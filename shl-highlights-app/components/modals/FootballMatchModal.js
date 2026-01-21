import { useState, useMemo } from 'react';
import { View, Text, Modal, ScrollView, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { extractScore, formatSwedishDate } from '../../utils';
import { TabButton } from '../TabButton';
import { StatBar } from '../StatBar';
import { FootballGoalItem, CardItem, SubstitutionItem, HalfMarker } from '../events';

const getTeamName = (team, fallback) => {
    return team?.names?.short || team?.names?.long || team?.code || fallback;
};

const getTeamLogo = (team) => {
    return team?.icon || null;
};

// Default team colors for football
const HOME_COLOR = '#4CAF50';
const AWAY_COLOR = '#2196F3';

export const FootballMatchModal = ({ match, details, visible, onClose, loading }) => {
    const [activeTab, setActiveTab] = useState('summary');

    // Extract all data upfront (before any hooks that depend on it)
    const info = details?.info || match;
    const homeTeam = info?.homeTeamInfo || match?.homeTeamInfo || {};
    const awayTeam = info?.awayTeamInfo || match?.awayTeamInfo || {};
    const homeCode = homeTeam?.code || 'HOME';
    const awayCode = awayTeam?.code || 'AWAY';

    // Extract team stats from details
    const teamStats = details?.teamStats || null;
    const homeStats = teamStats?.homeTeam?.statistics || {};
    const awayStats = teamStats?.awayTeam?.statistics || {};

    // Parse stat values for display
    const parseStatValue = (value) => {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        // Handle percentage strings
        const str = String(value);
        if (str.includes('%')) {
            return parseFloat(str.replace('%', ''));
        }
        const parsed = parseFloat(str);
        return isNaN(parsed) ? null : parsed;
    };

    // Extract common football stats
    const possession = {
        home: parseStatValue(homeStats.possessionPct) ?? parseStatValue(homeStats.possession),
        away: parseStatValue(awayStats.possessionPct) ?? parseStatValue(awayStats.possession)
    };
    const totalShots = {
        home: parseStatValue(homeStats.totalShots) ?? parseStatValue(homeStats.shots),
        away: parseStatValue(awayStats.totalShots) ?? parseStatValue(awayStats.shots)
    };
    const shotsOnTarget = {
        home: parseStatValue(homeStats.shotsOnTarget) ?? parseStatValue(homeStats.shotsOnGoal),
        away: parseStatValue(awayStats.shotsOnTarget) ?? parseStatValue(awayStats.shotsOnGoal)
    };
    const corners = {
        home: parseStatValue(homeStats.corners) ?? parseStatValue(homeStats.cornerKicks),
        away: parseStatValue(awayStats.corners) ?? parseStatValue(awayStats.cornerKicks)
    };
    const fouls = {
        home: parseStatValue(homeStats.foulsCommitted) ?? parseStatValue(homeStats.fouls),
        away: parseStatValue(awayStats.foulsCommitted) ?? parseStatValue(awayStats.fouls)
    };

    const hasStats = teamStats && (
        possession.home !== null ||
        totalShots.home !== null ||
        shotsOnTarget.home !== null
    );

    // Extract events
    const events = details?.events || {};
    const rawGoals = events?.goals || [];
    const cards = events?.cards || [];
    const substitutions = events?.substitutions || [];
    const allEvents = events?.all || [];

    // Calculate running scores for goals
    const goalsWithScores = useMemo(() => {
        if (rawGoals.length === 0) {
            return [];
        }

        // Sort goals by period and time first (chronological for score calculation)
        const sortedGoals = [...rawGoals].sort((a, b) => {
            const periodDiff = (a.period || 1) - (b.period || 1);
            if (periodDiff !== 0) {
                return periodDiff;
            }
            const parseTime = (clock) => {
                if (!clock) {
                    return 0;
                }
                const match = String(clock).match(/(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };
            return parseTime(a.clock) - parseTime(b.clock);
        });

        // Calculate running score for each goal
        let runningHome = 0;
        let runningAway = 0;

        const goalsWithCalcScores = sortedGoals.map(goal => {
            const isHomeGoal = goal.isHome === true || goal.teamCode === homeCode;

            if (isHomeGoal) {
                runningHome++;
            } else {
                runningAway++;
            }

            return {
                ...goal,
                calculatedScore: {
                    home: runningHome,
                    away: runningAway
                }
            };
        });

        // Reverse to show most recent first
        return goalsWithCalcScores.reverse();
    }, [rawGoals, homeCode]);

    // Use goals with calculated scores
    const goals = goalsWithScores;

    // Process events for the Events tab - group by half and calculate running scores
    const processedEvents = useMemo(() => {
        if (!allEvents.length && !rawGoals.length && !cards.length) {
            return [];
        }

        // Combine all events if allEvents is empty
        let combinedEvents = allEvents.length > 0 ? [...allEvents] : [
            ...rawGoals.map(g => ({ ...g, type: 'goal' })),
            ...cards.map(c => ({ ...c, type: 'card' })),
            ...substitutions.map(s => ({ ...s, type: 'substitution' }))
        ];

        // Sort by period and time (chronological first for score calculation)
        combinedEvents.sort((a, b) => {
            const periodDiff = (a.period || 1) - (b.period || 1);
            if (periodDiff !== 0) {
                return periodDiff;
            }
            const parseTime = (clock) => {
                if (!clock) {
                    return 0;
                }
                const match = String(clock).match(/(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };
            return parseTime(a.clock) - parseTime(b.clock);
        });

        // Calculate running scores for goals first
        let runningHome = 0;
        let runningAway = 0;
        const eventsWithScores = combinedEvents.map(event => {
            if (event.type === 'goal') {
                const isHomeGoal = event.isHome === true || event.teamCode === homeCode;
                if (isHomeGoal) {
                    runningHome++;
                } else {
                    runningAway++;
                }
                return {
                    ...event,
                    calculatedScore: {
                        home: runningHome,
                        away: runningAway
                    }
                };
            }
            return event;
        });

        // Reverse to show most recent first
        const reversedEvents = eventsWithScores.reverse();

        // Add half markers (now in reverse order: 2nd half first, then 1st)
        const result = [];
        let currentHalf = 0;

        for (const event of reversedEvents) {
            const eventHalf = event.period || 1;
            if (eventHalf !== currentHalf) {
                result.push({ type: 'half_marker', half: eventHalf });
                currentHalf = eventHalf;
            }
            result.push(event);
        }

        return result;
    }, [allEvents, rawGoals, cards, substitutions, homeCode]);

    // Early return after all hooks
    if (!match) {
        return null;
    }

    // Remaining derived values (safe to compute after hooks)
    const homeScore = extractScore(null, homeTeam);
    const awayScore = extractScore(null, awayTeam);
    const isLive = info?.state === 'live';
    const stateLabel = info?.state === 'post-game'
        ? 'Final'
        : info?.state === 'pre-game'
            ? 'Pre-game'
            : info?.state || '-';
    const startDateTime = info?.startDateTime || match?.startDateTime;
    const venueName = info?.venueInfo?.name
        || details?.venue?.fullName
        || details?.venue?.shortName
        || match?.venueInfo?.name
        || '-';

    // Summary Tab Content
    const renderSummaryTab = () => {
        return (
            <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
                {hasStats && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Match Stats</Text>
                        {possession.home !== null && possession.away !== null && (
                            <StatBar
                                label="Possession"
                                homeValue={`${Math.round(possession.home)}%`}
                                awayValue={`${Math.round(possession.away)}%`}
                                homeColor={HOME_COLOR}
                                awayColor={AWAY_COLOR}
                            />
                        )}
                        {totalShots.home !== null && totalShots.away !== null && (
                            <StatBar
                                label="Total Shots"
                                homeValue={totalShots.home}
                                awayValue={totalShots.away}
                                homeColor={HOME_COLOR}
                                awayColor={AWAY_COLOR}
                            />
                        )}
                        {shotsOnTarget.home !== null && shotsOnTarget.away !== null && (
                            <StatBar
                                label="Shots on Target"
                                homeValue={shotsOnTarget.home}
                                awayValue={shotsOnTarget.away}
                                homeColor={HOME_COLOR}
                                awayColor={AWAY_COLOR}
                            />
                        )}
                        {corners.home !== null && corners.away !== null && (
                            <StatBar
                                label="Corners"
                                homeValue={corners.home}
                                awayValue={corners.away}
                                homeColor={HOME_COLOR}
                                awayColor={AWAY_COLOR}
                            />
                        )}
                        {fouls.home !== null && fouls.away !== null && (
                            <StatBar
                                label="Fouls"
                                homeValue={fouls.home}
                                awayValue={fouls.away}
                                homeColor={HOME_COLOR}
                                awayColor={AWAY_COLOR}
                            />
                        )}
                    </View>
                )}

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Goals</Text>
                    {goals.length === 0 ? (
                        <Text style={styles.emptyText}>No goals scored</Text>
                    ) : (
                        goals.map((goal, idx) => (
                            <FootballGoalItem
                                key={goal.id || idx}
                                goal={goal}
                                homeTeamCode={homeCode}
                            />
                        ))
                    )}
                </View>

                {cards.length > 0 && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Cards</Text>
                        {cards.map((card, idx) => (
                            <CardItem key={card.id || idx} card={card} />
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    };

    // Events Tab Content
    const renderEventsTab = () => {
        if (processedEvents.length === 0) {
            return <Text style={styles.emptyText}>No events available</Text>;
        }

        return (
            <FlatList
                data={processedEvents}
                keyExtractor={(item, idx) => `${item.type}-${item.id || idx}`}
                contentContainerStyle={styles.tabContent}
                renderItem={({ item }) => {
                    if (item.type === 'half_marker') {
                        return <HalfMarker half={item.half} />;
                    }
                    if (item.type === 'goal') {
                        return <FootballGoalItem goal={item} homeTeamCode={homeCode} />;
                    }
                    if (item.type === 'card') {
                        return <CardItem card={item} />;
                    }
                    if (item.type === 'substitution') {
                        return <SubstitutionItem substitution={item} />;
                    }
                    return null;
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No events available</Text>}
            />
        );
    };

    // Info Tab Content
    const renderInfoTab = () => (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Match Details</Text>
                <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#888" />
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'd MMMM yyyy')}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={18} color="#888" />
                    <Text style={styles.detailLabel}>Kickoff</Text>
                    <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'HH:mm')}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={18} color="#888" />
                    <Text style={styles.detailLabel}>Venue</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{venueName}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Ionicons name="pulse-outline" size={18} color="#888" />
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>{stateLabel}</Text>
                </View>
            </View>
        </ScrollView>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                {/* Header with score */}
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.scoreHeader}>
                        <View style={styles.scoreTeam}>
                            {getTeamLogo(homeTeam) ? (
                                <Image
                                    source={{ uri: getTeamLogo(homeTeam) }}
                                    style={styles.scoreTeamLogo}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.teamLogoPlaceholder} />
                            )}
                            <Text style={styles.scoreTeamCode}>{getTeamName(homeTeam, 'Home')}</Text>
                        </View>
                        <View style={styles.scoreCenterBlock}>
                            <Text style={styles.scoreLarge}>{homeScore} - {awayScore}</Text>
                            <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
                                <Text style={styles.statusBadgeText}>{stateLabel}</Text>
                            </View>
                            {info?.state === 'pre-game' && startDateTime && (
                                <Text style={styles.gameDateText}>
                                    {formatSwedishDate(startDateTime, 'd MMMM HH:mm')}
                                </Text>
                            )}
                        </View>
                        <View style={styles.scoreTeam}>
                            {getTeamLogo(awayTeam) ? (
                                <Image
                                    source={{ uri: getTeamLogo(awayTeam) }}
                                    style={styles.scoreTeamLogo}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.teamLogoPlaceholder} />
                            )}
                            <Text style={styles.scoreTeamCode}>{getTeamName(awayTeam, 'Away')}</Text>
                        </View>
                    </View>
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    <TabButton
                        title="Summary"
                        icon="stats-chart"
                        isActive={activeTab === 'summary'}
                        onPress={() => setActiveTab('summary')}
                    />
                    <TabButton
                        title="Events"
                        icon="list"
                        isActive={activeTab === 'events'}
                        onPress={() => setActiveTab('events')}
                    />
                    <TabButton
                        title="Info"
                        icon="information-circle"
                        isActive={activeTab === 'info'}
                        onPress={() => setActiveTab('info')}
                    />
                </View>

                {/* Tab Content */}
                {loading ? (
                    <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 50 }} />
                ) : (
                    <View style={styles.tabContentContainer}>
                        {activeTab === 'summary' && renderSummaryTab()}
                        {activeTab === 'events' && renderEventsTab()}
                        {activeTab === 'info' && renderInfoTab()}
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    modalHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    scoreHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20
    },
    scoreTeam: {
        alignItems: 'center',
        width: 80
    },
    scoreTeamLogo: {
        width: 50,
        height: 50,
        marginBottom: 4
    },
    teamLogoPlaceholder: {
        width: 50,
        height: 50,
        marginBottom: 4,
        borderRadius: 25,
        backgroundColor: '#2c2c2e'
    },
    scoreTeamCode: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center'
    },
    scoreCenterBlock: {
        alignItems: 'center',
        marginHorizontal: 20
    },
    scoreLarge: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    statusBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#444'
    },
    statusBadgeLive: {
        backgroundColor: '#FF453A'
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    gameDateText: {
        color: '#aaa',
        fontSize: 13,
        marginTop: 8
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    tabContentContainer: {
        flex: 1
    },
    tabContent: {
        padding: 16
    },
    sectionCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a'
    },
    detailLabel: {
        color: '#888',
        fontSize: 14,
        flex: 1
    },
    detailValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right'
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        padding: 20
    }
});
