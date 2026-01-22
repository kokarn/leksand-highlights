import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';

/**
 * Helper to safely get player name from different API formats
 * @param {Object} player - Player object from API
 * @returns {string} Formatted player name
 */
export const getPlayerName = (player) => {
    if (!player) return 'Unknown';
    const firstName = player.givenName || player.firstName || '';
    const lastName = player.familyName || player.lastName || '';
    const fn = typeof firstName === 'string' ? firstName : firstName?.value || '';
    const ln = typeof lastName === 'string' ? lastName : lastName?.value || '';
    if (fn && ln) return `${fn.charAt(0)}. ${ln}`;
    if (ln) return ln;
    return 'Unknown';
};

/**
 * Helper to get assist name from goal object
 * @param {Object} assist - Assist object from API
 * @returns {string|null} Last name or null
 */
export const getAssistName = (assist) => {
    if (!assist) return null;
    const lastName = assist.familyName || assist.lastName;
    return typeof lastName === 'string' ? lastName : lastName?.value || null;
};

/**
 * Helper to generate a display title from video tags when title is null
 * @param {Object} video - Video object from API
 * @returns {string} Display title
 */
export const getVideoDisplayTitle = (video) => {
    if (video.title) return video.title;
    const tags = video.tags || [];
    if (tags.includes('custom.highlights')) return 'Game Highlights';
    const goalTag = tags.find(t => t.startsWith('goal.'));
    if (goalTag) {
        const score = goalTag.replace('goal.', '');
        return `Goal (${score})`;
    }
    if (tags.includes('penalty')) return 'Penalty';
    if (tags.includes('save')) return 'Save';
    if (tags.includes('interview')) return 'Interview';
    return 'Video Clip';
};

/**
 * Extract StayLive video ID from SHL video object
 * @param {Object} video - Video object from API
 * @returns {string|null} StayLive ID or null
 */
export const getStayLiveVideoId = (video) => {
    if (video.mediaString) {
        const parts = video.mediaString.split('|');
        if (parts.length === 3 && parts[1] === 'staylive') {
            return parts[2];
        }
    }
    return video.id || null;
};

/**
 * Format relative date (Today, Tomorrow, weekday, or date)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted relative date in Swedish
 */
export const formatRelativeDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = parseISO(dateStr);
        if (Number.isNaN(date.getTime())) return '-';
        if (isToday(date)) return 'Idag';
        if (isTomorrow(date)) return 'Imorgon';
        const days = differenceInDays(date, new Date());
        if (days > 0 && days <= 7) return format(date, 'EEEE', { locale: sv });
        return format(date, 'd MMM', { locale: sv });
    } catch (error) {
        return '-';
    }
};

/**
 * Format relative date in English (Today, Tomorrow, weekday, or date)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted relative date in English
 */
export const formatRelativeDateEnglish = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = parseISO(dateStr);
        if (Number.isNaN(date.getTime())) return '-';
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        const days = differenceInDays(date, new Date());
        if (days > 0 && days <= 7) return format(date, 'EEEE');
        return format(date, 'd MMM');
    } catch (error) {
        return '-';
    }
};

/**
 * Format time from ISO date string (HH:mm)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted time
 */
export const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = parseISO(dateStr);
        if (Number.isNaN(date.getTime())) return '-';
        return format(date, 'HH:mm');
    } catch (error) {
        return '-';
    }
};

/**
 * Format date in Swedish style
 * @param {string} dateStr - ISO date string
 * @param {string} formatStr - Date format string
 * @returns {string} Formatted date
 */
export const formatSwedishDate = (dateStr, formatStr = 'd MMMM HH:mm') => {
    if (!dateStr) return '-';
    try {
        const date = parseISO(dateStr);
        if (Number.isNaN(date.getTime())) return '-';
        return format(date, formatStr, { locale: sv });
    } catch (error) {
        return '-';
    }
};

/**
 * Get goal type tags (PP, SH, EN, PS, GWG)
 * @param {Object} goal - Goal object from API
 * @returns {string|null} Formatted goal types or null
 */
export const getGoalType = (goal) => {
    const types = [];
    if (goal.isPowerPlay) types.push('PP');
    if (goal.isShorthanded) types.push('SH');
    if (goal.isEmptyNet) types.push('EN');
    if (goal.isPenaltyShot) types.push('PS');
    if (goal.isGameWinningGoal) types.push('GWG');
    return types.length > 0 ? types.join(', ') : null;
};

/**
 * Extract score from team result/info objects
 * @param {Object} teamResult - Team result object
 * @param {Object} teamInfo - Team info object
 * @returns {string|number} Score value or dash
 */
export const normalizeScoreValue = (score) => {
    if (score === null || score === undefined) {
        return null;
    }
    if (typeof score === 'object') {
        if (Object.prototype.hasOwnProperty.call(score, 'value')) {
            return normalizeScoreValue(score.value);
        }
        return null;
    }
    if (typeof score === 'string') {
        const trimmed = score.trim();
        if (!trimmed) {
            return null;
        }
        const lowered = trimmed.toLowerCase();
        if (lowered === 'n/a' || lowered === 'na') {
            return null;
        }
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }
        return trimmed;
    }
    if (Number.isNaN(score)) {
        return null;
    }
    return score;
};

export const extractScore = (teamResult, teamInfo) => {
    if (teamResult?.score !== undefined) {
        const normalized = normalizeScoreValue(teamResult.score);
        return normalized ?? '-';
    }
    if (teamInfo?.score !== undefined) {
        const normalized = normalizeScoreValue(teamInfo.score);
        return normalized ?? '-';
    }
    return '-';
};

/**
 * Get penalty minutes from penalty event
 * @param {Object} penalty - Penalty event object
 * @returns {string} Penalty minutes
 */
export const getPenaltyMinutes = (penalty) => {
    const variant = penalty.variant;
    let penaltyMinutes = '2';

    if (penalty.penaltyMinutes) {
        penaltyMinutes = String(penalty.penaltyMinutes);
    } else if (variant && typeof variant === 'object') {
        if (variant.description) {
            const match = variant.description.match(/(\d+)/);
            if (match) penaltyMinutes = match[1];
        } else {
            const times = [
                parseInt(variant.majorTime) || 0,
                parseInt(variant.minorTime) || 0,
                parseInt(variant.doubleMinorTime) || 0,
                parseInt(variant.misconductTime) || 0,
                parseInt(variant.gMTime) || 0,
                parseInt(variant.mPTime) || 0,
                parseInt(variant.benchTime) || 0
            ];
            const maxTime = Math.max(...times);
            if (maxTime > 0) penaltyMinutes = String(maxTime);
        }
    }

    return penaltyMinutes;
};

/**
 * Get offense description from penalty event
 * @param {Object} penalty - Penalty event object
 * @returns {string} Offense description
 */
export const getPenaltyOffense = (penalty) => {
    const offence = penalty.offence;
    return typeof offence === 'string' ? offence : (offence?.shortName || offence?.name || 'Penalty');
};
