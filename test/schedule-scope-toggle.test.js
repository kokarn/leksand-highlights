const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');

const appSource = read('app/index.js');
const prefsSource = read('hooks/usePreferences.js');
const constantsSource = read('constants/index.js');
const scopeToggleSource = read('components/ui/ScopeToggle.js');
const compactCardSource = read('components/cards/CompactGameCard.js');
const dayHeaderSource = read('components/ui/DayHeader.js');
const settingsSource = read('components/modals/SettingsModal.js');
const onboardingSource = read('components/modals/OnboardingModal.js');

test('schedule scope is persisted via a dedicated storage key', () => {
    assert.match(constantsSource, /SCHEDULE_SCOPE:\s*'scheduleScope'/);
    assert.match(prefsSource, /const \[scheduleScope, setScheduleScope\] = useState\('myteams'\)/);
    // loads and saves through AsyncStorage like the other prefs
    assert.match(prefsSource, /AsyncStorage\.getItem\(STORAGE_KEYS\.SCHEDULE_SCOPE\)/);
    assert.match(prefsSource, /savePreference\(STORAGE_KEYS\.SCHEDULE_SCOPE, scope\)/);
    // exposed to the app
    assert.match(prefsSource, /\n\s*scheduleScope,/);
    assert.match(prefsSource, /handleScheduleScopeChange,/);
});

test("'all' scope bypasses the team filter by passing empty arrays to the data hooks", () => {
    assert.match(appSource, /const showAllMatches = scheduleScope === 'all'/);
    assert.match(appSource, /const scopedTeams = unfiltered \? \[\] : selectedTeams/);
    assert.match(appSource, /const scopedFootballTeams = unfiltered \? \[\] : selectedFootballTeams/);
    // hooks consume the scoped arrays, not the raw selected lists
    assert.match(appSource, /useFootballData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useShlData\(activeSport, scopedTeams/);
    assert.match(appSource, /useHockeyAllsvenskanData\(activeSport, scopedTeams/);
    assert.match(appSource, /useSvenskaCupenData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useEuropaLeagueQualData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useConferenceLeagueQualData\(activeSport, scopedFootballTeams/);
});

test('BOTH scopes render day-grouped sections (DayHeader + CompactGameCard)', () => {
    // One listing style app-wide: both lists always take the section array, so
    // there is no longer a tall-card branch to switch to.
    assert.match(appSource, /data=\{footballSections\}/);
    assert.match(appSource, /data=\{hockeySections\}/);
    assert.doesNotMatch(appSource, /data=\{showAllMatches \?/);
    // header rows render DayHeader; game rows render CompactGameCard
    assert.match(appSource, /item\.type === 'header' \? \(\s*<DayHeader date=\{item\.date\} \/>/);
    assert.match(appSource, /<CompactGameCard[\s\S]*?game=\{item\.game\}[\s\S]*?family="football"/);
    assert.match(appSource, /<CompactGameCard[\s\S]*?game=\{item\.game\}[\s\S]*?family=\{item\.game\.sport === 'hockeyallsvenskan' \? 'hockeyallsvenskan' : 'shl'\}/);
    // The tall cards are gone from the schedule lists entirely.
    assert.doesNotMatch(appSource, /<GameCard/);
    assert.doesNotMatch(appSource, /<FootballGameCard/);
    // Sections are built in both scopes; only the league filter is scoped to
    // all-matches (My teams is already narrowed to followed teams).
    assert.match(appSource, /buildScheduleSections\(\s*showAllMatches\s*\?\s*filterVisibleLeagues\(combinedFootballGames, hiddenAllMatchesLeagues\)\s*:\s*combinedFootballGames\s*\)/);
    assert.match(appSource, /buildScheduleSections\(\s*showAllMatches\s*\?\s*filterVisibleLeagues\(combinedHockeyGames, hiddenAllMatchesLeagues\)\s*:\s*combinedHockeyGames\s*\)/);
});

test('getItemLayout reads the precomputed section layout unconditionally', () => {
    assert.match(appSource, /const l = footballSectionLayout\[index\]/);
    assert.match(appSource, /const l = hockeySectionLayout\[index\]/);
    // Uniform compact rows mean the tall-card heights are gone for good — a
    // stray 174 would silently misplace every scroll offset.
    assert.doesNotMatch(appSource, /GAME_CARD_HEIGHT/);
    assert.doesNotMatch(appSource, /FOOTBALL_CARD_HEIGHT/);
    // The biathlon tab is the one list still using a tall card.
    assert.match(appSource, /const BIATHLON_CARD_HEIGHT = 168/);
});

test('auto-scroll uses the section offset in both scopes so it lands on the live match not the top', () => {
    assert.match(appSource, /const offset = footballSectionTargetOffset;/);
    assert.match(appSource, /const offset = hockeySectionTargetOffset;/);
});

test('no second auto-scroll races the combined list against a tall-card height', () => {
    // Each per-league hook used to multiply its OWN target index by a 174px
    // card height and scroll the same listRef app/index.js owns. Against 56px
    // compact rows that overshoots by ~3x, so the combined list is the only
    // thing that scrolls now.
    for (const rel of [
        'hooks/useShlData.js',
        'hooks/useHockeyAllsvenskanData.js',
        'hooks/useSvenskaCupenData.js',
        'hooks/useEuropaLeagueQualData.js',
        'hooks/useConferenceLeagueQualData.js'
    ]) {
        const source = read(rel);
        assert.doesNotMatch(source, /CARD_HEIGHT/, `${rel} must not carry a card-height constant`);
        assert.doesNotMatch(source, /scrollToOffset\(\{\s*\n?\s*offset: targetGameIndex/, `${rel} must not auto-scroll`);
    }
    // The biathlon tab keeps its own tall-card scroll: it is not a schedule list.
    assert.match(read('hooks/useBiathlonData.js'), /BIATHLON_CARD_HEIGHT = 168/);
});

test('scroll guards reset when scope flips, before the target effects, so it re-anchors', () => {
    assert.match(appSource, /hasFootballCombinedInitialScrolled\.current = false;\s*hasHockeyCombinedInitialScrolled\.current = false;/);
    assert.match(appSource, /\}, \[scheduleScope\]\)/);
    const resetIdx = appSource.indexOf('hasFootballCombinedInitialScrolled.current = false;');
    const footballScrollIdx = appSource.indexOf('Initial scroll to live/upcoming in combined football list');
    const hockeyScrollIdx = appSource.indexOf('Initial scroll to live/upcoming in combined hockey list');
    assert.ok(resetIdx > -1 && footballScrollIdx > -1 && hockeyScrollIdx > -1);
    assert.ok(resetIdx < footballScrollIdx, 'guard reset must be declared before the football scroll effect');
    assert.ok(resetIdx < hockeyScrollIdx, 'guard reset must be declared before the hockey scroll effect');
});

test('switching scope does NOT scroll to the top — the key change remounts the list', () => {
    // Regression: scheduleScope starts at 'myteams' and is hydrated from
    // AsyncStorage after mount, so a user with 'all' saved gets a scope CHANGE
    // on every cold load. A scrollToOffset(0) on that change raced the remount
    // the key flip triggers; when it landed last, the rows stayed rendered
    // around the anchor while the offset sat at 0 — a blank screen with a full
    // scrollbar. The remount already gives a fresh position, so there is no
    // stale offset to clear.
    assert.doesNotMatch(appSource, /scrollToOffset\(\{ offset: 0, animated: false \}\)/);
    // the list key still flips, which is what makes the reset unnecessary
    assert.match(appSource, /key=\{`hockey-\$\{scheduleScope\}`\}/);
    assert.match(appSource, /key=\{`football-\$\{scheduleScope\}`\}/);
});

test('ScopeToggle offers My teams / All matches and is wired into both tabs', () => {
    assert.match(scopeToggleSource, /key: 'myteams', label: 'My teams'/);
    assert.match(scopeToggleSource, /key: 'all', label: 'All matches'/);
    const count = (appSource.match(/<ScopeToggle scope=\{scheduleScope\} onChange=\{handleScheduleScopeChange\}/g) || []).length;
    assert.equal(count, 2);
});

test('DayHeader accents today and uses theme tokens, not hardcoded hex', () => {
    assert.match(dayHeaderSource, /isToday/);
    assert.match(dayHeaderSource, /TODAY ·/);
    assert.match(dayHeaderSource, /colors\.chipActive/);
    assert.match(dayHeaderSource, /colors\.accent/);
    assert.match(dayHeaderSource, /colors\.textMuted/);
    // height must match the layout constant so scroll offsets stay exact
    assert.match(dayHeaderSource, /height: 30/);
    assert.match(dayHeaderSource, /marginBottom: 12/);
});

test('the cross-sport All tab renders the same compact rows, dispatched by sport', () => {
    // A race has no home/away sides, so it gets the race-shaped row rather than
    // rendering as "Home 0–0 Away".
    assert.match(appSource, /<CompactRaceCard race=\{event\} onPress=\{handleUnifiedEventPress\} \/>/);
    assert.match(appSource, /family=\{HOCKEY_SPORTS\.includes\(sport\) \? sport : 'football'\}/);
    // handleEventPress takes the event; the compact card calls onPress() bare.
    assert.match(appSource, /onPress=\{\(\) => handleUnifiedEventPress\(event\)\}/);
    // The tall-card composer is no longer rendered by this list.
    assert.doesNotMatch(appSource, /<UnifiedEventCard/);
});

test('CompactRaceCard matches the game row geometry and reads biathlon state spellings', () => {
    const raceCardSource = read('components/cards/CompactRaceCard.js');
    // Same 44 + 12 = COMPACT_CARD_HEIGHT, so one layout constant covers every row.
    assert.match(raceCardSource, /height: 44/);
    assert.match(raceCardSource, /marginBottom: 12/);
    // normalizeEvent spreads the original event, so `state` keeps the biathlon
    // spelling: testing only 'post-game' would render finished races as upcoming.
    assert.match(raceCardSource, /state === 'completed'/);
    assert.match(raceCardSource, /race\?\.normalizedState/);
    assert.match(raceCardSource, /=== 'post-game'/);
    // 'starting-soon' is a fourth state the game card has no equivalent for.
    assert.match(raceCardSource, /state === 'starting-soon'/);
    assert.match(raceCardSource, /#FF9500/);
    // exported for the lists
    assert.match(read('components/cards/index.js'), /export \{ CompactRaceCard \}/);
});

test('multi-day status sections get day headers; single-day ones do not', () => {
    const unifiedSource = read('hooks/useUnifiedData.js');
    // A compact row shows a kickoff time and no date, so a match days out in
    // "This Week" / "Upcoming" / "Recent Results" needs the day above it.
    assert.match(unifiedSource, /addSection\('thisWeek'[^)]*\{ multiDay: true \}\)/);
    assert.match(unifiedSource, /addSection\('upcoming'[^)]*\{ multiDay: true \}\)/);
    assert.match(unifiedSource, /addSection\('recentResults'[^)]*\{ multiDay: true \}\)/);
    // Live / Starting Soon / Today / Tomorrow are single-day by construction.
    for (const key of ['live', 'startingSoon', 'today', 'tomorrow']) {
        const line = unifiedSource.match(new RegExp(`addSection\\('${key}'.*`))[0];
        assert.doesNotMatch(line, /multiDay/, `${key} must not emit day headers`);
    }
    // reuses the existing day-key helper rather than a second copy
    assert.match(unifiedSource, /import \{ localDayKey \} from '\.\.\/utils\/scheduleSections'/);
    // and the list renders + keys those rows
    assert.match(appSource, /item\.type === 'dayHeader'/);
});

test('CompactGameCard reuses shared team-identity resolvers, not a fresh fallback chain', () => {
    assert.match(compactCardSource, /getTeamName as resolveTeamName, getTeamLogoUri.*teamIdentity/);
    assert.match(compactCardSource, /export const COMPACT_CARD_HEIGHT/);
    assert.doesNotMatch(compactCardSource, /firebase|expo-notifications|messaging/i);
});

test('All-matches league filter: persisted hidden set, filtered sections, settings toggles', () => {
    // storage key + config
    assert.match(constantsSource, /HIDDEN_ALL_MATCHES_LEAGUES:\s*'hiddenAllMatchesLeagues'/);
    assert.match(constantsSource, /export const ALL_MATCHES_LEAGUES = \[/);
    // prefs plumbing (load, state, handler, exposed)
    assert.match(prefsSource, /const \[hiddenAllMatchesLeagues, setHiddenAllMatchesLeagues\] = useState\(\[\]\)/);
    assert.match(prefsSource, /AsyncStorage\.getItem\(STORAGE_KEYS\.HIDDEN_ALL_MATCHES_LEAGUES\)/);
    assert.match(prefsSource, /savePreference\(STORAGE_KEYS\.HIDDEN_ALL_MATCHES_LEAGUES, newHidden\)/);
    assert.match(prefsSource, /toggleAllMatchesLeague,/);
    // app applies the filter to both section lists (only in all scope — the
    // My-teams list is already narrowed to the teams you follow)
    assert.match(appSource, /filterVisibleLeagues\(combinedFootballGames, hiddenAllMatchesLeagues\)/);
    assert.match(appSource, /filterVisibleLeagues\(combinedHockeyGames, hiddenAllMatchesLeagues\)/);
    // settings renders the unified Leagues section, wired to both handlers
    assert.match(settingsSource, /ALL_MATCHES_LEAGUES/);
    assert.match(settingsSource, /onToggleAllMatchesLeague\?\.\(league\.id\)/);
    assert.match(settingsSource, /settingsSection}>Leagues</);
    // the old duplicate cards are gone
    assert.doesNotMatch(settingsSource, />Game Reminders</);
    assert.doesNotMatch(settingsSource, /settingsCardTitle}>All Matches</);
    // each league row carries both the reminder (bell) and the all-matches (eye) control
    assert.match(settingsSource, /onTogglePreGameLeague\?\.\(league\.id, !reminderOn\)/);
    assert.match(settingsSource, /eye-off-outline/);
});

test('redundant "Gender" wording removed from Settings + Onboarding', () => {
    // Settings biathlon card is now just "Biathlon"
    assert.match(settingsSource, /settingsCardTitle}>Biathlon</);
    assert.doesNotMatch(settingsSource, />Biathlon Gender</);
    // Onboarding biathlon step no longer has a standalone "Gender" label
    assert.doesNotMatch(onboardingSource, /sectionLabel}>Gender</);
});
