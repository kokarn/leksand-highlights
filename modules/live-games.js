/**
 * Bringing a cached games list up to date.
 *
 * The SHL schedule API never reports an in-play score: a game reads `pre-game`
 * with null/0 scores until it ends, then flips straight to `post-game` with the
 * final result. So two corrections have to be applied on top of whatever the
 * cache holds before a games list is served:
 *
 *   1. Promote games that have STARTED since the cache was written. The schedule
 *      feed won't say so, so each game inside its start window is probed for
 *      play-by-play events (provider.checkGameHasStarted).
 *   2. Resolve real scores for the live ones, which only exist on the
 *      play-by-play endpoint (provider.enrichGames).
 *
 * This lived inlined in the /api/games route and nowhere else, which is why
 * HockeyAllsvenskan served live games with `score: null` — HockeyAllsvenskan
 * runs on the same backend platform and its provider extends SHLProvider, so
 * the machinery already worked there, it was just never invoked. Extracted here
 * so both routes share one implementation rather than two that drift.
 *
 * Takes the provider as an argument rather than reaching for getProvider, so it
 * is testable against a fake and works for any provider offering the SHL-shaped
 * isGameInLiveWindow / checkGameHasStarted / enrichGames trio.
 *
 * @param {object} provider - a BaseProvider with the three methods above
 * @param {Array<object>} games - the cached games list
 * @returns {Promise<Array<object>>} the list, with states and scores corrected
 */
async function refreshLiveGames(provider, games) {
    if (!Array.isArray(games) || !games.length) {
        return Array.isArray(games) ? games : [];
    }

    let result = games;
    const tag = provider?.name || 'games';

    // 1. Games the clock says should have started but the feed still calls
    //    pre-game. Only these are probed — one request per candidate, and the
    //    window is narrow, so this is a handful at most.
    if (typeof provider?.isGameInLiveWindow === 'function'
        && typeof provider?.checkGameHasStarted === 'function') {
        const gamesInLiveWindow = result.filter(game => provider.isGameInLiveWindow(game));
        if (gamesInLiveWindow.length > 0) {
            console.log(`[${tag}] Checking ${gamesInLiveWindow.length} games that may have started...`);
            const liveCheckResults = await Promise.all(
                gamesInLiveWindow.map(async (game) => {
                    const hasStarted = await provider.checkGameHasStarted(game.uuid);
                    return { gameId: game.uuid, hasStarted };
                })
            );

            const liveGameIds = new Set(
                liveCheckResults.filter(r => r.hasStarted).map(r => r.gameId)
            );

            if (liveGameIds.size > 0) {
                console.log(`[${tag}] Found ${liveGameIds.size} games that have transitioned to live`);
                result = result.map(game => (
                    liveGameIds.has(game.uuid) ? { ...game, state: 'live' } : game
                ));
            }
        }
    }

    // 2. Live games always get fresh scores, even on a cache hit — the cached
    //    copy's score is stale by construction (see above).
    if (typeof provider?.enrichGames === 'function' && result.some(g => g.state === 'live')) {
        console.log(`[${tag}] Enriching live games with fresh scores...`);
        result = await provider.enrichGames(result);
    }

    return result;
}

module.exports = { refreshLiveGames };
