/**
 * Pure helpers for the team page. Kept free of React / React Native imports so
 * they can be unit-tested directly with `node --test`.
 *
 * `getTeamCode` is injected (per family) so the same logic works for hockey
 * (code lives on `team.code`) and football (same, but different logo source).
 */

const upper = (value) => (value ? String(value).toUpperCase() : null);

/**
 * Does a game involve the given team code (home or away)?
 */
export const gameInvolvesTeam = (game, teamCode, getTeamCode) => {
    const target = upper(teamCode);
    if (!target) {
        return false;
    }
    const home = upper(getTeamCode(game?.homeTeamInfo));
    const away = upper(getTeamCode(game?.awayTeamInfo));
    return home === target || away === target;
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
    const target = upper(teamCode);
    const isHome = upper(getTeamCode(game?.homeTeamInfo)) === target;
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
