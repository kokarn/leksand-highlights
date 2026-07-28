'use strict';

/**
 * ESPN only publishes qualifying fixtures shortly before kick-off. UEFA's draw
 * is already known earlier, so fill the gap from the corresponding Wikipedia
 * draw page (which cites UEFA's official draw) and keep later, not-yet-drawn
 * rounds visible as scheduled placeholders.
 *
 * This source is supplementary: played/live ESPN ties always win. If Wikimedia
 * is unavailable the existing ESPN bracket still renders unchanged.
 */

const WIKIMEDIA_API = 'https://en.wikipedia.org/w/api.php';
const CONFERENCE_PAGE = '2026–27 UEFA Conference League qualifying (third and play-off round matches)';
const CACHE_MS = 30 * 60 * 1000;

let cachedConference = null;
let cachedAt = 0;

const decodeEntities = (value) => String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ndash;|&mdash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const plainWikiText = (value) => {
    let text = decodeEntities(value);
    text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref\b[^>]*\/>/gi, '');
    text = text.replace(/\{\{(?:fbaicon|flagicon)\|[^}]+\}\}/gi, '');
    text = text.replace(/\{\{small\|([^{}]*)\}\}/gi, '$1');
    text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1');
    text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
    text = text.replace(/\{\{[^{}]*\}\}/g, '');
    text = text.replace(/'{2,}/g, '').replace(/<[^>]+>/g, '');
    return text.replace(/\s+/g, ' ').trim();
};

const describeSlot = (rawValue) => {
    const raw = String(rawValue || '');
    const commentMatch = raw.match(/<!--([\s\S]*?)-->/);
    const visible = plainWikiText(raw.replace(/<!--[\s\S]*?-->/g, ''));
    if (!commentMatch || !/^(Winner|Loser) of\b/i.test(visible)) {
        return visible || 'To be confirmed';
    }

    const candidates = plainWikiText(commentMatch[1]).replace(/^\(|\)$/g, '');
    if (!candidates) {
        return visible;
    }
    const outcome = /^Loser\b/i.test(visible) ? 'Loser' : 'Winner';
    return `${outcome}: ${candidates.replace(/\//g, ' / ')}`;
};

/** Split one Sports-series row on top-level pipes, ignoring pipes in links/templates/comments. */
const splitSeriesRow = (line) => {
    const fields = [];
    let current = '';
    let linkDepth = 0;
    let templateDepth = 0;
    let inComment = false;

    for (let index = 1; index < line.length; index += 1) {
        const pair = line.slice(index, index + 2);
        const triple = line.slice(index, index + 4);
        if (!inComment && triple === '<!--') {
            inComment = true;
            current += triple;
            index += 3;
            continue;
        }
        if (inComment && line.slice(index, index + 3) === '-->') {
            inComment = false;
            current += '-->';
            index += 2;
            continue;
        }
        if (!inComment && pair === '[[') {
            linkDepth += 1;
            current += pair;
            index += 1;
            continue;
        }
        if (!inComment && pair === ']]') {
            linkDepth = Math.max(0, linkDepth - 1);
            current += pair;
            index += 1;
            continue;
        }
        if (!inComment && pair === '{{') {
            templateDepth += 1;
            current += pair;
            index += 1;
            continue;
        }
        if (!inComment && pair === '}}') {
            templateDepth = Math.max(0, templateDepth - 1);
            current += pair;
            index += 1;
            continue;
        }
        if (!inComment && line[index] === '|' && linkDepth === 0 && templateDepth === 0) {
            fields.push(current.trim());
            current = '';
            continue;
        }
        current += line[index];
    }
    fields.push(current.trim());
    return fields;
};

const isoDate = (shortDate, year = 2026) => {
    const match = String(shortDate || '').match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (!match) {
        return null;
    }
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const month = months[match[2].slice(0, 3)];
    if (month == null) {
        return null;
    }
    return new Date(Date.UTC(year, month, Number(match[1]))).toISOString();
};

const pendingTeam = (name, tieNumber, side) => ({
    id: `pending-${tieNumber}-${side}`,
    code: null,
    name,
    logo: null,
    aggregate: null,
    isWinner: false,
    origin: /^(Winner|Loser):/i.test(name) ? 'pending' : 'seeded',
    fromTieKey: null
});

function parseSportsSeriesRound(wikitext, sectionCode, title) {
    const sectionPattern = new RegExp(`<section begin=["']?${sectionCode}["']?\\s*\\/>([\\s\\S]*?)<section end=["']?${sectionCode}["']?\\s*\\/>`, 'i');
    const section = String(wikitext || '').match(sectionPattern)?.[1] || '';
    const invokeStart = section.indexOf('{{#invoke:Sports series');
    if (invokeStart < 0) {
        return null;
    }

    const ties = [];
    const lines = section.slice(invokeStart).split('\n');
    for (const line of lines) {
        if (line.trim() === '}}') {
            break;
        }
        if (!line.startsWith('|') || line.startsWith('|heading')) {
            continue;
        }
        const fields = splitSeriesRow(line);
        if (fields.length < 7 || !/^Match\s+\d+/i.test(fields[2])) {
            continue;
        }
        const tieNumber = fields[2].match(/\d+/)?.[0] || String(ties.length + 1);
        const firstDate = isoDate(fields[5]);
        const secondDate = isoDate(fields[6]);
        ties.push({
            key: `draw-${sectionCode.toLowerCase()}-${tieNumber}`,
            round: title,
            completed: false,
            pending: true,
            winnerId: null,
            teams: [
                pendingTeam(describeSlot(fields[0]), tieNumber, 'a'),
                pendingTeam(describeSlot(fields[3]), tieNumber, 'b')
            ],
            legs: [
                { leg: 1, homeId: null, awayId: null, homeScore: null, awayScore: null, status: 'Scheduled', date: firstDate },
                { leg: 2, homeId: null, awayId: null, homeScore: null, awayScore: null, status: 'Scheduled', date: secondDate }
            ]
        });
    }

    if (ties.length === 0) {
        return null;
    }
    return {
        title,
        status: 'Draw completed · teams resolve after the previous round',
        seededCount: ties.reduce((count, tie) => count + tie.teams.filter((team) => team.origin === 'seeded').length, 0),
        ties
    };
}

const plannedRound = (title, status, firstLeg, secondLeg) => ({
    title,
    status,
    firstLeg,
    secondLeg,
    seededCount: 0,
    ties: []
});

async function fetchWikitext(pageTitle) {
    const params = new URLSearchParams({
        action: 'parse',
        page: pageTitle,
        prop: 'wikitext',
        format: 'json',
        formatversion: '2',
        origin: '*'
    });
    const response = await fetch(`${WIKIMEDIA_API}?${params}`, {
        headers: { 'User-Agent': 'GamePulse/3.15 (https://github.com/kokarn/leksand-highlights)' },
        signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
        throw new Error(`Wikimedia HTTP ${response.status}`);
    }
    const payload = await response.json();
    return payload?.parse?.wikitext || '';
}

async function fetchConferenceFutureRounds() {
    if (cachedConference && Date.now() - cachedAt < CACHE_MS) {
        return cachedConference;
    }
    try {
        const wikitext = await fetchWikitext(CONFERENCE_PAGE);
        const thirdRound = parseSportsSeriesRound(wikitext, 'Q3', 'Third Round');
        cachedConference = [
            ...(thirdRound ? [thirdRound] : []),
            plannedRound('Play-off Round', 'Draw: 3 August 2026', '2026-08-20', '2026-08-27')
        ];
        cachedAt = Date.now();
        return cachedConference;
    } catch (error) {
        console.warn('[Bracket] Future Conference League draw unavailable:', error.message);
        return [plannedRound('Third Round', 'Draw completed · fixture details temporarily unavailable', '2026-08-06', '2026-08-13'), plannedRound('Play-off Round', 'Draw: 3 August 2026', '2026-08-20', '2026-08-27')];
    }
}

function mergeFutureRounds(bracket, futureRounds) {
    const existing = new Set((bracket?.rounds || []).map((round) => round.title));
    return {
        ...bracket,
        rounds: [...(bracket?.rounds || []), ...(futureRounds || []).filter((round) => !existing.has(round.title))]
    };
}

module.exports = {
    fetchConferenceFutureRounds,
    mergeFutureRounds,
    __test: { describeSlot, splitSeriesRow, parseSportsSeriesRound, plainWikiText }
};
