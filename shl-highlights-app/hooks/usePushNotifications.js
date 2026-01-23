import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, NOTIFICATION_TAGS } from '../constants';

// Only import OneSignal on native platforms
let OneSignal = null;
if (Platform.OS !== 'web') {
    OneSignal = require('react-native-onesignal').OneSignal;
}

/**
 * Hook for managing OneSignal push notifications
 * Handles initialization, permission requests, and tag-based subscriptions
 *
 * Tag structure:
 * - goal_notifications: 'true' | removed - enables goal notification targeting
 * - team_{code}: 'true' | removed - individual team subscription (e.g., team_lif, team_aik)
 * - pre_game_shl: 'true' | removed - enables pre-game notifications for SHL
 * - pre_game_football: 'true' | removed - enables pre-game notifications for Allsvenskan
 * - pre_game_biathlon: 'true' | removed - enables pre-game notifications for Biathlon
 */
export function usePushNotifications() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState(null);

    // Notification preferences state
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState(true);

    // Pre-game notification preferences per sport
    const [preGameShlEnabled, setPreGameShlEnabled] = useState(false);
    const [preGameFootballEnabled, setPreGameFootballEnabled] = useState(false);
    const [preGameBiathlonEnabled, setPreGameBiathlonEnabled] = useState(false);

    // Track all current team tags to properly remove old ones
    const currentTeamsRef = useRef(new Set());

    // Queue for pending tag updates before initialization
    const pendingTeamUpdatesRef = useRef(null);

    // Queue for pending single tag updates before initialization
    const pendingTagUpdatesRef = useRef({});

    // Track initialization to prevent re-running init effect
    const initCompletedRef = useRef(false);

    // Apply team tags to OneSignal (internal helper)
    const applyTeamTags = useCallback((teamCodes) => {
        if (!OneSignal) {
            return;
        }

        const newTeams = new Set(teamCodes.map(code => code.toLowerCase()));
        const currentTeams = currentTeamsRef.current;

        // Find teams to remove (in current but not in new)
        const teamsToRemove = [...currentTeams].filter(code => !newTeams.has(code));

        // Find teams to add (in new but not in current)
        const teamsToAdd = [...newTeams].filter(code => !currentTeams.has(code));

        // Remove old team tags
        teamsToRemove.forEach(code => {
            OneSignal.User.removeTag(`team_${code}`);
        });

        // Add new team tags
        teamsToAdd.forEach(code => {
            OneSignal.User.addTag(`team_${code}`, 'true');
        });

        // Update ref
        currentTeamsRef.current = newTeams;

        if (teamsToAdd.length > 0 || teamsToRemove.length > 0) {
            console.log('[OneSignal] Team tags updated - added:', teamsToAdd, 'removed:', teamsToRemove);
        }
    }, []);

    // Helper to sync a single tag based on enabled state
    // Now checks initialization state and queues updates if needed
    const syncTag = useCallback((tagKey, enabled, forceApply = false) => {
        if (!OneSignal) {
            console.log('[OneSignal] syncTag skipped - OneSignal not available (web)');
            return;
        }

        // If not initialized yet and not forcing, queue the update
        if (!isInitialized && !forceApply) {
            console.log(`[OneSignal] Queuing tag update (not initialized): ${tagKey} = ${enabled}`);
            pendingTagUpdatesRef.current[tagKey] = enabled;
            return;
        }

        try {
            if (enabled) {
                OneSignal.User.addTag(tagKey, 'true');
                console.log(`[OneSignal] Tag added: ${tagKey} = true`);
            } else {
                OneSignal.User.removeTag(tagKey);
                console.log(`[OneSignal] Tag removed: ${tagKey}`);
            }
        } catch (error) {
            console.error(`[OneSignal] Error syncing tag ${tagKey}:`, error);
        }
    }, [isInitialized]);

    // Initialize OneSignal on mount
    useEffect(() => {
        const initOneSignal = async () => {
            // Prevent multiple initialization runs
            if (initCompletedRef.current) {
                return;
            }

            // Skip on web - native module not available
            if (!OneSignal) {
                console.log('[OneSignal] Skipped - not supported on web');
                return;
            }

            try {
                const appId = Constants.expoConfig?.extra?.oneSignalAppId;

                if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID') {
                    console.warn('[OneSignal] App ID not configured. Push notifications disabled.');
                    return;
                }

                // Initialize OneSignal
                OneSignal.initialize(appId);

                // Check current permission status
                const permission = await OneSignal.Notifications.getPermissionAsync();
                setHasPermission(permission);

                // Get subscription ID
                const subId = await OneSignal.User.pushSubscription.getIdAsync();
                setSubscriptionId(subId);

                // Load saved notification preferences
                const savedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
                const savedGoalNotifications = await AsyncStorage.getItem(STORAGE_KEYS.GOAL_NOTIFICATIONS_ENABLED);

                // Load pre-game notification preferences
                const savedPreGameShl = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_SHL_ENABLED);
                const savedPreGameFootball = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_FOOTBALL_ENABLED);
                const savedPreGameBiathlon = await AsyncStorage.getItem(STORAGE_KEYS.PRE_GAME_BIATHLON_ENABLED);

                const isEnabled = savedEnabled === 'true';
                const goalEnabled = savedGoalNotifications !== 'false'; // Default to true
                const preGameShl = savedPreGameShl === 'true';
                const preGameFootball = savedPreGameFootball === 'true';
                const preGameBiathlon = savedPreGameBiathlon === 'true';

                setNotificationsEnabled(isEnabled);
                setGoalNotificationsEnabled(goalEnabled);
                setPreGameShlEnabled(preGameShl);
                setPreGameFootballEnabled(preGameFootball);
                setPreGameBiathlonEnabled(preGameBiathlon);

                // Sync goal_notifications tag on initialization (forceApply since we just initialized)
                syncTag(NOTIFICATION_TAGS.GOAL_NOTIFICATIONS, goalEnabled, true);

                // Sync pre-game notification tags
                syncTag(NOTIFICATION_TAGS.PRE_GAME_SHL, preGameShl, true);
                syncTag(NOTIFICATION_TAGS.PRE_GAME_FOOTBALL, preGameFootball, true);
                syncTag(NOTIFICATION_TAGS.PRE_GAME_BIATHLON, preGameBiathlon, true);

                // Load and sync saved team preferences from both sports
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
                        console.error('[OneSignal] Error parsing saved SHL teams:', e);
                    }
                }

                if (savedFootballTeams) {
                    try {
                        const teams = JSON.parse(savedFootballTeams);
                        if (Array.isArray(teams)) {
                            allTeams.push(...teams);
                        }
                    } catch (e) {
                        console.error('[OneSignal] Error parsing saved football teams:', e);
                    }
                }

                // Apply all team tags
                if (allTeams.length > 0) {
                    applyTeamTags(allTeams);
                    console.log('[OneSignal] Synced team tags on init:', allTeams);
                }

                // Listen for permission changes
                OneSignal.Notifications.addEventListener('permissionChange', (granted) => {
                    setHasPermission(granted);
                });

                // Listen for subscription changes
                OneSignal.User.pushSubscription.addEventListener('change', (state) => {
                    if (state.current?.id) {
                        setSubscriptionId(state.current.id);
                    }
                });

                setIsInitialized(true);
                initCompletedRef.current = true;
                console.log('[OneSignal] Initialized successfully');

                // Process any pending team update that was queued before initialization
                if (pendingTeamUpdatesRef.current !== null) {
                    console.log('[OneSignal] Processing pending team update');
                    applyTeamTags(pendingTeamUpdatesRef.current);
                    pendingTeamUpdatesRef.current = null;
                }

                // Process any pending single tag updates that were queued before initialization
                const pendingTags = pendingTagUpdatesRef.current;
                if (Object.keys(pendingTags).length > 0) {
                    console.log('[OneSignal] Processing pending tag updates:', pendingTags);
                    for (const [tagKey, enabled] of Object.entries(pendingTags)) {
                        try {
                            if (enabled) {
                                OneSignal.User.addTag(tagKey, 'true');
                                console.log(`[OneSignal] Pending tag applied: ${tagKey} = true`);
                            } else {
                                OneSignal.User.removeTag(tagKey);
                                console.log(`[OneSignal] Pending tag removed: ${tagKey}`);
                            }
                        } catch (error) {
                            console.error(`[OneSignal] Error applying pending tag ${tagKey}:`, error);
                        }
                    }
                    pendingTagUpdatesRef.current = {};
                }
            } catch (error) {
                console.error('[OneSignal] Initialization error:', error);
            }
        };

        initOneSignal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyTeamTags]);

    // Request notification permission
    const requestPermission = useCallback(async () => {
        if (!OneSignal) {
            return false;
        }

        try {
            const canRequest = await OneSignal.Notifications.canRequestPermission();

            if (canRequest) {
                const granted = await OneSignal.Notifications.requestPermission(true);
                setHasPermission(granted);

                if (granted) {
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
                    OneSignal.User.pushSubscription.optIn();
                }

                return granted;
            } else {
                // User has already been prompted, check current status
                const permission = await OneSignal.Notifications.getPermissionAsync();
                return permission;
            }
        } catch (error) {
            console.error('[OneSignal] Permission request error:', error);
            return false;
        }
    }, []);

    // Toggle notifications on/off
    const toggleNotifications = useCallback(async (enabled) => {
        if (!OneSignal) {
            return;
        }

        try {
            if (enabled) {
                const granted = await requestPermission();
                if (granted) {
                    OneSignal.User.pushSubscription.optIn();
                    setNotificationsEnabled(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
                }
            } else {
                OneSignal.User.pushSubscription.optOut();
                setNotificationsEnabled(false);
                await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
            }
        } catch (error) {
            console.error('[OneSignal] Toggle error:', error);
        }
    }, [requestPermission]);

    // Toggle goal notifications
    const toggleGoalNotifications = useCallback(async (enabled) => {
        setGoalNotificationsEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.GOAL_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
        syncTag(NOTIFICATION_TAGS.GOAL_NOTIFICATIONS, enabled);
    }, [syncTag]);

    // Toggle pre-game notifications for SHL
    const togglePreGameShl = useCallback(async (enabled) => {
        setPreGameShlEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_SHL_ENABLED, enabled ? 'true' : 'false');
        syncTag(NOTIFICATION_TAGS.PRE_GAME_SHL, enabled);
        console.log('[OneSignal] Pre-game SHL notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTag]);

    // Toggle pre-game notifications for Allsvenskan/Football
    const togglePreGameFootball = useCallback(async (enabled) => {
        setPreGameFootballEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_FOOTBALL_ENABLED, enabled ? 'true' : 'false');
        syncTag(NOTIFICATION_TAGS.PRE_GAME_FOOTBALL, enabled);
        console.log('[OneSignal] Pre-game Football notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTag]);

    // Toggle pre-game notifications for Biathlon
    const togglePreGameBiathlon = useCallback(async (enabled) => {
        setPreGameBiathlonEnabled(enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.PRE_GAME_BIATHLON_ENABLED, enabled ? 'true' : 'false');
        syncTag(NOTIFICATION_TAGS.PRE_GAME_BIATHLON, enabled);
        console.log('[OneSignal] Pre-game Biathlon notifications:', enabled ? 'enabled' : 'disabled');
    }, [syncTag]);

    /**
     * Update team tags in OneSignal
     * Takes all currently selected teams from both sports combined
     * @param {string[]} allTeamCodes - Array of all selected team codes (from all sports)
     */
    const setTeamTags = useCallback((allTeamCodes) => {
        if (!isInitialized) {
            // Queue the update to be applied after initialization
            console.log('[OneSignal] Queuing team tags update (not initialized yet):', allTeamCodes);
            pendingTeamUpdatesRef.current = [...allTeamCodes];
            return;
        }

        applyTeamTags(allTeamCodes);
    }, [isInitialized, applyTeamTags]);

    // Get all current tags (for debugging)
    const getTags = useCallback(async () => {
        if (!OneSignal) {
            return {};
        }

        try {
            const tags = await OneSignal.User.getTags();
            return tags;
        } catch (error) {
            console.error('[OneSignal] Get tags error:', error);
            return {};
        }
    }, []);

    // Force sync team tags from AsyncStorage to OneSignal
    const syncTeamTags = useCallback(async () => {
        if (!isInitialized) {
            console.warn('[OneSignal] Cannot sync tags - not initialized');
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

            applyTeamTags(allTeams);
            console.log('[OneSignal] Force synced team tags from AsyncStorage:', allTeams);
        } catch (error) {
            console.error('[OneSignal] Sync team tags error:', error);
        }
    }, [isInitialized, applyTeamTags]);

    return {
        // State
        isInitialized,
        hasPermission,
        subscriptionId,
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
