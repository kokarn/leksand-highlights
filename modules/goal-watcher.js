const { formatSwedishTimestamp } = require('./utils');
const { getProvider } = require('./providers');
const pushNotifications = require('./fcm-notifications');
const { addEntry } = require('./activity-log');

// ============ GOAL WATCHER STATE ============
// Track previously seen goals to detect new ones
const seenGoals = new Map(); // gameId -> Set of goalIds
let isRunning = false;
let stats = {
    lastCheck: null,
    gamesChecked: 0,
    goalsDetected: 0,
    notificationsSent: 0
};

/**
 * Generate a unique ID for a goal event
 * @param {Object} goal - Goal event object
 * @param {string} gameId - Game UUID
 * @returns {string} Unique goal identifier
 */
function getGoalId(goal, gameId) {
    // Create a unique ID from available goal properties
    const parts = [
        gameId,
        goal.period || '',
        goal.time || '',
        goal.teamUuid || goal.team?.uuid || goal.eventTeam?.teamId || '',
        goal.player?.uuid || goal.player?.playerId || goal.scorerPlayer?.uuid || '',
        goal.homeGoals ?? goal.homeTeam?.score ?? '',
        goal.awayGoals ?? goal.awayTeam?.score ?? ''
    ];
    return parts.join('-');
}

/**
 * Extract goal details for notification
 * @param {Object} goal - Goal event object
 * @param {Object} gameInfo - Game info object
 * @param {string} sport - Sport type ('shl' or 'allsvenskan')
 * @returns {Object} Goal details for notification
 */
function extractGoalDetails(goal, gameInfo, sport) {
    const isShl = sport === 'shl';

    // Get scorer name
    let scorerName = 'Unknown';
    if (goal.player?.firstName && goal.player?.familyName) {
        scorerName = `${goal.player.firstName} ${goal.player.familyName}`;
    } else if (goal.scorerPlayer?.firstName && goal.scorerPlayer?.familyName) {
        scorerName = `${goal.scorerPlayer.firstName} ${goal.scorerPlayer.familyName}`;
    } else if (goal.player?.name) {
        scorerName = goal.player.name;
    }

    // Get scoring team
    const teamUuid = goal.teamUuid || goal.team?.uuid || goal.eventTeam?.teamId;
    const isHomeTeam = goal.eventTeam?.place === 'home' ||
        teamUuid === gameInfo.homeTeamInfo?.uuid ||
        teamUuid === gameInfo.homeTeamInfo?.code;
    const scoringTeam = isHomeTeam ? gameInfo.homeTeamInfo : gameInfo.awayTeamInfo;
    const opposingTeam = isHomeTeam ? gameInfo.awayTeamInfo : gameInfo.homeTeamInfo;

    // Get team codes for targeting
    const scoringTeamCode = scoringTeam?.code || scoringTeam?.names?.short || 'Unknown';
    const opposingTeamCode = opposingTeam?.code || opposingTeam?.names?.short || 'Unknown';

    // Get current score (API provides homeGoals/awayGoals or homeTeam.score/awayTeam.score)
    const homeScore = goal.homeGoals ?? goal.homeTeam?.score ?? gameInfo.homeTeamInfo?.score ?? 0;
    const awayScore = goal.awayGoals ?? goal.awayTeam?.score ?? gameInfo.awayTeamInfo?.score ?? 0;

    // Get period/half info
    let periodText = '';
    if (isShl) {
        periodText = goal.period ? `P${goal.period}` : '';
    } else {
        periodText = goal.period === 1 ? '1st half' : goal.period === 2 ? '2nd half' : '';
    }

    return {
        sport,
        gameId: gameInfo.uuid,
        scorerName,
        scoringTeamCode,
        scoringTeamName: scoringTeam?.names?.long || scoringTeam?.names?.short || scoringTeamCode,
        opposingTeamCode,
        opposingTeamName: opposingTeam?.names?.long || opposingTeam?.names?.short || opposingTeamCode,
        homeTeamCode: gameInfo.homeTeamInfo?.code,
        awayTeamCode: gameInfo.awayTeamInfo?.code,
        homeScore,
        awayScore,
        time: goal.time || '',
        period: periodText,
        isHomeTeam
    };
}

// Track previous scores for Olympics hockey (no play-by-play available)
const previousOlympicsScores = new Map(); // gameId -> { home, away }

/**
 * Check an Olympics hockey game for score changes
 * Since there's no play-by-play API, we detect goals by comparing scores between polls.
 * @param {Object} game - Game object from Olympics provider
 * @returns {Array} Array of new goal notifications
 */
function checkOlympicsGameForScoreChanges(game) {
    const gameId = game.uuid;
    const homeScore = game.homeTeamInfo?.score ?? 0;
    const awayScore = game.awayTeamInfo?.score ?? 0;
    const newGoals = [];

    if (!previousOlympicsScores.has(gameId)) {
        // First check - store current scores without triggering notifications
        previousOlympicsScores.set(gameId, { home: homeScore, away: awayScore });
        console.log(`[GoalWatcher] Olympics: Initialized scores for ${gameId}: ${homeScore}-${awayScore}`);
        return [];
    }

    const prev = previousOlympicsScores.get(gameId);

    // Detect home team score increase
    if (homeScore > prev.home) {
        const scoringTeam = game.homeTeamInfo;
        const opposingTeam = game.awayTeamInfo;
        newGoals.push({
            sport: 'olympics-hockey',
            gameId,
            scorerName: 'Goal',
            scoringTeamCode: scoringTeam?.code || '',
            scoringTeamName: scoringTeam?.names?.long || scoringTeam?.names?.short || '',
            opposingTeamCode: opposingTeam?.code || '',
            opposingTeamName: opposingTeam?.names?.long || opposingTeam?.names?.short || '',
            homeTeamCode: game.homeTeamInfo?.code,
            awayTeamCode: game.awayTeamInfo?.code,
            homeScore,
            awayScore,
            time: '',
            period: '',
            isHomeTeam: true
        });
    }

    // Detect away team score increase
    if (awayScore > prev.away) {
        const scoringTeam = game.awayTeamInfo;
        const opposingTeam = game.homeTeamInfo;
        newGoals.push({
            sport: 'olympics-hockey',
            gameId,
            scorerName: 'Goal',
            scoringTeamCode: scoringTeam?.code || '',
            scoringTeamName: scoringTeam?.names?.long || scoringTeam?.names?.short || '',
            opposingTeamCode: opposingTeam?.code || '',
            opposingTeamName: opposingTeam?.names?.long || opposingTeam?.names?.short || '',
            homeTeamCode: game.homeTeamInfo?.code,
            awayTeamCode: game.awayTeamInfo?.code,
            homeScore,
            awayScore,
            time: '',
            period: '',
            isHomeTeam: false
        });
    }

    // Update stored scores
    previousOlympicsScores.set(gameId, { home: homeScore, away: awayScore });

    return newGoals;
}

/**
 * Check a single game for new goals
 * @param {Object} game - Game object from provider
 * @param {string} sport - Sport type
 * @returns {Promise<Array>} Array of new goals detected
 */
async function checkGameForNewGoals(game, sport) {
    const provider = getProvider(sport);
    const gameId = game.uuid;

    // Only check live games
    if (game.state !== 'live') {
        return [];
    }

    try {
        const details = await provider.fetchGameDetails(gameId);
        if (!details || !details.events) {
            return [];
        }

        const goals = details.events.goals || [];
        if (goals.length === 0) {
            return [];
        }

        // Initialize seen goals for this game if needed
        if (!seenGoals.has(gameId)) {
            // First check for this game - mark all current goals as seen
            const goalIds = new Set(goals.map(g => getGoalId(g, gameId)));
            seenGoals.set(gameId, goalIds);
            console.log(`[GoalWatcher] Initialized ${goalIds.size} existing goals for game ${gameId}`);
            return [];
        }

        // Check for new goals
        const previousGoalIds = seenGoals.get(gameId);
        const newGoals = [];

        for (const goal of goals) {
            const goalId = getGoalId(goal, gameId);
            if (!previousGoalIds.has(goalId)) {
                previousGoalIds.add(goalId);

                // Merge team info - use schedule data (has code) as base, enhance with game-info data
                const gameInfo = {
                    uuid: gameId,
                    homeTeamInfo: {
                        ...(details.info?.homeTeam || {}),
                        ...game.homeTeamInfo  // Schedule data has .code, must take precedence
                    },
                    awayTeamInfo: {
                        ...(details.info?.awayTeam || {}),
                        ...game.awayTeamInfo  // Schedule data has .code, must take precedence
                    }
                };

                const goalDetails = extractGoalDetails(goal, gameInfo, sport);
                newGoals.push(goalDetails);
            }
        }

        return newGoals;
    } catch (error) {
        console.error(`[GoalWatcher] Error checking game ${gameId}:`, error.message);
        return [];
    }
}

/**
 * Run a full goal check across all live games
 * @returns {Promise<Object>} Check results
 */
async function runCheck() {
    const timestamp = formatSwedishTimestamp();
    console.log(`\n--- [GoalWatcher] Running check at ${timestamp} ---`);

    const results = {
        gamesChecked: 0,
        newGoals: [],
        notificationsSent: 0
    };

    // Check SHL games
    try {
        const shlProvider = getProvider('shl');
        const shlGames = await shlProvider.fetchActiveGames();
        const liveGames = shlGames.filter(g => g.state === 'live');

        for (const game of liveGames) {
            results.gamesChecked++;
            const newGoals = await checkGameForNewGoals(game, 'shl');
            results.newGoals.push(...newGoals);
        }
    } catch (error) {
        console.error('[GoalWatcher] Error checking SHL games:', error.message);
        addEntry('goal-watcher', 'error', `Error checking SHL games: ${error.message}`);
    }

    // Check Olympics hockey games (score-change detection, no play-by-play)
    try {
        const olympicsProvider = getProvider('olympics-hockey');
        const olympicsGames = await olympicsProvider.fetchActiveGames();
        const liveOlympicsGames = olympicsGames.filter(g => g.state === 'live');

        for (const game of liveOlympicsGames) {
            results.gamesChecked++;
            const newGoals = checkOlympicsGameForScoreChanges(game);
            results.newGoals.push(...newGoals);
        }
    } catch (error) {
        console.error('[GoalWatcher] Error checking Olympics hockey games:', error.message);
        addEntry('goal-watcher', 'error', `Error checking Olympics hockey games: ${error.message}`);
    }

    // Check Allsvenskan games
    try {
        const footballProvider = getProvider('allsvenskan');
        const footballGames = await footballProvider.fetchActiveGames();
        const liveGames = footballGames.filter(g => g.state === 'live');

        for (const game of liveGames) {
            results.gamesChecked++;
            const newGoals = await checkGameForNewGoals(game, 'allsvenskan');
            results.newGoals.push(...newGoals);
        }
    } catch (error) {
        console.error('[GoalWatcher] Error checking Allsvenskan games:', error.message);
        addEntry('goal-watcher', 'error', `Error checking Allsvenskan games: ${error.message}`);
    }

    // Send notifications for new goals
    for (const goal of results.newGoals) {
        console.log(`[GoalWatcher] New goal detected: ${goal.scorerName} for ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`);
        addEntry('goal-watcher', 'goal', `Goal: ${goal.scorerName} for ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`, { sport: goal.sport, gameId: goal.gameId });

        try {
            await pushNotifications.sendGoalNotification(goal);
            results.notificationsSent++;
            stats.notificationsSent++;
            addEntry('goal-watcher', 'notification', `Goal notification sent: ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`);
        } catch (error) {
            console.error('[GoalWatcher] Error sending notification:', error.message);
            addEntry('goal-watcher', 'error', `Goal notification failed: ${error.message}`);
        }
    }

    // Update stats
    stats.lastCheck = timestamp;
    stats.gamesChecked = results.gamesChecked;
    stats.goalsDetected += results.newGoals.length;

    if (results.newGoals.length > 0) {
        console.log(`[GoalWatcher] Detected ${results.newGoals.length} new goals, sent ${results.notificationsSent} notifications`);
    }

    return results;
}

/**
 * Clean up old game entries from seenGoals map
 * Called periodically to prevent memory leaks
 */
function cleanupOldGames() {
    const now = Date.now();
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours

    // Note: Since we don't track timestamps per game,
    // we rely on the game state checks to skip non-live games
    // This is a placeholder for future enhancement
    console.log(`[GoalWatcher] Tracking goals for ${seenGoals.size} games`);
}

/**
 * Start the goal watcher loop
 * Checks every 15 seconds for new goals during live games
 */
function startLoop() {
    if (isRunning) {
        console.log('[GoalWatcher] Already running');
        return;
    }

    isRunning = true;
    console.log('[GoalWatcher] Starting goal watcher service...');

    const checkLoop = async () => {
        if (!isRunning) {
            return;
        }

        try {
            const results = await runCheck();

            // Check more frequently if there are live games
            const delay = results.gamesChecked > 0 ? 15 * 1000 : 60 * 1000;

            if (results.gamesChecked > 0) {
                console.log(`[GoalWatcher] ${results.gamesChecked} live games. Next check in 15 seconds.`);
            }

            setTimeout(checkLoop, delay);
        } catch (error) {
            console.error('[GoalWatcher] Error in main loop:', error);
            setTimeout(checkLoop, 60 * 1000);
        }
    };

    // Initial check after a short delay
    setTimeout(checkLoop, 5000);

    // Cleanup old games every hour
    setInterval(cleanupOldGames, 60 * 60 * 1000);
}

/**
 * Stop the goal watcher loop
 */
function stopLoop() {
    isRunning = false;
    console.log('[GoalWatcher] Stopped');
}

/**
 * Get current stats
 * @returns {Object} Goal watcher statistics
 */
function getStats() {
    return {
        running: isRunning,
        lastCheck: stats.lastCheck,
        gamesChecked: stats.gamesChecked,
        totalGoalsDetected: stats.goalsDetected,
        totalNotificationsSent: stats.notificationsSent,
        trackedGames: seenGoals.size
    };
}

module.exports = {
    runCheck,
    startLoop,
    stopLoop,
    getStats
};
