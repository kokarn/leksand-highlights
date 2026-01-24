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
    getCachedStandings,
    setCachedStandings,
    getCachedBiathlon,
    setCachedBiathlon,
    getCachedAllsvenskanGames,
    setCachedAllsvenskanGames,
    getCachedAllsvenskanDetails,
    setCachedAllsvenskanDetails,
    getCachedAllsvenskanStandings,
    setCachedAllsvenskanStandings,
    clearAllCaches,
    getCacheStatus,
    setGamesLiveFlag,
    setAllsvenskanLiveFlag
} = require('./modules/cache');
const { getProvider, getAvailableSports } = require('./modules/providers');
const { formatSwedishTimestamp } = require('./modules/utils');
const notifier = require('./modules/notifier');
const scheduler = require('./modules/scheduler');
const goalWatcher = require('./modules/goal-watcher');
const preGameWatcher = require('./modules/pre-game-watcher');
const pushNotifications = require('./modules/fcm-notifications');
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

// Load teams data for SHL
const teamsDataPath = path.join(__dirname, 'static', 'teams.json');
let teamsData = { teams: [] };
if (fs.existsSync(teamsDataPath)) {
    teamsData = JSON.parse(fs.readFileSync(teamsDataPath, 'utf8'));
}
const teamsByCode = new Map(teamsData.teams.map(team => [team.code, team]));

const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENT_START_WINDOW_MINUTES = 90;

// Load biathlon nations data
const biathlonNationsPath = path.join(__dirname, 'static', 'biathlon-nations.json');
let biathlonData = { nations: [], disciplines: [] };
if (fs.existsSync(biathlonNationsPath)) {
    biathlonData = JSON.parse(fs.readFileSync(biathlonNationsPath, 'utf8'));
}

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

function isGameNearStart(game, now = new Date()) {
    if (!game || game.state === 'post-game') {
        return false;
    }
    const startTime = new Date(game.startDateTime);
    if (Number.isNaN(startTime.getTime())) {
        return false;
    }
    const minutesFromStart = (startTime.getTime() - now.getTime()) / (1000 * 60);
    return minutesFromStart <= STARTING_SOON_WINDOW_MINUTES
        && minutesFromStart >= -RECENT_START_WINDOW_MINUTES;
}

function shouldUseFastGamesCache(games, now = new Date()) {
    return games.some(game => game.state === 'live' || isGameNearStart(game, now));
}

function sendAdminError(res, error) {
    const message = error?.message || 'Invalid request';
    res.status(400).json({ error: message });
}

function normalizeTeamCode(value) {
    if (!value) {
        return '';
    }
    return String(value).trim().toUpperCase();
}

function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return null;
    }
    return parsed;
}

function parseOptionalBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n'].includes(normalized)) {
            return false;
        }
    }
    return Boolean(value);
}

function buildNotificationTarget(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const target = {};
    const subscriptionIds = payload.subscriptionIds ?? payload.subscriptionId;
    const playerIds = payload.playerIds ?? payload.playerId;
    const externalUserIds = payload.externalUserIds ?? payload.externalUserId;

    if (subscriptionIds) {
        target.subscriptionIds = subscriptionIds;
    }
    if (playerIds) {
        target.playerIds = playerIds;
    }
    if (externalUserIds) {
        target.externalUserIds = externalUserIds;
    }

    const hasDirectTarget = Object.keys(target).length > 0;
    if (!hasDirectTarget && parseOptionalBoolean(payload.sendToAll, false)) {
        target.sendToAll = true;
    }

    return Object.keys(target).length ? target : null;
}

// ============ API ENDPOINTS ============

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin.html'));
});

/**
 * GET /api/sports
 * Get all available sports
 */
app.get('/api/sports', (req, res) => {
    const sportIcons = {
        shl: 'hockey-puck',
        allsvenskan: 'soccer-ball',
        biathlon: 'target'
    };

    const sports = getAvailableSports().map(sport => {
        const provider = getProvider(sport);
        return {
            id: sport,
            name: provider.getName(),
            icon: sportIcons[sport] || 'target'
        };
    });
    res.json(sports);
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
 * GET /api/standings
 * Get current SHL league standings
 * Query params:
 *   - team: filter by team code (optional)
 *   - top: limit to top N teams (optional)
 */
app.get('/api/standings', async (req, res) => {
    try {
        // Check cache first
        let standings = getCachedStandings();

        if (standings) {
            console.log('[Cache HIT] /api/standings');
        } else {
            console.log('[Cache MISS] /api/standings - fetching fresh data...');
            const provider = getProvider('shl');
            standings = await provider.fetchStandings();
            setCachedStandings(standings);
        }

        // Apply filters
        let result = { ...standings };

        if (req.query.team) {
            const teamCode = req.query.team.toUpperCase();
            result.standings = standings.standings.filter(t =>
                t.teamCode?.toUpperCase() === teamCode
            );
        }

        if (req.query.top) {
            const topN = parseInt(req.query.top);
            if (topN > 0) {
                result.standings = result.standings.slice(0, topN);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching standings:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ BIATHLON ENDPOINTS ============

/**
 * GET /api/biathlon/nations
 * Get all biathlon nations/teams
 */
app.get('/api/biathlon/nations', (req, res) => {
    res.json(biathlonData.nations);
});

/**
 * GET /api/biathlon/disciplines
 * Get all biathlon race disciplines
 */
app.get('/api/biathlon/disciplines', (req, res) => {
    res.json(biathlonData.disciplines);
});

/**
 * GET /api/biathlon/events
 * Get all biathlon events (World Cup stops, Olympics, etc.)
 */
app.get('/api/biathlon/events', async (req, res) => {
    try {
        const provider = getProvider('biathlon');
        const events = await provider.fetchEvents();
        res.json(events);
    } catch (error) {
        console.error('Error fetching biathlon events:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biathlon/races
 * Get all biathlon races (individual race sessions)
 * Query params:
 *   - upcoming: only show upcoming races if 'true'
 *   - limit: max number of races to return
 *   - country: filter by host country code
 *   - discipline: filter by discipline (sprint, pursuit, etc.)
 *   - gender: filter by gender (men, women, mixed)
 */
app.get('/api/biathlon/races', async (req, res) => {
    try {
        let races;

        // Try cache first for all races
        if (req.query.upcoming !== 'true') {
            races = getCachedBiathlon();
            if (races) {
                console.log('[Cache HIT] /api/biathlon/races');
            }
        }

        if (!races) {
            console.log('[Cache MISS] /api/biathlon/races - fetching...');
            const provider = getProvider('biathlon');

            if (req.query.upcoming === 'true') {
                const limit = parseInt(req.query.limit) || 20;
                races = await provider.fetchUpcomingRaces(limit);
            } else {
                races = await provider.fetchAllGames();
                setCachedBiathlon(races);
            }
        }

        // Apply filters
        if (req.query.country) {
            const country = req.query.country.toUpperCase();
            races = races.filter(r => r.country === country);
        }

        if (req.query.discipline) {
            const discipline = req.query.discipline.toLowerCase();
            races = races.filter(r => r.discipline.toLowerCase().includes(discipline));
        }

        if (req.query.gender) {
            const gender = req.query.gender.toLowerCase();
            races = races.filter(r => r.gender === gender);
        }

        res.json(races);
    } catch (error) {
        console.error('Error fetching biathlon races:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biathlon/schedule
 * Get upcoming biathlon schedule (convenience endpoint)
 */
app.get('/api/biathlon/schedule', async (req, res) => {
    try {
        const provider = getProvider('biathlon');
        const limit = parseInt(req.query.limit) || 30;
        const races = await provider.fetchUpcomingRaces(limit);
        res.json(races);
    } catch (error) {
        console.error('Error fetching biathlon schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biathlon/standings
 * Get World Cup standings
 * Query params:
 *   - gender: 'men', 'women', or 'all' (default: 'all')
 *   - type: 'overall', 'sprint', 'pursuit', 'individual', 'mass-start' (default: 'overall')
 */
app.get('/api/biathlon/standings', async (req, res) => {
    try {
        const gender = req.query.gender || 'all';
        const type = req.query.type || 'overall';

        console.log(`[API] Fetching biathlon standings - gender: ${gender}, type: ${type}`);

        const provider = getProvider('biathlon');
        const standings = await provider.fetchStandings({ gender, type });

        res.json(standings);
    } catch (error) {
        console.error('Error fetching biathlon standings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biathlon/race/:id
 * Get details for a specific race
 */
app.get('/api/biathlon/race/:id', async (req, res) => {
    try {
        const provider = getProvider('biathlon');
        const cachedRaces = getCachedBiathlon();
        const details = await provider.fetchGameDetails(req.params.id, { races: cachedRaces });

        if (!details) {
            return res.status(404).json({ error: 'Race not found' });
        }

        res.json(details);
    } catch (error) {
        console.error(`Error fetching race details for ${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ALLSVENSKAN/FOOTBALL ENDPOINTS ============

/**
 * GET /api/football/games
 * Get Allsvenskan fixtures
 * Query params:
 *   - team: filter by team code, id, or name (optional)
 *   - state: filter by game state (pre-game, live, post-game)
 *   - upcoming: only show upcoming games if 'true'
 *   - limit: max number of games to return
 */
app.get('/api/football/games', async (req, res) => {
    try {
        let games = getCachedAllsvenskanGames();
        let usedCache = true;

        if (games) {
            console.log('[Cache HIT] /api/football/games');
        } else {
            usedCache = false;
            console.log('[Cache MISS] /api/football/games - fetching fresh data...');
            const provider = getProvider('allsvenskan');
            games = await provider.fetchAllGames();
        }

        if (!Array.isArray(games)) {
            games = [];
        }

        const getTimeValue = (value) => {
            const time = new Date(value).getTime();
            return Number.isNaN(time) ? 0 : time;
        };
        games = games.sort((a, b) => getTimeValue(b.startDateTime) - getTimeValue(a.startDateTime));

        const now = new Date();
        const shouldUseFastCache = shouldUseFastGamesCache(games, now);

        if (!usedCache) {
            setCachedAllsvenskanGames(games, shouldUseFastCache);
        } else {
            setAllsvenskanLiveFlag(shouldUseFastCache);
        }

        let result = games;

        if (req.query.team) {
            const teamQuery = String(req.query.team).trim().toLowerCase();
            const matchesTeam = (teamInfo) => {
                if (!teamInfo) return false;
                const candidates = [
                    teamInfo.code,
                    teamInfo.uuid,
                    teamInfo.names?.short,
                    teamInfo.names?.long
                ];
                return candidates.some(value => value && String(value).toLowerCase() === teamQuery);
            };
            result = result.filter(game => matchesTeam(game.homeTeamInfo) || matchesTeam(game.awayTeamInfo));
        }

        if (req.query.state) {
            const stateQuery = String(req.query.state).trim().toLowerCase();
            result = result.filter(game => game.state === stateQuery);
        }

        if (req.query.upcoming === 'true') {
            result = result.filter(game => {
                const startTime = new Date(game.startDateTime);
                return !Number.isNaN(startTime.getTime()) && startTime >= now;
            });
        }

        if (req.query.limit) {
            const limit = parseInt(req.query.limit);
            if (limit > 0) {
                result = result.slice(0, limit);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching Allsvenskan schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/football/game/:id/details
 * Get details for a specific Allsvenskan match
 */
app.get('/api/football/game/:id/details', async (req, res) => {
    const { id } = req.params;

    const cached = getCachedAllsvenskanDetails(id);
    if (cached) {
        console.log(`[Cache HIT] /api/football/game/${id}/details`);
        return res.json(cached);
    }

    console.log(`[Cache MISS] /api/football/game/${id}/details - fetching...`);

    try {
        const provider = getProvider('allsvenskan');
        const details = await provider.fetchGameDetails(id);

        if (!details) {
            return res.status(404).json({ error: 'Game not found' });
        }

        setCachedAllsvenskanDetails(id, details);
        res.json(details);
    } catch (error) {
        console.error(`Error fetching Allsvenskan details for ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/football/standings
 * Get Allsvenskan standings
 * Query params:
 *   - team: filter by team code or name (optional)
 *   - top: limit to top N teams (optional)
 */
app.get('/api/football/standings', async (req, res) => {
    try {
        const seasonQuery = req.query.season ? String(req.query.season).trim() : null;
        let standings = getCachedAllsvenskanStandings(seasonQuery);

        if (standings) {
            console.log('[Cache HIT] /api/football/standings');
        } else {
            console.log('[Cache MISS] /api/football/standings - fetching fresh data...');
            const provider = getProvider('allsvenskan');
            standings = await provider.fetchStandings({ season: seasonQuery });
            const resolvedSeason = standings?.season ? String(standings.season) : null;

            if (seasonQuery) {
                if (resolvedSeason && resolvedSeason !== seasonQuery) {
                    setCachedAllsvenskanStandings(resolvedSeason, standings);
                } else {
                    setCachedAllsvenskanStandings(seasonQuery, standings);
                }
            } else {
                setCachedAllsvenskanStandings(null, standings);
                if (resolvedSeason) {
                    setCachedAllsvenskanStandings(resolvedSeason, standings);
                }
            }
        }

        let result = { ...standings };

        if (req.query.team) {
            const teamQuery = String(req.query.team).trim().toLowerCase();
            result.standings = standings.standings.filter(team => {
                const candidates = [
                    team.teamCode,
                    team.teamUuid,
                    team.teamName,
                    team.teamShortName
                ];
                return candidates.some(value => value && String(value).toLowerCase() === teamQuery);
            });
        }

        if (req.query.top) {
            const topN = parseInt(req.query.top);
            if (topN > 0) {
                result.standings = result.standings.slice(0, topN);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching Allsvenskan standings:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ SHL/HOCKEY ENDPOINTS ============

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

app.patch('/api/admin/games/:id', async (req, res) => {
    try {
        const { sendNotification: shouldSendNotification, ...updatePayload } = req.body || {};

        // Get the old record to detect score changes
        const oldRecord = findAdminGameRecord(req.params.id);
        if (!oldRecord) {
            return res.status(404).json({ error: 'Admin game not found' });
        }

        const record = updateAdminGame(req.params.id, updatePayload, teamsByCode);
        if (!record) {
            return res.status(404).json({ error: 'Admin game not found' });
        }

        // Check if score changed and notification was requested
        let notificationResult = null;
        if (shouldSendNotification) {
            const oldTotalScore = (oldRecord.homeScore || 0) + (oldRecord.awayScore || 0);
            const newTotalScore = (record.homeScore || 0) + (record.awayScore || 0);
            const homeScoreChanged = oldRecord.homeScore !== record.homeScore;
            const awayScoreChanged = oldRecord.awayScore !== record.awayScore;

            if (homeScoreChanged || awayScoreChanged) {
                // Determine which team scored (increased their score)
                const homeTeam = teamsByCode.get(record.homeTeamCode);
                const awayTeam = teamsByCode.get(record.awayTeamCode);

                // Find which team's score increased
                let scoringTeamIsHome = true;
                if (homeScoreChanged && record.homeScore > oldRecord.homeScore) {
                    scoringTeamIsHome = true;
                } else if (awayScoreChanged && record.awayScore > oldRecord.awayScore) {
                    scoringTeamIsHome = false;
                } else if (homeScoreChanged) {
                    scoringTeamIsHome = true;
                } else {
                    scoringTeamIsHome = false;
                }

                const scoringTeam = scoringTeamIsHome ? homeTeam : awayTeam;
                const opposingTeam = scoringTeamIsHome ? awayTeam : homeTeam;

                // Build goal notification payload
                const goalData = {
                    sport: 'shl', // Admin games are SHL for now
                    gameId: record.id,
                    scorerName: 'Goal',
                    scoringTeamCode: scoringTeam?.code || (scoringTeamIsHome ? record.homeTeamCode : record.awayTeamCode),
                    scoringTeamName: scoringTeam?.names?.long || scoringTeam?.names?.short || (scoringTeamIsHome ? record.homeTeamCode : record.awayTeamCode),
                    opposingTeamCode: opposingTeam?.code || (scoringTeamIsHome ? record.awayTeamCode : record.homeTeamCode),
                    opposingTeamName: opposingTeam?.names?.long || opposingTeam?.names?.short || (scoringTeamIsHome ? record.awayTeamCode : record.homeTeamCode),
                    homeTeamCode: record.homeTeamCode,
                    awayTeamCode: record.awayTeamCode,
                    homeScore: record.homeScore,
                    awayScore: record.awayScore,
                    time: '',
                    period: '',
                    isHomeTeam: scoringTeamIsHome
                };

                notificationResult = await pushNotifications.sendGoalNotification(goalData);
                console.log(`[Admin Games] Goal notification sent for game ${record.id}: ${record.homeScore}-${record.awayScore}`);
            }
        }

        res.json({
            ...formatAdminRecord(record, teamsByCode),
            notificationSent: notificationResult?.success || false
        });
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
        const provider = getProvider('shl');

        if (baseGames) {
            console.log('[Cache HIT] /api/games');

            // For live games, always fetch fresh scores even on cache hit
            const hasLiveGames = baseGames.some(g => g.state === 'live');
            if (hasLiveGames) {
                console.log('[Cache] Enriching live games with fresh scores...');
                baseGames = await provider.enrichGames(baseGames);
            }
        } else {
            usedCache = false;
            console.log('[Cache MISS] /api/games - fetching fresh data...');
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
        const now = new Date();
        const hasLiveGame = combinedGames.some(game => game.state === 'live');
        const hasStartingSoonGame = combinedGames.some(game =>
            game.state !== 'post-game'
            && game.state !== 'live'
            && isGameNearStart(game, now)
        );
        const shouldUseFastCache = shouldUseFastGamesCache(combinedGames, now);

        if (!usedCache) {
            setCachedGames(baseGames, shouldUseFastCache);
            if (shouldUseFastCache) {
                const reason = hasLiveGame ? 'Live game' : 'Game starting soon';
                console.log(`[Cache] ${reason} detected - using 15s cache duration`);
            }
        } else {
            setGamesLiveFlag(shouldUseFastCache);
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
        const provider = getProvider('shl');
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
        const provider = getProvider('shl');
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
        const provider = getProvider('shl');
        const details = await provider.fetchGameDetails(uuid);
        setCachedDetails(uuid, details);
        res.json(details);
    } catch (error) {
        console.error(`Error fetching game details for ${uuid}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    const providers = getAvailableSports().reduce((acc, sport) => {
        acc[sport] = getProvider(sport).getName();
        return acc;
    }, {});

    res.json({
        server: {
            uptime: process.uptime(),
            timestamp: formatSwedishTimestamp()
        },
        providers,
        availableSports: getAvailableSports(),
        notifier: notifier.getStats(),
        scheduler: scheduler.getStats(),
        goalWatcher: goalWatcher.getStats(),
        preGameWatcher: preGameWatcher.getStats(),
        pushNotifications: pushNotifications.getStats(),
        cache: getCacheStatus(),
        refreshRates: {
            gamesNormal: '60 seconds',
            gamesLive: '15 seconds (live/starting soon)',
            gameDetails: '30 seconds',
            videos: '60 seconds',
            standings: '5 minutes',
            biathlon: '30 minutes',
            allsvenskanGamesNormal: '60 seconds',
            allsvenskanGamesLive: '15 seconds (live/starting soon)',
            allsvenskanStandings: '5 minutes',
            notifierNormal: '5 minutes',
            notifierLive: '30 seconds',
            biathlonScheduler: '1 hour',
            goalWatcher: '15 seconds (live games)',
            preGameWatcher: '60 seconds'
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

/**
 * POST /api/biathlon/refresh
 * Force refresh the biathlon schedule
 */
app.post('/api/biathlon/refresh', async (req, res) => {
    console.log('[API] Manual biathlon refresh triggered');
    try {
        const races = await scheduler.forceRefreshBiathlon();

        if (races) {
            const validation = scheduler.validateBiathlonSchedule(races);
            res.json({
                message: 'Biathlon schedule refreshed',
                timestamp: formatSwedishTimestamp(),
                racesCount: races.length,
                validation
            });
        } else {
            res.status(500).json({ error: 'Failed to refresh biathlon schedule' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scheduler/status
 * Get scheduler status and statistics
 */
app.get('/api/scheduler/status', (req, res) => {
    res.json({
        timestamp: formatSwedishTimestamp(),
        scheduler: scheduler.getStats()
    });
});

// ============ PUSH NOTIFICATION ENDPOINTS ============

/**
 * GET /api/notifications/status
 * Get push notification service status
 */
app.get('/api/notifications/status', (req, res) => {
    res.json({
        timestamp: formatSwedishTimestamp(),
        pushNotifications: pushNotifications.getStats(),
        goalWatcher: goalWatcher.getStats(),
        preGameWatcher: preGameWatcher.getStats()
    });
});

/**
 * POST /api/notifications/test
 * Send a test notification (for debugging)
 */
app.post('/api/notifications/test', async (req, res) => {
    console.log('[API] Test notification triggered');

    if (!pushNotifications.isConfigured()) {
        return res.status(503).json({
            error: 'Push notifications not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
        });
    }

    try {
        const message = req.body?.message || 'Test notification from GamePulse!';
        const token = req.body?.token || null;
        const result = await pushNotifications.sendTestNotification({ message, token });
        res.json({
            success: result.success,
            message: 'Test notification sent',
            timestamp: formatSwedishTimestamp(),
            result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/goal-test
 * Send a simulated goal notification
 */
app.post('/api/notifications/goal-test', async (req, res) => {
    console.log('[API] Goal notification test triggered');

    if (!pushNotifications.isConfigured()) {
        return res.status(503).json({
            error: 'Push notifications not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables.'
        });
    }

    try {
        const payload = req.body || {};
        const scoringTeamCode = normalizeTeamCode(payload.scoringTeamCode || payload.scoringTeam);
        const opposingTeamCode = normalizeTeamCode(payload.opposingTeamCode || payload.opponentTeamCode);

        if (!scoringTeamCode || !opposingTeamCode) {
            return res.status(400).json({
                error: 'scoringTeamCode and opposingTeamCode are required.'
            });
        }

        const sport = payload.sport === 'allsvenskan' ? 'allsvenskan' : 'shl';
        const scoringIsHome = parseOptionalBoolean(payload.scoringIsHome, true);
        const homeTeamCode = normalizeTeamCode(payload.homeTeamCode)
            || (scoringIsHome ? scoringTeamCode : opposingTeamCode);
        const awayTeamCode = normalizeTeamCode(payload.awayTeamCode)
            || (scoringIsHome ? opposingTeamCode : scoringTeamCode);

        let homeScore = parseOptionalNumber(payload.homeScore);
        let awayScore = parseOptionalNumber(payload.awayScore);

        if (homeScore === null || awayScore === null) {
            if (scoringIsHome) {
                homeScore = homeScore ?? 1;
                awayScore = awayScore ?? 0;
            } else {
                homeScore = homeScore ?? 0;
                awayScore = awayScore ?? 1;
            }
        }

        const scorerName = payload.scorerName ? String(payload.scorerName).trim() : 'Test Scorer';
        const time = payload.time ? String(payload.time).trim() : (sport === 'shl' ? '12:34' : '54:21');
        const period = payload.period ? String(payload.period).trim() : (sport === 'shl' ? 'P1' : '1st half');
        const token = payload.token || null;
        const sendOpposing = parseOptionalBoolean(payload.sendOpposing, !token);

        const goalDetails = {
            sport,
            gameId: `test-${Date.now()}`,
            scorerName,
            scoringTeamCode,
            scoringTeamName: payload.scoringTeamName ? String(payload.scoringTeamName).trim() : scoringTeamCode,
            opposingTeamCode,
            opposingTeamName: payload.opposingTeamName ? String(payload.opposingTeamName).trim() : opposingTeamCode,
            homeTeamCode,
            awayTeamCode,
            homeScore,
            awayScore,
            time,
            period
        };

        const result = await pushNotifications.sendGoalNotification(goalDetails, { token, sendOpposing });

        res.json({
            success: result.success,
            message: 'Goal notification sent',
            timestamp: formatSwedishTimestamp(),
            result,
            sendOpposing,
            goal: {
                sport,
                scoringTeamCode,
                opposingTeamCode,
                homeTeamCode,
                awayTeamCode,
                homeScore,
                awayScore,
                scorerName,
                time,
                period
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/goal-watcher/check
 * Manually trigger a goal check
 */
app.post('/api/goal-watcher/check', async (req, res) => {
    console.log('[API] Manual goal watcher check triggered');

    try {
        const results = await goalWatcher.runCheck();
        res.json({
            message: 'Goal check completed',
            timestamp: formatSwedishTimestamp(),
            ...results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pre-game-watcher/check
 * Manually trigger a pre-game notification check
 */
app.post('/api/pre-game-watcher/check', async (req, res) => {
    console.log('[API] Manual pre-game watcher check triggered');

    try {
        const results = await preGameWatcher.runCheck();
        res.json({
            message: 'Pre-game check completed',
            timestamp: formatSwedishTimestamp(),
            ...results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ FCM DEVICE REGISTRATION ENDPOINTS ============

/**
 * POST /api/fcm/register
 * Register a device and subscribe to topics
 * Body: { token, topics: [], platform: 'ios'|'android' }
 */
app.post('/api/fcm/register', async (req, res) => {
    const { token, topics = [], platform = 'unknown' } = req.body || {};

    if (!token) {
        return res.status(400).json({ error: 'token is required' });
    }

    if (!Array.isArray(topics)) {
        return res.status(400).json({ error: 'topics must be an array' });
    }

    try {
        const result = await pushNotifications.registerDevice(token, topics, { platform });
        res.json({
            success: result.success,
            timestamp: formatSwedishTimestamp(),
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/fcm/unregister
 * Unregister a device
 * Body: { token }
 */
app.post('/api/fcm/unregister', async (req, res) => {
    const { token } = req.body || {};

    if (!token) {
        return res.status(400).json({ error: 'token is required' });
    }

    try {
        const result = await pushNotifications.unregisterDevice(token);
        res.json({
            success: result.success,
            timestamp: formatSwedishTimestamp(),
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/fcm/subscribers
 * Get subscriber stats for admin dashboard
 */
app.get('/api/fcm/subscribers', (req, res) => {
    const stats = pushNotifications.getSubscriberStats();
    res.json({
        timestamp: formatSwedishTimestamp(),
        ...stats
    });
});

/**
 * GET /api/fcm/topics
 * Get topic list with subscriber counts
 */
app.get('/api/fcm/topics', (req, res) => {
    const stats = pushNotifications.getSubscriberStats();
    res.json({
        timestamp: formatSwedishTimestamp(),
        topics: stats.topics
    });
});

/**
 * GET /api/fcm/topics/:topic
 * Get details for a specific topic
 */
app.get('/api/fcm/topics/:topic', (req, res) => {
    const topicName = req.params.topic;
    const details = pushNotifications.getTopicDetails(topicName);
    res.json({
        timestamp: formatSwedishTimestamp(),
        ...details
    });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    const providerNames = getAvailableSports().map(sport => getProvider(sport).getName());

    console.log(`\n========================================`);
    console.log(`  GamePulse API Server`);
    console.log(`========================================`);
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Available sports: ${getAvailableSports().join(', ')}`);
    console.log(`Providers: ${providerNames.join(', ')}`);
    console.log(`Started at: ${formatSwedishTimestamp()}`);
    console.log(`\nCache durations:`);
    console.log(`  - Games: 60s (15s during live/starting soon games)`);
    console.log(`  - Details: 30s`);
    console.log(`  - Videos: 60s`);
    console.log(`  - Standings: 5 minutes`);
    console.log(`  - Biathlon: 30 minutes`);
    console.log(`\nNotifier check intervals:`);
    console.log(`  - Normal: 5 minutes`);
    console.log(`  - Live games: 30 seconds`);
    console.log(`\nScheduler intervals:`);
    console.log(`  - Biathlon refresh: 1 hour`);
    console.log(`\nGoal Watcher:`);
    console.log(`  - Check interval: 15 seconds (live games)`);
    console.log(`  - Push notifications (FCM): ${pushNotifications.isConfigured() ? 'Configured' : 'Not configured (set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars)'}`);
    console.log(`\nPre-Game Watcher:`);
    console.log(`  - Check interval: 60 seconds`);
    console.log(`  - Reminder window: 5 minutes before start`);
    console.log(`========================================\n`);

    // Start the notifier loop after server is ready
    notifier.startLoop();

    // Start the scheduler for periodic updates
    scheduler.startLoop();

    // Start the goal watcher for push notifications
    goalWatcher.startLoop();

    // Start the pre-game watcher for upcoming game reminders
    preGameWatcher.startLoop();
});

// Export for testing
module.exports = { app };
