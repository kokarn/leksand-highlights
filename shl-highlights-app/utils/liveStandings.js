/**
 * Live standings — the table as it would stand if every in-progress game ended
 * at its current score.
 *
 * The standings feeds only ever count COMPLETED games: the hockey tables are
 * computed server-side from post-game results (modules/providers/shl.js), and
 * the football one comes from an upstream feed that updates after full time. So
 * while a round is being played the table is correct but behind, and the obvious
 * question — "where would my team be if this held?" — has no answer on screen.
 * This answers it client-side, from the games the app has already loaded, with
 * no new endpoint.
 *
 * Deliberately free of React / React Native imports so it can be unit-tested
 * directly with `node --test`, the same reason utils/standingsPresentation.js
 * and utils/teamGames.js are.
 */

import { normalizeScoreValue } from './index.js';
import { teamIdentityToken } from './standingsIdentity.js';

/**
 * The live games that can actually move a table, with their scores resolved.
 *
 * A live game whose score has NOT been resolved yet is skipped rather than read
 * as 0-0: the schedule feeds carry `score: null` for a live game until the
 * play-by-play endpoint is consulted, and treating that as a goalless draw
 * would hand out points for a game nobody has seen the score of.
 *
 * @param {Array<object>} games
 * @returns {Array<{home: object, away: object, homeScore: number, awayScore: number}>}
 */
const resolvedLiveGames = (games) => {
    if (!Array.isArray(games)) {
        return [];
    }
    const seen = new Set();
    const out = [];
    for (const game of games) {
        if (game?.state !== 'live') {
            continue;
        }
        // The hockey tab merges SHL and HA lists, and a caller may pass a
        // concatenation, so the same fixture can appear twice. Counting it twice
        // would double its goals.
        const id = game.uuid ?? game.id;
        if (id !== undefined && id !== null) {
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
        }
        const homeScore = normalizeScoreValue(game.homeTeamInfo?.score);
        const awayScore = normalizeScoreValue(game.awayTeamInfo?.score);
        if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
            continue;
        }
        out.push({
            home: game.homeTeamInfo,
            away: game.awayTeamInfo,
            homeScore,
            awayScore
        });
    }
    return out;
};

// Every label a games-feed team might carry its identity in, folded through the
// one token function the rest of the app matches on. Mirrors IDENTITY_LABELS in
// standingsIdentity.js, which is not exported.
const gameTeamTokens = (team) => [
    team?.code,
    team?.names?.code,
    team?.names?.short,
    team?.names?.long,
    team?.names?.full
].map(teamIdentityToken).filter(Boolean);

// A standings row's own tokens, read from the same slots standingsRowIsFavorite
// compares (see standingsIdentity.js).
const rowTokens = (row) => [
    row?.teamCode,
    row?.teamShortName,
    row?.teamName
].map(teamIdentityToken).filter(Boolean);

/**
 * Apply one finished-as-it-stands result to a mutable row pair.
 *
 * The point rules match the server's own calculation in
 * modules/providers/shl.js:376-404, so a projection agrees with what the real
 * table will say once the game is in the books.
 *
 * The tie is the one case the data cannot settle. Hockey cannot end level — it
 * goes to overtime or a shootout — so a tied live game has no derivable winner.
 * Rather than invent one, both teams get the single point they are ALREADY
 * guaranteed by reaching overtime, and the extra point that the OT result
 * decides is left unawarded. No W/OW/OL/L is recorded either, because none has
 * happened yet. Football has a real draw, so there the tie is simply a draw.
 *
 * A team leading when the whistle goes has won in regulation, which is 3 points
 * in both codes, so this needs no sport branch — only the tie does.
 *
 * @param {object} leaderStats - mutable copy of the leading team's row
 * @param {object} trailerStats - mutable copy of the trailing team's row
 */
const applyResult = (leaderStats, trailerStats) => {
    if (!leaderStats || !trailerStats) {
        return;
    }
    leaderStats.points += 3;
    leaderStats.wins += 1;
    trailerStats.losses += 1;
};

const applyTie = (homeStats, awayStats, isHockey) => {
    for (const stats of [homeStats, awayStats]) {
        if (!stats) {
            continue;
        }
        stats.points += 1;
        if (!isHockey) {
            stats.draws += 1;
        }
    }
};

/**
 * Project a standings payload forward over the live games.
 *
 * @param {{standings?: Array<object>}} data - a standings payload as the API returns it
 * @param {Array<object>} games - games list (any states; only live ones are read)
 * @param {object} [options]
 * @param {string} [options.sport] - 'shl' | 'hockey' | 'hockeyallsvenskan' for the
 *        hockey point rules; anything else is treated as football. Falls back to
 *        sniffing the rows, which carry `overtimeWins` for hockey and `draws` for
 *        football.
 * @returns {{standings: Array<object>, liveTokens: Set<string>}|null}
 *          null when nothing is live, no live score has resolved, or no live
 *          game maps onto a row — which is the signal to hide the control
 *          rather than offer a toggle that changes nothing.
 */
export const projectLiveStandings = (data, games, options = {}) => {
    const rows = Array.isArray(data?.standings) ? data.standings : [];
    if (!rows.length) {
        return null;
    }
    const live = resolvedLiveGames(games);
    if (!live.length) {
        return null;
    }

    const sport = String(options.sport || '').toLowerCase();
    const isHockey = sport
        ? sport === 'shl' || sport === 'hockey' || sport === 'hockeyallsvenskan'
        : rows.some((row) => row?.overtimeWins !== undefined);

    // Index the rows by every token they answer to, so a games-feed team can
    // find its row across the two id spaces. teamIdentityToken is the same fold
    // favourite matching and team navigation use; test/standings-identity.test.js
    // pins it as collision-free across all six live feeds.
    const working = rows.map((row) => ({
        ...row,
        gamesPlayed: Number(row?.gamesPlayed) || 0,
        wins: Number(row?.wins) || 0,
        losses: Number(row?.losses) || 0,
        draws: Number(row?.draws) || 0,
        points: Number(row?.points) || 0,
        goalsFor: Number(row?.goalsFor) || 0,
        goalsAgainst: Number(row?.goalsAgainst) || 0
    }));

    const byToken = new Map();
    working.forEach((row) => {
        for (const token of rowTokens(row)) {
            if (!byToken.has(token)) {
                byToken.set(token, row);
            }
        }
    });

    const findRow = (team) => {
        for (const token of gameTeamTokens(team)) {
            const row = byToken.get(token);
            if (row) {
                return row;
            }
        }
        return null;
    };

    // Tokens of the rows a live game touches, for the caller's row tint.
    const liveTokens = new Set();
    let applied = 0;

    for (const game of live) {
        const homeRow = findRow(game.home);
        const awayRow = findRow(game.away);
        // A game only one of whose clubs has a row (a cup fixture against a club
        // from another division, say) cannot be projected onto this table.
        if (!homeRow || !awayRow || homeRow === awayRow) {
            continue;
        }
        applied += 1;
        for (const row of [homeRow, awayRow]) {
            for (const token of rowTokens(row)) {
                liveTokens.add(token);
            }
        }

        homeRow.gamesPlayed += 1;
        awayRow.gamesPlayed += 1;
        homeRow.goalsFor += game.homeScore;
        homeRow.goalsAgainst += game.awayScore;
        awayRow.goalsFor += game.awayScore;
        awayRow.goalsAgainst += game.homeScore;

        if (game.homeScore > game.awayScore) {
            applyResult(homeRow, awayRow);
        } else if (game.awayScore > game.homeScore) {
            applyResult(awayRow, homeRow);
        } else {
            applyTie(homeRow, awayRow, isHockey);
        }
    }

    if (!applied) {
        return null;
    }

    // Re-sort on the same keys the server uses (shl.js:412-423) so the
    // projection orders ties the way the real table will.
    const sorted = working
        .map((row) => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst }))
        .sort((a, b) => {
            if (b.points !== a.points) { return b.points - a.points; }
            if (b.goalDiff !== a.goalDiff) { return b.goalDiff - a.goalDiff; }
            return b.goalsFor - a.goalsFor;
        });

    // `note` belongs to the SLOT, not the club: Allsvenskan's feed marks
    // positions ("Relegation", "Champions League qualifying") and
    // getDividerPositions derives its dividers from runs of equal notes. Carried
    // along with a moving row, the relegation band would travel up the table
    // with whoever was relegation-marked before kickoff. So read the notes off
    // the ORIGINAL order by position and reapply them positionally.
    const noteByPosition = new Map();
    rows.forEach((row, index) => {
        const position = Number(row?.position);
        noteByPosition.set(Number.isFinite(position) ? position : index + 1, row?.note);
    });

    const standings = sorted.map((row, index) => {
        const position = index + 1;
        const note = noteByPosition.get(position);
        const next = { ...row, position };
        if (note === undefined) {
            delete next.note;
        } else {
            next.note = note;
        }
        return next;
    });

    return { standings, liveTokens };
};

/**
 * Whether a standings row is one the live projection touched, for the row tint.
 * @param {object} row
 * @param {Set<string>|null} liveTokens - from projectLiveStandings
 * @returns {boolean}
 */
export const standingsRowIsLive = (row, liveTokens) => {
    if (!row || !liveTokens?.size) {
        return false;
    }
    return rowTokens(row).some((token) => liveTokens.has(token));
};
