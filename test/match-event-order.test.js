const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const footballModalSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'components', 'modals', 'FootballMatchModal.js'),
    'utf8'
);
const hockeyDetailsSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'hooks', 'useGameDetails.js'),
    'utf8'
);

// Ordering convention (app 2.40.0): running scores are still tallied
// chronologically (oldest -> newest), but the rendered lists are reversed so the
// NEWEST event appears at the top, consistently across all four surfaces
// (football Goals, football Events, hockey Goals, hockey Events).

test('football goals render newest-first while scores are tallied chronologically', () => {
    // Scores still computed on the chronologically-sorted array...
    assert.match(footballModalSource, /const sortedGoals = \[\.\.\.rawGoals\]\.sort\(compareFootballEventsChronologically\)/);
    // ...then reversed for display.
    assert.match(footballModalSource, /goalsWithCalcScores\.reverse\(\)/);
});

test('football events render newest-first with half markers above each group', () => {
    // Combined events sorted chronologically for score tally...
    assert.match(footballModalSource, /combinedEvents\.sort\(compareFootballEventsChronologically\)/);
    // ...then iterated reversed to display newest-first.
    assert.match(footballModalSource, /for \(const event of \[\.\.\.eventsWithScores\]\.reverse\(\)\)/);
});

test('hockey goals render newest-first (chronological sort then reverse)', () => {
    assert.match(
        hockeyDetailsSource,
        /goals: \[\.\.\.\(gameDetails\?\.events\?\.goals \|\| \[\]\)\]\.sort\(compareHockeyEventsChronologically\)\.reverse\(\)/
    );
});

test('hockey events render newest-first with period markers above each group', () => {
    // Events sorted chronologically...
    assert.match(
        hockeyDetailsSource,
        /\.sort\(\(a, b\) => a\.period - b\.period \|\| compareHockeyEventTimes\(a\.time, b\.time\)\)/
    );
    // ...then iterated reversed for display.
    assert.match(hockeyDetailsSource, /\[\.\.\.sortedEvents\]\.reverse\(\)\.forEach/);
});
