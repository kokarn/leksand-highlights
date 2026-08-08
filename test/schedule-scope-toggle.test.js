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
    assert.match(appSource, /const scopedTeams = showAllMatches \? \[\] : selectedTeams/);
    assert.match(appSource, /const scopedFootballTeams = showAllMatches \? \[\] : selectedFootballTeams/);
    // hooks consume the scoped arrays, not the raw selected lists
    assert.match(appSource, /useFootballData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useShlData\(activeSport, scopedTeams/);
    assert.match(appSource, /useHockeyAllsvenskanData\(activeSport, scopedTeams/);
    assert.match(appSource, /useSvenskaCupenData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useEuropaLeagueQualData\(activeSport, scopedFootballTeams/);
    assert.match(appSource, /useConferenceLeagueQualData\(activeSport, scopedFootballTeams/);
});

test('compact rows are used only in all-matches scope; tall cards otherwise', () => {
    // football list branches on showAllMatches
    assert.match(appSource, /showAllMatches \? \(\s*<CompactGameCard[\s\S]*?family="football"[\s\S]*?\) : \(\s*<FootballGameCard/);
    // hockey list branches on showAllMatches
    assert.match(appSource, /showAllMatches \? \(\s*<CompactGameCard[\s\S]*?family=\{item\.sport === 'hockeyallsvenskan' \? 'hockeyallsvenskan' : 'shl'\}[\s\S]*?\) : \(\s*<GameCard/);
});

test('getItemLayout and auto-scroll use the compact height when in all scope', () => {
    assert.match(appSource, /showAllMatches \? COMPACT_CARD_HEIGHT : GAME_CARD_HEIGHT/);
    assert.match(appSource, /showAllMatches \? COMPACT_CARD_HEIGHT : FOOTBALL_CARD_HEIGHT/);
    // scroll guards reset when scope flips so it re-anchors to live
    assert.match(appSource, /hasFootballCombinedInitialScrolled\.current = false;\s*hasHockeyCombinedInitialScrolled\.current = false;/);
    assert.match(appSource, /\}, \[scheduleScope\]\)/);
});

test('switching scope snaps both lists back to the top to drop the stale offset', () => {
    // A large offset left over from the long "All matches" list overshoots the
    // short "My teams" list; both lists must be reset to offset 0 on scope change.
    assert.match(appSource, /football\.listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
    assert.match(appSource, /shl\.listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
    // but not on the initial mount, only on real scope changes
    assert.match(appSource, /isFirstScopeRender\.current/);
});

test('auto-scroll target effects re-run on scope flip so the list re-anchors to live', () => {
    // The guard-reset effect must precede the football/hockey target-scroll
    // effects (React runs effects in declaration order); otherwise the target
    // effects bail on the still-true guard and the list stays pinned to the top.
    const resetIdx = appSource.indexOf('hasFootballCombinedInitialScrolled.current = false;');
    const footballScrollIdx = appSource.indexOf('Initial scroll to live/upcoming in combined football list');
    const hockeyScrollIdx = appSource.indexOf('Initial scroll to live/upcoming in combined hockey list');
    assert.ok(resetIdx > -1 && footballScrollIdx > -1 && hockeyScrollIdx > -1);
    assert.ok(resetIdx < footballScrollIdx, 'guard reset must be declared before the football scroll effect');
    assert.ok(resetIdx < hockeyScrollIdx, 'guard reset must be declared before the hockey scroll effect');
    // both target effects list scheduleScope in their deps so they re-fire on a flip
    assert.match(appSource, /combinedFootballGames\.length, scheduleScope, showAllMatches\]/);
    assert.match(appSource, /combinedHockeyGames\.length, scheduleScope, showAllMatches\]/);
});

test('ScopeToggle offers My teams / All matches and is wired into both tabs', () => {
    assert.match(scopeToggleSource, /key: 'myteams', label: 'My teams'/);
    assert.match(scopeToggleSource, /key: 'all', label: 'All matches'/);
    // rendered in the app for hockey and football (two ScopeToggle instances)
    const count = (appSource.match(/<ScopeToggle scope=\{scheduleScope\} onChange=\{handleScheduleScopeChange\}/g) || []).length;
    assert.equal(count, 2);
});

test('CompactGameCard reuses shared team-identity resolvers, not a fresh fallback chain', () => {
    assert.match(compactCardSource, /getTeamName as resolveTeamName, getTeamLogoUri.*teamIdentity/);
    assert.match(compactCardSource, /export const COMPACT_CARD_HEIGHT/);
    // no firebase / FCM imports in a pure UI card
    assert.doesNotMatch(compactCardSource, /firebase|expo-notifications|messaging/i);
});
