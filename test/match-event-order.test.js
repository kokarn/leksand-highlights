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

test('football goals and events render chronologically from oldest to newest', () => {
    assert.doesNotMatch(footballModalSource, /goalsWithCalcScores\.reverse\(\)/);
    assert.doesNotMatch(footballModalSource, /eventsWithScores\.reverse\(\)/);
    assert.match(footballModalSource, /for \(const event of eventsWithScores\)/);
});

test('hockey goals and events render chronologically from oldest to newest', () => {
    assert.match(
        hockeyDetailsSource,
        /\.sort\(\(a, b\) => a\.period - b\.period \|\| compareHockeyEventTimes\(a\.time, b\.time\)\)/
    );
    assert.match(
        hockeyDetailsSource,
        /goals: \[\.\.\.\(gameDetails\?\.events\?\.goals \|\| \[\]\)\]\.sort\(compareHockeyEventsChronologically\)/
    );
});
