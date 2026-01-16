# 🏒 SHL Highlights Notifier

A lightweight, zero-dependency Node.js service that monitors the SHL schedule and sends mobile notifications (via ntfy) as soon as game highlights are published.

## ✨ Features

- **Multi-Team Support**: Dedicated notification topics for all 14 SHL teams.
- **Zero Dependencies**: Built entirely with native Node.js modules (`http`, `fs`, `fetch`).
- **Real-time Monitoring**: Polls the SHL Media API every 5 minutes.
- **Built-in Landing Page**: Serve a beautiful team selection page on port 3080.
- **Spoiler-Free**: Clean notifications with direct links to `staylive.tv` videos.
- **Reliable**: Handles the usual delay between game end and highlight publication (up to 24h).

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
