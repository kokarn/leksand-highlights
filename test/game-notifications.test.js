const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);
const { __test: fcm } = require('../modules/fcm-notifications');

// Issue #53: a match header's bell mutes a followed team's match (watching later,
// no spoilers) or opts in to a match with no followed team. Both are FCM topics,
// so the app's topic names have to be exactly the ones the server targets.

test('app and server build identical per-match topics', async () => {
    const { gameTopic } = await importApp('utils/gameNotifications.js');
    const cases = [
        ['game', 'shl', 'bmtqssiszm'],
        ['mute', 'hockeyallsvenskan', 'amxzb5ib4c'],
        ['mute', 'allsvenskan', 5164],
        ['game', 'football', '5164'],
        ['game', 'svenska-cupen', '5820431'],
        ['mute', 'europa-league-qual', 'A-b_c']
    ];
    for (const [kind, sport, id] of cases) {
        assert.equal(gameTopic(kind, sport, id), fcm.buildGameTopic(kind, sport, id), `${kind} ${sport} ${id}`);
    }
    // The sport is in the name: football ids are small integers, unique per feed only.
    assert.notEqual(fcm.buildGameTopic('game', 'allsvenskan', 1), fcm.buildGameTopic('game', 'svenska-cupen', 1));
    assert.equal(fcm.buildGameTopic('game', 'shl', ''), null);
    assert.equal(gameTopic('game', 'shl', null), null);
});

test('the goal condition reaches followers unless muted, and opted-in devices', () => {
    const condition = fcm.buildGameCondition('goal_notifications', ['LIF', 'MoDo'], 'hockeyallsvenskan', 'abc');
    assert.equal(
        condition,
        "'goal_notifications' in topics && "
        + "((('team_lif' in topics || 'team_modo' in topics) && !('mute_hockeyallsvenskan_abc' in topics)) "
        + "|| 'game_hockeyallsvenskan_abc' in topics)"
    );
});

test('a condition never exceeds FCM\'s five-topic limit', () => {
    const condition = fcm.buildGameCondition('goal_notifications', ['LIF', 'MODO', 'LIF', 'AIK'], 'shl', 'abc');
    const topics = condition.match(/'[^']+' in topics/g);
    assert.ok(topics.length <= 5, condition);
    assert.equal(new Set(topics).size, topics.length, 'no topic listed twice');
});

test('a match with no team codes still reaches opted-in devices', () => {
    assert.equal(
        fcm.buildGameCondition('pre_game_shl', [], 'shl', 'abc'),
        "'pre_game_shl' in topics && ('game_shl_abc' in topics)"
    );
    assert.equal(fcm.buildGameCondition('pre_game_shl', [], 'shl', ''), null);
});

test('the bell flips a match without storing a redundant override', async () => {
    const { gameNotificationsOn, toggledGameOverride } = await importApp('utils/gameNotifications.js');
    // A followed team's match: on, mutes, then un-mutes back to no override.
    assert.equal(gameNotificationsOn(true, undefined), true);
    assert.equal(toggledGameOverride(true, undefined), 'mute');
    assert.equal(gameNotificationsOn(true, 'mute'), false);
    assert.equal(toggledGameOverride(true, 'mute'), null);
    // Any other match: off, opts in, then back to no override.
    assert.equal(gameNotificationsOn(false, undefined), false);
    assert.equal(toggledGameOverride(false, undefined), 'game');
    assert.equal(gameNotificationsOn(false, 'game'), true);
    assert.equal(toggledGameOverride(false, 'game'), null);
});

test('following is decided by exact team code, as the server targets it', async () => {
    const { followsGameTeam } = await importApp('utils/gameNotifications.js');
    const game = { homeTeamInfo: { code: 'LIF' }, awayTeamInfo: { code: 'MoDo' } };
    assert.equal(followsGameTeam(game, ['lif']), true);
    assert.equal(followsGameTeam(game, ['MODO']), true);
    assert.equal(followsGameTeam(game, ['FHC']), false);
    assert.equal(followsGameTeam(game, []), false);
});

test('overrides for long-finished matches are pruned, recent ones kept', async () => {
    const { pruneGameOverrides, GAME_OVERRIDE_TTL_MS } = await importApp('utils/gameNotifications.js');
    const now = Date.parse('2026-10-13T12:00:00Z');
    const { kept, expired } = pruneGameOverrides({
        'shl:old': { kind: 'mute', startDateTime: new Date(now - GAME_OVERRIDE_TTL_MS - 1).toISOString() },
        'shl:new': { kind: 'game', startDateTime: '2026-10-12T17:00:00Z' },
        'shl:undated': { kind: 'game', startDateTime: null }
    }, now);
    assert.deepEqual(Object.keys(kept).sort(), ['shl:new', 'shl:undated']);
    assert.deepEqual(expired, [{ key: 'shl:old', kind: 'mute' }]);
});

test('the mute clause can be dropped for the fallback send', () => {
    const condition = fcm.buildGameCondition('goal_notifications', ['LIF'], 'shl', 'abc', { muting: false });
    assert.equal(condition, "'goal_notifications' in topics && (('team_lif' in topics) || 'game_shl_abc' in topics)");
});
