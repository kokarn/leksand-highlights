const {
    CACHE_DURATION_LIVE,
    CACHE_DURATION_NORMAL,
    CACHE_DURATION_DETAILS,
    CACHE_DURATION_VIDEOS,
    CACHE_DURATION_STANDINGS,
    CACHE_DURATION_BIATHLON
} = require('./config');

// ============ CACHE STORAGE ============
const cache = {
    games: { data: null, timestamp: 0, hasLive: false },
    details: new Map(),
    videos: new Map(),
    standings: { data: null, timestamp: 0 },
    biathlon: { data: null, timestamp: 0, lastUpdate: null }
};

// ============ CACHE HELPERS ============
function isCacheValid(cacheEntry, duration) {
    return cacheEntry && cacheEntry.data && (Date.now() - cacheEntry.timestamp) < duration;
}

function getGamesCacheDuration() {
    return cache.games.hasLive ? CACHE_DURATION_LIVE : CACHE_DURATION_NORMAL;
}

function setGamesLiveFlag(hasLive) {
    cache.games.hasLive = Boolean(hasLive);
}

function getCachedGames() {
    const duration = getGamesCacheDuration();
    if (isCacheValid(cache.games, duration)) {
        return cache.games.data;
    }
    return null;
}

function setCachedGames(data, hasLive = false) {
    cache.games = {
        data,
        timestamp: Date.now(),
        hasLive
    };
}

function getCachedDetails(uuid) {
    const cached = cache.details.get(uuid);
    if (isCacheValid(cached, CACHE_DURATION_DETAILS)) {
        return cached.data;
    }
    return null;
}

function setCachedDetails(uuid, data) {
    cache.details.set(uuid, { data, timestamp: Date.now() });
}

function getCachedVideos(uuid) {
    const cached = cache.videos.get(uuid);
    if (isCacheValid(cached, CACHE_DURATION_VIDEOS)) {
        return cached.data;
    }
    return null;
}

function setCachedVideos(uuid, data) {
    cache.videos.set(uuid, { data, timestamp: Date.now() });
}

// ============ STANDINGS CACHE ============
function getCachedStandings() {
    if (isCacheValid(cache.standings, CACHE_DURATION_STANDINGS)) {
        return cache.standings.data;
    }
    return null;
}

function setCachedStandings(data) {
    cache.standings = { data, timestamp: Date.now() };
}

// ============ BIATHLON CACHE ============
function getCachedBiathlon() {
    if (isCacheValid(cache.biathlon, CACHE_DURATION_BIATHLON)) {
        return cache.biathlon.data;
    }
    return null;
}

function setCachedBiathlon(data) {
    cache.biathlon = {
        data,
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString()
    };
}

function getBiathlonLastUpdate() {
    return cache.biathlon.lastUpdate;
}

function clearAllCaches() {
    cache.games = { data: null, timestamp: 0, hasLive: false };
    cache.details.clear();
    cache.videos.clear();
    cache.standings = { data: null, timestamp: 0 };
    cache.biathlon = { data: null, timestamp: 0, lastUpdate: null };
}

function getCacheStatus() {
    const now = Date.now();
    const gamesAge = cache.games.timestamp ? Math.round((now - cache.games.timestamp) / 1000) : null;
    const standingsAge = cache.standings.timestamp ? Math.round((now - cache.standings.timestamp) / 1000) : null;
    const biathlonAge = cache.biathlon.timestamp ? Math.round((now - cache.biathlon.timestamp) / 1000) : null;

    return {
        games: {
            cached: !!cache.games.data,
            ageSeconds: gamesAge,
            hasLiveGame: cache.games.hasLive,
            cacheDuration: cache.games.hasLive ? '15s (live mode)' : '60s (normal mode)'
        },
        details: {
            entriesCount: cache.details.size,
            cacheDuration: '30s'
        },
        videos: {
            entriesCount: cache.videos.size,
            cacheDuration: '60s'
        },
        standings: {
            cached: !!cache.standings.data,
            ageSeconds: standingsAge,
            cacheDuration: '5m'
        },
        biathlon: {
            cached: !!cache.biathlon.data,
            ageSeconds: biathlonAge,
            lastUpdate: cache.biathlon.lastUpdate,
            cacheDuration: '30m'
        }
    };
}

module.exports = {
    getCachedGames,
    setCachedGames,
    getCachedDetails,
    setCachedDetails,
    getCachedVideos,
    setCachedVideos,
    getCachedStandings,
    setCachedStandings,
    getCachedBiathlon,
    setCachedBiathlon,
    getBiathlonLastUpdate,
    clearAllCaches,
    getCacheStatus,
    getGamesCacheDuration,
    setGamesLiveFlag
};
