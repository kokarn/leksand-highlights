# Agent Rules

## Workflows
- Always verify the look of UI changes on both **desktop** and **mobile** screen sizes using the browser subagent.
- When using the browser subagent, remember to close the tab after you are done.
- For PRs opened from `cursor/**` branches that modify `shl-highlights-app/**`, include **both desktop and mobile screenshots** in the PR description.
- When testing, if there's a npm script called "dev" available, use that
- When adding tests, add it in a folder called "test"
- Use context7
- Keep the admin console in sync with new API features (e.g., new sports).
- Before starting on a task, make sure we do a git pull
- When incrementing versions, update the readme or changelog
- Never change text for old versions in changelogs

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
- Always increment the version according to semver. Both in package.json and in app.json

## Cursor Cloud specific instructions

### Services

| Service | Port | Start command | Notes |
|---------|------|---------------|-------|
| API Server | 3080 | `npm run dev` (root) | Requires a `.env` file (can be empty or just `PORT=3080`). No database; uses in-memory cache + JSON files. |
| Mobile App (web) | 8081 | `cd shl-highlights-app && npx expo start --web --port 8081` | Expo web mode; auto-connects to API at `localhost:3080`. Use for UI verification. |

### Running the server

- The `npm run dev` script uses `node --watch --env-file=.env`, so a `.env` file must exist in the project root (it is gitignored). A minimal file with `PORT=3080` is sufficient.
- Firebase/FCM credentials are optional; the server starts without them and logs a warning. Push notification features are gracefully disabled.
- Admin dashboard: `http://localhost:3080/admin`
- API status: `http://localhost:3080/api/status`

### Lint and tests

- **Server**: `npm test` is a placeholder (exits 1). No automated tests exist yet; manual API testing only.
- **Mobile app**: `cd shl-highlights-app && npm run lint` runs ESLint via Expo. Pre-existing warnings/errors exist in the codebase.

### Key gotchas

- The server writes JSON state files (`admin_games.json`, `seen_games.json`, etc.) to the project root. These are gitignored.
- `@resvg/resvg-js` ships prebuilt binaries; no native compilation tools needed beyond npm.
- The `--watch` flag in `npm run dev` does not pick up new npm dependency installations; restart the server after `npm install`.
- The mobile app's `api/shl.js` auto-detects `localhost` in the browser and points API calls to `localhost:3080`. No manual API URL config is needed for web mode.
- The Expo web app has an onboarding flow on first load; click "Get Started" and optionally select favorite teams to reach the main feed.
