import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Image, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

// API
import {
    fetchGames, fetchVideosForGame, fetchGameDetails, fetchVideoDetails, getTeamLogoUrl,
    fetchBiathlonSchedule, fetchBiathlonEvents, fetchBiathlonNations
} from '../api/shl';

// Constants
import { APP_NAME, APP_TAGLINE, STORAGE_KEYS, GENDER_OPTIONS, getTeamColor } from '../constants';

// Utils
import { getVideoDisplayTitle, getStayLiveVideoId } from '../utils';

// Components
import { LogoMark } from '../components/LogoMark';
import { SportTab } from '../components/SportTab';
import { StatBar } from '../components/StatBar';
import { TabButton } from '../components/TabButton';
import { GameCard, BiathlonRaceCard, VideoCard } from '../components/cards';
import { GoalItem, PenaltyItem, GoalkeeperItem, TimeoutItem, PeriodMarker } from '../components/events';
import { RaceModal, SettingsModal, OnboardingModal } from '../components/modals';

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

    // Biathlon state
    const [biathlonRaces, setBiathlonRaces] = useState([]);
    const [biathlonNations, setBiathlonNations] = useState([]);
    const [loadingBiathlon, setLoadingBiathlon] = useState(false);
    const [selectedNations, setSelectedNations] = useState([]);
    const [selectedGenders, setSelectedGenders] = useState([]);
    const [selectedRace, setSelectedRace] = useState(null);

    // Load saved preferences on app start
    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const [savedSport, savedTeams, savedNations, savedGenders, onboardingComplete] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SPORT),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_NATIONS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_GENDERS),
                AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE)
            ]);

            if (savedSport) setActiveSport(savedSport);
            if (savedTeams) setSelectedTeams(JSON.parse(savedTeams));
            if (savedNations) setSelectedNations(JSON.parse(savedNations));
            if (savedGenders) setSelectedGenders(JSON.parse(savedGenders));

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

        const scoreDisplay = {
            home: actualScore.home ?? gameDetails.info?.homeTeam?.score ?? selectedGame.homeTeamResult?.score ?? '-',
            away: actualScore.away ?? gameDetails.info?.awayTeam?.score ?? selectedGame.awayTeamResult?.score ?? '-'
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
        }
    }, [activeSport]);

    // Auto-refresh for live games
    useEffect(() => {
        const hasLiveGame = games.some(g => g.state === 'live');
        let intervalId;
        if (hasLiveGame && activeSport === 'shl') {
            intervalId = setInterval(() => {
                console.log('Auto-refreshing live games...');
                loadGames(true);
            }, 30800);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [games, activeSport]);

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
                fetchBiathlonSchedule(50),
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

    const onRefresh = () => {
        setRefreshing(true);
        if (activeSport === 'shl') {
            loadGames();
        } else {
            loadBiathlonData();
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

    const filteredGames = useMemo(() => {
        return games.filter(game => {
            if (selectedTeams.length > 0) {
                if (!selectedTeams.includes(game.homeTeamInfo.code) && !selectedTeams.includes(game.awayTeamInfo.code)) {
                    return false;
                }
            }
            if (game.state === 'pre-game') return false;
            return true;
        });
    }, [games, selectedTeams]);

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

    const closeModal = () => {
        stopVideo();
        setSelectedGame(null);
        setGameDetails(null);
        setVideos([]);
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
            <SportTab sport="biathlon" isActive={activeSport === 'biathlon'} onPress={() => handleSportChange('biathlon')} />
        </View>
    );

    const renderTeamFilter = () => (
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                <TouchableOpacity
                    style={[styles.filterPill, selectedTeams.length === 0 && styles.filterPillActive]}
                    onPress={clearTeamFilter}
                >
                    <Text style={[styles.filterText, selectedTeams.length === 0 && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                {teams.map(team => (
                    <TouchableOpacity
                        key={team.code}
                        style={[styles.filterPill, styles.filterPillTeam, selectedTeams.includes(team.code) && styles.filterPillActive]}
                        onPress={() => toggleTeamFilter(team.code)}
                    >
                        <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.filterTeamLogo} resizeMode="contain" />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderBiathlonFilters = () => (
        <View style={styles.biathlonFiltersContainer}>
            <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Gender</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
                    <TouchableOpacity
                        style={[styles.filterPillSmall, selectedGenders.length === 0 && styles.filterPillActive]}
                        onPress={clearGenderFilter}
                    >
                        <Text style={[styles.filterTextSmall, selectedGenders.length === 0 && styles.filterTextActive]}>All</Text>
                    </TouchableOpacity>
                    {GENDER_OPTIONS.map(gender => (
                        <TouchableOpacity
                            key={gender.id}
                            style={[
                                styles.filterPillSmall,
                                selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                            ]}
                            onPress={() => toggleGenderFilter(gender.id)}
                        >
                            <Text style={[styles.filterTextSmall, selectedGenders.includes(gender.id) && styles.filterTextActive]}>
                                {gender.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Country</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
                    <TouchableOpacity
                        style={[styles.filterPillSmall, selectedNations.length === 0 && styles.filterPillActive]}
                        onPress={clearNationFilter}
                    >
                        <Text style={[styles.filterTextSmall, selectedNations.length === 0 && styles.filterTextActive]}>All</Text>
                    </TouchableOpacity>
                    {biathlonNations.slice(0, 10).map(nation => (
                        <TouchableOpacity
                            key={nation.code}
                            style={[styles.filterPillSmall, selectedNations.includes(nation.code) && styles.filterPillActive]}
                            onPress={() => toggleNationFilter(nation.code)}
                        >
                            <Text style={styles.filterFlagTextSmall}>{nation.flag}</Text>
                            <Text style={[styles.filterTextSmall, selectedNations.includes(nation.code) && styles.filterTextActive]}>
                                {nation.code}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const renderBiathlonSchedule = () => (
        <FlatList
            data={filteredBiathlonRaces}
            renderItem={({ item }) => <BiathlonRaceCard race={item} onPress={() => setSelectedRace(item)} />}
            keyExtractor={item => item.uuid}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No upcoming races found.</Text>
                </View>
            }
            ListHeaderComponent={
                <View style={styles.scheduleHeader}>
                    <Ionicons name="calendar-outline" size={20} color="#0A84FF" />
                    <Text style={styles.scheduleHeaderText}>Upcoming Races</Text>
                    <Text style={styles.scheduleCount}>{filteredBiathlonRaces.length} races</Text>
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
                <View style={styles.headerBrand}>
                    <LogoMark />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{APP_NAME}</Text>
                        <Text style={styles.headerSubtitle}>{APP_TAGLINE}</Text>
                    </View>
                    <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
                        <Ionicons name="settings-outline" size={24} color="#888" />
                    </TouchableOpacity>
                </View>
            </View>

            {renderSportTabs()}

            {/* Sport-specific content */}
            {activeSport === 'shl' ? (
                <>
                    {!loading && renderTeamFilter()}
                    {loading ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={filteredGames}
                            renderItem={({ item }) => <GameCard game={item} onPress={() => handleGamePress(item)} />}
                            keyExtractor={item => item.uuid}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No games found.</Text></View>}
                        />
                    )}
                </>
            ) : (
                <>
                    {!loadingBiathlon && renderBiathlonFilters()}
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
    header: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 12 },
    headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    headerSubtitle: { color: '#8e8e93', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2 },
    settingsButton: { padding: 8 },

    // Sport Tabs
    sportTabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },

    // Filters
    filterContainer: { height: 52 },
    filterContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
    filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#333' },
    filterPillTeam: { paddingHorizontal: 8, paddingVertical: 6 },
    filterPillActive: { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
    filterText: { color: '#8e8e93', fontWeight: '600', fontSize: 13 },
    filterTextActive: { color: '#fff' },
    filterTeamLogo: { width: 28, height: 28 },
    listContent: { padding: 16, paddingTop: 8 },

    // Schedule Header
    scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
    scheduleHeaderText: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
    scheduleCount: { color: '#666', fontSize: 13, fontWeight: '600' },

    // Biathlon Filters
    biathlonFiltersContainer: { paddingBottom: 8 },
    filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
    filterRowLabel: { color: '#666', fontSize: 11, fontWeight: '600', width: 55, textTransform: 'uppercase' },
    filterRowContent: { flexDirection: 'row', gap: 6 },
    filterPillSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#333' },
    filterTextSmall: { color: '#8e8e93', fontWeight: '600', fontSize: 12 },
    filterFlagTextSmall: { fontSize: 14 },

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
