import { useMemo } from 'react';
import { resolveDisplayScore } from '../utils/gameScore';

const parseHockeyEventTime = (time) => {
    if (!time) return Number.POSITIVE_INFINITY;

    const [minutes, seconds] = String(time).split(':').map(Number);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
        return Number.POSITIVE_INFINITY;
    }
    return (minutes * 60) + seconds;
};

const compareHockeyEventTimes = (a, b) => parseHockeyEventTime(a) - parseHockeyEventTime(b);

const compareHockeyEventsChronologically = (a, b) => (
    (a.period || 0) - (b.period || 0) || compareHockeyEventTimes(a.time, b.time)
);

/**
 * Hook for processing SHL game details into a usable format
 * Extracts stats, score, and interesting events from game details
 */
export function useGameDetails(gameDetails, selectedGame, videos = []) {
    const processedData = useMemo(() => {
        if (!gameDetails || !selectedGame) return null;

        let sog = { home: 0, away: 0 };
        let pp = { home: '-', away: '-' };
        let pim = { home: 0, away: 0 };
        // The team-stats 'G' row. Carries the shots-on-goal totals alongside the
        // score, which is why it is read here at all — but it is a POST-game
        // endpoint and its score lags while the game is in progress, so it is
        // only a fallback for the header. See utils/gameScore.js.
        let statsScore = { home: null, away: null };

        const statsArray = gameDetails.teamStats?.stats || [];
        statsArray.forEach(stat => {
            const key = stat.homeTeam?.sideTranslateKey || stat.awayTeam?.sideTranslateKey;
            if (key === 'G') {
                statsScore.home = stat.homeTeam?.left?.value;
                statsScore.away = stat.awayTeam?.left?.value;
                sog.home = stat.homeTeam?.right?.value;
                sog.away = stat.awayTeam?.right?.value;
            } else if (key === 'PPG') {
                pp.home = stat.homeTeam?.center?.value !== undefined ? `${stat.homeTeam.center.value}%` : '-';
                pp.away = stat.awayTeam?.center?.value !== undefined ? `${stat.awayTeam.center.value}%` : '-';
            } else if (key === 'PIM') {
                pim.home = stat.homeTeam?.center?.value ?? 0;
                pim.away = stat.awayTeam?.center?.value ?? 0;
            }
        });

        // While a game is live the header is driven by the SAME goal events the
        // list below it renders, so the two cannot disagree — the bug this
        // replaces had the header a goal behind its own events list, because it
        // preferred the lagging team-stats score. See utils/gameScore.js.
        const scoreDisplay = resolveDisplayScore({
            goals: gameDetails.events?.goals,
            detailScore: {
                home: gameDetails.info?.homeTeam?.score,
                away: gameDetails.info?.awayTeam?.score
            },
            statsScore,
            listingScore: {
                home: selectedGame.homeTeamResult?.score ?? selectedGame.homeTeamInfo?.score,
                away: selectedGame.awayTeamResult?.score ?? selectedGame.awayTeamInfo?.score
            },
            isPostGame: selectedGame.state === 'post-game'
        });

        const interestingEvents = [];
        let currentPeriod = -1;
        const allEvents = gameDetails.events?.all || [];
        const sortedEvents = [...allEvents]
            .filter(e => {
                if (e.type === 'goal' || e.type === 'penalty' || e.type === 'timeout') return true;
                if (e.type === 'goalkeeper') {
                    if (e.isEntering && e.period === 1 && e.time === '00:00') return false;
                    if (!e.isEntering && e.gameState === 'GameEnded') return false;
                    return true;
                }
                return false;
            })
            .sort((a, b) => a.period - b.period || compareHockeyEventTimes(a.time, b.time));

        // Display newest-first: iterate reversed so the most recent period (and
        // its newest event) appears at the top, each period marker still above its group.
        [...sortedEvents].reverse().forEach(event => {
            if (event.period !== currentPeriod) {
                currentPeriod = event.period;
                interestingEvents.push({ type: 'period_marker', period: currentPeriod });
            }
            interestingEvents.push(event);
        });

        return { sog, pp, pim, scoreDisplay, events: interestingEvents };
    }, [gameDetails, selectedGame]);

    // Helper to find video for a goal
    const getGoalVideoId = useMemo(() => {
        return (goal) => {
            const homeGoals = goal.homeGoals;
            const awayGoals = goal.awayGoals;
            if (homeGoals === undefined || awayGoals === undefined) return null;

            const scoreTag = `goal.${homeGoals}-${awayGoals}`;
            const matchingVideo = videos.find(v => v.tags?.includes(scoreTag));
            if (matchingVideo) return matchingVideo.id;

            const playerLast = goal.player?.familyName || goal.player?.lastName || '';
            const ln = typeof playerLast === 'string' ? playerLast.toLowerCase() : (playerLast?.value || '').toLowerCase();
            if (ln.length > 2) {
                const titleMatch = videos.find(v => v.title?.toLowerCase()?.includes(ln));
                if (titleMatch) return titleMatch.id;
            }
            return null;
        };
    }, [videos]);

    return {
        processedData,
        getGoalVideoId,
        stats: processedData ? {
            sog: processedData.sog,
            pp: processedData.pp,
            pim: processedData.pim
        } : null,
        scoreDisplay: processedData?.scoreDisplay || { home: '-', away: '-' },
        events: processedData?.events || [],
        goals: [...(gameDetails?.events?.goals || [])].sort(compareHockeyEventsChronologically).reverse()
    };
}
