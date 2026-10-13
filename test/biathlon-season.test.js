const test = require('node:test');
const assert = require('node:assert/strict');
const BiathlonProvider = require('../modules/providers/biathlon');

// Issue #52: the season was a hardcoded '2025-26', so the app kept showing last
// winter after the IBU had published the next one.

test('the season rolls over on 1 July', () => {
    const provider = new BiathlonProvider();
    assert.equal(provider.getSeasonForDate(new Date('2026-06-30T23:59:59Z')), '2025-26');
    assert.equal(provider.getSeasonForDate(new Date('2026-07-01T00:00:00Z')), '2026-27');
    assert.equal(provider.getSeasonForDate(new Date('2027-03-20T12:00:00Z')), '2026-27');
});

test('season ids follow the derived season', () => {
    const provider = new BiathlonProvider();
    assert.equal(provider.getSeasonId('2026-27'), '2627');
    assert.equal(provider.getSeasonId('2099-00'), '9900');
    assert.equal(provider.getPreviousSeason('2026-27'), '2025-26');
});

test('currentSeason is derived from the clock, not a constant', () => {
    const provider = new BiathlonProvider();
    assert.equal(provider.currentSeason, provider.getSeasonForDate(new Date()));
});
