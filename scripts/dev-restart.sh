#!/bin/bash
set -e

cd "$(dirname "$0")/.."

./scripts/dev-stop.sh
./scripts/dev-start.sh
