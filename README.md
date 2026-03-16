# claude-browser

Claude Code plugin for frontend development. Launch a browser, visually inspect elements, detect React/Vue/Svelte components, and monitor console/network/performance.

## What it does

- **Visual element selection** — Hover over any element to see its component name, props, source file, and styles
- **"→ Claude Code" button** — Click to send component info to Claude Code
- **Component detection** — React, Vue 3, Svelte components with props and source file mapping
- **Browser monitoring** — Console logs, network requests, Core Web Vitals (LCP, FCP, CLS, INP)
- **Screenshots** — Capture page state for visual debugging
- **Headless mode** — Run browser monitoring in the background

## Installation

```bash
/plugin marketplace add tnsqjahong/claude-browser
/plugin install claude-browser
```

## Usage

### Quick start

```
/claude-browser:inspect http://localhost:3000
```

### Element selection

1. `/claude-browser:inspect http://localhost:3000`
2. Hover over elements to see component info
3. Click **"→ Claude Code"** on the tooltip
4. `[Component #1: <Header>]` appears in your chat
5. Claude reads the component details from `.claude-browser/selections/`

### Natural language

```
Launch the browser at http://localhost:3000 and take a screenshot
```

```
Check the console errors and failed network requests on localhost:3000
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `claude-browser launch <url> [--headless]` | Launch browser |
| `claude-browser navigate <url>` | Navigate to URL |
| `claude-browser screenshot [--fullpage]` | Save screenshot |
| `claude-browser close` | Close browser |
| `claude-browser inspect <selector>` | Inspect element by CSS selector |
| `claude-browser select start` | Start visual selection |
| `claude-browser select wait [--timeout=N]` | Wait for user click |
| `claude-browser select stop` | Stop selection |
| `claude-browser logs [--type=error\|warn\|all] [--limit=N]` | Console logs |
| `claude-browser network [--failed] [--limit=N]` | Network requests |
| `claude-browser perf` | Core Web Vitals |
| `claude-browser components [--selector=<sel>]` | Component tree |
| `claude-browser find-component <name> [--root=<path>]` | Find source file |
| `claude-browser status` | Check status |

All output is saved under `.claude-browser/` (screenshots, logs, network, perf, inspections, components, selections).

## Supported Frameworks

| Framework | Component Name | Props | Source File | Element Selection |
|-----------|:-:|:-:|:-:|:-:|
| React (dev mode) | ✓ | ✓ | ✓ | ✓ |
| Vue 3 | ✓ | ✓ | ✓ | ✓ |
| Svelte | ✓ | — | — | ✓ |

## License

MIT
