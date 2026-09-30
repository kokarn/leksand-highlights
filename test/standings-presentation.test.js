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

// --- column metrics: using the horizontal space -------------------------------
// Every width in StandingsTable was a phone constant, so on a tablet or in a
// browser the stat columns stayed 26px wide and the team column swallowed all the
// extra room. standingsColumnLayout derives them from the viewport instead — and
// past a tablet width makes the columns FLEX, because fixed columns merely spread
// a wide table out: measured at 1440px, the row content came to 987px of a 1352px
// row and the surplus 365px sat in dead gaps between columns.

test('a phone viewport keeps the original column metrics', async () => {
    const { standingsColumnLayout } = await load();
    const layout = standingsColumnLayout(390);
    assert.equal(layout.rank, 22);
    assert.equal(layout.stat, 26);
    assert.equal(layout.goalDiff, 32);
    assert.equal(layout.cellFontSize, 12);
    assert.equal(layout.logo, 18);
    // No room on a phone for GF/GA or the full club name, and no flexing: the
    // columns exactly fill a 390px row already.
    assert.equal(layout.showGoals, false);
    assert.equal(layout.fullTeamName, false);
    assert.equal(layout.fill, false);
    assert.equal(layout.statMaxWidth, null);
    assert.equal(layout.rowPaddingH, 8);
});

test('the table bleeds to the card edges at every width', async () => {
    const { standingsColumnLayout } = await load();
    // The point of dropping StandingsTable's own card: the block's card is the
    // only one, so there is no horizontal padding between the two. A phone is
    // where this mattered most — the doubled chrome cost 18% of a 390px screen.
    for (const width of [320, 390, 640, 1440]) {
        assert.equal(standingsColumnLayout(width).blockPaddingH, 0, `width: ${width}`);
    }
});

test('mobile keeps only three insets between the screen edge and a cell', async () => {
    const { standingsColumnLayout } = await load();
    const layout = standingsColumnLayout(390);
    // screen + the block card's single 1px border + the row. Two nested cards
    // used to make it five, for 36px a side; this is 19.
    const inset = layout.screenPadding + 1 + layout.rowPaddingH;
    assert.ok(inset <= 20, `phone inset should be at most 20px a side, got ${inset}`);
    // Not zero: the card still has to read as a card.
    assert.ok(layout.screenPadding > 0 && layout.rowPaddingH > 0);
    // Top padding only: it holds the header off the card's top edge. There is no
    // bottom padding — the last row is the bottom edge, and padding there showed
    // as an empty white strip under the table.
    assert.ok(layout.blockPaddingTop > 0);
    assert.equal(layout.blockPaddingV, undefined);
    // The header has to supply its own inset now that the card gives it none.
    assert.ok(layout.blockHeaderPaddingH > 0);
});

test('a narrower-than-phone viewport never shrinks below the phone metrics', async () => {
    const { standingsColumnLayout } = await load();
    // scale is clamped at 1: a 320px phone would otherwise get 21px stat columns,
    // which cannot hold a two-digit value.
    const layout = standingsColumnLayout(320);
    assert.equal(layout.stat, 26);
    assert.equal(layout.cellFontSize, 12);
    assert.equal(layout.fill, false);
});

test('a missing or bogus width falls back to the phone layout', async () => {
    const { standingsColumnLayout } = await load();
    for (const width of [undefined, null, 0, -100, NaN, 'wide']) {
        const layout = standingsColumnLayout(width);
        assert.equal(layout.stat, 26, `width: ${String(width)}`);
        assert.equal(layout.showGoals, false, `width: ${String(width)}`);
        assert.equal(layout.fill, false, `width: ${String(width)}`);
    }
});

test('a tablet-width viewport widens the columns and adds GF/GA', async () => {
    const { standingsColumnLayout } = await load();
    const layout = standingsColumnLayout(820);
    assert.ok(layout.stat > 26, 'stat columns should grow');
    assert.ok(layout.rank > 22, 'rank column should grow');
    // GF/GA are in every standings payload; only the phone lacks room for them.
    assert.equal(layout.showGoals, true);
    // Still short of the full-name threshold.
    assert.equal(layout.fullTeamName, false);
});

test('past a tablet width the columns flex to consume the row', async () => {
    const { standingsColumnLayout } = await load();
    const layout = standingsColumnLayout(1440);
    assert.equal(layout.fill, true);
    assert.equal(layout.fullTeamName, true);
    // Growth is capped, or a single digit floats in the middle of a huge cell.
    assert.equal(layout.statMaxWidth, Math.round(layout.stat * 1.5));
    // The name column keeps a floor so a long club name is not crushed.
    assert.ok(layout.teamMinWidth > 0);
});

test('the remaining chrome stays modest on a wide screen too', async () => {
    const { standingsColumnLayout } = await load();
    const wide = standingsColumnLayout(1440);
    const inset = wide.screenPadding + 1 + wide.rowPaddingH;
    assert.ok(inset <= 20, `wide inset should be at most 20px a side, got ${inset}`);
    assert.ok(wide.screenPadding > 0 && wide.rowPaddingH > 0);
});

test('the row padding no longer grows with the viewport', async () => {
    const { standingsColumnLayout } = await load();
    // It used to scale to 18px a side at 2x, which is the opposite of the goal.
    assert.ok(standingsColumnLayout(2560).rowPaddingH <= standingsColumnLayout(390).rowPaddingH + 2);
});

test('metrics stop growing at 2x so a huge window keeps digits legible', async () => {
    const { standingsColumnLayout } = await load();
    const wide = standingsColumnLayout(2560);
    const doubled = standingsColumnLayout(780);
    assert.equal(wide.stat, doubled.stat, 'stat basis is capped at 2x');
    assert.equal(wide.rank, doubled.rank);
    // Type and logos cap lower still: a 24px digit in a table row reads as broken.
    assert.equal(wide.cellFontSize, 15);
    assert.equal(wide.headerFontSize, 12);
    assert.equal(wide.logo, 26);
});

test('the table reads its widths from the shared metrics, not from constants', async () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(path.join(appDir, 'components', 'StandingsTable.js'), 'utf8');
    assert.match(source, /standingsColumnLayout/);
    assert.match(source, /useWindowDimensions/);
    // The header and the body must build their stat cells from one descriptor
    // list, or they drift apart as columns come and go (OW/OL vs D, GF/GA).
    assert.match(source, /statColumns\(isHockey, layout\.showGoals\)/);
    assert.equal((source.match(/columns\.map\(column =>/g) || []).length, 2);
    // No leftover fixed-width column styles competing with the measured ones.
    assert.doesNotMatch(source, /colStat:\s*\{/);
    assert.doesNotMatch(source, /colRank:\s*\{/);
    // The surplus must go into the cells, not into gaps between them.
    assert.match(source, /flexGrow: 1/);
    assert.doesNotMatch(source, /space-between/);
});

test('only the block draws a card; the table draws rows', async () => {
    const fs = require('node:fs');
    const table = fs.readFileSync(path.join(appDir, 'components', 'StandingsTable.js'), 'utf8');
    const block = fs.readFileSync(path.join(appDir, 'components', 'LeagueStandingsBlock.js'), 'utf8');
    // StandingsTable drew a second card with the same background, 1px border and
    // radius 12 as the block's, one level in — invisible, and on a 390px phone it
    // cost 18% of the screen. Its wrapper must stay chrome-free.
    assert.doesNotMatch(table, /tableCard/);
    assert.match(table, /table: \{\s*width: '100%'\s*\}/);
    // No borderWidth/borderRadius/backgroundColor on the table's own wrapper.
    const tableStyle = table.slice(table.indexOf('    table: {'), table.indexOf('    tableRow: {'));
    assert.doesNotMatch(tableStyle, /border|backgroundColor/);
    // The block is where the one card lives, and it must clip the top corners,
    // which the header meets. The BOTTOM corners are square: the last row is the
    // card's bottom edge, and a radius there left white wedges beside it.
    assert.match(block, /borderTopLeftRadius: 12/);
    assert.match(block, /borderTopRightRadius: 12/);
    assert.doesNotMatch(block, /block: \{[^}]*borderRadius: 12/);
    assert.match(block, /overflow: 'hidden'/);
    // paddingTop, never paddingVertical/paddingBottom on the card.
    assert.match(block, /paddingTop: layout\.blockPaddingTop/);
    assert.doesNotMatch(block, /paddingVertical: layout\./);
    // The last row drops its own bottom border, which would double the card edge.
    assert.match(table, /isLastRow/);
    assert.match(table, /tableRowLast: \{\s*borderBottomWidth: 0\s*\}/);
});

test('all four standings surfaces reclaim their stacked padding', async () => {
    const fs = require('node:fs');
    // The inset is the sum of three layers, so trimming any one alone leaves most
    // of the waste in place. The row is the table's, the card is the block's, and
    // the outer gutter belongs to each scroll container.
    for (const file of [
        path.join('components', 'StandingsTable.js'),
        path.join('components', 'LeagueStandingsBlock.js'),
        path.join('components', 'LeagueStandingsScreen.js'),
        path.join('app', 'index.js')
    ]) {
        const source = fs.readFileSync(path.join(appDir, file), 'utf8');
        assert.match(source, /standingsColumnLayout/, file);
    }
    // The sport tab must override listContent rather than edit it: that style is
    // shared with the game-card lists, which do want the wider gutter.
    const index = fs.readFileSync(path.join(appDir, 'app', 'index.js'), 'utf8');
    assert.match(index, /listContent,\s*\{ paddingHorizontal: standingsColumnLayout\(windowWidth\)\.screenPadding \}/);
    assert.match(index, /listContent: \{\s*paddingHorizontal: 12/);
});
