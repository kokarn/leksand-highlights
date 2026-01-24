import { View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getTeamLogoUrl } from '../../api/shl';
import { APP_NAME, GENDER_OPTIONS } from '../../constants';
import { LogoMark } from '../LogoMark';
import { useTheme } from '../../contexts';

const CHIP_GAP = 8;
const CONTENT_PADDING = 24;
// Use percentage-based width for 3 columns (accounts for 2 gaps between items)
const CHIP_WIDTH_PERCENT = '31%';

export const OnboardingModal = ({
    visible,
    step,
    onStepChange,
    onComplete,
    teams,
    selectedTeams,
    onToggleTeam,
    footballTeams = [],
    selectedFootballTeams = [],
    onToggleFootballTeam,
    biathlonNations,
    selectedNations,
    onToggleNation,
    selectedGenders,
    onToggleGender
}) => {
    const { colors, isDark } = useTheme();
    const themedStyles = getThemedStyles(colors, isDark);
    
    return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
        <SafeAreaView style={themedStyles.onboardingContainer} edges={['top', 'left', 'right', 'bottom']}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} />

            {step === 0 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingHeader}>
                        <LogoMark />
                        <Text style={themedStyles.onboardingWelcome}>Welcome to</Text>
                        <Text style={themedStyles.onboardingAppName}>{APP_NAME}</Text>
                        <Text style={themedStyles.onboardingTagline}>Your personal sports companion</Text>
                    </View>
                    <View style={styles.onboardingContent}>
                        <Text style={themedStyles.onboardingDesc}>
                            {"Let's set up your preferences so you can see the games and races you care about most."}
                        </Text>
                    </View>
                    <TouchableOpacity style={themedStyles.onboardingButton} onPress={() => onStepChange(1)}>
                        <Text style={styles.onboardingButtonText}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {step === 1 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingStepHeader}>
                        <Text style={themedStyles.onboardingStepNumber}>1 of 4</Text>
                        <Ionicons name="snow-outline" size={32} color={colors.accent} style={styles.stepIcon} />
                        <Text style={themedStyles.onboardingStepTitle}>Pick your Hockey teams</Text>
                        <Text style={themedStyles.onboardingStepSubtitle}>Select the SHL teams you want to follow</Text>
                    </View>
                    <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
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
                                    {selectedTeams.includes(team.code) && (
                                        <Ionicons name="checkmark-circle" size={16} color={colors.accent} style={styles.chipCheck} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                    <View style={styles.onboardingNav}>
                        <TouchableOpacity style={styles.onboardingNavButton} onPress={() => onStepChange(0)}>
                            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                            <Text style={themedStyles.onboardingNavButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={themedStyles.onboardingButton} onPress={() => onStepChange(2)}>
                            <Text style={styles.onboardingButtonText}>{selectedTeams.length > 0 ? 'Continue' : 'Skip'}</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 2 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingStepHeader}>
                        <Text style={themedStyles.onboardingStepNumber}>2 of 4</Text>
                        <Ionicons name="football-outline" size={32} color={colors.accentGreen} style={styles.stepIcon} />
                        <Text style={themedStyles.onboardingStepTitle}>Pick your Football teams</Text>
                        <Text style={themedStyles.onboardingStepSubtitle}>Select the Allsvenskan teams you want to follow</Text>
                    </View>
                    <ScrollView style={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
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
                                        {selectedFootballTeams.includes(team.key) && (
                                            <Ionicons name="checkmark-circle" size={16} color={colors.accentGreen} style={styles.chipCheck} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                                <Text style={themedStyles.emptyStateText}>Football teams will appear here once loaded</Text>
                            </View>
                        )}
                    </ScrollView>
                    <View style={styles.onboardingNav}>
                        <TouchableOpacity style={styles.onboardingNavButton} onPress={() => onStepChange(1)}>
                            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                            <Text style={themedStyles.onboardingNavButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={themedStyles.onboardingButton} onPress={() => onStepChange(3)}>
                            <Text style={styles.onboardingButtonText}>{selectedFootballTeams.length > 0 ? 'Continue' : 'Skip'}</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 3 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingStepHeader}>
                        <Text style={themedStyles.onboardingStepNumber}>3 of 4</Text>
                        <Ionicons name="locate-outline" size={32} color={colors.accentPink} style={styles.stepIcon} />
                        <Text style={themedStyles.onboardingStepTitle}>Biathlon preferences</Text>
                        <Text style={themedStyles.onboardingStepSubtitle}>Which race categories interest you?</Text>
                    </View>
                    <View style={styles.onboardingCenteredContent}>
                        <Text style={themedStyles.sectionLabel}>Gender</Text>
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
                        <Text style={themedStyles.genderHint}>Select one or both to filter biathlon races</Text>
                    </View>
                    <View style={styles.onboardingNav}>
                        <TouchableOpacity style={styles.onboardingNavButton} onPress={() => onStepChange(2)}>
                            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
                            <Text style={themedStyles.onboardingNavButtonText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={themedStyles.onboardingButton} onPress={() => onStepChange(4)}>
                            <Text style={styles.onboardingButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {step === 4 && (
                <View style={styles.onboardingStep}>
                    <View style={styles.onboardingHeader}>
                        <Ionicons name="checkmark-circle" size={80} color={colors.accentGreen} />
                        <Text style={themedStyles.onboardingCompleteTitle}>{"You're all set!"}</Text>
                        <Text style={themedStyles.onboardingCompleteSubtitle}>
                            Your preferences have been saved. You can change them anytime in Settings.
                        </Text>
                    </View>
                    <View style={themedStyles.onboardingSummary}>
                        {selectedTeams.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="snow-outline" size={20} color={colors.accent} />
                                <Text style={themedStyles.onboardingSummaryText}>
                                    Following {selectedTeams.length} hockey team{selectedTeams.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}
                        {selectedFootballTeams.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="football-outline" size={20} color={colors.accentGreen} />
                                <Text style={themedStyles.onboardingSummaryText}>
                                    Following {selectedFootballTeams.length} football team{selectedFootballTeams.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}
                        {selectedGenders.length > 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="locate-outline" size={20} color={colors.accentPink} />
                                <Text style={themedStyles.onboardingSummaryText}>
                                    Biathlon: {selectedGenders.map(g => GENDER_OPTIONS.find(o => o.id === g)?.label).join(', ')}
                                </Text>
                            </View>
                        )}
                        {selectedTeams.length === 0 && selectedFootballTeams.length === 0 && selectedGenders.length === 0 && (
                            <View style={styles.onboardingSummaryItem}>
                                <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
                                <Text style={themedStyles.onboardingSummaryText}>
                                    Showing all games and races
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={themedStyles.onboardingButtonLarge} onPress={onComplete}>
                        <Text style={styles.onboardingButtonText}>Start Exploring</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    </Modal>
    );
};

const styles = StyleSheet.create({
    onboardingContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    onboardingStep: {
        flex: 1,
        padding: CONTENT_PADDING,
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
    stepIcon: {
        marginBottom: 8
    },
    onboardingStepNumber: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 12
    },
    onboardingStepTitle: {
        color: '#fff',
        fontSize: 26,
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
    // Unified chip grid
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CHIP_GAP,
        justifyContent: 'flex-start'
    },
    // Base team chip style (used for hockey and football)
    teamChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#1c1c1e',
        borderWidth: 2,
        borderColor: '#333'
    },
    // Nation chip (slightly smaller, horizontal layout)
    nationChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#1c1c1e',
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
    chipActivePink: {
        backgroundColor: 'rgba(217, 74, 140, 0.2)',
        borderColor: '#D94A8C'
    },
    chipLogo: {
        width: 36,
        height: 36
    },
    chipLogoPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2c2c2e'
    },
    chipText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    chipTextActive: {
        color: '#fff'
    },
    chipCheck: {
        position: 'absolute',
        top: 6,
        right: 6
    },
    nationFlag: {
        fontSize: 20
    },
    // Gender chips
    genderRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 24
    },
    genderChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#1c1c1e',
        borderWidth: 2,
        borderColor: '#333'
    },
    genderText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '700'
    },
    genderTextActive: {
        color: '#fff'
    },
    genderHint: {
        color: '#666',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 16
    },
    onboardingCenteredContent: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 12
    },
    sectionLabel: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginTop: 8
    },
    // Navigation
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
    // Complete screen
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
    // Empty state
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16
    }
});

// Dynamic themed styles based on current theme
const getThemedStyles = (colors, isDark) => ({
    onboardingContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    onboardingWelcome: {
        color: colors.textSecondary,
        fontSize: 18,
        fontWeight: '500',
        marginTop: 30
    },
    onboardingAppName: {
        color: colors.text,
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1
    },
    onboardingTagline: {
        color: colors.textMuted,
        fontSize: 16
    },
    onboardingDesc: {
        color: colors.textSecondary,
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28
    },
    onboardingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.accent,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14
    },
    onboardingButtonLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.accent,
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 14,
        marginTop: 40
    },
    onboardingStepNumber: {
        color: colors.accent,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 12
    },
    onboardingStepTitle: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center'
    },
    onboardingStepSubtitle: {
        color: colors.textSecondary,
        fontSize: 15,
        marginTop: 8,
        textAlign: 'center'
    },
    // Team/selection chip styles
    teamChip: {
        flexBasis: CHIP_WIDTH_PERCENT,
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 8,
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
        fontSize: 12,
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
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: colors.chip,
        borderWidth: 2,
        borderColor: colors.chipBorder
    },
    genderText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '700'
    },
    genderHint: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        marginTop: 16
    },
    sectionLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginTop: 8
    },
    onboardingNavButtonText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '600'
    },
    // Complete screen
    onboardingCompleteTitle: {
        color: colors.text,
        fontSize: 32,
        fontWeight: '800',
        marginTop: 24,
        textAlign: 'center'
    },
    onboardingCompleteSubtitle: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 20,
        lineHeight: 24
    },
    onboardingSummary: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        marginTop: 30,
        borderWidth: isDark ? 0 : 1,
        borderColor: colors.cardBorder
    },
    onboardingSummaryText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '500'
    },
    emptyStateText: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: 'center'
    }
});
