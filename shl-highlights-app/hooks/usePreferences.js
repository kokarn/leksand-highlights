import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Hook for managing user preferences stored in AsyncStorage
 * Handles loading, saving, and toggling of sport, teams, nations, and gender filters
 */
export function usePreferences() {
    // Sport selection
    const [activeSport, setActiveSport] = useState('shl');

    // SHL team filters
    const [selectedTeams, setSelectedTeams] = useState([]);

    // Football team filters
    const [selectedFootballTeams, setSelectedFootballTeams] = useState([]);

    // Biathlon filters
    const [selectedNations, setSelectedNations] = useState([]);
    const [selectedGenders, setSelectedGenders] = useState([]);

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);

    // Loading state
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);

    // Save preference helper
    const savePreference = useCallback(async (key, value) => {
        try {
            await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
            console.error('Error saving preference:', e);
        }
    }, []);

    // Load all preferences on mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const [
                    savedSport,
                    savedTeams,
                    savedNations,
                    savedGenders,
                    savedFootballTeams,
                    onboardingComplete
                ] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SPORT),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TEAMS),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_NATIONS),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_GENDERS),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS),
                    AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE)
                ]);

                if (savedSport) setActiveSport(savedSport);
                if (savedTeams) setSelectedTeams(JSON.parse(savedTeams));
                if (savedNations) setSelectedNations(JSON.parse(savedNations));
                if (savedGenders) setSelectedGenders(JSON.parse(savedGenders));
                if (savedFootballTeams) setSelectedFootballTeams(JSON.parse(savedFootballTeams));

                if (!onboardingComplete) {
                    setShowOnboarding(true);
                }
            } catch (e) {
                console.error('Error loading preferences:', e);
            } finally {
                setPreferencesLoaded(true);
            }
        };

        loadPreferences();
    }, []);

    // Sport change handler
    const handleSportChange = useCallback((sport) => {
        setActiveSport(sport);
        savePreference(STORAGE_KEYS.SELECTED_SPORT, sport);
    }, [savePreference]);

    // SHL team filter handlers
    const toggleTeamFilter = useCallback((teamCode) => {
        setSelectedTeams(prev => {
            const newSelected = prev.includes(teamCode)
                ? prev.filter(t => t !== teamCode)
                : [...prev, teamCode];
            savePreference(STORAGE_KEYS.SELECTED_TEAMS, newSelected);
            return newSelected;
        });
    }, [savePreference]);

    const clearTeamFilter = useCallback(() => {
        setSelectedTeams([]);
        savePreference(STORAGE_KEYS.SELECTED_TEAMS, []);
    }, [savePreference]);

    // Football team filter handlers
    const toggleFootballTeamFilter = useCallback((teamKey) => {
        setSelectedFootballTeams(prev => {
            const newSelected = prev.includes(teamKey)
                ? prev.filter(t => t !== teamKey)
                : [...prev, teamKey];
            savePreference(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS, newSelected);
            return newSelected;
        });
    }, [savePreference]);

    const clearFootballTeamFilter = useCallback(() => {
        setSelectedFootballTeams([]);
        savePreference(STORAGE_KEYS.SELECTED_FOOTBALL_TEAMS, []);
    }, [savePreference]);

    // Nation filter handlers
    const toggleNationFilter = useCallback((nationCode) => {
        setSelectedNations(prev => {
            const newSelected = prev.includes(nationCode)
                ? prev.filter(n => n !== nationCode)
                : [...prev, nationCode];
            savePreference(STORAGE_KEYS.SELECTED_NATIONS, newSelected);
            return newSelected;
        });
    }, [savePreference]);

    const clearNationFilter = useCallback(() => {
        setSelectedNations([]);
        savePreference(STORAGE_KEYS.SELECTED_NATIONS, []);
    }, [savePreference]);

    // Gender filter handlers
    const toggleGenderFilter = useCallback((gender) => {
        setSelectedGenders(prev => {
            const newSelected = prev.includes(gender)
                ? prev.filter(g => g !== gender)
                : [...prev, gender];
            savePreference(STORAGE_KEYS.SELECTED_GENDERS, newSelected);
            return newSelected;
        });
    }, [savePreference]);

    const clearGenderFilter = useCallback(() => {
        setSelectedGenders([]);
        savePreference(STORAGE_KEYS.SELECTED_GENDERS, []);
    }, [savePreference]);

    // Onboarding handlers
    const completeOnboarding = useCallback(async () => {
        await savePreference(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        setShowOnboarding(false);
        setOnboardingStep(0);
    }, [savePreference]);

    const resetOnboarding = useCallback(async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
        setOnboardingStep(0);
        setShowOnboarding(true);
    }, []);

    return {
        // State
        activeSport,
        selectedTeams,
        selectedFootballTeams,
        selectedNations,
        selectedGenders,
        showOnboarding,
        onboardingStep,
        preferencesLoaded,

        // Setters
        setOnboardingStep,
        setShowOnboarding,

        // Handlers
        handleSportChange,
        toggleTeamFilter,
        clearTeamFilter,
        toggleFootballTeamFilter,
        clearFootballTeamFilter,
        toggleNationFilter,
        clearNationFilter,
        toggleGenderFilter,
        clearGenderFilter,
        completeOnboarding,
        resetOnboarding
    };
}
