/**
 * Standings presentation — the shape and chrome decisions a standings table
 * needs, kept separate from the row-identity matching in standingsIdentity.js.
 *
 * Extracted because four surfaces render standings (the sport tab's Standings
 * scope, the standalone /standings/<league> screen, and both match modals'
 * Standings tabs) and each had re-implemented these decisions. The flat-vs-
 * grouped branch in particular existed four times behind three different
 * predicates — `standingsFormat === 'groups'`, a hardcoded
 * `sport === 'svenska-cupen'`, and a structural split into two render functions
 * — so a new grouped league would have had to be taught to all three.
 *
 * Kept free of React / React Native imports so it can be unit-tested directly
 * with `node --test`, the same reason utils/teamGames.js is.
 */

import { getTeamLogoUrl, resolveMediaUrl } from '../api/shl.js';

// Hockey standings rows carry no usable icon URL; their crests are local static
// PNGs keyed by team code. Football rows carry an upstream icon that has to go
// through the image proxy. This is the one place that difference lives.
const HOCKEY_STANDINGS_SPORTS = new Set(['shl', 'hockey', 'hockeyallsvenskan']);

/**
 * The logo URL for one standings row.
 * @param {object} row - standings row
 * @param {string} [standingsSport] - the league's `standingsSport` ('shl' | 'football')
 * @returns {string|null}
 */
export const standingsRowLogo = (row, standingsSport) => {
    if (!row) {
        return null;
    }
    if (HOCKEY_STANDINGS_SPORTS.has(String(standingsSport || '').toLowerCase())) {
        const code = row.teamCode || row.teamShortName;
        return code ? getTeamLogoUrl(code) : resolveMediaUrl(row.teamIcon);
    }
    return resolveMediaUrl(row.teamIcon || row.icon);
};

/**
 * A stable React key / display fallback for one standings row. Reads every id
 * slot the feeds use, because Svenska Cupen puts the club NAME in `teamCode`
 * while the league feeds put a code there.
 * @param {object} row
 * @returns {string|undefined}
 */
export const standingsRowKey = (row) => row?.teamCode || row?.code || row?.key || row?.teamShortName;

/**
 * Split a standings payload into the blocks to render, so a caller never has to
 * know whether a league is a flat table or a set of cup groups.
 *
 * Driven by the league config's `standingsFormat` (constants/teamFamilies.js),
 * never by the sport slug: `standingsSport` is the COLUMN set (hockey shows
 * OW/OL, football shows D) and says nothing about the table's shape.
 *
 * @param {{slug?: string, label?: string, standingsFormat?: string}} [league]
 * @param {{standings?: Array<object>, groups?: Array<object>}} [data]
 * @returns {Array<{id: string, title: string|null, rows: Array<object>, lastUpdated: string|null}>}
 *          One entry per block. Cup groups carry their own `lastUpdated`, so a
 *          section prefers it and falls back to the payload-level one. Empty
 *          when there is nothing to render — a legitimate state for Svenska
 *          Cupen before the group stage is drawn, where the feed returns
 *          `groups: []`.
 */
export const standingsSections = (league, data) => {
    if (league?.standingsFormat === 'groups') {
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        return groups
            .map((group, index) => ({
                id: String(group?.id || group?.name || index),
                title: group?.name || null,
                rows: Array.isArray(group?.standings) ? group.standings : [],
                lastUpdated: group?.lastUpdated || data?.lastUpdated || null
            }))
            .filter((section) => section.rows.length > 0);
    }

    const rows = Array.isArray(data?.standings) ? data.standings : [];
    if (!rows.length) {
        return [];
    }
    // A flat table is one unnamed block: the league name already sits in the
    // block header, so a title here would just repeat it.
    return [{ id: String(league?.slug || 'standings'), title: null, rows, lastUpdated: data?.lastUpdated || null }];
};
