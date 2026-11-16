#!/usr/bin/env bash
# Dry run of pull-backup.sh against a local directory as the server, with stubs
# for ssh and scp. Also checks the launchd template. Needs only sqlite3 and
# python3 and runs on macOS bash 3.2 and Linux.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pull="$repo/deploy/pull-backup.sh"
plist="$repo/deploy/pl.autoscore.pull-backup.plist"
work=$(mktemp -d "${TMPDIR:-/tmp}/test-pull-backup.XXXXXX")
trap 'rm -rf -- "$work"' EXIT

unset AUTOSCORE_SSH AUTOSCORE_SSH_PORT AUTOSCORE_REMOTE_BACKUP_DIR
unset AUTOSCORE_LOCAL_BACKUP_DIR AUTOSCORE_LOCAL_BACKUP_KEEP

bin="$work/bin"
mkdir "$bin"

# Runs the remote command locally. stdin passes through, so the heredoc that
# lists the backups reaches the shell.
cat > "$bin/ssh" <<'EOF'
#!/bin/sh
if [ -e "$STUB_SSH_FAIL" ]; then exit 255; fi
while [ "$#" -gt 0 ]; do
  case "$1" in
    -p | -o) shift 2 ;;
    *) break ;;
  esac
done
shift
exec sh -c "$*"
EOF

cat > "$bin/scp" <<'EOF'
#!/bin/sh
while [ "$#" -gt 0 ]; do
  case "$1" in
    -q) shift ;;
    -P | -o) shift 2 ;;
    *) break ;;
  esac
done
exec cp "${1#*:}" "$2"
EOF
chmod +x "$bin"/*

passed=0
failed=0
scenario=0
name=""
dir=""
remote=""
local_dir=""
code=0

setup() {
  scenario=$((scenario + 1))
  name="$1"
  dir="$work/$scenario"
  remote="$dir/remote"
  local_dir="$dir/local"
  mkdir -p "$remote" "$local_dir"
  : > "$dir/out.log"
  : > "$dir/err.log"
}

pass() {
  passed=$((passed + 1))
  echo "ok $scenario: $name"
}

fail() {
  failed=$((failed + 1))
  echo "FAIL $scenario: $name: $1"
  sed 's/^/    /' "$dir/out.log" "$dir/err.log"
}

run_pull() {
  code=0
  PATH="$bin:$PATH" STUB_SSH_FAIL="$dir/ssh-fails" \
    bash "$pull" --ssh test@server --port 2222 \
    --remote-dir "$remote" --local-dir "$local_dir" "$@" \
    > "$dir/out.log" 2> "$dir/err.log" || code=$?
}

stamp_at() {
  date -u -d "@$1" +%Y%m%dT%H%M%SZ 2> /dev/null || date -u -r "$1" +%Y%m%dT%H%M%SZ
}

# Backup file name stamped the given number of hours before now.
backup_name() {
  echo "autoscore-$(stamp_at $(($(date -u +%s) - $1 * 3600))).sqlite"
}

good_db() {
  sqlite3 "$1" "CREATE TABLE throws (id integer PRIMARY KEY, segment integer NOT NULL);
INSERT INTO throws (segment) VALUES (20), (5), (1);"
}

# The file opens but fails integrity_check. Some builds of the sqlite3 shell,
# such as Ubuntu's, start in defensive mode, which forbids writing the schema.
corrupt_db() {
  sqlite3 -cmd '.dbconfig defensive off' "$1" "CREATE TABLE t (x, y);
CREATE INDEX i ON t (x);
WITH RECURSIVE n (v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < 300)
INSERT INTO t SELECT v, 300 - v FROM n;
PRAGMA writable_schema = ON;
UPDATE sqlite_schema SET sql = 'CREATE INDEX i ON t (y)' WHERE name = 'i';" > /dev/null
}

local_files() {
  local LC_ALL=C f out=""
  for f in "$local_dir"/* "$local_dir"/.*; do
    case "${f##*/}" in
      . | ..) continue ;;
    esac
    if [ -e "$f" ]; then
      out="$out${f##*/} "
    fi
  done
  printf '%s' "$out"
}

is_ok_db() {
  [ "$(sqlite3 "$1" 'PRAGMA integrity_check;' 2>&1)" = ok ]
}

setup "new fresh copy"
file=$(backup_name 2)
good_db "$remote/$file"
run_pull
if [ "$code" != 0 ]; then
  fail "exited $code"
elif ! is_ok_db "$local_dir/$file"; then
  fail "the local copy is missing or broken"
elif [ "$(local_files)" != "$file " ]; then
  fail "unexpected local files: $(local_files)"
else
  pass
fi

setup "fresh file already local"
file=$(backup_name 2)
good_db "$remote/$file"
good_db "$local_dir/$file"
cp -- "$local_dir/$file" "$dir/before"
run_pull
if [ "$code" != 0 ]; then
  fail "exited $code"
elif ! grep -q "nothing to copy" "$dir/out.log"; then
  fail "no 'nothing to copy' line"
elif ! cmp -s "$dir/before" "$local_dir/$file"; then
  fail "the local file changed"
else
  pass
fi

setup "stale file already local, server cron dead"
file=$(backup_name 49)
good_db "$remote/$file"
good_db "$local_dir/$file"
run_pull
if [ "$code" != 3 ]; then
  fail "exited $code, expected 3"
else
  pass
fi

setup "corrupt database on the server"
old=$(backup_name 30)
file=$(backup_name 2)
good_db "$local_dir/$old"
cp -- "$local_dir/$old" "$dir/before"
corrupt_db "$remote/$file"
run_pull
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif [ "$(local_files)" != "$old " ]; then
  fail "unexpected local files: $(local_files)"
elif ! cmp -s "$dir/before" "$local_dir/$old"; then
  fail "the earlier local copy changed"
else
  pass
fi

setup "server file is not a database"
old=$(backup_name 30)
file=$(backup_name 2)
good_db "$local_dir/$old"
cp -- "$local_dir/$old" "$dir/before"
echo "not a database" > "$remote/$file"
run_pull
if [ "$code" != 2 ]; then
  fail "exited $code, expected 2"
elif [ "$(local_files)" != "$old " ]; then
  fail "unexpected local files: $(local_files)"
elif ! cmp -s "$dir/before" "$local_dir/$old"; then
  fail "the earlier local copy changed"
else
  pass
fi

setup "new copy 49 h old"
file=$(backup_name 49)
good_db "$remote/$file"
run_pull
if [ "$code" != 3 ]; then
  fail "exited $code, expected 3"
elif ! is_ok_db "$local_dir/$file"; then
  fail "the copy was not kept"
elif ! grep -q "$file is 49 h old" "$dir/err.log"; then
  fail "stderr does not name the file and its age"
else
  pass
fi

setup "new copy 47 h old"
file=$(backup_name 47)
good_db "$remote/$file"
run_pull
if [ "$code" != 0 ]; then
  fail "exited $code"
elif ! is_ok_db "$local_dir/$file"; then
  fail "the copy was not kept"
else
  pass
fi

setup "pruning with --keep 2"
kept=$(backup_name 50)
good_db "$local_dir/$(backup_name 96)"
good_db "$local_dir/$(backup_name 72)"
good_db "$local_dir/$kept"
file=$(backup_name 1)
good_db "$remote/$file"
run_pull --keep 2
if [ "$code" != 0 ]; then
  fail "exited $code"
elif [ "$(local_files)" != "$kept $file " ]; then
  fail "unexpected local files: $(local_files)"
else
  pass
fi

setup "empty server directory"
run_pull
if [ "$code" != 1 ]; then
  fail "exited $code, expected 1"
elif [ -n "$(local_files)" ]; then
  fail "unexpected local files: $(local_files)"
else
  pass
fi

setup "ssh fails with 255"
good_db "$remote/$(backup_name 2)"
touch "$dir/ssh-fails"
run_pull
if [ "$code" != 1 ]; then
  fail "exited $code, expected 1"
elif [ -n "$(local_files)" ]; then
  fail "unexpected local files: $(local_files)"
else
  pass
fi

setup "bad --keep"
good_db "$remote/$(backup_name 2)"
run_pull --keep 0
zero=$code
run_pull --keep x
if [ "$zero" != 1 ]; then
  fail "--keep 0 exited $zero, expected 1"
elif [ "$code" != 1 ]; then
  fail "--keep x exited $code, expected 1"
elif [ -n "$(local_files)" ]; then
  fail "unexpected local files: $(local_files)"
else
  pass
fi

setup "launchd template"
code=0
python3 - "$plist" > "$dir/out.log" 2> "$dir/err.log" <<'EOF' || code=$?
import plistlib, sys
with open(sys.argv[1], "rb") as f:
    p = plistlib.load(f)
assert p["Label"] == "pl.autoscore.pull-backup", p["Label"]
args = p["ProgramArguments"]
assert args[0] == "/bin/bash", args
assert args[-1].endswith("deploy/pull-backup.sh"), args
assert p["StartCalendarInterval"]["Hour"] == 9, p["StartCalendarInterval"]
assert p["StandardOutPath"] and p["StandardErrorPath"]
EOF
if [ "$code" != 0 ]; then
  fail "plist check exited $code"
elif command -v plutil > /dev/null && ! plutil -lint "$plist" > "$dir/out.log" 2>&1; then
  fail "plutil -lint failed"
else
  pass
fi

if [ "$failed" -gt 0 ]; then
  echo "$passed passed, $failed failed"
  exit 1
fi
echo "$passed passed"
