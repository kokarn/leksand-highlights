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

// Column metrics, below. The table is mobile-first — every width was picked for
// a ~390px phone — so on a tablet or in a browser the fixed stat columns stayed
// 26px wide while the team column absorbed every extra pixel. These constants
// scale the columns off the viewport instead, and spend the extra room on the
// two stats the feeds already return but the phone layout has no space for.
const PHONE_WIDTH = 390;
// GF/GA need ~2 stat columns of room before they stop squeezing the team name.
const GOALS_MIN_WIDTH = 700;
// Below this the full club name ("Skellefteå AIK") does not beat the short one.
const FULL_NAME_MIN_WIDTH = 900;
// Above this the columns flex to fill the row instead of sitting at fixed widths.
const FILL_MIN_WIDTH = 560;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Column metrics for the standings table at a given viewport width.
 *
 * Two things make a table use its width, and fixed columns do neither. Measured
 * at 1440px before this: the row's content came to 987px of a 1352px row, and the
 * surplus 365px went into dead gaps between columns — the table was spread out
 * rather than filled. So above FILL_MIN_WIDTH the columns flex: each width below
 * becomes a minimum that grows to consume the row, stats capped at 1.5x so a
 * single digit does not float in a huge cell.
 *
 * The other half is chrome, and it mattered most on the phone this app is built
 * for. Two nested cards each drew their own border, radius and padding — the
 * block's and the table's, the latter vestigial from when every surface wrapped
 * the table itself — which on a 390px screen left the row 318px, an 18% tax. The
 * table no longer draws a card (the block's is the card) so only these remain:
 *
 *   screenPadding + 1px block border + rowPaddingH
 *
 * `blockPaddingH` is 0 by design: the table bleeds to the card's edges and the
 * block's header carries its own inset instead. There is no bottom padding and no
 * bottom radius either — the last row IS the card's bottom edge, and padding or a
 * curve there reads as an empty strip below the table. Type and logo sizes scale,
 * capped well below the 2x column cap — a 24px digit in a table row reads as
 * broken regardless of how wide the window is.
 *
 * @param {number} [windowWidth] - viewport width in dp (useWindowDimensions)
 * @returns {{showGoals: boolean, fullTeamName: boolean, fill: boolean,
 *            statMaxWidth: number|null, teamMinWidth: number,
 *            rank: number, stat: number, goalDiff: number, points: number,
 *            logo: number, cellFontSize: number, headerFontSize: number,
 *            rowPaddingH: number, rowPaddingV: number, teamGap: number,
 *            blockPaddingH: number, blockPaddingTop: number,
 *            blockHeaderPaddingH: number, screenPadding: number}}
 */
export const standingsColumnLayout = (windowWidth) => {
    const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : PHONE_WIDTH;
    const scale = clamp(width / PHONE_WIDTH, 1, 2);
    const fill = width >= FILL_MIN_WIDTH;
    const stat = Math.round(26 * scale);
    return {
        showGoals: width >= GOALS_MIN_WIDTH,
        fullTeamName: width >= FULL_NAME_MIN_WIDTH,
        // Columns grow to fill the row rather than leaving the surplus in gaps.
        fill,
        // Capped growth: past this a one- or two-digit value reads as adrift
        // rather than as a column, and the name column is the better home for
        // the remaining width.
        statMaxWidth: fill ? Math.round(stat * 1.5) : null,
        teamMinWidth: fill ? 150 : 0,
        rank: Math.round(22 * scale),
        stat,
        goalDiff: Math.round(32 * scale),
        points: Math.round(30 * scale),
        logo: Math.round(clamp(18 * scale, 18, 26)),
        cellFontSize: Math.round(clamp(12 * scale, 12, 15)),
        headerFontSize: Math.round(clamp(10 * scale, 10, 12)),
        // The row's own inset is the only one left between the card edge and a
        // cell, so it stays small and does NOT scale: it used to grow to 18px a
        // side, making the waste grow with the window that was wasting it.
        rowPaddingH: fill ? 10 : 8,
        rowPaddingV: Math.round(clamp(6 * scale, 6, 10)),
        teamGap: Math.round(clamp(6 * scale, 6, 12)),
        // Zero, always: the table runs to the card's edges. Only the TOP keeps
        // vertical padding, for the header above the table; the bottom has none,
        // because the last row is the card's bottom edge and any padding there
        // shows as an empty white strip under the table.
        blockPaddingH: 0,
        blockPaddingTop: fill ? 10 : 12,
        // What the header loses by the card no longer padding it.
        blockHeaderPaddingH: fill ? 10 : 12,
        screenPadding: fill ? 8 : 10
    };
};
