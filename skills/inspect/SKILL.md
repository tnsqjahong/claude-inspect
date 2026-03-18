---
name: inspect
description: Open a browser and start visual element inspection mode for frontend development
argument-hint: "<url>"
allowed-tools:
  - Bash(node *)
  - Read(.claude-browser/*)
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
2. Tell the user the browser is open and they can hover over elements and click "→ Claude Code" to select them
3. When the user selects an element (indicated by `[Component #N]` in chat), read the selection file from `.claude-browser/selections/N.txt` for full component details

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

All data is saved to `.claude-browser/` as files. Use Read tool for full data.

| Command | Output |
|---------|--------|
| screenshot | `.claude-browser/screenshots/{timestamp}.png` |
| logs | `.claude-browser/logs/{timestamp}.json` |
| network | `.claude-browser/network/{timestamp}.json` |
| perf | `.claude-browser/perf/{timestamp}.json` |
| inspect | `.claude-browser/inspections/{timestamp}.json` |
| components | `.claude-browser/components/{timestamp}.json` |
| select wait | `.claude-browser/selections/{timestamp}.json` |
