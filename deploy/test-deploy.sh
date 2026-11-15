#!/usr/bin/env bash
# Dry run of deploy.sh and its rollback on a throwaway clone, with stubs for
# sudo, systemctl, curl, journalctl and pnpm. Needs only git and sqlite3 and
# runs on macOS bash 3.2 and Linux.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy="$repo/deploy/deploy.sh"
work=$(mktemp -d "${TMPDIR:-/tmp}/test-deploy.XXXXXX")
trap 'rm -rf -- "$work"' EXIT

# deploy.sh prefers this over its argument.
unset SSH_ORIGINAL_COMMAND
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

bin="$work/bin"
mkdir "$bin"

cat > "$bin/sudo" <<'EOF'
#!/bin/sh
if [ "$1" = -n ]; then shift; fi
exec "$@"
EOF

cat > "$bin/systemctl" <<'EOF'
#!/bin/sh
echo "$1" >> "$STUB_EVENTS"
case "$1" in
  stop) echo stopped > "$STUB_STATE" ;;
  start)
    if [ -e "$STUB_APP/fail-start" ] || [ -e "$STUB_FAIL_START" ]; then
      echo stopped > "$STUB_STATE"
      exit 1
    fi
    echo running > "$STUB_STATE"
    ;;
esac
EOF

cat > "$bin/curl" <<'EOF'
#!/bin/sh
if [ "$(cat "$STUB_STATE")" = running ]; then printf 200; else printf 000; fi
EOF

cat > "$bin/journalctl" <<'EOF'
#!/bin/sh
EOF

cat > "$bin/pnpm" <<'EOF'
#!/bin/sh
out=dist
command=""
previous=""
for arg in "$@"; do
  case "$arg" in
    install | build) command="$arg" ;;
  esac
  if [ "$previous" = --outDir ]; then out="$arg"; fi
  previous="$arg"
done
echo "$command" >> "$STUB_EVENTS"
if [ "$command" = build ]; then
  mkdir -p "packages/web/$out"
  if [ -e fail-build ]; then
    echo partial > "packages/web/$out/partial.js"
    exit 1
  fi
  git rev-parse HEAD > "packages/web/$out/index.html"
fi
EOF

if ! command -v flock > /dev/null; then
  printf '#!/bin/sh\n' > "$bin/flock"
fi
chmod +x "$bin"/*

passed=0
failed=0
scenario=0
name=""
dir=""
app=""
web=""
db=""
previous=""
target=""
third=""
code=0

commit() {
  git -C "$dir/src" add -A
  git -C "$dir/src" commit --quiet -m "$1"
  git -C "$dir/src" rev-parse HEAD
}

write_env() {
  printf 'HOST=127.0.0.1\nDATABASE_PATH=%s\nAUTOSCORE_WEB_DIR=%s\nAUTOSCORE_PUBLIC_URL=http://app.test\n' \
    "$db" "$1" > "$dir/autoscore.env"
}

# setup <name> [marker in the target commit] [no-dist]
setup() {
  scenario=$((scenario + 1))
  name="$1"
  local marker="${2:-}" seed="${3:-}"
  dir="$work/$scenario"
  app="$dir/app"
  web="$app/packages/web"
  db="$dir/data/autoscore.sqlite"
  mkdir -p "$dir/src" "$dir/data"

  git -c init.defaultBranch=main init --quiet "$dir/src"
  git -C "$dir/src" symbolic-ref HEAD refs/heads/main
  # Like every commit from before deploy.sh ignored dist.new and dist.prev.
  printf 'dist/\n' > "$dir/src/.gitignore"
  echo previous > "$dir/src/version.txt"
  previous=$(commit previous)
  echo target > "$dir/src/version.txt"
  if [ -n "$marker" ]; then
    touch "$dir/src/$marker"
  fi
  target=$(commit target)
  rm -f -- "$dir/src/fail-build" "$dir/src/fail-start"
  echo third > "$dir/src/version.txt"
  third=$(commit third)
  git clone --quiet --bare "$dir/src" "$dir/origin.git"
  git clone --quiet "$dir/origin.git" "$app"
  git -C "$app" checkout --quiet --detach "$previous"

  sqlite3 "$db" "CREATE TABLE throws (id integer PRIMARY KEY, segment integer NOT NULL);
INSERT INTO throws (segment) VALUES (20), (5), (1);"
  write_env "$web/dist"
  echo running > "$dir/state"
  : > "$dir/events.log"
  : > "$dir/out.log"
  if [ "$seed" != no-dist ]; then
    mkdir -p "$web/dist"
    echo "$previous" > "$web/dist/index.html"
  fi
}

# .backup still copies this database, but the copy fails integrity_check.
corrupt_db() {
  rm -f -- "$db"
  sqlite3 "$db" "CREATE TABLE t (x, y);
CREATE INDEX i ON t (x);
WITH RECURSIVE n (v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < 300)
INSERT INTO t SELECT v, 300 - v FROM n;
PRAGMA writable_schema = ON;
UPDATE sqlite_schema SET sql = 'CREATE INDEX i ON t (y)' WHERE name = 'i';"
}

run_deploy() {
  code=0
  PATH="$bin:$PATH" \
    AUTOSCORE_APP_DIR="$app" \
    AUTOSCORE_ENV_FILE="$dir/autoscore.env" \
    AUTOSCORE_BACKUP_DIR="$dir/backups" \
    AUTOSCORE_LOG_DIR="$dir/logs" \
    AUTOSCORE_SERVICE=autoscore-test \
    AUTOSCORE_HEALTH_URL=http://app.test/health \
    STUB_EVENTS="$dir/events.log" \
    STUB_STATE="$dir/state" \
    STUB_APP="$app" \
    STUB_FAIL_START="$dir/fail-start-always" \
    "$BASH" "$deploy" "$1" >> "$dir/out.log" 2>&1 || code=$?
}

pass() {
  passed=$((passed + 1))
  echo "ok $scenario: $name"
}

fail() {
  failed=$((failed + 1))
  echo "FAIL $scenario: $name: $1"
  sed 's/^/    /' "$dir/out.log"
}

head_is() {
  [ "$(git -C "$app" rev-parse HEAD)" = "$1" ]
}

# front_is <directory under packages/web> <sha>
front_is() {
  [ -f "$web/$1/index.html" ] && [ "$(cat "$web/$1/index.html")" = "$2" ]
}

count_events() {
  grep -cx -- "$1" "$dir/events.log" || true
}

first_event_of() {
  grep -x -m 1 -e "$1" -e "$2" "$dir/events.log" || true
}

deploy_backups() {
  local file
  for file in "$dir/backups/deploy"/*; do
    if [ -e "$file" ]; then
      echo "$file"
    fi
  done
}

has_failed_db() {
  local file
  for file in "$db".failed-*; do
    [ -e "$file" ] && return 0
  done
  return 1
}

setup "successful deploy"
run_deploy "$target"
backups=$(deploy_backups)
if [ "$code" != 0 ]; then
  fail "exited $code"
elif ! head_is "$target"; then
  fail "HEAD is not the target"
elif ! front_is dist "$target"; then
  fail "dist does not hold the target front"
elif ! front_is dist.prev "$previous"; then
  fail "dist.prev does not hold the previous front"
elif [ -e "$web/dist.new" ]; then
  fail "dist.new is left behind"
elif [ "$(first_event_of build stop)" != build ]; then
  fail "the front was not built before the stop"
elif [ -z "$backups" ] || [ "$(echo "$backups" | wc -l | tr -d ' ')" != 1 ]; then
  fail "expected one file in backups/deploy"
elif [ "$(sqlite3 "$backups" 'PRAGMA integrity_check;')" != ok ]; then
  fail "the deploy backup fails integrity_check"
else
  pass
fi

setup "second deploy"
run_deploy "$target"
if [ "$code" != 0 ]; then
  fail "first deploy exited $code"
else
  run_deploy "$third"
  if [ "$code" != 0 ]; then
    fail "second deploy exited $code"
  elif ! head_is "$third"; then
    fail "HEAD is not the third commit"
  elif ! front_is dist "$third"; then
    fail "dist does not hold the third front"
  elif [ -n "$(git -C "$app" status --porcelain)" ]; then
    fail "the tree is dirty"
  else
    pass
  fi
fi

setup "failed build" fail-build
cp -- "$db" "$dir/db.before"
run_deploy "$target"
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif [ "$(count_events stop)" != 0 ] || [ "$(count_events start)" != 0 ]; then
  fail "the service was stopped or started"
elif ! head_is "$previous"; then
  fail "HEAD is not the previous commit"
elif ! front_is dist "$previous"; then
  fail "dist does not hold the previous front"
elif [ -e "$web/dist.new" ]; then
  fail "dist.new is left behind"
elif [ -n "$(deploy_backups)" ]; then
  fail "a deploy backup was made"
elif ! cmp -s "$dir/db.before" "$db"; then
  fail "the database changed"
else
  pass
fi

setup "start fails after the swap" fail-start
run_deploy "$target"
backups=$(deploy_backups)
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif ! head_is "$previous"; then
  fail "HEAD is not the previous commit"
elif ! front_is dist "$previous"; then
  fail "dist does not hold the previous front"
elif [ "$(count_events build)" != 1 ]; then
  fail "expected one build, the rollback must not build"
elif ! has_failed_db; then
  fail "no $db.failed-* file"
elif [ -z "$backups" ] || ! cmp -s "$backups" "$db"; then
  fail "the database does not equal the deploy backup"
elif [ "$(cat "$dir/state")" != running ]; then
  fail "the service is not running"
else
  pass
fi

setup "corrupt database"
corrupt_db
cp -- "$db" "$dir/db.before"
run_deploy "$target"
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif [ -n "$(deploy_backups)" ]; then
  fail "a broken backup is left in backups/deploy"
elif ! cmp -s "$dir/db.before" "$db"; then
  fail "the database changed"
elif ! front_is dist "$previous"; then
  fail "dist does not hold the previous front"
else
  pass
fi

setup "rollback fails too"
touch "$dir/fail-start-always"
run_deploy "$target"
if [ "$code" != 3 ]; then
  fail "exited $code, expected 3"
else
  pass
fi

setup "web build off"
write_env ""
run_deploy "$target"
if [ "$code" != 0 ]; then
  fail "exited $code"
elif [ "$(count_events build)" != 0 ]; then
  fail "the front was built"
elif [ -e "$web/dist.new" ] || [ -e "$web/dist.prev" ]; then
  fail "dist.new or dist.prev exists"
else
  pass
fi

setup "start fails without an earlier front" fail-start no-dist
run_deploy "$target"
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif ! front_is dist "$previous"; then
  fail "dist does not hold the previous front"
elif [ "$(count_events build)" != 2 ]; then
  fail "expected two builds, the rollback must build the previous front"
else
  pass
fi

if [ "$failed" -gt 0 ]; then
  echo "$passed passed, $failed failed"
  exit 1
fi
echo "$passed passed"
