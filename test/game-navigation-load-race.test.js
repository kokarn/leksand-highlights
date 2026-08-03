const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression coverage for the team-page -> game-detail navigation bug where
// tapping a game (e.g. AIK's last game) bounced the user to the football
// listing instead of opening the game. Root cause: the deep-link effect ran
// while the target sport's games list was still empty (eager load in flight),
// took the "not found" fallback, and the route-dedup ref latched on that empty
// pass so the effect never retried once games loaded.
//
// These are source-contract assertions (the RN screen can't be mounted under
// node:test). They lock in the three structural pieces of the fix in
// shl-highlights-app/app/index.js.

const appSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'app', 'index.js'),
    'utf8'
);

test('openGameById defers (does not open a stub) while the games list is still loading', () => {
    // It must inspect the owning hook's load state and bail out without latching
    // when the game is absent AND the list is unloaded/empty.
    assert.match(
        appSource,
        /if \(!game && \(hook\.loading \|\| hook\.games\.length === 0\)\) \{[\s\S]*?return false;/,
        'openGameById should return false (retry later) when games are not loaded yet'
    );
});

test('route deep-link only latches the dedup ref when the link was actually consumed', () => {
    // The old code latched processedRouteDeepLinkRef unconditionally before
    // calling openGameById, blocking the retry after games loaded. The fix must
    // latch only on a truthy (consumed) return value.
    assert.match(
        appSource,
        /const consumed = openGameById\([\s\S]*?\);[\s\S]*?if \(consumed\) \{[\s\S]*?processedRouteDeepLinkRef\.current = routeLinkKey;/,
        'route branch must latch processedRouteDeepLinkRef only when openGameById returns consumed'
    );

    // Guard against regression: the ref must NOT be assigned before the timeout
    // fires (i.e. no unconditional pre-latch remains).
    const preLatch = /if \(processedRouteDeepLinkRef\.current === routeLinkKey\) \{\s*return;\s*\}\s*processedRouteDeepLinkRef\.current = routeLinkKey;/;
    assert.doesNotMatch(
        appSource,
        preLatch,
        'route branch must not pre-latch processedRouteDeepLinkRef before opening the game'
    );
});

test('the effect re-runs when any sport games list populates', () => {
    // The deep-link useEffect deps must include the games arrays so the retry
    // actually fires once data lands.
    assert.match(appSource, /football\.games,/);
    assert.match(appSource, /shl\.games,/);
    assert.match(appSource, /deepLinkParams\s*\]/);
});

test('openGameById returns true for a genuine miss on a loaded list (opens a stub, not a bounce)', () => {
    // Once the list is loaded, an absent game still opens a best-effort stub via
    // buildFallbackGame and reports consumed so it is not retried forever.
    assert.match(appSource, /const buildFallbackGame = \(gameId, homeTeamCode, awayTeamCode\) => \(\{/);
    assert.match(
        appSource,
        /football\.handleGamePress\(game \|\| buildFallbackGame\(gameId, homeTeamCode, awayTeamCode\)\)/
    );
});
