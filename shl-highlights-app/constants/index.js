// App Configuration
export const APP_NAME = 'GamePulse';
export const APP_TAGLINE = 'Sports schedule & highlights';

// Team Color Mapping
export const TEAM_COLORS = {
    'LIF': ['#12284C', '#FFFFFF'],
    'DIF': ['#00247D', '#CF142B'],
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
    'VLH': ['#00205B', '#FFD700'],
};

// Storage keys for AsyncStorage
export const STORAGE_KEYS = {
    SELECTED_SPORT: 'selectedSport',
    SELECTED_TEAMS: 'selectedTeams',
    SELECTED_FOOTBALL_TEAMS: 'selectedFootballTeams',
    SELECTED_NATIONS: 'selectedNations',
    SELECTED_GENDERS: 'selectedGenders',
    ONBOARDING_COMPLETE: 'onboardingComplete',
    ENABLED_SPORTS: 'enabledSports',
    NOTIFICATIONS_ENABLED: 'notificationsEnabled',
    GOAL_NOTIFICATIONS_ENABLED: 'goalNotificationsEnabled',
    // Legacy grouped football flag (migrated to per-league keys, see PRE_GAME_LEAGUES)
    LEGACY_PRE_GAME_FOOTBALL_ENABLED: 'preGameFootballEnabled',
    // Theme preference
    THEME_MODE: 'themeMode'
};

// Pre-game reminder leagues. One toggle per league so reminders can be
// controlled individually. Adding a new league = add one entry here (plus
// the matching backend case in modules/fcm-notifications.js) and the app UI,
// storage, and topic subscription all follow automatically.
// `sportGroup` is used purely to group the toggles visually in Settings.
// `topic` must match the FCM topic the backend publishes to for that league.
export const PRE_GAME_LEAGUES = [
    { id: 'shl', label: 'SHL', sportGroup: 'Hockey', icon: 'snow-outline', topic: 'pre_game_shl', storageKey: 'preGameShlEnabled', description: 'Remind me before SHL games' },
    { id: 'hockeyallsvenskan', label: 'HockeyAllsvenskan', sportGroup: 'Hockey', icon: 'snow-outline', topic: 'pre_game_hockeyallsvenskan', storageKey: 'preGameHockeyAllsvenskanEnabled', description: 'Remind me before HockeyAllsvenskan games' },
    { id: 'allsvenskan', label: 'Allsvenskan', sportGroup: 'Football', icon: 'football-outline', topic: 'pre_game_allsvenskan', storageKey: 'preGameAllsvenskanEnabled', description: 'Remind me before Allsvenskan matches' },
    { id: 'svenska-cupen', label: 'Svenska Cupen', sportGroup: 'Football', icon: 'football-outline', topic: 'pre_game_svenska_cupen', storageKey: 'preGameSvenskaCupenEnabled', description: 'Remind me before Svenska Cupen matches' },
    { id: 'europa-league-qual', label: 'Europa League Qual', sportGroup: 'Football', icon: 'football-outline', topic: 'pre_game_europa_qual', storageKey: 'preGameEuropaQualEnabled', description: 'Remind me before Europa League qualifiers' },
    { id: 'conference-league-qual', label: 'Conference League Qual', sportGroup: 'Football', icon: 'football-outline', topic: 'pre_game_conference_qual', storageKey: 'preGameConferenceQualEnabled', description: 'Remind me before Conference League qualifiers' },
    { id: 'biathlon', label: 'Biathlon', sportGroup: 'Biathlon', icon: 'locate-outline', topic: 'pre_game_biathlon', storageKey: 'preGameBiathlonEnabled', description: 'Remind me before biathlon races' }
];

// Football leagues previously grouped under the single legacy pre_game_football
// topic. Used to migrate an existing grouped preference into per-league flags.
export const LEGACY_FOOTBALL_LEAGUE_IDS = ['allsvenskan', 'svenska-cupen', 'europa-league-qual', 'conference-league-qual'];

// Theme mode options
export const THEME_MODES = {
    SYSTEM: 'system',
    LIGHT: 'light',
    DARK: 'dark'
};

// Theme mode display options for settings
export const THEME_OPTIONS = [
    { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { id: 'light', label: 'Light', icon: 'sunny-outline' },
    { id: 'dark', label: 'Dark', icon: 'moon-outline' }
];

// FCM Topic names for push notifications.
// Per-league pre-game topics live on PRE_GAME_LEAGUES[].topic above.
export const FCM_TOPICS = {
    GOAL_NOTIFICATIONS: 'goal_notifications'
};

// Legacy alias for backward compatibility
export const NOTIFICATION_TAGS = FCM_TOPICS;

// Gender options for biathlon
export const GENDER_OPTIONS = [
    { id: 'men', label: 'Men', color: '#4A90D9' },
    { id: 'women', label: 'Women', color: '#D94A8C' },
    { id: 'mixed', label: 'Mixed', color: '#9B59B6' }
];

// Discipline icons for biathlon
export const DISCIPLINE_ICONS = {
    'Sprint': 'flash-outline',
    'Pursuit': 'trending-up-outline',
    'Individual': 'person-outline',
    'Mass Start': 'people-outline',
    'Relay': 'swap-horizontal-outline',
    'Mixed Relay': 'git-merge-outline',
    'Single Mixed Relay': 'git-branch-outline'
};

// Gender colors for biathlon
export const GENDER_COLORS = {
    'men': '#4A90D9',
    'women': '#D94A8C',
    'mixed': '#9B59B6'
};

// Helper to get team color
export const getTeamColor = (code, fallbackColor = '#333') => {
    if (typeof code !== 'string') {
        return fallbackColor;
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
        return fallbackColor;
    }

    return TEAM_COLORS[normalizedCode]?.[0] || fallbackColor;
};
