import { useLocalSearchParams } from 'expo-router';
import { LeagueBracketScreen } from '../../components/LeagueBracketScreen';
import { getLeagueBySlug } from '../../constants/teamFamilies';

const normalizeParam = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * Knockout bracket route: /bracket/<league-slug>?team=<code>
 *
 * `league` is a qualifying-league slug ('conference-league-qual' |
 * 'europa-league-qual'). Optional `team` highlights that team in the bracket.
 */
export default function BracketRoute() {
    const { league: leagueParam, team } = useLocalSearchParams();
    const slug = normalizeParam(leagueParam);
    const league = getLeagueBySlug(slug);

    return (
        <LeagueBracketScreen
            sport={slug}
            leagueLabel={league?.label}
            highlightTeamCode={normalizeParam(team)}
        />
    );
}
