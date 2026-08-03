/**
 * Tests for the aggregated, league-aware teams index + server-side filtering
 * (modules/teams-index.js). Pure node:test, no network — the index is built from
 * fixture "static SHL teams" + fixture per-league game lists that mirror the real
 * normalized shapes (homeTeamInfo/awayTeamInfo with code/uuid/names/city/icon).
 */

const { test } = require('node:test');
const assert = require('node:assert');

const {
    buildTeamsIndex,
    queryTeams,
    usesEnvelopeApi,
    normalizeForSearch
} = require('../modules/teams-index');

// --- Fixtures -------------------------------------------------------------

const shlTeams = [
    {
        code: 'BIF',
        uuid: 'u-bif',
        names: { short: 'Brynäs', long: 'Brynäs IF', full: 'Brynäs IF Gävle' },
        city: 'Gävle',
        logo: '/static/logos/bif.svg',
        colors: { primary: '#FFD700', secondary: '#000000' }
    },
    {
        code: 'LIF',
        uuid: 'u-lif',
        names: { short: 'Leksand', long: 'Leksands IF', full: 'Leksands IF' },
        city: 'Leksand',
        logo: '/static/logos/lif.svg'
    }
];

// HockeyAllsvenskan game payload (normalized homeTeamInfo/awayTeamInfo, no city).
const hockeyAllsvenskanGames = [
    {
        homeTeamInfo: { code: 'MODO', uuid: 'u-modo', names: { short: 'MoDo', long: 'MoDo Hockey' } },
        awayTeamInfo: { code: 'BIK', uuid: 'u-bik', names: { short: 'BIK Karlskoga', long: 'BIK Karlskoga' } }
    }
];

// Allsvenskan football games. AIK also appears in Svenska Cupen below (multi-league).
const allsvenskanGames = [
    {
        homeTeamInfo: { code: 'AIK', uuid: '1001', names: { short: 'AIK', long: 'AIK Fotboll' }, icon: 'http://x/aik.png' },
        awayTeamInfo: { code: 'MFF', uuid: '1002', names: { short: 'Malmö FF', long: 'Malmö FF' }, icon: 'http://x/mff.png' }
    }
];

const svenskaCupenGames = [
    {
        homeTeamInfo: { code: 'AIK', uuid: '1001', names: { short: 'AIK', long: 'AIK Fotboll' }, icon: 'http://x/aik.png' },
        awayTeamInfo: { code: 'DIF', uuid: '1003', names: { short: 'Djurgården', long: 'Djurgårdens IF' } }
    }
];

function buildFixtureIndex() {
    return buildTeamsIndex({
        shlTeams,
        gamesByLeague: {
            hockeyallsvenskan: hockeyAllsvenskanGames,
            allsvenskan: allsvenskanGames,
            'svenska-cupen': svenskaCupenGames
        }
    });
}

// --- Index construction ---------------------------------------------------

test('buildTeamsIndex aggregates all leagues and de-duplicates', () => {
    const index = buildFixtureIndex();
    // 2 SHL + 2 HA + (AIK, MFF, DIF) football = 7 distinct teams (AIK shared, counted once)
    assert.strictEqual(index.length, 7);

    const ids = index.map(t => t.id).sort();
    // football id = getTeamKey = code (AIK/MFF/DIF), same key the app persists
    assert.deepStrictEqual(ids, ['AIK', 'BIF', 'BIK', 'DIF', 'LIF', 'MFF', 'MODO']);
});

test('every team carries a leagues[] array and correct sport', () => {
    const index = buildFixtureIndex();
    const bif = index.find(t => t.id === 'BIF');
    assert.strictEqual(bif.sport, 'hockey');
    assert.deepStrictEqual(bif.leagues, ['shl']);

    const mff = index.find(t => t.id === 'MFF');
    assert.ok(mff, 'MFF entry exists');
    assert.strictEqual(mff.sport, 'football');
    assert.deepStrictEqual(mff.leagues, ['allsvenskan']);
});

test('multi-league team appears once with both leagues', () => {
    const index = buildFixtureIndex();
    const aikMatches = index.filter(t => t.names.short === 'AIK');
    assert.strictEqual(aikMatches.length, 1, 'AIK must not be duplicated across leagues');
    assert.deepStrictEqual(aikMatches[0].leagues.sort(), ['allsvenskan', 'svenska-cupen']);
});

test('region derived from city for hockey, null for football', () => {
    const index = buildFixtureIndex();
    assert.strictEqual(index.find(t => t.id === 'BIF').region, 'Gävle');
    assert.strictEqual(index.find(t => t.id === 'AIK').region, null);
});

// --- Single-filter cases --------------------------------------------------

test('single filter: q only (diacritic-insensitive substring)', () => {
    const index = buildFixtureIndex();
    const { total, teams } = queryTeams(index, { q: 'brynas' });
    assert.strictEqual(total, 1);
    assert.strictEqual(teams[0].id, 'BIF');
});

test('single filter: q matches by code', () => {
    const index = buildFixtureIndex();
    const { total, teams } = queryTeams(index, { q: 'mff' });
    assert.strictEqual(total, 1);
    assert.strictEqual(teams[0].id, 'MFF');
});

test('single filter: league only (OR across values)', () => {
    const index = buildFixtureIndex();
    const { total, teams } = queryTeams(index, { league: 'shl,hockeyallsvenskan' });
    assert.strictEqual(total, 4);
    assert.ok(teams.every(t => t.sport === 'hockey'));
});

test('single filter: sport facet', () => {
    const index = buildFixtureIndex();
    assert.strictEqual(queryTeams(index, { sport: 'hockey' }).total, 4);
    assert.strictEqual(queryTeams(index, { sport: 'football' }).total, 3);
    assert.strictEqual(queryTeams(index, { sport: 'all' }).total, 7);
    // legacy sport=shl alias maps to hockey card
    assert.strictEqual(queryTeams(index, { sport: 'shl' }).total, 4);
});

test('single filter: region (hockey city)', () => {
    const index = buildFixtureIndex();
    const { total, teams } = queryTeams(index, { region: 'gavle' });
    assert.strictEqual(total, 1);
    assert.strictEqual(teams[0].id, 'BIF');
});

// --- Combined-filter cases ------------------------------------------------

test('combined filter: q AND league', () => {
    const index = buildFixtureIndex();
    // AIK matches q, and is in svenska-cupen -> passes
    let res = queryTeams(index, { q: 'aik', league: 'svenska-cupen' });
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.teams[0].id, 'AIK');

    // AIK matches q but restrict to a league it is NOT in -> no match
    res = queryTeams(index, { q: 'aik', league: 'allsvenskan' });
    assert.strictEqual(res.total, 1); // AIK IS in allsvenskan too
    res = queryTeams(index, { q: 'malmo', league: 'svenska-cupen' });
    assert.strictEqual(res.total, 0); // Malmö only in allsvenskan
});

test('combined filter: sport AND q', () => {
    const index = buildFixtureIndex();
    const res = queryTeams(index, { sport: 'hockey', q: 'i' });
    // hockey teams whose names/code contain "i": Brynäs IF? short "Brynäs" no i... check long "Brynäs IF" -> yes; BIK, BIF codes contain I
    assert.ok(res.total >= 1);
    assert.ok(res.teams.every(t => t.sport === 'hockey'));
});

// --- No-match case --------------------------------------------------------

test('no-match returns {total:0, teams:[]}', () => {
    const index = buildFixtureIndex();
    const res = queryTeams(index, { q: 'zzzznotateam' });
    assert.strictEqual(res.total, 0);
    assert.deepStrictEqual(res.teams, []);
});

// --- Sorting & pagination -------------------------------------------------

test('default sort is alphabetical by display name (sv locale)', () => {
    const index = buildFixtureIndex();
    const { teams } = queryTeams(index, { sport: 'hockey' });
    const names = teams.map(t => t.names.short);
    const expected = [...names].sort((a, b) => a.localeCompare(b, 'sv'));
    assert.deepStrictEqual(names, expected);
});

test('pagination: limit + offset with stable total', () => {
    const index = buildFixtureIndex();
    const page1 = queryTeams(index, { limit: 3, offset: 0 });
    const page2 = queryTeams(index, { limit: 3, offset: 3 });
    assert.strictEqual(page1.total, 7);
    assert.strictEqual(page2.total, 7);
    assert.strictEqual(page1.teams.length, 3);
    assert.strictEqual(page2.teams.length, 3);
    // no overlap between pages
    const overlap = page1.teams.filter(t => page2.teams.some(u => u.id === t.id));
    assert.strictEqual(overlap.length, 0);
});

test('selected ids are marked, not force-included', () => {
    const index = buildFixtureIndex();
    const res = queryTeams(index, { q: 'brynas', selected: 'BIF,LIF' });
    // still only BIF matches the query; LIF is not force-added
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.teams[0].selected, true);
});

// --- Globally-unique key (uid) across sport=all --------------------------

// Cross-sport code collisions: the same team code exists in BOTH a hockey and a
// football league (the real-world AIK / DIF / VIK cases). Internally these are
// distinct entries (mapKey = `${sport}:${id}`) and must stay distinct rows, but
// their public `id` drops the sport prefix and therefore collides.
const collisionShlTeams = [
    { code: 'AIK', uuid: 'u-aik-h', names: { short: 'AIK', long: 'AIK Hockey' }, city: 'Stockholm' },
    { code: 'DIF', uuid: 'u-dif-h', names: { short: 'Djurgården', long: 'Djurgårdens IF' }, city: 'Stockholm' },
    { code: 'VIK', uuid: 'u-vik-h', names: { short: 'Västerås', long: 'Västerås IK' }, city: 'Västerås' }
];

const collisionFootballGames = [
    {
        homeTeamInfo: { code: 'AIK', uuid: '2001', names: { short: 'AIK', long: 'AIK Fotboll' }, icon: 'http://x/aikf.png' },
        awayTeamInfo: { code: 'DIF', uuid: '2003', names: { short: 'Differdange 03', long: 'FC Differdange 03' }, icon: 'http://x/dif03.png' }
    },
    {
        homeTeamInfo: { code: 'VIK', uuid: '2005', names: { short: 'Vikingur', long: 'Vikingur Reykjavik' }, icon: 'http://x/vik.png' },
        awayTeamInfo: { code: 'MFF', uuid: '2002', names: { short: 'Malmö FF', long: 'Malmö FF' }, icon: 'http://x/mff.png' }
    }
];

function buildCollisionIndex() {
    return buildTeamsIndex({
        shlTeams: collisionShlTeams,
        gamesByLeague: {
            'conference-league-qual': collisionFootballGames
        }
    });
}

test('sport=all exposes a globally-unique uid per team', () => {
    const index = buildCollisionIndex();
    const uids = index.map(t => t.uid);
    const uniqueUids = new Set(uids);
    assert.strictEqual(uids.length, uniqueUids.size, 'every team has a distinct uid');
    // uid is the internal sport:id map key
    for (const team of index) {
        assert.strictEqual(team.uid, `${team.sport}:${team.id}`);
    }
});

test('cross-sport code collisions collide on id but stay distinct rows via uid', () => {
    const index = buildCollisionIndex();
    // AIK/DIF/VIK each appear once as hockey and once as football = 3 duplicate ids
    for (const code of ['AIK', 'DIF', 'VIK']) {
        const rows = index.filter(t => t.id === code);
        assert.strictEqual(rows.length, 2, `${code} appears in both a hockey and a football league`);
        const sports = rows.map(r => r.sport).sort();
        assert.deepStrictEqual(sports, ['football', 'hockey'], `${code} rows span both sports`);
        // Same id, but distinct uid keeps them apart for any id-keying consumer.
        assert.strictEqual(rows[0].id, rows[1].id);
        assert.notStrictEqual(rows[0].uid, rows[1].uid);
    }
    // id is NOT globally unique (the documented cosmetic collision)...
    const ids = index.map(t => t.id);
    assert.notStrictEqual(new Set(ids).size, ids.length);
    // ...but uid IS.
    const uids = index.map(t => t.uid);
    assert.strictEqual(new Set(uids).size, uids.length);
});

// --- Envelope switch & helpers -------------------------------------------

test('usesEnvelopeApi detects new-API params only', () => {
    assert.strictEqual(usesEnvelopeApi({}), false);
    assert.strictEqual(usesEnvelopeApi({ foo: 'bar' }), false);
    assert.strictEqual(usesEnvelopeApi({ q: 'x' }), true);
    assert.strictEqual(usesEnvelopeApi({ sport: 'hockey' }), true);
    assert.strictEqual(usesEnvelopeApi({ limit: '10' }), true);
});

test('normalizeForSearch strips diacritics and lowercases', () => {
    assert.strictEqual(normalizeForSearch('Brynäs'), 'brynas');
    assert.strictEqual(normalizeForSearch('Malmö FF'), 'malmo ff');
    assert.strictEqual(normalizeForSearch(null), '');
});
