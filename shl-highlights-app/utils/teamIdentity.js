/**
 * Team identity (app side) — the single source of truth for turning a team
 * object from the API into a display name, code, stable key, or LOGO URI.
 *
 * The backend already normalizes every team into { code, uuid, names:{short,long},
 * icon }. Before this module the same fallback chains were inlined in GameCard,
 * FootballGameCard, FootballMatchModal, teamFamilies, and all four football data
 * hooks — and the two logo mechanisms (hockey local PNG by code vs football
 * upstream icon URL) were picked by hand at every card. Route everything here so
 * a team looks identical in every surface and a new sport is one switch case.
 *
 * Canonical display rule (agreed with Oskar, Jul 2026): prefer SHORT everywhere
 * compact (cards, titles); pass { prefer: 'long' } only for long-form contexts.
 */
import { getTeamLogoUrl, resolveMediaUrl } from '../api/shl';

/**
 * Human-readable team name. Prefers short by default, then long, then code.
 * @param {object} team
 * @param {{prefer?: 'short'|'long', fallback?: string}} [opts]
 * @returns {string}
 */
export const getTeamName = (team, { prefer = 'short', fallback = '' } = {}) => {
    if (!team) {
        return fallback;
    }
    const short = team.names?.short;
    const long = team.names?.long;
    const ordered = prefer === 'long' ? [long, short] : [short, long];
    for (const value of ordered) {
        if (value) {
            return value;
        }
    }
    return team.code || fallback;
};

/**
 * Team code (for logo lookup + FCM targeting). Falls through to the short name.
 * @param {object} team
 * @param {string} [fallback='']
 * @returns {string}
 */
export const getTeamCode = (team, fallback = '') => {
    if (!team) {
        return fallback;
    }
    return team.code || team.names?.short || fallback;
};

/**
 * Uppercased team code — the form used to compare/filter teams (selectedTeams,
 * gameInvolvesTeam). Returns null when nothing resolves so callers can skip.
 * @param {object} team
 * @returns {string|null}
 */
export const getTeamCodeUpper = (team) => {
    const code = getTeamCode(team, '');
    return code ? String(code).toUpperCase() : null;
};

/**
 * Stable dedup/map key for a team. Prefers code, then uuid, then names.
 * @param {object} team
 * @returns {string|null}
 */
export const getTeamKey = (team) => {
    if (!team) {
        return null;
    }
    return team.code || team.uuid || team.names?.short || team.names?.long || null;
};

/**
 * The ONE logo resolver. Hockey (SHL + HockeyAllsvenskan) serves local static
 * PNGs keyed by lowercased team code; football (Allsvenskan, Svenska Cupen,
 * Europa/Conference qual) uses the upstream `icon` URL through the image proxy.
 * Pass the team's `family` ('hockey' | 'football') or its sport slug — both are
 * accepted. Unknown/absent → falls back to the upstream icon so nothing breaks.
 * @param {object} team
 * @param {string} [familyOrSport] - 'hockey' | 'football' | a sport slug
 * @returns {string|null}
 */
const HOCKEY_SLUGS = new Set(['hockey', 'shl', 'hockeyallsvenskan']);

export const getTeamLogoUri = (team, familyOrSport) => {
    if (!team) {
        return null;
    }
    const key = String(familyOrSport || team.sport || '').toLowerCase();
    if (HOCKEY_SLUGS.has(key)) {
        const code = getTeamCode(team, '');
        return code ? getTeamLogoUrl(code) : resolveMediaUrl(team.icon);
    }
    // Football and everything else: upstream icon URL via the proxy.
    return resolveMediaUrl(team.icon);
};
