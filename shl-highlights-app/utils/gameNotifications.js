/**
 * Per-match notification overrides — the bell in a match header (issue #53).
 *
 * A match can be overridden either way against what the followed teams imply:
 *
 *  - MUTED: a followed team plays, but this device wants nothing about the match,
 *    typically because it is being watched later and a goal alert would spoil it.
 *  - OPTED IN: no followed team plays, but this device wants the alerts anyway.
 *
 * Both are FCM topics the server's targeting condition reads (see
 * buildGameCondition in modules/fcm-notifications.js), so an override takes effect
 * without the server storing anything per device. The topic names must match the
 * server's buildGameTopic exactly; test/game-notifications.test.js checks both.
 *
 * Kept free of React / React Native imports so it can be unit-tested directly
 * with `node --test`, the same reason utils/teamGames.js is.
 */

// The server's sanitizeTopicName, which FCM's topic charset forces on both sides.
const sanitizeTopicName = (str) => {
    if (!str) {
        return 'unknown';
    }
    return String(str)
        .toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/å/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/é/g, 'e')
        .replace(/ü/g, 'u')
        .replace(/[^a-z0-9_-]/g, '');
};

/**
 * The topic for one override of one match.
 * @param {'game'|'mute'} kind - 'game' opts in, 'mute' opts out
 * @param {string} sport - league slug, e.g. 'shl', 'allsvenskan'
 * @param {string|number} gameId - the feed's game uuid
 * @returns {string|null}
 */
export const gameTopic = (kind, sport, gameId) => {
    const id = sanitizeTopicName(String(gameId ?? ''));
    if (!id || id === 'unknown') {
        return null;
    }
    const league = String(sport || '').toLowerCase() === 'football' ? 'allsvenskan' : (sport || 'shl');
    return `${kind}_${sanitizeTopicName(league)}_${id}`;
};

/**
 * The stored key for one match's override: `${sport}:${gameId}`.
 */
export const gameOverrideKey = (sport, gameId) => `${sport}:${gameId}`;

/**
 * Whether this device gets alerts for a match, all things considered.
 * @param {boolean} followsTeam - a followed team plays in it
 * @param {'mute'|'game'|undefined} override
 */
export const gameNotificationsOn = (followsTeam, override) => {
    if (override === 'mute') {
        return false;
    }
    if (override === 'game') {
        return true;
    }
    return followsTeam;
};

/**
 * The override that flips a match from its current state.
 *
 * Toggling never stores the redundant value: switching a followed match back on
 * clears its mute rather than also opting it in, so following or unfollowing a
 * team later still behaves as expected.
 * @param {boolean} followsTeam
 * @param {'mute'|'game'|undefined} override
 * @returns {'mute'|'game'|null} null clears the override
 */
export const toggledGameOverride = (followsTeam, override) => {
    const on = gameNotificationsOn(followsTeam, override);
    if (followsTeam) {
        return on ? 'mute' : null;
    }
    return on ? null : 'game';
};

// How long after its start an override is kept. Long enough for highlight clips,
// which can arrive the day after; past that the topic would only accumulate.
export const GAME_OVERRIDE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Drop overrides for matches long finished.
 * @param {Record<string, {kind: string, startDateTime?: string}>} overrides
 * @param {number} now - ms timestamp
 * @returns {{kept: object, expired: Array<{key: string, kind: string}>}}
 */
export const pruneGameOverrides = (overrides, now) => {
    const kept = {};
    const expired = [];
    for (const [key, entry] of Object.entries(overrides || {})) {
        const start = Date.parse(entry?.startDateTime || '');
        if (Number.isFinite(start) && now - start > GAME_OVERRIDE_TTL_MS) {
            expired.push({ key, kind: entry.kind });
        } else {
            kept[key] = entry;
        }
    }
    return { kept, expired };
};

/**
 * Whether a followed team plays in a match, as the SERVER sees it: an exact
 * team-code match, because what it targets is the `team_{code}` topic. Not the
 * looser identity tokens that tint a favourite's row — a bell that said "on" for
 * a match the server would not push to is worse than no bell.
 * @param {object} game - carries homeTeamInfo / awayTeamInfo
 * @param {string[]} selectedKeys - followed team codes / keys
 */
export const followsGameTeam = (game, selectedKeys = []) => {
    const followed = new Set(selectedKeys.map(sanitizeTopicName));
    return [game?.homeTeamInfo?.code, game?.awayTeamInfo?.code]
        .filter(Boolean)
        .some(code => followed.has(sanitizeTopicName(code)));
};
