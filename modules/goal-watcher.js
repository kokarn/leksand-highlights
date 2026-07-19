const { formatSwedishTimestamp } = require('./utils');
const { getProvider } = require('./providers');
const { getActiveGames } = require('./games-cache');
const pushNotifications = require('./fcm-notifications');
const { addEntry } = require('./activity-log');

// ============ GOAL WATCHER STATE ============
// Track previously seen goals to detect new ones
const seenGoals = new Map(); // gameId -> Set of goalIds
const gameLastSeen = new Map(); // gameId -> timestamp (ms) of last live check, for cleanup
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
    // Create a unique ID from available goal properties.
    // goal.id is the provider's own stable per-event id (ESPN keyEvents/plays always
    // carry it). It MUST come first: football (ESPN) goals expose `clock`/`isHome`/
    // `.scorer` and null scores — NOT `time`/`teamUuid`/`.player`/homeGoals — so every
    // football goal in the same period used to collapse to the identical key
    // (`gameId-1-----`), making the 2nd+ goal of a half look already-seen and never push.
    const parts = [
        goal.id || goal.eventId || '',
        gameId,
        goal.period || '',
        goal.time || goal.clock?.displayValue || goal.clock || '',
        goal.teamUuid || goal.team?.uuid || goal.eventTeam?.teamId || goal.teamCode || (goal.isHome === true ? 'home' : goal.isHome === false ? 'away' : ''),
        goal.player?.uuid || goal.player?.playerId || goal.scorerPlayer?.uuid || goal.scorer?.id || goal.scorer?.name || '',
        goal.homeGoals ?? goal.homeTeam?.score ?? goal.score?.home ?? '',
        goal.awayGoals ?? goal.awayTeam?.score ?? goal.score?.away ?? ''
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

    // Record activity so cleanupOldGames can evict games that stopped being live.
    gameLastSeen.set(gameId, Date.now());

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
                // NOTE: do NOT mark this goal seen here. It is marked in runCheck ONLY
                // after its push notification succeeds, so a transient FCM/network
                // failure retries on the next tick instead of silently losing the goal.
                const computedScore = { home: homeTally, away: awayTally };
                const goalDetails = extractGoalDetails(goal, gameInfo, sport, computedScore);
                goalDetails.goalId = goalId;
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

    // Fetch all three sports' active games in parallel, then check each sport's live
    // games concurrently. Previously this was fully sequential (await per sport, then
    // await per game), so on a busy multi-league night detection lag stacked up.
    const SPORTS = ['shl', 'allsvenskan', 'svenska-cupen'];

    const perSportGoals = await Promise.all(SPORTS.map(async (sport) => {
        try {
            const games = await getActiveGames(sport);
            const liveGames = games.filter(g => g.state === 'live');

            // Check this sport's live games concurrently.
            const goalsPerGame = await Promise.all(
                liveGames.map(game => checkGameForNewGoals(game, sport))
            );

            return { liveCount: liveGames.length, goals: goalsPerGame.flat() };
        } catch (error) {
            console.error(`[GoalWatcher] Error checking ${sport} games:`, error.message);
            addEntry('goal-watcher', 'error', `Error checking ${sport} games: ${error.message}`);
            return { liveCount: 0, goals: [] };
        }
    }));

    for (const sportResult of perSportGoals) {
        results.gamesChecked += sportResult.liveCount;
        results.newGoals.push(...sportResult.goals);
    }

    // Send notifications for new goals concurrently. Each send independently marks its
    // goal seen ONLY on success, so a failed send retries next tick (order-independent).
    await Promise.all(results.newGoals.map(async (goal) => {
        console.log(`[GoalWatcher] New goal detected: ${goal.scorerName} for ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`);
        addEntry('goal-watcher', 'goal', `Goal: ${goal.scorerName} for ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`, { sport: goal.sport, gameId: goal.gameId });

        try {
            await pushNotifications.sendGoalNotification(goal);
            // Mark seen ONLY after a successful push, so a failed send retries next tick.
            if (goal.goalId) {
                const gameGoalIds = seenGoals.get(goal.gameId);
                if (gameGoalIds) {
                    gameGoalIds.add(goal.goalId);
                }
            }
            results.notificationsSent++;
            stats.notificationsSent++;
            addEntry('goal-watcher', 'notification', `Goal notification sent: ${goal.scoringTeamName} (${goal.homeScore}-${goal.awayScore})`);
        } catch (error) {
            console.error('[GoalWatcher] Error sending notification:', error.message);
            addEntry('goal-watcher', 'error', `Goal notification failed (will retry): ${error.message}`);
        }
    }));

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
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours since a game was last seen live

    let evicted = 0;
    for (const [gameId, lastSeen] of gameLastSeen) {
        if (now - lastSeen > maxAge) {
            seenGoals.delete(gameId);
            gameLastSeen.delete(gameId);
            evicted++;
        }
    }

    // Safety net: drop any seenGoals entry with no activity record at all
    // (e.g. a game initialized then never live again).
    for (const gameId of seenGoals.keys()) {
        if (!gameLastSeen.has(gameId)) {
            seenGoals.delete(gameId);
            evicted++;
        }
    }

    if (evicted > 0) {
        console.log(`[GoalWatcher] Cleanup evicted ${evicted} stale games. Now tracking ${seenGoals.size}.`);
    } else {
        console.log(`[GoalWatcher] Tracking goals for ${seenGoals.size} games`);
    }
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
            const delay = results.gamesChecked > 0 ? 10 * 1000 : 60 * 1000;

            if (results.gamesChecked > 0) {
                console.log(`[GoalWatcher] ${results.gamesChecked} live games. Next check in 10 seconds.`);
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
