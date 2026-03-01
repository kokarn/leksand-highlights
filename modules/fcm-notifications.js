const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { formatSwedishTimestamp } = require('./utils');

/**
 * Sanitize a string for use as an FCM topic name.
 * FCM topics can only contain alphanumeric characters, underscores, and hyphens.
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized topic-safe string
 */
function sanitizeTopicName(str) {
    if (!str) {
        return 'unknown';
    }
    // Normalize Swedish characters to ASCII equivalents
    const normalized = str
        .toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/å/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/é/g, 'e')
        .replace(/ü/g, 'u');
    // Remove any remaining non-alphanumeric characters (except underscore and hyphen)
    return normalized.replace(/[^a-z0-9_-]/g, '');
}

/**
 * Normalize sport identifiers for deep links
 * @param {string} sport - Sport identifier
 * @returns {string} Normalized sport key
 */
function normalizeSportForDeepLink(sport) {
    const normalized = String(sport || '').toLowerCase();
    if (!normalized) {
        return 'shl';
    }
    if (normalized === 'football') {
        return 'allsvenskan';
    }
    return normalized;
}

/**
 * Build in-app deep link for game notifications
 * @param {string} sport - Sport identifier
 * @param {string} gameId - Game identifier
 * @param {string|null} tab - Optional tab name
 * @returns {string} Deep link URL
 */
function buildGameDeepLink(sport, gameId, tab = null) {
    const safeSport = encodeURIComponent(normalizeSportForDeepLink(sport));
    const safeGameId = encodeURIComponent(String(gameId || ''));
    const tabQuery = tab ? `?tab=${encodeURIComponent(String(tab))}` : '';
    return `gamepulse://game/${safeSport}/${safeGameId}${tabQuery}`;
}

// ============ FIREBASE CONFIGURATION ============
// Set GOOGLE_APPLICATION_CREDENTIALS env var to path of service account JSON
// Or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY individually
let firebaseApp = null;

// ============ ERROR LOGGING ============
const ERROR_LOG_PATH = path.join(__dirname, '..', 'fcm_errors.json');
const MAX_ERROR_LOG_ENTRIES = 100;

let errorLog = [];

/**
 * Load error log from file
 */
function loadErrorLog() {
    try {
        if (fs.existsSync(ERROR_LOG_PATH)) {
            const data = fs.readFileSync(ERROR_LOG_PATH, 'utf8');
            errorLog = JSON.parse(data);
            if (!Array.isArray(errorLog)) {
                errorLog = [];
            }
            console.log(`[FCM] Loaded ${errorLog.length} error log entries`);
        }
    } catch (error) {
        console.error('[FCM] Error loading error log:', error.message);
        errorLog = [];
    }
}

/**
 * Save error log to file
 */
function saveErrorLog() {
    try {
        fs.writeFileSync(ERROR_LOG_PATH, JSON.stringify(errorLog, null, 2), 'utf8');
    } catch (error) {
        console.error('[FCM] Error saving error log:', error.message);
    }
}

/**
 * Log an FCM error
 * @param {string} operation - The operation that failed (e.g., 'sendToTopic', 'sendToDevice')
 * @param {string} errorMessage - The error message
 * @param {Object} context - Additional context about the error
 */
function logError(operation, errorMessage, context = {}) {
    const entry = {
        timestamp: formatSwedishTimestamp(),
        operation,
        error: errorMessage,
        context
    };

    errorLog.unshift(entry);

    // Keep only the most recent entries
    if (errorLog.length > MAX_ERROR_LOG_ENTRIES) {
        errorLog = errorLog.slice(0, MAX_ERROR_LOG_ENTRIES);
    }

    saveErrorLog();
}

/**
 * Get error log entries
 * @param {number} limit - Maximum number of entries to return (default: 50)
 */
function getErrorLog(limit = 50) {
    return {
        errors: errorLog.slice(0, limit),
        totalErrors: errorLog.length,
        maxEntries: MAX_ERROR_LOG_ENTRIES
    };
}

/**
 * Clear error log
 */
function clearErrorLog() {
    errorLog = [];
    saveErrorLog();
    return { success: true, message: 'Error log cleared' };
}

// Load error log on module initialization
loadErrorLog();

// ============ SUBSCRIBER TRACKING ============
// Note: FCM does not provide an API to list topic subscribers.
// This in-memory tracking is session-only and resets on restart.
// For persistent tracking, use Firebase Realtime Database or Firestore.

// In-memory store for subscribers and their topics (session-only)
let subscribersData = {
    subscribers: {},  // token -> { topics: [], registeredAt, lastSeen, platform }
    topicStats: {},   // topic -> { subscriberCount, lastUpdated }
    stats: {
        totalSubscribers: 0,
        totalTopicSubscriptions: 0,
        lastUpdated: null
    },
    sessionStart: formatSwedishTimestamp()
};

// ============ STATS ============
let stats = {
    notificationsSent: 0,
    errors: 0,
    lastSent: null
};

// ============ INITIALIZATION ============

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
    if (firebaseApp) {
        return true;
    }

    try {
        // Check for service account file path
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[FCM] Initialized with service account file');
            return true;
        }

        // Check for individual environment variables
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (projectId && clientEmail && privateKey) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
            console.log('[FCM] Initialized with environment variables');
            return true;
        }

        console.warn('[FCM] Not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        return false;
    } catch (error) {
        console.error('[FCM] Initialization error:', error.message);
        return false;
    }
}

/**
 * Update in-memory subscriber stats (session-only, no persistence)
 * FCM does not provide an API to query topic subscribers, so we track
 * what we see during this server session only.
 */
function updateSubscriberStats() {
    subscribersData.stats.lastUpdated = formatSwedishTimestamp();
    subscribersData.stats.totalSubscribers = Object.keys(subscribersData.subscribers).length;
    subscribersData.stats.totalTopicSubscriptions = Object.values(subscribersData.subscribers)
        .reduce((sum, sub) => sum + (sub.topics?.length || 0), 0);
}

/**
 * Update topic stats
 */
function updateTopicStats() {
    const topicCounts = {};
    
    for (const subscriber of Object.values(subscribersData.subscribers)) {
        for (const topic of (subscriber.topics || [])) {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
    }

    for (const [topic, count] of Object.entries(topicCounts)) {
        subscribersData.topicStats[topic] = {
            subscriberCount: count,
            lastUpdated: formatSwedishTimestamp()
        };
    }

    // Remove topics with no subscribers
    for (const topic of Object.keys(subscribersData.topicStats)) {
        if (!topicCounts[topic]) {
            delete subscribersData.topicStats[topic];
        }
    }
}

// Note: No persistent storage - subscriber tracking is session-only
console.log('[FCM] Subscriber tracking is session-only (no persistent storage)');

// ============ PUBLIC API ============

/**
 * Check if FCM is properly configured
 */
function isConfigured() {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return Boolean(firebaseApp);
}

/**
 * Register a device token and subscribe to topics
 * @param {string} token - FCM device token
 * @param {string[]} topics - Topics to subscribe to
 * @param {Object} metadata - Optional metadata (platform, etc.)
 */
async function registerDevice(token, topics = [], metadata = {}) {
    if (!isConfigured()) {
        return { success: false, error: 'FCM not configured' };
    }

    try {
        const now = formatSwedishTimestamp();
        const existingSubscriber = subscribersData.subscribers[token];
        const oldTopics = existingSubscriber?.topics || [];

        // Calculate topics to add and remove
        const topicsToAdd = topics.filter(t => !oldTopics.includes(t));
        const topicsToRemove = oldTopics.filter(t => !topics.includes(t));

        // Subscribe to new topics
        for (const topic of topicsToAdd) {
            try {
                await admin.messaging().subscribeToTopic([token], topic);
                console.log(`[FCM] Subscribed ${token.slice(-8)} to topic: ${topic}`);
            } catch (error) {
                console.error(`[FCM] Error subscribing to topic ${topic}:`, error.message);
            }
        }

        // Unsubscribe from removed topics
        for (const topic of topicsToRemove) {
            try {
                await admin.messaging().unsubscribeFromTopic([token], topic);
                console.log(`[FCM] Unsubscribed ${token.slice(-8)} from topic: ${topic}`);
            } catch (error) {
                console.error(`[FCM] Error unsubscribing from topic ${topic}:`, error.message);
            }
        }

        // Update subscriber data
        subscribersData.subscribers[token] = {
            topics,
            registeredAt: existingSubscriber?.registeredAt || now,
            lastSeen: now,
            platform: metadata.platform || existingSubscriber?.platform || 'unknown'
        };

        updateTopicStats();
        updateSubscriberStats();

        return {
            success: true,
            topicsAdded: topicsToAdd,
            topicsRemoved: topicsToRemove,
            totalTopics: topics.length
        };
    } catch (error) {
        console.error('[FCM] Error registering device:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Unregister a device
 * @param {string} token - FCM device token
 */
async function unregisterDevice(token) {
    if (!isConfigured()) {
        return { success: false, error: 'FCM not configured' };
    }

    try {
        const subscriber = subscribersData.subscribers[token];
        if (!subscriber) {
            return { success: true, message: 'Device not found' };
        }

        // Unsubscribe from all topics
        for (const topic of (subscriber.topics || [])) {
            try {
                await admin.messaging().unsubscribeFromTopic([token], topic);
            } catch (error) {
                console.error(`[FCM] Error unsubscribing from topic ${topic}:`, error.message);
            }
        }

        delete subscribersData.subscribers[token];
        updateTopicStats();
        updateSubscriberStats();

        return { success: true };
    } catch (error) {
        console.error('[FCM] Error unregistering device:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send a notification to a topic
 * @param {Object} options - Notification options
 * @param {string} options.topic - Topic to send to
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 */
async function sendToTopic({ topic, title, body, data = {} }) {
    if (!isConfigured()) {
        console.warn('[FCM] Not configured. Cannot send notification.');
        return { success: false, error: 'Not configured' };
    }

    const message = {
        topic,
        notification: {
            title,
            body
        },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
            priority: 'high',
            notification: {
                channelId: 'goals',
                priority: 'high',
                defaultSound: true
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        stats.notificationsSent++;
        stats.lastSent = formatSwedishTimestamp();
        console.log(`[FCM] Sent notification to topic "${topic}": "${title}"`);
        return { success: true, messageId: response };
    } catch (error) {
        stats.errors++;
        console.error('[FCM] Error sending to topic:', error.message);
        logError('sendToTopic', error.message, { topic, title, body });
        return { success: false, error: error.message };
    }
}

/**
 * Send a notification to multiple topics (OR logic)
 * @param {Object} options - Notification options
 * @param {string[]} options.topics - Topics to send to
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 */
async function sendToTopics({ topics, title, body, data = {} }) {
    if (!isConfigured()) {
        console.warn('[FCM] Not configured. Cannot send notification.');
        return { success: false, error: 'Not configured' };
    }

    if (!topics || topics.length === 0) {
        return { success: false, error: 'No topics specified' };
    }

    // For a single topic, use simple topic messaging
    if (topics.length === 1) {
        return sendToTopic({ topic: topics[0], title, body, data });
    }

    // For multiple topics, use condition (OR logic)
    // FCM condition: "'topic1' in topics || 'topic2' in topics"
    const condition = topics.map(t => `'${t}' in topics`).join(' || ');

    const message = {
        condition,
        notification: {
            title,
            body
        },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
            priority: 'high',
            notification: {
                channelId: 'goals',
                priority: 'high',
                defaultSound: true
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        stats.notificationsSent++;
        stats.lastSent = formatSwedishTimestamp();
        console.log(`[FCM] Sent notification to topics [${topics.join(', ')}]: "${title}"`);
        return { success: true, messageId: response };
    } catch (error) {
        stats.errors++;
        console.error('[FCM] Error sending to topics:', error.message);
        logError('sendToTopics', error.message, { topics, title, body });
        return { success: false, error: error.message };
    }
}

/**
 * Send a notification to a specific device token
 * @param {Object} options - Notification options
 * @param {string} options.token - Device token
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 */
async function sendToDevice({ token, title, body, data = {} }) {
    if (!isConfigured()) {
        console.warn('[FCM] Not configured. Cannot send notification.');
        return { success: false, error: 'Not configured' };
    }

    const message = {
        token,
        notification: {
            title,
            body
        },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
            priority: 'high',
            notification: {
                channelId: 'goals',
                priority: 'high',
                defaultSound: true
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        stats.notificationsSent++;
        stats.lastSent = formatSwedishTimestamp();
        console.log(`[FCM] Sent notification to device: "${title}"`);
        return { success: true, messageId: response };
    } catch (error) {
        stats.errors++;
        console.error('[FCM] Error sending to device:', error.message);
        logError('sendToDevice', error.message, { tokenPreview: `...${token.slice(-8)}`, title, body });
        return { success: false, error: error.message };
    }
}

/**
 * Send a goal notification
 * @param {Object} goal - Goal details
 * @param {Object} options - Options
 */
async function sendGoalNotification(goal, options = {}) {
    const {
        token = null,
        sendOpposing = !token
    } = options;

    const {
        sport,
        gameId,
        scorerName,
        scoringTeamCode,
        scoringTeamName,
        homeTeamCode,
        awayTeamCode,
        homeScore,
        awayScore,
        time,
        period
    } = goal;

    const normalizedSport = normalizeSportForDeepLink(sport);

    // Build notification content
    let sportEmoji = '🏒';
    let sportLabel = 'SHL';
    if (normalizedSport === 'allsvenskan') {
        sportEmoji = '⚽';
        sportLabel = 'Allsvenskan';
    } else if (normalizedSport === 'svenska-cupen') {
        sportEmoji = '🏆';
        sportLabel = 'Svenska Cupen';
    }
    const title = `${sportEmoji} ${sportLabel} Goal: ${scoringTeamName}`;

    let message = `${scorerName} scores!`;
    if (homeScore !== undefined && awayScore !== undefined) {
        message += ` ${homeScore}-${awayScore}`;
    }
    if (time) {
        message += ` (${time}`;
        if (period) {
            message += ` ${period}`;
        }
        message += ')';
    }

    // Build deep link URL
    const deepLinkUrl = buildGameDeepLink(normalizedSport, gameId, 'summary');

    const data = {
        type: 'goal',
        sport: normalizedSport,
        gameId,
        scoringTeam: scoringTeamCode,
        homeTeam: homeTeamCode,
        awayTeam: awayTeamCode,
        homeScore: String(homeScore),
        awayScore: String(awayScore),
        tab: 'summary',
        url: deepLinkUrl
    };

    let result;

    if (token) {
        // Send to specific device
        result = await sendToDevice({ token, title, body: message, data });
    } else {
        // Goal alerts should reach users following either team in this game.
        // When sendOpposing is disabled (e.g. in certain tests), only target the scoring team.
        const teamCodesToTarget = sendOpposing
            ? [homeTeamCode, awayTeamCode, scoringTeamCode]
            : [scoringTeamCode];

        const teamTopics = [...new Set(
            teamCodesToTarget
                .filter(code => Boolean(code))
                .map(code => sanitizeTopicName(code))
                .filter(code => code && code !== 'unknown')
                .map(code => `team_${code}`)
        )];

        if (teamTopics.length === 0) {
            return { success: false, error: 'Missing team topics for goal notification targeting' };
        }

        const teamsCondition = teamTopics.length === 1
            ? `'${teamTopics[0]}' in topics`
            : `(${teamTopics.map(topic => `'${topic}' in topics`).join(' || ')})`;
        const condition = `'goal_notifications' in topics && ${teamsCondition}`;

        console.log(`[FCM] Sending goal notification to: ${condition}`);
        
        result = await sendWithCondition({
            condition,
            title,
            body: message,
            data
        });
    }

    return result;
}

/**
 * Send a highlight notification
 * @param {Object} highlight - Highlight details
 * @param {Object} options - Options
 */
async function sendHighlightNotification(highlight, options = {}) {
    const { token = null } = options;
    const {
        sport = 'shl',
        gameId,
        videoId = '',
        clipTitle = '',
        homeTeamCode = '',
        awayTeamCode = '',
        homeTeamName = 'Home',
        awayTeamName = 'Away'
    } = highlight || {};

    if (!gameId) {
        return { success: false, error: 'gameId is required' };
    }

    const normalizedSport = normalizeSportForDeepLink(sport);
    const safeClipTitle = String(clipTitle || '').trim();
    const title = `🎬 New Highlight: ${homeTeamName} vs ${awayTeamName}`;
    const body = safeClipTitle
        ? safeClipTitle
        : `A new highlight clip is available from ${homeTeamName} vs ${awayTeamName}`;
    const deepLinkUrl = buildGameDeepLink(normalizedSport, gameId, 'highlights');

    const data = {
        type: 'highlight',
        sport: normalizedSport,
        gameId,
        videoId: String(videoId || ''),
        homeTeam: String(homeTeamCode || ''),
        awayTeam: String(awayTeamCode || ''),
        tab: 'highlights',
        url: deepLinkUrl
    };

    if (token) {
        return sendToDevice({ token, title, body, data });
    }

    const teamTopics = [homeTeamCode, awayTeamCode]
        .filter(Boolean)
        .map(code => `team_${sanitizeTopicName(code)}`);
    const uniqueTeamTopics = [...new Set(teamTopics)];

    if (uniqueTeamTopics.length === 0) {
        console.warn('[FCM] Highlight notification skipped - missing team topics');
        return { success: false, error: 'Missing team codes for highlight targeting' };
    }

    const teamsCondition = uniqueTeamTopics.map(topic => `'${topic}' in topics`).join(' || ');
    const condition = `'goal_notifications' in topics && (${teamsCondition})`;

    console.log(`[FCM] Sending highlight notification to: ${condition}`);

    return sendWithCondition({
        condition,
        title,
        body,
        data
    });
}

/**
 * Send a notification with a condition
 * @param {Object} options - Notification options
 * @param {string} options.condition - FCM condition string
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Additional data payload
 */
async function sendWithCondition({ condition, title, body, data = {} }) {
    if (!isConfigured()) {
        console.warn('[FCM] Not configured. Cannot send notification.');
        return { success: false, error: 'Not configured' };
    }

    const message = {
        condition,
        notification: {
            title,
            body
        },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
            priority: 'high',
            notification: {
                channelId: 'goals',
                priority: 'high',
                defaultSound: true
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        stats.notificationsSent++;
        stats.lastSent = formatSwedishTimestamp();
        console.log(`[FCM] Sent notification with condition: "${title}"`);
        return { success: true, messageId: response };
    } catch (error) {
        stats.errors++;
        console.error('[FCM] Error sending with condition:', error.message);
        logError('sendWithCondition', error.message, { condition, title, body });
        return { success: false, error: error.message };
    }
}

/**
 * Send a pre-game reminder notification
 * @param {Object} gameInfo - Game information
 */
async function sendPreGameNotification(gameInfo) {
    const {
        sport,
        gameId,
        homeTeamName,
        awayTeamName,
        homeTeamCode,
        awayTeamCode,
        eventName,
        venue,
        minutesUntilStart = 5
    } = gameInfo;

    let title, message, sportEmoji, preGameTopic;

    if (sport === 'shl') {
        sportEmoji = '🏒';
        preGameTopic = 'pre_game_shl';
        title = `${sportEmoji} SHL Starting Soon`;
        message = `${homeTeamName} vs ${awayTeamName}`;
        if (venue) {
            message += ` at ${venue}`;
        }
        message += ` - starts in ${minutesUntilStart} minutes!`;
    } else if (sport === 'allsvenskan') {
        sportEmoji = '⚽';
        preGameTopic = 'pre_game_football';
        title = `${sportEmoji} Allsvenskan Starting Soon`;
        message = `${homeTeamName} vs ${awayTeamName}`;
        if (venue) {
            message += ` at ${venue}`;
        }
        message += ` - kicks off in ${minutesUntilStart} minutes!`;
    } else if (sport === 'svenska-cupen') {
        sportEmoji = '🏆';
        preGameTopic = 'pre_game_football';
        title = `${sportEmoji} Svenska Cupen Starting Soon`;
        message = `${homeTeamName} vs ${awayTeamName}`;
        if (venue) {
            message += ` at ${venue}`;
        }
        message += ` - kicks off in ${minutesUntilStart} minutes!`;
    } else if (sport === 'biathlon') {
        sportEmoji = '🎯';
        preGameTopic = 'pre_game_biathlon';
        title = `${sportEmoji} Biathlon Starting Soon`;
        message = eventName || 'Race';
        if (venue) {
            message += ` in ${venue}`;
        }
        message += ` - starts in ${minutesUntilStart} minutes!`;
    } else {
        console.warn(`[FCM] Unknown sport for pre-game notification: ${sport}`);
        return { success: false, error: 'Unknown sport' };
    }

    const deepLinkUrl = buildGameDeepLink(sport, gameId, 'summary');

    const data = {
        type: 'pre_game',
        sport,
        gameId,
        homeTeam: homeTeamCode || '',
        awayTeam: awayTeamCode || '',
        tab: 'summary',
        url: deepLinkUrl
    };

    // For team sports, send to users following either team with pre-game enabled
    if ((sport === 'shl' || sport === 'allsvenskan' || sport === 'svenska-cupen') && homeTeamCode && awayTeamCode) {
        const homeTeamTopic = `team_${sanitizeTopicName(homeTeamCode)}`;
        const awayTeamTopic = `team_${sanitizeTopicName(awayTeamCode)}`;
        
        // Condition: pre_game AND (home_team OR away_team)
        const condition = `'${preGameTopic}' in topics && ('${homeTeamTopic}' in topics || '${awayTeamTopic}' in topics)`;
        
        console.log(`[FCM] Sending pre-game notification for ${sport}: ${message}`);
        return sendWithCondition({ condition, title, body: message, data });
    } else {
        // For biathlon, just use the pre-game topic
        console.log(`[FCM] Sending pre-game notification for ${sport}: ${message}`);
        return sendToTopic({ topic: preGameTopic, title, body: message, data });
    }
}

/**
 * Send a test notification
 * @param {Object} options - Options
 * @param {string} options.message - Custom message
 * @param {string} options.token - Optional device token
 */
async function sendTestNotification(options = {}) {
    const { message = 'This is a test notification from GamePulse!', token = null } = 
        typeof options === 'string' ? { message: options } : options;

    const title = '🔔 GamePulse Test';
    const data = { type: 'test' };

    if (token) {
        return sendToDevice({ token, title, body: message, data });
    }

    // Send to goal_notifications topic
    return sendToTopic({ topic: 'goal_notifications', title, body: message, data });
}

/**
 * Get notification stats
 */
function getStats() {
    return {
        configured: isConfigured(),
        notificationsSent: stats.notificationsSent,
        errors: stats.errors,
        lastSent: stats.lastSent
    };
}

/**
 * Get subscriber stats for admin dashboard
 * Note: This is session-only tracking. FCM does not provide an API to query
 * topic subscribers, so we can only track devices that register during this session.
 */
function getSubscriberStats() {
    const subscribers = Object.entries(subscribersData.subscribers).map(([token, data]) => ({
        tokenPreview: `...${token.slice(-12)}`,
        topics: data.topics || [],
        topicCount: (data.topics || []).length,
        platform: data.platform || 'unknown',
        registeredAt: data.registeredAt,
        lastSeen: data.lastSeen
    }));

    const topicList = Object.entries(subscribersData.topicStats)
        .map(([topic, stats]) => ({
            topic,
            subscriberCount: stats.subscriberCount,
            lastUpdated: stats.lastUpdated
        }))
        .sort((a, b) => b.subscriberCount - a.subscriberCount);

    return {
        totalSubscribers: Object.keys(subscribersData.subscribers).length,
        totalTopicSubscriptions: subscribersData.stats.totalTopicSubscriptions,
        lastUpdated: subscribersData.stats.lastUpdated,
        sessionStart: subscribersData.sessionStart,
        subscribers,
        topics: topicList,
        isSessionOnly: true,
        trackingNote: 'FCM does not provide an API to query topic subscribers. This shows devices that registered during this server session only. Actual FCM topic subscribers are managed by Firebase and notifications will reach all subscribed devices.'
    };
}

/**
 * Get topic details
 * @param {string} topicName - Topic name
 */
function getTopicDetails(topicName) {
    const subscribers = Object.entries(subscribersData.subscribers)
        .filter(([_, data]) => (data.topics || []).includes(topicName))
        .map(([token, data]) => ({
            tokenPreview: `...${token.slice(-12)}`,
            platform: data.platform || 'unknown',
            registeredAt: data.registeredAt,
            lastSeen: data.lastSeen
        }));

    return {
        topic: topicName,
        subscriberCount: subscribers.length,
        subscribers
    };
}

module.exports = {
    isConfigured,
    registerDevice,
    unregisterDevice,
    sendToTopic,
    sendToTopics,
    sendToDevice,
    sendWithCondition,
    sendGoalNotification,
    sendHighlightNotification,
    sendPreGameNotification,
    sendTestNotification,
    getStats,
    getSubscriberStats,
    getTopicDetails,
    getErrorLog,
    clearErrorLog
};
