const fs = require('fs');
const { randomUUID } = require('crypto');
const { ADMIN_GAMES_FILE } = require('./config');

const ALLOWED_STATES = new Set(['pre-game', 'live', 'post-game']);

function readAdminGamesFile() {
    if (!fs.existsSync(ADMIN_GAMES_FILE)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(ADMIN_GAMES_FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('[Admin Games] Failed to read admin games:', error.message);
        return [];
    }
}

function writeAdminGamesFile(records) {
    fs.writeFileSync(ADMIN_GAMES_FILE, JSON.stringify(records, null, 2));
}

function normalizeTeamCode(value, fieldName) {
    if (!value) {
        throw new Error(`${fieldName} is required`);
    }
    return String(value).trim().toUpperCase();
}

function getTeamByCode(teamsByCode, code, fieldName) {
    const team = teamsByCode.get(code);
    if (!team) {
        throw new Error(`${fieldName} must be a valid team code`);
    }
    return team;
}

function normalizeScore(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        return 0;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return parsed;
}

function normalizeState(value) {
    if (!value) {
        return 'live';
    }
    const normalized = String(value).trim().toLowerCase();
    if (!ALLOWED_STATES.has(normalized)) {
        throw new Error(`state must be one of: ${Array.from(ALLOWED_STATES).join(', ')}`);
    }
    return normalized;
}

function normalizeStartDateTime(value) {
    if (!value) {
        return new Date().toISOString();
    }
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
        throw new Error('startDateTime must be a valid date');
    }
    return date.toISOString();
}

function normalizeVenue(value, fallback) {
    const trimmed = value === undefined || value === null ? '' : String(value).trim();
    return trimmed || fallback || 'Unknown arena';
}

function hydrateAdminGame(record, teamsByCode) {
    const homeTeam = teamsByCode.get(record.homeTeamCode);
    const awayTeam = teamsByCode.get(record.awayTeamCode);

    const venueName = record.venue || homeTeam?.arena || awayTeam?.arena || 'Unknown arena';

    return {
        uuid: record.id,
        startDateTime: record.startDateTime,
        state: record.state,
        homeTeamInfo: {
            code: record.homeTeamCode,
            uuid: homeTeam?.uuid || null,
            names: homeTeam?.names || { short: record.homeTeamCode, long: record.homeTeamCode },
            score: record.homeScore,
            icon: homeTeam?.logo || null
        },
        awayTeamInfo: {
            code: record.awayTeamCode,
            uuid: awayTeam?.uuid || null,
            names: awayTeam?.names || { short: record.awayTeamCode, long: record.awayTeamCode },
            score: record.awayScore,
            icon: awayTeam?.logo || null
        },
        venueInfo: {
            name: venueName
        },
        source: 'admin',
        isManual: true,
        admin: {
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        }
    };
}

function formatAdminRecord(record, teamsByCode) {
    return {
        ...record,
        game: hydrateAdminGame(record, teamsByCode)
    };
}

function buildAdminRecord(payload, teamsByCode) {
    const homeTeamCode = normalizeTeamCode(payload.homeTeamCode, 'homeTeamCode');
    const awayTeamCode = normalizeTeamCode(payload.awayTeamCode, 'awayTeamCode');

    if (homeTeamCode === awayTeamCode) {
        throw new Error('homeTeamCode and awayTeamCode must be different');
    }

    const homeTeam = getTeamByCode(teamsByCode, homeTeamCode, 'homeTeamCode');
    const awayTeam = getTeamByCode(teamsByCode, awayTeamCode, 'awayTeamCode');

    const homeScore = normalizeScore(payload.homeScore, 'homeScore');
    const awayScore = normalizeScore(payload.awayScore, 'awayScore');
    const state = normalizeState(payload.state);
    const startDateTime = normalizeStartDateTime(payload.startDateTime);
    const venue = normalizeVenue(payload.venue, homeTeam?.arena || awayTeam?.arena);
    const now = new Date().toISOString();

    return {
        id: `admin-${randomUUID()}`,
        state,
        startDateTime,
        venue,
        homeTeamCode,
        awayTeamCode,
        homeScore,
        awayScore,
        createdAt: now,
        updatedAt: now
    };
}

function applyAdminUpdates(record, payload, teamsByCode) {
    const updated = { ...record };
    let homeTeamCode = record.homeTeamCode;
    let awayTeamCode = record.awayTeamCode;

    if (payload.homeTeamCode !== undefined) {
        homeTeamCode = normalizeTeamCode(payload.homeTeamCode, 'homeTeamCode');
    }
    if (payload.awayTeamCode !== undefined) {
        awayTeamCode = normalizeTeamCode(payload.awayTeamCode, 'awayTeamCode');
    }
    if (homeTeamCode === awayTeamCode) {
        throw new Error('homeTeamCode and awayTeamCode must be different');
    }

    const homeTeam = getTeamByCode(teamsByCode, homeTeamCode, 'homeTeamCode');
    const awayTeam = getTeamByCode(teamsByCode, awayTeamCode, 'awayTeamCode');

    updated.homeTeamCode = homeTeamCode;
    updated.awayTeamCode = awayTeamCode;

    if (payload.homeScore !== undefined) {
        updated.homeScore = normalizeScore(payload.homeScore, 'homeScore');
    }
    if (payload.awayScore !== undefined) {
        updated.awayScore = normalizeScore(payload.awayScore, 'awayScore');
    }
    if (payload.state !== undefined) {
        updated.state = normalizeState(payload.state);
    }
    if (payload.startDateTime !== undefined) {
        updated.startDateTime = normalizeStartDateTime(payload.startDateTime);
    }
    if (payload.venue !== undefined) {
        updated.venue = normalizeVenue(payload.venue, homeTeam?.arena || awayTeam?.arena);
    }

    updated.updatedAt = new Date().toISOString();
    return updated;
}

function listAdminGames(teamsByCode) {
    const records = readAdminGamesFile();
    return records.map(record => formatAdminRecord(record, teamsByCode));
}

function findAdminGameRecord(id) {
    const records = readAdminGamesFile();
    return records.find(record => record.id === id) || null;
}

function createAdminGame(payload, teamsByCode) {
    const records = readAdminGamesFile();
    const record = buildAdminRecord(payload, teamsByCode);
    records.push(record);
    writeAdminGamesFile(records);
    return record;
}

function updateAdminGame(id, payload, teamsByCode) {
    const records = readAdminGamesFile();
    const index = records.findIndex(record => record.id === id);
    if (index === -1) {
        return null;
    }
    const updated = applyAdminUpdates(records[index], payload, teamsByCode);
    records[index] = updated;
    writeAdminGamesFile(records);
    return updated;
}

function deleteAdminGame(id) {
    const records = readAdminGamesFile();
    const updated = records.filter(record => record.id !== id);
    if (updated.length === records.length) {
        return false;
    }
    writeAdminGamesFile(updated);
    return true;
}

module.exports = {
    listAdminGames,
    findAdminGameRecord,
    createAdminGame,
    updateAdminGame,
    deleteAdminGame,
    hydrateAdminGame,
    formatAdminRecord
};
