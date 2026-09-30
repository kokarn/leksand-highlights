/**
 * Standings identity — joining a standings row to a favourited team.
 *
 * The standings feeds and the games feeds do NOT share an id space, so the
 * obvious `selectedTeams.includes(row.teamCode)` check silently under-matches:
 *
 *   - Allsvenskan favourites come from the games feed, which is a merge of ESPN
 *     and FotbollPlay. Those two disagree per club (Degerfors is DEG on ESPN and
 *     DEIF on FotbollPlay), and the standings feed uses a THIRD set of its own
 *     (Sirius is IKS in games but SIR in standings). Only 10 of 16 rows matched
 *     by code; a FotbollPlay-sourced favourite reached just 6.
 *   - Svenska Cupen standings put the club NAME in `teamCode` ("Mjällby", not
 *     MJA), so a code comparison misses there for a different reason.
 *
 * Every feed does agree on the club's *name*, so match on a normalized name
 * token with the code/uuid as extra candidates. Verified against the live API:
 * 16/16 Allsvenskan, 31/32 Svenska Cupen, 14/14 SHL, 14/14 HockeyAllsvenskan.
 * (The one cup miss is a club with no fixture in the feed, so it can't be
 * favourited in the first place — the picker is built from games.)
 */

// Club-type words carry no identity: "IF Elfsborg"/"Elfsborg", "Mjällby AIF"/
// "Mjällby". Stripping them is what lets the three id spaces meet.
const CLUB_WORDS = /\b(if|ifk|ik|bk|fc|ff|aif|sk|is|fk|bois|united|fotboll)\b/g;

/**
 * Normalize any team label (code, name, short name) to a comparable token.
 * Diacritics are folded so "Mjällby" and "Mjallby" agree.
 * @param {string|number} value
 * @returns {string} '' when nothing usable remains
 */
export const normalizeTeamToken = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(CLUB_WORDS, ' ')
    .replace(/\s+/g, '');

/**
 * Swedish clubs appear with and without the genitive -s: the Allsvenskan
 * standings feed says "Djurgarden" where the games feed says "Djurgardens IF",
 * and "Halmstad"/"Halmstads" differ the same way. Fold a trailing -s so those
 * meet. Guarded on length so short codes (GAIS, AIS, VIS) survive intact.
 *
 * Verified against all six live feeds (SHL, HockeyAllsvenskan, Allsvenskan,
 * Svenska Cupen, Europa/Conference qual): 265 football + 87 hockey distinct
 * stems with ZERO cross-club collisions, so the fold never merges two clubs.
 * That claim is pinned by the pairwise-distinctness sweep in
 * test/standings-identity.test.js, so it fails loudly if a club changes league.
 *
 * This is the ONE token function every comparison in this module uses —
 * favourite matching and team-page navigation alike. They used to differ by
 * exactly this fold, which meant a row could navigate correctly while never
 * highlighting: the standings feed's "Djurgarden" resolved to the games feed's
 * "Djurgardens IF" for the URL but not for the favourite tint.
 *
 * @param {string|number} value
 * @returns {string} '' when nothing usable remains
 */
export const teamIdentityToken = (value) => {
    const token = normalizeTeamToken(value);
    return token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token;
};

// Every label a team object might carry its identity in. Standings rows use
// teamCode/teamShortName/teamName; games-feed teams use code/names.*; the cup
// puts the club NAME in the code slot. Read them all rather than guess a shape.
const IDENTITY_LABELS = (team) => [
    team?.code,
    team?.teamCode,
    team?.key,
    team?.name,
    team?.teamName,
    team?.teamShortName,
    team?.names?.code,
    team?.names?.short,
    team?.names?.long,
    team?.names?.full
];

/**
 * Every identity token a team object resolves to, for matching one feed's team
 * against another's. Pass `getTeamCode` (a TEAM_FAMILIES accessor) to fold in a
 * family-specific code as well.
 *
 * @param {object} team
 * @param {(team: object) => string|null} [getTeamCode]
 * @returns {Set<string>}
 */
export const teamIdentityTokens = (team, getTeamCode) => {
    const tokens = new Set();
    if (!team) {
        return tokens;
    }
    const labels = IDENTITY_LABELS(team);
    if (typeof getTeamCode === 'function') {
        labels.push(getTeamCode(team));
    }
    for (const label of labels) {
        const token = teamIdentityToken(label);
        if (token) {
            tokens.add(token);
        }
    }
    return tokens;
};

/**
 * Build the lookup set for a favourites list.
 *
 * `selectedTeams` holds bare keys (that is what AsyncStorage persists), and a
 * key alone is often not enough: a FotbollPlay-sourced key like DEIF shares no
 * token with the standings code DEG. Pass `teamRoster` — the same { key, name }
 * list that populates the favourites picker — so each key can also contribute
 * its club name. Measured against the live Allsvenskan feeds: keys alone reach
 * 10 of 20 favourites, keys resolved through the roster reach 19, and resolved
 * through the roster with the genitive fold reach 20 of 20.
 *
 * @param {Array<string|{key?: string, name?: string, code?: string}>} selectedTeams
 * @param {Array<{key?: string, code?: string, name?: string}>} [teamRoster]
 * @returns {Set<string>}
 */
export const buildFavoriteTokens = (selectedTeams = [], teamRoster = []) => {
    const tokens = new Set();
    const add = (value) => {
        const token = teamIdentityToken(value);
        if (token) {
            tokens.add(token);
        }
    };

    // Index the roster by every label it offers, so a favourite key resolves to
    // the club name regardless of which id space that key came from.
    const rosterByToken = new Map();
    for (const team of teamRoster) {
        for (const label of [team?.key, team?.code, team?.name]) {
            const token = teamIdentityToken(label);
            if (token && !rosterByToken.has(token)) {
                rosterByToken.set(token, team);
            }
        }
    }

    for (const entry of selectedTeams) {
        const isBareKey = typeof entry === 'string' || typeof entry === 'number';
        const values = isBareKey ? [entry] : [entry?.key, entry?.code, entry?.name];
        for (const value of values) {
            add(value);
        }
        // Expand through the roster: DEIF (favourite) -> "Degerfors" -> matches DEG.
        for (const value of values) {
            const match = rosterByToken.get(teamIdentityToken(value));
            if (match) {
                add(match.name);
                add(match.key);
                add(match.code);
            }
        }
    }
    return tokens;
};

/**
 * Whether a standings row belongs to a favourited team.
 *
 * Compares with teamIdentityToken, the same fold navigation uses. Both sides of
 * every comparison must fold identically: the stems it produces are lossy
 * ("Sirius" → siriu, "Degerfors" → degerfor, "Brynäs IF" → bryna) and only
 * meet because the favourite tokens went through the same function.
 *
 * @param {object} row - standings row ({ teamCode, teamUuid, teamShortName, teamName })
 * @param {Set<string>} favoriteTokens - from buildFavoriteTokens
 * @returns {boolean}
 */
export const standingsRowIsFavorite = (row, favoriteTokens) => {
    if (!row || !favoriteTokens?.size) {
        return false;
    }
    return [row.teamCode, row.teamUuid, row.teamShortName, row.teamName]
        .some((value) => {
            const token = teamIdentityToken(value);
            return token && favoriteTokens.has(token);
        });
};

/**
 * The value to put in a team-page URL for a standings row.
 *
 * Standings codes are NOT usable as a games-feed identity for every club: the
 * Allsvenskan standings feed invents its own set, and six of its codes (SIR,
 * MAL, GOT, BRO, ORG, VAS) appear nowhere in the games feeds, so navigating
 * with them lands on an empty team page. The club NAME resolves in every feed,
 * so prefer a roster-resolved games code when we have the roster and fall back
 * to the name — never to a bare standings code.
 *
 * @param {object} row - standings row
 * @param {Array<{key?: string, code?: string, name?: string}>} [teamRoster]
 *        the games-derived roster, so the row can resolve to a real feed code
 * @returns {string|null}
 */
export const standingsRowTeamParam = (row, teamRoster = []) => {
    if (!row) {
        return null;
    }
    const tokens = teamIdentityTokens(row);
    for (const team of teamRoster) {
        const candidate = team?.key || team?.code;
        if (!candidate) {
            continue;
        }
        const matched = [...teamIdentityTokens(team)].some((token) => tokens.has(token));
        if (matched) {
            return String(candidate);
        }
    }
    const fallback = row.teamName || row.teamShortName || row.teamCode;
    return fallback ? String(fallback) : null;
};

/**
 * Qualification / relegation boundaries drawn under a table.
 *
 * Two sources, in priority order:
 *  1. The row's own `note` ("Champions League qualifying", "Relegation playoff",
 *     …). Allsvenskan supplies these, and they are authoritative — they come
 *     from the feed and stay correct when the league changes format.
 *  2. Hardcoded position thresholds, for feeds with no notes (verified: SHL and
 *     HockeyAllsvenskan return no `note` on any row).
 *
 * This replaces keying thresholds off the *column set* (`sport`), which drew
 * SHL's 6/10/12 playoff lines onto HockeyAllsvenskan and Allsvenskan's 3/13/14
 * relegation lines onto 4-team cup groups.
 */
const DIVIDERS_BY_LEAGUE = {
    // 1-6 direct playoffs, 7-10 playoff qualification, 11-12 safe, 13-14 relegation
    shl: [6, 10, 12],
    // Two-legged qualification round decides the last SHL spot.
    hockeyallsvenskan: [2, 6, 10],
    // Fallback only — Allsvenskan rows normally carry `note`.
    allsvenskan: [3, 13, 14],
    // Cup groups are 4 teams; only the group winner advances.
    'svenska-cupen': [1]
};

/**
 * What each hardcoded boundary MEANS, so the hockey tables can label their lines
 * the way the football ones do.
 *
 * Allsvenskan gets its labels free: every row carries a `note` from the feed and
 * the table prints it. The hockey feeds return no `note` on any row, so their
 * dividers were unlabelled lines — the reader saw that something changes after
 * 6th but not what. These supply that text, keyed by the position the line is
 * drawn AFTER so they line up with DIVIDERS_BY_LEAGUE above.
 *
 * Kept next to the thresholds deliberately: a league that changes format needs
 * both edited together, and splitting them is how they drift.
 */
const DIVIDER_LABELS_BY_LEAGUE = {
    shl: {
        // 1-6 go straight to the quarterfinals.
        6: 'Playoffs',
        // 7-10 play a best-of-three for the last two quarterfinal spots.
        10: 'Play-in',
        // 13-14 play the Direktkval; 14th is the worst position in the league.
        12: 'Relegation playoff'
    },
    hockeyallsvenskan: {
        // Top two meet in the Direktkval for a place in the SHL.
        2: 'SHL qualification',
        // 3-6 enter the playoff round that feeds into it.
        6: 'Playoffs',
        // 7-10 are safe but done; below 10 is the relegation group.
        10: 'Relegation group'
    },
    allsvenskan: {
        3: 'Europe',
        13: 'Relegation playoff',
        14: 'Relegation'
    }
};

/**
 * The label for one divider, or null when it should be drawn as a bare line.
 *
 * `standings` is required, and not for the position: it decides WHICH source is
 * in charge. A feed that labels its own boundaries is authoritative for all of
 * them, including the ones it deliberately leaves unlabelled. Allsvenskan draws a
 * line after 13th (the boundary into the noted relegation rows) that carries no
 * note of its own, and filling that from the hardcoded table printed "Relegation
 * playoff" twice — once after 13 and again after 14. So when any row has a note,
 * this returns nothing and the row's own note is the only label.
 *
 * @param {string} [league] - league slug
 * @param {number} position - the position the divider is drawn after
 * @param {Array<object>} [standings] - the rows being rendered
 * @returns {string|null}
 */
export const getDividerLabel = (league, position, standings = []) => {
    // A noted feed owns its labels; see above.
    if (Array.isArray(standings) && standings.some((row) => row?.note)) {
        return null;
    }
    const labels = DIVIDER_LABELS_BY_LEAGUE[String(league || '').toLowerCase()];
    if (!labels) {
        return null;
    }
    return labels[Number(position)] || null;
};

/**
 * Positions to draw a divider AFTER, for one table.
 * @param {Array<object>} standings - the rows being rendered
 * @param {string} [league] - league slug ('shl', 'allsvenskan', 'svenska-cupen', …)
 * @returns {number[]}
 */
export const getDividerPositions = (standings = [], league) => {
    // Prefer the feed's own notes: a divider goes after the last row of each
    // distinct note group, and after the last noted row before an unnoted run.
    const noted = standings.some((row) => row?.note);
    if (noted) {
        const positions = [];
        standings.forEach((row, index) => {
            const next = standings[index + 1];
            const current = row?.note || '';
            const following = next?.note || '';
            if (next && current !== following) {
                positions.push(Number(row.position));
            }
        });
        return positions.filter((position) => Number.isFinite(position));
    }

    if (!standings.length) {
        return [];
    }
    const thresholds = DIVIDERS_BY_LEAGUE[String(league || '').toLowerCase()] || [];
    // Never draw a line at or past the final row — it reads as a stray border.
    // A row without a usable position means we cannot tell where the end is, so
    // fall back to the row count.
    const lastPosition = Number(standings[standings.length - 1]?.position);
    const endPosition = Number.isFinite(lastPosition) ? lastPosition : standings.length;
    return thresholds.filter((position) => position < endPosition);
};
