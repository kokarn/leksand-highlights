import { useEffect, useState, useCallback } from 'react';
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

                if (savedEnabled !== null) {
                    setNotificationsEnabled(savedEnabled === 'true');
                }
                if (savedGoalNotifications !== null) {
                    setGoalNotificationsEnabled(savedGoalNotifications === 'true');
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

    // Set team tags for targeted notifications
    const setTeamTags = useCallback((sport, teamCodes) => {
        if (!isInitialized) {
            return;
        }

        try {
            // Clear existing team tags for this sport
            const tagKey = `${sport}_teams`;

            if (teamCodes.length === 0) {
                OneSignal.User.removeTag(tagKey);
            } else {
                // Store as comma-separated list
                OneSignal.User.addTag(tagKey, teamCodes.join(','));
            }

            // Also set individual team tags for precise targeting
            teamCodes.forEach(code => {
                OneSignal.User.addTag(`team_${code.toLowerCase()}`, 'true');
            });

            console.log(`[OneSignal] Updated ${sport} team tags:`, teamCodes);
        } catch (error) {
            console.error('[OneSignal] Tag update error:', error);
        }
    }, [isInitialized]);

    // Remove a specific team tag
    const removeTeamTag = useCallback((teamCode) => {
        if (!isInitialized) {
            return;
        }

        try {
            OneSignal.User.removeTag(`team_${teamCode.toLowerCase()}`);
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
        getTags
    };
}
