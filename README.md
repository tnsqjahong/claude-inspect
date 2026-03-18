# claude-inspect

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
/plugin marketplace add tnsqjahong/claude-inspect
/plugin install claude-inspect
```

## Usage

### Quick start

```
/claude-inspect:inspect http://localhost:3000
```

### Element selection

1. `/claude-inspect:inspect http://localhost:3000`
2. Hover over elements to see component info
3. Click **"→ Claude Code"** on the tooltip
4. `[Component #1: <Header>]` appears in your chat
5. Claude reads the component details from `.claude-inspect/selections/`

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
| `claude-inspect launch <url> [--headless]` | Launch browser |
| `claude-inspect navigate <url>` | Navigate to URL |
| `claude-inspect screenshot [--fullpage]` | Save screenshot |
| `claude-inspect close` | Close browser |
| `claude-inspect inspect <selector>` | Inspect element by CSS selector |
| `claude-inspect select start` | Start visual selection |
| `claude-inspect select wait [--timeout=N]` | Wait for user click |
| `claude-inspect select stop` | Stop selection |
| `claude-inspect logs [--type=error\|warn\|all] [--limit=N]` | Console logs |
| `claude-inspect network [--failed] [--limit=N]` | Network requests |
| `claude-inspect perf` | Core Web Vitals |
| `claude-inspect components [--selector=<sel>]` | Component tree |
| `claude-inspect find-component <name> [--root=<path>]` | Find source file |
| `claude-inspect status` | Check status |

All output is saved under `.claude-inspect/` (screenshots, logs, network, perf, inspections, components, selections).

## Supported Frameworks

| Framework | Component Name | Props | Source File | Element Selection |
|-----------|:-:|:-:|:-:|:-:|
| React (dev mode) | ✓ | ✓ | ✓ | ✓ |
| Vue 3 | ✓ | ✓ | ✓ | ✓ |
| Svelte | ✓ | — | — | ✓ |

## License

MIT
