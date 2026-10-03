const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const load = () => importApp('utils/gameScore.js');

// --- The detail header's score ----------------------------------------------
// A live game's score is offered by three sources that disagree. The post-game
// team-stats endpoint LAGS while a game is in progress, and the modal header
// preferred it, so the header showed a score one goal behind the events list
// printed directly beneath it.

const goal = (period, time, home, away) => ({
    period,
    time,
    homeGoals: home,
    awayGoals: away,
    homeTeam: { score: home },
    awayTeam: { score: away }
});

// The real play-by-play of Leksand-Oskarshamn on 2026-10-03, which is where
// this bug was caught. team-stats sat at 3-2 while these events said 3-3.
const leksandGoals = () => [
    goal(1, '10:39', 0, 1),
    goal(2, '03:58', 1, 1),
    goal(2, '14:11', 2, 1),
    goal(2, '16:28', 3, 1),
    goal(3, '01:42', 3, 2),
    goal(3, '10:06', 3, 3)
];

test('the live header follows the goal events, not the lagging team-stats', async () => {
    const { resolveDisplayScore } = await load();
    const score = resolveDisplayScore({
        goals: leksandGoals(),
        detailScore: { home: 3, away: 3 },
        statsScore: { home: 3, away: 2 }, // the real lagging value
        listingScore: { home: 3, away: 3 },
        isPostGame: false
    });
    assert.deepEqual(score, { home: 3, away: 3 });
});

// The reported symptom, reproduced exactly: header 3-1 while the events list
// already carried the 3-2 goal.
test('the reported 3-1 vs 3-2 disagreement cannot recur', async () => {
    const { resolveDisplayScore } = await load();
    const throughThe32 = leksandGoals().slice(0, 5); // ends at the 3-2
    const score = resolveDisplayScore({
        goals: throughThe32,
        detailScore: { home: 3, away: 2 },
        statsScore: { home: 3, away: 1 }, // what the header used to show
        listingScore: { home: 3, away: 1 },
        isPostGame: false
    });
    assert.deepEqual(score, { home: 3, away: 2 }, 'the header must agree with its own events list');
});

test('the latest goal wins by period and clock, not array order', async () => {
    const { scoreFromGoalEvents } = await load();
    // Shuffled, and with a clock that breaks string comparison ("9:30" > "10:06").
    const shuffled = [
        goal(3, '10:06', 3, 3),
        goal(1, '10:39', 0, 1),
        goal(3, '09:30', 3, 2),
        goal(2, '16:28', 3, 1)
    ];
    assert.deepEqual(scoreFromGoalEvents(shuffled), { home: 3, away: 3 });
});

test('a later period wins even with a smaller clock value', async () => {
    const { scoreFromGoalEvents } = await load();
    const goals = [goal(2, '18:40', 2, 0), goal(3, '00:35', 2, 1)];
    assert.deepEqual(scoreFromGoalEvents(goals), { home: 2, away: 1 });
});

test('the nested team scores stand in when homeGoals is absent', async () => {
    const { scoreFromGoalEvents } = await load();
    const goals = [{ period: 2, time: '05:00', homeTeam: { score: 1 }, awayTeam: { score: 2 } }];
    assert.deepEqual(scoreFromGoalEvents(goals), { home: 1, away: 2 });
});

test('no goals yet means no event score, so the chain falls through', async () => {
    const { scoreFromGoalEvents, resolveDisplayScore } = await load();
    assert.equal(scoreFromGoalEvents([]), null);
    assert.equal(scoreFromGoalEvents(undefined), null);
    // A live 0-0 game has no goal events at all; the resolved detail score is
    // what should show, NOT a '-'.
    const score = resolveDisplayScore({
        goals: [],
        detailScore: { home: 0, away: 0 },
        statsScore: { home: null, away: null },
        isPostGame: false
    });
    assert.deepEqual(score, { home: 0, away: 0 });
});

test('a 0-0 score is kept, not treated as missing', async () => {
    const { resolveDisplayScore } = await load();
    // 0 is falsy, so a `||` chain here would skip a legitimate goalless score.
    const score = resolveDisplayScore({ goals: [], detailScore: { home: 0, away: 0 }, isPostGame: false });
    assert.deepEqual(score, { home: 0, away: 0 });
});

// By full time every source agrees, so the ordering only matters while one
// lags. The listing stays first there so the header and the schedule card one
// tap away cannot show different finals.
test('a finished game keeps the listing score first', async () => {
    const { resolveDisplayScore } = await load();
    const score = resolveDisplayScore({
        goals: leksandGoals(),
        detailScore: { home: 9, away: 9 },
        statsScore: { home: 8, away: 8 },
        listingScore: { home: 3, away: 3 },
        isPostGame: true
    });
    assert.deepEqual(score, { home: 3, away: 3 });
});

test('a finished game with no listing score falls back in order', async () => {
    const { resolveDisplayScore } = await load();
    const score = resolveDisplayScore({
        goals: leksandGoals(),
        detailScore: { home: 3, away: 3 },
        listingScore: { home: null, away: null },
        isPostGame: true
    });
    assert.deepEqual(score, { home: 3, away: 3 });
});

test('team-stats still serves a finished game that has nothing else', async () => {
    const { resolveDisplayScore } = await load();
    const score = resolveDisplayScore({
        goals: [],
        detailScore: { home: null, away: null },
        statsScore: { home: 4, away: 2 },
        listingScore: { home: null, away: null },
        isPostGame: true
    });
    assert.deepEqual(score, { home: 4, away: 2 });
});

test('an entirely unknown score shows a dash per side', async () => {
    const { resolveDisplayScore } = await load();
    assert.deepEqual(resolveDisplayScore({}), { home: '-', away: '-' });
    assert.deepEqual(
        resolveDisplayScore({ goals: [], detailScore: { home: null, away: null } }),
        { home: '-', away: '-' }
    );
});

test('the empty-string score the live game-info carries is not shown', async () => {
    const { resolveDisplayScore } = await load();
    // game-info returns score: "" for a live game before the server resolves it;
    // normalizeScoreValue maps that to null so the chain moves on.
    const score = resolveDisplayScore({
        goals: leksandGoals(),
        detailScore: { home: '', away: '' },
        isPostGame: false
    });
    assert.deepEqual(score, { home: 3, away: 3 });
});

test('a malformed clock does not let a stale goal win', async () => {
    const { scoreFromGoalEvents } = await load();
    const goals = [goal(3, '10:06', 3, 3), goal(3, 'not-a-time', 9, 9)];
    assert.deepEqual(scoreFromGoalEvents(goals), { home: 3, away: 3 });
});

test('goal rows with no usable score are skipped', async () => {
    const { scoreFromGoalEvents } = await load();
    assert.equal(scoreFromGoalEvents([{ period: 1, time: '01:00' }, null]), null);
    assert.deepEqual(
        scoreFromGoalEvents([{ period: 1, time: '01:00' }, goal(1, '02:00', 1, 0)]),
        { home: 1, away: 0 }
    );
});
