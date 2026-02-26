# 🏒 GamePulse API Server

**Version: 3.8.0**

A multi-sport API server that provides real-time game data, notifications, and highlights for Swedish sports leagues.

## ✨ Features

### Supported Sports
- **SHL (Hockey)**: Full game schedule, play-by-play events, team stats, video highlights
- **Allsvenskan (Football)**: Match schedule, detailed game events (goals, cards, substitutions), team statistics, lineups
- **Svenska Cupen (Football Cup)**: Live match schedule, match details, and group standings
- **Biathlon**: World Cup races, results, and standings

### Core Features
- **Push Notifications**: Goal alerts, highlight clip alerts, and pre-game reminders via Firebase Cloud Messaging (FCM)
- **Real-time Monitoring**: Live game tracking with adaptive polling
- **Rich Game Details**: Goals, penalties/cards, team stats, rosters
- **Video Highlights**: Direct streaming URLs for SHL highlights
- **Admin Dashboard**: Live subscriber and topic monitoring

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd leksand-notify
   npm install
   ```

2. **Configure Firebase (for push notifications)**
   
   Set one of these environment variable options:
   
   Option A - Service Account File:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
   ```
   
   Option B - Environment Variables:
   ```bash
   export FIREBASE_PROJECT_ID=your-project-id
   export FIREBASE_CLIENT_EMAIL=your-client-email
   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. **Run the Server**
   ```bash
   npm start
   ```

4. **Access Admin Dashboard**
   Visit `http://localhost:3080/admin` to monitor subscribers, topics, and send test notifications.

## 🛠 Configuration

The server uses native `fetch` and requires Node.js 20+ (tested with Node 24 in Docker).

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3080) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON |
| `FIREBASE_PROJECT_ID` | Firebase project ID (alternative to credentials file) |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email (alternative to credentials file) |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (alternative to credentials file) |

## 📱 FCM Topics

The notification system uses FCM topics for targeting:

| Topic | Description |
|-------|-------------|
| `goal_notifications` | Enables goal and highlight alerts for followed teams |
| `pre_game_shl` | Pre-game reminders for SHL |
| `pre_game_football` | Pre-game reminders for Allsvenskan and Svenska Cupen |
| `pre_game_biathlon` | Pre-game reminders for Biathlon |
| `team_{code}` | Team-specific notifications (e.g., `team_lif`, `team_dif`) |

## 📊 Admin Console

Access the admin dashboard at `/admin` with URL-based routing:
- `/admin` - Dashboard
- `/admin/push` - Push Notifications
- `/admin/goal-test` - Goal Testing
- `/admin/pregame-test` - Event Start Testing
- `/admin/status` - System Status
- `/admin/cache` - Cache Management
- `/admin/games` - Manual Games

## 🔌 FCM API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/fcm/register` | Register a device token with topics |
| `POST /api/fcm/unregister` | Unregister a device token |
| `POST /api/notifications/test` | Send a test notification |
| `POST /api/notifications/goal-test` | Send a test goal notification |
| `POST /api/notifications/pre-game-test` | Send a test pre-game/event start notification |
| `GET /api/fcm/errors` | Get FCM error log (query param: `limit`) |
| `POST /api/fcm/errors/clear` | Clear the FCM error log |

> **Note:** FCM does not provide an API to query topic subscribers. The backend runs stateless - topic subscriptions are managed entirely by Firebase.

---
*Powered by SHL Media API & Firebase Cloud Messaging*
