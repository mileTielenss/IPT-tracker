#!/bin/sh
# Zet een nieuwe KBC-export op de fixture-plaats en draai de tests.
# Gebruik: scripts/ververs-fixture.sh pad/naar/nieuwe-export.csv
set -eu
if [ "$#" -ne 1 ]; then
  echo "Gebruik: $0 pad/naar/nieuwe-export.csv" >&2
  exit 1
fi
cp "$1" "$(dirname "$0")/../fixtures/kbc-export.csv"
echo "Fixture ververst. Vergeet de tests niet: npm test"
