const test = require('node:test');
const assert = require('node:assert/strict');

const goalWatcher = require('../modules/goal-watcher');
const pushNotifications = require('../modules/fcm-notifications');
const AllsvenskanProvider = require('../modules/providers/allsvenskan');

const { extractGoalDetails } = goalWatcher.__test;
const { buildGoalNotificationMessage } = pushNotifications.__test;

test('AllsvenskanProvider.isGoalClip detects action.goal tag only', () => {
    const p = new AllsvenskanProvider();
    assert.equal(p.isGoalClip({ tags: ['clip', 'event', 'action.goal'] }), true);
    assert.equal(p.isGoalClip({ tags: ['clip', 'event', 'action.shot'] }), false);
    assert.equal(p.isGoalClip({ tags: ['custom.highlights'] }), false);
    assert.equal(p.isGoalClip({}), false);
});

function makeGameInfo() {
    return {
        uuid: 'cup-game-1',
        homeTeamInfo: {
            uuid: 'home-1',
            code: 'AIK',
            names: {
                short: 'AIK',
                long: 'AIK'
            },
            score: 0
        },
        awayTeamInfo: {
            uuid: 'away-1',
            code: 'MFF',
            names: {
                short: 'MFF',
                long: 'Malmo FF'
            },
            score: 0
        }
    };
}

test('extractGoalDetails reads scorer from Svenska Cupen goal payload', () => {
    const gameInfo = makeGameInfo();
    const goal = {
        eventTeam: {
            place: 'home',
            teamId: 'home-1'
        },
        scorer: {
            name: 'John Doe'
        },
        homeGoals: 1,
        awayGoals: 0,
        time: "42'"
    };

    const goalDetails = extractGoalDetails(goal, gameInfo, 'svenska-cupen');

    assert.equal(goalDetails.scorerName, 'John Doe');
    assert.equal(goalDetails.homeScore, 1);
    assert.equal(goalDetails.awayScore, 0);
    assert.equal(goalDetails.scoringTeamCode, 'AIK');
});

test('extractGoalDetails reads score object fallback used by football providers', () => {
    const gameInfo = makeGameInfo();
    const goal = {
        isHome: false,
        scorer: {
            firstName: 'Jane',
            lastName: 'Smith'
        },
        score: {
            home: 2,
            away: 1
        },
        time: "65'"
    };

    const goalDetails = extractGoalDetails(goal, gameInfo, 'allsvenskan');

    assert.equal(goalDetails.scorerName, 'Jane Smith');
    assert.equal(goalDetails.homeScore, 2);
    assert.equal(goalDetails.awayScore, 1);
    assert.equal(goalDetails.scoringTeamCode, 'MFF');
});

test('extractGoalDetails prefers computed running score over lagging team score (Allsvenskan 0-0 bug)', () => {
    const gameInfo = makeGameInfo();
    // Simulate the ESPN case: the goal event carries no score, and the scoreboard-derived
    // team score still lags at 0-0 at the moment the first goal is detected.
    gameInfo.homeTeamInfo.score = 0;
    gameInfo.awayTeamInfo.score = 0;
    const goal = {
        isHome: true,
        scorer: { name: 'Late Feed' },
        time: "12'"
        // no homeGoals/awayGoals, no score object — mirrors ESPN keyEvents
    };

    const goalDetails = extractGoalDetails(goal, gameInfo, 'allsvenskan', { home: 1, away: 0 });

    assert.equal(goalDetails.homeScore, 1);
    assert.equal(goalDetails.awayScore, 0);
});

test('extractGoalDetails keeps explicit per-goal score ahead of computed tally (SHL unchanged)', () => {
    const gameInfo = makeGameInfo();
    const goal = {
        isHome: false,
        scorer: { name: 'Shl Sniper' },
        homeGoals: 2,
        awayGoals: 3,
        period: 3,
        time: '18:20'
    };

    // Even if a (hypothetical) miscounted tally were passed, the explicit per-goal score wins.
    const goalDetails = extractGoalDetails(goal, gameInfo, 'shl', { home: 9, away: 9 });

    assert.equal(goalDetails.homeScore, 2);
    assert.equal(goalDetails.awayScore, 3);
});

test('goal notification message falls back when scorer is unknown', () => {
    const message = buildGoalNotificationMessage({
        scorerName: 'Unknown',
        scoringTeamName: 'AIK',
        homeScore: 3,
        awayScore: 2,
        time: "88'",
        period: '2nd half'
    });

    assert.equal(message, "AIK scores! 3-2 (88' 2nd half)");
});

