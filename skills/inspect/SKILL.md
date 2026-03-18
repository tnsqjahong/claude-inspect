---
name: inspect
description: Open a browser and start visual element inspection mode for frontend development
argument-hint: "<url>"
allowed-tools:
  - Bash(node *)
  - Read(.claude-inspect/*)
---

# Inspect

Opens a Chromium browser, navigates to the URL, and enables visual element selection mode.

## Important: CLI Path

The CLI is located relative to this skill's base directory. Construct the path using the base directory provided at the top of this prompt:

```
CLI_PATH = <base directory>/../../dist/cli.js
```

All commands below should be run as: `node <CLI_PATH> <command> [args]`

## Instructions

1. Run `node <CLI_PATH> launch $ARGUMENTS` to start the browser
2. Tell the user the browser is open and they can hover over elements and click "→ Claude Code" to select them, then wait for their next message
3. When the user selects an element (indicated by `[Component #N]` in chat), read the selection file from `.claude-inspect/selections/N.txt` for full component details
4. Run other commands (screenshot, logs, network, perf, etc.) only when the user asks

## Available Commands

```bash
node <CLI_PATH> launch <url> [--headless]     # Launch browser
node <CLI_PATH> navigate <url>                # Navigate
node <CLI_PATH> screenshot [--fullpage]       # Save screenshot
node <CLI_PATH> close                         # Close browser
node <CLI_PATH> inspect <selector>            # Inspect by CSS selector
node <CLI_PATH> select start                  # Start visual selection
node <CLI_PATH> select wait [--timeout=N]     # Wait for user click
node <CLI_PATH> select stop                   # Stop selection
node <CLI_PATH> logs [--type=error|warn|all]  # Console logs
node <CLI_PATH> network [--failed]            # Network requests
node <CLI_PATH> perf                          # Core Web Vitals
node <CLI_PATH> components [--selector=<s>]   # Component tree
node <CLI_PATH> find-component <name>         # Find source file
node <CLI_PATH> status                        # Check status
```

## Output Locations

All data is saved to `.claude-inspect/` as files. Use Read tool for full data.

| Command | Output |
|---------|--------|
| screenshot | `.claude-inspect/screenshots/{timestamp}.png` |
| logs | `.claude-inspect/logs/{timestamp}.json` |
| network | `.claude-inspect/network/{timestamp}.json` |
| perf | `.claude-inspect/perf/{timestamp}.json` |
| inspect | `.claude-inspect/inspections/{timestamp}.json` |
| components | `.claude-inspect/components/{timestamp}.json` |
| select wait | `.claude-inspect/selections/{timestamp}.json` |
