{
    const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
    const config = JSON.parse(configText);
    const candidateVariantPalettes = {
        D: ["#034B8F", "#07A297", "#6A3BD4", "#068B87", "#3C4AE6", "#0A6EE9", "#0881C8"],
        R: ["#9C102B", "#F65428", "#DB2F09", "#E92A3E", "#E44229", "#A90725", "#BE5708"],
        ID: ["#5F55C3", "#358C8A", "#3587C2", "#4D74D9", "#449FA4", "#427BA4", "#4492DC"],
        IR: ["#A4334E", "#B35523", "#D24552", "#E35B2D", "#C33553", "#D05A3B", "#BF3A5C"],
        I: ["#8F69AB", "#AD6C51", "#629879", "#BD963E", "#808080", "#5F80A6", "#6B929E"]
    };
    const candidateRaceColourAssignments = new Map();
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
        if(party === "ID" || party === "IR") return party;
        if(party === "I" || party.toLowerCase() === "independent") {
            const caucus = String(
                candidate?.caucusParty
                || candidate?.caucus
                || candidate?.extendedAttribs?.caucusParty
                || candidate?.extendedAttribs?.caucus
                || ""
            ).charAt(0).toUpperCase();
            return caucus === "D" || caucus === "R" ? `I${caucus}` : "I";
        }
        const first = party.charAt(0).toUpperCase();
        return first === "D" || first === "R" ? first : "I";
    };
    const getCandidateVariantIdentity = candidate => {
        const id = candidate?.id ?? candidate?.candID ?? candidate?.candidateId ?? candidate?.candidateID;
        if(id !== undefined && id !== null) return `id:${id}`;
        return `name:${String(candidate?.name || candidate?.fullName || "").trim().toLowerCase()}`;
    };
    const getCandidateColour = cand => {
        const party = cand?.party;
        if(party === "ID") return config.partyColours.I.D;
        if(party === "IR") return config.partyColours.I.R;
        if(party === "I" || cand?.extendedAttribs?.party === "Independent") {
            const caucusParty = String(
                cand?.caucusParty
                || cand?.caucus
                || cand?.extendedAttribs?.caucusParty
                || cand?.extendedAttribs?.caucus
                || ""
            ).charAt(0).toUpperCase();
            return config.partyColours.I[caucusParty] || config.partyColours.I.default;
        }
        return config.partyColours[party] || config.partyColours.I.default;
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
    const getCandidateColourForRace = (candidate, race) => {
        const baseColour = { ...getCandidateColour(candidate) };
        const raceCandidates = Array.isArray(race?.cands) ? race.cands : [];
        if(!candidate || raceCandidates.length < 2) return baseColour;
        const partyKey = getCandidateVariantPartyKey(candidate);
        const samePartyCandidates = raceCandidates.filter(raceCandidate =>
            getCandidateVariantPartyKey(raceCandidate) === partyKey
        );
        if(samePartyCandidates.length < 2) return baseColour;
        const identity = getCandidateVariantIdentity(candidate);
        const colourScope = String(
            race?.colourScope
            || race?.colorScope
            || race?.candidateColourScope
            || ""
        ).trim();
        const raceKey = `${colourScope}|${partyKey}|${samePartyCandidates
            .map(getCandidateVariantIdentity)
            .sort()
            .join("|")}`;
        if(!candidateRaceColourAssignments.has(raceKey)) {
            const hasCurrentVoteFields = samePartyCandidates.some(candidate =>
                candidate?.currentVotes !== undefined && candidate?.currentVotes !== null
            );
            const hasVisibleCurrentVotes = samePartyCandidates.some(candidate =>
                (Number(candidate?.currentVotes) || 0) > 0
            );
            if(hasCurrentVoteFields && !hasVisibleCurrentVotes) return baseColour;
            const rankedCandidates = samePartyCandidates.slice().sort((candidateA, candidateB) => {
                const currentA = Number(candidateA?.currentVotes) || 0;
                const currentB = Number(candidateB?.currentVotes) || 0;
                if(currentA > 0 || currentB > 0) return currentB - currentA;
                return (Number(candidateB?.votes) || 0) - (Number(candidateA?.votes) || 0);
            });
            candidateRaceColourAssignments.set(
                raceKey,
                new Map(rankedCandidates.map((raceCandidate, index) => [
                    getCandidateVariantIdentity(raceCandidate),
                    index
                ]))
            );
        }
        const variantIndex = candidateRaceColourAssignments.get(raceKey).get(identity) ?? 0;
        const palette = candidateVariantPalettes[partyKey] || candidateVariantPalettes.I;
        return variantIndex === 0 ? baseColour : getExtendedPaletteColour(palette, variantIndex - 1);
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