#!/usr/bin/env bash
# Installs a pinned gitleaks release after verifying its sha256. No credentials, no registry login.
# Usage: install-gitleaks.sh <destination-dir>   (prints the binary path on stdout)
set -euo pipefail
VERSION="8.30.1"
ARCHIVE="gitleaks_${VERSION}_linux_x64.tar.gz"
SHA256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
dest="${1:?destination directory required}"
mkdir -p "$dest"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${ARCHIVE}" --output "$dest/$ARCHIVE"
echo "${SHA256}  $dest/$ARCHIVE" | sha256sum --check --status || { echo "gitleaks archive checksum mismatch" >&2; exit 1; }
tar -xzf "$dest/$ARCHIVE" -C "$dest" gitleaks
echo "$dest/gitleaks"
