/**
 * Team identity — the single source of truth for turning an upstream/normalized
 * team object into a display name, a code, a stable key, or a comparable string.
 *
 * Every provider (SHL, HockeyAllsvenskan, Allsvenskan + its UEFA-qual subclasses,
 * Svenska Cupen) normalizes teams into the SAME shape:
 *   { code, uuid, names: { short, long }, icon, score }
 * so the same resolver works for all sports. Before this module the fallback
 * chains (`names.short || names.long || code`, and its many reorderings) were
 * copy-pasted across providers, the goal-watcher, and the pre-game-watcher — and
 * they disagreed (some preferred `.long`, some `.short`), so the same club showed
 * one name in a card and a different one in a push. Route everything through here.
 *
 * Canonical display rule (agreed with Oskar, Jul 2026):
 *   - Cards, notification TITLES, anything compact  → prefer SHORT.
 *   - Long-form bodies (e.g. the pre-game push body) → prefer LONG.
 */

/**
 * Human-readable team name.
 * @param {Object} teamInfo - normalized team ({ names:{short,long}, code })
 * @param {Object} [opts]
 * @param {'short'|'long'} [opts.prefer='short'] - which name to try first
 * @param {string} [opts.fallback] - value if nothing resolves (defaults to '')
 * @returns {string}
 */
function getTeamName(teamInfo, { prefer = 'short', fallback = '' } = {}) {
    if (!teamInfo) {
        return fallback;
    }
    const short = teamInfo.names?.short;
    const long = teamInfo.names?.long;
    const ordered = prefer === 'long' ? [long, short] : [short, long];
    for (const value of ordered) {
        if (value) {
            return value;
        }
    }
    return teamInfo.code || fallback;
}

/**
 * Team code used for logo lookup, FCM team targeting, and cheap identity.
 * Falls through to the short name so football clubs (whose upstream `code` may be
 * absent) still get a stable string.
 * @param {Object} teamInfo
 * @param {string} [fallback='']
 * @returns {string}
 */
function getTeamCode(teamInfo, fallback = '') {
    if (!teamInfo) {
        return fallback;
    }
    return teamInfo.code || teamInfo.names?.short || fallback;
}

/**
 * Stable dedup/map key for a team. Prefers the immutable upstream uuid, then code,
 * then names. Used where two entries must not collide (team lists, standings maps).
 * @param {Object} teamInfo
 * @returns {string|null}
 */
function getTeamKey(teamInfo) {
    if (!teamInfo) {
        return null;
    }
    return (
        teamInfo.code ||
        teamInfo.uuid ||
        teamInfo.names?.short ||
        teamInfo.names?.long ||
        null
    );
}

/**
 * Diacritic-stripped, punctuation-free, lowercased form of a string — for fuzzy
 * name matching (FotbollPlay title matching, bracket feeder linking, etc.).
 * Kept identical to the historic AllsvenskanProvider.normalizeComparableText so
 * existing match scores are unchanged.
 * @param {string} value
 * @returns {string}
 */
function normalizeComparableText(value) {
    if (!value) {
        return '';
    }
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

module.exports = {
    getTeamName,
    getTeamCode,
    getTeamKey,
    normalizeComparableText
};
