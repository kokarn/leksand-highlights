import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Platform } from 'react-native';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Only import OneSignal on native platforms
let OneSignal = null;
if (Platform.OS !== 'web') {
    OneSignal = require('react-native-onesignal').OneSignal;
}

// Card height constants for consistent scroll behavior
// Height = padding (32) + header (~36) + content (~90) + marginBottom (16)
const GAME_CARD_HEIGHT = 174;
const FOOTBALL_CARD_HEIGHT = 174;
// Biathlon: padding (32) + cardHeader (~40) + mainRow (~80) + marginBottom (16)
const BIATHLON_CARD_HEIGHT = 168;
// Section header height: paddingVertical (24) + text (~20) + marginBottom (8)
const SECTION_HEADER_HEIGHT = 52;
// Average unified card height (for estimation)
const UNIFIED_CARD_HEIGHT = 174;

const normalizeRouteParam = (value) => {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
};

// API
import { getTeamLogoUrl, getNationFlag } from '../api/shl';

// Constants - getTeamColor is used by ShlGameModal

// Utils
import { formatSwedishDate } from '../utils';

// Hooks
import {
    usePreferences,
    useShlData,
    useFootballData,
    useBiathlonData,
    useUnifiedData,
    usePushNotifications
} from '../hooks';

// Components
import {
    SportPicker,
    StandingsTable,
    ViewToggle,
    SeasonPicker,
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
    const football = useFootballData(activeSport, selectedFootballTeams, { eagerLoad: true });
    const biathlon = useBiathlonData(activeSport, selectedNations, selectedGenders, { eagerLoad: true });

    // Unified data combining all sports
    const unified = useUnifiedData(shl, football, biathlon);

    // Push notifications
    const {
        notificationsEnabled,
        goalNotificationsEnabled,
        hasPermission: hasNotificationPermission,
        toggleNotifications,
        toggleGoalNotifications,
        requestPermission: requestNotificationPermission,
        setTeamTags,
        // Pre-game notification state and toggles
        preGameShlEnabled,
        preGameFootballEnabled,
        preGameBiathlonEnabled,
        togglePreGameShl,
        togglePreGameFootball,
        togglePreGameBiathlon
    } = usePushNotifications();

    const router = useRouter();
    const { sport: routeSport, gameId: routeGameId } = useLocalSearchParams();
    const deepLinkParams = useMemo(() => {
        const sportParam = normalizeRouteParam(routeSport);
        const gameIdParam = normalizeRouteParam(routeGameId);

        if (!sportParam || !gameIdParam) {
            return null;
        }

        return { sport: sportParam, gameId: gameIdParam };
    }, [routeSport, routeGameId]);

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);

    // SHL game modal tab state
    const [shlActiveTab, setShlActiveTab] = useState('summary');

    // Track if we've processed a pending deep link
    const processedDeepLinkRef = useRef(null);

    // Handle notification clicks and deep links to open games
    useEffect(() => {
        // Parse deep link URL to extract game info
        const parseGameDeepLink = (url) => {
            if (!url) {
                return null;
            }
            // Handle gamepulse://game/{sport}/{gameId}
            const match = url.match(/gamepulse:\/\/game\/(\w+)\/(.+)/);
            if (match) {
                return { sport: match[1], gameId: match[2] };
            }
            return null;
        };

        // Open a game by ID
        const openGameById = (sport, gameId) => {
            // Prevent processing the same deep link twice
            const linkKey = `${sport}:${gameId}`;
            if (processedDeepLinkRef.current === linkKey) {
                return;
            }
            processedDeepLinkRef.current = linkKey;

            // Clear after a short delay to allow re-opening if needed
            setTimeout(() => {
                processedDeepLinkRef.current = null;
            }, 2000);

            console.log('[DeepLink] Opening game:', sport, gameId);

            if (sport === 'shl') {
                // Find the game in SHL games list
                const game = shl.games.find(g => g.uuid === gameId);
                if (game) {
                    handleSportChange('shl');
                    setShlActiveTab('summary');
                    shl.handleGamePress(game);
                } else {
                    // Game not in list yet, try to open anyway with minimal data
                    console.log('[DeepLink] SHL game not found in list, opening with ID');
                    handleSportChange('shl');
                    setShlActiveTab('summary');
                    shl.handleGamePress({ uuid: gameId });
                }
            } else if (sport === 'allsvenskan' || sport === 'football') {
                const game = football.games.find(g => g.uuid === gameId);
                if (game) {
                    handleSportChange('football');
                    football.handleGamePress(game);
                } else {
                    console.log('[DeepLink] Football game not found in list');
                    handleSportChange('football');
                    football.handleGamePress({ uuid: gameId });
                }
            }
        };

        if (deepLinkParams) {
            openGameById(deepLinkParams.sport, deepLinkParams.gameId);
            router.replace('/');
        }

        // Handle notification click events (native only)
        const handleNotificationClick = (event) => {
            console.log('[Notification] Clicked:', event);
            const data = event.notification?.additionalData;
            if (data?.type === 'goal' && data?.gameId && data?.sport) {
                openGameById(data.sport, data.gameId);
            }
        };

        // Listen for notification clicks (native only)
        if (OneSignal) {
            OneSignal.Notifications.addEventListener('click', handleNotificationClick);
        }

        // Handle deep link when app is already open
        const handleDeepLink = (event) => {
            const gameInfo = parseGameDeepLink(event.url);
            if (gameInfo) {
                openGameById(gameInfo.sport, gameInfo.gameId);
            }
        };

        // Check if app was opened with a deep link
        Linking.getInitialURL().then(url => {
            if (url) {
                const gameInfo = parseGameDeepLink(url);
                if (gameInfo) {
                    // Wait a bit for data to load before opening
                    setTimeout(() => {
                        openGameById(gameInfo.sport, gameInfo.gameId);
                    }, 1000);
                }
            }
        });

        // Listen for deep links while app is open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        return () => {
            if (OneSignal) {
                OneSignal.Notifications.removeEventListener('click', handleNotificationClick);
            }
            subscription?.remove();
        };
    }, [
        shl.games,
        football.games,
        shl.handleGamePress,
        football.handleGamePress,
        handleSportChange,
        deepLinkParams,
        router
    ]);

    // Unified refresh handler
    const onRefresh = useCallback(() => {
        if (activeSport === 'all') {
            unified.onRefresh();
        } else if (activeSport === 'shl') {
            shl.onRefresh();
        } else if (activeSport === 'football') {
            football.onRefresh();
        } else if (activeSport === 'biathlon') {
            biathlon.onRefresh();
        }
    }, [activeSport, shl, football, biathlon, unified]);

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
                    activeSport === 'shl' ? shl.listRef :
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
        : activeSport === 'shl'
            ? shl.refreshing
            : activeSport === 'football'
                ? football.refreshing
                : biathlon.refreshing;


    // Handle SHL game press - reset tab and open modal
    const handleShlGamePress = useCallback((game) => {
        setShlActiveTab('summary');
        shl.handleGamePress(game);
    }, [shl]);

    // Render sport picker
    const renderSportPicker = () => (
        <SportPicker activeSport={activeSport} onSportChange={handleSportChange} />
    );

    // Render SHL schedule - start at the most recent/current game
    const renderShlSchedule = () => (
        <FlatList
            ref={shl.listRef}
            data={shl.games}
            renderItem={({ item }) => <GameCard game={item} onPress={() => handleShlGamePress(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            initialScrollIndex={shl.effectiveInitialScrollIndex}
            getItemLayout={getShlItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={shl.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No games found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="snow-outline" title="SHL" count={shl.games.length} countLabel="games" />
            }
        />
    );

    // Render SHL standings
    const renderShlStandings = () => {
        const seasonLabel = shl.standings?.season ? String(shl.standings.season) : null;
        const seasonOptions = Array.isArray(shl.standings?.availableSeasons)
            ? shl.standings.availableSeasons.map(value => String(value))
            : (seasonLabel ? [seasonLabel] : []);
        const lastUpdatedLabel = shl.standings?.lastUpdated
            ? formatSwedishDate(shl.standings.lastUpdated, 'd MMM HH:mm')
            : null;
        const gamesAnalyzed = shl.standings?.gamesAnalyzed;
        const standingsRows = Array.isArray(shl.standings?.standings) ? shl.standings.standings : [];

        return (
            <View style={styles.scheduleContainer}>
                <View style={styles.stickyToggle}>
                    <ViewToggle mode={shl.viewMode} onChange={shl.handleViewChange} />
                    <LinearGradient
                        colors={['#000000', 'transparent']}
                        style={styles.toggleGradient}
                        pointerEvents="none"
                    />
                </View>
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                >
                    <View style={styles.standingsHeader}>
                        <View style={styles.standingsHeaderRow}>
                            <Ionicons name="stats-chart" size={20} color="#0A84FF" />
                            <Text style={styles.standingsTitle}>SHL Table</Text>
                            <Text style={styles.standingsCount}>{standingsRows.length} teams</Text>
                        </View>
                        <SeasonPicker seasons={seasonOptions} selectedSeason={seasonLabel} onSelect={null} />
                        <View style={styles.standingsMetaRow}>
                            {lastUpdatedLabel && (
                                <Text style={styles.standingsMetaText}>Updated {lastUpdatedLabel}</Text>
                            )}
                        </View>
                    </View>

                    {shl.loadingStandings ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 24 }} />
                    ) : (
                        <StandingsTable
                            standings={standingsRows}
                            selectedTeams={selectedTeams}
                            sport="shl"
                            getTeamKey={(team) => team.teamCode || team.teamShortName}
                            getTeamLogo={(team) => {
                                const teamCode = team.teamCode || team.teamShortName;
                                return teamCode ? getTeamLogoUrl(teamCode) : team.teamIcon || null;
                            }}
                        />
                    )}
                </ScrollView>
            </View>
        );
    };

    // Render Football schedule - start at the most recent/current match
    const renderFootballSchedule = () => (
        <FlatList
            ref={football.listRef}
            data={football.games}
            renderItem={({ item }) => <FootballGameCard game={item} onPress={() => football.handleGamePress(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            initialScrollIndex={football.effectiveInitialScrollIndex}
            getItemLayout={getFootballItemLayout}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={football.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No matches found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="football-outline" title="Allsvenskan" count={football.games.length} countLabel="matches" />
            }
        />
    );

    // Render Football standings
    const renderFootballStandings = () => {
        const seasonLabel = football.activeSeason ? String(football.activeSeason) : null;
        const lastUpdatedLabel = football.standings?.lastUpdated
            ? formatSwedishDate(football.standings.lastUpdated, 'd MMM HH:mm')
            : null;
        const standingsRows = Array.isArray(football.standings?.standings) ? football.standings.standings : [];

        return (
            <View style={styles.scheduleContainer}>
                <View style={styles.stickyToggle}>
                    <ViewToggle mode={football.viewMode} onChange={football.handleViewChange} />
                    <LinearGradient
                        colors={['#000000', 'transparent']}
                        style={styles.toggleGradient}
                        pointerEvents="none"
                    />
                </View>
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                >
                    <View style={styles.standingsHeader}>
                        <View style={styles.standingsHeaderRow}>
                            <Ionicons name="football-outline" size={20} color="#0A84FF" />
                            <Text style={styles.standingsTitle}>Allsvenskan Table</Text>
                            <Text style={styles.standingsCount}>{standingsRows.length} teams</Text>
                        </View>
                        <SeasonPicker
                            seasons={football.seasonOptions}
                            selectedSeason={seasonLabel}
                            onSelect={football.handleSeasonSelect}
                            variant="dropdown"
                        />
                        <View style={styles.standingsMetaRow}>
                            {lastUpdatedLabel && (
                                <Text style={styles.standingsMetaText}>Updated {lastUpdatedLabel}</Text>
                            )}
                        </View>
                    </View>

                    {football.loadingStandings ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 24 }} />
                    ) : (
                        <StandingsTable
                            standings={standingsRows}
                            selectedTeams={selectedFootballTeams}
                            sport="football"
                            getTeamKey={football.getStandingsTeamKey}
                            getTeamLogo={(team) => team.teamIcon || null}
                        />
                    )}
                </ScrollView>
            </View>
        );
    };

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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            initialScrollIndex={biathlon.effectiveInitialScrollIndex}
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

    // Render Biathlon standings
    const renderBiathlonStandings = () => {
        const seasonLabel = biathlon.standings?.season || null;
        const typeName = biathlon.standings?.typeName || 'World Cup Overall';
        const availableTypes = biathlon.standings?.availableTypes || [];
        const categories = biathlon.standings?.categories || [];
        const lastUpdatedLabel = biathlon.standings?.lastUpdated
            ? formatSwedishDate(biathlon.standings.lastUpdated, 'd MMM HH:mm')
            : null;

        // Filter to selected gender
        const selectedCategory = categories.find(c => c.gender === biathlon.standingsGender) || categories[0];

        return (
            <View style={styles.scheduleContainer}>
                <View style={styles.stickyToggle}>
                    <ViewToggle mode={biathlon.viewMode} onChange={biathlon.handleViewChange} />
                    <LinearGradient
                        colors={['#000000', 'transparent']}
                        style={styles.toggleGradient}
                        pointerEvents="none"
                    />
                </View>
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                >
                    <View style={styles.standingsHeader}>
                        <View style={styles.standingsHeaderRow}>
                            <Ionicons name="trophy-outline" size={20} color="#0A84FF" />
                            <Text style={styles.standingsTitle}>{typeName}</Text>
                            {seasonLabel && <Text style={styles.standingsCount}>{seasonLabel}</Text>}
                        </View>
                        {/* Gender toggle */}
                        <View style={styles.biathlonGenderPicker}>
                            <TouchableOpacity
                                style={[
                                    styles.biathlonGenderButton,
                                    biathlon.standingsGender === 'men' && styles.biathlonGenderButtonActive
                                ]}
                                onPress={() => biathlon.handleStandingsGenderChange('men')}
                            >
                                <Text style={[
                                    styles.biathlonGenderText,
                                    biathlon.standingsGender === 'men' && styles.biathlonGenderTextActive
                                ]}>
                                    Men
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.biathlonGenderButton,
                                    biathlon.standingsGender === 'women' && styles.biathlonGenderButtonActive
                                ]}
                                onPress={() => biathlon.handleStandingsGenderChange('women')}
                            >
                                <Text style={[
                                    styles.biathlonGenderText,
                                    biathlon.standingsGender === 'women' && styles.biathlonGenderTextActive
                                ]}>
                                    Women
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {/* Standings type picker */}
                        <View style={styles.biathlonTypePicker}>
                            {availableTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.biathlonTypeButton,
                                        biathlon.standingsType === type && styles.biathlonTypeButtonActive
                                    ]}
                                    onPress={() => biathlon.handleStandingsTypeChange(type)}
                                >
                                    <Text style={[
                                        styles.biathlonTypeText,
                                        biathlon.standingsType === type && styles.biathlonTypeTextActive
                                    ]}>
                                        {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.standingsMetaRow}>
                            {lastUpdatedLabel && (
                                <Text style={styles.standingsMetaText}>Updated {lastUpdatedLabel}</Text>
                            )}
                        </View>
                    </View>

                    {biathlon.loadingStandings ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 24 }} />
                    ) : selectedCategory ? (
                        <View style={styles.biathlonStandingsCategory}>
                            <View style={styles.biathlonCategoryHeader}>
                                <Text style={styles.biathlonCategoryTitle}>{selectedCategory.genderDisplay}</Text>
                                <Text style={styles.biathlonCategoryCount}>
                                    {selectedCategory.standings?.length || 0} athletes
                                </Text>
                            </View>
                            {selectedCategory.standings?.slice(0, 30).map((athlete, index) => (
                                <View key={athlete.athleteId || index} style={styles.biathlonAthleteRow}>
                                    <Text style={[
                                        styles.biathlonRank,
                                        athlete.rank <= 3 && styles.biathlonRankTop
                                    ]}>
                                        {athlete.rank}
                                    </Text>
                                    <Text style={styles.biathlonNationFlag}>{getNationFlag(athlete.nation)}</Text>
                                    <Text style={styles.biathlonName} numberOfLines={1}>{athlete.name}</Text>
                                    <Text style={styles.biathlonPoints}>{athlete.points} pts</Text>
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

    // Get item layout for unified list (mixed heights)
    const getUnifiedItemLayout = useCallback((data, index) => {
        // Estimate: headers are smaller than cards
        const item = data?.[index];
        const height = item?.type === 'header' ? SECTION_HEADER_HEIGHT : UNIFIED_CARD_HEIGHT;
        return {
            length: height,
            offset: index * UNIFIED_CARD_HEIGHT, // Rough estimate for offset
            index
        };
    }, []);

    // Render Unified schedule - all sports combined
    const renderUnifiedSchedule = () => (
        <FlatList
            ref={unified.listRef}
            data={unified.flatListData}
            renderItem={renderUnifiedItem}
            keyExtractor={unifiedKeyExtractor}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={unified.refreshing} onRefresh={unified.onRefresh} tintColor="#fff" />}
            onScroll={unified.handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            windowSize={15}
            ListEmptyComponent={<EmptyState message="No events found." />}
            ListHeaderComponent={
                <ScheduleHeader
                    icon="grid-outline"
                    title="All Events"
                    count={unified.stats.total}
                    countLabel="events"
                />
            }
        />
    );

    // Main render
    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <LinearGradient colors={['#000000', '#121212']} style={StyleSheet.absoluteFill} />

            {/* Header with gradient fade */}
            <View style={styles.headerContainer}>
                <View style={styles.header}>
                    {renderSportPicker()}
                    <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
                        <Ionicons name="settings-outline" size={16} color="#888" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sport-specific content */}
            {activeSport === 'all' ? (
                <View style={styles.scheduleContainer}>
                    {unified.loading ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        renderUnifiedSchedule()
                    )}
                </View>
            ) : activeSport === 'shl' ? (
                shl.viewMode === 'standings' ? (
                    renderShlStandings()
                ) : (
                    <View style={styles.scheduleContainer}>
                        <View style={styles.stickyToggle}>
                            <ViewToggle mode={shl.viewMode} onChange={shl.handleViewChange} />
                            <LinearGradient
                                colors={['#000000', 'transparent']}
                                style={styles.toggleGradient}
                                pointerEvents="none"
                            />
                        </View>
                        {shl.loading ? (
                            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                        ) : (
                            renderShlSchedule()
                        )}
                    </View>
                )
            ) : activeSport === 'football' ? (
                football.viewMode === 'standings' ? (
                    renderFootballStandings()
                ) : (
                    <View style={styles.scheduleContainer}>
                        <View style={styles.stickyToggle}>
                            <ViewToggle mode={football.viewMode} onChange={football.handleViewChange} />
                            <LinearGradient
                                colors={['#000000', 'transparent']}
                                style={styles.toggleGradient}
                                pointerEvents="none"
                            />
                        </View>
                        {football.loading ? (
                            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                        ) : (
                            renderFootballSchedule()
                        )}
                    </View>
                )
            ) : (
                biathlon.viewMode === 'standings' ? (
                    renderBiathlonStandings()
                ) : (
                    <View style={styles.scheduleContainer}>
                        <View style={styles.stickyToggle}>
                            <ViewToggle mode={biathlon.viewMode} onChange={biathlon.handleViewChange} />
                            <LinearGradient
                                colors={['#000000', 'transparent']}
                                style={styles.toggleGradient}
                                pointerEvents="none"
                            />
                        </View>
                        {biathlon.loading ? (
                            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
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
            />

            {/* Football Match Modal */}
            <FootballMatchModal
                match={football.selectedGame}
                details={football.gameDetails}
                visible={!!football.selectedGame}
                loading={football.loadingDetails}
                onClose={football.closeModal}
                onRefresh={football.refreshModalDetails}
                refreshing={football.refreshingModal}
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
                teams={shl.teams}
                selectedTeams={selectedTeams}
                onToggleTeam={(teamCode) => {
                    toggleTeamFilter(teamCode);
                    // Update OneSignal tags with all teams from both sports
                    const newShlTeams = selectedTeams.includes(teamCode)
                        ? selectedTeams.filter(t => t !== teamCode)
                        : [...selectedTeams, teamCode];
                    setTeamTags([...newShlTeams, ...selectedFootballTeams]);
                }}
                onClearTeams={() => {
                    clearTeamFilter();
                    setTeamTags([...selectedFootballTeams]);
                }}
                footballTeams={football.teams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={(teamKey) => {
                    toggleFootballTeamFilter(teamKey);
                    // Update OneSignal tags with all teams from both sports
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
                selectedNations={selectedNations}
            />

            {/* Onboarding Modal */}
            <OnboardingModal
                visible={showOnboarding}
                step={onboardingStep}
                onStepChange={setOnboardingStep}
                onComplete={() => {
                    // Sync all team tags to OneSignal when onboarding completes
                    setTeamTags([...selectedTeams, ...selectedFootballTeams]);
                    completeOnboarding();
                }}
                teams={shl.teams}
                selectedTeams={selectedTeams}
                onToggleTeam={(teamCode) => {
                    toggleTeamFilter(teamCode);
                    // Update OneSignal tags with all teams from both sports
                    const newShlTeams = selectedTeams.includes(teamCode)
                        ? selectedTeams.filter(t => t !== teamCode)
                        : [...selectedTeams, teamCode];
                    setTeamTags([...newShlTeams, ...selectedFootballTeams]);
                }}
                footballTeams={football.teams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={(teamKey) => {
                    toggleFootballTeamFilter(teamKey);
                    // Update OneSignal tags with all teams from both sports
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
    biathlonGenderButtonActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderColor: '#0A84FF'
    },
    biathlonGenderText: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '600'
    },
    biathlonGenderTextActive: {
        color: '#0A84FF'
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
    biathlonTypeButtonActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderColor: '#0A84FF'
    },
    biathlonTypeText: {
        color: '#8e8e93',
        fontSize: 11,
        fontWeight: '600'
    },
    biathlonTypeTextActive: {
        color: '#0A84FF'
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
    biathlonRankTop: {
        color: '#FFD700'
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
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '700',
        minWidth: 60,
        textAlign: 'right'
    }
});
