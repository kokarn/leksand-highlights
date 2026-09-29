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
 * Build the lookup set for a favourites list.
 *
 * `selectedTeams` holds bare keys (that is what AsyncStorage persists), and a
 * key alone is often not enough: a FotbollPlay-sourced key like DEIF shares no
 * token with the standings code DEG. Pass `teamRoster` — the same { key, name }
 * list that populates the favourites picker — so each key can also contribute
 * its club name. Measured against the live Allsvenskan feeds: keys alone reach
 * 10 of 20 favourites, keys resolved through the roster reach 19.
 *
 * @param {Array<string|{key?: string, name?: string, code?: string}>} selectedTeams
 * @param {Array<{key?: string, code?: string, name?: string}>} [teamRoster]
 * @returns {Set<string>}
 */
export const buildFavoriteTokens = (selectedTeams = [], teamRoster = []) => {
    const tokens = new Set();
    const add = (value) => {
        const token = normalizeTeamToken(value);
        if (token) {
            tokens.add(token);
        }
    };

    // Index the roster by every label it offers, so a favourite key resolves to
    // the club name regardless of which id space that key came from.
    const rosterByToken = new Map();
    for (const team of teamRoster) {
        for (const label of [team?.key, team?.code, team?.name]) {
            const token = normalizeTeamToken(label);
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
            const match = rosterByToken.get(normalizeTeamToken(value));
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
            const token = normalizeTeamToken(value);
            return token && favoriteTokens.has(token);
        });
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
