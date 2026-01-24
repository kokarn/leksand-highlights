# SHL Highlights App

A React Native app for following Swedish hockey, football, and biathlon events.

## Changelog

### 2.3.1
- Apply theme colors to all match/race modals and event components
- Wrap events list in card container for better visual distinction
- Wrap highlights section in card container for consistency
- Standardize padding across all modal tabs (Summary, Events, Highlights)

### 2.3.0
- Add light mode support with theme toggle in Settings
- Theme options: System (default), Light, and Dark
- System option follows device color scheme preference
- Theme-aware styling throughout the app

### 2.2.0
- Remove legacy OneSignal integration code
- Clean up unused OneSignal utility files and imports

### 2.1.0
- Improve biathlon relay race start list view by grouping participants by team/nation
- Display team header with nation flag, bib number, and start info
- Show nested athletes under their team with leg numbers (without redundant country/start info)
- Add expandable shooting details for relay athletes
- Filter out IBU's internal high ResultOrder values (10000+) from display

### 2.0.0
- **BREAKING**: Migrate to Firebase Cloud Messaging (FCM) for push notifications
- Topic-based subscriptions for team and notification preferences
- Server-side subscriber tracking for admin dashboard
- FCM supports up to 2,000 topics per device

### 1.18.2
- Fix FCM topics not being updated when changing push notification settings after app initialization
- Use ref instead of state for initialization check to avoid stale closure issues

### 1.18.1
- Fix 5-digit starting numbers showing for DNS/DNF athletes in biathlon results (filter ResultOrder >= 10000)

### 1.18.0
- Add country filter dropdown on biathlon race results to show only athletes from a specific nation

### 1.17.2
- Remove scroll animation when navigating to today's date on match lists

### 1.17.1
- Fix FCM topics not updating when toggling sport notification preferences
- Add queuing mechanism for topic updates before FCM initialization completes
- Improve logging for FCM topic operations

### 1.17.0
- Add pull-to-refresh on game/race detail modals for SHL, Football, and Biathlon

### 1.16.2
- Keep today's games in the All Events list until day end

### 1.16.1
- Enable fullscreen video playback for hockey highlights on native platforms

### 1.16.0
- Add pre-game reminder notifications (5 minutes before event start)
- Add per-sport notification settings for game reminders (SHL, Allsvenskan, Biathlon)
- New "Game Reminders" section in Settings modal

### 1.15.1
- Fix biathlon card centering on tablet widths by giving left and right containers equal flex widths

### 1.15.0
- Add dropdown season picker to football standings view
- Add swipe gesture navigation between tabs on match detail pages
- Remove "Analyzed xx games" text from SHL standings
- Remove biathlon country filter from settings and onboarding

### 1.14.0
- Unify football and hockey game modals with shared header component
- Move Match Details section to Summary tab (removed separate Info tab)
- Rename "Team Stats" to "Match Stats" in hockey modal for consistency
- Add logo placeholder fallback to hockey modal
- Hide Match Stats section in pre-game state for both sports

### 1.13.0
- Replace sport tabs with a compact dropdown picker
- Use English relative date format on all event cards (Today, Tomorrow, weekday names)
- Align event card widths with header
- Fix gender badge text wrapping on narrow screens
- Center discipline text in biathlon cards when wrapping
- Remove location name from biathlon cards for cleaner look
- Default to showing all sports for new users

### 1.12.1
- Previous release

---

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
