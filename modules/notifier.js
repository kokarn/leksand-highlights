const fs = require('fs');
const {
    SEEN_GAMES_FILE,
    SEEN_VIDEOS_FILE,
    HIGHLIGHTS_TOPIC_PREFIX,
    TEAM_ALL_TOPIC_PREFIX,
    GLOBAL_ALL_TOPIC,
    MAX_HOURS_SINCE_GAME,
    NOTIFIER_INTERVAL_NORMAL,
    NOTIFIER_INTERVAL_LIVE
} = require('./config');
const { getProvider } = require('./providers');
const { formatSwedishTimestamp } = require('./utils');
const { addEntry } = require('./activity-log');

// ============ NOTIFIER STATE ============
let seenGames = [];
let seenVideos = [];
let isFirstCheck = true;  // Skip notifications on startup
let stats = {
    lastCheck: null,
    gamesChecked: 0,
    notificationsSent: 0,
    isRunning: false
};

// ============ DATA PERSISTENCE ============
function loadData() {
    if (fs.existsSync(SEEN_GAMES_FILE)) {
        try {
            seenGames = JSON.parse(fs.readFileSync(SEEN_GAMES_FILE, 'utf8'));
        } catch (e) {
            console.error('Error reading seen_games.json:', e);
        }
    }
    if (fs.existsSync(SEEN_VIDEOS_FILE)) {
        try {
            seenVideos = JSON.parse(fs.readFileSync(SEEN_VIDEOS_FILE, 'utf8'));
        } catch (e) {
            console.error('Error reading seen_videos.json:', e);
        }
    }
}

function saveSeenGame(gameId) {
    if (!seenGames.includes(gameId)) {
        seenGames.push(gameId);
        fs.writeFileSync(SEEN_GAMES_FILE, JSON.stringify(seenGames, null, 2));
    }
}

function saveSeenVideo(videoId) {
    if (!seenVideos.includes(videoId)) {
        seenVideos.push(videoId);
        fs.writeFileSync(SEEN_VIDEOS_FILE, JSON.stringify(seenVideos, null, 2));
    }
}

// ============ NOTIFICATIONS ============
async function sendNotification(topic, video, gameInfo, isHighlight) {
    const provider = getProvider();
    const videoUrl = provider.getVideoUrl(video);
    const imageUrl = provider.getVideoThumbnail(video);

    const title = isHighlight
        ? `Highlights: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}`
        : `New Video: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}`;

    let message = isHighlight
        ? `Watch the highlights from ${gameInfo.homeTeam} vs ${gameInfo.awayTeam} at ${gameInfo.venue}`
        : `A new video has been posted from ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}`;

    if (imageUrl) {
        message += `\n\n![Thumbnail](${imageUrl})`;
    }

    console.log(`[Notifier] Sending notification to ntfy.sh/${topic}...`);
    try {
        const payload = {
            topic,
            message,
            title,
            tags: ['hockey', 'shl', isHighlight ? 'highlights' : 'videos'],
            priority: isHighlight ? 4 : 3,
            click: videoUrl,
            markdown: true,
            actions: [{
                action: 'view',
                label: 'Watch Video',
                url: videoUrl
            }]
        };

        await fetch('https://ntfy.sh', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        stats.notificationsSent++;
        addEntry('notifier', 'notification', `Video notification: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}`);
    } catch (error) {
        console.error(`Error sending notification to ${topic}:`, error.message);
        addEntry('notifier', 'error', `Video notification failed: ${error.message}`);
    }
}

async function processGameVideos(game, skipNotifications = false) {
    const provider = getProvider();
    const gameInfo = provider.getGameDisplayInfo(game);
    const timestamp = formatSwedishTimestamp();

    console.log(`[${timestamp}] Checking videos for ${gameInfo.homeTeam} vs ${gameInfo.awayTeam} (${gameInfo.gameId})...`);

    try {
        const videos = await provider.fetchGameVideos(gameInfo.gameId);
        if (!videos) return;

        for (const video of videos) {
            if (seenVideos.includes(video.id)) continue;

            const isHighlight = provider.isHighlight(video);

            if (!skipNotifications) {
                // 1. Global topic
                await sendNotification(GLOBAL_ALL_TOPIC, video, gameInfo, isHighlight);

                // 2. Per-team "all" topics
                await sendNotification(`${TEAM_ALL_TOPIC_PREFIX}${gameInfo.homeTeamCode}`, video, gameInfo, isHighlight);
                await sendNotification(`${TEAM_ALL_TOPIC_PREFIX}${gameInfo.awayTeamCode}`, video, gameInfo, isHighlight);

                // 3. Per-team highlights (if applicable)
                if (isHighlight) {
                    await sendNotification(`${HIGHLIGHTS_TOPIC_PREFIX}${gameInfo.homeTeamCode}`, video, gameInfo, isHighlight);
                    await sendNotification(`${HIGHLIGHTS_TOPIC_PREFIX}${gameInfo.awayTeamCode}`, video, gameInfo, isHighlight);
                }
            }

            saveSeenVideo(video.id);
        }

        // If game is old, mark it as seen
        const startTime = new Date(gameInfo.startTime);
        const hoursSinceStart = (new Date() - startTime) / (1000 * 60 * 60);
        if (hoursSinceStart > MAX_HOURS_SINCE_GAME) {
            saveSeenGame(gameInfo.gameId);
        }

    } catch (e) {
        console.error(`Error processing videos for ${gameInfo.gameId}: ${e.message}`);
        addEntry('notifier', 'error', `Error processing videos: ${e.message}`);
    }
}

// ============ MAIN CHECK LOOP ============
async function runCheck() {
    const provider = getProvider();
    console.log(`\n--- [Notifier] Running check at ${formatSwedishTimestamp()} ---`);
    loadData();

    const games = await provider.fetchActiveGames();

    // Skip all notifications on first check after server start
    const skipNotifications = isFirstCheck;
    if (isFirstCheck) {
        console.log(`[Notifier] Startup check - indexing videos without sending notifications...`);
        isFirstCheck = false;
    }

    stats.gamesChecked = games.length;

    for (const game of games) {
        const gameInfo = provider.getGameDisplayInfo(game);
        if (seenGames.includes(gameInfo.gameId)) continue;
        await processGameVideos(game, skipNotifications);
    }

    stats.lastCheck = formatSwedishTimestamp();
    return games;
}

function startLoop() {
    stats.isRunning = true;
    console.log('[Notifier] Starting background notification service...');
    loadData();

    const checkLoop = async () => {
        try {
            const games = await runCheck();
            const hasLiveGame = games && games.some(g => g.state === 'live');

            const delay = hasLiveGame ? NOTIFIER_INTERVAL_LIVE : NOTIFIER_INTERVAL_NORMAL;

            if (hasLiveGame) {
                console.log(`[Notifier] Live game active! Next check in 30 seconds.`);
            } else {
                console.log(`[Notifier] No live games. Next check in 5 minutes.`);
            }

            setTimeout(checkLoop, delay);
        } catch (error) {
            console.error('[Notifier] Error in main loop:', error);
            setTimeout(checkLoop, NOTIFIER_INTERVAL_NORMAL);
        }
    };

    checkLoop();
}

function getStats() {
    return {
        running: stats.isRunning,
        lastCheck: stats.lastCheck,
        gamesChecked: stats.gamesChecked,
        totalNotificationsSent: stats.notificationsSent,
        seenGamesCount: seenGames.length,
        seenVideosCount: seenVideos.length
    };
}

module.exports = {
    loadData,
    runCheck,
    startLoop,
    getStats
};
