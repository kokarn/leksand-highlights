import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// API
import { getTeamLogoUrl } from '../api/shl';

// Constants - getTeamColor is used by ShlGameModal

// Utils
import { formatSwedishDate } from '../utils';

// Hooks
import {
    usePreferences,
    useShlData,
    useFootballData,
    useBiathlonData
} from '../hooks';

// Components
import {
    SportTab,
    StandingsTable,
    ViewToggle,
    SeasonPicker,
    ScheduleHeader,
    EmptyState
} from '../components';

import { GameCard, FootballGameCard, BiathlonRaceCard } from '../components/cards';
import {
    RaceModal,
    FootballMatchModal,
    SettingsModal,
    OnboardingModal,
    ShlGameModal
} from '../components/modals';

// Constants for scroll layout
const GAME_CARD_HEIGHT = 160;
const FOOTBALL_CARD_HEIGHT = 160;
const BIATHLON_CARD_HEIGHT = 140;
const LIST_HEADER_HEIGHT = 50; // Just the ScheduleHeader height (no ViewToggle in FlatList)

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

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);

    // SHL game modal tab state
    const [shlActiveTab, setShlActiveTab] = useState('summary');

    // Unified refresh handler
    const onRefresh = useCallback(() => {
        if (activeSport === 'shl') {
            shl.onRefresh();
        } else if (activeSport === 'football') {
            football.onRefresh();
        } else if (activeSport === 'biathlon') {
            biathlon.onRefresh();
        }
    }, [activeSport, shl, football, biathlon]);

    // Get current refreshing state
    const refreshing = activeSport === 'shl'
        ? shl.refreshing
        : activeSport === 'football'
            ? football.refreshing
            : biathlon.refreshing;

    // FlatList layout helpers
    const getGameItemLayout = useCallback((_, index) => ({
        length: GAME_CARD_HEIGHT,
        offset: LIST_HEADER_HEIGHT + (GAME_CARD_HEIGHT * index),
        index
    }), []);

    const getFootballItemLayout = useCallback((_, index) => ({
        length: FOOTBALL_CARD_HEIGHT,
        offset: LIST_HEADER_HEIGHT + (FOOTBALL_CARD_HEIGHT * index),
        index
    }), []);

    const getBiathlonItemLayout = useCallback((_, index) => ({
        length: BIATHLON_CARD_HEIGHT,
        offset: LIST_HEADER_HEIGHT + (BIATHLON_CARD_HEIGHT * index),
        index
    }), []);

    const handleScrollToIndexFailed = useCallback((info) => {
        const offset = info.averageItemLength * info.index;
        setTimeout(() => {
            shl.listRef.current?.scrollToOffset({ offset, animated: false });
        }, 50);
    }, [shl.listRef]);

    const handleFootballScrollToIndexFailed = useCallback((info) => {
        const offset = info.averageItemLength * info.index;
        setTimeout(() => {
            football.listRef.current?.scrollToOffset({ offset, animated: false });
        }, 50);
    }, [football.listRef]);

    const handleBiathlonScrollToIndexFailed = useCallback((info) => {
        const offset = info.averageItemLength * info.index;
        setTimeout(() => {
            biathlon.listRef.current?.scrollToOffset({ offset, animated: false });
        }, 50);
    }, [biathlon.listRef]);

    // Handle SHL game press - reset tab and open modal
    const handleShlGamePress = useCallback((game) => {
        setShlActiveTab('summary');
        shl.handleGamePress(game);
    }, [shl]);

    // Render sport tabs
    const renderSportTabs = () => (
        <View style={styles.sportTabsContainer}>
            <SportTab sport="shl" isActive={activeSport === 'shl'} onPress={() => handleSportChange('shl')} />
            <SportTab sport="football" isActive={activeSport === 'football'} onPress={() => handleSportChange('football')} />
            <SportTab sport="biathlon" isActive={activeSport === 'biathlon'} onPress={() => handleSportChange('biathlon')} />
        </View>
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
            onScrollToIndexFailed={handleScrollToIndexFailed}
            getItemLayout={getGameItemLayout}
            initialScrollIndex={shl.targetGameIndex > 0 ? shl.targetGameIndex : undefined}
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
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            >
                <ViewToggle mode={shl.viewMode} onChange={shl.handleViewChange} />
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
                        {Number.isFinite(gamesAnalyzed) && (
                            <Text style={styles.standingsMetaText}>Analyzed {gamesAnalyzed} games</Text>
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
            onScrollToIndexFailed={handleFootballScrollToIndexFailed}
            getItemLayout={getFootballItemLayout}
            initialScrollIndex={football.targetGameIndex > 0 ? football.targetGameIndex : undefined}
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
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            >
                <ViewToggle mode={football.viewMode} onChange={football.handleViewChange} />
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
        );
    };

    // Render Biathlon schedule - start at the most recent/current race
    const renderBiathlonSchedule = () => (
        <FlatList
            ref={biathlon.listRef}
            data={biathlon.races}
            renderItem={({ item }) => <BiathlonRaceCard race={item} onPress={() => biathlon.handleRacePress(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            onScrollToIndexFailed={handleBiathlonScrollToIndexFailed}
            getItemLayout={getBiathlonItemLayout}
            initialScrollIndex={biathlon.targetRaceIndex > 0 ? biathlon.targetRaceIndex : undefined}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={<EmptyState message="No races found." />}
            ListHeaderComponent={
                <ScheduleHeader icon="calendar-outline" title="All Races" count={biathlon.races.length} countLabel="races" />
            }
        />
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
                shl.viewMode === 'standings' ? (
                    renderShlStandings()
                ) : (
                    <View style={styles.scheduleContainer}>
                        <View style={styles.stickyToggle}>
                            <ViewToggle mode={shl.viewMode} onChange={shl.handleViewChange} />
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
                        </View>
                        {football.loading ? (
                            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                        ) : (
                            renderFootballSchedule()
                        )}
                    </View>
                )
            ) : (
                <View style={styles.scheduleContainer}>
                    {biathlon.loading ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        renderBiathlonSchedule()
                    )}
                </View>
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
            />

            {/* Football Match Modal */}
            <FootballMatchModal
                match={football.selectedGame}
                details={football.gameDetails}
                visible={!!football.selectedGame}
                loading={football.loadingDetails}
                onClose={football.closeModal}
            />

            {/* Biathlon Race Modal */}
            <RaceModal
                race={biathlon.selectedRace}
                details={biathlon.raceDetails}
                loading={biathlon.loadingDetails}
                visible={!!biathlon.selectedRace}
                onClose={biathlon.closeModal}
            />

            {/* Settings Modal */}
            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                teams={shl.teams}
                selectedTeams={selectedTeams}
                onToggleTeam={toggleTeamFilter}
                onClearTeams={clearTeamFilter}
                footballTeams={football.teams}
                selectedFootballTeams={selectedFootballTeams}
                onToggleFootballTeam={toggleFootballTeamFilter}
                onClearFootballTeams={clearFootballTeamFilter}
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
            />

            {/* Onboarding Modal */}
            <OnboardingModal
                visible={showOnboarding}
                step={onboardingStep}
                onStepChange={setOnboardingStep}
                onComplete={completeOnboarding}
                teams={shl.teams}
                selectedTeams={selectedTeams}
                onToggleTeam={toggleTeamFilter}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12
    },
    settingsButton: {
        padding: 8
    },
    sportTabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        flex: 1
    },
    scheduleContainer: {
        flex: 1
    },
    stickyToggle: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: '#000'
    },
    listContent: {
        padding: 16,
        paddingTop: 8
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
    }
});
