const path = require('path');

// ============ SERVER CONFIGURATION ============
const PORT = process.env.PORT || 3080;

// ============ CACHE DURATIONS (milliseconds) ============
const CACHE_DURATION_LIVE = 15 * 1000;      // 15 seconds when live games exist
const CACHE_DURATION_NORMAL = 60 * 1000;    // 1 minute otherwise
const CACHE_DURATION_DETAILS = 30 * 1000;   // 30 seconds for game details
const CACHE_DURATION_VIDEOS = 60 * 1000;    // 1 minute for videos

// ============ NOTIFIER CONFIGURATION ============
const SEEN_GAMES_FILE = path.join(__dirname, '..', 'seen_games.json');
const SEEN_VIDEOS_FILE = path.join(__dirname, '..', 'seen_videos.json');
const ADMIN_GAMES_FILE = path.join(__dirname, '..', 'admin_games.json');
const HIGHLIGHTS_TOPIC_PREFIX = 'shl-highlights-';
const TEAM_ALL_TOPIC_PREFIX = 'shl-all-';
const GLOBAL_ALL_TOPIC = 'shl-all-videos';
const MAX_HOURS_SINCE_GAME = 36;

// ============ NOTIFIER INTERVALS (milliseconds) ============
const NOTIFIER_INTERVAL_NORMAL = 5 * 60 * 1000;  // 5 minutes
const NOTIFIER_INTERVAL_LIVE = 30 * 1000;        // 30 seconds

module.exports = {
    // Server
    PORT,

    // Cache durations
    CACHE_DURATION_LIVE,
    CACHE_DURATION_NORMAL,
    CACHE_DURATION_DETAILS,
    CACHE_DURATION_VIDEOS,

    // Notifier
    SEEN_GAMES_FILE,
    SEEN_VIDEOS_FILE,
    ADMIN_GAMES_FILE,
    HIGHLIGHTS_TOPIC_PREFIX,
    TEAM_ALL_TOPIC_PREFIX,
    GLOBAL_ALL_TOPIC,
    MAX_HOURS_SINCE_GAME,
    NOTIFIER_INTERVAL_NORMAL,
    NOTIFIER_INTERVAL_LIVE
};
