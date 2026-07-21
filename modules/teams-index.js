/**
 * Aggregated, league-aware teams index + server-side filtering.
 *
 * The GET /api/teams endpoint historically returned only the 14 static SHL teams
 * (static/teams.json). HockeyAllsvenskan and every football team were derived
 * client-side from game payloads and had no league metadata, so no server-side
 * filtering was possible.
 *
 * This module builds a single de-duplicated index across all leagues and exposes a
 * pure query function (search / league facet / region / sort / pagination). It is
 * intentionally network-free: the caller passes in the static SHL teams plus the
 * already-cached game lists per league (see games-cache.js), so the aggregation and
 * filtering logic is fully unit-testable without hitting shl.se / ESPN.
 *
 * A team can belong to more than one league (an Allsvenskan club also playing in
 * Svenska Cupen; an SHL team also in a cup), so `leagues` is always an ARRAY and the
 * league facet uses OR semantics across values (spec §5).
 */

// Which top-level picker card a league belongs to.
const SPORT_BY_LEAGUE = {
    shl: 'hockey',
    hockeyallsvenskan: 'hockey',
    allsvenskan: 'football',
    'svenska-cupen': 'football',
    'europa-league-qual': 'football',
    'conference-league-qual': 'football'
};

const HOCKEY_LEAGUES = ['shl', 'hockeyallsvenskan'];
const FOOTBALL_LEAGUES = [
    'allsvenskan',
    'svenska-cupen',
    'europa-league-qual',
    'conference-league-qual'
];
const KNOWN_LEAGUES = [...HOCKEY_LEAGUES, ...FOOTBALL_LEAGUES];

// Params the new (envelope) API understands. Presence of any of these switches the
// endpoint from the legacy bare-array response to the { total, teams } envelope.
const QUERY_PARAM_NAMES = ['sport', 'q', 'league', 'region', 'selected', 'sort', 'limit', 'offset'];

/**
 * Selection id used by the app. Hockey selects by `code`; football's getTeamKey is
 * code || uuid || names.short || names.long (mirrors the app hooks exactly so the
 * ids the picker persists line up with what this endpoint returns).
 */
function getTeamKey(team) {
    if (!team) {
        return null;
    }
    return team.code || team.uuid || team.names?.short || team.names?.long || null;
}

/**
 * Lowercase + strip diacritics so "brynas" matches "Brynäs" and "malmo" matches
 * "Malmö". Uses the combining-marks unicode range (portable across node versions).
 */
function normalizeForSearch(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeNames(rawTeam) {
    const names = rawTeam.names || {};
    const short = names.short || rawTeam.name || rawTeam.code || null;
    const long = names.long || short || null;
    const full = names.full || long || short || null;
    return { short, long, full };
}

/**
 * Insert or enrich a team entry in the index map. Later sources fill fields the
 * first source lacked (e.g. static SHL carries city/colors; a game payload may carry
 * a fresher icon), and each contributing league is unioned into `leagues`.
 */
function upsertTeam(map, sport, rawTeam, league) {
    if (!rawTeam) {
        return;
    }

    const id = sport === 'hockey'
        ? (rawTeam.code || getTeamKey(rawTeam))
        : getTeamKey(rawTeam);

    if (!id) {
        return;
    }

    const mapKey = `${sport}:${id}`;
    let entry = map.get(mapKey);

    if (!entry) {
        const city = rawTeam.city || null;
        entry = {
            id,
            sport,
            leagues: [],
            names: normalizeNames(rawTeam),
            // hockey selects by code; football's key is the id (getTeamKey)
            code: rawTeam.code || (sport === 'hockey' ? id : null),
            key: sport === 'football' ? id : (rawTeam.code || id),
            city,
            // region is derived from city for hockey; football has no city today (spec §6)
            region: sport === 'hockey' ? city : null,
            logo: rawTeam.logo || null,
            icon: rawTeam.icon || rawTeam.logo || null,
            colors: rawTeam.colors || null
        };
        map.set(mapKey, entry);
    } else {
        // Enrich missing fields from this later source.
        const names = normalizeNames(rawTeam);
        entry.names.short = entry.names.short || names.short;
        entry.names.long = entry.names.long || names.long;
        entry.names.full = entry.names.full || names.full;
        if (!entry.code && rawTeam.code) {
            entry.code = rawTeam.code;
        }
        if (!entry.city && rawTeam.city) {
            entry.city = rawTeam.city;
            if (sport === 'hockey') {
                entry.region = entry.region || rawTeam.city;
            }
        }
        if (!entry.logo && rawTeam.logo) {
            entry.logo = rawTeam.logo;
        }
        if (!entry.icon && (rawTeam.icon || rawTeam.logo)) {
            entry.icon = rawTeam.icon || rawTeam.logo;
        }
        if (!entry.colors && rawTeam.colors) {
            entry.colors = rawTeam.colors;
        }
    }

    if (league && !entry.leagues.includes(league)) {
        entry.leagues.push(league);
    }
}

/**
 * Build the full aggregated teams index.
 * @param {Object} sources
 * @param {Array}  sources.shlTeams       Static SHL teams (static/teams.json .teams)
 * @param {Object} sources.gamesByLeague  { <league>: [games] } for the remaining leagues
 * @returns {Array} de-duplicated team objects with per-team `leagues` arrays
 */
function buildTeamsIndex({ shlTeams = [], gamesByLeague = {} } = {}) {
    const map = new Map();

    for (const team of shlTeams) {
        upsertTeam(map, 'hockey', team, 'shl');
    }

    for (const [league, games] of Object.entries(gamesByLeague)) {
        const sport = SPORT_BY_LEAGUE[league];
        if (!sport || !Array.isArray(games)) {
            continue;
        }
        for (const game of games) {
            upsertTeam(map, sport, game.homeTeamInfo, league);
            upsertTeam(map, sport, game.awayTeamInfo, league);
        }
    }

    return Array.from(map.values());
}

function normalizeSport(sport) {
    if (!sport) {
        return null;
    }
    const s = String(sport).toLowerCase().trim();
    if (s === 'all' || s === '') {
        return 'all';
    }
    if (s === 'shl') {
        return 'hockey';
    }
    return s; // 'hockey' | 'football'
}

/** Normalize league param (string | comma-list | array) into a lowercased array. */
function toLeagueArray(league) {
    if (league === undefined || league === null) {
        return [];
    }
    const raw = Array.isArray(league) ? league : [league];
    return raw
        .flatMap(value => String(value).split(','))
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
}

function toIdArray(value) {
    if (value === undefined || value === null) {
        return [];
    }
    const raw = Array.isArray(value) ? value : [value];
    return raw
        .flatMap(item => String(item).split(','))
        .map(item => item.trim())
        .filter(Boolean);
}

function matchesSearch(team, needle) {
    if (!needle) {
        return true;
    }
    const haystacks = [
        team.code,
        team.key,
        team.names?.short,
        team.names?.long,
        team.names?.full
    ];
    return haystacks.some(value => normalizeForSearch(value).includes(needle));
}

function matchesLeagueFacet(team, leagues) {
    if (!leagues.length) {
        return true; // "All"
    }
    return team.leagues.some(league => leagues.includes(league));
}

function matchesRegion(team, region) {
    if (!region) {
        return true;
    }
    const target = normalizeForSearch(region);
    return normalizeForSearch(team.region).includes(target)
        || normalizeForSearch(team.city).includes(target);
}

function sortTeams(teams, sort) {
    const mode = (sort || 'name').toLowerCase();
    const byName = (a, b) => (a.names?.short || a.id || '')
        .localeCompare(b.names?.short || b.id || '', 'sv');
    const byCode = (a, b) => String(a.code || a.id || '')
        .localeCompare(String(b.code || b.id || ''), 'sv');
    return teams.sort(mode === 'code' ? byCode : byName);
}

/**
 * Filter / sort / paginate the aggregated index.
 * @param {Array}  allTeams  output of buildTeamsIndex
 * @param {Object} params    { sport, q, league, region, selected, sort, limit, offset }
 * @returns {{ total:number, teams:Array }}
 */
function queryTeams(allTeams, params = {}) {
    const sport = normalizeSport(params.sport);
    const needle = normalizeForSearch(params.q);
    const leagues = toLeagueArray(params.league);
    const region = params.region ? String(params.region).trim() : '';
    const selectedIds = new Set(toIdArray(params.selected));

    let teams = allTeams.filter(team => {
        if (sport && sport !== 'all' && team.sport !== sport) {
            return false;
        }
        if (!matchesSearch(team, needle)) {
            return false;
        }
        if (!matchesLeagueFacet(team, leagues)) {
            return false;
        }
        if (!matchesRegion(team, region)) {
            return false;
        }
        return true;
    });

    // Mark (don't force-include) currently-selected teams so the frontend can pin them.
    if (selectedIds.size) {
        teams = teams.map(team => ({ ...team, selected: selectedIds.has(team.id) }));
    }

    sortTeams(teams, params.sort);

    const total = teams.length;

    const offset = Number.parseInt(params.offset, 10);
    const limit = Number.parseInt(params.limit, 10);
    let paged = teams;
    if (Number.isFinite(offset) && offset > 0) {
        paged = paged.slice(offset);
    }
    if (Number.isFinite(limit) && limit >= 0) {
        paged = paged.slice(0, limit);
    }

    return { total, teams: paged };
}

/** True when the request uses any new-API query param (switches on the envelope). */
function usesEnvelopeApi(query = {}) {
    return QUERY_PARAM_NAMES.some(name => name in query);
}

module.exports = {
    buildTeamsIndex,
    queryTeams,
    usesEnvelopeApi,
    normalizeForSearch,
    getTeamKey,
    normalizeSport,
    toLeagueArray,
    SPORT_BY_LEAGUE,
    HOCKEY_LEAGUES,
    FOOTBALL_LEAGUES,
    KNOWN_LEAGUES,
    QUERY_PARAM_NAMES
};
