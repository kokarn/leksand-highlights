# SHL Highlights App

A React Native app for following Swedish hockey, football, and biathlon events.

## Changelog

### 2.38.6
- Fix a bug where the "Download & install" update button could be tapped multiple times, kicking off duplicate downloads / installer launches. The download is now guarded so repeat taps while a download or install is already underway are ignored
- When an app update is available (or downloading/installing), the App Updates card now moves to the TOP of Settings instead of sitting below Appearance, so the action is the first thing you see

### 2.38.5
- Restyle the Biathlon Men/Women gender selector in the standings view to match the app's other pill selectors (the Schedule/Standings ViewToggle right above it). It now uses the same compact, centered icon+text chips with the shared card/chipActive theme tokens and male/female icons, instead of the previous full-width buttons with hardcoded colors and no icons

### 2.38.4
- Show the day of week before the date on event cards, in short form (e.g. "Fri 8 Aug" / "Fre 8 aug"). Upcoming games within the next week now read as a short weekday abbreviation ("Fri" instead of "Friday"), and games further out lead with the weekday before the day/month. "Today"/"Tomorrow" (and the Swedish "Idag"/"Imorgon") are unchanged

### 2.38.1
- Fix ~10 Round 3 qualifying-bracket ties rendering with NO connector to the round that feeds them. The app reconstructs feeder links by matching each "Winner: A / B" draw placeholder back to the previous round's tie by team name, but the matcher only accepted an exact shared token — so Wikipedia-vs-ESPN name variants like "Paks" (draw) vs "Paksi SE" (ESPN R2) never linked. Added a conservative ≥4-char prefix match (shorter token must be a prefix of the longer) alongside the existing alias map; this recovers the missing links (live Conference qual R3: 26→27 of 30 connected) with zero ambiguous multi-matches. The remaining unconnected R3 ties are correct: fresh seeded entrants and "Loser: …" slots dropping in from Champions/Europa League qualifying, which genuinely have no feeder in this bracket. Short/ambiguous tokens (≤3 chars like "AEK") still require an exact hit so they can't force a wrong link

### 2.38.0
- Fix Round 3 (and later drawn rounds) of the qualifying brackets showing inconsistent team names + blank logos. Those rounds come from a separate Wikipedia-draw source (`future-bracket-rounds.js`) that emits raw placeholder teams, so a club that already played earlier rounds re-appeared with a different name and no crest (e.g. R3 "Vaduz"/"Tobol"/"Drita" vs "FC Vaduz"/"Tobol Kostanay"/"Drita Gjilan" with logos in R1/R2). `mergeFutureRounds` now enriches each real future-round club with the canonical name/code/logo from earlier rounds — exact match on code/name first, then a conservative token-subset fuzzy match that is SKIPPED when more than one distinct club matches (so ambiguous bare names like "Riga" never get the wrong crest). Genuine undecided "Winner: A / B" slots and fresh entrants dropping in from Champions/Europa qualifying stay as-is. Live effect on Conference qual R3: 7 of 11 real clubs now resolve to their canonical name + crest, the rest correctly left raw

### 2.37.0
- Bring the qualifying bracket into the shared team-identity system. The bracket built its team objects straight from raw ESPN fields (`shortDisplayName`/`t.logo`), bypassing both the canonical name resolver and the fallback-badge logo map — so it was the one surface where a club could read differently and where ~118/210 crests were blank. `buildBracket` now accepts injected `resolveNames`/`resolveIcon` (wired to the provider's `getTeamNames`/`resolveTeamIcon`), emits the canonical `names:{short,long}` shape (keeping `name` for back-compat), and the app's `LeagueBracketScreen` renders names/logos through the shared `getTeamName`/`getTeamLogoUri` helpers. Live effect: bracket long-names now match the rest of the app (e.g. `Strassen`→`UNA Strassen`, `BATE`→`BATE Borisov`) and blank bracket logos dropped 118→69 (the remainder are clubs with no crest anywhere)

### 2.36.1
- Fix the CI test suite failing to import the new shared team-identity module under raw Node ESM: `utils/teamIdentity.js` imported `../api/shl` without the `.js` extension, which Metro/Expo tolerate but Node's ESM loader rejects (`ERR_MODULE_NOT_FOUND`), breaking the team-page tests and the backend Docker Publish gate

### 2.36.0
- Add a shared team-identity system so team names, codes, and logos resolve the same way everywhere. Both the backend (`modules/team-identity.js`) and the app (`utils/teamIdentity.js`) now route every team through one resolver instead of ~15 copy-pasted `names.short || names.long || code` fallback chains. This fixes a real inconsistency where the same club could show a short name on a card but a long name in its goal/pre-game push; the canonical rule is now short for cards/notification titles, long only for long-form push bodies. The app also gets one `getTeamLogoUri(team, family)` entry point that internally picks the hockey local-PNG-by-code path vs the football upstream-icon path, so cards no longer choose the logo mechanism by hand and a new sport is a single switch case

### 2.35.0
- Replace the qualifying bracket's fixed row grid with the approved feeder-aligned funnel layout: reconstruct missing Third Round links from `Winner: A / B` placeholder names, reject impossible many-to-one phantom feeders, reorder ties with barycenter sweeps to eliminate connector crossings, anchor the largest round as a spine, and use weighted isotonic alignment to keep matches level with their feeders wherever possible. Connectors now use one simple shared midpoint per column gap (no per-line arrow offsets), while aligned matches render as a single straight horizontal line. Duplicate placeholder tie keys are handled with unique render/layout IDs. The geometry and feeder logic moved into a pure testable utility with regression coverage

### 2.34.0
- Fix two qualifying-bracket rendering bugs. (1) Overlapping connectors: every winner→next-round line between a pair of columns used to bend at the same x, so their vertical segments stacked on top of each other and you couldn't tell which match fed which. Each connector now gets its own vertical channel, spread evenly across the inter-column gutter and ordered by height, so no two lines share an x. (2) Round 3 not aligned with Round 2: the feeder/spine-anchoring layout staggered later rounds off a shared baseline (and mislaid rounds whose live data reuses placeholder tie keys like `draw-q3-1`). Every round now stacks uniformly from a shared top baseline on a fixed grid, positioned by slot index, so all columns line up in clean horizontal rows

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
