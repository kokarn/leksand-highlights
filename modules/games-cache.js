/**
 * Shared cached game-list accessor.
 *
 * PROBLEM this solves: the expensive network fetch is `provider.fetchAllGames()`
 * (SHL schedule / full ESPN season / cup league). `fetchActiveGames()` calls it
 * directly with NO caching, and it was being called independently by the goal-watcher
 * (~10s while live), the notifier (~30s while live) AND the HTTP routes — so the same
 * season got refetched many times per minute, ×3 sports. That's wasteful and a
 * rate-limit/ban risk against shl.se and ESPN.
 *
 * FIX: route every consumer through getActiveGames(sport), which reads the same
 * per-sport cache slots the HTTP layer already uses (cache.js), fetching the full
 * list at most once per TTL window and sharing it across all callers. A watcher fetch
 * warms the route cache and vice versa. TTL is live-aware: 15s when a game is live or
 * starting soon, 60s otherwise (identical to the existing HTTP behaviour).
 */

const { getProvider } = require('./providers');
const {
    getCachedGames,
    setCachedGames,
    setGamesLiveFlag,
    getCachedAllsvenskanGames,
    setCachedAllsvenskanGames,
    setAllsvenskanLiveFlag,
    getCachedSvenskaCupenGames,
    setCachedSvenskaCupenGames,
    setSvenskaCupenLiveFlag,
    getCachedHockeyAllsvenskanGames,
    setCachedHockeyAllsvenskanGames,
    setHockeyAllsvenskanLiveFlag,
    getCachedEuropaLeagueQualGames,
    setCachedEuropaLeagueQualGames,
    setEuropaLeagueQualLiveFlag
} = require('./cache');

// How close to kickoff a pre-game counts as "starting soon" for fast-cache purposes.
// Mirrors server.js STARTING_SOON_WINDOW_MINUTES / RECENT_START_WINDOW_MINUTES.
const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENT_START_WINDOW_MINUTES = 90;

function isGameNearStart(game, now = new Date()) {
    if (!game || game.state === 'post-game') {
        return false;
    }
    const startTime = new Date(game.rawStartDateTime || game.startDateTime);
    if (Number.isNaN(startTime.getTime())) {
        return false;
    }
    const minutesFromStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    return minutesFromStart <= STARTING_SOON_WINDOW_MINUTES
        && minutesFromStart >= -RECENT_START_WINDOW_MINUTES;
}

function shouldUseFastGamesCache(games, now = new Date()) {
    return Array.isArray(games)
        && games.some(game => game.state === 'live' || isGameNearStart(game, now));
}

// Per-sport cache adapters. Only the sports that back the watchers are wired here;
// biathlon has its own dedicated cache/scheduler and is not polled per-goal.
const CACHE_ADAPTERS = {
    shl: {
        get: getCachedGames,
        set: setCachedGames,
        setLiveFlag: setGamesLiveFlag
    },
    allsvenskan: {
        get: getCachedAllsvenskanGames,
        set: setCachedAllsvenskanGames,
        setLiveFlag: setAllsvenskanLiveFlag
    },
    'svenska-cupen': {
        get: getCachedSvenskaCupenGames,
        set: setCachedSvenskaCupenGames,
        setLiveFlag: setSvenskaCupenLiveFlag
    },
    hockeyallsvenskan: {
        get: getCachedHockeyAllsvenskanGames,
        set: setCachedHockeyAllsvenskanGames,
        setLiveFlag: setHockeyAllsvenskanLiveFlag
    },
    'europa-league-qual': {
        get: getCachedEuropaLeagueQualGames,
        set: setCachedEuropaLeagueQualGames,
        setLiveFlag: setEuropaLeagueQualLiveFlag
    }
};

// Coalesce concurrent misses per sport: if two watchers miss at the same instant,
// they await the same in-flight fetch instead of both hitting the network.
const inFlight = new Map();

/**
 * Get the full games list for a sport, served from the shared cache when warm.
 * On a miss (or expiry) it fetches the season once, stores it with a live-aware TTL,
 * and returns it. Concurrent misses share one in-flight fetch.
 * @param {string} sport
 * @returns {Promise<Array>} full games list (may be empty on error)
 */
async function getAllGamesCached(sport) {
    const adapter = CACHE_ADAPTERS[sport];
    if (!adapter) {
        // Unknown/uncached sport: fall back to a direct fetch.
        const provider = getProvider(sport);
        return provider.fetchAllGames();
    }

    const cached = adapter.get();
    if (cached) {
        // Keep the live flag fresh so the TTL tracks current live state even on a hit.
        adapter.setLiveFlag(shouldUseFastGamesCache(cached));
        return cached;
    }

    if (inFlight.has(sport)) {
        return inFlight.get(sport);
    }

    const fetchPromise = (async () => {
        const provider = getProvider(sport);
        let games = [];
        try {
            games = await provider.fetchAllGames();
        } catch (error) {
            console.error(`[GamesCache] ${sport} fetchAllGames failed:`, error.message);
            return [];
        }
        if (!Array.isArray(games)) {
            games = [];
        }
        const fast = shouldUseFastGamesCache(games);
        adapter.set(games, fast);
        return games;
    })();

    inFlight.set(sport, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        inFlight.delete(sport);
    }
}

/**
 * Get the ACTIVE/recent games for a sport, served from the shared cache.
 * This is the drop-in replacement for `provider.fetchActiveGames()` in the watchers.
 * @param {string} sport
 * @returns {Promise<Array>} active games (filtered from the cached full list)
 */
async function getActiveGames(sport) {
    const provider = getProvider(sport);
    const allGames = await getAllGamesCached(sport);
    // Providers expose a pure filterActiveGames(); fall back to a direct call if a
    // provider somehow lacks it (keeps this safe against future providers).
    if (typeof provider.filterActiveGames === 'function') {
        return provider.filterActiveGames(allGames);
    }
    return provider.fetchActiveGames();
}

module.exports = {
    getActiveGames,
    getAllGamesCached,
    shouldUseFastGamesCache,
    isGameNearStart
};
