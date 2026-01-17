import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getTeamLogoUrl } from '../../api/shl';
import { APP_NAME, GENDER_OPTIONS } from '../../constants';
import { LogoMark } from '../LogoMark';

export const OnboardingModal = ({
    visible,
    step,
    onStepChange,
    onComplete,
    teams,
    selectedTeams,
    onToggleTeam,
    biathlonNations,
    selectedNations,
    onToggleNation,
    selectedGenders,
    onToggleGender
}) => (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
        <SafeAreaView style={styles.onboardingContainer} edges={['top', 'left', 'right', 'bottom']}>
            <LinearGradient colors={['#0a0a0a', '#1a1a2e']} style={StyleSheet.absoluteFill} />

            {step === 0 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingHeader}>
                        <LogoMark />
                        <Text style={styles.onboardingWelcome}>Welcome to</Text>
                        <Text style={styles.onboardingAppName}>{APP_NAME}</Text>
                        <Text style={styles.onboardingTagline}>Your personal sports companion</Text>
                    </View>
                    <View style={styles.onboardingContent}>
                        <Text style={styles.onboardingDesc}>
                            {"Let's set up your preferences so you can see the games and races you care about most."}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.onboardingButton} onPress={() => onStepChange(1)}>
                        <Text style={styles.onboardingButtonText}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {step === 1 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingStepHeader}>
                        <Text style={styles.onboardingStepNumber}>1 of 3</Text>
                        <Text style={styles.onboardingStepTitle}>Pick your Hockey teams</Text>
                        <Text style={styles.onboardingStepSubtitle}>Select the SHL teams you want to follow</Text>
                    </View>
                    <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.onboardingChipGrid}>
                            {teams.map(team => {
                                const logoUrl = getTeamLogoUrl(team.code);
                                return (
                                    <TouchableOpacity
                                        key={team.code}
                                        style={[styles.onboardingChip, selectedTeams.includes(team.code) && styles.onboardingChipActive]}
                                        onPress={() => onToggleTeam(team.code)}
                                    >
                                        {logoUrl ? (
                                            <Image source={{ uri: logoUrl }} style={styles.onboardingChipLogo} resizeMode="contain" />
                                        ) : (
                                            <View style={styles.onboardingChipLogoPlaceholder} />
                                        )}
                                        <Text style={[styles.onboardingChipText, selectedTeams.includes(team.code) && styles.onboardingChipTextActive]}>
                                            {team.code}
                                        </Text>
                                        {selectedTeams.includes(team.code) && (
                                            <Ionicons name="checkmark-circle" size={20} color="#0A84FF" style={styles.onboardingChipCheck} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                    <View style={styles.onboardingNav}>
                        <TouchableOpacity style={styles.onboardingNavButton} onPress={() => onStepChange(0)}>
                            <Ionicons name="arrow-back" size={20} color="#888" />
                            <Text style={styles.onboardingNavButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.onboardingButton} onPress={() => onStepChange(2)}>
                            <Text style={styles.onboardingButtonText}>{selectedTeams.length > 0 ? 'Continue' : 'Skip'}</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 2 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingStepHeader}>
                        <Text style={styles.onboardingStepNumber}>2 of 3</Text>
                        <Text style={styles.onboardingStepTitle}>Biathlon preferences</Text>
                        <Text style={styles.onboardingStepSubtitle}>Which race categories interest you?</Text>
                    </View>
                    <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.onboardingSectionLabel}>Gender</Text>
                        <View style={styles.onboardingChipRow}>
                            {GENDER_OPTIONS.map(gender => (
                                <TouchableOpacity
                                    key={gender.id}
                                    style={[
                                        styles.onboardingGenderChip,
                                        selectedGenders.includes(gender.id) && { backgroundColor: gender.color, borderColor: gender.color }
                                    ]}
                                    onPress={() => onToggleGender(gender.id)}
                                >
                                    <Text style={[styles.onboardingGenderText, selectedGenders.includes(gender.id) && styles.onboardingGenderTextActive]}>
                                        {gender.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.onboardingSectionLabel}>Countries</Text>
                        <View style={styles.onboardingChipGrid}>
                            {biathlonNations.map(nation => (
                                <TouchableOpacity
                                    key={nation.code}
                                    style={[styles.onboardingNationChip, selectedNations.includes(nation.code) && styles.onboardingChipActive]}
                                    onPress={() => onToggleNation(nation.code)}
                                >
                                    <Text style={styles.onboardingNationFlag}>{nation.flag}</Text>
                                    <Text style={[styles.onboardingNationText, selectedNations.includes(nation.code) && styles.onboardingChipTextActive]}>
                                        {nation.name || nation.code}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                    <View style={styles.onboardingNav}>
                        <TouchableOpacity style={styles.onboardingNavButton} onPress={() => onStepChange(1)}>
                            <Ionicons name="arrow-back" size={20} color="#888" />
                            <Text style={styles.onboardingNavButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.onboardingButton} onPress={() => onStepChange(3)}>
                            <Text style={styles.onboardingButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 3 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingHeader}>
                        <Ionicons name="checkmark-circle" size={80} color="#30D158" />
                        <Text style={styles.onboardingCompleteTitle}>{"You're all set!"}</Text>
                        <Text style={styles.onboardingCompleteSubtitle}>
                            Your preferences have been saved. You can change them anytime in Settings.
                        </Text>
                    </View>
                    <View style={styles.onboardingSummary}>
                        {selectedTeams.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="snow-outline" size={20} color="#0A84FF" />
                                <Text style={styles.onboardingSummaryText}>
                                    Following {selectedTeams.length} hockey team{selectedTeams.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}
                        {selectedGenders.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="locate-outline" size={20} color="#D94A8C" />
                                <Text style={styles.onboardingSummaryText}>
                                    Biathlon: {selectedGenders.map(g => GENDER_OPTIONS.find(o => o.id === g)?.label).join(', ')}
                                </Text>
                            </View>
                        )}
                        {selectedNations.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="flag-outline" size={20} color="#FF9F0A" />
                                <Text style={styles.onboardingSummaryText}>
                                    {selectedNations.length} countr{selectedNations.length > 1 ? 'ies' : 'y'} selected
                                </Text>
                            </View>
                        )}
                        {selectedTeams.length === 0 && selectedGenders.length === 0 && selectedNations.length === 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="globe-outline" size={20} color="#888" />
                                <Text style={styles.onboardingSummaryText}>
                                    Showing all games and races
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={styles.onboardingButtonLarge} onPress={onComplete}>
                        <Text style={styles.onboardingButtonText}>Start Exploring</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    </Modal>
);

const styles = StyleSheet.create({
    onboardingContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    onboardingStep: {
        flex: 1,
        padding: 24,
        justifyContent: 'space-between'
    },
    onboardingHeader: {
        alignItems: 'center',
        paddingTop: 60,
        gap: 12
    },
    onboardingWelcome: {
        color: '#888',
        fontSize: 18,
        fontWeight: '500',
        marginTop: 30
    },
    onboardingAppName: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1
    },
    onboardingTagline: {
        color: '#666',
        fontSize: 16
    },
    onboardingContent: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    onboardingDesc: {
        color: '#aaa',
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28
    },
    onboardingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0A84FF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14
    },
    onboardingButtonLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#0A84FF',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 14,
        marginTop: 40
    },
    onboardingButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700'
    },
    onboardingStepHeader: {
        alignItems: 'center',
        marginBottom: 24
    },
    onboardingStepNumber: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8
    },
    onboardingStepTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center'
    },
    onboardingStepSubtitle: {
        color: '#888',
        fontSize: 15,
        marginTop: 8,
        textAlign: 'center'
    },
    onboardingScrollContent: {
        flex: 1
    },
    onboardingChipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center'
    },
    onboardingChipRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 20
    },
    onboardingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#1c1c1e',
        borderWidth: 2,
        borderColor: '#333',
        minWidth: 100
    },
    onboardingChipActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.2)',
        borderColor: '#0A84FF'
    },
    onboardingChipLogo: {
        width: 32,
        height: 32
    },
    onboardingChipLogoPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1c1c1e'
    },
    onboardingChipText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600'
    },
    onboardingChipTextActive: {
        color: '#fff'
    },
    onboardingChipCheck: {
        marginLeft: 'auto'
    },
    onboardingGenderChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#1c1c1e',
        borderWidth: 2,
        borderColor: '#333'
    },
    onboardingGenderText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '700'
    },
    onboardingGenderTextActive: {
        color: '#fff'
    },
    onboardingSectionLabel: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginTop: 8
    },
    onboardingNationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#1c1c1e',
        borderWidth: 2,
        borderColor: '#333'
    },
    onboardingNationFlag: {
        fontSize: 22
    },
    onboardingNationText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600'
    },
    onboardingNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16
    },
    onboardingNavButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 12
    },
    onboardingNavButtonText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600'
    },
    onboardingCompleteTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '800',
        marginTop: 24,
        textAlign: 'center'
    },
    onboardingCompleteSubtitle: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 20,
        lineHeight: 24
    },
    onboardingSummary: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 20,
        marginTop: 30
    },
    onboardingSummaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10
    },
    onboardingSummaryText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500'
    },
});
