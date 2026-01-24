import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { GENDER_COLORS } from '../../constants';
import { formatSwedishDate } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';
import { ShootingDisplay, ShootingInline } from '../biathlon';

/**
 * Parse shooting string into array of misses per stage
 */
function parseShootings(shootings) {
    if (!shootings || typeof shootings !== 'string') {
        return null;
    }
    return shootings.split('+').map(s => parseInt(s, 10) || 0);
}

/**
 * Get medal emoji for top 3 positions
 */
function getMedalEmoji(rank) {
    const r = parseInt(rank, 10);
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return null;
}

/**
 * Check if discipline is a relay race
 */
function isRelayRace(discipline) {
    if (!discipline) {
        return false;
    }
    const d = discipline.toLowerCase();
    return d.includes('relay');
}

/**
 * Group participants by nation for relay races
 * IBU relay data has team entries (IsTeam: true, Leg: 0) followed by athlete entries (Leg: 1, 2, 3, 4)
 */
function groupByNation(participants) {
    const groups = {};
    const order = [];

    participants.forEach((item, index) => {
        const nation = item?.Nat || item?.Nation || item?.Country || 'Unknown';

        // Check if this is a team header entry (IBU format: IsTeam=true or Leg=0)
        const isTeamHeader = item?.IsTeam === true || item?.Leg === 0;

        if (!groups[nation]) {
            groups[nation] = {
                nation,
                athletes: [],
                // Team data from first entry (either team header or first athlete)
                rank: null,
                startOrder: null,
                result: null,
                behind: null,
                startInfo: null,
                bib: null
            };
            order.push(nation);
        }

        if (isTeamHeader) {
            // Use team header data for team info
            groups[nation].rank = item?.Rank ?? null;
            groups[nation].startOrder = item?.StartOrder ?? null;
            groups[nation].result = item?.Result || item?.TotalTime || null;
            groups[nation].behind = item?.Behind || null;
            groups[nation].startInfo = item?.StartInfo || null;
            groups[nation].bib = item?.Bib || null;
        } else {
            // Add athlete to the team
            groups[nation].athletes.push({ ...item, originalIndex: index });

            // If no team header was found, use first athlete's data for team info
            if (groups[nation].startOrder === null) {
                groups[nation].startOrder = item?.StartOrder ?? null;
                groups[nation].result = item?.Result || item?.TotalTime || null;
                groups[nation].behind = item?.Behind || null;
                groups[nation].bib = item?.Bib || null;
            }
        }
    });

    // Sort by bib number (for start lists) or rank (for results)
    return order
        .map(nation => groups[nation])
        .sort((a, b) => {
            // Use bib for start list order, rank for results
            // Filter out high values (10000+ means no result from IBU)
            const getOrder = (team) => {
                if (team.rank && team.rank < 10000) {
                    return team.rank;
                }
                if (team.bib) {
                    return parseInt(team.bib, 10) || 9999;
                }
                return team.startOrder || 9999;
            };
            return getOrder(a) - getOrder(b);
        });
}

/**
 * Result row component with enhanced shooting display
 */
const ResultRow = ({ item, index, hasResults, isExpanded, onToggle, isRaceCompleted, discipline, colors, themedStyles }) => {
    const rank = (() => {
        // IBU uses ResultOrder >= 10000 for non-finishers (DNS, DNF, etc.)
        const rawResultOrder = item?.ResultOrder;
        const resultOrder = (typeof rawResultOrder === 'number' && rawResultOrder < 10000) ? rawResultOrder : null;
        const r = item?.Rank ?? resultOrder ?? item?.StartOrder;
        return r ? String(r) : String(index + 1);
    })();

    const name = (() => {
        if (!item) return 'Unknown';
        if (item.Name) return item.Name;
        const givenName = item.GivenName || '';
        const familyName = item.FamilyName || '';
        const combined = `${givenName} ${familyName}`.trim();
        return combined || item.ShortName || 'Unknown';
    })();

    const nation = item?.Nat || item?.Nation || item?.Country || null;

    const resultValue = (() => {
        if (!item) return '-';
        if (item.IRM) return item.IRM;
        if (hasResults) {
            return item.Result || item.TotalTime || item.RunTime || item.Behind || '-';
        }
        return '-';
    })();

    const shootings = item?.Shootings;
    const shootingTotal = item?.ShootingTotal;
    const hasShootingData = Boolean(shootings);
    // Only show medals if the race is completed (not live or upcoming)
    const medal = isRaceCompleted ? getMedalEmoji(rank) : null;
    const isTopThree = isRaceCompleted && parseInt(rank, 10) <= 3;

    // For start list, show start info
    const startInfo = !hasResults ? item?.StartInfo : null;

    return (
        <TouchableOpacity
            style={[themedStyles.resultRow, isTopThree && themedStyles.resultRowHighlight]}
            onPress={hasShootingData ? onToggle : undefined}
            activeOpacity={hasShootingData ? 0.7 : 1}
        >
            <View style={themedStyles.resultRankContainer}>
                {medal ? (
                    <Text style={themedStyles.medalEmoji}>{medal}</Text>
                ) : (
                    <Text style={themedStyles.resultRank}>{rank}</Text>
                )}
            </View>

            <View style={themedStyles.resultMain}>
                <View style={themedStyles.resultNameRow}>
                    <Text style={[themedStyles.resultName, isTopThree && themedStyles.resultNameHighlight]} numberOfLines={1}>
                        {name}
                    </Text>
                </View>

                <View style={themedStyles.resultMetaRow}>
                    {nation && (
                        <Text style={themedStyles.resultNation}>
                            {getNationFlag(nation)} {nation}
                        </Text>
                    )}
                    {hasShootingData && !isExpanded && (
                        <ShootingInline shootings={shootings} shootingTotal={shootingTotal} />
                    )}
                    {startInfo && !hasResults && (
                        <Text style={themedStyles.startInfoText}>Start: {startInfo}</Text>
                    )}
                </View>

                {/* Expanded shooting view */}
                {isExpanded && hasShootingData && (
                    <View style={themedStyles.expandedShooting}>
                        <ShootingDisplay
                            shootings={shootings}
                            shootingTotal={shootingTotal}
                            discipline={discipline}
                            compact={false}
                            showTotal={true}
                            showLabel={false}
                        />
                    </View>
                )}
            </View>

            <View style={themedStyles.resultValueContainer}>
                <Text style={[themedStyles.resultValue, isTopThree && themedStyles.resultValueHighlight]}>
                    {resultValue}
                </Text>
                {hasShootingData && (
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.textMuted}
                        style={themedStyles.expandIcon}
                    />
                )}
            </View>
        </TouchableOpacity>
    );
};

/**
 * Relay team row component - shows team header with nested athletes
 */
const RelayTeamRow = ({ team, teamIndex, hasResults, expandedRows, onToggle, isRaceCompleted, discipline, colors, themedStyles }) => {
    // For start lists, use bib number as display rank (cleaner than startOrder)
    // For results, use rank. Filter out high values (10000+ means no result)
    const getDisplayRank = () => {
        if (hasResults) {
            const r = team.rank;
            if (r && r < 10000) {
                return r;
            }
            return teamIndex + 1;
        }
        // For start lists, prefer bib number, fall back to calculated index
        if (team.bib) {
            return team.bib;
        }
        return teamIndex + 1;
    };
    const displayRank = getDisplayRank();
    const rank = String(displayRank);
    const medal = isRaceCompleted && hasResults ? getMedalEmoji(rank) : null;
    const isTopThree = isRaceCompleted && hasResults && parseInt(rank, 10) <= 3;

    return (
        <View style={[themedStyles.relayTeamContainer, isTopThree && themedStyles.relayTeamHighlight]}>
            {/* Team header */}
            <View style={themedStyles.relayTeamHeader}>
                <View style={themedStyles.resultRankContainer}>
                    {medal ? (
                        <Text style={themedStyles.medalEmoji}>{medal}</Text>
                    ) : (
                        <Text style={themedStyles.resultRank}>{rank}</Text>
                    )}
                </View>
                <View style={themedStyles.relayTeamInfo}>
                    <View style={themedStyles.relayTeamNameRow}>
                        <Text style={[themedStyles.relayTeamName, isTopThree && themedStyles.resultNameHighlight]}>
                            {getNationFlag(team.nation)} {team.nation}
                        </Text>
                        {team.bib && (
                            <Text style={themedStyles.relayTeamBib}>#{team.bib}</Text>
                        )}
                    </View>
                    {!hasResults && team.startInfo && (
                        <Text style={themedStyles.relayTeamStartInfo}>{team.startInfo}</Text>
                    )}
                    {hasResults && team.result && (
                        <Text style={themedStyles.relayTeamResult}>{team.result}</Text>
                    )}
                    {hasResults && team.behind && team.behind !== '+0.0' && (
                        <Text style={themedStyles.relayTeamBehind}>{team.behind}</Text>
                    )}
                </View>
            </View>

            {/* Team athletes */}
            <View style={themedStyles.relayAthletesList}>
                {team.athletes.map((item, athleteIndex) => {
                    const name = (() => {
                        if (!item) {
                            return 'Unknown';
                        }
                        if (item.Name) {
                            return item.Name;
                        }
                        const givenName = item.GivenName || '';
                        const familyName = item.FamilyName || '';
                        const combined = `${givenName} ${familyName}`.trim();
                        return combined || item.ShortName || 'Unknown';
                    })();

                    const legNumber = item?.Leg || athleteIndex + 1;
                    const shootings = item?.Shootings;
                    const shootingTotal = item?.ShootingTotal;
                    const hasShootingData = Boolean(shootings);
                    const isExpanded = expandedRows.has(item.originalIndex);
                    const athleteResult = item?.LegTime || item?.Result || null;

                    return (
                        <TouchableOpacity
                            key={item?.IBUId || item?.Name || athleteIndex}
                            style={themedStyles.relayAthleteRow}
                            onPress={hasShootingData ? () => onToggle(item.originalIndex) : undefined}
                            activeOpacity={hasShootingData ? 0.7 : 1}
                        >
                            <View style={themedStyles.relayLegBadge}>
                                <Text style={themedStyles.relayLegText}>{legNumber}</Text>
                            </View>
                            <View style={themedStyles.relayAthleteMain}>
                                <Text style={themedStyles.relayAthleteName} numberOfLines={1}>{name}</Text>
                                {hasShootingData && !isExpanded && (
                                    <View style={themedStyles.resultMetaRow}>
                                        <ShootingInline shootings={shootings} shootingTotal={shootingTotal} />
                                    </View>
                                )}
                                {isExpanded && hasShootingData && (
                                    <View style={themedStyles.expandedShooting}>
                                        <ShootingDisplay
                                            shootings={shootings}
                                            shootingTotal={shootingTotal}
                                            discipline={discipline}
                                            compact={false}
                                            showTotal={true}
                                            showLabel={false}
                                        />
                                    </View>
                                )}
                            </View>
                            <View style={themedStyles.relayAthleteRight}>
                                {hasResults && athleteResult && (
                                    <Text style={themedStyles.relayAthleteTime}>{athleteResult}</Text>
                                )}
                                {hasShootingData && (
                                    <Ionicons
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={14}
                                        color={colors.textMuted}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

/**
 * Country filter dropdown component
 */
const CountryFilterDropdown = ({ countries, selectedCountry, onSelectCountry, colors, themedStyles }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    if (!countries || countries.length <= 1) {
        return null;
    }

    const handleSelect = (country) => {
        onSelectCountry(country);
        setIsOpen(false);
    };

    const displayText = selectedCountry
        ? `${getNationFlag(selectedCountry)} ${selectedCountry}`
        : 'All countries';

    return (
        <View style={themedStyles.countryDropdownContainer}>
            <TouchableOpacity
                style={themedStyles.countryDropdownButton}
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <View style={themedStyles.countryDropdownButtonContent}>
                    <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
                    <Text style={themedStyles.countryDropdownButtonText}>{displayText}</Text>
                </View>
                <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                />
            </TouchableOpacity>

            {isOpen && (
                <View style={themedStyles.countryDropdownList}>
                    <ScrollView style={themedStyles.countryDropdownScroll} nestedScrollEnabled>
                        <TouchableOpacity
                            style={[
                                themedStyles.countryDropdownItem,
                                !selectedCountry && themedStyles.countryDropdownItemActive
                            ]}
                            onPress={() => handleSelect(null)}
                        >
                            <Text style={[
                                themedStyles.countryDropdownItemText,
                                !selectedCountry && themedStyles.countryDropdownItemTextActive
                            ]}>
                                All countries
                            </Text>
                            {!selectedCountry && (
                                <Ionicons name="checkmark" size={16} color={colors.accent} />
                            )}
                        </TouchableOpacity>
                        {countries.map((country) => (
                            <TouchableOpacity
                                key={country}
                                style={[
                                    themedStyles.countryDropdownItem,
                                    selectedCountry === country && themedStyles.countryDropdownItemActive
                                ]}
                                onPress={() => handleSelect(country)}
                            >
                                <Text style={[
                                    themedStyles.countryDropdownItemText,
                                    selectedCountry === country && themedStyles.countryDropdownItemTextActive
                                ]}>
                                    {getNationFlag(country)} {country}
                                </Text>
                                {selectedCountry === country && (
                                    <Ionicons name="checkmark" size={16} color={colors.accent} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

export const RaceModal = ({ race, details, visible, onClose, loading, onRefresh, refreshing = false }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);

    if (!race) return null;

    const raceInfo = details?.info || race;
    const competition = details?.competition || null;
    const results = Array.isArray(details?.results) ? details.results : null;
    const startList = Array.isArray(details?.startList) ? details.startList : null;
    const hasResults = Boolean(results?.length);
    const hasStartList = Boolean(startList?.length);
    const allResultRows = hasResults ? results : (hasStartList ? startList : []);
    const isLiveRace = raceInfo?.state === 'live' || raceInfo?.state === 'ongoing';
    const isRelay = isRelayRace(raceInfo?.discipline);
    const isStartingSoon = raceInfo?.state === 'starting-soon';
    const isUpcomingRace = raceInfo?.state === 'upcoming' || raceInfo?.state === 'pre-race';

    // State for expanded rows
    const [expandedRows, setExpandedRows] = React.useState(new Set());

    // State for country filter
    const [selectedCountry, setSelectedCountry] = React.useState(null);

    // Extract unique countries from results
    const availableCountries = React.useMemo(() => {
        const countries = new Set();
        allResultRows.forEach(item => {
            const nation = item?.Nat || item?.Nation || item?.Country;
            if (nation) {
                countries.add(nation);
            }
        });
        return Array.from(countries).sort();
    }, [allResultRows]);

    // Filter results by selected country
    const resultRows = React.useMemo(() => {
        if (!selectedCountry) {
            return allResultRows;
        }
        return allResultRows.filter(item => {
            const nation = item?.Nat || item?.Nation || item?.Country;
            return nation === selectedCountry;
        });
    }, [allResultRows, selectedCountry]);

    // Group by nation for relay races
    const relayTeams = React.useMemo(() => {
        if (!isRelay) {
            return null;
        }
        const dataToGroup = selectedCountry ? resultRows : allResultRows;
        return groupByNation(dataToGroup);
    }, [isRelay, allResultRows, resultRows, selectedCountry]);

    // Reset country filter when race changes
    React.useEffect(() => {
        setSelectedCountry(null);
    }, [race?.raceId]);

    const toggleRow = React.useCallback((index) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    }, []);

    // Reset expanded rows when results change
    React.useEffect(() => {
        setExpandedRows(new Set());
    }, [results, startList]);

    const getStatusLabel = () => {
        if (competition?.StatusText) {
            return competition.StatusText;
        }
        if (raceInfo?.statusText) {
            return raceInfo.statusText;
        }
        if (isLiveRace) {
            return 'Live';
        }
        if (isStartingSoon) {
            return 'Starting Soon';
        }
        if (isUpcomingRace) {
            return 'Upcoming';
        }
        return 'Completed';
    };
    const statusLabel = getStatusLabel();
    const resultTitle = hasResults ? 'Results' : (hasStartList ? 'Start list' : 'Results');

    // Race format info
    const shootingsCount = competition?.NrShootings || raceInfo?.shootings;
    const km = competition?.km || raceInfo?.km;

    let infoNoteText = 'Official results will appear here once published.';
    if (hasResults) {
        const shootingNote = shootingsCount
            ? `This race has ${shootingsCount} shooting stages (5 targets each).`
            : '';
        infoNoteText = shootingNote || 'Official results are available below. Tap a row to see shooting details.';
    } else if (hasStartList) {
        infoNoteText = 'Start list loaded for this race.';
    } else if (isLiveRace) {
        infoNoteText = 'Live results will appear here during the race.';
    } else if (isStartingSoon) {
        infoNoteText = 'Race is about to begin. Live results will appear shortly.';
    } else if (isUpcomingRace) {
        infoNoteText = 'Start lists and results will be available closer to race time.';
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={themedStyles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                <>
                    <View style={themedStyles.raceModalHeader}>
                        <TouchableOpacity onPress={onClose} style={themedStyles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={themedStyles.raceModalTitleContainer}>
                            <Text style={themedStyles.raceModalEventName}>{raceInfo.eventName}</Text>
                            <Text style={themedStyles.raceModalLocation}>
                                {getNationFlag(raceInfo.country)} {raceInfo.location}, {raceInfo.countryName}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={themedStyles.raceModalContent}
                        refreshControl={
                            onRefresh ? (
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                            ) : undefined
                        }
                    >
                        <View style={themedStyles.raceDetailCard}>
                            <View style={themedStyles.raceDetailHeader}>
                                <View style={themedStyles.disciplineContainer}>
                                    <Text style={themedStyles.raceDetailDiscipline}>{raceInfo.discipline}</Text>
                                    {km && (
                                        <Text style={themedStyles.distanceText}>{km} km</Text>
                                    )}
                                </View>
                                <View style={[themedStyles.genderBadgeLarge, {
                                    backgroundColor: GENDER_COLORS[raceInfo.gender] || colors.textMuted
                                }]}>
                                    <Text style={themedStyles.genderBadgeTextLarge}>{raceInfo.genderDisplay}</Text>
                                </View>
                            </View>

                            <View style={themedStyles.raceDetailRow}>
                                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                                <Text style={themedStyles.raceDetailLabel}>Date</Text>
                                <Text style={themedStyles.raceDetailValue}>
                                    {formatSwedishDate(raceInfo?.startDateTime, 'd MMMM yyyy')}
                                </Text>
                            </View>

                            <View style={themedStyles.raceDetailRow}>
                                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                                <Text style={themedStyles.raceDetailLabel}>Start Time</Text>
                                <Text style={themedStyles.raceDetailValue}>
                                    {formatSwedishDate(raceInfo?.startDateTime, 'HH:mm')} CET
                                </Text>
                            </View>

                            {shootingsCount && (
                                <View style={themedStyles.raceDetailRow}>
                                    <Ionicons name="ellipse" size={20} color={colors.textSecondary} />
                                    <Text style={themedStyles.raceDetailLabel}>Shooting Stages</Text>
                                    <Text style={themedStyles.raceDetailValue}>
                                        {shootingsCount} × 5 targets
                                    </Text>
                                </View>
                            )}

                            <View style={themedStyles.raceDetailRow}>
                                <Ionicons name="trophy-outline" size={20} color={colors.textSecondary} />
                                <Text style={themedStyles.raceDetailLabel}>Competition</Text>
                                <Text style={themedStyles.raceDetailValue}>
                                    {raceInfo.eventType === 'olympics' ? 'Winter Olympics 2026' : 'IBU World Cup 2025/26'}
                                </Text>
                            </View>

                            <View style={[themedStyles.raceDetailRow, themedStyles.raceDetailRowLast]}>
                                <Ionicons name="pulse-outline" size={20} color={colors.textSecondary} />
                                <Text style={themedStyles.raceDetailLabel}>Status</Text>
                                <View style={[themedStyles.statusBadge, {
                                    backgroundColor: isLiveRace ? colors.accentRed : isStartingSoon ? colors.accentOrange : isUpcomingRace ? colors.accentGreen : colors.textMuted
                                }]}>
                                    <Text style={themedStyles.statusBadgeText}>
                                        {statusLabel}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={themedStyles.resultsCard}>
                            <View style={themedStyles.resultsHeaderRow}>
                                <Text style={themedStyles.resultsTitle}>{resultTitle}</Text>
                                {details?.lastUpdated && (
                                    <Text style={themedStyles.resultsUpdated}>Updated {details.lastUpdated}</Text>
                                )}
                            </View>

                            {/* Country filter dropdown */}
                            {!loading && availableCountries.length > 1 && (
                                <CountryFilterDropdown
                                    countries={availableCountries}
                                    selectedCountry={selectedCountry}
                                    onSelectCountry={setSelectedCountry}
                                    colors={colors}
                                    themedStyles={themedStyles}
                                />
                            )}

                            {loading ? (
                                <View style={themedStyles.resultsLoading}>
                                    <ActivityIndicator size="small" color={colors.accent} />
                                    <Text style={themedStyles.resultsLoadingText}>Loading results...</Text>
                                </View>
                            ) : isRelay && relayTeams && relayTeams.length > 0 ? (
                                relayTeams.map((team, teamIndex) => (
                                    <RelayTeamRow
                                        key={team.nation}
                                        team={team}
                                        teamIndex={teamIndex}
                                        hasResults={hasResults}
                                        expandedRows={expandedRows}
                                        onToggle={toggleRow}
                                        isRaceCompleted={!isLiveRace && !isStartingSoon && !isUpcomingRace}
                                        discipline={raceInfo.discipline}
                                        colors={colors}
                                        themedStyles={themedStyles}
                                    />
                                ))
                            ) : resultRows.length > 0 ? (
                                resultRows.map((item, index) => {
                                    const rowKey = item?.IBUId || item?.Name || item?.Bib || item?.StartOrder || index;
                                    // Use original index for expansion state to maintain consistency
                                    const originalIndex = allResultRows.indexOf(item);
                                    return (
                                        <ResultRow
                                            key={String(rowKey)}
                                            item={item}
                                            index={index}
                                            hasResults={hasResults}
                                            isExpanded={expandedRows.has(originalIndex)}
                                            onToggle={() => toggleRow(originalIndex)}
                                            isRaceCompleted={!isLiveRace && !isStartingSoon && !isUpcomingRace}
                                            discipline={raceInfo.discipline}
                                            colors={colors}
                                            themedStyles={themedStyles}
                                        />
                                    );
                                })
                            ) : selectedCountry ? (
                                <Text style={themedStyles.emptyText}>No athletes from {getNationFlag(selectedCountry)} {selectedCountry} in this race.</Text>
                            ) : (
                                <Text style={themedStyles.emptyText}>Results are not available yet.</Text>
                            )}
                        </View>

                        {/* Shooting legend for races with results */}
                        {hasResults && shootingsCount && (
                            <View style={themedStyles.shootingLegend}>
                                <Text style={themedStyles.legendTitle}>🎯 Shooting Legend</Text>
                                <View style={themedStyles.legendRow}>
                                    <View style={themedStyles.legendItem}>
                                        <View style={[themedStyles.legendDot, themedStyles.legendDotHit]} />
                                        <Text style={themedStyles.legendText}>Hit</Text>
                                    </View>
                                    <View style={themedStyles.legendItem}>
                                        <View style={[themedStyles.legendDot, themedStyles.legendDotMiss]} />
                                        <Text style={themedStyles.legendText}>Miss (+penalty)</Text>
                                    </View>
                                </View>
                                <Text style={themedStyles.legendNote}>
                                    P = Prone • S = Standing • Tap row to see details
                                </Text>
                            </View>
                        )}

                        <View style={themedStyles.raceInfoNote}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                            <Text style={themedStyles.raceInfoNoteText}>
                                {infoNoteText}
                            </Text>
                        </View>
                    </ScrollView>
                </>
            </SafeAreaView>
        </Modal>
    );
};

// Need React for useState and useEffect
import React from 'react';

const createStyles = (colors) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    raceModalHeader: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder
    },
    raceModalTitleContainer: {
        paddingTop: 10
    },
    raceModalEventName: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 6
    },
    raceModalLocation: {
        color: colors.textSecondary,
        fontSize: 15
    },
    raceModalContent: {
        flex: 1,
        padding: 16
    },
    raceDetailCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20
    },
    raceDetailHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24
    },
    disciplineContainer: {
        flex: 1,
        gap: 4
    },
    raceDetailDiscipline: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '800'
    },
    distanceText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600'
    },
    genderBadgeLarge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8
    },
    genderBadgeTextLarge: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700'
    },
    raceDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator
    },
    raceDetailRowLast: {
        borderBottomWidth: 0
    },
    raceDetailLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        flex: 1
    },
    raceDetailValue: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
    },
    // Shooting legend (shown at bottom of results)
    shootingLegend: {
        marginTop: 20,
        padding: 16,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.separator
    },
    legendTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 10
    },
    legendRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 8
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1.5
    },
    legendDotHit: {
        backgroundColor: colors.accentGreen,
        borderColor: colors.accentGreen
    },
    legendDotMiss: {
        backgroundColor: 'transparent',
        borderColor: colors.accentRed
    },
    legendText: {
        color: colors.textSecondary,
        fontSize: 12
    },
    legendNote: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 4
    },
    raceInfoNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        marginBottom: 40,
        padding: 16,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12
    },
    raceInfoNoteText: {
        color: colors.textMuted,
        fontSize: 13,
        flex: 1
    },
    resultsCard: {
        marginTop: 20,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16
    },
    resultsHeaderRow: {
        marginBottom: 12
    },
    resultsTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700'
    },
    resultsUpdated: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 4
    },
    // Country filter dropdown styles
    countryDropdownContainer: {
        marginBottom: 12,
        zIndex: 10
    },
    countryDropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.chip,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.chipBorder
    },
    countryDropdownButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    countryDropdownButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '500'
    },
    countryDropdownList: {
        marginTop: 4,
        backgroundColor: colors.chip,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.chipBorder,
        overflow: 'hidden'
    },
    countryDropdownScroll: {
        maxHeight: 200
    },
    countryDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.chipBorder
    },
    countryDropdownItemActive: {
        backgroundColor: colors.chipActive
    },
    countryDropdownItemText: {
        color: colors.textSecondary,
        fontSize: 14
    },
    countryDropdownItemTextActive: {
        color: colors.text,
        fontWeight: '600'
    },
    resultsLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12
    },
    resultsLoadingText: {
        color: colors.textSecondary,
        fontSize: 13
    },
    // Result rows
    resultRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator
    },
    resultRowHighlight: {
        backgroundColor: 'rgba(255, 215, 0, 0.05)',
        marginHorizontal: -8,
        paddingHorizontal: 8,
        borderRadius: 8
    },
    resultRankContainer: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center'
    },
    resultRank: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '700'
    },
    medalEmoji: {
        fontSize: 18
    },
    resultMain: {
        flex: 1,
        gap: 4
    },
    resultNameRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    resultName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        flex: 1
    },
    resultNameHighlight: {
        fontWeight: '700'
    },
    resultMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10
    },
    resultNation: {
        color: colors.textSecondary,
        fontSize: 12
    },
    startInfoText: {
        color: colors.textMuted,
        fontSize: 12
    },
    expandedShooting: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.separator
    },
    resultValueContainer: {
        alignItems: 'flex-end',
        gap: 2
    },
    resultValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600'
    },
    resultValueHighlight: {
        fontSize: 14,
        fontWeight: '700'
    },
    expandIcon: {
        marginTop: 2
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 13,
        paddingVertical: 8
    },
    // Relay team styles
    relayTeamContainer: {
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        paddingVertical: 12
    },
    relayTeamHighlight: {
        backgroundColor: 'rgba(255, 215, 0, 0.05)',
        marginHorizontal: -8,
        paddingHorizontal: 8,
        borderRadius: 8
    },
    relayTeamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8
    },
    relayTeamInfo: {
        flex: 1,
        gap: 4
    },
    relayTeamNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    relayTeamName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700'
    },
    relayTeamBib: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600'
    },
    relayTeamStartInfo: {
        color: colors.textSecondary,
        fontSize: 12
    },
    relayTeamResult: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: '600'
    },
    relayTeamBehind: {
        color: colors.textSecondary,
        fontSize: 13
    },
    relayAthletesList: {
        marginLeft: 44,
        borderLeftWidth: 2,
        borderLeftColor: colors.cardBorder,
        paddingLeft: 12
    },
    relayAthleteRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 8
    },
    relayLegBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.chip,
        alignItems: 'center',
        justifyContent: 'center'
    },
    relayLegText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700'
    },
    relayAthleteMain: {
        flex: 1,
        gap: 4
    },
    relayAthleteName: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500'
    },
    relayAthleteRight: {
        alignItems: 'flex-end',
        gap: 2
    },
    relayAthleteTime: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '500'
    }
});
