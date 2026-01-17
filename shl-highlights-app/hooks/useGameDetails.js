import { useMemo } from 'react';
import { normalizeScoreValue } from '../utils';

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
        let actualScore = { home: null, away: null };

        const statsArray = gameDetails.teamStats?.stats || [];
        statsArray.forEach(stat => {
            const key = stat.homeTeam?.sideTranslateKey || stat.awayTeam?.sideTranslateKey;
            if (key === 'G') {
                actualScore.home = stat.homeTeam?.left?.value;
                actualScore.away = stat.awayTeam?.left?.value;
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

        const detailHomeScore = normalizeScoreValue(gameDetails.info?.homeTeam?.score);
        const detailAwayScore = normalizeScoreValue(gameDetails.info?.awayTeam?.score);
        const fallbackHomeScore = normalizeScoreValue(selectedGame.homeTeamResult?.score) ?? normalizeScoreValue(selectedGame.homeTeamInfo?.score);
        const fallbackAwayScore = normalizeScoreValue(selectedGame.awayTeamResult?.score) ?? normalizeScoreValue(selectedGame.awayTeamInfo?.score);
        const scoreDisplay = {
            home: actualScore.home ?? detailHomeScore ?? fallbackHomeScore ?? '-',
            away: actualScore.away ?? detailAwayScore ?? fallbackAwayScore ?? '-'
        };

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
            .sort((a, b) => b.period - a.period || (b.time > a.time ? 1 : -1));

        sortedEvents.forEach(event => {
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
        goals: gameDetails?.events?.goals || []
    };
}
