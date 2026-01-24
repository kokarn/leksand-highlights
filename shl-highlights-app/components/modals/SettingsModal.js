import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getTeamLogoUrl } from '../../api/shl';
import { GENDER_OPTIONS, THEME_OPTIONS } from '../../constants';
import { useTheme } from '../../contexts';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

const CHIP_GAP = 8;
const CONTENT_PADDING = 16;
const CARD_INNER_PADDING = 16;
// Use percentage-based width for 3 columns (accounts for 2 gaps between items)
const CHIP_WIDTH_PERCENT = '31%';

export const SettingsModal = ({
    visible,
    onClose,
    teams,
    selectedTeams,
    onToggleTeam,
    onClearTeams,
    footballTeams = [],
    selectedFootballTeams = [],
    onToggleFootballTeam,
    onClearFootballTeams,
    biathlonNations,
    selectedNations,
    onToggleNation,
    onClearNations,
    selectedGenders,
    onToggleGender,
    onResetOnboarding,
    // Push notification props
    notificationsEnabled = false,
    goalNotificationsEnabled = true,
    hasNotificationPermission = false,
    onToggleNotifications,
    onToggleGoalNotifications,
    onRequestNotificationPermission,
    // Pre-game notification props
    preGameShlEnabled = false,
    preGameFootballEnabled = false,
    preGameBiathlonEnabled = false,
    onTogglePreGameShl,
    onTogglePreGameFootball,
    onTogglePreGameBiathlon
}) => {
    const { colors, themeMode, setThemeMode, isDark } = useTheme();
    
    const themedStyles = getThemedStyles(colors, isDark);
    
    return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={themedStyles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            <View style={themedStyles.settingsHeader}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={themedStyles.settingsTitle}>Settings</Text>
            </View>
            <ScrollView
                style={styles.settingsContent}
                contentContainerStyle={styles.settingsContentContainer}
            >
                {/* Notifications Section */}
                <Text style={themedStyles.settingsSection}>Notifications</Text>
                <Text style={themedStyles.settingsSectionSubtitle}>Get notified when goals are scored</Text>

                <View style={themedStyles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="notifications-outline" size={22} color={colors.accentRed} />
                        <Text style={themedStyles.settingsCardTitle}>Push Notifications</Text>
                    </View>

                    <View style={styles.notificationRow}>
                        <View style={styles.notificationTextContainer}>
                            <Text style={styles.notificationLabel}>Enable Notifications</Text>
                            <Text style={styles.notificationDescription}>
                                Receive push notifications on this device
                            </Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={(value) => {
                                if (value && !hasNotificationPermission) {
                                    onRequestNotificationPermission?.();
                                } else {
                                    onToggleNotifications?.(value);
                                }
                            }}
                            trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                            thumbColor="#fff"
                        />
                    </View>

                    {notificationsEnabled && (
                        <View style={styles.notificationRow}>
                            <View style={styles.notificationTextContainer}>
                                <Text style={styles.notificationLabel}>Goal Alerts</Text>
                                <Text style={styles.notificationDescription}>
                                    Get notified when your favorite teams score
                                </Text>
                            </View>
                            <Switch
                                value={goalNotificationsEnabled}
                                onValueChange={onToggleGoalNotifications}
                                trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                                thumbColor="#fff"
                            />
                        </View>
                    )}

                    {notificationsEnabled && (selectedTeams.length > 0 || selectedFootballTeams.length > 0) && (
                        <View style={styles.notificationInfo}>
                            <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
                            <Text style={styles.notificationInfoText}>
                                You'll receive goal alerts for your selected teams below
                            </Text>
                        </View>
                    )}

                    {notificationsEnabled && selectedTeams.length === 0 && selectedFootballTeams.length === 0 && (
                        <View style={styles.notificationWarning}>
                            <Ionicons name="warning-outline" size={16} color="#FF9F0A" />
                            <Text style={styles.notificationWarningText}>
                                Select teams below to receive goal notifications
                            </Text>
                        </View>
                    )}
                </View>

                {/* Pre-game Reminders Section */}
                {notificationsEnabled && (
                    <View style={themedStyles.settingsCard}>
                        <View style={styles.settingsCardHeader}>
                            <Ionicons name="time-outline" size={22} color={colors.accentPurple} />
                            <Text style={themedStyles.settingsCardTitle}>Game Reminders</Text>
                        </View>
                        <Text style={styles.preGameDescription}>
                            Get notified 5 minutes before games start
                        </Text>

                        <View style={styles.notificationRow}>
                            <View style={styles.notificationTextContainer}>
                                <View style={styles.sportLabelRow}>
                                    <Ionicons name="snow-outline" size={16} color={colors.accent} />
                                    <Text style={styles.notificationLabel}>Hockey (SHL)</Text>
                                </View>
                                <Text style={styles.notificationDescription}>
                                    Remind me before hockey games
                                </Text>
                            </View>
                            <Switch
                                value={preGameShlEnabled}
                                onValueChange={onTogglePreGameShl}
                                trackColor={{ false: colors.switchTrackOff, true: colors.accentPurple }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={styles.notificationRow}>
                            <View style={styles.notificationTextContainer}>
                                <View style={styles.sportLabelRow}>
                                    <Ionicons name="football-outline" size={16} color={colors.accentGreen} />
                                    <Text style={styles.notificationLabel}>Football (Allsvenskan)</Text>
                                </View>
                                <Text style={styles.notificationDescription}>
                                    Remind me before football matches
                                </Text>
                            </View>
                            <Switch
                                value={preGameFootballEnabled}
                                onValueChange={onTogglePreGameFootball}
                                trackColor={{ false: colors.switchTrackOff, true: colors.accentPurple }}
                                thumbColor="#fff"
                            />
                        </View>

                        <View style={[styles.notificationRow, styles.notificationRowLast]}>
                            <View style={styles.notificationTextContainer}>
                                <View style={styles.sportLabelRow}>
                                    <Ionicons name="locate-outline" size={16} color={colors.accentPink} />
                                    <Text style={styles.notificationLabel}>Biathlon</Text>
                                </View>
                                <Text style={styles.notificationDescription}>
                                    Remind me before biathlon races
                                </Text>
                            </View>
                            <Switch
                                value={preGameBiathlonEnabled}
                                onValueChange={onTogglePreGameBiathlon}
                                trackColor={{ false: colors.switchTrackOff, true: colors.accentPurple }}
                                thumbColor="#fff"
                            />
                        </View>

                        {(preGameShlEnabled || preGameFootballEnabled || preGameBiathlonEnabled) &&
                         (selectedTeams.length > 0 || selectedFootballTeams.length > 0 || selectedNations.length > 0) && (
                            <View style={styles.notificationInfo}>
                                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                                <Text style={styles.notificationInfoText}>
                                    Reminders are sent for your favorite teams
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <Text style={themedStyles.settingsSection}>Favorites</Text>
                <Text style={themedStyles.settingsSectionSubtitle}>Customize which sports and teams you follow</Text>

                {/* Hockey Teams */}
                <View style={themedStyles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="snow-outline" size={22} color={colors.accent} />
                        <Text style={themedStyles.settingsCardTitle}>Hockey Teams</Text>
                        <Text style={[styles.settingsCardCount, { color: colors.textMuted }]}>
                            {selectedTeams.length > 0 ? `${selectedTeams.length} selected` : ''}
                        </Text>
                    </View>
                    <View style={styles.chipGrid}>
                        {teams.map(team => (
                            <TouchableOpacity
                                key={team.code}
                                style={[themedStyles.teamChip, selectedTeams.includes(team.code) && themedStyles.chipActive]}
                                onPress={() => onToggleTeam(team.code)}
                            >
                                <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.chipLogo} resizeMode="contain" />
                                <Text style={[themedStyles.chipText, selectedTeams.includes(team.code) && themedStyles.chipTextActive]} numberOfLines={1}>
                                    {team.code}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {selectedTeams.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={onClearTeams}>
                            <Text style={styles.clearButtonText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Football Teams */}
                <View style={themedStyles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="football-outline" size={22} color={colors.accentGreen} />
                        <Text style={themedStyles.settingsCardTitle}>Football Teams</Text>
                        <Text style={[styles.settingsCardCount, { color: colors.textMuted }]}>
                            {selectedFootballTeams.length > 0 ? `${selectedFootballTeams.length} selected` : ''}
                        </Text>
                    </View>
                    {footballTeams.length > 0 ? (
                        <View style={styles.chipGrid}>
                            {footballTeams.map(team => (
                                <TouchableOpacity
                                    key={team.key}
                                    style={[themedStyles.teamChip, selectedFootballTeams.includes(team.key) && themedStyles.chipActiveGreen]}
                                    onPress={() => onToggleFootballTeam(team.key)}
                                >
                                    {team.icon ? (
                                        <Image source={{ uri: team.icon }} style={styles.chipLogo} resizeMode="contain" />
                                    ) : (
                                        <View style={[styles.chipLogoPlaceholder, { backgroundColor: colors.separator }]} />
                                    )}
                                    <Text style={[themedStyles.chipText, selectedFootballTeams.includes(team.key) && themedStyles.chipTextActive]} numberOfLines={1}>
                                        {team.shortName || team.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={[styles.settingsEmptyText, { color: colors.textMuted }]}>No football teams available yet.</Text>
                    )}
                    {selectedFootballTeams.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={onClearFootballTeams}>
                            <Text style={styles.clearButtonText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Biathlon Gender */}
                <View style={themedStyles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="locate-outline" size={22} color={colors.accentPink} />
                        <Text style={themedStyles.settingsCardTitle}>Biathlon Gender</Text>
                    </View>
                    <View style={styles.genderRow}>
                        {GENDER_OPTIONS.map(gender => (
                            <TouchableOpacity
                                key={gender.id}
                                style={[
                                    themedStyles.genderChip,
                                    selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                ]}
                                onPress={() => onToggleGender(gender.id)}
                            >
                                <Text style={[themedStyles.genderText, selectedGenders.includes(gender.id) && styles.genderTextActive]}>
                                    {gender.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Appearance Section */}
                <Text style={themedStyles.settingsSection}>Appearance</Text>
                <Text style={themedStyles.settingsSectionSubtitle}>Customize the look of the app</Text>

                <View style={themedStyles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="color-palette-outline" size={22} color={colors.accentPurple} />
                        <Text style={themedStyles.settingsCardTitle}>Theme</Text>
                    </View>
                    <View style={styles.themeRow}>
                        {THEME_OPTIONS.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                style={[
                                    themedStyles.themeChip,
                                    themeMode === option.id && themedStyles.themeChipActive
                                ]}
                                onPress={() => setThemeMode(option.id)}
                            >
                                <Ionicons 
                                    name={option.icon} 
                                    size={20} 
                                    color={themeMode === option.id ? colors.accent : colors.textSecondary} 
                                />
                                <Text style={[
                                    themedStyles.themeText,
                                    themeMode === option.id && themedStyles.themeTextActive
                                ]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Reset Onboarding */}
                <TouchableOpacity style={themedStyles.resetOnboardingButton} onPress={onResetOnboarding}>
                    <Ionicons name="refresh-outline" size={20} color={colors.accentOrange} />
                    <Text style={themedStyles.resetOnboardingText}>Restart setup wizard</Text>
                </TouchableOpacity>

                {/* Version */}
                <View style={styles.versionContainer}>
                    <Text style={themedStyles.versionText}>GamePulse v{APP_VERSION}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    settingsHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    settingsTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        paddingTop: 10
    },
    settingsContent: {
        flex: 1
    },
    settingsContentContainer: {
        padding: CONTENT_PADDING,
        paddingBottom: 32
    },
    settingsSection: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4
    },
    settingsSectionSubtitle: {
        color: '#666',
        fontSize: 14,
        marginBottom: 20
    },
    settingsCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: CARD_INNER_PADDING,
        marginBottom: 16
    },
    settingsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16
    },
    settingsCardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        flex: 1
    },
    settingsCardCount: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600'
    },
    // Unified chip grid
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CHIP_GAP
    },
    // Base team chip style
    teamChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: '#252525',
        borderWidth: 2,
        borderColor: '#333'
    },
    // Nation chip
    nationChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: '#252525',
        borderWidth: 2,
        borderColor: '#333'
    },
    chipActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.2)',
        borderColor: '#0A84FF'
    },
    chipActiveGreen: {
        backgroundColor: 'rgba(48, 209, 88, 0.2)',
        borderColor: '#30D158'
    },
    chipActiveOrange: {
        backgroundColor: 'rgba(255, 159, 10, 0.2)',
        borderColor: '#FF9F0A'
    },
    chipLogo: {
        width: 32,
        height: 32
    },
    chipLogoPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#2c2c2e'
    },
    chipText: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center'
    },
    chipTextActive: {
        color: '#fff'
    },
    nationFlag: {
        fontSize: 18
    },
    // Gender chips
    genderRow: {
        flexDirection: 'row',
        gap: 10
    },
    genderChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#252525',
        borderWidth: 2,
        borderColor: '#333'
    },
    genderText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '700'
    },
    genderTextActive: {
        color: '#fff'
    },
    clearButton: {
        marginTop: 12,
        alignSelf: 'flex-start'
    },
    clearButtonText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600'
    },
    settingsEmptyText: {
        color: '#666',
        fontSize: 13
    },
    resetOnboardingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        paddingVertical: 16,
        backgroundColor: 'rgba(255, 159, 10, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.3)'
    },
    resetOnboardingText: {
        color: '#FF9F0A',
        fontSize: 15,
        fontWeight: '600'
    },
    // Notification styles
    notificationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    notificationTextContainer: {
        flex: 1,
        marginRight: 12
    },
    notificationLabel: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2
    },
    notificationDescription: {
        color: '#8E8E93',
        fontSize: 12
    },
    notificationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(142, 142, 147, 0.1)',
        borderRadius: 8
    },
    notificationInfoText: {
        color: '#8E8E93',
        fontSize: 12,
        flex: 1
    },
    notificationWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 159, 10, 0.1)',
        borderRadius: 8
    },
    notificationWarningText: {
        color: '#FF9F0A',
        fontSize: 12,
        flex: 1
    },
    notificationRowLast: {
        borderBottomWidth: 0
    },
    preGameDescription: {
        color: '#8E8E93',
        fontSize: 13,
        marginBottom: 12,
        marginTop: -8
    },
    sportLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2
    },
    // Version styles
    versionContainer: {
        marginTop: 32,
        alignItems: 'center',
        paddingBottom: 16
    },
    versionText: {
        color: '#4a4a4a',
        fontSize: 12,
        fontWeight: '500'
    },
    // Theme picker styles
    themeRow: {
        flexDirection: 'row',
        gap: 10
    }
});

// Dynamic themed styles based on current theme
const getThemedStyles = (colors, isDark) => ({
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    settingsHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder
    },
    settingsTitle: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        paddingTop: 10
    },
    settingsSection: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4
    },
    settingsSectionSubtitle: {
        color: colors.textMuted,
        fontSize: 14,
        marginBottom: 20
    },
    settingsCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: CARD_INNER_PADDING,
        marginBottom: 16,
        borderWidth: isDark ? 0 : 1,
        borderColor: colors.cardBorder
    },
    settingsCardTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        flex: 1
    },
    resetOnboardingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        paddingVertical: 16,
        backgroundColor: isDark ? 'rgba(255, 159, 10, 0.1)' : 'rgba(255, 159, 10, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.3)'
    },
    resetOnboardingText: {
        color: colors.accentOrange,
        fontSize: 15,
        fontWeight: '600'
    },
    versionText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '500'
    },
    // Team/selection chip styles
    teamChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: colors.chip,
        borderWidth: 2,
        borderColor: colors.chipBorder
    },
    chipActive: {
        backgroundColor: colors.chipActive,
        borderColor: colors.accent
    },
    chipActiveGreen: {
        backgroundColor: isDark ? 'rgba(48, 209, 88, 0.2)' : 'rgba(48, 209, 88, 0.15)',
        borderColor: colors.accentGreen
    },
    chipText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center'
    },
    chipTextActive: {
        color: colors.text
    },
    // Gender chip styles
    genderChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.chip,
        borderWidth: 2,
        borderColor: colors.chipBorder
    },
    genderText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '700'
    },
    // Theme picker chip styles
    themeChip: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.chip,
        borderWidth: 2,
        borderColor: colors.chipBorder
    },
    themeChipActive: {
        backgroundColor: colors.chipActive,
        borderColor: colors.accent
    },
    themeText: {
        color: colors.chipText,
        fontSize: 13,
        fontWeight: '600'
    },
    themeTextActive: {
        color: colors.accent
    }
});
