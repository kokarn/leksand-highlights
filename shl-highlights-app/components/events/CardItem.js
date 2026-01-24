import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Try to extract player name from card text
const extractPlayerFromText = (text) => {
    if (!text) {
        return null;
    }
    // Common patterns: "Yellow Card - Player Name" or "Player Name receives yellow card"
    const patterns = [
        /(?:Yellow|Red)\s+Card\s*[-–]\s*(.+?)(?:\s*\(|$)/i,
        /^(.+?)\s+(?:receives|gets|shown)\s+(?:a\s+)?(?:yellow|red)/i,
        /(?:yellow|red)\s+card\s+(?:for|to)\s+(.+?)(?:\s*\(|$)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
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

export const CardItem = ({ card }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    // Try multiple sources for player name
    const playerName = card.player?.name 
        || card.player?.displayName 
        || extractPlayerFromText(card.text)
        || card.text
        || 'Card';
    
    const isRed = card.cardType === 'red';
    const cardColor = isRed ? colors.accentRed : '#FFC107';
    const clock = card.clock || '';
    const reason = card.reason || '';
    const periodLabel = card.period === 1 ? '1st' : card.period === 2 ? '2nd' : card.periodDisplay || '';
    const teamLabel = card.teamCode || card.teamName || '';

    return (
        <View style={[themedStyles.cardItem, { borderLeftColor: cardColor }]}>
            <View style={themedStyles.eventTime}>
                <Text style={themedStyles.eventPeriod}>{periodLabel}</Text>
                <Text style={themedStyles.eventTimeText}>{formatTime(clock)}</Text>
            </View>
            <View style={themedStyles.eventContent}>
                <View style={themedStyles.eventHeader}>
                    <View style={[themedStyles.cardIcon, { backgroundColor: cardColor }]} />
                    <Text style={themedStyles.playerName} numberOfLines={2}>{playerName}</Text>
                </View>
                {reason && reason.toLowerCase() !== 'yellow card' && reason.toLowerCase() !== 'red card' && (
                    <Text style={themedStyles.eventDetail}>{reason}</Text>
                )}
                <View style={themedStyles.footerRow}>
                    <Text style={themedStyles.eventTypeLabel}>{isRed ? 'Red Card' : 'Yellow Card'}</Text>
                    {teamLabel && <Text style={themedStyles.teamCode}>{teamLabel}</Text>}
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3
    },
    eventTime: {
        width: 45,
        marginRight: 12
    },
    eventPeriod: {
        color: colors.textSecondary,
        fontSize: 11
    },
    eventTimeText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600'
    },
    eventContent: {
        flex: 1
    },
    eventHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },
    cardIcon: {
        width: 12,
        height: 16,
        borderRadius: 2,
        marginRight: 8,
        marginTop: 2
    },
    playerName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        flex: 1
    },
    eventDetail: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 4
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4
    },
    eventTypeLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    teamCode: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase'
    }
});
