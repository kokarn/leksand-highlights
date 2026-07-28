const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

// Hockey-style code accessor (code on team.code)
const getCode = (team) => (team?.code ? String(team.code).toUpperCase() : null);

const mk = (state, home, hs, away, as, extra = {}) => ({
    uuid: `${home}-${away}-${extra.startDateTime || state}`,
    state,
    startDateTime: extra.startDateTime || '2026-03-01T19:00:00',
    homeTeamInfo: { code: home },
    awayTeamInfo: { code: away },
    homeTeamResult: { score: hs },
    awayTeamResult: { score: as },
    ...extra
});

test('gameInvolvesTeam matches home or away, case-insensitive', async () => {
    const { gameInvolvesTeam } = await importApp('utils/teamGames.js');
    const g = mk('post-game', 'LIF', 4, 'FHC', 2);
    assert.equal(gameInvolvesTeam(g, 'lif', getCode), true);
    assert.equal(gameInvolvesTeam(g, 'FHC', getCode), true);
    assert.equal(gameInvolvesTeam(g, 'BIF', getCode), false);
    assert.equal(gameInvolvesTeam(g, null, getCode), false);
});

test('getTeamResult computes W/L/D from the team perspective', async () => {
    const { getTeamResult } = await importApp('utils/teamGames.js');
    // LIF home win 4-2
    assert.equal(getTeamResult(mk('post-game', 'LIF', 4, 'FHC', 2), 'LIF', getCode), 'W');
    // LIF away loss (BIF 3-1 LIF) → LIF away score 1 < 3
    assert.equal(getTeamResult(mk('post-game', 'BIF', 3, 'LIF', 1), 'LIF', getCode), 'L');
    // Draw
    assert.equal(getTeamResult(mk('post-game', 'LIF', 2, 'DIF', 2), 'LIF', getCode), 'D');
    // Not finished → null
    assert.equal(getTeamResult(mk('pre-game', 'LIF', 0, 'DIF', 0), 'LIF', getCode), null);
});

test('getTeamResult flags overtime/shootout losses as OT', async () => {
    const { getTeamResult } = await importApp('utils/teamGames.js');
    const otLoss = mk('post-game', 'LIF', 2, 'HV71', 3, { overtime: true });
    assert.equal(getTeamResult(otLoss, 'LIF', getCode), 'OT');
    // A regulation loss stays 'L'
    assert.equal(getTeamResult(mk('post-game', 'LIF', 2, 'HV71', 3), 'LIF', getCode), 'L');
});

test('selectCompletedGames returns only finished games, newest first', async () => {
    const { selectCompletedGames } = await importApp('utils/teamGames.js');
    const games = [
        mk('post-game', 'LIF', 1, 'A', 0, { startDateTime: '2026-03-01T19:00:00' }),
        mk('pre-game', 'LIF', 0, 'B', 0, { startDateTime: '2026-03-20T19:00:00' }),
        mk('post-game', 'C', 2, 'LIF', 5, { startDateTime: '2026-03-10T19:00:00' })
    ];
    const out = selectCompletedGames(games, 'LIF', getCode);
    assert.equal(out.length, 2);
    assert.equal(out[0].startDateTime, '2026-03-10T19:00:00'); // newest first
});

test('selectUpcomingGames returns non-final games, soonest first', async () => {
    const { selectUpcomingGames } = await importApp('utils/teamGames.js');
    const games = [
        mk('pre-game', 'LIF', 0, 'B', 0, { startDateTime: '2026-03-20T19:00:00' }),
        mk('post-game', 'LIF', 1, 'A', 0, { startDateTime: '2026-03-01T19:00:00' }),
        mk('live', 'LIF', 1, 'C', 1, { startDateTime: '2026-03-15T19:00:00' })
    ];
    const out = selectUpcomingGames(games, 'LIF', getCode);
    assert.equal(out.length, 2);
    assert.equal(out[0].startDateTime, '2026-03-15T19:00:00'); // soonest first (live before pre-game)
});

test('computeForm returns most-recent W/L/D limited to N', async () => {
    const { selectCompletedGames, computeForm } = await importApp('utils/teamGames.js');
    const games = [
        mk('post-game', 'LIF', 4, 'A', 2, { startDateTime: '2026-03-05T19:00:00' }), // W
        mk('post-game', 'B', 3, 'LIF', 1, { startDateTime: '2026-03-04T19:00:00' }), // L
        mk('post-game', 'LIF', 2, 'C', 2, { startDateTime: '2026-03-03T19:00:00' }), // D
        mk('post-game', 'LIF', 5, 'D', 3, { startDateTime: '2026-03-02T19:00:00' }), // W
        mk('post-game', 'E', 1, 'LIF', 6, { startDateTime: '2026-03-01T19:00:00' })  // W
    ];
    const completed = selectCompletedGames(games, 'LIF', getCode);
    const form = computeForm(completed, 'LIF', getCode, 5);
    assert.deepEqual(form, ['W', 'L', 'D', 'W', 'W']);
    // Limit respected
    assert.equal(computeForm(completed, 'LIF', getCode, 3).length, 3);
});

test('dedupeGames removes duplicates merged from multiple leagues', async () => {
    const { dedupeGames } = await importApp('utils/teamGames.js');
    const g = mk('post-game', 'LIF', 1, 'A', 0);
    assert.equal(dedupeGames([g, { ...g }, mk('post-game', 'LIF', 2, 'B', 1)]).length, 2);
});

test('team families map every deep-link sport slug to a family (except biathlon)', async () => {
    const { getTeamFamilyForSport, sportSupportsTeamPage } = await importApp('constants/teamFamilies.js');
    assert.equal(getTeamFamilyForSport('shl').family, 'hockey');
    assert.equal(getTeamFamilyForSport('hockeyallsvenskan').family, 'hockey');
    assert.equal(getTeamFamilyForSport('allsvenskan').family, 'football');
    assert.equal(getTeamFamilyForSport('football').family, 'football');
    assert.equal(getTeamFamilyForSport('svenska-cupen').family, 'football');
    assert.equal(getTeamFamilyForSport('europa-league-qual').family, 'football');
    assert.equal(getTeamFamilyForSport('conference-league-qual').family, 'football');
    assert.equal(sportSupportsTeamPage('biathlon'), false);
    assert.equal(sportSupportsTeamPage('nonsense'), false);
});

test('each family exposes fetchers, card type, and team accessors', async () => {
    const { TEAM_FAMILIES } = await importApp('constants/teamFamilies.js');
    for (const family of Object.values(TEAM_FAMILIES)) {
        assert.ok(family.leagues.length >= 1);
        assert.ok(family.leagues.every((l) => typeof l.fetchGames === 'function' && l.slug && l.label));
        assert.ok(['hockey', 'football'].includes(family.cardType));
        assert.equal(typeof family.getTeamCode, 'function');
        assert.equal(typeof family.getTeamName, 'function');
        assert.equal(typeof family.getTeamLogo, 'function');
    }
});

test('team page route exists and reuses shared card + screen', () => {
    const routePath = path.join(appDir, 'app', 'team', '[family]', '[code].js');
    assert.equal(fs.existsSync(routePath), true, 'expected /team/[family]/[code] route to exist');
    const screenPath = path.join(appDir, 'components', 'TeamGamesScreen.js');
    assert.equal(fs.existsSync(screenPath), true, 'expected shared TeamGamesScreen to exist');
    const screen = fs.readFileSync(screenPath, 'utf8');
    assert.match(screen, /GameCard/);
    assert.match(screen, /FootballGameCard/);
    assert.match(screen, /Latest games/);
    // Standings rows and modal headers must be able to navigate here.
    const standings = fs.readFileSync(path.join(appDir, 'components', 'StandingsTable.js'), 'utf8');
    assert.match(standings, /onTeamPress/);
    const header = fs.readFileSync(path.join(appDir, 'components', 'modals', 'GameModalHeader.js'), 'utf8');
    assert.match(header, /onTeamPress/);
});

test('leaguesForTeam returns only the leagues present in the team games, in family order', async () => {
    const { leaguesForTeam } = await importApp('utils/teamGames.js');
    const leagues = [
        { slug: 'allsvenskan' },
        { slug: 'svenska-cupen' },
        { slug: 'conference-league-qual' }
    ];
    const games = [
        { sport: 'allsvenskan' },
        { sport: 'conference-league-qual' },
        { sport: 'allsvenskan' }
    ];
    const out = leaguesForTeam(games, leagues);
    assert.deepEqual(out.map((l) => l.slug), ['allsvenskan', 'conference-league-qual']);
    // Empty when no games
    assert.deepEqual(leaguesForTeam([], leagues), []);
});

test('family league config carries standings metadata; knockout leagues have none', async () => {
    const { TEAM_FAMILIES, getLeagueBySlug } = await importApp('constants/teamFamilies.js');
    // Leagues with a real table
    for (const slug of ['shl', 'hockeyallsvenskan', 'allsvenskan', 'svenska-cupen']) {
        const league = getLeagueBySlug(slug);
        assert.equal(league.hasStandings, true, `${slug} should have standings`);
        assert.equal(typeof league.fetchStandings, 'function');
        assert.ok(['table', 'groups'].includes(league.standingsFormat));
        assert.ok(['shl', 'football'].includes(league.standingsSport));
    }
    // Knockout leagues: no table
    for (const slug of ['europa-league-qual', 'conference-league-qual']) {
        assert.equal(getLeagueBySlug(slug).hasStandings, false, `${slug} should NOT have standings`);
    }
    // Svenska Cupen is grouped, Allsvenskan is a flat table
    assert.equal(getLeagueBySlug('svenska-cupen').standingsFormat, 'groups');
    assert.equal(getLeagueBySlug('allsvenskan').standingsFormat, 'table');
    // Sanity: every family exposes at least one standings-capable league
    for (const family of Object.values(TEAM_FAMILIES)) {
        assert.ok(family.leagues.some((l) => l.hasStandings));
    }
});

test('standings route exists and reuses StandingsTable + league config', () => {
    const routePath = path.join(appDir, 'app', 'standings', '[league].js');
    assert.equal(fs.existsSync(routePath), true, 'expected /standings/[league] route to exist');
    const screenPath = path.join(appDir, 'components', 'LeagueStandingsScreen.js');
    assert.equal(fs.existsSync(screenPath), true, 'expected LeagueStandingsScreen to exist');
    const screen = fs.readFileSync(screenPath, 'utf8');
    assert.match(screen, /StandingsTable/);
    // Team page must render buttons that link to the standings route.
    const teamScreen = fs.readFileSync(path.join(appDir, 'components', 'TeamGamesScreen.js'), 'utf8');
    assert.match(teamScreen, /leaguesForTeam/);
    assert.match(teamScreen, /\/standings\//);
});

test('knockout leagues expose a bracket, not a standings table', async () => {
    const { getLeagueBySlug } = await importApp('constants/teamFamilies.js');
    for (const slug of ['europa-league-qual', 'conference-league-qual']) {
        const league = getLeagueBySlug(slug);
        assert.equal(league.hasStandings, false, `${slug} has no table`);
        assert.equal(league.hasBracket, true, `${slug} has a bracket`);
    }
    // Round-robin leagues do not advertise a bracket.
    for (const slug of ['allsvenskan', 'shl', 'hockeyallsvenskan']) {
        assert.notEqual(getLeagueBySlug(slug).hasBracket, true, `${slug} is not a bracket`);
    }
});

test('bracket route + screen exist and team page links to them', () => {
    const routePath = path.join(appDir, 'app', 'bracket', '[league].js');
    assert.equal(fs.existsSync(routePath), true, 'expected /bracket/[league] route to exist');
    const screenPath = path.join(appDir, 'components', 'LeagueBracketScreen.js');
    assert.equal(fs.existsSync(screenPath), true, 'expected LeagueBracketScreen to exist');
    const screen = fs.readFileSync(screenPath, 'utf8');
    assert.match(screen, /fetchBracket/);
    // tap-to-trace: seeded vs advanced origin handling
    assert.match(screen, /Seeded into/);
    assert.match(screen, /Advanced from/);
    // Team page renders a "View bracket" link to the route.
    const teamScreen = fs.readFileSync(path.join(appDir, 'components', 'TeamGamesScreen.js'), 'utf8');
    assert.match(teamScreen, /bracketLeagues/);
    assert.match(teamScreen, /\/bracket\//);
});
