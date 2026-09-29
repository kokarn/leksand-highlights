const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const load = () => importApp('utils/standingsIdentity.js');

// --- favourite matching across id spaces -----------------------------------
// The games feeds and the standings feeds do not share team ids. Allsvenskan
// games are an ESPN + FotbollPlay merge (Degerfors is DEG vs DEIF), and the
// standings feed uses a third set (Sirius is IKS in games, SIR in standings).
// Verified against the live API: matching on teamCode alone highlighted only
// 10 of 16 rows, and a FotbollPlay-sourced favourite reached just 6.

const ROSTER = [
    { key: 'IKS', name: 'IK Sirius' },
    { key: 'DEIF', name: 'Degerfors' },
    { key: 'MAIF', name: 'Mjällby' },
    { key: 'IFE', name: 'IF Elfsborg' },
    { key: 'AIK', name: 'AIK' }
];

const row = (teamCode, teamShortName, extra = {}) => ({
    position: 1, teamCode, teamShortName, teamName: teamShortName, ...extra
});

test('a favourite key from one feed matches the standings row from another', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IKS'], ROSTER);
    // Standings call Sirius SIR; the favourite was stored as IKS.
    assert.equal(standingsRowIsFavorite(row('SIR', 'Sirius'), tokens), true);
});

test('club-type words do not block a match', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IFE'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('ELF', 'Elfsborg'), tokens), true);
});

test('diacritics fold so Mjällby and Mjallby agree', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['MAIF'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('MJA', 'Mjällby'), tokens), true);
    assert.equal(standingsRowIsFavorite(row('MJA', 'Mjallby'), tokens), true);
});

test('Svenska Cupen puts the club name in teamCode and still matches', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['MAIF'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('Mjällby', 'Mjällby'), tokens), true);
});

test('a non-favourite row is not highlighted', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IKS'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
    assert.equal(standingsRowIsFavorite(row('HAM', 'Hammarby'), tokens), false);
});

test('no favourites highlights nothing', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens([], ROSTER);
    assert.equal(standingsRowIsFavorite(row('SIR', 'Sirius'), tokens), false);
});

test('an unknown favourite key still matches on its own token', async () => {
    // Not in the roster (e.g. a stale stored favourite) — must not throw, and
    // must still match a row that shares its name.
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['Hammarby'], []);
    assert.equal(standingsRowIsFavorite(row('HAM', 'Hammarby'), tokens), true);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
});

test('null and empty inputs degrade quietly', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite, normalizeTeamToken } = await load();
    assert.equal(standingsRowIsFavorite(null, buildFavoriteTokens(['AIK'])), false);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), new Set()), false);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), null), false);
    assert.equal(normalizeTeamToken(null), '');
    assert.equal(normalizeTeamToken(undefined), '');
    // A name of nothing but club-type words leaves no token, so it must not
    // match every row by collapsing to ''.
    assert.equal(normalizeTeamToken('IF'), '');
    const tokens = buildFavoriteTokens(['IF'], []);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
});

// --- dividers -------------------------------------------------------------
// Thresholds used to be keyed off the `sport` prop (the COLUMN set), so
// HockeyAllsvenskan (sport="shl") drew SHL's 6/10/12 playoff lines and 4-team
// cup groups (sport="football") drew Allsvenskan's 3/13/14 relegation lines.

const table = (count, notes = {}) => Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    teamCode: `T${i + 1}`,
    ...(notes[i + 1] ? { note: notes[i + 1] } : {})
}));

test('the feed note decides the boundaries when present', async () => {
    const { getDividerPositions } = await load();
    // Mirrors the live Allsvenskan payload: notes on 1-3 and 14-16.
    const rows = table(16, {
        1: 'Champions League qualifying',
        2: 'Conference League qualifying',
        3: 'Conference League qualifying',
        14: 'Relegation playoff',
        15: 'Relegation',
        16: 'Relegation'
    });
    assert.deepEqual(getDividerPositions(rows, 'allsvenskan'), [1, 3, 13, 14]);
});

test('SHL falls back to position thresholds (its feed has no notes)', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions(table(14), 'shl'), [6, 10, 12]);
});

test('HockeyAllsvenskan no longer inherits SHL thresholds', async () => {
    const { getDividerPositions } = await load();
    const ha = getDividerPositions(table(14), 'hockeyallsvenskan');
    assert.notDeepEqual(ha, [6, 10, 12]);
    assert.deepEqual(ha, [2, 6, 10]);
});

test('a 4-team cup group does not get Allsvenskan relegation lines', async () => {
    const { getDividerPositions } = await load();
    // Was [3, 13, 14] via sport="football" — 3 landed inside a 4-row group.
    assert.deepEqual(getDividerPositions(table(4), 'svenska-cupen'), [1]);
});

test('no divider is drawn at or past the final row', async () => {
    const { getDividerPositions } = await load();
    // A short table must not get a trailing line that reads as a stray border.
    assert.deepEqual(getDividerPositions(table(6), 'shl'), []);
    assert.deepEqual(getDividerPositions(table(1), 'svenska-cupen'), []);
});

test('an unknown league draws no dividers rather than guessing', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions(table(12), 'europa-league-qual'), []);
    assert.deepEqual(getDividerPositions(table(12), undefined), []);
});

test('an empty table is safe', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions([], 'shl'), []);
    assert.deepEqual(getDividerPositions(undefined, 'shl'), []);
});
