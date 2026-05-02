#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${OCR_VENV_DIR:-${APP_DIR}/.venv-ocr}"
PYTHON_BIN="${VENV_DIR}/bin/python"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to install OCR dependencies." >&2
  exit 1
fi

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Bootstrapping OCR virtualenv at ${VENV_DIR}"
  if ! python3 -m venv "${VENV_DIR}" >/tmp/shop-app-image-processor-ocr-venv.log 2>&1; then
    cat /tmp/shop-app-image-processor-ocr-venv.log >&2
    echo "OCR install could not create ${VENV_DIR}." >&2
    echo "If python venv support is missing, install it first, for example:" >&2
    echo "  sudo apt install python3.12-venv" >&2
    exit 1
  fi
fi

"${PYTHON_BIN}" -m pip install "paddleocr==3.5.0" "paddlepaddle==3.2.2" "numpy<2.4,>=1.24"

echo "OCR dependencies installed into ${VENV_DIR}."
