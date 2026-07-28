import {
    fetchGames,
    fetchHockeyAllsvenskanGames,
    fetchFootballGames,
    fetchSvenskaCupenGames,
    fetchEuropaLeagueQualGames,
    fetchConferenceLeagueQualGames,
    getTeamLogoUrl,
    resolveMediaUrl
} from '../api/shl.js';

/**
 * Team-page configuration, keyed by "team family" (a group of leagues that
 * share the same data shape, card component, and team-identity model).
 *
 * This is the single source of truth that lets every similar sport reuse the
 * same TeamGamesScreen + navigation. To support a new league, add its slug to
 * the matching family's `leagues` array (or add a new family entry).
 *
 * - hockey  → SHL + HockeyAllsvenskan (shl.se-clone shape, local PNG logos by code)
 * - football→ Allsvenskan + Svenska Cupen + Europa/Conference Qual (ESPN-ish
 *             shape, logos via upstream icon URL through the image proxy)
 *
 * Biathlon is intentionally excluded: it has no per-team schedule/opponent
 * model, so a "team page" doesn't apply.
 */

const hockeyTeamCode = (team) => {
    const code = team?.code || team?.names?.code || team?.teamCode;
    return code ? String(code).toUpperCase() : null;
};

const footballTeamCode = (team) => {
    const code = team?.code || team?.teamCode;
    return code ? String(code).toUpperCase() : null;
};

export const TEAM_FAMILIES = {
    hockey: {
        family: 'hockey',
        sportTab: 'hockey',
        cardType: 'hockey',
        // Order matters only for stable de-duplication; games are re-sorted by date.
        leagues: [
            { slug: 'shl', label: 'SHL', fetchGames: () => fetchGames() },
            { slug: 'hockeyallsvenskan', label: 'HockeyAllsvenskan', fetchGames: () => fetchHockeyAllsvenskanGames() }
        ],
        getTeamCode: hockeyTeamCode,
        getTeamName: (team) => team?.names?.short || team?.names?.long || hockeyTeamCode(team) || 'Team',
        // Hockey logos come from local static PNGs keyed by lowercased code.
        getTeamLogo: (team) => {
            const code = hockeyTeamCode(team);
            return code ? getTeamLogoUrl(code) : resolveMediaUrl(team?.icon);
        }
    },
    football: {
        family: 'football',
        sportTab: 'football',
        cardType: 'football',
        leagues: [
            { slug: 'allsvenskan', label: 'Allsvenskan', fetchGames: (filters) => fetchFootballGames(filters) },
            { slug: 'svenska-cupen', label: 'Svenska Cupen', fetchGames: (filters) => fetchSvenskaCupenGames(filters) },
            { slug: 'europa-league-qual', label: 'Europa League Qualifying', fetchGames: (filters) => fetchEuropaLeagueQualGames(filters) },
            { slug: 'conference-league-qual', label: 'Conference League Qualifying', fetchGames: (filters) => fetchConferenceLeagueQualGames(filters) }
        ],
        getTeamCode: footballTeamCode,
        getTeamName: (team) => team?.names?.short || team?.names?.long || footballTeamCode(team) || 'Team',
        // Football logos come from the upstream icon URL (proxied).
        getTeamLogo: (team) => resolveMediaUrl(team?.icon)
    }
};

/**
 * Map a per-league sport slug (as used by deep links / standings / modals) to
 * the team family that owns it. Returns null for slugs without a team page
 * (e.g. biathlon or an unknown slug).
 */
export const getTeamFamilyForSport = (sport) => {
    const normalized = String(sport || '').toLowerCase();
    if (normalized === 'football') {
        return TEAM_FAMILIES.football;
    }
    for (const family of Object.values(TEAM_FAMILIES)) {
        if (family.family === normalized) {
            return family;
        }
        if (family.leagues.some((league) => league.slug === normalized)) {
            return family;
        }
    }
    return null;
};

/**
 * Whether a given sport slug supports navigating to a team page.
 */
export const sportSupportsTeamPage = (sport) => getTeamFamilyForSport(sport) !== null;
