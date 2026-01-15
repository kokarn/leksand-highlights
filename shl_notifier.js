const fs = require('fs');
const path = require('path');

const SEEN_GAMES_FILE = path.join(__dirname, 'seen_games.json');
const SEEN_VIDEOS_FILE = path.join(__dirname, 'seen_videos.json');
const SHL_SCHEDULE_API = 'https://www.shl.se/api/sports-v2/game-schedule?seasonUuid=xs4m9qupsi&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B&gamePlace=all&played=all';
const HIGHLIGHTS_TOPIC_PREFIX = 'shl-highlights-';
const TEAM_ALL_TOPIC_PREFIX = 'shl-all-';
const GLOBAL_ALL_TOPIC = 'shl-all-videos';
const MAX_HOURS_SINCE_GAME = 36;

// Load seen games/videos
let seenGames = [];
let seenVideos = [];

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

async function fetchSchedule() {
    console.log('Fetching schedule from API...');
    try {
        const response = await fetch(SHL_SCHEDULE_API);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data || !data.gameInfo) {
            console.error('Invalid API response structure.');
            return [];
        }

        const now = new Date();
        const games = data.gameInfo.filter(game => {
            const startTime = new Date(game.startDateTime);
            const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

            // 1. Post-game: Check within the detection window
            if (game.state === 'post-game') {
                return hoursSinceStart >= -1 && hoursSinceStart <= MAX_HOURS_SINCE_GAME;
            }

            // 2. Live game: Check if it's currently active
            if (game.state === 'live') {
                return true;
            }

            // 3. Pre-game fallback: If start time passed, check for 6 hours (handles API lag)
            if (game.state === 'pre-game' && hoursSinceStart >= 0) {
                return hoursSinceStart <= 6;
            }

            return false;
        });

        if (games.length > 0) {
            const gameDetails = games.map(g => `${g.homeTeamInfo.names.short} vs ${g.awayTeamInfo.names.short} (${g.state})`).join(', ');
            console.log(`Checking ${games.length} active/recent games: ${gameDetails}`);
        } else {
            console.log(`No active or recent games found (last ${MAX_HOURS_SINCE_GAME} hours).`);
        }
        return games;

    } catch (error) {
        console.error('Error fetching schedule:', error.message);
        return [];
    }
}

async function sendNotification(topic, video, game, isHighlight) {
    const homeName = game.homeTeamInfo.names.short || game.homeTeamInfo.code;
    const awayName = game.awayTeamInfo.names.short || game.awayTeamInfo.code;
    const arenaName = game.venueInfo ? game.venueInfo.name : 'arenan';
    const videoUrl = video.renderedMedia.videourl;
    const imageUrl = video.renderedMedia.url || video.thumbnail;

    const title = isHighlight
        ? `Highlights: ${homeName} vs ${awayName}`
        : `New Video: ${homeName} vs ${awayName}`;

    let message = isHighlight
        ? `Watch the highlights from ${homeName} vs ${awayName} at ${arenaName}`
        : `A new video has been posted from ${homeName} vs ${awayName}`;

    if (imageUrl) {
        message += `\n\n![Thumbnail](${imageUrl})`;
    }

    console.log(`Sending notification to ntfy.sh/${topic}...`);
    try {
        const payload = {
            topic: topic,
            message: message,
            title: title,
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

        await fetch(`https://ntfy.sh`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error(`Error sending notification to ${topic}:`, error.message);
    }
}

async function processGameVideos(game, skipNotifications = false) {
    const timestamp = new Date().toLocaleTimeString();
    const homeName = game.homeTeamInfo.names.short || game.homeTeamInfo.code;
    const awayName = game.awayTeamInfo.names.short || game.awayTeamInfo.code;

    console.log(`[${timestamp}] Checking videos for ${homeName} vs ${awayName} (${game.uuid})...`);

    const apiUrl = `https://www.shl.se/api/media/videos-for-game?page=0&pageSize=20&gameUuid=${game.uuid}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        const videos = data.items || [];

        for (const video of videos) {
            if (seenVideos.includes(video.id)) continue;

            const isHighlight = video.tags && video.tags.includes('custom.highlights');

            if (!skipNotifications) {
                // 1. Global topic
                await sendNotification(GLOBAL_ALL_TOPIC, video, game, isHighlight);

                // 2. Per-team "all" topics
                await sendNotification(`${TEAM_ALL_TOPIC_PREFIX}${game.homeTeamInfo.code}`, video, game, isHighlight);
                await sendNotification(`${TEAM_ALL_TOPIC_PREFIX}${game.awayTeamInfo.code}`, video, game, isHighlight);

                // 3. Per-team highlights (if applicable)
                if (isHighlight) {
                    await sendNotification(`${HIGHLIGHTS_TOPIC_PREFIX}${game.homeTeamInfo.code}`, video, game, isHighlight);
                    await sendNotification(`${HIGHLIGHTS_TOPIC_PREFIX}${game.awayTeamInfo.code}`, video, game, isHighlight);
                }
            }

            saveSeenVideo(video.id);
        }

        // If game is old, also mark it as seen in seen_games.json to potentially skip schedule checks
        const startTime = new Date(game.startDateTime);
        const hoursSinceStart = (new Date() - startTime) / (1000 * 60 * 60);
        if (hoursSinceStart > MAX_HOURS_SINCE_GAME) {
            saveSeenGame(game.uuid);
        }

    } catch (e) {
        console.error(`Error processing videos for ${game.uuid}: ${e.message}`);
    }
}

async function runCheck() {
    console.log(`\n--- Running check at ${new Date().toLocaleString()} ---`);
    loadData();
    const games = await fetchSchedule();

    const isFirstRun = seenVideos.length === 0 && games.length > 0;
    if (isFirstRun) {
        console.log(`First run detected. Pre-seeding seen videos for older games...`);
    }

    for (const game of games) {
        if (seenGames.includes(game.uuid)) continue;

        if (isFirstRun) {
            const startTime = new Date(game.startDateTime);
            const hoursSinceStart = (new Date() - startTime) / (1000 * 60 * 60);

            // On first run, we only skip notifications for videos older than 12h.
            // Recently completed games (within 12h) will have their videos processed with notifications.
            if (hoursSinceStart > 12) {
                console.log(`First run: pre-seeding videos for game ${game.uuid} (${hoursSinceStart.toFixed(1)}h ago) without notifications.`);
                await processGameVideos(game, true);
                continue;
            }
        }
        await processGameVideos(game, false);
    }
    return games;
}

async function main() {
    console.log('Starting SHL Notifier (Multi-Topic support)...');
    loadData();

    const checkLoop = async () => {
        try {
            const games = await runCheck();
            const hasLiveGame = games && games.some(g => g.state === 'live');

            // Check every 30 seconds if live game, otherwise every 5 minutes
            const delay = hasLiveGame ? 30 * 1000 : 5 * 60 * 1000;

            if (hasLiveGame) {
                console.log(`Live game active! Next check in 30 seconds.`);
            }

            setTimeout(checkLoop, delay);
        } catch (error) {
            console.error('Error in main loop:', error);
            // Fallback to 5 minutes on error
            setTimeout(checkLoop, 5 * 60 * 1000);
        }
    };

    await checkLoop();
}

if (require.main === module) {
    main();
}
