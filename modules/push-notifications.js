const { formatSwedishTimestamp } = require('./utils');

// ============ ONESIGNAL CONFIGURATION ============
// These should be set via environment variables
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

// ============ STATS ============
let stats = {
    notificationsSent: 0,
    errors: 0,
    lastSent: null
};

function normalizeIdArray(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value
            .map(entry => String(entry || '').trim())
            .filter(Boolean);
    }
    const trimmed = String(value).trim();
    return trimmed ? [trimmed] : [];
}

function normalizeTarget(target) {
    if (!target || typeof target !== 'object') {
        return null;
    }

    const subscriptionIds = normalizeIdArray(target.subscriptionIds || target.subscriptionId);
    const playerIds = normalizeIdArray(target.playerIds || target.playerId);
    const externalUserIds = normalizeIdArray(target.externalUserIds || target.externalUserId);
    const includeAll = Boolean(target.includeAll || target.sendToAll);

    if (!subscriptionIds.length && !playerIds.length && !externalUserIds.length && !includeAll) {
        return null;
    }

    return {
        subscriptionIds,
        playerIds,
        externalUserIds,
        includeAll
    };
}

/**
 * Check if OneSignal is properly configured
 * @returns {boolean} Whether OneSignal is configured
 */
function isConfigured() {
    return Boolean(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);
}

/**
 * Send a push notification via OneSignal REST API
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {Array} options.filters - OneSignal filters for targeting
 * @param {Object} options.target - Direct targeting options (subscriptionIds, playerIds, externalUserIds, includeAll)
 * @param {Object} options.data - Additional data to include (url field enables deep linking)
 * @returns {Promise<Object>} OneSignal API response
 */
async function sendNotification({ title, message, filters = [], target = null, data = {} }) {
    if (!isConfigured()) {
        console.warn('[PushNotifications] OneSignal not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables.');
        return { success: false, error: 'Not configured' };
    }

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message },
        data
    };

    // Add deep link URL if provided in data
    // This enables OneSignal to open the app with the specified URL
    if (data.url) {
        payload.url = data.url;
    }

    const normalizedTarget = normalizeTarget(target);

    if (normalizedTarget?.subscriptionIds?.length) {
        payload.include_subscription_ids = normalizedTarget.subscriptionIds;
    }

    if (normalizedTarget?.playerIds?.length) {
        payload.include_player_ids = normalizedTarget.playerIds;
    }

    if (normalizedTarget?.externalUserIds?.length) {
        payload.include_external_user_ids = normalizedTarget.externalUserIds;
    }

    const hasDirectTarget = Boolean(
        normalizedTarget?.subscriptionIds?.length
        || normalizedTarget?.playerIds?.length
        || normalizedTarget?.externalUserIds?.length
    );

    if (hasDirectTarget) {
        // Direct target overrides filters.
    } else if (normalizedTarget?.includeAll) {
        payload.included_segments = ['Subscribed Users'];
    } else if (filters.length > 0) {
        payload.filters = filters;
    } else {
        // Default: send to all subscribed users with goal_notifications tag
        payload.filters = [
            { field: 'tag', key: 'goal_notifications', relation: '=', value: 'true' }
        ];
    }

    try {
        const response = await fetch(ONESIGNAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            stats.notificationsSent++;
            stats.lastSent = formatSwedishTimestamp();
            console.log(`[PushNotifications] Sent notification: "${title}" to ${result.recipients || 0} recipients`);
            return { success: true, recipients: result.recipients, id: result.id };
        } else {
            stats.errors++;
            console.error('[PushNotifications] API error:', result);
            return { success: false, error: result.errors?.[0] || 'Unknown error' };
        }
    } catch (error) {
        stats.errors++;
        console.error('[PushNotifications] Error sending notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send a goal notification
 * @param {Object} goal - Goal details from goal-watcher
 * @returns {Promise<Object>} Send result
 */
async function sendGoalNotification(goal, options = {}) {
    const {
        target = null,
        sendOpposing = !target
    } = options;
    const {
        sport,
        gameId,
        scorerName,
        scoringTeamCode,
        scoringTeamName,
        opposingTeamName,
        homeTeamCode,
        awayTeamCode,
        homeScore,
        awayScore,
        time,
        period
    } = goal;

    // Build notification content
    const sportEmoji = sport === 'shl' ? '🏒' : '⚽';
    const sportLabel = sport === 'shl' ? 'SHL' : 'Allsvenskan';
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

    // Build deep link URL for opening the game in the app
    // Format: gamepulse://game/{sport}/{gameId}
    const deepLinkUrl = `gamepulse://game/${sport}/${gameId}`;

    // Filter to target users with goal_notifications enabled AND following the scoring team
    // Tag structure: goal_notifications='true', team_{code}='true' (e.g., team_lif, team_aik)
    const simpleFilters = [
        { field: 'tag', key: 'goal_notifications', relation: '=', value: 'true' },
        { operator: 'AND' },
        { field: 'tag', key: `team_${scoringTeamCode.toLowerCase()}`, relation: '=', value: 'true' }
    ];

    // Also send to users following the opposing team (they want to know too!)
    const data = {
        type: 'goal',
        sport,
        gameId,
        scoringTeam: scoringTeamCode,
        homeTeam: homeTeamCode,
        awayTeam: awayTeamCode,
        homeScore,
        awayScore,
        url: deepLinkUrl
    };

    // Send notification to scoring team followers
    const result = await sendNotification({
        title,
        message,
        filters: simpleFilters,
        target,
        data
    });

    // Also send to opposing team followers with slightly different message
    if (sendOpposing && homeTeamCode && awayTeamCode) {
        const opposingCode = scoringTeamCode === homeTeamCode ? awayTeamCode : homeTeamCode;
        const opposingFilters = [
            { field: 'tag', key: 'goal_notifications', relation: '=', value: 'true' },
            { operator: 'AND' },
            { field: 'tag', key: `team_${opposingCode.toLowerCase()}`, relation: '=', value: 'true' }
        ];

        // Don't await - fire and forget for the second notification
        // Include the same deep link URL so opposing fans can also open the game
        sendNotification({
            title,
            message: `${scoringTeamName} scored. ${homeScore}-${awayScore}`,
            filters: opposingFilters,
            target: sendOpposing && target ? target : null,
            data // data already includes the url for deep linking
        }).catch(err => console.error('[PushNotifications] Error sending opposing team notification:', err));
    }

    return result;
}

/**
 * Send a pre-game reminder notification
 * @param {Object} gameInfo - Game information
 * @param {string} gameInfo.sport - Sport type ('shl', 'allsvenskan', 'biathlon')
 * @param {string} gameInfo.gameId - Game UUID
 * @param {string} gameInfo.homeTeamName - Home team name
 * @param {string} gameInfo.awayTeamName - Away team name (for team sports)
 * @param {string} gameInfo.homeTeamCode - Home team code (for targeting)
 * @param {string} gameInfo.awayTeamCode - Away team code (for targeting)
 * @param {string} gameInfo.eventName - Event name (for biathlon)
 * @param {string} gameInfo.startTime - Game start time
 * @param {string} gameInfo.venue - Venue name
 * @param {number} gameInfo.minutesUntilStart - Minutes until game starts
 * @returns {Promise<Object>} Send result
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
        startTime,
        venue,
        minutesUntilStart = 5
    } = gameInfo;

    // Build sport-specific notification content
    let title, message, sportEmoji, preGameTag;

    if (sport === 'shl') {
        sportEmoji = '🏒';
        preGameTag = 'pre_game_shl';
        title = `${sportEmoji} SHL Starting Soon`;
        message = `${homeTeamName} vs ${awayTeamName}`;
        if (venue) {
            message += ` at ${venue}`;
        }
        message += ` - starts in ${minutesUntilStart} minutes!`;
    } else if (sport === 'allsvenskan') {
        sportEmoji = '⚽';
        preGameTag = 'pre_game_football';
        title = `${sportEmoji} Allsvenskan Starting Soon`;
        message = `${homeTeamName} vs ${awayTeamName}`;
        if (venue) {
            message += ` at ${venue}`;
        }
        message += ` - kicks off in ${minutesUntilStart} minutes!`;
    } else if (sport === 'biathlon') {
        sportEmoji = '🎯';
        preGameTag = 'pre_game_biathlon';
        title = `${sportEmoji} Biathlon Starting Soon`;
        message = eventName || 'Race';
        if (venue) {
            message += ` in ${venue}`;
        }
        message += ` - starts in ${minutesUntilStart} minutes!`;
    } else {
        console.warn(`[PushNotifications] Unknown sport for pre-game notification: ${sport}`);
        return { success: false, error: 'Unknown sport' };
    }

    // Build deep link URL for opening the game in the app
    const deepLinkUrl = `gamepulse://game/${sport}/${gameId}`;

    // Build filters: users must have pre-game tag enabled for this sport
    // AND (for team sports) be following one of the teams
    let filters = [
        { field: 'tag', key: preGameTag, relation: '=', value: 'true' }
    ];

    // For team sports, also filter by followed teams
    if ((sport === 'shl' || sport === 'allsvenskan') && homeTeamCode && awayTeamCode) {
        // Users following either team
        filters.push({ operator: 'AND' });
        filters.push({
            operator: 'OR',
            filters: [
                { field: 'tag', key: `team_${homeTeamCode.toLowerCase()}`, relation: '=', value: 'true' },
                { field: 'tag', key: `team_${awayTeamCode.toLowerCase()}`, relation: '=', value: 'true' }
            ]
        });
    }

    const data = {
        type: 'pre_game',
        sport,
        gameId,
        homeTeam: homeTeamCode,
        awayTeam: awayTeamCode,
        url: deepLinkUrl
    };

    console.log(`[PushNotifications] Sending pre-game notification for ${sport}: ${message}`);

    return sendNotification({
        title,
        message,
        filters,
        data
    });
}

/**
 * Send a test notification
 * @param {string} message - Test message
 * @returns {Promise<Object>} Send result
 */
async function sendTestNotification(messageOrOptions = 'This is a test notification from GamePulse!') {
    const defaultMessage = 'This is a test notification from GamePulse!';
    let message = defaultMessage;
    let target = null;

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        message = messageOrOptions.message || defaultMessage;
        target = messageOrOptions.target || null;
    } else {
        message = messageOrOptions || defaultMessage;
    }

    return sendNotification({
        title: '🔔 GamePulse Test',
        message,
        filters: [
            // Send to all users with goal_notifications enabled
            { field: 'tag', key: 'goal_notifications', relation: '=', value: 'true' }
        ],
        target,
        data: { type: 'test' }
    });
}

/**
 * Get notification stats
 * @returns {Object} Stats object
 */
function getStats() {
    return {
        configured: isConfigured(),
        notificationsSent: stats.notificationsSent,
        errors: stats.errors,
        lastSent: stats.lastSent
    };
}

module.exports = {
    isConfigured,
    sendNotification,
    sendGoalNotification,
    sendPreGameNotification,
    sendTestNotification,
    getStats
};
