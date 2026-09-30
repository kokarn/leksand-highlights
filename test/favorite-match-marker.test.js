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

// --- the 'all' sport tab ignores the scope -------------------------------

test("the 'all' sport tab is always unfiltered, whatever the remembered scope says", () => {
    assert.match(appSource, /const isAllSportsTab = activeSport === 'all'/);
    assert.match(appSource, /const unfiltered = showAllMatches \|\| isAllSportsTab/);
    // Both families' scoped arrays go through `unfiltered`, not showAllMatches:
    // the tab has no ScopeToggle, so the scope was an invisible filter there.
    assert.match(appSource, /const scopedTeams = unfiltered \? \[\] : selectedTeams/);
    assert.match(appSource, /const scopedFootballTeams = unfiltered \? \[\] : selectedFootballTeams/);
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
    // live feeds are cross-SPORT, so one merged set could mis-tint.
    assert.match(appSource, /HOCKEY_SPORTS\.includes\(sport\) \? hockeyFavoriteTokens : footballFavoriteTokens/);
    // Biathlon is per-athlete: no team favourites, so it never tints.
    assert.match(appSource, /if \(sport === 'biathlon'\) \{\s*return false;/);
});

test('all three all-matches lists mark a favourite row', () => {
    // cross-sport list
    assert.match(appSource, /<UnifiedEventCard[\s\S]*?isFavorite=\{eventIsFavorite\(item\.event\)\}/);
    // the two per-sport all-matches (compact) lists
    assert.match(appSource, /isFavorite=\{gameInvolvesFavorite\(item\.game, hockeyFavoriteTokens\)\}/);
    assert.match(appSource, /isFavorite=\{gameInvolvesFavorite\(item\.game, footballFavoriteTokens\)\}/);
});

test('the My-teams lists do NOT tint: every row there is already a favourite', () => {
    // A mark that is on every row marks nothing. The tall-card branch of the
    // per-sport lists only renders in 'myteams' scope, so it takes no isFavorite.
    const tallHockey = appSource.match(/<GameCard\s+game=\{item\}[\s\S]*?\/>/);
    const tallFootball = appSource.match(/<FootballGameCard\s+game=\{item\}[\s\S]*?\/>/);
    assert.ok(tallHockey && tallFootball, 'both per-sport tall-card branches must exist');
    assert.doesNotMatch(tallHockey[0], /isFavorite/);
    assert.doesNotMatch(tallFootball[0], /isFavorite/);
});

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
