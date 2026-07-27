"use strict";

const {
    buildGeneralCountyResults,
    normalizePrimaryCountyName
} = require("./primary-counties.js");

const SPECIAL_EVENT_FUNCTION = "specialElectCheck";
const STORE_VERSION = 3;
const RACE_TYPES = Object.freeze({
    usHouse: {
        key: "usHouse",
        eventTypes: ["ushouse"],
        tabLabel: "U.S. House",
        headline: "U.S. HOUSE SPECIAL ELECTIONS",
        officeLabel: "U.S. House"
    },
    usSenate: {
        key: "usSenate",
        eventTypes: ["ussenate"],
        tabLabel: "U.S. Senate",
        headline: "U.S. SENATE SPECIAL ELECTIONS",
        officeLabel: "U.S. Senate"
    },
    stateSenate: {
        key: "stateSenate",
        eventTypes: ["statesenate", "states"],
        tabLabel: "State Senate",
        headline: "STATE SENATE SPECIAL ELECTIONS",
        officeLabel: "State Senate",
        listOnly: true
    },
    stateHouse: {
        key: "stateHouse",
        eventTypes: ["statehouse", "stateh"],
        tabLabel: "State House",
        headline: "STATE HOUSE SPECIAL ELECTIONS",
        officeLabel: "State House",
        listOnly: true
    }
});
const DEFAULT_DURATION_SECONDS = 240;
const SPECIAL_REPORTING_START_SECONDS = 3;
const REPORTING_DELAY_BY_ZONE = Object.freeze({
    eastern: 5,
    central: 26,
    mountain: 48,
    pacific: 72,
    alaska: 88,
    hawaii: 102
});
const CENTRAL_STATES = new Set(["AL", "AR", "IA", "IL", "KS", "LA", "MN", "MO", "MS", "NE", "ND", "OK", "SD", "TN", "TX", "WI"]);
const MOUNTAIN_STATES = new Set(["AZ", "CO", "ID", "MT", "NM", "UT", "WY"]);
const PACIFIC_STATES = new Set(["CA", "NV", "OR", "WA"]);
const STATE_NAMES = Object.freeze({
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
    MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
    DC: "District of Columbia"
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const hashString = value => {
    let hash = 2166136261;
    const text = String(value || "");
    for(let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const getPartyKey = party => {
    const value = String(party || "").trim().toLowerCase();
    if(value === "d" || value.includes("democrat")) return "D";
    if(value === "r" || value.includes("republican")) return "R";
    if(value === "i" || value.includes("independent")) return "I";
    return String(party || "I").slice(0, 1).toUpperCase() || "I";
};

const getPartyColour = party => {
    const key = getPartyKey(party);
    if(key === "D") return "#168bd2";
    if(key === "R") return "#e62b2f";
    return "#858585";
};

const getEventEffectNames = event => {
    const effects = Array.isArray(event?.effects) ? event.effects : [];
    return effects.map(effect => String(effect?.functionID || effect?.functionId || effect?.id || ""));
};

const getSpecialEventRaceType = event => {
    const eventType = String(event?.vars?.electType || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");
    return Object.values(RACE_TYPES).find(type => type.eventTypes.includes(eventType))?.key || "";
};

const isStateLegislativeRaceType = raceType => (
    raceType === "stateSenate" || raceType === "stateHouse"
);

const raceTypeNeedsDistrict = raceType => raceType !== "usSenate";

const isSupportedSpecialEvent = event => {
    const vars = event?.vars || {};
    const raceType = getSpecialEventRaceType(event);
    if(!raceType) return false;
    return getEventEffectNames(event).includes(SPECIAL_EVENT_FUNCTION)
        && Number.isFinite(Number(vars.genWeek))
        && Number.isFinite(Number(vars.genYear))
        && Boolean(vars.electState)
        && (!raceTypeNeedsDistrict(raceType) || Number.isFinite(Number(vars.electDistrict)));
};

const isHouseSpecialEvent = event => {
    return getSpecialEventRaceType(event) === "usHouse" && isSupportedSpecialEvent(event);
};

const isSenateSpecialEvent = event => {
    return getSpecialEventRaceType(event) === "usSenate" && isSupportedSpecialEvent(event);
};

const getScheduledHouseSpecialEvents = (events, year, week) => {
    const currentYear = Number(year);
    const currentWeek = Number(week);
    return (Array.isArray(events) ? events : []).filter(event => {
        if(!isHouseSpecialEvent(event)) return false;
        return Number(event.vars.genYear) === currentYear
            && Number(event.vars.genWeek) === currentWeek;
    });
};

const getScheduledSpecialEvents = (events, year, week) => {
    const currentYear = Number(year);
    const currentWeek = Number(week);
    return (Array.isArray(events) ? events : []).filter(event => (
        isSupportedSpecialEvent(event)
        && Number(event.vars.genYear) === currentYear
        && Number(event.vars.genWeek) === currentWeek
    ));
};

const haveAllSpecialRaceResults = (events, races) => (
    Array.isArray(events)
    && events.length > 0
    && Array.isArray(races)
    && races.length === events.length
);

const getElectionArray = source => {
    if(Array.isArray(source)) return source;
    if(Array.isArray(source?.elections)) return source.elections;
    return [];
};

const getRaceCandidates = race => {
    if(Array.isArray(race?.cands) && race.cands.length) return race.cands;
    const readBucket = (bucket, fallbackParty) => {
        const candidates = Array.isArray(bucket?.cands) ? bucket.cands : [];
        const winners = candidates.filter(candidate => candidate?.win === true);
        const selected = winners.length ? winners : candidates;
        return selected.map(candidate => ({
            ...candidate,
            _bmSpecialParty: candidate?.party || fallbackParty
        }));
    };
    return [
        ...readBucket(race?.dem, "D"),
        ...readBucket(race?.rep, "R"),
        ...readBucket(race?.allCands, "I")
    ];
};

const getEventCandidatePartyByName = event => {
    const parties = new Map();
    const candidates = Array.isArray(event?.vars?.candidates) ? event.vars.candidates : [];
    candidates.forEach(candidate => {
        const party = Array.isArray(candidate) ? candidate[0] : candidate?.party;
        const name = Array.isArray(candidate)
            ? [candidate[4], candidate[5]].filter(Boolean).join(" ")
            : String(candidate?.name || [candidate?.fName, candidate?.lName].filter(Boolean).join(" "));
        const normalizedName = String(name || "").trim().toLowerCase();
        if(normalizedName) parties.set(normalizedName, getPartyKey(party));
    });
    return parties;
};

const getEventCandidateRecords = event => {
    const candidates = Array.isArray(event?.vars?.candidates) ? event.vars.candidates : [];
    return candidates.map((candidate, index) => {
        const party = Array.isArray(candidate) ? candidate[0] : candidate?.party;
        const firstName = Array.isArray(candidate)
            ? candidate[4]
            : candidate?.fName || candidate?.firstName;
        const lastName = Array.isArray(candidate)
            ? candidate[5]
            : candidate?.lName || candidate?.lastName || candidate?.surname;
        const name = String(
            Array.isArray(candidate)
                ? [firstName, lastName].filter(Boolean).join(" ")
                : candidate?.name || [firstName, lastName].filter(Boolean).join(" ")
        ).trim();
        return {
            id: Array.isArray(candidate)
                ? candidate[1] ?? candidate[2] ?? `${name || "candidate"}-${index}`
                : candidate?.id ?? candidate?.candID ?? `${name || "candidate"}-${index}`,
            name,
            lastName: String(lastName || name.split(/\s+/).pop() || "").trim(),
            party: getPartyKey(party)
        };
    }).filter(candidate => candidate.name);
};

const flattenHookStrings = (value, output = [], depth = 0, visited = new Set()) => {
    if(depth > 4 || value === null || value === undefined) return output;
    if(typeof value === "string") {
        output.push(value);
        return output;
    }
    if(typeof value !== "object" || visited.has(value)) return output;
    visited.add(value);
    const values = Array.isArray(value) ? value : Object.values(value);
    values.slice(0, 80).forEach(entry => flattenHookStrings(entry, output, depth + 1, visited));
    return output;
};

const parseSpecialNewsCapture = (hookArgs, event) => {
    const strings = flattenHookStrings(hookArgs);
    const source = strings.join("\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]+>/g, " ");
    const heading = source.match(
        /(U\.?S\.?\s+House|U\.?S\.?\s+Senate|State\s+House|State\s+Senate)\s+Special\s+Election\s+Results\s*\(\s*([A-Z]{2})(?:\s*-\s*(\d+))?\s*\)/i
    );
    if(!heading) return null;
    const office = heading[1].toLowerCase().replace(/[^a-z]/g, "");
    const type = office === "ushouse"
        ? "usHouse"
        : office === "ussenate"
            ? "usSenate"
            : office === "statesenate"
                ? "stateSenate"
                : "stateHouse";
    const state = heading[2].toUpperCase();
    const district = raceTypeNeedsDistrict(type) ? Number(heading[3]) : null;
    if(raceTypeNeedsDistrict(type) && !Number.isFinite(district)) return null;
    const eventCandidates = getEventCandidateRecords(event);
    const resultText = source
        .replace(/\r/g, "")
        .replace(/\bResults\s*:\s*/gi, "\n");
    const resultPattern = /(?:^|\n)\s*([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F.'\- ]{0,70}?)\s*:\s*([\d,]+)\s*\(([\d.]+)%\)/g;
    const cands = [];
    let match;
    while((match = resultPattern.exec(resultText))) {
        const reportedName = String(match[1] || "").trim();
        const normalizedReported = reportedName.toLowerCase();
        const metadata = eventCandidates.find(candidate => (
            candidate.name.toLowerCase() === normalizedReported
            || candidate.lastName.toLowerCase() === normalizedReported
        ));
        const votes = Number(String(match[2] || "0").replace(/,/g, ""));
        if(!reportedName || !Number.isFinite(votes)) continue;
        cands.push({
            id: metadata?.id ?? `${state}-${district}-${cands.length}`,
            name: metadata?.name || reportedName,
            lastName: metadata?.lastName || reportedName,
            party: metadata?.party || "I",
            votes,
            incumbent: String(metadata?.id ?? "") === String(event?.vars?.incumbID ?? "")
        });
    }
    if(cands.length < 2) return null;
    return { type, state, district, cands };
};

const parseStateSpecialNewsCapture = (hookArgs, event) => {
    const race = parseSpecialNewsCapture(hookArgs, event);
    return race && isStateLegislativeRaceType(race.type) ? race : null;
};

const findStateSpecialNewsRace = (event, newsCollections) => {
    if(!event || !isStateLegislativeRaceType(getSpecialEventRaceType(event))) return null;
    const vars = event.vars || {};
    const expectedType = getSpecialEventRaceType(event);
    const expectedState = String(vars.electState || "").toUpperCase();
    const expectedDistrict = Number(vars.electDistrict);
    const expectedWeek = Number(vars.genWeek);
    const entries = [];
    (Array.isArray(newsCollections) ? newsCollections : [newsCollections]).forEach(collection => {
        if(Array.isArray(collection)) entries.push(...collection);
        else if(collection !== null && collection !== undefined) entries.push(collection);
    });
    for(let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        const entryWeek = Number(entry?.week);
        if(Number.isFinite(entryWeek) && Number.isFinite(expectedWeek) && entryWeek !== expectedWeek) continue;
        const race = parseStateSpecialNewsCapture(entry, event);
        if(!race) continue;
        if(race.type === expectedType
            && race.state === expectedState
            && race.district === expectedDistrict) return race;
    }
    return null;
};

const findSpecialNewsRace = (event, newsCollections) => {
    if(!event || !isSupportedSpecialEvent(event)) return null;
    const vars = event.vars || {};
    const expectedType = getSpecialEventRaceType(event);
    const expectedState = String(vars.electState || "").toUpperCase();
    const expectedDistrict = raceTypeNeedsDistrict(expectedType)
        ? Number(vars.electDistrict)
        : null;
    const expectedWeek = Number(vars.genWeek);
    const expectedYear = Number(vars.genYear);
    const entries = [];
    (Array.isArray(newsCollections) ? newsCollections : [newsCollections]).forEach(collection => {
        if(Array.isArray(collection)) entries.push(...collection);
        else if(collection !== null && collection !== undefined) entries.push(collection);
    });
    for(let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        const entryWeek = Number(entry?.week);
        const entryYear = Number(entry?.year);
        if(Number.isFinite(entryWeek) && Number.isFinite(expectedWeek) && entryWeek !== expectedWeek) continue;
        if(Number.isFinite(entryYear) && Number.isFinite(expectedYear) && entryYear !== expectedYear) continue;
        const race = parseSpecialNewsCapture(entry, event);
        if(!race) continue;
        if(race.type === expectedType
            && race.state === expectedState
            && (!raceTypeNeedsDistrict(expectedType) || race.district === expectedDistrict)) return race;
    }
    return null;
};

const getSpecialRaceCandidateMatchScore = (event, race) => {
    const raceCandidates = getRaceCandidates(race);
    if(raceCandidates.length < 2) return -1;
    const eventCandidates = getEventCandidateRecords(event);
    const eventIds = new Set(eventCandidates.map(candidate => String(candidate.id)));
    const eventNames = new Set(eventCandidates.flatMap(candidate => [
        candidate.name.toLowerCase(),
        candidate.lastName.toLowerCase()
    ]).filter(Boolean));
    const incumbentId = String(event?.vars?.incumbID ?? "");
    let score = 0;
    raceCandidates.forEach(candidate => {
        const id = String(candidate?.id ?? candidate?.candID ?? "");
        const name = String(candidate?.name || [candidate?.fName, candidate?.lName].filter(Boolean).join(" "))
            .trim()
            .toLowerCase();
        const lastName = name.split(/\s+/).pop();
        if(id && eventIds.has(id)) score += 20;
        if(name && eventNames.has(name)) score += 10;
        else if(lastName && eventNames.has(lastName)) score += 5;
        if(incumbentId && id === incumbentId) score += 30;
    });
    return score;
};

const findSpecialHouseRace = (event, houseElectionNight) => {
    const vars = event?.vars || {};
    const state = String(vars.electState || "").toUpperCase();
    const district = Number(vars.electDistrict);
    const matches = getElectionArray(houseElectionNight).filter(race => (
        String(race?.state || "").toUpperCase() === state
        && Number(race?.district) === district
        && Array.isArray(race?.cands)
        && race.cands.length >= 2
    ));

    return matches
        .map((race, index) => ({ race, index, score: getSpecialRaceCandidateMatchScore(event, race) }))
        .filter(entry => entry.score > 0)
        .sort((left, right) => right.score - left.score || right.index - left.index)[0]?.race || null;
};

const findSpecialSenateRace = (event, senateElectionNight) => {
    const state = String(event?.vars?.electState || "").toUpperCase();
    const matches = getElectionArray(senateElectionNight).filter(race => (
        String(race?.state || race?.stateId || race?.stateID || "").toUpperCase() === state
        && getRaceCandidates(race).length >= 2
    ));

    return matches
        .map((race, index) => ({ race, index, score: getSpecialRaceCandidateMatchScore(event, race) }))
        .filter(entry => entry.score > 0)
        .sort((left, right) => right.score - left.score || right.index - left.index)[0]?.race || null;
};

const findSpecialStateLegislativeRace = (event, capturedRace) => {
    const vars = event?.vars || {};
    const state = String(vars.electState || "").toUpperCase();
    const district = Number(vars.electDistrict);
    const directCandidates = [
        vars.stateElection,
        vars.specialElection,
        vars.electionResult,
        capturedRace
    ].filter(Boolean);
    const direct = directCandidates.find(race => getRaceCandidates(race).length >= 2);
    if(direct) return direct;
    const matches = getElectionArray(capturedRace).filter(race => (
        String(race?.state || race?.stateId || race?.stateID || state).toUpperCase() === state
        && Number(race?.district ?? race?.electDistrict) === district
        && getRaceCandidates(race).length >= 2
    ));
    return matches.length ? matches[matches.length - 1] : null;
};

const findSpecialRace = (event, electionNights = {}) => {
    const raceType = getSpecialEventRaceType(event);
    if(raceType === "usSenate") {
        return findSpecialSenateRace(event, electionNights.usSenate);
    }
    if(raceType === "usHouse") {
        return findSpecialHouseRace(event, electionNights.usHouse);
    }
    if(isStateLegislativeRaceType(raceType)) {
        return findSpecialStateLegislativeRace(event, electionNights[raceType]);
    }
    return null;
};

const getSpecialCandidateLastName = candidate => {
    const explicitLastName = String(
        candidate?.lastName
        || candidate?.lName
        || candidate?.surname
        || ""
    ).trim();
    if(explicitLastName) return explicitLastName;
    const fullName = String(candidate?.name || "").trim();
    if(!fullName) return "Candidate";
    return fullName.split(/\s+/).pop();
};

const normalizeRace = (event, race) => {
    if(!event || !race) return null;
    const vars = event.vars || {};
    const state = String(vars.electState || race.state || "").toUpperCase();
    const raceType = getSpecialEventRaceType(event) || "usHouse";
    const district = raceTypeNeedsDistrict(raceType)
        ? Number(vars.electDistrict ?? race.district)
        : null;
    const eventCandidateParties = getEventCandidatePartyByName(event);
    const candidates = getRaceCandidates(race).map((candidate, index) => {
        const candidateName = String(
            candidate?.name
            || [candidate?.fName || candidate?.firstName, candidate?.lName || candidate?.lastName]
                .filter(Boolean)
                .join(" ")
            || `Candidate ${index + 1}`
        ).trim();
        return ({
        id: candidate?.id ?? candidate?.candID ?? `${state}-${district ?? raceType}-${index}`,
        name: candidateName,
        lastName: getSpecialCandidateLastName({ ...candidate, name: candidateName }),
        party: getPartyKey(
            candidate?.party
            || candidate?._bmSpecialParty
            || eventCandidateParties.get(candidateName.toLowerCase())
        ),
        finalVotes: Math.max(0, Math.round(Number(
            candidate?.votes
            ?? candidate?.totVotes
            ?? candidate?.finalVotes
            ?? candidate?.currentVotes
        ) || 0)),
        incumbent: Boolean(candidate?.incumbent || candidate?.incumb)
            || String(candidate?.id ?? candidate?.candID ?? "") === String(vars.incumbID ?? "")
        });
    });
    if(candidates.length < 2 || candidates.every(candidate => candidate.finalVotes <= 0)) return null;
    return {
        id: `${raceType}-${state}-${district ?? "statewide"}-${event.id || "special"}`,
        eventId: String(event.id || ""),
        type: raceType,
        state,
        stateName: STATE_NAMES[state] || state,
        district,
        title: raceType === "usSenate"
            ? `${STATE_NAMES[state] || state} - U.S. Senate`
            : isStateLegislativeRaceType(raceType)
                ? `${STATE_NAMES[state] || state} - ${RACE_TYPES[raceType].officeLabel} District ${district}`
                : `${STATE_NAMES[state] || state} - District ${district}`,
        candidates
    };
};

const formatPromptRaceLabel = race => {
    if(race?.type === "usSenate") {
        return `${race.stateName || STATE_NAMES[race.state] || race.state} U.S. Senate`;
    }
    if(isStateLegislativeRaceType(race?.type)) {
        return `${race?.state || ""} ${RACE_TYPES[race.type].officeLabel} District ${race?.district}`.trim();
    }
    return `${race?.state || ""} District ${race?.district}`.trim();
};

const buildStepCumulative = (finalVotes, seedValue, steps = 100) => {
    const total = Math.max(0, Math.round(Number(finalVotes) || 0));
    if(total === 0) return new Array(steps + 1).fill(0);
    const seed = hashString(seedValue);
    const phase = ((seed % 6283) / 1000);
    const frequency = 0.105 + ((seed >>> 8) % 37) / 1000;
    const amplitude = 0.29 + ((seed >>> 16) % 12) / 100;
    const weights = [];
    for(let step = 0; step < steps; step++) {
        const wave = Math.sin((step + 1) * frequency + phase);
        const secondWave = Math.cos((step + 1) * frequency * 0.47 + phase * 0.6);
        weights.push(Math.max(0.12, 1 + amplitude * wave + 0.12 * secondWave));
    }
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const exact = weights.map(weight => total * weight / weightTotal);
    const allocations = exact.map(value => Math.floor(value));
    let remaining = total - allocations.reduce((sum, value) => sum + value, 0);
    exact
        .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
        .sort((left, right) => right.remainder - left.remainder)
        .slice(0, remaining)
        .forEach(entry => { allocations[entry.index]++; });
    const cumulative = [0];
    allocations.forEach(value => cumulative.push(cumulative[cumulative.length - 1] + value));
    cumulative[cumulative.length - 1] = total;
    return cumulative;
};

const buildReportingMilestones = seedValue => {
    const firstReport = 9 + (hashString(`${seedValue}-opening`) % 4);
    const milestones = [firstReport];
    let reported = firstReport;
    let batch = 0;
    while(reported < 100) {
        const remaining = 100 - reported;
        if(remaining <= 5) {
            milestones.push(100);
            break;
        }
        const jump = 4 + (hashString(`${seedValue}-batch-${batch}`) % 8);
        reported = Math.min(100, reported + jump);
        milestones.push(reported);
        batch++;
    }
    if(milestones[milestones.length - 1] !== 100) milestones.push(100);
    return milestones;
};

const buildRaceRevealModel = race => ({
    ...race,
    reportingDelaySeconds: getRaceReportingDelaySeconds(race),
    reportingMilestones: buildReportingMilestones(race.id),
    candidates: race.candidates.map((candidate, index) => ({
        ...candidate,
        cumulative: buildStepCumulative(candidate.finalVotes, `${race.id}-${candidate.id}-${index}`)
    }))
});

const getRaceReportingDelaySeconds = race => {
    const state = String(race?.state || "").toUpperCase();
    let base = REPORTING_DELAY_BY_ZONE.eastern;
    if(state === "AK") base = REPORTING_DELAY_BY_ZONE.alaska;
    else if(state === "HI") base = REPORTING_DELAY_BY_ZONE.hawaii;
    else if(PACIFIC_STATES.has(state)) base = REPORTING_DELAY_BY_ZONE.pacific;
    else if(MOUNTAIN_STATES.has(state)) base = REPORTING_DELAY_BY_ZONE.mountain;
    else if(CENTRAL_STATES.has(state)) base = REPORTING_DELAY_BY_ZONE.central;

    return base + (hashString(race?.id || `${state}-${race?.district || 0}`) % 7);
};

const buildRaceRevealModels = races => {
    const models = (races || []).map(race => buildRaceRevealModel(race));
    if(!models.length) return models;
    const earliestDelay = Math.min(...models.map(model => model.reportingDelaySeconds));
    return models.map(model => ({
        ...model,
        reportingDelaySeconds: SPECIAL_REPORTING_START_SECONDS
            + Math.max(0, model.reportingDelaySeconds - earliestDelay)
    }));
};

const getRaceProgress = (raceModel, session) => {
    const duration = Math.max(1, Number(session?.durationSeconds || DEFAULT_DURATION_SECONDS));
    const elapsed = clamp(Number(session?.elapsedSeconds || 0), 0, duration);
    const delay = clamp(Number(raceModel?.reportingDelaySeconds || 0), 0, duration - 1);
    if(elapsed <= delay) return 0;
    const rawProgress = clamp((elapsed - delay) / (duration - delay) * 100, 0, 100);
    if(rawProgress >= 100) return 100;
    const milestones = Array.isArray(raceModel?.reportingMilestones)
        && raceModel.reportingMilestones.length
        ? raceModel.reportingMilestones
        : buildReportingMilestones(raceModel?.id || "special-race");
    let displayedProgress = milestones[0];
    for(const milestone of milestones) {
        if(milestone > rawProgress) break;
        displayedProgress = milestone;
    }
    return displayedProgress;
};

const getVisibleRace = (raceModel, progress) => {
    const reporting = clamp(Number(progress) || 0, 0, 100);
    const wholeStep = Math.floor(reporting);
    const candidates = raceModel.candidates.map(candidate => ({
        ...candidate,
        currentVotes: reporting >= 100
            ? candidate.finalVotes
            : Number(candidate.cumulative[wholeStep] || 0)
    })).sort((left, right) => right.currentVotes - left.currentVotes || right.finalVotes - left.finalVotes);
    const currentTotal = candidates.reduce((sum, candidate) => sum + candidate.currentVotes, 0);
    const finalTotal = candidates.reduce((sum, candidate) => sum + candidate.finalVotes, 0);
    const leader = candidates[0] || null;
    const runnerUp = candidates[1] || null;
    const lead = Math.max(0, Number(leader?.currentVotes || 0) - Number(runnerUp?.currentVotes || 0));
    const remaining = Math.max(0, finalTotal - currentTotal);
    const marginPoints = currentTotal > 0
        ? lead / currentTotal * 100
        : 0;
    const mathematicallyCalled = reporting >= 65 && lead > remaining;
    const projected = reporting >= 100 || mathematicallyCalled || (reporting >= 95 && marginPoints > 2);
    return {
        ...raceModel,
        candidates,
        reporting,
        currentTotal,
        finalTotal,
        leader,
        runnerUp,
        lead,
        marginPoints,
        projected
    };
};

const getTooCloseThreshold = reported => {
    const start = 65;
    const end = 95;
    const maxThreshold = 5.0;
    const minThreshold = 1.5;
    const progress = clamp((Number(reported || 0) - start) / (end - start), 0, 1);
    return minThreshold + (maxThreshold - minThreshold) * (1 - Math.pow(progress, 1.8));
};

const getRaceStatus = race => {
    if(race.reporting <= 0 || race.currentTotal <= 0) return { text: "PENDING REPORT", kind: "pending" };
    if(race.projected) return { text: "PROJECTED WINNER", kind: "projected" };
    if(race.reporting >= 65 && race.marginPoints <= getTooCloseThreshold(race.reporting)) {
        return { text: "TOO CLOSE TO CALL", kind: "close" };
    }
    if(race.reporting < 10) return { text: "COUNTING VOTES", kind: "counting" };
    let threshold = null;
    if(race.reporting >= 10 && race.reporting < 25) threshold = 25;
    else if(race.reporting < 45) threshold = 18;
    else if(race.reporting < 65) threshold = 12;
    if(threshold !== null && race.marginPoints <= threshold) {
        return { text: "TOO EARLY TO CALL", kind: "early" };
    }
    return { text: "COUNTING VOTES", kind: "counting" };
};

const isSpecialRaceFlip = race => {
    if(!race?.projected || !race?.leader) return false;
    const incumbent = (race.candidates || []).find(candidate => candidate?.incumbent) || null;
    if(!race.leader.incumbent) return true;
    return Boolean(
        incumbent
        && getPartyKey(incumbent.party) !== getPartyKey(race.leader.party)
    );
};

const canEnterCountyResults = race => Boolean(race && Number(race.currentTotal) > 0);

const formatNumber = value => Math.round(Number(value) || 0).toLocaleString("en-US");

const getRegisteredVotersFromStats = stats => {
    const population = Number(stats?.pop ?? stats?.population) || 0;
    const rawRegistered = Number(stats?.regVoters ?? stats?.registeredVoters);
    if(!Number.isFinite(rawRegistered) || rawRegistered <= 0) return 0;
    if(rawRegistered > 100) return Math.round(rawRegistered);
    const registeredFraction = rawRegistered > 1 ? rawRegistered / 100 : rawRegistered;
    return Math.round(population * registeredFraction);
};

const calculateSpecialRaceTurnout = (race, sources = {}) => {
    if(!race || Number(race.reporting) < 99.999 || Number(race.finalTotal) <= 0) return null;
    let registered = 0;
    if(race.type === "stateHouse") {
        registered = getRegisteredVotersFromStats(sources.stateHouseStats);
    } else if(race.type === "stateSenate") {
        registered = getRegisteredVotersFromStats(sources.stateSenateStats);
    } else if(race.type === "usHouse") {
        const districtStats = (Array.isArray(sources.houseDistricts) ? sources.houseDistricts : [])
            .find(district => (
                String(district?.state || "").toUpperCase() === String(race.state || "").toUpperCase()
                && Number(district?.district) === Number(race.district)
            ));
        registered = getRegisteredVotersFromStats(districtStats);
    }

    if(registered <= 0 && race.type === "usSenate") {
        registered = getRegisteredVotersFromStats(sources.stateStats);
    }
    if(registered <= 0) return null;
    return clamp(Number(race.finalTotal) / registered * 100, 0, 100);
};

const formatSpecialCountyDisplayName = value => String(value || "")
    .trim()
    .replace(/\s+county$/i, "")
    .trim();

const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if(className) element.className = className;
    if(text !== undefined && text !== null) element.textContent = String(text);
    return element;
};

const createSpecialElectionNight = options => {
    const {
        fs,
        path,
        basePath,
        getCurrentYear,
        getCurrentWeek,
        getActiveEvents,
        getHouseElectionNight,
        getSenateElectionNight,
        getStateNews,
        getNationNews,
        getHouseDistricts,
        getStateHouseElectStats,
        getStateSenateElectStats,
        playClick = () => {}
    } = options || {};

    let installed = false;
    let scanTimer = null;
    let tickTimer = null;
    let promptingSessionId = null;
    let activeSession = null;
    let raceModels = [];
    let root = null;
    let modal = null;
    let blocker = null;
    let reopenButton = null;
    let mapHost = null;
    let panelHost = null;
    let clockLabel = null;
    let pauseButton = null;
    let titleLabel = null;
    let currentView = { type: "nation", state: null };
    let activeRaceType = "usHouse";
    let speed = 1;
    let playing = true;
    let lastTickAt = 0;
    let mapPaths = new Map();
    let countyResultsCache = new Map();
    let countyNamesByRace = new Map();
    let hoverTip = null;
    let hoveredRaceId = null;
    let hoveredRacePoint = null;
    let hoveredCountyKey = null;
    let currentSpecialHookEvent = null;
    const capturedStateRaces = new Map();

    const safePlayClick = () => {
        try { playClick(); } catch {}
    };

    const getStore = () => {
        if(!globalThis.Executive?.game?.loaded) return null;
        const saveData = Executive.mods.saveData;
        if(!saveData.specialElectionNight || typeof saveData.specialElectionNight !== "object") {
            saveData.specialElectionNight = { version: STORE_VERSION, sessions: [] };
        }
        const store = saveData.specialElectionNight;
        store.version = STORE_VERSION;
        if(!Array.isArray(store.sessions)) store.sessions = [];
        if(!Array.isArray(store.capturedStateRaces)) store.capturedStateRaces = [];
        return store;
    };

    const getEventCaptureKey = event => {
        const vars = event?.vars || {};
        return [
            Number(vars.genYear) || 0,
            Number(vars.genWeek) || 0,
            getSpecialEventRaceType(event),
            String(vars.electState || "").toUpperCase(),
            Number(vars.electDistrict) || 0
        ].join("-");
    };

    const rememberCapturedStateRace = (event, race) => {
        if(!event || !race) return;
        const key = getEventCaptureKey(event);
        capturedStateRaces.set(key, race);
        const store = getStore();
        if(!store) return;
        const existingIndex = store.capturedStateRaces.findIndex(entry => entry?.key === key);
        const entry = { key, race };
        if(existingIndex >= 0) store.capturedStateRaces[existingIndex] = entry;
        else store.capturedStateRaces.push(entry);
    };

    const getCapturedStateRace = event => {
        const key = getEventCaptureKey(event);
        if(capturedStateRaces.has(key)) return capturedStateRaces.get(key);
        const saved = getStore()?.capturedStateRaces?.find(entry => entry?.key === key)?.race || null;
        if(saved) capturedStateRaces.set(key, saved);
        return saved;
    };

    const resolveHookEvent = args => {
        const values = Array.isArray(args) ? args : [args];
        const objects = [];
        const visited = new Set();
        const visit = (value, depth = 0) => {
            if(!value || typeof value !== "object" || depth > 3 || visited.has(value)) return;
            visited.add(value);
            objects.push(value);
            if(Array.isArray(value)) value.slice(0, 40).forEach(entry => visit(entry, depth + 1));
            else Object.values(value).slice(0, 60).forEach(entry => visit(entry, depth + 1));
        };
        values.forEach(value => visit(value));
        const directEvent = objects.find(value => value?.vars?.electType);
        if(directEvent) return directEvent;
        const directVars = objects.find(value => value?.electType && value?.electState);
        if(!directVars) return null;
        const matchingEvent = (getActiveEvents?.() || []).find(event => (
            event?.vars === directVars
            || (
                String(event?.vars?.electType || "").toLowerCase() === String(directVars.electType || "").toLowerCase()
                && String(event?.vars?.electState || "").toUpperCase() === String(directVars.electState || "").toUpperCase()
                && Number(event?.vars?.electDistrict || 0) === Number(directVars.electDistrict || 0)
                && Number(event?.vars?.genYear || 0) === Number(directVars.genYear || 0)
                && Number(event?.vars?.genWeek || 0) === Number(directVars.genWeek || 0)
            )
        ));
        return matchingEvent || {
            id: `captured-${Date.now()}`,
            effects: [{ functionID: SPECIAL_EVENT_FUNCTION }],
            vars: directVars
        };
    };

    const captureStateNewsResult = hookArgs => {
        const year = Number(getCurrentYear?.());
        const week = Number(getCurrentWeek?.());
        const candidates = [
            currentSpecialHookEvent,
            ...getScheduledSpecialEvents(getActiveEvents?.(), year, week)
        ].filter((event, index, events) => (
            event
            && events.indexOf(event) === index
        ));
        for(const event of candidates) {
            const race = parseSpecialNewsCapture(hookArgs, event);
            if(!race) continue;
            const vars = event.vars || {};
            if(race.type !== getSpecialEventRaceType(event)
                || race.state !== String(vars.electState || "").toUpperCase()
                || (
                    raceTypeNeedsDistrict(race.type)
                    && race.district !== Number(vars.electDistrict)
                )) continue;
            rememberCapturedStateRace(event, race);
            break;
        }
    };

    const getRuntimeNewsCollections = () => {
        const collections = [];
        const seen = new Set();
        const add = value => {
            if(!Array.isArray(value) || seen.has(value)) return;
            if(!value.some(entry => (
                entry
                && typeof entry === "object"
                && (typeof entry.title === "string" || typeof entry.news === "string")
            ))) return;
            seen.add(value);
            collections.push(value);
        };
        const inspectNewsProperties = rootObject => {
            if(!rootObject || (typeof rootObject !== "object" && typeof rootObject !== "function")) return;
            let descriptors;
            try { descriptors = Object.getOwnPropertyDescriptors(rootObject); } catch { return; }
            Object.entries(descriptors).forEach(([key, descriptor]) => {
                if(!/news/i.test(key) || !("value" in descriptor)) return;
                add(descriptor.value);
            });
        };
        inspectNewsProperties(globalThis);
        inspectNewsProperties(globalThis.Executive);
        inspectNewsProperties(globalThis.Executive?.game);
        inspectNewsProperties(globalThis.Executive?.mods);
        inspectNewsProperties(globalThis.Executive?.mods?.saveData);
        return collections;
    };

    const recoverStateNewsResults = events => {
        const specialEvents = (Array.isArray(events) ? events : []).filter(event => (
            !getCapturedStateRace(event)
        ));
        if(!specialEvents.length) return;
        const collections = getRuntimeNewsCollections();
        const savedStateNews = getStateNews?.();
        const savedNationNews = getNationNews?.();
        if(Array.isArray(savedStateNews)) collections.push(savedStateNews);
        if(Array.isArray(savedNationNews)) collections.push(savedNationNews);

        const visibleNewsText = document?.body?.innerText || "";
        if(/(?:U\.?S\.?|State)\s+(?:House|Senate)\s+Special\s+Election\s+Results/i.test(visibleNewsText)) {
            collections.push([{ week: Number(getCurrentWeek?.()), news: visibleNewsText }]);
        }
        specialEvents.forEach(event => {
            const race = findSpecialNewsRace(event, collections);
            if(race) rememberCapturedStateRace(event, race);
        });
    };

    const makeSessionId = (year, week) => `special-election-${Number(year)}-${Number(week)}`;

    const collectCurrentSessionData = () => {
        const year = Number(getCurrentYear?.());
        const week = Number(getCurrentWeek?.());
        if(!Number.isFinite(year) || !Number.isFinite(week)) return null;
        const currentActiveEvents = getActiveEvents?.();
        const activeEventList = Array.isArray(currentActiveEvents)
            ? [...currentActiveEvents]
            : [];

        if(currentSpecialHookEvent && !activeEventList.includes(currentSpecialHookEvent)) {
            activeEventList.push(currentSpecialHookEvent);
        }
        const events = getScheduledSpecialEvents(activeEventList, year, week);
        if(!events.length) return null;
        recoverStateNewsResults(events);
        const resolvedRaces = events.map(event => normalizeRace(
            event,
            getCapturedStateRace(event) || findSpecialRace(event, {
                usHouse: getHouseElectionNight?.(),
                usSenate: getSenateElectionNight?.(),
                stateSenate: null,
                stateHouse: null
            })
        ));
        const races = resolvedRaces.filter(Boolean);

        if(!haveAllSpecialRaceResults(events, races)) return null;
        return { id: makeSessionId(year, week), year, week, races };
    };

    const ensureSession = data => {
        const store = getStore();
        if(!store || !data) return null;
        let session = store.sessions.find(entry => entry?.id === data.id);
        if(!session) {
            session = {
                id: data.id,
                year: data.year,
                week: data.week,
                status: "pending",
                decision: "pending",
                progress: 0,
                elapsedSeconds: 0,
                durationSeconds: DEFAULT_DURATION_SECONDS,
                races: data.races,
                createdAt: Date.now()
            };
            store.sessions.push(session);
        } else {
            const racesById = new Map(
                (Array.isArray(session.races) ? session.races : [])
                    .filter(Boolean)
                    .map(race => [race.id, race])
            );
            data.races.forEach(race => racesById.set(race.id, race));
            session.races = Array.from(racesById.values());
        }
        return session;
    };

    const removeBlocker = () => {
        blocker?.remove();
        blocker = null;
    };

    const showBlockerIfScheduled = () => {
        if(root || modal || blocker) return;
        const year = Number(getCurrentYear?.());
        const week = Number(getCurrentWeek?.());
        const events = getScheduledSpecialEvents(getActiveEvents?.(), year, week);
        if(!events.length) return;
        blocker = createElement("div", "bm-special-election-blocker");
        blocker.appendChild(createElement("div", "bm-special-election-loading", "Preparing special election results…"));
        document.body?.appendChild(blocker);
    };

    const dismissPrompt = () => {
        modal?.remove();
        modal = null;
        promptingSessionId = null;
        removeBlocker();
    };

    const showPrompt = session => {
        if(!session || promptingSessionId === session.id || root) return;
        promptingSessionId = session.id;
        removeBlocker();
        modal = createElement("div", "bm-special-election-modal-backdrop");
        const card = createElement("div", "bm-special-election-modal");
        card.appendChild(createElement("div", "bm-special-election-modal-kicker", "SPECIAL ELECTION"));
        card.appendChild(createElement("h2", "", "Watch special election night coverage?"));
        const raceNames = session.races.map(formatPromptRaceLabel).join(" · ");
        card.appendChild(createElement("p", "", `${raceNames}.`));
        const actions = createElement("div", "bm-special-election-modal-actions");
        const yes = createElement("button", "bm-special-election-primary", "Watch Coverage");
        const no = createElement("button", "", "Skip Coverage");
        yes.addEventListener("click", () => {
            safePlayClick();
            session.decision = "watch";
            session.status = session.progress >= 100 ? "completed" : "counting";
            dismissPrompt();
            openSession(session);
        });
        no.addEventListener("click", () => {
            safePlayClick();
            session.decision = "skip";
            session.status = "dismissed";
            dismissPrompt();
        });
        actions.append(yes, no);
        card.appendChild(actions);
        modal.appendChild(card);
        document.body?.appendChild(modal);

        const pendingModal = modal;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if(modal === pendingModal && pendingModal.isConnected) {
                    pendingModal.classList.add("bm-special-election-modal-ready");
                }
            });
        });
    };

    const loadInlineSvg = relativeFile => {
        try {
            const absolute = path.join(basePath, relativeFile);
            const raw = fs.readFileSync(absolute, "utf8");
            const parsed = new DOMParser().parseFromString(raw, "image/svg+xml");
            const source = parsed.documentElement;
            if(!source || String(source.nodeName).toLowerCase() !== "svg") return null;
            source.querySelectorAll("script").forEach(script => script.remove());
            const svg = document.importNode(source, true);

            const width = Number.parseFloat(source.getAttribute("width"));
            const height = Number.parseFloat(source.getAttribute("height"));
            if(!svg.hasAttribute("viewBox") && width > 0 && height > 0) {
                svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
            }
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            svg.classList.add("bm-special-election-svg");
            return svg;
        } catch(error) {
            globalThis.bmSpecialElectionMapError = error;
            return null;
        }
    };

    const getVisibleRaces = () => raceModels.map(model => getVisibleRace(
        model,
        getRaceProgress(model, activeSession)
    ));

    const getActiveVisibleRaces = () => getVisibleRaces().filter(race => (
        String(race.type || "usHouse") === activeRaceType
    ));

    const getRaceForStateDistrict = (state, district) => getActiveVisibleRaces().find(race => (
        race.state === state && Number(race.district) === Number(district)
    )) || null;

    const getStateRaces = state => getActiveVisibleRaces().filter(race => race.state === state);

    const getCountyResultsForRace = (race, fallbackCountyNames = countyNamesByRace.get(race?.id) || []) => {
        if(!canEnterCountyResults(race)) return null;
        const stableCandidates = race.candidates.slice().sort((left, right) =>
            String(left.id).localeCompare(String(right.id))
        );
        const countySignature = fallbackCountyNames
            .map(name => normalizePrimaryCountyName(name, race.state))
            .join(",");
        const signature = `${race.id}|${stableCandidates.map(candidate => (
            `${candidate.id}:${candidate.finalVotes}:${candidate.currentVotes}`
        )).join(",")}|${countySignature}`;
        if(countyResultsCache.has(signature)) return countyResultsCache.get(signature);
        const result = buildGeneralCountyResults(
            race.state,
            stableCandidates,
            race.id,
            fallbackCountyNames
        );
        if(countyResultsCache.size > 80) countyResultsCache.clear();
        if(result) countyResultsCache.set(signature, result);
        return result;
    };

    const getCountyResultMap = (race, fallbackCountyNames) => new Map(
        (getCountyResultsForRace(race, fallbackCountyNames)?.counties || []).map(county => [
            normalizePrimaryCountyName(county.name, race.state),
            county
        ])
    );

    const paintPath = (pathElement, fill, stroke = "#ffffff") => {
        if(!pathElement) return;
        pathElement.style.setProperty("fill", fill, "important");
        pathElement.style.setProperty("stroke", stroke, "important");
        pathElement.style.setProperty("stroke-width", "1.5", "important");
        pathElement.style.setProperty("opacity", "1", "important");
    };

    const getRaceMapColour = race => {
        if(!race || race.reporting <= 0 || race.currentTotal <= 0) return "#ffd51a";
        return getPartyColour(race.leader?.party);
    };

    const showHover = (event, text) => {
        hoveredRaceId = null;
        hoveredRacePoint = null;
        hoveredCountyKey = null;
        if(!hoverTip) {
            hoverTip = createElement("div", "bm-special-election-hover");
            root?.appendChild(hoverTip);
        }
        hoverTip.textContent = text;
        hoverTip.style.left = `${event.clientX + 14}px`;
        hoverTip.style.top = `${event.clientY + 14}px`;
        hoverTip.classList.add("visible");
    };

    const createTooltipCandidateRow = (candidate, total, projectedWinner) => {
        const row = createElement("div", `bm-special-tooltip-candidate${projectedWinner ? " winner" : ""}`);
        const candidateColour = getPartyColour(candidate.party);
        row.style.setProperty("--bm-special-candidate-colour", candidateColour);
        const identity = createElement("div", "bm-special-tooltip-identity");
        const name = createElement("strong", "bm-special-tooltip-name", `${candidate.name}${candidate.incumbent ? " *" : ""}`);
        const party = createElement("span", "bm-special-tooltip-party", candidate.party);
        party.style.background = candidateColour;
        const votes = createElement("span", "bm-special-tooltip-votes", formatNumber(candidate.currentVotes));
        const percentage = total > 0 ? candidate.currentVotes / total * 100 : 0;
        const pct = createElement("strong", "bm-special-tooltip-pct", `${percentage.toFixed(2)}%`);
        if(projectedWinner) name.appendChild(createElement("span", "bm-special-tooltip-check", "✓"));
        const winnerCheck = name.querySelector(".bm-special-tooltip-check");
        if(winnerCheck) winnerCheck.textContent = String.fromCodePoint(0x2713);
        identity.append(name);
        row.append(identity, party, votes, pct);
        return row;
    };

    const createSpecialWinnerIcon = () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 14 14");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("bm-special-tooltip-winner-icon");
        const check = document.createElementNS("http://www.w3.org/2000/svg", "path");
        check.setAttribute("fill", "none");
        check.setAttribute("d", "M12,3.5l-6.81,7L2,7.8");
        svg.appendChild(check);
        return svg;
    };

    const createSpecialFlipBadge = () => {
        const badge = createElement("span", "bm-special-flip-badge");
        badge.append(
            createElement("span", "bm-special-flip-plus", "+"),
            createElement("span", "bm-special-flip-text", "FLIP")
        );
        return badge;
    };

    const createSpecialTooltipCandidateRow = (candidate, total, projectedWinner) => {
        const row = createElement("div", `bm-special-tooltip-candidate${projectedWinner ? " winner" : ""}`);
        const candidateColour = getPartyColour(candidate.party);
        row.style.setProperty("--bm-special-candidate-colour", candidateColour);
        const identity = createElement("div", "bm-special-tooltip-identity");
        const name = createElement(
            "strong",
            "bm-special-tooltip-name",
            `${candidate.lastName || getSpecialCandidateLastName(candidate)}${candidate.incumbent ? " *" : ""}`
        );
        if(projectedWinner) name.appendChild(createSpecialWinnerIcon());
        const party = createElement("span", "bm-special-tooltip-party", candidate.party);
        party.style.background = candidateColour;
        const votes = createElement("span", "bm-special-tooltip-votes", formatNumber(candidate.currentVotes));
        const percentage = total > 0 ? candidate.currentVotes / total * 100 : 0;
        const pct = createElement("strong", "bm-special-tooltip-pct", `${percentage.toFixed(2)}%`);
        identity.append(name);
        row.append(identity, party, votes, pct);
        return row;
    };

    const getSpecialRaceTurnoutText = race => {
        const stateId = String(race.state || "").toLowerCase();
        const turnout = calculateSpecialRaceTurnout(race, {
            stateStats: globalThis.Executive?.data?.states?.[stateId],
            houseDistricts: getHouseDistricts?.(),
            stateHouseStats: getStateHouseElectStats?.(),
            stateSenateStats: getStateSenateElectStats?.()
        });
        if(!Number.isFinite(turnout)) return "";
        return `Turnout: ${turnout.toFixed(1)}%`;
    };

    const showRaceTooltip = (event, raceId) => {
        const race = getActiveVisibleRaces().find(entry => entry.id === raceId);
        if(!race) return;
        hoveredRaceId = raceId;
        hoveredCountyKey = null;
        hoveredRacePoint = {
            clientX: Number(event?.clientX) || 0,
            clientY: Number(event?.clientY) || 0
        };
        if(!hoverTip) {
            hoverTip = createElement("div", "bm-special-election-hover bm-special-election-result-tooltip");
            root?.appendChild(hoverTip);
        }
        hoverTip.className = "bm-special-election-hover bm-special-election-result-tooltip visible";
        hoverTip.replaceChildren();
        hoverTip.style.setProperty(
            "--bm-special-tooltip-accent",
            race.currentTotal > 0 && race.leader
                ? getPartyColour(race.leader.party)
                : "#737373"
        );
        const turnoutText = getSpecialRaceTurnoutText(race);
        if(turnoutText) {
            hoverTip.appendChild(createElement("div", "bm-special-tooltip-turnout", turnoutText));
        }
        const status = getRaceStatus(race);
        if(status.kind !== "pending" && status.kind !== "counting") {
            const statusElement = createElement("div", `bm-special-tooltip-status ${status.kind}`, status.text);
            if(status.kind === "projected") {
                statusElement.appendChild(createSpecialWinnerIcon());
                if(isSpecialRaceFlip(race)) {
                    statusElement.appendChild(createSpecialFlipBadge());
                }
            }
            hoverTip.appendChild(statusElement);
        }
        const header = createElement("div", "bm-special-tooltip-columns");
        header.append(
            createElement("strong", "", "State"),
            createElement("strong", "", "Candidate"),
            createElement("strong", "", "Party"),
            createElement("strong", "", "Votes"),
            createElement("strong", "", "Pct.")
        );
        hoverTip.appendChild(header);
        const body = createElement("div", "bm-special-tooltip-body");
        const location = createElement("div", "bm-special-tooltip-location");
        location.append(
            createElement(
                "strong",
                "",
                race.type === "usSenate"
                    ? String(race.stateName || STATE_NAMES[race.state] || race.state).toUpperCase()
                    : isStateLegislativeRaceType(race.type)
                        ? `${String(race.stateName || STATE_NAMES[race.state] || race.state).toUpperCase()} - ${RACE_TYPES[race.type].officeLabel.toUpperCase()} DISTRICT ${race.district}`
                        : `${String(race.stateName || STATE_NAMES[race.state] || race.state).toUpperCase()} - DISTRICT ${race.district}`
            ),
            createElement("span", "", `${race.reporting.toFixed(0)}% in`)
        );
        if(race.currentTotal > 0) {
            location.appendChild(createElement(
                "span",
                "bm-special-tooltip-margin",
                `Margin: ${formatNumber(race.lead)} (${race.marginPoints.toFixed(2)}%)`
            ));
        }
        const candidates = createElement("div", "bm-special-tooltip-candidates");
        race.candidates.forEach((candidate, index) => candidates.appendChild(createSpecialTooltipCandidateRow(
            candidate,
            race.currentTotal,
            race.projected && index === 0
        )));
        const total = createElement("div", "bm-special-tooltip-total");
        total.append(
            createElement("strong", "", "Total reported"),
            createElement("span", "", formatNumber(race.currentTotal))
        );
        candidates.appendChild(total);
        body.append(location, candidates);
        hoverTip.appendChild(body);
        const tooltipWidth = 550;
        const tooltipHeight = Math.max(220, hoverTip.offsetHeight || 0);
        hoverTip.style.left = `${clamp(event.clientX + 14, 8, window.innerWidth - tooltipWidth - 8)}px`;
        hoverTip.style.top = `${clamp(event.clientY + 14, 8, window.innerHeight - tooltipHeight - 8)}px`;
    };

    const showCountyTooltip = (event, raceId, countyKey) => {
        const race = getActiveVisibleRaces().find(entry => entry.id === raceId);
        if(!race) return;
        const county = getCountyResultMap(race).get(countyKey);
        if(!county) return;
        hoveredRaceId = raceId;
        hoveredCountyKey = countyKey;
        hoveredRacePoint = {
            clientX: Number(event?.clientX) || 0,
            clientY: Number(event?.clientY) || 0
        };
        if(!hoverTip) {
            hoverTip = createElement("div", "bm-special-election-hover bm-special-election-result-tooltip");
            root?.appendChild(hoverTip);
        }
        hoverTip.className = "bm-special-election-hover bm-special-election-result-tooltip visible";
        hoverTip.replaceChildren();
        const sortedCandidates = county.cands.slice().sort((left, right) =>
            right.currentVotes - left.currentVotes || right.votes - left.votes
        );
        const leader = sortedCandidates[0] || null;
        const runnerUp = sortedCandidates[1] || null;
        const lead = Math.max(0, Number(leader?.currentVotes || 0) - Number(runnerUp?.currentVotes || 0));
        const marginPoints = county.totalCurrVotes > 0 ? lead / county.totalCurrVotes * 100 : 0;
        hoverTip.style.setProperty(
            "--bm-special-tooltip-accent",
            county.totalCurrVotes > 0 && leader ? getPartyColour(leader.party) : "#737373"
        );
        const header = createElement("div", "bm-special-tooltip-columns");
        header.append(
            createElement("strong", "", "County"),
            createElement("strong", "", "Candidate"),
            createElement("strong", "", "Party"),
            createElement("strong", "", "Votes"),
            createElement("strong", "", "Pct.")
        );
        hoverTip.appendChild(header);
        const body = createElement("div", "bm-special-tooltip-body");
        const location = createElement("div", "bm-special-tooltip-location");
        location.append(
            createElement("strong", "", formatSpecialCountyDisplayName(county.name).toUpperCase()),
            createElement("span", "", `${(county.reporting * 100).toFixed(0)}% in`)
        );
        if(county.totalCurrVotes > 0) {
            location.appendChild(createElement(
                "span",
                "bm-special-tooltip-margin",
                `Margin: ${formatNumber(lead)} (${marginPoints.toFixed(2)}%)`
            ));
        }
        const candidates = createElement("div", "bm-special-tooltip-candidates");
        sortedCandidates.forEach(candidate => candidates.appendChild(
            createSpecialTooltipCandidateRow(candidate, county.totalCurrVotes, false)
        ));
        const total = createElement("div", "bm-special-tooltip-total");
        total.append(
            createElement("strong", "", "Total reported"),
            createElement("span", "", formatNumber(county.totalCurrVotes))
        );
        candidates.appendChild(total);
        body.append(location, candidates);
        hoverTip.appendChild(body);
        const tooltipWidth = 550;
        const tooltipHeight = Math.max(220, hoverTip.offsetHeight || 0);
        hoverTip.style.left = `${clamp(event.clientX + 14, 8, window.innerWidth - tooltipWidth - 8)}px`;
        hoverTip.style.top = `${clamp(event.clientY + 14, 8, window.innerHeight - tooltipHeight - 8)}px`;
    };

    const refreshHoveredRaceTooltip = () => {
        if(!hoveredRaceId || !hoveredRacePoint || !hoverTip?.classList.contains("visible")) return;
        if(hoveredCountyKey) {
            showCountyTooltip(hoveredRacePoint, hoveredRaceId, hoveredCountyKey);
            return;
        }
        showRaceTooltip(hoveredRacePoint, hoveredRaceId);
    };

    const hideHover = () => {
        hoveredRaceId = null;
        hoveredRacePoint = null;
        hoveredCountyKey = null;
        hoverTip?.classList.remove("visible");
    };

    const bindMapPath = (element, key, handlers) => {
        element.style.cursor = handlers.click ? "pointer" : "default";
        if(handlers.enter) element.addEventListener("mousemove", handlers.enter);
        element.addEventListener("mouseleave", hideHover);
        if(handlers.click) element.addEventListener("click", handlers.click);
        mapPaths.set(key, element);
    };

    const renderNationalMap = () => {
        mapHost.replaceChildren();
        mapPaths = new Map();
        const svg = loadInlineSvg(path.join("data", "states.svg"));
        if(!svg) {
            mapHost.appendChild(createElement("div", "bm-special-election-map-error", "U.S. map unavailable"));
            return;
        }
        svg.querySelectorAll("path[id]").forEach(element => {
            const state = String(element.id || "").toUpperCase();
            if(state.length !== 2) return;
            const races = getStateRaces(state);
            paintPath(element, races.length ? getRaceMapColour(races[0]) : "#c5c7c9");
            bindMapPath(element, state, {
                enter: event => {
                    if(races.length === 1) {
                        showRaceTooltip(event, races[0].id);
                        return;
                    }
                    showHover(
                        event,
                        races.length
                            ? `${STATE_NAMES[state] || state}: ${races.length} special elections`
                            : `${STATE_NAMES[state] || state}: no special election`
                    );
                },
                click: races.length ? () => {
                    safePlayClick();
                    const startedRaces = getStateRaces(state).filter(canEnterCountyResults);
                    if(!startedRaces.length) return;
                    if(activeRaceType === "usHouse") {
                        currentView = { type: "state", state };
                        renderMap();
                    } else {
                        currentView = {
                            type: "counties",
                            state,
                            raceId: startedRaces[0].id
                        };
                        renderMap();
                    }
                    renderPanel();
                } : null
            });
        });
        mapHost.appendChild(svg);
    };

    const renderStateMap = state => {
        mapHost.replaceChildren();
        mapPaths = new Map();
        const file = path.join("data", "states-house", `${state.toLowerCase()}-house.svg`);
        const svg = loadInlineSvg(file);
        const back = createElement("button", "bm-special-election-map-back", "Return to U.S. Map");
        back.addEventListener("click", () => {
            safePlayClick();
            currentView = { type: "nation", state: null };
            renderMap();
            renderPanel();
        });
        mapHost.appendChild(back);
        if(!svg) {
            mapHost.appendChild(createElement("div", "bm-special-election-map-error", "State district map unavailable"));
            return;
        }
        svg.querySelectorAll('[id^="district-"]').forEach(element => {
            const district = Number(String(element.id).replace("district-", ""));
            if(!Number.isFinite(district)) return;
            const race = getRaceForStateDistrict(state, district);
            paintPath(element, race ? getRaceMapColour(race) : "#b9bbbd");
            bindMapPath(element, `${state}-${district}`, {
                enter: race
                    ? event => showRaceTooltip(event, race.id)
                    : event => showHover(event, `${state} District ${district}: no special election`),

                click: null
            });
        });
        mapHost.appendChild(svg);
    };

    const renderCountyMap = (state, raceId) => {
        hideHover();
        mapHost.replaceChildren();
        mapPaths = new Map();
        const race = getActiveVisibleRaces().find(entry => entry.id === raceId);
        const returnTo = activeRaceType === "usHouse"
            ? { type: "state", state }
            : { type: "nation", state: null };
        const back = createElement(
            "button",
            "bm-special-election-map-back",
            activeRaceType === "usHouse" ? "Return to State Map" : "Return to U.S. Map"
        );
        back.addEventListener("click", () => {
            safePlayClick();
            currentView = returnTo;
            renderMap();
            renderPanel();
        });
        mapHost.appendChild(back);
        if(!canEnterCountyResults(race)) {
            mapHost.appendChild(createElement(
                "div",
                "bm-special-election-map-error",
                "This race has not begun counting yet."
            ));
            return;
        }
        const svg = loadInlineSvg(path.join("data", "counties", `${state.toLowerCase()}.svg`));
        if(!svg) {
            mapHost.appendChild(createElement("div", "bm-special-election-map-error", "County map unavailable"));
            return;
        }

        const fallbackCountyNames = Array.from(svg.querySelectorAll("path[id]"))
            .map(element => String(element.id || "").replace(/_/g, " ").trim())
            .filter(Boolean);
        countyNamesByRace.set(race.id, fallbackCountyNames);
        const countyResults = getCountyResultMap(race, fallbackCountyNames);
        if(!countyResults.size) {
            mapHost.appendChild(createElement("div", "bm-special-election-map-error", "County map unavailable"));
            return;
        }
        svg.querySelectorAll("path[id]").forEach(element => {
            const countyKey = normalizePrimaryCountyName(
                String(element.id || "").replace(/_/g, " "),
                state
            );
            const county = countyResults.get(countyKey);
            const leader = county?.cands?.slice().sort((left, right) =>
                right.currentVotes - left.currentVotes || right.votes - left.votes
            )[0];
            paintPath(
                element,
                county?.totalCurrVotes > 0 && leader ? getPartyColour(leader.party) : "#b9bbbd"
            );
            bindMapPath(element, countyKey, {
                enter: county
                    ? event => showCountyTooltip(event, race.id, countyKey)
                    : event => showHover(event, `${String(element.id || "").replace(/_/g, " ")}: no result`)
            });
        });
        mapHost.appendChild(svg);
    };

    const renderMap = () => {
        if(!mapHost || !activeSession) return;
        const listOnly = Boolean(RACE_TYPES[activeRaceType]?.listOnly);
        mapHost.parentElement?.classList.toggle("bm-special-election-list-only", listOnly);
        if(listOnly) {
            hideHover();
            mapHost.replaceChildren();
            mapPaths = new Map();
            return;
        }
        if(currentView.type === "counties" && currentView.state && currentView.raceId) {
            renderCountyMap(currentView.state, currentView.raceId);
        }
        else if(activeRaceType === "usHouse" && currentView.type === "state" && currentView.state) {
            renderStateMap(currentView.state);
        }
        else renderNationalMap();
    };

    const updateMapColours = () => {
        if(RACE_TYPES[activeRaceType]?.listOnly) return;
        if(currentView.type === "counties" && currentView.raceId) {
            const race = getActiveVisibleRaces().find(entry => entry.id === currentView.raceId);
            const countyResults = race ? getCountyResultMap(race) : new Map();
            mapPaths.forEach((element, countyKey) => {
                const county = countyResults.get(countyKey);
                const leader = county?.cands?.slice().sort((left, right) =>
                    right.currentVotes - left.currentVotes || right.votes - left.votes
                )[0];
                paintPath(
                    element,
                    county?.totalCurrVotes > 0 && leader ? getPartyColour(leader.party) : "#b9bbbd"
                );
            });
            return;
        }
        if(currentView.type === "nation") {
            mapPaths.forEach((element, state) => {
                const race = getStateRaces(state)[0];
                paintPath(element, race ? getRaceMapColour(race) : "#c5c7c9");
            });
            return;
        }
        mapPaths.forEach((element, key) => {
            const parts = String(key).split("-");
            const district = Number(parts[parts.length - 1]);
            const race = getRaceForStateDistrict(currentView.state, district);
            paintPath(element, race ? getRaceMapColour(race) : "#b9bbbd");
        });
    };

    const createCandidateRow = (candidate, total, isProjectedWinner) => {
        const row = createElement(
            "div",
            `bm-special-candidate${isProjectedWinner ? " projected-winner" : ""}`
        );
        const candidateColour = getPartyColour(candidate.party);
        row.style.setProperty("--bm-special-candidate-colour", candidateColour);
        const identity = createElement("div", "bm-special-candidate-identity");
        const name = createElement(
            "strong",
            "",
            `${candidate.lastName || getSpecialCandidateLastName(candidate)}${candidate.incumbent ? " *" : ""}`
        );
        identity.append(name);
        if(isProjectedWinner) identity.appendChild(createSpecialWinnerIcon());
        const party = createElement("span", "bm-special-candidate-party", candidate.party);
        party.style.background = candidateColour;
        const votes = createElement("span", "bm-special-candidate-votes", formatNumber(candidate.currentVotes));
        const percentage = total > 0 ? candidate.currentVotes / total * 100 : 0;
        const pct = createElement("strong", "bm-special-candidate-pct", `${percentage.toFixed(2)}%`);
        row.append(identity, party, votes, pct);
        return row;
    };

    const createRaceCard = race => {
        const status = getRaceStatus(race);
        const card = createElement("section", "bm-special-race-card");
        card.dataset.raceId = race.id;
        const header = createElement("div", "bm-special-race-header");
        const location = createElement("div", "");
        location.append(
            createElement("span", "bm-special-race-state", race.stateName),
            createElement("h2", "", `U.S. House · District ${race.district}`)
        );
        const officeHeading = location.querySelector("h2");
        if(officeHeading) {
            officeHeading.textContent = race.type === "usSenate"
                ? "U.S. Senate"
                : isStateLegislativeRaceType(race.type)
                    ? `${RACE_TYPES[race.type].officeLabel} · District ${race.district}`
                    : `U.S. House · District ${race.district}`;
        }
        const badge = createElement("span", `bm-special-status ${status.kind}`, status.text);
        if(status.kind === "projected") {
            badge.appendChild(createSpecialWinnerIcon());
            if(isSpecialRaceFlip(race)) badge.appendChild(createSpecialFlipBadge());
        }
        header.append(location, badge);
        card.appendChild(header);
        const reporting = createElement("div", "bm-special-reporting");
        reporting.appendChild(createElement("span", "", `${race.reporting.toFixed(0)}% reporting`));
        const turnoutText = getSpecialRaceTurnoutText(race);
        reporting.appendChild(createElement("strong", "bm-special-card-turnout", turnoutText));
        reporting.appendChild(createElement("strong", "", `${formatNumber(race.currentTotal)} votes`));
        const bar = createElement("div", "bm-special-progress-track");
        const fill = createElement("div", "bm-special-progress-fill");
        fill.style.width = `${race.reporting}%`;
        bar.appendChild(fill);
        reporting.appendChild(bar);
        card.appendChild(reporting);
        const list = createElement("div", "bm-special-candidate-list");
        race.candidates.forEach((candidate, index) => {
            list.appendChild(createCandidateRow(
                candidate,
                race.currentTotal,
                race.projected && index === 0
            ));
        });
        card.appendChild(list);
        if(race.currentTotal > 0 && race.leader && race.runnerUp) {
            card.appendChild(createElement(
                "div",
                "bm-special-margin",
                `Margin: ${formatNumber(race.lead)} (${race.marginPoints.toFixed(2)} pts)`
            ));
        }
        return card;
    };

    const renderPanel = (preserveScroll = false) => {
        if(!panelHost || !activeSession) return;
        const previousScrollTop = preserveScroll ? panelHost.scrollTop : 0;
        const previousScrollLeft = preserveScroll ? panelHost.scrollLeft : 0;
        panelHost.replaceChildren();
        const all = getActiveVisibleRaces();
        const selected = currentView.type === "counties"
            ? all.filter(race => race.id === currentView.raceId)
            : currentView.type === "state"
            ? all.filter(race => race.state === currentView.state)
            : all;
        const focusId = panelHost.dataset.focusRace;
        selected.sort((left, right) => (
            (left.id === focusId ? -1 : 0) - (right.id === focusId ? -1 : 0)
            || left.state.localeCompare(right.state)
            || left.district - right.district
        ));
        selected.forEach(race => panelHost.appendChild(createRaceCard(race)));
        if(preserveScroll) {
            panelHost.scrollTop = previousScrollTop;
            panelHost.scrollLeft = previousScrollLeft;
        }
    };

    const updateClock = () => {
        if(!clockLabel || !activeSession) return;
        const remaining = Math.max(0, Number(activeSession.durationSeconds || DEFAULT_DURATION_SECONDS)
            - Number(activeSession.elapsedSeconds || 0));
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        clockLabel.textContent = remaining <= 0
            ? "0:00"
            : `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    const finishSession = () => {
        if(!activeSession) return;
        activeSession.elapsedSeconds = Number(activeSession.durationSeconds || DEFAULT_DURATION_SECONDS);
        activeSession.progress = 100;
        activeSession.status = "completed";
        playing = false;
        if(pauseButton) pauseButton.textContent = "▶";
        updateClock();
        updateMapColours();
        renderPanel(true);
        refreshHoveredRaceTooltip();
        if(titleLabel) titleLabel.textContent = "SPECIAL ELECTION RESULTS";
    };

    const closeSession = () => {
        playing = false;
        document.body?.classList.remove("bm-special-election-active");
        root?.remove();
        root = null;
        hoverTip = null;
        hoveredRaceId = null;
        hoveredRacePoint = null;
        hoveredCountyKey = null;
        mapHost = null;
        panelHost = null;
        clockLabel = null;
        pauseButton = null;
        titleLabel = null;
        mapPaths = new Map();
        countyResultsCache.clear();
        countyNamesByRace.clear();
        if(activeSession && activeSession.status !== "dismissed") createReopenButton();
    };

    const isSessionInCurrentWeek = session => {
        if(!session) return false;
        const year = Number(getCurrentYear?.());
        const week = Number(getCurrentWeek?.());

        if(!Number.isFinite(year) || !Number.isFinite(week)) return true;
        return Number(session.year) === year && Number(session.week) === week;
    };

    const removeReopenButtonIfExpired = () => {
        if(!reopenButton || isSessionInCurrentWeek(activeSession)) return;
        reopenButton.remove();
        reopenButton = null;
    };

    const createReopenButton = () => {
        if(reopenButton || !activeSession || activeSession.decision !== "watch") return;
        if(!isSessionInCurrentWeek(activeSession)) return;
        reopenButton = createElement("button", "bm-special-election-reopen", "SPECIAL ELECTION");
        reopenButton.addEventListener("click", () => {
            safePlayClick();
            reopenButton.remove();
            reopenButton = null;
            openSession(activeSession);
        });
        document.body?.appendChild(reopenButton);
    };

    const buildScreen = () => {
        root?.remove();
        reopenButton?.remove();
        reopenButton = null;

        document.body?.classList.add("bm-special-election-active");

        document.getElementById("bm-margin-through-night")?.remove();
        const marginTooltip = document.getElementById("bm-margin-through-night-tooltip");
        if(marginTooltip) marginTooltip.style.display = "none";
        root = createElement("div", "bm-special-election-night");
        const top = createElement("header", "bm-special-election-topbar");
        const brand = createElement("div", "bm-special-election-brand");
        brand.append(
            createElement("strong", "", `ELECTION NIGHT ${activeSession.year}`),
            createElement("span", "", "SPECIAL ELECTION")
        );
        const tabs = createElement("div", "bm-special-election-tabs");
        const sessionRaceTypes = [...new Set((activeSession.races || []).map(race => (
            String(race.type || "usHouse")
        )))].filter(type => RACE_TYPES[type]);
        sessionRaceTypes.forEach(raceType => {
            const tab = createElement(
                "button",
                raceType === activeRaceType ? "active" : "",
                RACE_TYPES[raceType].tabLabel
            );
            tab.addEventListener("click", () => {
                if(activeRaceType === raceType) return;
                safePlayClick();
                activeRaceType = raceType;
                currentView = { type: "nation", state: null };
                panelHost?.removeAttribute("data-focus-race");
                tabs.querySelectorAll("button").forEach(button => button.classList.remove("active"));
                tab.classList.add("active");
                if(titleLabel && activeSession.progress < 100) {
                    titleLabel.textContent = RACE_TYPES[activeRaceType].headline;
                }
                renderMap();
                renderPanel();
            });
            tabs.appendChild(tab);
        });
        const controls = createElement("div", "bm-special-election-controls");
        clockLabel = createElement("strong", "bm-special-election-clock");
        pauseButton = createElement("button", "", "Ⅱ");
        const speedButton = createElement("button", "", "1×");
        const skip = createElement("button", "", "Skip to End");
        const close = createElement("button", "bm-special-election-close", "×");
        pauseButton.addEventListener("click", () => {
            safePlayClick();
            playing = !playing;
            pauseButton.textContent = playing ? "Ⅱ" : "▶";
            lastTickAt = performance.now();
        });
        speedButton.addEventListener("click", () => {
            safePlayClick();
            speed = speed === 1 ? 3 : speed === 3 ? 6 : 1;
            speedButton.textContent = `${speed}×`;
        });
        skip.addEventListener("click", () => {
            safePlayClick();
            finishSession();
        });
        close.addEventListener("click", () => {
            safePlayClick();
            closeSession();
        });
        controls.append(clockLabel, pauseButton, speedButton, skip, close);
        top.append(brand, tabs, controls);
        const headline = createElement("div", "bm-special-election-headline");
        titleLabel = createElement("h1", "", activeSession.progress >= 100
            ? "SPECIAL ELECTION RESULTS"
            : RACE_TYPES[activeRaceType].headline);
        headline.append(
            titleLabel,
            createElement("span", "", `${activeSession.races.length} race${activeSession.races.length === 1 ? "" : "s"}`)
        );
        const content = createElement("main", "bm-special-election-content");
        mapHost = createElement("section", "bm-special-election-map");
        panelHost = createElement("aside", "bm-special-election-panel");
        content.append(mapHost, panelHost);
        root.append(top, headline, content);
        document.body?.appendChild(root);
        updateClock();
        renderMap();
        renderPanel();
    };

    const openSession = session => {
        if(!session) return;
        activeSession = session;
        countyResultsCache.clear();
        countyNamesByRace.clear();
        raceModels = buildRaceRevealModels((session.races || []).map(race => ({
            ...race,
            type: race.type || "usHouse"
        })));
        const availableTypes = [...new Set(raceModels.map(race => race.type))];
        activeRaceType = availableTypes.includes("usHouse") ? "usHouse" : (availableTypes[0] || "usHouse");
        currentView = { type: "nation", state: null };
        speed = 1;
        playing = session.progress < 100;
        lastTickAt = performance.now();
        buildScreen();
    };

    const tick = () => {
        if(!root || !activeSession || !playing || activeSession.progress >= 100) return;
        const now = performance.now();
        if(!lastTickAt) lastTickAt = now;
        const deltaSeconds = Math.min(2, Math.max(0, (now - lastTickAt) / 1000));
        lastTickAt = now;
        activeSession.elapsedSeconds = Math.min(
            Number(activeSession.durationSeconds || DEFAULT_DURATION_SECONDS),
            Number(activeSession.elapsedSeconds || 0) + deltaSeconds * speed
        );
        activeSession.progress = clamp(
            activeSession.elapsedSeconds / Number(activeSession.durationSeconds || DEFAULT_DURATION_SECONDS) * 100,
            0,
            100
        );
        if(activeSession.progress >= 100) {
            finishSession();
            return;
        }
        updateClock();
        updateMapColours();
        renderPanel(true);
        refreshHoveredRaceTooltip();
    };

    const scan = () => {
        if(root || modal) return;

        removeReopenButtonIfExpired();
        const data = collectCurrentSessionData();
        if(!data) {
            removeBlocker();
            return;
        }
        const session = ensureSession(data);
        if(!session) return;
        activeSession = session;
        if(session.decision === "pending") showPrompt(session);
        else if(session.decision === "watch" && session.status === "counting" && !reopenButton) createReopenButton();
    };

    const install = () => {
        if(installed) return;
        installed = true;
        try {
            Executive.functions.registerPreHook(SPECIAL_EVENT_FUNCTION, args => {
                currentSpecialHookEvent = resolveHookEvent(args);
            });
            Executive.functions.registerPreHook("stateNews", args => {
                captureStateNewsResult(args);
            });

            try {
                Executive.functions.registerPreHook("nationNews", args => {
                    captureStateNewsResult(args);
                });
            } catch {}
            Executive.functions.registerPostHook(SPECIAL_EVENT_FUNCTION, () => {
                scan();
                setTimeout(scan, 0);
                setTimeout(scan, 250);
                setTimeout(scan, 1000);
                currentSpecialHookEvent = null;
            });
        } catch(error) {
            globalThis.bmSpecialElectionHookError = error;
        }
        scanTimer = setInterval(scan, 1500);
        tickTimer = setInterval(tick, 250);
        setTimeout(scan, 0);
        setTimeout(scan, 1000);
        setTimeout(scan, 3000);
    };

    const destroy = () => {
        if(scanTimer) clearInterval(scanTimer);
        if(tickTimer) clearInterval(tickTimer);
        scanTimer = null;
        tickTimer = null;
        installed = false;
        document.body?.classList.remove("bm-special-election-active");
        dismissPrompt();
        root?.remove();
        reopenButton?.remove();
        root = null;
        reopenButton = null;
    };

    return { install, destroy, scan, openSession };
};

module.exports = {
    createSpecialElectionNight
};