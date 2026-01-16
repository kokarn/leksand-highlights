const BaseProvider = require('./base');

/**
 * SHL (Swedish Hockey League) Data Provider
 *
 * Fetches game data from the official SHL API.
 */
class SHLProvider extends BaseProvider {
    constructor() {
        super('SHL');

        this.baseUrl = 'https://www.shl.se/api';
        this.scheduleUrl = `${this.baseUrl}/sports-v2/game-schedule?seasonUuid=xs4m9qupsi&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B&gamePlace=all&played=all`;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // How far back to check for post-game videos
        this.maxHoursSinceGame = 36;
    }

    async fetchAllGames() {
        const response = await fetch(this.scheduleUrl, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data?.gameInfo || [];
    }

    async fetchActiveGames() {
        console.log(`[${this.name}] Fetching active games...`);
        try {
            const games = await this.fetchAllGames();
            const now = new Date();

            const activeGames = games.filter(game => {
                const startTime = new Date(game.startDateTime);
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

            if (activeGames.length > 0) {
                const details = activeGames.map(g => {
                    const info = this.getGameDisplayInfo(g);
                    return `${info.homeTeam} vs ${info.awayTeam} (${g.state})`;
                }).join(', ');
                console.log(`[${this.name}] Found ${activeGames.length} active/recent games: ${details}`);
            }

            return activeGames;
        } catch (error) {
            console.error(`[${this.name}] Error fetching schedule:`, error.message);
            return [];
        }
    }

    async fetchGameVideos(gameId) {
        const url = `${this.baseUrl}/media/videos-for-game?page=0&pageSize=20&gameUuid=${gameId}`;
        try {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                console.error(`[${this.name}] Failed to fetch videos for ${gameId}: ${response.status}`);
                return [];
            }
            const data = await response.json();
            return data.items || [];
        } catch (e) {
            console.error(`[${this.name}] Error fetching videos for ${gameId}:`, e);
            return [];
        }
    }

    async fetchGameDetails(gameId) {
        const gameInfoUrl = `${this.baseUrl}/sports-v2/game-info/${gameId}`;
        const playByPlayUrl = `${this.baseUrl}/gameday/play-by-play/${gameId}`;

        const [gameInfoResponse, playByPlayResponse] = await Promise.all([
            fetch(gameInfoUrl, { headers: this.headers }),
            fetch(playByPlayUrl, { headers: this.headers })
        ]);

        let gameInfo = null;
        if (gameInfoResponse.ok) {
            gameInfo = await gameInfoResponse.json();
        }

        let events = [];
        if (playByPlayResponse.ok) {
            const rawEvents = await playByPlayResponse.json();
            events = Array.isArray(rawEvents) ? rawEvents : [];
        }

        let teamStats = null;
        if (gameInfo?.ssgtUuid && gameInfo?.homeTeam && gameInfo?.awayTeam) {
            const teamStatsUrl = `${this.baseUrl}/gameday/post-game-data/team-stats/${gameId}?ssgtUuid=${gameInfo.ssgtUuid}&homeTeamUuid=${gameInfo.homeTeam.uuid}&awayTeamUuid=${gameInfo.awayTeam.uuid}`;
            try {
                const response = await fetch(teamStatsUrl, { headers: this.headers });
                if (response.ok) {
                    teamStats = await response.json();
                }
            } catch (e) {
                console.warn(`[${this.name}] Could not fetch team stats for ${gameId}:`, e.message);
            }
        }

        return {
            info: gameInfo,
            teamStats,
            events: {
                goals: events.filter(e => e.type === 'goal'),
                penalties: events.filter(e => e.type === 'penalty'),
                periods: events.filter(e => e.type === 'period'),
                all: events
            }
        };
    }

    async enrichGames(games) {
        return Promise.all(games.map(async (game) => {
            const homeScore = game.homeTeamInfo?.score ?? 0;
            const awayScore = game.awayTeamInfo?.score ?? 0;

            // Fetch actual score for post-game with 0-0
            if (game.state === 'post-game' && homeScore === 0 && awayScore === 0) {
                const actualScore = await this._fetchActualScore(game);
                if (actualScore) {
                    return {
                        ...game,
                        homeTeamInfo: { ...game.homeTeamInfo, score: actualScore.home },
                        awayTeamInfo: { ...game.awayTeamInfo, score: actualScore.away }
                    };
                }
            }
            return game;
        }));
    }

    async _fetchActualScore(game) {
        try {
            const url = `${this.baseUrl}/gameday/post-game-data/team-stats/${game.uuid}?ssgtUuid=${game.ssgtUuid}&homeTeamUuid=${game.homeTeamInfo?.uuid}&awayTeamUuid=${game.awayTeamInfo?.uuid}`;
            const response = await fetch(url, { headers: this.headers });
            if (response.ok) {
                const teamStats = await response.json();
                const stats = teamStats?.stats || [];
                for (const stat of stats) {
                    const key = stat.homeTeam?.sideTranslateKey || stat.awayTeam?.sideTranslateKey;
                    if (key === 'G') {
                        return {
                            home: stat.homeTeam?.left?.value ?? 0,
                            away: stat.awayTeam?.left?.value ?? 0
                        };
                    }
                }
            }
        } catch (e) {
            console.warn(`[${this.name}] Could not fetch score for ${game.uuid}:`, e.message);
        }
        return null;
    }

    isHighlight(video) {
        return video.tags && video.tags.includes('custom.highlights');
    }

    getGameDisplayInfo(game) {
        return {
            homeTeam: game.homeTeamInfo?.names?.short || game.homeTeamInfo?.code || 'Unknown',
            awayTeam: game.awayTeamInfo?.names?.short || game.awayTeamInfo?.code || 'Unknown',
            homeTeamCode: game.homeTeamInfo?.code,
            awayTeamCode: game.awayTeamInfo?.code,
            venue: game.venueInfo?.name || 'arenan',
            gameId: game.uuid,
            state: game.state,
            startTime: game.startDateTime
        };
    }

    getVideoUrl(video) {
        return video.renderedMedia?.videourl || '';
    }

    getVideoThumbnail(video) {
        return video.renderedMedia?.url || video.thumbnail || null;
    }

    /**
     * Extract StayLive video ID from SHL video object
     * @param {Object} video - SHL video object
     * @returns {string|null} StayLive video ID
     */
    getStayLiveVideoId(video) {
        // mediaString format: "video|staylive|488394"
        if (video.mediaString) {
            const parts = video.mediaString.split('|');
            if (parts.length === 3 && parts[1] === 'staylive') {
                return parts[2];
            }
        }
        return video.id || null;
    }

    /**
     * Fetch enriched video details from StayLive API
     * Provides HLS streaming URL, thumbnails, and preview GIFs
     * @param {string} videoId - StayLive video ID
     * @returns {Promise<Object|null>}
     */
    async fetchVideoDetails(videoId) {
        const stayLiveUrl = `https://api.staylive.tv/videos/${videoId}`;

        try {
            const response = await fetch(stayLiveUrl, { headers: this.headers });
            if (!response.ok) {
                console.error(`[${this.name}] Failed to fetch video details for ${videoId}: ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (!data.success || !data.message) {
                return null;
            }

            const video = data.message;

            return {
                id: video.id,
                name: video.name,
                description: video.description,
                duration: video.duration,
                createdAt: video.created_at,

                // Streaming URLs
                streams: {
                    hls: video.playback_url || null,  // .m3u8 with token
                    embed: `https://embed.staylive.tv/video/${video.id}`,
                },

                // Images
                images: {
                    thumbnail: video.thumbnail || null,
                    gif: video.gif || null,
                    storyboard: video.storyboard || null,
                },

                // Metadata
                channel: {
                    id: video.channel,
                    name: video.channelName,
                    path: video.channelPath,
                    image: video.channelImage,
                },

                categories: video.categories || [],
                tags: video.tags || [],

                // Access info
                isLocked: video.subscribers_only === 1,
                isFree: video.price === 0,
                geoRestricted: !video.geo_restricted?.allowed,
            };
        } catch (e) {
            console.error(`[${this.name}] Error fetching video details for ${videoId}:`, e);
            return null;
        }
    }
}

module.exports = SHLProvider;
