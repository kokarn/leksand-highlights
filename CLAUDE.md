# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GamePulse is a multi-sport API server + React Native mobile app for Swedish sports leagues. The server provides real-time game data and push notifications (via Firebase Cloud Messaging) for SHL hockey, Allsvenskan football, Svenska Cupen football, and biathlon.

## Development Commands

### Server (root directory)
```bash
npm install          # Install dependencies
npm start            # Start production server (port 3080)
npm run dev          # Start with file watching and .env loaded
```

### Mobile App (shl-highlights-app/)
```bash
cd shl-highlights-app
npm install
npm start            # Start Expo dev server
npm run ios          # Run on iOS simulator
npm run android      # Run on Android emulator
npm run lint         # Run ESLint
```

## Architecture

### Server (Node.js + Express)

**Entry point:** `server.js` - Express server with all API endpoints

**Core modules in `modules/`:**
- `providers/` - Sport data providers implementing `BaseProvider` interface
  - `base.js` - Abstract interface (fetchAllGames, fetchGameDetails, etc.)
  - `shl.js` - SHL Media API integration
  - `allsvenskan.js` - Allsvenskan/football data
 - `svenska-cupen.js` - Svenska Cupen/football cup data
  - `biathlon.js` - IBU biathlon data
- `cache.js` - In-memory caching with TTL (15s live, 60s normal)
- `goal-watcher.js` - Polls live games for new goals, triggers notifications
- `pre-game-watcher.js` - Scheduled reminders before game starts
- `fcm-notifications.js` - Firebase Cloud Messaging integration
- `notifier.js` - Video highlight detection and notifications
- `scheduler.js` - Background task scheduling
- `admin-games.js` - Manual game management for testing

**Key patterns:**
- Providers are singletons accessed via `getProvider('shl')`
- Cache durations shorten during live games (15s vs 60s)
- FCM topics: `goal_notifications`, `pre_game_shl`, `team_{code}`

### Mobile App (React Native + Expo)

**Entry point:** `shl-highlights-app/app/index.js`

**Structure:**
- `hooks/` - Data fetching hooks (`useShlData`, `useFootballData`, `useBiathlonData`, `usePushNotifications`)
- `components/` - Reusable UI components
  - `cards/` - Game/race card components
  - `modals/` - Detail modals for each sport
  - `events/` - Goal, penalty, substitution items
- `api/shl.js` - API client, team logos, nation flags
- `contexts/ThemeContext.js` - Dark/light theme

**Key patterns:**
- All sports data eagerly loaded on app start for instant navigation
- Deep linking: `gamepulse://game/{sport}/{gameId}`
- FCM topic subscriptions managed via `usePushNotifications` hook

## Environment Variables

```
PORT=3080
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
# Or individual Firebase credentials:
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## API Endpoints

- `GET /api/games` - SHL schedule with live score enrichment
- `GET /api/game/:uuid/details` - Game details, events, stats
- `GET /api/football/games` - Allsvenskan fixtures
- `GET /api/svenska-cupen/games` - Svenska Cupen fixtures
- `GET /api/biathlon/races` - Biathlon race schedule
- `GET /api/standings`, `/api/football/standings`, `/api/svenska-cupen/standings`, `/api/biathlon/standings`
- `POST /api/fcm/register` - Device registration with topics
- `GET /admin` - Admin dashboard (client-side routing)
