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
 * @param {Object} options.data - Additional data to include
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
    const title = `${sportEmoji} GOAL! ${scoringTeamName}`;

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
        awayScore
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
        sendNotification({
            title: `${sportEmoji} Goal Against`,
            message: `${scoringTeamName} scored. ${homeScore}-${awayScore}`,
            filters: opposingFilters,
            target: sendOpposing && target ? target : null,
            data
        }).catch(err => console.error('[PushNotifications] Error sending opposing team notification:', err));
    }

    return result;
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
        title: '🔔 Test Notification',
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
    sendTestNotification,
    getStats
};
