const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AllsvenskanProvider = require('../modules/providers/allsvenskan');

const { games } = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'fotbollplay-games.json'), 'utf8')
);

const provider = new AllsvenskanProvider();
const byId = (id) => games.find(g => g.id === id);

// --- state, derived from `phase` rather than goal counts -------------------
// Regression: a 0-0 final used to be indistinguishable from an unplayed fixture,
// so it stayed 'pre-game' forever and the app's All-matches list anchored on it.

test('a 0-0 final is post-game with real 0 scores, not pre-game with null', () => {
    const game = provider.normalizeFotbollPlayGame(byId(5085));
    assert.equal(game.state, 'post-game');
    assert.equal(game.homeTeamInfo.score, 0);
    assert.equal(game.awayTeamInfo.score, 0);
    assert.equal(game.statusText, '0 - 0');
});

test('a scored final keeps its scores', () => {
    const game = provider.normalizeFotbollPlayGame(byId(5106));
    assert.equal(game.state, 'post-game');
    assert.equal(game.homeTeamInfo.score, 0);
    assert.equal(game.awayTeamInfo.score, 5);
    assert.equal(game.statusText, '0 - 5');
});

test('an unplayed fixture stays pre-game with null scores', () => {
    const game = provider.normalizeFotbollPlayGame(byId(5200));
    assert.equal(game.state, 'pre-game');
    assert.equal(game.homeTeamInfo.score, null);
    assert.equal(game.awayTeamInfo.score, null);
    assert.equal(game.statusText, null);
});

test('isFotbollPlayGameFinished falls back to kickoff timestamps without phase', () => {
    // No `phase` key at all, but goals recorded → still finished.
    assert.equal(provider.isFotbollPlayGameFinished(byId(5201)), false);
    assert.equal(provider.isFotbollPlayGameFinished({ phase: 'finished' }), true);
    assert.equal(provider.isFotbollPlayGameFinished({ phase: 'not started' }), false);
    assert.equal(provider.isFotbollPlayGameFinished({ finished_time: '2026-09-05T14:54:04Z' }), true);
    assert.equal(provider.isFotbollPlayGameFinished({ end_of_2nd_half: '2026-09-05T14:54:04Z' }), true);
    assert.equal(provider.isFotbollPlayGameFinished({}), false);
    assert.equal(provider.isFotbollPlayGameFinished(null), false);
});

test('normalization never reports live (goal-watcher must not poll FotbollPlay ids)', () => {
    const states = games.map(g => provider.normalizeFotbollPlayGame(g)).map(g => g.state);
    assert.equal(states.includes('live'), false);
});

// --- logos ----------------------------------------------------------------

test('team icons come from the feed logo_url, not hardcoded null', () => {
    const game = provider.normalizeFotbollPlayGame(byId(5085));
    assert.equal(
        game.homeTeamInfo.icon,
        'https://cdn.forzasys.com/team-logos/forzify-backend-allsvenskan/GAIS-g33.png'
    );
    assert.equal(
        game.awayTeamInfo.icon,
        'https://cdn.forzasys.com/team-logos/forzify-backend-allsvenskan/BK_Hacken-g3.png'
    );
});

test('a missing logo_url degrades to null rather than throwing', () => {
    const game = provider.normalizeFotbollPlayGame(byId(5201));
    assert.equal(game.homeTeamInfo.icon, null);
    assert.equal(game.awayTeamInfo.icon, null);
});

// --- cross-source de-duplication -----------------------------------------
// ESPN and FotbollPlay use disjoint id spaces and disagree on team codes, so
// mergeGamesById cannot pair them; the same fixture appeared twice in the app.

const espnGame = (overrides = {}) => ({
    uuid: '401842831',
    startDateTime: '2026-09-20T12:00Z',
    state: 'post-game',
    homeTeamInfo: { code: 'KFF', names: { short: 'Kalmar FF', long: 'Kalmar FF' }, score: 0, icon: 'https://a.espncdn.com/x.png' },
    awayTeamInfo: { code: 'BKH', names: { short: 'Häcken', long: 'BK Häcken' }, score: 5, icon: 'https://a.espncdn.com/y.png' },
    venueInfo: { name: 'Guldfågeln Arena' },
    statusText: 'FT',
    sport: 'allsvenskan',
    source: 'espn',
    ...overrides
});

test('the same fixture from both sources collapses to the ESPN record', () => {
    const fp = provider.normalizeFotbollPlayGame(byId(5106));
    const merged = provider.dedupeGamesAcrossSources([espnGame(), fp]);

    assert.equal(merged.length, 1);
    // The ESPN uuid is the only one fetchGameDetails can resolve — ESPN's summary
    // endpoint answers a FotbollPlay id with an unrelated fixture (200, not 404).
    assert.equal(merged[0].uuid, '401842831');
    assert.equal(merged[0].source, 'espn');
});

test('de-dup pairs fixtures whose team codes disagree between sources', () => {
    // Mjällby is MJA on ESPN but MAIF on FotbollPlay — codes cannot pair these.
    const espn = espnGame({
        uuid: '401842830',
        startDateTime: '2026-09-19T15:30Z',
        homeTeamInfo: { code: 'MJA', names: { short: 'Mjällby', long: 'Mjällby AIF' }, score: 1, icon: null },
        awayTeamInfo: { code: 'HAM', names: { short: 'Hammarby', long: 'Hammarby IF' }, score: 2, icon: null }
    });
    const fp = provider.normalizeFotbollPlayGame(byId(5201));

    const merged = provider.dedupeGamesAcrossSources([espn, fp]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].uuid, '401842830');
});

test('genuinely different fixtures are both kept', () => {
    const fp = provider.normalizeFotbollPlayGame(byId(5200)); // Nov 29, DIF v BKH
    const merged = provider.dedupeGamesAcrossSources([espnGame(), fp]);
    assert.equal(merged.length, 2);
});

test('de-dup backfills only gaps and leaves the winner authoritative', () => {
    const espn = espnGame({
        homeTeamInfo: { code: 'KFF', names: { short: 'Kalmar FF', long: 'Kalmar FF' }, score: 0, icon: null },
        awayTeamInfo: { code: 'BKH', names: { short: 'Häcken', long: 'BK Häcken' }, score: 5, icon: null },
        venueInfo: { name: null },
        statusText: null
    });
    const fp = provider.normalizeFotbollPlayGame(byId(5106));
    const [merged] = provider.dedupeGamesAcrossSources([espn, fp]);

    // Gaps filled from the absorbed twin...
    assert.equal(
        merged.homeTeamInfo.icon,
        'https://cdn.forzasys.com/team-logos/forzify-backend-allsvenskan/Kalmar_FF-g15.png'
    );
    assert.equal(merged.venueInfo.name, 'Guldfågeln Arena');
    assert.equal(merged.statusText, '0 - 5');
    // ...but identity and scores stay the winner's.
    assert.equal(merged.uuid, '401842831');
    assert.equal(merged.homeTeamInfo.code, 'KFF');
    assert.equal(merged.awayTeamInfo.score, 5);
});

test('de-dup preserves ESPN icons rather than overwriting them', () => {
    const fp = provider.normalizeFotbollPlayGame(byId(5106));
    const [merged] = provider.dedupeGamesAcrossSources([espnGame(), fp]);
    assert.equal(merged.homeTeamInfo.icon, 'https://a.espncdn.com/x.png');
});

test('de-dup is a no-op for single-source lists', () => {
    const fpOnly = games.map(g => provider.normalizeFotbollPlayGame(g));
    assert.equal(provider.dedupeGamesAcrossSources(fpOnly).length, fpOnly.length);
    assert.deepEqual(provider.dedupeGamesAcrossSources([]), []);
});

test('each ESPN game absorbs at most one twin', () => {
    // Two ESPN records at the same kickoff must not both claim the same FP row.
    const a = espnGame();
    const b = espnGame({
        uuid: '401842832',
        homeTeamInfo: { code: 'HBK', names: { short: 'Halmstad', long: 'Halmstads BK' }, score: 2, icon: null },
        awayTeamInfo: { code: 'AIK', names: { short: 'AIK', long: 'AIK' }, score: 1, icon: null }
    });
    const fp = provider.normalizeFotbollPlayGame(byId(5106));
    const merged = provider.dedupeGamesAcrossSources([a, b, fp]);

    assert.equal(merged.length, 2);
    assert.deepEqual(merged.map(g => g.uuid).sort(), ['401842831', '401842832']);
});

// --- ESPN league guard ----------------------------------------------------
// ESPN's summary endpoint returns 200 + an unrelated fixture for an unknown
// event id (it echoes the id back, so the id is no discriminator). FotbollPlay
// ids are low-numbered and collide with year-2000 European matches, so tapping
// such a game opened e.g. Brescia v Napoli instead of 404ing.

test('espnLeagueSlug is read off summaryBaseUrl so subclasses inherit it', () => {
    assert.equal(provider.espnLeagueSlug, 'swe.1');

    const EuropaQual = require('../modules/providers/europa-league-qual');
    const ConferenceQual = require('../modules/providers/conference-league-qual');
    assert.equal(new EuropaQual().espnLeagueSlug, 'uefa.europa_qual');
    assert.equal(new ConferenceQual().espnLeagueSlug, 'uefa.europa.conf_qual');
});

test('isExpectedEspnLeague rejects a summary from another league', () => {
    assert.equal(provider.isExpectedEspnLeague({ header: { league: { slug: 'swe.1' } } }), true);
    assert.equal(provider.isExpectedEspnLeague({ header: { league: { slug: 'SWE.1' } } }), true);
    assert.equal(provider.isExpectedEspnLeague({ header: { league: { slug: 'ita.1' } } }), false);
    assert.equal(provider.isExpectedEspnLeague({ header: { league: { slug: 'ger.1' } } }), false);
});

test('isExpectedEspnLeague fails open when the slug is absent', () => {
    // A payload-shape change should degrade to the old behaviour, not blank
    // out every match detail.
    assert.equal(provider.isExpectedEspnLeague({ header: {} }), true);
    assert.equal(provider.isExpectedEspnLeague({}), true);
    assert.equal(provider.isExpectedEspnLeague(null), true);
});

// --- provider capability flags --------------------------------------------
// The Europa/Conference qualifying providers subclass AllsvenskanProvider for
// its ESPN contract. They used to inherit the FotbollPlay supplement too, which
// merged 100 Allsvenskan fixtures (all tagged sport: 'allsvenskan') into their
// own schedules — 112 and 123 games where 12 and 23 were expected.

const EuropaQual = require('../modules/providers/europa-league-qual');
const ConferenceQual = require('../modules/providers/conference-league-qual');

test('only Allsvenskan opts into the FotbollPlay supplement', () => {
    assert.equal(provider.supportsFotbollPlay, true);
    assert.equal(new EuropaQual().supportsFotbollPlay, false);
    assert.equal(new ConferenceQual().supportsFotbollPlay, false);
});

test('each provider stamps its own sport slug', () => {
    assert.equal(provider.sportSlug, 'allsvenskan');
    assert.equal(new EuropaQual().sportSlug, 'europa-league-qual');
    assert.equal(new ConferenceQual().sportSlug, 'conference-league-qual');
});

test('normalizeFotbollPlayGame stamps the provider sport slug', () => {
    assert.equal(provider.normalizeFotbollPlayGame(byId(5085)).sport, 'allsvenskan');
});

test('a provider without FotbollPlay returns no clips and makes no request', async () => {
    const euro = new EuropaQual();
    // If the guard were missing this would call fetchGameDetails over the network.
    let called = false;
    euro.fetchGameDetails = async () => { called = true; return null; };

    assert.deepEqual(await euro.fetchGameVideos('401842827'), []);
    assert.equal(called, false);
});

test('fetchAllGames skips the FotbollPlay supplement when unsupported', async () => {
    const euro = new EuropaQual();
    let fpCalls = 0;
    euro.fetchFotbollPlayGamesInWindow = async () => { fpCalls++; return []; };
    euro.fetchSeasonEventsSafe = async () => [];
    euro.normalizeEvents = () => [];

    const out = await euro.fetchAllGames();
    assert.deepEqual(out, []);
    // Even with zero games (no future AND no past), the year+1/year-1 FotbollPlay
    // windows must stay unrequested.
    assert.equal(fpCalls, 0);
});

test('fetchAllGames still uses the FotbollPlay supplement for Allsvenskan', async () => {
    const alls = new AllsvenskanProvider();
    let fpCalls = 0;
    alls.fetchSeasonEventsSafe = async () => [];
    alls.normalizeEvents = () => [];
    alls.fetchFotbollPlayGamesInWindow = async () => {
        fpCalls++;
        return [byId(5085)];
    };

    const out = await alls.fetchAllGames();
    assert.ok(fpCalls > 0, 'expected the FotbollPlay window to be fetched');
    assert.equal(out.length, 1);
    assert.equal(out[0].sport, 'allsvenskan');
});
