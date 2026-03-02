const test = require('node:test');
const assert = require('node:assert/strict');

const goalWatcher = require('../modules/goal-watcher');
const pushNotifications = require('../modules/fcm-notifications');

const { extractGoalDetails } = goalWatcher.__test;
const { buildGoalNotificationMessage } = pushNotifications.__test;

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

