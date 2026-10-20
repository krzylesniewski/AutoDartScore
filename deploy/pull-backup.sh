#!/usr/bin/env bash
# Copies the newest server backup to this machine. Runs on macOS bash 3.2.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pull-backup.sh --ssh <user@host> --local-dir <dir> [--port <n>] [--remote-dir <dir>]

Fallbacks: AUTOSCORE_SSH, AUTOSCORE_SSH_PORT (default 22),
AUTOSCORE_REMOTE_BACKUP_DIR (default /home/autoscore/backups/daily),
AUTOSCORE_LOCAL_BACKUP_DIR.
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

ssh_target="${AUTOSCORE_SSH:-}"
port="${AUTOSCORE_SSH_PORT:-22}"
remote_dir="${AUTOSCORE_REMOTE_BACKUP_DIR:-/home/autoscore/backups/daily}"
local_dir="${AUTOSCORE_LOCAL_BACKUP_DIR:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ssh | --port | --remote-dir | --local-dir)
      [ "$#" -ge 2 ] || die "$1 needs a value"
      case "$1" in
        --ssh) ssh_target="$2" ;;
        --port) port="$2" ;;
        --remote-dir) remote_dir="$2" ;;
        --local-dir) local_dir="$2" ;;
      esac
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
done

[ -n "$ssh_target" ] || die "missing --ssh <user@host> or AUTOSCORE_SSH"
[ -n "$local_dir" ] || die "missing --local-dir <dir> or AUTOSCORE_LOCAL_BACKUP_DIR"
mkdir -p "$local_dir"

# ssh joins its arguments into one remote command line, so the directory is
# quoted for the remote shell.
newest=$(ssh -p "$port" "$ssh_target" "bash -s -- $(printf '%q' "$remote_dir")" <<'EOF'
set -euo pipefail
shopt -s nullglob
export LC_ALL=C
files=("$1"/autoscore-*.sqlite)
if [ "${#files[@]}" -gt 0 ]; then
  basename "${files[${#files[@]}-1]}"
fi
EOF
)

case "$newest" in
  '') die "no autoscore-*.sqlite in $remote_dir on $ssh_target" ;;
  */* | .*) die "unexpected file name from the server: $newest" ;;
esac

local_file="$local_dir/$newest"
if [ -e "$local_file" ]; then
  echo "$local_file already exists, nothing to copy"
  exit 0
fi

# A partial copy under the final name would be skipped on every later run.
partial="$local_dir/.$newest.partial"
trap 'rm -f -- "$partial"' EXIT
scp -q -P "$port" "$ssh_target:$remote_dir/$newest" "$partial"

result=$(sqlite3 "$partial" 'PRAGMA integrity_check;')
if [ "$result" != "ok" ]; then
  echo "integrity check failed for $newest:" >&2
  echo "$result" >&2
  exit 1
fi
mv -- "$partial" "$local_file"
echo "copied $newest to $local_file, integrity ok"
