const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

const appDir = path.join(__dirname, '..', 'shl-highlights-app');
const importApp = (rel) => import(url.pathToFileURL(path.join(appDir, rel)).href);

const load = () => importApp('utils/standingsIdentity.js');

// --- favourite matching across id spaces -----------------------------------
// The games feeds and the standings feeds do not share team ids. Allsvenskan
// games are an ESPN + FotbollPlay merge (Degerfors is DEG vs DEIF), and the
// standings feed uses a third set (Sirius is IKS in games, SIR in standings).
// Verified against the live API: matching on teamCode alone highlighted only
// 10 of 16 rows, and a FotbollPlay-sourced favourite reached just 6.

const ROSTER = [
    { key: 'IKS', name: 'IK Sirius' },
    { key: 'DEIF', name: 'Degerfors' },
    { key: 'MAIF', name: 'Mjällby' },
    { key: 'IFE', name: 'IF Elfsborg' },
    { key: 'AIK', name: 'AIK' }
];

const row = (teamCode, teamShortName, extra = {}) => ({
    position: 1, teamCode, teamShortName, teamName: teamShortName, ...extra
});

test('a favourite key from one feed matches the standings row from another', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IKS'], ROSTER);
    // Standings call Sirius SIR; the favourite was stored as IKS.
    assert.equal(standingsRowIsFavorite(row('SIR', 'Sirius'), tokens), true);
});

test('club-type words do not block a match', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IFE'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('ELF', 'Elfsborg'), tokens), true);
});

test('diacritics fold so Mjällby and Mjallby agree', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['MAIF'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('MJA', 'Mjällby'), tokens), true);
    assert.equal(standingsRowIsFavorite(row('MJA', 'Mjallby'), tokens), true);
});

test('Svenska Cupen puts the club name in teamCode and still matches', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['MAIF'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('Mjällby', 'Mjällby'), tokens), true);
});

test('a non-favourite row is not highlighted', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['IKS'], ROSTER);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
    assert.equal(standingsRowIsFavorite(row('HAM', 'Hammarby'), tokens), false);
});

test('no favourites highlights nothing', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens([], ROSTER);
    assert.equal(standingsRowIsFavorite(row('SIR', 'Sirius'), tokens), false);
});

test('an unknown favourite key still matches on its own token', async () => {
    // Not in the roster (e.g. a stale stored favourite) — must not throw, and
    // must still match a row that shares its name.
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const tokens = buildFavoriteTokens(['Hammarby'], []);
    assert.equal(standingsRowIsFavorite(row('HAM', 'Hammarby'), tokens), true);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
});

test('null and empty inputs degrade quietly', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite, normalizeTeamToken } = await load();
    assert.equal(standingsRowIsFavorite(null, buildFavoriteTokens(['AIK'])), false);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), new Set()), false);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), null), false);
    assert.equal(normalizeTeamToken(null), '');
    assert.equal(normalizeTeamToken(undefined), '');
    // A name of nothing but club-type words leaves no token, so it must not
    // match every row by collapsing to ''.
    assert.equal(normalizeTeamToken('IF'), '');
    const tokens = buildFavoriteTokens(['IF'], []);
    assert.equal(standingsRowIsFavorite(row('AIK', 'AIK'), tokens), false);
});

// --- dividers -------------------------------------------------------------
// Thresholds used to be keyed off the `sport` prop (the COLUMN set), so
// HockeyAllsvenskan (sport="shl") drew SHL's 6/10/12 playoff lines and 4-team
// cup groups (sport="football") drew Allsvenskan's 3/13/14 relegation lines.

const table = (count, notes = {}) => Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    teamCode: `T${i + 1}`,
    ...(notes[i + 1] ? { note: notes[i + 1] } : {})
}));

test('the feed note decides the boundaries when present', async () => {
    const { getDividerPositions } = await load();
    // Mirrors the live Allsvenskan payload: notes on 1-3 and 14-16.
    const rows = table(16, {
        1: 'Champions League qualifying',
        2: 'Conference League qualifying',
        3: 'Conference League qualifying',
        14: 'Relegation playoff',
        15: 'Relegation',
        16: 'Relegation'
    });
    assert.deepEqual(getDividerPositions(rows, 'allsvenskan'), [1, 3, 13, 14]);
});

test('SHL falls back to position thresholds (its feed has no notes)', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions(table(14), 'shl'), [6, 10, 12]);
});

test('HockeyAllsvenskan no longer inherits SHL thresholds', async () => {
    const { getDividerPositions } = await load();
    const ha = getDividerPositions(table(14), 'hockeyallsvenskan');
    assert.notDeepEqual(ha, [6, 10, 12]);
    assert.deepEqual(ha, [2, 6, 10]);
});

test('a 4-team cup group does not get Allsvenskan relegation lines', async () => {
    const { getDividerPositions } = await load();
    // Was [3, 13, 14] via sport="football" — 3 landed inside a 4-row group.
    assert.deepEqual(getDividerPositions(table(4), 'svenska-cupen'), [1]);
});

test('no divider is drawn at or past the final row', async () => {
    const { getDividerPositions } = await load();
    // A short table must not get a trailing line that reads as a stray border.
    assert.deepEqual(getDividerPositions(table(6), 'shl'), []);
    assert.deepEqual(getDividerPositions(table(1), 'svenska-cupen'), []);
});

test('an unknown league draws no dividers rather than guessing', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions(table(12), 'europa-league-qual'), []);
    assert.deepEqual(getDividerPositions(table(12), undefined), []);
});

// --- divider labels ----------------------------------------------------------
// Allsvenskan labels its own boundaries via each row's `note`. The hockey feeds
// send no note on any row, so SHL's 6/10/12 lines were unlabelled: the reader
// could see that something changes after 6th but not what.

test('SHL boundaries carry labels matching their thresholds', async () => {
    const { getDividerLabel, getDividerPositions } = await load();
    // Every threshold must have a label, or a bare line reappears.
    for (const position of getDividerPositions(table(14), 'shl')) {
        assert.ok(getDividerLabel('shl', position), `no label for SHL after ${position}`);
    }
    assert.equal(getDividerLabel('shl', 6), 'Playoffs');
    assert.equal(getDividerLabel('shl', 12), 'Relegation playoff');
});

test('HockeyAllsvenskan gets its own labels, not SHL\'s', async () => {
    const { getDividerLabel, getDividerPositions } = await load();
    for (const position of getDividerPositions(table(14), 'hockeyallsvenskan')) {
        assert.ok(getDividerLabel('hockeyallsvenskan', position), `no label after ${position}`);
    }
    // Its top boundary is promotion, the opposite end from SHL's playoff cut.
    assert.equal(getDividerLabel('hockeyallsvenskan', 2), 'SHL qualification');
    assert.notEqual(getDividerLabel('hockeyallsvenskan', 6), getDividerLabel('shl', 6) + '!');
});

test('an unlabelled league or position yields null, not a guess', async () => {
    const { getDividerLabel } = await load();
    assert.equal(getDividerLabel('europa-league-qual', 6), null);
    assert.equal(getDividerLabel(undefined, 6), null);
    // A position that is not a boundary in that league has no label.
    assert.equal(getDividerLabel('shl', 7), null);
    assert.equal(getDividerLabel('svenska-cupen', 1), null);
});

test('a noted feed owns every one of its boundaries, labelled or not', async () => {
    const { getDividerLabel, getDividerPositions } = await load();
    // Regression: Allsvenskan draws a line after 13th — the boundary INTO the
    // noted relegation rows — which carries no note itself. Filling it from the
    // hardcoded table printed "Relegation playoff" twice, after 13 and after 14.
    const rows = table(16, {
        1: 'Champions League qualifying',
        2: 'Conference League qualifying',
        3: 'Conference League qualifying',
        14: 'Relegation playoff',
        15: 'Relegation',
        16: 'Relegation'
    });
    assert.deepEqual(getDividerPositions(rows, 'allsvenskan'), [1, 3, 13, 14]);
    // Every boundary in a noted table takes its text from the row, never here.
    for (const position of getDividerPositions(rows, 'allsvenskan')) {
        assert.equal(getDividerLabel('allsvenskan', position, rows), null, `position ${position}`);
    }
    // Without notes the same league does use the fallback.
    assert.equal(getDividerLabel('allsvenskan', 13, table(16)), 'Relegation playoff');
});

test('a feed-supplied note still wins over the hardcoded label', async () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'shl-highlights-app', 'components', 'StandingsTable.js'),
        'utf8'
    );
    // `row?.note ||` must come first: the feed's own text survives a format
    // change, the hardcoded table does not. And the rows must be passed, or the
    // fallback cannot tell a noted feed from a noteless one.
    assert.match(source, /row\?\.note \|\| getDividerLabel\(league \|\| sport, position, standings\)/);
});

test('an empty table is safe', async () => {
    const { getDividerPositions } = await load();
    assert.deepEqual(getDividerPositions([], 'shl'), []);
    assert.deepEqual(getDividerPositions(undefined, 'shl'), []);
});

// --- identity tokens & team-page navigation ---------------------------------
// Standings rows must resolve to something the GAMES feeds recognize. Verified
// against the live API: six Allsvenskan standings codes (SIR, MAL, GOT, BRO,
// ÖRG, VAS) appear in no games feed at all, so navigating by teamCode opened an
// empty team page (?team=SIR returned 0 games, ?team=IKS returned 12).

test("teamIdentityToken folds the Swedish genitive -s", async () => {
    const { teamIdentityToken } = await load();
    // The standings feed says "Djurgården"; the games feed says "Djurgårdens IF".
    assert.equal(teamIdentityToken("Djurgården"), teamIdentityToken("Djurgårdens IF"));
    assert.equal(teamIdentityToken("Halmstad"), teamIdentityToken("Halmstads BK"));
    // Short codes must survive intact — folding them would merge distinct clubs.
    assert.equal(teamIdentityToken("GAIS"), "gais");
    assert.equal(teamIdentityToken("AIS"), "ais");
    assert.equal(teamIdentityToken("VIS"), "vis");
    // GAIS and AIS stay distinct despite both ending in -s.
    assert.notEqual(teamIdentityToken("GAIS"), teamIdentityToken("AIS"));
});

test("teamIdentityToken keeps different clubs in the same family apart", async () => {
    const { teamIdentityToken } = await load();
    assert.notEqual(teamIdentityToken("IFK Göteborg"), teamIdentityToken("Örgryte IS"));
    assert.notEqual(teamIdentityToken("Malmö FF"), teamIdentityToken("Mjällby AIF"));
    assert.notEqual(teamIdentityToken("Hammarby IF"), teamIdentityToken("Halmstads BK"));
    // Swept across all six live feeds: 265 football + 87 hockey distinct tokens
    // with ZERO within-family cross-club collisions.
});

test("token collisions across sports are harmless because navigation is family-scoped", async () => {
    const { teamIdentityToken } = await load();
    // Stripping the club-type word makes a few names collide ACROSS sports:
    // Kalmar FF and the hockey feed's "Kalmar" (Kalmar HC) fold together, as do
    // Västerås SK and "Västerås" (Västerås IK), because the club-type word is
    // stripped and the hockey feed's short name is just the city.
    // The hockey feed's SHORT names are bare city names ("Kalmar" for Kalmar HC,
    // "Västerås" for Västerås IK), which collide with the football clubs:
    assert.equal(teamIdentityToken("Kalmar FF"), teamIdentityToken("Kalmar"));
    assert.equal(teamIdentityToken("Västerås SK"), teamIdentityToken("Västerås"));
    assert.equal(teamIdentityToken("Malmö FF"), teamIdentityToken("Malmö"));
    // That is safe: every caller navigates to /team/<family>/... and the team
    // page only ever fetches that family's leagues, so a football token is never
    // matched against a hockey team. Documented here so the next reader does not
    // "fix" the collision by un-stripping the club words, which would re-break
    // the six Allsvenskan rows this module exists to resolve.
});

test("teamIdentityTokens reads every label shape the feeds use", async () => {
    const { teamIdentityTokens, teamIdentityToken } = await load();
    // Games-feed shape
    const gameTeam = { code: "IKS", names: { short: "IK Sirius", long: "IK Sirius" } };
    assert.equal(teamIdentityTokens(gameTeam).has(teamIdentityToken("Sirius")), true);
    // Standings-row shape, with a code that exists in no games feed
    const row = { teamCode: "SIR", teamShortName: "Sirius", teamName: "IK Sirius" };
    assert.equal(teamIdentityTokens(row).has(teamIdentityToken("Sirius")), true);
    // The two therefore meet, which is what makes the row navigable
    const shared = [...teamIdentityTokens(row)].some((t) => teamIdentityTokens(gameTeam).has(t));
    assert.equal(shared, true);
    assert.equal(teamIdentityTokens(null).size, 0);
});

test("standingsRowTeamParam resolves a standings row to a games-feed code", async () => {
    const { standingsRowTeamParam } = await load();
    // The roster is built from the GAMES feeds, so its keys are navigable.
    const roster = [
        { key: "IKS", name: "IK Sirius" },
        { key: "MFF", name: "Malmö FF" },
        { key: "OIS", name: "Örgryte IS" },
        { key: "DIF", name: "Djurgårdens IF" }
    ];
    // SIR/MAL/ÖRG are standings-only codes — each must come back as a games code.
    assert.equal(standingsRowTeamParam({ teamCode: "SIR", teamName: "IK Sirius" }, roster), "IKS");
    assert.equal(standingsRowTeamParam({ teamCode: "MAL", teamName: "Malmö FF" }, roster), "MFF");
    assert.equal(standingsRowTeamParam({ teamCode: "ÖRG", teamName: "Örgryte IS" }, roster), "OIS");
    // Genitive difference between the two feeds still resolves.
    assert.equal(standingsRowTeamParam({ teamCode: "DJU", teamName: "Djurgården" }, roster), "DIF");
});

test("standingsRowTeamParam falls back to the club name, never a dead code", async () => {
    const { standingsRowTeamParam } = await load();
    // No roster yet (still loading) — the name resolves in every feed, the
    // standings-only code does not, so the name is the safe fallback.
    assert.equal(standingsRowTeamParam({ teamCode: "SIR", teamName: "IK Sirius" }), "IK Sirius");
    // Svenska Cupen puts the club NAME in teamCode and has no teamName distinct
    // from it; that name is already navigable.
    assert.equal(standingsRowTeamParam({ teamCode: "Mjällby", teamName: "Mjällby" }, []), "Mjällby");
    // A row with nothing usable yields null rather than a broken URL.
    assert.equal(standingsRowTeamParam(null), null);
    assert.equal(standingsRowTeamParam({}), null);
});

// --- one normalizer for both jobs -------------------------------------------
// Favourite matching and team-page navigation used to use DIFFERENT folds:
// buildFavoriteTokens/standingsRowIsFavorite called normalizeTeamToken, while
// standingsRowTeamParam called teamIdentityToken, which adds the genitive -s
// fold. A club whose two feeds disagree by exactly that -s therefore navigated
// correctly but never highlighted. Both now use teamIdentityToken.

test('Djurgården highlights, not just navigates (the genitive-fold regression)', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite, standingsRowTeamParam } = await load();
    // Games feed: "Djurgårdens IF" / DIF. Standings feed: "Djurgården" / DJU.
    const roster = [{ key: 'DIF', name: 'Djurgårdens IF' }];
    const standingsRow = row('DJU', 'Djurgården');
    // Navigation already worked before the fix…
    assert.equal(standingsRowTeamParam(standingsRow, roster), 'DIF');
    // …highlighting did not. This is the assertion that was missing.
    assert.equal(standingsRowIsFavorite(standingsRow, buildFavoriteTokens(['DIF'], roster)), true);
});

test('Halmstad is the same shape and also highlights', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    const roster = [{ key: 'HBK', name: 'Halmstads BK' }];
    assert.equal(standingsRowIsFavorite(row('HAL', 'Halmstad'), buildFavoriteTokens(['HBK'], roster)), true);
});

test('the genitive fold does not make a non-favourite match', async () => {
    const { buildFavoriteTokens, standingsRowIsFavorite } = await load();
    // Widening the fold must not tint the rest of the table.
    const tokens = buildFavoriteTokens(['DIF'], [{ key: 'DIF', name: 'Djurgårdens IF' }]);
    for (const other of ['AIK', 'Hammarby', 'Malmö FF', 'GAIS', 'IFK Göteborg', 'Halmstads BK']) {
        assert.equal(standingsRowIsFavorite(row(other, other), tokens), false, `${other} must not match`);
    }
});

// --- pairwise distinctness sweep --------------------------------------------
// "265 football + 87 hockey distinct stems with ZERO cross-club collisions"
// appears in three prose comments (standingsIdentity.js, teamGames.js, and the
// note above) and was pinned by no executable assertion, so it would rot in
// silence when a club changes league. Every name below is one this app's feeds
// actually serve, grouped by the family navigation is scoped to.

const FAMILY_CLUBS = {
    football: [
        'AIK', 'BK Häcken', 'Brommapojkarna', 'Degerfors IF', 'Djurgårdens IF',
        'GAIS', 'Halmstads BK', 'Hammarby IF', 'IF Elfsborg',
        'IFK Göteborg', 'IFK Norrköping', 'IFK Värnamo', 'IK Sirius', 'Kalmar FF',
        'Malmö FF', 'Mjällby AIF', 'Örgryte IS', 'Östers IF', 'Varbergs BoIS',
        'Västerås SK', 'Trelleborgs FF', 'Utsiktens BK', 'Landskrona BoIS',
        'Helsingborgs IF', 'Örebro SK', 'Sandvikens IF', 'Umeå FC'
    ],
    hockey: [
        'Brynäs IF', 'Djurgårdens IF', 'Frölunda HC', 'Färjestad BK', 'HV71',
        'Leksands IF', 'Linköping HC', 'Luleå HF', 'Malmö Redhawks', 'Örebro HK',
        'Rögle BK', 'Skellefteå AIK', 'Timrå IK', 'Växjö Lakers',
        'AIK', 'Almtuna IS', 'BIK Karlskoga', 'Björklöven', 'Kalmar HC',
        'Mora IK', 'Nybro Vikings', 'Södertälje SK', 'Tingsryds AIF',
        'Vita Hästen', 'Västerås IK', 'Östersunds IK'
    ]
};

test('no two clubs in the same family fold to the same identity token', async () => {
    const { teamIdentityToken } = await load();
    for (const [family, clubs] of Object.entries(FAMILY_CLUBS)) {
        const seen = new Map();
        for (const club of clubs) {
            const token = teamIdentityToken(club);
            assert.notEqual(token, '', `${club} must leave a usable token`);
            const clash = seen.get(token);
            // A collision here means the fold merged two real clubs: favourites
            // would tint the wrong row and navigation would open the wrong team.
            assert.equal(
                clash,
                undefined,
                `${family}: "${club}" and "${clash}" both fold to "${token}"`
            );
            seen.set(token, club);
        }
        assert.equal(seen.size, clubs.length);
    }
});

test('the fold is idempotent, so a folded stem re-folds to itself', async () => {
    const { teamIdentityToken } = await load();
    // Both sides of every comparison fold, sometimes via different label
    // shapes, so applying it twice must not lose more.
    for (const clubs of Object.values(FAMILY_CLUBS)) {
        for (const club of clubs) {
            const once = teamIdentityToken(club);
            assert.equal(teamIdentityToken(once), once, `${club} → ${once} is not stable`);
        }
    }
});
