/**
 * Scheduler Module
 *
 * Handles periodic background tasks like:
 * - Refreshing biathlon schedule data
 * - Future: Any other scheduled updates
 */

const { BIATHLON_CHECK_INTERVAL } = require('./config');
const { getProvider } = require('./providers');
const { setCachedBiathlon, getBiathlonLastUpdate } = require('./cache');
const { formatSwedishTimestamp } = require('./utils');

// ============ SCHEDULER STATE ============
let stats = {
    isRunning: false,
    biathlonLastCheck: null,
    biathlonCheckCount: 0,
    errors: []
};

/**
 * Refresh biathlon schedule data
 * This fetches the latest schedule and caches it
 */
async function refreshBiathlonSchedule() {
    console.log(`[Scheduler] Refreshing biathlon schedule at ${formatSwedishTimestamp()}...`);

    try {
        const provider = getProvider('biathlon');
        const races = await provider.fetchAllGames();

        if (races && races.length > 0) {
            setCachedBiathlon(races);
            stats.biathlonLastCheck = formatSwedishTimestamp();
            stats.biathlonCheckCount++;

            // Count upcoming vs past races
            const now = new Date();
            const upcoming = races.filter(r => new Date(r.startDateTime) >= now);
            const completed = races.filter(r => r.state === 'completed');

            console.log(`[Scheduler] Biathlon schedule refreshed: ${races.length} total races (${upcoming.length} upcoming, ${completed.length} completed)`);
        }

        return races;
    } catch (error) {
        console.error('[Scheduler] Error refreshing biathlon schedule:', error.message);
        stats.errors.push({
            type: 'biathlon',
            message: error.message,
            timestamp: formatSwedishTimestamp()
        });

        // Keep only last 10 errors
        if (stats.errors.length > 10) {
            stats.errors = stats.errors.slice(-10);
        }

        return null;
    }
}

/**
 * Validate biathlon schedule data
 * Checks for any anomalies like missing dates, duplicates, etc.
 */
function validateBiathlonSchedule(races) {
    const issues = [];
    const seenIds = new Set();

    for (const race of races) {
        // Check for duplicate IDs
        if (seenIds.has(race.uuid)) {
            issues.push(`Duplicate race ID: ${race.uuid}`);
        }
        seenIds.add(race.uuid);

        // Check for valid date
        const date = new Date(race.startDateTime);
        if (isNaN(date.getTime())) {
            issues.push(`Invalid date for race: ${race.uuid}`);
        }

        // Check for required fields
        if (!race.discipline) {
            issues.push(`Missing discipline for race: ${race.uuid}`);
        }
        if (!race.location) {
            issues.push(`Missing location for race: ${race.uuid}`);
        }
    }

    return {
        valid: issues.length === 0,
        issues,
        totalRaces: races.length
    };
}

/**
 * Start the scheduler loop
 */
function startLoop() {
    stats.isRunning = true;
    console.log('[Scheduler] Starting background scheduler...');
    console.log(`[Scheduler] Biathlon check interval: ${BIATHLON_CHECK_INTERVAL / 1000 / 60} minutes`);

    // Initial refresh on startup
    refreshBiathlonSchedule();

    // Set up periodic refresh
    const biathlonLoop = async () => {
        await refreshBiathlonSchedule();
        setTimeout(biathlonLoop, BIATHLON_CHECK_INTERVAL);
    };

    // Start after initial interval
    setTimeout(biathlonLoop, BIATHLON_CHECK_INTERVAL);
}

/**
 * Get scheduler statistics
 */
function getStats() {
    return {
        running: stats.isRunning,
        biathlon: {
            lastCheck: stats.biathlonLastCheck,
            checkCount: stats.biathlonCheckCount,
            checkInterval: `${BIATHLON_CHECK_INTERVAL / 1000 / 60} minutes`,
            cacheLastUpdate: getBiathlonLastUpdate()
        },
        recentErrors: stats.errors.slice(-5)
    };
}

/**
 * Force an immediate biathlon schedule refresh
 */
async function forceRefreshBiathlon() {
    console.log('[Scheduler] Manual biathlon refresh triggered');
    return await refreshBiathlonSchedule();
}

module.exports = {
    startLoop,
    getStats,
    forceRefreshBiathlon,
    refreshBiathlonSchedule,
    validateBiathlonSchedule
};
