/**
 * Shared utility functions
 */

/**
 * Format a date as Swedish timestamp
 * @param {Date} date - Date to format (defaults to now)
 * @returns {string} Formatted timestamp string
 */
function formatSwedishTimestamp(date = new Date()) {
    return date.toLocaleString('sv-SE', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

module.exports = {
    formatSwedishTimestamp
};
