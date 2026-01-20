import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Try to extract substitution info from text
const extractSubstitutionFromText = (text) => {
    if (!text) {
        return { playerIn: null, playerOut: null };
    }

    // "Player Out is replaced by Player In"
    const replacedByMatch = text.match(/(.+?)\s+(?:is replaced by|replaced by|ersätts av)\s+(.+)/i);
    if (replacedByMatch) {
        return {
            playerOut: replacedByMatch[1].trim(),
            playerIn: replacedByMatch[2].trim()
        };
    }

    // "Player In replaces Player Out"
    const replacesMatch = text.match(/(.+?)\s+(?:replaces|ersätter|comes on for)\s+(.+)/i);
    if (replacesMatch) {
        return {
            playerIn: replacesMatch[1].trim(),
            playerOut: replacesMatch[2].trim()
        };
    }

    // "Substitution: Player Out off, Player In on"
    const offOnMatch = text.match(/(.+?)\s+(?:off|ut)[,.]?\s+(.+?)\s+(?:on|in)/i);
    if (offOnMatch) {
        return {
            playerOut: offOnMatch[1].trim(),
            playerIn: offOnMatch[2].trim()
        };
    }

    // "Substitution, Team. Player In for Player Out"
    const subForMatch = text.match(/substitution[,.]?\s*(?:[^.]+\.)?\s*(.+?)\s+(?:for|för)\s+(.+)/i);
    if (subForMatch) {
        return {
            playerIn: subForMatch[1].trim(),
            playerOut: subForMatch[2].trim()
        };
    }

    // "Player In for Player Out"
    const forMatch = text.match(/(.+?)\s+(?:for|för)\s+(.+)/i);
    if (forMatch) {
        return {
            playerIn: forMatch[1].trim(),
            playerOut: forMatch[2].trim()
        };
    }

    // Try to find two names separated by common delimiters
    // "Player Out → Player In" or "Player Out -> Player In"
    const arrowMatch = text.match(/(.+?)\s*(?:→|->|›)\s*(.+)/);
    if (arrowMatch) {
        return {
            playerOut: arrowMatch[1].trim(),
            playerIn: arrowMatch[2].trim()
        };
    }

    return { playerIn: null, playerOut: null };
};

// Format time display
const formatTime = (time) => {
    if (!time) {
        return '-';
    }
    const str = String(time);
    if (str.includes("'")) {
        return str;
    }
    return `${str}'`;
};

export const SubstitutionItem = ({ substitution }) => {
    // Try to get player names from structured data first, then from text
    const textParsed = extractSubstitutionFromText(substitution.text);

    const playerIn = substitution.playerIn?.name
        || substitution.playerIn?.displayName
        || textParsed.playerIn
        || null;

    const playerOut = substitution.playerOut?.name
        || substitution.playerOut?.displayName
        || textParsed.playerOut
        || null;

    const clock = substitution.clock || '';
    const periodLabel = substitution.period === 1 ? '1st' : substitution.period === 2 ? '2nd' : substitution.periodDisplay || '';
    const teamLabel = substitution.teamCode || substitution.teamName || '';

    // If we have both players, show the nice format
    const hasBothPlayers = playerIn && playerOut;
    // If we only have one player or none, show what we have or fall back to text
    const showRawText = !playerIn && !playerOut && substitution.text;

    return (
        <View style={styles.subItem}>
            <View style={styles.eventTime}>
                <Text style={styles.eventPeriod}>{periodLabel}</Text>
                <Text style={styles.eventTimeText}>{formatTime(clock)}</Text>
            </View>
            <View style={styles.eventContent}>
                {showRawText ? (
                    <Text style={styles.rawText} numberOfLines={2}>{substitution.text}</Text>
                ) : hasBothPlayers ? (
                    <>
                        <View style={styles.playerRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="arrow-down" size={12} color="#F44336" />
                            </View>
                            <Text style={styles.playerOut} numberOfLines={1}>{playerOut}</Text>
                        </View>
                        <View style={styles.playerRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="arrow-up" size={12} color="#4CAF50" />
                            </View>
                            <Text style={styles.playerIn} numberOfLines={1}>{playerIn}</Text>
                        </View>
                    </>
                ) : (
                    <>
                        {playerOut && (
                            <View style={styles.playerRow}>
                                <View style={styles.iconContainer}>
                                    <Ionicons name="arrow-down" size={12} color="#F44336" />
                                </View>
                                <Text style={styles.playerOut} numberOfLines={1}>{playerOut}</Text>
                            </View>
                        )}
                        {playerIn && (
                            <View style={styles.playerRow}>
                                <View style={styles.iconContainer}>
                                    <Ionicons name="arrow-up" size={12} color="#4CAF50" />
                                </View>
                                <Text style={styles.playerIn} numberOfLines={1}>{playerIn}</Text>
                            </View>
                        )}
                    </>
                )}
                <View style={styles.footerRow}>
                    <Text style={styles.eventTypeLabel}>Substitution</Text>
                    {teamLabel && <Text style={styles.teamCode}>{teamLabel}</Text>}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    subItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#2196F3'
    },
    eventTime: {
        width: 45,
        marginRight: 12
    },
    eventPeriod: {
        color: '#888',
        fontSize: 11
    },
    eventTimeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    eventContent: {
        flex: 1
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    iconContainer: {
        width: 20,
        alignItems: 'center',
        marginRight: 6
    },
    playerIn: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
        flex: 1
    },
    playerOut: {
        color: '#aaa',
        fontSize: 14,
        flex: 1
    },
    rawText: {
        color: '#fff',
        fontSize: 14,
        marginBottom: 4
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4
    },
    eventTypeLabel: {
        color: '#666',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    teamCode: {
        color: '#666',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase'
    }
});
