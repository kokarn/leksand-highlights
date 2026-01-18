import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchFootballGames, fetchFootballStandings, fetchFootballGameDetails } from '../api/shl';

const AUTO_REFRESH_INTERVAL_MS = 20000;
const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENT_START_WINDOW_MINUTES = 90;

/**
 * Hook for managing Football/Allsvenskan data
 * @param {string} activeSport - Currently active sport tab
 * @param {string[]} selectedFootballTeams - Selected team filters
 * @param {object} options - Additional options
 * @param {boolean} options.eagerLoad - Load data immediately on mount regardless of activeSport
 */
export function useFootballData(activeSport, selectedFootballTeams, options = {}) {
    const { eagerLoad = false } = options;

    // Games state
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const hasLoadedOnce = useRef(false);

    // Standings state
    const [standings, setStandings] = useState(null);
    const [loadingStandings, setLoadingStandings] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState(null);

    // View mode
    const [viewMode, setViewMode] = useState('schedule');

    // Selected game modal state
    const [selectedGame, setSelectedGame] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // List scroll ref
    const listRef = useRef(null);
    const lastFocusedGameRef = useRef(null);

    // Get team key helper
    const getTeamKey = useCallback((team) => {
        return team?.code || team?.uuid || team?.names?.short || team?.names?.long || null;
    }, []);

    const getStandingsTeamKey = useCallback((team) => {
        return team?.teamCode || team?.teamUuid || team?.teamName || team?.teamShortName || null;
    }, []);

    // Check if auto-refresh should be enabled
    const shouldAutoRefreshGames = useCallback((gamesList) => {
        const now = Date.now();
        return gamesList.some(game => {
            if (game.state === 'live') return true;
            if (game.state === 'post-game') return false;
            const startTime = new Date(game.startDateTime).getTime();
            if (Number.isNaN(startTime)) return false;
            const minutesFromStart = (startTime - now) / (1000 * 60);
            return minutesFromStart <= STARTING_SOON_WINDOW_MINUTES
                && minutesFromStart >= -RECENT_START_WINDOW_MINUTES;
        });
    }, []);

    // Load games
    const loadGames = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await fetchFootballGames();
            setGames(data);
        } catch (e) {
            console.error("Failed to load football games", e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Load standings
    const loadStandings = useCallback(async (silent = false, seasonOverride) => {
        if (!silent) setLoadingStandings(true);
        try {
            const season = seasonOverride ?? selectedSeason;
            const data = await fetchFootballStandings(season ? { season } : {});
            setStandings(data);

            const resolvedSeason = data?.season ? String(data.season) : null;
            const availableSeasons = Array.isArray(data?.availableSeasons)
                ? data.availableSeasons.map(value => String(value))
                : [];
            const normalizedSeasons = resolvedSeason && !availableSeasons.includes(resolvedSeason)
                ? [resolvedSeason, ...availableSeasons]
                : availableSeasons;

            if (!selectedSeason && resolvedSeason) {
                setSelectedSeason(resolvedSeason);
            }

            if (selectedSeason && resolvedSeason && !normalizedSeasons.includes(String(selectedSeason))) {
                setSelectedSeason(resolvedSeason);
            }
        } catch (e) {
            console.error("Failed to load football standings", e);
        } finally {
            if (!silent) setLoadingStandings(false);
            setRefreshing(false);
        }
    }, [selectedSeason]);

    // Initial data load (eager load on mount if enabled, otherwise wait for active sport)
    useEffect(() => {
        if (!hasLoadedOnce.current && (eagerLoad || activeSport === 'football')) {
            hasLoadedOnce.current = true;
            loadGames();
        }
    }, [activeSport, loadGames, eagerLoad]);

    // Load standings when view mode changes
    useEffect(() => {
        if (activeSport !== 'football') return;
        if (viewMode !== 'standings') return;
        loadStandings();
    }, [activeSport, viewMode, loadStandings]);

    // Auto-refresh for live games
    useEffect(() => {
        if (activeSport !== 'football') return;
        const shouldAutoRefresh = shouldAutoRefreshGames(games);
        if (!shouldAutoRefresh) return;

        const intervalId = setInterval(() => {
            console.log('Auto-refreshing live or starting-soon football matches...');
            loadGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [games, activeSport, shouldAutoRefreshGames, loadGames]);

    // Reset focused game ref when switching sports
    useEffect(() => {
        if (activeSport !== 'football') {
            lastFocusedGameRef.current = null;
        }
    }, [activeSport]);

    // Derived teams list
    const teams = useMemo(() => {
        const teamMap = new Map();
        games.forEach(game => {
            [game.homeTeamInfo, game.awayTeamInfo].forEach(team => {
                const key = getTeamKey(team);
                if (!key || teamMap.has(key)) return;
                const name = team?.names?.short || team?.names?.long || team?.code || key;
                teamMap.set(key, {
                    key,
                    name,
                    icon: team?.icon || null
                });
            });
        });
        return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [games, getTeamKey]);

    // Season options
    const seasonOptions = useMemo(() => {
        const seasons = Array.isArray(standings?.availableSeasons)
            ? standings.availableSeasons.map(value => String(value))
            : [];
        const currentSeason = standings?.season ? String(standings.season) : null;
        if (currentSeason && !seasons.includes(currentSeason)) {
            seasons.unshift(currentSeason);
        }
        const unique = Array.from(new Set(seasons));
        return unique.sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
                return numB - numA;
            }
            return b.localeCompare(a);
        });
    }, [standings]);

    const activeSeason = selectedSeason
        || standings?.season
        || seasonOptions[0]
        || null;

    // Filtered and sorted games
    const filteredGames = useMemo(() => {
        return games.filter(game => {
            if (selectedFootballTeams.length > 0) {
                const homeKey = getTeamKey(game.homeTeamInfo);
                const awayKey = getTeamKey(game.awayTeamInfo);
                if (!selectedFootballTeams.includes(homeKey) && !selectedFootballTeams.includes(awayKey)) {
                    return false;
                }
            }
            return true;
        });
    }, [games, selectedFootballTeams, getTeamKey]);

    const sortedGames = useMemo(() => {
        return [...filteredGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredGames]);

    // Target game index for auto-scroll
    const targetGameIndex = useMemo(() => {
        if (!sortedGames.length) return 0;

        const liveIndex = sortedGames.findIndex(game => game.state === 'live');
        if (liveIndex !== -1) return liveIndex;

        const upcomingIndex = sortedGames.findIndex(game => game.state !== 'post-game');
        if (upcomingIndex !== -1) return upcomingIndex;

        return sortedGames.length - 1;
    }, [sortedGames]);

    const targetGameId = useMemo(() => {
        return sortedGames[targetGameIndex]?.uuid || null;
    }, [sortedGames, targetGameIndex]);

    // View mode handler
    const handleViewChange = useCallback((nextView) => {
        if (nextView === viewMode) return;
        setViewMode(nextView);
    }, [viewMode]);

    // Season select handler
    const handleSeasonSelect = useCallback((season) => {
        if (!season || season === selectedSeason) return;
        setSelectedSeason(season);
        loadStandings(false, season);
    }, [selectedSeason, loadStandings]);

    // Refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (viewMode === 'standings') {
            loadStandings();
        } else {
            loadGames();
        }
    }, [viewMode, loadGames, loadStandings]);

    // Game press handler
    const handleGamePress = useCallback(async (game) => {
        setSelectedGame(game);
        setLoadingDetails(true);
        setGameDetails(null);
        try {
            const details = await fetchFootballGameDetails(game.uuid);
            setGameDetails(details);
        } catch (error) {
            console.error('Failed to load football match details', error);
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    // Close modal handler
    const closeModal = useCallback(() => {
        setSelectedGame(null);
        setGameDetails(null);
        setLoadingDetails(false);
    }, []);

    return {
        // State
        games: sortedGames,
        loading,
        refreshing,
        standings,
        loadingStandings,
        viewMode,
        selectedGame,
        gameDetails,
        loadingDetails,
        teams,
        seasonOptions,
        activeSeason,
        targetGameIndex,
        targetGameId,

        // Refs
        listRef,
        lastFocusedGameRef,

        // Helpers
        getTeamKey,
        getStandingsTeamKey,

        // Handlers
        loadGames,
        loadStandings,
        handleViewChange,
        handleSeasonSelect,
        onRefresh,
        handleGamePress,
        closeModal
    };
}
