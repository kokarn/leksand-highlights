const AllsvenskanProvider = require('./allsvenskan');
const { buildBracket } = require('../bracket-builder');

/**
 * UEFA Europa League Qualifying Data Provider
 *
 * Uses ESPN public APIs (league slug `uefa.europa_qual`) for fixtures, scores, and
 * game summaries/events — the SAME contract as Allsvenskan (`swe.1`), so this is a
 * thin subclass of AllsvenskanProvider with only the ESPN endpoints, sport slug,
 * and FotbollPlay capability overridden.
 *
 * Differences vs Allsvenskan:
 *  - FotbollPlay: covers Allsvenskan only, so `supportsFotbollPlay = false`. That
 *    keeps its fixtures out of this competition's schedule and leaves it with no
 *    clip source — schedule + scores + goal pushes only, no highlight clips
 *    (expected, not a gap).
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

        this.sportSlug = 'europa-league-qual';

        // FotbollPlay covers Allsvenskan only. Left on, the inherited
        // fetchAllGames() merged 100 Swedish league fixtures into this
        // competition's schedule (every one tagged sport: 'allsvenskan').
        this.supportsFotbollPlay = false;
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

    /**
     * Build the knockout bracket (two-legged ties grouped by round, with feeder
     * origins for arrows). See ConferenceLeagueQualProvider.fetchBracket — same
     * approach: raw ESPN leg-events across the multi-year window.
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
        const bracket = buildBracket(allEvents, {
            resolveNames: (t) => this.getTeamNames(t),
            resolveIcon: (icon, id) => this.resolveTeamIcon(icon, id)
        });
        return {
            league: this.name,
            sport: 'europa-league-qual',
            season: String(year),
            source: 'espn',
            ...bracket
        };
    }
}

module.exports = EuropaLeagueQualProvider;
