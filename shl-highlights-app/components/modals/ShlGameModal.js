import { useRef } from 'react';
import { View, Text, Modal, FlatList, ScrollView, ActivityIndicator, StyleSheet, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { getTeamLogoUrl } from '../../api/shl';
import { getTeamColor } from '../../constants';
import { getVideoDisplayTitle, formatSwedishDate } from '../../utils';
import { useGameDetails } from '../../hooks/useGameDetails';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
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
    onTabChange
}) => {
    const { processedData, scoreDisplay, events, goals, getGoalVideoId } = useGameDetails(gameDetails, game, videos);
    const {
        playingVideoId,
        playingVideoDetails,
        loadingVideoDetails,
        playVideo,
        stopVideo
    } = useVideoPlayer();

    const translateX = useRef(new Animated.Value(0)).current;

    const handleGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        { useNativeDriver: true }
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
                    useNativeDriver: true
                }).start(() => {
                    handleTabChange(TABS[currentIndex + direction]);
                    translateX.setValue(direction * SCREEN_WIDTH);
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 100,
                        friction: 12
                    }).start();
                });
            } else {
                // Spring back
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
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
            return <Text style={styles.emptyText}>No data available</Text>;
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
            <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                {!isPreGame && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Match Stats</Text>
                        <StatBar label="Shots" homeValue={sog.home} awayValue={sog.away} homeColor={homeColor} awayColor={awayColor} />
                        <StatBar label="Power Play %" homeValue={pp.home} awayValue={pp.away} homeColor={homeColor} awayColor={awayColor} />
                        <StatBar label="Penalty Min" homeValue={pim.home} awayValue={pim.away} homeColor={homeColor} awayColor={awayColor} />
                    </View>
                )}

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
                                            onTabChange('highlights');
                                            playVideo(videos.find(v => v.id === videoId));
                                        }
                                    }}
                                />
                            );
                        })
                    )}
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Match Details</Text>
                    <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={18} color="#888" />
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'd MMMM yyyy')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={18} color="#888" />
                        <Text style={styles.detailLabel}>Face-off</Text>
                        <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'HH:mm')}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={18} color="#888" />
                        <Text style={styles.detailLabel}>Venue</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>{venueName}</Text>
                    </View>
                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="pulse-outline" size={18} color="#888" />
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{stateLabel}</Text>
                    </View>
                </View>
            </ScrollView>
        );
    };

    // Events Tab Content
    const renderEventsTab = () => {
        if (!gameDetails || !processedData) {
            return <Text style={styles.emptyText}>No data available</Text>;
        }

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
                                    onTabChange('highlights');
                                    playVideo(videos.find(v => v.id === videoId));
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

    // Highlights Tab Content
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
                        <Text style={styles.nowPlayingTitle} numberOfLines={2}>
                            {getVideoDisplayTitle(currentlyPlayingVideo)}
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.highlightsSubtitle}>
                        {videos.length} {videos.length === 1 ? 'clip' : 'clips'} available
                    </Text>
                )}
            </View>

            {currentlyPlayingVideo && (
                <VideoPlayer
                    video={currentlyPlayingVideo}
                    videoDetails={playingVideoDetails}
                    loading={loadingVideoDetails}
                    onClose={stopVideo}
                />
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

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
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
                        <View style={styles.tabBar}>
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
                            <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                        ) : (
                            <PanGestureHandler
                                onGestureEvent={handleGestureEvent}
                                onHandlerStateChange={handleGestureStateChange}
                                activeOffsetX={[-20, 20]}
                                failOffsetY={[-20, 20]}
                            >
                                <Animated.View
                                    style={[
                                        styles.tabContentContainer,
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

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    tabContentContainer: {
        flex: 1
    },
    tabContent: {
        padding: 16
    },
    sectionCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16
    },
    highlightsTitleBox: {
        padding: 16,
        paddingBottom: 8
    },
    highlightsTitleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    highlightsTitleLabel: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700'
    },
    highlightsSubtitle: {
        color: '#888',
        fontSize: 14
    },
    nowPlayingBox: {
        backgroundColor: '#1c1c1e',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#0A84FF'
    },
    nowPlayingLabel: {
        color: '#0A84FF',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4
    },
    nowPlayingTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20
    },
    videoList: {
        padding: 8
    },
    videoGridRow: {
        justifyContent: 'space-between',
        paddingHorizontal: 8
    },
    emptyText: {
        color: '#666',
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
        borderBottomColor: '#2a2a2a'
    },
    detailLabel: {
        color: '#888',
        fontSize: 14,
        flex: 1
    },
    detailValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right'
    }
});
