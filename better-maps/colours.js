{
    const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
    const config = JSON.parse(configText);
    const candidateVariantPalettes = {
        D: ["#034B8F", "#00CBAC", "#8370F1", "#F1A410", "#73718B", "#278685", "#79AF2D", "#80DAEE", "#D8A084", "#8D438B"],
        R: ["#8F1B1B", "#F69696", "#E38B39", "#B84C96", "#FF6000", "#9F8383", "#BC8604", "#E26D99", "#BB37FF", "#470000"],
        ID: ["#5F55C3", "#358C8A", "#4D74D9", "#3587C2", "#427BA4", "#449FA4", "#4492DC"],
        IR: ["#A4334E", "#B35523", "#D24552", "#C33553", "#D05A3B", "#E35B2D", "#BF3A5C"],
        I: ["#8F69AB", "#AD6C51", "#629879", "#BD963E", "#808080", "#5F80A6", "#6B929E"]
    };
    const presidentialPrimaryColourAssignments = new Map();
    const hexToHsl = hex => {
        const value = String(hex || "").replace("#", "");
        const red = parseInt(value.slice(0, 2), 16) / 255;
        const green = parseInt(value.slice(2, 4), 16) / 255;
        const blue = parseInt(value.slice(4, 6), 16) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;
        if(delta > 0) {
            if(max === red) hue = 60 * (((green - blue) / delta) % 6);
            else if(max === green) hue = 60 * (((blue - red) / delta) + 2);
            else hue = 60 * (((red - green) / delta) + 4);
        }
        if(hue < 0) hue += 360;
        const lightness = (max + min) / 2;
        const saturation = delta === 0 ? 0 : delta / (1 - Math.abs((2 * lightness) - 1));
        return {
            h: Math.round(hue * 10) / 10,
            s: Math.round(saturation * 1000) / 10,
            l: Math.round(lightness * 1000) / 10
        };
    };
    const getCandidateVariantPartyKey = candidate => {
        const party = String(candidate?.party || candidate?.extendedAttribs?.party || "").trim();
        const compactParty = party.replace(/[^A-Za-z]/g, "").toUpperCase();
        if([
            "ID", "INDD", "INDDEM", "INDEPENDENTD", "INDEPENDENTDEM",
            "INDEPENDENTDEMOCRAT", "INDEPENDENTDEMOCRATS"
        ].includes(compactParty)) return "ID";
        if([
            "IR", "INDR", "INDREP", "INDEPENDENTR", "INDEPENDENTREP",
            "INDEPENDENTREPUBLICAN", "INDEPENDENTREPUBLICANS"
        ].includes(compactParty)) return "IR";
        if(compactParty === "I" || compactParty === "IND" || compactParty === "INDEPENDENT") {
            const caucus = String(
                candidate?.caucusParty
                || candidate?.caucus
                || candidate?.extendedAttribs?.caucusParty
                || candidate?.extendedAttribs?.caucus
                || ""
            ).charAt(0).toUpperCase();
            return caucus === "D" || caucus === "R" ? `I${caucus}` : "I";
        }
        const first = compactParty.charAt(0);
        return first === "D" || first === "R" ? first : "I";
    };
    const getCandidateVariantIdentity = candidate => {
        const id = candidate?.id ?? candidate?.candID ?? candidate?.candidateId ?? candidate?.candidateID;
        if(id !== undefined && id !== null) return `id:${id}`;
        return `name:${String(candidate?.name || candidate?.fullName || "").trim().toLowerCase()}`;
    };
    const normalizeCandidateReferenceName = value => String(value || "")
        .replace(/\*+$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toLowerCase();
    const getCandidateReferenceId = value => {
        if(value === undefined || value === null) return "";
        if(typeof value !== "object") return String(value);
        if(Array.isArray(value)) {
            const idIndex = Executive?.enums?.characterArray?.candidate?.id ?? 0;
            return value[idIndex] === undefined || value[idIndex] === null
                ? ""
                : String(value[idIndex]);
        }
        const id = value.id ?? value.candID ?? value.candidateId ?? value.candidateID
            ?? value.characterId ?? value.characterID ?? value.polID ?? value.politicianID;
        return id === undefined || id === null ? "" : String(id);
    };
    const getCandidateReferenceNames = value => {
        if(!value || typeof value !== "object" || Array.isArray(value)) return [];
        return [
            value.name,
            value.fullName,
            value.displayName,
            [value.firstName || value.first, value.lastName || value.last]
                .filter(Boolean)
                .join(" ")
        ].map(normalizeCandidateReferenceName).filter(Boolean);
    };
    const candidateMatchesReference = (candidate, reference) => {
        const candidateId = getCandidateReferenceId(candidate);
        const referenceId = getCandidateReferenceId(reference);
        if(candidateId && referenceId && candidateId === referenceId) return true;
        const candidateNames = getCandidateReferenceNames(candidate);
        const referenceNames = getCandidateReferenceNames(reference);
        return candidateNames.some(name => referenceNames.includes(name));
    };
    const hasIncumbentFlag = candidate => Boolean(
        candidate?.incumbent === true
        || candidate?.incumbent === 1
        || String(candidate?.incumbent || "").toLowerCase() === "true"
        || candidate?.isIncumbent === true
        || candidate?.inc === true
        || candidate?.incumb === true
        || candidate?.extendedAttribs?.incumbent === true
        || candidate?.extendedAttribs?.incumbent === 1
        || String(candidate?.extendedAttribs?.incumbent || "").toLowerCase() === "true"
        || /\*$/.test(String(candidate?.name || candidate?.fullName || "").trim())
    );
    const isCandidateIncumbent = candidate => {
        if(hasIncumbentFlag(candidate)) return true;
        const currentPresidentSources = [
            globalThis?.usPresident,
            Executive?.data?.usPresident,
            Executive?.data?.president,
            Executive?.data?.officeHolders?.president,
            Executive?.data?.executive?.president,
            Executive?.data?.federal?.president
        ].filter(source => source !== undefined && source !== null);
        return currentPresidentSources.some(source =>
            candidateMatchesReference(candidate, source));
    };
    const getCandidateColour = cand => {
        const partyKey = getCandidateVariantPartyKey(cand);
        if(partyKey === "ID") return config.partyColours.I.D;
        if(partyKey === "IR") return config.partyColours.I.R;
        if(partyKey === "I") {
            const caucusParty = String(
                cand?.caucusParty
                || cand?.caucus
                || cand?.extendedAttribs?.caucusParty
                || cand?.extendedAttribs?.caucus
                || ""
            ).charAt(0).toUpperCase();
            return config.partyColours.I[caucusParty] || config.partyColours.I.default;
        }
        return config.partyColours[partyKey] || config.partyColours.I.default;
    };
    const getExtendedPaletteColour = (palette, index) => {
        const base = hexToHsl(palette[index % palette.length]);
        const cycle = Math.floor(index / palette.length);
        if(cycle === 0) return base;
        const direction = cycle % 2 === 0 ? -1 : 1;
        return {
            h: (base.h + (direction * cycle * 7) + 360) % 360,
            s: Math.max(38, Math.min(92, base.s - (cycle * 4))),
            l: Math.max(27, Math.min(76, base.l + (direction * cycle * 6)))
        };
    };
    const getCandidateCurrentVotes = candidate => {
        const keys = ["visibleVotes", "currentVotes", "currVotes", "currentVoteTotal"];
        for(const key of keys) {
            if(candidate?.[key] === undefined || candidate?.[key] === null) continue;
            const votes = Number(candidate[key]);
            if(Number.isFinite(votes)) return Math.max(0, votes);
        }
        return 0;
    };
    const hasCandidateCurrentVoteField = candidate => [
        "visibleVotes", "currentVotes", "currVotes", "currentVoteTotal"
    ].some(key => candidate?.[key] !== undefined && candidate?.[key] !== null);
    const getCandidateFinalVotes = candidate => {
        const keys = ["votes", "totVotes", "finalVotes", "finalRcvVotes"];
        for(const key of keys) {
            if(candidate?.[key] === undefined || candidate?.[key] === null) continue;
            const votes = Number(candidate[key]);
            if(Number.isFinite(votes)) return Math.max(0, votes);
        }
        return 0;
    };
    const getRaceColourScope = (race, candidates) => {
        const explicitScope = String(
            race?.colourScope
            || race?.colorScope
            || race?.candidateColourScope
            || ""
        ).trim();
        if(explicitScope) return explicitScope;
        const candidateLocation = candidates.find(entry =>
            entry?.stateId || entry?.state || entry?.stateCode || entry?.district
        );
        const parts = [
            race?.year,
            race?.electionType,
            race?.stateId,
            race?.stateCode,
            race?.state,
            race?.district,
            race?.name,
            candidateLocation?.stateId,
            candidateLocation?.state,
            candidateLocation?.stateCode,
            candidateLocation?.district
        ].filter(value => value !== undefined && value !== null && String(value).trim());
        if(parts.length) return parts.map(String).join(":");
        return candidates.map(getCandidateVariantIdentity).sort().join("|");
    };
    const hashColourSeed = value => {
        let hash = 2166136261;
        const text = String(value || "");
        for(let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };
    const shufflePaletteIndexes = (indexes, seedText) => {
        const shuffled = indexes.slice();
        let seed = hashColourSeed(seedText) || 0x9E3779B9;
        const random = () => {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            return (seed >>> 0) / 4294967296;
        };
        for(let index = shuffled.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    };
    const getVariantBand = (partyKey, paletteLength, candidateIndex) => {
        const bands = (partyKey === "D" || partyKey === "R") && paletteLength >= 10
            ? [[0, 2], [2, 5], [5, 10]]
            : paletteLength >= 7
                ? [[0, 3], [3, 7]]
                : [[0, paletteLength]];
        let remainingIndex = candidateIndex;
        for(const band of bands) {
            const bandLength = band[1] - band[0];
            if(remainingIndex < bandLength) {
                return { start: band[0], end: band[1], slot: remainingIndex };
            }
            remainingIndex -= bandLength;
        }
        const lastBand = bands[bands.length - 1];
        const lastBandLength = lastBand[1] - lastBand[0];
        return {
            start: lastBand[0],
            end: lastBand[1],
            slot: remainingIndex % lastBandLength
        };
    };
    const getPresidentialPrimaryAssignment = (
        candidate,
        race,
        colourScope,
        partyKey,
        palette,
        rankedCandidates,
        incumbentIdentities
    ) => {
        const candidateSet = rankedCandidates
            .map(getCandidateVariantIdentity)
            .sort()
            .join("|");
        const scopeParts = colourScope.split(":").filter(Boolean);
        const ballotParty = scopeParts[scopeParts.length - 1] || partyKey;
        const electionYear = race?.year
            || race?.electionYear
            || globalThis?.currentYear
            || Executive?.data?.currentYear
            || "current";
        const assignmentKey = `${electionYear}|${ballotParty}|${partyKey}`;
        if(!presidentialPrimaryColourAssignments.has(assignmentKey)) {
            const assignments = new Map();
            incumbentIdentities.forEach(identity => assignments.set(identity, -1));
            const variantCandidates = incumbentIdentities.size > 0
                ? rankedCandidates.filter(entry =>
                    !incumbentIdentities.has(getCandidateVariantIdentity(entry))
                )
                : rankedCandidates.slice(1);
            if(incumbentIdentities.size === 0 && rankedCandidates[0]) {
                assignments.set(getCandidateVariantIdentity(rankedCandidates[0]), -1);
            }
            variantCandidates.forEach((entry, candidateIndex) => {
                const band = getVariantBand(partyKey, palette.length, candidateIndex);
                const paletteIndexes = Array.from(
                    { length: band.end - band.start },
                    (_value, index) => band.start + index
                );
                const shuffledIndexes = shufflePaletteIndexes(
                    paletteIndexes,
                    `${colourScope}|${partyKey}|${band.start}-${band.end}|${candidateSet}`
                );
                assignments.set(
                    getCandidateVariantIdentity(entry),
                    shuffledIndexes[band.slot % shuffledIndexes.length]
                );
            });
            presidentialPrimaryColourAssignments.set(assignmentKey, {
                assignments,
                seedScope: colourScope,
                seedCandidateSet: candidateSet
            });
        }
        const assignmentState = presidentialPrimaryColourAssignments.get(assignmentKey);
        const candidateIdentity = getCandidateVariantIdentity(candidate);
        if(!assignmentState.assignments.has(candidateIdentity)) {
            if(isCandidateIncumbent(candidate)) {
                assignmentState.assignments.set(candidateIdentity, -1);
            } else {
                const variantCandidateIndex = Array.from(assignmentState.assignments.values())
                    .filter(paletteIndex => paletteIndex >= 0)
                    .length;
                const band = getVariantBand(partyKey, palette.length, variantCandidateIndex);
                const paletteIndexes = Array.from(
                    { length: band.end - band.start },
                    (_value, index) => band.start + index
                );
                const shuffledIndexes = shufflePaletteIndexes(
                    paletteIndexes,
                    `${assignmentState.seedScope}|${partyKey}|${band.start}-${band.end}|${assignmentState.seedCandidateSet}`
                );
                assignmentState.assignments.set(
                    candidateIdentity,
                    shuffledIndexes[band.slot % shuffledIndexes.length]
                );
            }
        }
        return assignmentState.assignments.get(candidateIdentity);
    };
    const getCandidateColourForRace = (candidate, race) => {
        const baseColour = { ...getCandidateColour(candidate) };
        const raceCandidates = Array.isArray(race?.cands) ? race.cands : [];
        if(!candidate) return baseColour;
        const partyKey = getCandidateVariantPartyKey(candidate);
        const samePartyCandidates = raceCandidates.filter(raceCandidate =>
            getCandidateVariantPartyKey(raceCandidate) === partyKey
        );
        const candidateIdentity = getCandidateVariantIdentity(candidate);
        if(!samePartyCandidates.some(entry =>
            getCandidateVariantIdentity(entry) === candidateIdentity
        )) {
            samePartyCandidates.push(candidate);
        }
        if(samePartyCandidates.length < 2 || isCandidateIncumbent(candidate)) return baseColour;
        const hasFinalVotes = samePartyCandidates.some(entry =>
            getCandidateFinalVotes(entry) > 0
        );
        const getRankingVotes = raceCandidate => hasFinalVotes
            ? getCandidateFinalVotes(raceCandidate)
            : getCandidateCurrentVotes(raceCandidate);
        const rankedCandidates = samePartyCandidates.slice().sort((candidateA, candidateB) => {
            const voteDifference = getRankingVotes(candidateB) - getRankingVotes(candidateA);
            if(voteDifference !== 0) return voteDifference;
            return getCandidateVariantIdentity(candidateA)
                .localeCompare(getCandidateVariantIdentity(candidateB));
        });
        const incumbentIdentities = new Set(
            rankedCandidates.filter(isCandidateIncumbent).map(getCandidateVariantIdentity)
        );
        const palette = candidateVariantPalettes[partyKey] || candidateVariantPalettes.I;
        const colourScope = getRaceColourScope(race, samePartyCandidates);
        if(/^presidential-primary:/i.test(colourScope)) {
            const assignedPaletteIndex = getPresidentialPrimaryAssignment(
                candidate,
                race,
                colourScope,
                partyKey,
                palette,
                rankedCandidates,
                incumbentIdentities
            );
            return assignedPaletteIndex === -1 || assignedPaletteIndex === undefined
                ? baseColour
                : getExtendedPaletteColour(palette, assignedPaletteIndex);
        }
        const variantCandidates = incumbentIdentities.size > 0
            ? rankedCandidates.filter(entry =>
                !incumbentIdentities.has(getCandidateVariantIdentity(entry))
            )
            : rankedCandidates.slice(1);
        if(
            incumbentIdentities.size === 0
            && getCandidateVariantIdentity(rankedCandidates[0]) === candidateIdentity
        ) return baseColour;
        const variantCandidateIndex = variantCandidates.findIndex(entry =>
            getCandidateVariantIdentity(entry) === candidateIdentity
        );
        if(variantCandidateIndex < 0) return baseColour;
        const band = getVariantBand(partyKey, palette.length, variantCandidateIndex);
        const paletteIndexes = Array.from(
            { length: band.end - band.start },
            (_value, index) => band.start + index
        );
        const candidateSet = samePartyCandidates
            .map(getCandidateVariantIdentity)
            .sort()
            .join("|");
        const shuffledIndexes = shufflePaletteIndexes(
            paletteIndexes,
            `${colourScope}|${partyKey}|${band.start}-${band.end}|${candidateSet}`
        );
        const paletteIndex = shuffledIndexes[band.slot % shuffledIndexes.length];
        return getExtendedPaletteColour(palette, paletteIndex);
    };
    module.exports = {
        getCandidateColour,
        getCandidateColourForRace,
        getCandidateVariantPartyKey,
        getPoliticianColour: pol => {
            const caucusParty = String(pol?.caucusParty || pol?.caucus || "").charAt(0).toUpperCase();
            return ((pol.extendedAttribs.party !== "Independent") ? config.partyColours[caucusParty] :
                (config.partyColours.I[caucusParty] || config.partyColours.I.default));
        },
        stringifyColour: col => {
            return `hsl(${col.h}, ${col.s}%, ${col.l}%)`;
        }
    };
};
