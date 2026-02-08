const BaseProvider = require('./base');

/**
 * Olympics Hockey Data Provider (2026 Milan-Cortina)
 *
 * Fetches ice hockey game data from the official Olympics schedule API.
 * Normalizes data to match the app's existing game format (same as SHL).
 */
class OlympicsHockeyProvider extends BaseProvider {
    constructor() {
        super('Olympics Hockey');

        this.scheduleUrl = 'https://www.olympics.com/wmr-owg2026/schedules/api/ENG/schedule/discipline/IHO';

        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
    }

    /**
     * Map Olympics status to app state
     */
    mapStatus(status, liveFlag) {
        if (liveFlag || status === 'RUNNING') return 'live';
        if (status === 'FINISHED') return 'post-game';
        return 'pre-game'; // SCHEDULED, RESCHEDULED, etc.
    }

    /**
     * Normalize a single Olympics unit to match the app's game format
     */
    normalizeUnit(unit) {
        const competitors = unit.competitors || [];
        const home = competitors[0] || {};
        const away = competitors[1] || {};

        const homeScore = home.results?.mark != null ? Number(home.results.mark) : null;
        const awayScore = away.results?.mark != null ? Number(away.results.mark) : null;

        const state = this.mapStatus(unit.status, unit.liveFlag);

        // Build phase description
        let phaseLabel = '';
        if (unit.eventUnitName) {
            phaseLabel = unit.eventUnitName;
        } else if (unit.phaseName) {
            phaseLabel = unit.phaseName;
        }

        return {
            uuid: unit.id,
            state,
            startDateTime: unit.startDate,
            rawStartDateTime: unit.startDate,
            league: 'Olympics',
            sport: 'olympics-hockey',
            homeTeamInfo: {
                code: home.noc || '',
                names: {
                    short: home.noc || '',
                    long: home.name || home.noc || ''
                },
                score: homeScore
            },
            awayTeamInfo: {
                code: away.noc || '',
                names: {
                    short: away.noc || '',
                    long: away.name || away.noc || ''
                },
                score: awayScore
            },
            homeTeamResult: { score: homeScore },
            awayTeamResult: { score: awayScore },
            genderCode: unit.genderCode || '',
            phaseName: phaseLabel,
            venueInfo: {
                name: unit.venueDescription || ''
            },
            liveFlag: unit.liveFlag || false
        };
    }

    async fetchAllGames() {
        const response = await fetch(this.scheduleUrl, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const units = data?.units || [];
        return units.map(unit => this.normalizeUnit(unit));
    }

    async fetchActiveGames() {
        console.log(`[${this.name}] Fetching active games...`);
        try {
            const games = await this.fetchAllGames();
            const now = new Date();

            return games.filter(game => {
                if (game.state === 'live') return true;

                const startTime = new Date(game.startDateTime);
                const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

                if (game.state === 'post-game') {
                    return hoursSinceStart >= -1 && hoursSinceStart <= 6;
                }
                // Upcoming within next 2 hours
                if (game.state === 'pre-game') {
                    return hoursSinceStart >= -2 && hoursSinceStart <= 4;
                }
                return false;
            });
        } catch (error) {
            console.error(`[${this.name}] Error fetching active games:`, error.message);
            return [];
        }
    }

    async fetchGameDetails(gameId) {
        // No play-by-play API available for Olympics
        // Return minimal details from schedule data
        const games = await this.fetchAllGames();
        const game = games.find(g => g.uuid === gameId);

        if (!game) return null;

        return {
            info: {
                gameInfo: {
                    gameUuid: game.uuid,
                    startDateTime: game.startDateTime,
                    arenaName: game.venueInfo?.name || null,
                    state: game.state
                },
                homeTeam: game.homeTeamInfo,
                awayTeam: game.awayTeamInfo
            },
            teamStats: null,
            events: {
                goals: [],
                penalties: [],
                periods: [],
                all: []
            }
        };
    }

    async enrichGames(games) {
        // Scores are already in the schedule data
        return games;
    }

    async fetchGameVideos() {
        return [];
    }

    isHighlight() {
        return false;
    }

    getGameDisplayInfo(game) {
        return {
            homeTeam: game.homeTeamInfo?.names?.short || game.homeTeamInfo?.code || 'Unknown',
            awayTeam: game.awayTeamInfo?.names?.short || game.awayTeamInfo?.code || 'Unknown',
            homeTeamCode: game.homeTeamInfo?.code,
            awayTeamCode: game.awayTeamInfo?.code,
            venue: game.venueInfo?.name || '',
            gameId: game.uuid,
            state: game.state,
            startTime: game.startDateTime
        };
    }

    getVideoUrl() {
        return '';
    }

    getVideoThumbnail() {
        return null;
    }
}

module.exports = OlympicsHockeyProvider;
