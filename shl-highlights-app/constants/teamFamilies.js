import {
    fetchGames,
    fetchHockeyAllsvenskanGames,
    fetchFootballGames,
    fetchSvenskaCupenGames,
    fetchEuropaLeagueQualGames,
    fetchConferenceLeagueQualGames,
    fetchStandings,
    fetchHockeyAllsvenskanStandings,
    fetchFootballStandings,
    fetchSvenskaCupenStandings
} from '../api/shl.js';
import { getTeamName, getTeamCodeUpper, getTeamLogoUri } from '../utils/teamIdentity.js';

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
    return code ? String(code).toUpperCase() : getTeamCodeUpper(team);
};

const footballTeamCode = (team) => {
    const code = team?.code || team?.teamCode;
    return code ? String(code).toUpperCase() : getTeamCodeUpper(team);
};

export const TEAM_FAMILIES = {
    hockey: {
        family: 'hockey',
        sportTab: 'hockey',
        cardType: 'hockey',
        // `standingsSport` is the `sport` prop StandingsTable expects (column set).
        // `standingsFormat`: 'table' = flat league table, 'groups' = grouped (cup).
        // Leagues without a table (knockout) set hasStandings: false.
        // Order matters only for stable de-duplication; games are re-sorted by date.
        leagues: [
            { slug: 'shl', label: 'SHL', fetchGames: () => fetchGames(), hasStandings: true, standingsFormat: 'table', standingsSport: 'shl', fetchStandings: (opts) => fetchStandings(opts) },
            { slug: 'hockeyallsvenskan', label: 'HockeyAllsvenskan', fetchGames: () => fetchHockeyAllsvenskanGames(), hasStandings: true, standingsFormat: 'table', standingsSport: 'shl', fetchStandings: (opts) => fetchHockeyAllsvenskanStandings(opts) }
        ],
        getTeamCode: hockeyTeamCode,
        getTeamName: (team) => getTeamName(team, { fallback: hockeyTeamCode(team) || 'Team' }),
        // Hockey logos come from local static PNGs keyed by lowercased code.
        getTeamLogo: (team) => getTeamLogoUri(team, 'hockey')
    },
    football: {
        family: 'football',
        sportTab: 'football',
        cardType: 'football',
        leagues: [
            { slug: 'allsvenskan', label: 'Allsvenskan', fetchGames: (filters) => fetchFootballGames(filters), hasStandings: true, standingsFormat: 'table', standingsSport: 'football', fetchStandings: (opts) => fetchFootballStandings(opts) },
            { slug: 'svenska-cupen', label: 'Svenska Cupen', fetchGames: (filters) => fetchSvenskaCupenGames(filters), hasStandings: true, standingsFormat: 'groups', standingsSport: 'football', fetchStandings: (opts) => fetchSvenskaCupenStandings(opts) },
            // Europa/Conference qualifying are knockout — no league table.
            { slug: 'europa-league-qual', label: 'Europa League Qualifying', fetchGames: (filters) => fetchEuropaLeagueQualGames(filters), hasStandings: false, hasBracket: true },
            { slug: 'conference-league-qual', label: 'Conference League Qualifying', fetchGames: (filters) => fetchConferenceLeagueQualGames(filters), hasStandings: false, hasBracket: true }
        ],
        getTeamCode: footballTeamCode,
        getTeamName: (team) => getTeamName(team, { fallback: footballTeamCode(team) || 'Team' }),
        // Football logos come from the upstream icon URL (proxied).
        getTeamLogo: (team) => getTeamLogoUri(team, 'football')
    }
};

/**
 * Find a single league entry by its slug, across all families.
 */
export const getLeagueBySlug = (slug) => {
    const normalized = String(slug || '').toLowerCase();
    for (const family of Object.values(TEAM_FAMILIES)) {
        const league = family.leagues.find((l) => l.slug === normalized);
        if (league) {
            return league;
        }
    }
    return null;
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
