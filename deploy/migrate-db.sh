#!/usr/bin/env bash
# One-off move of a local SQLite database to the server, or to another local
# file. Runs on macOS bash 3.2.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  migrate-db.sh --local <source.sqlite> <target.sqlite> [--force]
  migrate-db.sh <source.sqlite> --ssh <user@host> [--port <n>] --remote-db <path>
                [--service <name>] [--health-url <url>] [--force]

Fallbacks: AUTOSCORE_SOURCE_DB, AUTOSCORE_SSH, AUTOSCORE_SSH_PORT (default 22),
AUTOSCORE_REMOTE_DB. Defaults: service autoscore, health URL
http://[::1]:3000/health.

A target with rows in players, matches, throws or match_events needs --force.
An existing target is backed up to <target>.before-migrate-<UTC timestamp>.
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

tables="players matches throws match_events"
count_sql="SELECT (SELECT count(*) FROM players), (SELECT count(*) FROM matches), (SELECT count(*) FROM throws), (SELECT count(*) FROM match_events);"

# Prints the row counts of the four tables as a|b|c|d. Fails on a missing table.
row_counts() {
  sqlite3 -readonly "$1" "$count_sql"
}

describe_counts() {
  echo "$1" | awk -F'|' '{ printf "players=%s matches=%s throws=%s match_events=%s\n", $1, $2, $3, $4 }'
}

is_database() {
  sqlite3 -readonly "$1" 'SELECT count(*) FROM sqlite_master;' > /dev/null 2>&1
}

has_table() {
  [ "$(sqlite3 -readonly "$1" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '$2';")" != "0" ]
}

# A database that only went through the server's migrations counts as empty.
is_non_empty_target() {
  local db="$1" table
  [ -s "$db" ] || return 1
  is_database "$db" || return 0
  for table in $tables; do
    if has_table "$db" "$table" && [ "$(sqlite3 -readonly "$db" "SELECT count(*) FROM $table;")" != "0" ]; then
      return 0
    fi
  done
  return 1
}

migration_names() {
  if has_table "$1" kysely_migration; then
    sqlite3 -readonly "$1" 'SELECT name FROM kysely_migration ORDER BY name;'
  fi
}

# Older code refuses a database with migrations it does not know.
check_migrations() {
  local source="$1" target="$2" target_names name
  is_database "$target" && has_table "$target" kysely_migration || return 0
  target_names=$(migration_names "$target")
  for name in $(migration_names "$source"); do
    if ! printf '%s\n' "$target_names" | grep -Fxq -- "$name"; then
      die "the target lacks migration $name, deploy the newer main to the server first"
    fi
  done
}

mode=remote
force=0
source_db="${AUTOSCORE_SOURCE_DB:-}"
ssh_target="${AUTOSCORE_SSH:-}"
port="${AUTOSCORE_SSH_PORT:-22}"
remote_db="${AUTOSCORE_REMOTE_DB:-}"
service=autoscore
health_url="http://[::1]:3000/health"
positional_1=""
positional_2=""
positional_count=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --local)
      mode=local
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    --ssh | --port | --remote-db | --service | --health-url)
      [ "$#" -ge 2 ] || die "$1 needs a value"
      case "$1" in
        --ssh) ssh_target="$2" ;;
        --port) port="$2" ;;
        --remote-db) remote_db="$2" ;;
        --service) service="$2" ;;
        --health-url) health_url="$2" ;;
      esac
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      usage >&2
      exit 1
      ;;
    *)
      positional_count=$((positional_count + 1))
      case "$positional_count" in
        1) positional_1="$1" ;;
        2) positional_2="$1" ;;
        *) die "too many arguments" ;;
      esac
      shift
      ;;
  esac
done

if [ "$mode" = local ]; then
  case "$positional_count" in
    2)
      source_db="$positional_1"
      target_db="$positional_2"
      ;;
    1) target_db="$positional_1" ;;
    *) die "--local needs <source.sqlite> <target.sqlite>" ;;
  esac
else
  [ "$positional_count" -le 1 ] || die "remote mode takes one source database"
  [ "$positional_count" = 0 ] || source_db="$positional_1"
  [ -n "$ssh_target" ] || die "missing --ssh <user@host> or AUTOSCORE_SSH"
  [ -n "$remote_db" ] || die "missing --remote-db <path> or AUTOSCORE_REMOTE_DB"
  case "$remote_db" in
    /*) ;;
    *) die "--remote-db must be an absolute path" ;;
  esac
fi
[ -n "$source_db" ] || die "missing the source database or AUTOSCORE_SOURCE_DB"
[ -f "$source_db" ] || die "source database not found: $source_db"

work=$(mktemp -d "${TMPDIR:-/tmp}/autoscore-migrate.XXXXXX")
remote_tmp=""
cleanup() {
  rm -rf -- "$work"
  if [ -n "$remote_tmp" ]; then
    ssh -p "$port" "$ssh_target" "rm -rf -- $(printf '%q' "$remote_tmp")" || true
  fi
}
trap cleanup EXIT

# .backup gives a consistent copy even if a server still has the file open.
snapshot="$work/autoscore.sqlite"
sqlite3 -readonly "$source_db" ".backup '$snapshot'" || die "cannot snapshot $source_db, is it an SQLite database?"
integrity=$(sqlite3 -readonly "$snapshot" 'PRAGMA integrity_check;' 2>&1 || true)
[ "$integrity" = "ok" ] || die "integrity check of $source_db failed: $integrity"
source_counts=$(row_counts "$snapshot") || die "$source_db lacks one of the tables: $tables"
echo "source $source_db: integrity ok"
echo "source counts: $(describe_counts "$source_counts")"

if [ "$mode" = local ]; then
  if [ -e "$target_db" ]; then
    check_migrations "$snapshot" "$target_db"
    if is_non_empty_target "$target_db" && [ "$force" = 0 ]; then
      die "$target_db is not empty, use --force to replace it"
    fi
    before="$target_db.before-migrate-$(date -u +%Y%m%dT%H%M%SZ)"
    [ ! -e "$before" ] || die "$before already exists"
    if is_database "$target_db"; then
      sqlite3 -readonly "$target_db" ".backup '$before'"
    else
      cp -p -- "$target_db" "$before"
    fi
    echo "backed up the old target to $before"
  fi
  # Copy next to the target and rename, so the target is never half-written.
  cp -- "$snapshot" "$target_db.migrate-new"
  mv -- "$target_db.migrate-new" "$target_db"
  rm -f -- "$target_db-journal"
  integrity=$(sqlite3 -readonly "$target_db" 'PRAGMA integrity_check;')
  [ "$integrity" = "ok" ] || die "integrity check of $target_db failed: $integrity"
  target_counts=$(row_counts "$target_db")
  [ "$target_counts" = "$source_counts" ] || die "target counts differ: $(describe_counts "$target_counts")"
  echo "target $target_db: integrity ok, counts equal"
  exit 0
fi

remote_tmp=$(ssh -p "$port" "$ssh_target" 'mktemp -d /tmp/autoscore-migrate.XXXXXX')
case "$remote_tmp" in
  /tmp/autoscore-migrate.*) ;;
  *)
    remote_tmp=""
    die "unexpected remote temp directory"
    ;;
esac
scp -q -P "$port" "$snapshot" "$ssh_target:$remote_tmp/autoscore.sqlite"
echo "uploaded the snapshot to $ssh_target:$remote_tmp"

# ssh joins its arguments into one remote command line, so each one is quoted
# for the remote shell. The script itself is a quoted heredoc and needs no
# escaping.
remote_args=""
for arg in "$remote_tmp" "$remote_db" "$service" "$health_url" "$force" "$source_counts"; do
  remote_args="$remote_args $(printf '%q' "$arg")"
done
ssh -p "$port" "$ssh_target" "bash -s --$remote_args" <<'EOF'
set -euo pipefail
tmp="$1" target="$2" service="$3" health_url="$4" force="$5" expected="$6"
snapshot="$tmp/autoscore.sqlite"
stopped=0
started=0
before=""

as_root() {
  if [ "$(id -u)" = 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

on_exit() {
  local code=$?
  rm -rf -- "$tmp"
  if [ "$stopped" = 1 ] && [ "$started" = 0 ]; then
    echo "migration failed with $service stopped, starting it again" >&2
    as_root systemctl start "$service" || true
  fi
  if [ "$code" != 0 ] && [ -n "$before" ]; then
    echo "the database before the migration is in $before" >&2
  fi
}
trap on_exit EXIT

die() {
  echo "$*" >&2
  exit 1
}

count_sql="SELECT (SELECT count(*) FROM players), (SELECT count(*) FROM matches), (SELECT count(*) FROM throws), (SELECT count(*) FROM match_events);"

is_database() {
  as_root sqlite3 -readonly "$1" 'SELECT count(*) FROM sqlite_master;' > /dev/null 2>&1
}

has_table() {
  [ "$(as_root sqlite3 -readonly "$1" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '$2';")" != "0" ]
}

integrity=$(sqlite3 -readonly "$snapshot" 'PRAGMA integrity_check;' 2>&1 || true)
[ "$integrity" = "ok" ] || die "integrity check of the uploaded snapshot failed: $integrity"
counts=$(sqlite3 -readonly "$snapshot" "$count_sql")
[ "$counts" = "$expected" ] || die "uploaded counts $counts differ from local $expected, the live database is untouched"
echo "uploaded snapshot: integrity ok, counts equal"

as_root test -d "$(dirname "$target")" || die "directory of $target does not exist"
if as_root test -e "$target"; then
  if is_database "$target" && has_table "$target" kysely_migration; then
    target_names=$(as_root sqlite3 -readonly "$target" 'SELECT name FROM kysely_migration;')
    source_names=""
    if has_table "$snapshot" kysely_migration; then
      source_names=$(sqlite3 -readonly "$snapshot" 'SELECT name FROM kysely_migration;')
    fi
    for name in $source_names; do
      printf '%s\n' "$target_names" | grep -Fxq -- "$name" ||
        die "the target lacks migration $name, deploy the newer main to the server first"
    done
  fi
  non_empty=0
  if as_root test -s "$target"; then
    if ! is_database "$target"; then
      non_empty=1
    else
      for table in players matches throws match_events; do
        if has_table "$target" "$table" && [ "$(as_root sqlite3 -readonly "$target" "SELECT count(*) FROM $table;")" != "0" ]; then
          non_empty=1
        fi
      done
    fi
  fi
  if [ "$non_empty" = 1 ] && [ "$force" = 0 ]; then
    die "$target is not empty, use --force to replace it"
  fi
fi

echo "stopping $service"
as_root systemctl stop "$service"
stopped=1

if as_root test -e "$target"; then
  before="$target.before-migrate-$(date -u +%Y%m%dT%H%M%SZ)"
  as_root test ! -e "$before" || die "$before already exists"
  if is_database "$target"; then
    as_root sqlite3 -readonly "$target" ".backup '$before'"
  else
    as_root cp -p -- "$target" "$before"
  fi
  echo "backed up the old target to $before"
fi

as_root cp -- "$snapshot" "$target.migrate-new"
as_root chown autoscore:autoscore "$target.migrate-new"
as_root mv -- "$target.migrate-new" "$target"
as_root rm -f -- "$target-journal"
echo "moved the snapshot to $target"

echo "starting $service"
as_root systemctl start "$service"
started=1

deadline=$((SECONDS + 30))
while [ "$SECONDS" -lt "$deadline" ]; do
  code=$(curl --globoff --silent --output /dev/null --write-out '%{http_code}' --max-time 2 "$health_url" || true)
  if [ "$code" = "200" ]; then
    echo "$health_url returned 200, migration done"
    exit 0
  fi
  sleep 1
done
die "$health_url did not return 200 within 30 s"
EOF
