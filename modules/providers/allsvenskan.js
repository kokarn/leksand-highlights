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
        this.fotbollPlayApiBaseUrl = 'https://api.fotbollplay.se/allsvenskan';
        this.fotbollPlayWebBaseUrl = 'https://fotbollplay.se';

        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        this.maxEvents = 400;
        this.maxHoursSinceGame = 36;
        this.maxFotbollPlayGameCandidates = 200;
        this.maxFotbollPlayPlaylists = 50;
    }

    normalizeComparableText(value) {
        if (!value) {
            return '';
        }
        return String(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
    }

    buildTeamNameCandidates(teamInfo) {
        const candidates = [
            teamInfo?.names?.short,
            teamInfo?.names?.long,
            teamInfo?.code
        ]
            .map(value => this.normalizeComparableText(value))
            .filter(Boolean);

        return Array.from(new Set(candidates));
    }

    getTeamNameScore(teamName, candidates) {
        if (!teamName || !Array.isArray(candidates) || candidates.length === 0) {
            return 0;
        }

        let bestScore = 0;
        for (const candidate of candidates) {
            if (candidate === teamName) {
                return 12;
            }

            if (candidate.includes(teamName) || teamName.includes(candidate)) {
                bestScore = Math.max(bestScore, 7);
            }

            if (candidate.length >= 4 && teamName.length >= 4) {
                const candidatePrefix = candidate.slice(0, 4);
                const teamPrefix = teamName.slice(0, 4);
                if (candidate.includes(teamPrefix) || teamName.includes(candidatePrefix)) {
                    bestScore = Math.max(bestScore, 4);
                }
            }
        }

        return bestScore;
    }

    getKickoffScore(expectedKickoff, candidateKickoff) {
        if (!expectedKickoff || !candidateKickoff) {
            return 0;
        }

        const expectedTime = new Date(expectedKickoff).getTime();
        const candidateTime = new Date(candidateKickoff).getTime();

        if (Number.isNaN(expectedTime) || Number.isNaN(candidateTime)) {
            return 0;
        }

        const diffMinutes = Math.abs(expectedTime - candidateTime) / (1000 * 60);
        if (diffMinutes <= 30) {
            return 6;
        }
        if (diffMinutes <= 120) {
            return 3;
        }
        if (diffMinutes <= 360) {
            return 1;
        }
        return -2;
    }

    formatFotbollPlayDate(date) {
        return date.toISOString().slice(0, 10);
    }

    async fetchFotbollPlayGamesNearDate(startDateTime) {
        const kickoff = new Date(startDateTime);
        if (Number.isNaN(kickoff.getTime())) {
            return [];
        }

        const fromDate = new Date(kickoff);
        fromDate.setUTCDate(fromDate.getUTCDate() - 1);

        const toDate = new Date(kickoff);
        toDate.setUTCDate(toDate.getUTCDate() + 1);

        const url = new URL(`${this.fotbollPlayApiBaseUrl}/game`);
        url.searchParams.set('from_date', this.formatFotbollPlayDate(fromDate));
        url.searchParams.set('to_date', this.formatFotbollPlayDate(toDate));
        url.searchParams.set('count', String(this.maxFotbollPlayGameCandidates));

        try {
            const response = await fetch(url.toString(), { headers: this.headers });
            if (!response.ok) {
                console.warn(`[${this.name}] FotbollPlay game lookup failed (${response.status})`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data?.games) ? data.games : [];
        } catch (error) {
            console.warn(`[${this.name}] Could not fetch FotbollPlay games:`, error.message);
            return [];
        }
    }

    scoreFotbollPlayGame(candidateGame, expectedMatchInfo) {
        const homeTeamName = this.normalizeComparableText(
            candidateGame?.home_team?.name || candidateGame?.home_team?.short_name
        );
        const awayTeamName = this.normalizeComparableText(
            candidateGame?.visiting_team?.name
            || candidateGame?.visiting_team?.short_name
            || candidateGame?.away_team?.name
            || candidateGame?.away_team?.short_name
        );

        if (!homeTeamName || !awayTeamName) {
            return Number.NEGATIVE_INFINITY;
        }

        const expectedHomeCandidates = this.buildTeamNameCandidates(expectedMatchInfo?.homeTeamInfo);
        const expectedAwayCandidates = this.buildTeamNameCandidates(expectedMatchInfo?.awayTeamInfo);

        const directScore = this.getTeamNameScore(homeTeamName, expectedHomeCandidates)
            + this.getTeamNameScore(awayTeamName, expectedAwayCandidates);
        const swappedScore = this.getTeamNameScore(homeTeamName, expectedAwayCandidates)
            + this.getTeamNameScore(awayTeamName, expectedHomeCandidates);

        const bestTeamScore = Math.max(directScore, swappedScore - 3);
        if (bestTeamScore <= 0) {
            return Number.NEGATIVE_INFINITY;
        }

        const candidateKickoff = candidateGame?.start_time || candidateGame?.start_of_game || null;
        const kickoffScore = this.getKickoffScore(expectedMatchInfo?.startDateTime, candidateKickoff);

        return bestTeamScore + kickoffScore;
    }

    async findFotbollPlayGame(expectedMatchInfo) {
        if (!expectedMatchInfo?.startDateTime || !expectedMatchInfo?.homeTeamInfo || !expectedMatchInfo?.awayTeamInfo) {
            return null;
        }

        const candidateGames = await this.fetchFotbollPlayGamesNearDate(expectedMatchInfo.startDateTime);
        if (candidateGames.length === 0) {
            return null;
        }

        let bestMatch = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const candidateGame of candidateGames) {
            const score = this.scoreFotbollPlayGame(candidateGame, expectedMatchInfo);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = candidateGame;
            }
        }

        if (!bestMatch || bestScore < 12) {
            return null;
        }

        return bestMatch;
    }

    extractPlaylistActionTags(playlist) {
        const actions = [];
        const events = Array.isArray(playlist?.events) ? playlist.events : [];
        for (const event of events) {
            const tags = Array.isArray(event?.tags) ? event.tags : [];
            for (const tag of tags) {
                const action = String(tag?.action || '').trim().toLowerCase();
                if (action) {
                    actions.push(action);
                }
            }
        }
        return Array.from(new Set(actions));
    }

    normalizePlaylistFilters(playlist) {
        const filters = Array.isArray(playlist?.filters) ? playlist.filters : [];
        return filters
            .map(filter => String(filter || '').trim().toLowerCase())
            .filter(Boolean);
    }

    buildClipTitle(playlist, tags) {
        if (playlist?.title) {
            return playlist.title;
        }
        if (playlist?.description) {
            return playlist.description;
        }
        if (tags.includes('custom.highlights')) {
            return 'Match Highlights';
        }
        const actionTag = tags.find(tag => tag.startsWith('action.'));
        if (actionTag) {
            return actionTag.replace('action.', '').replace(/_/g, ' ');
        }
        return 'Video Clip';
    }

    normalizeFotbollPlayPlaylist(playlist, matchId) {
        if (!playlist?.id) {
            return null;
        }

        const filters = this.normalizePlaylistFilters(playlist);
        const actionTags = this.extractPlaylistActionTags(playlist);
        const tags = [
            ...filters,
            ...actionTags.map(action => `action.${action.replace(/\s+/g, '_')}`)
        ];

        if (actionTags.includes('highlights') || filters.includes('highlights')) {
            tags.push('custom.highlights');
        }

        const uniqueTags = Array.from(new Set(tags));
        const thumbnail = playlist?.hd_thumbnail_url
            || playlist?.thumbnail_url
            || playlist?.hd_thumbnail_override_url
            || playlist?.thumbnail_override_url
            || null;

        return {
            id: String(playlist.id),
            title: this.buildClipTitle(playlist, uniqueTags),
            description: playlist?.description || null,
            date: playlist?.date || playlist?.recording_timestamp || null,
            tags: uniqueTags,
            source: 'fotbollplay',
            gameId: String(matchId),
            renderedMedia: {
                videourl: `${this.fotbollPlayWebBaseUrl}/embed/playlist/${playlist.id}`,
                url: thumbnail
            },
            thumbnail,
            videoUrl: playlist?.video_url || null,
            frontendUrl: playlist?.frontend_url || null,
            isAvailablePublicly: Boolean(playlist?.is_available_publicly)
        };
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
        try {
            const details = await this.fetchGameDetails(gameId);
            const matchInfo = details?.info;
            if (!matchInfo) {
                return [];
            }

            const matchedGame = await this.findFotbollPlayGame(matchInfo);
            if (!matchedGame?.id) {
                return [];
            }

            const url = new URL(`${this.fotbollPlayApiBaseUrl}/playlist`);
            url.searchParams.set('game_id', String(matchedGame.id));
            url.searchParams.set('count', String(this.maxFotbollPlayPlaylists));
            url.searchParams.set('holdback', 'public');

            const response = await fetch(url.toString(), { headers: this.headers });
            if (!response.ok) {
                console.warn(`[${this.name}] FotbollPlay playlist fetch failed for ${gameId}: ${response.status}`);
                return [];
            }

            const data = await response.json();
            const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
            const uniqueClips = new Map();

            for (const playlist of playlists) {
                const clip = this.normalizeFotbollPlayPlaylist(playlist, matchedGame.id);
                if (!clip || !clip.isAvailablePublicly) {
                    continue;
                }
                uniqueClips.set(clip.id, clip);
            }

            const clips = Array.from(uniqueClips.values());
            clips.sort((a, b) => {
                const aHighlight = this.isHighlight(a);
                const bHighlight = this.isHighlight(b);
                if (aHighlight && !bHighlight) {
                    return -1;
                }
                if (!aHighlight && bHighlight) {
                    return 1;
                }
                const aTime = new Date(a.date || 0).getTime();
                const bTime = new Date(b.date || 0).getTime();
                return bTime - aTime;
            });

            return clips;
        } catch (error) {
            console.warn(`[${this.name}] Failed to fetch clips for game ${gameId}:`, error.message);
            return [];
        }
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

        // Extract team statistics from boxscore
        const teamStats = this.extractTeamStats(data?.boxscore, homeCompetitor, awayCompetitor);

        // Extract events from keyEvents and plays
        const events = this.extractEvents(data, homeCompetitor, awayCompetitor);

        // Extract lineups/rosters if available
        const rosters = this.extractRosters(data?.rosters);

        // Extract match commentary/plays
        const commentary = this.extractCommentary(data?.plays);

        return {
            info,
            venue: data?.gameInfo?.venue || null,
            teamStats,
            events,
            rosters,
            commentary,
            format: data?.format || null
        };
    }

    extractTeamStats(boxscore, homeCompetitor, awayCompetitor) {
        if (!boxscore?.teams || !Array.isArray(boxscore.teams)) {
            return null;
        }

        const homeTeam = boxscore.teams.find(t => t.homeAway === 'home') || boxscore.teams[0];
        const awayTeam = boxscore.teams.find(t => t.homeAway === 'away') || boxscore.teams[1];

        const extractStats = (team) => {
            if (!team?.statistics || !Array.isArray(team.statistics)) {
                return {};
            }

            const stats = {};
            for (const stat of team.statistics) {
                if (stat.name && stat.displayValue !== undefined) {
                    stats[stat.name] = stat.displayValue;
                }
            }
            return stats;
        };

        return {
            homeTeam: {
                name: homeTeam?.team?.displayName || homeCompetitor?.team?.displayName || 'Home',
                code: homeTeam?.team?.abbreviation || homeCompetitor?.team?.abbreviation || null,
                statistics: extractStats(homeTeam)
            },
            awayTeam: {
                name: awayTeam?.team?.displayName || awayCompetitor?.team?.displayName || 'Away',
                code: awayTeam?.team?.abbreviation || awayCompetitor?.team?.abbreviation || null,
                statistics: extractStats(awayTeam)
            }
        };
    }

    extractEvents(data, homeCompetitor, awayCompetitor) {
        const keyEvents = data?.keyEvents || [];
        const plays = data?.plays || [];

        const goals = [];
        const cards = [];
        const substitutions = [];
        const all = [];

        // Helper to determine team info from event
        const getTeamInfo = (event) => {
            const teamId = event?.team?.id;
            if (!teamId) {
                return null;
            }

            const isHome = String(teamId) === String(homeCompetitor?.team?.id || homeCompetitor?.id);
            const isAway = String(teamId) === String(awayCompetitor?.team?.id || awayCompetitor?.id);

            if (isHome) {
                return {
                    teamCode: homeCompetitor?.team?.abbreviation || 'HOME',
                    teamName: homeCompetitor?.team?.displayName || 'Home',
                    isHome: true
                };
            }
            if (isAway) {
                return {
                    teamCode: awayCompetitor?.team?.abbreviation || 'AWAY',
                    teamName: awayCompetitor?.team?.displayName || 'Away',
                    isHome: false
                };
            }
            return null;
        };

        // Process key events
        for (const event of keyEvents) {
            const type = event?.type?.text?.toLowerCase() || event?.type?.id || '';
            const teamInfo = getTeamInfo(event);

            const periodNumber = event?.period?.number ?? (typeof event?.period === 'number' ? event.period : 1);
            const periodDisplay = event?.period?.displayValue || (periodNumber === 1 ? '1st half' : '2nd half');

            const baseEvent = {
                id: event?.id || null,
                clock: event?.clock?.displayValue || event?.clock || null,
                period: periodNumber,
                periodDisplay,
                text: event?.text || event?.shortText || null,
                teamCode: teamInfo?.teamCode || null,
                teamName: teamInfo?.teamName || null,
                isHome: teamInfo?.isHome ?? null
            };

            // Categorize by event type
            if (type.includes('goal') || type === 'goal scored' || event?.scoringPlay) {
                const goal = {
                    ...baseEvent,
                    type: 'goal',
                    scorer: this.extractPlayerFromEvent(event),
                    assist: this.extractAssistFromEvent(event),
                    goalType: event?.type?.text || 'Goal',
                    score: {
                        home: event?.homeScore ?? null,
                        away: event?.awayScore ?? null
                    }
                };
                goals.push(goal);
                all.push(goal);
            } else if (type.includes('yellow') || type.includes('red') || type.includes('card')) {
                const card = {
                    ...baseEvent,
                    type: 'card',
                    cardType: type.includes('red') ? 'red' : 'yellow',
                    player: this.extractPlayerFromEvent(event),
                    reason: event?.type?.text || null
                };
                cards.push(card);
                all.push(card);
            } else if (type.includes('substitution') || type.includes('sub')) {
                const sub = {
                    ...baseEvent,
                    type: 'substitution',
                    playerIn: this.extractPlayerIn(event),
                    playerOut: this.extractPlayerOut(event)
                };
                substitutions.push(sub);
                all.push(sub);
            } else {
                all.push({
                    ...baseEvent,
                    type: type || 'other'
                });
            }
        }

        // Also check plays array for additional goal/card data if keyEvents is sparse
        if (goals.length === 0 && plays.length > 0) {
            for (const play of plays) {
                if (play?.scoringPlay || play?.type?.text?.toLowerCase().includes('goal')) {
                    const teamInfo = getTeamInfo(play);
                    const playPeriodNumber = play?.period?.number ?? (typeof play?.period === 'number' ? play.period : 1);
                    const playPeriodDisplay = play?.period?.displayValue || (playPeriodNumber === 1 ? '1st half' : '2nd half');
                    const goal = {
                        id: play?.id || null,
                        type: 'goal',
                        clock: play?.clock?.displayValue || play?.clock || null,
                        period: playPeriodNumber,
                        periodDisplay: playPeriodDisplay,
                        text: play?.text || play?.shortText || null,
                        teamCode: teamInfo?.teamCode || null,
                        teamName: teamInfo?.teamName || null,
                        isHome: teamInfo?.isHome ?? null,
                        scorer: this.extractPlayerFromEvent(play),
                        assist: this.extractAssistFromEvent(play),
                        goalType: play?.type?.text || 'Goal',
                        score: {
                            home: play?.homeScore ?? null,
                            away: play?.awayScore ?? null
                        }
                    };
                    goals.push(goal);
                }
            }
        }

        // Sort events by time
        const sortByTime = (a, b) => {
            const periodDiff = (a.period || 0) - (b.period || 0);
            if (periodDiff !== 0) {
                return periodDiff;
            }
            // Parse clock strings like "45'+2" or "23:15"
            const parseTime = (clock) => {
                if (!clock) {
                    return 0;
                }
                const match = String(clock).match(/(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };
            return parseTime(a.clock) - parseTime(b.clock);
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

    extractPlayerFromEvent(event) {
        // ESPN events can have participants array or direct player references
        const participants = event?.participants || [];
        const scorer = participants.find(p =>
            p?.type?.text?.toLowerCase().includes('goal') ||
            p?.type?.id === 'scorer' ||
            p?.type === 'scorer'
        ) || participants[0];

        if (scorer?.athlete) {
            return {
                id: scorer.athlete.id || null,
                name: scorer.athlete.displayName || scorer.athlete.shortName || null,
                firstName: scorer.athlete.firstName || null,
                lastName: scorer.athlete.lastName || null,
                jersey: scorer.athlete.jersey || null,
                position: scorer.athlete.position?.abbreviation || null
            };
        }

        // Fallback: try to extract from text
        if (event?.text) {
            const text = event.text;
            // Common patterns: "Goal! Player Name scores"
            const match = text.match(/Goal[!.]?\s*(.+?)\s*(?:scores|mål)/i);
            if (match) {
                return { name: match[1].trim() };
            }
        }

        return null;
    }

    extractAssistFromEvent(event) {
        const participants = event?.participants || [];
        const assist = participants.find(p =>
            p?.type?.text?.toLowerCase().includes('assist') ||
            p?.type?.id === 'assist' ||
            p?.type === 'assist'
        );

        if (assist?.athlete) {
            return {
                id: assist.athlete.id || null,
                name: assist.athlete.displayName || assist.athlete.shortName || null,
                firstName: assist.athlete.firstName || null,
                lastName: assist.athlete.lastName || null,
                jersey: assist.athlete.jersey || null
            };
        }

        return null;
    }

    extractPlayerIn(event) {
        const participants = event?.participants || [];
        
        // Try to find player in by type
        const playerIn = participants.find(p => {
            const typeText = (p?.type?.text || p?.type || '').toString().toLowerCase();
            const typeId = (p?.type?.id || '').toString().toLowerCase();
            return typeText.includes('in') || 
                   typeText.includes('on') ||
                   typeId === 'substitutionin' ||
                   typeId === 'sub_in' ||
                   typeId === 'playerin';
        });

        if (playerIn?.athlete) {
            return {
                id: playerIn.athlete.id || null,
                name: playerIn.athlete.displayName || playerIn.athlete.shortName || playerIn.athlete.name || null,
                jersey: playerIn.athlete.jersey || null
            };
        }

        // If only 2 participants and no clear type, assume first is player in
        if (participants.length === 2 && participants[0]?.athlete) {
            return {
                id: participants[0].athlete.id || null,
                name: participants[0].athlete.displayName || participants[0].athlete.shortName || participants[0].athlete.name || null,
                jersey: participants[0].athlete.jersey || null
            };
        }

        // Try to parse from text if available
        const parsed = this.parseSubstitutionText(event?.text);
        if (parsed.playerIn) {
            return { name: parsed.playerIn };
        }

        return null;
    }

    extractPlayerOut(event) {
        const participants = event?.participants || [];
        
        // Try to find player out by type
        const playerOut = participants.find(p => {
            const typeText = (p?.type?.text || p?.type || '').toString().toLowerCase();
            const typeId = (p?.type?.id || '').toString().toLowerCase();
            return typeText.includes('out') || 
                   typeText.includes('off') ||
                   typeId === 'substitutionout' ||
                   typeId === 'sub_out' ||
                   typeId === 'playerout';
        });

        if (playerOut?.athlete) {
            return {
                id: playerOut.athlete.id || null,
                name: playerOut.athlete.displayName || playerOut.athlete.shortName || playerOut.athlete.name || null,
                jersey: playerOut.athlete.jersey || null
            };
        }

        // If only 2 participants and no clear type, assume second is player out
        if (participants.length === 2 && participants[1]?.athlete) {
            return {
                id: participants[1].athlete.id || null,
                name: participants[1].athlete.displayName || participants[1].athlete.shortName || participants[1].athlete.name || null,
                jersey: participants[1].athlete.jersey || null
            };
        }

        // Try to parse from text if available
        const parsed = this.parseSubstitutionText(event?.text);
        if (parsed.playerOut) {
            return { name: parsed.playerOut };
        }

        return null;
    }

    parseSubstitutionText(text) {
        if (!text) {
            return { playerIn: null, playerOut: null };
        }

        // Common patterns for substitution text
        // "Player Out is replaced by Player In"
        const replacedByMatch = text.match(/(.+?)\s+(?:is replaced by|replaced by|ersätts av)\s+(.+)/i);
        if (replacedByMatch) {
            return {
                playerOut: replacedByMatch[1].trim(),
                playerIn: replacedByMatch[2].trim()
            };
        }

        // "Player In replaces Player Out"
        const replacesMatch = text.match(/(.+?)\s+(?:replaces|ersätter|comes on for)\s+(.+)/i);
        if (replacesMatch) {
            return {
                playerIn: replacesMatch[1].trim(),
                playerOut: replacesMatch[2].trim()
            };
        }

        // "Substitution: Player Out off, Player In on"
        const offOnMatch = text.match(/(.+?)\s+(?:off|ut)[,.]?\s+(.+?)\s+(?:on|in)/i);
        if (offOnMatch) {
            return {
                playerOut: offOnMatch[1].trim(),
                playerIn: offOnMatch[2].trim()
            };
        }

        // "Player In for Player Out"
        const forMatch = text.match(/(.+?)\s+(?:for|för)\s+(.+)/i);
        if (forMatch) {
            return {
                playerIn: forMatch[1].trim(),
                playerOut: forMatch[2].trim()
            };
        }

        return { playerIn: null, playerOut: null };
    }

    extractRosters(rostersData) {
        if (!Array.isArray(rostersData)) {
            return null;
        }

        const rosters = [];
        for (const roster of rostersData) {
            const team = roster?.team || {};
            const athletes = roster?.roster || [];

            rosters.push({
                teamId: team.id || null,
                teamName: team.displayName || team.name || null,
                teamCode: team.abbreviation || null,
                homeAway: roster.homeAway || null,
                players: athletes.map(a => ({
                    id: a.athlete?.id || a.id || null,
                    name: a.athlete?.displayName || a.displayName || null,
                    firstName: a.athlete?.firstName || null,
                    lastName: a.athlete?.lastName || null,
                    jersey: a.athlete?.jersey || a.jersey || null,
                    position: a.position?.abbreviation || a.athlete?.position?.abbreviation || null,
                    starter: a.starter ?? false
                }))
            });
        }

        return rosters.length > 0 ? rosters : null;
    }

    extractCommentary(playsData) {
        if (!Array.isArray(playsData) || playsData.length === 0) {
            return null;
        }

        // Return recent plays/commentary as a simplified timeline
        return playsData.slice(0, 50).map(play => ({
            id: play.id || null,
            clock: play.clock?.displayValue || play.clock || null,
            period: play.period?.number || play.period || 1,
            text: play.text || play.shortText || null,
            type: play.type?.text || play.type || null,
            scoringPlay: play.scoringPlay || false,
            homeScore: play.homeScore ?? null,
            awayScore: play.awayScore ?? null
        }));
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
        const tags = Array.isArray(video?.tags) ? video.tags : [];
        return tags.includes('custom.highlights')
            || tags.includes('action.highlights')
            || tags.includes('highlights');
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
        return video?.renderedMedia?.videourl || video?.frontendUrl || video?.videoUrl || '';
    }

    getVideoThumbnail(video) {
        return video?.renderedMedia?.url || video?.thumbnail || null;
    }
}

module.exports = AllsvenskanProvider;
