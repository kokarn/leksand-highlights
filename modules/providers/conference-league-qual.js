const AllsvenskanProvider = require('./allsvenskan');
const { buildBracket } = require('../bracket-builder');

/**
 * UEFA Conference League Qualifying Data Provider
 *
 * Uses ESPN public APIs (league slug `uefa.europa.conf_qual`) for fixtures, scores,
 * and game summaries/events — the SAME contract as Allsvenskan (`swe.1`), so this is
 * a thin subclass of AllsvenskanProvider with only the ESPN endpoints + sport tag
 * overridden. (This is where GAIS's 2026/27 European campaign lives — NOT the Europa
 * League qualifiers.)
 *
 * Differences vs Allsvenskan (same as the Europa League Qualifying provider):
 *  - Clips: FotbollPlay is Allsvenskan-only, so there is NO clip source for this
 *    competition. fetchGameVideos() is overridden to return [] (schedule + scores +
 *    goal pushes only, no highlight clips — expected, not a gap).
 *  - Standings: the ESPN qualifying endpoint returns no standings table (knockout
 *    format), so fetchStandings() degrades to an empty-but-valid payload.
 */
class ConferenceLeagueQualProvider extends AllsvenskanProvider {
    constructor() {
        super();

        this.name = 'Conference League Qualifying';

        this.scoreboardBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa.conf_qual/scoreboard';
        this.summaryBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa.conf_qual/summary';
        this.standingsUrl = 'https://site.web.api.espn.com/apis/v2/sports/soccer/uefa.europa.conf_qual/standings';
    }

    normalizeEvent(event) {
        const normalized = super.normalizeEvent(event);
        if (normalized) {
            normalized.sport = 'conference-league-qual';
        }
        return normalized;
    }

    async fetchGameDetails(gameId) {
        const details = await super.fetchGameDetails(gameId);
        if (details?.info) {
            details.info.sport = 'conference-league-qual';
        }
        return details;
    }

    /**
     * No clip source exists for Conference League qualifiers (FotbollPlay is
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
                    league: 'Conference League Qualifying',
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
                league: 'Conference League Qualifying',
                lastUpdated: new Date().toISOString(),
                standings: [],
                source: 'espn',
                availableSeasons: []
            };
        }
    }

    /**
     * Build the knockout bracket (two-legged ties grouped by round, with feeder
     * origins for arrows). Uses the RAW ESPN leg-events — which carry the
     * series/leg/aggregate fields that normalizeEvent() strips — across the same
     * multi-year window fetchAllGames() uses, so we catch both the season that
     * just finished and the one ramping up.
     */
    async fetchBracket() {
        const year = this.getSeasonYear();
        const now = new Date();
        const events = await this.fetchSeasonEventsSafe(year);
        const hasFuture = events.some(e => e?.date && new Date(e.date) >= now);
        const hasPast = events.some(e => e?.date && new Date(e.date) < now);

        const extra = [];
        if (!hasFuture) {
            extra.push(await this.fetchSeasonEventsSafe(year + 1));
        }
        if (!hasPast) {
            extra.push(await this.fetchSeasonEventsSafe(year - 1));
        }

        const allEvents = [...events, ...extra.flat()];
        const bracket = buildBracket(allEvents);
        return {
            league: this.name,
            sport: 'conference-league-qual',
            season: String(year),
            source: 'espn',
            ...bracket
        };
    }
}

module.exports = ConferenceLeagueQualProvider;
