const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../shl-highlights-app/utils/bugReport.js');

test('bug report URL targets the repo issue form and carries device info', async () => {
    const { buildBugReportUrl } = await load();
    const url = new URL(buildBugReportUrl({ appVersion: '2.52.0', platform: 'android', osVersion: 14, model: 'Pixel 8' }));
    assert.equal(url.origin + url.pathname, 'https://github.com/kokarn/leksand-highlights/issues/new');
    const body = url.searchParams.get('body');
    assert.match(body, /App version: 2\.52\.0/);
    assert.match(body, /Platform: android 14/);
    assert.match(body, /Device: Pixel 8/);
});

test('bug report URL tolerates missing device info', async () => {
    const { buildBugReportUrl } = await load();
    const body = new URL(buildBugReportUrl()).searchParams.get('body');
    assert.match(body, /App version: unknown/);
    assert.doesNotMatch(body, /Device:/);
});
