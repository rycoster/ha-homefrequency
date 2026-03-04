#!/bin/sh
# Deploy HomeFrequency to HA via GitHub
# Usage: bash scripts/deploy-to-ha.sh
#
# Syncs source files into homefrequency/ addon subdirectory,
# commits, and pushes to GitHub. HA pulls updates from the repo.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ADDON_DIR="$PROJECT_DIR/homefrequency"

# Extract version from addon config.yaml
VERSION=$(grep '^version:' "$ADDON_DIR/config.yaml" | awk '{print $2}')

if [ -z "$VERSION" ]; then
    echo "Error: could not read version from homefrequency/config.yaml"
    exit 1
fi

echo "Deploying HomeFrequency v$VERSION ..."

# Sync source files into addon subdirectory
echo "Syncing source files into homefrequency/ ..."
rsync -a --delete "$PROJECT_DIR/app/" "$ADDON_DIR/app/"
rsync -a --delete "$PROJECT_DIR/custom_components/homefrequency/" "$ADDON_DIR/integration/"
cp "$PROJECT_DIR/requirements.txt" "$ADDON_DIR/"

# Git add, commit, push
cd "$PROJECT_DIR"
git add .
if git diff --cached --quiet; then
    echo "No changes to deploy."
    exit 0
fi

git commit -m "Deploy v$VERSION"
git push

echo ""
echo "Deployed to GitHub."
echo "  Version: $VERSION"
echo "  Repo: https://github.com/rycoster/ha-homefrequency"
echo ""
echo "Next: Check for update in HA Add-on Store and rebuild."
