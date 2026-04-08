#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${APP_DIR}/.venv-rembg"
PYTHON_BIN="${VENV_DIR}/bin/python"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to install rembg dependencies." >&2
  exit 1
fi

if ! python3 -m venv "${VENV_DIR}" >/tmp/shop-app-image-processor-rembg-venv.log 2>&1; then
  cat /tmp/shop-app-image-processor-rembg-venv.log >&2
  echo >&2
  echo "rembg install could not create ${VENV_DIR}." >&2
  echo "On Debian/Ubuntu, install the missing venv support with:" >&2
  echo "  sudo apt install python3.12-venv" >&2
  echo "Then rerun: pnpm --dir apps/image_processor run install:rembg" >&2
  exit 1
fi

"${PYTHON_BIN}" -m pip install --upgrade pip
"${PYTHON_BIN}" -m pip install "rembg[cpu,cli]"

echo "rembg dependencies installed into ${VENV_DIR}."