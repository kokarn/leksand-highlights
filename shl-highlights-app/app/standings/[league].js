import { useLocalSearchParams } from 'expo-router';
import { LeagueStandingsScreen } from '../../components/LeagueStandingsScreen';
import { getLeagueBySlug, getTeamFamilyForSport } from '../../constants/teamFamilies';

const normalizeParam = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * League standings route: /standings/<league-slug>?team=<code>
 *
 * `league` is a league slug ('shl', 'allsvenskan', 'svenska-cupen', …). The
 * optional `team` query param highlights that team's row, and `name` carries
 * its club name so the highlight survives the standings feed's own codes.
 */
export default function StandingsRoute() {
    const { league: leagueParam, team, name } = useLocalSearchParams();
    const slug = normalizeParam(leagueParam);
    const league = getLeagueBySlug(slug);
    const family = getTeamFamilyForSport(slug);
    const highlightTeamCode = normalizeParam(team);

    return (
        <LeagueStandingsScreen
            league={league}
            family={family}
            highlightTeamCode={highlightTeamCode}
            highlightTeamName={normalizeParam(name)}
        />
    );
}
