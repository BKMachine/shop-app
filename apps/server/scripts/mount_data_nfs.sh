#!/usr/bin/env bash
# Mounts the NFS share where the real shop data (images, documents) lives
# onto apps/server/data. Configure via environment variables, or set them
# in apps/server/.env (loaded automatically if present).
#
# Required:
#   NFS_HOST            NFS server host/IP, e.g. 192.168.1.50
#   NFS_EXPORT           Export path on that server, e.g. /volume1/shop-data
#
# Optional:
#   NFS_MOUNT_OPTIONS    Mount options (default: rw,noatime,hard,intr)
#   DATA_MOUNT_POINT     Local mount point (default: apps/server/data)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${SERVER_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SERVER_DIR}/.env"
  set +a
fi

: "${NFS_HOST:?Set NFS_HOST (the NFS server host/IP), e.g. in apps/server/.env}"
: "${NFS_EXPORT:?Set NFS_EXPORT (the export path on the NFS server), e.g. in apps/server/.env}"
NFS_MOUNT_OPTIONS="${NFS_MOUNT_OPTIONS:-rw,noatime,hard,intr}"
MOUNT_POINT="${DATA_MOUNT_POINT:-${SERVER_DIR}/data}"

if ! command -v mount.nfs >/dev/null 2>&1 && ! command -v mount.nfs4 >/dev/null 2>&1; then
  echo "NFS client support not found. Install it first, e.g.:" >&2
  echo "  sudo apt install nfs-common" >&2
  exit 1
fi

if mountpoint -q "${MOUNT_POINT}" 2>/dev/null; then
  echo "${MOUNT_POINT} is already mounted."
  exit 0
fi

mkdir -p "${MOUNT_POINT}"

echo "Mounting ${NFS_HOST}:${NFS_EXPORT} at ${MOUNT_POINT} (options: ${NFS_MOUNT_OPTIONS})"
sudo mount -t nfs -o "${NFS_MOUNT_OPTIONS}" "${NFS_HOST}:${NFS_EXPORT}" "${MOUNT_POINT}"

echo "Mounted."
