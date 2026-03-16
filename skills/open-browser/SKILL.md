---
name: open-browser
description: Open a browser window and navigate to a URL for visual frontend development
arguments:
  - name: url
    description: The URL to navigate to
    required: true
---

# Open Browser

Opens a Chromium browser and navigates to the specified URL.

## Instructions

1. Call the `browser_launch` tool with the provided URL
2. Wait for the page to load
3. Call `browser_screenshot` to capture the initial state
4. Present the screenshot to the user
5. Suggest next steps:
   - Use `start_element_selection` to visually select and inspect elements
   - Use `get_console_logs` to check for errors
   - Use `get_network_requests` to monitor API calls
