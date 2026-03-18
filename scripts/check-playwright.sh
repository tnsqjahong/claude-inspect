#!/bin/bash

# Auto-install dependencies and Playwright Chromium if not found
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"

# Install npm dependencies if missing
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "claude-browser: Installing dependencies..."
  cd "$SCRIPT_DIR" && npm install --ignore-scripts 2>&1
fi

check_chromium() {
  if [ -d "$PLAYWRIGHT_BROWSERS_PATH" ] && ls "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null | grep -q "chromium"; then
    return 0
  fi
  return 1
}

if check_chromium; then
  echo "claude-browser: Ready"
else
  echo "claude-browser: Installing Chromium..."
  cd "$SCRIPT_DIR" && npx playwright install chromium 2>&1
  if check_chromium; then
    echo "claude-browser: Ready"
  else
    echo "claude-browser: Failed to install Chromium. Run manually: npx playwright install chromium"
  fi
fi
