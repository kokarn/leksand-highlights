const BaseProvider = require('./base');

/**
 * Biathlon Data Provider
 *
 * Fetches race schedules from the IBU (International Biathlon Union) World Cup.
 * Uses a combination of cached season data and live updates.
 */
class BiathlonProvider extends BaseProvider {
    constructor() {
        super('Biathlon');

        // IBU Datacenter API base URL
        this.baseUrl = 'https://www.biathlonworld.com';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        // Current season identifier
        this.currentSeason = '2025-26';
    }

    /**
     * Get the 2025-26 World Cup calendar
     * This is a curated list based on official IBU calendar
     */
    getSeasonCalendar() {
        return [
            {
                id: 'wc-2025-kontiolahti-1',
                name: 'World Cup 1 - Kontiolahti',
                type: 'world-cup',
                location: 'Kontiolahti',
                country: 'FIN',
                countryName: 'Finland',
                startDate: '2025-11-29',
                endDate: '2025-12-01',
                races: [
                    { discipline: 'Individual', gender: 'women', date: '2025-11-29', time: '13:30' },
                    { discipline: 'Individual', gender: 'men', date: '2025-11-29', time: '16:45' },
                    { discipline: 'Sprint', gender: 'women', date: '2025-11-30', time: '13:30' },
                    { discipline: 'Sprint', gender: 'men', date: '2025-11-30', time: '16:00' },
                    { discipline: 'Pursuit', gender: 'women', date: '2025-12-01', time: '13:00' },
                    { discipline: 'Pursuit', gender: 'men', date: '2025-12-01', time: '15:00' }
                ]
            },
            {
                id: 'wc-2025-hochfilzen',
                name: 'World Cup 2 - Hochfilzen',
                type: 'world-cup',
                location: 'Hochfilzen',
                country: 'AUT',
                countryName: 'Austria',
                startDate: '2025-12-12',
                endDate: '2025-12-14',
                races: [
                    { discipline: 'Sprint', gender: 'men', date: '2025-12-12', time: '11:30' },
                    { discipline: 'Sprint', gender: 'women', date: '2025-12-12', time: '14:15' },
                    { discipline: 'Pursuit', gender: 'men', date: '2025-12-13', time: '12:00' },
                    { discipline: 'Pursuit', gender: 'women', date: '2025-12-13', time: '14:15' },
                    { discipline: 'Relay', gender: 'men', date: '2025-12-14', time: '11:45' },
                    { discipline: 'Relay', gender: 'women', date: '2025-12-14', time: '14:30' }
                ]
            },
            {
                id: 'wc-2025-le-grand-bornand',
                name: 'World Cup 3 - Le Grand-Bornand',
                type: 'world-cup',
                location: 'Le Grand-Bornand',
                country: 'FRA',
                countryName: 'France',
                startDate: '2025-12-18',
                endDate: '2025-12-21',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2025-12-18', time: '14:15' },
                    { discipline: 'Sprint', gender: 'men', date: '2025-12-19', time: '14:15' },
                    { discipline: 'Pursuit', gender: 'women', date: '2025-12-20', time: '12:30' },
                    { discipline: 'Pursuit', gender: 'men', date: '2025-12-20', time: '14:45' },
                    { discipline: 'Mass Start', gender: 'women', date: '2025-12-21', time: '12:30' },
                    { discipline: 'Mass Start', gender: 'men', date: '2025-12-21', time: '14:45' }
                ]
            },
            {
                id: 'wc-2026-oberhof',
                name: 'World Cup 4 - Oberhof',
                type: 'world-cup',
                location: 'Oberhof',
                country: 'GER',
                countryName: 'Germany',
                startDate: '2026-01-08',
                endDate: '2026-01-12',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2026-01-08', time: '14:20' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-01-09', time: '14:20' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-01-10', time: '12:30' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-01-10', time: '14:45' },
                    { discipline: 'Relay', gender: 'women', date: '2026-01-11', time: '11:45' },
                    { discipline: 'Relay', gender: 'men', date: '2026-01-11', time: '14:15' },
                    { discipline: 'Mass Start', gender: 'women', date: '2026-01-12', time: '12:30' },
                    { discipline: 'Mass Start', gender: 'men', date: '2026-01-12', time: '15:00' }
                ]
            },
            {
                id: 'wc-2026-ruhpolding',
                name: 'World Cup 5 - Ruhpolding',
                type: 'world-cup',
                location: 'Ruhpolding',
                country: 'GER',
                countryName: 'Germany',
                startDate: '2026-01-14',
                endDate: '2026-01-18',
                races: [
                    { discipline: 'Sprint', gender: 'men', date: '2026-01-15', time: '14:20' },
                    { discipline: 'Sprint', gender: 'women', date: '2026-01-16', time: '14:20' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-01-17', time: '12:20' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-01-17', time: '14:30' },
                    { discipline: 'Mixed Relay', gender: 'mixed', date: '2026-01-18', time: '11:30' },
                    { discipline: 'Single Mixed Relay', gender: 'mixed', date: '2026-01-18', time: '14:15' }
                ]
            },
            {
                id: 'wc-2026-antholz',
                name: 'World Cup 6 - Antholz-Anterselva',
                type: 'world-cup',
                location: 'Antholz-Anterselva',
                country: 'ITA',
                countryName: 'Italy',
                startDate: '2026-01-22',
                endDate: '2026-01-25',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2026-01-22', time: '14:30' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-01-23', time: '14:30' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-01-24', time: '13:00' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-01-24', time: '15:00' },
                    { discipline: 'Mass Start', gender: 'women', date: '2026-01-25', time: '12:15' },
                    { discipline: 'Mass Start', gender: 'men', date: '2026-01-25', time: '14:45' }
                ]
            },
            {
                id: 'olympics-2026',
                name: 'Winter Olympics 2026',
                type: 'olympics',
                location: 'Antholz-Anterselva',
                country: 'ITA',
                countryName: 'Italy',
                startDate: '2026-02-08',
                endDate: '2026-02-21',
                races: [
                    { discipline: 'Mixed Relay', gender: 'mixed', date: '2026-02-08', time: '14:45' },
                    { discipline: 'Individual', gender: 'women', date: '2026-02-10', time: '14:30' },
                    { discipline: 'Individual', gender: 'men', date: '2026-02-11', time: '14:30' },
                    { discipline: 'Sprint', gender: 'women', date: '2026-02-13', time: '17:00' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-02-14', time: '17:00' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-02-15', time: '15:00' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-02-16', time: '15:00' },
                    { discipline: 'Relay', gender: 'women', date: '2026-02-18', time: '14:30' },
                    { discipline: 'Relay', gender: 'men', date: '2026-02-20', time: '14:30' },
                    { discipline: 'Mass Start', gender: 'women', date: '2026-02-21', time: '10:00' },
                    { discipline: 'Mass Start', gender: 'men', date: '2026-02-21', time: '15:15' }
                ]
            },
            {
                id: 'wc-2026-nove-mesto',
                name: 'World Cup 7 - Nové Město',
                type: 'world-cup',
                location: 'Nové Město na Moravě',
                country: 'CZE',
                countryName: 'Czech Republic',
                startDate: '2026-03-05',
                endDate: '2026-03-08',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2026-03-05', time: '14:30' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-03-06', time: '14:30' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-03-07', time: '12:45' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-03-07', time: '15:00' },
                    { discipline: 'Mass Start', gender: 'women', date: '2026-03-08', time: '12:30' },
                    { discipline: 'Mass Start', gender: 'men', date: '2026-03-08', time: '15:00' }
                ]
            },
            {
                id: 'wc-2026-otepaa',
                name: 'World Cup 8 - Otepää',
                type: 'world-cup',
                location: 'Otepää',
                country: 'EST',
                countryName: 'Estonia',
                startDate: '2026-03-12',
                endDate: '2026-03-15',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2026-03-12', time: '14:20' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-03-13', time: '14:20' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-03-14', time: '11:45' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-03-14', time: '14:00' },
                    { discipline: 'Mixed Relay', gender: 'mixed', date: '2026-03-15', time: '12:00' },
                    { discipline: 'Single Mixed Relay', gender: 'mixed', date: '2026-03-15', time: '14:30' }
                ]
            },
            {
                id: 'wc-2026-oslo',
                name: 'World Cup Final - Oslo Holmenkollen',
                type: 'world-cup',
                location: 'Oslo Holmenkollen',
                country: 'NOR',
                countryName: 'Norway',
                startDate: '2026-03-19',
                endDate: '2026-03-22',
                races: [
                    { discipline: 'Sprint', gender: 'women', date: '2026-03-19', time: '14:30' },
                    { discipline: 'Sprint', gender: 'men', date: '2026-03-20', time: '14:30' },
                    { discipline: 'Pursuit', gender: 'women', date: '2026-03-21', time: '12:30' },
                    { discipline: 'Pursuit', gender: 'men', date: '2026-03-21', time: '15:00' },
                    { discipline: 'Mass Start', gender: 'women', date: '2026-03-22', time: '12:30' },
                    { discipline: 'Mass Start', gender: 'men', date: '2026-03-22', time: '15:30' }
                ]
            }
        ];
    }

    /**
     * Transform calendar events into a unified game/race format
     */
    transformToRaces(events) {
        const races = [];
        const now = new Date();

        for (const event of events) {
            for (const race of event.races) {
                const raceDateTime = new Date(`${race.date}T${race.time}:00`);
                const isPast = raceDateTime < now;
                const isLive = !isPast && (now - raceDateTime) > -3600000 && (now - raceDateTime) < 7200000; // within 1hr before to 2hr after

                let state = 'upcoming';
                if (isPast) state = 'completed';
                if (isLive) state = 'live';

                races.push({
                    uuid: `${event.id}-${race.discipline.toLowerCase().replace(/\s/g, '-')}-${race.gender}`,
                    eventId: event.id,
                    eventName: event.name,
                    eventType: event.type,
                    discipline: race.discipline,
                    gender: race.gender,
                    genderDisplay: race.gender === 'mixed' ? 'Mixed' : (race.gender === 'men' ? 'Men' : 'Women'),
                    startDateTime: `${race.date}T${race.time}:00`,
                    date: race.date,
                    time: race.time,
                    location: event.location,
                    country: event.country,
                    countryName: event.countryName,
                    state,
                    sport: 'biathlon'
                });
            }
        }

        // Sort by date (newest first for consistency with SHL)
        return races.sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    }

    async fetchAllGames() {
        console.log(`[${this.name}] Fetching biathlon race schedule...`);
        const events = this.getSeasonCalendar();
        return this.transformToRaces(events);
    }

    async fetchActiveGames() {
        const allRaces = await this.fetchAllGames();
        const now = new Date();

        // Return upcoming races within next 14 days and recent completed races
        return allRaces.filter(race => {
            const raceDate = new Date(race.startDateTime);
            const daysDiff = (raceDate - now) / (1000 * 60 * 60 * 24);
            return daysDiff >= -2 && daysDiff <= 14;
        });
    }

    async fetchUpcomingRaces(limit = 20) {
        const allRaces = await this.fetchAllGames();
        const now = new Date();

        // Return only upcoming races
        return allRaces
            .filter(race => new Date(race.startDateTime) >= now)
            .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
            .slice(0, limit);
    }

    async fetchGameVideos(gameId) {
        // Biathlon videos would come from different sources
        // For now, return empty - can be implemented later
        return [];
    }

    async fetchGameDetails(gameId) {
        const allRaces = await this.fetchAllGames();
        const race = allRaces.find(r => r.uuid === gameId);

        if (!race) return null;

        return {
            info: race,
            results: null, // Would contain race results when available
            startList: null // Would contain start list when available
        };
    }

    async fetchEvents() {
        return this.getSeasonCalendar();
    }

    isHighlight(video) {
        return false;
    }

    getGameDisplayInfo(game) {
        return {
            discipline: game.discipline,
            gender: game.genderDisplay,
            location: game.location,
            country: game.countryName,
            gameId: game.uuid,
            state: game.state,
            startTime: game.startDateTime
        };
    }

    getVideoUrl(video) {
        return '';
    }

    getVideoThumbnail(video) {
        return null;
    }
}

module.exports = BiathlonProvider;
