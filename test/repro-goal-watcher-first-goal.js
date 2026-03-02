const { setProvider, resetProvider } = require('../modules/providers');
const goalWatcher = require('../modules/goal-watcher');
const pushNotifications = require('../modules/fcm-notifications');

function makeGame(sport) {
    return {
        uuid: `${sport}-game-1`,
        state: 'live',
        homeTeamInfo: {
            uuid: `${sport}-home-team`,
            code: `${sport.slice(0, 3).toUpperCase()}H`,
            names: { short: `${sport}-home`, long: `${sport}-home-long` }
        },
        awayTeamInfo: {
            uuid: `${sport}-away-team`,
            code: `${sport.slice(0, 3).toUpperCase()}A`,
            names: { short: `${sport}-away`, long: `${sport}-away-long` }
        }
    };
}

function makeGoal({ period, time, teamUuid, playerUuid, homeGoals, awayGoals }) {
    return {
        period,
        time,
        teamUuid,
        player: { uuid: playerUuid, firstName: 'Test', familyName: 'Scorer' },
        homeGoals,
        awayGoals,
        eventTeam: {
            teamId: teamUuid,
            place: teamUuid.includes('home') ? 'home' : 'away'
        }
    };
}

function createMockProvider(sport) {
    const game = makeGame(sport);
    const firstGoal = makeGoal({
        period: 1,
        time: '10:00',
        teamUuid: game.homeTeamInfo.uuid,
        playerUuid: `${sport}-p1`,
        homeGoals: 1,
        awayGoals: 0
    });
    const secondGoal = makeGoal({
        period: 1,
        time: '15:00',
        teamUuid: game.awayTeamInfo.uuid,
        playerUuid: `${sport}-p2`,
        homeGoals: 1,
        awayGoals: 1
    });

    let detailsCallCount = 0;
    return {
        getName() {
            return `mock-${sport}`;
        },
        async fetchActiveGames() {
            return [game];
        },
        async fetchGameDetails() {
            detailsCallCount += 1;
            if (detailsCallCount === 1) {
                return { info: { homeTeam: game.homeTeamInfo, awayTeam: game.awayTeamInfo }, events: { goals: [] } };
            }
            if (detailsCallCount <= 3) {
                return { info: { homeTeam: game.homeTeamInfo, awayTeam: game.awayTeamInfo }, events: { goals: [firstGoal] } };
            }
            return { info: { homeTeam: game.homeTeamInfo, awayTeam: game.awayTeamInfo }, events: { goals: [firstGoal, secondGoal] } };
        }
    };
}

async function main() {
    resetProvider();

    setProvider('shl', createMockProvider('shl'));
    setProvider('allsvenskan', createMockProvider('allsvenskan'));
    setProvider('svenska-cupen', createMockProvider('svenska-cupen'));

    const sentNotifications = [];
    pushNotifications.sendGoalNotification = async (goal) => {
        sentNotifications.push(goal);
        return { success: true };
    };

    const runSummaries = [];
    for (let run = 1; run <= 4; run += 1) {
        const result = await goalWatcher.runCheck();
        runSummaries.push({
            run,
            gamesChecked: result.gamesChecked,
            newGoals: result.newGoals.length,
            newGoalsBySport: result.newGoals.reduce((acc, item) => {
                acc[item.sport] = (acc[item.sport] || 0) + 1;
                return acc;
            }, {}),
            notificationsSent: result.notificationsSent
        });
    }

    console.log(JSON.stringify({
        sentNotificationsBySport: sentNotifications.reduce((acc, item) => {
            acc[item.sport] = (acc[item.sport] || 0) + 1;
            return acc;
        }, {}),
        runSummaries
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
