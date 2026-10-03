const test = require('node:test');
const assert = require('node:assert/strict');

const { refreshLiveGames } = require('../modules/live-games');

// --- refreshLiveGames --------------------------------------------------------
// The SHL backend's schedule feed never reports an in-play score: a game reads
// pre-game with a null score until it ends. Both /api/games and
// /api/hockeyallsvenskan/games therefore have to promote games that have
// started and resolve live scores from the play-by-play endpoint. That logic
// lived inlined in the SHL route only, which is why HockeyAllsvenskan served
// live games with score: null and the app showed a bare '-'.

const game = (uuid, state, homeScore = null, awayScore = null) => ({
    uuid,
    state,
    homeTeamInfo: { code: 'HOM', score: homeScore },
    awayTeamInfo: { code: 'AWY', score: awayScore }
});

/**
 * A stand-in for SHLProvider offering the three methods refreshLiveGames uses.
 * `inWindow` is the set of uuids the clock says should have started; `started`
 * the subset the play-by-play endpoint confirms; `scores` what enrichment
 * resolves. Records its calls so the test can assert nothing extra was fetched.
 */
const fakeProvider = ({ inWindow = [], started = [], scores = {} } = {}) => {
    const calls = { checked: [], enriched: 0 };
    return {
        name: 'Fake',
        calls,
        isGameInLiveWindow: (g) => inWindow.includes(g.uuid),
        checkGameHasStarted: async (uuid) => {
            calls.checked.push(uuid);
            return started.includes(uuid);
        },
        enrichGames: async (games) => {
            calls.enriched += 1;
            return games.map((g) => {
                const score = g.state === 'live' ? scores[g.uuid] : null;
                if (!score) {
                    return g;
                }
                return {
                    ...g,
                    homeTeamInfo: { ...g.homeTeamInfo, score: score.home },
                    awayTeamInfo: { ...g.awayTeamInfo, score: score.away }
                };
            });
        }
    };
};

test('a game that has started is promoted to live', async () => {
    const provider = fakeProvider({ inWindow: ['g1'], started: ['g1'] });
    const out = await refreshLiveGames(provider, [game('g1', 'pre-game'), game('g2', 'pre-game')]);
    assert.equal(out.find(g => g.uuid === 'g1').state, 'live');
    assert.equal(out.find(g => g.uuid === 'g2').state, 'pre-game', 'untouched');
});

test('a game in the window that has NOT started stays pre-game', async () => {
    const provider = fakeProvider({ inWindow: ['g1'], started: [] });
    const out = await refreshLiveGames(provider, [game('g1', 'pre-game')]);
    assert.equal(out[0].state, 'pre-game');
    assert.deepEqual(provider.calls.checked, ['g1']);
    assert.equal(provider.calls.enriched, 0, 'nothing live, so no score fetch');
});

test('only games inside the live window are probed', async () => {
    const provider = fakeProvider({ inWindow: ['g2'], started: ['g2'] });
    await refreshLiveGames(provider, [game('g1', 'pre-game'), game('g2', 'pre-game'), game('g3', 'post-game')]);
    assert.deepEqual(provider.calls.checked, ['g2'], 'one request, not one per game');
});

// The reported bug: a live HA game arrived with score null and rendered as '-'.
test('a live game gets its real score resolved', async () => {
    const provider = fakeProvider({ scores: { g1: { home: 3, away: 1 } } });
    const out = await refreshLiveGames(provider, [game('g1', 'live')]);
    assert.equal(out[0].homeTeamInfo.score, 3);
    assert.equal(out[0].awayTeamInfo.score, 1);
    assert.equal(provider.calls.enriched, 1);
});

test('a game promoted to live in this pass is also scored in it', async () => {
    // Both corrections have to happen in order, or a game that just started
    // would be live with a null score until the next request.
    const provider = fakeProvider({ inWindow: ['g1'], started: ['g1'], scores: { g1: { home: 2, away: 0 } } });
    const out = await refreshLiveGames(provider, [game('g1', 'pre-game')]);
    assert.equal(out[0].state, 'live');
    assert.equal(out[0].homeTeamInfo.score, 2);
});

test('nothing live and nothing starting means no requests at all', async () => {
    const provider = fakeProvider();
    const games = [game('g1', 'post-game', 4, 2), game('g2', 'pre-game')];
    const out = await refreshLiveGames(provider, games);
    assert.deepEqual(provider.calls.checked, []);
    assert.equal(provider.calls.enriched, 0);
    assert.deepEqual(out, games);
});

test('the game list keeps its length and order', async () => {
    const provider = fakeProvider({ inWindow: ['g2'], started: ['g2'], scores: { g2: { home: 1, away: 1 } } });
    const games = [game('g1', 'post-game', 2, 1), game('g2', 'pre-game'), game('g3', 'pre-game')];
    const out = await refreshLiveGames(provider, games);
    assert.deepEqual(out.map(g => g.uuid), ['g1', 'g2', 'g3']);
});

test('an empty or missing list is handled without touching the provider', async () => {
    const provider = fakeProvider();
    assert.deepEqual(await refreshLiveGames(provider, []), []);
    assert.deepEqual(await refreshLiveGames(provider, null), []);
    assert.deepEqual(await refreshLiveGames(provider, undefined), []);
    assert.equal(provider.calls.enriched, 0);
});

test('a provider missing the optional methods degrades rather than throwing', async () => {
    // BaseProvider's enrichGames is a no-op passthrough, and a provider that
    // cannot probe for live transitions should still serve its games.
    const bare = { name: 'Bare' };
    const games = [game('g1', 'live')];
    assert.deepEqual(await refreshLiveGames(bare, games), games);
});
