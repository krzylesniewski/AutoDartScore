#!/usr/bin/env bash
# Copies the newest server backup to this machine and keeps the newest local
# copies. Fails when the server stopped making backups. Runs on macOS bash 3.2.
set -euo pipefail

# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

max_age_hours=48

usage() {
  cat <<'EOF'
Usage: pull-backup.sh --ssh <user@host> --local-dir <dir> [--port <n>] [--remote-dir <dir>] [--keep <n>]

Fallbacks: AUTOSCORE_SSH, AUTOSCORE_SSH_PORT (default 22),
AUTOSCORE_REMOTE_BACKUP_DIR (default /home/autoscore/backups/daily),
AUTOSCORE_LOCAL_BACKUP_DIR, AUTOSCORE_LOCAL_BACKUP_KEEP (default 30).

Exit codes: 0 ok, 1 usage or transport error, 2 integrity check failed,
3 newest server backup older than 48 h.
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

# Days since 1970-01-01 for a Gregorian date (days_from_civil). Plain
# arithmetic works the same on GNU and BSD, unlike the flags of date.
days_from_civil() {
  local y="$1" m="$2" d="$3" era yoe doy doe
  if [ "$m" -le 2 ]; then
    y=$((y - 1))
    doy=$(((153 * (m + 9) + 2) / 5 + d - 1))
  else
    doy=$(((153 * (m - 3) + 2) / 5 + d - 1))
  fi
  era=$((y / 400))
  yoe=$((y - era * 400))
  doe=$((yoe * 365 + yoe / 4 - yoe / 100 + doy))
  echo $((era * 146097 + doe - 719468))
}

# Epoch seconds for a stamp like 20261115T031500Z. 10# keeps fields such as 08
# and 09 from being read as invalid octal.
stamp_epoch() {
  local s="$1" days
  days=$(days_from_civil "$((10#${s:0:4}))" "$((10#${s:4:2}))" "$((10#${s:6:2}))")
  echo $((days * 86400 + 10#${s:9:2} * 3600 + 10#${s:11:2} * 60 + 10#${s:13:2}))
}

echo "pull-backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"

ssh_target="${AUTOSCORE_SSH:-}"
port="${AUTOSCORE_SSH_PORT:-22}"
remote_dir="${AUTOSCORE_REMOTE_BACKUP_DIR:-/home/autoscore/backups/daily}"
local_dir="${AUTOSCORE_LOCAL_BACKUP_DIR:-}"
keep="${AUTOSCORE_LOCAL_BACKUP_KEEP:-30}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ssh | --port | --remote-dir | --local-dir | --keep)
      [ "$#" -ge 2 ] || die "$1 needs a value"
      case "$1" in
        --ssh) ssh_target="$2" ;;
        --port) port="$2" ;;
        --remote-dir) remote_dir="$2" ;;
        --local-dir) local_dir="$2" ;;
        --keep) keep="$2" ;;
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
case "$keep" in
  '' | *[!0-9]*) die "--keep must be a positive integer, got: $keep" ;;
esac
keep=$((10#$keep))
[ "$keep" -gt 0 ] || die "--keep must be a positive integer, got: 0"
mkdir -p "$local_dir"

# BatchMode makes a scheduled run fail instead of waiting for a password or
# host key prompt that nobody answers.
ssh_options=(-o BatchMode=yes -o ConnectTimeout=30)

# ssh joins its arguments into one remote command line, so the directory is
# quoted for the remote shell.
newest=$(ssh -p "$port" "${ssh_options[@]}" "$ssh_target" "bash -s -- $(printf '%q' "$remote_dir")" <<'EOF'
set -euo pipefail
shopt -s nullglob
export LC_ALL=C
files=("$1"/autoscore-*.sqlite)
if [ "${#files[@]}" -gt 0 ]; then
  basename "${files[${#files[@]}-1]}"
fi
EOF
) || die "listing backups on $ssh_target failed"

case "$newest" in
  '') die "no autoscore-*.sqlite in $remote_dir on $ssh_target" ;;
  */* | .*) die "unexpected file name from the server: $newest" ;;
esac
case "$newest" in
  autoscore-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.sqlite) ;;
  *) die "unexpected file name from the server: $newest" ;;
esac
stamp="${newest#autoscore-}"
stamp="${stamp%.sqlite}"

local_file="$local_dir/$newest"
if [ -e "$local_file" ]; then
  echo "$local_file already exists, nothing to copy"
else
  # A partial copy under the final name would be skipped on every later run.
  partial="$local_dir/.$newest.partial"
  trap 'rm -f -- "$partial"' EXIT
  scp -q -P "$port" "${ssh_options[@]}" "$ssh_target:$remote_dir/$newest" "$partial" ||
    die "copying $newest from $ssh_target failed"

  # A file that is not a database makes sqlite3 itself fail. That is a failed
  # check too, not a set -e exit.
  result=$(sqlite3 "$partial" 'PRAGMA integrity_check;' 2>&1) || true
  if [ "$result" != "ok" ]; then
    rm -f -- "$partial"
    echo "integrity check failed for $newest:" >&2
    echo "$result" >&2
    exit 2
  fi
  mv -- "$partial" "$local_file"
  echo "copied $newest to $local_file, integrity ok"
  prune_backups "$local_dir" "$keep"
fi

now=$(date -u +%s)
age=$((now - $(stamp_epoch "$stamp")))
# A stamp in the future means clock skew, so it counts as fresh.
if [ "$age" -gt $((max_age_hours * 3600)) ]; then
  echo "newest server backup $newest is $((age / 3600)) h old, more than $max_age_hours h" >&2
  exit 3
fi
