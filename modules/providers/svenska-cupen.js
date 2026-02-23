const BaseProvider = require('./base');

const INVISIBLE_TIME_CHARS_REGEX = /[\u200e\u200f\u202a-\u202e]/g;

/**
 * Svenska Cupen (Swedish Cup) Data Provider
 *
 * Data source:
 * - FotMob league API (id=171) for fixtures/live scores
 * - FotMob match page (__NEXT_DATA__) for richer match details
 */
class SvenskaCupenProvider extends BaseProvider {
    constructor() {
        super('Svenska Cupen');

        this.leagueId = '171';
        this.leagueApiUrl = 'https://www.fotmob.com/api/leagues';
        this.webBaseUrl = 'https://www.fotmob.com';
        this.maxHoursSinceGame = 36;

        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        };
    }

    buildLeagueUrl(options = {}) {
        const url = new URL(this.leagueApiUrl);
        url.searchParams.set('id', this.leagueId);

        const season = options.season ? String(options.season).trim() : '';
        if (season) {
            url.searchParams.set('season', season);
        }

        return url.toString();
    }

    async fetchLeagueData(options = {}) {
        const url = this.buildLeagueUrl(options);
        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
            throw new Error(`[${this.name}] League fetch failed (${response.status})`);
        }

        return response.json();
    }

    getTeamLogoUrl(teamId) {
        if (!teamId) {
            return null;
        }
        return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`;
    }

    cleanLiveTime(value) {
        if (!value) {
            return '';
        }
        return String(value).replace(INVISIBLE_TIME_CHARS_REGEX, '').trim();
    }

    normalizeState(status) {
        if (!status || typeof status !== 'object') {
            return 'pre-game';
        }
        if (status.cancelled) {
            return 'post-game';
        }
        if (status.ongoing || (status.started && !status.finished)) {
            return 'live';
        }
        if (status.finished) {
            return 'post-game';
        }
        return 'pre-game';
    }

    parseScoreString(scoreStr) {
        if (!scoreStr) {
            return [null, null];
        }
        const match = String(scoreStr).match(/(\d+)\s*-\s*(\d+)/);
        if (!match) {
            return [null, null];
        }
        return [Number(match[1]), Number(match[2])];
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

    getTeamCode(team) {
        const shortName = team?.shortName ? String(team.shortName).trim() : '';
        if (shortName) {
            return shortName;
        }
        const name = team?.name ? String(team.name).trim() : '';
        if (name) {
            return name;
        }
        if (team?.id) {
            return String(team.id);
        }
        return 'Unknown';
    }

    normalizeTeam(team, score, state) {
        const shortName = team?.shortName ? String(team.shortName).trim() : '';
        const longName = team?.name ? String(team.name).trim() : '';
        const code = this.getTeamCode(team);

        return {
            code,
            uuid: team?.id ? String(team.id) : null,
            names: {
                short: shortName || longName || code,
                long: longName || shortName || code
            },
            score: this.parseScore(score, state),
            icon: this.getTeamLogoUrl(team?.id)
        };
    }

    getMatchStatusText(status, state) {
        if (!status || typeof status !== 'object') {
            return null;
        }

        if (state === 'live') {
            const liveShort = this.cleanLiveTime(status?.liveTime?.short);
            if (liveShort) {
                return liveShort;
            }
            const liveLong = status?.liveTime?.long;
            if (liveLong) {
                return String(liveLong);
            }
            return status?.reason?.short || 'LIVE';
        }

        if (state === 'post-game') {
            return status?.reason?.short || 'FT';
        }

        return status?.reason?.short || null;
    }

    extractMatchesFromLeagueData(data) {
        const fixturesMatches = data?.fixtures?.allMatches;
        if (Array.isArray(fixturesMatches)) {
            return fixturesMatches;
        }

        const overviewMatches = data?.overview?.leagueOverviewMatches;
        if (Array.isArray(overviewMatches)) {
            return overviewMatches;
        }

        const nestedOverviewMatches = data?.overview?.matches?.allMatches;
        if (Array.isArray(nestedOverviewMatches)) {
            return nestedOverviewMatches;
        }

        return [];
    }

    normalizeMatch(match) {
        if (!match) {
            return null;
        }

        const gameId = match.id ? String(match.id) : null;
        const status = match.status || {};
        const state = this.normalizeState(status);
        const startDateTime = status.utcTime || null;

        if (!gameId || !startDateTime) {
            return null;
        }

        const [scoreFromStatusHome, scoreFromStatusAway] = this.parseScoreString(status.scoreStr);
        const homeRawScore = match?.home?.score ?? scoreFromStatusHome;
        const awayRawScore = match?.away?.score ?? scoreFromStatusAway;

        const homeTeamInfo = this.normalizeTeam(match.home, homeRawScore, state);
        const awayTeamInfo = this.normalizeTeam(match.away, awayRawScore, state);

        if (!homeTeamInfo || !awayTeamInfo) {
            return null;
        }

        return {
            uuid: gameId,
            startDateTime,
            rawStartDateTime: startDateTime,
            state,
            homeTeamInfo,
            awayTeamInfo,
            venueInfo: {
                name: null
            },
            statusText: this.getMatchStatusText(status, state),
            round: match.roundName || match.round || null,
            stage: match?.tournament?.stage || null,
            sport: 'svenska-cupen',
            source: 'fotmob',
            pageUrl: match.pageUrl || null
        };
    }

    normalizeMatches(matches) {
        return (Array.isArray(matches) ? matches : [])
            .map(match => this.normalizeMatch(match))
            .filter(Boolean);
    }

    async fetchAllGames(options = {}) {
        const data = await this.fetchLeagueData(options);
        const matches = this.extractMatchesFromLeagueData(data);
        const games = this.normalizeMatches(matches);

        const getTimeValue = (value) => {
            const time = new Date(value).getTime();
            return Number.isNaN(time) ? 0 : time;
        };

        return games.sort((a, b) => getTimeValue(b.startDateTime) - getTimeValue(a.startDateTime));
    }

    async fetchActiveGames() {
        const games = await this.fetchAllGames();
        const now = Date.now();

        return games.filter(game => {
            if (game.state === 'live') {
                return true;
            }

            const startTime = new Date(game.startDateTime).getTime();
            if (Number.isNaN(startTime)) {
                return false;
            }

            const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

            if (game.state === 'post-game') {
                return hoursSinceStart >= -1 && hoursSinceStart <= this.maxHoursSinceGame;
            }

            if (game.state === 'pre-game') {
                const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
                return hoursUntilStart >= 0 && hoursUntilStart <= 6;
            }

            return false;
        });
    }

    resolveMatchPageUrl(pageUrl) {
        if (!pageUrl) {
            return null;
        }
        if (String(pageUrl).startsWith('http')) {
            return String(pageUrl);
        }
        return `${this.webBaseUrl}${pageUrl}`;
    }

    extractNextDataJson(html) {
        if (!html) {
            return null;
        }

        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (!match || !match[1]) {
            return null;
        }

        try {
            return JSON.parse(match[1]);
        } catch (_error) {
            return null;
        }
    }

    async fetchMatchPageProps(pageUrl) {
        const resolvedUrl = this.resolveMatchPageUrl(pageUrl);
        if (!resolvedUrl) {
            return null;
        }

        const response = await fetch(resolvedUrl, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`[${this.name}] Match page fetch failed (${response.status})`);
        }

        const html = await response.text();
        const nextData = this.extractNextDataJson(html);

        if (!nextData?.props?.pageProps) {
            throw new Error(`[${this.name}] Match page payload missing pageProps`);
        }

        return nextData.props.pageProps;
    }

    inferPeriod(minuteValue) {
        const minute = Number(minuteValue);
        if (Number.isNaN(minute)) {
            return {
                number: 1,
                display: '1st half'
            };
        }
        if (minute <= 45) {
            return {
                number: 1,
                display: '1st half'
            };
        }
        if (minute <= 90) {
            return {
                number: 2,
                display: '2nd half'
            };
        }
        return {
            number: 3,
            display: 'Extra time'
        };
    }

    formatIncidentClock(incident) {
        if (!incident) {
            return null;
        }

        if (incident.halfStrShort) {
            return String(incident.halfStrShort);
        }

        const baseTime = Number(incident.timeStr ?? incident.time);
        const overloadTime = Number(incident.overloadTime);
        if (!Number.isNaN(baseTime)) {
            if (!Number.isNaN(overloadTime) && overloadTime > 0) {
                return `${baseTime}+${overloadTime}'`;
            }
            return `${baseTime}'`;
        }

        return null;
    }

    getIncidentTeamInfo(incident, homeTeamInfo, awayTeamInfo) {
        if (incident?.isHome === true) {
            return {
                teamCode: homeTeamInfo?.code || null,
                teamName: homeTeamInfo?.names?.long || homeTeamInfo?.names?.short || null,
                isHome: true
            };
        }
        if (incident?.isHome === false) {
            return {
                teamCode: awayTeamInfo?.code || null,
                teamName: awayTeamInfo?.names?.long || awayTeamInfo?.names?.short || null,
                isHome: false
            };
        }
        return {
            teamCode: null,
            teamName: null,
            isHome: null
        };
    }

    buildPlayer(player, fallbackName = null) {
        if (player?.id || player?.name || fallbackName) {
            return {
                id: player?.id ? String(player.id) : null,
                name: player?.name || fallbackName || null,
                firstName: player?.firstName || null,
                lastName: player?.lastName || null,
                jersey: player?.shirtNumber || null
            };
        }
        return null;
    }

    extractGoalType(incident) {
        if (incident?.ownGoal) {
            return 'Own Goal';
        }
        if (incident?.isPenaltyShootoutEvent) {
            return 'Penalty Shootout';
        }
        if (incident?.goalDescription) {
            return String(incident.goalDescription);
        }
        return 'Goal';
    }

    buildIncidentText(incident, defaultText) {
        if (incident?.nameStr) {
            return String(incident.nameStr);
        }
        if (incident?.fullName) {
            return String(incident.fullName);
        }
        if (incident?.player?.name) {
            return String(incident.player.name);
        }
        return defaultText;
    }

    extractEvents(incidents, homeTeamInfo, awayTeamInfo) {
        const goals = [];
        const cards = [];
        const substitutions = [];
        const all = [];

        for (const incident of (Array.isArray(incidents) ? incidents : [])) {
            const incidentType = String(incident?.type || '').toLowerCase();
            const teamInfo = this.getIncidentTeamInfo(incident, homeTeamInfo, awayTeamInfo);
            const period = this.inferPeriod(incident?.timeStr ?? incident?.time);
            const clock = this.formatIncidentClock(incident);

            const baseEvent = {
                id: incident?.eventId ? String(incident.eventId) : null,
                clock,
                period: period.number,
                periodDisplay: period.display,
                text: this.buildIncidentText(incident, incident?.type || null),
                teamCode: teamInfo.teamCode,
                teamName: teamInfo.teamName,
                isHome: teamInfo.isHome
            };

            if (incidentType === 'goal') {
                const score = Array.isArray(incident?.newScore) && incident.newScore.length >= 2
                    ? { home: Number(incident.newScore[0]), away: Number(incident.newScore[1]) }
                    : {
                        home: incident?.homeScore ?? null,
                        away: incident?.awayScore ?? null
                    };

                const goal = {
                    ...baseEvent,
                    type: 'goal',
                    time: clock,
                    teamUuid: teamInfo.isHome === true ? homeTeamInfo?.uuid : awayTeamInfo?.uuid,
                    eventTeam: {
                        place: teamInfo.isHome === true ? 'home' : teamInfo.isHome === false ? 'away' : null,
                        teamId: teamInfo.isHome === true ? homeTeamInfo?.uuid : awayTeamInfo?.uuid
                    },
                    homeGoals: score.home,
                    awayGoals: score.away,
                    scorer: this.buildPlayer(incident.player, incident?.nameStr || null),
                    assist: incident?.assistStr ? { name: String(incident.assistStr) } : null,
                    goalType: this.extractGoalType(incident),
                    score
                };
                goals.push(goal);
                all.push(goal);
                continue;
            }

            if (incidentType === 'card') {
                const cardTypeRaw = String(incident?.card || '').toLowerCase();
                const card = {
                    ...baseEvent,
                    type: 'card',
                    cardType: cardTypeRaw.includes('red') ? 'red' : 'yellow',
                    player: this.buildPlayer(incident.player, incident?.nameStr || null),
                    reason: incident?.cardDescription || incident?.card || null
                };
                cards.push(card);
                all.push(card);
                continue;
            }

            if (incidentType === 'substitution') {
                const swap = Array.isArray(incident?.swap) ? incident.swap : [];
                const playerInRaw = swap[0] || null;
                const playerOutRaw = swap[1] || null;

                const playerIn = this.buildPlayer(
                    playerInRaw ? { id: playerInRaw.id, name: playerInRaw.name } : null,
                    playerInRaw?.name || null
                );
                const playerOut = this.buildPlayer(
                    playerOutRaw ? { id: playerOutRaw.id, name: playerOutRaw.name } : null,
                    playerOutRaw?.name || null
                );

                const substitutionText = playerIn?.name && playerOut?.name
                    ? `${playerIn.name} for ${playerOut.name}`
                    : baseEvent.text;

                const substitution = {
                    ...baseEvent,
                    type: 'substitution',
                    text: substitutionText,
                    playerIn,
                    playerOut
                };
                substitutions.push(substitution);
                all.push(substitution);
                continue;
            }

            all.push({
                ...baseEvent,
                type: incidentType || 'other'
            });
        }

        const parseClockToNumber = (clockValue) => {
            if (!clockValue) {
                return 0;
            }
            const match = String(clockValue).match(/(\d+)/);
            return match ? Number(match[1]) : 0;
        };

        const sortByTime = (a, b) => {
            const periodDiff = (a.period || 1) - (b.period || 1);
            if (periodDiff !== 0) {
                return periodDiff;
            }
            return parseClockToNumber(a.clock) - parseClockToNumber(b.clock);
        };

        goals.sort(sortByTime);
        cards.sort(sortByTime);
        substitutions.sort(sortByTime);
        all.sort(sortByTime);

        return {
            goals,
            cards,
            substitutions,
            all
        };
    }

    extractRosters(lineup) {
        if (!lineup || typeof lineup !== 'object') {
            return null;
        }

        const mapTeam = (team, homeAway) => {
            if (!team || typeof team !== 'object') {
                return null;
            }

            const starters = Array.isArray(team.starters) ? team.starters : [];
            const subs = Array.isArray(team.subs) ? team.subs : [];
            const players = [
                ...starters.map(player => ({ ...player, starter: true })),
                ...subs.map(player => ({ ...player, starter: false }))
            ];

            return {
                teamId: team.id ? String(team.id) : null,
                teamName: team.name || null,
                teamCode: team.name || null,
                homeAway,
                formation: team.formation || null,
                players: players.map(player => ({
                    id: player.id ? String(player.id) : null,
                    name: player.name || null,
                    firstName: player.firstName || null,
                    lastName: player.lastName || null,
                    jersey: player.shirtNumber || null,
                    position: player.usualPlayingPositionId || player.positionId || null,
                    starter: Boolean(player.starter)
                }))
            };
        };

        const rosters = [
            mapTeam(lineup.homeTeam, 'home'),
            mapTeam(lineup.awayTeam, 'away')
        ].filter(Boolean);

        return rosters.length > 0 ? rosters : null;
    }

    extractVenueName(pageProps) {
        const infoBox = pageProps?.content?.matchFacts?.infoBox;
        const stadium = infoBox?.Stadium;

        if (!stadium) {
            return null;
        }
        if (typeof stadium === 'string') {
            return stadium || null;
        }
        if (typeof stadium === 'object') {
            return stadium.name || stadium.text || null;
        }
        return null;
    }

    buildFallbackDetails(game) {
        return {
            info: {
                uuid: String(game.uuid),
                startDateTime: game.startDateTime,
                state: game.state,
                homeTeamInfo: game.homeTeamInfo,
                awayTeamInfo: game.awayTeamInfo,
                venueInfo: {
                    name: game.venueInfo?.name || null
                },
                statusText: game.statusText || null,
                sport: 'svenska-cupen',
                source: 'fotmob'
            },
            venue: null,
            teamStats: null,
            events: {
                goals: [],
                cards: [],
                substitutions: [],
                all: []
            },
            rosters: null,
            commentary: null
        };
    }

    async fetchGameDetails(gameId) {
        const games = await this.fetchAllGames();
        const game = games.find(item => String(item.uuid) === String(gameId));

        if (!game) {
            return null;
        }

        if (!game.pageUrl) {
            return this.buildFallbackDetails(game);
        }

        try {
            const pageProps = await this.fetchMatchPageProps(game.pageUrl);
            const general = pageProps?.general || {};
            const status = pageProps?.header?.status || {};
            const state = this.normalizeState(status);
            const [homeScoreFromStatus, awayScoreFromStatus] = this.parseScoreString(status.scoreStr);
            const startDateTime = status.utcTime
                || general.matchTimeUTC
                || general.matchTimeUTCDate
                || game.startDateTime;

            const homeTeamInfo = this.normalizeTeam(
                {
                    id: general?.homeTeam?.id ?? game?.homeTeamInfo?.uuid,
                    name: general?.homeTeam?.name ?? game?.homeTeamInfo?.names?.long,
                    shortName: general?.homeTeam?.name ?? game?.homeTeamInfo?.names?.short
                },
                game?.homeTeamInfo?.score ?? homeScoreFromStatus,
                state
            );

            const awayTeamInfo = this.normalizeTeam(
                {
                    id: general?.awayTeam?.id ?? game?.awayTeamInfo?.uuid,
                    name: general?.awayTeam?.name ?? game?.awayTeamInfo?.names?.long,
                    shortName: general?.awayTeam?.name ?? game?.awayTeamInfo?.names?.short
                },
                game?.awayTeamInfo?.score ?? awayScoreFromStatus,
                state
            );

            const incidents = pageProps?.content?.matchFacts?.events?.events || [];
            const events = this.extractEvents(incidents, homeTeamInfo, awayTeamInfo);
            const rosters = this.extractRosters(pageProps?.content?.lineup);
            const venueName = this.extractVenueName(pageProps) || game?.venueInfo?.name || null;

            return {
                info: {
                    uuid: String(gameId),
                    startDateTime,
                    state,
                    homeTeamInfo,
                    awayTeamInfo,
                    venueInfo: {
                        name: venueName
                    },
                    statusText: this.getMatchStatusText(status, state),
                    sport: 'svenska-cupen',
                    source: 'fotmob'
                },
                venue: venueName ? { name: venueName } : null,
                teamStats: null,
                events,
                rosters,
                commentary: null
            };
        } catch (error) {
            console.warn(`[${this.name}] Detail fallback for game ${gameId}:`, error.message);
            return this.buildFallbackDetails(game);
        }
    }

    normalizeSeasonOptions(seasons, fallbackSeason) {
        const normalized = (Array.isArray(seasons) ? seasons : [])
            .map(value => (value === null || value === undefined ? null : String(value).trim()))
            .filter(Boolean);

        if (fallbackSeason) {
            const fallback = String(fallbackSeason).trim();
            if (fallback && !normalized.includes(fallback)) {
                normalized.unshift(fallback);
            }
        }

        const unique = Array.from(new Set(normalized));
        return unique.sort((a, b) => this.compareSeasonLabels(a, b));
    }

    parseSeasonSortValue(label) {
        const match = String(label).match(/(\d{4})/);
        if (!match) {
            return Number.NaN;
        }
        return Number(match[1]);
    }

    compareSeasonLabels(a, b) {
        const seasonA = this.parseSeasonSortValue(a);
        const seasonB = this.parseSeasonSortValue(b);

        if (!Number.isNaN(seasonA) && !Number.isNaN(seasonB) && seasonA !== seasonB) {
            return seasonB - seasonA;
        }

        return String(b).localeCompare(String(a));
    }

    parseGoalsForAgainst(scoreString) {
        if (!scoreString) {
            return { goalsFor: null, goalsAgainst: null };
        }
        const match = String(scoreString).match(/(-?\d+)\s*-\s*(-?\d+)/);
        if (!match) {
            return { goalsFor: null, goalsAgainst: null };
        }
        return {
            goalsFor: Number(match[1]),
            goalsAgainst: Number(match[2])
        };
    }

    async fetchStandings(options = {}) {
        const season = options.season ? String(options.season).trim() : null;
        const data = await this.fetchLeagueData({ season });
        const tables = data?.table?.[0]?.data?.tables;
        const selectedSeason = data?.details?.selectedSeason || season || null;
        const availableSeasons = this.normalizeSeasonOptions(data?.allAvailableSeasons, selectedSeason);

        const groups = (Array.isArray(tables) ? tables : [])
            .map((table, index) => {
                const rows = table?.table?.all;
                if (!Array.isArray(rows) || rows.length === 0) {
                    return null;
                }

                const standings = rows.map(row => {
                    const scores = this.parseGoalsForAgainst(row.scoresStr);
                    return {
                        position: row.idx ?? null,
                        teamCode: row.shortName || row.name || (row.id ? String(row.id) : null),
                        teamName: row.name || row.shortName || null,
                        teamShortName: row.shortName || row.name || null,
                        teamUuid: row.id ? String(row.id) : null,
                        teamIcon: this.getTeamLogoUrl(row.id),
                        gamesPlayed: row.played ?? null,
                        wins: row.wins ?? null,
                        draws: row.draws ?? null,
                        losses: row.losses ?? null,
                        points: row.pts ?? null,
                        goalsFor: scores.goalsFor,
                        goalsAgainst: scores.goalsAgainst,
                        goalDiff: row.goalConDiff ?? null
                    };
                });

                return {
                    id: String(table?.leagueId || index + 1),
                    name: table?.leagueName || `Group ${index + 1}`,
                    standings
                };
            })
            .filter(Boolean);

        return {
            season: selectedSeason ? String(selectedSeason) : null,
            league: data?.details?.name || 'Svenska Cupen',
            lastUpdated: new Date().toISOString(),
            groups,
            source: 'fotmob',
            availableSeasons
        };
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
            venue: game.venueInfo?.name || 'arena',
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

module.exports = SvenskaCupenProvider;
