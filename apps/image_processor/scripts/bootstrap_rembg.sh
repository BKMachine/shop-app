#!/usr/bin/env bash
set -euo pipefail

if [[ "${REMBG_INSTALL_ON_START:-1}" != "1" ]]; then
  exec "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${REMBG_VENV_DIR:-${APP_DIR}/.venv-rembg}"
PYTHON_BIN="${VENV_DIR}/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Bootstrapping rembg virtualenv at ${VENV_DIR}"
  export REMBG_VENV_DIR="${VENV_DIR}"
  bash "${SCRIPT_DIR}/install_rembg.sh"
fi

exec "$@"