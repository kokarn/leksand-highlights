import { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, ActivityIndicator, StyleSheet, Animated, Dimensions, Platform, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { getTeamLogoUrl, fetchStandings } from '../../api/shl';
import { getTeamColor } from '../../constants';
import { getVideoDisplayTitle, formatSwedishDate } from '../../utils';
import { useGameDetails } from '../../hooks/useGameDetails';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useTheme } from '../../contexts/ThemeContext';
import { TabButton } from '../TabButton';
import { StatBar } from '../StatBar';
import { StandingsTable } from '../StandingsTable';
import { VideoCard } from '../cards';
import { GoalItem, PenaltyItem, GoalkeeperItem, TimeoutItem, PeriodMarker } from '../events';
import { VideoPlayer } from '../VideoPlayer';
import { GameModalHeader } from './GameModalHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * SHL Game Modal with Summary, Events, Highlights, and Standings tabs
 */
const TABS = ['summary', 'events', 'highlights', 'standings'];
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;

const pickDisplayText = (...values) => {
    for (const value of values) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
            continue;
        }
        if (value !== null && value !== undefined) {
            return String(value);
        }
    }
    return '';
};

const normalizeGameState = (state) => {
    const normalized = String(state || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');

    if (normalized === 'pregame' || normalized === 'pre-game') {
        return 'pre-game';
    }
    if (normalized === 'postgame' || normalized === 'post-game') {
        return 'post-game';
    }
    if (
        normalized === 'live'
        || normalized === 'ongoing'
        || normalized === 'inprogress'
        || normalized === 'in-progress'
    ) {
        return 'live';
    }

    return normalized || '-';
};

export const ShlGameModal = ({
    game,
    gameDetails,
    videos = [],
    visible,
    loading,
    onClose,
    activeTab,
    onTabChange,
    onRefresh,
    refreshing = false,
    selectedTeams = []
}) => {
    const { colors } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const useCompactTabs = windowWidth <= 430;
    const { processedData, scoreDisplay, events, goals, getGoalVideoId } = useGameDetails(gameDetails, game, videos);
    const {
        playingVideoId,
        playingVideoDetails,
        loadingVideoDetails,
        playVideo,
        stopVideo
    } = useVideoPlayer();

    const [standingsData, setStandingsData] = useState(null);
    const [loadingStandings, setLoadingStandings] = useState(false);
    const [refreshingStandings, setRefreshingStandings] = useState(false);

    const loadStandings = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingStandings(true);
        } else {
            setRefreshingStandings(true);
        }
        try {
            const data = await fetchStandings();
            setStandingsData(data);
        } catch (e) {
            console.error('Failed to load standings', e);
        } finally {
            setLoadingStandings(false);
            setRefreshingStandings(false);
        }
    }, []);

    useEffect(() => {
        if (visible && activeTab === 'standings' && !standingsData) {
            loadStandings();
        }
    }, [visible, activeTab, standingsData, loadStandings]);

    const translateX = useRef(new Animated.Value(0)).current;
    const themedStyles = createStyles(colors);

    const handleGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        { useNativeDriver: Platform.OS !== 'web' }
    );

    const handleGestureStateChange = ({ nativeEvent }) => {
        if (nativeEvent.state === State.END) {
            const { translationX: tx, velocityX } = nativeEvent;
            const currentIndex = TABS.indexOf(activeTab);

            let shouldSwipe = false;
            let direction = 0;

            // Determine if swipe should happen
            if (Math.abs(tx) > SWIPE_THRESHOLD || Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD) {
                direction = tx > 0 ? -1 : 1; // Swipe right = go left (previous), swipe left = go right (next)
                const nextIndex = currentIndex + direction;
                if (nextIndex >= 0 && nextIndex < TABS.length) {
                    shouldSwipe = true;
                }
            }

            if (shouldSwipe) {
                // Animate out, then change tab
                Animated.timing(translateX, {
                    toValue: -direction * SCREEN_WIDTH,
                    duration: 150,
                    useNativeDriver: Platform.OS !== 'web'
                }).start(() => {
                    handleTabChange(TABS[currentIndex + direction]);
                    translateX.setValue(direction * SCREEN_WIDTH);
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: Platform.OS !== 'web',
                        tension: 100,
                        friction: 12
                    }).start();
                });
            } else {
                // Spring back
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: Platform.OS !== 'web',
                    tension: 100,
                    friction: 12
                }).start();
            }
        }
    };

    const handleClose = () => {
        stopVideo();
        onClose();
    };

    const handleTabChange = (tab) => {
        if (activeTab === 'highlights' && tab !== 'highlights') {
            stopVideo();
        }
        onTabChange(tab);
    };

    const currentlyPlayingVideo = videos.find(v => v.id === playingVideoId);
    const detailsHomeTeam = gameDetails?.info?.homeTeam || null;
    const detailsAwayTeam = gameDetails?.info?.awayTeam || null;

    const homeCode = pickDisplayText(
        game?.homeTeamInfo?.code,
        detailsHomeTeam?.names?.code,
        detailsHomeTeam?.names?.codeSite
    ) || null;
    const awayCode = pickDisplayText(
        game?.awayTeamInfo?.code,
        detailsAwayTeam?.names?.code,
        detailsAwayTeam?.names?.codeSite
    ) || null;

    const homeName = pickDisplayText(
        game?.homeTeamInfo?.names?.short,
        detailsHomeTeam?.names?.short,
        detailsHomeTeam?.names?.long,
        detailsHomeTeam?.names?.code,
        homeCode,
        'Home'
    );
    const awayName = pickDisplayText(
        game?.awayTeamInfo?.names?.short,
        detailsAwayTeam?.names?.short,
        detailsAwayTeam?.names?.long,
        detailsAwayTeam?.names?.code,
        awayCode,
        'Away'
    );

    const homeLogo = homeCode ? getTeamLogoUrl(homeCode) : detailsHomeTeam?.icon || null;
    const awayLogo = awayCode ? getTeamLogoUrl(awayCode) : detailsAwayTeam?.icon || null;
    const gameState = normalizeGameState(game?.state || gameDetails?.info?.gameInfo?.state);
    const startDateTime = game?.startDateTime || gameDetails?.info?.gameInfo?.startDateTime || null;

    const homeColor = getTeamColor(homeCode, '#1E88E5');
    const awayColor = getTeamColor(awayCode, '#E53935');

    // Summary Tab Content
    const renderSummaryTab = () => {
        if (!gameDetails || !processedData) {
            return <Text style={themedStyles.emptyText}>No data available</Text>;
        }

        const { sog, pp, pim } = processedData;
        const isPreGame = gameState === 'pre-game';
        const venueName = gameDetails?.venue?.name
            || gameDetails?.info?.gameInfo?.arenaName
            || game?.venue?.name
            || game?.venueInfo?.name
            || '-';
        const stateLabel = gameState === 'post-game'
            ? 'Final'
            : gameState === 'pre-game'
                ? 'Pre-game'
                : gameState || '-';

        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={themedStyles.tabContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    onRefresh ? (
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    ) : undefined
                }
            >
                {!isPreGame && (
                    <View style={themedStyles.sectionCard}>
                        <Text style={themedStyles.sectionTitle}>Match Stats</Text>
                        <StatBar label="Shots" homeValue={sog.home} awayValue={sog.away} homeColor={homeColor} awayColor={awayColor} />
                        <StatBar label="Power Play %" homeValue={pp.home} awayValue={pp.away} homeColor={homeColor} awayColor={awayColor} />
                        <StatBar label="Penalty Min" homeValue={pim.home} awayValue={pim.away} homeColor={homeColor} awayColor={awayColor} />
                    </View>
                )}

                <View style={themedStyles.sectionCard}>
                    <Text style={themedStyles.sectionTitle}>Goals</Text>
                    {goals.length === 0 ? (
                        <Text style={themedStyles.emptyText}>No goals scored</Text>
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
                                            onTabChange('highlights');
                                            playVideo(videos.find(v => v.id === videoId));
                                        }
                                    }}
                                />
                            );
                        })
                    )}
                </View>

                <View style={themedStyles.sectionCard}>
                    <Text style={themedStyles.sectionTitle}>Match Details</Text>
                    <View style={themedStyles.detailRow}>
                        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                        <Text style={themedStyles.detailLabel}>Date</Text>
                        <Text style={themedStyles.detailValue}>{formatSwedishDate(startDateTime, 'd MMMM yyyy')}</Text>
                    </View>
                    <View style={themedStyles.detailRow}>
                        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                        <Text style={themedStyles.detailLabel}>Face-off</Text>
                        <Text style={themedStyles.detailValue}>{formatSwedishDate(startDateTime, 'HH:mm')}</Text>
                    </View>
                    <View style={themedStyles.detailRow}>
                        <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                        <Text style={themedStyles.detailLabel}>Venue</Text>
                        <Text style={themedStyles.detailValue} numberOfLines={2}>{venueName}</Text>
                    </View>
                    <View style={[themedStyles.detailRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="pulse-outline" size={18} color={colors.textSecondary} />
                        <Text style={themedStyles.detailLabel}>Status</Text>
                        <Text style={themedStyles.detailValue}>{stateLabel}</Text>
                    </View>
                </View>
            </ScrollView>
        );
    };

    // Events Tab Content
    const renderEventsTab = () => {
        if (!gameDetails || !processedData) {
            return <Text style={themedStyles.emptyText}>No data available</Text>;
        }

        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={themedStyles.tabContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    onRefresh ? (
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    ) : undefined
                }
            >
                <View style={themedStyles.sectionCard}>
                    <Text style={themedStyles.sectionTitle}>Match Events</Text>
                    {events.length === 0 ? (
                        <Text style={themedStyles.emptyText}>No events available</Text>
                    ) : (
                        events.map((item, idx) => {
                            if (item.type === 'period_marker') {
                                return <PeriodMarker key={`period-${idx}`} period={item.period} />;
                            }
                            if (item.type === 'goal') {
                                const videoId = getGoalVideoId(item);
                                return (
                                    <GoalItem
                                        key={`goal-${idx}`}
                                        goal={item}
                                        homeTeamCode={homeCode}
                                        hasVideo={!!videoId}
                                        onVideoPress={() => {
                                            onTabChange('highlights');
                                            playVideo(videos.find(v => v.id === videoId));
                                        }}
                                    />
                                );
                            }
                            if (item.type === 'penalty') {
                                return <PenaltyItem key={`penalty-${idx}`} penalty={item} homeTeamCode={homeCode} />;
                            }
                            if (item.type === 'goalkeeper') {
                                return <GoalkeeperItem key={`gk-${idx}`} event={item} />;
                            }
                            if (item.type === 'timeout') {
                                return <TimeoutItem key={`timeout-${idx}`} event={item} />;
                            }
                            return null;
                        })
                    )}
                </View>
            </ScrollView>
        );
    };

    // Highlights Tab Content
    const renderHighlightsTab = () => (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={themedStyles.tabContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
                onRefresh ? (
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                ) : undefined
            }
        >
            {currentlyPlayingVideo && (
                <View style={themedStyles.nowPlayingCard}>
                    <View style={themedStyles.nowPlayingHeader}>
                        <Ionicons name="play-circle" size={18} color={colors.accent} />
                        <Text style={themedStyles.nowPlayingLabel}>Now Playing</Text>
                    </View>
                    <Text style={themedStyles.nowPlayingTitle} numberOfLines={2}>
                        {getVideoDisplayTitle(currentlyPlayingVideo)}
                    </Text>
                    <VideoPlayer
                        video={currentlyPlayingVideo}
                        videoDetails={playingVideoDetails}
                        loading={loadingVideoDetails}
                        onClose={stopVideo}
                    />
                </View>
            )}

            <View style={themedStyles.sectionCard}>
                <View style={themedStyles.highlightsTitleHeader}>
                    <Ionicons name="videocam" size={20} color={colors.accent} />
                    <Text style={themedStyles.highlightsSectionTitle}>Match Highlights</Text>
                </View>
                <Text style={themedStyles.highlightsSubtitle}>
                    {videos.length} {videos.length === 1 ? 'clip' : 'clips'} available
                </Text>
                {videos.length === 0 ? (
                    <Text style={themedStyles.emptyText}>No videos available yet.</Text>
                ) : (
                    <View style={themedStyles.videoGrid}>
                        {videos.map((item) => (
                            <VideoCard
                                key={item.id}
                                video={item}
                                isPlaying={playingVideoId === item.id}
                                onPress={() => playVideo(item)}
                            />
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );

    // Standings Tab Content
    const renderStandingsTab = () => {
        const lastUpdatedLabel = standingsData?.lastUpdated
            ? formatSwedishDate(standingsData.lastUpdated, 'd MMM HH:mm')
            : null;
        const standingsRows = Array.isArray(standingsData?.standings) ? standingsData.standings : [];
        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={themedStyles.tabContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshingStandings}
                        onRefresh={() => loadStandings(true)}
                        tintColor={colors.text}
                    />
                }
            >
                <View style={[themedStyles.sectionCard, { marginBottom: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Ionicons name="stats-chart" size={20} color={colors.accent} />
                        <Text style={[themedStyles.sectionTitle, { marginBottom: 0 }]}>SHL Table</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{standingsRows.length} teams</Text>
                    </View>
                    {lastUpdatedLabel && (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>Updated {lastUpdatedLabel}</Text>
                    )}
                </View>
                {loadingStandings ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 24 }} />
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

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView style={themedStyles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                {game && (
                    <>
                        <GameModalHeader
                            homeTeam={{ name: homeName, logo: homeLogo }}
                            awayTeam={{ name: awayName, logo: awayLogo }}
                            homeScore={scoreDisplay.home}
                            awayScore={scoreDisplay.away}
                            state={gameState}
                            startDateTime={startDateTime}
                            onClose={handleClose}
                        />

                        {/* Tab Bar */}
                        <View style={themedStyles.tabBar}>
                            <TabButton
                                title="Summary"
                                compactTitle="Stats"
                                icon="stats-chart"
                                compact={useCompactTabs}
                                isActive={activeTab === 'summary'}
                                onPress={() => handleTabChange('summary')}
                            />
                            <TabButton
                                title="Events"
                                compactTitle="Events"
                                icon="list"
                                compact={useCompactTabs}
                                isActive={activeTab === 'events'}
                                onPress={() => handleTabChange('events')}
                            />
                            <TabButton
                                title="Highlights"
                                compactTitle="Clips"
                                icon="videocam"
                                compact={useCompactTabs}
                                isActive={activeTab === 'highlights'}
                                onPress={() => handleTabChange('highlights')}
                            />
                            <TabButton
                                title="Standings"
                                compactTitle="Table"
                                icon="podium-outline"
                                compact={useCompactTabs}
                                isActive={activeTab === 'standings'}
                                onPress={() => handleTabChange('standings')}
                            />
                        </View>

                        {/* Tab Content with gesture support */}
                        {loading ? (
                            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                        ) : (
                            <PanGestureHandler
                                onGestureEvent={handleGestureEvent}
                                onHandlerStateChange={handleGestureStateChange}
                                activeOffsetX={[-20, 20]}
                                failOffsetY={[-20, 20]}
                            >
                                <Animated.View
                                    style={[
                                        themedStyles.tabContentContainer,
                                        { transform: [{ translateX }] }
                                    ]}
                                >
                                    {activeTab === 'summary' && renderSummaryTab()}
                                    {activeTab === 'events' && renderEventsTab()}
                                    {activeTab === 'highlights' && renderHighlightsTab()}
                                    {activeTab === 'standings' && renderStandingsTab()}
                                </Animated.View>
                            </PanGestureHandler>
                        )}
                    </>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const createStyles = (colors) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder
    },
    tabContentContainer: {
        flex: 1
    },
    tabContent: {
        padding: 16
    },
    sectionCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16
    },
    highlightsTitleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    highlightsSectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 0
    },
    highlightsSubtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        marginBottom: 16
    },
    nowPlayingCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent
    },
    nowPlayingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4
    },
    nowPlayingLabel: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    nowPlayingTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        marginBottom: 12
    },
    videoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 16,
        textAlign: 'center',
        padding: 20
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator
    },
    detailLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        flex: 1
    },
    detailValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right'
    }
});
