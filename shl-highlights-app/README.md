# SHL Highlights App

A React Native app for following Swedish hockey, football, and biathlon events.

## Changelog

### 2.33.0
- Fix the qualifying bracket bunching every round at the top: the tallest round (e.g. Second Round's 49 ties) is now the spine and every other round aligns to it — earlier rounds spread out so each match sits at the height of the next-round tie it feeds, later rounds anchor to their feeder. Round 1 is now spread across the full height and centered instead of compacted at the top, and ~17 of 18 first→second-round connectors run dead straight

### 2.32.0
- Restore straight-across connectors in the qualifying bracket where possible: a tie fed by a single previous-round tie now sits at that feeder's exact vertical position (connector runs dead straight), and only shifts down when two feeders sit too close to both stay level. Seeded/fresh entrants fill the gaps around the anchored ties, and one global shift keeps every aligned pair aligned. ~17 of 29 single-feeder connectors are now perfectly straight (was ~1)

### 2.31.0
- Lay out the qualifying bracket like a real bracket: each round is now a contiguous block of ties ordered by feeder position (connectors flow top-to-bottom without crossing) and vertically centered against the tallest round. Shorter later rounds (e.g. Third Round's 30 ties vs Second Round's 49) sit in the middle band so feeder lines converge inward — the classic bracket funnel — instead of every round starting flush at the top

### 2.30.0
- Fix qualifying-bracket connectors that stopped short in empty space: feeder lines are now drawn in a single overlay spanning the whole canvas (instead of nested inside each round column, where the next column's background clipped/painted over them), so every connector bridges the full gap and lands its arrowhead on the target card's left edge

### 2.29.0
- Row-align the qualifying bracket by feeder link: a team's tie now sits at the same vertical height as the next-round tie it feeds into (e.g. Levadia Tallinn's first-round tie lines up directly beside its second-round tie), so you can read a club's path straight across. Seeded entrants fill the remaining row slots

### 2.28.0
- Make the team-page competition links less pronounced: they're now compact, subtle chips showing just a small icon + the league name (no "table"/"bracket" text, no chevron, no filled card), wrapping in a row instead of full-width buttons

### 2.27.0
- Align the qualifying bracket into clean rows: every round column now starts at the same top baseline and its ties are stacked on a fixed grid, so First/Second/Third round cards line up horizontally instead of drifting down the canvas. Feeder→tie connectors still trace each team's path

### 2.26.0
- Fix the qualifying bracket only being partly visible: the screen now scrolls both vertically and horizontally, so all rounds are reachable. Previously later rounds (Second/Third) were positioned far down the canvas with no vertical scroll, so they looked empty and the First Round couldn't be scrolled through. Opening the bracket from a team page now auto-scrolls to that team's tie

### 2.25.0
- Clean up the team page header: remove the competition list shown above the team name (logo, name and form now stand alone) and surface each competition the team plays in as a tappable button next to the standings/bracket actions — league-table competitions open standings, knockout competitions open the bracket

### 2.24.0
- Render the qualifying view as a traditional bracket: each real feeder tie now connects directly to the exact tie it feeds in the following round using horizontal/vertical bracket lines and arrowheads. Future draw slots carry explicit feeder links, so GAIS/Nordsjælland visibly joins Valur/Zrinjski in their third-round matchup

### 2.23.0
- Make qualifying rounds visually distinct with bordered round lanes, numbered headers, and directional connector arrows between stages. The selected team's route receives purple lane, tie, and connector highlighting so its possible progression remains visible across unresolved future rounds

### 2.22.0
- Extend the qualifying bracket beyond ESPN's currently published fixtures: Conference League now includes the already-drawn **Third Round** with honest unresolved winner slots (including GAIS/Nordsjælland's path), plus the upcoming **Play-off Round** and its draw date. Future slots resolve automatically to real ESPN teams and scores once those fixtures become available

### 2.21.0
- Add a knockout **Bracket** view for the qualifying leagues (Conference League Qualifying, Europa League Qualifying), reachable via a "View bracket" button on a team's page. Rounds scroll horizontally; two-legged ties show aggregate + both legs + winner. Teams that advanced from a prior round are marked with an up-arrow, and teams seeded in fresh (byes) get an amber marker — so the growing qualifying draw reads honestly instead of faking a clean tree. Tap any team to trace its path: an advanced team shows the earlier-round tie it won (and whom it beat), a seeded team shows it entered at that round, with a link to the full team page. Backend builds the bracket from ESPN series/leg/aggregate data (`/api/<league>/bracket`)

### 2.20.0
- Add "View standings" buttons on team pages: from a team page you can jump to the full league table for each standings-capable league the team plays in (Allsvenskan, SHL, HockeyAllsvenskan, Svenska Cupen groups). Knockout leagues (Europa/Conference League Qualifying) have no table so no button is shown. The standings screen reuses the shared StandingsTable, highlights the team's row, and tapping any row opens that team's page — so you can hop team → standings → team

### 2.19.0
- Add team pages: tap a team's logo/name in a game's score view, or a row in any standings table, to open a dedicated page showing that team's latest and upcoming games (form strip + reused game cards). Works across all team sports that share the same setup — hockey (SHL, HockeyAllsvenskan) and football (Allsvenskan, Svenska Cupen, Europa/Conference League Qualifying) — via one shared TeamGamesScreen component and a `/team/[family]/[code]` route

### 2.15.0
- Add Conference League Qualifying as a sub-league merged into the "Football" tab (alongside Allsvenskan, Svenska Cupen, and Europa League Qualifying) — combined schedule with per-game "Conference League Qualifying" labels, shared football team filter, and match modal (knockout format, so no standings table or clips)

### 2.14.0
- Add Europa League Qualifying as a sub-league merged into the "Football" tab (alongside Allsvenskan and Svenska Cupen) — combined schedule with per-game "Europa League Qualifying" labels, shared football team filter, and match modal (knockout format, so no standings table or clips)

### 2.13.0
- Use a proper hockey puck icon for the Hockey tab (was a snowflake)
- Add HockeyAllsvenskan team logos (aik, ais, bik, iko, khc, mik, modo, nyb, osik, ssk, vhc, vik, vis)

### 2.12.0
- Merge SHL and HockeyAllsvenskan into a single "Hockey" tab (mirrors how Football combines Allsvenskan + Svenska Cupen) — one combined schedule with per-game league labels, one merged hockey team list in Settings/onboarding

### 2.11.0
- Add HockeyAllsvenskan as a selectable league in the app (own sport tab, schedule, standings, and game modal)
- Add HockeyAllsvenskan team selection in Settings and onboarding, wired into goal-notification topics
- Include HockeyAllsvenskan games in the unified "All" feed with a distinct league indicator

### 2.9.0
- Add Allsvenskan highlights integration via FotbollPlay clips
- Add football match modal Highlights tab with in-modal clip playback
- Fix deep links for football games so modal auto-opens reliably for games outside the current list

### 2.8.4
- Make SHL detail tabs more compact on smaller screens by shortening labels and reducing tab padding
- Prevent awkward single-character wraps in team names on game cards and modal headers
- Improve compact card balance by giving team labels more room and scaling score text on narrow devices

### 2.8.2
- Bump app version to align with server release 3.8.0
- Add admin support for selecting Svenska Cupen in goal and pre-game notification tests

### 2.8.1
- Remove Olympics hockey schedule and standings from the Hockey tab
- Remove Olympics hockey events from the unified All view
- Keep hockey deep links focused on SHL games only

### 2.5.2
- Show home/away side indicators for hockey penalty events
- Align football card indicators with home/away side

### 2.5.1
- Show total time for all teams in biathlon relay results, with time difference shown separately
- Fix duplicate time difference display on biathlon relay results for non-winning teams
- Fix expanded shooting display overflowing screen on relay athlete rows
- Show shooting position labels (P/S) in compact mode for relay athletes
- Fix shooting display text colors for light/dark theme compatibility
- Pass shooting positions from competition data to correctly display P/S for relay shooting stages
- Fix relay shooting parsing: correctly handle "0+2 0+3" format (space-separated stages with spare rounds)
- Display spare rounds used in relay shooting: orange indicators for hits using spare rounds
- Only show "Clean!" badge if no misses AND no spare rounds were used
- Fix duplicate location in biathlon race modal header

### 2.5.0
- Remove "All Events" header from unified schedule view for cleaner look
- Show "Ended" instead of "Today" with time for finished games and races
- Fix video highlights grid layout to show 2 cards per row consistently
- Improve penalty event display with human-readable offense descriptions
- Map penalty codes like "IL-HEAD" to "Illegal hit to head", "Un Sp" to "Unsportsmanlike"
- Show team name instead of "Unknown" for bench/team penalties

### 2.4.0
- Upgrade React Native Firebase from v21 to v23.8.3
- Set explicit iOS deployment target to 15.1 (Firebase v23 requirement)
- Note: Android minSdk is now 23 (was 21)

### 2.3.2
- Update Expo SDK to 54.0.32 (latest patch)
- Update react-native-webview to 13.16.0

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
