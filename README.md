# claude-browser

A Claude Code plugin that provides visual browser tools for frontend development. It launches a Chromium browser via Playwright and exposes tools for element inspection, component detection, console/network monitoring, and performance analysis — all accessible from Claude Code.

## Installation

### Prerequisites

- Node.js 18+
- Claude Code

### Setup

```bash
# Clone or navigate to the plugin directory
cd claude-browser

# Install dependencies
npm install

# Install Playwright Chromium browser
npx playwright install chromium

# Build the plugin
npm run build
```

### Register with Claude Code

Add the plugin to your Claude Code configuration (`~/.claude/settings.json` or project-level `.claude/settings.json`):

```json
{
  "mcpServers": {
    "claude-browser": {
      "command": "node",
      "args": ["/absolute/path/to/claude-browser/dist/index.js"]
    }
  }
}
```

## Usage with Claude Code

Once installed, the browser tools are available in any Claude Code session. Use the `open-browser` skill to get started:

```
/open-browser http://localhost:3000
```

Or instruct Claude directly:

```
Launch the browser at http://localhost:3000 and take a screenshot
```

```
Open http://localhost:3000, select the navigation component, and show me its React props
```

```
Check the console logs and network errors on http://localhost:3000
```

## Available Tools

### Browser Control

| Tool | Description |
|------|-------------|
| `browser_launch` | Launch a Chromium browser and navigate to a URL. Returns a screenshot of the loaded page. |
| `browser_navigate` | Navigate the open browser to a new URL. |
| `browser_screenshot` | Capture a screenshot of the current browser state. |
| `browser_close` | Close the browser and release all resources. |

### Element Inspection

| Tool | Description |
|------|-------------|
| `start_element_selection` | Enable visual selection mode — hover over elements in the browser to highlight them, then click to select. |
| `get_selected_element` | Retrieve full details of the currently selected element: tag, classes, attributes, computed styles, React/Vue component name and props, and source file location. |
| `stop_element_selection` | Disable visual selection mode. |
| `inspect_element` | Inspect a specific element by CSS selector without entering selection mode. |

### Monitoring

| Tool | Description |
|------|-------------|
| `get_console_logs` | Retrieve captured browser console messages (log, warn, error, info). Filterable by level. |
| `get_network_requests` | Retrieve captured network requests with URL, method, status code, and response timing. |
| `get_performance_metrics` | Measure Core Web Vitals: LCP (Largest Contentful Paint), FCP (First Contentful Paint), CLS (Cumulative Layout Shift), and TTFB. |

### Component Analysis

| Tool | Description |
|------|-------------|
| `get_component_tree` | Get the React/Vue component hierarchy for the current page, showing component names, props, and nesting. |
| `find_component_source` | Locate the source file for a named component in the project directory. |

## Example Workflows

### Visual Debugging

```
1. browser_launch("http://localhost:3000")
2. get_console_logs()                  # check for errors
3. get_network_requests()              # check for failed API calls
4. start_element_selection()           # enable click-to-inspect
   [user clicks on broken element]
5. get_selected_element()              # see component name + source file
```

### Performance Audit

```
1. browser_launch("http://localhost:3000")
2. get_performance_metrics()           # Core Web Vitals snapshot
3. get_network_requests()              # identify slow requests
4. inspect_element(".hero-image")      # check largest contentful element
```

### Component Inspection

```
1. browser_launch("http://localhost:3000/dashboard")
2. browser_screenshot()                # confirm page loaded
3. get_component_tree()                # understand component hierarchy
4. start_element_selection()
   [user clicks on a card component]
5. get_selected_element()              # get props + source file path
6. find_component_source("DashboardCard")  # open source file location
```

## Architecture

```
claude-browser/
├── src/
│   ├── browser/
│   │   ├── manager.ts        # Playwright lifecycle management (launch, navigate, close)
│   │   └── types.ts          # Browser-related TypeScript types
│   ├── inspector/
│   │   ├── element-inspector.ts  # DOM inspection + React/Vue devtools bridge
│   │   ├── source-mapper.ts      # Component name -> source file resolution
│   │   └── types.ts              # Inspector TypeScript types
│   ├── monitor/
│   │   ├── console-monitor.ts    # Console message capture
│   │   ├── network-monitor.ts    # Network request/response capture
│   │   └── performance-monitor.ts # Core Web Vitals measurement
│   └── overlay/
│       ├── overlay-manager.ts    # Injected overlay lifecycle
│       ├── overlay-script.ts     # In-browser JS for element highlighting
│       └── overlay-styles.ts     # Overlay CSS styles
├── agents/
│   └── browser-dev.md        # Browser development specialist agent definition
├── hooks/
│   └── hooks.json            # Session start hook to verify Playwright install
├── scripts/
│   └── check-playwright.sh   # Playwright browser installation check
└── skills/
    └── open-browser/
        └── SKILL.md          # /open-browser skill definition
```

The plugin exposes an MCP server (`dist/index.js`) that Claude Code connects to. Tools are registered at server startup and delegate to the appropriate source module. The browser state (page, monitors, overlay) is managed as a singleton across tool calls within a session.

## Troubleshooting

**Playwright Chromium not found**

```bash
npx playwright install chromium
```

**Build errors**

```bash
npm run build
# Check TypeScript errors in src/
```

**Browser fails to launch**

Ensure no other Playwright instances are running. Try `browser_close` then `browser_launch` again.
