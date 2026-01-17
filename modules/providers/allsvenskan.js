const BaseProvider = require('./base');

/**
 * Allsvenskan (Swedish Football League) Data Provider
 *
 * Uses ESPN public APIs for fixtures, standings, and game summaries.
 */
class AllsvenskanProvider extends BaseProvider {
    constructor() {
        super('Allsvenskan');

        this.scoreboardBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/swe.1/scoreboard';
        this.summaryBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/swe.1/summary';
        this.standingsUrl = 'https://site.web.api.espn.com/apis/v2/sports/soccer/swe.1/standings';

        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        this.maxEvents = 400;
        this.maxHoursSinceGame = 36;
    }

    getSeasonYear(date = new Date()) {
        return date.getUTCFullYear();
    }

    getSeasonDateRange(year) {
        return {
            start: `${year}0101`,
            end: `${year}1231`
        };
    }

    async fetchSeasonEvents(year) {
        const { start, end } = this.getSeasonDateRange(year);
        const url = `${this.scoreboardBaseUrl}?dates=${start}-${end}&limit=${this.maxEvents}`;
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
            throw new Error(`[${this.name}] Scoreboard fetch failed (${response.status})`);
        }

        const data = await response.json();
        return Array.isArray(data?.events) ? data.events : [];
    }

    async fetchSeasonEventsSafe(year) {
        try {
            return await this.fetchSeasonEvents(year);
        } catch (error) {
            console.warn(`[${this.name}] Failed to fetch ${year} schedule:`, error.message);
            return [];
        }
    }

    normalizeState(status) {
        const state = status?.type?.state;

        if (state === 'in') return 'live';
        if (state === 'post') return 'post-game';
        if (state === 'pre') return 'pre-game';
        if (status?.type?.completed) return 'post-game';

        return 'pre-game';
    }

    parseScore(rawScore, state) {
        if (state === 'pre-game') {
            return null;
        }
        if (rawScore === undefined || rawScore === null || rawScore === '') {
            return null;
        }
        const parsed = Number(rawScore);
        return Number.isNaN(parsed) ? null : parsed;
    }

    getTeamLogo(team) {
        if (!team) return null;
        if (team.logo) return team.logo;
        if (Array.isArray(team.logos) && team.logos.length > 0) {
            return team.logos[0].href || team.logos[0].url || null;
        }
        return null;
    }

    getTeamNames(team) {
        const shortName = team?.shortDisplayName || team?.displayName || team?.name || team?.abbreviation || null;
        const longName = team?.displayName || team?.name || shortName || team?.abbreviation || null;
        return {
            short: shortName || 'Unknown',
            long: longName || shortName || 'Unknown'
        };
    }

    normalizeTeam(competitor, state) {
        if (!competitor) {
            return null;
        }

        const team = competitor.team || {};
        const names = this.getTeamNames(team);

        return {
            code: team.abbreviation || names.short,
            uuid: team.id || competitor.id || null,
            names,
            score: this.parseScore(competitor.score, state),
            icon: this.getTeamLogo(team)
        };
    }

    normalizeEvent(event) {
        if (!event) {
            return null;
        }

        const competition = event.competitions?.[0] || {};
        const status = competition.status || event.status;
        const state = this.normalizeState(status);
        const competitors = competition.competitors || [];
        const homeCompetitor = competitors.find(c => c.homeAway === 'home') || competitors[0] || null;
        const awayCompetitor = competitors.find(c => c.homeAway === 'away') || competitors[1] || null;
        const startDateTime = event.date || competition.date || null;
        const venueName = competition.venue?.fullName
            || competition.venue?.shortName
            || event.venue?.fullName
            || event.venue?.shortName
            || null;

        const gameId = event.id || competition.id;
        if (!gameId || !startDateTime || !homeCompetitor || !awayCompetitor) {
            return null;
        }

        return {
            uuid: String(gameId),
            startDateTime,
            state,
            homeTeamInfo: this.normalizeTeam(homeCompetitor, state),
            awayTeamInfo: this.normalizeTeam(awayCompetitor, state),
            venueInfo: {
                name: venueName
            },
            statusText: status?.type?.detail || status?.type?.shortDetail || null,
            sport: 'allsvenskan',
            source: 'espn'
        };
    }

    normalizeEvents(events) {
        return events
            .map(event => this.normalizeEvent(event))
            .filter(Boolean);
    }

    mergeGamesById(...gameLists) {
        const merged = new Map();
        gameLists.flat().forEach(game => {
            if (!game?.uuid) return;
            merged.set(game.uuid, game);
        });
        return Array.from(merged.values());
    }

    async fetchAllGames() {
        const year = this.getSeasonYear();
        const now = new Date();
        const events = await this.fetchSeasonEventsSafe(year);
        const games = this.normalizeEvents(events);
        const hasFutureGames = games.some(game => new Date(game.startDateTime) >= now);
        const hasPastGames = games.some(game => new Date(game.startDateTime) < now);

        const extraEventBatches = [];

        if (!hasFutureGames) {
            const nextYear = year + 1;
            extraEventBatches.push(await this.fetchSeasonEventsSafe(nextYear));
        }

        if (!hasPastGames) {
            const previousYear = year - 1;
            extraEventBatches.push(await this.fetchSeasonEventsSafe(previousYear));
        }

        const extraEvents = extraEventBatches.flat();
        const extraGames = extraEvents.length ? this.normalizeEvents(extraEvents) : [];
        const mergedGames = this.mergeGamesById(games, extraGames);

        return mergedGames.sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    }

    async fetchActiveGames() {
        const games = await this.fetchAllGames();
        const now = new Date();

        return games.filter(game => {
            const startTime = new Date(game.startDateTime);
            if (Number.isNaN(startTime.getTime())) {
                return false;
            }

            const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

            if (game.state === 'post-game') {
                return hoursSinceStart >= -1 && hoursSinceStart <= this.maxHoursSinceGame;
            }
            if (game.state === 'live') {
                return true;
            }
            if (game.state === 'pre-game' && hoursSinceStart >= 0) {
                return hoursSinceStart <= 6;
            }

            return false;
        });
    }

    async fetchGameVideos(gameId) {
        return [];
    }

    async fetchGameDetails(gameId) {
        const url = `${this.summaryBaseUrl}?event=${gameId}`;
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`[${this.name}] Summary fetch failed (${response.status})`);
        }

        const data = await response.json();
        const competition = data?.header?.competitions?.[0] || {};
        const status = competition.status || null;
        const state = this.normalizeState(status);
        const competitors = competition.competitors || [];
        const homeCompetitor = competitors.find(c => c.homeAway === 'home') || competitors[0] || null;
        const awayCompetitor = competitors.find(c => c.homeAway === 'away') || competitors[1] || null;
        const startDateTime = competition.date || data?.header?.competitions?.[0]?.date || null;
        const venueName = data?.gameInfo?.venue?.fullName
            || data?.gameInfo?.venue?.shortName
            || competition.venue?.fullName
            || competition.venue?.shortName
            || null;

        const info = {
            uuid: String(gameId),
            startDateTime,
            state,
            homeTeamInfo: this.normalizeTeam(homeCompetitor, state),
            awayTeamInfo: this.normalizeTeam(awayCompetitor, state),
            venueInfo: {
                name: venueName
            },
            statusText: status?.type?.detail || status?.type?.shortDetail || null,
            sport: 'allsvenskan',
            source: 'espn'
        };

        return {
            info,
            venue: data?.gameInfo?.venue || null,
            boxscore: data?.boxscore || null,
            format: data?.format || null
        };
    }

    getStatValue(stats, statName) {
        const stat = stats?.find(item => item.name === statName);
        if (!stat) {
            return null;
        }
        if (stat.value === undefined || stat.value === null || stat.value === '') {
            return null;
        }
        const parsed = Number(stat.value);
        return Number.isNaN(parsed) ? stat.value : parsed;
    }

    normalizeSeasonOptions(seasons, fallbackSeason) {
        const normalized = (Array.isArray(seasons) ? seasons : [])
            .map(season => season?.year ?? season?.season ?? season?.value ?? season)
            .map(value => (value === null || value === undefined ? null : String(value)))
            .filter(Boolean);

        if (fallbackSeason && !normalized.includes(String(fallbackSeason))) {
            normalized.unshift(String(fallbackSeason));
        }

        const unique = Array.from(new Set(normalized));
        return unique.sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
                return numB - numA;
            }
            return b.localeCompare(a);
        });
    }

    async fetchStandingsData(url) {
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
            throw new Error(`[${this.name}] Standings fetch failed (${response.status})`);
        }

        return response.json();
    }

    async fetchStandings(options = {}) {
        const season = options.season ? String(options.season).trim() : null;
        const url = season ? `${this.standingsUrl}?season=${encodeURIComponent(season)}` : this.standingsUrl;
        let data;

        try {
            data = await this.fetchStandingsData(url);
        } catch (error) {
            if (!season) {
                throw error;
            }
            console.warn(`[${this.name}] Season ${season} standings failed, falling back:`, error.message);
            data = await this.fetchStandingsData(this.standingsUrl);
        }

        const group = data?.children?.[0] || {};
        const entries = group?.standings?.entries || [];
        const resolvedSeason = data?.seasons?.[0]?.year
            || data?.season?.year
            || season
            || this.getSeasonYear();
        const availableSeasons = this.normalizeSeasonOptions(data?.seasons, resolvedSeason);

        const standings = entries.map(entry => {
            const team = entry.team || {};
            const stats = entry.stats || [];
            const goalsFor = this.getStatValue(stats, 'pointsFor');
            const goalsAgainst = this.getStatValue(stats, 'pointsAgainst');

            return {
                position: this.getStatValue(stats, 'rank'),
                teamCode: team.abbreviation || team.shortDisplayName || team.displayName || null,
                teamName: team.displayName || team.name || team.abbreviation || null,
                teamShortName: team.shortDisplayName || team.abbreviation || null,
                teamUuid: team.id || null,
                teamIcon: team.logos?.[0]?.href || null,
                gamesPlayed: this.getStatValue(stats, 'gamesPlayed'),
                wins: this.getStatValue(stats, 'wins'),
                draws: this.getStatValue(stats, 'ties'),
                losses: this.getStatValue(stats, 'losses'),
                points: this.getStatValue(stats, 'points'),
                goalsFor,
                goalsAgainst,
                goalDiff: this.getStatValue(stats, 'pointDifferential'),
                note: entry.note?.description || null
            };
        });

        return {
            season: String(resolvedSeason),
            league: group?.name || 'Allsvenskan',
            lastUpdated: new Date().toISOString(),
            standings,
            source: 'espn',
            availableSeasons
        };
    }

    isHighlight(video) {
        return false;
    }

    getGameDisplayInfo(game) {
        return {
            homeTeam: game.homeTeamInfo?.names?.short || game.homeTeamInfo?.code || 'Unknown',
            awayTeam: game.awayTeamInfo?.names?.short || game.awayTeamInfo?.code || 'Unknown',
            homeTeamCode: game.homeTeamInfo?.code,
            awayTeamCode: game.awayTeamInfo?.code,
            venue: game.venueInfo?.name || 'arena',
            gameId: game.uuid,
            state: game.state,
            startTime: game.startDateTime
        };
    }

    getVideoUrl(video) {
        return '';
    }

    getVideoThumbnail(video) {
        return null;
    }
}

module.exports = AllsvenskanProvider;
