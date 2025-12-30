// Native fetch is used directly

const fs = require('fs');
const path = require('path');

const SEEN_GAMES_FILE = path.join(__dirname, 'seen_games.json');
// Using the API endpoint found via browser inspection
// Season/Series/GameType UUIDs are hardcoded based on current season inspection.
const SHL_SCHEDULE_API = 'https://www.shl.se/api/sports-v2/game-schedule?seasonUuid=xs4m9qupsi&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B&gamePlace=all&played=all';
const LEKSAND_TEAM_CODE = 'LIF';
const NOTIFICATION_TOPIC = 'leksand-highlights'; // Customize this if needed

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

        // The API returns an object where keys are usually dates or structural,
        // but based on the subagent output it seemed to return *an object containing gameInfo array*?
        // Wait, the subagent said "The API returns a JSON object containing gameInfo (an array of matches)..."
        // Let's verify the structure.
        // The subagent said: "Response Structure Sample ... { "gameInfo": [ ... ] }"
        // OR it said "The API returns a JSON object containing gameInfo..., but the sample showed a single game object?"
        // Retrying the subagent output reading: "The API returns a JSON object containing gameInfo (an array of matches), teamList, and ssgtUuid."
        // So `data.gameInfo` should be the array.

        if (!data || !data.gameInfo) {
            console.error('Invalid API response structure. Keys:', data ? Object.keys(data) : 'null');
            return [];
        }

        const games = data.gameInfo;
        console.log(`Found ${games.length} games in schedule.`);

        const leksandGames = games.filter(game => {
            const isLeksand = (game.homeTeamInfo && game.homeTeamInfo.code === LEKSAND_TEAM_CODE) ||
                (game.awayTeamInfo && game.awayTeamInfo.code === LEKSAND_TEAM_CODE);
            const isFinished = game.state === 'post-game'; // Verify specific state string
            return isLeksand && isFinished;
        });




        console.log(`Found ${leksandGames.length} completed Leksand games.`);
        return leksandGames;

    } catch (error) {
        console.error('Error fetching schedule:', error.message);
        return [];
    }
}

async function sendNotification(videoUrl, imageUrl, game) {
    const homeName = game.homeTeamInfo.names.short || game.homeTeamInfo.code;
    const awayName = game.awayTeamInfo.names.short || game.awayTeamInfo.code;
    const homeScore = game.homeTeamInfo.score;
    const awayScore = game.awayTeamInfo.score;

    const title = `🚨 Highlights: ${homeName} vs ${awayName}`;
    let message = `**${homeName} ${homeScore} - ${awayScore} ${awayName}**\n\nHighlights are now available!`;

    // Add Markdown image link if image is available
    if (imageUrl) {
        message += `\n\n[![Highlights](${imageUrl})](${videoUrl})`;
    }

    console.log(`Sending notification to ntfy.sh/${NOTIFICATION_TOPIC}...`);
    try {
        const payload = {
            topic: NOTIFICATION_TOPIC,
            message: message,
            title: title,
            tags: ['hockey', 'leksand', 'highlights'],
            priority: 4, // High
            click: videoUrl,
            markdown: true,
            actions: [{
                action: 'view',
                label: 'Watch Highlights',
                url: videoUrl
            }]
        };

        // Removed 'attach' logic in favor of Markdown embedding

        await fetch(`https://ntfy.sh`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Notification sent successfully!');
    } catch (error) {
        console.error('Error sending notification:', error.message);
    }
}

async function checkHighlights(game) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Checking highlights for game ${game.uuid} (${game.startDateTime})...`);

    if (seenGames.includes(game.uuid)) {
        console.log('Game already processed.');
        return;
    }

    // Stop checking if game is older than 24 hours to avoid infinite polling for games without highlights
    const startTime = new Date(game.startDateTime);
    const now = new Date();
    const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

    if (hoursSinceStart > 24) {
        console.log(`Game ${game.uuid} is older than 24 hours and no highlights found. Marking as seen to stop polling.`);
        saveSeenGame(game.uuid);
        return;
    }

    const apiUrl = `https://www.shl.se/api/media/videos-for-game?page=0&pageSize=20&gameUuid=${game.uuid}`;
    console.log(`Fetching videos from API: ${apiUrl}...`);

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const items = data.items || [];
        let videoUrl = null;
        let imageUrl = null;

        const highlight = items.find(item =>
            item.tags && item.tags.includes('custom.highlights')
        );

        if (highlight && highlight.renderedMedia) {
            if (highlight.renderedMedia.videourl) {
                videoUrl = highlight.renderedMedia.videourl;
            }
            // Extract image URL (prefer renderedMedia.url, fallback to thumbnail)
            if (highlight.renderedMedia.url) {
                imageUrl = highlight.renderedMedia.url;
            } else if (highlight.thumbnail) {
                imageUrl = highlight.thumbnail;
            }
        }

        if (videoUrl) {
            console.log(`Found highlights: ${videoUrl}`);
            if (imageUrl) console.log(`Found image: ${imageUrl}`);
            await sendNotification(videoUrl, imageUrl, game);
            saveSeenGame(game.uuid);
        } else {
            console.log('No specific highlight video found in API response. Skipping notification.');
        }

    } catch (e) {
        console.error(`Error fetching game videos: ${e.message}`);
    }
}

async function runCheck() {
    console.log(`\n--- Running check at ${new Date().toLocaleTimeString()} ---`);
    const games = await fetchSchedule();

    // On first run (no seen games), marks all *but the last* as seen to avoid spamming 30 notifications.
    if (seenGames.length === 0 && games.length > 1) {
        console.log('First run detected. Marking historical games as seen to avoid spam.');
        const oldGames = games.slice(0, games.length - 1);
        oldGames.forEach(g => saveSeenGame(g.uuid));
        console.log(`Marked ${oldGames.length} past games as seen.`);
    }

    // Now process (which will only include the last game if it was the first run)
    for (const game of games) {
        await checkHighlights(game);
    }
}

async function main() {
    console.log('Starting Leksand Notifier...');

    // Initial Run
    await runCheck();

    // Schedule every 5 minutes (300,000 ms)
    const INTERVAL = 5 * 60 * 1000;
    console.log(`Scheduling next check in 5 minutes...`);

    setInterval(async () => {
        await runCheck();
        console.log(`Check complete. Next check in 5 minutes...`);
    }, INTERVAL);
}

if (require.main === module) {
    main();
}
