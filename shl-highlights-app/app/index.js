import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Dimensions, ScrollView, Image, RefreshControl, Platform } from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
    fetchGames, fetchVideosForGame, fetchGameDetails, fetchVideoDetails, getTeamLogoUrl,
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

const APP_NAME = 'GamePulse';
const APP_TAGLINE = 'Sports schedule & highlights';

// Storage keys
const STORAGE_KEYS = {
    SELECTED_SPORT: 'selectedSport',
    SELECTED_TEAMS: 'selectedTeams',
    SELECTED_NATIONS: 'selectedNations',
    SELECTED_GENDERS: 'selectedGenders',
    ONBOARDING_COMPLETE: 'onboardingComplete',
    ENABLED_SPORTS: 'enabledSports'
};

// Gender options for biathlon
const GENDER_OPTIONS = [
    { id: 'men', label: 'Men', color: '#4A90D9' },
    { id: 'women', label: 'Women', color: '#D94A8C' },
    { id: 'mixed', label: 'Mixed', color: '#9B59B6' }
];

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
    // Onboarding & Settings state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Sport selection
    const [activeSport, setActiveSport] = useState('shl');
    const [enabledSports, setEnabledSports] = useState(['shl', 'biathlon']);

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
    const [biathlonEvents, setBiathlonEvents] = useState([]);
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
            const [savedSport, savedTeams, savedNations, savedGenders, onboardingComplete, savedEnabledSports] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SPORT),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_NATIONS),
                AsyncStorage.getItem(STORAGE_KEYS.SELECTED_GENDERS),
                AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
                AsyncStorage.getItem(STORAGE_KEYS.ENABLED_SPORTS)
            ]);

            if (savedSport) setActiveSport(savedSport);
            if (savedTeams) setSelectedTeams(JSON.parse(savedTeams));
            if (savedNations) setSelectedNations(JSON.parse(savedNations));
            if (savedGenders) setSelectedGenders(JSON.parse(savedGenders));
            if (savedEnabledSports) setEnabledSports(JSON.parse(savedEnabledSports));

            // Show onboarding if not completed
            if (!onboardingComplete) {
                setShowOnboarding(true);
            }

            setIsInitialized(true);
        } catch (e) {
            console.error('Error loading preferences:', e);
            setIsInitialized(true);
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

    const toggleTeamFilter = (teamCode) => {
        const newSelected = selectedTeams.includes(teamCode)
            ? selectedTeams.filter(t => t !== teamCode)
            : [...selectedTeams, teamCode];
        setSelectedTeams(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_TEAMS, newSelected);
    };

    const clearTeamFilter = () => {
        setSelectedTeams([]);
        savePreference(STORAGE_KEYS.SELECTED_TEAMS, []);
    };

    const toggleNationFilter = (nationCode) => {
        const newSelected = selectedNations.includes(nationCode)
            ? selectedNations.filter(n => n !== nationCode)
            : [...selectedNations, nationCode];
        setSelectedNations(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, newSelected);
    };

    const clearNationFilter = () => {
        setSelectedNations([]);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, []);
    };

    const toggleGenderFilter = (gender) => {
        const newSelected = selectedGenders.includes(gender)
            ? selectedGenders.filter(g => g !== gender)
            : [...selectedGenders, gender];
        setSelectedGenders(newSelected);
        savePreference(STORAGE_KEYS.SELECTED_GENDERS, newSelected);
    };

    const clearGenderFilter = () => {
        setSelectedGenders([]);
        savePreference(STORAGE_KEYS.SELECTED_GENDERS, []);
    };

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
            // Filter by selected teams (if any)
            if (selectedTeams.length > 0) {
                if (!selectedTeams.includes(game.homeTeamInfo.code) && !selectedTeams.includes(game.awayTeamInfo.code)) {
                    return false;
                }
            }
            if (game.state === 'pre-game') return false;
            return true;
        });
    }, [games, selectedTeams]);

    // Filter biathlon races by selected nations (athlete country) and gender
    const filteredBiathlonRaces = useMemo(() => {
        return biathlonRaces.filter(race => {
            // Filter by gender if any selected
            if (selectedGenders.length > 0 && !selectedGenders.includes(race.gender)) {
                return false;
            }
            // Filter by nation (host country for now, but represents athlete interest)
            if (selectedNations.length > 0 && !selectedNations.includes(race.country)) {
                return false;
            }
            return true;
        });
    }, [biathlonRaces, selectedNations, selectedGenders]);

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
            {/* Gender Filter Row */}
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

            {/* Country Filter Row */}
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
            {renderRaceModal()}

            {/* Settings Modal */}
            <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
                <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                    <View style={styles.settingsHeader}>
                        <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.settingsTitle}>Settings</Text>
                    </View>
                    <ScrollView style={styles.settingsContent}>
                        <Text style={styles.settingsSection}>Favorites</Text>
                        <Text style={styles.settingsSectionSubtitle}>Customize which sports and teams you follow</Text>

                        <View style={styles.settingsCard}>
                            <View style={styles.settingsCardHeader}>
                                <Ionicons name="snow-outline" size={22} color="#0A84FF" />
                                <Text style={styles.settingsCardTitle}>Hockey Teams</Text>
                            </View>
                            <View style={styles.settingsChipContainer}>
                                {teams.map(team => (
                                    <TouchableOpacity
                                        key={team.code}
                                        style={[styles.settingsChip, selectedTeams.includes(team.code) && styles.settingsChipActive]}
                                        onPress={() => toggleTeamFilter(team.code)}
                                    >
                                        <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.settingsChipLogo} resizeMode="contain" />
                                        <Text style={[styles.settingsChipText, selectedTeams.includes(team.code) && styles.settingsChipTextActive]}>
                                            {team.code}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedTeams.length > 0 && (
                                <TouchableOpacity style={styles.clearButton} onPress={clearTeamFilter}>
                                    <Text style={styles.clearButtonText}>Clear selection</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.settingsCard}>
                            <View style={styles.settingsCardHeader}>
                                <Ionicons name="locate-outline" size={22} color="#0A84FF" />
                                <Text style={styles.settingsCardTitle}>Biathlon Gender</Text>
                            </View>
                            <View style={styles.settingsChipContainer}>
                                {GENDER_OPTIONS.map(gender => (
                                    <TouchableOpacity
                                        key={gender.id}
                                        style={[
                                            styles.settingsChip,
                                            selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                        ]}
                                        onPress={() => toggleGenderFilter(gender.id)}
                                    >
                                        <Text style={[styles.settingsChipText, selectedGenders.includes(gender.id) && styles.settingsChipTextActive]}>
                                            {gender.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.settingsCard}>
                            <View style={styles.settingsCardHeader}>
                                <Ionicons name="flag-outline" size={22} color="#0A84FF" />
                                <Text style={styles.settingsCardTitle}>Biathlon Countries</Text>
                            </View>
                            <View style={styles.settingsChipContainer}>
                                {biathlonNations.map(nation => (
                                    <TouchableOpacity
                                        key={nation.code}
                                        style={[styles.settingsChip, selectedNations.includes(nation.code) && styles.settingsChipActive]}
                                        onPress={() => toggleNationFilter(nation.code)}
                                    >
                                        <Text style={styles.settingsChipFlag}>{nation.flag}</Text>
                                        <Text style={[styles.settingsChipText, selectedNations.includes(nation.code) && styles.settingsChipTextActive]}>
                                            {nation.code}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedNations.length > 0 && (
                                <TouchableOpacity style={styles.clearButton} onPress={clearNationFilter}>
                                    <Text style={styles.clearButtonText}>Clear selection</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity style={styles.resetOnboardingButton} onPress={resetOnboarding}>
                            <Ionicons name="refresh-outline" size={20} color="#FF9F0A" />
                            <Text style={styles.resetOnboardingText}>Restart setup wizard</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Onboarding Modal */}
            <Modal visible={showOnboarding} animationType="fade" presentationStyle="fullScreen">
                <SafeAreaView style={styles.onboardingContainer} edges={['top', 'left', 'right', 'bottom']}>
                    <LinearGradient colors={['#0a0a0a', '#1a1a2e']} style={StyleSheet.absoluteFill} />

                    {onboardingStep === 0 && (
                        <View style={styles.onboardingStep}>
                            <View style={styles.onboardingHeader}>
                                <LogoMark />
                                <Text style={styles.onboardingWelcome}>Welcome to</Text>
                                <Text style={styles.onboardingAppName}>{APP_NAME}</Text>
                                <Text style={styles.onboardingTagline}>Your personal sports companion</Text>
                            </View>
                            <View style={styles.onboardingContent}>
                                <Text style={styles.onboardingDesc}>
                                    {"Let's set up your preferences so you can see the games and races you care about most."}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.onboardingButton} onPress={() => setOnboardingStep(1)}>
                                <Text style={styles.onboardingButtonText}>Get Started</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {onboardingStep === 1 && (
                        <View style={styles.onboardingStep}>
                            <View style={styles.onboardingStepHeader}>
                                <Text style={styles.onboardingStepNumber}>1 of 3</Text>
                                <Text style={styles.onboardingStepTitle}>Pick your Hockey teams</Text>
                                <Text style={styles.onboardingStepSubtitle}>Select the SHL teams you want to follow</Text>
                            </View>
                            <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.onboardingChipGrid}>
                                    {teams.map(team => (
                                        <TouchableOpacity
                                            key={team.code}
                                            style={[styles.onboardingChip, selectedTeams.includes(team.code) && styles.onboardingChipActive]}
                                            onPress={() => toggleTeamFilter(team.code)}
                                        >
                                            <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.onboardingChipLogo} resizeMode="contain" />
                                            <Text style={[styles.onboardingChipText, selectedTeams.includes(team.code) && styles.onboardingChipTextActive]}>
                                                {team.code}
                                            </Text>
                                            {selectedTeams.includes(team.code) && (
                                                <Ionicons name="checkmark-circle" size={20} color="#0A84FF" style={styles.onboardingChipCheck} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                            <View style={styles.onboardingNav}>
                                <TouchableOpacity style={styles.onboardingNavButton} onPress={() => setOnboardingStep(0)}>
                                    <Ionicons name="arrow-back" size={20} color="#888" />
                                    <Text style={styles.onboardingNavButtonText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.onboardingButton} onPress={() => setOnboardingStep(2)}>
                                    <Text style={styles.onboardingButtonText}>{selectedTeams.length > 0 ? 'Continue' : 'Skip'}</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {onboardingStep === 2 && (
                        <View style={styles.onboardingStep}>
                            <View style={styles.onboardingStepHeader}>
                                <Text style={styles.onboardingStepNumber}>2 of 3</Text>
                                <Text style={styles.onboardingStepTitle}>Biathlon preferences</Text>
                                <Text style={styles.onboardingStepSubtitle}>Which race categories interest you?</Text>
                            </View>
                            <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
                                <Text style={styles.onboardingSectionLabel}>Gender</Text>
                                <View style={styles.onboardingChipRow}>
                                    {GENDER_OPTIONS.map(gender => (
                                        <TouchableOpacity
                                            key={gender.id}
                                            style={[
                                                styles.onboardingGenderChip,
                                                selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                            ]}
                                            onPress={() => toggleGenderFilter(gender.id)}
                                        >
                                            <Text style={[styles.onboardingGenderText, selectedGenders.includes(gender.id) && styles.onboardingGenderTextActive]}>
                                                {gender.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.onboardingSectionLabel}>Countries</Text>
                                <View style={styles.onboardingChipGrid}>
                                    {biathlonNations.map(nation => (
                                        <TouchableOpacity
                                            key={nation.code}
                                            style={[styles.onboardingNationChip, selectedNations.includes(nation.code) && styles.onboardingChipActive]}
                                            onPress={() => toggleNationFilter(nation.code)}
                                        >
                                            <Text style={styles.onboardingNationFlag}>{nation.flag}</Text>
                                            <Text style={[styles.onboardingNationText, selectedNations.includes(nation.code) && styles.onboardingChipTextActive]}>
                                                {nation.name || nation.code}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                            <View style={styles.onboardingNav}>
                                <TouchableOpacity style={styles.onboardingNavButton} onPress={() => setOnboardingStep(1)}>
                                    <Ionicons name="arrow-back" size={20} color="#888" />
                                    <Text style={styles.onboardingNavButtonText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.onboardingButton} onPress={() => setOnboardingStep(3)}>
                                    <Text style={styles.onboardingButtonText}>Continue</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {onboardingStep === 3 && (
                        <View style={styles.onboardingStep}>
                            <View style={styles.onboardingHeader}>
                                <Ionicons name="checkmark-circle" size={80} color="#30D158" />
                                <Text style={styles.onboardingCompleteTitle}>{"You're all set!"}</Text>
                                <Text style={styles.onboardingCompleteSubtitle}>
                                    Your preferences have been saved. You can change them anytime in Settings.
                                </Text>
                            </View>
                            <View style={styles.onboardingSummary}>
                                {selectedTeams.length > 0 && (
                                    <View style={styles.onboardingSummaryItem}>
                                        <Ionicons name="snow-outline" size={20} color="#0A84FF" />
                                        <Text style={styles.onboardingSummaryText}>
                                            Following {selectedTeams.length} hockey team{selectedTeams.length > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                )}
                                {selectedGenders.length > 0 && (
                                    <View style={styles.onboardingSummaryItem}>
                                        <Ionicons name="locate-outline" size={20} color="#D94A8C" />
                                        <Text style={styles.onboardingSummaryText}>
                                            Biathlon: {selectedGenders.map(g => GENDER_OPTIONS.find(o => o.id === g)?.label).join(', ')}
                                        </Text>
                                    </View>
                                )}
                                {selectedNations.length > 0 && (
                                    <View style={styles.onboardingSummaryItem}>
                                        <Ionicons name="flag-outline" size={20} color="#FF9F0A" />
                                        <Text style={styles.onboardingSummaryText}>
                                            {selectedNations.length} countr{selectedNations.length > 1 ? 'ies' : 'y'} selected
                                        </Text>
                                    </View>
                                )}
                                {selectedTeams.length === 0 && selectedGenders.length === 0 && selectedNations.length === 0 && (
                                    <View style={styles.onboardingSummaryItem}>
                                        <Ionicons name="globe-outline" size={20} color="#888" />
                                        <Text style={styles.onboardingSummaryText}>
                                            Showing all games and races
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity style={styles.onboardingButtonLarge} onPress={completeOnboarding}>
                                <Text style={styles.onboardingButtonText}>Start Exploring</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
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
    emptyText: { color: '#666', fontSize: 16, textAlign: 'center', padding: 20 },

    // Settings Button
    settingsButton: { padding: 8 },

    // Biathlon Filters
    biathlonFiltersContainer: { paddingBottom: 8 },
    filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
    filterRowLabel: { color: '#666', fontSize: 11, fontWeight: '600', width: 55, textTransform: 'uppercase' },
    filterRowContent: { flexDirection: 'row', gap: 6 },
    filterPillSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#333' },
    filterTextSmall: { color: '#8e8e93', fontWeight: '600', fontSize: 12 },
    filterFlagTextSmall: { fontSize: 14 },

    // Settings Modal
    settingsHeader: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#333' },
    settingsTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', paddingTop: 10 },
    settingsContent: { flex: 1, padding: 16 },
    settingsSection: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
    settingsSectionSubtitle: { color: '#666', fontSize: 14, marginBottom: 20 },
    settingsCard: { backgroundColor: '#1c1c1e', borderRadius: 16, padding: 16, marginBottom: 16 },
    settingsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    settingsCardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    settingsChipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    settingsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#252525', borderWidth: 1, borderColor: '#333' },
    settingsChipActive: { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
    settingsChipLogo: { width: 24, height: 24 },
    settingsChipFlag: { fontSize: 18 },
    settingsChipText: { color: '#888', fontSize: 13, fontWeight: '600' },
    settingsChipTextActive: { color: '#fff' },
    clearButton: { marginTop: 12, alignSelf: 'flex-start' },
    clearButtonText: { color: '#0A84FF', fontSize: 13, fontWeight: '600' },
    resetOnboardingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 16, backgroundColor: 'rgba(255, 159, 10, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 159, 10, 0.3)' },
    resetOnboardingText: { color: '#FF9F0A', fontSize: 15, fontWeight: '600' },

    // Onboarding
    onboardingContainer: { flex: 1, backgroundColor: '#0a0a0a' },
    onboardingStep: { flex: 1, padding: 24, justifyContent: 'space-between' },
    onboardingHeader: { alignItems: 'center', paddingTop: 60, gap: 12 },
    onboardingWelcome: { color: '#888', fontSize: 18, fontWeight: '500', marginTop: 30 },
    onboardingAppName: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1 },
    onboardingTagline: { color: '#666', fontSize: 16 },
    onboardingContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
    onboardingDesc: { color: '#aaa', fontSize: 18, textAlign: 'center', lineHeight: 28 },
    onboardingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0A84FF', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14 },
    onboardingButtonLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0A84FF', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 14, marginTop: 40 },
    onboardingButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    onboardingStepHeader: { alignItems: 'center', marginBottom: 24 },
    onboardingStepNumber: { color: '#0A84FF', fontSize: 13, fontWeight: '700', marginBottom: 8 },
    onboardingStepTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
    onboardingStepSubtitle: { color: '#888', fontSize: 15, marginTop: 8, textAlign: 'center' },
    onboardingScrollContent: { flex: 1 },
    onboardingChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    onboardingChipRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
    onboardingChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1c1c1e', borderWidth: 2, borderColor: '#333', minWidth: 100 },
    onboardingChipActive: { backgroundColor: 'rgba(10, 132, 255, 0.2)', borderColor: '#0A84FF' },
    onboardingChipLogo: { width: 32, height: 32 },
    onboardingChipText: { color: '#888', fontSize: 14, fontWeight: '600' },
    onboardingChipTextActive: { color: '#fff' },
    onboardingChipCheck: { marginLeft: 'auto' },
    onboardingGenderChip: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12, backgroundColor: '#1c1c1e', borderWidth: 2, borderColor: '#333' },
    onboardingGenderText: { color: '#888', fontSize: 16, fontWeight: '700' },
    onboardingGenderTextActive: { color: '#fff' },
    onboardingSectionLabel: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
    onboardingNationChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1c1c1e', borderWidth: 2, borderColor: '#333' },
    onboardingNationFlag: { fontSize: 22 },
    onboardingNationText: { color: '#888', fontSize: 13, fontWeight: '600' },
    onboardingNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 },
    onboardingNavButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
    onboardingNavButtonText: { color: '#888', fontSize: 15, fontWeight: '600' },
    onboardingCompleteTitle: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 24, textAlign: 'center' },
    onboardingCompleteSubtitle: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 24 },
    onboardingSummary: { backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20, marginTop: 30 },
    onboardingSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    onboardingSummaryText: { color: '#fff', fontSize: 15, fontWeight: '500' }
});
