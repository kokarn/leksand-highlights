const MAX_ENTRIES = 200;
const log = [];

function addEntry(source, type, title, details = null) {
    log.unshift({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        source,
        type,
        title,
        details,
        timestamp: new Date().toISOString()
    });
    if (log.length > MAX_ENTRIES) {
        log.pop();
    }
}

function getEntries(limit = 50) {
    return { entries: log.slice(0, limit), total: log.length };
}

function clear() {
    log.length = 0;
}

module.exports = { addEntry, getEntries, clear };
