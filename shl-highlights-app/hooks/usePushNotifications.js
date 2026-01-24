import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, FCM_TOPICS } from '../constants';

// Silence Firebase modular API deprecation warnings (namespaced API still works in v23)
// TODO: Migrate to modular API in a future release
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

// Only import Firebase on native platforms
let messaging = null;
if (Platform.OS !== 'web') {
    try {
        messaging = require('@react-native-firebase/messaging').default;
    } catch (e) {
        console.log('[FCM] Firebase messaging not available:', e.message);
    }
}

/**
 * Hook for managing Firebase Cloud Messaging push notifications
 * Handles initialization, permission requests, and topic subscriptions
 *
 * Topic structure:
 * - goal_notifications - enables goal notification targeting
 * - team_{code} - individual team subscription (e.g., team_lif, team_aik)
 * - pre_game_shl - enables pre-game notifications for SHL
 * - pre_game_football - enables pre-game notifications for Allsvenskan
 * - pre_game_biathlon - enables pre-game notifications for Biathlon
 */
export function usePushNotifications() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [fcmToken, setFcmToken] = useState(null);

    // Notification preferences state
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState(true);

    // Pre-game notification preferences per sport
    const [preGameShlEnabled, setPreGameShlEnabled] = useState(false);
    const [preGameFootballEnabled, setPreGameFootballEnabled] = useState(false);
    const [preGameBiathlonEnabled, setPreGameBiathlonEnabled] = useState(false);

    // Track all current team topics
    const currentTeamsRef = useRef(new Set());

    // Queue for pending topic updates before initialization
    const pendingTeamUpdatesRef = useRef(null);
    const pendingTopicUpdatesRef = useRef({});

    // Track initialization
    const initCompletedRef = useRef(false);
    const isInitializedRef = useRef(false);

    // Get API base URL from config
    const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';

    /**
     * Register device with backend server
     */
    const registerWithServer = useCallback(async (token, topics) => {
        try {
            const response = await fetch(`${apiBaseUrl}/api/fcm/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    topics,
                    platform: Platform.OS
                })
            });
            const result = await response.json();
            if (result.success) {
                console.log('[FCM] Registered with server successfully');
            } else {
                console.warn('[FCM] Server registration failed:', result.error);
            }
            return result;
        } catch (error) {
            console.error('[FCM] Error registering with server:', error.message);
            return { success: false, error: error.message };
        }
    }, [apiBaseUrl]);

    /**
     * Subscribe to a topic
     */
    const subscribeToTopic = useCallback(async (topic) => {
        if (!messaging) {
            return false;
        }
        try {
            await messaging().subscribeToTopic(topic);
            console.log(`[FCM] Subscribed to topic: ${topic}`);
            return true;
        } catch (error) {
            console.error(`[FCM] Error subscribing to ${topic}:`, error.message);
            return false;
        }
    }, []);

    /**
     * Unsubscribe from a topic
     */
    const unsubscribeFromTopic = useCallback(async (topic) => {
        if (!messaging) {
            return false;
        }
        try {
            await messaging().unsubscribeFromTopic(topic);
            console.log(`[FCM] Unsubscribed from topic: ${topic}`);
            return true;
        } catch (error) {
            console.error(`[FCM] Error unsubscribing from ${topic}:`, error.message);
            return false;
        }
    }, []);

    /**
     * Apply team topics
     */
    const applyTeamTopics = useCallback(async (teamCodes) => {
        if (!messaging) {
            return;
        }

        const newTeams = new Set(teamCodes.map(code => code.toLowerCase()));
        const currentTeams = currentTeamsRef.current;

        // Find teams to remove and add
        const teamsToRemove = [...currentTeams].filter(code => !newTeams.has(code));
        const teamsToAdd = [...newTeams].filter(code => !currentTeams.has(code));

        // Unsubscribe from removed teams
        for (const code of teamsToRemove) {
            await unsubscribeFromTopic(`team_${code}`);
        }

        // Subscribe to new teams
        for (const code of teamsToAdd) {
            await subscribeToTopic(`team_${code}`);
        }

        // Update ref
        currentTeamsRef.current = newTeams;

        if (teamsToAdd.length > 0 || teamsToRemove.length > 0) {
            console.log('[FCM] Team topics updated - added:', teamsToAdd, 'removed:', teamsToRemove);

            // Sync with server
            if (fcmToken) {
                const allTopics = await buildCurrentTopicList();
                await registerWithServer(fcmToken, allTopics);
            }
        }
    }, [subscribeToTopic, unsubscribeFromTopic, fcmToken, registerWithServer]);

    /**
     * Build current topic list from state
     */
    const buildCurrentTopicList = useCallback(async () => {
        const topics = [];

        // Add notification type topics
        const savedGoal = await AsyncStorage.getItem(STORAGE_KEYS.GOAL_NOTIFICATIONS_ENABLED);
        if (savedGoal !== 'false') {
            topics.push(FCM_TOPICS.GOAL_NOTIFICATIONS);
        }

        const savedPreGameShl = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_SHL_ENABLED);
        if (savedPreGameShl === 'true') {
            topics.push(FCM_TOPICS.PRE_GAME_SHL);
        }

        const savedPreGameFootball = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_FOOTBALL_ENABLED);
        if (savedPreGameFootball === 'true') {
            topics.push(FCM_TOPICS.PRE_GAME_FOOTBALL);
        }

        const savedPreGameBiathlon = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_BIATHLON_ENABLED);
        if (savedPreGameBiathlon === 'true') {
            topics.push(FCM_TOPICS.PRE_GAME_BIATHLON);
        }

        // Add team topics
        for (const team of currentTeamsRef.current) {
            topics.push(`team_${team}`);
        }

        return topics;
    }, []);

    /**
     * Sync a single topic based on enabled state
     */
    const syncTopic = useCallback(async (topicName, enabled, forceApply = false) => {
        if (!messaging) {
            console.log('[FCM] syncTopic skipped - Firebase not available (web)');
            return;
        }

        if (!isInitializedRef.current && !forceApply) {
            console.log(`[FCM] Queuing topic update (not initialized): ${topicName} = ${enabled}`);
            pendingTopicUpdatesRef.current[topicName] = enabled;
            return;
        }

        if (enabled) {
            await subscribeToTopic(topicName);
        } else {
            await unsubscribeFromTopic(topicName);
        }

        // Sync with server
        if (fcmToken) {
            const allTopics = await buildCurrentTopicList();
            await registerWithServer(fcmToken, allTopics);
        }
    }, [subscribeToTopic, unsubscribeFromTopic, fcmToken, registerWithServer, buildCurrentTopicList]);

    /**
     * Initialize Firebase Cloud Messaging
     */
    useEffect(() => {
        const initFCM = async () => {
            if (initCompletedRef.current) {
                return;
            }

            if (!messaging) {
                console.log('[FCM] Skipped - not supported on web');
                return;
            }

            try {
                // Request permission on iOS
                if (Platform.OS === 'ios') {
                    const authStatus = await messaging().requestPermission();
                    const enabled =
                        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
                    setHasPermission(enabled);

                    if (!enabled) {
                        console.log('[FCM] Permission not granted');
                        return;
                    }
                } else if (Platform.OS === 'android') {
                    // Android 13+ requires POST_NOTIFICATIONS permission
                    if (Platform.Version >= 33) {
                        const granted = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                        );
                        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
                    } else {
                        setHasPermission(true);
                    }
                }

                // Get FCM token
                const token = await messaging().getToken();
                setFcmToken(token);
                console.log('[FCM] Token obtained:', token.slice(-12));

                // Load saved notification preferences
                const savedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
                const savedGoalNotifications = await AsyncStorage.getItem(STORAGE_KEYS.GOAL_NOTIFICATIONS_ENABLED);
                const savedPreGameShl = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_SHL_ENABLED);
                const savedPreGameFootball = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_FOOTBALL_ENABLED);
                const savedPreGameBiathlon = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_BIATHLON_ENABLED);

                const isEnabled = savedEnabled === 'true';
                const goalEnabled = savedGoalNotifications !== 'false';
                const preGameShl = savedPreGameShl === 'true';
                const preGameFootball = savedPreGameFootball === 'true';
                const preGameBiathlon = savedPreGameBiathlon === 'true';

                setNotificationsEnabled(isEnabled);
                setGoalNotificationsEnabled(goalEnabled);
                setPreGameShlEnabled(preGameShl);
                setPreGameFootballEnabled(preGameFootball);
                setPreGameBiathlonEnabled(preGameBiathlon);

                // Subscribe to topics
                if (goalEnabled) {
                    await subscribeToTopic(FCM_TOPICS.GOAL_NOTIFICATIONS);
                }
                if (preGameShl) {
                    await subscribeToTopic(FCM_TOPICS.PRE_GAME_SHL);
                }
                if (preGameFootball) {
                    await subscribeToTopic(FCM_TOPICS.PRE_GAME_FOOTBALL);
                }
                if (preGameBiathlon) {
                    await subscribeToTopic(FCM_TOPICS.PRE_GAME_BIATHLON);
                }

                // Load and sync saved team preferences
                const savedShlTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS);
                const savedFootballTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS);

                const allTeams = [];

                if (savedShlTeams) {
                    try {
                        const teams = JSON.parse(savedShlTeams);
                        if (Array.isArray(teams)) {
                            allTeams.push(...teams);
                        }
                    } catch (e) {
                        console.error('[FCM] Error parsing saved SHL teams:', e);
                    }
                }

                if (savedFootballTeams) {
                    try {
                        const teams = JSON.parse(savedFootballTeams);
                        if (Array.isArray(teams)) {
                            allTeams.push(...teams);
                        }
                    } catch (e) {
                        console.error('[FCM] Error parsing saved football teams:', e);
                    }
                }

                // Subscribe to team topics
                for (const team of allTeams) {
                    const code = team.toLowerCase();
                    await subscribeToTopic(`team_${code}`);
                    currentTeamsRef.current.add(code);
                }

                console.log('[FCM] Synced team topics on init:', allTeams);

                // Listen for token refresh
                const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
                    console.log('[FCM] Token refreshed');
                    setFcmToken(newToken);
                    const topics = await buildCurrentTopicList();
                    await registerWithServer(newToken, topics);
                });

                // Handle foreground messages
                const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
                    console.log('[FCM] Foreground message received:', remoteMessage);
                });

                // Set initialized
                isInitializedRef.current = true;
                setIsInitialized(true);
                initCompletedRef.current = true;
                console.log('[FCM] Initialized successfully');

                // Register with server
                const topics = await buildCurrentTopicList();
                await registerWithServer(token, topics);

                // Process pending team updates
                if (pendingTeamUpdatesRef.current !== null) {
                    console.log('[FCM] Processing pending team update');
                    await applyTeamTopics(pendingTeamUpdatesRef.current);
                    pendingTeamUpdatesRef.current = null;
                }

                // Process pending topic updates
                const pendingTopics = pendingTopicUpdatesRef.current;
                if (Object.keys(pendingTopics).length > 0) {
                    console.log('[FCM] Processing pending topic updates:', pendingTopics);
                    for (const [topicName, enabled] of Object.entries(pendingTopics)) {
                        if (enabled) {
                            await subscribeToTopic(topicName);
                        } else {
                            await unsubscribeFromTopic(topicName);
                        }
                    }
                    pendingTopicUpdatesRef.current = {};
                }

                // Cleanup
                return () => {
                    unsubscribeTokenRefresh();
                    unsubscribeMessage();
                };
            } catch (error) {
                console.error('[FCM] Initialization error:', error);
            }
        };

        initFCM();
    }, [subscribeToTopic, unsubscribeFromTopic, registerWithServer, buildCurrentTopicList, applyTeamTopics]);

    /**
     * Request notification permission
     */
    const requestPermission = useCallback(async () => {
        if (!messaging) {
            return false;
        }

        try {
            if (Platform.OS === 'ios') {
                const authStatus = await messaging().requestPermission();
                const enabled =
                    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
                setHasPermission(enabled);

                if (enabled) {
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
                }

                return enabled;
            } else if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                const enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
                setHasPermission(enabled);

                if (enabled) {
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
                }

                return enabled;
            }

            return true;
        } catch (error) {
            console.error('[FCM] Permission request error:', error);
            return false;
        }
    }, []);

    /**
     * Toggle notifications on/off
     */
    const toggleNotifications = useCallback(async (enabled) => {
        if (!messaging) {
            return;
        }

        try {
            if (enabled) {
                const granted = await requestPermission();
                if (granted) {
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
                }
            } else {
                setNotificationsEnabled(false);
                await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
            }
        } catch (error) {
            console.error('[FCM] Toggle error:', error);
        }
    }, [requestPermission]);

    /**
     * Toggle goal notifications
     */
    const toggleGoalNotifications = useCallback(async (enabled) => {
        setGoalNotificationsEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.GOAL_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
        await syncTopic(FCM_TOPICS.GOAL_NOTIFICATIONS, enabled);
    }, [syncTopic]);

    /**
     * Toggle pre-game notifications for SHL
     */
    const togglePreGameShl = useCallback(async (enabled) => {
        setPreGameShlEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_SHL_ENABLED, enabled ? 'true' : 'false');
        await syncTopic(FCM_TOPICS.PRE_GAME_SHL, enabled);
        console.log('[FCM] Pre-game SHL notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTopic]);

    /**
     * Toggle pre-game notifications for Allsvenskan/Football
     */
    const togglePreGameFootball = useCallback(async (enabled) => {
        setPreGameFootballEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_FOOTBALL_ENABLED, enabled ? 'true' : 'false');
        await syncTopic(FCM_TOPICS.PRE_GAME_FOOTBALL, enabled);
        console.log('[FCM] Pre-game Football notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTopic]);

    /**
     * Toggle pre-game notifications for Biathlon
     */
    const togglePreGameBiathlon = useCallback(async (enabled) => {
        setPreGameBiathlonEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_BIATHLON_ENABLED, enabled ? 'true' : 'false');
        await syncTopic(FCM_TOPICS.PRE_GAME_BIATHLON, enabled);
        console.log('[FCM] Pre-game Biathlon notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTopic]);

    /**
     * Update team topics
     * @param {string[]} allTeamCodes - Array of all selected team codes
     */
    const setTeamTags = useCallback((allTeamCodes) => {
        if (!isInitializedRef.current) {
            console.log('[FCM] Queuing team topics update (not initialized yet):', allTeamCodes);
            pendingTeamUpdatesRef.current = [...allTeamCodes];
            return;
        }

        applyTeamTopics(allTeamCodes);
    }, [applyTeamTopics]);

    /**
     * Get all current topics (for debugging)
     */
    const getTags = useCallback(async () => {
        // FCM doesn't have a direct way to get subscribed topics
        // Return the locally tracked topics
        const topics = await buildCurrentTopicList();
        const result = {};
        for (const topic of topics) {
            result[topic] = 'true';
        }
        return result;
    }, [buildCurrentTopicList]);

    /**
     * Force sync team topics from AsyncStorage
     */
    const syncTeamTags = useCallback(async () => {
        if (!isInitializedRef.current) {
            console.warn('[FCM] Cannot sync topics - not initialized');
            return;
        }

        try {
            const savedShlTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS);
            const savedFootballTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS);

            const allTeams = [];

            if (savedShlTeams) {
                const teams = JSON.parse(savedShlTeams);
                if (Array.isArray(teams)) {
                    allTeams.push(...teams);
                }
            }

            if (savedFootballTeams) {
                const teams = JSON.parse(savedFootballTeams);
                if (Array.isArray(teams)) {
                    allTeams.push(...teams);
                }
            }

            await applyTeamTopics(allTeams);
            console.log('[FCM] Force synced team topics from AsyncStorage:', allTeams);
        } catch (error) {
            console.error('[FCM] Sync team topics error:', error);
        }
    }, [applyTeamTopics]);

    return {
        // State
        isInitialized,
        hasPermission,
        subscriptionId: fcmToken, // Alias for compatibility
        fcmToken,
        notificationsEnabled,
        goalNotificationsEnabled,
        // Pre-game notification state per sport
        preGameShlEnabled,
        preGameFootballEnabled,
        preGameBiathlonEnabled,

        // Actions
        requestPermission,
        toggleNotifications,
        toggleGoalNotifications,
        // Pre-game notification toggles
        togglePreGameShl,
        togglePreGameFootball,
        togglePreGameBiathlon,
        setTeamTags,
        getTags,
        syncTeamTags
    };
}
