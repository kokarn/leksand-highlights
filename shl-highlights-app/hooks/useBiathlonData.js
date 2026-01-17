import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchBiathlonRaces, fetchBiathlonEvents, fetchBiathlonNations } from '../api/shl';

/**
 * Hook for managing Biathlon data
 */
export function useBiathlonData(activeSport, selectedNations, selectedGenders) {
    // Races state
    const [races, setRaces] = useState([]);
    const [nations, setNations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Selected race modal state
    const [selectedRace, setSelectedRace] = useState(null);

    // List scroll ref
    const listRef = useRef(null);
    const lastFocusedRaceRef = useRef(null);

    // Load biathlon data
    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [racesData, , nationsData] = await Promise.all([
                fetchBiathlonRaces(),
                fetchBiathlonEvents(),
                fetchBiathlonNations()
            ]);
            setRaces(racesData);
            setNations(nationsData);
        } catch (e) {
            console.error("Failed to load biathlon data", e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial data load
    useEffect(() => {
        if (activeSport === 'biathlon') {
            loadData();
        }
    }, [activeSport, loadData]);

    // Reset focused race ref when switching sports
    useEffect(() => {
        if (activeSport !== 'biathlon') {
            lastFocusedRaceRef.current = null;
        }
    }, [activeSport]);

    // Filtered and sorted races
    const filteredRaces = useMemo(() => {
        return races.filter(race => {
            if (selectedGenders.length > 0 && !selectedGenders.includes(race.gender)) {
                return false;
            }
            if (selectedNations.length > 0 && !selectedNations.includes(race.country)) {
                return false;
            }
            return true;
        });
    }, [races, selectedNations, selectedGenders]);

    const sortedRaces = useMemo(() => {
        return [...filteredRaces].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredRaces]);

    // Target race index for auto-scroll
    const targetRaceIndex = useMemo(() => {
        if (!sortedRaces.length) return 0;

        // Priority 1: Find live/ongoing races
        const liveIndex = sortedRaces.findIndex(race =>
            race.state === 'live' || race.state === 'ongoing'
        );
        if (liveIndex !== -1) return liveIndex;

        // Priority 2: Find first upcoming race
        const upcomingIndex = sortedRaces.findIndex(race =>
            race.state === 'upcoming' || race.state === 'pre-race'
        );
        if (upcomingIndex !== -1) {
            return upcomingIndex > 0 ? upcomingIndex - 1 : upcomingIndex;
        }

        // Priority 3: All races completed - show the most recent one
        return sortedRaces.length - 1;
    }, [sortedRaces]);

    const targetRaceId = useMemo(() => {
        return sortedRaces[targetRaceIndex]?.uuid || null;
    }, [sortedRaces, targetRaceIndex]);

    // Refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    // Race press handler
    const handleRacePress = useCallback((race) => {
        setSelectedRace(race);
    }, []);

    // Close modal handler
    const closeModal = useCallback(() => {
        setSelectedRace(null);
    }, []);

    return {
        // State
        races: sortedRaces,
        nations,
        loading,
        refreshing,
        selectedRace,
        targetRaceIndex,
        targetRaceId,

        // Refs
        listRef,
        lastFocusedRaceRef,

        // Handlers
        loadData,
        onRefresh,
        handleRacePress,
        closeModal
    };
}
