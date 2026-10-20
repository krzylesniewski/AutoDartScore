#!/usr/bin/env bash
# Checks migrate-db.sh --local on throwaway databases. Needs only sqlite3 and
# runs on macOS bash 3.2 and Linux.
set -euo pipefail

migrate="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/migrate-db.sh"
work=$(mktemp -d "${TMPDIR:-/tmp}/test-migrate-db.XXXXXX")
trap 'rm -rf -- "$work"' EXIT

schema="CREATE TABLE players (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE matches (id text PRIMARY KEY, type text NOT NULL);
CREATE TABLE throws (id text PRIMARY KEY, match_id text NOT NULL, segment integer NOT NULL);
CREATE TABLE match_events (match_id text NOT NULL, seq integer NOT NULL, type text NOT NULL);"
migrations="CREATE TABLE kysely_migration (name varchar(255) PRIMARY KEY, timestamp varchar(255) NOT NULL);"
count_sql="SELECT (SELECT count(*) FROM players), (SELECT count(*) FROM matches), (SELECT count(*) FROM throws), (SELECT count(*) FROM match_events);"

make_source() {
  sqlite3 "$1" "$schema
$migrations
INSERT INTO kysely_migration VALUES ('0001_initial', 't'), ('0002_match_lifecycle', 't'), ('0003_player_changes', 't');
INSERT INTO players VALUES ('p1', 'Ala'), ('p2', 'Olek');
INSERT INTO matches VALUES ('m1', 'match');
INSERT INTO throws VALUES ('t1', 'm1', 20), ('t2', 'm1', 5), ('t3', 'm1', 1);
INSERT INTO match_events VALUES ('m1', 1, 'throw'), ('m1', 2, 'throw'), ('m1', 3, 'throw');"
}

make_empty_target() {
  sqlite3 "$1" "$schema"
}

make_non_empty_target() {
  sqlite3 "$1" "$schema
INSERT INTO players VALUES ('x1', 'Stary');"
}

passed=0
failed=0
scenario=0
dir=""

start() {
  scenario=$((scenario + 1))
  name="$1"
  dir="$work/$scenario"
  mkdir "$dir"
  make_source "$dir/source.sqlite"
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

run_migrate() {
  "$BASH" "$migrate" --local "$@" > "$dir/out.log" 2>&1
}

counts_equal() {
  [ "$(sqlite3 "$1" "$count_sql")" = "$(sqlite3 "$2" "$count_sql")" ]
}

has_before_file() {
  local file
  for file in "$1".before-migrate-*; do
    [ -e "$file" ] && return 0
  done
  return 1
}

start "missing target"
if ! run_migrate "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "exited non-zero"
elif ! counts_equal "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "counts differ"
else
  pass
fi

start "empty target without --force"
make_empty_target "$dir/target.sqlite"
if ! run_migrate "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "exited non-zero"
elif ! has_before_file "$dir/target.sqlite"; then
  fail "no .before-migrate-* file"
elif ! counts_equal "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "counts differ"
else
  pass
fi

start "non-empty target without --force"
make_non_empty_target "$dir/target.sqlite"
cp "$dir/target.sqlite" "$dir/expected.sqlite"
if run_migrate "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "exited 0"
elif ! cmp -s "$dir/expected.sqlite" "$dir/target.sqlite"; then
  fail "target changed"
else
  pass
fi

start "non-empty target with --force"
make_non_empty_target "$dir/target.sqlite"
if ! run_migrate "$dir/source.sqlite" "$dir/target.sqlite" --force; then
  fail "exited non-zero"
elif ! has_before_file "$dir/target.sqlite"; then
  fail "no .before-migrate-* file"
elif ! counts_equal "$dir/source.sqlite" "$dir/target.sqlite"; then
  fail "counts differ"
else
  pass
fi

start "source that is not a database"
echo "not a database, just some text that is long enough to fill a page header" > "$dir/source.sqlite"
make_empty_target "$dir/target.sqlite"
cp "$dir/target.sqlite" "$dir/expected.sqlite"
if run_migrate "$dir/source.sqlite" "$dir/target.sqlite" --force; then
  fail "exited 0"
elif ! cmp -s "$dir/expected.sqlite" "$dir/target.sqlite"; then
  fail "target changed"
else
  pass
fi

start "empty target with an older migration list"
sqlite3 "$dir/target.sqlite" "$schema
$migrations
INSERT INTO kysely_migration VALUES ('0001_initial', 't'), ('0002_match_lifecycle', 't');"
cp "$dir/target.sqlite" "$dir/expected.sqlite"
if run_migrate "$dir/source.sqlite" "$dir/target.sqlite" --force; then
  fail "exited 0"
elif ! grep -q "deploy the newer main to the server first" "$dir/out.log"; then
  fail "no hint to deploy the newer main"
elif ! cmp -s "$dir/expected.sqlite" "$dir/target.sqlite"; then
  fail "target changed"
else
  pass
fi

if [ "$failed" -gt 0 ]; then
  echo "$passed passed, $failed failed"
  exit 1
fi
echo "$passed passed"
