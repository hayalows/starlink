#!/bin/bash
# Run from Terminal: bash /path/to/your/extension/Update-Starlink.command
set -euo pipefail
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$INSTALL_DIR/manifest.json" ]; then echo 'Run this helper inside your existing Starlink Ghana extension folder.'; exit 1; fi
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
BASE_URL='https://github.com/hayalows/starlink/releases/latest/download/starlink-ghana-monitor-chrome.zip'
echo 'Downloading the latest Starlink Ghana Monitor. Close its dashboard before continuing.'
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 "$BASE_URL" -o "$WORK_DIR/starlink-ghana-monitor-chrome.zip"
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 "$BASE_URL.sha256" -o "$WORK_DIR/checksum"
(cd "$WORK_DIR" && shasum -a 256 -c checksum)
# Reject absolute paths, traversal and backslash paths before extraction.
if unzip -Z1 "$WORK_DIR/starlink-ghana-monitor-chrome.zip" | LC_ALL=C grep -E '(^/|(^|/)\.\.(/|$)|\\)' >/dev/null; then echo 'Unsafe archive path. Update stopped.'; exit 1; fi
unzip -q "$WORK_DIR/starlink-ghana-monitor-chrome.zip" -d "$WORK_DIR/package"
if [ ! -f "$WORK_DIR/package/manifest.json" ]; then echo 'Missing extension manifest. Update stopped.'; exit 1; fi
if find "$WORK_DIR/package" -type l | grep . >/dev/null; then echo 'Unexpected symbolic link. Update stopped.'; exit 1; fi
BACKUP_DIR="${INSTALL_DIR}-files-backup-$(date +%Y%m%d-%H%M%S)"
cp -R "$INSTALL_DIR" "$BACKUP_DIR"
if ! cp -R "$WORK_DIR/package/." "$INSTALL_DIR/"; then
  cp -R "$BACKUP_DIR/." "$INSTALL_DIR/"
  echo 'Copy failed. Previous files restored. Close Chrome and retry.'
  exit 1
fi
echo "Files updated. Old files are in: $BACKUP_DIR"
echo 'Now click Reload on your existing extension at chrome://extensions. Do not remove it.'
