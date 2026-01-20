# Agent Rules

## Workflows
- Always verify the look of UI changes on both **desktop** and **mobile** screen sizes using the browser subagent.
- When using the browser subagent, remember to close the tab after you are done.
- When testing, if there's a npm script called "dev" available, use that
- When adding tests, add it in a folder called "test"
- Use context7
- Keep the admin console in sync with new API features (e.g., new sports).
- Before starting on a task, make sure we do a git pull

## Design
- Ensure that buttons and layouts are responsive and premium-looking across all devices.

## Code Style
- Prefer early returns over complex conditionals.
- Prefer simple and readable code over complex and unreadable code.
- Use descriptive variable names that are self-explanatory.
- Use node builtins over external dependencies for basic functionality, such as fetch
- When we print timestamps, make sure to do it in a local swedish style with dates
- Always use curly brackets for if statements and the like

## Backend
- Always use the latest LTS version of node.js
- Always increment the version according to semver

## App
- Always increment the version according to semver
- When incrementing versions, update the readme
