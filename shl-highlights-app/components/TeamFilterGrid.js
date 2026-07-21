import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Diacritic-insensitive, case-insensitive normalization.
// "brynas" -> matches "Brynäs"; "aik" -> matches "AIK".
const normalize = (str) =>
    (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

/**
 * Reusable team picker with free-text search + multi-select league facet chips.
 *
 * Filter combination (per team-filtering-spec.md §5):
 *   - search AND league
 *   - OR within the league facet (a team matches if it's in ANY selected league)
 *   - no leagues selected == "All" (no league constraint)
 *
 * The ACTION of favoriting is unchanged — the parent supplies renderChip and
 * owns selection state; this component only decides which teams are rendered.
 *
 * Props:
 *   teams          array of team objects, each optionally carrying `leagues: []`
 *   selectedKeys   array of currently-selected ids
 *   getKey         (team) => id used for selection membership
 *   getSearchText  (team) => string searched against the query
 *   leagueOptions  [{ id, label }] candidate facet chips (only shown if they
 *                  actually have teams; counts are computed live)
 *   renderChip     (team, isSelected) => node for a single team chip
 *   accentColor    color for the active facet chip + "Clear filters" link
 *   placeholder    search box placeholder
 *   colors, isDark theme
 *   gridStyle      style applied to the chip grid container
 */
export const TeamFilterGrid = ({
    teams = [],
    selectedKeys = [],
    getKey,
    getSearchText,
    leagueOptions = [],
    renderChip,
    accentColor,
    placeholder = 'Search teams',
    colors,
    isDark,
    gridStyle
}) => {
    const [query, setQuery] = useState('');
    const [activeLeagues, setActiveLeagues] = useState([]);
    const s = getStyles(colors, isDark, accentColor);

    const nq = normalize(query.trim());

    // Only surface facet chips for leagues that actually have teams, with counts.
    const availableLeagues = useMemo(() => {
        return leagueOptions
            .map((opt) => ({
                ...opt,
                count: teams.filter((t) => (t.leagues || []).includes(opt.id)).length
            }))
            .filter((opt) => opt.count > 0);
    }, [leagueOptions, teams]);

    const filtered = useMemo(() => {
        return teams.filter((team) => {
            if (nq && !normalize(getSearchText(team)).includes(nq)) {
                return false;
            }
            if (activeLeagues.length > 0) {
                const tl = team.leagues || [];
                if (!activeLeagues.some((l) => tl.includes(l))) {
                    return false;
                }
            }
            return true;
        });
    }, [teams, nq, activeLeagues, getSearchText]);

    const toggleLeague = (id) => {
        setActiveLeagues((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const clearFilters = () => {
        setQuery('');
        setActiveLeagues([]);
    };

    // Facet only makes sense when there's more than one league to choose between.
    const showFacet = availableLeagues.length > 1;

    return (
        <View>
            {/* Search box */}
            <View style={s.searchBox}>
                <Ionicons name="search" size={16} color={colors.textMuted} style={s.searchIcon} />
                <TextInput
                    style={s.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="never"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* League facet chips */}
            {showFacet && (
                <View style={s.facetRow}>
                    <TouchableOpacity
                        style={[s.facetChip, activeLeagues.length === 0 && s.facetChipActive]}
                        onPress={() => setActiveLeagues([])}
                    >
                        <Text style={[s.facetText, activeLeagues.length === 0 && s.facetTextActive]}>All</Text>
                    </TouchableOpacity>
                    {availableLeagues.map((opt) => {
                        const active = activeLeagues.includes(opt.id);
                        return (
                            <TouchableOpacity
                                key={opt.id}
                                style={[s.facetChip, active && s.facetChipActive]}
                                onPress={() => toggleLeague(opt.id)}
                            >
                                <Text style={[s.facetText, active && s.facetTextActive]}>
                                    {opt.label} ({opt.count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Team grid, or empty state */}
            {filtered.length > 0 ? (
                <View style={gridStyle}>
                    {filtered.map((team) => renderChip(team, selectedKeys.includes(getKey(team))))}
                </View>
            ) : (
                <View style={s.emptyWrap}>
                    <Text style={s.emptyText}>
                        {nq ? `No teams match \u201C${query.trim()}\u201D` : 'No teams match your filters'}
                    </Text>
                    <TouchableOpacity onPress={clearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.clearFiltersText}>Clear filters</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const getStyles = (colors, isDark, accentColor) =>
    StyleSheet.create({
        searchBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.chip,
            borderWidth: 1,
            borderColor: colors.chipBorder,
            marginBottom: 12
        },
        searchIcon: {
            marginRight: 0
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontSize: 14,
            padding: 0,
            margin: 0
        },
        facetRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14
        },
        facetChip: {
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: colors.chip,
            borderWidth: 1,
            borderColor: colors.chipBorder
        },
        facetChipActive: {
            backgroundColor: isDark ? 'rgba(108, 92, 231, 0.2)' : 'rgba(108, 92, 231, 0.12)',
            borderColor: accentColor || colors.accent
        },
        facetText: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '600'
        },
        facetTextActive: {
            color: accentColor || colors.accent
        },
        emptyWrap: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 24,
            gap: 8
        },
        emptyText: {
            color: colors.textMuted,
            fontSize: 13,
            textAlign: 'center'
        },
        clearFiltersText: {
            color: accentColor || colors.accent,
            fontSize: 13,
            fontWeight: '600'
        }
    });
