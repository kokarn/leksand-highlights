const AllsvenskanProvider = require('./allsvenskan');

/**
 * UEFA Europa League Qualifying Data Provider
 *
 * Uses ESPN public APIs (league slug `uefa.europa_qual`) for fixtures, scores, and
 * game summaries/events — the SAME contract as Allsvenskan (`swe.1`), so this is a
 * thin subclass of AllsvenskanProvider with only the ESPN endpoints + sport tag
 * overridden.
 *
 * Differences vs Allsvenskan:
 *  - Clips: FotbollPlay is Allsvenskan-only, so there is NO clip source for this
 *    competition. fetchGameVideos() is overridden to return [] (schedule + scores +
 *    goal pushes only, no highlight clips — expected, not a gap).
 *  - Standings: the ESPN qualifying endpoint returns no standings table (knockout
 *    format), so fetchStandings() degrades to an empty-but-valid payload rather than
 *    throwing.
 */
class EuropaLeagueQualProvider extends AllsvenskanProvider {
    constructor() {
        super();

        this.name = 'Europa League Qualifying';

        this.scoreboardBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa_qual/scoreboard';
        this.summaryBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa_qual/summary';
        this.standingsUrl = 'https://site.web.api.espn.com/apis/v2/sports/soccer/uefa.europa_qual/standings';
    }

    normalizeEvent(event) {
        const normalized = super.normalizeEvent(event);
        if (normalized) {
            normalized.sport = 'europa-league-qual';
        }
        return normalized;
    }

    async fetchGameDetails(gameId) {
        const details = await super.fetchGameDetails(gameId);
        if (details?.info) {
            details.info.sport = 'europa-league-qual';
        }
        return details;
    }

    /**
     * No clip source exists for Europa League qualifiers (FotbollPlay is
     * Allsvenskan-only). Return no clips rather than attempting a Swedish-league
     * lookup that would never match.
     */
    async fetchGameVideos() {
        return [];
    }

    /**
     * The ESPN qualifying standings endpoint returns no group/league table (the
     * competition is knockout/two-legged), so degrade gracefully to an empty-but-valid
     * payload instead of throwing.
     */
    async fetchStandings(options = {}) {
        try {
            const data = await this.fetchStandingsData(
                options.season
                    ? `${this.standingsUrl}?season=${encodeURIComponent(String(options.season).trim())}`
                    : this.standingsUrl
            );
            const group = data?.children?.[0] || {};
            const entries = group?.standings?.entries || [];

            if (entries.length === 0) {
                return {
                    season: String(data?.season?.year || this.getSeasonYear()),
                    league: 'Europa League Qualifying',
                    lastUpdated: new Date().toISOString(),
                    standings: [],
                    source: 'espn',
                    availableSeasons: []
                };
            }

            // If ESPN ever exposes a table, reuse the parent parser.
            return super.fetchStandings(options);
        } catch (error) {
            console.warn(`[${this.name}] Standings unavailable:`, error.message);
            return {
                season: String(this.getSeasonYear()),
                league: 'Europa League Qualifying',
                lastUpdated: new Date().toISOString(),
                standings: [],
                source: 'espn',
                availableSeasons: []
            };
        }
    }
}

module.exports = EuropaLeagueQualProvider;
