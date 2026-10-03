const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const load = () => importApp('utils/liveStandings.js');

// --- Live standings projection -----------------------------------------------
// The standings feeds only count COMPLETED games, so during a round the table is
// correct but behind. projectLiveStandings answers "where would they be if this
// held" from the games the app already has. The point rules must agree with the
// server's own calculation in modules/providers/shl.js:376-404, or the
// projection would disagree with the table it is predicting.

const hockeyRow = (overrides) => ({
    position: 1,
    teamCode: 'LIF',
    teamName: 'Leksands IF',
    teamShortName: 'Leksand',
    gamesPlayed: 7,
    wins: 5,
    losses: 1,
    overtimeWins: 1,
    overtimeLosses: 0,
    points: 17,
    goalsFor: 28,
    goalsAgainst: 18,
    goalDiff: 10,
    ...overrides
});

const hockeyTable = () => ({
    standings: [
        hockeyRow({ position: 1, teamCode: 'AIK', teamName: 'AIK', teamShortName: 'AIK', points: 18, wins: 6, overtimeWins: 0, goalsFor: 26, goalsAgainst: 15, goalDiff: 11 }),
        hockeyRow({ position: 2 }),
        hockeyRow({ position: 3, teamCode: 'IKO', teamName: 'IK Oskarshamn', teamShortName: 'Oskarshamn', points: 10, wins: 3, overtimeWins: 0, goalsFor: 20, goalsAgainst: 22, goalDiff: -2 })
    ]
});

const liveGame = (homeShort, awayShort, homeScore, awayScore, extra = {}) => ({
    uuid: `${homeShort}-${awayShort}`,
    state: 'live',
    homeTeamInfo: { code: homeShort.slice(0, 3).toUpperCase(), names: { short: homeShort }, score: homeScore },
    awayTeamInfo: { code: awayShort.slice(0, 3).toUpperCase(), names: { short: awayShort }, score: awayScore },
    ...extra
});

test('a led hockey game gives the leader 3 points and the trailer a loss', async () => {
    const { projectLiveStandings } = await load();
    const result = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', 3, 1)],
        { sport: 'hockeyallsvenskan' }
    );
    assert.ok(result);
    const leksand = result.standings.find(r => r.teamCode === 'LIF');
    const oskarshamn = result.standings.find(r => r.teamCode === 'IKO');
    assert.equal(leksand.points, 20, '17 + 3');
    assert.equal(leksand.wins, 6, '5 + 1');
    assert.equal(leksand.gamesPlayed, 8);
    assert.equal(oskarshamn.points, 10, 'a loss is worth nothing');
    assert.equal(oskarshamn.losses, 2);
    assert.equal(oskarshamn.gamesPlayed, 8);
});

test('goals and goal difference move with the live score', async () => {
    const { projectLiveStandings } = await load();
    const { standings } = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', 3, 1)],
        { sport: 'hockeyallsvenskan' }
    );
    const leksand = standings.find(r => r.teamCode === 'LIF');
    const oskarshamn = standings.find(r => r.teamCode === 'IKO');
    assert.equal(leksand.goalsFor, 31, '28 + 3');
    assert.equal(leksand.goalsAgainst, 19, '18 + 1');
    assert.equal(leksand.goalDiff, 12);
    assert.equal(oskarshamn.goalsFor, 21, '20 + 1');
    assert.equal(oskarshamn.goalsAgainst, 25, '22 + 3');
    assert.equal(oskarshamn.goalDiff, -4);
});

// Hockey cannot end level: it goes to overtime or a shootout. A tied live game
// therefore has NO derivable winner, so both teams get only the single point
// reaching overtime already guarantees them, and the extra point the OT decides
// is left unawarded. No W/OW/OL/L is invented either.
test('a tied hockey game splits one point and invents no result', async () => {
    const { projectLiveStandings } = await load();
    const { standings } = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', 2, 2)],
        { sport: 'hockeyallsvenskan' }
    );
    const leksand = standings.find(r => r.teamCode === 'LIF');
    const oskarshamn = standings.find(r => r.teamCode === 'IKO');

    assert.equal(leksand.points, 18, '17 + 1');
    assert.equal(oskarshamn.points, 11, '10 + 1');
    // The extra OT point is NOT awarded to either side.
    assert.equal(leksand.points + oskarshamn.points, 29, 'one point total, not three');

    // Nothing has been won or lost yet.
    assert.equal(leksand.wins, 5, 'unchanged');
    assert.equal(leksand.losses, 1, 'unchanged');
    assert.equal(leksand.overtimeWins, 1, 'unchanged');
    assert.equal(leksand.overtimeLosses, 0, 'unchanged');
    assert.equal(oskarshamn.wins, 3, 'unchanged');
    assert.equal(oskarshamn.losses, 1, 'unchanged');

    // The game still counts as played, and its goals still count.
    assert.equal(leksand.gamesPlayed, 8);
    assert.equal(leksand.goalsFor, 30);
});

test('a tied football game is a real draw', async () => {
    const { projectLiveStandings } = await load();
    const data = {
        standings: [
            { position: 1, teamCode: 'HAM', teamName: 'Hammarby IF', teamShortName: 'Hammarby', gamesPlayed: 22, wins: 13, draws: 4, losses: 5, points: 43, goalsFor: 49, goalsAgainst: 20, goalDiff: 29 },
            { position: 2, teamCode: 'GAIS', teamName: 'GAIS', teamShortName: 'GAIS', gamesPlayed: 22, wins: 10, draws: 3, losses: 9, points: 33, goalsFor: 30, goalsAgainst: 30, goalDiff: 0 }
        ]
    };
    const { standings } = projectLiveStandings(data, [liveGame('Hammarby', 'GAIS', 1, 1)], { sport: 'allsvenskan' });
    const hammarby = standings.find(r => r.teamCode === 'HAM');
    const gais = standings.find(r => r.teamCode === 'GAIS');
    assert.equal(hammarby.points, 44, '43 + 1');
    assert.equal(hammarby.draws, 5, 'a football tie IS a draw');
    assert.equal(gais.points, 34);
    assert.equal(gais.draws, 4);
});

test('the projection re-sorts, so a win can change position', async () => {
    const { projectLiveStandings } = await load();
    // AIK lead on 18; Leksand are second on 17. A Leksand win takes them to 20.
    const { standings } = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', 3, 1)],
        { sport: 'hockeyallsvenskan' }
    );
    assert.equal(standings[0].teamCode, 'LIF', 'Leksand now lead');
    assert.equal(standings[0].position, 1);
    assert.equal(standings[1].teamCode, 'AIK');
    assert.equal(standings[1].position, 2);
    // Positions are a dense 1..n after the re-sort.
    assert.deepEqual(standings.map(r => r.position), [1, 2, 3]);
});

// The feed's `note` marks a POSITION ("Relegation", "Champions League
// qualifying") and getDividerPositions derives its dividers from runs of equal
// notes. Carried along with a moving row, the relegation band would travel up
// the table with whoever happened to be marked before kickoff.
test('notes stay with the position, not with the team that moves', async () => {
    const { projectLiveStandings } = await load();
    const data = {
        standings: [
            { position: 1, teamCode: 'AAA', teamName: 'Alpha', teamShortName: 'Alpha', gamesPlayed: 10, wins: 7, draws: 0, losses: 3, points: 21, goalsFor: 20, goalsAgainst: 10, goalDiff: 10, note: 'Champions League qualifying' },
            { position: 2, teamCode: 'BBB', teamName: 'Beta', teamShortName: 'Beta', gamesPlayed: 10, wins: 6, draws: 0, losses: 4, points: 18, goalsFor: 18, goalsAgainst: 12, goalDiff: 6 },
            { position: 3, teamCode: 'CCC', teamName: 'Gamma', teamShortName: 'Gamma', gamesPlayed: 10, wins: 0, draws: 0, losses: 10, points: 0, goalsFor: 2, goalsAgainst: 30, goalDiff: -28, note: 'Relegation' }
        ]
    };
    // Beta win big and overtake Alpha.
    const { standings } = projectLiveStandings(data, [liveGame('Beta', 'Gamma', 5, 0)], { sport: 'allsvenskan' });
    assert.equal(standings[0].teamCode, 'BBB', 'Beta have overtaken');
    assert.equal(standings[0].note, 'Champions League qualifying', 'the top slot keeps its note');
    assert.equal(standings[1].teamCode, 'AAA');
    assert.equal(standings[1].note, undefined, 'second place is unnoted, as it was');
    assert.equal(standings[2].teamCode, 'CCC');
    assert.equal(standings[2].note, 'Relegation', 'the bottom slot keeps its note');
});

test('a live game whose score has not resolved yet is ignored', async () => {
    const { projectLiveStandings } = await load();
    // This is exactly how the schedule feed reports a live game before the
    // play-by-play endpoint is consulted. Reading it as 0-0 would award points
    // for a game nobody has the score of.
    const result = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', null, null)],
        { sport: 'hockeyallsvenskan' }
    );
    assert.equal(result, null);
});

test('no live game means no projection, which is what hides the control', async () => {
    const { projectLiveStandings } = await load();
    const finished = { ...liveGame('Leksand', 'Oskarshamn', 3, 1), state: 'post-game' };
    assert.equal(projectLiveStandings(hockeyTable(), [finished], { sport: 'hockeyallsvenskan' }), null);
    assert.equal(projectLiveStandings(hockeyTable(), [], { sport: 'hockeyallsvenskan' }), null);
    assert.equal(projectLiveStandings(hockeyTable(), undefined, { sport: 'hockeyallsvenskan' }), null);
});

test('a live game that maps onto no row leaves the table alone', async () => {
    const { projectLiveStandings } = await load();
    const result = projectLiveStandings(
        hockeyTable(),
        [liveGame('Nowhere United', 'Elsewhere City', 2, 0)],
        { sport: 'hockeyallsvenskan' }
    );
    assert.equal(result, null, 'no row touched, so nothing to toggle');
});

test('an empty standings payload yields no projection', async () => {
    const { projectLiveStandings } = await load();
    assert.equal(projectLiveStandings({ standings: [] }, [liveGame('Leksand', 'Oskarshamn', 1, 0)]), null);
    assert.equal(projectLiveStandings(null, [liveGame('Leksand', 'Oskarshamn', 1, 0)]), null);
});

test('the same fixture passed twice is only counted once', async () => {
    const { projectLiveStandings } = await load();
    // The hockey tab concatenates SHL and HA lists, so a caller can hand over
    // the same game twice; its goals must not be double-counted.
    const game = liveGame('Leksand', 'Oskarshamn', 3, 1);
    const { standings } = projectLiveStandings(hockeyTable(), [game, { ...game }], { sport: 'hockeyallsvenskan' });
    const leksand = standings.find(r => r.teamCode === 'LIF');
    assert.equal(leksand.gamesPlayed, 8, 'one extra game, not two');
    assert.equal(leksand.points, 20);
    assert.equal(leksand.goalsFor, 31);
});

test('the source payload is never mutated', async () => {
    const { projectLiveStandings } = await load();
    const data = hockeyTable();
    const snapshot = JSON.parse(JSON.stringify(data));
    projectLiveStandings(data, [liveGame('Leksand', 'Oskarshamn', 3, 1)], { sport: 'hockeyallsvenskan' });
    assert.deepEqual(data, snapshot, 'the official table must survive the projection');
});

// --- the row tint ------------------------------------------------------------

test('liveTokens marks exactly the teams a live game touches', async () => {
    const { projectLiveStandings, standingsRowIsLive } = await load();
    const { standings, liveTokens } = projectLiveStandings(
        hockeyTable(),
        [liveGame('Leksand', 'Oskarshamn', 3, 1)],
        { sport: 'hockeyallsvenskan' }
    );
    const isLive = (code) => standingsRowIsLive(standings.find(r => r.teamCode === code), liveTokens);
    assert.equal(isLive('LIF'), true);
    assert.equal(isLive('IKO'), true);
    assert.equal(isLive('AIK'), false, 'AIK are not playing');
});

test('standingsRowIsLive is false without tokens', async () => {
    const { standingsRowIsLive } = await load();
    assert.equal(standingsRowIsLive(hockeyRow(), null), false);
    assert.equal(standingsRowIsLive(hockeyRow(), new Set()), false);
    assert.equal(standingsRowIsLive(null, new Set(['leksand'])), false);
});

// The games feeds and the standings feeds do not share an id space, which is
// why the join goes through teamIdentityToken rather than a raw code.
test('a team joins its row by name even when the codes disagree', async () => {
    const { projectLiveStandings } = await load();
    const data = {
        standings: [
            { position: 1, teamCode: 'DEG', teamName: 'Degerfors IF', teamShortName: 'Degerfors', gamesPlayed: 10, wins: 5, draws: 2, losses: 3, points: 17, goalsFor: 15, goalsAgainst: 12, goalDiff: 3 },
            { position: 2, teamCode: 'SIR', teamName: 'IK Sirius', teamShortName: 'Sirius', gamesPlayed: 10, wins: 4, draws: 2, losses: 4, points: 14, goalsFor: 13, goalsAgainst: 14, goalDiff: -1 }
        ]
    };
    // DEIF/IKS are the GAMES feed's codes for these clubs; the standings feed
    // uses DEG/SIR. Only the name bridges them.
    const game = {
        uuid: 'x1',
        state: 'live',
        homeTeamInfo: { code: 'DEIF', names: { short: 'Degerfors', long: 'Degerfors IF' }, score: 2 },
        awayTeamInfo: { code: 'IKS', names: { short: 'Sirius', long: 'IK Sirius' }, score: 0 }
    };
    const result = projectLiveStandings(data, [game], { sport: 'allsvenskan' });
    assert.ok(result, 'the join must succeed across the two id spaces');
    const degerfors = result.standings.find(r => r.teamCode === 'DEG');
    assert.equal(degerfors.points, 20, '17 + 3');
});
