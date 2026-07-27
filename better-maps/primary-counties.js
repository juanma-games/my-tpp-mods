{
    const cache = new Map();
    const allocationCache = new Map();
    const latestByScope = new Map();
    let context = {};

    const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, Number(value) || 0));

    const normalizeParty = party => {
        const value = String(party || "").trim().toUpperCase();
        if(value === "DEMOCRAT" || value === "DEMOCRATIC") return "D";
        if(value === "REPUBLICAN") return "R";
        if(value === "NONPARTISAN" || value === "ALL" || value === "N") return "N";
        return value === "D" || value === "R" ? value : "";
    };

    const virginiaNamesThatKeepCity = new Set([
        "charles city",
        "fairfax city",
        "franklin city",
        "james city",
        "richmond city",
        "roanoke city"
    ]);

    const normalizeName = (value, stateId = "") => {
        const rawName = String(value || "").trim().toLowerCase();
        const normalizedState = String(stateId || "").trim().toUpperCase();
        if(normalizedState === "MO") {
            const missouriName = rawName
                .replace(/\./g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
            if(missouriName === "st louis county") return "stlouiscounty";
            if(missouriName === "st louis city" || missouriName === "st louis") {
                return "stlouiscity";
            }
        }
        if(normalizedState === "VA" && /\s+city$/.test(rawName)) {
            if(!virginiaNamesThatKeepCity.has(rawName)) {
                return rawName
                    .replace(/\s+city$/, "")
                    .replace(/\./g, "")
                    .replace(/[^a-z0-9]+/g, "");
            }
        }
        return rawName
            .replace(/\./g, "")
            .replace(/\b(county|parish|borough|municipality|census area|city and borough)\b/g, "")
            .replace(/[^a-z0-9]+/g, "");
    };

    const stableHash = value => {
        let hash = 2166136261;
        const text = String(value || "");
        for(let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };

    const stableUnit = value => stableHash(value) / 4294967295;

    const readNumber = (object, keys) => {
        if(!object || typeof object !== "object") return null;
        for(const key of keys) {
            const value = Number(object[key]);
            if(Number.isFinite(value)) return value;
        }
        return null;
    };

    const findNamedObject = (
        container,
        countyName,
        stateId = "",
        depth = 0,
        seen = new Set()
    ) => {
        if(!container || depth > 5 || typeof container !== "object" || seen.has(container)) return null;
        seen.add(container);
        const target = normalizeName(countyName, stateId);
        if(Array.isArray(container)) {
            for(const entry of container) {
                const match = findNamedObject(entry, countyName, stateId, depth + 1, seen);
                if(match) return match;
            }
            return null;
        }
        const ownName = container.name ?? container.countyName ?? container.county ?? container.label;
        if(ownName && normalizeName(ownName, stateId) === target) return container;
        for(const key of [
            "counties", "countyStats", "countyElectStats", "countyData",
            "countyDemographics", "demographics", "electStats"
        ]) {
            const match = findNamedObject(container[key], countyName, stateId, depth + 1, seen);
            if(match) return match;
        }
        for(const [key, value] of Object.entries(container)) {
            if(value && typeof value === "object" && normalizeName(key, stateId) === target) return value;
            const valueName = value?.name ?? value?.countyName ?? value?.county;
            if(valueName && normalizeName(valueName, stateId) === target) return value;
        }
        return null;
    };

    const getCandidateKey = candidate => String(
        candidate?.id ?? candidate?.candidateId ?? candidate?.charID
        ?? candidate?.name ?? candidate?.lastName ?? "candidate"
    );

    const getCandidateName = candidate => String(
        candidate?.name
        ?? [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
        ?? candidate?.lastName
        ?? "Candidate"
    );

    const getCandidateIdeology = (candidate, party) => {
        const direct = readNumber(candidate, [
            "ideologyScore", "ideology", "ideologyValue", "politicalIdeology",
            "conservativeScore", "conservatism"
        ]);
        if(Number.isFinite(direct)) {
            if(direct < 0 && direct >= -1) return direct;
            if(direct >= 0 && direct <= 1) return (direct * 2) - 1;
            if(direct >= 0 && direct <= 100) return clamp((direct - 50) / 50, -1, 1);
            return clamp(direct, -1, 1);
        }
        const label = String(
            candidate?.ideologyName ?? candidate?.ideologyLabel ?? candidate?.politicalView ?? ""
        ).toLowerCase();
        if(label.includes("very liberal") || label.includes("progressive")) return -0.9;
        if(label.includes("liberal")) return -0.65;
        if(label.includes("moderate")) return 0;
        if(label.includes("very conservative")) return 0.9;
        if(label.includes("conservative")) return 0.65;
        const baseline = party === "D" ? -0.55 : (party === "R" ? 0.55 : 0);
        return clamp(baseline + ((stableUnit(getCandidateKey(candidate)) - 0.5) * 0.35), -1, 1);
    };

    const getCandidateApproval = candidate => {
        const approval = readNumber(candidate, [
            "approval", "approvalRating", "approve", "favorability", "favourability",
            "candidateApproval", "stateApproval"
        ]);
        if(!Number.isFinite(approval)) return 0.5;
        return clamp(approval > 1 ? approval / 100 : approval, 0, 1);
    };

    const parsePartisanLean = value => {
        if(typeof value === "string") {
            const match = value.trim().toUpperCase().match(/^([DR])\s*\+?\s*(\d+(?:\.\d+)?)$/);
            if(match) {
                const magnitude = clamp(Number(match[2]) / 50, 0, 1);
                return match[1] === "D" ? magnitude : -magnitude;
            }
        }
        const direct = Number(value);
        if(!Number.isFinite(direct)) return null;
        if(Math.abs(direct) <= 1) return direct;
        return clamp(direct / 50, -1, 1);
    };

    const getPartisanLeanFromObject = object => {
        if(!object || typeof object !== "object") return null;
        for(const key of [
            "partisanLean", "partyLean", "demLean", "democraticLean", "partisanship",
            "pvi", "PVI", "cookPvi", "cookPVI", "partisanVotingIndex"
        ]) {
            if(object[key] === undefined || object[key] === null) continue;
            const parsed = parsePartisanLean(object[key]);
            if(Number.isFinite(parsed)) return parsed;
        }
        const democrat = readNumber(object, [
            "demPop", "democratPop", "democraticPop", "demShare", "democraticShare",
            "democratShare", "demPercent", "demPct", "democraticPercent",
            "democraticPct", "demVoteShare", "democraticVoteShare", "demSupport",
            "registeredDemocrat", "registeredDemocrats", "demRegistered", "democrat"
        ]);
        const republican = readNumber(object, [
            "repPop", "republicanPop", "repShare", "republicanShare", "repPercent",
            "repPct", "republicanPercent", "republicanPct", "repVoteShare",
            "republicanVoteShare", "repSupport", "registeredRepublican",
            "registeredRepublicans", "repRegistered", "republican"
        ]);
        if(Number.isFinite(democrat) && Number.isFinite(republican) && democrat + republican > 0) {
            return clamp((democrat - republican) / (democrat + republican), -1, 1);
        }
        if(Number.isFinite(democrat)) {
            const share = democrat > 1 ? democrat / 100 : democrat;
            if(share >= 0 && share <= 1) return clamp((share - 0.5) * 2, -1, 1);
        }
        if(Number.isFinite(republican)) {
            const share = republican > 1 ? republican / 100 : republican;
            if(share >= 0 && share <= 1) return clamp((0.5 - share) * 2, -1, 1);
        }
        return null;
    };

    const getCountyPartisanLean = (countyData, stateData, stateId, countyName) => {
        const countySources = [
            countyData,
            countyData?.stats,
            countyData?.demographics,
            countyData?.partisanship,
            countyData?.partySupport,
            countyData?.votingData,
            countyData?.electStats
        ];
        for(const source of countySources) {
            const lean = getPartisanLeanFromObject(source);
            if(Number.isFinite(lean)) return lean;
        }
        const stateLean = getPartisanLeanFromObject(stateData);
        const baseline = Number.isFinite(stateLean) ? stateLean : 0;
        const localVariation = (stableUnit(`${stateId}|${countyName}|lean`) - 0.5) * 0.7;
        return clamp(baseline + localVariation, -0.85, 0.85);
    };

    const getCountyWeight = (countyData, stateId, countyName) => {
        const direct = readNumber(countyData, [
            "registeredVoters", "registered", "registeredPopulation", "totalRegistered",
            "votingPopulation", "population", "pop", "countyPop", "totalPop",
            "expectedVotes", "totalVotes", "votes"
        ]);
        if(Number.isFinite(direct) && direct > 0) return direct;
        return 0.75 + stableUnit(`${stateId}|${countyName}|weight`) * 0.5;
    };

    const getCountyPopulation = countyData => {
        const population = readNumber(countyData, [
            "population", "pop", "countyPop", "totalPop", "votingPopulation"
        ]);
        return Number.isFinite(population) && population > 0 ? population : 0;
    };

    const getCountyRegisteredVoters = (countyData, stateData) => {
        const population = getCountyPopulation(countyData);
        const direct = readNumber(countyData, [
            "registeredVoters", "registered", "registeredPopulation", "registeredPop",
            "totalRegistered", "totRegistered", "registeredVoterTotal"
        ]);
        if(Number.isFinite(direct) && direct > 0) {
            return Math.round(direct <= 100 && population > 1000
                ? population * (direct / 100)
                : direct);
        }
        let fraction = readNumber(countyData, [
            "regVoters", "voterRegistration", "registeredFraction", "regFraction"
        ]);
        if(!Number.isFinite(fraction) || fraction <= 0) {
            fraction = readNumber(stateData, ["regVoters", "registeredFraction"]);
        }
        if(!population || !Number.isFinite(fraction) || fraction <= 0) return 0;
        if(fraction > 1) fraction /= 100;
        return Math.round(population * fraction);
    };

    const getRace = (stateId, electionType) =>
        context.getRace?.(String(stateId || "").toLowerCase(), electionType) || null;

    const getGroup = (race, party) => {
        const normalized = normalizeParty(party);
        if(normalized === "D") return race?.dem || null;
        if(normalized === "R") return race?.rep || null;
        if(normalized === "N") return race?.allCands || null;
        return null;
    };

    const getCandidateParty = candidate => {
        const party = String(candidate?.party || candidate?.extendedAttribs?.party || "").trim();
        if(party === "ID" || party === "IR") return party;
        if(party === "I" || party.toLowerCase() === "independent") {
            const caucus = String(
                candidate?.caucus ?? candidate?.caucusParty
                ?? candidate?.extendedAttribs?.caucus ?? candidate?.extendedAttribs?.caucusParty
                ?? ""
            ).charAt(0).toUpperCase();
            return caucus === "D" || caucus === "R" ? `I${caucus}` : "I";
        }
        const first = party.charAt(0).toUpperCase();
        return first === "D" || first === "R" ? first : "I";
    };

    const getCandidateIdeologicalBlock = candidate => {
        const party = getCandidateParty(candidate);
        if(party === "D" || party === "ID") return "D";
        if(party === "R" || party === "IR") return "R";
        return "N";
    };

    const getResolvedCandidateParty = candidate => {
        const contextualParty = context.getCandidateParty?.(candidate);
        return contextualParty || getCandidateParty(candidate);
    };

    const getVisibleVotes = (candidate, stateId, electionType) => {
        const contextualVotes = Number(context.getVisibleVotes?.(candidate, stateId, electionType));
        if(Number.isFinite(contextualVotes) && contextualVotes >= 0) return contextualVotes;
        const currentVotes = Number(candidate?.currentVotes);
        if(Number.isFinite(currentVotes) && currentVotes >= 0) return currentVotes;
        return Number(candidate?.votes) || 0;
    };

    const getCountyCatalog = (stateId, fallbackCounties = []) => {
        const electionData = context.getElectionData?.(stateId) || null;
        const stateData = context.getStateData?.(String(stateId || "").toLowerCase()) || null;
        const contextualSubdivisions = context.getPrimaryCountySubdivisions?.(stateId);
        const subdivisionSources = Array.isArray(contextualSubdivisions)
            ? contextualSubdivisions.filter(Boolean)
            : [];
        const fallbackSources = (Array.isArray(fallbackCounties) ? fallbackCounties : [])
            .map(county => typeof county === "string" ? { name: county } : county)
            .filter(Boolean);
        const electionCounties = Array.isArray(electionData?.counties) ? electionData.counties : [];
        const stateCounties = Array.isArray(stateData?.counties) ? stateData.counties : [];

        const sourceCounties = subdivisionSources.length
            ? subdivisionSources
            : (electionCounties.length
                ? electionCounties
                : (stateCounties.length ? stateCounties : fallbackSources));
        const seen = new Set();
        const catalog = sourceCounties.flatMap((sourceCounty, index) => {
            const name = String(
                sourceCounty?.name ?? sourceCounty?.countyName ?? sourceCounty?.county ?? ""
            ).trim();
            const normalized = normalizeName(name, stateId);
            if(!name || !normalized || seen.has(normalized)) return [];
            seen.add(normalized);
            const countyData = findNamedObject(
                [stateData, electionData],
                name,
                stateId
            ) || sourceCounty;
            return [{
                name,
                normalizedName: normalized,
                index,
                weight: getCountyWeight(countyData, stateId, name),
                lean: getCountyPartisanLean(countyData, stateData, stateId, name),
                population: getCountyPopulation(countyData),
                registeredVoters: getCountyRegisteredVoters(countyData, stateData),
                sourceCounty,
                countyData
            }];
        });
        const totalWeight = catalog.reduce((sum, county) => sum + county.weight, 0) || 1;
        const statePopulation = readNumber(stateData, ["population", "pop", "statePopulation"]) || 0;
        let stateRegistered = readNumber(stateData, [
            "registeredVoters", "registered", "totalRegistered", "registeredPopulation"
        ]) || 0;
        if(!stateRegistered && statePopulation > 0) {
            let registeredFraction = readNumber(stateData, ["regVoters", "registeredFraction"]) || 0;
            if(registeredFraction > 1) registeredFraction /= 100;
            if(registeredFraction > 0) stateRegistered = statePopulation * registeredFraction;
        }
        catalog.forEach(county => {
            const share = county.weight / totalWeight;
            if(!county.population && statePopulation > 0) {
                county.population = Math.max(1, Math.round(statePopulation * share));
            }
            if(!county.registeredVoters && stateRegistered > 0) {
                county.registeredVoters = Math.max(1, Math.round(stateRegistered * share));
            }
        });
        if(stateRegistered > 0 && catalog.length) {
            const normalizedRegistration = allocateExact(
                Math.round(stateRegistered),
                catalog.map(county => county.registeredVoters || county.weight)
            );
            catalog.forEach((county, index) => {
                county.registeredVoters = normalizedRegistration[index];
            });
        }
        return catalog;
    };

    const allocateExact = (totalVotes, scores) => {
        const total = Math.max(0, Math.round(Number(totalVotes) || 0));
        if(!scores.length) return [];
        const positiveScores = scores.map(score => Math.max(0.000001, Number(score) || 0));
        const scoreTotal = positiveScores.reduce((sum, score) => sum + score, 0);
        const raw = positiveScores.map(score => total * score / scoreTotal);
        const allocated = raw.map(Math.floor);
        let remainder = total - allocated.reduce((sum, votes) => sum + votes, 0);
        raw.map((value, index) => ({ index, fraction: value - allocated[index] }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
            .slice(0, remainder)
            .forEach(entry => allocated[entry.index]++);
        return allocated;
    };

    const allocateExactWithCaps = (totalVotes, scores, caps) => {
        const target = Math.max(0, Math.round(Number(totalVotes) || 0));
        const normalizedCaps = caps.map(cap => Math.max(0, Math.round(Number(cap) || 0)));
        const allocated = normalizedCaps.map(() => 0);
        let remaining = target;
        let guard = 0;
        while(remaining > 0 && guard++ <= normalizedCaps.length + 2) {
            const availableIndexes = normalizedCaps
                .map((cap, index) => ({ index, available: cap - allocated[index] }))
                .filter(entry => entry.available > 0);
            if(!availableIndexes.length) break;
            const proposed = allocateExact(
                remaining,
                availableIndexes.map(entry => scores[entry.index])
            );
            let assigned = 0;
            availableIndexes.forEach((entry, proposalIndex) => {
                const addition = Math.min(entry.available, proposed[proposalIndex] || 0);
                allocated[entry.index] += addition;
                assigned += addition;
            });
            if(assigned <= 0) {
                const entry = availableIndexes
                    .slice()
                    .sort((a, b) =>
                        (Number(scores[b.index]) || 0) - (Number(scores[a.index]) || 0)
                        || a.index - b.index
                    )[0];
                allocated[entry.index]++;
                assigned = 1;
            }
            remaining -= assigned;
        }
        if(remaining > 0) {
            const overflow = allocateExact(remaining, scores);
            overflow.forEach((votes, index) => {
                allocated[index] += votes;
            });
        }
        return allocated;
    };

    const getCandidateCountyProfile = (candidate, party) => {
        const candidateProfile = context.getCandidateProfile?.(candidate) || null;
        const profile = candidateProfile && typeof candidateProfile === "object"
            ? { ...candidate, ...candidateProfile }
            : candidate;
        const candidateBlock = party === "N" ? getCandidateIdeologicalBlock(profile) : party;
        return {
            candidate,
            candidateBlock,
            ideology: getCandidateIdeology(profile, candidateBlock),
            approval: getCandidateApproval(profile),
            candidateKey: getCandidateKey(candidate)
        };
    };

    const getPrimaryRaceCompetitiveness = candidateTotals => {
        const total = candidateTotals.reduce((sum, votes) => sum + Math.max(0, votes), 0);
        if(total <= 0 || candidateTotals.length < 2) {
            return {
                total,
                shares: candidateTotals.map(() => 0),
                leaderShare: 1,
                margin: 1,
                competitiveness: 0
            };
        }
        const shares = candidateTotals.map(votes => Math.max(0, votes) / total);
        const sortedShares = shares.slice().sort((a, b) => b - a);
        const leaderShare = sortedShares[0] || 0;
        const secondShare = sortedShares[1] || 0;
        const margin = leaderShare - secondShare;
        const marginCompetitiveness = clamp((0.34 - margin) / 0.34, 0, 1);
        const leaderCompetitiveness = clamp((0.72 - leaderShare) / 0.27, 0, 1);
        return {
            total,
            shares,
            leaderShare,
            margin,
            competitiveness: Math.sqrt(marginCompetitiveness * leaderCompetitiveness)
        };
    };

    const buildCandidateCountyScore = (stateId, party, candidateProfile, county, raceContext = {}) => {
        const partisanMultiplier = candidateProfile.candidateBlock === "D"
            ? 1 + (county.lean * 0.38)
            : (candidateProfile.candidateBlock === "R"
                ? 1 - (county.lean * 0.38)
                : 1 - (Math.abs(county.lean) * 0.1));
        const countyIdeology = -county.lean;
        const ideologicalDistance = Math.abs(candidateProfile.ideology - countyIdeology);
        const ideologyPenalty = (party === "N" ? 0.24 : 0.29)
            * (1.12 - candidateProfile.approval * 0.24);
        const ideologicalFit = clamp(
            1.1 - (ideologicalDistance * ideologyPenalty),
            0.66,
            1.1
        );
        const blockStrength = party === "N"
            ? clamp(partisanMultiplier, 0.62, 1.38)
            : 1;
        const randomUnit = stableUnit(
            `${county.normalizedName}|${candidateProfile.candidateKey}|${stateId}|${party}`
        );
        const randomFactor = party === "N"
            ? 0.99 + (randomUnit * 0.02)
            : 0.7 + (randomUnit * 0.6);
        const competitiveness = clamp(raceContext.competitiveness, 0, 1);
        const share = clamp(raceContext.share, 0, 1);
        const isLeader = raceContext.rank === 0;
        const pocketUnit = stableUnit(
            `${stateId}|${party}|${county.normalizedName}|${candidateProfile.candidateKey}|primary-pocket-v2`
        );
        const pocketThreshold = clamp(
            0.78 - (competitiveness * 0.3) - (share < 0.28 ? 0.1 : 0),
            0.42,
            0.94
        );
        const pocketStrength = pocketUnit > pocketThreshold
            ? Math.pow((pocketUnit - pocketThreshold) / (1 - pocketThreshold), 1.35)
            : 0;
        const oppositePartisanLean = candidateProfile.candidateBlock === "D"
            ? -county.lean
            : (candidateProfile.candidateBlock === "R" ? county.lean : 0);
        const oppositionIntensity = party === "N"
            ? clamp((oppositePartisanLean - 0.28) / 0.44, 0, 1)
            : 0;
        const underdogBonus = isLeader
            ? 0.42
            : (2.4 + ((1 - share) * 1.8));
        const pocketBoost = 1 + (
            pocketStrength
            * competitiveness
            * underdogBonus
            * (1 - (oppositionIntensity * 0.88))
        );
        const frontrunnerDrag = isLeader
            ? 1 - (competitiveness * 0.18 * (1 - pocketStrength))
            : 1;
        const partisanGuard = 1 - (
            oppositionIntensity
            * (0.52 + (competitiveness * 0.22))
        );
        const candidateLocalTilt = 0.9 + (
            stableUnit(`${stateId}|${party}|${candidateProfile.candidateKey}|${county.normalizedName}|local-tilt-v2`)
            * 0.2
        );
        const territorialScore = blockStrength
            * ideologicalFit
            * randomFactor
            * pocketBoost
            * frontrunnerDrag
            * partisanGuard
            * candidateLocalTilt;
        const rawMaxScore = party === "N"
            ? 1.58 + (competitiveness * 1.12)
            : 1.7 + (competitiveness * 2.5);
        const maxScore = rawMaxScore * (1 - (oppositionIntensity * 0.42));
        return clamp(0.35 + (territorialScore * 0.65), 0.42, maxScore);
    };

    const balanceCandidateCountyMatrix = (
        candidateTotals,
        countyTotals,
        seedMatrix,
        territorialWeight = 0.58
    ) => {
        const matrix = seedMatrix.map(row => row.map(value => Math.max(0.000001, value)));
        for(let iteration = 0; iteration < 80; iteration++) {
            matrix.forEach((row, candidateIndex) => {
                const target = candidateTotals[candidateIndex];
                const total = row.reduce((sum, value) => sum + value, 0);
                const scale = target > 0 && total > 0 ? target / total : 0;
                row.forEach((value, countyIndex) => {
                    row[countyIndex] = value * scale;
                });
            });
            countyTotals.forEach((target, countyIndex) => {
                const total = matrix.reduce((sum, row) => sum + row[countyIndex], 0);
                const scale = target > 0 && total > 0 ? target / total : 0;
                matrix.forEach(row => {
                    row[countyIndex] *= scale;
                });
            });
        }

        const statewideTotal = candidateTotals.reduce((sum, votes) => sum + votes, 0);
        if(statewideTotal > 0) {
            matrix.forEach((row, candidateIndex) => {
                row.forEach((value, countyIndex) => {
                    const statewideBaseline = candidateTotals[candidateIndex]
                        * countyTotals[countyIndex] / statewideTotal;
                    row[countyIndex] = statewideBaseline
                        + ((value - statewideBaseline) * territorialWeight);
                });
            });
        }

        const integers = matrix.map(row => row.map(Math.floor));
        const rowDeficits = candidateTotals.map((target, candidateIndex) =>
            target - integers[candidateIndex].reduce((sum, value) => sum + value, 0));
        const columnDeficits = countyTotals.map((target, countyIndex) =>
            target - integers.reduce((sum, row) => sum + row[countyIndex], 0));
        const fractions = [];
        matrix.forEach((row, candidateIndex) => row.forEach((value, countyIndex) => {
            fractions.push({
                candidateIndex,
                countyIndex,
                fraction: value - Math.floor(value)
            });
        }));
        fractions.sort((a, b) => b.fraction - a.fraction);
        fractions.forEach(cell => {
            if(rowDeficits[cell.candidateIndex] <= 0 || columnDeficits[cell.countyIndex] <= 0) return;
            integers[cell.candidateIndex][cell.countyIndex]++;
            rowDeficits[cell.candidateIndex]--;
            columnDeficits[cell.countyIndex]--;
        });
        rowDeficits.forEach((deficit, candidateIndex) => {
            while(rowDeficits[candidateIndex] > 0) {
                const countyIndex = columnDeficits.findIndex(value => value > 0);
                if(countyIndex < 0) break;
                integers[candidateIndex][countyIndex]++;
                rowDeficits[candidateIndex]--;
                columnDeficits[countyIndex]--;
            }
        });
        return integers;
    };

    const buildCandidateAllocations = (stateId, party, candidates, counties) => {
        const candidateTotals = candidates.map(candidate =>
            Math.max(0, Math.round(Number(candidate?.votes) || 0)));
        const totalVotes = candidateTotals.reduce((sum, votes) => sum + votes, 0);
        const countyParticipationWeights = counties.map(county => {
            if(party === "D") {
                return county.weight * clamp(1 + (county.lean * 0.58), 0.42, 1.58);
            }
            if(party === "R") {
                return county.weight * clamp(1 - (county.lean * 0.58), 0.42, 1.58);
            }
            return county.weight;
        });
        const countyTotals = allocateExact(totalVotes, countyParticipationWeights);
        const profiles = candidates.map(candidate => getCandidateCountyProfile(candidate, party));
        const raceContext = getPrimaryRaceCompetitiveness(candidateTotals);
        const rankedCandidateIndexes = candidateTotals
            .map((votes, index) => ({ votes, index }))
            .sort((a, b) => b.votes - a.votes || a.index - b.index)
            .reduce((ranks, entry, rank) => {
                ranks[entry.index] = rank;
                return ranks;
            }, []);
        const seedMatrix = profiles.map((profile, candidateIndex) => counties.map((county, countyIndex) =>
            Math.max(0.000001, countyTotals[countyIndex])
            * buildCandidateCountyScore(stateId, party, profile, county, {
                ...raceContext,
                share: raceContext.shares[candidateIndex] || 0,
                rank: rankedCandidateIndexes[candidateIndex] ?? candidateIndex
            })));
        const territorialWeight = party === "N"
            ? 0.62 + (raceContext.competitiveness * 0.12)
            : 0.96 + (raceContext.competitiveness * 0.1);
        const balanced = balanceCandidateCountyMatrix(
            candidateTotals,
            countyTotals,
            seedMatrix,
            territorialWeight
        );
        return new Map(candidates.map((candidate, candidateIndex) => [
            getCandidateKey(candidate),
            balanced[candidateIndex]
        ]));
    };

    const buildCurrentCandidateAllocations = (
        stateId,
        party,
        candidates,
        counties,
        finalAllocations
    ) => {
        const currentMatrix = candidates.map(candidate => {
            const key = getCandidateKey(candidate);
            const finalRow = finalAllocations.get(key) || counties.map(() => 0);
            const currentTotal = Math.max(0, Math.round(Number(candidate?.currentVotes) || 0));
            const finalTotal = finalRow.reduce((sum, votes) => sum + votes, 0);
            if(currentTotal >= finalTotal) return finalRow.slice();
            const progressScores = finalRow.map((votes, countyIndex) => {
                if(votes <= 0) return 0;
                const reportingPace = 0.5 + stableUnit(
                    `${stateId}|${party}|${counties[countyIndex].normalizedName}|reporting`
                );
                return votes * reportingPace;
            });
            return allocateExactWithCaps(currentTotal, progressScores, finalRow);
        });

        const statewideCurrentVotes = candidates.reduce(
            (sum, candidate) => sum + Math.max(0, Math.round(Number(candidate?.currentVotes) || 0)),
            0
        );
        if(statewideCurrentVotes >= counties.length) {
            counties.forEach((_county, countyIndex) => {
                const countyCurrentVotes = currentMatrix.reduce(
                    (sum, row) => sum + row[countyIndex],
                    0
                );
                if(countyCurrentVotes > 0) return;
                for(let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
                    const finalRow = finalAllocations.get(
                        getCandidateKey(candidates[candidateIndex])
                    ) || [];
                    if((finalRow[countyIndex] || 0) <= 0) continue;
                    const donorIndex = currentMatrix[candidateIndex]
                        .map((votes, index) => ({ votes, index }))
                        .filter(entry => entry.index !== countyIndex && entry.votes > 1)
                        .sort((a, b) => b.votes - a.votes || a.index - b.index)[0]?.index;
                    if(donorIndex === undefined) continue;
                    currentMatrix[candidateIndex][donorIndex]--;
                    currentMatrix[candidateIndex][countyIndex]++;
                    break;
                }
            });
        }

        return new Map(candidates.map((candidate, candidateIndex) => [
            getCandidateKey(candidate),
            currentMatrix[candidateIndex]
        ]));
    };

    const buildGeneralCountyResults = (
        stateId,
        sourceCandidates,
        scope = "general",
        fallbackCounties = []
    ) => {
        const candidates = (sourceCandidates || []).map(candidate => ({
            ...candidate,
            party: getResolvedCandidateParty(candidate),
            votes: Math.max(0, Math.round(Number(candidate?.finalVotes ?? candidate?.votes) || 0)),
            currentVotes: Math.max(0, Math.round(Number(candidate?.currentVotes) || 0))
        }));
        if(candidates.length < 2) return null;
        const counties = getCountyCatalog(stateId, fallbackCounties);
        if(!counties.length) return null;
        const candidateTotals = candidates.map(candidate => candidate.votes);
        const statewideTotal = candidateTotals.reduce((sum, votes) => sum + votes, 0);
        if(statewideTotal <= 0) return null;
        const countyTotals = allocateExact(
            statewideTotal,
            counties.map(county => county.weight)
        );
        const profiles = candidates.map(candidate => getCandidateCountyProfile(candidate, "N"));
        const raceContext = getPrimaryRaceCompetitiveness(candidateTotals);
        const rankedIndexes = candidateTotals
            .map((votes, index) => ({ votes, index }))
            .sort((left, right) => right.votes - left.votes || left.index - right.index)
            .reduce((ranks, entry, rank) => {
                ranks[entry.index] = rank;
                return ranks;
            }, []);
        const signature = [
            "general-county-v1",
            scope,
            String(stateId || "").toUpperCase(),
            candidates.map(candidate => `${getCandidateKey(candidate)}:${candidate.votes}:${candidate.party}`).join(","),
            counties.map(county => `${county.normalizedName}:${county.lean.toFixed(4)}`).join(",")
        ].join("|");
        let finalAllocations = allocationCache.get(signature);
        if(!finalAllocations) {
            const seedMatrix = profiles.map((profile, candidateIndex) => counties.map((county, countyIndex) =>
                Math.max(0.000001, countyTotals[countyIndex])
                * buildCandidateCountyScore(stateId, "N", profile, county, {
                    ...raceContext,
                    share: raceContext.shares[candidateIndex] || 0,
                    rank: rankedIndexes[candidateIndex] ?? candidateIndex
                })));
            const balanced = balanceCandidateCountyMatrix(
                candidateTotals,
                countyTotals,
                seedMatrix,
                0.92
            );
            finalAllocations = new Map(candidates.map((candidate, candidateIndex) => [
                getCandidateKey(candidate),
                balanced[candidateIndex]
            ]));
            allocationCache.set(signature, finalAllocations);
        }
        const currentAllocations = buildCurrentCandidateAllocations(
            stateId,
            "N",
            candidates,
            counties,
            finalAllocations
        );
        return {
            stateId: String(stateId || "").toUpperCase(),
            candidates,
            totalVotes: statewideTotal,
            totalCurrVotes: candidates.reduce((sum, candidate) => sum + candidate.currentVotes, 0),
            counties: counties.map((county, countyIndex) => {
                const countyCandidates = candidates.map(candidate => ({
                    ...candidate,
                    votes: finalAllocations.get(getCandidateKey(candidate))?.[countyIndex] || 0,
                    currentVotes: currentAllocations.get(getCandidateKey(candidate))?.[countyIndex] || 0
                }));
                const totalVotes = countyCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
                const totalCurrVotes = countyCandidates.reduce((sum, candidate) => sum + candidate.currentVotes, 0);
                return {
                    name: county.name,
                    normalizedName: county.normalizedName,
                    cands: countyCandidates,
                    totalVotes,
                    totalCurrVotes,
                    reporting: totalVotes > 0 ? Math.min(1, totalCurrVotes / totalVotes) : 0
                };
            })
        };
    };

    const getSignature = (stateId, party, electionType, candidates, counties) => [
        electionType || "",
        String(stateId || "").toUpperCase(),
        party,
        candidates.map(candidate => `${getCandidateKey(candidate)}:${Math.round(Number(candidate?.votes) || 0)}`).join(","),
        counties.map(county => `${county.normalizedName}:${county.lean.toFixed(4)}`).join(","),
        "block-matrix-v10-local-upsets"
    ].join("|");

    const getPrimaryStateResult = (stateId, party, electionType = context.getElectionType?.()) => {
        const normalizedParty = normalizeParty(party);
        const race = getRace(stateId, electionType);
        const group = getGroup(race, normalizedParty);
        if(!group || !Array.isArray(group.cands) || !group.cands.length) return null;
        const candidates = group.cands.map(candidate => ({
            ...candidate,
            party: normalizedParty === "N" ? getResolvedCandidateParty(candidate) : normalizedParty,
            votes: Math.max(0, Math.round(Number(candidate?.votes) || 0)),
            currentVotes: Math.max(0, Math.round(getVisibleVotes(candidate, stateId, electionType)))
        }));
        const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
        const totalCurrVotes = candidates.reduce((sum, candidate) => sum + candidate.currentVotes, 0);
        const colourScope = electionType === "president"
            ? `presidential-primary:${normalizedParty}`
            : `statewide-primary:${String(stateId || "").toLowerCase()}:${normalizedParty}`;
        return {
            stateId: String(stateId || "").toUpperCase(),
            electionType,
            party: normalizedParty,
            colourScope,
            candidates,
            totalVotes,
            totalCurrVotes,
            reporting: totalVotes > 0 ? Math.min(1, totalCurrVotes / totalVotes) : 0
        };
    };

    const buildPrimaryCountyResults = (stateId, party, electionType = context.getElectionType?.()) => {
        const stateResult = getPrimaryStateResult(stateId, party, electionType);
        if(!stateResult || stateResult.totalVotes <= 0 || stateResult.totalCurrVotes <= 0) return null;
        const scopeKey = `${electionType}|${stateResult.stateId}|${stateResult.party}`;
        const voteSignature = stateResult.candidates
            .map(candidate =>
                `${getCandidateKey(candidate)}:${candidate.votes}:${candidate.currentVotes}`
            )
            .join(",");
        const latest = latestByScope.get(scopeKey);
        if(latest?.voteSignature === voteSignature) return latest.result;
        const counties = getCountyCatalog(stateId);
        if(!counties.length) return null;
        const signature = getSignature(
            stateId,
            stateResult.party,
            electionType,
            stateResult.candidates,
            counties
        );
        if(stateResult.reporting >= 0.999 && cache.has(signature)) return cache.get(signature);
        let allocations = allocationCache.get(signature);
        if(!allocations) {
            allocations = buildCandidateAllocations(
                stateId,
                stateResult.party,
                stateResult.candidates,
                counties
            );
            allocationCache.set(signature, allocations);
        }
        const currentAllocations = stateResult.reporting >= 0.999
            ? allocations
            : buildCurrentCandidateAllocations(
                stateId,
                stateResult.party,
                stateResult.candidates,
                counties,
                allocations
            );
        const countyResults = counties.map((county, countyIndex) => {
            const candidates = stateResult.candidates.map(candidate => {
                const votes = allocations.get(getCandidateKey(candidate))[countyIndex] || 0;
                const currentVotes = currentAllocations.get(
                    getCandidateKey(candidate)
                )[countyIndex] || 0;
                return {
                    ...candidate,
                    votes,
                    currentVotes
                };
            });
            const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
            const totalCurrVotes = candidates.reduce(
                (sum, candidate) => sum + candidate.currentVotes,
                0
            );
            return {
                name: county.name,
                normalizedName: county.normalizedName,
                stateId: stateResult.stateId,
                party: stateResult.party,
                colourScope: stateResult.colourScope,
                cands: candidates,
                totalVotes,
                totalCurrVotes,
                pW: false,
                simulatedPrimaryCounty: true,
                population: county.population,
                registeredVoters: county.registeredVoters,
                sourceCounty: county.sourceCounty
            };
        });
        const result = {
            ...stateResult,
            counties: countyResults,
            signature
        };
        if(stateResult.reporting >= 0.999) cache.set(signature, result);
        latestByScope.set(scopeKey, { voteSignature, result });
        return result;
    };

    const getPrimaryCountyResult = (
        stateId,
        party,
        countyName,
        electionType = context.getElectionType?.()
    ) => {
        const result = buildPrimaryCountyResults(stateId, party, electionType);
        if(!result) return null;
        const target = normalizeName(countyName, stateId);
        return result.counties.find(county => county.normalizedName === target) || null;
    };

    const getPrimaryCountyTurnoutVotes = (
        stateId,
        countyName,
        electionType = context.getElectionType?.()
    ) => {
        return getAvailablePrimaryParties(stateId, electionType).reduce((total, party) => {
            const county = getPrimaryCountyResult(stateId, party, countyName, electionType);
            return total + (Number(county?.totalVotes) || 0);
        }, 0);
    };

    const getAvailablePrimaryParties = (stateId, electionType = context.getElectionType?.()) => {
        const race = getRace(stateId, electionType);
        const partisanParties = ["D", "R"].filter(party => {
            const group = getGroup(race, party);
            return Array.isArray(group?.cands) && group.cands.length > 0;
        });
        if(partisanParties.length) return partisanParties;
        return Array.isArray(race?.allCands?.cands) && race.allCands.cands.length > 0
            ? ["N"]
            : [];
    };

    const isPrimaryStateFullyReported = (stateId, electionType = context.getElectionType?.()) => {
        const parties = getAvailablePrimaryParties(stateId, electionType);
        if(!parties.length) return false;
        return parties.every(party =>
            isPrimaryPartyFullyReported(stateId, party, electionType));
    };

    const isPrimaryPartyFullyReported = (
        stateId,
        party,
        electionType = context.getElectionType?.()
    ) => {
        const result = getPrimaryStateResult(stateId, party, electionType);
        return Boolean(result?.totalVotes > 0 && result.reporting >= 0.999);
    };

    const isPrimaryPartyStarted = (
        stateId,
        party,
        electionType = context.getElectionType?.()
    ) => {
        const result = getPrimaryStateResult(stateId, party, electionType);
        return Boolean(result?.totalVotes > 0 && result.totalCurrVotes > 0);
    };

    const configurePrimaryCountyResults = options => {
        context = options || {};
        cache.clear();
        allocationCache.clear();
        latestByScope.clear();
    };

    module.exports = {
        configurePrimaryCountyResults,
        getPrimaryStateResult,
        buildPrimaryCountyResults,
        getPrimaryCountyResult,
        getPrimaryCountyTurnoutVotes,
        buildGeneralCountyResults,
        getAvailablePrimaryParties,
        isPrimaryStateFullyReported,
        isPrimaryPartyFullyReported,
        isPrimaryPartyStarted,
        normalizePrimaryCountyName: normalizeName,
        clearPrimaryCountyResultsCache: () => {
            cache.clear();
            allocationCache.clear();
            latestByScope.clear();
        }
    };
}