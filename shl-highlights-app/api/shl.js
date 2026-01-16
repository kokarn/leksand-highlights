// Automatically determine API base URL based on how the page is accessed
// - localhost: use localhost:3000
// - network IP: use same hostname with port 3000
// - native mobile: fallback to localhost (change for device testing)
const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location) {
        const { hostname, protocol } = window.location;
        return `${protocol}//${hostname}:3000`;
    }
    // Fallback for native mobile (React Native)
    return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();

// Team data cache
let teamsCache = null;

/**
 * Get team logo URL (local static file)
 * PNG format for Android compatibility
 * @param {string} teamCode - Team code (e.g., 'LIF', 'FHC')
 * @returns {string} Logo URL
 */
export function getTeamLogoUrl(teamCode) {
    if (!teamCode) return null;
    return `${API_BASE_URL}/static/logos/${teamCode.toLowerCase()}.png`;
}

/**
 * Fetch all teams with their info and local logo URLs
 * @returns {Promise<Array>} Array of team objects
 */
export async function fetchTeams() {
    // Return cached if available
    if (teamsCache) return teamsCache;

    try {
        const response = await fetch(`${API_BASE_URL}/api/teams`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const teams = await response.json();
        teamsCache = teams;
        return teams;
    } catch (error) {
        console.error('Error fetching teams:', error.message);
        return [];
    }
}

/**
 * Get team info by code
 * @param {string} teamCode - Team code (e.g., 'LIF', 'FHC')
 * @returns {Promise<Object|null>} Team object or null
 */
export async function fetchTeam(teamCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/teams/${teamCode}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching team ${teamCode}:`, error.message);
        return null;
    }
}

export async function fetchGames() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/games`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching schedule:', error.message);
        return [];
    }
}

export async function fetchVideosForGame(gameUuid) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/game/${gameUuid}/videos`);
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error(`Error processing videos for ${gameUuid}: ${e.message}`);
        return [];
    }
}

export async function fetchGameDetails(gameUuid) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/game/${gameUuid}/details`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching game details for ${gameUuid}:`, error.message);
        return null;
    }
}

/**
 * Fetch enriched video details with HLS streaming URLs
 * @param {string} videoId - StayLive video ID
 * @returns {Promise<Object|null>} Video details with streaming URLs
 */
export async function fetchVideoDetails(videoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/video/${videoId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching video details for ${videoId}:`, error.message);
        return null;
    }
}
