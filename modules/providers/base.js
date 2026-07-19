/**
 * Base Provider Interface
 *
 * All data providers must implement these methods.
 * This allows swapping between different data sources (SHL, mock, etc.)
 */
class BaseProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Get the provider name
     * @returns {string}
     */
    getName() {
        return this.name;
    }

    /**
     * Fetch all games (raw, unfiltered)
     * @returns {Promise<Array>} Array of game objects
     */
    async fetchAllGames() {
        throw new Error('fetchAllGames() must be implemented');
    }

    /**
     * Fetch active/recent games only
     * @returns {Promise<Array>} Array of active game objects
     */
    async fetchActiveGames() {
        throw new Error('fetchActiveGames() must be implemented');
    }

    /**
     * Fetch videos for a specific game
     * @param {string} gameId - The game identifier
     * @returns {Promise<Array>} Array of video objects
     */
    async fetchGameVideos(gameId) {
        throw new Error('fetchGameVideos() must be implemented');
    }

    /**
     * Fetch detailed game information
     * @param {string} gameId - The game identifier
     * @returns {Promise<Object>} Game details object
     */
    async fetchGameDetails(gameId) {
        throw new Error('fetchGameDetails() must be implemented');
    }

    /**
     * Enrich games with additional data (e.g., actual scores)
     * @param {Array} games - Array of game objects
     * @returns {Promise<Array>} Enriched game objects
     */
    async enrichGames(games) {
        return games; // Default: no enrichment
    }

    /**
     * Check if a video is a highlight
     * @param {Object} video - Video object
     * @returns {boolean}
     */
    isHighlight(video) {
        throw new Error('isHighlight() must be implemented');
    }

    /**
     * Get game display info for logging/notifications
     * @param {Object} game - Game object
     * @returns {Object} { homeTeam, awayTeam, venue, gameId }
     */
    getGameDisplayInfo(game) {
        throw new Error('getGameDisplayInfo() must be implemented');
    }

    /**
     * Get video URL for playback
     * @param {Object} video - Video object
     * @returns {string}
     */
    getVideoUrl(video) {
        throw new Error('getVideoUrl() must be implemented');
    }

    /**
     * Get video thumbnail URL
     * @param {Object} video - Video object
     * @returns {string|null}
     */
    getVideoThumbnail(video) {
        throw new Error('getVideoThumbnail() must be implemented');
    }

    /**
     * Get enriched video details with streaming URLs
     * @param {string} videoId - The video identifier
     * @returns {Promise<Object|null>} Enriched video object with streaming URLs
     */
    async fetchVideoDetails(videoId) {
        return null; // Default: not implemented
    }

    /**
     * Resolve a team logo URL, falling back to a curated static badge map when the
     * upstream source (e.g. ESPN) returns no logo for a club. Keyed by the team id
     * used upstream (ESPN team id). Used to fill logo gaps for minor European clubs.
     * @param {string|null} upstreamIcon - Logo URL from the upstream feed (may be empty)
     * @param {string|number|null} teamId - The upstream team id (ESPN id)
     * @returns {string|null}
     */
    resolveTeamIcon(upstreamIcon, teamId) {
        if (upstreamIcon) {
            return upstreamIcon;
        }
        if (teamId === undefined || teamId === null) {
            return upstreamIcon || null;
        }
        const fallbacks = BaseProvider.getTeamLogoFallbacks();
        return fallbacks[String(teamId)] || upstreamIcon || null;
    }

    /**
     * Lazily load + cache the static fallback badge map (ESPN team id -> logo URL).
     * @returns {Object<string,string>}
     */
    static getTeamLogoFallbacks() {
        if (BaseProvider._teamLogoFallbacks) {
            return BaseProvider._teamLogoFallbacks;
        }
        let badges = {};
        try {
            const path = require('path');
            const data = require(path.join(__dirname, '..', '..', 'data', 'team-logo-fallbacks.json'));
            badges = (data && data.badges) || {};
        } catch (err) {
            badges = {};
        }
        BaseProvider._teamLogoFallbacks = badges;
        return badges;
    }
}

module.exports = BaseProvider;
