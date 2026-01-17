import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTeamLogoUrl } from '../../api/shl';
import { GENDER_OPTIONS } from '../../constants';

export const SettingsModal = ({
    visible,
    onClose,
    teams,
    selectedTeams,
    onToggleTeam,
    onClearTeams,
    biathlonNations,
    selectedNations,
    onToggleNation,
    onClearNations,
    selectedGenders,
    onToggleGender,
    onResetOnboarding
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
                <Text style={styles.settingsSection}>Favorites</Text>
                <Text style={styles.settingsSectionSubtitle}>Customize which sports and teams you follow</Text>

                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="snow-outline" size={22} color="#0A84FF" />
                        <Text style={styles.settingsCardTitle}>Hockey Teams</Text>
                    </View>
                    <View style={styles.settingsChipContainer}>
                        {teams.map(team => {
                            const logoUrl = getTeamLogoUrl(team.code);
                            return (
                                <TouchableOpacity
                                    key={team.code}
                                    style={[styles.settingsChip, selectedTeams.includes(team.code) && styles.settingsChipActive]}
                                    onPress={() => onToggleTeam(team.code)}
                                >
                                    {logoUrl ? (
                                        <Image source={{ uri: logoUrl }} style={styles.settingsChipLogo} resizeMode="contain" />
                                    ) : (
                                        <View style={styles.settingsChipLogoPlaceholder} />
                                    )}
                                    <Text style={[styles.settingsChipText, selectedTeams.includes(team.code) && styles.settingsChipTextActive]}>
                                        {team.code}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {selectedTeams.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={onClearTeams}>
                            <Text style={styles.clearButtonText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="locate-outline" size={22} color="#0A84FF" />
                        <Text style={styles.settingsCardTitle}>Biathlon Gender</Text>
                    </View>
                    <View style={styles.settingsChipContainer}>
                        {GENDER_OPTIONS.map(gender => (
                            <TouchableOpacity
                                key={gender.id}
                                style={[
                                    styles.settingsChip,
                                    selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                ]}
                                onPress={() => onToggleGender(gender.id)}
                            >
                                <Text style={[styles.settingsChipText, selectedGenders.includes(gender.id) && styles.settingsChipTextActive]}>
                                    {gender.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.settingsCard}>
                    <View style={styles.settingsCardHeader}>
                        <Ionicons name="flag-outline" size={22} color="#0A84FF" />
                        <Text style={styles.settingsCardTitle}>Biathlon Countries</Text>
                    </View>
                    <View style={styles.settingsChipContainer}>
                        {biathlonNations.map(nation => (
                            <TouchableOpacity
                                key={nation.code}
                                style={[styles.settingsChip, selectedNations.includes(nation.code) && styles.settingsChipActive]}
                                onPress={() => onToggleNation(nation.code)}
                            >
                                <Text style={styles.settingsChipFlag}>{nation.flag}</Text>
                                <Text style={[styles.settingsChipText, selectedNations.includes(nation.code) && styles.settingsChipTextActive]}>
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
        padding: 16,
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
        padding: 16,
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
        fontWeight: '700'
    },
    settingsChipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    settingsChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#252525',
        borderWidth: 1,
        borderColor: '#333'
    },
    settingsChipActive: {
        backgroundColor: '#0A84FF',
        borderColor: '#0A84FF'
    },
    settingsChipLogo: {
        width: 24,
        height: 24
    },
    settingsChipLogoPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#1c1c1e'
    },
    settingsChipFlag: {
        fontSize: 18
    },
    settingsChipText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600'
    },
    settingsChipTextActive: {
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
});
