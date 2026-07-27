{
    const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, Number(value) || 0));

    const sigmoid = value => 1 / (1 + Math.exp(-value));

    const logit = value => {
        const bounded = clamp(value, 0.000001, 0.999999);
        return Math.log(bounded / (1 - bounded));
    };

    const allocateExact = (total, weights) => {
        const target = Math.max(0, Math.round(Number(total) || 0));
        if(!Array.isArray(weights) || weights.length === 0) return [];
        let normalized = weights.map(weight => Math.max(0, Number(weight) || 0));
        let weightTotal = normalized.reduce((sum, weight) => sum + weight, 0);
        if(weightTotal <= 0) {
            normalized = normalized.map(() => 1);
            weightTotal = normalized.length;
        }
        const exact = normalized.map(weight => (target * weight) / weightTotal);
        const allocated = exact.map(Math.floor);
        let remainder = target - allocated.reduce((sum, value) => sum + value, 0);
        exact
            .map((value, index) => ({ index, fraction: value - allocated[index] }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
            .forEach(entry => {
                if(remainder <= 0) return;
                allocated[entry.index]++;
                remainder--;
            });
        return allocated;
    };

    const allocateCandidateExactly = (targetVotes, unitTotals, exactVotes) => {
        const target = Math.max(0, Math.round(Number(targetVotes) || 0));
        const allocated = exactVotes.map((value, index) =>
            Math.min(unitTotals[index], Math.max(0, Math.floor(value))));
        let difference = target - allocated.reduce((sum, value) => sum + value, 0);
        const additions = exactVotes
            .map((value, index) => ({
                index,
                fraction: value - Math.floor(value)
            }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
        const removals = additions.slice().reverse();
        while(difference > 0) {
            let changed = false;
            for(const entry of additions) {
                if(difference <= 0) break;
                if(allocated[entry.index] >= unitTotals[entry.index]) continue;
                allocated[entry.index]++;
                difference--;
                changed = true;
            }
            if(!changed) break;
        }
        while(difference < 0) {
            let changed = false;
            for(const entry of removals) {
                if(difference >= 0) break;
                if(allocated[entry.index] <= 0) continue;
                allocated[entry.index]--;
                difference++;
                changed = true;
            }
            if(!changed) break;
        }
        return allocated;
    };

    const deterministicUnitBias = key => {
        const text = String(key || "");
        let hash = 2166136261;
        for(let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (((hash >>> 0) % 2001) / 2000 - 0.5) * 0.08;
    };

    const buildRawShare = (unit, finalistA, finalistB) => {
        const candidates = Array.isArray(unit?.candidates) ? unit.candidates : [];
        const ideologyA = clamp(finalistA?.ideology, -2, 2);
        const ideologyB = clamp(finalistB?.ideology, -2, 2);
        let votesA = 0;
        let votesB = 0;
        let transferable = 0;
        candidates.forEach(candidate => {
            const votes = Math.max(0, Number(candidate?.votes) || 0);
            if(candidate.key === finalistA.key) {
                votesA += votes;
                return;
            }
            if(candidate.key === finalistB.key) {
                votesB += votes;
                return;
            }
            const ideology = clamp(candidate?.ideology, -2, 2);
            const distanceA = Math.abs(ideology - ideologyA);
            const distanceB = Math.abs(ideology - ideologyB);
            const transferA = sigmoid((distanceB - distanceA) * 2.15);
            votesA += votes * transferA;
            votesB += votes * (1 - transferA);
            transferable += votes;
        });
        const total = votesA + votesB;
        let share = total > 0 ? votesA / total : 0.5;
        const unitIdeology = Number(unit?.ideology);
        if(Number.isFinite(unitIdeology) && Math.abs(ideologyA - ideologyB) > 0.05) {
            const affinityA = Math.abs(unitIdeology - ideologyA);
            const affinityB = Math.abs(unitIdeology - ideologyB);
            share = sigmoid(logit(share) + ((affinityB - affinityA) * 0.18));
        }
        if(transferable <= 0 && total > 0) {
            share = sigmoid(logit(share) + deterministicUnitBias(unit?.key));
        }
        return clamp(share, 0.015, 0.985);
    };

    const buildRcvFinalResultsForUnits = ({
        units,
        finalistA,
        finalistB,
        finalVotesA,
        finalVotesB,
        getUnitIdeology = unit => unit?.ideology,
        getUnitTurnoutWeight = unit => unit?.turnoutWeight
    }) => {
        const safeUnits = Array.isArray(units) ? units : [];
        const targetA = Math.max(0, Math.round(Number(finalVotesA) || 0));
        const targetB = Math.max(0, Math.round(Number(finalVotesB) || 0));
        const finalTotal = targetA + targetB;
        if(safeUnits.length === 0 || finalTotal <= 0) return [];
        const totals = allocateExact(
            finalTotal,
            safeUnits.map(unit => Math.max(0, Number(getUnitTurnoutWeight(unit)) || 0))
        );
        const rawShares = safeUnits.map(unit => buildRawShare(
            {
                ...unit,
                ideology: getUnitIdeology(unit)
            },
            finalistA,
            finalistB
        ));
        let low = -18;
        let high = 18;
        for(let iteration = 0; iteration < 90; iteration++) {
            const offset = (low + high) / 2;
            const expectedA = totals.reduce((sum, total, index) =>
                sum + (total * sigmoid(logit(rawShares[index]) + offset)), 0);
            if(expectedA < targetA) low = offset;
            else high = offset;
        }
        const offset = (low + high) / 2;
        const exactA = totals.map((total, index) =>
            total * sigmoid(logit(rawShares[index]) + offset));
        const allocatedA = allocateCandidateExactly(targetA, totals, exactA);
        return safeUnits.map((unit, index) => ({
            ...unit,
            totalVotes: totals[index],
            votesA: allocatedA[index],
            votesB: totals[index] - allocatedA[index],
            shareA: totals[index] > 0 ? allocatedA[index] / totals[index] : 0,
            marginVotes: Math.abs((allocatedA[index] * 2) - totals[index]),
            marginPct: totals[index] > 0
                ? (Math.abs((allocatedA[index] * 2) - totals[index]) / totals[index]) * 100
                : 0,
            winnerKey: allocatedA[index] >= (totals[index] - allocatedA[index])
                ? finalistA.key
                : finalistB.key
        }));
    };

    const buildRcvPrecinctResultsForCounty = ({
        precincts,
        finalistA,
        finalistB,
        countyVotesA,
        countyVotesB,
        getPrecinctIdeology = precinct => precinct?.ideology,
        getPrecinctTurnoutWeight = precinct => precinct?.turnoutWeight
    }) => buildRcvFinalResultsForUnits({
        units: precincts,
        finalistA,
        finalistB,
        finalVotesA: countyVotesA,
        finalVotesB: countyVotesB,
        getUnitIdeology: getPrecinctIdeology,
        getUnitTurnoutWeight: getPrecinctTurnoutWeight
    });

    module.exports = {
        allocateExact,
        buildRcvFinalResultsForUnits,
        buildRcvPrecinctResultsForCounty
    };
}