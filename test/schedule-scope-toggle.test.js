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

test('all-matches scope renders day-grouped sections (DayHeader + CompactGameCard)', () => {
    // both lists feed the section array in all scope, raw games otherwise
    assert.match(appSource, /data=\{showAllMatches \? footballSections : combinedFootballGames\}/);
    assert.match(appSource, /data=\{showAllMatches \? hockeySections : combinedHockeyGames\}/);
    // header rows render DayHeader; game rows render CompactGameCard
    assert.match(appSource, /item\.type === 'header' \? \(\s*<DayHeader date=\{item\.date\} \/>/);
    assert.match(appSource, /<CompactGameCard[\s\S]*?game=\{item\.game\}[\s\S]*?family="football"/);
    assert.match(appSource, /<CompactGameCard[\s\S]*?game=\{item\.game\}[\s\S]*?family=\{item\.game\.sport === 'hockeyallsvenskan' \? 'hockeyallsvenskan' : 'shl'\}/);
    // sections are only built in all scope
    assert.match(appSource, /buildScheduleSections\(combinedFootballGames\)/);
    assert.match(appSource, /buildScheduleSections\(combinedHockeyGames\)/);
});

test('getItemLayout uses the precomputed section layout in all scope; uniform tall card otherwise', () => {
    assert.match(appSource, /const l = footballSectionLayout\[index\]/);
    assert.match(appSource, /const l = hockeySectionLayout\[index\]/);
    assert.match(appSource, /length: FOOTBALL_CARD_HEIGHT, offset: FOOTBALL_CARD_HEIGHT \* index/);
    assert.match(appSource, /length: GAME_CARD_HEIGHT, offset: GAME_CARD_HEIGHT \* index/);
});

test('auto-scroll uses the section offset in all scope so it lands on the live match not the top', () => {
    assert.match(appSource, /showAllMatches\s*\?\s*footballSectionTargetOffset/);
    assert.match(appSource, /showAllMatches\s*\?\s*hockeySectionTargetOffset/);
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

test('switching scope snaps both lists back to the top to drop the stale offset', () => {
    assert.match(appSource, /football\.listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
    assert.match(appSource, /shl\.listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
    assert.match(appSource, /isFirstScopeRender\.current/);
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

test('CompactGameCard reuses shared team-identity resolvers, not a fresh fallback chain', () => {
    assert.match(compactCardSource, /getTeamName as resolveTeamName, getTeamLogoUri.*teamIdentity/);
    assert.match(compactCardSource, /export const COMPACT_CARD_HEIGHT/);
    assert.doesNotMatch(compactCardSource, /firebase|expo-notifications|messaging/i);
});
