// Integration check: prove Allsvenskan goal-clip detection works end-to-end against
// the live FotbollPlay API. Not a unit test (hits network) — run manually.
const AllsvenskanProvider = require('../modules/providers/allsvenskan');

async function main() {
    const p = new AllsvenskanProvider();

    // Find a recently played game via FotbollPlay directly.
    const from = '2026-07-01';
    const to = '2026-07-14';
    const url = new URL(`${p.fotbollPlayApiBaseUrl}/game`);
    url.searchParams.set('from_date', from);
    url.searchParams.set('to_date', to);
    url.searchParams.set('count', '50');
    const res = await fetch(url.toString(), { headers: p.headers });
    const data = await res.json();
    const games = Array.isArray(data?.games) ? data.games : [];
    if (games.length === 0) {
        console.log('No FotbollPlay games in window — cannot run integration check.');
        return;
    }
    const gameId = games[0].id;
    console.log(`Testing FotbollPlay game ${gameId}: ${games[0].home_team?.name} vs ${games[0].visiting_team?.name || games[0].away_team?.name}`);

    // Pull playlists and normalize exactly as fetchGameVideos does.
    const plUrl = new URL(`${p.fotbollPlayApiBaseUrl}/playlist`);
    plUrl.searchParams.set('game_id', String(gameId));
    plUrl.searchParams.set('count', '50');
    plUrl.searchParams.set('holdback', 'public');
    const plRes = await fetch(plUrl.toString(), { headers: p.headers });
    const plData = await plRes.json();
    const playlists = Array.isArray(plData?.playlists) ? plData.playlists : [];

    const clips = playlists
        .map(pl => p.normalizeFotbollPlayPlaylist(pl, gameId))
        .filter(Boolean);

    const goalClips = clips.filter(c => p.isGoalClip(c));
    const highlightReels = clips.filter(c => p.isHighlight(c));

    console.log(`Total clips: ${clips.length}`);
    console.log(`Goal clips (isGoalClip): ${goalClips.length}`);
    console.log(`Highlight reels (isHighlight): ${highlightReels.length}`);
    console.log('--- goal clips ---');
    for (const g of goalClips) {
        console.log(`  • "${g.title}" | tags=${JSON.stringify(g.tags)} | url=${p.getVideoUrl(g)}`);
    }

    if (goalClips.length === 0) {
        console.error('FAIL: expected at least one goal clip for a completed match.');
        process.exit(1);
    }
    // Every goal clip must carry a playable URL.
    const missingUrl = goalClips.filter(g => !p.getVideoUrl(g));
    if (missingUrl.length > 0) {
        console.error(`FAIL: ${missingUrl.length} goal clip(s) have no playable URL.`);
        process.exit(1);
    }
    console.log('PASS: goal clips detected with playable URLs.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
