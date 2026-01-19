import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Hook for managing OneSignal push notifications
 * Handles initialization, permission requests, and tag-based subscriptions
 */
export function usePushNotifications() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState(null);

    // Notification preferences state
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [goalNotificationsEnabled, setGoalNotificationsEnabled] = useState(true);

    // Track current team tags to properly remove old ones
    const currentShlTeamsRef = useRef([]);
    const currentFootballTeamsRef = useRef([]);

    // Queue for pending tag updates before initialization
    const pendingTagUpdatesRef = useRef([]);

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

                // Load and sync saved team preferences
                const savedShlTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS);
                const savedFootballTeams = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS);

                if (savedShlTeams) {
                    try {
                        const teams = JSON.parse(savedShlTeams);
                        if (Array.isArray(teams) && teams.length > 0) {
                            currentShlTeamsRef.current = teams;
                            OneSignal.User.addTag('shl_teams', teams.join(','));
                            teams.forEach(code => {
                                OneSignal.User.addTag(`team_${code.toLowerCase()}`, 'true');
                            });
                            console.log('[OneSignal] Synced SHL team tags on init:', teams);
                        }
                    } catch (e) {
                        console.error('[OneSignal] Error parsing saved SHL teams:', e);
                    }
                }

                if (savedFootballTeams) {
                    try {
                        const teams = JSON.parse(savedFootballTeams);
                        if (Array.isArray(teams) && teams.length > 0) {
                            currentFootballTeamsRef.current = teams;
                            OneSignal.User.addTag('allsvenskan_teams', teams.join(','));
                            teams.forEach(code => {
                                OneSignal.User.addTag(`team_${code.toLowerCase()}`, 'true');
                            });
                            console.log('[OneSignal] Synced football team tags on init:', teams);
                        }
                    } catch (e) {
                        console.error('[OneSignal] Error parsing saved football teams:', e);
                    }
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

                // Process any pending tag updates that were queued before initialization
                if (pendingTagUpdatesRef.current.length > 0) {
                    console.log(`[OneSignal] Processing ${pendingTagUpdatesRef.current.length} pending tag updates`);

                    // Get the latest update for each sport (in case there were multiple)
                    const latestUpdates = {};
                    pendingTagUpdatesRef.current.forEach(update => {
                        latestUpdates[update.sport] = update.teamCodes;
                    });

                    // Apply the latest updates for each sport
                    Object.entries(latestUpdates).forEach(([sport, teamCodes]) => {
                        const currentTeamsRef = sport === 'shl' ? currentShlTeamsRef : currentFootballTeamsRef;
                        const previousTeams = currentTeamsRef.current;
                        const removedTeams = previousTeams.filter(code => !teamCodes.includes(code));

                        removedTeams.forEach(code => {
                            OneSignal.User.removeTag(`team_${code.toLowerCase()}`);
                        });

                        const tagKey = `${sport}_teams`;
                        if (teamCodes.length === 0) {
                            OneSignal.User.removeTag(tagKey);
                        } else {
                            OneSignal.User.addTag(tagKey, teamCodes.join(','));
                        }

                        teamCodes.forEach(code => {
                            OneSignal.User.addTag(`team_${code.toLowerCase()}`, 'true');
                        });

                        currentTeamsRef.current = [...teamCodes];
                        console.log(`[OneSignal] Applied pending ${sport} team tags:`, teamCodes);
                    });

                    // Clear the pending queue
                    pendingTagUpdatesRef.current = [];
                }
            } catch (error) {
                console.error('[OneSignal] Initialization error:', error);
            }
        };

        initOneSignal();
    }, []);

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

    // Internal function to apply team tags (called when initialized)
    const applyTeamTags = useCallback((sport, teamCodes) => {
        try {
            // Get the reference to the current teams for this sport
            const currentTeamsRef = sport === 'shl' ? currentShlTeamsRef : currentFootballTeamsRef;
            const previousTeams = currentTeamsRef.current;

            // Find teams that were removed
            const removedTeams = previousTeams.filter(code => !teamCodes.includes(code));

            // Remove tags for teams that are no longer selected
            removedTeams.forEach(code => {
                OneSignal.User.removeTag(`team_${code.toLowerCase()}`);
            });

            // Update the sport-specific team list tag
            const tagKey = `${sport}_teams`;

            if (teamCodes.length === 0) {
                OneSignal.User.removeTag(tagKey);
            } else {
                // Store as comma-separated list
                OneSignal.User.addTag(tagKey, teamCodes.join(','));
            }

            // Add individual team tags for precise targeting
            teamCodes.forEach(code => {
                OneSignal.User.addTag(`team_${code.toLowerCase()}`, 'true');
            });

            // Update the ref with current teams
            currentTeamsRef.current = [...teamCodes];

            console.log(`[OneSignal] Updated ${sport} team tags:`, teamCodes);
            if (removedTeams.length > 0) {
                console.log(`[OneSignal] Removed ${sport} team tags:`, removedTeams);
            }
        } catch (error) {
            console.error('[OneSignal] Tag update error:', error);
        }
    }, []);

    // Set team tags for targeted notifications
    // Queues updates if called before OneSignal is initialized
    const setTeamTags = useCallback((sport, teamCodes) => {
        if (!isInitialized) {
            // Queue the update to be applied after initialization
            console.log(`[OneSignal] Queuing ${sport} team tags update (not initialized yet):`, teamCodes);
            pendingTagUpdatesRef.current.push({ sport, teamCodes: [...teamCodes] });
            return;
        }

        applyTeamTags(sport, teamCodes);
    }, [isInitialized, applyTeamTags]);

    // Remove a specific team tag
    const removeTeamTag = useCallback((teamCode) => {
        if (!isInitialized) {
            return;
        }

        try {
            const lowerCode = teamCode.toLowerCase();
            OneSignal.User.removeTag(`team_${lowerCode}`);

            // Update both refs in case the team was in either
            currentShlTeamsRef.current = currentShlTeamsRef.current.filter(
                code => code.toLowerCase() !== lowerCode
            );
            currentFootballTeamsRef.current = currentFootballTeamsRef.current.filter(
                code => code.toLowerCase() !== lowerCode
            );

            console.log(`[OneSignal] Removed team tag: team_${lowerCode}`);
        } catch (error) {
            console.error('[OneSignal] Tag removal error:', error);
        }
    }, [isInitialized]);

    // Get all current tags
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

            if (savedShlTeams) {
                const teams = JSON.parse(savedShlTeams);
                if (Array.isArray(teams)) {
                    applyTeamTags('shl', teams);
                }
            }

            if (savedFootballTeams) {
                const teams = JSON.parse(savedFootballTeams);
                if (Array.isArray(teams)) {
                    applyTeamTags('allsvenskan', teams);
                }
            }

            console.log('[OneSignal] Force synced team tags from AsyncStorage');
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
        removeTeamTag,
        getTags,
        syncTeamTags
    };
}
