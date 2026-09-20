#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

get_default_venv_dir() {
  local venv_name="$1"

  if [[ -n "${IMAGE_PROCESSOR_VENVS_DIR:-}" ]]; then
    echo "${IMAGE_PROCESSOR_VENVS_DIR%/}/${venv_name}"
    return
  fi

  echo "${APP_DIR}/${venv_name}"
}

if [[ "${REMBG_INSTALL_ON_START:-1}" != "1" ]]; then
  :
else
  VENV_DIR="${REMBG_VENV_DIR:-$(get_default_venv_dir '.venv-rembg')}"
  PYTHON_BIN="${VENV_DIR}/bin/python"

  if [[ ! -x "${PYTHON_BIN}" ]] || ! "${PYTHON_BIN}" -c "import rembg" >/dev/null 2>&1; then
    echo "Bootstrapping rembg virtualenv at ${VENV_DIR}"
    export REMBG_VENV_DIR="${VENV_DIR}"
    bash "${SCRIPT_DIR}/install_rembg.sh"
  fi
fi

exec "$@"