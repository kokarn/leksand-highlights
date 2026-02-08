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
            eventUnitName: unit.eventUnitName || '',
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

    async fetchStandings(options = {}) {
        console.log(`[${this.name}] Calculating group standings from game data...`);

        try {
            const games = await this.fetchAllGames();

            // Filter to completed group-stage games
            const completedGames = games.filter(g =>
                g.state === 'post-game' && g.eventUnitName.includes('Group')
            );

            // Optionally filter by gender
            const genderFilter = options.gender ? options.gender.toUpperCase() : null;
            const filteredGames = genderFilter
                ? completedGames.filter(g => g.genderCode === genderFilter)
                : completedGames;

            // Group games by their group name
            const groupGames = new Map();

            for (const game of filteredGames) {
                // Extract group name: "Women's Preliminary Round - Group A" → "Women - Group A"
                let groupName = game.eventUnitName;
                const groupMatch = groupName.match(/Group\s+[A-Z]/);
                if (groupMatch) {
                    const gender = game.genderCode === 'W' ? 'Women' : 'Men';
                    groupName = `${gender} - ${groupMatch[0]}`;
                }

                if (!groupGames.has(groupName)) {
                    groupGames.set(groupName, { gender: game.genderCode, games: [] });
                }
                groupGames.get(groupName).games.push(game);
            }

            // Build standings per group
            const groups = [];

            for (const [groupName, groupData] of groupGames) {
                const teamStats = new Map();

                for (const game of groupData.games) {
                    const homeTeam = game.homeTeamInfo;
                    const awayTeam = game.awayTeamInfo;

                    if (!homeTeam?.code || !awayTeam?.code) continue;

                    const homeScore = homeTeam.score ?? 0;
                    const awayScore = awayTeam.score ?? 0;

                    // Initialize team stats if not exists
                    for (const team of [homeTeam, awayTeam]) {
                        if (!teamStats.has(team.code)) {
                            teamStats.set(team.code, {
                                teamCode: team.code,
                                teamName: team.names?.long || team.names?.short || team.code,
                                teamShortName: team.names?.short || team.code,
                                gamesPlayed: 0,
                                wins: 0,
                                losses: 0,
                                points: 0,
                                goalsFor: 0,
                                goalsAgainst: 0
                            });
                        }
                    }

                    const homeStats = teamStats.get(homeTeam.code);
                    const awayStats = teamStats.get(awayTeam.code);

                    homeStats.gamesPlayed++;
                    awayStats.gamesPlayed++;

                    homeStats.goalsFor += homeScore;
                    homeStats.goalsAgainst += awayScore;
                    awayStats.goalsFor += awayScore;
                    awayStats.goalsAgainst += homeScore;

                    // Win = 3 pts, Loss = 0 pts (no OT detection available)
                    if (homeScore > awayScore) {
                        homeStats.wins++;
                        homeStats.points += 3;
                        awayStats.losses++;
                    } else {
                        awayStats.wins++;
                        awayStats.points += 3;
                        homeStats.losses++;
                    }
                }

                const standings = Array.from(teamStats.values())
                    .map(team => ({
                        ...team,
                        goalDiff: team.goalsFor - team.goalsAgainst
                    }))
                    .sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                        return b.goalsFor - a.goalsFor;
                    })
                    .map((team, index) => ({
                        position: index + 1,
                        ...team
                    }));

                groups.push({
                    name: groupName,
                    gender: groupData.gender,
                    standings
                });
            }

            // Sort groups: Women first, then Men, alphabetically within each
            groups.sort((a, b) => {
                if (a.gender !== b.gender) return a.gender === 'W' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            console.log(`[${this.name}] Calculated standings for ${groups.length} groups from ${filteredGames.length} games`);

            return {
                season: 'Milan-Cortina 2026',
                tournament: 'Olympics Ice Hockey',
                lastUpdated: new Date().toISOString(),
                gamesAnalyzed: filteredGames.length,
                groups
            };
        } catch (error) {
            console.error(`[${this.name}] Error calculating standings:`, error.message);
            throw error;
        }
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
