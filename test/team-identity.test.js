const test = require('node:test');
const assert = require('node:assert');
const {
    getTeamName,
    getTeamCode,
    getTeamKey,
    normalizeComparableText
} = require('../modules/team-identity');

const AIK = { code: 'AIK', uuid: '559', names: { short: 'AIK', long: 'AIK Fotboll' } };
const NOCODE = { uuid: 'x1', names: { short: 'Djurgården', long: 'Djurgårdens IF' } };
const CODEONLY = { code: 'MFF' };
const EMPTY = {};

test('getTeamName defaults to short', () => {
    assert.strictEqual(getTeamName(AIK), 'AIK');
});

test('getTeamName prefer:long returns long form', () => {
    assert.strictEqual(getTeamName(AIK, { prefer: 'long' }), 'AIK Fotboll');
});

test('getTeamName falls back short->long->code->fallback', () => {
    assert.strictEqual(getTeamName(NOCODE), 'Djurgården');
    assert.strictEqual(getTeamName(CODEONLY), 'MFF');
    assert.strictEqual(getTeamName(EMPTY, { fallback: 'Unknown' }), 'Unknown');
    assert.strictEqual(getTeamName(null, { fallback: 'Home' }), 'Home');
    assert.strictEqual(getTeamName(EMPTY), '');
});

test('getTeamName prefer:long still falls through to short then code', () => {
    assert.strictEqual(getTeamName(CODEONLY, { prefer: 'long' }), 'MFF');
    assert.strictEqual(getTeamName({ names: { short: 'X' } }, { prefer: 'long' }), 'X');
});

test('getTeamCode prefers code then short name', () => {
    assert.strictEqual(getTeamCode(AIK), 'AIK');
    assert.strictEqual(getTeamCode(NOCODE), 'Djurgården');
    assert.strictEqual(getTeamCode(EMPTY, 'Unknown'), 'Unknown');
    assert.strictEqual(getTeamCode(EMPTY), '');
});

test('getTeamKey prefers immutable identifiers', () => {
    assert.strictEqual(getTeamKey(AIK), 'AIK');
    assert.strictEqual(getTeamKey(NOCODE), 'x1');
    assert.strictEqual(getTeamKey({ names: { short: 'Only' } }), 'Only');
    assert.strictEqual(getTeamKey(null), null);
    assert.strictEqual(getTeamKey(EMPTY), null);
});

test('normalizeComparableText strips diacritics/punctuation and lowercases', () => {
    assert.strictEqual(normalizeComparableText('Djurgårdens IF'), 'djurgardensif');
    assert.strictEqual(normalizeComparableText('AIK'), 'aik');
    assert.strictEqual(normalizeComparableText('Malmö FF'), 'malmoff');
    assert.strictEqual(normalizeComparableText(''), '');
    assert.strictEqual(normalizeComparableText(null), '');
});
