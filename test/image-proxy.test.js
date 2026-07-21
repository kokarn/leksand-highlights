const test = require('node:test');
const assert = require('node:assert/strict');

const { isAllowedHost, parseAllowedUrl } = require('../modules/image-proxy');

test('isAllowedHost accepts allowlisted CDN hosts and subdomains', () => {
    assert.equal(isAllowedHost('a.espncdn.com'), true);
    assert.equal(isAllowedHost('a1.espncdn.com'), true);
    assert.equal(isAllowedHost('images.fotmob.com'), true);
    assert.equal(isAllowedHost('r2.thesportsdb.com'), true);
    assert.equal(isAllowedHost('api.staylive.tv'), true);
    assert.equal(isAllowedHost('fotbollplay.se'), true);
    assert.equal(isAllowedHost('api.fotbollplay.se'), true);
});

test('isAllowedHost rejects non-allowlisted hosts (SSRF guard)', () => {
    assert.equal(isAllowedHost('evil.com'), false);
    assert.equal(isAllowedHost('localhost'), false);
    assert.equal(isAllowedHost('169.254.169.254'), false);
    assert.equal(isAllowedHost('espncdn.com.evil.com'), false);
    assert.equal(isAllowedHost(''), false);
    assert.equal(isAllowedHost(null), false);
});

test('parseAllowedUrl only allows http/https to allowlisted hosts', () => {
    assert.ok(parseAllowedUrl('https://a.espncdn.com/i/teamlogos/soccer/500/x.png'));
    assert.ok(parseAllowedUrl('http://images.fotmob.com/image_resources/logo/teamlogo/1.png'));
    // Wrong scheme
    assert.equal(parseAllowedUrl('file:///etc/passwd'), null);
    assert.equal(parseAllowedUrl('ftp://a.espncdn.com/x.png'), null);
    // Disallowed host
    assert.equal(parseAllowedUrl('https://evil.com/x.png'), null);
    // Garbage
    assert.equal(parseAllowedUrl('not a url'), null);
    assert.equal(parseAllowedUrl(''), null);
    assert.equal(parseAllowedUrl(undefined), null);
});
