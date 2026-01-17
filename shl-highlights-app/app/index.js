import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Dimensions, ScrollView, Image, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
    fetchGames, fetchVideosForGame, fetchGameDetails, fetchVideoDetails, getTeamLogoUrl, fetchTeams,
    fetchBiathlonSchedule, fetchBiathlonEvents, fetchBiathlonNations, getNationFlag
} from '../api/shl';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Team Color Mapping
const TEAM_COLORS = {
    'LIF': ['#12284C', '#FFFFFF'],
    'FBK': ['#005336', '#B79256'],
    'RBK': ['#00573F', '#FFFFFF'],
    'LHF': ['#D31022', '#FCE300'],
    'SAIK': ['#000000', '#FFCD00'],
    'FHC': ['#D31022', '#005336'],
    'TIK': ['#D31022', '#FFFFFF'],
    'OHK': ['#D31022', '#000000'],
    'LHC': ['#12284C', '#D31022'],
    'MIF': ['#D31022', '#000000'],
    'HV71': ['#12284C', '#FCE300'],
    'MIK': ['#D31022', '#FFFFFF'],
    'BIF': ['#000000', '#FFFFFF'],
    'MODO': ['#D31022', '#005336'],
};

// Nation colors for biathlon
const NATION_COLORS = {
    'NOR': '#BA0C2F',
    'SWE': '#006AA7',
    'FRA': '#0055A4',
    'GER': '#000000',
    'ITA': '#009246',
    'AUT': '#ED2939',
    'SUI': '#FF0000',
    'FIN': '#003580',
    'USA': '#3C3B6E',
    'CAN': '#FF0000',
    'CZE': '#11457E',
};

const APP_NAME = 'GamePulse';
const APP_TAGLINE = 'Sports schedule & highlights';

// Storage keys
const STORAGE_KEYS = {
    SELECTED_SPORT: 'selectedSport',
    SELECTED_TEAM: 'selectedTeam',
    SELECTED_NATIONS: 'selectedNations'
};

// ============ COMPONENTS ============

const LogoMark = () => (
    <LinearGradient colors={['#0A84FF', '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark}>
        <View style={styles.logoBars}>
            <View style={[styles.logoBar, styles.logoBarShort]} />
            <View style={[styles.logoBar, styles.logoBarTall]} />
            <View style={[styles.logoBar, styles.logoBarMid]} />
        </View>
        <View style={styles.logoAccentDot} />
    </LinearGradient>
);

// Sport Tab Component
const SportTab = ({ sport, isActive, onPress }) => {
    const icons = {
        shl: 'hockey-puck',
        biathlon: 'locate-outline'
    };

    const names = {
        shl: 'Hockey',
        biathlon: 'Biathlon'
    };

    return (
        <TouchableOpacity
            style={[styles.sportTab, isActive && styles.sportTabActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Ionicons
                name={sport === 'biathlon' ? 'locate-outline' : 'snow-outline'}
                size={18}
                color={isActive ? '#0A84FF' : '#666'}
            />
            <Text style={[styles.sportTabText, isActive && styles.sportTabTextActive]}>
                {names[sport] || sport}
            </Text>
        </TouchableOpacity>
    );
};

// Stats Bar Component
const StatBar = ({ label, homeValue, awayValue, homeColor, awayColor }) => {
    const total = (homeValue || 0) + (awayValue || 0);
    const homePerc = total > 0 ? ((homeValue || 0) / total) * 100 : 50;

    return (
        <View style={styles.statBarContainer}>
            <Text style={styles.statValue}>{homeValue ?? '-'}</Text>
            <View style={styles.statBarMiddle}>
                <Text style={styles.statLabel}>{label}</Text>
                <View style={styles.statBarTrack}>
                    <View style={[styles.statBarFill, { width: `${homePerc}%`, backgroundColor: homeColor }]} />
                    <View style={[styles.statBarFill, { width: `${100 - homePerc}%`, backgroundColor: awayColor }]} />
                </View>
            </View>
            <Text style={styles.statValue}>{awayValue ?? '-'}</Text>
        </View>
    );
};

// Helper to safely get player name from different API formats
const getPlayerName = (player) => {
    if (!player) return 'Unknown';
    const firstName = player.givenName || player.firstName || '';
    const lastName = player.familyName || player.lastName || '';
    const fn = typeof firstName === 'string' ? firstName : firstName?.value || '';
    const ln = typeof lastName === 'string' ? lastName : lastName?.value || '';
    if (fn && ln) return `${fn.charAt(0)}. ${ln}`;
    if (ln) return ln;
    return 'Unknown';
};

// Helper to generate a display title from video tags when title is null
const getVideoDisplayTitle = (video) => {
    if (video.title) return video.title;
    const tags = video.tags || [];
    if (tags.includes('custom.highlights')) return 'Game Highlights';
    const goalTag = tags.find(t => t.startsWith('goal.'));
    if (goalTag) {
        const score = goalTag.replace('goal.', '');
        return `Goal (${score})`;
    }
    if (tags.includes('penalty')) return 'Penalty';
    if (tags.includes('save')) return 'Save';
    if (tags.includes('interview')) return 'Interview';
    return 'Video Clip';
};

const getAssistName = (assist) => {
    if (!assist) return null;
    const lastName = assist.familyName || assist.lastName;
    return typeof lastName === 'string' ? lastName : lastName?.value || null;
};

// Extract StayLive video ID from SHL video object
const getStayLiveVideoId = (video) => {
    if (video.mediaString) {
        const parts = video.mediaString.split('|');
        if (parts.length === 3 && parts[1] === 'staylive') {
            return parts[2];
        }
    }
    return video.id || null;
};

// Format relative date
const formatRelativeDate = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Idag';
    if (isTomorrow(date)) return 'Imorgon';
    const days = differenceInDays(date, new Date());
    if (days > 0 && days <= 7) return format(date, 'EEEE', { locale: sv });
    return format(date, 'd MMM', { locale: sv });
};

// Goal Item Component
const GoalItem = ({ goal, homeTeamCode, hasVideo, onVideoPress }) => {
    const isHomeGoal = goal.eventTeam?.place === 'home' || goal.eventTeam?.teamCode === homeTeamCode;
    const playerName = getPlayerName(goal.player);
    const assists = [];
    const a1 = getAssistName(goal.assist1);
    const a2 = getAssistName(goal.assist2);
    if (a1) assists.push(a1);
    if (a2) assists.push(a2);
    const homeGoals = goal.homeGoals ?? goal.homeScore ?? 0;
    const awayGoals = goal.awayGoals ?? goal.awayScore ?? 0;

    const getGoalType = () => {
        const types = [];
        if (goal.isPowerPlay) types.push('PP');
        if (goal.isShorthanded) types.push('SH');
        if (goal.isEmptyNet) types.push('EN');
        if (goal.isPenaltyShot) types.push('PS');
        if (goal.isGameWinningGoal) types.push('GWG');
        return types.length > 0 ? types.join(', ') : null;
    };

    const goalType = getGoalType();

    return (
        <View style={[styles.goalItem, isHomeGoal ? styles.goalItemHome : styles.goalItemAway]}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{goal.period}</Text>
                <Text style={styles.goalTimeText}>{goal.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="radio-button-on" size={14} color="#4CAF50" style={{ marginRight: 6 }} />
                    <Text style={styles.goalScorerText}>{playerName}</Text>
                    {goalType && <Text style={styles.goalTypeTag}>{goalType}</Text>}
                </View>
                {assists.length > 0 && (
                    <Text style={styles.goalAssists}>Assists: {assists.join(', ')}</Text>
                )}
                <Text style={styles.eventTypeLabel}>Goal</Text>
            </View>
            <View style={styles.goalRightSection}>
                <View style={styles.goalScoreContainer}>
                    <Text style={[styles.goalScoreNum, isHomeGoal && styles.goalScoreHighlight]}>{homeGoals}</Text>
                    <Text style={styles.goalScoreDash}>-</Text>
                    <Text style={[styles.goalScoreNum, !isHomeGoal && styles.goalScoreHighlight]}>{awayGoals}</Text>
                </View>
                {hasVideo && (
                    <TouchableOpacity onPress={onVideoPress} style={styles.videoIconButton}>
                        <Ionicons name="videocam" size={16} color="#0A84FF" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

// Goalkeeper Item Component
const GoalkeeperItem = ({ event, homeTeamCode }) => {
    const playerName = getPlayerName(event.player);
    const jersey = event.player?.jerseyToday;
    const isEntering = event.isEntering;
    const teamCode = event.eventTeam?.teamCode || '';

    return (
        <View style={[styles.goalkeeperItem, isEntering ? styles.goalkeeperItemIn : styles.goalkeeperItemOut]}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{event.period}</Text>
                <Text style={styles.goalTimeText}>{event.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons
                        name={isEntering ? "enter-outline" : "exit-outline"}
                        size={14}
                        color={isEntering ? "#4CAF50" : "#9E9E9E"}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={styles.goalkeeperPlayer}>{playerName}</Text>
                    {jersey && <Text style={styles.goalkeeperJersey}>#{jersey}</Text>}
                    <Text style={[styles.goalkeeperTag, isEntering ? styles.goalkeeperTagIn : styles.goalkeeperTagOut]}>
                        {isEntering ? 'IN' : 'OUT'}
                    </Text>
                </View>
                <Text style={styles.goalkeeperTeam}>{teamCode}</Text>
                <Text style={styles.eventTypeLabel}>Goalkeeper</Text>
            </View>
        </View>
    );
};

// Timeout Item Component
const TimeoutItem = ({ event }) => {
    const teamName = event.eventTeam?.teamName || event.eventTeam?.teamCode || 'Team';

    return (
        <View style={styles.timeoutItem}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{event.period}</Text>
                <Text style={styles.goalTimeText}>{event.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="time-outline" size={14} color="#2196F3" style={{ marginRight: 6 }} />
                    <Text style={styles.timeoutTeam}>{teamName}</Text>
                </View>
                <Text style={styles.eventTypeLabel}>Timeout</Text>
            </View>
        </View>
    );
};

// Tab Button Component
const TabButton = ({ title, isActive, onPress, icon }) => (
    <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Ionicons name={icon} size={18} color={isActive ? '#fff' : '#888'} />
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{title}</Text>
    </TouchableOpacity>
);

// Biathlon Race Card Component
const BiathlonRaceCard = ({ race, onPress }) => {
    const date = parseISO(race.startDateTime);
    const relativeDate = formatRelativeDate(race.startDateTime);
    const time = format(date, 'HH:mm');
    const isUpcoming = race.state === 'upcoming';
    const isLive = race.state === 'live';

    const disciplineIcons = {
        'Sprint': 'flash-outline',
        'Pursuit': 'trending-up-outline',
        'Individual': 'person-outline',
        'Mass Start': 'people-outline',
        'Relay': 'swap-horizontal-outline',
        'Mixed Relay': 'git-merge-outline',
        'Single Mixed Relay': 'git-branch-outline'
    };

    const genderColors = {
        'men': '#4A90D9',
        'women': '#D94A8C',
        'mixed': '#9B59B6'
    };

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={isLive ? ['#2a1c1c', '#1c1c1e'] : ['#1c1c1e', '#2c2c2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.raceCard, isLive && styles.raceCardLive]}
            >
                <View style={styles.raceCardHeader}>
                    <View style={styles.raceTypeContainer}>
                        <Text style={styles.raceEventType}>
                            {race.eventType === 'olympics' ? '🏅 Olympics' : 'World Cup'}
                        </Text>
                    </View>
                    <View style={styles.raceDateTimeContainer}>
                        <Text style={[styles.raceDate, isLive && styles.liveTextAccented]}>
                            {isLive ? 'LIVE' : relativeDate}
                        </Text>
                        <Text style={styles.raceTime}>{time}</Text>
                    </View>
                </View>

                <View style={styles.raceMainContent}>
                    <View style={styles.raceDisciplineRow}>
                        <Ionicons
                            name={disciplineIcons[race.discipline] || 'ellipse-outline'}
                            size={22}
                            color={genderColors[race.gender] || '#fff'}
                        />
                        <Text style={styles.raceDiscipline}>{race.discipline}</Text>
                        <View style={[styles.genderBadge, { backgroundColor: genderColors[race.gender] || '#666' }]}>
                            <Text style={styles.genderBadgeText}>{race.genderDisplay}</Text>
                        </View>
                    </View>
                    <View style={styles.raceLocationRow}>
                        <Text style={styles.raceFlag}>{getNationFlag(race.country)}</Text>
                        <Text style={styles.raceLocation}>{race.location}</Text>
                        <Text style={styles.raceCountry}>{race.countryName}</Text>
                    </View>
                </View>

                {race.eventName && (
                    <Text style={styles.raceEventName}>{race.eventName}</Text>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

// ============ MAIN APP ============

export default function App() {
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
    const [selectedTeam, setSelectedTeam] = useState('ALL');
    const [playingVideoId, setPlayingVideoId] = useState(null);
    const [playingVideoDetails, setPlayingVideoDetails] = useState(null);
    const [loadingVideoDetails, setLoadingVideoDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');

    // Biathlon state
    const [biathlonRaces, setBiathlonRaces] = useState([]);
    const [biathlonEvents, setBiathlonEvents] = useState([]);
    const [biathlonNations, setBiathlonNations] = useState([]);
    const [loadingBiathlon, setLoadingBiathlon] = useState(false);
    const [selectedNations, setSelectedNations] = useState([]);
    const [selectedRace, setSelectedRace] = useState(null);

    // Load saved preferences
    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const [savedSport, savedTeam, savedNations] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SPORT),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAM),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_NATIONS)
            ]);

            if (savedSport) setActiveSport(savedSport);
            if (savedTeam) setSelectedTeam(savedTeam);
            if (savedNations) setSelectedNations(JSON.parse(savedNations));
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
            const [races, events, nations] = await Promise.all([
                fetchBiathlonSchedule(50),
                fetchBiathlonEvents(),
                fetchBiathlonNations()
            ]);
            setBiathlonRaces(races);
            setBiathlonEvents(events);
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

    const handleTeamChange = (team) => {
        setSelectedTeam(team);
        savePreference(STORAGE_KEYS.SELECTED_TEAM, team);
    };

    const toggleNationFilter = (nationCode) => {
        const newSelected = selectedNations.includes(nationCode)
            ? selectedNations.filter(n => n !== nationCode)
            : [...selectedNations, nationCode];
        setSelectedNations(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, newSelected);
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
            if (selectedTeam !== 'ALL') {
                if (game.homeTeamInfo.code !== selectedTeam && game.awayTeamInfo.code !== selectedTeam) {
                    return false;
                }
            }
            if (game.state === 'pre-game') return false;
            return true;
        });
    }, [games, selectedTeam]);

    // Filter biathlon races by selected nations (host country)
    const filteredBiathlonRaces = useMemo(() => {
        if (selectedNations.length === 0) return biathlonRaces;
        return biathlonRaces.filter(race => selectedNations.includes(race.country));
    }, [biathlonRaces, selectedNations]);

    // Group races by event
    const groupedBiathlonRaces = useMemo(() => {
        const groups = {};
        filteredBiathlonRaces.forEach(race => {
            if (!groups[race.eventId]) {
                groups[race.eventId] = {
                    eventId: race.eventId,
                    eventName: race.eventName,
                    location: race.location,
                    country: race.country,
                    countryName: race.countryName,
                    races: []
                };
            }
            groups[race.eventId].races.push(race);
        });
        return Object.values(groups);
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

    const handleRacePress = (race) => {
        setSelectedRace(race);
    };

    const closeModal = () => {
        stopVideo();
        setSelectedGame(null);
        setGameDetails(null);
        setVideos([]);
    };

    const closeRaceModal = () => {
        setSelectedRace(null);
    };

    const getTeamColor = (code) => TEAM_COLORS[code]?.[0] || '#333';

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

    // ============ RENDER FUNCTIONS ============

    const renderSportTabs = () => (
        <View style={styles.sportTabsContainer}>
            <SportTab sport="shl" isActive={activeSport === 'shl'} onPress={() => handleSportChange('shl')} />
            <SportTab sport="biathlon" isActive={activeSport === 'biathlon'} onPress={() => handleSportChange('biathlon')} />
        </View>
    );

    const renderGameItem = ({ item }) => {
        const date = parseISO(item.startDateTime);
        const formattedDate = format(date, 'd MMMM HH:mm', { locale: sv });
        const isLive = item.state === 'live';
        const extractScore = (teamResult, teamInfo) => {
            if (teamResult?.score !== undefined) {
                return typeof teamResult.score === 'object' ? teamResult.score.value : teamResult.score;
            }
            if (teamInfo?.score !== undefined) {
                return typeof teamInfo.score === 'object' ? teamInfo.score.value : teamInfo.score;
            }
            return '-';
        };
        const homeScore = extractScore(item.homeTeamResult, item.homeTeamInfo);
        const awayScore = extractScore(item.awayTeamResult, item.awayTeamInfo);

        return (
            <TouchableOpacity onPress={() => handleGamePress(item)} activeOpacity={0.8}>
                <LinearGradient colors={['#1c1c1e', '#2c2c2e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.leagueText}>SHL</Text>
                        <Text style={[styles.gameDate, isLive && styles.liveTextAccented]}>
                            {isLive ? 'LIVE' : formattedDate}
                        </Text>
                    </View>
                    <View style={styles.matchupContainer}>
                        <View style={styles.teamContainer}>
                            <Image source={{ uri: getTeamLogoUrl(item.homeTeamInfo.code) }} style={styles.teamLogo} resizeMode="contain" />
                            <Text style={styles.teamName} numberOfLines={1}>{item.homeTeamInfo.names.short}</Text>
                        </View>
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreText}>{homeScore} - {awayScore}</Text>
                            <Text style={styles.statusText}>{item.state === 'post-game' ? 'Final' : item.state}</Text>
                        </View>
                        <View style={styles.teamContainer}>
                            <Image source={{ uri: getTeamLogoUrl(item.awayTeamInfo.code) }} style={styles.teamLogo} resizeMode="contain" />
                            <Text style={styles.teamName} numberOfLines={1}>{item.awayTeamInfo.names.short}</Text>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderTeamFilter = () => (
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                <TouchableOpacity style={[styles.filterPill, selectedTeam === 'ALL' && styles.filterPillActive]} onPress={() => handleTeamChange('ALL')}>
                    <Text style={[styles.filterText, selectedTeam === 'ALL' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                {teams.map(team => (
                    <TouchableOpacity
                        key={team.code}
                        style={[styles.filterPill, styles.filterPillTeam, selectedTeam === team.code && styles.filterPillActive]}
                        onPress={() => handleTeamChange(team.code)}
                    >
                        <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.filterTeamLogo} resizeMode="contain" />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderNationFilter = () => (
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                <TouchableOpacity
                    style={[styles.filterPill, selectedNations.length === 0 && styles.filterPillActive]}
                    onPress={() => { setSelectedNations([]); savePreference(STORAGE_KEYS.SELECTED_NATIONS, []); }}
                >
                    <Text style={[styles.filterText, selectedNations.length === 0 && styles.filterTextActive]}>All Venues</Text>
                </TouchableOpacity>
                {biathlonNations.slice(0, 10).map(nation => (
                    <TouchableOpacity
                        key={nation.code}
                        style={[styles.filterPill, selectedNations.includes(nation.code) && styles.filterPillActive]}
                        onPress={() => toggleNationFilter(nation.code)}
                    >
                        <Text style={styles.filterFlagText}>{nation.flag}</Text>
                        <Text style={[styles.filterText, selectedNations.includes(nation.code) && styles.filterTextActive]}>
                            {nation.code}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderBiathlonSchedule = () => (
        <FlatList
            data={filteredBiathlonRaces}
            renderItem={({ item }) => <BiathlonRaceCard race={item} onPress={() => handleRacePress(item)} />}
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

    // ============ TAB CONTENT ============

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
                        return (
                            <View style={styles.periodMarker}>
                                <View style={styles.periodLine} />
                                <Text style={styles.periodText}>Period {item.period}</Text>
                                <View style={styles.periodLine} />
                            </View>
                        );
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
                        const playerName = getPlayerName(item.player);
                        const offence = typeof item.offence === 'string' ? item.offence : (item.offence?.shortName || item.offence?.name || 'Penalty');
                        const variant = item.variant;
                        let penaltyMinutes = '2';
                        if (item.penaltyMinutes) {
                            penaltyMinutes = String(item.penaltyMinutes);
                        } else if (variant && typeof variant === 'object') {
                            if (variant.description) {
                                const match = variant.description.match(/(\d+)/);
                                if (match) penaltyMinutes = match[1];
                            } else {
                                const times = [
                                    parseInt(variant.majorTime) || 0,
                                    parseInt(variant.minorTime) || 0,
                                    parseInt(variant.doubleMinorTime) || 0,
                                    parseInt(variant.misconductTime) || 0,
                                    parseInt(variant.gMTime) || 0,
                                    parseInt(variant.mPTime) || 0,
                                    parseInt(variant.benchTime) || 0
                                ];
                                const maxTime = Math.max(...times);
                                if (maxTime > 0) penaltyMinutes = String(maxTime);
                            }
                        }
                        const penaltyType = variant?.shortName || '';

                        return (
                            <View style={styles.penaltyItem}>
                                <View style={styles.goalTime}>
                                    <Text style={styles.goalPeriod}>P{item.period}</Text>
                                    <Text style={styles.goalTimeText}>{item.time}</Text>
                                </View>
                                <View style={styles.goalContent}>
                                    <View style={styles.goalScorer}>
                                        <Ionicons name="alert-circle" size={14} color="#FF9800" style={{ marginRight: 6 }} />
                                        <Text style={styles.penaltyPlayer}>{playerName}</Text>
                                        <Text style={styles.penaltyMinutesTag}>{penaltyMinutes} min</Text>
                                        {penaltyType ? <Text style={styles.penaltyTypeTag}>{penaltyType}</Text> : null}
                                    </View>
                                    <Text style={styles.penaltyOffense}>{offence}</Text>
                                    <Text style={styles.eventTypeLabel}>Penalty</Text>
                                </View>
                            </View>
                        );
                    }

                    if (item.type === 'goalkeeper') {
                        return <GoalkeeperItem event={item} homeTeamCode={homeCode} />;
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
                renderItem={({ item }) => {
                    const isPlaying = playingVideoId === item.id;
                    return (
                        <TouchableOpacity
                            style={[styles.videoGridCard, isPlaying && styles.videoGridCardPlaying]}
                            onPress={() => playVideo(item)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.videoGridThumbnailContainer}>
                                <Image source={{ uri: item.renderedMedia.url || item.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                                {isPlaying ? (
                                    <View style={styles.nowPlayingBadge}>
                                        <Ionicons name="volume-high" size={14} color="#fff" />
                                        <Text style={styles.nowPlayingBadgeText}>Playing</Text>
                                    </View>
                                ) : (
                                    <View style={styles.miniPlayIconContainer}>
                                        <Ionicons name="play" size={24} color="#fff" />
                                    </View>
                                )}
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.thumbnailGradient} />
                            </View>
                            <View style={styles.videoGridInfo}>
                                <Text style={[styles.videoGridTitle, isPlaying && styles.videoGridTitlePlaying]} numberOfLines={2}>{getVideoDisplayTitle(item)}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No videos available yet.</Text>}
            />
        </View>
    );

    // ============ RACE DETAIL MODAL ============

    const renderRaceModal = () => (
        <Modal visible={!!selectedRace} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeRaceModal}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                {selectedRace && (
                    <>
                        <View style={styles.raceModalHeader}>
                            <TouchableOpacity onPress={closeRaceModal} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.raceModalTitleContainer}>
                                <Text style={styles.raceModalEventName}>{selectedRace.eventName}</Text>
                                <Text style={styles.raceModalLocation}>
                                    {getNationFlag(selectedRace.country)} {selectedRace.location}, {selectedRace.countryName}
                                </Text>
                            </View>
                        </View>

                        <ScrollView style={styles.raceModalContent}>
                            <View style={styles.raceDetailCard}>
                                <View style={styles.raceDetailHeader}>
                                    <Text style={styles.raceDetailDiscipline}>{selectedRace.discipline}</Text>
                                    <View style={[styles.genderBadgeLarge, {
                                        backgroundColor: selectedRace.gender === 'men' ? '#4A90D9' :
                                            selectedRace.gender === 'women' ? '#D94A8C' : '#9B59B6'
                                    }]}>
                                        <Text style={styles.genderBadgeTextLarge}>{selectedRace.genderDisplay}</Text>
                                    </View>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="calendar-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Date</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {format(parseISO(selectedRace.startDateTime), 'd MMMM yyyy', { locale: sv })}
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="time-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Start Time</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {format(parseISO(selectedRace.startDateTime), 'HH:mm')} CET
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="trophy-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Competition</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {selectedRace.eventType === 'olympics' ? 'Winter Olympics 2026' : 'IBU World Cup 2025/26'}
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="pulse-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Status</Text>
                                    <View style={[styles.statusBadge, {
                                        backgroundColor: selectedRace.state === 'live' ? '#FF453A' :
                                            selectedRace.state === 'upcoming' ? '#30D158' : '#666'
                                    }]}>
                                        <Text style={styles.statusBadgeText}>
                                            {selectedRace.state === 'live' ? 'LIVE' :
                                                selectedRace.state === 'upcoming' ? 'Upcoming' : 'Completed'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.raceInfoNote}>
                                <Ionicons name="information-circle-outline" size={18} color="#666" />
                                <Text style={styles.raceInfoNoteText}>
                                    Results and start lists will be available closer to race time.
                                </Text>
                            </View>
                        </ScrollView>
                    </>
                )}
            </SafeAreaView>
        </Modal>
    );

    // ============ MAIN RENDER ============

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <LinearGradient colors={['#000000', '#121212']} style={StyleSheet.absoluteFill} />
            <View style={styles.header}>
                <View style={styles.headerBrand}>
                    <LogoMark />
                    <View>
                        <Text style={styles.headerTitle}>{APP_NAME}</Text>
                        <Text style={styles.headerSubtitle}>{APP_TAGLINE}</Text>
                    </View>
                </View>
            </View>

            {renderSportTabs()}

            {activeSport === 'shl' ? (
                <>
                    {!loading && renderTeamFilter()}
                    {loading ? (
                        <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={filteredGames}
                            renderItem={renderGameItem}
                            keyExtractor={item => item.uuid}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No games found.</Text></View>}
                        />
                    )}
                </>
            ) : (
                <>
                    {!loadingBiathlon && renderNationFilter()}
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
            {renderRaceModal()}
        </SafeAreaView>
    );
}

// ============ STYLES ============

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 12 },
    headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    headerSubtitle: { color: '#8e8e93', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2 },
    logoMark: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    logoBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 22 },
    logoBar: { width: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
    logoBarShort: { height: 8 },
    logoBarMid: { height: 14 },
    logoBarTall: { height: 20 },
    logoAccentDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#0b0d10', right: 10, top: 10 },

    // Sport Tabs
    sportTabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
    sportTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1c1c1e', borderRadius: 10, borderWidth: 1, borderColor: '#333' },
    sportTabActive: { backgroundColor: 'rgba(10, 132, 255, 0.15)', borderColor: '#0A84FF' },
    sportTabText: { color: '#666', fontSize: 14, fontWeight: '600' },
    sportTabTextActive: { color: '#0A84FF' },

    // Filters
    filterContainer: { height: 52 },
    filterContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
    filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#333' },
    filterPillTeam: { paddingHorizontal: 8, paddingVertical: 6 },
    filterPillActive: { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
    filterText: { color: '#8e8e93', fontWeight: '600', fontSize: 13 },
    filterTextActive: { color: '#fff' },
    filterTeamLogo: { width: 28, height: 28 },
    filterFlagText: { fontSize: 18 },
    listContent: { padding: 16, paddingTop: 8 },

    // Schedule Header
    scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
    scheduleHeaderText: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
    scheduleCount: { color: '#666', fontSize: 13, fontWeight: '600' },

    // Game Card
    gameCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    leagueText: { color: '#666', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    gameDate: { color: '#8e8e93', fontSize: 12, fontWeight: '600' },
    liveTextAccented: { color: '#FF453A', fontWeight: '800' },
    matchupContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamContainer: { alignItems: 'center', flex: 1 },
    teamLogo: { width: 60, height: 60, marginBottom: 8 },
    teamName: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    scoreContainer: { alignItems: 'center', paddingHorizontal: 10 },
    scoreText: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
    statusText: { color: '#666', fontSize: 12, marginTop: 4, textTransform: 'uppercase' },

    // Biathlon Race Card
    raceCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
    raceCardLive: { borderColor: '#FF453A' },
    raceCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    raceTypeContainer: {},
    raceEventType: { color: '#666', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    raceDateTimeContainer: { alignItems: 'flex-end' },
    raceDate: { color: '#8e8e93', fontSize: 13, fontWeight: '600' },
    raceTime: { color: '#666', fontSize: 12, marginTop: 2 },
    raceMainContent: { gap: 10 },
    raceDisciplineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    raceDiscipline: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
    genderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    genderBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    raceLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    raceFlag: { fontSize: 20 },
    raceLocation: { color: '#fff', fontSize: 15, fontWeight: '600' },
    raceCountry: { color: '#666', fontSize: 13 },
    raceEventName: { color: '#555', fontSize: 12, marginTop: 10, fontWeight: '500' },

    // Modal
    modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
    modalHeader: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#333' },
    closeButton: { position: 'absolute', top: 20, right: 16, zIndex: 10, padding: 8 },

    // Race Modal
    raceModalHeader: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#333' },
    raceModalTitleContainer: { paddingTop: 10 },
    raceModalEventName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
    raceModalLocation: { color: '#888', fontSize: 15 },
    raceModalContent: { flex: 1, padding: 16 },
    raceDetailCard: { backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20 },
    raceDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    raceDetailDiscipline: { color: '#fff', fontSize: 26, fontWeight: '800' },
    genderBadgeLarge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    genderBadgeTextLarge: { color: '#fff', fontSize: 13, fontWeight: '700' },
    raceDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
    raceDetailLabel: { color: '#888', fontSize: 14, flex: 1 },
    raceDetailValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    raceInfoNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, padding: 16, backgroundColor: '#1a1a1a', borderRadius: 12 },
    raceInfoNoteText: { color: '#666', fontSize: 13, flex: 1 },

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
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
    tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#0A84FF' },
    tabButtonText: { color: '#888', fontSize: 14, fontWeight: '600' },
    tabButtonTextActive: { color: '#fff' },
    tabContentContainer: { flex: 1 },
    tabContent: { padding: 16 },

    // Section Card
    sectionCard: { backgroundColor: '#1c1c1e', borderRadius: 12, padding: 16, marginBottom: 16 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },

    // Stats Bar
    statBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '700', width: 40, textAlign: 'center' },
    statBarMiddle: { flex: 1, marginHorizontal: 12 },
    statLabel: { color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 6 },
    statBarTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#333' },
    statBarFill: { height: '100%' },

    // Goal Item
    goalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 8, padding: 12, marginBottom: 8 },
    goalItemHome: { borderLeftWidth: 3, borderLeftColor: '#4CAF50' },
    goalItemAway: { borderRightWidth: 3, borderRightColor: '#4CAF50' },
    goalTime: { width: 45, marginRight: 12 },
    goalPeriod: { color: '#888', fontSize: 11 },
    goalTimeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    goalContent: { flex: 1 },
    goalScorer: { flexDirection: 'row', alignItems: 'center' },
    goalScorerText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    goalAssists: { color: '#888', fontSize: 12, marginTop: 2 },
    goalTypeTag: { backgroundColor: '#333', color: '#4CAF50', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },
    eventTypeLabel: { color: '#666', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
    goalRightSection: { alignItems: 'flex-end', marginLeft: 12 },
    goalScoreContainer: { flexDirection: 'row', alignItems: 'center' },
    goalScoreNum: { color: '#666', fontSize: 16, fontWeight: '700' },
    goalScoreDash: { color: '#666', fontSize: 16, fontWeight: '700', marginHorizontal: 2 },
    goalScoreHighlight: { color: '#fff' },
    videoIconButton: { marginTop: 6, padding: 4 },

    // Penalty Item
    penaltyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#FF9800' },
    penaltyPlayer: { color: '#fff', fontSize: 15, fontWeight: '600' },
    penaltyMinutesTag: { backgroundColor: '#333', color: '#FF9800', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },
    penaltyTypeTag: { backgroundColor: '#442200', color: '#FF9800', fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6, overflow: 'hidden' },
    penaltyOffense: { color: '#888', fontSize: 12, marginTop: 2 },

    // Period Marker
    periodMarker: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    periodLine: { flex: 1, height: 1, backgroundColor: '#333' },
    periodText: { color: '#666', fontSize: 12, fontWeight: '600', marginHorizontal: 12 },

    // Goalkeeper Item
    goalkeeperItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 8, padding: 12, marginBottom: 8 },
    goalkeeperItemIn: { borderLeftWidth: 3, borderLeftColor: '#4CAF50' },
    goalkeeperItemOut: { borderLeftWidth: 3, borderLeftColor: '#9E9E9E' },
    goalkeeperPlayer: { color: '#fff', fontSize: 15, fontWeight: '600' },
    goalkeeperJersey: { color: '#888', fontSize: 13, marginLeft: 6 },
    goalkeeperTag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, overflow: 'hidden' },
    goalkeeperTagIn: { backgroundColor: '#1B3D1B', color: '#4CAF50' },
    goalkeeperTagOut: { backgroundColor: '#333', color: '#9E9E9E' },
    goalkeeperTeam: { color: '#888', fontSize: 12, marginTop: 2 },

    // Timeout Item
    timeoutItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#2196F3' },
    timeoutTeam: { color: '#fff', fontSize: 15, fontWeight: '600' },

    // Highlights
    highlightsTitleBox: { padding: 16, paddingBottom: 8 },
    highlightsTitleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    highlightsTitleLabel: { color: '#fff', fontSize: 20, fontWeight: '700' },
    highlightsSubtitle: { color: '#888', fontSize: 14 },
    nowPlayingBox: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#0A84FF' },
    nowPlayingLabel: { color: '#0A84FF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    nowPlayingTitle: { color: '#fff', fontSize: 15, fontWeight: '600', lineHeight: 20 },

    // Video Grid
    videoList: { padding: 8 },
    videoGridRow: { justifyContent: 'space-between', paddingHorizontal: 8 },
    activePlayerContainer: { marginBottom: 20, paddingHorizontal: 16 },
    activePlayer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
    activePlayerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
    activePlayerTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 },
    closePlayerButton: { padding: 4 },
    nowPlayingBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A84FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, gap: 4 },
    nowPlayingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    videoGridCard: { flex: 1, marginBottom: 16, backgroundColor: '#1c1c1e', borderRadius: 8, overflow: 'hidden', marginHorizontal: 4, maxWidth: (width - 48) / 2 },
    videoGridCardPlaying: { borderWidth: 2, borderColor: '#0A84FF' },
    videoLoadingContainer: { width: '100%', aspectRatio: 16 / 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    videoLoadingText: { color: '#888', fontSize: 12, marginTop: 8 },
    videoGridThumbnailContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    thumbnail: { width: '100%', height: '100%', opacity: 0.8 },
    thumbnailGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
    miniPlayIconContainer: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderColor: '#fff', borderWidth: 1.5 },
    videoGridInfo: { padding: 10 },
    videoGridTitle: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
    videoGridTitlePlaying: { color: '#0A84FF' },

    // Empty
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#666', fontSize: 16, textAlign: 'center', padding: 20 }
});
