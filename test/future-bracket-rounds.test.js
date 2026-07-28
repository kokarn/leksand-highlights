const test = require('node:test');
const assert = require('node:assert/strict');

const {
    mergeFutureRounds,
    __test: { describeSlot, splitSeriesRow, parseSportsSeriesRound }
} = require('../modules/future-bracket-rounds');

test('describeSlot keeps a drawn feeder pairing readable before its winner is known', () => {
    const slot = 'Winner of [[Some page#GAIS v Nordsjælland|match 10]]<!--[[GAIS]]/[[FC Nordsjælland|Nordsjælland]]-->';
    assert.equal(describeSlot(slot), 'Winner: GAIS / Nordsjælland');
});

test('splitSeriesRow ignores pipes inside wiki links', () => {
    const fields = splitSeriesRow('|Winner of [[Page#A|match 1]]<!--[[A]]/[[B]]-->|<!--SWE/DEN-->|Match 9|[[Valur (men\'s football)|Valur]]|ISL|6 Aug|13 Aug');
    assert.equal(fields.length, 7);
    assert.equal(fields[2], 'Match 9');
    assert.equal(fields[3], "[[Valur (men's football)|Valur]]");
});

test('parseSportsSeriesRound creates unresolved third-round ties with scheduled legs', () => {
    const fixture = `
<section begin=Q3 />
{{#invoke:Sports series|main|caption=Third qualifying round
|heading1=Main Path
|Winner of [[Page#GAIS v Nordsjælland|match 10]]<!--[[GAIS]]/[[FC Nordsjælland|Nordsjælland]]-->|<!--SWE/DEN-->|Match 9|Winner of [[Page#Valur v Zrinjski|match 18]]<!--[[Valur]]/[[Zrinjski Mostar]]-->|<!--ISL/BIH-->|6 Aug|13 Aug
}}
<section end=Q3 />`;
    const round = parseSportsSeriesRound(fixture, 'Q3', 'Third Round');
    assert.equal(round.title, 'Third Round');
    assert.equal(round.ties.length, 1);
    assert.equal(round.ties[0].pending, true);
    assert.deepEqual(round.ties[0].teams.map((team) => team.name), [
        'Winner: GAIS / Nordsjælland',
        'Winner: Valur / Zrinjski Mostar'
    ]);
    assert.equal(round.ties[0].legs[0].date, '2026-08-06T00:00:00.000Z');
    assert.equal(round.ties[0].legs[1].date, '2026-08-13T00:00:00.000Z');
});

test('mergeFutureRounds appends missing rounds without replacing ESPN rounds', () => {
    const first = { title: 'First Round', ties: [{ key: 'espn' }] };
    const third = { title: 'Third Round', ties: [{ key: 'draw' }] };
    const merged = mergeFutureRounds({ rounds: [first] }, [third]);
    assert.deepEqual(merged.rounds.map((round) => round.title), ['First Round', 'Third Round']);
    assert.equal(merged.rounds[0].ties[0].key, 'espn');

    const espnThird = { title: 'Third Round', ties: [{ key: 'espn-third' }] };
    const noDuplicate = mergeFutureRounds({ rounds: [first, espnThird] }, [third]);
    assert.equal(noDuplicate.rounds.filter((round) => round.title === 'Third Round').length, 1);
    assert.equal(noDuplicate.rounds[1].ties[0].key, 'espn-third');
});
