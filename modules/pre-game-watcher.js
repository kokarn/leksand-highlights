/**
 * Pre-Game Watcher Module
 *
 * Schedules reminder notifications for upcoming games across all sports.
 * Runs a daily schedule job (default 6:00 AM Stockholm time) that looks at all 
 * games for the next 24 hours and schedules notifications to fire X minutes 
 * before each game starts.
 * 
 * This approach is more reliable than polling because:
 * - Notifications are scheduled in advance, not dependent on API availability at game time
 * - Less network traffic and API load
 * - Predictable timing
 */

const fs = require('fs');
const {
    PRE_GAME_REMINDER_MINUTES,
    SEEN_PRE_GAME_FILE
} = require('./config');
const { getProvider } = require('./providers');
const { formatSwedishTimestamp } = require('./utils');
const pushNotifications = require('./fcm-notifications');

// ============ PRE-GAME WATCHER STATE ============
let seenPreGameNotifications = new Set(); // Track sent notifications by gameId
let scheduledNotifications = new Map(); // Track scheduled timeouts by gameId -> { timeout, gameInfo, scheduledFor }
let isRunning = false;
let dailyScheduleTimer = null;
let stats = {
    lastScheduleRun: null,
    scheduledCount: 0,
    notificationsSent: 0,
    totalNotificationsSent: 0,
    nextScheduleRun: null
};

// Schedule hour in 24h format (Stockholm time)
const DAILY_SCHEDULE_HOUR = 6; // 6:00 AM

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
        // Only keep the most recent 100 entries to prevent file from growing indefinitely
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

// ============ GAME INFO EXTRACTION ============

/**
 * Extract game info for notification from a SHL game
 */
function extractShlGameInfo(game) {
    return {
        sport: 'shl',
        gameId: game.uuid,
        homeTeamName: game.homeTeamInfo?.names?.long || game.homeTeamInfo?.names?.short || 'Home',
        awayTeamName: game.awayTeamInfo?.names?.long || game.awayTeamInfo?.names?.short || 'Away',
        homeTeamCode: game.homeTeamInfo?.code || game.homeTeamInfo?.names?.short || '',
        awayTeamCode: game.awayTeamInfo?.code || game.awayTeamInfo?.names?.short || '',
        startDateTime: game.rawStartDateTime || game.startDateTime,
        venue: game.venueInfo?.name || game.venue || null
    };
}

/**
 * Extract game info for notification from an Allsvenskan game
 */
function extractFootballGameInfo(game) {
    return {
        sport: 'allsvenskan',
        gameId: game.uuid,
        homeTeamName: game.homeTeamInfo?.names?.long || game.homeTeamInfo?.names?.short || 'Home',
        awayTeamName: game.awayTeamInfo?.names?.long || game.awayTeamInfo?.names?.short || 'Away',
        homeTeamCode: game.homeTeamInfo?.code || game.homeTeamInfo?.names?.short || '',
        awayTeamCode: game.awayTeamInfo?.code || game.awayTeamInfo?.names?.short || '',
        startDateTime: game.rawStartDateTime || game.startDateTime,
        venue: game.venueInfo?.name || game.venue || null
    };
}

/**
 * Extract game info for notification from an Olympics hockey game
 */
function extractOlympicsHockeyGameInfo(game) {
    return {
        sport: 'olympics-hockey',
        gameId: game.uuid,
        homeTeamName: game.homeTeamInfo?.names?.long || game.homeTeamInfo?.names?.short || 'Home',
        awayTeamName: game.awayTeamInfo?.names?.long || game.awayTeamInfo?.names?.short || 'Away',
        homeTeamCode: game.homeTeamInfo?.code || '',
        awayTeamCode: game.awayTeamInfo?.code || '',
        startDateTime: game.rawStartDateTime || game.startDateTime,
        venue: game.venueInfo?.name || null
    };
}

/**
 * Extract game info for notification from a Biathlon race
 */
function extractBiathlonGameInfo(race) {
    const genderDisplay = race.gender === 'men' ? 'Men\'s' : race.gender === 'women' ? 'Women\'s' : 'Mixed';
    const eventName = `${genderDisplay} ${race.discipline || 'Race'}`;

    return {
        sport: 'biathlon',
        gameId: race.uuid,
        eventName,
        startDateTime: race.rawStartDateTime || race.startDateTime,
        venue: race.location || null,
        homeTeamCode: null,
        awayTeamCode: null
    };
}

// ============ NOTIFICATION SCHEDULING ============

/**
 * Schedule a notification for a specific game
 * @param {Object} gameInfo - Game information
 * @returns {boolean} Whether the notification was scheduled
 */
function scheduleNotification(gameInfo) {
    const { gameId, startDateTime, sport } = gameInfo;

    // Skip if already sent
    if (hasNotificationBeenSent(gameId)) {
        return false;
    }

    // Skip if already scheduled
    if (scheduledNotifications.has(gameId)) {
        return false;
    }

    const startTime = new Date(startDateTime);
    const now = new Date();
    
    // Calculate when to send (X minutes before start)
    const notifyTime = new Date(startTime.getTime() - (PRE_GAME_REMINDER_MINUTES * 60 * 1000));
    const msUntilNotify = notifyTime.getTime() - now.getTime();

    // Skip if notification time has already passed
    if (msUntilNotify < 0) {
        return false;
    }

    // Skip if more than 24 hours away (will be scheduled in next daily run)
    if (msUntilNotify > 24 * 60 * 60 * 1000) {
        return false;
    }

    const minutesUntilStart = Math.round((startTime.getTime() - notifyTime.getTime()) / (1000 * 60));
    const displayName = gameInfo.eventName || `${gameInfo.homeTeamName} vs ${gameInfo.awayTeamName}`;
    const minutesFromNow = Math.round(msUntilNotify / 60000);
    const hoursFromNow = Math.floor(minutesFromNow / 60);
    const remainingMinutes = minutesFromNow % 60;
    const timeFromNowStr = hoursFromNow > 0 ? `${hoursFromNow}h ${remainingMinutes}m` : `${minutesFromNow}m`;

    console.log(`[PreGameWatcher] + Scheduled: ${displayName} (notify in ${timeFromNowStr})`);

    const timeout = setTimeout(async () => {
        await sendScheduledNotification(gameId);
    }, msUntilNotify);

    scheduledNotifications.set(gameId, {
        timeout,
        gameInfo: { ...gameInfo, minutesUntilStart },
        scheduledFor: notifyTime.toISOString()
    });

    return true;
}

/**
 * Send a scheduled notification
 * @param {string} gameId - Game UUID
 */
async function sendScheduledNotification(gameId) {
    const scheduled = scheduledNotifications.get(gameId);
    if (!scheduled) {
        console.warn(`[PreGameWatcher] No scheduled notification found for ${gameId}`);
        return;
    }

    const { gameInfo } = scheduled;
    scheduledNotifications.delete(gameId);

    // Double-check we haven't already sent
    if (hasNotificationBeenSent(gameId)) {
        console.log(`[PreGameWatcher] Notification for ${gameId} was already sent, skipping`);
        return;
    }

    const displayName = gameInfo.eventName || `${gameInfo.homeTeamName} vs ${gameInfo.awayTeamName}`;
    console.log(`[PreGameWatcher] Sending scheduled notification for ${gameInfo.sport}: ${displayName}`);

    try {
        const result = await pushNotifications.sendPreGameNotification(gameInfo);

        if (result.success) {
            markNotificationSent(gameId);
            stats.notificationsSent++;
            stats.totalNotificationsSent++;
            console.log(`[PreGameWatcher] Successfully sent notification for ${displayName}`);
        } else {
            console.error(`[PreGameWatcher] Failed to send notification for ${gameId}:`, result.error);
        }
    } catch (error) {
        console.error(`[PreGameWatcher] Error sending notification for ${gameId}:`, error.message);
    }
}

/**
 * Cancel all scheduled notifications
 */
function cancelAllScheduled() {
    for (const [gameId, scheduled] of scheduledNotifications) {
        clearTimeout(scheduled.timeout);
    }
    scheduledNotifications.clear();
}

// ============ DAILY SCHEDULE JOB ============

/**
 * Fetch all games for the next 24 hours and schedule notifications
 */
async function runDailySchedule() {
    const timestamp = formatSwedishTimestamp();
    console.log(`\n========================================`);
    console.log(`[PreGameWatcher] Running daily schedule at ${timestamp}`);
    console.log(`========================================`);

    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let totalScheduled = 0;

    // Cancel any existing scheduled notifications (in case of manual re-run)
    const previousCount = scheduledNotifications.size;
    if (previousCount > 0) {
        console.log(`[PreGameWatcher] Clearing ${previousCount} previously scheduled notifications`);
        cancelAllScheduled();
    }

    // Fetch and schedule SHL games
    try {
        const shlProvider = getProvider('shl');
        const shlGames = await shlProvider.fetchAllGames();
        
        let shlScheduled = 0;
        for (const game of shlGames) {
            if (game.state === 'post-game') {
                continue;
            }
            const startTime = new Date(game.rawStartDateTime || game.startDateTime);
            if (startTime >= now && startTime <= next24Hours) {
                const gameInfo = extractShlGameInfo(game);
                if (scheduleNotification(gameInfo)) {
                    shlScheduled++;
                }
            }
        }
        console.log(`[PreGameWatcher] Scheduled ${shlScheduled} SHL notifications`);
        totalScheduled += shlScheduled;
    } catch (error) {
        console.error('[PreGameWatcher] Error fetching SHL games:', error.message);
    }

    // Fetch and schedule Allsvenskan games
    try {
        const footballProvider = getProvider('allsvenskan');
        const footballGames = await footballProvider.fetchAllGames();
        
        let footballScheduled = 0;
        for (const game of footballGames) {
            if (game.state === 'post-game') {
                continue;
            }
            const startTime = new Date(game.rawStartDateTime || game.startDateTime);
            if (startTime >= now && startTime <= next24Hours) {
                const gameInfo = extractFootballGameInfo(game);
                if (scheduleNotification(gameInfo)) {
                    footballScheduled++;
                }
            }
        }
        console.log(`[PreGameWatcher] Scheduled ${footballScheduled} Allsvenskan notifications`);
        totalScheduled += footballScheduled;
    } catch (error) {
        console.error('[PreGameWatcher] Error fetching Allsvenskan games:', error.message);
    }

    // Fetch and schedule Olympics hockey games
    try {
        const olympicsProvider = getProvider('olympics-hockey');
        const olympicsGames = await olympicsProvider.fetchAllGames();

        let olympicsScheduled = 0;
        for (const game of olympicsGames) {
            if (game.state === 'post-game') {
                continue;
            }
            const startTime = new Date(game.rawStartDateTime || game.startDateTime);
            if (startTime >= now && startTime <= next24Hours) {
                const gameInfo = extractOlympicsHockeyGameInfo(game);
                if (scheduleNotification(gameInfo)) {
                    olympicsScheduled++;
                }
            }
        }
        console.log(`[PreGameWatcher] Scheduled ${olympicsScheduled} Olympics hockey notifications`);
        totalScheduled += olympicsScheduled;
    } catch (error) {
        console.error('[PreGameWatcher] Error fetching Olympics hockey games:', error.message);
    }

    // Fetch and schedule Biathlon races
    try {
        const biathlonProvider = getProvider('biathlon');
        const races = await biathlonProvider.fetchAllGames();
        
        let biathlonScheduled = 0;
        for (const race of races) {
            if (race.state === 'completed' || race.state === 'live') {
                continue;
            }
            const startTime = new Date(race.rawStartDateTime || race.startDateTime);
            if (startTime >= now && startTime <= next24Hours) {
                const raceInfo = extractBiathlonGameInfo(race);
                if (scheduleNotification(raceInfo)) {
                    biathlonScheduled++;
                }
            }
        }
        console.log(`[PreGameWatcher] Scheduled ${biathlonScheduled} Biathlon notifications`);
        totalScheduled += biathlonScheduled;
    } catch (error) {
        console.error('[PreGameWatcher] Error fetching Biathlon races:', error.message);
    }

    stats.lastScheduleRun = timestamp;
    stats.scheduledCount = totalScheduled;

    // Log a clear summary of all scheduled notifications
    console.log(`\n[PreGameWatcher] ===== SCHEDULED NOTIFICATIONS SUMMARY =====`);
    if (scheduledNotifications.size === 0) {
        console.log(`[PreGameWatcher] No notifications scheduled for the next 24 hours.`);
    } else {
        // Sort by scheduled time
        const sortedNotifications = Array.from(scheduledNotifications.entries())
            .map(([gameId, data]) => ({
                gameId,
                sport: data.gameInfo.sport,
                name: data.gameInfo.eventName || `${data.gameInfo.homeTeamName} vs ${data.gameInfo.awayTeamName}`,
                venue: data.gameInfo.venue,
                gameTime: data.gameInfo.startDateTime,
                notifyAt: data.scheduledFor
            }))
            .sort((a, b) => new Date(a.notifyAt) - new Date(b.notifyAt));

        for (const notification of sortedNotifications) {
            const gameTime = new Date(notification.gameTime);
            const notifyTime = new Date(notification.notifyAt);
            const gameTimeStr = gameTime.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
            const notifyTimeStr = notifyTime.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
            const sportEmoji = notification.sport === 'shl' ? '🏒' : notification.sport === 'olympics-hockey' ? '🥇' : notification.sport === 'allsvenskan' ? '⚽' : '🎯';
            
            console.log(`[PreGameWatcher]   ${sportEmoji} ${notification.name}`);
            console.log(`[PreGameWatcher]      Game: ${gameTimeStr} | Notify: ${notifyTimeStr} | ${notification.venue || 'TBA'}`);
        }
    }
    console.log(`[PreGameWatcher] ==========================================`);
    console.log(`[PreGameWatcher] Total: ${totalScheduled} notifications scheduled`);
    console.log(`========================================\n`);

    return { totalScheduled };
}

/**
 * Calculate milliseconds until next schedule time
 * @returns {number} Milliseconds until next schedule run
 */
function getMsUntilNextSchedule() {
    const now = new Date();
    
    // Get current time in Stockholm timezone
    const stockholmTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
    const currentHour = stockholmTime.getHours();
    const currentMinutes = stockholmTime.getMinutes();
    
    // Calculate next schedule time
    let hoursUntilSchedule;
    if (currentHour < DAILY_SCHEDULE_HOUR) {
        // Schedule is later today
        hoursUntilSchedule = DAILY_SCHEDULE_HOUR - currentHour;
    } else {
        // Schedule is tomorrow
        hoursUntilSchedule = (24 - currentHour) + DAILY_SCHEDULE_HOUR;
    }

    // Convert to milliseconds, subtracting current minutes
    const msUntilSchedule = (hoursUntilSchedule * 60 - currentMinutes) * 60 * 1000;
    
    return msUntilSchedule;
}

/**
 * Schedule the next daily run
 */
function scheduleNextDailyRun() {
    const msUntilNext = getMsUntilNextSchedule();
    const nextRun = new Date(Date.now() + msUntilNext);
    
    stats.nextScheduleRun = nextRun.toISOString();
    console.log(`[PreGameWatcher] Next daily schedule at ${nextRun.toISOString()} (${Math.round(msUntilNext / 60000)} minutes)`);

    dailyScheduleTimer = setTimeout(async () => {
        if (!isRunning) {
            return;
        }
        await runDailySchedule();
        scheduleNextDailyRun();
    }, msUntilNext);
}

// ============ PUBLIC API ============

/**
 * Run the daily schedule immediately (for manual triggering or initial run)
 */
async function runCheck() {
    return await runDailySchedule();
}

/**
 * Start the pre-game watcher
 */
function startLoop() {
    if (isRunning) {
        console.log('[PreGameWatcher] Already running');
        return;
    }

    isRunning = true;
    loadSeenNotifications();
    
    console.log('[PreGameWatcher] Starting pre-game notification scheduler...');
    console.log(`[PreGameWatcher] Sports: Hockey (SHL), Olympics Hockey, Football (Allsvenskan), Biathlon`);
    console.log(`[PreGameWatcher] Reminder time: ${PRE_GAME_REMINDER_MINUTES} minutes before start`);
    console.log(`[PreGameWatcher] Daily schedule time: ${DAILY_SCHEDULE_HOUR}:00 (Stockholm time)`);

    // Run initial schedule after a short delay (to let other services start)
    setTimeout(async () => {
        if (!isRunning) {
            return;
        }
        console.log('[PreGameWatcher] Running initial schedule...');
        await runDailySchedule();
        scheduleNextDailyRun();
    }, 5000);
}

/**
 * Stop the pre-game watcher
 */
function stopLoop() {
    isRunning = false;
    
    if (dailyScheduleTimer) {
        clearTimeout(dailyScheduleTimer);
        dailyScheduleTimer = null;
    }
    
    cancelAllScheduled();
    console.log('[PreGameWatcher] Stopped');
}

/**
 * Get current stats
 */
function getStats() {
    const scheduled = Array.from(scheduledNotifications.entries()).map(([gameId, data]) => ({
        gameId,
        sport: data.gameInfo.sport,
        name: data.gameInfo.eventName || `${data.gameInfo.homeTeamName} vs ${data.gameInfo.awayTeamName}`,
        scheduledFor: data.scheduledFor
    }));

    return {
        running: isRunning,
        lastScheduleRun: stats.lastScheduleRun,
        nextScheduleRun: stats.nextScheduleRun,
        scheduledCount: scheduledNotifications.size,
        totalNotificationsSent: stats.totalNotificationsSent,
        seenNotificationsCount: seenPreGameNotifications.size,
        scheduledNotifications: scheduled,
        config: {
            reminderMinutes: PRE_GAME_REMINDER_MINUTES,
            dailyScheduleHour: DAILY_SCHEDULE_HOUR
        }
    };
}

module.exports = {
    runCheck,
    startLoop,
    stopLoop,
    getStats
};
