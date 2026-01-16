const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import modules
const { PORT } = require('./modules/config');
const {
    getCachedGames,
    setCachedGames,
    getCachedDetails,
    setCachedDetails,
    getCachedVideos,
    setCachedVideos,
    clearAllCaches,
    getCacheStatus,
    setGamesLiveFlag
} = require('./modules/cache');
const { getProvider } = require('./modules/providers');
const { formatSwedishTimestamp } = require('./modules/utils');
const notifier = require('./modules/notifier');
const {
    listAdminGames,
    findAdminGameRecord,
    createAdminGame,
    updateAdminGame,
    deleteAdminGame,
    hydrateAdminGame,
    formatAdminRecord
} = require('./modules/admin-games');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static files (logos, etc.)
app.use('/static', express.static(path.join(__dirname, 'static')));

// Load teams data
const teamsDataPath = path.join(__dirname, 'static', 'teams.json');
let teamsData = { teams: [] };
if (fs.existsSync(teamsDataPath)) {
    teamsData = JSON.parse(fs.readFileSync(teamsDataPath, 'utf8'));
}
const teamsByCode = new Map(teamsData.teams.map(team => [team.code, team]));

function getAdminGameSchedule() {
    return listAdminGames(teamsByCode).map(record => record.game);
}

function getAdminGameById(uuid) {
    const record = findAdminGameRecord(uuid);
    return record ? hydrateAdminGame(record, teamsByCode) : null;
}

function mergeGames(primaryGames, adminGames) {
    const merged = new Map();
    primaryGames.forEach(game => {
        merged.set(game.uuid, game);
    });
    adminGames.forEach(game => {
        merged.set(game.uuid, game);
    });
    return Array.from(merged.values()).sort((a, b) =>
        new Date(b.startDateTime) - new Date(a.startDateTime)
    );
}

function sendAdminError(res, error) {
    const message = error?.message || 'Invalid request';
    res.status(400).json({ error: message });
}

// ============ API ENDPOINTS ============

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin.html'));
});

/**
 * GET /api/teams
 * Get all SHL teams with their logos and info
 */
app.get('/api/teams', (req, res) => {
    res.json(teamsData.teams);
});

/**
 * GET /api/teams/:code
 * Get a specific team by code (e.g., LIF, FHC, BIF)
 */
app.get('/api/teams/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const team = teamsData.teams.find(t => t.code === code);

    if (!team) {
        return res.status(404).json({ error: `Team not found: ${code}` });
    }

    res.json(team);
});

/**
 * Admin: list, create, update, delete manual games
 */
app.get('/api/admin/games', (req, res) => {
    res.json({ games: listAdminGames(teamsByCode) });
});

app.post('/api/admin/games', (req, res) => {
    try {
        const record = createAdminGame(req.body || {}, teamsByCode);
        res.status(201).json(formatAdminRecord(record, teamsByCode));
    } catch (error) {
        sendAdminError(res, error);
    }
});

app.patch('/api/admin/games/:id', (req, res) => {
    try {
        const record = updateAdminGame(req.params.id, req.body || {}, teamsByCode);
        if (!record) {
            return res.status(404).json({ error: 'Admin game not found' });
        }
        res.json(formatAdminRecord(record, teamsByCode));
    } catch (error) {
        sendAdminError(res, error);
    }
});

app.delete('/api/admin/games/:id', (req, res) => {
    const deleted = deleteAdminGame(req.params.id);
    if (!deleted) {
        return res.status(404).json({ error: 'Admin game not found' });
    }
    res.json({ message: 'Admin game deleted' });
});

app.get('/api/games', async (req, res) => {
    try {
        let baseGames = getCachedGames();
        let usedCache = true;

        if (baseGames) {
            console.log('[Cache HIT] /api/games');
        } else {
            usedCache = false;
            console.log('[Cache MISS] /api/games - fetching fresh data...');
            const provider = getProvider();
            const games = await provider.fetchAllGames();

            baseGames = games.length
                ? games.sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))
                : [];

            if (baseGames.length) {
                baseGames = await provider.enrichGames(baseGames);
            }
        }

        const adminGames = getAdminGameSchedule();
        const combinedGames = mergeGames(baseGames, adminGames);
        const hasLiveGame = combinedGames.some(game => game.state === 'live');

        if (!usedCache) {
            setCachedGames(baseGames, hasLiveGame);
            if (hasLiveGame) {
                console.log('[Cache] Live game detected - using 15s cache duration');
            }
        } else {
            setGamesLiveFlag(hasLiveGame);
        }

        res.json(combinedGames);

    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/game/:uuid/videos', async (req, res) => {
    const { uuid } = req.params;

    const adminGame = getAdminGameById(uuid);
    if (adminGame) {
        return res.json([]);
    }

    // Check cache first
    const cached = getCachedVideos(uuid);
    if (cached) {
        console.log(`[Cache HIT] /api/game/${uuid}/videos`);
        return res.json(cached);
    }

    console.log(`[Cache MISS] /api/game/${uuid}/videos - fetching...`);

    try {
        const provider = getProvider();
        const videos = await provider.fetchGameVideos(uuid);
        setCachedVideos(uuid, videos);
        res.json(videos);
    } catch (error) {
        console.error(`Error processing videos for ${uuid}:`, error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/video/:id
 * Get enriched video details with streaming URLs for embedding
 *
 * Response includes:
 * - streams.hls: HLS streaming URL (.m3u8) for native players
 * - streams.embed: Iframe embed URL
 * - images.thumbnail: Thumbnail image
 * - images.gif: Animated preview GIF
 */
app.get('/api/video/:id', async (req, res) => {
    const { id } = req.params;

    console.log(`[API] Fetching video details for ${id}...`);

    try {
        const provider = getProvider();
        const details = await provider.fetchVideoDetails(id);

        if (!details) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json(details);
    } catch (error) {
        console.error(`Error fetching video details for ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/game/:uuid/details', async (req, res) => {
    const { uuid } = req.params;

    const adminGame = getAdminGameById(uuid);
    if (adminGame) {
        return res.json({
            info: {
                gameInfo: {
                    gameUuid: adminGame.uuid,
                    startDateTime: adminGame.startDateTime,
                    arenaName: adminGame.venueInfo?.name || null,
                    state: adminGame.state
                },
                homeTeam: {
                    names: adminGame.homeTeamInfo.names,
                    uuid: adminGame.homeTeamInfo.uuid,
                    score: adminGame.homeTeamInfo.score,
                    icon: adminGame.homeTeamInfo.icon
                },
                awayTeam: {
                    names: adminGame.awayTeamInfo.names,
                    uuid: adminGame.awayTeamInfo.uuid,
                    score: adminGame.awayTeamInfo.score,
                    icon: adminGame.awayTeamInfo.icon
                },
                ssgtUuid: null
            },
            teamStats: null,
            events: {
                goals: [],
                penalties: [],
                periods: [],
                all: []
            }
        });
    }

    // Check cache first
    const cached = getCachedDetails(uuid);
    if (cached) {
        console.log(`[Cache HIT] /api/game/${uuid}/details`);
        return res.json(cached);
    }

    console.log(`[Cache MISS] /api/game/${uuid}/details - fetching...`);

    try {
        const provider = getProvider();
        const details = await provider.fetchGameDetails(uuid);
        setCachedDetails(uuid, details);
        res.json(details);
    } catch (error) {
        console.error(`Error fetching game details for ${uuid}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    const provider = getProvider();
    res.json({
        server: {
            uptime: process.uptime(),
            timestamp: formatSwedishTimestamp()
        },
        provider: provider.getName(),
        notifier: notifier.getStats(),
        cache: getCacheStatus(),
        refreshRates: {
            gamesNormal: '60 seconds',
            gamesLive: '15 seconds',
            gameDetails: '30 seconds',
            videos: '60 seconds',
            notifierNormal: '5 minutes',
            notifierLive: '30 seconds'
        }
    });
});

app.post('/api/cache/clear', (req, res) => {
    clearAllCaches();
    console.log('[Cache] All caches cleared manually');
    res.json({ message: 'All caches cleared', timestamp: formatSwedishTimestamp() });
});

app.post('/api/notifier/check', async (req, res) => {
    console.log('[API] Manual notifier check triggered');
    try {
        const games = await notifier.runCheck();
        res.json({
            message: 'Notifier check completed',
            timestamp: formatSwedishTimestamp(),
            gamesChecked: games.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ START SERVER ============
app.listen(PORT, () => {
    const provider = getProvider();
    console.log(`\n========================================`);
    console.log(`  SHL Proxy Server + Notifier`);
    console.log(`========================================`);
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data provider: ${provider.getName()}`);
    console.log(`Started at: ${formatSwedishTimestamp()}`);
    console.log(`\nCache durations:`);
    console.log(`  - Games: 60s (15s during live games)`);
    console.log(`  - Details: 30s`);
    console.log(`  - Videos: 60s`);
    console.log(`\nNotifier check intervals:`);
    console.log(`  - Normal: 5 minutes`);
    console.log(`  - Live games: 30 seconds`);
    console.log(`========================================\n`);

    // Start the notifier loop after server is ready
    notifier.startLoop();
});

// Export for testing
module.exports = { app };
