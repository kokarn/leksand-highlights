const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

test('formatLiveClock keeps a live minute value', async () => {
    const { formatLiveClock } = await importApp('utils/index.js');
    assert.equal(formatLiveClock("37'"), "37'");
    assert.equal(formatLiveClock('45+2\''), '45+2\'');
    assert.equal(formatLiveClock('HT'), 'HT');
});

test('formatLiveClock trims surrounding whitespace', async () => {
    const { formatLiveClock } = await importApp('utils/index.js');
    assert.equal(formatLiveClock("  62'  "), "62'");
});

test('formatLiveClock returns null for uninformative placeholders', async () => {
    const { formatLiveClock } = await importApp('utils/index.js');
    for (const v of [null, undefined, '', '   ', 'TBD', 'FT', 'Full-Time', 'AET', 'PENS', '-']) {
        assert.equal(formatLiveClock(v), null, `expected null for ${JSON.stringify(v)}`);
    }
});
