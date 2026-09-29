const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const load = () => importApp('utils/standingsPresentation.js');

// --- standingsSections: the flat-vs-grouped branch, written once --------------
// The four standings surfaces used to each decide this for themselves, with
// three different predicates: `standingsFormat === 'groups'`, a hardcoded
// `sport === 'svenska-cupen'`, and app/index's own structural split. Only the
// league's declared standingsFormat is authoritative.

const rows = (n) => Array.from({ length: n }, (_, i) => ({ position: i + 1, teamCode: `T${i + 1}` }));

test('a flat league yields one untitled section carrying its rows', async () => {
    const { standingsSections } = await load();
    const league = { slug: 'shl', standingsFormat: 'table' };
    const sections = standingsSections(league, { standings: rows(14), lastUpdated: '2026-09-30T10:00:00Z' });
    assert.equal(sections.length, 1);
    assert.equal(sections[0].id, 'shl');
    // No per-section title: the block falls back to the league label, so a flat
    // table is not captioned twice.
    assert.equal(sections[0].title, null);
    assert.equal(sections[0].rows.length, 14);
    assert.equal(sections[0].lastUpdated, '2026-09-30T10:00:00Z');
});

test('a grouped league yields one titled section per group', async () => {
    const { standingsSections } = await load();
    const league = { slug: 'svenska-cupen', standingsFormat: 'groups' };
    const sections = standingsSections(league, {
        groups: [
            { id: 'G1', name: 'Group 1', standings: rows(4) },
            { id: 'G2', name: 'Group 2', standings: rows(4) }
        ],
        lastUpdated: 'FEED'
    });
    assert.equal(sections.length, 2);
    assert.deepEqual(sections.map((s) => s.title), ['Group 1', 'Group 2']);
    assert.deepEqual(sections.map((s) => s.rows.length), [4, 4]);
    // Each group falls back to the payload's timestamp when it carries none.
    assert.deepEqual(sections.map((s) => s.lastUpdated), ['FEED', 'FEED']);
});

test('a group keeps its own lastUpdated over the payload-level one', async () => {
    const { standingsSections } = await load();
    const league = { slug: 'svenska-cupen', standingsFormat: 'groups' };
    const sections = standingsSections(league, {
        groups: [{ id: 'G1', name: 'Group 1', standings: rows(4), lastUpdated: 'GROUP' }],
        lastUpdated: 'FEED'
    });
    assert.equal(sections[0].lastUpdated, 'GROUP');
});

test('Svenska Cupen with no groups drawn yet yields no sections, not a crash', async () => {
    const { standingsSections } = await load();
    const league = { slug: 'svenska-cupen', standingsFormat: 'groups' };
    // Live behaviour for 2026/2027: the group stage is not drawn, so the feed
    // returns groups: []. A known non-regression — the block renders its shared
    // empty state rather than an empty card per group.
    assert.deepEqual(standingsSections(league, { groups: [] }), []);
    assert.deepEqual(standingsSections(league, {}), []);
    // A group with no rows is dropped rather than rendered as an empty table.
    assert.deepEqual(standingsSections(league, { groups: [{ id: 'G1', name: 'Group 1', standings: [] }] }), []);
});

test('missing data and missing league degrade to no sections', async () => {
    const { standingsSections } = await load();
    assert.deepEqual(standingsSections({ slug: 'shl', standingsFormat: 'table' }, null), []);
    assert.deepEqual(standingsSections({ slug: 'shl', standingsFormat: 'table' }, { standings: [] }), []);
    assert.deepEqual(standingsSections(null, { standings: rows(4) }).length, 1);
});

// --- row logos -------------------------------------------------------------
// Hockey resolves a local static PNG by code; football resolves the upstream
// icon URL through the image proxy. Keyed off standingsSport (the column set),
// which is what every league entry declares.

test('hockey rows resolve the local crest by code', async () => {
    const { standingsRowLogo } = await load();
    const logo = standingsRowLogo({ teamCode: 'LHC', teamShortName: 'Linköping' }, 'shl');
    assert.match(logo, /lhc\.png$/);
    // HockeyAllsvenskan uses the same crest source as SHL.
    assert.equal(standingsRowLogo({ teamCode: 'LHC' }, 'hockeyallsvenskan'), logo);
});

test('football rows resolve the upstream icon through the proxy', async () => {
    const { standingsRowLogo } = await load();
    const logo = standingsRowLogo({ teamCode: 'AIK', teamIcon: 'https://a.espncdn.com/x.png' }, 'football');
    // Must be proxied, never a bare upstream URL — check-kokarn-routing guards this.
    assert.match(logo, /\/api\/img\?url=/);
    // The cup payload puts the icon on `icon` instead of `teamIcon`.
    assert.match(standingsRowLogo({ icon: 'https://a.espncdn.com/y.png' }, 'football'), /\/api\/img\?url=/);
});

// --- row keys ----------------------------------------------------------------

test('standingsRowKey reads whichever id slot the feed filled', async () => {
    const { standingsRowKey } = await load();
    assert.equal(standingsRowKey({ teamCode: 'AIK' }), 'AIK');
    assert.equal(standingsRowKey({ code: 'AIK' }), 'AIK');
    assert.equal(standingsRowKey({ key: 'AIK' }), 'AIK');
    // Svenska Cupen puts the club NAME in the code slot.
    assert.equal(standingsRowKey({ teamCode: 'Mjällby' }), 'Mjällby');
    assert.equal(standingsRowKey({ teamShortName: 'Sirius' }), 'Sirius');
});
