const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const game = (uuid, sport, iso, state = 'pre-game') => ({
    uuid,
    sport,
    startDateTime: iso,
    state
});

test('buildScheduleSections emits a header when the calendar day changes', async () => {
    const { buildScheduleSections } = await importApp('utils/scheduleSections.js');
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z'),
        game('b', 'svenska-cupen', '2026-08-08T17:00:00Z'),
        game('c', 'allsvenskan', '2026-08-09T15:00:00Z')
    ];
    const items = buildScheduleSections(games);
    const types = items.map(i => i.type);
    // header, game, game, header, game
    assert.deepEqual(types, ['header', 'game', 'game', 'header', 'game']);
    assert.equal(items[0].type, 'header');
    assert.equal(items[1].game.uuid, 'a');
    assert.equal(items[3].type, 'header');
    assert.equal(items[4].game.uuid, 'c');
    // game rows carry a sport-scoped key
    assert.equal(items[1].key, 'allsvenskan-a');
});

test('buildScheduleSections is empty for an empty list', async () => {
    const { buildScheduleSections } = await importApp('utils/scheduleSections.js');
    assert.deepEqual(buildScheduleSections([]), []);
    assert.deepEqual(buildScheduleSections(undefined), []);
});

test('buildItemLayout gives headers the header height and games the card height', async () => {
    const { buildScheduleSections, buildItemLayout, DAY_HEADER_HEIGHT, COMPACT_ROW_HEIGHT } =
        await importApp('utils/scheduleSections.js');
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z'),
        game('b', 'allsvenskan', '2026-08-09T15:00:00Z')
    ];
    const items = buildScheduleSections(games);
    const layout = buildItemLayout(items);
    // header, game, header, game
    assert.equal(layout[0].length, DAY_HEADER_HEIGHT);
    assert.equal(layout[0].offset, 0);
    assert.equal(layout[1].length, COMPACT_ROW_HEIGHT);
    assert.equal(layout[1].offset, DAY_HEADER_HEIGHT);
    assert.equal(layout[2].length, DAY_HEADER_HEIGHT);
    assert.equal(layout[2].offset, DAY_HEADER_HEIGHT + COMPACT_ROW_HEIGHT);
    assert.equal(layout[3].offset, DAY_HEADER_HEIGHT + COMPACT_ROW_HEIGHT + DAY_HEADER_HEIGHT);
});

test('findTargetScrollOffset anchors on the day header above the live match', async () => {
    const { buildScheduleSections, buildItemLayout, findTargetScrollOffset, DAY_HEADER_HEIGHT, COMPACT_ROW_HEIGHT } =
        await importApp('utils/scheduleSections.js');
    // Day 1 has two finished games; day 2 opens with a live game.
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z', 'post-game'),
        game('b', 'allsvenskan', '2026-08-08T15:00:00Z', 'post-game'),
        game('c', 'allsvenskan', '2026-08-09T15:00:00Z', 'live')
    ];
    const items = buildScheduleSections(games);
    const layout = buildItemLayout(items);
    // items: header0, gameA(1), gameB(2), header(3), gameC(live,4)
    // target is the live game at index 4; anchor is the header at index 3.
    const offset = findTargetScrollOffset(items, layout);
    assert.equal(offset, layout[3].offset);
    // sanity: that's header + 2 games + header worth of scroll
    assert.equal(offset, DAY_HEADER_HEIGHT + COMPACT_ROW_HEIGHT + COMPACT_ROW_HEIGHT);
    void DAY_HEADER_HEIGHT;
});

test('findTargetScrollOffset returns 0 when the first game is the target', async () => {
    const { buildScheduleSections, buildItemLayout, findTargetScrollOffset } =
        await importApp('utils/scheduleSections.js');
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z', 'live'),
        game('b', 'allsvenskan', '2026-08-09T15:00:00Z', 'pre-game')
    ];
    const items = buildScheduleSections(games);
    const layout = buildItemLayout(items);
    // live game at index 1, header above it at index 0 -> offset 0
    assert.equal(findTargetScrollOffset(items, layout), 0);
});

test('filterVisibleLeagues drops hidden leagues and leaves the rest', async () => {
    const { filterVisibleLeagues } = await importApp('utils/scheduleSections.js');
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z'),
        game('b', 'svenska-cupen', '2026-08-08T15:00:00Z'),
        game('c', 'conference-league-qual', '2026-08-08T17:00:00Z')
    ];
    const out = filterVisibleLeagues(games, ['svenska-cupen', 'conference-league-qual']);
    assert.deepEqual(out.map(g => g.uuid), ['a']);
});

test('filterVisibleLeagues returns the list unchanged when nothing is hidden', async () => {
    const { filterVisibleLeagues } = await importApp('utils/scheduleSections.js');
    const games = [game('a', 'allsvenskan', '2026-08-08T13:00:00Z')];
    // empty hidden set / undefined -> passthrough (new leagues show by default)
    assert.equal(filterVisibleLeagues(games, []), games);
    assert.equal(filterVisibleLeagues(games, undefined), games);
    assert.deepEqual(filterVisibleLeagues([], ['allsvenskan']), []);
});

test('filterVisibleLeagues accepts a Set as well as an array', async () => {
    const { filterVisibleLeagues } = await importApp('utils/scheduleSections.js');
    const games = [
        game('a', 'allsvenskan', '2026-08-08T13:00:00Z'),
        game('b', 'shl', '2026-08-08T15:00:00Z')
    ];
    const out = filterVisibleLeagues(games, new Set(['shl']));
    assert.deepEqual(out.map(g => g.uuid), ['a']);
});
