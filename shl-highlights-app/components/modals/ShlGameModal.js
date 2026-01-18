import { View, Text, Image, Modal, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

/**
 * SHL Game Modal with Summary, Events, and Highlights tabs
 */
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
    const homeColor = getTeamColor(homeCode);
    const awayColor = getTeamColor(awayCode);

    // Summary Tab Content
    const renderSummaryTab = () => {
        if (!gameDetails || !processedData) {
            return <Text style={styles.emptyText}>No data available</Text>;
        }

        const { sog, pp, pim } = processedData;

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
                                            onTabChange('highlights');
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
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.scoreHeader}>
                                <View style={styles.scoreTeam}>
                                    <Image
                                        source={{ uri: getTeamLogoUrl(homeCode) }}
                                        style={styles.scoreTeamLogo}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.scoreTeamCode}>{homeCode}</Text>
                                </View>
                                <View style={styles.scoreCenterBlock}>
                                    <Text style={styles.scoreLarge}>
                                        {scoreDisplay.home} - {scoreDisplay.away}
                                    </Text>
                                    <Text style={styles.gameStateText}>
                                        {game.state === 'post-game' ? 'Final' : game.state}
                                    </Text>
                                    {game.state === 'pre-game' && game.startDateTime && (
                                        <Text style={styles.gameDateText}>
                                            {formatSwedishDate(game.startDateTime, 'd MMMM HH:mm')}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.scoreTeam}>
                                    <Image
                                        source={{ uri: getTeamLogoUrl(awayCode) }}
                                        style={styles.scoreTeamLogo}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.scoreTeamCode}>{awayCode}</Text>
                                </View>
                            </View>
                        </View>

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

                        {/* Tab Content */}
                        {loading ? (
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
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    modalHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    scoreHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20
    },
    scoreTeam: {
        alignItems: 'center',
        width: 80
    },
    scoreTeamLogo: {
        width: 50,
        height: 50,
        marginBottom: 4
    },
    scoreTeamCode: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700'
    },
    scoreCenterBlock: {
        alignItems: 'center',
        marginHorizontal: 20
    },
    scoreLarge: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    gameStateText: {
        color: '#888',
        fontSize: 14,
        marginTop: 4,
        textTransform: 'uppercase'
    },
    gameDateText: {
        color: '#aaa',
        fontSize: 13,
        marginTop: 4
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
    }
});
