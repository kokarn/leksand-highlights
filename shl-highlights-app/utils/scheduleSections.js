// Helpers for the "All matches" schedule scope: group the full day-by-day
// fixture list into day sections with header rows, and compute the variable-row
// layout (header rows are shorter than match rows) so FlatList getItemLayout and
// the auto-scroll-to-live offset land correctly.
//
// Kept dependency-free (no date-fns / RN imports) so it runs under raw
// `node --test`. Day-label formatting that needs date-fns lives in the DayHeader
// component instead.

// Height of a single compact game row incl. its bottom margin. Mirrors
// COMPACT_CARD_HEIGHT in components/cards/CompactGameCard.js — duplicated as a
// plain constant (rather than imported) so this module stays free of any
// React Native imports and runs under raw `node --test`.
export const COMPACT_ROW_HEIGHT = 56;

// Header row height incl. its bottom margin. Must match DayHeader's rendered
// height (container 30 + marginBottom 12).
export const DAY_HEADER_HEIGHT = 42;

// Local calendar day key (yyyy-mm-dd) from an ISO string, in the device's
// timezone — pure JS so it stays node-testable without date-fns.
export const localDayKey = (iso) => {
    if (!iso) {
        return 'unknown';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return 'unknown';
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Filter a games array down to leagues NOT in the hidden set. Used by the
// "All matches" view so a user can hide leagues they don't care about. An empty
// hidden set (the default) returns the list unchanged, so new leagues show up
// automatically. `hiddenLeagues` may be an array or a Set of `sport` slugs.
export const filterVisibleLeagues = (games, hiddenLeagues) => {
    if (!games || !games.length) {
        return games || [];
    }
    const hidden = hiddenLeagues instanceof Set ? hiddenLeagues : new Set(hiddenLeagues || []);
    if (hidden.size === 0) {
        return games;
    }
    return games.filter(g => !hidden.has(g?.sport));
};

// Flatten a time-sorted games array into a mixed list of header + game rows:
//   [{ type:'header', key, dayKey, date }, { type:'game', key, game }, ...]
// A header is emitted whenever the calendar day changes.
export const buildScheduleSections = (games) => {
    const items = [];
    let lastKey = null;
    for (const game of games || []) {
        const key = localDayKey(game?.startDateTime);
        if (key !== lastKey) {
            items.push({
                type: 'header',
                key: `header-${key}`,
                dayKey: key,
                date: game?.startDateTime ?? null
            });
            lastKey = key;
        }
        items.push({
            type: 'game',
            key: `${game.sport}-${game.uuid}`,
            game
        });
    }
    return items;
};

// Precompute per-index {length, offset} for the mixed section list so
// getItemLayout is O(1) and scroll offsets are exact.
export const buildItemLayout = (items, cardHeight = COMPACT_ROW_HEIGHT, headerHeight = DAY_HEADER_HEIGHT) => {
    const layouts = [];
    let offset = 0;
    for (const item of items || []) {
        const length = item.type === 'header' ? headerHeight : cardHeight;
        layouts.push({ length, offset });
        offset += length;
    }
    return layouts;
};

// Index of the target row to anchor on: first live game, else first
// not-yet-finished game, else the last game. Returns 0 for an empty list.
export const findTargetItemIndex = (items) => {
    if (!items || !items.length) {
        return 0;
    }
    const liveIdx = items.findIndex(i => i.type === 'game' && i.game?.state === 'live');
    if (liveIdx !== -1) {
        return liveIdx;
    }
    const upcomingIdx = items.findIndex(i => i.type === 'game' && i.game?.state !== 'post-game');
    if (upcomingIdx !== -1) {
        return upcomingIdx;
    }
    for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].type === 'game') {
            return i;
        }
    }
    return 0;
};

// Scroll offset to anchor the target game — prefer the day header directly above
// it so the day context ("Today · …") stays visible after the jump.
export const findTargetScrollOffset = (items, layouts) => {
    const idx = findTargetItemIndex(items);
    const anchorIdx = (idx > 0 && items[idx - 1]?.type === 'header') ? idx - 1 : idx;
    return layouts?.[anchorIdx]?.offset ?? 0;
};
