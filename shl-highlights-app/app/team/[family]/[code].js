import { useLocalSearchParams } from 'expo-router';
import { TeamGamesScreen } from '../../../components/TeamGamesScreen';
import { getTeamFamilyForSport } from '../../../constants/teamFamilies';

const normalizeParam = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * Team page route: /team/<family-or-sport-slug>/<teamCode>
 *
 * `family` accepts either a family key ('hockey' | 'football') or any league
 * slug within it ('shl', 'allsvenskan', 'conference-league-qual', …) so callers
 * (standings tables, match modals) can pass whatever sport slug they already
 * hold without translating it first.
 */
export default function TeamRoute() {
    const { family: familyParam, code } = useLocalSearchParams();
    const family = getTeamFamilyForSport(normalizeParam(familyParam));
    const teamCode = normalizeParam(code);

    return <TeamGamesScreen family={family} teamCode={teamCode} />;
}
