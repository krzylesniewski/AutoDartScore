#!/usr/bin/env bash
# Daily copy of the live database, run by cron as the autoscore user.
set -euo pipefail

env_file="${AUTOSCORE_ENV_FILE:-/etc/autoscore/autoscore.env}"
backup_dir="${AUTOSCORE_BACKUP_DIR:-/home/autoscore/backups}/daily"
keep_backups=14

# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ ! -r "$env_file" ]; then
  echo "cannot read $env_file" >&2
  exit 1
fi
db=$(env_file_value "$env_file" DATABASE_PATH)
if [ -z "$db" ] || [ ! -f "$db" ]; then
  echo "database not found: ${db:-DATABASE_PATH is not set in $env_file}" >&2
  exit 1
fi

mkdir -p "$backup_dir"
file="$backup_dir/autoscore-$(utc_stamp).sqlite"
# .backup copies a consistent state even while the server writes.
sqlite3 "$db" ".backup '$file'"

result=$(sqlite3 "$file" 'PRAGMA integrity_check;')
if [ "$result" != "ok" ]; then
  # A broken copy must not push a good one out of the rotation.
  rm -f -- "$file"
  echo "integrity check failed for the copy of $db:" >&2
  echo "$result" >&2
  exit 1
fi
echo "backed up $db to $file"

prune_backups "$backup_dir" "$keep_backups"
