/**
 * Bracket builder for two-legged UEFA qualifying competitions
 * (Conference League Qualifying, Europa League Qualifying).
 *
 * ESPN exposes each match as a leg-event carrying:
 *   - season.slug / series.title  -> the round ("First Round", "Second Round", …)
 *   - leg.value                   -> 1 or 2 (which leg)
 *   - series.competitors[].aggregateScore + winner
 *   - competitors[] (per-leg home/away + score)
 *
 * This module folds those leg-events into TIES, computes each tie's aggregate /
 * winner / per-leg scores, orders the rounds, and — crucially — traces each
 * team's ORIGIN so the UI can render honest feeder arrows:
 *
 *   - 'advanced'  : the team won a tie in an earlier round (we return that tie id)
 *   - 'seeded'    : the team never appears in an earlier round (a bye/fresh entry)
 *
 * Everything here is derived from the feed — no invented connections. A seeded
 * team's true domestic origin (e.g. "4th in Allsvenskan") is NOT in this feed;
 * that is a separate data source and intentionally left as origin:'seeded'.
 *
 * Pure functions only (no network / RN imports) so it is unit-testable and can
 * run inside the provider on the server.
 */

// Canonical round ordering for UEFA qualifying. Unknown labels sort last, stably.
const ROUND_ORDER = [
    'Preliminary Round',
    'First Round',
    'Second Round',
    'Third Round',
    'Play-off Round',
    'Play-off',
    'Playoff Round'
];

const roundRank = (title) => {
    const idx = ROUND_ORDER.indexOf(title);
    return idx === -1 ? ROUND_ORDER.length : idx;
};

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const teamOf = (competitor) => {
    const t = competitor?.team || {};
    return {
        id: competitor?.id != null ? String(competitor.id) : (t.id != null ? String(t.id) : null),
        code: t.abbreviation || null,
        name: t.shortDisplayName || t.displayName || t.abbreviation || null,
        logo: t.logo || null
    };
};

/**
 * Stable key for the two teams in a tie (order-independent), so both legs map
 * to the same tie regardless of which team was home.
 */
const tieKeyFromSeries = (series, event) => {
    const ids = (series?.competitors || [])
        .map((c) => (c.id != null ? String(c.id) : null))
        .filter(Boolean)
        .sort();
    if (ids.length === 2) {
        return `${series.title || 'round'}:${ids[0]}-${ids[1]}`;
    }
    // Fallback: use the leg-event's own competitors.
    const evIds = (event?.competitors || [])
        .map((c) => teamOf(c).id)
        .filter(Boolean)
        .sort();
    return `${series?.title || (event?.season || {}).slug || 'round'}:${evIds.join('-') || event?.id}`;
};

/**
 * Fold raw ESPN leg-events into ties.
 * Returns a Map<tieKey, tie>. Each tie:
 *   { key, round, roundRank, teams:{[id]:team}, aggregate:{[id]:number|null},
 *     winnerId, completed, legs:[{leg,homeId,awayId,homeScore,awayScore,status,date}] }
 */
function foldEventsIntoTies(events) {
    const ties = new Map();

    for (const rawEvent of events || []) {
        // Accept both raw ESPN events (series/leg/competitors nested under
        // competitions[0]) and pre-flattened events (fields at top level).
        const competition = (rawEvent.competitions && rawEvent.competitions[0]) || {};
        const event = {
            id: rawEvent.id || competition.id,
            date: rawEvent.date || competition.date || null,
            season: rawEvent.season || null,
            status: rawEvent.status || competition.status?.type?.shortDetail || null,
            leg: rawEvent.leg || competition.leg || null,
            series: rawEvent.series || competition.series || {},
            competitors: rawEvent.competitors || competition.competitors || []
        };

        const series = event.series || {};
        const round = series.title || (event.season || {}).slug || 'Round';
        const key = tieKeyFromSeries(series, event);

        let tie = ties.get(key);
        if (!tie) {
            tie = {
                key,
                round,
                roundRank: roundRank(round),
                teams: {},
                aggregate: {},
                winnerId: null,
                completed: Boolean(series.completed),
                legs: []
            };
            ties.set(key, tie);
        }

        // Series-level aggregate + winner (authoritative when present).
        for (const sc of series.competitors || []) {
            const id = sc.id != null ? String(sc.id) : null;
            if (!id) {
                continue;
            }
            if (sc.aggregateScore != null) {
                tie.aggregate[id] = num(sc.aggregateScore);
            }
            if (sc.winner === true) {
                tie.winnerId = id;
            }
        }
        if (series.completed != null) {
            tie.completed = Boolean(series.completed);
        }

        // Per-leg record.
        const home = (event.competitors || []).find((c) => c.homeAway === 'home') || null;
        const away = (event.competitors || []).find((c) => c.homeAway === 'away') || null;
        const homeTeam = home ? teamOf(home) : null;
        const awayTeam = away ? teamOf(away) : null;
        if (homeTeam?.id) {
            tie.teams[homeTeam.id] = homeTeam;
        }
        if (awayTeam?.id) {
            tie.teams[awayTeam.id] = awayTeam;
        }
        tie.legs.push({
            leg: (event.leg && event.leg.value) || null,
            homeId: homeTeam?.id || null,
            awayId: awayTeam?.id || null,
            homeScore: home ? num(home.score) : null,
            awayScore: away ? num(away.score) : null,
            status: event.status || null,
            date: event.date || null
        });
    }

    // Sort each tie's legs by leg number (1 before 2).
    for (const tie of ties.values()) {
        tie.legs.sort((a, b) => (a.leg || 0) - (b.leg || 0));
        // Derive winner from aggregate if the series didn't state one.
        if (!tie.winnerId) {
            const ids = Object.keys(tie.aggregate);
            if (ids.length === 2 && tie.aggregate[ids[0]] != null && tie.aggregate[ids[1]] != null && tie.aggregate[ids[0]] !== tie.aggregate[ids[1]]) {
                tie.winnerId = tie.aggregate[ids[0]] > tie.aggregate[ids[1]] ? ids[0] : ids[1];
            }
        }
    }

    return ties;
}

/**
 * Given all ties, trace each team's origin per tie:
 *   origin = 'advanced' (won an earlier-round tie -> fromTieKey) | 'seeded'.
 * A team "advanced" into round R if it is the winner of some tie in a round
 * with a strictly smaller roundRank.
 */
function traceOrigins(ties) {
    const tieList = [...ties.values()];
    // Map teamId -> list of {roundRank, tieKey} where it WON.
    const winsByTeam = new Map();
    for (const tie of tieList) {
        if (tie.winnerId) {
            if (!winsByTeam.has(tie.winnerId)) {
                winsByTeam.set(tie.winnerId, []);
            }
            winsByTeam.get(tie.winnerId).push({ roundRank: tie.roundRank, tieKey: tie.key });
        }
    }

    for (const tie of tieList) {
        tie.origins = {};
        for (const teamId of Object.keys(tie.teams)) {
            const priorWins = (winsByTeam.get(teamId) || [])
                .filter((w) => w.roundRank < tie.roundRank)
                .sort((a, b) => b.roundRank - a.roundRank); // most recent prior round first
            if (priorWins.length > 0) {
                tie.origins[teamId] = { origin: 'advanced', fromTieKey: priorWins[0].tieKey };
            } else {
                tie.origins[teamId] = { origin: 'seeded', fromTieKey: null };
            }
        }
    }

    return ties;
}

/**
 * Build the full bracket payload from raw ESPN leg-events.
 * Returns { rounds: [{ title, ties: [...] }], generatedAt }.
 */
function buildBracket(events) {
    const ties = traceOrigins(foldEventsIntoTies(events));
    const tieList = [...ties.values()];

    // Group into rounds, preserving canonical order.
    const byRound = new Map();
    for (const tie of tieList) {
        if (!byRound.has(tie.round)) {
            byRound.set(tie.round, []);
        }
        byRound.get(tie.round).push(tie);
    }

    const rounds = [...byRound.entries()]
        .sort((a, b) => roundRank(a[0]) - roundRank(b[0]))
        .map(([title, roundTies]) => {
            const seededCount = roundTies.reduce((sum, t) => {
                return sum + Object.values(t.origins).filter((o) => o.origin === 'seeded').length;
            }, 0);
            return {
                title,
                seededCount,
                ties: roundTies
                    .map((t) => shapeTie(t))
                    .sort((a, b) => firstLegDate(a) - firstLegDate(b))
            };
        });

    return { rounds, generatedAt: new Date().toISOString() };
}

const firstLegDate = (tie) => {
    const d = tie.legs?.[0]?.date;
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

/** Public-facing tie shape returned to the app. */
function shapeTie(tie) {
    const teamIds = Object.keys(tie.teams);
    return {
        key: tie.key,
        round: tie.round,
        completed: tie.completed,
        winnerId: tie.winnerId,
        teams: teamIds.map((id) => ({
            ...tie.teams[id],
            aggregate: tie.aggregate[id] != null ? tie.aggregate[id] : null,
            isWinner: tie.winnerId === id,
            origin: tie.origins?.[id]?.origin || 'seeded',
            fromTieKey: tie.origins?.[id]?.fromTieKey || null
        })),
        legs: tie.legs
    };
}

module.exports = {
    ROUND_ORDER,
    roundRank,
    foldEventsIntoTies,
    traceOrigins,
    buildBracket,
    __test: { tieKeyFromSeries, teamOf }
};
