import { useRef } from 'react';
import { View, Text, Modal, ScrollView, ActivityIndicator, StyleSheet, Animated, Dimensions, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { getTeamLogoUrl } from '../../api/shl';
import { getTeamColor } from '../../constants';
import { getVideoDisplayTitle, formatSwedishDate } from '../../utils';
import { useGameDetails } from '../../hooks/useGameDetails';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useTheme } from '../../contexts/ThemeContext';
import { TabButton } from '../TabButton';
import { StatBar } from '../StatBar';
import { VideoCard } from '../cards';
import { GoalItem, PenaltyItem, GoalkeeperItem, TimeoutItem, PeriodMarker } from '../events';
import { VideoPlayer } from '../VideoPlayer';
import { GameModalHeader } from './GameModalHeader';

/**
 * SHL Game Modal with Summary, Events, and Highlights tabs
 */
const TABS = ['summary', 'events', 'highlights'];
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;

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
    refreshing = false
}) => {
    const { colors } = useTheme();
    const { processedData, scoreDisplay, events, goals, getGoalVideoId } = useGameDetails(gameDetails, game, videos);
    const {
        playingVideoId,
        playingVideoDetails,
        loadingVideoDetails,
        playVideo,
        stopVideo
    } = useVideoPlayer();

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
    const homeCode = game?.homeTeamInfo?.code;
    const awayCode = game?.awayTeamInfo?.code;
    const homeName = game?.homeTeamInfo?.names?.short ?? homeCode ?? 'Home';
    const awayName = game?.awayTeamInfo?.names?.short ?? awayCode ?? 'Away';
    const homeColor = getTeamColor(homeCode);
    const awayColor = getTeamColor(awayCode);

    // Summary Tab Content
    const renderSummaryTab = () => {
        if (!gameDetails || !processedData) {
            return <Text style={themedStyles.emptyText}>No data available</Text>;
        }

        const { sog, pp, pim } = processedData;
        const isPreGame = game?.state === 'pre-game';
        const venueName = gameDetails?.venue?.name
            || game?.venue?.name
            || game?.venueInfo?.name
            || '-';
        const startDateTime = game?.startDateTime;
        const stateLabel = game?.state === 'post-game'
            ? 'Final'
            : game?.state === 'pre-game'
                ? 'Pre-game'
                : game?.state || '-';

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

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView style={themedStyles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                {game && (
                    <>
                        <GameModalHeader
                            homeTeam={{ name: homeName, logo: homeCode ? getTeamLogoUrl(homeCode) : null }}
                            awayTeam={{ name: awayName, logo: awayCode ? getTeamLogoUrl(awayCode) : null }}
                            homeScore={scoreDisplay.home}
                            awayScore={scoreDisplay.away}
                            state={game.state}
                            startDateTime={game.startDateTime}
                            onClose={handleClose}
                        />

                        {/* Tab Bar */}
                        <View style={themedStyles.tabBar}>
                            <TabButton
                                title="Summary"
                                icon="stats-chart"
                                isActive={activeTab === 'summary'}
                                onPress={() => handleTabChange('summary')}
                            />
                            <TabButton
                                title="Events"
                                icon="list"
                                isActive={activeTab === 'events'}
                                onPress={() => handleTabChange('events')}
                            />
                            <TabButton
                                title="Highlights"
                                icon="videocam"
                                isActive={activeTab === 'highlights'}
                                onPress={() => handleTabChange('highlights')}
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
