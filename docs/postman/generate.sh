#!/usr/bin/env bash
set -euo pipefail
export PIP_DISABLE_PIP_VERSION_CHECK=1

# Builds Social-Event-Mapper.postman_collection.json from docs/openapi/*.yaml.
# Run from anywhere: bash docs/postman/generate.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV="${SCRIPT_DIR}/.venv"
PY="${VENV}/bin/python"
PIP="${VENV}/bin/pip"

if [[ ! -x "$PY" ]]; then
  echo "Creating venv at ${VENV}"
  python3 -m venv "$VENV"
fi

"$PIP" install -r "${SCRIPT_DIR}/requirements.txt"
"$PY" "${SCRIPT_DIR}/generate_from_openapi.py"
