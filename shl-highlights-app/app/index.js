import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Platform } from 'react-native';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';

// Theme
import { useTheme } from '../contexts';

// Card height constants for consistent scroll behavior
// Height = padding (32) + header (~36) + content (~90) + marginBottom (16)
const GAME_CARD_HEIGHT = 174;
const FOOTBALL_CARD_HEIGHT = 174;
// Biathlon: padding (32) + cardHeader (~40) + mainRow (~80) + marginBottom (16)
const BIATHLON_CARD_HEIGHT = 168;
const BIATHLON_MEDAL_COLORS = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32'
};

const normalizeRouteParam = (value) => {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
};

const normalizeDeepLinkTab = (value) => {
    const normalized = String(normalizeRouteParam(value) || '').toLowerCase();
    if (normalized === 'summary' || normalized === 'events' || normalized === 'highlights') {
        return normalized;
    }
    return null;
};

let firebaseMessaging = null;
if (Platform.OS !== 'web') {
    try {
        firebaseMessaging = require('@react-native-firebase/messaging').default;
    } catch (error) {
        console.log('[DeepLink] Firebase messaging unavailable:', error.message);
    }
}

// API
import { getTeamLogoUrl, getNationFlag, fetchHockeyAllsvenskanStandings } from '../api/shl';

// Constants - getTeamColor is used by ShlGameModal

// Utils
import { formatSwedishDate } from '../utils';

// Hooks
import {
    usePreferences,
    useShlData,
    useHockeyAllsvenskanData,
    useFootballData,
    useSvenskaCupenData,
    useEuropaLeagueQualData,
    useConferenceLeagueQualData,
    useBiathlonData,
    useUnifiedData,
    usePushNotifications,
    useAppUpdate
} from '../hooks';

// Components
import {
    SportPicker,
    ViewToggle,
    ScheduleHeader,
    SectionHeader,
    EmptyState
} from '../components';

import { GameCard, FootballGameCard, BiathlonRaceCard, UnifiedEventCard } from '../components/cards';
import {
    RaceModal,
    FootballMatchModal,
    SettingsModal,
    OnboardingModal,
    ShlGameModal
} from '../components/modals';


export default function App() {
    // User preferences
    const {
        activeSport,
        selectedTeams,
        selectedFootballTeams,
        selectedNations,
        selectedGenders,
        showOnboarding,
        onboardingStep,
        setOnboardingStep,
        handleSportChange,
        toggleTeamFilter,
        clearTeamFilter,
        toggleFootballTeamFilter,
        clearFootballTeamFilter,
        toggleNationFilter,
        clearNationFilter,
        toggleGenderFilter,
        completeOnboarding,
        resetOnboarding
    } = usePreferences();

    // Eager load all sports data on app start for instant scroll
    const shl = useShlData(activeSport, selectedTeams, { eagerLoad: true });
    const hockeyAllsvenskan = useHockeyAllsvenskanData(activeSport, selectedTeams, { eagerLoad: true });
    const football = useFootballData(activeSport, selectedFootballTeams, { eagerLoad: true });
    const svenskaCupen = useSvenskaCupenData(activeSport, selectedFootballTeams, { eagerLoad: true });
    const europaLeagueQual = useEuropaLeagueQualData(activeSport, selectedFootballTeams, { eagerLoad: true });
    const conferenceLeagueQual = useConferenceLeagueQualData(activeSport, selectedFootballTeams, { eagerLoad: true });
    const biathlon = useBiathlonData(activeSport, selectedNations, selectedGenders, { eagerLoad: true });

    // Combined football games (Allsvenskan + Svenska Cupen + Europa League Qual) for single list
    const combinedFootballGames = useMemo(() => {
        const allsvenskan = (football.games || []).map(g => ({ ...g, sport: g.sport || 'allsvenskan' }));
        const cupen = (svenskaCupen.games || []).map(g => ({ ...g, sport: g.sport || 'svenska-cupen' }));
        const europaQual = (europaLeagueQual.games || []).map(g => ({ ...g, sport: g.sport || 'europa-league-qual' }));
        const conferenceQual = (conferenceLeagueQual.games || []).map(g => ({ ...g, sport: g.sport || 'conference-league-qual' }));
        return [...allsvenskan, ...cupen, ...europaQual, ...conferenceQual].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [football.games, svenskaCupen.games, europaLeagueQual.games, conferenceLeagueQual.games]);

    const combinedFootballTargetGameIndex = useMemo(() => {
        if (!combinedFootballGames.length) {
            return 0;
        }
        const liveIndex = combinedFootballGames.findIndex(g => g.state === 'live');
        if (liveIndex !== -1) {
            return liveIndex;
        }
        const upcomingIndex = combinedFootballGames.findIndex(g => g.state !== 'post-game');
        if (upcomingIndex !== -1) {
            return upcomingIndex;
        }
        return combinedFootballGames.length - 1;
    }, [combinedFootballGames]);

    const hasFootballCombinedInitialScrolled = useRef(false);

    // Initial scroll to live/upcoming in combined football list
    useEffect(() => {
        if (activeSport !== 'football' || football.viewMode !== 'schedule') {
            return;
        }
        if (hasFootballCombinedInitialScrolled.current || combinedFootballTargetGameIndex <= 0 || !combinedFootballGames.length) {
            return;
        }
        const timeoutId = setTimeout(() => {
            if (football.listRef.current && !hasFootballCombinedInitialScrolled.current) {
                hasFootballCombinedInitialScrolled.current = true;
                football.listRef.current.scrollToOffset({
                    offset: combinedFootballTargetGameIndex * FOOTBALL_CARD_HEIGHT,
                    animated: false
                });
            }
        }, 50);
        return () => clearTimeout(timeoutId);
    }, [activeSport, football.viewMode, combinedFootballTargetGameIndex, combinedFootballGames.length]);

    // Combined hockey games (SHL + HockeyAllsvenskan) for single list
    const combinedHockeyGames = useMemo(() => {
        const shlGames = (shl.games || []).map(g => ({ ...g, sport: g.sport || 'shl' }));
        const haGames = (hockeyAllsvenskan.games || []).map(g => ({ ...g, sport: g.sport || 'hockeyallsvenskan' }));
        return [...shlGames, ...haGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [shl.games, hockeyAllsvenskan.games]);

    const combinedHockeyTargetGameIndex = useMemo(() => {
        if (!combinedHockeyGames.length) {
            return 0;
        }
        const liveIndex = combinedHockeyGames.findIndex(g => g.state === 'live');
        if (liveIndex !== -1) {
            return liveIndex;
        }
        const upcomingIndex = combinedHockeyGames.findIndex(g => g.state !== 'post-game');
        if (upcomingIndex !== -1) {
            return upcomingIndex;
        }
        return combinedHockeyGames.length - 1;
    }, [combinedHockeyGames]);

    const hasHockeyCombinedInitialScrolled = useRef(false);

    // Initial scroll to live/upcoming in combined hockey list
    useEffect(() => {
        if (activeSport !== 'hockey') {
            return;
        }
        if (hasHockeyCombinedInitialScrolled.current || combinedHockeyTargetGameIndex <= 0 || !combinedHockeyGames.length) {
            return;
        }
        const timeoutId = setTimeout(() => {
            if (shl.listRef.current && !hasHockeyCombinedInitialScrolled.current) {
                hasHockeyCombinedInitialScrolled.current = true;
                shl.listRef.current.scrollToOffset({
                    offset: combinedHockeyTargetGameIndex * GAME_CARD_HEIGHT,
                    animated: false
                });
            }
        }, 50);
        return () => clearTimeout(timeoutId);
    }, [activeSport, combinedHockeyTargetGameIndex, combinedHockeyGames.length]);

    // Merged hockey teams (SHL + HockeyAllsvenskan) for filter in Settings/Onboarding
    // Merged football teams (Allsvenskan + Svenska Cupen) for filter in Settings/Onboarding
    const combinedFootballTeams = useMemo(() => {
        const byKey = new Map();
        (football.teams || []).forEach(t => byKey.set(t.key, t));
        (svenskaCupen.teams || []).forEach(t => byKey.set(t.key, t));
        (europaLeagueQual.teams || []).forEach(t => byKey.set(t.key, t));
        (conferenceLeagueQual.teams || []).forEach(t => byKey.set(t.key, t));
        return Array.from(byKey.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [football.teams, svenskaCupen.teams, europaLeagueQual.teams, conferenceLeagueQual.teams]);

    // Merged hockey teams (SHL + HockeyAllsvenskan) for filter in Settings/Onboarding.
    // Both use { code }; merge by code so a team shared across leagues isn't duplicated.
    const combinedHockeyTeams = useMemo(() => {
        const byCode = new Map();
        (shl.teams || []).forEach(t => byCode.set(t.code, t));
        (hockeyAllsvenskan.teams || []).forEach(t => byCode.set(t.code, t));
        return Array.from(byCode.values()).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }, [shl.teams, hockeyAllsvenskan.teams]);

    // Unified data combining all sports
    const unified = useUnifiedData(shl, hockeyAllsvenskan, football, svenskaCupen, europaLeagueQual, conferenceLeagueQual, biathlon);

    // Push notifications
    const {
        notificationsEnabled,
        goalNotificationsEnabled,
        hasPermission: hasNotificationPermission,
        toggleNotifications,
        toggleGoalNotifications,
        requestPermission: requestNotificationPermission,
        setTeamTags,
        fcmToken,
        // Pre-game notification state and toggles
        preGameShlEnabled,
        preGameFootballEnabled,
        preGameBiathlonEnabled,
        togglePreGameShl,
        togglePreGameFootball,
        togglePreGameBiathlon
    } = usePushNotifications();

    // App self-update (Android sideload) — check GitHub Releases on launch
    const appUpdate = useAppUpdate();
    const hasCheckedUpdateRef = useRef(false);
    useEffect(() => {
        if (hasCheckedUpdateRef.current) {
            return;
        }
        hasCheckedUpdateRef.current = true;
        // Silent check so we don't flash a spinner; the Settings badge/card reflects the result.
        appUpdate.checkForUpdate({ silent: true });
    }, [appUpdate]);

    // Theme
    const { colors } = useTheme();

    const { sport: routeSport, gameId: routeGameId, tab: routeTab } = useLocalSearchParams();
    const deepLinkParams = useMemo(() => {
        const sportParam = normalizeRouteParam(routeSport);
        const gameIdParam = normalizeRouteParam(routeGameId);
        const tabParam = normalizeDeepLinkTab(routeTab);

        if (!sportParam || !gameIdParam) {
            return null;
        }

        return { sport: sportParam, gameId: gameIdParam, tab: tabParam };
    }, [routeSport, routeGameId, routeTab]);

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);

    // SHL game modal tab state
    const [shlActiveTab, setShlActiveTab] = useState('summary');

    // HockeyAllsvenskan game modal tab state
    const [haActiveTab, setHaActiveTab] = useState('summary');

    // Track if we've processed a pending deep link
    const processedDeepLinkRef = useRef(null);
    const processedRouteDeepLinkRef = useRef(null);

    // Handle notification clicks and deep links to open games
    useEffect(() => {
        const normalizeSport = (sport) => {
            const normalized = String(sport || '').toLowerCase();
            if (normalized === 'football') {
                return 'allsvenskan';
            }
            return normalized;
        };

        const safeDecode = (value) => {
            try {
                return decodeURIComponent(value);
            } catch (_error) {
                return value;
            }
        };

        // Parse deep link URL to extract game info
        const parseGameDeepLink = (url) => {
            if (!url) {
                return null;
            }

            const normalizedUrl = String(url).trim();
            // Handle gamepulse://game/{sport}/{gameId} and gamepulse:///game/{sport}/{gameId}
            const match = normalizedUrl.match(/^gamepulse:\/\/(?:\/)?game\/([^/?#]+)\/([^?#]+)/i);
            if (!match) {
                return null;
            }

            const parsed = Linking.parse(normalizedUrl);
            return {
                sport: normalizeSport(safeDecode(match[1])),
                gameId: safeDecode(match[2]),
                tab: normalizeDeepLinkTab(parsed?.queryParams?.tab)
            };
        };

        const parseRemoteMessageGame = (remoteMessage) => {
            const data = remoteMessage?.data || {};
            if (data.url) {
                const fromUrl = parseGameDeepLink(data.url);
                if (!fromUrl) {
                    return null;
                }
                return {
                    ...fromUrl,
                    homeTeamCode: safeDecode(String(normalizeRouteParam(data.homeTeam || data.homeTeamCode) || '')) || null,
                    awayTeamCode: safeDecode(String(normalizeRouteParam(data.awayTeam || data.awayTeamCode) || '')) || null
                };
            }

            const sport = normalizeSport(normalizeRouteParam(data.sport));
            const gameId = normalizeRouteParam(data.gameId);
            if (!sport || !gameId) {
                return null;
            }

            return {
                sport,
                gameId: safeDecode(String(gameId)),
                tab: normalizeDeepLinkTab(data.tab),
                homeTeamCode: safeDecode(String(normalizeRouteParam(data.homeTeam || data.homeTeamCode) || '')) || null,
                awayTeamCode: safeDecode(String(normalizeRouteParam(data.awayTeam || data.awayTeamCode) || '')) || null
            };
        };

        // Open a game by ID
        const openGameById = (sport, gameId, tab = null, options = {}) => {
            const normalizedSport = normalizeSport(sport);
            const normalizedTab = normalizeDeepLinkTab(tab) || 'summary';
            const homeTeamCode = normalizeRouteParam(options?.homeTeamCode);
            const awayTeamCode = normalizeRouteParam(options?.awayTeamCode);

            // Prevent processing the same deep link twice
            const linkKey = `${normalizedSport}:${gameId}:${normalizedTab}`;
            if (processedDeepLinkRef.current === linkKey) {
                return;
            }
            processedDeepLinkRef.current = linkKey;

            // Clear after a short delay to allow re-opening if needed
            setTimeout(() => {
                processedDeepLinkRef.current = null;
            }, 2000);

            console.log('[DeepLink] Opening game:', normalizedSport, gameId, normalizedTab);

            if (normalizedSport === 'shl') {
                // Find the game in SHL games list
                const game = shl.games.find(g => g.uuid === gameId);
                if (game) {
                    handleSportChange('hockey');
                    setShlActiveTab(normalizedTab);
                    shl.handleGamePress(game);
                } else {
                    // Game not in list yet, try to open anyway with minimal data
                    console.log('[DeepLink] SHL game not found in list, opening with ID');
                    handleSportChange('hockey');
                    setShlActiveTab(normalizedTab);
                    const fallbackGame = {
                        uuid: gameId,
                        homeTeamInfo: homeTeamCode
                            ? {
                                code: homeTeamCode,
                                names: { short: homeTeamCode }
                            }
                            : undefined,
                        awayTeamInfo: awayTeamCode
                            ? {
                                code: awayTeamCode,
                                names: { short: awayTeamCode }
                            }
                            : undefined
                    };
                    shl.handleGamePress(fallbackGame);
                }
            } else if (normalizedSport === 'hockeyallsvenskan') {
                const game = hockeyAllsvenskan.games.find(g => g.uuid === gameId);
                handleSportChange('hockey');
                setHaActiveTab(normalizedTab);
                if (game) {
                    hockeyAllsvenskan.handleGamePress(game);
                } else {
                    console.log('[DeepLink] HockeyAllsvenskan game not found in list, opening with ID');
                    const fallbackGame = {
                        uuid: gameId,
                        homeTeamInfo: homeTeamCode
                            ? { code: homeTeamCode, names: { short: homeTeamCode } }
                            : undefined,
                        awayTeamInfo: awayTeamCode
                            ? { code: awayTeamCode, names: { short: awayTeamCode } }
                            : undefined
                    };
                    hockeyAllsvenskan.handleGamePress(fallbackGame);
                }
            } else if (normalizedSport === 'allsvenskan') {
                const game = football.games.find(g => g.uuid === gameId);
                if (game) {
                    handleSportChange('football');
                    football.handleGamePress(game);
                } else {
                    console.log('[DeepLink] Football game not found in list');
                    handleSportChange('football');
                    football.handleGamePress({ uuid: gameId });
                }
            } else if (normalizedSport === 'svenska-cupen') {
                handleSportChange('football');
                const game = svenskaCupen.games.find(g => g.uuid === gameId);
                if (game) {
                    svenskaCupen.handleGamePress(game);
                } else {
                    svenskaCupen.handleGamePress({ uuid: gameId });
                }
            } else if (normalizedSport === 'europa-league-qual') {
                handleSportChange('football');
                const game = europaLeagueQual.games.find(g => g.uuid === gameId);
                if (game) {
                    europaLeagueQual.handleGamePress(game);
                } else {
                    europaLeagueQual.handleGamePress({ uuid: gameId });
                }
            } else if (normalizedSport === 'conference-league-qual') {
                handleSportChange('football');
                const game = conferenceLeagueQual.games.find(g => g.uuid === gameId);
                if (game) {
                    conferenceLeagueQual.handleGamePress(game);
                } else {
                    conferenceLeagueQual.handleGamePress({ uuid: gameId });
                }
            } else {
                console.warn('[DeepLink] Unsupported sport in deep link:', normalizedSport);
            }
        };

        const openFromGameInfo = (gameInfo, delayMs = 0) => {
            if (!gameInfo) {
                return;
            }
            if (delayMs > 0) {
                setTimeout(() => {
                    openGameById(gameInfo.sport, gameInfo.gameId, gameInfo.tab, gameInfo);
                }, delayMs);
                return;
            }
            openGameById(gameInfo.sport, gameInfo.gameId, gameInfo.tab, gameInfo);
        };

        if (deepLinkParams) {
            const routeLinkKey = `${normalizeSport(deepLinkParams.sport)}:${deepLinkParams.gameId}:${normalizeDeepLinkTab(deepLinkParams.tab) || 'summary'}`;
            if (processedRouteDeepLinkRef.current === routeLinkKey) {
                return;
            }
            processedRouteDeepLinkRef.current = routeLinkKey;

            const timeoutId = setTimeout(() => {
                openGameById(deepLinkParams.sport, deepLinkParams.gameId, deepLinkParams.tab);
            }, 0);

            return () => {
                clearTimeout(timeoutId);
            };
        }

        // Handle deep link when app is already open
        const handleDeepLink = (event) => {
            const gameInfo = parseGameDeepLink(event.url);
            openFromGameInfo(gameInfo);
        };

        // Handle app opens from push notifications (background state)
        let unsubscribeNotificationOpened = null;
        if (firebaseMessaging) {
            unsubscribeNotificationOpened = firebaseMessaging().onNotificationOpenedApp((remoteMessage) => {
                const gameInfo = parseRemoteMessageGame(remoteMessage);
                openFromGameInfo(gameInfo);
            });

            // Handle app opens from push notifications (quit state)
            firebaseMessaging().getInitialNotification().then((remoteMessage) => {
                if (!remoteMessage) {
                    return;
                }
                const gameInfo = parseRemoteMessageGame(remoteMessage);
                openFromGameInfo(gameInfo, 1000);
            }).catch((error) => {
                console.error('[DeepLink] Error reading initial notification:', error.message);
            });
        }

        // Check if app was opened with a deep link
        Linking.getInitialURL().then(url => {
            if (url) {
                const gameInfo = parseGameDeepLink(url);
                openFromGameInfo(gameInfo, 1000);
            }
        });

        // Listen for deep links while app is open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        return () => {
            subscription?.remove();
            unsubscribeNotificationOpened?.();
        };
    }, [
        shl.games,
        hockeyAllsvenskan.games,
        football.games,
        svenskaCupen.games,
        europaLeagueQual.games,
        conferenceLeagueQual.games,
        shl.handleGamePress,
        hockeyAllsvenskan.handleGamePress,
        football.handleGamePress,
        svenskaCupen.handleGamePress,
        europaLeagueQual.handleGamePress,
        conferenceLeagueQual.handleGamePress,
        handleSportChange,
        deepLinkParams
    ]);

    // Unified refresh handler
    const onRefresh = useCallback(() => {
        if (activeSport === 'all') {
            unified.onRefresh();
        } else if (activeSport === 'hockey') {
            shl.onRefresh();
            hockeyAllsvenskan.onRefresh();
        } else if (activeSport === 'football') {
            football.onRefresh();
            svenskaCupen.onRefresh();
            europaLeagueQual.onRefresh();
            conferenceLeagueQual.onRefresh();
        } else if (activeSport === 'biathlon') {
            biathlon.onRefresh();
        }
    }, [activeSport, shl, hockeyAllsvenskan, football, svenskaCupen, europaLeagueQual, conferenceLeagueQual, biathlon, unified]);

    // getItemLayout functions for consistent scroll behavior
    const getShlItemLayout = useCallback((data, index) => ({
        length: GAME_CARD_HEIGHT,
        offset: GAME_CARD_HEIGHT * index,
        index
    }), []);

    const getFootballItemLayout = useCallback((data, index) => ({
        length: FOOTBALL_CARD_HEIGHT,
        offset: FOOTBALL_CARD_HEIGHT * index,
        index
    }), []);

    const getBiathlonItemLayout = useCallback((data, index) => ({
        length: BIATHLON_CARD_HEIGHT,
        offset: BIATHLON_CARD_HEIGHT * index,
        index
    }), []);

    // onScrollToIndexFailed handler for robustness
    const handleScrollToIndexFailed = useCallback((info) => {
        // Wait a bit and retry scrolling
        setTimeout(() => {
            if (info.index >= 0 && info.index < (info.highestMeasuredFrameIndex + 1)) {
                // We have measured frames up to this point, try again
                const listRef =
                    activeSport === 'all' ? unified.listRef :
                    activeSport === 'hockey' ? shl.listRef :
                    activeSport === 'football' ? football.listRef :
                    biathlon.listRef;

                listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false
                });
            }
        }, 100);
    }, [activeSport, unified.listRef, shl.listRef, football.listRef, biathlon.listRef]);

    // Get current refreshing state
    const refreshing = activeSport === 'all'
        ? unified.refreshing
        : activeSport === 'hockey'
            ? (shl.refreshing || hockeyAllsvenskan.refreshing)
            : activeSport === 'football'
                ? (football.refreshing || svenskaCupen.refreshing || europaLeagueQual.refreshing || conferenceLeagueQual.refreshing)
                : biathlon.refreshing;


    // Handle hockey game press — routes to the correct league's handler
    const handleHockeyGamePress = useCallback((game) => {
        if (game.sport === 'hockeyallsvenskan') {
            setHaActiveTab('summary');
            hockeyAllsvenskan.handleGamePress(game);
        } else {
            setShlActiveTab('summary');
            shl.handleGamePress(game);
        }
    }, [shl, hockeyAllsvenskan]);

    // Render sport picker
    const renderSportPicker = () => (
        <SportPicker activeSport={activeSport} onSportChange={handleSportChange} />
    );

    // Render Hockey schedule (SHL + HockeyAllsvenskan in one list)
    const renderHockeySchedule = () => (
        <FlatList
            ref={shl.listRef}
            data={combinedHockeyGames}
            renderItem={({ item }) => (
                <GameCard
                    game={item}
                    onPress={() => handleHockeyGamePress(item)}
                    leagueLabel={item.sport === 'hockeyallsvenskan' ? 'HockeyAllsvenskan' : 'SHL'}
                />
            )}
            keyExtractor={item => `${item.sport}-${item.uuid}`}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            getItemLayout={getShlItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={shl.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No games found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="snow-outline" title="Hockey" count={combinedHockeyGames.length} countLabel="games" />
            }
        />
    );

    // Render Football schedule (Allsvenskan + Svenska Cupen in one list)
    const renderFootballSchedule = () => (
        <FlatList
            ref={football.listRef}
            data={combinedFootballGames}
            renderItem={({ item }) => (
                <FootballGameCard
                    game={item}
                    onPress={() => {
                        if (item.sport === 'svenska-cupen') {
                            svenskaCupen.handleGamePress(item);
                        } else if (item.sport === 'europa-league-qual') {
                            europaLeagueQual.handleGamePress(item);
                        } else if (item.sport === 'conference-league-qual') {
                            conferenceLeagueQual.handleGamePress(item);
                        } else {
                            football.handleGamePress(item);
                        }
                    }}
                    leagueLabel={item.sport === 'svenska-cupen' ? 'Svenska Cupen' : (item.sport === 'europa-league-qual' ? 'Europa League Qualifying' : (item.sport === 'conference-league-qual' ? 'Conference League Qualifying' : 'Allsvenskan'))}
                />
            )}
            keyExtractor={item => `${item.sport}-${item.uuid}`}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            getItemLayout={getFootballItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={football.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No matches found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="football-outline" title="Football" count={combinedFootballGames.length} countLabel="matches" />
            }
        />
    );

    // Memoized render function for biathlon race items
    const renderBiathlonRaceItem = useCallback(({ item }) => (
        <BiathlonRaceCard race={item} onPress={biathlon.handleRacePress} />
    ), [biathlon.handleRacePress]);

    // Memoized key extractor for biathlon
    const biathlonKeyExtractor = useCallback((item) => item.uuid, []);

    // Render Biathlon schedule - start at the most recent/current race
    const renderBiathlonSchedule = () => (
        <FlatList
            ref={biathlon.listRef}
            data={biathlon.races}
            renderItem={renderBiathlonRaceItem}
            keyExtractor={biathlonKeyExtractor}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            getItemLayout={getBiathlonItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={biathlon.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No races found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="calendar-outline" title="All Races" count={biathlon.races.length} countLabel="races" />
            }
        />
    );

    // Render Biathlon standings (main screen only; no standings tab in race modal)
    const renderBiathlonStandings = () => {
        const seasonLabel = biathlon.standings?.season || null;
        const typeName = biathlon.standings?.typeName || 'World Cup Overall';
        const availableTypes = biathlon.standings?.availableTypes || [];
        const categories = biathlon.standings?.categories || [];
        const lastUpdatedLabel = biathlon.standings?.lastUpdated
            ? formatSwedishDate(biathlon.standings.lastUpdated, 'd MMM HH:mm')
            : null;
        const selectedCategory = categories.find(c => c.gender === biathlon.standingsGender) || categories[0];

        return (
            <View style={styles.scheduleContainer}>
                <View style={[styles.stickyToggle, { backgroundColor: colors.background }]}>
                    <ViewToggle mode={biathlon.viewMode} onChange={biathlon.handleViewChange} />
                    <LinearGradient
                        colors={[colors.background, 'transparent']}
                        style={styles.toggleGradient}
                        pointerEvents="none"
                    />
                </View>
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
                >
                    <View style={[styles.standingsHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <View style={styles.standingsHeaderRow}>
                            <Ionicons name="trophy-outline" size={20} color={colors.accent} />
                            <Text style={[styles.standingsTitle, { color: colors.text }]}>{typeName}</Text>
                            {seasonLabel && <Text style={[styles.standingsCount, { color: colors.textMuted }]}>{seasonLabel}</Text>}
                        </View>
                        <View style={styles.biathlonGenderPicker}>
                            <TouchableOpacity
                                style={[
                                    styles.biathlonGenderButton,
                                    { backgroundColor: colors.chip, borderColor: colors.chipBorder },
                                    biathlon.standingsGender === 'men' && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                                ]}
                                onPress={() => biathlon.handleStandingsGenderChange('men')}
                            >
                                <Text style={[
                                    styles.biathlonGenderText,
                                    { color: colors.textSecondary },
                                    biathlon.standingsGender === 'men' && { color: colors.accent }
                                ]}>Men</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.biathlonGenderButton,
                                    { backgroundColor: colors.chip, borderColor: colors.chipBorder },
                                    biathlon.standingsGender === 'women' && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                                ]}
                                onPress={() => biathlon.handleStandingsGenderChange('women')}
                            >
                                <Text style={[
                                    styles.biathlonGenderText,
                                    { color: colors.textSecondary },
                                    biathlon.standingsGender === 'women' && { color: colors.accent }
                                ]}>Women</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.biathlonTypePicker}>
                            {availableTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.biathlonTypeButton,
                                        { backgroundColor: colors.chip, borderColor: colors.chipBorder },
                                        biathlon.standingsType === type && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                                    ]}
                                    onPress={() => biathlon.handleStandingsTypeChange(type)}
                                >
                                    <Text style={[
                                        styles.biathlonTypeText,
                                        { color: colors.textSecondary },
                                        biathlon.standingsType === type && { color: colors.accent }
                                    ]}>
                                        {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.standingsMetaRow}>
                            {lastUpdatedLabel && (
                                <Text style={[styles.standingsMetaText, { color: colors.textSecondary }]}>Updated {lastUpdatedLabel}</Text>
                            )}
                        </View>
                    </View>
                    {biathlon.loadingStandings ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 24 }} />
                    ) : selectedCategory ? (
                        <View style={[styles.biathlonStandingsCategory, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                            <View style={[styles.biathlonCategoryHeader, { borderBottomColor: colors.cardBorder }]}>
                                <Text style={[styles.biathlonCategoryTitle, { color: colors.text }]}>{selectedCategory.genderDisplay}</Text>
                                <Text style={[styles.biathlonCategoryCount, { color: colors.textMuted }]}>{selectedCategory.standings?.length || 0} athletes</Text>
                            </View>
                            {selectedCategory.standings?.slice(0, 30).map((athlete, index) => (
                                <View key={athlete.athleteId || index} style={[styles.biathlonAthleteRow, { borderBottomColor: colors.separator }]}>
                                    <Text
                                        style={[
                                            styles.biathlonRank,
                                            { color: colors.textSecondary },
                                            BIATHLON_MEDAL_COLORS[Number(athlete.rank)] && { color: BIATHLON_MEDAL_COLORS[Number(athlete.rank)] }
                                        ]}
                                    >
                                        {athlete.rank}
                                    </Text>
                                    <Text style={styles.biathlonNationFlag}>{getNationFlag(athlete.nation)}</Text>
                                    <Text style={[styles.biathlonName, { color: colors.text }]} numberOfLines={1}>{athlete.name}</Text>
                                    <Text style={[styles.biathlonPoints, { color: colors.accent }]}>{athlete.points} pts</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </ScrollView>
            </View>
        );
    };

    // Memoized render function for unified event items
    const renderUnifiedItem = useCallback(({ item }) => {
        if (item.type === 'header') {
            return (
                <SectionHeader
                    title={item.title}
                    icon={item.icon}
                    count={item.count}
                    isLive={item.key === 'live'}
                />
            );
        }
        return (
            <UnifiedEventCard
                event={item.event}
                onPress={unified.handleEventPress}
                showSportIndicator={false}
            />
        );
    }, [unified.handleEventPress]);

    // Memoized key extractor for unified list
    const unifiedKeyExtractor = useCallback((item) => {
        if (item.type === 'header') {
            return `header-${item.key}`;
        }
        return item.key || item.event?.uuid || `event-${item.event?.startTime}`;
    }, []);

    // Render Unified schedule - all sports combined
    const renderUnifiedSchedule = () => (
        <FlatList
            ref={unified.listRef}
            data={unified.flatListData}
            renderItem={renderUnifiedItem}
            keyExtractor={unifiedKeyExtractor}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={unified.refreshing} onRefresh={unified.onRefresh} tintColor={colors.text} />}
            onScroll={unified.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            windowSize={15}
            ListEmptyComponent={<EmptyState message="No events found." />}
        />
    );

    // Main render
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} />

            {/* Header with gradient fade */}
            <View style={styles.headerContainer}>
                <View style={[styles.header, { backgroundColor: colors.background }]}>
                    {renderSportPicker()}
                    <TouchableOpacity style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setShowSettings(true)}>
                        <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
                        {appUpdate.isUpdateAvailable && (
                            <View style={[styles.settingsUpdateBadge, { backgroundColor: colors.accent, borderColor: colors.background }]} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sport-specific content */}
            {activeSport === 'all' ? (
                <View style={styles.scheduleContainer}>
                    {unified.loading ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                    ) : (
                        renderUnifiedSchedule()
                    )}
                </View>
            ) : activeSport === 'hockey' ? (
                <View style={styles.scheduleContainer}>
                    {(shl.loading || hockeyAllsvenskan.loading) ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                    ) : (
                        renderHockeySchedule()
                    )}
                </View>
            ) : activeSport === 'football' ? (
                <View style={styles.scheduleContainer}>
                    {(football.loading || svenskaCupen.loading || europaLeagueQual.loading || conferenceLeagueQual.loading) ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                    ) : (
                        renderFootballSchedule()
                    )}
                </View>
            ) : (
                biathlon.viewMode === 'standings' ? (
                    renderBiathlonStandings()
                ) : (
                    <View style={styles.scheduleContainer}>
                        <View style={[styles.stickyToggle, { backgroundColor: colors.background }]}>
                            <ViewToggle mode={biathlon.viewMode} onChange={biathlon.handleViewChange} />
                            <LinearGradient
                                colors={[colors.background, 'transparent']}
                                style={styles.toggleGradient}
                                pointerEvents="none"
                            />
                        </View>
                        {biathlon.loading ? (
                            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                        ) : (
                            renderBiathlonSchedule()
                        )}
                    </View>
                )
            )}

            {/* SHL Game Modal */}
            <ShlGameModal
                game={shl.selectedGame}
                gameDetails={shl.gameDetails}
                videos={shl.videos}
                visible={!!shl.selectedGame}
                loading={shl.loadingModal}
                onClose={shl.closeModal}
                activeTab={shlActiveTab}
                onTabChange={setShlActiveTab}
                onRefresh={shl.refreshModalDetails}
                refreshing={shl.refreshingModal}
                selectedTeams={selectedTeams}
            />

            {/* HockeyAllsvenskan Game Modal (reuses SHL modal — identical data shape) */}
            <ShlGameModal
                game={hockeyAllsvenskan.selectedGame}
                gameDetails={hockeyAllsvenskan.gameDetails}
                videos={hockeyAllsvenskan.videos}
                visible={!!hockeyAllsvenskan.selectedGame}
                loading={hockeyAllsvenskan.loadingModal}
                onClose={hockeyAllsvenskan.closeModal}
                activeTab={haActiveTab}
                onTabChange={setHaActiveTab}
                onRefresh={hockeyAllsvenskan.refreshModalDetails}
                refreshing={hockeyAllsvenskan.refreshingModal}
                selectedTeams={selectedTeams}
                standingsFetcher={fetchHockeyAllsvenskanStandings}
                standingsSport="hockeyallsvenskan"
            />

            {/* Football Match Modal */}
            <FootballMatchModal
                match={football.selectedGame}
                details={football.gameDetails}
                videos={football.videos}
                visible={!!football.selectedGame}
                loading={football.loadingDetails}
                onClose={football.closeModal}
                onRefresh={football.refreshModalDetails}
                refreshing={football.refreshingModal}
                selectedTeams={selectedFootballTeams}
                showStandingsTab={true}
            />

            {/* Svenska Cupen Match Modal */}
            <FootballMatchModal
                match={svenskaCupen.selectedGame}
                details={svenskaCupen.gameDetails}
                videos={[]}
                visible={!!svenskaCupen.selectedGame}
                loading={svenskaCupen.loadingDetails}
                onClose={svenskaCupen.closeModal}
                onRefresh={svenskaCupen.refreshModalDetails}
                refreshing={svenskaCupen.refreshingModal}
                sport="svenska-cupen"
                showStandingsTab={true}
            />

            {/* Europa League Qualifying Match Modal */}
            <FootballMatchModal
                match={europaLeagueQual.selectedGame}
                details={europaLeagueQual.gameDetails}
                videos={[]}
                visible={!!europaLeagueQual.selectedGame}
                loading={europaLeagueQual.loadingDetails}
                onClose={europaLeagueQual.closeModal}
                onRefresh={europaLeagueQual.refreshModalDetails}
                refreshing={europaLeagueQual.refreshingModal}
                sport="europa-league-qual"
                showStandingsTab={false}
            />

            {/* Conference League Qualifying Match Modal */}
            <FootballMatchModal
                match={conferenceLeagueQual.selectedGame}
                details={conferenceLeagueQual.gameDetails}
                videos={[]}
                visible={!!conferenceLeagueQual.selectedGame}
                loading={conferenceLeagueQual.loadingDetails}
                onClose={conferenceLeagueQual.closeModal}
                onRefresh={conferenceLeagueQual.refreshModalDetails}
                refreshing={conferenceLeagueQual.refreshingModal}
                sport="conference-league-qual"
                showStandingsTab={false}
            />

            {/* Biathlon Race Modal */}
            <RaceModal
                race={biathlon.selectedRace}
                details={biathlon.raceDetails}
                loading={biathlon.loadingDetails}
                visible={!!biathlon.selectedRace}
                onClose={biathlon.closeModal}
                onRefresh={biathlon.refreshModalDetails}
                refreshing={biathlon.refreshingModal}
            />

            {/* Settings Modal */}
            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                teams={combinedHockeyTeams}
                selectedTeams={selectedTeams}
                onToggleTeam={(teamCode) => {
                    toggleTeamFilter(teamCode);
                    // Update FCM topic subscriptions with all teams from all sports
                    const newHockeyTeams = selectedTeams.includes(teamCode)
                        ? selectedTeams.filter(t => t !== teamCode)
                        : [...selectedTeams, teamCode];
                    setTeamTags([...newHockeyTeams, ...selectedFootballTeams]);
                }}
                onClearTeams={() => {
                    clearTeamFilter();
                    setTeamTags([...selectedFootballTeams]);
                }}
                footballTeams={combinedFootballTeams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={(teamKey) => {
                    toggleFootballTeamFilter(teamKey);
                    // Update FCM topic subscriptions with all teams from all sports
                    const newFootballTeams = selectedFootballTeams.includes(teamKey)
                        ? selectedFootballTeams.filter(t => t !== teamKey)
                        : [...selectedFootballTeams, teamKey];
                    setTeamTags([...selectedTeams, ...newFootballTeams]);
                }}
                onClearFootballTeams={() => {
                    clearFootballTeamFilter();
                    setTeamTags([...selectedTeams]);
                }}
                biathlonNations={biathlon.nations}
                selectedNations={selectedNations}
                onToggleNation={toggleNationFilter}
                onClearNations={clearNationFilter}
                selectedGenders={selectedGenders}
                onToggleGender={toggleGenderFilter}
                onResetOnboarding={async () => {
                    await resetOnboarding();
                    setShowSettings(false);
                }}
                // Push notification props
                notificationsEnabled={notificationsEnabled}
                goalNotificationsEnabled={goalNotificationsEnabled}
                hasNotificationPermission={hasNotificationPermission}
                onToggleNotifications={toggleNotifications}
                onToggleGoalNotifications={toggleGoalNotifications}
                onRequestNotificationPermission={requestNotificationPermission}
                // Pre-game notification props
                preGameShlEnabled={preGameShlEnabled}
                preGameFootballEnabled={preGameFootballEnabled}
                preGameBiathlonEnabled={preGameBiathlonEnabled}
                onTogglePreGameShl={togglePreGameShl}
                onTogglePreGameFootball={togglePreGameFootball}
                onTogglePreGameBiathlon={togglePreGameBiathlon}
                fcmToken={fcmToken}
                updateStatus={appUpdate.status}
                updateInfo={appUpdate.updateInfo}
                updateProgress={appUpdate.progress}
                updateError={appUpdate.error}
                onCheckForUpdate={appUpdate.checkForUpdate}
                onDownloadAndInstall={appUpdate.downloadAndInstall}
            />

            {/* Onboarding Modal */}
            <OnboardingModal
                visible={showOnboarding}
                step={onboardingStep}
                onStepChange={setOnboardingStep}
                onComplete={() => {
                    // Sync all team topics to FCM when onboarding completes
                    setTeamTags([...selectedTeams, ...selectedFootballTeams]);
                    completeOnboarding();
                }}
                teams={combinedHockeyTeams}
                selectedTeams={selectedTeams}
                onToggleTeam={(teamCode) => {
                    toggleTeamFilter(teamCode);
                    // Update FCM topic subscriptions with all teams from all sports
                    const newHockeyTeams = selectedTeams.includes(teamCode)
                        ? selectedTeams.filter(t => t !== teamCode)
                        : [...selectedTeams, teamCode];
                    setTeamTags([...newHockeyTeams, ...selectedFootballTeams]);
                }}
                footballTeams={combinedFootballTeams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={(teamKey) => {
                    toggleFootballTeamFilter(teamKey);
                    // Update FCM topic subscriptions with all teams from all sports
                    const newFootballTeams = selectedFootballTeams.includes(teamKey)
                        ? selectedFootballTeams.filter(t => t !== teamKey)
                        : [...selectedFootballTeams, teamKey];
                    setTeamTags([...selectedTeams, ...newFootballTeams]);
                }}
                biathlonNations={biathlon.nations}
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
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    headerContainer: {
        position: 'relative',
        zIndex: 10
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
        backgroundColor: '#000'
    },
    settingsButton: {
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#1c1c1e',
        borderWidth: 1,
        borderColor: '#333'
    },
    settingsUpdateBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.5
    },
    scheduleContainer: {
        flex: 1
    },
    stickyToggle: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: '#000',
        position: 'relative',
        zIndex: 10
    },
    footballLeaguePicker: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        zIndex: 10
    },
    footballLeagueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 16
    },
    leagueChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    leagueChipText: {
        fontSize: 14,
        fontWeight: '600'
    },
    toggleGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -30,
        height: 30,
        zIndex: 5
    },
    listContent: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        paddingTop: 24
    },
    standingsHeader: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    standingsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12
    },
    standingsTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1
    },
    standingsCount: {
        color: '#666',
        fontSize: 13,
        fontWeight: '600'
    },
    standingsMetaRow: {
        gap: 6,
        marginTop: 10
    },
    standingsMetaText: {
        color: '#8e8e93',
        fontSize: 12,
        fontWeight: '600'
    },
    biathlonGenderPicker: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        marginBottom: 8
    },
    biathlonGenderButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#2c2c2e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#3c3c3e',
        alignItems: 'center'
    },
    biathlonGenderText: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '600'
    },
    biathlonTypePicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
        marginBottom: 4
    },
    biathlonTypeButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#2c2c2e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3c3c3e'
    },
    biathlonTypeText: {
        color: '#8e8e93',
        fontSize: 11,
        fontWeight: '600'
    },
    biathlonStandingsCategory: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333'
    },
    biathlonCategoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    biathlonCategoryTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700'
    },
    biathlonCategoryCount: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600'
    },
    biathlonAthleteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    biathlonRank: {
        width: 28,
        color: '#8e8e93',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center'
    },
    biathlonNation: {
        width: 36,
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        marginRight: 8
    },
    biathlonNationFlag: {
        width: 28,
        fontSize: 16,
        textAlign: 'center',
        marginRight: 8
    },
    biathlonName: {
        flex: 1,
        color: '#fff',
        fontSize: 13,
        fontWeight: '500'
    },
    biathlonPoints: {
        color: '#6C5CE7',
        fontSize: 13,
        fontWeight: '700',
        minWidth: 60,
        textAlign: 'right'
    }
});
