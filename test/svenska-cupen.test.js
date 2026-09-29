const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SvenskaCupenProvider = require('../modules/providers/svenska-cupen');

const readFixture = (name) => JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
);

const leagueData = readFixture('fotmob-svenska-cupen-league.json');
const standingsData = readFixture('fotmob-svenska-cupen-standings.json');

const provider = new SvenskaCupenProvider();
const matches = provider.extractMatchesFromLeagueData(leagueData);
const byId = (id) => matches.find(m => String(m.id) === String(id));

// --- endpoints -------------------------------------------------------------
// Regression: the provider pointed at FotMob's pre-move paths (/api/leagues,
// /api/matchDetails), which now serve a 404 HTML page. Every request failed, so
// the league returned zero games and the tab rendered empty. The JSON API is
// still unauthenticated — it just lives under /api/data/ now.

test('league and match-details URLs target the /api/data/ paths', () => {
    assert.equal(provider.buildLeagueUrl(), 'https://www.fotmob.com/api/data/leagues?id=171');
    assert.equal(
        provider.buildMatchDetailsUrl('5629939'),
        'https://www.fotmob.com/api/data/matchDetails?matchId=5629939'
    );
});

test('buildLeagueUrl passes a requested season through', () => {
    assert.equal(
        provider.buildLeagueUrl({ season: '2025/2026' }),
        'https://www.fotmob.com/api/data/leagues?id=171&season=2025%2F2026'
    );
});

test('match details are addressed by id, not by a scraped page URL', () => {
    // FotMob's slug-and-hash page URLs go stale when fixtures are rescheduled and
    // then serve a DIFFERENT match at HTTP 200, so the app opened the wrong game.
    // The id is the only stable handle; the page-scraping helpers are gone.
    assert.equal(typeof provider.fetchMatchDetailsData, 'function');
    assert.equal(provider.fetchMatchPageProps, undefined);
    assert.equal(provider.extractNextDataJson, undefined);
    assert.equal(provider.resolveMatchPageUrl, undefined);
});

// --- fixture extraction ----------------------------------------------------

test('fixtures are read from the fixtures.allMatches container', () => {
    assert.equal(matches.length, 3);
});

test('extractMatchesFromLeagueData tolerates a missing payload', () => {
    assert.deepEqual(provider.extractMatchesFromLeagueData(null), []);
    assert.deepEqual(provider.extractMatchesFromLeagueData({}), []);
});

// --- normalization ---------------------------------------------------------

test('a finished fixture normalizes to post-game with its scores', () => {
    const game = provider.normalizeMatch(byId('5629939'));
    assert.equal(game.state, 'post-game');
    assert.equal(game.homeTeamInfo.score, 5);
    assert.equal(game.awayTeamInfo.score, 3);
    assert.equal(game.sport, 'svenska-cupen');
});

test('a drawn final keeps both scores rather than collapsing to null', () => {
    const game = provider.normalizeMatch(byId('5629947'));
    assert.equal(game.state, 'post-game');
    assert.equal(game.homeTeamInfo.score, 2);
    assert.equal(game.awayTeamInfo.score, 2);
});

test('an unplayed fixture is pre-game with null scores', () => {
    const game = provider.normalizeMatch(byId('5820431'));
    assert.equal(game.state, 'pre-game');
    assert.equal(game.homeTeamInfo.score, null);
    assert.equal(game.awayTeamInfo.score, null);
});

test('every normalized team carries a crest', () => {
    for (const match of matches) {
        const game = provider.normalizeMatch(match);
        assert.match(game.homeTeamInfo.icon, /^https:\/\/images\.fotmob\.com\//);
        assert.match(game.awayTeamInfo.icon, /^https:\/\/images\.fotmob\.com\//);
    }
});

test('normalizeMatches yields one game per fixture, with unique uuids', () => {
    const games = provider.normalizeMatches(matches);
    assert.equal(games.length, 3);
    assert.equal(new Set(games.map(g => g.uuid)).size, 3);
});

// --- state mapping ---------------------------------------------------------

test('normalizeState maps FotMob status flags', () => {
    assert.equal(provider.normalizeState({ started: true, finished: false }), 'live');
    assert.equal(provider.normalizeState({ ongoing: true }), 'live');
    assert.equal(provider.normalizeState({ started: true, finished: true }), 'post-game');
    assert.equal(provider.normalizeState({ started: false, finished: false }), 'pre-game');
    // A cancelled tie is over, not upcoming — it must not sit at the top of the list.
    assert.equal(provider.normalizeState({ cancelled: true }), 'post-game');
    assert.equal(provider.normalizeState(null), 'pre-game');
});

// --- standings -------------------------------------------------------------

// Stub the single network call so fetchStandings itself is under test.
const withLeagueData = async (data, fn) => {
    const stub = new SvenskaCupenProvider();
    stub.fetchLeagueData = async () => data;
    return fn(stub);
};

test('standings parse the group tables of a season that had a group stage', async () => {
    const result = await withLeagueData(standingsData, p => p.fetchStandings({ season: '2025/2026' }));
    assert.equal(result.league, 'Svenska Cupen');
    assert.equal(result.season, '2025/2026');
    assert.equal(result.source, 'fotmob');
    assert.ok(result.groups.length > 0);

    const row = result.groups[0].standings[0];
    assert.ok(row.teamName);
    assert.equal(typeof row.points, 'number');
    assert.match(row.teamIcon, /^https:\/\/images\.fotmob\.com\//);
});

test('a knockout season has no table, and degrades to empty groups', async () => {
    // The current season is in round 1, so FotMob sends table: null. That is not an
    // error — the endpoint must still answer with a valid, empty-grouped payload.
    assert.equal(leagueData.table, null);

    const result = await withLeagueData(leagueData, p => p.fetchStandings());
    assert.deepEqual(result.groups, []);
    assert.equal(result.league, 'Svenska Cupen');
    assert.equal(result.season, '2026/2027');
    assert.ok(result.availableSeasons.length > 0);
});

test('standings survive the source being unavailable', async () => {
    // fetchLeagueData returns null rather than throwing when FotMob 404s, so the
    // standings route must not blow up on that path either.
    const result = await withLeagueData(null, p => p.fetchStandings());
    assert.deepEqual(result.groups, []);
    assert.equal(result.league, 'Svenska Cupen');
});

test('fetchLeagueData degrades to null on a non-ok response, warning once', async () => {
    const p = new SvenskaCupenProvider();
    const originalFetch = global.fetch;
    const warnings = [];
    const originalWarn = console.warn;
    let calls = 0;

    global.fetch = async () => { calls++; return { ok: false, status: 404 }; };
    console.warn = (msg) => warnings.push(msg);

    try {
        assert.equal(await p.fetchLeagueData(), null);
        assert.equal(await p.fetchLeagueData(), null);
    } finally {
        global.fetch = originalFetch;
        console.warn = originalWarn;
    }

    assert.equal(calls, 2);
    // Warn once, not on every 15s poll — that used to bury real GoalWatcher errors.
    assert.equal(warnings.length, 1);
});
