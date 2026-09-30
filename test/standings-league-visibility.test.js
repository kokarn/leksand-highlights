const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');

const appSource = read('app/index.js');
const prefsSource = read('hooks/usePreferences.js');
const settingsSource = read('components/modals/SettingsModal.js');

// The Settings "Leagues" eye toggle already stored a hidden set, but it only
// filtered the All-matches schedule: the Standings scope rendered all four
// league tables regardless. These guard the single preference now reaching both.

test('league visibility is one predicate over the existing hidden-set preference', () => {
    // No second storage key — the standings gate reuses hiddenAllMatchesLeagues,
    // so existing installs keep the choices they already made.
    assert.match(appSource, /const isLeagueVisible = useCallback\(\s*\(leagueId\) => !hiddenAllMatchesLeagues\.includes\(leagueId\),/);
    assert.match(appSource, /\[hiddenAllMatchesLeagues\]\s*\);/);
    const keys = prefsSource.match(/STORAGE_KEYS\.HIDDEN_ALL_MATCHES_LEAGUES/g) || [];
    assert.equal(keys.length, 2, 'hidden-set key is still read once and written once');
});

test('the standings scope renders only the leagues that are switched on', () => {
    assert.match(appSource, /const visible = leagues\.filter\(entry => isLeagueVisible\(entry\.slug\)\)/);
    // The blocks come from the filtered list, never the raw argument.
    assert.match(appSource, /\{visible\.map\(\(entry, index\) => \(/);
    assert.doesNotMatch(appSource, /\{leagues\.map\(\(entry, index\) => \(/);
    // isLeagueVisible must be a dependency or the scope keeps a stale filter.
    assert.match(appSource, /\}, \[windowWidth, isLeagueVisible\]\)/);
});

test('a hidden league is not fetched either', () => {
    assert.match(appSource, /const wanted = tabLeagues\.filter\(league => isLeagueVisible\(league\.id\)\)/);
    assert.match(appSource, /wanted\.map\(league => league\.fetch\(\)\.then\(league\.setData\)\)/);
    assert.match(appSource, /\}, \[scheduleScope, activeSport, isLeagueVisible\]\)/);
    // Every league the standings scope can show is covered by a descriptor.
    for (const id of ['shl', 'hockeyallsvenskan', 'allsvenskan', 'svenska-cupen']) {
        assert.match(appSource, new RegExp(`\\{ id: '${id}', fetch:`), `${id} needs a fetch descriptor`);
    }
});

test('hiding a league mid-flight clears its loading flag', () => {
    // The cancelled run's finally() no longer resolves it, so without this the
    // scope's all-loading gate would hang on a request nobody is waiting for.
    assert.match(appSource, /\.filter\(league => !isLeagueVisible\(league\.id\)\)\s*\.forEach\(league => league\.setLoading\(false\)\)/);
});

test('the scope spinner counts only visible leagues, and never replaces the empty state', () => {
    assert.match(appSource, /const visible = leagues\.filter\(\(\[id\]\) => isLeagueVisible\(id\)\)/);
    assert.match(appSource, /return visible\.length > 0 && visible\.every\(\(\[, loading\]\) => loading\)/);
    // The old raw `a && b` gates are gone: a hidden league is pinned false, so
    // they could never fire once one league was switched off.
    assert.doesNotMatch(appSource, /shlStandingsLoading && haStandingsLoading/);
    assert.doesNotMatch(appSource, /footballStandingsLoading && cupenStandingsLoading/);
    assert.match(appSource, /\{scheduleScope === 'standings' \? \(\s*hockeyStandingsLoading \?/);
    assert.match(appSource, /\{scheduleScope === 'standings' \? \(\s*footballStandingsScopeLoading \?/);
});

test('switching every league off says so instead of silently showing them all', () => {
    assert.match(appSource, /if \(!visible\.length\) \{\s*return <EmptyState message="No leagues selected\. Turn one on under Leagues in Settings\." \/>;/);
});

test('Settings tells the user the eye toggle now covers Standings too', () => {
    assert.match(settingsSource, /which leagues show in All matches and Standings/);
    assert.match(settingsSource, /\$\{league\.label\} in All matches and Standings/);
});
