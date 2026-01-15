#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  setup-opencode-config.sh <repo-url> [--target DIR] [--no-rc] [--disable-local]

Options:
  --target DIR      Local checkout path (default: $OPENCODE_CONFIG_DIR or ~/.local/share/opencode-config)
  --no-rc           Do not modify shell rc file
  --disable-local   Rename ./packages/opencode/.opencode to avoid local overrides

Env:
  OPENCODE_CONFIG_REPO  Default repo URL
  OPENCODE_CONFIG_DIR   Default target dir
USAGE
}

REPO_URL="${OPENCODE_CONFIG_REPO:-}"
TARGET_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.local/share/opencode-config}"
UPDATE_RC="true"
DISABLE_LOCAL="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --target)
      TARGET_DIR="$2"
      shift 2
      ;;
    --no-rc)
      UPDATE_RC="false"
      shift
      ;;
    --disable-local)
      DISABLE_LOCAL="true"
      shift
      ;;
    *)
      if [[ -z "$REPO_URL" ]]; then
        REPO_URL="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$REPO_URL" ]]; then
  usage
  exit 1
fi

if [[ -d "$TARGET_DIR" && ! -d "$TARGET_DIR/.git" ]]; then
  echo "Target exists but is not a git repo: $TARGET_DIR" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_DIR")"

if [[ -d "$TARGET_DIR/.git" ]]; then
  git -C "$TARGET_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$TARGET_DIR"
fi

if [[ "$UPDATE_RC" == "true" ]]; then
  case "${SHELL:-}" in
    */zsh) RC_FILE="$HOME/.zshrc" ;;
    */bash) RC_FILE="$HOME/.bashrc" ;;
    *) RC_FILE="$HOME/.profile" ;;
  esac

  LINE="export OPENCODE_CONFIG_DIR=\"$TARGET_DIR\""
  if [[ -f "$RC_FILE" ]] && grep -q "OPENCODE_CONFIG_DIR=" "$RC_FILE"; then
    tmp="$(mktemp)"
    awk -v line="$LINE" '
      $0 ~ /OPENCODE_CONFIG_DIR=/ { print line; next }
      { print }
    ' "$RC_FILE" > "$tmp"
    mv "$tmp" "$RC_FILE"
  else
    printf "\n%s\n" "$LINE" >> "$RC_FILE"
  fi
  echo "Updated ${RC_FILE} with OPENCODE_CONFIG_DIR."
fi

if [[ "$DISABLE_LOCAL" == "true" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  LOCAL_OPENCODE="$SCRIPT_DIR/packages/opencode/.opencode"
  if [[ -d "$LOCAL_OPENCODE" ]]; then
    mv "$LOCAL_OPENCODE" "${LOCAL_OPENCODE}.disabled.$(date +%Y%m%d-%H%M%S)"
    echo "Disabled local .opencode at $LOCAL_OPENCODE"
  fi
fi

echo "Done. Restart your shell or run: export OPENCODE_CONFIG_DIR=\"$TARGET_DIR\""
