# 🏒 GamePulse API Server

**Version: 3.0.0**

A multi-sport API server that provides real-time game data, notifications, and highlights for Swedish sports leagues.

## ✨ Features

### Supported Sports
- **SHL (Hockey)**: Full game schedule, play-by-play events, team stats, video highlights
- **Allsvenskan (Football)**: Match schedule, detailed game events (goals, cards, substitutions), team statistics, lineups
- **Biathlon**: World Cup races, results, and standings

### Core Features
- **Push Notifications**: Goal alerts and pre-game reminders via Firebase Cloud Messaging (FCM)
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

The server uses native `fetch` and requires Node.js 18+.

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
| `goal_notifications` | Users who want goal alerts |
| `pre_game_shl` | Pre-game reminders for SHL |
| `pre_game_football` | Pre-game reminders for Allsvenskan |
| `pre_game_biathlon` | Pre-game reminders for Biathlon |
| `team_{code}` | Team-specific notifications (e.g., `team_lif`, `team_dif`) |

## 📊 Admin API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/fcm/subscribers` | List all registered subscribers and their topics |
| `GET /api/fcm/topics` | List all topics with subscriber counts |
| `GET /api/fcm/topics/:topic` | Get details for a specific topic |
| `POST /api/fcm/register` | Register a device token with topics |
| `POST /api/fcm/unregister` | Unregister a device token |

---
*Powered by SHL Media API & Firebase Cloud Messaging*
