/**
 * Two UX fixes, tested together because they are the same complaint: the app
 * knew which teams you follow but showed it in the wrong place.
 *
 *  1. The 'all' SPORT tab renders no ScopeToggle (there is no single league to
 *     show standings for), yet it still obeyed the remembered scope — so a user
 *     who left the hockey tab on "My teams" got a silently pruned cross-sport
 *     list with no visible control to widen it.
 *  2. With every match shown, a followed team needed marking rather than
 *     filtering.
 *
 * gameInvolvesFavorite is pure, so it is tested for real; the render wiring is
 * pinned by asserting on source text, the convention the other app-surface tests
 * in this directory use (there is no react-test-renderer in the project).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const appSource = read('app/index.js');
const compactCardSource = read('components/cards/CompactGameCard.js');
const gameCardSource = read('components/cards/GameCard.js');
const footballCardSource = read('components/cards/FootballGameCard.js');
const unifiedCardSource = read('components/cards/UnifiedEventCard.js');

const game = (home, away, extra = {}) => ({
    uuid: `${home}-${away}`,
    state: 'pre-game',
    homeTeamInfo: { code: home },
    awayTeamInfo: { code: away },
    ...extra
});

// --- gameInvolvesFavorite (pure) -----------------------------------------

test('a favourite on either side of the fixture marks the game', async () => {
    const { gameInvolvesFavorite } = await importApp('utils/teamGames.js');
    const { buildFavoriteTokens } = await importApp('utils/standingsIdentity.js');
    const tokens = buildFavoriteTokens(['LIF']);

    assert.equal(gameInvolvesFavorite(game('LIF', 'FHC'), tokens), true, 'home');
    assert.equal(gameInvolvesFavorite(game('FHC', 'LIF'), tokens), true, 'away');
    assert.equal(gameInvolvesFavorite(game('LIF', 'LIF'), tokens), true, 'both');
    assert.equal(gameInvolvesFavorite(game('FHC', 'BIF'), tokens), false, 'neither');
});

test('no favourites means no marks, and junk input never throws', async () => {
    const { gameInvolvesFavorite } = await importApp('utils/teamGames.js');
    const { buildFavoriteTokens } = await importApp('utils/standingsIdentity.js');

    // The whole point of the 'all' views: an unfiltered list with an empty
    // favourites set must render entirely untinted, not entirely tinted.
    assert.equal(gameInvolvesFavorite(game('LIF', 'FHC'), buildFavoriteTokens([])), false);
    assert.equal(gameInvolvesFavorite(game('LIF', 'FHC'), new Set()), false);

    for (const bogus of [null, undefined, {}, { homeTeamInfo: null, awayTeamInfo: undefined }]) {
        assert.equal(gameInvolvesFavorite(bogus, buildFavoriteTokens(['LIF'])), false);
    }
    for (const bogus of [null, undefined]) {
        assert.equal(gameInvolvesFavorite(game('LIF', 'FHC'), bogus), false);
    }
});

test('a favourite matches across the feeds\' disagreeing id spaces', async () => {
    const { gameInvolvesFavorite } = await importApp('utils/teamGames.js');
    const { buildFavoriteTokens } = await importApp('utils/standingsIdentity.js');

    // The reason this goes through buildFavoriteTokens rather than a bare
    // `selectedTeams.includes(code)`. The Allsvenskan games feed is an ESPN +
    // FotbollPlay merge carrying TWO codes per club: a favourite stored as DEIF
    // shares no token with an ESPN-sourced DEG row, and only the club NAME —
    // which the roster supplies — bridges them.
    const roster = [{ key: 'DEIF', name: 'Degerfors IF' }];
    const tokens = buildFavoriteTokens(['DEIF'], roster);
    const espnRow = game('DEG', 'AIK', { homeTeamInfo: { code: 'DEG', names: { short: 'Degerfors' } } });

    assert.equal(gameInvolvesFavorite(espnRow, tokens), true);
    // Without the roster the bridge does not exist — this is the bug, pinned.
    assert.equal(gameInvolvesFavorite(espnRow, buildFavoriteTokens(['DEIF'])), false);

    // The genitive fold, the other half of the same problem: the feeds spell the
    // same club "Djurgarden" and "Djurgardens IF".
    const genitive = buildFavoriteTokens(['DIF'], [{ key: 'DIF', name: 'Djurgardens IF' }]);
    assert.equal(
        gameInvolvesFavorite(game('DJU', 'AIK', { homeTeamInfo: { names: { long: 'Djurgarden' } } }), genitive),
        true
    );
});

// --- the Home tab ignores the scope and keeps your filter ----------------

test('the Home tab is always filtered to your teams, whatever the remembered scope says', () => {
    assert.match(appSource, /const isHomeTab = activeSport === 'all'/);
    // Home opts OUT of the unfiltered path: it is the "your teams" view, so the
    // scope (which it renders no toggle for) must not widen it.
    assert.match(appSource, /const unfiltered = !isHomeTab && showAllMatches/);
    assert.match(appSource, /const scopedTeams = unfiltered \? \[\] : selectedTeams/);
    assert.match(appSource, /const scopedFootballTeams = unfiltered \? \[\] : selectedFootballTeams/);
});

test('with no favourites picked, Home falls back to everything instead of an empty screen', () => {
    // The hooks' team filter self-disables on an empty array, so the fallback is
    // structural — but the flag drives the remount key and the empty-state copy.
    assert.match(appSource, /const hasFavorites = selectedTeams\.length > 0 \|\| selectedFootballTeams\.length > 0/);
    assert.match(appSource, /key=\{`home-\$\{hasFavorites \? 'favorites' : 'everything'\}`\}/);
    assert.match(appSource, /hasFavorites\s*\n?\s*\? 'Nothing coming up for the teams you follow/);
});

test('the cross-sport tab is labelled Home, keeping its stored key', () => {
    const pickerSource = read('components/SportPicker.js');
    // The key stays 'all' so an existing install's saved sport still resolves.
    assert.match(pickerSource, /\{ key: 'all', name: 'Home', icon: 'home-outline' \}/);
    assert.doesNotMatch(pickerSource, /name: 'All'/);
    assert.match(read('components/SportTab.js'), /all: 'Home'/);
});

test('the per-sport tabs keep their own scope — the fix must not clear it', () => {
    // scheduleScope still drives the per-sport lists and is still persisted; the
    // 'all' tab opting out must not have become "reset the scope on tab change".
    assert.match(appSource, /const showAllMatches = scheduleScope === 'all'/);
    assert.doesNotMatch(appSource, /handleScheduleScopeChange\('(myteams|all)'\)/);
    // and the toggle is still rendered by exactly the two tabs that honour it
    const toggles = (appSource.match(/<ScopeToggle scope=\{scheduleScope\}/g) || []).length;
    assert.equal(toggles, 2);
});

// --- the favourite marker ------------------------------------------------

test('favourite tokens are built once per list, per family, from the roster', () => {
    assert.match(appSource, /buildFavoriteTokens.*standingsIdentity/);
    assert.match(appSource, /gameInvolvesFavorite.*teamGames/);
    // Memoized (once per render, not once per row) and roster-fed.
    assert.match(appSource, /const hockeyFavoriteTokens = useMemo\(\s*\(\) => buildFavoriteTokens\(selectedTeams, combinedHockeyTeams\)/);
    assert.match(appSource, /const footballFavoriteTokens = useMemo\(\s*\(\) => buildFavoriteTokens\(selectedFootballTeams, combinedFootballTeams\)/);
});

test('the two families stay separate so a hockey favourite cannot tint a football match', () => {
    // The token stems are lossy and the only known collisions across the six
    // live feeds are cross-SPORT, so one merged set could mis-tint. Each list
    // only ever consults its OWN family's tokens, which is what keeps them
    // apart now that Home (the one mixed-sport list) does not tint at all.
    assert.match(appSource, /gameInvolvesFavorite\(item\.game, hockeyFavoriteTokens\)/);
    assert.match(appSource, /gameInvolvesFavorite\(item\.game, footballFavoriteTokens\)/);
    // Neither set is passed to the other list, and nothing merges them.
    const hockeyList = appSource.match(/const renderHockeySchedule[\s\S]*?const renderFootballSchedule/);
    assert.ok(hockeyList, 'hockey list must exist');
    assert.doesNotMatch(hockeyList[0], /footballFavoriteTokens/);
    // Biathlon is per-athlete: no team favourites, so its row takes no tint prop.
    const raceRow = appSource.match(/<CompactRaceCard[^/]*\/>/);
    assert.ok(raceRow, 'the race row must exist');
    assert.doesNotMatch(raceRow[0], /isFavorite/);
});

test('the per-sport all-matches lists mark a favourite row', () => {
    assert.match(appSource, /isFavorite=\{showAllMatches && gameInvolvesFavorite\(item\.game, hockeyFavoriteTokens\)\}/);
    assert.match(appSource, /isFavorite=\{showAllMatches && gameInvolvesFavorite\(item\.game, footballFavoriteTokens\)\}/);
});

test('Home never tints: in either state the mark would carry no information', () => {
    // Favourites set -> the list IS your teams, so every row would tint.
    // No favourites -> there are no tokens, so there is nothing to mark.
    assert.doesNotMatch(appSource, /eventIsFavorite/);
    const homeRow = appSource.match(/<CompactGameCard\s+game=\{event\}[\s\S]*?\/>/);
    assert.ok(homeRow, 'the Home row must exist');
    assert.doesNotMatch(homeRow[0], /isFavorite/);
});

test('the My-teams lists do NOT tint: every row there is already a favourite', () => {
    // A mark that is on every row marks nothing. Both scopes now render the same
    // compact row, so the distinction moved from "which card" to the
    // showAllMatches guard on the single isFavorite prop — asserted above. What
    // matters here is that nothing tints unconditionally.
    assert.doesNotMatch(appSource, /isFavorite=\{gameInvolvesFavorite\(item\.game/);
    // Biathlon races take no favourite prop at all (per-athlete sport).
    assert.match(appSource, /<CompactRaceCard race=\{event\}[^/]*\/>/);
    const raceRow = appSource.match(/<CompactRaceCard race=\{event\}[^/]*\/>/)[0];
    assert.doesNotMatch(raceRow, /isFavorite/);
});

// The tall cards no longer appear in any schedule list, but they are still
// rendered by the team pages, so their tint contract is still live.
test('the marker reuses the standings tint, and cards take it as a prop', () => {
    // One visual language for "a team you follow": the same token the standings
    // rows use, not a new colour.
    for (const [name, source] of [
        ['CompactGameCard', compactCardSource],
        ['GameCard', gameCardSource],
        ['FootballGameCard', footballCardSource]
    ]) {
        assert.match(source, /isFavorite = false/, `${name} defaults isFavorite to false`);
        assert.match(source, /colors\.chipActive/, `${name} uses the shared chipActive tint`);
    }
    // UnifiedEventCard only passes it through; biathlon takes no such prop.
    assert.match(unifiedCardSource, /isFavorite = false/);
    assert.match(unifiedCardSource, /<BiathlonRaceCard race=\{event\} onPress=\{\(\) => onPress\(event\)\} \/>/);
});

test('live styling still wins over the favourite tint on a compact row', () => {
    // A live match is the more urgent signal and its red wash would fight the
    // accent one, so isLive is tested first.
    assert.match(compactCardSource, /const cardColors = isLive\s*\?\s*\(isDark \? '#2a1c1c' : colors\.card\)\s*:\s*\(isFavorite \? colors\.chipActive : colors\.card\)/);
    // The row's border keeps encoding live-ness only, as it did before.
    assert.match(compactCardSource, /borderColor: isLive \? '#FF453A' : colors\.cardBorder/);
});

test('the tall cards layer the tint over their gradient instead of recolouring it', () => {
    // chipActive is translucent (designed to sit ON something): as a gradient
    // stop it would drop the card's opaque base and let the screen gradient
    // through. As an overlay it must not swallow the card's touches, and it
    // repeats the radius because the card does not clip its children.
    for (const [name, source] of [['GameCard', gameCardSource], ['FootballGameCard', footballCardSource]]) {
        assert.match(source, /styles\.favoriteTint[\s\S]{0,80}pointerEvents="none"/, `${name} overlay is inert`);
        assert.match(source, /favoriteTint: \{\s*\.\.\.StyleSheet\.absoluteFillObject,\s*borderRadius: 16/, `${name} tint fills and rounds`);
    }
});
