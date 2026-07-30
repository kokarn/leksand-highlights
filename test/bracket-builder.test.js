const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildBracket, foldEventsIntoTies, roundRank } = require('../modules/bracket-builder');

const events = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'conf-qual-events.json'), 'utf8')
);

test('roundRank orders known UEFA qualifying rounds', () => {
    assert.ok(roundRank('First Round') < roundRank('Second Round'));
    assert.ok(roundRank('Second Round') < roundRank('Third Round'));
    assert.equal(roundRank('Some Unknown Round'), 7); // falls to the end
});

test('folds leg-events into ties (26 First Round + 49 Second Round)', () => {
    const ties = foldEventsIntoTies(events);
    const byRound = {};
    for (const tie of ties.values()) {
        byRound[tie.round] = (byRound[tie.round] || 0) + 1;
    }
    assert.equal(byRound['First Round'], 26, 'expected 26 first-round ties');
    assert.equal(byRound['Second Round'], 49, 'expected 49 second-round ties');
});

test('each tie has exactly two teams and both legs fold together', () => {
    const ties = foldEventsIntoTies(events);
    let twoLegTies = 0;
    for (const tie of ties.values()) {
        assert.ok(Object.keys(tie.teams).length <= 2, 'a tie never has more than two teams');
        if (tie.legs.length === 2) {
            twoLegTies++;
            // legs are ordered 1 then 2 when both present
            assert.ok((tie.legs[0].leg || 0) <= (tie.legs[1].leg || 0));
        }
    }
    assert.ok(twoLegTies > 0, 'some ties have both legs recorded');
});

test('completed ties compute a winner from aggregate', () => {
    const ties = foldEventsIntoTies(events);
    const completed = [...ties.values()].filter((t) => t.completed && Object.keys(t.aggregate).length === 2);
    assert.ok(completed.length > 0, 'there are completed ties');
    for (const tie of completed) {
        const [a, b] = Object.values(tie.aggregate);
        if (a !== b) {
            assert.ok(tie.winnerId, 'a decided completed tie names a winner');
        }
    }
});

test('buildBracket returns rounds in canonical order', () => {
    const { rounds } = buildBracket(events);
    const titles = rounds.map((r) => r.title);
    assert.deepEqual(titles, ['First Round', 'Second Round']);
});

test('origins: advanced teams point at a real prior-round tie; seeded do not', () => {
    const { rounds } = buildBracket(events);
    const second = rounds.find((r) => r.title === 'Second Round');
    const first = rounds.find((r) => r.title === 'First Round');
    const firstKeys = new Set(first.ties.map((t) => t.key));

    let advanced = 0;
    let seeded = 0;
    for (const tie of second.ties) {
        for (const team of tie.teams) {
            if (team.origin === 'advanced') {
                advanced++;
                assert.ok(team.fromTieKey, 'advanced team carries a feeder tie key');
                assert.ok(firstKeys.has(team.fromTieKey), 'feeder key is a real First Round tie');
            } else {
                seeded++;
                assert.equal(team.fromTieKey, null, 'seeded team has no feeder');
            }
        }
    }
    // From the live data: 26 advanced into R2, the rest seeded in.
    assert.equal(advanced, 26, 'exactly the 26 First Round winners advanced');
    assert.ok(seeded > advanced, 'most Second Round slots are seeded entrants');
});

test('First Round teams are all seeded (no earlier round to advance from)', () => {
    const { rounds } = buildBracket(events);
    const first = rounds.find((r) => r.title === 'First Round');
    for (const tie of first.ties) {
        for (const team of tie.teams) {
            assert.equal(team.origin, 'seeded');
        }
    }
    assert.equal(first.seededCount, first.ties.length * 2);
});

test('seededCount tallies entrants per round', () => {
    const { rounds } = buildBracket(events);
    const second = rounds.find((r) => r.title === 'Second Round');
    // 49 ties * 2 slots - 26 advanced = 72 seeded
    assert.equal(second.seededCount, 49 * 2 - 26);
});

test('buildBracket emits the canonical names shape and routes logos through injected resolvers', () => {
    // Mirror how the qual providers wire in AllsvenskanProvider.getTeamNames /
    // resolveTeamIcon so bracket teams read identically to cards/pushes and
    // ESPN's blank crests get filled from the fallback-badge map.
    const resolveNames = (t) => ({
        short: t.shortDisplayName || t.displayName || t.name || t.abbreviation || 'Unknown',
        long: t.displayName || t.name || t.shortDisplayName || t.abbreviation || 'Unknown'
    });
    const resolveIcon = (icon, id) => icon || (id ? `FALLBACK:${id}` : null);

    const { rounds } = buildBracket(events, { resolveNames, resolveIcon });
    let sawNames = 0;
    let sawFallbackLogo = 0;
    for (const round of rounds) {
        for (const tie of round.ties) {
            for (const team of tie.teams) {
                // Canonical shape present, with a back-compat `name` === names.short.
                assert.ok(team.names && typeof team.names.short === 'string', 'team carries names.short');
                assert.ok(typeof team.names.long === 'string', 'team carries names.long');
                assert.equal(team.name, team.names.short, 'name mirrors names.short for back-compat');
                sawNames++;
                if (typeof team.logo === 'string' && team.logo.startsWith('FALLBACK:')) {
                    sawFallbackLogo++;
                }
            }
        }
    }
    assert.ok(sawNames > 0, 'saw at least one team with canonical names');
    // The conf-qual fixture has ESPN teams with no logo → the injected fallback
    // must have filled them, proving the logo path runs through the resolver.
    assert.ok(sawFallbackLogo > 0, 'blank ESPN logos were filled via the injected fallback resolver');
});

test('buildBracket without resolvers keeps the historical field priority (back-compat)', () => {
    const { rounds } = buildBracket(events);
    const team = rounds[0].ties[0].teams[0];
    assert.ok(team.names && team.names.short, 'default names.short still produced');
    assert.equal(team.name, team.names.short);
});

