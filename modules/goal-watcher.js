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

function buildFullName(firstName, lastName) {
    const safeFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const safeLastName = typeof lastName === 'string' ? lastName.trim() : '';
    if (!safeFirstName || !safeLastName) {
        return null;
    }
    return `${safeFirstName} ${safeLastName}`;
}

function resolveGoalScorerName(goal) {
    const structuredName = buildFullName(goal.player?.firstName, goal.player?.familyName)
        || buildFullName(goal.player?.firstName, goal.player?.lastName)
        || buildFullName(goal.scorerPlayer?.firstName, goal.scorerPlayer?.familyName)
        || buildFullName(goal.scorerPlayer?.firstName, goal.scorerPlayer?.lastName)
        || buildFullName(goal.scorer?.firstName, goal.scorer?.familyName)
        || buildFullName(goal.scorer?.firstName, goal.scorer?.lastName);

    if (structuredName) {
        return structuredName;
    }

    const directNameCandidates = [
        goal.player?.name,
        goal.scorerPlayer?.name,
        goal.scorer?.name
    ];

    for (const candidate of directNameCandidates) {
        if (typeof candidate !== 'string') {
            continue;
        }
        const trimmedCandidate = candidate.trim();
        if (trimmedCandidate) {
            return trimmedCandidate;
        }
    }

    return 'Unknown';
}

function isSameTeamCode(leftCode, rightCode) {
    if (!leftCode || !rightCode) {
        return false;
    }
    return String(leftCode).trim().toLowerCase() === String(rightCode).trim().toLowerCase();
}

function resolveGoalIsHomeTeam(goal, gameInfo) {
    if (goal.eventTeam?.place === 'home' || goal.isHome === true) {
        return true;
    }
    if (goal.eventTeam?.place === 'away' || goal.isHome === false) {
        return false;
    }

    const teamUuid = goal.teamUuid || goal.team?.uuid || goal.eventTeam?.teamId;
    if (teamUuid) {
        const normalizedTeamUuid = String(teamUuid);
        if (
            normalizedTeamUuid === String(gameInfo.homeTeamInfo?.uuid || '')
            || normalizedTeamUuid === String(gameInfo.homeTeamInfo?.code || '')
        ) {
            return true;
        }
        if (
            normalizedTeamUuid === String(gameInfo.awayTeamInfo?.uuid || '')
            || normalizedTeamUuid === String(gameInfo.awayTeamInfo?.code || '')
        ) {
            return false;
        }
    }

    const goalTeamCode = goal.teamCode || goal.team?.code || goal.team?.abbreviation;
    if (isSameTeamCode(goalTeamCode, gameInfo.homeTeamInfo?.code)) {
        return true;
    }
    if (isSameTeamCode(goalTeamCode, gameInfo.awayTeamInfo?.code)) {
        return false;
    }

    return false;
}

function resolveGoalScore(...candidates) {
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null || candidate === '') {
            continue;
        }
        const parsed = Number(candidate);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}

/**
 * Extract goal details for notification
 * @param {Object} goal - Goal event object
 * @param {Object} gameInfo - Game info object
 * @param {string} sport - Sport type ('shl', 'allsvenskan', 'svenska-cupen')
 * @returns {Object} Goal details for notification
 */
function extractGoalDetails(goal, gameInfo, sport, computedScore = null) {
    const isShl = sport === 'shl';

    // Goal payloads differ between sports/providers, so we support several scorer field shapes.
    const scorerName = resolveGoalScorerName(goal);

    // Get scoring team
    const isHomeTeam = resolveGoalIsHomeTeam(goal, gameInfo);
    const scoringTeam = isHomeTeam ? gameInfo.homeTeamInfo : gameInfo.awayTeamInfo;
    const opposingTeam = isHomeTeam ? gameInfo.awayTeamInfo : gameInfo.homeTeamInfo;

    // Get team codes for targeting
    const scoringTeamCode = scoringTeam?.code || scoringTeam?.names?.short || 'Unknown';
    const opposingTeamCode = opposingTeam?.code || opposingTeam?.names?.short || 'Unknown';

    // Determine the running score AT THE MOMENT OF THIS GOAL.
    // Order of trust:
    //   1. goal.homeGoals/awayGoals — explicit per-goal running score (SHL provides this,
    //      and it's authoritative; keep it first so SHL behaviour is unchanged).
    //   2. computedScore — running tally counted from ordered goals; used when the provider
    //      gives no per-goal score (Allsvenskan/ESPN keyEvents carry null score, which used
    //      to make goal pushes announce a stale 0-0).
    //   3. goal-level score object, then the (possibly lagging) team-level score.
    const homeScore = resolveGoalScore(
        goal.homeGoals,
        computedScore?.home,
        goal.homeTeam?.score ?? goal.score?.home,
        gameInfo.homeTeamInfo?.score
    ) ?? 0;
    const awayScore = resolveGoalScore(
        goal.awayGoals,
        computedScore?.away,
        goal.awayTeam?.score ?? goal.score?.away,
        gameInfo.awayTeamInfo?.score
    ) ?? 0;

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

        // Initialize seen goals for this game if needed
        if (!seenGoals.has(gameId)) {
            if (goals.length === 0) {
                seenGoals.set(gameId, new Set());
                return [];
            }

            // First check for this game with goals - mark all current goals as seen
            const goalIds = new Set(goals.map(g => getGoalId(g, gameId)));
            seenGoals.set(gameId, goalIds);
            console.log(`[GoalWatcher] Initialized ${goalIds.size} existing goals for game ${gameId}`);
            return [];
        }

        if (goals.length === 0) {
            return [];
        }

        // Check for new goals
        const previousGoalIds = seenGoals.get(gameId);
        const newGoals = [];

        // Merge team info once — schedule data (has .code) takes precedence over the
        // richer summary-header team objects. NOTE: fetchGameDetails returns team info
        // under .homeTeamInfo/.awayTeamInfo (this previously read .homeTeam/.awayTeam,
        // which are undefined, silently discarding the fresher summary data).
        const gameInfo = {
            uuid: gameId,
            homeTeamInfo: {
                ...(details.info?.homeTeamInfo || {}),
                ...game.homeTeamInfo  // Schedule data has .code, must take precedence
            },
            awayTeamInfo: {
                ...(details.info?.awayTeamInfo || {}),
                ...game.awayTeamInfo  // Schedule data has .code, must take precedence
            }
        };

        // Walk goals in chronological order, maintaining a running tally so each goal's
        // announced score is the scoreline AT THE MOMENT IT WAS SCORED. This is
        // authoritative and immune to lagging scoreboard/summary score fields (the cause
        // of goal pushes announcing a stale 0-0 for the first goal of a match).
        let homeTally = 0;
        let awayTally = 0;
        for (const goal of goals) {
            const isHomeGoal = resolveGoalIsHomeTeam(goal, gameInfo);
            if (isHomeGoal) {
                homeTally++;
            } else {
                awayTally++;
            }

            const goalId = getGoalId(goal, gameId);
            if (!previousGoalIds.has(goalId)) {
                previousGoalIds.add(goalId);

                const computedScore = { home: homeTally, away: awayTally };
                const goalDetails = extractGoalDetails(goal, gameInfo, sport, computedScore);
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

    // Check Svenska Cupen games
    try {
        const cupProvider = getProvider('svenska-cupen');
        const cupGames = await cupProvider.fetchActiveGames();
        const liveGames = cupGames.filter(g => g.state === 'live');

        for (const game of liveGames) {
            results.gamesChecked++;
            const newGoals = await checkGameForNewGoals(game, 'svenska-cupen');
            results.newGoals.push(...newGoals);
        }
    } catch (error) {
        console.error('[GoalWatcher] Error checking Svenska Cupen games:', error.message);
        addEntry('goal-watcher', 'error', `Error checking Svenska Cupen games: ${error.message}`);
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
    getStats,
    __test: {
        extractGoalDetails,
        resolveGoalScorerName
    }
};
