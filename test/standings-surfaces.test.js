const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');

// Wiring tests, per this repo's convention: there is no React test renderer in
// shl-highlights-app (no react-test-renderer, no @testing-library, no jest, no
// transform), so component wiring is pinned by asserting on source. Pure logic
// lives in utils/ and is tested for real — see standings-presentation.test.js.

// The app shows league standings from four places. They used to each wrap
// StandingsTable themselves: nine call sites, nine prop sets, four card styles,
// three flat-vs-grouped predicates and four copies of the navigation handler.
// Favourite highlighting was broken on three of the four as a result, because
// only one passed the teamRoster that bridges the disjoint team-id spaces.
const SURFACES = {
    'app/index.js': 'sport tab → Standings scope',
    'components/LeagueStandingsScreen.js': 'standalone /standings/<league>',
    'components/modals/ShlGameModal.js': 'SHL match modal → Standings tab',
    'components/modals/FootballMatchModal.js': 'football match modal → Standings tab'
};

test('all four standings surfaces render the shared block', () => {
    for (const [file, label] of Object.entries(SURFACES)) {
        assert.match(read(file), /<LeagueStandingsBlock/, `${label} (${file})`);
    }
});

test('no surface wraps StandingsTable directly any more', () => {
    // StandingsTable is still the table BODY — but only the block may render it,
    // or the chrome and the identity plumbing diverge again.
    for (const [file, label] of Object.entries(SURFACES)) {
        assert.doesNotMatch(read(file), /<StandingsTable/, `${label} (${file})`);
    }
    assert.match(read('components/LeagueStandingsBlock.js'), /<StandingsTable/);
});

test('the block is the only place that resolves a standings row to a team URL', () => {
    // standingsRowTeamParam turns a standings code into something the GAMES
    // feeds recognize. ShlGameModal used to skip it and push the raw code.
    // Matched on the import, so a passing mention in a comment does not count.
    for (const file of Object.keys(SURFACES)) {
        assert.doesNotMatch(read(file), /^import .*standingsRowTeamParam/m, file);
    }
    assert.match(read('components/LeagueStandingsBlock.js'), /standingsRowTeamParam\(row, teamRoster\)/);
});

test('every match modal instance receives both favourites and the roster', () => {
    // Without teamRoster a favourite key from one feed cannot reach a standings
    // row from another (measured on Allsvenskan: 10 of 20 vs 20 of 20). Three
    // FootballMatchModal instances also used to pass no selectedTeams at all, so
    // the Svenska Cupen standings tab highlighted nothing.
    const source = read('app/index.js');
    const instances = source.match(/<(?:ShlGameModal|FootballMatchModal)\b[\s\S]*?\/>/g) || [];
    assert.equal(instances.length, 6, 'expected 6 match modal instances');
    for (const instance of instances) {
        const tag = instance.slice(1, instance.indexOf('\n'));
        assert.match(instance, /selectedTeams=\{selected(Football)?Teams\}/, tag);
        assert.match(instance, /teamRoster=\{combined(Hockey|Football)Teams\}/, tag);
    }
});

test('both modals declare teamRoster so the prop is not silently dropped', () => {
    for (const file of ['components/modals/ShlGameModal.js', 'components/modals/FootballMatchModal.js']) {
        assert.match(read(file), /teamRoster = \[\]/, file);
    }
});

test('the grouped layout comes from the league config, not a hardcoded slug', () => {
    // FootballMatchModal used to branch on `sport === 'svenska-cupen'` and the
    // standalone screen on its own standingsFormat read. One predicate now, in
    // standingsSections, driven by the league entry.
    //
    // Scoped to the two modals and the standalone screen: app/index.js also
    // names the slug for deep-link routing and card labels, which is unrelated
    // to standings and must stay.
    const standingsOnly = Object.keys(SURFACES).filter((file) => file !== 'app/index.js');
    for (const file of standingsOnly) {
        assert.doesNotMatch(read(file), /===\s*'svenska-cupen'/, file);
        assert.doesNotMatch(read(file), /standingsFormat/, file);
    }
    assert.match(read('utils/standingsPresentation.js'), /standingsFormat === 'groups'/);
});

test('the block is exported from the components barrel', () => {
    assert.match(read('components/index.js'), /export \{ LeagueStandingsBlock \}/);
});

test('a refetch keeps the previous table on screen instead of blanking it', () => {
    // The modals used to render `loadingStandings ? <spinner/> : <table/>`, so
    // every pull-to-refresh replaced the table with a spinner. Two halves hold
    // the fix, and both are easy to undo by accident:
    //
    //  1. the block only spins when it has nothing to show at all, and
    //  2. the modals' refresh path never clears the data it already has.
    const block = read('components/LeagueStandingsBlock.js');
    const emptyBranch = block.slice(block.indexOf('if (!sections.length)'));
    assert.ok(emptyBranch.length > 0, 'block must keep its no-data guard');
    assert.match(emptyBranch, /loading \?/, 'the spinner belongs inside the no-data branch');
    // ...and nowhere else. Counting the reads, not the shape: an early return
    // (`if (loading) { ... }`) above the guard blanks the table just as a
    // top-level ternary does, so the invariant is that `loading` is consulted
    // exactly twice in the whole file — the prop default, and that one spinner.
    assert.equal((block.match(/\bloading\b/g) || []).length, 2, 'loading must only be read in the no-data branch');
    assert.match(block, /loading = false/);

    for (const file of ['components/modals/ShlGameModal.js', 'components/modals/FootballMatchModal.js']) {
        const source = read(file);
        // Pull-to-refresh goes through the silent path, which touches only the
        // refreshing flag.
        assert.match(source, /onRefresh=\{\(\) => loadStandings\(true\)\}/, file);
        assert.match(source, /if \(!silent\) \{\s*setLoadingStandings\(true\);\s*\} else \{\s*setRefreshingStandings\(true\);/, file);
        // No refresh path may null the data out from under the table. Scoped to
        // loadStandings' own body: FootballMatchModal separately resets the data
        // when the LEAGUE changes (`useEffect(..., [sport])`), which is correct
        // and must not be mistaken for a refresh clearing the table.
        const start = source.indexOf('const loadStandings');
        const body = source.slice(start, source.indexOf('}, [', start));
        assert.ok(body.includes('setStandingsData'), file);
        assert.doesNotMatch(body, /setStandingsData\(null\)/, file);
    }
});

test('the same standings row yields the same team URL from every surface', () => {
    // A row used to push /team/football/IKS from the sport tab and
    // /team/football/IK%20Sirius from the standalone screen. Both landed
    // somewhere real, so nothing caught it. One resolver, one push, one shape.
    const block = read('components/LeagueStandingsBlock.js');
    assert.match(block, /router\.push\(`\/team\/\$\{family\}\/\$\{encodeURIComponent\(param\)\}`\)/);
    assert.equal((block.match(/router\.push/g) || []).length, 1, 'one push for every surface');

    // The standalone screen is the surface that cannot build a full roster, so
    // it forwards the arrival club as a code+name pair. Without the name the
    // pair resolves to nothing: a bare code shares no identity token with a
    // club name, which is the only bridge between the two feeds' id spaces.
    assert.match(read('components/TeamGamesScreen.js'), /params\.set\('name', teamName\)/);
    assert.match(read('components/LeagueStandingsScreen.js'), /key: String\(highlightTeamCode\)\.toUpperCase\(\), name: String\(highlightTeamName\)/);
});
