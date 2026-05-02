#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${REMBG_INSTALL_ON_START:-1}" != "1" ]]; then
  :
else
  VENV_DIR="${REMBG_VENV_DIR:-${APP_DIR}/.venv-rembg}"
  PYTHON_BIN="${VENV_DIR}/bin/python"

  if [[ ! -x "${PYTHON_BIN}" ]]; then
    echo "Bootstrapping rembg virtualenv at ${VENV_DIR}"
    export REMBG_VENV_DIR="${VENV_DIR}"
    bash "${SCRIPT_DIR}/install_rembg.sh"
  fi
fi

if [[ "${OCR_INSTALL_ON_START:-1}" == "1" ]]; then
  OCR_VENV_DIR="${OCR_VENV_DIR:-${APP_DIR}/.venv-ocr}"
  OCR_PYTHON_BIN="${OCR_VENV_DIR}/bin/python"

  if [[ ! -x "${OCR_PYTHON_BIN}" ]]; then
    echo "Bootstrapping PaddleOCR virtualenv at ${OCR_VENV_DIR}"
    export OCR_VENV_DIR="${OCR_VENV_DIR}"
    bash "${SCRIPT_DIR}/install_ocr.sh"
  fi
fi

exec "$@"