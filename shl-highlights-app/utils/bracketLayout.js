// Pure geometry + feeder logic for the qualifying-bracket screen. No react-native
// imports, so it runs under `node --test`. LeagueBracketScreen imports these.
//
// UEFA qualifying is NOT a clean binary tree — it GROWS then shrinks (26 → 49 →
// 30 ties) because most entrants are SEEDED straight in, not fed by a prior tie.
// The layout therefore: (1) reconstructs missing/corrupt feeder links from the
// placeholder team names, (2) reorders ties within each round to sit beside their
// feeders (barycenter crossing reduction), (3) anchors the biggest round as a
// spine and aligns the others outward at their feeder's height (weighted PAV),
// maximising clean horizontal connectors.

export const CARD_HEIGHT = 94;
export const CARD_GAP = 18;

export const rawFeeders = (tie) => {
    const explicit = tie?.feederTieKeys || [];
    const resolved = (tie?.teams || []).map((team) => team.fromTieKey).filter(Boolean);
    return [...new Set([...explicit, ...resolved])];
};

// ---- FEEDER RECONSTRUCTION -------------------------------------------------
// The backend under-populates (and sometimes corrupts) feeder links: it can emit
// one previous-round tie as the feeder of MANY not-yet-decided ties (seen: R2
// "Levadia/Göteborg" tagged as feeder of 8 different R3 ties). But the
// placeholder team NAMES carry the real answer — an undecided slot reads
// "Winner: <TeamA> / <TeamB>", which literally names the previous-round tie it
// comes from. We match "<TeamA> / <TeamB>" back to that tie by fuzzy team-name
// comparison and synthesise the missing feeder link, recovering ~40 of ~50 R3
// links vs the ~13 the backend supplies. "Loser: …" placeholders are teams
// dropping in from Champions/Europa-League qualifying — NOT in this bracket — so
// they stay unlinked (correct).
const FEEDER_ALIAS = { varteks: 'varazdin', vreykjavik: 'valur', hbtorshavn: 'hb', paksise: 'paks', neftchi: 'neftci', austriawien: 'vienna' };
const feederTokenSet = (name) => new Set(String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !['fc', 'fk', 'the', 'club', 'city', 'sport'].includes(w))
    .map((w) => FEEDER_ALIAS[w] || w));
const feederTeamMatch = (a, b) => {
    const A = feederTokenSet(a);
    const B = feederTokenSet(b);
    if (!A.size || !B.size) { return false; }
    for (const x of A) {
        if (B.has(x)) { return true; }
        // Prefix match for name variants the alias map doesn't cover, e.g. the
        // Wikipedia draw's "Paks" vs ESPN's "Paksi (SE)". Require the shorter
        // token be ≥4 chars and a prefix of the longer, so short/ambiguous
        // tokens ("aek", "inter") can't cause a false link.
        for (const y of B) {
            const lo = x.length < y.length ? x : y;
            const hi = x.length < y.length ? y : x;
            if (lo.length >= 4 && hi.startsWith(lo)) { return true; }
        }
    }
    return false;
};
const reconstructFeeders = (rounds) => rounds.map((round, ri) => {
    if (ri === 0) { return round; }
    const prev = (rounds[ri - 1].ties || []).map((t) => ({ key: t.key, names: (t.teams || []).map((x) => x.name) }));
    const findPrev = (p1, p2) => {
        for (const t of prev) {
            const [n1, n2] = t.names;
            if ((feederTeamMatch(p1, n1) && feederTeamMatch(p2, n2)) || (feederTeamMatch(p1, n2) && feederTeamMatch(p2, n1))) {
                return t.key;
            }
        }
        return null;
    };
    return {
        ...round,
        ties: (round.ties || []).map((tie) => {
            // RELIABLE feeders: per-team fromTieKey (a real advancement) + links
            // derived from "Winner: A / B" placeholder names. These are trustworthy.
            // The tie-level feederTieKeys array is the source that gets corrupted
            // (one tie listed as feeder of many), so only fall back to it when we
            // can't derive anything reliable.
            const reliable = new Set((tie.teams || []).map((x) => x.fromTieKey).filter(Boolean));
            (tie.teams || []).forEach((tm) => {
                const m = String(tm.name || '').match(/^Winner:\s*(.+?)\s*\/\s*(.+)$/);
                if (m) { const k = findPrev(m[1], m[2]); if (k) { reliable.add(k); } }
            });
            const recon = reliable.size ? [...reliable] : rawFeeders(tie);
            return { ...tie, _recon: recon };
        })
    };
});

// After reconstruction, a feeder key shared by >1 tie in the same round is still
// impossible (a tie advances to ONE slot) — drop it from all of them so nothing
// piles onto one row.
const dedupFeeders = (rounds) => rounds.map((round) => {
    const src = (t) => t._recon || rawFeeders(t);
    const cnt = new Map();
    (round.ties || []).forEach((t) => src(t).forEach((k) => cnt.set(k, (cnt.get(k) || 0) + 1)));
    return { ...round, ties: (round.ties || []).map((t) => ({ ...t, _feeders: src(t).filter((k) => cnt.get(k) === 1) })) };
});
export const prepFeeders = (rounds) => dedupFeeders(reconstructFeeders(rounds));
export const tieFeeders = (tie) => tie._feeders || rawFeeders(tie);

// Weighted pool-adjacent-violators: least-squares fit of d[] by a non-decreasing
// sequence, where high-weight entries stay close to their desired value and
// low-weight ones absorb the slack. Used to pin fed ties to their feeder height
// (heavy) while seeded gap-fillers (light) take the displacement.
export const isotonicNonDecreasing = (d, w) => {
    const weights = w || d.map(() => 1);
    const val = [];
    const wt = [];
    const cnt = [];
    for (let i = 0; i < d.length; i += 1) {
        let v = d[i];
        let ww = weights[i];
        let c = 1;
        while (val.length && val[val.length - 1] > v) {
            const pv = val.pop();
            const pw = wt.pop();
            const pc = cnt.pop();
            v = (v * ww + pv * pw) / (ww + pw);
            ww += pw;
            c += pc;
        }
        val.push(v); wt.push(ww); cnt.push(c);
    }
    const out = [];
    for (let k = 0; k < val.length; k += 1) { for (let j = 0; j < cnt[k]; j += 1) { out.push(val[k]); } }
    return out;
};

// Draw order is irrelevant, so REORDER ties within each round to sit next to
// their feeders — classic layered-graph barycenter crossing reduction. Repeated
// down/up sweeps order each round by the average position of its feeders (prev
// round) and successors (next round). This drove connector crossings 220 → 0 on
// live Conference-Qual data.
export const reorderByBarycenter = (rounds) => {
    const layers = rounds.map((r) => (r.ties || []).slice());
    const ITER = 8;
    for (let it = 0; it < ITER; it += 1) {
        for (let li = 1; li < layers.length; li += 1) {
            const prevIdx = new Map();
            layers[li - 1].forEach((t, idx) => { if (!prevIdx.has(t.key)) { prevIdx.set(t.key, idx); } });
            layers[li] = layers[li].map((t, idx) => {
                const ps = tieFeeders(t).map((k) => prevIdx.get(k)).filter((v) => v != null);
                return { t, idx, bc: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : idx };
            }).sort((a, b) => (a.bc - b.bc) || (a.idx - b.idx)).map((x) => x.t);
        }
        for (let li = layers.length - 2; li >= 0; li -= 1) {
            const succ = new Map();
            layers[li + 1].forEach((t, idx) => tieFeeders(t).forEach((k) => { if (!succ.has(k)) { succ.set(k, []); } succ.get(k).push(idx); }));
            layers[li] = layers[li].map((t, idx) => {
                const ss = succ.get(t.key) || [];
                return { t, idx, bc: ss.length ? ss.reduce((a, b) => a + b, 0) / ss.length : idx };
            }).sort((a, b) => (a.bc - b.bc) || (a.idx - b.idx)).map((x) => x.t);
        }
    }
    return rounds.map((r, ri) => ({ ...r, ties: layers[ri] }));
};

export const buildTraditionalBracketLayout = (roundsIn) => {
    const positions = new Map();
    const step = CARD_HEIGHT + CARD_GAP;
    const half = CARD_HEIGHT / 2;
    const rounds = reorderByBarycenter(prepFeeders(roundsIn || []));

    // Positions are keyed by a UNIQUE per-tie uid (round:index), NEVER by tie.key
    // — the live data reuses placeholder keys (e.g. `draw-q3-1`) across ties, so a
    // key-based Map collides and mislays those rounds.
    const uid = (ri, idx) => `${ri}:${idx}`;
    const center = new Map();
    const keyToUid = new Map();
    rounds.forEach((r, ri) => (r.ties || []).forEach((t, idx) => { if (!keyToUid.has(t.key)) { keyToUid.set(t.key, uid(ri, idx)); } }));

    // Place ONE round given a desired-y function (null => loose/seeded). Fed ties
    // are pinned heavy so their connector stays horizontal; seeded gap-fillers are
    // light and absorb the min-gap slack. Order preserved via weighted PAV.
    const place = (ri, desiredFn) => {
        const ties = rounds[ri].ties || [];
        const n = ties.length;
        const desired = ties.map((t, i) => desiredFn(t, i));
        const anch = [];
        for (let i = 0; i < n; i += 1) { if (desired[i] != null) { anch.push(i); } }
        const weight = desired.map((v) => (v != null ? 1000 : 1));
        if (!anch.length) {
            for (let i = 0; i < n; i += 1) { desired[i] = i * step + half; }
        } else {
            for (let i = 0; i < anch[0]; i += 1) { desired[i] = desired[anch[0]] - (anch[0] - i) * step; }
            const last = anch[anch.length - 1];
            for (let i = last + 1; i < n; i += 1) { desired[i] = desired[last] + (i - last) * step; }
            for (let a = 0; a < anch.length - 1; a += 1) {
                const lo = anch[a];
                const hi = anch[a + 1];
                const ylo = desired[lo];
                const yhi = desired[hi];
                for (let i = lo + 1; i < hi; i += 1) { desired[i] = ylo + (yhi - ylo) * ((i - lo) / (hi - lo)); }
            }
        }
        const dU = desired.map((v, i) => v - i * step);
        const u = isotonicNonDecreasing(dU, weight);
        for (let i = 0; i < n; i += 1) { center.set(uid(ri, i), u[i] + i * step); }
    };

    // SPINE = the biggest round (UEFA qual grows then shrinks: 26→49→30, so R2).
    // Stack it uniformly, then align every other round OUTWARD toward it: rounds
    // after the spine align to their feeders (previous round); rounds before it
    // align to their successors (next round). The spine has the most rows, so the
    // smaller neighbouring rounds have slack to sit level with their links →
    // maximises horizontal connectors instead of steep fan-outs.
    let spine = 0;
    rounds.forEach((r, i) => { if ((r.ties || []).length > (rounds[spine].ties || []).length) { spine = i; } });
    (rounds[spine]?.ties || []).forEach((t, idx) => center.set(uid(spine, idx), idx * step + half));
    for (let ri = spine + 1; ri < rounds.length; ri += 1) {
        place(ri, (t) => { const fs = tieFeeders(t).map((k) => center.get(keyToUid.get(k))).filter(Number.isFinite); return fs.length ? fs.reduce((a, b) => a + b, 0) / fs.length : null; });
    }
    for (let ri = spine - 1; ri >= 0; ri -= 1) {
        const childY = new Map();
        (rounds[ri + 1].ties || []).forEach((ct, ci) => tieFeeders(ct).forEach((k) => { if (!childY.has(k)) { childY.set(k, []); } childY.get(k).push(center.get(uid(ri + 1, ci))); }));
        place(ri, (t) => { const cs = (childY.get(t.key) || []).filter(Number.isFinite); return cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null; });
    }

    // Normalise so the canvas starts at 0 (one uniform shift preserves alignment).
    let gMin = Infinity;
    let gMax = -Infinity;
    for (const c of center.values()) { gMin = Math.min(gMin, c - half); gMax = Math.max(gMax, c + half); }
    if (!Number.isFinite(gMin)) { gMin = 0; gMax = step; }
    const globalHeight = gMax - gMin;
    const globalShift = -gMin;

    const roundLayouts = rounds.map((round, ri) => {
        const ties = (round.ties || []).map((tie, idx) => {
            const c = (center.get(uid(ri, idx)) || half) + globalShift;
            positions.set(tie.key, c);
            return { tie, uid: uid(ri, idx), top: c - half, center: c };
        });
        return { ...round, ties, height: globalHeight };
    });

    const height = Math.max(420, globalHeight);
    return { rounds: roundLayouts, positions, height };
};
