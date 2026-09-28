#!/usr/bin/env bash
# Regenerates the Batch 7 fixtures (form.pdf, table.pdf, notform.pdf).
# The generator imports @cantoo/pdf-lib, which resolves through the root
# node_modules from the scripts workspace (whose devDependency is tsx).
set -eu
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$DIR" rev-parse --show-toplevel)"
cd "$ROOT/scripts"
./node_modules/.bin/tsx "$DIR/make-batch7-fixtures.mjs"
