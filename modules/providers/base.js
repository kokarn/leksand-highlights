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
}

module.exports = BaseProvider;
