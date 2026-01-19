import { useEffect, useState, useCallback, useRef } from 'react';
import { OneSignal } from 'react-native-onesignal';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Hook for managing OneSignal push notifications
 * Handles initialization, permission requests, and tag-based subscriptions
 *
 * Tag structure:
 * - goal_notifications: 'true' | removed - enables goal notification targeting
 * - team_{code}: 'true' | removed - individual team subscription (e.g., team_lif, team_aik)
 */
export function usePushNotifications() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState(null);

    // Notification preferences state
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState(true);

    // Track all current team tags to properly remove old ones
    const currentTeamsRef = useRef(new Set());

    // Queue for pending tag updates before initialization
    const pendingTeamUpdatesRef = useRef(null);

    // Apply team tags to OneSignal (internal helper)
    const applyTeamTags = useCallback((teamCodes) => {
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

    // Initialize OneSignal on mount
    useEffect(() => {
        const initOneSignal = async () => {
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

                const isEnabled = savedEnabled === 'true';
                const goalEnabled = savedGoalNotifications !== 'false'; // Default to true

                setNotificationsEnabled(isEnabled);
                setGoalNotificationsEnabled(goalEnabled);

                // Sync goal_notifications tag on initialization
                if (goalEnabled) {
                    OneSignal.User.addTag('goal_notifications', 'true');
                } else {
                    OneSignal.User.removeTag('goal_notifications');
                }

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
                console.log('[OneSignal] Initialized successfully');

                // Process any pending team update that was queued before initialization
                if (pendingTeamUpdatesRef.current !== null) {
                    console.log('[OneSignal] Processing pending team update');
                    applyTeamTags(pendingTeamUpdatesRef.current);
                    pendingTeamUpdatesRef.current = null;
                }
            } catch (error) {
                console.error('[OneSignal] Initialization error:', error);
            }
        };

        initOneSignal();
    }, [applyTeamTags]);

    // Request notification permission
    const requestPermission = useCallback(async () => {
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

        // Update tag to indicate goal notification preference
        if (enabled) {
            OneSignal.User.addTag('goal_notifications', 'true');
        } else {
            OneSignal.User.removeTag('goal_notifications');
        }
    }, []);

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

        // Actions
        requestPermission,
        toggleNotifications,
        toggleGoalNotifications,
        setTeamTags,
        getTags,
        syncTeamTags
    };
}
