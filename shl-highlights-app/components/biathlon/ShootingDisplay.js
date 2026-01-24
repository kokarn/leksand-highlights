import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Parse shooting string into array of stage data
 * 
 * Two formats exist:
 * 1. Individual races: "0+1+0+0" - stages separated by +, each number is misses
 * 2. Relay races: "0+2 0+3" - stages separated by space, each stage is "penalties+sparesUsed"
 * 
 * Returns array of { misses, spares } objects
 * - misses: penalties (targets still missed after using spare rounds)
 * - spares: spare rounds used (0 for individual races)
 */
function parseShootings(shootings) {
    if (!shootings || typeof shootings !== 'string') {
        return null;
    }

    const trimmed = shootings.trim();

    // Check if it's relay format (contains space - stages are space-separated)
    if (trimmed.includes(' ')) {
        // Relay format: "0+2 0+3" -> split by space, parse each stage
        const stages = trimmed.split(/\s+/);
        return stages.map(stage => {
            const parts = stage.split('+');
            return {
                misses: parseInt(parts[0], 10) || 0,
                spares: parseInt(parts[1], 10) || 0
            };
        });
    }

    // Individual format: "0+1+0+0" -> split by +, each is misses (no spare rounds)
    return trimmed.split('+').map(s => ({
        misses: parseInt(s, 10) || 0,
        spares: 0
    }));
}

/**
 * Helper to get total misses from parsed stages
 */
function getTotalMisses(stages) {
    if (!stages) {
        return 0;
    }
    return stages.reduce((sum, stage) => sum + (stage.misses || 0), 0);
}

/**
 * Helper to get total spare rounds used from parsed stages
 */
function getTotalSpares(stages) {
    if (!stages) {
        return 0;
    }
    return stages.reduce((sum, stage) => sum + (stage.spares || 0), 0);
}

/**
 * Get shooting position for each stage based on discipline
 * Sprint: Prone, Standing (PS - 2 stages)
 * Pursuit: Prone, Prone, Standing, Standing (PPSS - 4 stages)
 * Mass Start: Prone, Prone, Standing, Standing (PPSS - 4 stages)
 * Individual: Prone, Standing, Prone, Standing (PSPS - 4 stages)
 * Relay: Each athlete has 2 stages (PS - prone, standing)
 */
function getShootingPositions(stageCount, positions = null, discipline = null) {
    // If positions are provided and match the stage count, use them
    if (positions && typeof positions === 'string' && positions.length === stageCount) {
        return positions.split('').map(p => (p === 'P' ? 'prone' : 'standing'));
    }

    // Default patterns based on stage count and discipline
    const normalizedDiscipline = (discipline || '').toLowerCase();

    if (stageCount === 2) {
        // For relay athletes and sprint: Prone, Standing
        return ['prone', 'standing'];
    }
    if (stageCount === 4) {
        // Individual races use PSPS pattern
        if (normalizedDiscipline.includes('individual')) {
            return ['prone', 'standing', 'prone', 'standing'];
        }
        // Pursuit, Mass Start use PPSS pattern
        return ['prone', 'prone', 'standing', 'standing'];
    }
    // For other stage counts, default to alternating P/S
    return Array.from({ length: stageCount }, (_, i) => i % 2 === 0 ? 'prone' : 'standing');
}

/**
 * Render 5 target circles for a single shooting stage
 * Shows:
 * - Clean hits (no spare used): green filled circle
 * - Hits using spare rounds: orange/yellow filled circle
 * - Misses (penalties): red empty circle with X
 * 
 * Layout: [clean hits][spare hits][misses]
 * Example: 0 misses, 2 spares = 3 clean + 2 spare = ●●●◐◐
 */
const ShootingStage = memo(function ShootingStage({ misses, spares = 0, position, stageIndex, compact = false }) {
    const totalHits = 5 - misses;
    const cleanHits = Math.max(0, totalHits - spares); // Hits without spare rounds
    const spareHits = Math.min(spares, totalHits); // Hits that used spare rounds
    
    const isProne = position === 'prone';
    const positionColor = isProne ? '#4A9EFF' : '#FF6B6B';

    const targetSize = compact ? 10 : 14;
    const gap = compact ? 2 : 4;

    return (
        <View style={[styles.stageContainer, compact && styles.stageContainerCompact]}>
            <Text style={[styles.positionLabel, compact && styles.positionLabelCompact, { color: positionColor }]}>
                {isProne ? 'P' : 'S'}
            </Text>
            <View style={[styles.targetsRow, { gap }]}>
                {Array.from({ length: 5 }, (_, i) => {
                    const isCleanHit = i < cleanHits;
                    const isSpareHit = !isCleanHit && i < cleanHits + spareHits;
                    const isMiss = !isCleanHit && !isSpareHit;
                    
                    return (
                        <View
                            key={i}
                            style={[
                                styles.target,
                                { width: targetSize, height: targetSize, borderRadius: targetSize / 2 },
                                isCleanHit && styles.targetHit,
                                isSpareHit && styles.targetSpare,
                                isMiss && styles.targetMiss
                            ]}
                        >
                            {isMiss && (
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
    discipline = null,
    compact = false,
    showTotal = true,
    showLabel = true,
    textColor = null
}) {
    const stages = parseShootings(shootings);

    if (!stages || stages.length === 0) {
        return null;
    }

    const positions = getShootingPositions(stages.length, shootingPositions, discipline);
    const totalMisses = getTotalMisses(stages);
    const totalSpares = getTotalSpares(stages);
    const totalShots = stages.length * 5;
    const totalHits = totalShots - totalMisses;
    // Only truly clean if no misses AND no spare rounds used
    const isClean = totalMisses === 0 && totalSpares === 0;

    // For 4 stages, render in 2x2 grid: top-left, top-right, bottom-left, bottom-right
    const renderStages = () => {
        if (stages.length === 4) {
            return (
                <View style={styles.stagesGrid}>
                    <View style={[styles.stagesRow, compact && styles.stagesRowCompact]}>
                        <ShootingStage
                            key={0}
                            misses={stages[0].misses}
                            spares={stages[0].spares}
                            position={positions[0]}
                            stageIndex={0}
                            compact={compact}
                        />
                        <ShootingStage
                            key={1}
                            misses={stages[1].misses}
                            spares={stages[1].spares}
                            position={positions[1]}
                            stageIndex={1}
                            compact={compact}
                        />
                    </View>
                    <View style={[styles.stagesRow, compact && styles.stagesRowCompact]}>
                        <ShootingStage
                            key={2}
                            misses={stages[2].misses}
                            spares={stages[2].spares}
                            position={positions[2]}
                            stageIndex={2}
                            compact={compact}
                        />
                        <ShootingStage
                            key={3}
                            misses={stages[3].misses}
                            spares={stages[3].spares}
                            position={positions[3]}
                            stageIndex={3}
                            compact={compact}
                        />
                    </View>
                </View>
            );
        }
        // For 2 stages or other counts, render in a single row
        return (
            <View style={[styles.stagesRow, compact && styles.stagesRowCompact]}>
                {stages.map((stage, index) => (
                    <ShootingStage
                        key={index}
                        misses={stage.misses}
                        spares={stage.spares}
                        position={positions[index]}
                        stageIndex={index}
                        compact={compact}
                    />
                ))}
            </View>
        );
    };

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            {showLabel && !compact && (
                <Text style={[styles.label, textColor && { color: textColor }]}>Shooting</Text>
            )}
            {renderStages()}
            {showTotal && (
                <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, textColor && { color: textColor }]}>
                        {totalHits}/{totalShots}
                        {totalSpares > 0 && ` (+${totalSpares})`}
                    </Text>
                    {isClean && (
                        <Text style={styles.perfectBadge}>Clean!</Text>
                    )}
                </View>
            )}
        </View>
    );
});

/**
 * Compact inline shooting result (for result lists)
 * Shows shooting summary like "●●●◐◐ ●●●●○"
 * - ● = clean hit (no spare used)
 * - ◐ = hit using spare round (shown in orange)
 * - ○ = miss/penalty
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

    const totalMisses = getTotalMisses(stages);
    const totalSpares = getTotalSpares(stages);
    const isClean = totalMisses === 0 && totalSpares === 0;

    return (
        <View style={styles.inlineContainer}>
            {stages.map((stage, index) => {
                const { misses, spares } = stage;
                const totalHits = 5 - misses;
                const cleanHits = Math.max(0, totalHits - spares);
                const spareHits = Math.min(spares, totalHits);
                
                return (
                    <View key={index} style={styles.inlineStage}>
                        {Array.from({ length: 5 }, (_, i) => {
                            const isCleanHit = i < cleanHits;
                            const isSpareHit = !isCleanHit && i < cleanHits + spareHits;
                            
                            return (
                                <Text
                                    key={i}
                                    style={[
                                        styles.inlineDot,
                                        isCleanHit && styles.inlineDotHit,
                                        isSpareHit && styles.inlineDotSpare,
                                        !isCleanHit && !isSpareHit && styles.inlineDotMiss
                                    ]}
                                >
                                    {isCleanHit ? '●' : isSpareHit ? '●' : '○'}
                                </Text>
                            );
                        })}
                    </View>
                );
            })}
            {isClean && (
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
    const totalMisses = getTotalMisses(stages);
    const totalSpares = getTotalSpares(stages);

    if (totalMisses === 0 && !stages) {
        return null;
    }

    // Only truly clean if no misses AND no spare rounds used
    const isClean = totalMisses === 0 && totalSpares === 0;
    const isSizeLarge = size === 'large';

    // Determine badge display
    let badgeContent;
    if (isClean) {
        badgeContent = '🎯';
    } else if (totalMisses === 0 && totalSpares > 0) {
        // No penalties but used spares
        badgeContent = `+${totalSpares}`;
    } else {
        badgeContent = `${totalMisses}💨`;
    }

    return (
        <View style={[
            styles.badge,
            isClean ? styles.badgeClean : (totalMisses === 0 ? styles.badgeSpare : styles.badgeNormal),
            isSizeLarge && styles.badgeLarge
        ]}>
            <Text style={[
                styles.badgeText,
                isClean ? styles.badgeTextClean : (totalMisses === 0 ? styles.badgeTextSpare : styles.badgeTextNormal),
                isSizeLarge && styles.badgeTextLarge
            ]}>
                {badgeContent}
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
    stagesGrid: {
        gap: 12
    },
    stagesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16
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
    positionLabelCompact: {
        fontSize: 8
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
    targetSpare: {
        backgroundColor: '#FF9F0A',
        borderColor: '#FF9F0A'
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
        color: '#888',
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
    inlineDotSpare: {
        color: '#FF9F0A'
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
    badgeSpare: {
        backgroundColor: 'rgba(255, 159, 10, 0.2)'
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
    badgeTextSpare: {
        color: '#FF9F0A'
    },
    badgeTextNormal: {
        color: '#FF6B6B'
    },
    badgeTextLarge: {
        fontSize: 14
    }
});

export default ShootingDisplay;
