# 🏒 GamePulse API Server

**Version: 2.9.1**

A multi-sport API server that provides real-time game data, notifications, and highlights for Swedish sports leagues.

## ✨ Features

### Supported Sports
- **SHL (Hockey)**: Full game schedule, play-by-play events, team stats, video highlights
- **Allsvenskan (Football)**: Match schedule, detailed game events (goals, cards, substitutions), team statistics, lineups
- **Biathlon**: World Cup races, results, and standings

### Core Features
- **Push Notifications**: Goal alerts via OneSignal
- **Real-time Monitoring**: Live game tracking with adaptive polling
- **Rich Game Details**: Goals, penalties/cards, team stats, rosters
- **Video Highlights**: Direct streaming URLs for SHL highlights
- **Built-in Landing Page**: Team selection and notification subscription

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd leksand-notify
   npm install # (Optional, as there are no dependencies)
   ```

2. **Run the Notifier**
   ```bash
   npm start
   ```

3. **Subscribe to Highlights**
   Visit `http://localhost:3080` in your browser to select your team and subscribe via ntfy.

## 🛠 Configuration

The script uses native `fetch` and requires Node.js 18+. To customize the ntfy topics or script behavior, check the constants at the top of `shl_notifier.js`.

---
*Powered by SHL Media API & [ntfy.sh](https://ntfy.sh)*
