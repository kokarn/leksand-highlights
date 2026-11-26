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

// Issue #54: until the new season had a completed race, fetchAllGames merged the
// previous season's whole schedule in, so last winter's races sat in the list for
// months after the IBU had published this one.
test('fetchAllGames does not mix in the previous season once the current one has events', async () => {
    const provider = new BiathlonProvider();
    const requested = [];
    provider.fetchIbuSchedule = async (season = provider.currentSeason) => {
        requested.push(season);
        return [{
            id: `ev-${season}`, name: 'World Cup', type: 'world-cup', location: 'X', country: 'FIN',
            countryName: 'Finland', startDate: '2026-11-28', endDate: '2026-11-28',
            races: [{ discipline: 'Sprint', gender: 'men', date: '2026-11-28', time: '13:00' }]
        }];
    };
    await provider.fetchAllGames();
    assert.deepEqual(requested, [provider.currentSeason]);
});

// The IBU datacenter 401s every data request without an `apikey` header, which
// made fetchAllGames fall back to last season's static calendar (all completed),
// so Home had no biathlon rows. The key is read from the site's own bundle.
test('IBU requests carry the apikey read from the site, and a 401 refreshes it', async () => {
    const KEY_OLD = '00000000-0000-0000-0000-000000000001';
    const KEY_NEW = '00000000-0000-0000-0000-000000000002';
    let currentKey = KEY_OLD;
    const dataKeys = [];
    const realFetch = global.fetch;
    global.fetch = async url => {
        const target = String(url);
        const reply = (status, body) => ({
            ok: status >= 200 && status < 300,
            status,
            text: async () => body,
            json: async () => JSON.parse(body)
        });
        if (target.endsWith('biathlonresults.com/')) {
            return reply(200, '<script src="/vendors~x.js"></script><script src="/app~y.js"></script>');
        }
        if (target.endsWith('/app~y.js')) {
            return reply(200, `window.ApiKey = "${currentKey}";`);
        }
        if (target.endsWith('/vendors~x.js')) {
            return reply(200, 'nothing here');
        }
        return reply(500, '{}');
    };
    const provider = new BiathlonProvider();
    const calls = [];
    const wrapped = global.fetch;
    global.fetch = async (url, options = {}) => {
        const target = String(url);
        if (!target.includes('/modules/sportapi/api/')) {
            return wrapped(url, options);
        }
        calls.push(options.headers.apikey);
        dataKeys.push(options.headers.apikey);
        const accepted = options.headers.apikey === currentKey;
        return {
            ok: accepted,
            status: accepted ? 200 : 401,
            json: async () => [{ EventId: 'E1' }]
        };
    };
    try {
        assert.deepEqual(await provider.fetchIbuJson('Events?SeasonId=2627', 'events'), [{ EventId: 'E1' }]);
        assert.deepEqual(dataKeys, [KEY_OLD]);

        // The site rotates its key: the next call 401s, refreshes and retries once.
        currentKey = KEY_NEW;
        assert.deepEqual(await provider.fetchIbuJson('Events?SeasonId=2627', 'events'), [{ EventId: 'E1' }]);
        assert.deepEqual(dataKeys, [KEY_OLD, KEY_OLD, KEY_NEW]);
    } finally {
        global.fetch = realFetch;
    }
});
