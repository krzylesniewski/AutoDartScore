#!/usr/bin/env bash
# Helpers for deploy.sh and backup.sh. Sourced, so it sets no shell options.

# Prints the value of KEY from a systemd env file, or nothing when KEY is
# missing. The file is never sourced, because the password may contain shell
# characters.
env_file_value() {
  local file="$1" key="$2" line value found=""
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      '' | '#'* | ';'*) continue ;;
    esac
    if [ "${line%%=*}" = "$key" ] && [ "$line" != "$key" ]; then
      value="${line#*=}"
      if [ "${#value}" -ge 2 ]; then
        case "$value" in
          \"*\" | \'*\') value="${value:1:${#value}-2}" ;;
        esac
      fi
      # systemd keeps the last assignment, so this does too.
      found="$value"
    fi
  done < "$file"
  printf '%s' "$found"
}

utc_stamp() {
  date -u +%Y%m%dT%H%M%SZ
}

# Keeps the newest files by name. The names start with a UTC timestamp, so
# byte order is time order.
prune_backups() {
  local dir="$1" keep="$2" LC_ALL=C
  local files=("$dir"/autoscore-*.sqlite)
  [ -e "${files[0]}" ] || return 0
  local count="${#files[@]}" i
  for ((i = 0; i < count - keep; i++)); do
    rm -f -- "${files[i]}"
    echo "removed old backup ${files[i]}"
  done
}
