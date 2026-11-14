#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

load_app_env() {
  local env_file="${APP_DIR}/.env"

  if [[ ! -f "${env_file}" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
}

load_app_env

get_default_venv_dir() {
  if [[ -n "${IMAGE_PROCESSOR_VENVS_DIR:-}" ]]; then
    echo "${IMAGE_PROCESSOR_VENVS_DIR%/}/.venv-rembg"
    return
  fi

  echo "${APP_DIR}/.venv-rembg"
}

VENV_DIR="${REMBG_VENV_DIR:-$(get_default_venv_dir)}"
PYTHON_BIN="${VENV_DIR}/bin/python"
created_venv=0

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to install rembg dependencies." >&2
  exit 1
fi

if [[ -x "${PYTHON_BIN}" ]] && "${PYTHON_BIN}" -c "import rembg" >/dev/null 2>&1; then
  echo "rembg dependencies already available in ${VENV_DIR}."
  exit 0
fi

# A virtualenv kept from an image with another Python version, or one whose creation was cut
# short, still has a python but no pip that it can load. Nothing in it is usable, so it is rebuilt.
if [[ ! -x "${PYTHON_BIN}" ]] || ! "${PYTHON_BIN}" -m pip --version >/dev/null 2>&1; then
  if [[ -e "${VENV_DIR}" ]]; then
    echo "The rembg virtualenv at ${VENV_DIR} has no working pip, rebuilding it."
  fi

  if ! python3 -m venv --clear "${VENV_DIR}" >/tmp/shop-app-image-processor-rembg-venv.log 2>&1; then
    cat /tmp/shop-app-image-processor-rembg-venv.log >&2
    echo >&2
    echo "rembg install could not create ${VENV_DIR}." >&2
    echo "On Debian/Ubuntu, install the missing venv support with:" >&2
    echo "  sudo apt install python3-venv" >&2
    echo "Then rerun: pnpm --dir apps/image_processor run install:rembg" >&2
    exit 1
  fi

  created_venv=1
fi

if [[ "${created_venv}" == "1" ]]; then
  "${PYTHON_BIN}" -m pip install --upgrade pip
fi

"${PYTHON_BIN}" -m pip install "rembg[cpu,cli]"

echo "rembg dependencies installed into ${VENV_DIR}."