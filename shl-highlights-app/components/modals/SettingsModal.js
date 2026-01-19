import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getTeamLogoUrl } from '../../api/shl';
import { GENDER_OPTIONS } from '../../constants';

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
    onRequestNotificationPermission
}) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.settingsHeader}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.settingsTitle}>Settings</Text>
            </View>
            <ScrollView
                style={styles.settingsContent}
                contentContainerStyle={styles.settingsContentContainer}
            >
                {/* Notifications Section */}
                <Text style={styles.settingsSection}>Notifications</Text>
                <Text style={styles.settingsSectionSubtitle}>Get notified when goals are scored</Text>

                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="notifications-outline" size={22} color="#FF453A" />
                        <Text style={styles.settingsCardTitle}>Push Notifications</Text>
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
                            trackColor={{ false: '#3a3a3c', true: '#34C759' }}
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
                                trackColor={{ false: '#3a3a3c', true: '#34C759' }}
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

                <Text style={styles.settingsSection}>Favorites</Text>
                <Text style={styles.settingsSectionSubtitle}>Customize which sports and teams you follow</Text>

                {/* Hockey Teams */}
                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="snow-outline" size={22} color="#0A84FF" />
                        <Text style={styles.settingsCardTitle}>Hockey Teams</Text>
                        <Text style={styles.settingsCardCount}>
                            {selectedTeams.length > 0 ? `${selectedTeams.length} selected` : ''}
                        </Text>
                    </View>
                    <View style={styles.chipGrid}>
                        {teams.map(team => (
                            <TouchableOpacity
                                key={team.code}
                                style={[styles.teamChip, selectedTeams.includes(team.code) && styles.chipActive]}
                                onPress={() => onToggleTeam(team.code)}
                            >
                                <Image source={{ uri: getTeamLogoUrl(team.code) }} style={styles.chipLogo} resizeMode="contain" />
                                <Text style={[styles.chipText, selectedTeams.includes(team.code) && styles.chipTextActive]} numberOfLines={1}>
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
                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="football-outline" size={22} color="#30D158" />
                        <Text style={styles.settingsCardTitle}>Football Teams</Text>
                        <Text style={styles.settingsCardCount}>
                            {selectedFootballTeams.length > 0 ? `${selectedFootballTeams.length} selected` : ''}
                        </Text>
                    </View>
                    {footballTeams.length > 0 ? (
                        <View style={styles.chipGrid}>
                            {footballTeams.map(team => (
                                <TouchableOpacity
                                    key={team.key}
                                    style={[styles.teamChip, selectedFootballTeams.includes(team.key) && styles.chipActiveGreen]}
                                    onPress={() => onToggleFootballTeam(team.key)}
                                >
                                    {team.icon ? (
                                        <Image source={{ uri: team.icon }} style={styles.chipLogo} resizeMode="contain" />
                                    ) : (
                                        <View style={styles.chipLogoPlaceholder} />
                                    )}
                                    <Text style={[styles.chipText, selectedFootballTeams.includes(team.key) && styles.chipTextActive]} numberOfLines={1}>
                                        {team.shortName || team.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.settingsEmptyText}>No football teams available yet.</Text>
                    )}
                    {selectedFootballTeams.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={onClearFootballTeams}>
                            <Text style={styles.clearButtonText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Biathlon Gender */}
                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="locate-outline" size={22} color="#D94A8C" />
                        <Text style={styles.settingsCardTitle}>Biathlon Gender</Text>
                    </View>
                    <View style={styles.genderRow}>
                        {GENDER_OPTIONS.map(gender => (
                            <TouchableOpacity
                                key={gender.id}
                                style={[
                                    styles.genderChip,
                                    selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                ]}
                                onPress={() => onToggleGender(gender.id)}
                            >
                                <Text style={[styles.genderText, selectedGenders.includes(gender.id) && styles.genderTextActive]}>
                                    {gender.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Biathlon Countries */}
                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="flag-outline" size={22} color="#FF9F0A" />
                        <Text style={styles.settingsCardTitle}>Biathlon Countries</Text>
                        <Text style={styles.settingsCardCount}>
                            {selectedNations.length > 0 ? `${selectedNations.length} selected` : ''}
                        </Text>
                    </View>
                    <View style={styles.chipGrid}>
                        {biathlonNations.map(nation => (
                            <TouchableOpacity
                                key={nation.code}
                                style={[styles.nationChip, selectedNations.includes(nation.code) && styles.chipActiveOrange]}
                                onPress={() => onToggleNation(nation.code)}
                            >
                                <Text style={styles.nationFlag}>{nation.flag}</Text>
                                <Text style={[styles.chipText, selectedNations.includes(nation.code) && styles.chipTextActive]} numberOfLines={1}>
                                    {nation.code}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {selectedNations.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={onClearNations}>
                            <Text style={styles.clearButtonText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity style={styles.resetOnboardingButton} onPress={onResetOnboarding}>
                    <Ionicons name="refresh-outline" size={20} color="#FF9F0A" />
                    <Text style={styles.resetOnboardingText}>Restart setup wizard</Text>
                </TouchableOpacity>

                {/* Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>GamePulse v{APP_VERSION}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    </Modal>
);

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
    }
});
