const BaseProvider = require('./base');
const { formatSwedishTimestamp } = require('../utils');

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
        this.resultsApiBaseUrl = 'https://www.biathlonresults.com/modules/sportapi/api';
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

    getSeasonId(season = this.currentSeason) {
        const [startYear, endYearRaw] = String(season).split('-');
        const start = String(startYear || '').slice(-2);
        const end = String(endYearRaw || '').padStart(2, '0');
        return `${start}${end}`;
    }

    getPreviousSeason(season = this.currentSeason) {
        const [startYearRaw] = String(season).split('-');
        const startYear = parseInt(startYearRaw, 10);
        if (Number.isNaN(startYear)) {
            return this.currentSeason;
        }
        const previousStartYear = startYear - 1;
        const previousEndYear = String(previousStartYear + 1).slice(-2);
        return `${previousStartYear}-${previousEndYear}`;
    }

    getStockholmDateTimeParts(date) {
        return {
            date: date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }),
            time: date.toLocaleTimeString('sv-SE', {
                timeZone: 'Europe/Stockholm',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
        };
    }

    getGenderFromCategory(categoryId) {
        if (categoryId === 'SM') {
            return 'men';
        }
        if (categoryId === 'SW') {
            return 'women';
        }
        return 'mixed';
    }

    getDisciplineName(competition) {
        const description = `${competition.ShortDescription || ''} ${competition.Description || ''}`.toLowerCase();

        if (description.includes('single mixed')) {
            return 'Single Mixed Relay';
        }
        if (description.includes('mixed relay')) {
            return 'Mixed Relay';
        }

        const disciplineMap = {
            SP: 'Sprint',
            PU: 'Pursuit',
            IN: 'Individual',
            MS: 'Mass Start',
            RL: 'Relay',
            SR: 'Single Mixed Relay',
            MR: 'Mixed Relay'
        };

        if (disciplineMap[competition.DisciplineId]) {
            return disciplineMap[competition.DisciplineId];
        }

        if (description.includes('mass start')) {
            return 'Mass Start';
        }
        if (description.includes('individual')) {
            return 'Individual';
        }
        if (description.includes('pursuit')) {
            return 'Pursuit';
        }
        if (description.includes('sprint')) {
            return 'Sprint';
        }
        if (description.includes('relay')) {
            return 'Relay';
        }

        return competition.ShortDescription || competition.Description || 'Race';
    }

    buildEventName(event) {
        if (event.EventClassificationId === 'BTSWRLOG') {
            const year = event.StartDate ? new Date(event.StartDate).getUTCFullYear() : null;
            return year ? `Winter Olympics ${year}` : 'Winter Olympics';
        }

        const series = event.EventSeriesNr ? event.EventSeriesNr.trim() : '';
        const prefix = series ? `World Cup ${series}` : 'World Cup';
        return `${prefix} - ${event.ShortDescription || event.Organizer || 'TBA'}`;
    }

    async fetchIbuJson(endpoint, label) {
        const isAbsolute = typeof endpoint === 'string' && endpoint.startsWith('http');
        const url = isAbsolute ? endpoint : `${this.resultsApiBaseUrl}/${endpoint}`;
        const context = label || 'data';

        try {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok) {
                throw new Error(`IBU ${context} fetch failed (${response.status})`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`[${this.name}] Failed to fetch IBU ${context}:`, error.message);
            return null;
        }
    }

    async fetchIbuEvents(season = this.currentSeason) {
        const seasonId = this.getSeasonId(season);
        const events = await this.fetchIbuJson(`Events?SeasonId=${seasonId}`, 'events');
        if (!Array.isArray(events)) {
            return [];
        }

        return events.filter(event => (
            event.EventClassificationId === 'BTSWRLCP' ||
            event.EventClassificationId === 'BTSWRLOG'
        ));
    }

    async fetchIbuEventRaces(eventId) {
        const competitions = await this.fetchIbuJson(`Competitions?EventId=${eventId}`, `competitions for ${eventId}`);
        if (!Array.isArray(competitions)) {
            return [];
        }

        return competitions
            .filter(competition => competition.StartTime)
            .map(competition => {
                const startDate = new Date(competition.StartTime);
                if (Number.isNaN(startDate.getTime())) {
                    return null;
                }

                const { date, time } = this.getStockholmDateTimeParts(startDate);

                return {
                    id: competition.RaceId,
                    discipline: this.getDisciplineName(competition),
                    disciplineId: competition.DisciplineId || null,
                    gender: this.getGenderFromCategory(competition.catId),
                    categoryId: competition.catId || null,
                    km: competition.km || null,
                    date,
                    time,
                    startDateTime: competition.StartTime,
                    isLive: Boolean(competition.IsLive),
                    hasLiveData: Boolean(competition.HasLiveData),
                    scheduleStatus: competition.ScheduleStatus || null,
                    resultStatus: competition.ResultStatus || null,
                    statusText: competition.StatusText || null,
                    startMode: competition.StartMode || null,
                    shootings: competition.NrShootings ?? null,
                    spareRounds: competition.NrSpareRounds ?? null,
                    hasSpareRounds: Boolean(competition.HasSpareRounds),
                    penaltySeconds: competition.PenaltySeconds ?? null,
                    legs: competition.NrLegs ?? null,
                    shootingPositions: competition.ShootingPositions || null,
                    localUtcOffset: competition.LocalUTCOffset ?? null,
                    rsc: competition.RSC || null,
                    resultsCredit: competition.ResultsCredit || null,
                    timingCredit: competition.TimingCredit || null,
                    hasAnalysis: Boolean(competition.HasAnalysis)
                };
            })
            .filter(Boolean);
    }

    async fetchIbuSchedule(season = this.currentSeason) {
        const events = await this.fetchIbuEvents(season);
        if (!events.length) return [];

        const schedule = await Promise.all(events.map(async event => {
            const races = await this.fetchIbuEventRaces(event.EventId);
            return {
                id: event.EventId,
                name: this.buildEventName(event),
                type: event.EventClassificationId === 'BTSWRLOG' ? 'olympics' : 'world-cup',
                location: event.ShortDescription || event.Organizer || 'TBA',
                country: event.Nat,
                countryName: event.NatLong,
                startDate: event.StartDate ? event.StartDate.slice(0, 10) : null,
                endDate: event.EndDate ? event.EndDate.slice(0, 10) : null,
                races
            };
        }));

        return schedule
            .filter(event => event.races && event.races.length > 0)
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }

    /**
     * Transform calendar events into a unified game/race format
     */
    transformToRaces(events) {
        const races = [];
        const now = new Date();

        for (const event of events) {
            for (const race of event.races) {
                const startDateTime = race.startDateTime || `${race.date}T${race.time}:00`;
                const raceDateTime = new Date(startDateTime);
                if (Number.isNaN(raceDateTime.getTime())) {
                    continue;
                }

                const isPast = raceDateTime < now;
                const timeSinceStart = now - raceDateTime; // positive if race has started
                // Only consider "live" if race started within last 2 hours (races typically last 30min-2hrs)
                // Do NOT mark upcoming races as live just because they're about to start
                const isLiveWindow = timeSinceStart > 0 && timeSinceStart < 7200000; // 0-2 hours after start
                const scheduleStatus = race.scheduleStatus ? String(race.scheduleStatus).toUpperCase() : '';
                const resultStatus = race.resultStatus ? String(race.resultStatus).toUpperCase() : '';
                const hasResultStatus = ['OFFICIAL', 'PROVISIONAL', 'UNOFFICIAL'].includes(resultStatus);
                const isFinished = scheduleStatus === 'FINISHED' || scheduleStatus === 'COMPLETED' || hasResultStatus;
                // Only use isLiveWindow if the race is actually ongoing (not finished)
                const isLive = Boolean(race.isLive) || Boolean(race.hasLiveData) || (isLiveWindow && !isFinished);

                let state = 'upcoming';
                if (isFinished || isPast) {
                    state = 'completed';
                }
                if (isLive) {
                    state = 'live';
                }

                const raceId = race.uuid || race.id || `${event.id}-${race.discipline.toLowerCase().replace(/\s/g, '-')}-${race.gender}`;
                const dateParts = race.date && race.time
                    ? { date: race.date, time: race.time }
                    : this.getStockholmDateTimeParts(raceDateTime);

                races.push({
                    uuid: raceId,
                    ibuRaceId: race.id || null,
                    eventId: event.id,
                    eventName: event.name,
                    eventType: event.type,
                    discipline: race.discipline,
                    disciplineId: race.disciplineId || null,
                    gender: race.gender,
                    genderDisplay: race.gender === 'mixed' ? 'Mixed' : (race.gender === 'men' ? 'Men' : 'Women'),
                    startDateTime,
                    date: dateParts.date,
                    time: dateParts.time,
                    location: event.location,
                    country: event.country,
                    countryName: event.countryName,
                    statusText: race.statusText || null,
                    scheduleStatus: race.scheduleStatus || null,
                    resultStatus: race.resultStatus || null,
                    hasLiveData: Boolean(race.hasLiveData),
                    startMode: race.startMode || null,
                    shootings: race.shootings ?? null,
                    spareRounds: race.spareRounds ?? null,
                    hasSpareRounds: Boolean(race.hasSpareRounds),
                    penaltySeconds: race.penaltySeconds ?? null,
                    legs: race.legs ?? null,
                    shootingPositions: race.shootingPositions || null,
                    localUtcOffset: race.localUtcOffset ?? null,
                    rsc: race.rsc || null,
                    categoryId: race.categoryId || null,
                    km: race.km || null,
                    resultsCredit: race.resultsCredit || null,
                    timingCredit: race.timingCredit || null,
                    hasAnalysis: Boolean(race.hasAnalysis),
                    state,
                    source: race.id ? 'ibu' : 'static',
                    sport: 'biathlon'
                });
            }
        }

        // Sort by date (newest first for consistency with SHL)
        return races.sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    }

    mergeRaces(...raceLists) {
        const merged = new Map();
        raceLists.flat().forEach(race => {
            if (!race?.uuid) return;
            merged.set(race.uuid, race);
        });
        return Array.from(merged.values()).sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));
    }

    async fetchAllGames() {
        console.log(`[${this.name}] Fetching biathlon race schedule...`);
        try {
            const events = await this.fetchIbuSchedule();
            if (events.length) {
                const currentRaces = this.transformToRaces(events);
                const hasCompleted = currentRaces.some(race => race.state === 'completed');
                if (!hasCompleted) {
                    const previousSeason = this.getPreviousSeason();
                    const previousEvents = await this.fetchIbuSchedule(previousSeason);
                    if (previousEvents.length) {
                        const previousRaces = this.transformToRaces(previousEvents);
                        return this.mergeRaces(previousRaces, currentRaces);
                    }
                }
                return currentRaces;
            }
        } catch (error) {
            console.warn(`[${this.name}] Falling back to static calendar:`, error.message);
        }

        const fallbackEvents = this.getSeasonCalendar();
        return this.transformToRaces(fallbackEvents);
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

    isIbuRaceId(raceId) {
        if (typeof raceId !== 'string') {
            return false;
        }
        return /^[A-Z]{2}\d{4}[A-Z0-9]+$/.test(raceId);
    }

    async fetchIbuRaceResults(raceId) {
        if (!raceId) {
            return null;
        }
        const encodedRaceId = encodeURIComponent(raceId);
        return await this.fetchIbuJson(`Results?RaceId=${encodedRaceId}`, `results for ${raceId}`);
    }

    async fetchIbuRaceStartList(raceId) {
        if (!raceId) {
            return null;
        }
        const encodedRaceId = encodeURIComponent(raceId);
        return await this.fetchIbuJson(`StartList?RaceId=${encodedRaceId}`, `start list for ${raceId}`);
    }

    buildRaceFromIbuPayload(payload) {
        if (!payload?.Competition || !payload?.SportEvt) {
            return null;
        }

        const competition = payload.Competition;
        const event = payload.SportEvt;
        const gender = this.getGenderFromCategory(competition.catId);
        const startDateTime = competition.StartTime || null;
        const raceDateTime = startDateTime ? new Date(startDateTime) : null;
        const hasValidDate = raceDateTime && !Number.isNaN(raceDateTime.getTime());
        const dateParts = hasValidDate
            ? this.getStockholmDateTimeParts(raceDateTime)
            : { date: null, time: null };

        const race = {
            uuid: competition.RaceId || payload.RaceId,
            ibuRaceId: competition.RaceId || payload.RaceId || null,
            eventId: event.EventId,
            eventName: this.buildEventName(event),
            eventType: event.EventClassificationId === 'BTSWRLOG' ? 'olympics' : 'world-cup',
            discipline: this.getDisciplineName(competition),
            disciplineId: competition.DisciplineId || null,
            gender,
            genderDisplay: gender === 'mixed' ? 'Mixed' : (gender === 'men' ? 'Men' : 'Women'),
            startDateTime,
            date: dateParts.date,
            time: dateParts.time,
            location: competition.Location || event.ShortDescription || event.Organizer || 'TBA',
            country: event.Nat || null,
            countryName: event.NatLong || null,
            statusText: competition.StatusText || null,
            scheduleStatus: competition.ScheduleStatus || null,
            resultStatus: competition.ResultStatus || null,
            hasLiveData: Boolean(competition.HasLiveData),
            isLive: Boolean(competition.IsLive),
            startMode: competition.StartMode || null,
            shootings: competition.NrShootings ?? null,
            spareRounds: competition.NrSpareRounds ?? null,
            hasSpareRounds: Boolean(competition.HasSpareRounds),
            penaltySeconds: competition.PenaltySeconds ?? null,
            legs: competition.NrLegs ?? null,
            shootingPositions: competition.ShootingPositions || null,
            localUtcOffset: competition.LocalUTCOffset ?? null,
            rsc: competition.RSC || null,
            categoryId: competition.catId || null,
            km: competition.km || null,
            resultsCredit: competition.ResultsCredit || null,
            timingCredit: competition.TimingCredit || null,
            hasAnalysis: Boolean(competition.HasAnalysis),
            source: 'ibu',
            sport: 'biathlon'
        };

        if (hasValidDate) {
            const scheduleStatus = race.scheduleStatus ? String(race.scheduleStatus).toUpperCase() : '';
            const resultStatus = race.resultStatus ? String(race.resultStatus).toUpperCase() : '';
            const hasResultStatus = ['OFFICIAL', 'PROVISIONAL', 'UNOFFICIAL'].includes(resultStatus);
            const isFinished = scheduleStatus === 'FINISHED' || scheduleStatus === 'COMPLETED' || hasResultStatus;
            const now = new Date();
            const diffMs = now - raceDateTime;
            const isPast = raceDateTime < now;
            const isLiveWindow = !isPast && diffMs > -3600000 && diffMs < 7200000;
            const isLive = Boolean(race.isLive) || Boolean(race.hasLiveData) || isLiveWindow;

            if (isLive) {
                race.state = 'live';
            } else if (isFinished || isPast) {
                race.state = 'completed';
            } else {
                race.state = 'upcoming';
            }
        } else {
            race.state = 'upcoming';
        }

        return race;
    }

    async fetchGameDetails(gameId, options = {}) {
        const races = Array.isArray(options.races) ? options.races : null;
        const allRaces = races || await this.fetchAllGames();
        let race = allRaces.find(r => r.uuid === gameId);

        const ibuRaceId = race?.ibuRaceId || (this.isIbuRaceId(gameId) ? gameId : null);
        let resultsPayload = null;
        let startListPayload = null;

        if (ibuRaceId) {
            resultsPayload = await this.fetchIbuRaceResults(ibuRaceId);
            const hasResults = Boolean(resultsPayload?.IsResult);
            const hasStartList = Boolean(resultsPayload?.IsStartList);
            if (!hasStartList && !hasResults) {
                startListPayload = await this.fetchIbuRaceStartList(ibuRaceId);
            }
        }

        if (!race && resultsPayload) {
            race = this.buildRaceFromIbuPayload(resultsPayload);
        }

        if (!race) {
            return null;
        }

        const resultStatus = resultsPayload?.Competition?.ResultStatus;
        const normalizedResultStatus = resultStatus ? String(resultStatus).toUpperCase() : '';
        const hasResultStatus = ['OFFICIAL', 'PROVISIONAL', 'UNOFFICIAL'].includes(normalizedResultStatus);
        const hasResults = Boolean(resultsPayload?.IsResult) || hasResultStatus;
        const resultsList = Array.isArray(resultsPayload?.Results) ? resultsPayload.Results : null;
        const results = hasResults ? resultsList : null;
        let startList = (!hasResults && resultsPayload?.IsStartList && resultsList) ? resultsList : null;
        if (!startList && Array.isArray(startListPayload?.Results) && startListPayload.Results.length > 0) {
            startList = startListPayload.Results;
        }

        const competition = resultsPayload?.Competition || startListPayload?.Competition || null;
        const event = resultsPayload?.SportEvt || startListPayload?.SportEvt || null;

        return {
            info: race,
            competition,
            event,
            results,
            startList,
            resultMeta: resultsPayload ? {
                isResult: Boolean(resultsPayload.IsResult),
                isStartList: Boolean(resultsPayload.IsStartList)
            } : null,
            source: race.source || (competition ? 'ibu' : 'static'),
            lastUpdated: formatSwedishTimestamp()
        };
    }

    async fetchEvents() {
        const events = await this.fetchIbuSchedule();
        return events.length ? events : this.getSeasonCalendar();
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

    /**
     * Build the full IBU cup ID for standings
     * Format: BT{season}SWRLCP__{category}{discipline}
     * e.g., BT2526SWRLCP__SMTS = Men's World Cup Total Score for 2025-26 season
     */
    buildCupId(seasonId, gender, type) {
        // Map type to discipline code
        const disciplineMap = {
            overall: 'TS',     // Total Score
            sprint: 'SP',      // Sprint
            pursuit: 'PU',     // Pursuit
            individual: 'IN',  // Individual
            'mass-start': 'MS', // Mass Start
            nations: 'NC'      // Nations Cup
        };

        const discipline = disciplineMap[type] || 'TS';
        const category = gender === 'men' ? 'SM' : 'SW';

        return `BT${seasonId}SWRLCP__${category}${discipline}`;
    }

    /**
     * Fetch World Cup standings from IBU
     * @param {Object} options - Optional filters
     * @param {string} options.gender - 'men' or 'women' (defaults to both)
     * @param {string} options.type - 'overall', 'sprint', 'pursuit', 'individual', 'mass-start', 'nations' (defaults to 'overall')
     * @returns {Promise<Object>} Standings payload with season and rankings
     */
    async fetchStandings(options = {}) {
        const { gender = 'all', type = 'overall' } = options;
        const seasonId = this.getSeasonId();

        console.log(`[${this.name}] Fetching standings for season ${seasonId}, gender: ${gender}, type: ${type}...`);

        try {
            const standingsResults = [];

            // Fetch men's standings if requested
            if (gender === 'all' || gender === 'men') {
                const menCupId = this.buildCupId(seasonId, 'men', type);
                const menStandings = await this.fetchIbuJson(
                    `CupResults?CupId=${menCupId}`,
                    `men ${type} standings`
                );
                // IBU API returns 'Rows' array with standings data
                const menRows = menStandings?.Rows || menStandings?.CupResult;
                if (menRows && Array.isArray(menRows) && menRows.length > 0) {
                    standingsResults.push({
                        gender: 'men',
                        genderDisplay: 'Men',
                        type,
                        cupId: menStandings.CupId || menCupId,
                        cupName: menStandings.CupName || this.getCupTypeName(type),
                        raceCount: menStandings.RaceCount || null,
                        totalRaces: menStandings.TotalRaces || null,
                        standings: menRows.map((entry, index) => ({
                            rank: parseInt(entry.Rank, 10) || index + 1,
                            athleteId: entry.IBUId,
                            name: entry.Name || entry.Fullname || `${entry.GivenName || ''} ${entry.FamilyName || ''}`.trim(),
                            nation: entry.Nat,
                            points: parseInt(entry.Score, 10) || 0,
                            raceCount: entry.Starts || entry.RaceCount || null
                        }))
                    });
                }
            }

            // Fetch women's standings if requested
            if (gender === 'all' || gender === 'women') {
                const womenCupId = this.buildCupId(seasonId, 'women', type);
                const womenStandings = await this.fetchIbuJson(
                    `CupResults?CupId=${womenCupId}`,
                    `women ${type} standings`
                );
                // IBU API returns 'Rows' array with standings data
                const womenRows = womenStandings?.Rows || womenStandings?.CupResult;
                if (womenRows && Array.isArray(womenRows) && womenRows.length > 0) {
                    standingsResults.push({
                        gender: 'women',
                        genderDisplay: 'Women',
                        type,
                        cupId: womenStandings.CupId || womenCupId,
                        cupName: womenStandings.CupName || this.getCupTypeName(type),
                        raceCount: womenStandings.RaceCount || null,
                        totalRaces: womenStandings.TotalRaces || null,
                        standings: womenRows.map((entry, index) => ({
                            rank: parseInt(entry.Rank, 10) || index + 1,
                            athleteId: entry.IBUId,
                            name: entry.Name || entry.Fullname || `${entry.GivenName || ''} ${entry.FamilyName || ''}`.trim(),
                            nation: entry.Nat,
                            points: parseInt(entry.Score, 10) || 0,
                            raceCount: entry.Starts || entry.RaceCount || null
                        }))
                    });
                }
            }

            return {
                season: this.currentSeason,
                seasonId,
                type,
                typeName: this.getCupTypeName(type),
                lastUpdated: formatSwedishTimestamp(),
                categories: standingsResults,
                availableTypes: ['overall', 'sprint', 'pursuit', 'individual', 'mass-start']
            };
        } catch (error) {
            console.error(`[${this.name}] Error fetching standings:`, error.message);
            return {
                season: this.currentSeason,
                seasonId,
                type,
                typeName: this.getCupTypeName(type),
                lastUpdated: formatSwedishTimestamp(),
                categories: [],
                availableTypes: ['overall', 'sprint', 'pursuit', 'individual', 'mass-start'],
                error: error.message
            };
        }
    }

    getCupTypeName(type) {
        const names = {
            overall: 'World Cup Overall',
            sprint: 'Sprint Cup',
            pursuit: 'Pursuit Cup',
            individual: 'Individual Cup',
            'mass-start': 'Mass Start Cup',
            nations: 'Nations Cup'
        };
        return names[type] || 'World Cup';
    }
}

module.exports = BiathlonProvider;
