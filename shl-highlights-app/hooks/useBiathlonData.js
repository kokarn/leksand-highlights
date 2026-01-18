import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    fetchBiathlonRaces,
    fetchBiathlonEvents,
    fetchBiathlonNations,
    fetchBiathlonRaceDetails,
    fetchBiathlonStandings
} from '../api/shl';

/**
 * Hook for managing Biathlon data
 * @param {string} activeSport - Currently active sport tab
 * @param {string[]} selectedNations - Selected nation filters
 * @param {string[]} selectedGenders - Selected gender filters
 * @param {object} options - Additional options
 * @param {boolean} options.eagerLoad - Load data immediately on mount regardless of activeSport
 */
export function useBiathlonData(activeSport, selectedNations, selectedGenders, options = {}) {
    const { eagerLoad = false } = options;

    // View mode state (schedule or standings)
    const [viewMode, setViewMode] = useState('schedule');
    const [standingsType, setStandingsType] = useState('overall');
    const [standingsGender, setStandingsGender] = useState('men');

    // Races state
    const [races, setRaces] = useState([]);
    const [nations, setNations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const hasLoadedOnce = useRef(false);

    // Standings state
    const [standings, setStandings] = useState(null);
    const [loadingStandings, setLoadingStandings] = useState(false);
    const hasLoadedStandingsOnce = useRef(false);

    // Selected race modal state
    const [selectedRace, setSelectedRace] = useState(null);
    const [raceDetails, setRaceDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const detailsRequestIdRef = useRef(0);

    // List scroll ref
    const listRef = useRef(null);
    const lastFocusedRaceRef = useRef(null);

    // Load biathlon data
    const loadData = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        try {
            const [racesResult, eventsResult, nationsResult] = await Promise.allSettled([
                fetchBiathlonRaces(),
                fetchBiathlonEvents(),
                fetchBiathlonNations()
            ]);

            if (racesResult.status === 'fulfilled') {
                setRaces(racesResult.value);
            } else {
                console.error('Failed to load biathlon races', racesResult.reason);
            }

            if (nationsResult.status === 'fulfilled') {
                setNations(nationsResult.value);
            } else {
                console.error('Failed to load biathlon nations', nationsResult.reason);
            }

            if (eventsResult.status === 'rejected') {
                console.warn('Failed to load biathlon events', eventsResult.reason);
            }
        } catch (e) {
            console.error("Failed to load biathlon data", e);
        } finally {
            if (!silent) {
                setLoading(false);
            }
            setRefreshing(false);
        }
    }, []);

    // Load standings data
    const loadStandings = useCallback(async (type = standingsType) => {
        setLoadingStandings(true);
        try {
            const standingsData = await fetchBiathlonStandings({ type });
            setStandings(standingsData);
        } catch (e) {
            console.error("Failed to load biathlon standings", e);
        } finally {
            setLoadingStandings(false);
        }
    }, [standingsType]);

    // Initial data load (eager load on mount if enabled, otherwise wait for active sport)
    useEffect(() => {
        if (!hasLoadedOnce.current && (eagerLoad || activeSport === 'biathlon')) {
            hasLoadedOnce.current = true;
            loadData();
        }
    }, [activeSport, loadData, eagerLoad]);

    // Load standings when switching to standings view
    useEffect(() => {
        if (activeSport === 'biathlon' && viewMode === 'standings' && !hasLoadedStandingsOnce.current) {
            hasLoadedStandingsOnce.current = true;
            loadStandings();
        }
    }, [activeSport, viewMode, loadStandings]);

    // Handle view mode change
    const handleViewChange = useCallback((newMode) => {
        setViewMode(newMode);
        if (newMode === 'standings' && !hasLoadedStandingsOnce.current) {
            hasLoadedStandingsOnce.current = true;
            loadStandings();
        }
    }, [loadStandings]);

    // Handle standings type change (overall, sprint, pursuit, etc.)
    const handleStandingsTypeChange = useCallback((newType) => {
        setStandingsType(newType);
        loadStandings(newType);
    }, [loadStandings]);

    // Handle standings gender change (men/women)
    const handleStandingsGenderChange = useCallback((gender) => {
        setStandingsGender(gender);
    }, []);

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

        // Priority 2: Find races that are starting soon
        const startingSoonIndex = sortedRaces.findIndex(race =>
            race.state === 'starting-soon'
        );
        if (startingSoonIndex !== -1) return startingSoonIndex;

        // Priority 3: Find first upcoming race
        const upcomingIndex = sortedRaces.findIndex(race =>
            race.state === 'upcoming' || race.state === 'pre-race'
        );
        if (upcomingIndex !== -1) {
            return upcomingIndex > 0 ? upcomingIndex - 1 : upcomingIndex;
        }

        // Priority 4: All races completed - show the most recent one
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
    const handleRacePress = useCallback(async (race) => {
        if (!race) {
            return;
        }
        setSelectedRace(race);
        setRaceDetails(null);
        setLoadingDetails(true);

        const requestId = detailsRequestIdRef.current + 1;
        detailsRequestIdRef.current = requestId;
        const raceId = race.ibuRaceId || race.uuid;

        if (!raceId) {
            setLoadingDetails(false);
            return;
        }

        try {
            const details = await fetchBiathlonRaceDetails(raceId);
            if (detailsRequestIdRef.current === requestId) {
                setRaceDetails(details);
            }
        } catch (error) {
            if (detailsRequestIdRef.current === requestId) {
                console.error('Failed to load biathlon race details', error);
            }
        } finally {
            if (detailsRequestIdRef.current === requestId) {
                setLoadingDetails(false);
            }
        }
    }, []);

    // Close modal handler
    const closeModal = useCallback(() => {
        detailsRequestIdRef.current += 1;
        setSelectedRace(null);
        setRaceDetails(null);
        setLoadingDetails(false);
    }, []);

    return {
        // State
        races: sortedRaces,
        nations,
        loading,
        refreshing,
        selectedRace,
        raceDetails,
        loadingDetails,
        targetRaceIndex,
        targetRaceId,
        viewMode,
        standings,
        loadingStandings,
        standingsType,
        standingsGender,

        // Refs
        listRef,
        lastFocusedRaceRef,

        // Handlers
        loadData,
        onRefresh,
        handleRacePress,
        closeModal,
        handleViewChange,
        handleStandingsTypeChange,
        handleStandingsGenderChange
    };
}
