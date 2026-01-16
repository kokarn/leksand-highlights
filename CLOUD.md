# Cloud Runbook

## Overview
Sports API with video support for schedules, game details, and highlight clips.

## Prerequisites
- Node.js 18+ (native fetch is required).

## Install
- `npm install`

## Run
- `npm start`
- Default base URL: `http://localhost:3000`

## Environment variables
- `PORT`: overrides the default port (3000).
- `DATA_PROVIDER`: data source provider (default: `shl`).

## Useful URLs
- Landing page: `http://localhost:3000`
- Admin console: `http://localhost:3000/admin`
- API base: `http://localhost:3000/api`
- Static assets: `http://localhost:3000/static`

## Admin workflows
- List admin games: `GET /api/admin/games`
- Create admin game: `POST /api/admin/games`
- Update admin game: `PATCH /api/admin/games/:id`
- Delete admin game: `DELETE /api/admin/games/:id`
- Admin games are merged into `GET /api/games`.
- Admin game details and videos return safe empty payloads via
  `GET /api/game/:uuid/details` and `GET /api/game/:uuid/videos`.

## Operational actions
- Status (cache + notifier): `GET /api/status`
- Clear caches: `POST /api/cache/clear`
- Manual notifier check: `POST /api/notifier/check`

## Data persistence
- `admin_games.json`: manual games storage (gitignored).
- `seen_games.json`: notifier state (gitignored).
- `seen_videos.json`: notifier state.

## API documentation
- See `API_DOCUMENTATION.md`.

## Testing
- `npm test` currently exits with an error; manual checks only.
