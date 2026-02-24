import { useMemo, useCallback, useRef } from 'react';
import { parseISO, isToday, isTomorrow, differenceInDays, startOfDay } from 'date-fns';

/**
 * Normalize an event from any sport to a common structure
 */
const normalizeEvent = (event, sport) => {
    const startDateTime = event.startDateTime;
    const startTime = startDateTime ? new Date(startDateTime).getTime() : 0;

    // Normalize state across sports
    let normalizedState = event.state || 'unknown';
    if (sport === 'biathlon') {
        // Biathlon uses: 'live', 'starting-soon', 'upcoming', 'completed'
        if (normalizedState === 'completed') {
            normalizedState = 'post-game';
        } else if (normalizedState === 'upcoming' || normalizedState === 'starting-soon') {
            normalizedState = 'pre-game';
        }
    }

    return {
        ...event,
        sport,
        startTime,
        normalizedState,
        isLive: event.state === 'live',
        isStartingSoon: event.state === 'starting-soon',
        isCompleted: normalizedState === 'post-game' || event.state === 'completed'
    };
};

/**
 * Group events into sections based on date/status
 */
const groupEventsIntoSections = (events) => {
    const sections = {
        live: [],
        startingSoon: [],
        today: [],
        tomorrow: [],
        thisWeek: [],
        upcoming: [],
        recentResults: []
    };

    const now = new Date();
    const todayStart = startOfDay(now);

    events.forEach(event => {
        const eventDate = event.startDateTime ? parseISO(event.startDateTime) : null;

        // Live events
        if (event.isLive) {
            sections.live.push(event);
            return;
        }

        // Starting soon (within 30 minutes)
        if (event.isStartingSoon) {
            sections.startingSoon.push(event);
            return;
        }

        // Completed events (keep today's games in Today until day ends)
        if (event.isCompleted) {
            if (eventDate) {
                if (isToday(eventDate)) {
                    sections.today.push(event);
                } else {
                    const daysAgo = differenceInDays(todayStart, startOfDay(eventDate));
                    if (daysAgo >= 0 && daysAgo <= 7) {
                        sections.recentResults.push(event);
                    }
                }
            }
            return;
        }

        // Future events by date
        if (eventDate) {
            if (isToday(eventDate)) {
                sections.today.push(event);
            } else if (isTomorrow(eventDate)) {
                sections.tomorrow.push(event);
            } else {
                const daysUntil = differenceInDays(startOfDay(eventDate), todayStart);
                if (daysUntil > 0 && daysUntil <= 7) {
                    sections.thisWeek.push(event);
                } else if (daysUntil > 7) {
                    sections.upcoming.push(event);
                }
            }
        }
    });

    // Sort recent results by most recent first
    sections.recentResults.sort((a, b) => b.startTime - a.startTime);

    return sections;
};

/**
 * Build flat list data with section headers for SectionList-like rendering in FlatList
 */
const buildFlatListData = (sections) => {
    const data = [];

    const addSection = (key, title, events, icon) => {
        if (events.length > 0) {
            data.push({ type: 'header', key, title, icon, count: events.length });
            events.forEach(event => {
                data.push({ type: 'event', event, key: event.uuid || `${event.sport}-${event.startTime}` });
            });
        }
    };

    addSection('live', 'Live Now', sections.live, 'radio');
    addSection('startingSoon', 'Starting Soon', sections.startingSoon, 'time-outline');
    addSection('today', 'Today', sections.today, 'today-outline');
    addSection('tomorrow', 'Tomorrow', sections.tomorrow, 'calendar-outline');
    addSection('thisWeek', 'This Week', sections.thisWeek, 'calendar-outline');
    addSection('upcoming', 'Upcoming', sections.upcoming, 'arrow-forward-outline');
    addSection('recentResults', 'Recent Results', sections.recentResults, 'checkmark-done-outline');

    return data;
};

/**
 * Hook for managing unified data across all sports
 * @param {Object} shl - SHL data hook return value
 * @param {Object} football - Football/Allsvenskan data hook return value
 * @param {Object} svenskaCupen - Svenska Cupen data hook return value
 * @param {Object} biathlon - Biathlon data hook return value
 * @param {Object} options - Filter options
 */
export function useUnifiedData(shl, football, svenskaCupen, biathlon, options = {}) {
    const { sportFilters = ['shl', 'football', 'biathlon'] } = options;

    // List scroll ref
    const listRef = useRef(null);

    // Scroll position persistence
    const savedScrollOffset = useRef(null);
    const hasUserScrolled = useRef(false);

    // Combine and normalize all events (football = Allsvenskan + Svenska Cupen)
    const allEvents = useMemo(() => {
        const events = [];

        // Add SHL games
        if (sportFilters.includes('shl')) {
            shl.games.forEach(game => {
                events.push(normalizeEvent(game, 'shl'));
            });
        }

        // Add Football games (Allsvenskan + Svenska Cupen, preserve sport for routing)
        if (sportFilters.includes('football')) {
            football.games.forEach(game => {
                const sport = game.sport || 'allsvenskan';
                events.push(normalizeEvent(game, sport));
            });
            svenskaCupen.games.forEach(game => {
                events.push(normalizeEvent(game, 'svenska-cupen'));
            });
        }

        // Add Biathlon races
        if (sportFilters.includes('biathlon')) {
            biathlon.races.forEach(race => {
                events.push(normalizeEvent(race, 'biathlon'));
            });
        }

        // Sort all events by start time
        return events.sort((a, b) => a.startTime - b.startTime);
    }, [shl.games, football.games, svenskaCupen.games, biathlon.races, sportFilters]);

    // Group events into sections
    const sections = useMemo(() => {
        return groupEventsIntoSections(allEvents);
    }, [allEvents]);

    // Build flat list data with headers
    const flatListData = useMemo(() => {
        return buildFlatListData(sections);
    }, [sections]);

    // Calculate target scroll index (first live or first upcoming)
    const targetIndex = useMemo(() => {
        // Find first live event
        const liveIndex = flatListData.findIndex(
            item => item.type === 'event' && item.event.isLive
        );
        if (liveIndex !== -1) {
            return liveIndex;
        }

        // Find first starting soon
        const startingSoonIndex = flatListData.findIndex(
            item => item.type === 'event' && item.event.isStartingSoon
        );
        if (startingSoonIndex !== -1) {
            return startingSoonIndex;
        }

        // Find first today event
        const todayHeaderIndex = flatListData.findIndex(
            item => item.type === 'header' && item.key === 'today'
        );
        if (todayHeaderIndex !== -1) {
            return todayHeaderIndex;
        }

        // Find first tomorrow event
        const tomorrowHeaderIndex = flatListData.findIndex(
            item => item.type === 'header' && item.key === 'tomorrow'
        );
        if (tomorrowHeaderIndex !== -1) {
            return tomorrowHeaderIndex;
        }

        return 0;
    }, [flatListData]);

    // Combined loading state
    const loading = shl.loading || football.loading || svenskaCupen.loading || biathlon.loading;

    // Combined refreshing state
    const refreshing = shl.refreshing || football.refreshing || svenskaCupen.refreshing || biathlon.refreshing;

    // Unified refresh handler
    const onRefresh = useCallback(() => {
        shl.onRefresh();
        football.onRefresh();
        svenskaCupen.onRefresh();
        biathlon.onRefresh();
    }, [shl, football, svenskaCupen, biathlon]);

    // Handle scroll event to save position
    const handleScroll = useCallback((event) => {
        const offset = event.nativeEvent.contentOffset.y;
        savedScrollOffset.current = offset;
        hasUserScrolled.current = true;
    }, []);

    // Event press handler - routes to the correct sport's handler
    const handleEventPress = useCallback((event) => {
        if (event.sport === 'shl') {
            shl.handleGamePress(event);
        } else if (event.sport === 'allsvenskan' || event.sport === 'football') {
            football.handleGamePress(event);
        } else if (event.sport === 'svenska-cupen') {
            svenskaCupen.handleGamePress(event);
        } else if (event.sport === 'biathlon') {
            biathlon.handleRacePress(event);
        }
    }, [shl, football, svenskaCupen, biathlon]);

    // Stats for header display
    const stats = useMemo(() => ({
        total: allEvents.length,
        live: sections.live.length,
        today: sections.today.length,
        shlCount: allEvents.filter(e => e.sport === 'shl').length,
        footballCount: allEvents.filter(e => e.sport === 'allsvenskan' || e.sport === 'svenska-cupen' || e.sport === 'football').length,
        biathlonCount: allEvents.filter(e => e.sport === 'biathlon').length
    }), [allEvents, sections]);

    // Determine effective initial scroll index (skip if user has scrolled before)
    const effectiveInitialScrollIndex = hasUserScrolled.current ? undefined : (targetIndex > 0 ? targetIndex : undefined);

    return {
        // Data
        allEvents,
        sections,
        flatListData,
        stats,

        // State
        loading,
        refreshing,
        targetIndex,
        effectiveInitialScrollIndex,

        // Refs
        listRef,

        // Handlers
        onRefresh,
        handleScroll,
        handleEventPress
    };
}
