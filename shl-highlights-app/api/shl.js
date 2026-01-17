// Automatically determine API base URL based on how the page is accessed
// - localhost: use localhost:3080
// - network IP: use same hostname with port 3080
// - native mobile: use live API
const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location) {
        const { hostname, protocol } = window.location;
        return `${protocol}//${hostname}:3080`;
    }
    // Fallback for native mobile (React Native) - use live API
    return 'https://sports-api.kokarn.com';
};

const API_BASE_URL = getApiBaseUrl();

// Team data cache
let teamsCache = null;
let nationsCache = null;

// ============ GENERAL API ============

/**
 * Fetch all available sports
 * @returns {Promise<Array>} Array of sport objects
 */
export async function fetchSports() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sports`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching sports:', error.message);
        return [];
    }
}

// ============ SHL/HOCKEY API ============

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

/**
 * Fetch SHL league standings
 * @param {Object} options - Optional filters
 * @param {string} options.team - Filter by team code
 * @param {number} options.top - Limit to top N teams
 * @returns {Promise<Object>} Standings object with season info and team array
 */
export async function fetchStandings(options = {}) {
    try {
        const params = new URLSearchParams();
        if (options.team) params.append('team', options.team);
        if (options.top) params.append('top', options.top);

        const url = `${API_BASE_URL}/api/standings${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching standings:', error.message);
        return { season: null, standings: [] };
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

// ============ BIATHLON API ============

/**
 * Fetch all biathlon nations
 * @returns {Promise<Array>} Array of nation objects
 */
export async function fetchBiathlonNations() {
    if (nationsCache) return nationsCache;

    try {
        const response = await fetch(`${API_BASE_URL}/api/biathlon/nations`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const nations = await response.json();
        nationsCache = nations;
        return nations;
    } catch (error) {
        console.error('Error fetching biathlon nations:', error.message);
        return [];
    }
}

/**
 * Fetch biathlon disciplines
 * @returns {Promise<Array>} Array of discipline objects
 */
export async function fetchBiathlonDisciplines() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/biathlon/disciplines`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching biathlon disciplines:', error.message);
        return [];
    }
}

/**
 * Fetch biathlon events (World Cup stops, etc.)
 * @returns {Promise<Array>} Array of event objects
 */
export async function fetchBiathlonEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/biathlon/events`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching biathlon events:', error.message);
        return [];
    }
}

/**
 * Fetch upcoming biathlon race schedule
 * @param {number} limit - Max number of races to return
 * @returns {Promise<Array>} Array of race objects
 */
export async function fetchBiathlonSchedule(limit = 30) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/biathlon/schedule?limit=${limit}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching biathlon schedule:', error.message);
        return [];
    }
}

/**
 * Fetch all biathlon races with optional filters
 * @param {Object} filters - Optional filters (upcoming, country, discipline, gender)
 * @returns {Promise<Array>} Array of race objects
 */
export async function fetchBiathlonRaces(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.upcoming) params.append('upcoming', 'true');
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.country) params.append('country', filters.country);
        if (filters.discipline) params.append('discipline', filters.discipline);
        if (filters.gender) params.append('gender', filters.gender);

        const url = `${API_BASE_URL}/api/biathlon/races${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching biathlon races:', error.message);
        return [];
    }
}

/**
 * Fetch details for a specific biathlon race
 * @param {string} raceId - Race identifier
 * @returns {Promise<Object|null>} Race details or null
 */
export async function fetchBiathlonRaceDetails(raceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/biathlon/race/${raceId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching biathlon race details for ${raceId}:`, error.message);
        return null;
    }
}

/**
 * Get nation flag emoji by code
 * @param {string} nationCode - Nation code (e.g., 'SWE', 'NOR')
 * @returns {string} Flag emoji
 */
export function getNationFlag(nationCode) {
    const flags = {
        'NOR': '🇳🇴', 'SWE': '🇸🇪', 'FRA': '🇫🇷', 'GER': '🇩🇪', 'ITA': '🇮🇹',
        'AUT': '🇦🇹', 'SUI': '🇨🇭', 'FIN': '🇫🇮', 'USA': '🇺🇸', 'CAN': '🇨🇦',
        'CZE': '🇨🇿', 'SLO': '🇸🇮', 'UKR': '🇺🇦', 'BLR': '🇧🇾', 'POL': '🇵🇱',
        'EST': '🇪🇪', 'BUL': '🇧🇬', 'CHN': '🇨🇳', 'JPN': '🇯🇵', 'KOR': '🇰🇷'
    };
    return flags[nationCode] || '🏳️';
}
