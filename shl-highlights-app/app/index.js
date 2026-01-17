import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Image, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { isToday, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

// API
import {
    fetchGames, fetchVideosForGame, fetchGameDetails, fetchVideoDetails, getTeamLogoUrl,
    fetchBiathlonRaces, fetchBiathlonEvents, fetchBiathlonNations,
    fetchFootballGames, fetchFootballGameDetails
} from '../api/shl';

// Constants
import { STORAGE_KEYS, GENDER_OPTIONS, getTeamColor } from '../constants';

// Utils
import { getVideoDisplayTitle, getStayLiveVideoId, normalizeScoreValue } from '../utils';

// Components
import { SportTab } from '../components/SportTab';
import { StatBar } from '../components/StatBar';
import { TabButton } from '../components/TabButton';
import { GameCard, FootballGameCard, BiathlonRaceCard, VideoCard } from '../components/cards';
import { GoalItem, PenaltyItem, GoalkeeperItem, TimeoutItem, PeriodMarker } from '../components/events';
import { RaceModal, FootballMatchModal, SettingsModal, OnboardingModal } from '../components/modals';

export default function App() {
    // Onboarding & Settings state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    // Sport selection
    const [activeSport, setActiveSport] = useState('shl');

    // SHL state
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedGame, setSelectedGame] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loadingModal, setLoadingModal] = useState(false);
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [playingVideoId, setPlayingVideoId] = useState(null);
    const [playingVideoDetails, setPlayingVideoDetails] = useState(null);
    const [loadingVideoDetails, setLoadingVideoDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');
    const shlListRef = useRef(null);
    const footballListRef = useRef(null);
    const lastFocusedGameRef = useRef(null);
    const lastFocusedFootballRef = useRef(null);
    const AUTO_REFRESH_INTERVAL_MS = 20000;
    const STARTING_SOON_WINDOW_MINUTES = 30;
    const RECENT_START_WINDOW_MINUTES = 90;

    // Biathlon state
    const [biathlonRaces, setBiathlonRaces] = useState([]);
    const [biathlonNations, setBiathlonNations] = useState([]);
    const [loadingBiathlon, setLoadingBiathlon] = useState(false);
    const [selectedNations, setSelectedNations] = useState([]);
    const [selectedGenders, setSelectedGenders] = useState([]);
    const [selectedRace, setSelectedRace] = useState(null);

    // Football state
    const [footballGames, setFootballGames] = useState([]);
    const [loadingFootball, setLoadingFootball] = useState(false);
    const [selectedFootballGame, setSelectedFootballGame] = useState(null);
    const [footballDetails, setFootballDetails] = useState(null);
    const [loadingFootballDetails, setLoadingFootballDetails] = useState(false);
    const [selectedFootballTeams, setSelectedFootballTeams] = useState([]);

    // Load saved preferences on app start
    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const [
                savedSport,
                savedTeams,
                savedNations,
                savedGenders,
                savedFootballTeams,
                onboardingComplete
            ] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SPORT),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_NATIONS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_GENDERS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS),
                AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE)
            ]);

            if (savedSport) setActiveSport(savedSport);
            if (savedTeams) setSelectedTeams(JSON.parse(savedTeams));
            if (savedNations) setSelectedNations(JSON.parse(savedNations));
            if (savedGenders) setSelectedGenders(JSON.parse(savedGenders));
            if (savedFootballTeams) setSelectedFootballTeams(JSON.parse(savedFootballTeams));

            if (!onboardingComplete) {
                setShowOnboarding(true);
            }
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
    };

    const savePreference = async (key, value) => {
        try {
            await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
            console.error('Error saving preference:', e);
        }
    };

    // Process game details into usable format
    const processedGameData = useMemo(() => {
        if (!gameDetails || !selectedGame) return null;

        let sog = { home: 0, away: 0 };
        let pp = { home: '-', away: '-' };
        let pim = { home: 0, away: 0 };
        let actualScore = { home: null, away: null };

        const statsArray = gameDetails.teamStats?.stats || [];
        statsArray.forEach(stat => {
            const key = stat.homeTeam?.sideTranslateKey || stat.awayTeam?.sideTranslateKey;
            if (key === 'G') {
                actualScore.home = stat.homeTeam?.left?.value;
                actualScore.away = stat.awayTeam?.left?.value;
                sog.home = stat.homeTeam?.right?.value;
                sog.away = stat.awayTeam?.right?.value;
            } else if (key === 'PPG') {
                pp.home = stat.homeTeam?.center?.value !== undefined ? `${stat.homeTeam.center.value}%` : '-';
                pp.away = stat.awayTeam?.center?.value !== undefined ? `${stat.awayTeam.center.value}%` : '-';
            } else if (key === 'PIM') {
                pim.home = stat.homeTeam?.center?.value ?? 0;
                pim.away = stat.awayTeam?.center?.value ?? 0;
            }
        });

        const detailHomeScore = normalizeScoreValue(gameDetails.info?.homeTeam?.score);
        const detailAwayScore = normalizeScoreValue(gameDetails.info?.awayTeam?.score);
        const fallbackHomeScore = normalizeScoreValue(selectedGame.homeTeamResult?.score) ?? normalizeScoreValue(selectedGame.homeTeamInfo?.score);
        const fallbackAwayScore = normalizeScoreValue(selectedGame.awayTeamResult?.score) ?? normalizeScoreValue(selectedGame.awayTeamInfo?.score);
        const scoreDisplay = {
            home: actualScore.home ?? detailHomeScore ?? fallbackHomeScore ?? '-',
            away: actualScore.away ?? detailAwayScore ?? fallbackAwayScore ?? '-'
        };

        const interestingEvents = [];
        let currentPeriod = -1;
        const allEvents = gameDetails.events?.all || [];
        const sortedEvents = [...allEvents]
            .filter(e => {
                if (e.type === 'goal' || e.type === 'penalty' || e.type === 'timeout') return true;
                if (e.type === 'goalkeeper') {
                    if (e.isEntering && e.period === 1 && e.time === '00:00') return false;
                    if (!e.isEntering && e.gameState === 'GameEnded') return false;
                    return true;
                }
                return false;
            })
            .sort((a, b) => b.period - a.period || (b.time > a.time ? 1 : -1));

        sortedEvents.forEach(event => {
            if (event.period !== currentPeriod) {
                currentPeriod = event.period;
                interestingEvents.push({ type: 'period_marker', period: currentPeriod });
            }
            interestingEvents.push(event);
        });

        return { sog, pp, pim, scoreDisplay, events: interestingEvents };
    }, [gameDetails, selectedGame]);

    // Load data based on active sport
    useEffect(() => {
        if (activeSport === 'shl') {
            loadGames();
        } else if (activeSport === 'biathlon') {
            loadBiathlonData();
        } else if (activeSport === 'football') {
            loadFootballGames();
        }
    }, [activeSport]);

    const shouldAutoRefreshGames = (gamesList) => {
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
    };

    // Auto-refresh for live or starting-soon games
    useEffect(() => {
        if (activeSport !== 'shl') return;
        const shouldAutoRefresh = shouldAutoRefreshGames(games);
        if (!shouldAutoRefresh) return;
        const intervalId = setInterval(() => {
            console.log('Auto-refreshing live or starting-soon games...');
            loadGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [games, activeSport]);

    useEffect(() => {
        if (activeSport !== 'football') return;
        const shouldAutoRefresh = shouldAutoRefreshGames(footballGames);
        if (!shouldAutoRefresh) return;
        const intervalId = setInterval(() => {
            console.log('Auto-refreshing live or starting-soon football matches...');
            loadFootballGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [footballGames, activeSport]);

    const loadGames = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await fetchGames();
            setGames(data);
        } catch (e) {
            console.error("Failed to load games", e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    };

    const loadBiathlonData = async (silent = false) => {
        if (!silent) setLoadingBiathlon(true);
        try {
            const [races, , nations] = await Promise.all([
                fetchBiathlonRaces(),
                fetchBiathlonEvents(),
                fetchBiathlonNations()
            ]);
            setBiathlonRaces(races);
            setBiathlonNations(nations);
        } catch (e) {
            console.error("Failed to load biathlon data", e);
        } finally {
            if (!silent) setLoadingBiathlon(false);
            setRefreshing(false);
        }
    };

    const loadFootballGames = async (silent = false) => {
        if (!silent) setLoadingFootball(true);
        try {
            const data = await fetchFootballGames();
            setFootballGames(data);
        } catch (e) {
            console.error("Failed to load football games", e);
        } finally {
            if (!silent) setLoadingFootball(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (activeSport === 'shl') {
            loadGames();
        } else if (activeSport === 'biathlon') {
            loadBiathlonData();
        } else if (activeSport === 'football') {
            loadFootballGames();
        }
    };

    const handleSportChange = (sport) => {
        setActiveSport(sport);
        savePreference(STORAGE_KEYS.SELECTED_SPORT, sport);
    };

    const toggleTeamFilter = useCallback((teamCode) => {
        const newSelected = selectedTeams.includes(teamCode)
            ? selectedTeams.filter(t => t !== teamCode)
            : [...selectedTeams, teamCode];
        setSelectedTeams(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_TEAMS, newSelected);
    }, [selectedTeams]);

    const clearTeamFilter = useCallback(() => {
        setSelectedTeams([]);
        savePreference(STORAGE_KEYS.SELECTED_TEAMS, []);
    }, []);

    const toggleFootballTeamFilter = useCallback((teamKey) => {
        const newSelected = selectedFootballTeams.includes(teamKey)
            ? selectedFootballTeams.filter(t => t !== teamKey)
            : [...selectedFootballTeams, teamKey];
        setSelectedFootballTeams(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS, newSelected);
    }, [selectedFootballTeams]);

    const clearFootballTeamFilter = useCallback(() => {
        setSelectedFootballTeams([]);
        savePreference(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS, []);
    }, []);

    const toggleNationFilter = useCallback((nationCode) => {
        const newSelected = selectedNations.includes(nationCode)
            ? selectedNations.filter(n => n !== nationCode)
            : [...selectedNations, nationCode];
        setSelectedNations(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, newSelected);
    }, [selectedNations]);

    const clearNationFilter = useCallback(() => {
        setSelectedNations([]);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, []);
    }, []);

    const toggleGenderFilter = useCallback((gender) => {
        const newSelected = selectedGenders.includes(gender)
            ? selectedGenders.filter(g => g !== gender)
            : [...selectedGenders, gender];
        setSelectedGenders(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_GENDERS, newSelected);
    }, [selectedGenders]);

    const clearGenderFilter = useCallback(() => {
        setSelectedGenders([]);
        savePreference(STORAGE_KEYS.SELECTED_GENDERS, []);
    }, []);

    const completeOnboarding = async () => {
        await savePreference(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        setShowOnboarding(false);
        setOnboardingStep(0);
    };

    const resetOnboarding = async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
        setOnboardingStep(0);
        setShowOnboarding(true);
        setShowSettings(false);
    };

    // Video playback
    const playVideo = async (video) => {
        const stayLiveId = getStayLiveVideoId(video);
        if (!stayLiveId) {
            console.warn('Could not extract StayLive video ID');
            return;
        }

        setPlayingVideoId(video.id);
        setLoadingVideoDetails(true);
        setPlayingVideoDetails(null);

        try {
            const details = await fetchVideoDetails(stayLiveId);
            setPlayingVideoDetails(details);
        } catch (e) {
            console.error('Failed to fetch video details:', e);
        } finally {
            setLoadingVideoDetails(false);
        }
    };

    const stopVideo = () => {
        setPlayingVideoId(null);
        setPlayingVideoDetails(null);
        setLoadingVideoDetails(false);
    };

    const handleTabChange = (tab) => {
        if (activeTab === 'highlights' && tab !== 'highlights') {
            stopVideo();
        }
        setActiveTab(tab);
    };

    const getFootballTeamKey = useCallback((team) => {
        return team?.code || team?.uuid || team?.names?.short || team?.names?.long || null;
    }, []);

    // Derived data
    const teams = useMemo(() => {
        const teamCodes = new Set();
        games.forEach(g => {
            if (g.homeTeamInfo?.code) teamCodes.add(g.homeTeamInfo.code);
            if (g.awayTeamInfo?.code) teamCodes.add(g.awayTeamInfo.code);
        });
        return Array.from(teamCodes)
            .map(code => ({ code }))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [games]);

    const footballTeams = useMemo(() => {
        const teamMap = new Map();
        footballGames.forEach(game => {
            [game.homeTeamInfo, game.awayTeamInfo].forEach(team => {
                const key = getFootballTeamKey(team);
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
    }, [footballGames, getFootballTeamKey]);

    const filteredGames = useMemo(() => {
        return games.filter(game => {
            if (selectedTeams.length > 0) {
                const homeCode = game.homeTeamInfo?.code;
                const awayCode = game.awayTeamInfo?.code;
                if (!selectedTeams.includes(homeCode) && !selectedTeams.includes(awayCode)) {
                    return false;
                }
            }
            return true;
        });
    }, [games, selectedTeams]);

    const filteredFootballGames = useMemo(() => {
        return footballGames.filter(game => {
            if (selectedFootballTeams.length > 0) {
                const homeKey = getFootballTeamKey(game.homeTeamInfo);
                const awayKey = getFootballTeamKey(game.awayTeamInfo);
                if (!selectedFootballTeams.includes(homeKey) && !selectedFootballTeams.includes(awayKey)) {
                    return false;
                }
            }
            return true;
        });
    }, [footballGames, selectedFootballTeams, getFootballTeamKey]);

    const sortedGames = useMemo(() => {
        return [...filteredGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredGames]);

    const sortedFootballGames = useMemo(() => {
        return [...filteredFootballGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredFootballGames]);

    const nextGameIndex = useMemo(() => {
        if (!sortedGames.length) return 0;
        const upcomingIndex = sortedGames.findIndex(game => game.state !== 'post-game');
        if (upcomingIndex !== -1) return upcomingIndex;
        return sortedGames.length - 1;
    }, [sortedGames]);

    const currentDateIndex = useMemo(() => {
        if (!sortedGames.length) return 0;
        return sortedGames.findIndex(game => {
            if (!game?.startDateTime) return false;
            try {
                const parsed = parseISO(game.startDateTime);
                if (Number.isNaN(parsed.getTime())) return false;
                return isToday(parsed);
            } catch (error) {
                return false;
            }
        });
    }, [sortedGames]);

    const targetGameIndex = useMemo(() => {
        return currentDateIndex !== -1 ? currentDateIndex : nextGameIndex;
    }, [currentDateIndex, nextGameIndex]);

    const targetGameId = useMemo(() => {
        return sortedGames[targetGameIndex]?.uuid || null;
    }, [sortedGames, targetGameIndex]);

    const footballNextGameIndex = useMemo(() => {
        if (!sortedFootballGames.length) return 0;
        const upcomingIndex = sortedFootballGames.findIndex(game => game.state !== 'post-game');
        if (upcomingIndex !== -1) return upcomingIndex;
        return sortedFootballGames.length - 1;
    }, [sortedFootballGames]);

    const footballCurrentDateIndex = useMemo(() => {
        if (!sortedFootballGames.length) return 0;
        return sortedFootballGames.findIndex(game => {
            if (!game?.startDateTime) return false;
            try {
                const parsed = parseISO(game.startDateTime);
                if (Number.isNaN(parsed.getTime())) return false;
                return isToday(parsed);
            } catch (error) {
                return false;
            }
        });
    }, [sortedFootballGames]);

    const footballTargetGameIndex = useMemo(() => {
        return footballCurrentDateIndex !== -1 ? footballCurrentDateIndex : footballNextGameIndex;
    }, [footballCurrentDateIndex, footballNextGameIndex]);

    const footballTargetGameId = useMemo(() => {
        return sortedFootballGames[footballTargetGameIndex]?.uuid || null;
    }, [sortedFootballGames, footballTargetGameIndex]);

    const handleScrollToIndexFailed = useCallback((info) => {
        const offset = info.averageItemLength * info.index;
        setTimeout(() => {
            shlListRef.current?.scrollToOffset({ offset, animated: false });
        }, 50);
    }, []);

    const handleFootballScrollToIndexFailed = useCallback((info) => {
        const offset = info.averageItemLength * info.index;
        setTimeout(() => {
            footballListRef.current?.scrollToOffset({ offset, animated: false });
        }, 50);
    }, []);

    useEffect(() => {
        if (activeSport !== 'shl') {
            lastFocusedGameRef.current = null;
        }
        if (activeSport !== 'football') {
            lastFocusedFootballRef.current = null;
        }
    }, [activeSport]);

    useEffect(() => {
        if (activeSport !== 'shl' || !sortedGames.length || !targetGameId) return;
        if (lastFocusedGameRef.current === targetGameId) return;

        const timeoutId = setTimeout(() => {
            shlListRef.current?.scrollToIndex({ index: targetGameIndex, animated: false });
        }, 0);

        lastFocusedGameRef.current = targetGameId;
        return () => clearTimeout(timeoutId);
    }, [activeSport, sortedGames.length, targetGameId, targetGameIndex]);

    useEffect(() => {
        if (activeSport !== 'football' || !sortedFootballGames.length || !footballTargetGameId) return;
        if (lastFocusedFootballRef.current === footballTargetGameId) return;

        const timeoutId = setTimeout(() => {
            footballListRef.current?.scrollToIndex({ index: footballTargetGameIndex, animated: false });
        }, 0);

        lastFocusedFootballRef.current = footballTargetGameId;
        return () => clearTimeout(timeoutId);
    }, [activeSport, sortedFootballGames.length, footballTargetGameId, footballTargetGameIndex]);

    const filteredBiathlonRaces = useMemo(() => {
        return biathlonRaces.filter(race => {
            if (selectedGenders.length > 0 && !selectedGenders.includes(race.gender)) {
                return false;
            }
            if (selectedNations.length > 0 && !selectedNations.includes(race.country)) {
                return false;
            }
            return true;
        });
    }, [biathlonRaces, selectedNations, selectedGenders]);

    const sortedBiathlonRaces = useMemo(() => {
        return [...filteredBiathlonRaces].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredBiathlonRaces]);

    const handleGamePress = async (game) => {
        setSelectedGame(game);
        setLoadingModal(true);
        setActiveTab('summary');
        setPlayingVideoId(null);

        const [details, vids] = await Promise.all([
            fetchGameDetails(game.uuid),
            fetchVideosForGame(game.uuid)
        ]);

        setGameDetails(details);

        const sortedVids = vids.sort((a, b) => {
            const aHigh = a.tags && a.tags.includes('custom.highlights');
            const bHigh = b.tags && b.tags.includes('custom.highlights');
            if (aHigh && !bHigh) return -1;
            if (!aHigh && bHigh) return 1;
            return 0;
        });
        setVideos(sortedVids);
        setLoadingModal(false);
    };

    const handleFootballGamePress = async (game) => {
        setSelectedFootballGame(game);
        setLoadingFootballDetails(true);
        setFootballDetails(null);
        try {
            const details = await fetchFootballGameDetails(game.uuid);
            setFootballDetails(details);
        } catch (error) {
            console.error('Failed to load football match details', error);
        } finally {
            setLoadingFootballDetails(false);
        }
    };

    const closeModal = () => {
        stopVideo();
        setSelectedGame(null);
        setGameDetails(null);
        setVideos([]);
    };

    const closeFootballModal = () => {
        setSelectedFootballGame(null);
        setFootballDetails(null);
        setLoadingFootballDetails(false);
    };

    // Helper to check if a goal has an associated video clip
    const getGoalVideoId = (goal) => {
        const homeGoals = goal.homeGoals;
        const awayGoals = goal.awayGoals;
        if (homeGoals === undefined || awayGoals === undefined) return null;
        const scoreTag = `goal.${homeGoals}-${awayGoals}`;
        const matchingVideo = videos.find(v => v.tags?.includes(scoreTag));
        if (matchingVideo) return matchingVideo.id;
        const playerLast = goal.player?.familyName || goal.player?.lastName || '';
        const ln = typeof playerLast === 'string' ? playerLast.toLowerCase() : (playerLast?.value || '').toLowerCase();
        if (ln.length > 2) {
            const titleMatch = videos.find(v => v.title?.toLowerCase()?.includes(ln));
            if (titleMatch) return titleMatch.id;
        }
        return null;
    };

    // Render functions
    const renderSportTabs = () => (
        <View style={styles.sportTabsContainer}>
            <SportTab sport="shl" isActive={activeSport === 'shl'} onPress={() => handleSportChange('shl')} />
            <SportTab sport="football" isActive={activeSport === 'football'} onPress={() => handleSportChange('football')} />
            <SportTab sport="biathlon" isActive={activeSport === 'biathlon'} onPress={() => handleSportChange('biathlon')} />
        </View>
    );

    const renderBiathlonSchedule = () => (
        <FlatList
            data={sortedBiathlonRaces}
            renderItem={({ item }) => <BiathlonRaceCard race={item} onPress={() => setSelectedRace(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No races found.</Text>
                </View>
            }
            ListHeaderComponent={
                <View style={styles.scheduleHeader}>
                    <Ionicons name="calendar-outline" size={20} color="#0A84FF" />
                    <Text style={styles.scheduleHeaderText}>All Races</Text>
                    <Text style={styles.scheduleCount}>{sortedBiathlonRaces.length} races</Text>
                </View>
            }
        />
    );

    const renderFootballSchedule = () => (
        <FlatList
            ref={footballListRef}
            data={sortedFootballGames}
            renderItem={({ item }) => <FootballGameCard game={item} onPress={() => handleFootballGamePress(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            onScrollToIndexFailed={handleFootballScrollToIndexFailed}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No matches found.</Text>
                </View>
            }
            ListHeaderComponent={
                <View style={styles.scheduleHeader}>
                    <Ionicons name="football-outline" size={20} color="#0A84FF" />
                    <Text style={styles.scheduleHeaderText}>Allsvenskan</Text>
                    <Text style={styles.scheduleCount}>{sortedFootballGames.length} matches</Text>
                </View>
            }
        />
    );

    // Tab content renderers
    const renderSummaryTab = () => {
        if (!gameDetails || !processedGameData) return <Text style={styles.emptyText}>No data available</Text>;

        const { sog, pp, pim } = processedGameData;
        const goals = gameDetails.events?.goals || [];
        const homeCode = selectedGame?.homeTeamInfo?.code;
        const homeColor = getTeamColor(homeCode);
        const awayColor = getTeamColor(selectedGame?.awayTeamInfo?.code);

        return (
            <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Team Stats</Text>
                    <StatBar label="Shots" homeValue={sog.home} awayValue={sog.away} homeColor={homeColor} awayColor={awayColor} />
                    <StatBar label="Power Play %" homeValue={pp.home} awayValue={pp.away} homeColor={homeColor} awayColor={awayColor} />
                    <StatBar label="Penalty Min" homeValue={pim.home} awayValue={pim.away} homeColor={homeColor} awayColor={awayColor} />
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Goals</Text>
                    {goals.length === 0 ? (
                        <Text style={styles.emptyText}>No goals scored</Text>
                    ) : (
                        goals.map((goal, idx) => {
                            const videoId = getGoalVideoId(goal);
                            return (
                                <GoalItem
                                    key={idx}
                                    goal={goal}
                                    homeTeamCode={homeCode}
                                    hasVideo={!!videoId}
                                    onVideoPress={() => {
                                        if (videoId) {
                                            setActiveTab('highlights');
                                            playVideo(videos.find(v => v.id === videoId));
                                        }
                                    }}
                                />
                            );
                        })
                    )}
                </View>
            </ScrollView>
        );
    };

    const renderEventsTab = () => {
        if (!gameDetails || !processedGameData) return <Text style={styles.emptyText}>No data available</Text>;

        const { events } = processedGameData;
        const homeCode = selectedGame?.homeTeamInfo?.code;

        return (
            <FlatList
                data={events}
                keyExtractor={(item, idx) => `${item.type}-${idx}`}
                contentContainerStyle={styles.tabContent}
                renderItem={({ item }) => {
                    if (item.type === 'period_marker') {
                        return <PeriodMarker period={item.period} />;
                    }
                    if (item.type === 'goal') {
                        const videoId = getGoalVideoId(item);
                        return (
                            <GoalItem
                                goal={item}
                                homeTeamCode={homeCode}
                                hasVideo={!!videoId}
                                onVideoPress={() => {
                                    setActiveTab('highlights');
                                    setPlayingVideoId(videoId);
                                }}
                            />
                        );
                    }
                    if (item.type === 'penalty') {
                        return <PenaltyItem penalty={item} />;
                    }
                    if (item.type === 'goalkeeper') {
                        return <GoalkeeperItem event={item} />;
                    }
                    if (item.type === 'timeout') {
                        return <TimeoutItem event={item} />;
                    }
                    return null;
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No events available</Text>}
            />
        );
    };

    const currentlyPlayingVideo = videos.find(v => v.id === playingVideoId);

    const renderHighlightsTab = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.highlightsTitleBox}>
                <View style={styles.highlightsTitleHeader}>
                    <Ionicons name="videocam" size={20} color="#0A84FF" />
                    <Text style={styles.highlightsTitleLabel}>Match Highlights</Text>
                </View>
                {currentlyPlayingVideo ? (
                    <View style={styles.nowPlayingBox}>
                        <Text style={styles.nowPlayingLabel}>Now Playing</Text>
                        <Text style={styles.nowPlayingTitle} numberOfLines={2}>{getVideoDisplayTitle(currentlyPlayingVideo)}</Text>
                    </View>
                ) : (
                    <Text style={styles.highlightsSubtitle}>
                        {videos.length} {videos.length === 1 ? 'clip' : 'clips'} available
                    </Text>
                )}
            </View>

            {currentlyPlayingVideo && (
                <View style={styles.activePlayerContainer}>
                    <View style={styles.activePlayer}>
                        {loadingVideoDetails ? (
                            <View style={styles.videoLoadingContainer}>
                                <ActivityIndicator size="large" color="#0A84FF" />
                                <Text style={styles.videoLoadingText}>Loading stream...</Text>
                            </View>
                        ) : playingVideoDetails?.streams?.hls && Platform.OS === 'web' ? (
                            <video
                                src={playingVideoDetails.streams.hls}
                                controls
                                autoPlay
                                style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                            />
                        ) : Platform.OS === 'web' ? (
                            <iframe
                                src={playingVideoDetails?.streams?.embed || currentlyPlayingVideo.renderedMedia?.videourl}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                allow="autoplay; fullscreen"
                                allowFullScreen
                            />
                        ) : playingVideoDetails?.streams?.hls || playingVideoDetails?.streams?.embed || currentlyPlayingVideo.renderedMedia?.videourl ? (
                            <WebView
                                key={playingVideoId}
                                source={{ uri: playingVideoDetails?.streams?.hls || playingVideoDetails?.streams?.embed || currentlyPlayingVideo.renderedMedia?.videourl }}
                                style={{ flex: 1, backgroundColor: 'transparent' }}
                                allowsInlineMediaPlayback
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                            />
                        ) : (
                            <View style={styles.videoLoadingContainer}>
                                <Text style={styles.videoLoadingText}>Video unavailable</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.activePlayerInfo}>
                        <Text style={styles.activePlayerTitle}>{getVideoDisplayTitle(currentlyPlayingVideo)}</Text>
                        <TouchableOpacity onPress={stopVideo} style={styles.closePlayerButton}>
                            <Ionicons name="close-circle" size={28} color="#ff453a" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <FlatList
                data={videos}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.videoGridRow}
                contentContainerStyle={styles.videoList}
                renderItem={({ item }) => (
                    <VideoCard
                        video={item}
                        isPlaying={playingVideoId === item.id}
                        onPress={() => playVideo(item)}
                    />
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No videos available yet.</Text>}
            />
        </View>
    );

    // Main render
    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <LinearGradient colors={['#000000', '#121212']} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <View style={styles.header}>
                {renderSportTabs()}
                <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
                    <Ionicons name="settings-outline" size={24} color="#888" />
                </TouchableOpacity>
            </View>

            {/* Sport-specific content */}
            {activeSport === 'shl' ? (
                <>
                    {loading ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            ref={shlListRef}
                            data={sortedGames}
                            renderItem={({ item }) => <GameCard game={item} onPress={() => handleGamePress(item)} />}
                            keyExtractor={item => item.uuid}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                            onScrollToIndexFailed={handleScrollToIndexFailed}
                            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No games found.</Text></View>}
                        />
                    )}
                </>
            ) : activeSport === 'football' ? (
                <>
                    {loadingFootball ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        renderFootballSchedule()
                    )}
                </>
            ) : (
                <>
                    {loadingBiathlon ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        renderBiathlonSchedule()
                    )}
                </>
            )}

            {/* SHL Game Modal */}
            <Modal visible={!!selectedGame} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
                <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                    {selectedGame && (
                        <>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                                <View style={styles.scoreHeader}>
                                    <View style={styles.scoreTeam}>
                                        <Image source={{ uri: getTeamLogoUrl(selectedGame.homeTeamInfo.code) }} style={styles.scoreTeamLogo} resizeMode="contain" />
                                        <Text style={styles.scoreTeamCode}>{selectedGame.homeTeamInfo.code}</Text>
                                    </View>
                                    <View style={styles.scoreCenterBlock}>
                                        <Text style={styles.scoreLarge}>
                                            {processedGameData ?
                                                `${processedGameData.scoreDisplay.home} - ${processedGameData.scoreDisplay.away}` :
                                                `${selectedGame.homeTeamResult?.score ?? '-'} - ${selectedGame.awayTeamResult?.score ?? '-'}`
                                            }
                                        </Text>
                                        <Text style={styles.gameStateText}>
                                            {selectedGame.state === 'post-game' ? 'Final' : selectedGame.state}
                                        </Text>
                                    </View>
                                    <View style={styles.scoreTeam}>
                                        <Image source={{ uri: getTeamLogoUrl(selectedGame.awayTeamInfo.code) }} style={styles.scoreTeamLogo} resizeMode="contain" />
                                        <Text style={styles.scoreTeamCode}>{selectedGame.awayTeamInfo.code}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.tabBar}>
                                <TabButton title="Summary" icon="stats-chart" isActive={activeTab === 'summary'} onPress={() => handleTabChange('summary')} />
                                <TabButton title="Events" icon="list" isActive={activeTab === 'events'} onPress={() => handleTabChange('events')} />
                                <TabButton title="Highlights" icon="videocam" isActive={activeTab === 'highlights'} onPress={() => handleTabChange('highlights')} />
                            </View>

                            {loadingModal ? (
                                <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                            ) : (
                                <View style={styles.tabContentContainer}>
                                    {activeTab === 'summary' && renderSummaryTab()}
                                    {activeTab === 'events' && renderEventsTab()}
                                    {activeTab === 'highlights' && renderHighlightsTab()}
                                </View>
                            )}
                        </>
                    )}
                </SafeAreaView>
            </Modal>

            {/* Football Match Modal */}
            <FootballMatchModal
                match={selectedFootballGame}
                details={footballDetails}
                visible={!!selectedFootballGame}
                loading={loadingFootballDetails}
                onClose={closeFootballModal}
            />

            {/* Biathlon Race Modal */}
            <RaceModal
                race={selectedRace}
                visible={!!selectedRace}
                onClose={() => setSelectedRace(null)}
            />

            {/* Settings Modal */}
            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                teams={teams}
                selectedTeams={selectedTeams}
                onToggleTeam={toggleTeamFilter}
                onClearTeams={clearTeamFilter}
                footballTeams={footballTeams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={toggleFootballTeamFilter}
                onClearFootballTeams={clearFootballTeamFilter}
                biathlonNations={biathlonNations}
                selectedNations={selectedNations}
                onToggleNation={toggleNationFilter}
                onClearNations={clearNationFilter}
                selectedGenders={selectedGenders}
                onToggleGender={toggleGenderFilter}
                onResetOnboarding={resetOnboarding}
            />

            {/* Onboarding Modal */}
            <OnboardingModal
                visible={showOnboarding}
                step={onboardingStep}
                onStepChange={setOnboardingStep}
                onComplete={completeOnboarding}
                teams={teams}
                selectedTeams={selectedTeams}
                onToggleTeam={toggleTeamFilter}
                biathlonNations={biathlonNations}
                selectedNations={selectedNations}
                onToggleNation={toggleNationFilter}
                selectedGenders={selectedGenders}
                onToggleGender={toggleGenderFilter}
            />
        </SafeAreaView>
    );
}

// Styles
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12
    },
    settingsButton: { padding: 8 },

    // Sport Tabs
    sportTabsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 },

    listContent: { padding: 16, paddingTop: 8 },

    // Schedule Header
    scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
    scheduleHeaderText: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
    scheduleCount: { color: '#666', fontSize: 13, fontWeight: '600' },

    // Modal
    modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
    modalHeader: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#333' },
    closeButton: { position: 'absolute', top: 20, right: 16, zIndex: 10, padding: 8 },

    // Score Header
    scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
    scoreTeam: { alignItems: 'center', width: 80 },
    scoreTeamLogo: { width: 50, height: 50, marginBottom: 4 },
    scoreTeamCode: { color: '#fff', fontSize: 14, fontWeight: '700' },
    scoreCenterBlock: { alignItems: 'center', marginHorizontal: 20 },
    scoreLarge: { color: '#fff', fontSize: 42, fontWeight: '800', fontVariant: ['tabular-nums'] },
    gameStateText: { color: '#888', fontSize: 14, marginTop: 4, textTransform: 'uppercase' },

    // Tabs
    tabBar: { flexDirection: 'row', backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#333' },
    tabContentContainer: { flex: 1 },
    tabContent: { padding: 16 },

    // Section Card
    sectionCard: { backgroundColor: '#1c1c1e', borderRadius: 12, padding: 16, marginBottom: 16 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },

    // Highlights
    highlightsTitleBox: { padding: 16, paddingBottom: 8 },
    highlightsTitleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    highlightsTitleLabel: { color: '#fff', fontSize: 20, fontWeight: '700' },
    highlightsSubtitle: { color: '#888', fontSize: 14 },
    nowPlayingBox: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#0A84FF' },
    nowPlayingLabel: { color: '#0A84FF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    nowPlayingTitle: { color: '#fff', fontSize: 15, fontWeight: '600', lineHeight: 20 },

    // Video
    videoList: { padding: 8 },
    videoGridRow: { justifyContent: 'space-between', paddingHorizontal: 8 },
    activePlayerContainer: { marginBottom: 20, paddingHorizontal: 16 },
    activePlayer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
    activePlayerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
    activePlayerTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 },
    closePlayerButton: { padding: 4 },
    videoLoadingContainer: { width: '100%', aspectRatio: 16 / 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    videoLoadingText: { color: '#888', fontSize: 12, marginTop: 8 },

    // Empty
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#666', fontSize: 16, textAlign: 'center', padding: 20 },
});
