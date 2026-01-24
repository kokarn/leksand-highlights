/**
 * Pre-Game Watcher Module
 *
 * Monitors upcoming games across all sports and sends reminder notifications
 * 5 minutes before games start. Supports SHL, Allsvenskan, and Biathlon.
 */

const fs = require('fs');
const {
    PRE_GAME_REMINDER_MINUTES,
    PRE_GAME_CHECK_INTERVAL,
    PRE_GAME_WINDOW_MINUTES,
    SEEN_PRE_GAME_FILE
} = require('./config');
const { getProvider } = require('./providers');
const { formatSwedishTimestamp } = require('./utils');
const pushNotifications = require('./fcm-notifications');

// ============ PRE-GAME WATCHER STATE ============
let seenPreGameNotifications = new Set(); // Track sent notifications by gameId
let isRunning = false;
let stats = {
    lastCheck: null,
    gamesChecked: 0,
    notificationsSent: 0,
    totalNotificationsSent: 0
};

// ============ DATA PERSISTENCE ============

/**
 * Load previously sent pre-game notification IDs from file
 */
function loadSeenNotifications() {
    if (fs.existsSync(SEEN_PRE_GAME_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SEEN_PRE_GAME_FILE, 'utf8'));
            seenPreGameNotifications = new Set(data);
            console.log(`[PreGameWatcher] Loaded ${seenPreGameNotifications.size} seen notification IDs`);
        } catch (e) {
            console.error('[PreGameWatcher] Error reading seen_pre_game.json:', e);
        }
    }
}

/**
 * Save sent notification IDs to file
 */
function saveSeenNotifications() {
    try {
        // Only keep notifications from the last 48 hours worth of games
        // (approximately 100 entries max to prevent file from growing indefinitely)
        const notificationArray = Array.from(seenPreGameNotifications);
        const trimmedArray = notificationArray.slice(-100);
        fs.writeFileSync(SEEN_PRE_GAME_FILE, JSON.stringify(trimmedArray, null, 2));
    } catch (e) {
        console.error('[PreGameWatcher] Error saving seen_pre_game.json:', e);
    }
}

/**
 * Mark a game as having had its pre-game notification sent
 * @param {string} gameId - Game UUID
 */
function markNotificationSent(gameId) {
    seenPreGameNotifications.add(gameId);
    saveSeenNotifications();
}

/**
 * Check if a pre-game notification has already been sent for a game
 * @param {string} gameId - Game UUID
 * @returns {boolean}
 */
function hasNotificationBeenSent(gameId) {
    return seenPreGameNotifications.has(gameId);
}

// ============ GAME CHECKING ============

/**
 * Check if a game is starting soon (within the notification window)
 * @param {Date} startTime - Game start time
 * @param {Date} now - Current time
 * @returns {Object|null} - { minutesUntilStart } if within window, null otherwise
 */
function isGameStartingSoon(startTime, now = new Date()) {
    const msUntilStart = startTime.getTime() - now.getTime();
    const minutesUntilStart = msUntilStart / (1000 * 60);

    // Game should start between now and the window (e.g., 0-10 minutes)
    // We target around the reminder time (e.g., 5 minutes)
    if (minutesUntilStart > 0 && minutesUntilStart <= PRE_GAME_WINDOW_MINUTES) {
        return { minutesUntilStart: Math.round(minutesUntilStart) };
    }

    return null;
}

/**
 * Extract game info for notification from a SHL game
 * @param {Object} game - SHL game object
 * @returns {Object} Game info for notification
 */
function extractShlGameInfo(game) {
    return {
        sport: 'shl',
        gameId: game.uuid,
        homeTeamName: game.homeTeamInfo?.names?.long || game.homeTeamInfo?.names?.short || 'Home',
        awayTeamName: game.awayTeamInfo?.names?.long || game.awayTeamInfo?.names?.short || 'Away',
        homeTeamCode: game.homeTeamInfo?.code || game.homeTeamInfo?.names?.short || '',
        awayTeamCode: game.awayTeamInfo?.code || game.awayTeamInfo?.names?.short || '',
        startTime: game.startDateTime,
        venue: game.venueInfo?.name || game.venue || null
    };
}

/**
 * Extract game info for notification from an Allsvenskan game
 * @param {Object} game - Allsvenskan game object
 * @returns {Object} Game info for notification
 */
function extractFootballGameInfo(game) {
    return {
        sport: 'allsvenskan',
        gameId: game.uuid,
        homeTeamName: game.homeTeamInfo?.names?.long || game.homeTeamInfo?.names?.short || 'Home',
        awayTeamName: game.awayTeamInfo?.names?.long || game.awayTeamInfo?.names?.short || 'Away',
        homeTeamCode: game.homeTeamInfo?.code || game.homeTeamInfo?.names?.short || '',
        awayTeamCode: game.awayTeamInfo?.code || game.awayTeamInfo?.names?.short || '',
        startTime: game.startDateTime,
        venue: game.venueInfo?.name || game.venue || null
    };
}

/**
 * Extract game info for notification from a Biathlon race
 * @param {Object} race - Biathlon race object
 * @returns {Object} Game info for notification
 */
function extractBiathlonGameInfo(race) {
    const genderDisplay = race.gender === 'men' ? 'Men\'s' : race.gender === 'women' ? 'Women\'s' : 'Mixed';
    const eventName = `${genderDisplay} ${race.discipline || 'Race'}`;

    return {
        sport: 'biathlon',
        gameId: race.uuid,
        eventName,
        startTime: race.startDateTime,
        venue: race.location || null,
        // No team codes for biathlon
        homeTeamCode: null,
        awayTeamCode: null
    };
}

/**
 * Check SHL games for upcoming starts
 * @param {Date} now - Current time
 * @returns {Promise<Array>} Array of games needing notifications
 */
async function checkShlGames(now) {
    const upcomingGames = [];

    try {
        const provider = getProvider('shl');
        const games = await provider.fetchAllGames();

        for (const game of games) {
            // Skip if not pre-game state
            if (game.state !== 'pre-game') {
                continue;
            }

            // Skip if already notified
            if (hasNotificationBeenSent(game.uuid)) {
                continue;
            }

            const startTime = new Date(game.startDateTime);
            const startingSoon = isGameStartingSoon(startTime, now);

            if (startingSoon) {
                const gameInfo = extractShlGameInfo(game);
                gameInfo.minutesUntilStart = startingSoon.minutesUntilStart;
                upcomingGames.push(gameInfo);
            }
        }
    } catch (error) {
        console.error('[PreGameWatcher] Error checking SHL games:', error.message);
    }

    return upcomingGames;
}

/**
 * Check Allsvenskan games for upcoming starts
 * @param {Date} now - Current time
 * @returns {Promise<Array>} Array of games needing notifications
 */
async function checkFootballGames(now) {
    const upcomingGames = [];

    try {
        const provider = getProvider('allsvenskan');
        const games = await provider.fetchAllGames();

        for (const game of games) {
            // Skip if not pre-game state
            if (game.state !== 'pre-game') {
                continue;
            }

            // Skip if already notified
            if (hasNotificationBeenSent(game.uuid)) {
                continue;
            }

            const startTime = new Date(game.startDateTime);
            const startingSoon = isGameStartingSoon(startTime, now);

            if (startingSoon) {
                const gameInfo = extractFootballGameInfo(game);
                gameInfo.minutesUntilStart = startingSoon.minutesUntilStart;
                upcomingGames.push(gameInfo);
            }
        }
    } catch (error) {
        console.error('[PreGameWatcher] Error checking Allsvenskan games:', error.message);
    }

    return upcomingGames;
}

/**
 * Check Biathlon races for upcoming starts
 * @param {Date} now - Current time
 * @returns {Promise<Array>} Array of races needing notifications
 */
async function checkBiathlonRaces(now) {
    const upcomingRaces = [];

    try {
        const provider = getProvider('biathlon');
        const races = await provider.fetchAllGames();

        for (const race of races) {
            // Skip if not upcoming/scheduled state
            if (race.state === 'completed' || race.state === 'live') {
                continue;
            }

            // Skip if already notified
            if (hasNotificationBeenSent(race.uuid)) {
                continue;
            }

            const startTime = new Date(race.startDateTime);
            const startingSoon = isGameStartingSoon(startTime, now);

            if (startingSoon) {
                const raceInfo = extractBiathlonGameInfo(race);
                raceInfo.minutesUntilStart = startingSoon.minutesUntilStart;
                upcomingRaces.push(raceInfo);
            }
        }
    } catch (error) {
        console.error('[PreGameWatcher] Error checking Biathlon races:', error.message);
    }

    return upcomingRaces;
}

// ============ MAIN CHECK LOOP ============

/**
 * Run a full check across all sports for upcoming games
 * @returns {Promise<Object>} Check results
 */
async function runCheck() {
    const timestamp = formatSwedishTimestamp();
    const now = new Date();

    console.log(`\n--- [PreGameWatcher] Running check at ${timestamp} ---`);

    const results = {
        gamesChecked: 0,
        upcomingGames: [],
        notificationsSent: 0
    };

    // Check all sports in parallel
    const [shlGames, footballGames, biathlonRaces] = await Promise.all([
        checkShlGames(now),
        checkFootballGames(now),
        checkBiathlonRaces(now)
    ]);

    results.upcomingGames = [...shlGames, ...footballGames, ...biathlonRaces];
    results.gamesChecked = results.upcomingGames.length;

    // Send notifications for upcoming games
    for (const gameInfo of results.upcomingGames) {
        // Only send if within the target window (around 5 minutes)
        if (gameInfo.minutesUntilStart <= PRE_GAME_REMINDER_MINUTES + 2) {
            console.log(`[PreGameWatcher] Sending pre-game notification for ${gameInfo.sport}: ${gameInfo.homeTeamName || gameInfo.eventName}`);

            try {
                const result = await pushNotifications.sendPreGameNotification(gameInfo);

                if (result.success) {
                    markNotificationSent(gameInfo.gameId);
                    results.notificationsSent++;
                    stats.totalNotificationsSent++;
                } else {
                    console.error(`[PreGameWatcher] Failed to send notification for ${gameInfo.gameId}:`, result.error);
                }
            } catch (error) {
                console.error(`[PreGameWatcher] Error sending notification for ${gameInfo.gameId}:`, error.message);
            }
        }
    }

    // Update stats
    stats.lastCheck = timestamp;
    stats.gamesChecked = results.gamesChecked;
    stats.notificationsSent = results.notificationsSent;

    if (results.upcomingGames.length > 0) {
        console.log(`[PreGameWatcher] Found ${results.upcomingGames.length} upcoming games, sent ${results.notificationsSent} notifications`);
    }

    return results;
}

/**
 * Start the pre-game watcher loop
 */
function startLoop() {
    if (isRunning) {
        console.log('[PreGameWatcher] Already running');
        return;
    }

    isRunning = true;
    loadSeenNotifications();
    console.log('[PreGameWatcher] Starting pre-game notification service...');
    console.log(`[PreGameWatcher] Reminder window: ${PRE_GAME_REMINDER_MINUTES} minutes before start`);
    console.log(`[PreGameWatcher] Check interval: ${PRE_GAME_CHECK_INTERVAL / 1000} seconds`);

    const checkLoop = async () => {
        if (!isRunning) {
            return;
        }

        try {
            await runCheck();
            setTimeout(checkLoop, PRE_GAME_CHECK_INTERVAL);
        } catch (error) {
            console.error('[PreGameWatcher] Error in main loop:', error);
            setTimeout(checkLoop, PRE_GAME_CHECK_INTERVAL);
        }
    };

    // Initial check after a short delay
    setTimeout(checkLoop, 10000);
}

/**
 * Stop the pre-game watcher loop
 */
function stopLoop() {
    isRunning = false;
    console.log('[PreGameWatcher] Stopped');
}

/**
 * Get current stats
 * @returns {Object} Pre-game watcher statistics
 */
function getStats() {
    return {
        running: isRunning,
        lastCheck: stats.lastCheck,
        gamesChecked: stats.gamesChecked,
        lastNotificationsSent: stats.notificationsSent,
        totalNotificationsSent: stats.totalNotificationsSent,
        seenNotificationsCount: seenPreGameNotifications.size,
        config: {
            reminderMinutes: PRE_GAME_REMINDER_MINUTES,
            checkIntervalSeconds: PRE_GAME_CHECK_INTERVAL / 1000,
            windowMinutes: PRE_GAME_WINDOW_MINUTES
        }
    };
}

module.exports = {
    runCheck,
    startLoop,
    stopLoop,
    getStats
};
