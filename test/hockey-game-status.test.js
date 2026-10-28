const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const SHLProvider = require('../modules/providers/shl');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

// --- liveClockFromEvents -----------------------------------------------------
// The SHL schedule feed carries no clock, so a live card could not say what
// minute it was (#58). The play-by-play feed has period markers and an elapsed
// `time` on each event; the clock is read off those.

const period = (p, started, finished) => ({ type: 'period', period: p, started, finished });
const shot = (p, time) => ({ type: 'shot', period: p, time });
const clock = SHLProvider.liveClockFromEvents;

test('liveClockFromEvents reads the period and newest elapsed time', () => {
    const events = [period(1, true, true), period(2, true, false), shot(1, '19:51'), shot(2, '03:10'), shot(2, '14:32'), shot(2, '09:05')];
    assert.equal(clock(events), '2nd 14:32');
});

test('liveClockFromEvents compares times as time, not as ragged strings', () => {
    assert.equal(clock([period(1, true, false), shot(1, '9:30'), shot(1, '10:02')]), '1st 10:02');
});

test('liveClockFromEvents says End of Nth between periods', () => {
    assert.equal(clock([period(1, true, true), shot(1, '19:59')]), 'End of 1st');
});

test('liveClockFromEvents labels overtime and the shootout', () => {
    assert.equal(clock([period(3, true, true), period(4, true, false), shot(4, '02:27')]), 'OT 02:27');
    assert.equal(clock([period(4, true, true), period('shootout', true, false)]), 'SO');
});

test('liveClockFromEvents ignores a period that has not started, and empty input', () => {
    assert.equal(clock([period(1, false, false)]), null);
    assert.equal(clock([]), null);
    assert.equal(clock(null), null);
});

test('liveClockFromEvents names a period with no timed events yet', () => {
    assert.equal(clock([period(2, true, false)]), '2nd');
});

// --- enrichGames carries the clock only for live games -----------------------

test('enrichGames puts the clock in statusText for a live game, not a finished one', async () => {
    const provider = new SHLProvider();
    provider._fetchActualScore = async () => ({ home: 2, away: 1, clock: '3rd 05:00' });
    const mk = (state, home = 0, away = 0) => ({ uuid: state, state, homeTeamInfo: { score: home }, awayTeamInfo: { score: away } });

    const [live, finishedZeroZero] = await provider.enrichGames([mk('live'), mk('post-game')]);
    assert.equal(live.statusText, '3rd 05:00');
    assert.equal(live.homeTeamInfo.score, 2);
    assert.equal(finishedZeroZero.statusText, undefined);
});

// --- getDecidedIn / formatFinalLabel (#57) -----------------------------------

test('getDecidedIn distinguishes regulation, overtime and shootout', async () => {
    const { getDecidedIn, formatFinalLabel } = await importApp('utils/index.js');
    const final = (extra) => ({ state: 'post-game', ...extra });

    assert.equal(getDecidedIn(final({ overtime: false, shootout: false })), null);
    assert.equal(getDecidedIn(final({ overtime: true, shootout: false })), 'OT');
    assert.equal(getDecidedIn(final({ overtime: false, shootout: true })), 'SO');
    assert.equal(getDecidedIn(final({ overtime: true, shootout: true })), 'SO');
    assert.equal(getDecidedIn(final({})), null, 'football carries neither flag');

    assert.equal(formatFinalLabel(final({})), 'Final');
    assert.equal(formatFinalLabel(final({ overtime: true })), 'Final/OT');
    assert.equal(formatFinalLabel(final({ shootout: true })), 'Final/SO');
});

test('an unfinished game is never labelled OT or Final', async () => {
    const { getDecidedIn, formatFinalLabel } = await importApp('utils/index.js');
    for (const state of ['live', 'pre-game']) {
        assert.equal(getDecidedIn({ state, overtime: true }), null);
        assert.equal(formatFinalLabel({ state, overtime: true }), null);
    }
});
