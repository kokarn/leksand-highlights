import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Parse shooting string into array of misses per stage
 * Format: "0+1+0+0" for pursuit (4 stages) or "0+0" for sprint (2 stages)
 * Numbers represent MISSES at each shooting stage (5 targets per stage)
 */
function parseShootings(shootings) {
    if (!shootings || typeof shootings !== 'string') {
        return null;
    }
    return shootings.split('+').map(s => parseInt(s, 10) || 0);
}

/**
 * Get shooting position for each stage
 * Sprint: Prone, Standing
 * Pursuit/Mass Start: Prone, Standing, Prone, Standing
 * Individual: Prone, Standing, Prone, Standing (but with time penalties)
 */
function getShootingPositions(stageCount, positions = null) {
    // If positions are provided (e.g., "PPSS"), use them
    if (positions && typeof positions === 'string') {
        return positions.split('').map(p => (p === 'P' ? 'prone' : 'standing'));
    }

    // Default patterns based on stage count
    if (stageCount === 2) {
        return ['prone', 'standing'];
    }
    if (stageCount === 4) {
        return ['prone', 'standing', 'prone', 'standing'];
    }
    // For relay and other formats
    return Array(stageCount).fill('prone');
}

/**
 * Render 5 target circles for a single shooting stage
 * Shows hits (filled) and misses (empty with X)
 */
const ShootingStage = memo(function ShootingStage({ misses, position, stageIndex, compact = false }) {
    const hits = 5 - misses;
    const isProne = position === 'prone';
    const positionColor = isProne ? '#4A9EFF' : '#FF6B6B';

    const targetSize = compact ? 10 : 14;
    const gap = compact ? 2 : 4;

    return (
        <View style={[styles.stageContainer, compact && styles.stageContainerCompact]}>
            {!compact && (
                <Text style={[styles.positionLabel, { color: positionColor }]}>
                    {isProne ? 'P' : 'S'}
                </Text>
            )}
            <View style={[styles.targetsRow, { gap }]}>
                {Array.from({ length: 5 }, (_, i) => {
                    const isHit = i < hits;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.target,
                                { width: targetSize, height: targetSize, borderRadius: targetSize / 2 },
                                isHit ? styles.targetHit : styles.targetMiss
                            ]}
                        >
                            {!isHit && (
                                <Text style={[styles.missX, { fontSize: compact ? 7 : 9 }]}>✕</Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
});

/**
 * Full shooting display with all stages
 */
export const ShootingDisplay = memo(function ShootingDisplay({
    shootings,
    shootingTotal,
    shootingPositions = null,
    compact = false,
    showTotal = true,
    showLabel = true
}) {
    const stages = parseShootings(shootings);

    if (!stages || stages.length === 0) {
        return null;
    }

    const positions = getShootingPositions(stages.length, shootingPositions);
    const totalMisses = parseInt(shootingTotal, 10) || stages.reduce((sum, m) => sum + m, 0);
    const totalShots = stages.length * 5;
    const totalHits = totalShots - totalMisses;

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            {showLabel && !compact && (
                <Text style={styles.label}>Shooting</Text>
            )}
            <View style={[styles.stagesRow, compact && styles.stagesRowCompact]}>
                {stages.map((misses, index) => (
                    <ShootingStage
                        key={index}
                        misses={misses}
                        position={positions[index]}
                        stageIndex={index}
                        compact={compact}
                    />
                ))}
            </View>
            {showTotal && (
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                        {totalHits}/{totalShots}
                    </Text>
                    {totalMisses === 0 && (
                        <Text style={styles.perfectBadge}>Clean!</Text>
                    )}
                </View>
            )}
        </View>
    );
});

/**
 * Compact inline shooting result (for result lists)
 * Shows shooting summary like "●●●●○ ●●●●● ●●●●● ●●●●●"
 */
export const ShootingInline = memo(function ShootingInline({ shootings, shootingTotal }) {
    const stages = parseShootings(shootings);

    if (!stages || stages.length === 0) {
        if (shootingTotal !== undefined && shootingTotal !== null) {
            // Just show the total if we have it
            const total = parseInt(shootingTotal, 10);
            return (
                <Text style={styles.inlineShooting}>
                    {total === 0 ? '🎯 0' : `${total}💨`}
                </Text>
            );
        }
        return null;
    }

    const totalMisses = parseInt(shootingTotal, 10) || stages.reduce((sum, m) => sum + m, 0);

    return (
        <View style={styles.inlineContainer}>
            {stages.map((misses, index) => {
                const hits = 5 - misses;
                return (
                    <View key={index} style={styles.inlineStage}>
                        {Array.from({ length: 5 }, (_, i) => (
                            <Text
                                key={i}
                                style={[
                                    styles.inlineDot,
                                    i < hits ? styles.inlineDotHit : styles.inlineDotMiss
                                ]}
                            >
                                {i < hits ? '●' : '○'}
                            </Text>
                        ))}
                    </View>
                );
            })}
            {totalMisses === 0 && (
                <Text style={styles.cleanIcon}>🎯</Text>
            )}
        </View>
    );
});

/**
 * Summary badge showing shooting result (for cards)
 */
export const ShootingBadge = memo(function ShootingBadge({ shootings, shootingTotal, size = 'medium' }) {
    const stages = parseShootings(shootings);
    const totalMisses = parseInt(shootingTotal, 10) || (stages ? stages.reduce((sum, m) => sum + m, 0) : 0);

    if (totalMisses === null && !stages) {
        return null;
    }

    const isClean = totalMisses === 0;
    const isSizeLarge = size === 'large';

    return (
        <View style={[
            styles.badge,
            isClean ? styles.badgeClean : styles.badgeNormal,
            isSizeLarge && styles.badgeLarge
        ]}>
            <Text style={[
                styles.badgeText,
                isClean ? styles.badgeTextClean : styles.badgeTextNormal,
                isSizeLarge && styles.badgeTextLarge
            ]}>
                {isClean ? '🎯' : `${totalMisses}💨`}
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        gap: 8
    },
    containerCompact: {
        gap: 4
    },
    label: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4
    },
    stagesRow: {
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap'
    },
    stagesRowCompact: {
        gap: 8
    },
    stageContainer: {
        alignItems: 'center',
        gap: 4
    },
    stageContainerCompact: {
        gap: 2
    },
    positionLabel: {
        fontSize: 10,
        fontWeight: '700'
    },
    targetsRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    target: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5
    },
    targetHit: {
        backgroundColor: '#30D158',
        borderColor: '#30D158'
    },
    targetMiss: {
        backgroundColor: 'transparent',
        borderColor: '#FF453A'
    },
    missX: {
        color: '#FF453A',
        fontWeight: '800'
    },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4
    },
    totalLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700'
    },
    perfectBadge: {
        color: '#30D158',
        fontSize: 12,
        fontWeight: '700'
    },
    // Inline styles
    inlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    inlineStage: {
        flexDirection: 'row',
        gap: 1
    },
    inlineDot: {
        fontSize: 8
    },
    inlineDotHit: {
        color: '#30D158'
    },
    inlineDotMiss: {
        color: '#FF453A'
    },
    inlineShooting: {
        color: '#888',
        fontSize: 12
    },
    cleanIcon: {
        fontSize: 12,
        marginLeft: 2
    },
    // Badge styles
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    badgeClean: {
        backgroundColor: 'rgba(48, 209, 88, 0.2)'
    },
    badgeNormal: {
        backgroundColor: 'rgba(255, 69, 58, 0.15)'
    },
    badgeLarge: {
        paddingHorizontal: 12,
        paddingVertical: 5
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700'
    },
    badgeTextClean: {
        color: '#30D158'
    },
    badgeTextNormal: {
        color: '#FF6B6B'
    },
    badgeTextLarge: {
        fontSize: 14
    }
});

export default ShootingDisplay;
