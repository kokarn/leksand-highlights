const fs = require('fs');
const path = require('path');

const SEEN_GAMES_FILE = path.join(__dirname, 'seen_games.json');
const SHL_SCHEDULE_API = 'https://www.shl.se/api/sports-v2/game-schedule?seasonUuid=xs4m9qupsi&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B&gamePlace=all&played=all';
const TOPIC_PREFIX = 'shl-highlights-';

// Load seen games
let seenGames = [];
if (fs.existsSync(SEEN_GAMES_FILE)) {
    try {
        seenGames = JSON.parse(fs.readFileSync(SEEN_GAMES_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading seen_games.json:', e);
    }
}

function saveSeenGame(gameId) {
    if (!seenGames.includes(gameId)) {
        seenGames.push(gameId);
        fs.writeFileSync(SEEN_GAMES_FILE, JSON.stringify(seenGames, null, 2));
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
            if (game.state !== 'post-game') return false;

            const startTime = new Date(game.startDateTime);
            const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);
            return hoursSinceStart <= 24;
        });

        if (games.length > 0) {
            const gameDetails = games.map(g => `${g.homeTeamInfo.names.short} vs ${g.awayTeamInfo.names.short}`).join(', ');
            console.log(`Found ${games.length} recently completed games: ${gameDetails}`);
        } else {
            console.log('No games found from the last 24 hours.');
        }
        return games;

    } catch (error) {
        console.error('Error fetching schedule:', error.message);
        return [];
    }
}

async function sendNotification(videoUrl, imageUrl, game, teamCode) {
    const topic = `${TOPIC_PREFIX}${teamCode}`;
    const homeName = game.homeTeamInfo.names.short || game.homeTeamInfo.code;
    const awayName = game.awayTeamInfo.names.short || game.awayTeamInfo.code;
    const arenaName = game.venueInfo ? game.venueInfo.name : 'arenan';
    const title = `Highlights: ${homeName} vs ${awayName}`;
    let message = `Watch the summary from ${homeName} vs ${awayName} at ${arenaName}`;

    if (imageUrl) {
        message += `\n\n[![Highlights](${imageUrl})](${videoUrl})`;
    }

    console.log(`Sending notification to ntfy.sh/${topic}...`);
    try {
        const payload = {
            topic: topic,
            message: message,
            title: title,
            tags: ['hockey', teamCode.toLowerCase(), 'highlights'],
            priority: 4,
            click: videoUrl,
            markdown: true,
            actions: [{
                action: 'view',
                label: 'Watch Highlights',
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

async function checkHighlights(game) {
    const timestamp = new Date().toLocaleTimeString();
    const homeName = game.homeTeamInfo.names.short || game.homeTeamInfo.code;
    const awayName = game.awayTeamInfo.names.short || game.awayTeamInfo.code;

    console.log(`[${timestamp}] Checking highlights for ${homeName} vs ${awayName} (${game.uuid})...`);

    if (seenGames.includes(game.uuid)) {
        console.log(`Game ${game.uuid} has already been processed. Skipping.`);
        return;
    }

    // Stop checking if game is older than 24 hours
    const startTime = new Date(game.startDateTime);
    const now = new Date();
    const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

    if (hoursSinceStart > 24) {
        console.log(`Game ${game.uuid} is older than 24 hours. Marking as seen.`);
        saveSeenGame(game.uuid);
        return;
    }

    const apiUrl = `https://www.shl.se/api/media/videos-for-game?page=0&pageSize=20&gameUuid=${game.uuid}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return;

        const data = await response.json();
        const highlight = (data.items || []).find(item =>
            item.tags && item.tags.includes('custom.highlights')
        );

        if (highlight && highlight.renderedMedia && highlight.renderedMedia.videourl) {
            const videoUrl = highlight.renderedMedia.videourl;
            const imageUrl = highlight.renderedMedia.url || highlight.thumbnail;

            console.log(`Found highlights for ${game.uuid}. Notifying teams...`);

            // Notify both teams
            await sendNotification(videoUrl, imageUrl, game, game.homeTeamInfo.code);
            await sendNotification(videoUrl, imageUrl, game, game.awayTeamInfo.code);

            saveSeenGame(game.uuid);
        }
    } catch (e) {
        console.error(`Error checking highlights for ${game.uuid}: ${e.message}`);
    }
}

async function runCheck() {
    console.log(`\n--- Running check at ${new Date().toLocaleTimeString()} ---`);
    const games = await fetchSchedule();

    // If seenGames is empty (first run), we mark all currently finished games as seen
    // to avoid a burst of notifications for games that just happened.
    if (seenGames.length === 0 && games.length > 0) {
        const gameDetails = games.map(g => `${g.homeTeamInfo.names.short} vs ${g.awayTeamInfo.names.short}`).join(', ');
        console.log(`First run: marking ${games.length} games as seen to avoid initial spam: ${gameDetails}`);
        games.forEach(g => saveSeenGame(g.uuid));
        return;
    }

    for (const game of games) {
        await checkHighlights(game);
    }
}

async function main() {
    console.log('Starting SHL Notifier (Multi-Team Support)...');

    await runCheck();
    setInterval(runCheck, 5 * 60 * 1000);
}

if (require.main === module) {
    main();
}
