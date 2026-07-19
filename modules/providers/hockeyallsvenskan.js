const SHLProvider = require('./shl');

/**
 * HockeyAllsvenskan (Swedish tier-2 hockey) Data Provider
 *
 * HockeyAllsvenskan runs on the EXACT same backend platform as the SHL
 * (same www.<league>.se/api contract: sports-v2/game-schedule, sports-v2/game-info,
 * gameday/play-by-play, media/videos-for-game, StayLive video CDN, identical JSON
 * shapes with gameInfo[]/homeTeamInfo/awayTeamInfo/state/explicit per-goal scores).
 *
 * So this provider is just the SHL provider pointed at the HA host with the HA
 * season/series/gameType UUIDs. All the score-resolution, live-window, play-by-play,
 * standings-from-games and video logic in SHLProvider works unchanged. If SHL and HA
 * ever diverge, override the specific method here.
 */
class HockeyAllsvenskanProvider extends SHLProvider {
    constructor() {
        super();
        // Re-brand (BaseProvider.name drives log tags + getName()).
        this.name = 'HockeyAllsvenskan';

        this.baseUrl = 'https://www.hockeyallsvenskan.se/api';

        // Current season identifiers (2025-26). Sourced from the HA site's embedded
        // game-schedule URL. gameTypeUuid (regular season) happens to match SHL's.
        this.seasonUuid = 'ndcf81nlb3';
        this.seriesUuid = 'qQ9-594cW8OWD';
        this.gameTypeUuid = 'qQ9-af37Ti40B';
        this.seasonLabel = '2026-27';

        this.scheduleUrl = `${this.baseUrl}/sports-v2/game-schedule?seasonUuid=${this.seasonUuid}&seriesUuid=${this.seriesUuid}&gameTypeUuid=${this.gameTypeUuid}&gamePlace=all&played=all`;

        this.maxHoursSinceGame = 36;
    }

    // Standings label the series 'HockeyAllsvenskan' instead of 'SHL'.
    async fetchStandings() {
        const standings = await super.fetchStandings();
        return { ...standings, series: 'HockeyAllsvenskan' };
    }
}

module.exports = HockeyAllsvenskanProvider;
