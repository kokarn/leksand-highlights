/**
 * Pure helpers for the team page. Kept free of React / React Native imports so
 * they can be unit-tested directly with `node --test`.
 *
 * `getTeamCode` is injected (per family) so the same logic works for hockey
 * (code lives on `team.code`) and football (same, but different logo source).
 */
import { teamIdentityToken, teamIdentityTokens } from './standingsIdentity.js';

/**
 * Does a team object refer to the given team identity?
 *
 * `team` may be a code, a club name, or another team object — the feeds do not
 * agree on codes, so everything is compared as normalized identity tokens.
 * Shared by gameInvolvesTeam, getTeamResult and the team page header.
 */
export const identityTokensFor = (team, getTeamCode) => {
    if (team instanceof Set) {
        return team;
    }
    if (typeof team === 'object' && team !== null) {
        return teamIdentityTokens(team, getTeamCode);
    }
    return new Set([teamIdentityToken(team)].filter(Boolean));
};

export const teamMatchesIdentity = (side, team, getTeamCode) => {
    if (!side) {
        return false;
    }
    const target = identityTokensFor(team, getTeamCode);
    if (!target.size) {
        return false;
    }
    for (const token of teamIdentityTokens(side, getTeamCode)) {
        if (target.has(token)) {
            return true;
        }
    }
    return false;
};

/**
 * Does a game involve the given team (home or away)?
 *
 * `team` is whatever identity the caller holds — a code, a club name, or a team
 * object — because the feeds disagree on codes. The Allsvenskan games feed is an
 * ESPN + FotbollPlay merge that carries TWO codes per club (Degerfors is both
 * DEG and DEIF), and the standings feed uses a third set whose SIR/MAL/GOT/BRO/
 * ORG/VAS appear in no games feed at all. Comparing a single uppercased code
 * therefore drops most of a club’s fixtures; comparing normalized identity
 * tokens matches every spelling of the same club. `getTeamCode` is still
 * consulted so a family-specific accessor keeps contributing its code.
 */
export const gameInvolvesTeam = (game, team, getTeamCode) => {
    return teamMatchesIdentity(game?.homeTeamInfo, team, getTeamCode)
        || teamMatchesIdentity(game?.awayTeamInfo, team, getTeamCode);
};

/**
 * Grow a team identity into every token the FEEDS use for that same club.
 *
 * A bare code cannot bridge the two id spaces on its own: the Allsvenskan games
 * feed records Degerfors as both DEG (ESPN, with names "Degerfors") and DEIF
 * (FotbollPlay), and `DEG` tokenizes to just {deg} — no token of a DEIF record
 * contains it, so filtering game-by-game finds 1 of 12 fixtures (measured).
 * The bridge only exists on the club NAME, which the URL param does not carry.
 *
 * So resolve against the fetched games first: any team object sharing a token
 * with the identity contributes all of ITS tokens, which pulls in the name, and
 * the name in turn matches the other code. DEG -> {deg, degerfor} -> DEIF.
 *
 * Iterated to a fixpoint (capped) because the hop is transitive. This is only
 * safe while no two DIFFERENT clubs in one family share a token, or the closure
 * would merge them — verified across all six live feeds: 265 football + 87
 * hockey tokens with zero within-family cross-club collisions. Navigation is
 * family-scoped, so the known cross-SPORT collisions cannot be reached here.
 *
 * @param {Array<object>} games
 * @param {string|object} team
 * @param {(team: object) => string|null} [getTeamCode]
 * @returns {Set<string>} every token that means this club
 */
export const resolveTeamIdentity = (games = [], team, getTeamCode) => {
    const identity = new Set(identityTokensFor(team, getTeamCode));
    if (!identity.size) {
        return identity;
    }
    const sides = [];
    for (const game of games) {
        for (const key of ['homeTeamInfo', 'awayTeamInfo']) {
            if (game?.[key]) {
                sides.push(teamIdentityTokens(game[key], getTeamCode));
            }
        }
    }
    // Three passes is ample: code -> name -> other code is two hops. The cap
    // keeps this O(games) rather than looping on pathological data.
    for (let pass = 0; pass < 3; pass += 1) {
        let grew = false;
        for (const tokens of sides) {
            let shared = false;
            for (const token of tokens) {
                if (identity.has(token)) {
                    shared = true;
                    break;
                }
            }
            if (!shared) {
                continue;
            }
            for (const token of tokens) {
                if (!identity.has(token)) {
                    identity.add(token);
                    grew = true;
                }
            }
        }
        if (!grew) {
            break;
        }
    }
    return identity;
};

/**
 * The games involving a team, matched on its resolved identity.
 *
 * Use this rather than filtering with gameInvolvesTeam directly whenever the
 * caller holds a bare code or name, so the two-codes-per-club case resolves.
 *
 * @param {Array<object>} games - fetched UNFILTERED, across the family
 * @param {string|object} team
 * @param {(team: object) => string|null} [getTeamCode]
 * @returns {Array<object>}
 */
export const selectTeamGames = (games = [], team, getTeamCode) => {
    const identity = resolveTeamIdentity(games, team, getTeamCode);
    if (!identity.size) {
        return [];
    }
    return games.filter((game) => gameInvolvesTeam(game, identity, getTeamCode));
};

const toScore = (result, team) => {
    const candidates = [result?.score, result?.goals, team?.score, team?.goals];
    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};

/**
 * Compute W / L / D / OT result for a completed game from the team's
 * perspective. Returns null if the game isn't finished or has no score.
 * 'OT' = overtime/shootout loss (hockey), surfaced as its own badge color.
 */
export const getTeamResult = (game, teamCode, getTeamCode) => {
    if (game?.state !== 'post-game') {
        return null;
    }
    // Same identity-token comparison as gameInvolvesTeam: an uppercased `===`
    // would call every Degerfors DEIF fixture an away game when the caller holds
    // DEG, and silently invert the W/L.
    const isHome = teamMatchesIdentity(game?.homeTeamInfo, teamCode, getTeamCode);
    const teamScore = toScore(isHome ? game?.homeTeamResult : game?.awayTeamResult, isHome ? game?.homeTeamInfo : game?.awayTeamInfo);
    const oppScore = toScore(isHome ? game?.awayTeamResult : game?.homeTeamResult, isHome ? game?.awayTeamInfo : game?.homeTeamInfo);
    if (teamScore === null || oppScore === null) {
        return null;
    }
    if (teamScore > oppScore) {
        return 'W';
    }
    if (teamScore < oppScore) {
        // Overtime/shootout loss still earns a point in hockey — flag it distinctly.
        const overtime = Boolean(game?.overtime || game?.shootout || game?.afterShootout || game?.afterOvertime);
        return overtime ? 'OT' : 'L';
    }
    return 'D';
};

/**
 * Given a team's games across one or more leagues, return the completed ones
 * sorted newest-first (for the "Latest games" list).
 */
export const selectCompletedGames = (games, teamCode, getTeamCode) => {
    return (games || [])
        .filter((game) => gameInvolvesTeam(game, teamCode, getTeamCode) && game?.state === 'post-game')
        .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
};

/**
 * Given a team's games, return upcoming (not-yet-final) ones sorted soonest-first.
 */
export const selectUpcomingGames = (games, teamCode, getTeamCode) => {
    return (games || [])
        .filter((game) => gameInvolvesTeam(game, teamCode, getTeamCode) && game?.state !== 'post-game')
        .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
};

/**
 * Recent form (most-recent-first) as an array of 'W'|'L'|'D'|'OT', limited to
 * `limit` entries. Built from completed games.
 */
export const computeForm = (completedGames, teamCode, getTeamCode, limit = 5) => {
    return completedGames
        .map((game) => getTeamResult(game, teamCode, getTeamCode))
        .filter(Boolean)
        .slice(0, limit);
};

/**
 * De-duplicate games merged from multiple leagues by their stable id.
 */
export const dedupeGames = (games) => {
    const seen = new Set();
    const out = [];
    for (const game of games || []) {
        const key = String(game?.uuid || game?.id || `${game?.startDateTime}-${game?.homeTeamInfo?.code}-${game?.awayTeamInfo?.code}`);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(game);
    }
    return out;
};

/**
 * From a team's games (each tagged with a `sport` slug), return the distinct
 * league slugs the team actually appears in, in the order the family declares
 * them. Used to render "View standings" buttons only for the team's leagues.
 *
 * @param {Array} games   games involving the team, each carrying `.sport`
 * @param {Array} leagues the family's ordered league entries ({slug,...})
 */
export const leaguesForTeam = (games, leagues) => {
    const present = new Set((games || []).map((game) => String(game?.sport || '').toLowerCase()));
    return (leagues || []).filter((league) => present.has(league.slug));
};
