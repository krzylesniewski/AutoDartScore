#!/usr/bin/env bash
# Deploys one commit from origin/main as the autoscore user, builds the front
# when AUTOSCORE_WEB_DIR is set, and rolls back the commit, the front and the
# database when any step fails.
#
#   deploy.sh <40-character sha>
#
# As the forced command of the deploy key, the SHA comes from
# SSH_ORIGINAL_COMMAND. Exit codes: 0 deployed, 1 rejected or failed before
# any change, 2 deploy failed and rollback succeeded, 3 rollback failed too.
set -euo pipefail

app_dir="${AUTOSCORE_APP_DIR:-/home/autoscore/app}"
env_file="${AUTOSCORE_ENV_FILE:-/etc/autoscore/autoscore.env}"
backup_dir="${AUTOSCORE_BACKUP_DIR:-/home/autoscore/backups}"
log_dir="${AUTOSCORE_LOG_DIR:-/home/autoscore/logs}"
service="${AUTOSCORE_SERVICE:-autoscore}"
keep_backups=14

target=""
previous=""
db=""
health_url=""
backup_file=""
db_absent=0
web_dir=""
public_url=""

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

finish() {
  local result="$1" code="$2"
  if [ "$code" -ge 2 ]; then
    echo "last 50 lines of the $service journal:"
    journalctl -u "$service" -n 50 --no-pager || true
  fi
  log "result=$result previous=${previous:-unknown} target=${target:-invalid} exit=$code"
  exit "$code"
}

wait_for_health() {
  local deadline=$((SECONDS + 30)) code
  while [ "$SECONDS" -lt "$deadline" ]; do
    # curl exits non-zero until the server listens, which set -e must not see.
    code=$(curl --globoff --silent --output /dev/null --write-out '%{http_code}' --max-time 2 "$health_url" || true)
    if [ "$code" = "200" ]; then
      log "$health_url returned 200"
      return 0
    fi
    sleep 1
  done
  log "$health_url did not return 200 within 30 s"
  return 1
}

install_deps() {
  (cd "$app_dir" && pnpm install --frozen-lockfile)
}

# AUTOSCORE_WEB_DIR only switches the build on. The build always writes
# packages/web/dist. The server has 1 GB of RAM, hence the heap limit.
build_web() {
  if [ -z "$web_dir" ]; then
    return 0
  fi
  log "building the front for $public_url"
  (cd "$app_dir" && VITE_API_URL="$public_url" VITE_BASE=/ NODE_OPTIONS=--max-old-space-size=512 pnpm --filter @autoscore/web build)
}

# Called as an if condition, where set -e is off, so every step checks its own
# status.
deploy_target() {
  log "checking out $target"
  git -C "$app_dir" checkout --quiet --detach "$target" || return 1
  install_deps || return 1
  build_web || return 1

  log "stopping $service"
  sudo -n systemctl stop "$service" || return 1

  if [ -e "$db" ]; then
    mkdir -p "$backup_dir/deploy" || return 1
    local file
    file="$backup_dir/deploy/autoscore-$(utc_stamp)-${previous:0:7}.sqlite"
    sqlite3 "$db" ".backup '$file'" || return 1
    backup_file="$file"
    log "backed up the database to $backup_file"
    prune_backups "$backup_dir/deploy" "$keep_backups" || return 1
  else
    db_absent=1
    log "no database at $db yet, skipping the backup"
  fi

  log "starting $service"
  sudo -n systemctl start "$service" || return 1
  wait_for_health || return 1
}

rollback() {
  log "rolling back to $previous"
  sudo -n systemctl stop "$service" || return 1

  # The failed database is kept for inspection, never deleted.
  local failed
  failed="$db.failed-$(utc_stamp)"
  if [ -n "$backup_file" ]; then
    if [ -e "$db" ]; then
      mv -- "$db" "$failed" || return 1
      log "moved the failed database to $failed"
    fi
    cp -- "$backup_file" "$db" || return 1
    rm -f -- "$db-journal" || return 1
    log "restored the database from $backup_file"
  elif [ "$db_absent" = 1 ] && [ -e "$db" ]; then
    # The new code created this database. Its migrations would stop the
    # previous code from starting.
    mv -- "$db" "$failed" || return 1
    rm -f -- "$db-journal" || return 1
    log "moved the database created by the failed deploy to $failed"
  fi

  # The tree was clean before the deploy, so forcing only drops what a
  # half-done checkout left behind.
  git -C "$app_dir" checkout --quiet --force --detach "$previous" || return 1
  install_deps || return 1
  build_web || return 1
  sudo -n systemctl start "$service" || return 1
  wait_for_health || return 1
}

# The whole body lives in main, because git checkout rewrites this file while
# it runs and bash reads scripts lazily.
main() {
  mkdir -p "$log_dir"
  exec > >(tee -a "$log_dir/deploy.log") 2>&1
  tee_pid=$!
  # Closing our end of the pipe lets tee write the last lines before the SSH
  # session ends.
  trap 'exec >&- 2>&-; wait "$tee_pid" 2>/dev/null || true' EXIT

  local input
  if [ -n "${SSH_ORIGINAL_COMMAND+set}" ]; then
    input="$SSH_ORIGINAL_COMMAND"
  else
    input="${1:-}"
  fi
  log "deploy requested: $(printf '%q' "$input")"
  if [[ ! "$input" =~ ^[0-9a-f]{40}$ ]]; then
    echo "expected a full 40-character lowercase commit SHA"
    finish rejected 1
  fi
  target="$input"

  exec 9> "$log_dir/deploy.lock"
  if ! flock -n 9; then
    echo "another deploy is running"
    finish rejected 1
  fi

  # shellcheck source=deploy/lib.sh
  source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

  if [ ! -r "$env_file" ]; then
    echo "cannot read $env_file"
    finish rejected 1
  fi
  local host port
  host=$(env_file_value "$env_file" HOST)
  port=$(env_file_value "$env_file" PORT)
  port="${port:-3000}"
  db=$(env_file_value "$env_file" DATABASE_PATH)
  case "$db" in
    /*) ;;
    *)
      echo "DATABASE_PATH in $env_file must be an absolute path"
      finish rejected 1
      ;;
  esac
  web_dir=$(env_file_value "$env_file" AUTOSCORE_WEB_DIR)
  public_url=$(env_file_value "$env_file" AUTOSCORE_PUBLIC_URL)
  if [ -n "$web_dir" ] && [[ ! "$public_url" =~ ^https?:// ]]; then
    echo "AUTOSCORE_PUBLIC_URL in $env_file must start with http:// or https:// when AUTOSCORE_WEB_DIR is set"
    finish rejected 1
  fi
  if [ -n "${AUTOSCORE_HEALTH_URL:-}" ]; then
    health_url="$AUTOSCORE_HEALTH_URL"
  elif [[ "$host" == *:* ]]; then
    health_url="http://[::1]:$port/health"
  else
    health_url="http://127.0.0.1:$port/health"
  fi

  export CI=true

  previous=$(git -C "$app_dir" rev-parse HEAD)
  if [ -n "$(git -C "$app_dir" status --porcelain)" ]; then
    echo "the checkout in $app_dir has local changes"
    git -C "$app_dir" status --short
    finish rejected 1
  fi

  if ! git -C "$app_dir" fetch --quiet origin main; then
    echo "git fetch origin main failed"
    finish failed 1
  fi
  if ! git -C "$app_dir" cat-file -e "$target^{commit}" 2>/dev/null; then
    echo "commit $target does not exist"
    finish rejected 1
  fi
  if ! git -C "$app_dir" merge-base --is-ancestor "$target" origin/main; then
    echo "commit $target is not on origin/main"
    finish rejected 1
  fi

  log "previous=$previous target=$target"

  if deploy_target; then
    finish deployed 0
  fi
  log "deploy of $target failed"
  if rollback; then
    finish rolled-back 2
  fi
  log "rollback to $previous failed"
  finish rollback-failed 3
}

main "$@"
