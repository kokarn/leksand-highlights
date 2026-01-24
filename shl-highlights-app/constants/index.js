// App Configuration
export const APP_NAME = 'GamePulse';
export const APP_TAGLINE = 'Sports schedule & highlights';

// Team Color Mapping
export const TEAM_COLORS = {
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
    // Pre-game notification settings per sport
    PRE_GAME_SHL_ENABLED: 'preGameShlEnabled',
    PRE_GAME_FOOTBALL_ENABLED: 'preGameFootballEnabled',
    PRE_GAME_BIATHLON_ENABLED: 'preGameBiathlonEnabled'
};

// FCM Topic names for push notifications
export const FCM_TOPICS = {
    GOAL_NOTIFICATIONS: 'goal_notifications',
    PRE_GAME_SHL: 'pre_game_shl',
    PRE_GAME_FOOTBALL: 'pre_game_football',
    PRE_GAME_BIATHLON: 'pre_game_biathlon'
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
export const getTeamColor = (code) => TEAM_COLORS[code]?.[0] || '#333';
