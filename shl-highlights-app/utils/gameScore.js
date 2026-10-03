/**
 * The score a game's detail view should display.
 *
 * A live game's score is available from three sources that do NOT agree, which
 * is the whole reason this exists. Measured on a live game (Leksand-Oskarshamn,
 * 2026-10-03) while it stood at 3-3:
 *
 *   play-by-play goal events  3-3   <- current
 *   game-info team scores     3-3   <- current (server resolves it from events)
 *   post-game-data/team-stats 3-2   <- a goal behind, persistently
 *
 * team-stats is a POST-game endpoint. While a game is in progress it lags, and
 * not as a momentary race: it was sampled repeatedly a goal behind. The modal
 * header preferred it, so the header read 3-1 while the events list directly
 * beneath it already showed the 3-2 goal — the header disagreeing with the very
 * list it sits above.
 *
 * So for a game in progress the goal events win. They are the same rows the
 * events list renders, which makes the header unable to contradict it: both now
 * read the same source. team-stats stays in the chain as a fallback for the case
 * it is actually good for — a finished game, where it has caught up and carries
 * the shots/PP/PIM totals the view needs anyway.
 *
 * Kept free of React / React Native imports so it can be unit-tested directly
 * with `node --test`, the same reason utils/standingsPresentation.js is.
 */

import { normalizeScoreValue } from './index.js';

/**
 * Numeric elapsed seconds for a hockey event's "mm:ss" period clock.
 * String comparison is not safe here ("9:30" vs "10:06"), and the feed is not
 * guaranteed to be ordered.
 * @param {string} time
 * @returns {number} -Infinity when unparseable, so it never wins a max()
 */
const eventSeconds = (time) => {
    if (!time) {
        return Number.NEGATIVE_INFINITY;
    }
    const [minutes, seconds] = String(time).split(':').map(Number);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
        return Number.NEGATIVE_INFINITY;
    }
    return (minutes * 60) + seconds;
};

/**
 * The running score after the most recent goal.
 *
 * Reads `homeGoals`/`awayGoals` — the running tally the feed stamps on each goal
 * — and falls back to the nested team scores, which carry the same values.
 * Picks the latest goal by (period, clock) rather than trusting array order.
 *
 * @param {Array<object>} goals - play-by-play goal events
 * @returns {{home: number, away: number}|null} null when there are no usable goals
 */
export const scoreFromGoalEvents = (goals) => {
    if (!Array.isArray(goals) || !goals.length) {
        return null;
    }
    let latest = null;
    for (const goal of goals) {
        if (!goal) {
            continue;
        }
        const home = normalizeScoreValue(goal.homeGoals ?? goal.homeTeam?.score);
        const away = normalizeScoreValue(goal.awayGoals ?? goal.awayTeam?.score);
        if (typeof home !== 'number' || typeof away !== 'number') {
            continue;
        }
        const period = Number(goal.period) || 0;
        const seconds = eventSeconds(goal.time);
        if (!latest
            || period > latest.period
            || (period === latest.period && seconds > latest.seconds)) {
            latest = { period, seconds, home, away };
        }
    }
    return latest ? { home: latest.home, away: latest.away } : null;
};

/**
 * Pick the score to show in a game's detail header.
 *
 * @param {object} sources
 * @param {Array<object>} [sources.goals] - play-by-play goal events
 * @param {{home: *, away: *}} [sources.detailScore] - game-info team scores
 *        (the server has already resolved these; see provider resolveGameScore)
 * @param {{home: *, away: *}} [sources.statsScore] - the team-stats 'G' row
 * @param {{home: *, away: *}} [sources.listingScore] - the schedule/listing score
 * @param {boolean} [sources.isPostGame]
 * @returns {{home: number|string, away: number|string}} '-' per side when unknown
 */
export const resolveDisplayScore = ({
    goals,
    detailScore,
    statsScore,
    listingScore,
    isPostGame = false
} = {}) => {
    const pair = (value) => ({
        home: normalizeScoreValue(value?.home),
        away: normalizeScoreValue(value?.away)
    });
    const detail = pair(detailScore);
    const stats = pair(statsScore);
    const listing = pair(listingScore);
    const events = scoreFromGoalEvents(goals);

    // A finished game keeps the listing score first, so the modal header and the
    // schedule card a tap away cannot show different finals. By then every
    // source agrees anyway; the ordering only matters while one of them lags.
    const order = isPostGame
        ? [listing, detail, events, stats]
        : [events, detail, stats, listing];

    const firstOf = (side) => {
        for (const candidate of order) {
            const value = candidate?.[side];
            if (value !== null && value !== undefined) {
                return value;
            }
        }
        return '-';
    };

    return { home: firstOf('home'), away: firstOf('away') };
};
