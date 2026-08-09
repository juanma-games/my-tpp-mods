{
    const path = require("path");
    const fs = require("fs");
    const os = require("os");
    const d3 = require("./third-party/d3.v7.min.js");
    const resultProxies = require("./proxies.js");
    const { createPrecinctResultsController } = require("./precinct-results.js");
    const { createCityMayoralMap } = require("./city-mayoral-map.js");
    const { buildRcvFinalResultsForUnits } = require("./rcv-map-results.js");
    const { createBallotMeasuresSubmod } = require("./ballot-measures.js");
    const { createSpecialElectionNight } = require("./special-election-night.js");
    const { createVotingBooth } = require("./voting-booth.js");
    const {
        getCandidateColour,
        getCandidateColourForRace,
        getCandidateVariantPartyKey,
        getPoliticianColour,
        stringifyColour
    } = require("./colours.js");
    const {
        configurePrimaryCountyResults,
        buildPrimaryCountyResults,
        getPrimaryCountyResult,
        getPrimaryCountyTurnout,
        getAvailablePrimaryParties,
        isPrimaryStateFullyReported,
        isPrimaryPartyFullyReported,
        isPrimaryPartyStarted,
        normalizePrimaryCountyName
    } = require("./primary-counties.js");
    const mod = {};
    const originalElectPageMap = Executive.functions.getOriginalFunction("electPageMap");
    const originalElectNightMap = Executive.functions.getOriginalFunction("electNightMap");
    const originalSummaryNationMap = Executive.functions.getOriginalFunction("summaryNationMap");
    const { tooltipDiv, tooltipComponents, updateTooltip, updateHouseStateTooltip, updateHouseDistrictTooltip, getHouseDistrictFlipData, shouldRevealHouseDistrictResults, getLiveHouseDistrictSnapshot, hasVisibleHouseStateResults, refreshLiveStateResultsForTooltip, createTooltip, getSenateControlCountsFromPage, getLatestSenateControlCountsFromPage, getCurrentSenateParty, updateSenateControlBanner, updateHouseControlBanner, updatePresidentialWinnerBanner, getCandidateBannerPortraitSource, getActivePresidentialPrimaryParty, getPrimaryCandidateAffiliation, renderPrecinctResultsTooltip, hidePrecinctResultsTooltip, setPrimaryCountyResultResolver } = require("./tooltip.js");
    let config = null;
    let onCountyMap = false;
    let lastMapElectionType = "none";
    let isHydratingMsnbcElectionData = false;
    let lastMapLive = false;
    let houseDistrictGridState = null;
    let housePoliticianDistrictGridState = null;
    let houseDistrictTooltipTarget = null;
    let houseDistrictGridMode = "projections";
    let houseDistrictGridZoom = 1;
    let houseDistrictGridZoomState = null;
    let houseDistrictGridPanX = 0;
    let houseDistrictGridPanY = 0;
    let activeHouseDistrictDragCleanup = null;
    let rcvResultsModal = null;
    let rcvResultsEscapeListener = null;
    let activePrimaryCountyParty = null;
    let activePrimaryCountyElectionType = null;
    const MAP_MODES = Object.freeze({
        PRECINCTS: "precincts",
        WINNER: "winner",
        FLIP_COUNTIES: "flip-counties",
        MARGIN: "margin",
        PRECINCTS_RCV: "precincts-rcv",
        WINNER_RCV: "winner-rcv",
        MARGIN_RCV: "margin-rcv"
    });
    const MAP_NO_ELECTION_FILL = "#cccccc";
    const MAP_PRIMARY_ELECTION_PENDING_FILL = "#eeeeee";
    const MAP_ELECTION_PENDING_FILL = "#eeeeee";
    const MAP_ELECTION_STATE_STROKE = "rgba(255, 255, 255, 0.9)";
    let activeCountyMapMode = MAP_MODES.MARGIN;
    let presidentialPrimaryNationalMapMode = MAP_MODES.WINNER;
    const rcvMapResultsCache = new Map();
    const rcvMapContextByRace = new WeakMap();
    let lastMapPageRefresh = null;
    let presidentialPrimaryTabResetInstalled = false;
    let statewideTurnoutMapMode = null;
    let statewideTurnoutMapView = "current";
    let statewideShiftMapMode = null;
    let statewideShiftComparisonYear = null;
    const statewideTurnoutDetailsByState = new Map();
    const statewideTurnoutAvailableElections = new Set();
    const statewideTurnoutMapControllers = new WeakMap();
    const statewideShiftArrowPoints = new WeakMap();
    const statewideShiftDetailsByState = new Map();
    const electionNightMapButtonObservers = new Map();
    const statewideTurnoutDocumentListenerRemovers = [];
    let statewideTurnoutDocumentControllerInstalled = false;
    let statewideTurnoutRenderToken = 0;
    let suppressElectionNightProjectObserverUntil = 0;
    let houseDistrictGridDragging = false;
    let houseDistrictTooltipRefreshTimer = null;
    let lastHouseDistrictGridFillRefresh = 0;
    let lastUpdateDataHook = null;
    let electionNightThemeAudio = null;
    let electionNightThemePlayPending = false;
    let electionNightThemeMonitor = null;
    let electionNightThemeLastScreenSeenAt = 0;
    let electionNightThemeSessionActive = false;
    let electionNightThemeEnabled = true;
    let electionNightSkipEndPrimaryRefreshInstalled = false;
    let precinctResultsController = null;
    let cityMayoralMap = null;
    let ballotMeasuresSubmod = null;
    let independentPollObserver = null;
    let independentPollFormatQueued = false;
    let independentPollFormatTimer = null;
    let pollBattlegroundFilterActive = false;
    let pollBattlegroundFilterInstalled = false;
    let pollBattlegroundFilterRefreshTimer = null;
    let pollBattlegroundResultsRestoreTimer = null;
    let pollBattlegroundResultsRestoreState = null;
    let pollBattlegroundStateCodesCache = null;
    let independentPollFilterSelectsCache = null;
    let pollAverageTooltip = null;
    let pollAverageWeekMarker = null;
    let independentPollResultsCache = null;
    let pollWeeklyAveragesCache = null;
    let lastIndependentPollScan = 0;
    let pollAveragePointCenterCache = new WeakMap();
    let pollAverageRawPointCenterCache = new WeakMap();
    let pollAverageCanvasPointLog = new WeakMap();
    let pollAverageCanvasRecorderInstalled = false;
    const pollAverageTooltipTargets = new WeakSet();
    const pollAverageVisualOverlays = new WeakMap();
    let pollAverageWeightedGraphCache = new WeakMap();
    let pollAverageNativeColourCache = new WeakMap();
    let pollAverageActiveIndex = null;
    let pollAverageActiveX = null;
    let pollAverageActiveGraph = null;
    let specialElectionNight = null;
    let votingBooth = null;
    let votingBoothShapeDumped = false;
    let stateCountyZoomController = null;
    const marginThroughNightHistories = new Map();
    let marginThroughNightTooltip = null;
    let marginThroughNightObserver = null;
    let marginThroughNightUpdateQueued = false;
    let marginThroughNightUpdateTimer = null;
    let marginThroughNightLastUpdateAt = 0;
    let modInitialized = false;
    let modShuttingDown = false;
    let electionNightThemeClickTimer = null;
    let msnbcElectionButtonVisibilityTimer = null;
    let msnbcElectionButtonInstallTimer = null;
    let independentPollObserverInstallTimer = null;
    let presidentialPrimaryResetTimer = null;
    const independentPollObserverFollowupTimers = new Set();
    const electionNightSkipEndRefreshTimers = new Set();
    const managedPostHooks = [];
    const registerManagedPostHook = (functionName, callback) => {
        const index = Executive.functions.registerPostHook(functionName, callback);
        managedPostHooks.push({ functionName, index });
        return index;
    };
    const stateNameToCode = {
        "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
        "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
        "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
        "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
        "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
        "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
        "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
        "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
        "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
        "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
        "District of Columbia": "DC", "Washington D.C.": "DC", "Washington DC": "DC",
        "D.C.": "DC", "DC": "DC", "National": "national"
    };
    const getRaceInfo = (district, live) => {
        const sortedCands = district.cands.slice().sort((cand1, cand2) => {
            if(live) return cand2.currentVotes - cand1.currentVotes;
            return cand2.votes - cand1.votes;
        });
        const topVotes = live ? sortedCands[0].currentVotes : sortedCands[0].votes;
        const secondVotes = (sortedCands[1] !== undefined) ? (live ? sortedCands[1].currentVotes : sortedCands[1].votes) : 0;
        const info = {
            currentLeader: sortedCands[0],
            currentLead: topVotes - secondVotes
        };
        if(district.pW){
            const resortedCands = sortedCands.sort((cand1, cand2) => {
                return cand2.votes - cand1.votes;
            });
            info.finalWinner = resortedCands[0];
        }
        return info;
    };
    const getCurrentElectionYearValue = () => {
        try {
            const year = Number(typeof currentYear !== "undefined" ? currentYear : globalThis.currentYear);
            return Number.isFinite(year) ? year : null;
        } catch {
            return null;
        }
    };
    const getStateRegisteredVoters = stateId => {
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        const population = Number(state?.pop) || 0;
        let registeredFraction = Number(state?.regVoters) || 0;
        if(registeredFraction > 1) registeredFraction /= 100;
        if(population <= 0 || registeredFraction <= 0) return 0;
        return Math.round(population * registeredFraction);
    };
    const getStatewideRaceVotes = (race, live) => {
        if(!race) return 0;
        const candidates = Array.isArray(race.cands) ? race.cands : [];
        const candidateTotal = candidates.reduce((sum, candidate) =>
            sum + Math.max(0, Number(live ? candidate?.currentVotes : candidate?.votes) || 0), 0);
        if(candidateTotal > 0) return candidateTotal;
        const directTotal = Number(live ? race.totalCurrVotes : race.totalVotes);
        return Number.isFinite(directTotal) && directTotal > 0 ? directTotal : 0;
    };
    const getStatewideArchive = electionType => {
        try {
            if(electionType === "president") {
                return typeof presidentArchive !== "undefined" ? presidentArchive : globalThis.presidentArchive;
            }
            if(electionType === "usSenate") {
                return typeof usSenateArchive !== "undefined" ? usSenateArchive : globalThis.usSenateArchive;
            }
            if(electionType === "governor") {
                return typeof allGovArchive !== "undefined" ? allGovArchive : globalThis.allGovArchive;
            }
        } catch {}
        return null;
    };
    const getArchivedRaceStateCode = race => {
        const value = String(race?.state || race?.district || race?.name || "").trim();
        const directCode = value.toUpperCase();
        if(Executive?.data?.states?.[directCode.toLowerCase()]) return directCode;
        const simplifiedValue = value
            .replace(/\./g, "")
            .replace(/\b(?:presidential|senate|gubernatorial|governor|general)\s+election\b/gi, "")
            .replace(/\bresults?\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        if(/^(?:washington\s+dc|district\s+of\s+columbia)$/i.test(simplifiedValue)) return "DC";
        return stateNameToCode[value] || stateNameToCode[simplifiedValue] || stateNameToCode[
            Object.keys(stateNameToCode).find(name => name.toLowerCase() === value.toLowerCase())
        ] || stateNameToCode[
            Object.keys(stateNameToCode).find(name => name.toLowerCase() === simplifiedValue.toLowerCase())
        ] || "";
    };
    const getArchivedRaceVotes = race => {
        const directTotal = Number(race?.totalVotes ?? race?.totVotes);
        if(Number.isFinite(directTotal) && directTotal > 0) return directTotal;
        const candidates = race?.candidates || race?.cands || [];
        if(!Array.isArray(candidates)) return 0;
        return candidates.reduce((sum, candidate) =>
            sum + Math.max(0, Number(
                candidate?.totVotes
                ?? candidate?.votes
                ?? candidate?.finalVotes
                ?? candidate?.finalRcvVotes
                ?? candidate?.currentVotes
            ) || 0), 0);
    };
    const getArchivedRegisteredVoters = (archiveEntry, race, stateId) => {
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        const sources = [race, archiveEntry].filter(Boolean);
        const directKeys = [
            "registeredVoters", "registered", "registeredPopulation", "registeredPop",
            "totalRegistered", "totRegistered", "registeredVoterTotal"
        ];
        for(const source of sources) {
            for(const key of directKeys) {
                const value = Number(source?.[key]);
                if(Number.isFinite(value) && value > 100) return Math.round(value);
            }
        }
        const populationKeys = ["population", "pop", "statePopulation"];
        const fractionKeys = ["regVoters", "registeredPercent", "registeredFraction", "regFraction"];
        for(const source of sources) {
            const population = populationKeys
                .map(key => Number(source?.[key]))
                .find(value => Number.isFinite(value) && value > 1000);
            let fraction = fractionKeys
                .map(key => Number(source?.[key]))
                .find(value => Number.isFinite(value) && value > 0);
            if(Number.isFinite(population) && Number.isFinite(fraction)) {
                if(fraction > 1) fraction /= 100;
                return Math.round(population * fraction);
            }
        }
        return getStateRegisteredVoters(stateId)
            || Math.round((Number(state?.pop) || 0) * (Number(state?.regVoters) || 0));
    };
    const getPreviousStatewideRaceDetails = (electionType, stateId) => {
        const archive = getStatewideArchive(electionType);
        if(!Array.isArray(archive)) return null;
        const currentYear = getCurrentElectionYearValue();

        const interval = getStatewideShiftYearInterval(electionType) || 1;
        const targetYear = Number.isFinite(currentYear)
            ? currentYear - interval
            : null;
        const entries = archive
            .filter(entry => entry?.category === "general"
                && (!Number.isFinite(currentYear) || Number(entry?.year) < currentYear))
            .sort((a, b) => {
                if(!Number.isFinite(targetYear)) {
                    return Number(b?.year) - Number(a?.year);
                }
                return Math.abs(Number(a?.year) - targetYear) - Math.abs(Number(b?.year) - targetYear);
            });
        const normalizedState = String(stateId || "").toUpperCase();
        for(const entry of entries) {
            if(
                Number.isFinite(targetYear)
                && Number(entry?.year) !== targetYear
            ) continue;
            const races = electionType === "president"
                ? (entry?.exitPoll?.states || entry?.states || [])
                : (entry?.elections || []);
            const race = races.find(candidateRace =>
                getArchivedRaceStateCode(candidateRace) === normalizedState);
            const votes = getArchivedRaceVotes(race);
            if(votes > 0) {
                return {
                    year: Number(entry?.year) || null,
                    votes,
                    registeredVoters: getArchivedRegisteredVoters(entry, race, stateId)
                };
            }
        }
        return null;
    };
    const getPreviousStatewideRaceVotes = (electionType, stateId) => {
        return getPreviousStatewideRaceDetails(electionType, stateId)?.votes || 0;
    };
    const getStatewideShiftYearInterval = electionType => {
        if(electionType === "usSenate") return 6;
        if(electionType === "president" || electionType === "governor") return 4;
        return null;
    };
    const getStatewideShiftComparisonYear = electionType => {
        const currentElectionYear = getCurrentElectionYearValue() || getElectionNightPanelYear();
        const interval = getStatewideShiftYearInterval(electionType);
        return Number.isFinite(Number(currentElectionYear)) && Number.isFinite(interval)
            ? Number(currentElectionYear) - interval
            : null;
    };
    const getStatewideShiftCandidateParty = candidate => {
        const directParty = candidate?.party?.name
            || candidate?.party?.id
            || candidate?.party
            || candidate?.partyKey
            || candidate?.caucus
            || candidate?.caucusParty
            || candidate?.extendedAttribs?.party
            || candidate?.extendedAttribs?.partyKey;
        const directText = String(directParty || "")
            .replace(/[^A-Za-z]/g, "")
            .toUpperCase();
        if(directText === "ID" || directText.includes("INDEPENDENTDEMOCR")) return "ID";
        if(directText === "IR" || directText.includes("INDEPENDENTREPUBLIC")) return "IR";
        if(directText.includes("DEMOCR")) return "D";
        if(directText.includes("REPUBLIC")) return "R";
        let normalized = normalizeHousePrimaryCandidateAffiliation(
            directParty,
            candidate?.caucusParty
                || candidate?.caucus
                || candidate?.extendedAttribs?.caucusParty
                || candidate?.extendedAttribs?.caucus,
            "I"
        );
        if(normalized !== "I" || !candidate?.id) return normalized;
        try {
            const character = findCandByID([candidate.id])?.[0];
            const wrapped = Executive.data.characters.wrapCharacter(character, "candidate");
            normalized = normalizeHousePrimaryCandidateAffiliation(
                wrapped?.extendedAttribs?.party,
                wrapped?.caucusParty
                    || wrapped?.extendedAttribs?.caucusParty
                    || wrapped?.extendedAttribs?.caucus,
                "I"
            );
        } catch {}
        return normalized;
    };
    const getStatewidePartyShares = (race, live = false) => {
        const candidates = race?.candidates || race?.cands || [];
        if(!Array.isArray(candidates) || candidates.length === 0) return null;
        let democraticVotes = 0;
        let republicanVotes = 0;
        let totalVotes = 0;
        candidates.forEach(candidate => {
            const votes = Math.max(0, Number(
                live
                    ? (candidate?.currentVotes ?? candidate?.votes ?? candidate?.totVotes)
                    : (
                        candidate?.totVotes
                        ?? candidate?.votes
                        ?? candidate?.finalVotes
                        ?? candidate?.finalRcvVotes
                        ?? candidate?.currentVotes
                    )
            ) || 0);
            const party = getStatewideShiftCandidateParty(candidate);
            totalVotes += votes;
            if(party === "D") democraticVotes += votes;
            else if(party === "R") republicanVotes += votes;
        });
        if(totalVotes <= 0 || (democraticVotes <= 0 && republicanVotes <= 0)) return null;
        const democratic = (democraticVotes / totalVotes) * 100;
        const republican = (republicanVotes / totalVotes) * 100;
        return {
            D: democratic,
            R: republican,
            I: Math.max(0, 100 - democratic - republican),
            totalVotes
        };
    };
    const calculateStatewideShift = (currentRace, previousRace, live = false) => {
        const current = getStatewidePartyShares(currentRace, live);
        const previous = getStatewidePartyShares(previousRace, false);
        if(!current || !previous) return null;
        const currentMargin = current.D - current.R;
        const previousMargin = previous.D - previous.R;
        const signedValue = currentMargin - previousMargin;
        const value = Math.abs(signedValue);
        return {
            current,
            previous,
            currentMargin,
            previousMargin,
            signedValue,
            value,
            direction: value < 0.05 ? null : (signedValue > 0 ? "D" : "R")
        };
    };
    const SHIFT_ARROW_MIN_LENGTH = 8.1;
    const SHIFT_ARROW_MAX_LENGTH = 50;
    const SHIFT_ARROW_GROWTH = 0.125;
    const getStatewideShiftArrowLength = shiftPoints => SHIFT_ARROW_MIN_LENGTH
        + ((SHIFT_ARROW_MAX_LENGTH - SHIFT_ARROW_MIN_LENGTH)
            * (1 - Math.exp(-SHIFT_ARROW_GROWTH * Math.max(0, Number(shiftPoints) || 0))));
    const getPreviousStatewideShiftRace = (electionType, stateId) => {
        const archive = getStatewideArchive(electionType);
        const targetYear = getStatewideShiftComparisonYear(electionType);
        if(!Array.isArray(archive) || !Number.isFinite(targetYear)) return null;
        const entries = archive.filter(archiveEntry =>
            archiveEntry?.category === "general"
            && Number(archiveEntry?.year) === targetYear
        );
        if(!entries.length) return null;
        const normalizedState = String(stateId || "").toUpperCase();
        for(const entry of entries) {
            const raceCollections = electionType === "president"
                ? [
                    entry?.exitPoll?.states,
                    entry?.states,
                    entry?.results?.states,
                    entry?.elections
                ]
                : [
                    entry?.elections,
                    entry?.results?.elections,
                    entry?.states
                ];
            for(const races of raceCollections) {
                if(!Array.isArray(races)) continue;
                const race = races.find(candidateRace =>
                    getArchivedRaceStateCode(candidateRace) === normalizedState
                );
                if(race && getArchivedRaceVotes(race) > 0) {
                    return { year: targetYear, race };
                }
            }
        }
        return null;
    };
    const getLiveStatewideRaces = electionType => {
        try {
            const source = electionType === "president"
                ? (typeof electNightP !== "undefined" ? electNightP : globalThis.electNightP)
                : electionType === "usSenate"
                    ? (typeof electNightUSS !== "undefined" ? electNightUSS : globalThis.electNightUSS)
                    : (typeof electNightG !== "undefined" ? electNightG : globalThis.electNightG);
            return Array.isArray(source?.elections) ? source.elections : [];
        } catch {
            return [];
        }
    };
    const areAllStatewideRacesFullyReported = electionType => {
        const races = getLiveStatewideRaces(electionType);
        if(!races.length) return false;
        return races.every(race => {
            if(!Array.isArray(race?.cands) || race.cands.length === 0) return false;
            const expectedVotes = Number(race?.totalVotes) || race.cands.reduce(
                (sum, candidate) => sum + Math.max(0, Number(candidate?.votes) || 0), 0);
            const countedVotes = Number(race?.totalCurrVotes) || race.cands.reduce(
                (sum, candidate) => sum + Math.max(0, Number(candidate?.currentVotes) || 0), 0);
            return expectedVotes > 0 && countedVotes >= expectedVotes;
        });
    };
    const isStatewideShiftModeSelected = electionType => Boolean(
        statewideShiftMapMode === electionType
        && ["president", "usSenate", "governor"].includes(electionType)
        && !onCountyMap
    );
    const isStatewideTurnoutModeActive = electionType => {
        return Boolean(
            statewideTurnoutMapMode
            && statewideTurnoutMapMode === electionType
            && ["president", "usSenate", "governor"].includes(electionType)
            && !onCountyMap
        );
    };
    const isStatewideTurnoutModeSelected = electionType => {
        const turnoutButton = document.getElementById("eNightTurnoutB");
        const turnoutUiActive = Boolean(
            document.body?.classList.contains("bm-turnout-mode-active")
            && turnoutButton?.classList.contains("eNightMarginBActive")
            && lastMapElectionType === electionType
        );
        return Boolean(
            ["president", "usSenate", "governor"].includes(electionType)
            && (statewideTurnoutMapMode === electionType || turnoutUiActive)
        );
    };
    const removeStatewideTurnoutLegend = () => {
        document.getElementById("bm-statewide-turnout-legend")?.remove();
        document.getElementById("bm-turnout-no-history")?.remove();
    };
    const removeStatewideTurnoutTooltip = () => {
        document.getElementById("bm-statewide-turnout-tooltip")?.remove();
    };
    const removeStatewideShiftTooltip = () => {
        document.getElementById("bm-statewide-shift-tooltip")?.remove();
    };
    const formatStatewideShiftShare = share => `${(Number(share) || 0).toFixed(1)}%`;
    const hasVisibleShiftIndependent = shares => (Number(shares?.I) || 0) >= 0.05;
    const buildStatewideShiftShareCells = (shares, showIndependent) => {
        const entries = [
            { key: "D", value: Number(shares?.D) || 0 },
            { key: "R", value: Number(shares?.R) || 0 }
        ];
        if(showIndependent) entries.push({ key: "I", value: Number(shares?.I) || 0 });
        return entries
            .sort((entryA, entryB) => entryB.value - entryA.value)
            .map(entry => `<span class="bm-shift-share bm-shift-share-${entry.key.toLowerCase()}">`
                + `${entry.key} ${formatStatewideShiftShare(entry.value)}</span>`)
            .join("");
    };
    const showStatewideShiftTooltip = (event, details) => {
        if(!details) return;
        let tooltip = document.getElementById("bm-statewide-shift-tooltip");
        if(!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "bm-statewide-shift-tooltip";
            document.body.appendChild(tooltip);
        }
        const shift = details.shift;
        const shiftColour = shift?.direction
            ? stringifyColour(config.partyColours[shift.direction])
            : null;
        tooltip.style.setProperty("--bm-shift-colour", shiftColour || "#6c757d");
        tooltip.style.setProperty("--bm-shift-party-d", stringifyColour(config.partyColours.D));
        tooltip.style.setProperty("--bm-shift-party-r", stringifyColour(config.partyColours.R));
        const showIndependent = Boolean(shift)
            && (hasVisibleShiftIndependent(shift.previous) || hasVisibleShiftIndependent(shift.current));
        const resultRow = (year, shares) => `
            <div class="bm-shift-tooltip-row">
                <span class="bm-shift-tooltip-year">${year} result</span>
                <span class="bm-shift-tooltip-shares">${
                    buildStatewideShiftShareCells(shares, showIndependent)
                }</span>
            </div>
        `;
        tooltip.innerHTML = !shift ? `
            <div class="bm-shift-tooltip-state">${details.stateName}</div>
            <div class="bm-shift-tooltip-empty">No comparable ${details.previousYear || "previous"} result is available for this state.</div>
        ` : `
            <div class="bm-shift-tooltip-state">${details.stateName}</div>
            ${resultRow(details.previousYear, shift.previous)}
            ${resultRow(details.currentYear, shift.current)}
            <div class="bm-shift-tooltip-shift${shift.direction ? ` bm-shift-${shift.direction.toLowerCase()}` : " bm-shift-even"}">
                ${shift.direction
                    ? `${shift.direction} +${shift.value.toFixed(1)} shift`
                    : "No shift"}
            </div>
        `;
        tooltip.style.display = "block";
        const margin = 12;
        const left = Math.min(
            event.clientX + 14,
            window.innerWidth - tooltip.offsetWidth - margin
        );
        const top = Math.min(
            event.clientY + 14,
            window.innerHeight - tooltip.offsetHeight - margin
        );
        tooltip.style.left = `${Math.max(margin, left)}px`;
        tooltip.style.top = `${Math.max(margin, top)}px`;
    };
    const clearStatewideTurnoutFloatingUi = () => {
        removeStatewideTurnoutTooltip();
        removeStatewideShiftTooltip();
        tooltipDiv.setAttribute("style", "display: none !important;");
        tooltipComponents.properties.visible = false;
        tooltipComponents.properties.targetDistrict = null;
    };
    const resetStatewideTurnoutMapSelection = () => {
        onCountyMap = false;
        activeMap = "US";
        clearStatewideTurnoutFloatingUi();
    };
    const setClassNameIfChanged = (element, className) => {
        if(!element || element.className === className) return false;
        element.className = className;
        return true;
    };
    const resetNativeElectionNightMapModeButtons = (options = {}) => {
        const projectButton = document.getElementById("eNightProjectB");
        const marginButton = document.getElementById("eNightMarginB");
        const projectChanged = setClassNameIfChanged(projectButton, "eNightProjectB");
        const marginChanged = setClassNameIfChanged(marginButton, "eNightMarginB");
        const changed = projectChanged || marginChanged;
        if(changed && options.suppressProjectObserver) {
            suppressElectionNightProjectObserverUntil = Date.now() + 160;
        }
        return changed;
    };
    const resetStatewideTurnoutMode = () => {
        statewideTurnoutRenderToken++;
        statewideTurnoutMapMode = null;
        document.body?.classList.remove("bm-turnout-mode-active");
        removeStatewideTurnoutLegend();
        removeStatewideTurnoutTooltip();
        const turnoutButton = document.getElementById("eNightTurnoutB");
        setClassNameIfChanged(turnoutButton, "eNightMarginB");
        const modeControls = document.getElementById("bm-turnout-mode-controls");
        modeControls?.classList.remove("active");
    };
    const removeStatewideShiftOverlay = svgMap => {
        const root = svgMap || document;
        root.querySelectorAll?.(".bm-statewide-shift-arrow")?.forEach(arrow => arrow.remove());
        root.querySelectorAll?.(".bm-statewide-shift-defs")?.forEach(defs => defs.remove());
        root.querySelectorAll?.("[data-bm-shift]")?.forEach(statePath => {
            statePath.removeAttribute("data-bm-shift");
            statePath.removeAttribute("data-bm-shift-points");
        });
    };
    const resetStatewideShiftMode = () => {
        statewideShiftMapMode = null;
        statewideShiftComparisonYear = null;
        statewideShiftDetailsByState.clear();
        removeStatewideShiftTooltip();
        document.body?.classList.remove("bm-shift-mode-active");
        const shiftButton = document.getElementById("eNightShiftB");
        setClassNameIfChanged(shiftButton, "eNightMarginB");
        document.querySelectorAll("svg").forEach(removeStatewideShiftOverlay);
    };
    const shouldIgnoreTurnoutDocumentEvent = event => {
        const target = event?.target;
        return Boolean(target?.closest?.([
            "#eNightTurnoutB",
            "#eNightShiftB",
            "#eNightPrecinctsB",
            "#bm-turnout-mode-controls",
            "#bm-statewide-turnout-legend",
            "#bm-statewide-turnout-tooltip",
            "#eNightProjectB",
            "#eNightMarginB",
            "#ePageProjectB",
            "#ePageMarginB",
            "#eNightReturnB",
            "#ePageReturnB",
            "#ePageReturnB2",
            "#bm-house-district-return",
            "#bm-house-district-controls",
            "#bm-house-district-zoom-controls"
        ].join(",")));
    };
    const traceStatewideTurnout = (message, payload = {}) => {
        const entry = {
            at: Math.round((typeof performance !== "undefined" && performance.now)
                ? performance.now()
                : Date.now()),
            message,
            mode: statewideTurnoutMapMode,
            view: statewideTurnoutMapView,
            onCountyMap,
            activeMap,
            lastMapElectionType,
            ...payload
        };
        globalThis.bmTurnoutTrace = globalThis.bmTurnoutTrace || [];
        globalThis.bmTurnoutTrace.push(entry);
        if(globalThis.bmTurnoutTrace.length > 80) globalThis.bmTurnoutTrace.shift();
        if(globalThis.bmTurnoutTraceEnabled) console.log("Turnout", entry);
    };
    const getStatewideTurnoutAvailabilityKey = electionType => {
        const year = getCurrentElectionYearValue() || getElectionNightPanelYear() || "current";
        return `${year}:${electionType}`;
    };
    const getStatePathFromMapEvent = (event, svgMap) => {
        const eventPath = typeof event?.composedPath === "function" ? event.composedPath() : [];
        const statePath = eventPath.find(element =>
            element?.classList?.contains?.("better-maps-state-path")
        );
        if(statePath && svgMap.contains(statePath)) return statePath;
        const targetStatePath = event?.target?.closest?.(".better-maps-state-path");
        return targetStatePath && svgMap.contains(targetStatePath) ? targetStatePath : null;
    };
    const getStateIdFromMapPath = statePath => String(statePath?.id || "")
        .replace(/-state-path(?:-live)?$/, "")
        .toUpperCase();

    const getThemeMapFill = (varName, fallback) => {
        try {
            const value = getComputedStyle(document.documentElement)
                .getPropertyValue(varName).trim();
            return value || fallback;
        } catch { return fallback; }
    };
    const getElectionPendingStateFill = (stateId, primary = false) => {
        return getThemeMapFill(
            "--bm-map-pending-fill",
            primary ? MAP_PRIMARY_ELECTION_PENDING_FILL : MAP_ELECTION_PENDING_FILL
        );
    };
    const applyNationalElectionStateOutline = (statePath, options = {}) => {
        if(!statePath) return;
        statePath.style.setProperty(
            "stroke",
            MAP_ELECTION_STATE_STROKE,
            "important"
        );
        statePath.style.setProperty(
            "stroke-width",
            "0.9px",
            "important"
        );
        statePath.style.setProperty("stroke-linejoin", "round");
        statePath.style.setProperty("vector-effect", "non-scaling-stroke");
    };
    const applyPendingNationalElectionStateFill = (
        statePath,
        stateId,
        options = {}
    ) => {
        if(!statePath) return;
        statePath.style.setProperty(
            "fill",
            options.noElection
                ? MAP_NO_ELECTION_FILL
                : getElectionPendingStateFill(stateId, options.primary === true)
        );
        applyNationalElectionStateOutline(statePath, options);
    };
    const applyNationalElectionMapOutlines = (svgMap, electionType, live) => {
        if(!svgMap || live !== true || onCountyMap) return;
        if(!["usHouse", "usSenate"].includes(electionType)) return;
        svgMap.querySelectorAll(".better-maps-state-path").forEach(statePath => {
            const stateId = getStateIdFromMapPath(statePath);
            const currentRace = resultProxies?.[electionType]?.[stateId.toLowerCase()];
            applyNationalElectionStateOutline(statePath, {
                noElection: !currentRace
            });
        });
    };
    const getMapElectionTypeFromStatePath = statePath => {
        const svgMap = statePath?.ownerSVGElement || statePath?.closest?.("svg");
        return svgMap?.getAttribute?.("data-type") || lastMapElectionType;
    };
    const rememberMapTooltipPointer = (event, districtId, electionType) => {
        const properties = tooltipComponents.properties;
        if(!properties) return;
        properties.hoverClientX = Number(event?.clientX) || 0;
        properties.hoverClientY = Number(event?.clientY) || 0;
        properties.hoverDistrictId = String(districtId || "").toLowerCase();
        properties.hoverElectionType = electionType || "";
    };
    const showRememberedMapTooltip = () => {
        const properties = tooltipComponents.properties;
        if(!properties || properties.visible === false || properties.targetDistrict === null) return;
        const clientX = Number(properties.hoverClientX) || 0;
        const clientY = Number(properties.hoverClientY) || 0;
        let left;
        let top;

        if(
            properties.positionedX === clientX
            && properties.positionedY === clientY
            && Number.isFinite(properties.positionedLeft)
            && Number.isFinite(properties.positionedTop)
        ) {
            left = properties.positionedLeft;
            top = properties.positionedTop;
        } else {
            const offset = 10;
            const width = tooltipDiv.offsetWidth || 320;
            const height = tooltipDiv.offsetHeight || 180;
            left = Math.max(
                4,
                Math.min(clientX + offset, window.innerWidth - width - 4)
            );
            top = Math.max(
                4,
                Math.min(clientY + offset, window.innerHeight - height - 4)
            );
            properties.positionedX = clientX;
            properties.positionedY = clientY;
            properties.positionedLeft = left;
            properties.positionedTop = top;
        }
        tooltipDiv.style.setProperty("display", "flex", "important");
        tooltipDiv.style.setProperty("left", `${left}px`);
        tooltipDiv.style.setProperty("top", `${top}px`);
    };
    const pointerStillTargetsMapDistrict = (event, districtId, electionType) => {
        if(typeof document.elementFromPoint !== "function") return false;
        const topElement = document.elementFromPoint(event.clientX, event.clientY);
        if(!topElement || tooltipDiv.contains(topElement)) return false;
        const statePath = topElement.closest?.(".better-maps-state-path");
        if(!statePath) return false;
        const pathDistrict = String(statePath.id || "")
            .replace(/-state-path(?:-live)?$/, "")
            .toLowerCase();
        return pathDistrict === String(districtId || "").toLowerCase()
            && getMapElectionTypeFromStatePath(statePath) === electionType;
    };
    const getTurnoutStatePathFromPoint = event => {
        if(typeof document.elementsFromPoint !== "function") return null;
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        if(elements.some(element => element?.closest?.("#eNightPrecinctsB"))) return null;
        return elements
            .filter(element => !element?.closest?.("#eNightTurnoutB, #eNightShiftB, #eNightPrecinctsB, #bm-turnout-mode-controls, #bm-statewide-turnout-legend, #bm-statewide-turnout-tooltip"))
            .find(element => element?.classList?.contains?.("better-maps-state-path")) || null;
    };
    const hideNativeMapTooltipForTurnout = () => {
        tooltipDiv.setAttribute("style", "display: none !important;");
        tooltipComponents.properties.visible = false;
        tooltipComponents.properties.targetDistrict = null;
    };
    const installStatewideTurnoutDocumentController = () => {
        if(statewideTurnoutDocumentControllerInstalled || !document) return;
        statewideTurnoutDocumentControllerInstalled = true;
        const blockTurnoutStateNavigation = event => {
            if(shouldIgnoreTurnoutDocumentEvent(event)) return;
            const statePath = event.target?.closest?.(".better-maps-state-path")
                || getTurnoutStatePathFromPoint(event);
            if(!statePath) return;
            const electionType = getMapElectionTypeFromStatePath(statePath);
            if(!isStatewideTurnoutModeSelected(electionType)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            traceStatewideTurnout("blocked state navigation", { electionType });
            resetStatewideTurnoutMapSelection();
        };
        const updateTurnoutHover = event => {
            if(!isStatewideTurnoutModeSelected(lastMapElectionType)) return;
            if(shouldIgnoreTurnoutDocumentEvent(event)) {
                return;
            }
            const statePath = event.target?.closest?.(".better-maps-state-path")
                || getTurnoutStatePathFromPoint(event);
            if(!statePath) {
                clearStatewideTurnoutFloatingUi();
                return;
            }
            const electionType = getMapElectionTypeFromStatePath(statePath);
            if(!isStatewideTurnoutModeSelected(electionType)) return;
            event.stopImmediatePropagation();
            onCountyMap = false;
            activeMap = "US";
            hideNativeMapTooltipForTurnout();
            const details = statewideTurnoutDetailsByState.get(getStateIdFromMapPath(statePath));
            if(details) showStatewideTurnoutTooltip(event, details);
            else removeStatewideTurnoutTooltip();
        };
        ["pointerdown", "mousedown", "mouseup", "click", "dblclick"].forEach(eventName => {
            window.addEventListener(eventName, blockTurnoutStateNavigation, true);
            statewideTurnoutDocumentListenerRemovers.push(() => {
                window.removeEventListener(eventName, blockTurnoutStateNavigation, true);
            });
        });
        window.addEventListener("mousemove", updateTurnoutHover, true);
        statewideTurnoutDocumentListenerRemovers.push(() => {
            window.removeEventListener("mousemove", updateTurnoutHover, true);
        });
    };
    const installStatewideTurnoutMapController = (svgMap, electionType) => {
        installStatewideTurnoutDocumentController();
        const existingController = statewideTurnoutMapControllers.get(svgMap);
        if(existingController?.electionType === electionType) return;
        if(existingController) existingController.destroy();

        const blockStateNavigation = event => {
            if(shouldIgnoreTurnoutDocumentEvent(event)) return;
            if(!isStatewideTurnoutModeSelected(electionType)) return;
            if(!getStatePathFromMapEvent(event, svgMap)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            traceStatewideTurnout("blocked svg state navigation", { electionType });
            resetStatewideTurnoutMapSelection();
        };
        const blockedEvents = ["pointerdown", "mousedown", "mouseup", "click"];
        blockedEvents.forEach(eventName =>
            svgMap.addEventListener(eventName, blockStateNavigation, true));

        statewideTurnoutMapControllers.set(svgMap, {
            electionType,
            destroy: () => {
                blockedEvents.forEach(eventName =>
                    svgMap.removeEventListener(eventName, blockStateNavigation, true));
            }
        });
    };
    const removeStatewideTurnoutControls = () => {
        statewideTurnoutRenderToken++;
        document.body?.classList.remove("bm-turnout-mode-active");
        document.body?.classList.remove("bm-shift-mode-active");
        document.getElementById("eNightTurnoutB")?.remove();
        document.getElementById("eNightShiftB")?.remove();
        document.getElementById("bm-turnout-mode-controls")?.remove();
        removeStatewideTurnoutLegend();
        removeStatewideTurnoutTooltip();
        document.querySelectorAll("svg").forEach(removeStatewideShiftOverlay);
        document.querySelectorAll(".bm-turnout-map-host").forEach(host =>
            host.classList.remove("bm-turnout-map-host"));
    };
    const formatTurnoutLegendValue = (value, comparison) => {
        const rounded = Math.round(Number(value) || 0);
        if(comparison && rounded > 0) return `+${rounded}%`;
        return `${rounded}%`;
    };
    const ensureStatewideTurnoutLegend = (svgMap, minimum, maximum, comparison) => {
        removeStatewideTurnoutLegend();
        const host = svgMap?.parentElement;
        if(!host) return;
        host.classList.add("bm-turnout-map-host");
        const legend = document.createElement("div");
        legend.id = "bm-statewide-turnout-legend";
        legend.className = comparison ? "comparison" : "current";
        legend.innerHTML = `
            <div class="bm-turnout-legend-title">${comparison ? "CURRENT VS PREVIOUS ELECTION" : "CURRENT TURNOUT"}</div>
            <div class="bm-turnout-legend-labels">
                <span>${formatTurnoutLegendValue(minimum, comparison)}</span>
                <span>${formatTurnoutLegendValue(maximum, comparison)}</span>
            </div>
            <div class="bm-turnout-legend-gradient"></div>
        `;
        host.appendChild(legend);
    };
    const showStatewideTurnoutTooltip = (event, details) => {
        if(!details) return;
        let tooltip = document.getElementById("bm-statewide-turnout-tooltip");
        if(!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "bm-statewide-turnout-tooltip";
            document.body.appendChild(tooltip);
        }
        tooltip.style.setProperty("--bm-turnout-colour", details.colour || "#176b2c");
        const change = Number(details.changePoints) || 0;
        tooltip.innerHTML = details.noHistory ? `
            <div class="bm-turnout-tooltip-state">${details.stateName}</div>
            <div class="bm-turnout-tooltip-empty">No previous-election information is available for this state.</div>
        ` : details.comparison ? `
            <div class="bm-turnout-tooltip-state">${details.stateName}</div>
            <div class="bm-turnout-tooltip-comparison">
                <div class="bm-turnout-tooltip-change ${change >= 0 ? "positive" : "negative"}">(${change >= 0 ? "+" : ""}${change.toFixed(1)} points)</div>
                <div class="bm-turnout-tooltip-rates">
                    <div class="bm-turnout-tooltip-row"><span>Turnout rate, ${details.previousYear}</span><strong>${details.previousRate.toFixed(1)}%</strong></div>
                    <div class="bm-turnout-tooltip-row"><span>Turnout rate, ${details.currentYear}</span><strong>${details.currentRate.toFixed(1)}%</strong></div>
                </div>
            </div>
        ` : `
            <div class="bm-turnout-tooltip-state">${details.stateName}</div>
            <div class="bm-turnout-tooltip-row"><span>Registered</span><strong>${formatWholeNumber(details.registeredVoters)}</strong></div>
            <div class="bm-turnout-tooltip-row"><span>Total reported</span><strong>${formatWholeNumber(details.currentVotes)}</strong></div>
            <div class="bm-turnout-tooltip-rate">${details.currentRate.toFixed(1)}% turnout</div>
        `;
        tooltip.style.display = "block";
        const margin = 12;
        const left = Math.min(
            event.clientX + 14,
            window.innerWidth - tooltip.offsetWidth - margin
        );
        const top = Math.min(
            event.clientY + 14,
            window.innerHeight - tooltip.offsetHeight - margin
        );
        tooltip.style.left = `${Math.max(margin, left)}px`;
        tooltip.style.top = `${Math.max(margin, top)}px`;
    };
    const updateStatewideTurnoutMap = (svgMap, electionType, live) => {
        const comparison = statewideTurnoutMapView === "comparison";
        const values = [];
        const stateValues = new Map();
        const stateDetails = new Map();
        statewideTurnoutDetailsByState.clear();
        const currentYear = getCurrentElectionYearValue() || getElectionNightPanelYear() || "";
        svgMap.querySelectorAll(".better-maps-state-path").forEach(statePath => {
            const stateId = String(statePath.id || "")
                .replace(/-state-path(?:-live)?$/, "")
                .toUpperCase();
            const race = resultProxies[electionType][stateId];
            const currentVotes = getStatewideRaceVotes(race, live);
            const registeredVoters = getStateRegisteredVoters(stateId);
            let value = null;
            let details = null;
            if(currentVotes > 0 && registeredVoters > 0) {
                const currentRate = (currentVotes / registeredVoters) * 100;
                if(comparison) {
                    const previous = getPreviousStatewideRaceDetails(electionType, stateId);
                    if(previous?.votes > 0 && previous?.registeredVoters > 0) {
                        const previousRate = (previous.votes / previous.registeredVoters) * 100;
                        value = currentRate - previousRate;
                        details = {
                            comparison: true,
                            stateName: Executive?.data?.states?.[stateId.toLowerCase()]?.name || stateId,
                            currentYear,
                            previousYear: previous.year || "",
                            registeredVoters,
                            currentVotes,
                            currentRate,
                            previousRate,
                            changePoints: value
                        };
                    } else {
                        details = {
                            comparison: true,
                            noHistory: true,
                            stateName: Executive?.data?.states?.[stateId.toLowerCase()]?.name || stateId
                        };
                    }
                } else {
                    value = currentRate;
                    details = {
                        comparison: false,
                        stateName: Executive?.data?.states?.[stateId.toLowerCase()]?.name || stateId,
                        currentYear,
                        registeredVoters,
                        currentVotes,
                        currentRate
                    };
                }
            }
            if(Number.isFinite(value)) {
                stateValues.set(stateId, value);
                values.push(value);
            }
            if(details) stateDetails.set(stateId, details);
        });
        const extent = values.length ? d3.extent(values) : [0, 0];
        let minimum = Number(extent[0]) || 0;
        let maximum = Number(extent[1]) || 0;
        if(comparison) {
            const maximumDifference = Math.max(5, Math.abs(minimum), Math.abs(maximum));
            minimum = -maximumDifference;
            maximum = maximumDifference;
        } else {
            minimum = 30;
            maximum = 80;
        }
        const midpoint = comparison ? 0 : 55;
        const colourScale = comparison
            ? d3.scaleLinear()
                .domain([minimum, midpoint, maximum])
                .range(["#8f2d18", "#f4e8de", "#138a36"])
                .clamp(true)
            : d3.scaleLinear()
                .domain([minimum, midpoint, maximum])
                .range(["#8f2d18", "#f28e2b", "#138a36"])
                .clamp(true);
        svgMap.querySelectorAll(".better-maps-state-path").forEach(statePath => {
            const stateId = String(statePath.id || "")
                .replace(/-state-path(?:-live)?$/, "")
                .toUpperCase();
            const value = stateValues.get(stateId);
            const stateColour = Number.isFinite(value) ? colourScale(value) : "#cccccc";
            statePath.style.fill = stateColour;
            const details = stateDetails.get(stateId) || null;
            if(details) details.colour = stateColour;
            if(details) statewideTurnoutDetailsByState.set(stateId, details);
        });
        ensureStatewideTurnoutLegend(svgMap, minimum, maximum, comparison);
        if(comparison && values.length === 0) {
            const host = svgMap?.parentElement;
            if(host) {
                const emptyMessage = document.createElement("div");
                emptyMessage.id = "bm-turnout-no-history";
                emptyMessage.textContent = "No previous-election information is available.";
                host.appendChild(emptyMessage);
            }
        }
        const senateBanner = document.getElementById("bm-senate-banner");
        if(senateBanner) {
            senateBanner.classList.remove("show");
            senateBanner.innerHTML = "";
        }
        const houseBanner = document.getElementById("bm-house-banner");
        if(houseBanner) {
            houseBanner.classList.remove("show");
            houseBanner.innerHTML = "";
        }
        const presidentBanner = document.getElementById("bm-president-elect-banner");
        if(presidentBanner) {
            presidentBanner.classList.remove("show");
            presidentBanner.innerHTML = "";
        }
    };
    const updateStatewideShiftMap = (svgMap, electionType, live) => {
        if(!svgMap) return;
        removeStatewideTurnoutLegend();
        removeStatewideTurnoutTooltip();
        removeStatewideShiftOverlay(svgMap);
        statewideShiftDetailsByState.clear();
        statewideShiftComparisonYear = getStatewideShiftComparisonYear(electionType);
        const namespace = "http://www.w3.org/2000/svg";
        const getBalancedStateArrowPoint = statePath => {
            const cachedPoint = statewideShiftArrowPoints.get(statePath);
            if(cachedPoint) return cachedPoint;
            let box = null;
            try {
                box = statePath.getBBox();
            } catch {}
            if(!box || box.width <= 0 || box.height <= 0) return null;
            const center = {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2
            };
            if(typeof statePath.isPointInFill !== "function" || typeof DOMPoint === "undefined") {
                const fallback = { ...center, box };
                statewideShiftArrowPoints.set(statePath, fallback);
                return fallback;
            }
            const candidates = [];
            const divisions = 15;
            for(let row = 1; row < divisions; row++) {
                for(let column = 1; column < divisions; column++) {
                    const x = box.x + (box.width * column / divisions);
                    const y = box.y + (box.height * row / divisions);
                    try {
                        if(statePath.isPointInFill(new DOMPoint(x, y))) {
                            candidates.push({
                                x,
                                y,
                                centerDistance: Math.hypot(x - center.x, y - center.y),
                                clearance: 0
                            });
                        }
                    } catch {}
                }
            }
            const minimumDimension = Math.max(1, Math.min(box.width, box.height));
            const radiusStep = minimumDimension / 18;
            const directions = Array.from({ length: 8 }, (_, index) => ({
                x: Math.cos(index * Math.PI / 4),
                y: Math.sin(index * Math.PI / 4)
            }));
            candidates.forEach(candidate => {
                for(let radius = radiusStep; radius <= minimumDimension * 0.34; radius += radiusStep) {
                    const remainsInside = directions.every(direction => {
                        try {
                            return statePath.isPointInFill(new DOMPoint(
                                candidate.x + direction.x * radius,
                                candidate.y + direction.y * radius
                            ));
                        } catch {
                            return false;
                        }
                    });
                    if(!remainsInside) break;
                    candidate.clearance = radius;
                }
                candidate.score = candidate.clearance - candidate.centerDistance * 0.035;
            });
            const selected = candidates.sort((pointA, pointB) =>
                pointB.score - pointA.score
            )[0];
            const balancedPoint = { ...(selected || center), box };
            statewideShiftArrowPoints.set(statePath, balancedPoint);
            return balancedPoint;
        };

        svgMap.querySelectorAll(".better-maps-state-path").forEach(statePath => {
            const stateId = String(statePath.id || "")
                .replace(/-state-path(?:-live)?$/, "")
                .toUpperCase();
            const currentRace = resultProxies[electionType]?.[stateId];
            const hasElection = Array.isArray(currentRace?.cands) && currentRace.cands.length > 0;
            statePath.setAttribute("data-bm-shift", hasElection ? "pending" : "inactive");
            if(!hasElection) {
                statePath.style.fill = "#bfc1c2";
                return;
            }
            statePath.style.fill = "#dededb";
            const previous = getPreviousStatewideShiftRace(electionType, stateId);
            const shift = calculateStatewideShift(currentRace, previous?.race, live);
            statewideShiftDetailsByState.set(stateId, {
                stateName: Executive?.data?.states?.[stateId.toLowerCase()]?.name || stateId,
                currentYear: getCurrentElectionYearValue() || getElectionNightPanelYear() || "",
                previousYear: previous?.year || statewideShiftComparisonYear || "",
                shift
            });
            if(!shift?.direction) return;
            const shiftParty = shift.direction;
            const absoluteShift = shift.value;
            statePath.style.fill = "#f3f3f0";
            statePath.setAttribute("data-bm-shift", shiftParty);
            statePath.setAttribute("data-bm-shift-points", absoluteShift.toFixed(2));
            const placement = getBalancedStateArrowPoint(statePath);
            if(!placement) return;

            const length = getStatewideShiftArrowLength(absoluteShift);
            const halfLength = length / 2;
            const chevronArm = Math.min(length * 0.36, Math.max(4.5, length * 0.26));
            const headLength = chevronArm * 0.875;
            const headHalfWidth = chevronArm * 0.485;
            const shoulderX = halfLength - headLength;
            const arrowData = [
                `M ${-halfLength} 0`,
                `L ${halfLength} 0`,
                `M ${shoulderX} ${-headHalfWidth}`,
                `L ${halfLength} 0`,
                `L ${shoulderX} ${headHalfWidth}`
            ].join(" ");
            const arrowStrokeWidth = Math.min(1.8, 1.25 + (length * 0.011));
            const arrowGroup = document.createElementNS(namespace, "g");
            arrowGroup.setAttribute("class", "bm-statewide-shift-arrow");
            arrowGroup.setAttribute("pointer-events", "none");
            arrowGroup.setAttribute(
                "transform",
                `translate(${placement.x} ${placement.y}) rotate(${shiftParty === "R" ? -45 : -135})`
            );

            const arrowHalo = document.createElementNS(namespace, "path");
            arrowHalo.setAttribute("d", arrowData);
            arrowHalo.setAttribute("fill", "none");
            arrowHalo.setAttribute("stroke", "rgba(255, 255, 255, 0.9)");
            arrowHalo.setAttribute("stroke-width", String(arrowStrokeWidth + 1.2));
            arrowHalo.setAttribute("stroke-linecap", "butt");
            arrowHalo.setAttribute("stroke-linejoin", "miter");
            arrowHalo.setAttribute("vector-effect", "non-scaling-stroke");
            arrowGroup.appendChild(arrowHalo);

            const arrow = document.createElementNS(namespace, "path");
            arrow.setAttribute("d", arrowData);
            arrow.setAttribute("fill", "none");
            arrow.setAttribute("stroke", stringifyColour(config.partyColours[shiftParty]));
            arrow.setAttribute("stroke-width", String(arrowStrokeWidth));
            arrow.setAttribute("stroke-linecap", "butt");
            arrow.setAttribute("stroke-linejoin", "miter");
            arrow.setAttribute("vector-effect", "non-scaling-stroke");
            arrowGroup.appendChild(arrow);
            statePath.parentNode?.appendChild(arrowGroup);
        });
        const senateBanner = document.getElementById("bm-senate-banner");
        if(senateBanner) {
            senateBanner.classList.remove("show");
            senateBanner.innerHTML = "";
        }
        const houseBanner = document.getElementById("bm-house-banner");
        if(houseBanner) {
            houseBanner.classList.remove("show");
            houseBanner.innerHTML = "";
        }
        const presidentBanner = document.getElementById("bm-president-elect-banner");
        if(presidentBanner) {
            presidentBanner.classList.remove("show");
            presidentBanner.innerHTML = "";
        }
    };
    const renderStatewideTurnoutNationalMap = ({
        svgMap,
        electionType,
        live,
        view = "current",
        reason = "manual",
        refreshControls = null,
        deactivateNativeMapButtons = null,
        onClickPageFunc = null
    }) => {
        const renderToken = ++statewideTurnoutRenderToken;
        const needsNativeNationalRender = onCountyMap || String(activeMap || "US").toUpperCase() !== "US";
        statewideTurnoutMapMode = electionType;
        statewideTurnoutMapView = view === "comparison" ? "comparison" : "current";
        resetStatewideTurnoutMapSelection();
        deactivateNativeMapButtons?.();
        refreshControls?.();
        traceStatewideTurnout("turnout render requested", { electionType, view: statewideTurnoutMapView, reason, renderToken });
        if(needsNativeNationalRender && typeof onClickPageFunc === "function") {
            try {
                onClickPageFunc();
                deactivateNativeMapButtons?.();
                refreshControls?.();
                traceStatewideTurnout("turnout requested native national rerender", { electionType, reason, renderToken });
            } catch(error) {
                traceStatewideTurnout("turnout native rerender failed", { electionType, reason, renderToken, error: String(error?.message || error) });
            }
        }

        const renderAttempt = attempt => {
            if(renderToken !== statewideTurnoutRenderToken) {
                traceStatewideTurnout("turnout render aborted", { electionType, reason, renderToken, currentToken: statewideTurnoutRenderToken });
                return;
            }
            const activeSvgMap = document.getElementById(`${electionType}-map-live`) || svgMap;
            if(!activeSvgMap || activeSvgMap.getAttribute("data-type") !== electionType) {
                if(attempt < 8) {
                    setTimeout(() => renderAttempt(attempt + 1), 25);
                } else {
                    traceStatewideTurnout("turnout render missing svg", { electionType, reason, renderToken });
                }
                return;
            }
            resetStatewideTurnoutMapSelection();
            deactivateNativeMapButtons?.();
            installStatewideTurnoutMapController(activeSvgMap, electionType);
            updateStatewideTurnoutMap(activeSvgMap, electionType, live);
            refreshControls?.();
            traceStatewideTurnout("turnout render painted", {
                electionType,
                view: statewideTurnoutMapView,
                reason,
                renderToken,
                details: statewideTurnoutDetailsByState.size
            });
        };

        renderAttempt(0);
        setTimeout(() => renderAttempt(1), 0);
        setTimeout(() => renderAttempt(2), 80);
    };
    const getPreviousStatewideWinner = (electionType, stateId) => {
        let archive = null;
        try {
            if(electionType === "president") {
                archive = typeof presidentArchive !== "undefined" ? presidentArchive : globalThis.presidentArchive;
            } else if(electionType === "usSenate") {
                archive = typeof usSenateArchive !== "undefined" ? usSenateArchive : globalThis.usSenateArchive;
            } else if(electionType === "governor") {
                archive = typeof allGovArchive !== "undefined" ? allGovArchive : globalThis.allGovArchive;
            }
        } catch {}
        if(!Array.isArray(archive)) return null;
        let gameYear = null;
        gameYear = getCurrentElectionYearValue();
        const previousGenerals = archive
            .filter(entry => entry.category === "general"
                && (!Number.isFinite(gameYear) || Number(entry.year) < gameYear))
            .sort((entryA, entryB) => {
                if(electionType === "usSenate" && Number.isFinite(gameYear)) {
                    const classElectionYear = gameYear - 6;
                    const distanceA = Math.abs(Number(entryA.year) - classElectionYear);
                    const distanceB = Math.abs(Number(entryB.year) - classElectionYear);
                    if(distanceA !== distanceB) return distanceA - distanceB;
                }
                return Number(entryB.year) - Number(entryA.year);
            });
        if(previousGenerals.length === 0) return null;
        const stateName = Executive.data.states[stateId.toLowerCase()]?.name;
        let previousRace = null;
        for(const previousGeneral of previousGenerals) {
            previousRace = electionType === "president"
                ? (previousGeneral.exitPoll?.states || previousGeneral.states || []).find(state =>
                    String(state?.name || state?.state || "").toLowerCase()
                    === String(stateName || "").toLowerCase()
                )
                : (previousGeneral.elections || []).find(election =>
                    String(election?.district || "").toLowerCase()
                    === String(stateName || "").toLowerCase()
                );
            if(previousRace) break;
        }
        if(!previousRace) return null;
        return (previousRace.candidates || previousRace.cands || [])
            .slice()
            .sort((cand1, cand2) =>
                Number(cand2.totVotes ?? cand2.votes ?? 0)
                - Number(cand1.totVotes ?? cand1.votes ?? 0)
            )[0] || null;
    };
    const getPreviousPresidentialStateWinner = stateId => {
        const previous = getPreviousStatewideShiftRace("president", stateId);
        const previousRace = previous?.race;
        if(!previousRace) return getPreviousStatewideWinner("president", stateId);
        return (previousRace.candidates || previousRace.cands || [])
            .slice()
            .sort((cand1, cand2) =>
                Number(cand2.totVotes ?? cand2.votes ?? cand2.finalVotes ?? 0)
                - Number(cand1.totVotes ?? cand1.votes ?? cand1.finalVotes ?? 0)
            )[0] || null;
    };
    const getExplicitPreviousStatewideSeatDescriptor = (source, includeCurrentHolder = true) => {
        if(!source || typeof source !== "object") return null;
        const partyKeys = includeCurrentHolder
            ? [
                "incumbentParty", "incumbParty", "previousParty", "priorParty",
                "oldParty", "lastParty", "seatParty", "holderParty",
                "defendingParty", "retiringParty", "openSeatParty"
            ]
            : [
                "incumbentParty", "incumbParty", "previousParty", "priorParty",
                "oldParty", "lastParty", "defendingParty", "retiringParty",
                "openSeatParty"
            ];
        for(const key of partyKeys) {
            const value = source[key];
            if(value) return typeof value === "object" ? value : { party: value };
        }
        const holderKeys = includeCurrentHolder
            ? [
                "previousWinner", "previousIncumbent", "incumbent",
                "officeHolder", "currentHolder", "currentSenator", "senator", "governor"
            ]
            : ["previousWinner", "previousIncumbent", "incumbent"];
        for(const key of holderKeys) {
            const value = source[key];
            if(value) return typeof value === "object" ? value : { party: value };
        }
        return null;
    };
    const getStatewideFlipPreviousWinner = (electionType, stateId, currentDistrict) => {
        if(electionType === "president") {
            return getPreviousPresidentialStateWinner(stateId);
        }
        const incumbentCandidate = Array.isArray(currentDistrict?.cands)
            ? currentDistrict.cands.find(candidate =>
                candidate?.incumbent === true
                || candidate?.incumbent === 1
                || String(candidate?.incumbent || "").toLowerCase() === "true"
                || /\*$/.test(String(candidate?.name || candidate?.fullName || "").trim())
            )
            : null;
        if(electionType === "usSenate") {
            const explicitPrevious = getExplicitPreviousStatewideSeatDescriptor(
                currentDistrict,
                false
            );
            if(explicitPrevious) return explicitPrevious;
            const previousClassWinner = getPreviousStatewideWinner(electionType, stateId);
            if(previousClassWinner) return previousClassWinner;
            if(incumbentCandidate) return incumbentCandidate;
            const currentClassHolder = getCurrentSenateParty(stateId);
            return currentClassHolder || null;
        }
        const explicitPrevious = getExplicitPreviousStatewideSeatDescriptor(currentDistrict);
        if(explicitPrevious) return explicitPrevious;
        if(incumbentCandidate) return incumbentCandidate;
        return getPreviousStatewideWinner(electionType, stateId);
    };
    const normalizeFlipPartyText = value => String(value || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    const getFlipComparisonPartyBlock = candidateOrParty => {
        const rawParty = typeof candidateOrParty === "string"
            ? candidateOrParty
            : getCandidateVariantPartyKey(candidateOrParty);
        const normalized = normalizeFlipPartyText(rawParty);
        if(normalized === "D" || normalized === "DEM" || normalized.startsWith("DEMOCRAT")) return "D";
        if(normalized === "R" || normalized === "REP" || normalized.startsWith("REPUBLICAN")) return "R";
        if(
            normalized === "ID"
            || normalized === "INDD"
            || normalized.includes("INDEPENDENTDEM")
            || normalized.includes("INDDEM")
        ) return "ID";
        if(
            normalized === "IR"
            || normalized === "INDR"
            || normalized.includes("INDEPENDENTREP")
            || normalized.includes("INDREP")
        ) return "IR";
        return normalized ? "I" : null;
    };
    const getPlayerGovernorCountyArchive = () => {
        try {
            const archive = typeof governorArchive !== "undefined"
                ? governorArchive
                : globalThis.governorArchive;
            return Array.isArray(archive) ? archive : [];
        } catch {
            return [];
        }
    };
    const getArchivedGovernorCandidates = race => {
        if(Array.isArray(race?.cands)) return race.cands;
        if(Array.isArray(race?.candidates)) return race.candidates;
        return [];
    };
    const getArchivedGovernorCandidateVariant = candidate => {
        const archivedVariant = getCandidateVariantPartyKey(candidate);
        if(String(archivedVariant || "").startsWith("I")) return archivedVariant;
        const candidateId = candidate?.id
            ?? candidate?.candID
            ?? candidate?.candidateId
            ?? candidate?.candidateID;
        if(candidateId !== undefined && candidateId !== null) {
            try {
                const character = findCandByID([candidateId])?.[0];
                const wrapped = Executive?.data?.characters?.wrapCharacter(
                    character,
                    "candidate"
                );
                const runtimeVariant = getCandidateVariantPartyKey({
                    party: wrapped?.extendedAttribs?.party || wrapped?.party,
                    caucusParty: wrapped?.caucusParty
                        || wrapped?.caucus
                        || wrapped?.extendedAttribs?.caucusParty
                        || wrapped?.extendedAttribs?.caucus
                });
                if(String(runtimeVariant || "").startsWith("I")) {
                    return runtimeVariant;
                }
            } catch {}
        }
        const statewideVariant = getStatewideShiftCandidateParty(candidate);
        if(statewideVariant) return statewideVariant;
        return archivedVariant;
    };
    const getArchivedCountyWinnerReference = county => {
        if(!county || typeof county !== "object") return null;
        const objectWinner = county.winner
            || county.winningCandidate
            || county.winnerCandidate
            || county.candidate;
        if(objectWinner && typeof objectWinner === "object") return objectWinner;
        if(typeof objectWinner === "string" && objectWinner.trim()) {
            return { name: objectWinner.trim() };
        }
        const id = county.winnerId
            ?? county.winnerID
            ?? county.winnerCandidateId
            ?? county.winnerCandidateID
            ?? county.candidateId
            ?? county.candidateID;
        if(id !== undefined && id !== null && String(id).trim()) {
            return { id };
        }
        const name = county.winnerName
            || county.winningCandidateName
            || county.candidateName;
        return name ? { name } : null;
    };
    const findArchivedGovernorCandidate = (reference, candidates) => {
        if(!reference) return null;
        const referenceId = reference.id
            ?? reference.candID
            ?? reference.candidateId
            ?? reference.candidateID;
        if(referenceId !== undefined && referenceId !== null) {
            const idMatch = candidates.find(candidate => {
                const candidateId = candidate?.id
                    ?? candidate?.candID
                    ?? candidate?.candidateId
                    ?? candidate?.candidateID;
                return candidateId !== undefined
                    && candidateId !== null
                    && String(candidateId) === String(referenceId);
            });
            if(idMatch) return idMatch;
        }
        const referenceName = String(
            reference.name
            || reference.fullName
            || reference.displayName
            || ""
        ).replace(/\*+$/, "").replace(/\s+/g, " ").trim().toLowerCase();
        if(!referenceName) return null;
        return candidates.find(candidate =>
            String(getPanelCandidateName(candidate) || "")
                .replace(/\*+$/, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase() === referenceName
        ) || null;
    };
    const getArchivedGovernorCandidateIdentity = candidate => {
        const id = candidate?.id
            ?? candidate?.candID
            ?? candidate?.candidateId
            ?? candidate?.candidateID;
        if(id !== undefined && id !== null && String(id).trim()) {
            return `id:${String(id).trim()}`;
        }
        const name = String(getPanelCandidateName(candidate) || "")
            .replace(/\*+$/, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        return name ? `name:${name}` : "";
    };
    const isSameGovernorElectionResult = (archiveRace, currentRace) => {
        const archivedCandidates = getArchivedGovernorCandidates(archiveRace);
        const currentCandidates = getArchivedGovernorCandidates(currentRace);
        if(archivedCandidates.length < 2 || currentCandidates.length < 2) return false;
        const archivedIdentities = new Set(
            archivedCandidates.map(getArchivedGovernorCandidateIdentity).filter(Boolean)
        );
        const sharedIdentities = currentCandidates
            .map(getArchivedGovernorCandidateIdentity)
            .filter(identity => identity && archivedIdentities.has(identity));
        if(sharedIdentities.length >= 2) return true;

        const archivedTotal = archivedCandidates.reduce((sum, candidate) =>
            sum + Math.max(0, Number(
                candidate?.votes
                ?? candidate?.totVotes
                ?? candidate?.finalVotes
            ) || 0), 0);
        const currentTotal = currentCandidates.reduce((sum, candidate) =>
            sum + Math.max(0, Number(
                candidate?.votes
                ?? candidate?.totVotes
                ?? candidate?.finalVotes
            ) || 0), 0);
        if(archivedTotal <= 0 || currentTotal <= 0) return false;
        return Math.abs(archivedTotal - currentTotal) <= Math.max(2, currentTotal * 0.000001)
            && sharedIdentities.length >= 1;
    };
    const getPreviousGovernorCountyWinnerMap = (stateId, currentRace) => {
        const normalizedState = String(stateId || "").toUpperCase();
        const archive = getPlayerGovernorCountyArchive();
        const matchingCurrentArchive = archive
            .filter(entry =>
                entry?.category === "general"
                && getArchivedRaceStateCode(entry) === normalizedState
                && isSameGovernorElectionResult(entry, currentRace)
            )
            .sort((left, right) => Number(right?.year) - Number(left?.year))[0];
        const explicitCurrentRaceYear = Number(
            currentRace?.year ?? currentRace?.electionYear
        );
        const currentRaceYear = Number.isFinite(explicitCurrentRaceYear)
            ? explicitCurrentRaceYear
            : Number(matchingCurrentArchive?.year ?? getCurrentElectionYearValue());
        const previousRace = archive
            .filter(entry =>
                entry?.category === "general"
                && getArchivedRaceStateCode(entry) === normalizedState
                && Array.isArray(entry?.counties)
                && entry.counties.length > 0
                && entry !== matchingCurrentArchive
                && (
                    !Number.isFinite(currentRaceYear)
                    || Number(entry?.year) < currentRaceYear
                )
            )
            .sort((entryA, entryB) => Number(entryB?.year) - Number(entryA?.year))[0];
        if(!previousRace) return null;
        const archivedCandidates = getArchivedGovernorCandidates(previousRace);
        const archivedStatewideWinner = archivedCandidates.slice().sort(
            (left, right) => (
                Math.max(0, Number(
                    right?.votes
                    ?? right?.totVotes
                    ?? right?.finalVotes
                ) || 0)
                - Math.max(0, Number(
                    left?.votes
                    ?? left?.totVotes
                    ?? left?.finalVotes
                ) || 0)
            )
        )[0] || null;
        const hasIndependentStatewideWinner = Boolean(
            archivedStatewideWinner
            && String(
                getArchivedGovernorCandidateVariant(archivedStatewideWinner) || ""
            ).startsWith("I")
            && Math.max(0, Number(
                archivedStatewideWinner?.votes
                ?? archivedStatewideWinner?.totVotes
                ?? archivedStatewideWinner?.finalVotes
            ) || 0) > 0
        );
        const winners = new Map();
        let hasUnverifiableIndependentCounty = false;
        previousRace.counties.forEach(county => {
            const countyKey = normalizePrimaryCountyName(county?.name, normalizedState);
            const winnerReference = getArchivedCountyWinnerReference(county);
            const winnerCandidate = findArchivedGovernorCandidate(
                winnerReference,
                archivedCandidates
            );
            if(hasIndependentStatewideWinner && !winnerCandidate) {
                hasUnverifiableIndependentCounty = true;
            }
            const partyBlock = winnerCandidate
                ? getFlipComparisonPartyBlock(
                    getArchivedGovernorCandidateVariant(winnerCandidate)
                )
                : getFlipComparisonPartyBlock(
                    county?.winParty
                    || county?.winnerParty
                    || county?.party
                );
            if(countyKey && partyBlock) winners.set(countyKey, partyBlock);
        });
        return winners.size > 0
            ? {
                year: Number(previousRace.year) || null,
                winners,
                reliable: !hasUnverifiableIndependentCounty,
                unavailableReason: hasUnverifiableIndependentCounty
                    ? "independent-county-winner-not-recorded"
                    : ""
            }
            : null;
    };
    const isGovernorCountyFlipModeAvailable = (electionType, stateId, currentRace, live) => {
        if(
            electionType !== "governor"
            || isStatewidePrimaryRace(currentRace)
            || getRcvRaceReporting(currentRace, live) < 99.999
        ) return false;
        const previousResults = getPreviousGovernorCountyWinnerMap(stateId, currentRace);
        if(!previousResults) return false;
        return live !== true || previousResults.reliable === true;
    };
    const getFlipCandidateIdentity = candidate => {
        if(!candidate || typeof candidate !== "object") return "";
        const id = candidate.id
            ?? candidate.candID
            ?? candidate.candidateId
            ?? candidate.candidateID
            ?? candidate.personId
            ?? candidate.personID
            ?? candidate.characterId
            ?? candidate.characterID
            ?? candidate.politicianId
            ?? candidate.politicianID;
        if(id !== undefined && id !== null && String(id).trim() !== "") return `id:${String(id).trim()}`;
        const name = String(candidate.name || candidate.fullName || candidate.displayName || "").replace(/\*/g, "").trim().toLowerCase();
        return name ? `name:${name}` : "";
    };
    const getFlipCandidateNameTokens = candidate => {
        const name = String(candidate?.name || candidate?.fullName || candidate?.displayName || "")
            .replace(/\*/g, "")
            .replace(/[^a-zA-Z\s'-]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        return name ? name.split(/\s+/).filter(Boolean) : [];
    };
    const isSameFlipCandidate = (candidateA, candidateB) => {
        const identityA = getFlipCandidateIdentity(candidateA);
        const identityB = getFlipCandidateIdentity(candidateB);
        if(identityA && identityB && identityA === identityB) return true;
        const tokensA = getFlipCandidateNameTokens(candidateA);
        const tokensB = getFlipCandidateNameTokens(candidateB);
        if(!tokensA.length || !tokensB.length) return false;
        const nameA = tokensA.join(" ");
        const nameB = tokensB.join(" ");
        if(nameA === nameB) return true;
        if(tokensA.length === 1 && tokensB[tokensB.length - 1] === tokensA[0]) return true;
        if(tokensB.length === 1 && tokensA[tokensA.length - 1] === tokensB[0]) return true;
        return false;
    };
    const HOUSE_SEAT_BALANCE_TIE_EDGE_LIGHTNESS = 82;
    const HOUSE_SEAT_BALANCE_MIN_SATURATION_SCALE = 0.55;
    const getHousePoliticianSeatBalanceColour = stateSummary => {
        const democraticSeats = Math.max(0, Number(stateSummary?.projectedDem) || 0);
        const republicanSeats = Math.max(0, Number(stateSummary?.projectedRep) || 0);
        const totalSeats = democraticSeats + republicanSeats;
        if(totalSeats <= 0) return null;
        if(democraticSeats === republicanSeats) {
            return stringifyColour(config.partyColours.HouseTie);
        }
        const leadParty = democraticSeats > republicanSeats ? "D" : "R";
        const baseColour = config.partyColours[leadParty];
        const seatDominance = Math.abs(democraticSeats - republicanSeats) / totalSeats;
        const saturationScale = HOUSE_SEAT_BALANCE_MIN_SATURATION_SCALE
            + ((1 - HOUSE_SEAT_BALANCE_MIN_SATURATION_SCALE) * seatDominance);
        const saturation = Math.max(0, Math.min(100, Number(baseColour.s) * saturationScale));
        const lightness = HOUSE_SEAT_BALANCE_TIE_EDGE_LIGHTNESS
            + ((Number(baseColour.l) - HOUSE_SEAT_BALANCE_TIE_EDGE_LIGHTNESS) * seatDominance);
        return stringifyColour({
            h: baseColour.h,
            s: Math.round(saturation * 10) / 10,
            l: Math.round(lightness * 10) / 10
        });
    };
    const updateMap = (svgMap, resultColours, electionType, live, projected) => {
        svgMap.setAttribute("data-colours", JSON.stringify(resultColours));
        if(isStatewideShiftModeSelected(electionType)) {
            updateStatewideShiftMap(svgMap, electionType, live);
            return;
        }
        if(isStatewideTurnoutModeActive(electionType)) {
            updateStatewideTurnoutMap(svgMap, electionType, live);
            return;
        }
        removeStatewideShiftOverlay(svgMap);
        removeStatewideTurnoutLegend();
        applyNationalElectionMapOutlines(svgMap, electionType, live);
        const resultKeys = Object.keys(resultColours);
        const isPrimaryControlPage = live === true && (
            isPrimaryElectionNightPage()
            || (
                electionType === "usSenate"
                && resultKeys.some(stateId => isStatewidePrimaryRace(
                    getStatewideRaceForMap(electionType, stateId, { allowArchive: false })
                ))
            )
            || (
                electionType === "usHouse"
                && resultKeys.some(stateId => isHousePrimaryState(
                    getStatewideRaceForMap(electionType, stateId, { allowArchive: false })
                ))
            )
        );
        if(electionType === "usSenate" || electionType === "usHouse") {
            svgMap.setAttribute("data-bm-primary-election", isPrimaryControlPage ? "true" : "false");
        }
        if (electionType === "usHouse" && live) {
            svgMap.querySelectorAll(".better-maps-state-path").forEach(path => {
                const stateId = getStateIdFromMapPath(path);
                applyPendingNationalElectionStateFill(path, stateId, {
                    noElection: true
                });
            });
        }
        const raceInfoCache = {};
        if(electionType !== "usHouse" && electionType !== "usHousePol" && !projected) {
            resultKeys.forEach(stateId => {
                const currentDistrict = resultProxies[electionType][stateId];
                if(currentDistrict !== undefined && currentDistrict.cands !== undefined) {
                    raceInfoCache[stateId] = getRaceInfo(currentDistrict, live);
                    const distMajority = raceInfoCache[stateId].currentLead / (live ? currentDistrict.totalCurrVotes : currentDistrict.totalVotes);
                    raceInfoCache[stateId].currentMajority = distMajority;
                }
            });
        }
        resultKeys.forEach(stateId => {
            const currentDistrict = getStatewideRaceForMap(electionType, stateId, { allowArchive: !live });
            const isHousePrimaryStateMap = electionType === "usHouse" && isHousePrimaryState(currentDistrict);
            if (electionType === "usHouse" && live) {
                const statePath = document.getElementById(`${stateId}-state-path-live`)
                    || svgMap.querySelector(`#${stateId}-state-path-live`);
                if (!hasHouseStateStartedCounting(stateId)) {
                    applyPendingNationalElectionStateFill(statePath, stateId, {
                        primary: isHousePrimaryStateMap,
                        noElection: !currentDistrict
                    });
                    return;
                }
                const hasRealHouseResults = currentDistrict && (
                    isHousePrimaryStateMap
                        ? hasVisibleHousePrimaryStateVotes(stateId, currentDistrict, true)
                        : hasVisibleHouseStateResults(stateId, true)
                );
                if (!hasRealHouseResults) {
                    applyPendingNationalElectionStateFill(statePath, stateId, {
                        primary: isHousePrimaryStateMap,
                        noElection: !currentDistrict
                    });
                    return;
                }
            }
            if (
                (electionType === "president" || electionType === "usSenate" || electionType === "governor")
                && isStatewidePrimaryRace(currentDistrict)
            ) {
                const primaryFill = getStatewidePrimaryStateFill(svgMap, stateId, currentDistrict, live, electionType);
                const statePath = document.getElementById(`${stateId}-state-path${live ? "-live" : ""}`)
                    || svgMap.querySelector(`#${stateId}-state-path${live ? "-live" : ""}`);
                if(primaryFill) {
                    d3.select(statePath).style("fill", primaryFill);
                    applyNationalElectionStateOutline(statePath);
                } else {
                    applyPendingNationalElectionStateFill(statePath, stateId, {
                        primary: true,
                        noElection: !currentDistrict
                    });
                }
                return;
            }
            if (
                electionType === "usSenate"
                && live
                && currentDistrict?.cands !== undefined
                && Number(currentDistrict.totalCurrVotes || 0) <= 0
            ) {
                const statePath = document.getElementById(`${stateId}-state-path-live`)
                    || svgMap.querySelector(`#${stateId}-state-path-live`);
                applyPendingNationalElectionStateFill(statePath, stateId, {
                    noElection: false
                });
                return;
            }
            if(currentDistrict !== undefined && (electionType === "usHouse" || electionType === "usHousePol"
                || electionType === "governorPol" || electionType === "usSenatePol"
                || currentDistrict.cands !== undefined)) {
                let raceInfo = null;
                let newColour = null;
                if(electionType === "usHouse" || electionType === "usHousePol") {
                    if(electionType === "usHousePol") {
                        newColour = getHousePoliticianSeatBalanceColour(currentDistrict);
                    } else if (isHousePrimaryStateMap) {
                        newColour = getHousePrimaryStateColour(stateId, currentDistrict, live)
                            || MAP_PRIMARY_ELECTION_PENDING_FILL;
                    } else {
                        newColour = getHouseStatePopularVoteColour(stateId, currentDistrict, live);
                        if (!newColour) {
                    const leadParty = (currentDistrict.projectedDem > currentDistrict.projectedRep) ? "D" : "R";
                    const baseColour = config.partyColours[leadParty];
                    const majority = ((leadParty === "D") ? (currentDistrict.projectedDem - currentDistrict.projectedRep) : (currentDistrict.projectedRep - currentDistrict.projectedDem))
                                        / (currentDistrict.projectedDem + currentDistrict.projectedRep);
                    if(currentDistrict.projectedDem - currentDistrict.projectedRep === 0) {
                        newColour = stringifyColour(config.partyColours.HouseTie);
                    }
                    else {
                        newColour = stringifyColour(getElectionMarginColour(baseColour, majority));
                    }
                        }
                    }
                } else if (electionType === "usSenatePol") {
                    const seniorAcronym = (currentDistrict.senior.extendedAttribs.party === "Independent")
                        ? ("I" + currentDistrict.senior.caucusParty.charAt(0))
                        : currentDistrict.senior.caucusParty.charAt(0);
                    const juniorAcronym = (currentDistrict.junior.extendedAttribs.party === "Independent")
                        ? ("I" + currentDistrict.junior.caucusParty.charAt(0))
                        : currentDistrict.junior.caucusParty.charAt(0);
                    if(seniorAcronym === juniorAcronym){
                        newColour = stringifyColour(getPoliticianColour(currentDistrict.senior));
                    } else {
                        newColour = `url(#${seniorAcronym}:${juniorAcronym})`;
                    }
                } else if (electionType === "governorPol") {
                    newColour = stringifyColour(getPoliticianColour(currentDistrict));
                } else if(projected) {
                    raceInfo = getRaceInfo(currentDistrict, live);
                    newColour = (currentDistrict.pW === true) ? stringifyColour(getCandidateColourForRace(raceInfo.finalWinner, currentDistrict))
                        : (!live ? stringifyColour(getCandidateColourForRace(raceInfo.currentLeader, currentDistrict)) : resultColours[stateId]);
                    const isFinalResult = currentDistrict.pW === true || live !== true;
                    if(
                        isFinalResult
                        && (electionType === "president" || electionType === "usSenate" || electionType === "governor")
                    ) {
                        const currentWinner = raceInfo.finalWinner || raceInfo.currentLeader;
                        const previousWinner = getStatewideFlipPreviousWinner(
                            electionType,
                            stateId,
                            currentDistrict
                        );
                        const previousParty = getCandidateVariantPartyKey(previousWinner);
                        const currentParty = getCandidateVariantPartyKey(currentWinner);
                        const previousBlock = getFlipComparisonPartyBlock(previousParty || previousWinner);
                        const currentBlock = getFlipComparisonPartyBlock(currentParty || currentWinner);
                        if(
                            previousWinner
                            && previousBlock
                            && currentBlock
                            && previousBlock !== currentBlock
                            && (
                                electionType === "president"
                                || !isSameFlipCandidate(previousWinner, currentWinner)
                            )
                        ) {
                            const statewideFlipPatternId = ensureStatewideFlipPattern(
                                svgMap,
                                stateId,
                                newColour
                            );
                            if(statewideFlipPatternId) {
                                newColour = `url(#${statewideFlipPatternId})`;
                            }
                        }
                    }
                } else {
                    raceInfo = raceInfoCache[stateId];
                    if(raceInfo === undefined || raceInfo.currentLead === 0) newColour = resultColours[stateId];
                    else {
                        const baseColour = getCandidateColourForRace(raceInfo.currentLeader, currentDistrict);
                        newColour = stringifyColour(
                            getElectionMarginColour(baseColour, raceInfo.currentMajority)
                        );
                    }
                }
                const statePathId = stateId + "-state-path" + (live ? "-live" : "");
                const visibleStatePath = svgMap.querySelector(`[id="${statePathId}"]`)
                    || document.getElementById(statePathId);
                if(visibleStatePath) d3.select(visibleStatePath).style("fill", newColour);
            } else {
                const statePathId = stateId + "-state-path" + (live ? "-live" : "");
                const visibleStatePath = svgMap.querySelector(`[id="${statePathId}"]`)
                    || document.getElementById(statePathId);
                if(visibleStatePath) d3.select(visibleStatePath).style("fill", resultColours[stateId]);
            }
        });
        if (electionType === "usSenate") {
            try { updateSenateControlBanner({ live, onCountyMap, svgMap, isPrimary: isPrimaryControlPage }); } catch (e) {}
            const houseEl = document.getElementById("bm-house-banner");
            if (houseEl) { houseEl.classList.remove("show"); houseEl.innerHTML = ""; }
            const presidentEl = document.getElementById("bm-president-elect-banner");
            if (presidentEl) { presidentEl.classList.remove("show"); presidentEl.innerHTML = ""; }
        } else if (electionType === "usHouse") {
            try { updateHouseControlBanner({ live, onCountyMap, svgMap, isPrimary: isPrimaryControlPage }); } catch (e) {}
            const senateEl = document.getElementById("bm-senate-banner");
            if (senateEl) { senateEl.classList.remove("show"); senateEl.innerHTML = ""; }
            const presidentEl = document.getElementById("bm-president-elect-banner");
            if (presidentEl) { presidentEl.classList.remove("show"); presidentEl.innerHTML = ""; }
        } else if (electionType === "president") {
            try { updatePresidentialWinnerBanner({ live, onCountyMap, svgMap }); } catch (e) {}
            const senateEl = document.getElementById("bm-senate-banner");
            if (senateEl) { senateEl.classList.remove("show"); senateEl.innerHTML = ""; }
            const houseEl = document.getElementById("bm-house-banner");
            if (houseEl) { houseEl.classList.remove("show"); houseEl.innerHTML = ""; }
        } else {
            const senateEl = document.getElementById("bm-senate-banner");
            if (senateEl) { senateEl.classList.remove("show"); senateEl.innerHTML = ""; }
            const houseEl = document.getElementById("bm-house-banner");
            if (houseEl) { houseEl.classList.remove("show"); houseEl.innerHTML = ""; }
            const presidentEl = document.getElementById("bm-president-elect-banner");
            if (presidentEl) { presidentEl.classList.remove("show"); presidentEl.innerHTML = ""; }
        }
    };
    const getCountyMapPathElement = (svgMap, countyName, live) => {
        const croppedCountyName = String(countyName || "").substring(
            0,
            String(countyName || "").lastIndexOf(" ")
        );
        const fullId = String(countyName || "").toLowerCase().replace(/ /g, "_").replace(/\./g, "")
            + "-state-path" + (live ? "-live" : "");
        const croppedId = croppedCountyName.toLowerCase().replace(/ /g, "_").replace(/\./g, "")
            + "-state-path" + (live ? "-live" : "");
        const directMatch = document.getElementById(fullId) || document.getElementById(croppedId)
            || svgMap.querySelector(`[id="${fullId}"], [id="${croppedId}"]`);
        if(directMatch) return directMatch;
        const targetName = normalizePrimaryCountyName(countyName, activeMap);
        return Array.from(svgMap.querySelectorAll(".better-maps-state-path")).find(pathElement => {
            const pathName = String(pathElement.id || "")
                .replace(/-state-path(?:-live)?$/, "")
                .replace(/_/g, " ");
            return normalizePrimaryCountyName(pathName, activeMap) === targetName;
        }) || null;
    };
    let dcWardBaselineCache = null;
    const getDcWardBaselines = () => {
        if(dcWardBaselineCache) return dcWardBaselineCache;
        try {
            const wardMapPath = Executive.mods.getRelativePathPrefix()
                + path.sep + "data" + path.sep + "counties" + path.sep + "dc.svg";
            if(!fs.existsSync(wardMapPath)) return [];
            const wardDocument = new DOMParser().parseFromString(
                fs.readFileSync(wardMapPath, "utf8"),
                "image/svg+xml"
            );
            if(wardDocument.querySelector("parsererror")) return [];
            dcWardBaselineCache = Array.from(
                wardDocument.querySelectorAll("path[data-ward][data-dem][data-rep]")
            ).map(element => {
                const wardNumber = Number(element.getAttribute("data-ward"));
                return {
                    id: `ward-${wardNumber}`,
                    name: `Ward ${wardNumber}`,
                    ward: wardNumber,
                    D: Math.max(0, Number(element.getAttribute("data-dem")) || 0),
                    R: Math.max(0, Number(element.getAttribute("data-rep")) || 0),
                    I: Math.max(0, Number(element.getAttribute("data-ind")) || 0)
                };
            }).filter(ward => Number.isInteger(ward.ward) && ward.ward >= 1 && ward.ward <= 8)
                .sort((wardA, wardB) => wardA.ward - wardB.ward);
            return dcWardBaselineCache;
        } catch(error) {
            console.error("Could not load Washington D.C. ward baselines", error);
            return [];
        }
    };
    const allocateDcWardVotes = (targetVotes, weights) => {
        const target = Math.max(0, Math.round(Number(targetVotes) || 0));
        if(!weights.length) return [];
        let normalizedWeights = weights.map(weight => Math.max(0, Number(weight) || 0));
        let weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
        if(weightTotal <= 0) {
            normalizedWeights = normalizedWeights.map(() => 1);
            weightTotal = normalizedWeights.length;
        }
        const exact = normalizedWeights.map(weight => (target * weight) / weightTotal);
        const allocated = exact.map(Math.floor);
        let remainder = target - allocated.reduce((sum, value) => sum + value, 0);
        exact.map((value, index) => ({ index, fraction: value - allocated[index] }))
            .sort((entryA, entryB) =>
                entryB.fraction - entryA.fraction || entryA.index - entryB.index)
            .slice(0, remainder)
            .forEach(entry => allocated[entry.index]++);
        return allocated;
    };
    const getDcWardCandidateBaselineParty = candidate => {
        const party = String(
            candidate?.party
            || candidate?.extendedAttribs?.party
            || candidate?.caucusParty
            || candidate?.caucus
            || ""
        ).trim().toLowerCase();
        if(party === "d" || party.includes("dem")) return "D";
        if(party === "r" || party.includes("rep")) return "R";
        return "I";
    };
    const buildDcWardRace = (stateRace, live = false) => {
        const baselines = getDcWardBaselines();
        if(!stateRace || !Array.isArray(stateRace.cands) || baselines.length !== 8) {
            return stateRace;
        }
        const wards = baselines.map(baseline => ({
            id: baseline.id,
            name: baseline.name,
            ward: baseline.ward,
            cands: []
        }));
        stateRace.cands.forEach(candidate => {
            const baselineParty = getDcWardCandidateBaselineParty(candidate);
            const weights = baselines.map(baseline => baseline[baselineParty]);
            const finalAllocations = allocateDcWardVotes(candidate.votes, weights);
            const currentAllocations = live
                ? allocateDcWardVotes(candidate.currentVotes, weights)
                : finalAllocations;
            wards.forEach((ward, wardIndex) => {
                ward.cands.push({
                    ...candidate,
                    votes: finalAllocations[wardIndex],
                    currentVotes: currentAllocations[wardIndex]
                });
            });
        });
        wards.forEach(ward => {
            ward.totalVotes = ward.cands.reduce(
                (sum, candidate) => sum + (Number(candidate.votes) || 0),
                0
            );
            ward.totalCurrVotes = ward.cands.reduce(
                (sum, candidate) => sum + (Number(candidate.currentVotes) || 0),
                0
            );
        });
        return {
            ...stateRace,
            counties: wards,
            bmSyntheticDcWards: true
        };
    };
    const getStatewideRaceWithMapSubdivisions = (electionType, stateId, live) => {
        const stateRace = getStatewideRaceForMap(electionType, stateId, { allowArchive: !live });
        if(
            String(stateId || "").toUpperCase() === "DC"
            && electionType === "president"
            && !isStatewidePrimaryRace(stateRace)
        ) {
            return buildDcWardRace(stateRace, live);
        }
        return stateRace;
    };
    const updatePrimaryCountyMap = (svgMap, electionType, live) => {
        const result = buildPrimaryCountyResults(
            activeMap,
            activePrimaryCountyParty,
            electionType
        );
        if(!result) {
            svgMap?.querySelectorAll?.(".better-maps-state-path").forEach(pathElement => {
                pathElement.style.fill = "#cccccc";
            });
            return false;
        }
        const primaryColourScope = electionType === "president"
            ? (result.colourScope || `presidential-primary:${String(activeMap || "").toLowerCase()}:${activePrimaryCountyParty || result.party || "N"}`)
            : `statewide-primary:${String(activeMap || "").toLowerCase()}:${activePrimaryCountyParty || result.party || "N"}`;
        const primaryColourRace = {
            cands: result.candidates,
            colourScope: primaryColourScope
        };
        result.candidates.forEach(candidate => {
            candidate.candidateColour = stringifyColour(
                getCandidateColourForRace(candidate, primaryColourRace)
            );
        });
        result.counties.forEach(county => {
            county.cands.forEach((candidate, candidateIndex) => {
                const statewideCandidate = resolveElectionCandidate(
                    candidate,
                    result.candidates,
                    candidateIndex
                );
                candidate.portraitSource = statewideCandidate;
                candidate.candidateColour = statewideCandidate?.candidateColour
                    || stringifyColour(
                        getCandidateColourForRace(
                            statewideCandidate || candidate,
                            primaryColourRace
                        )
                    );
            });
            const raceInfo = getRaceInfo(county, live);
            const total = live ? county.totalCurrVotes : county.totalVotes;
            const pathElement = getCountyMapPathElement(svgMap, county.name, live);
            if(!pathElement) return;
            if(total <= 0 || !raceInfo.currentLeader) {
                pathElement.style.fill = getElectionPendingStateFill(activeMap, true);
                return;
            }
            const margin = total > 0 ? raceInfo.currentLead / total : 0;
            const leaderIndex = county.cands.indexOf(raceInfo.currentLeader);
            const statewideLeader = resolveElectionCandidate(
                raceInfo.currentLeader,
                result.candidates,
                leaderIndex
            );
            const baseColour = getCandidateColourForRace(
                statewideLeader || raceInfo.currentLeader,
                primaryColourRace
            );
            let colour = stringifyColour(baseColour);
            if(activeCountyMapMode === MAP_MODES.MARGIN) {
                colour = stringifyColour(getElectionMarginColour(baseColour, margin));
            }
            pathElement.style.fill = colour;
        });
        return true;
    };
    const isRenderedRcvCountyMode = svgMap => {
        const renderedMode = svgMap?.dataset?.bmCountyMapMode || activeCountyMapMode;
        return onCountyMap && (
            renderedMode === MAP_MODES.WINNER_RCV
            || renderedMode === MAP_MODES.MARGIN_RCV
        );
    };
    const getElectionCandidateIdentityValues = candidate => {
        const values = new Set();
        const sources = [
            candidate,
            candidate?.source,
            candidate?.candidate,
            candidate?.character,
            candidate?.politician
        ].filter(source => source && typeof source === "object");
        sources.forEach(source => {
            [
                source.id,
                source.ID,
                source.candID,
                source.candidateId,
                source.candidateID,
                source.characterId,
                source.characterID,
                source.politicianId,
                source.politicianID,
                source.extendedAttribs?.id,
                source.extendedAttribs?.ID,
                source.extendedAttribs?.candidateId,
                source.extendedAttribs?.candidateID,
                source.extendedAttribs?.characterId,
                source.extendedAttribs?.characterID
            ].forEach(value => {
                const normalized = String(value ?? "").trim().toLowerCase();
                if(normalized) values.add(normalized);
            });
        });
        return values;
    };
    const normalizeElectionCandidateName = value => String(value || "")
        .replace(/\*+$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const getElectionCandidateComparableNames = candidate => {
        const fullNames = new Set();
        const surnames = new Set();
        const sources = [
            candidate,
            candidate?.source,
            candidate?.candidate,
            candidate?.character,
            candidate?.politician
        ].filter(source => source && typeof source === "object");
        sources.forEach(source => {
            [
                source.name,
                source.fullName,
                source.displayName,
                [source.first, source.last].filter(Boolean).join(" "),
                [source.firstName, source.lastName].filter(Boolean).join(" ")
            ].forEach(value => {
                const normalized = normalizeElectionCandidateName(value);
                if(!normalized) return;
                const pieces = normalized.split(/\s+/).filter(Boolean);
                if(pieces.length > 1) fullNames.add(normalized);
                surnames.add(pieces[pieces.length - 1]);
            });
            [source.last, source.lastName].forEach(value => {
                const normalized = normalizeElectionCandidateName(value);
                if(normalized) surnames.add(normalized);
            });
        });
        const panelName = normalizeElectionCandidateName(getPanelCandidateName(candidate));
        if(panelName) surnames.add(panelName);
        return { fullNames, surnames };
    };
    const getElectionCandidatePartyForMatch = candidate => {
        const sources = [
            candidate,
            candidate?.source,
            candidate?.candidate,
            candidate?.character,
            candidate?.politician
        ].filter(source => source && typeof source === "object");
        const hasPartyMetadata = sources.some(source =>
            source.party !== undefined
            || source.caucus !== undefined
            || source.caucusParty !== undefined
            || source.extendedAttribs?.party !== undefined
            || source.extendedAttribs?.caucusParty !== undefined
        );
        if(!hasPartyMetadata) return "";
        const party = String(getCandidateVariantPartyKey(candidate) || "").toUpperCase();
        if(party === "ID") return "D";
        if(party === "IR") return "R";
        return party;
    };
    const resolveElectionCandidate = (
        candidate,
        candidates,
        fallbackIndex = -1
    ) => {
        if(!candidate || !Array.isArray(candidates) || candidates.length === 0) {
            return candidate;
        }
        const candidateIds = getElectionCandidateIdentityValues(candidate);
        if(candidateIds.size) {
            const idMatches = candidates.filter(entry => {
                const entryIds = getElectionCandidateIdentityValues(entry);
                for(const id of candidateIds) {
                    if(entryIds.has(id)) return true;
                }
                return false;
            });
            if(idMatches.length === 1) return idMatches[0];
        }
        const candidateNames = getElectionCandidateComparableNames(candidate);
        if(candidateNames.fullNames.size) {
            const fullNameMatches = candidates.filter(entry => {
                const entryNames = getElectionCandidateComparableNames(entry);
                for(const name of candidateNames.fullNames) {
                    if(entryNames.fullNames.has(name)) return true;
                }
                return false;
            });
            if(fullNameMatches.length === 1) return fullNameMatches[0];
        }
        let surnameMatches = candidates.filter(entry => {
            const entryNames = getElectionCandidateComparableNames(entry);
            for(const surname of candidateNames.surnames) {
                if(entryNames.surnames.has(surname)) return true;
            }
            return false;
        });
        const candidateParty = getElectionCandidatePartyForMatch(candidate);
        if(candidateParty && surnameMatches.length > 1) {
            surnameMatches = surnameMatches.filter(entry =>
                getElectionCandidatePartyForMatch(entry) === candidateParty
            );
        }
        if(surnameMatches.length === 1) return surnameMatches[0];
        if(
            Number.isInteger(fallbackIndex)
            && fallbackIndex >= 0
            && fallbackIndex < candidates.length
        ) {
            return candidates[fallbackIndex];
        }
        return candidate;
    };
    const updateCountyMap = (svgMap, electionType, live) => {
        const normalStateRace = getStatewideRaceWithMapSubdivisions(
            electionType,
            activeMap,
            live
        );
        const rcvMode = activeCountyMapMode === MAP_MODES.WINNER_RCV
            || activeCountyMapMode === MAP_MODES.MARGIN_RCV;
        const rcvContext = rcvMode
            ? getRcvMapFinalContext(electionType, activeMap, normalStateRace, live)
            : null;
        if(rcvMode && !rcvContext) activeCountyMapMode = MAP_MODES.MARGIN;
        const currentStateRace = rcvContext?.virtualRace || normalStateRace;
        if(!currentStateRace) return;
        svgMap.dataset.bmCountyMapMode = activeCountyMapMode;
        const useCompletedFirstPreferences = live === true
            && !rcvContext
            && isRcvResultsRace(electionType, activeMap, normalStateRace)
            && getRcvRaceReporting(normalStateRace, true) >= 99.999;
        if(
            (electionType === "president" || electionType === "usSenate" || electionType === "governor")
            && isStatewidePrimaryRace(currentStateRace)
            && activePrimaryCountyParty
        ) {
            updatePrimaryCountyMap(svgMap, electionType, live);
            return;
        }
        const currentOrigCounties = currentStateRace.counties;
        const partisanPrimary = isStatewidePrimaryRace(currentStateRace)
            && (
                (currentStateRace?.dem?.cands || []).length > 0
                || (currentStateRace?.rep?.cands || []).length > 0
            );
        const previousGovernorCountyResults = electionType === "governor"
            && activeCountyMapMode === MAP_MODES.FLIP_COUNTIES
            && !isStatewidePrimaryRace(currentStateRace)
            ? getPreviousGovernorCountyWinnerMap(activeMap, currentStateRace)
            : null;
        const newCounties = [];
        const stateElectData = allStElectData.filter(electData => (electData.id === activeMap))[0];
        const raceInfoCache = {};
        const primaryCandidateGroup = isStatewidePrimaryRace(currentStateRace)
            ? (activePrimaryCountyParty === "D"
                ? currentStateRace?.dem
                : (activePrimaryCountyParty === "R"
                    ? currentStateRace?.rep
                    : (activePrimaryCountyParty === "N"
                        ? currentStateRace?.allCands
                        : (currentStateRace?.allCands?.cands?.length
                            ? currentStateRace.allCands
                            : null))))
            : null;
        const statewideCandidates = Array.isArray(currentStateRace?.cands)
            ? currentStateRace.cands
            : (Array.isArray(primaryCandidateGroup?.cands)
                ? primaryCandidateGroup.cands
                : []);
        const statewideColourRace = Array.isArray(currentStateRace?.cands)
            ? currentStateRace
            : {
                cands: statewideCandidates,
                colourScope: `statewide-primary:${String(activeMap || "").toLowerCase()}:${activePrimaryCountyParty || "N"}`
            };
        statewideCandidates.forEach(candidate =>
            getCandidateColourForRace(candidate, statewideColourRace)
        );
        currentOrigCounties.forEach(origCounty => {
            let totalCurrVotes = 0;
            let totalVotes = 0;
            const newCounty = {
                name: origCounty.name,
                cands: origCounty.cands.map((candObj, candidateIndex) => {
                    const newCandObj = Object.assign({}, candObj);
                    const statewideCandidate = resolveElectionCandidate(
                        candObj,
                        statewideCandidates,
                        candidateIndex
                    );
                    const candidateColour = stringifyColour(
                        getCandidateColourForRace(statewideCandidate, statewideColourRace)
                    );

                    candObj.candidateColour = candidateColour;
                    newCandObj.candidateColour = candidateColour;
                    newCandObj.portraitSource = statewideCandidate;
                    if(!live){
                        newCandObj.currentVotes = newCandObj.votes;
                    } else if(
                        currentStateRace.bmSyntheticDcWards
                        || currentStateRace.bmRcvFinal
                        || useCompletedFirstPreferences
                    ) {
                        newCandObj.currentVotes = Number(candObj.currentVotes) || 0;
                        if(useCompletedFirstPreferences) {
                            newCandObj.currentVotes = Number(candObj.votes) || 0;
                        }
                    } else {
                        const countyElectData = stateElectData.counties.filter(candCountyData => (candCountyData.name === origCounty.name))[0];
                        newCandObj.currentVotes = (newCandObj.votes * candObj.updates[countyElectData.indx]);
                    }
                    totalCurrVotes += newCandObj.currentVotes;
                    totalVotes += newCandObj.votes;
                    return newCandObj;
                })
            };
            newCounty.totalCurrVotes = totalCurrVotes;
            newCounty.totalVotes = totalVotes;
            newCounties.push(newCounty);
            raceInfoCache[newCounty.name] = getRaceInfo(newCounty, live);
            const distMajority = raceInfoCache[newCounty.name].currentLead / (live ? totalCurrVotes : totalVotes);
            raceInfoCache[newCounty.name].currentMajority = distMajority;
        });
        newCounties.forEach(county => {
            const raceInfo = raceInfoCache[county.name];
            const displayedCountyVotes = Math.max(
                0,
                Number(live ? county.totalCurrVotes : county.totalVotes) || 0
            );
            const statewideLeader = resolveElectionCandidate(
                raceInfo.currentLeader,
                statewideCandidates,
                county.cands.indexOf(raceInfo.currentLeader)
            );
            let newColour;
            if(displayedCountyVotes <= 0 || !raceInfo.currentLeader) {
                newColour = getElectionPendingStateFill(activeMap, partisanPrimary);
            } else {
                const baseColour = partisanPrimary
                    ? getCandidateColourForRace(
                        statewideLeader || raceInfo.currentLeader,
                        statewideColourRace
                    )
                    : activeCountyMapMode === MAP_MODES.FLIP_COUNTIES
                        ? getCandidateColour(statewideLeader || raceInfo.currentLeader)
                        : getCandidateColourForRace(
                            statewideLeader || raceInfo.currentLeader,
                            statewideColourRace
                        );
                if(
                    activeCountyMapMode === MAP_MODES.WINNER
                    || activeCountyMapMode === MAP_MODES.FLIP_COUNTIES
                    || activeCountyMapMode === MAP_MODES.WINNER_RCV
                ) {
                    newColour = stringifyColour(baseColour);
                } else {
                    newColour = stringifyColour(
                        getElectionMarginColour(baseColour, raceInfo.currentMajority)
                    );
                }
            }
            const pathElement = getCountyMapPathElement(svgMap, county.name, live);
            if(!pathElement) return;

            const expectedCountyVotes = Math.max(0, Number(county.totalVotes) || 0);
            const countedCountyVotes = Math.max(0, Number(county.totalCurrVotes) || 0);
            const countyFullyReported = live !== true || (
                expectedCountyVotes > 0
                && countedCountyVotes / expectedCountyVotes >= 0.999999
            );
            const previousCountyParty = previousGovernorCountyResults?.winners?.get(
                normalizePrimaryCountyName(county.name, activeMap)
            );
            const currentCountyParty = getFlipComparisonPartyBlock(
                statewideLeader || raceInfo.currentLeader
            );
            const governorCountyFlipped = Boolean(
                electionType === "governor"
                && activeCountyMapMode === MAP_MODES.FLIP_COUNTIES
                && displayedCountyVotes > 0
                && countyFullyReported
                && previousGovernorCountyResults?.reliable === true
                && previousCountyParty
                && currentCountyParty
                && previousCountyParty !== currentCountyParty
            );
            if(governorCountyFlipped) {
                const patternId = ensureGovernorCountyFlipPattern(
                    svgMap,
                    county.name,
                    newColour
                );
                if(patternId) newColour = `url(#${patternId})`;
                pathElement.dataset.bmGovernorCountyFlip = "true";
                pathElement.dataset.bmGovernorCountyPreviousYear = String(
                    previousGovernorCountyResults?.year || ""
                );
            } else {
                delete pathElement.dataset.bmGovernorCountyFlip;
                delete pathElement.dataset.bmGovernorCountyPreviousYear;
            }
            d3.select(pathElement).style("fill", newColour);
        });
    };
    const renderRcvCountyMapTooltip = (electionType, countyIdentifier, live) => {
        const normalRace = getStatewideRaceWithMapSubdivisions(
            electionType,
            activeMap,
            live
        );
        const rcvContext = getRcvMapFinalContext(
            electionType,
            activeMap,
            normalRace,
            live
        );
        if(!rcvContext) return false;
        const cleanCountyIdentifier = value => String(value || "")
            .replace(/-state-path(?:-live)?$/i, "")
            .replace(/_/g, " ")
            .trim();
        const normalize = value => normalizePrimaryCountyName(
            cleanCountyIdentifier(value),
            activeMap
        );
        const svgMap = document.getElementById(
            `${electionType}-map${live ? "-live" : ""}`
        );
        const targetPath = svgMap
            ? getCountyMapPathElement(
                svgMap,
                cleanCountyIdentifier(countyIdentifier),
                live
            )
            : null;
        const findMatchingCounty = counties =>
            (counties || []).find(entry =>
                normalize(entry?.name || entry?.id) === normalize(countyIdentifier)
            )
            || (
                targetPath && svgMap
                    ? (counties || []).find(entry =>
                        getCountyMapPathElement(
                            svgMap,
                            entry?.name || entry?.id,
                            live
                        ) === targetPath
                    )
                    : null
            );
        const county = findMatchingCounty(rcvContext.virtualRace.counties);
        if(!county) return false;
        const sourceCounty = findMatchingCounty(normalRace.counties) || county;
        const sourceCountyVotes = Number(sourceCounty?.totalVotes)
            || (sourceCounty?.cands || []).reduce(
                (sum, candidate) => sum + (Number(candidate?.votes) || 0),
                0
            )
            || Number(sourceCounty?.totalCurrVotes)
            || (sourceCounty?.cands || []).reduce(
                (sum, candidate) => sum + (Number(candidate?.currentVotes) || 0),
                0
            );
        const turnoutSourceCounty = {
            ...sourceCounty,
            stateId: String(activeMap || "").toUpperCase(),
            sourceCounty,
            totalVotes: sourceCountyVotes,
            totalCurrVotes: sourceCountyVotes
        };
        const ranked = county.cands.slice().sort((a, b) =>
            (Number(b.currentVotes) || 0) - (Number(a.currentVotes) || 0));
        const total = ranked.reduce((sum, candidate) =>
            sum + (Number(candidate.currentVotes) || 0), 0);
        const getFirstRoundCandidate = finalist => {
            return resolveElectionCandidate(
                finalist,
                sourceCounty?.cands || [],
                county.cands.indexOf(finalist)
            ) || null;
        };
        renderPrecinctResultsTooltip({
            territoryType: "County",
            territoryName: county.name,
            territoryContext: "Final RCV",
            reportingText: "100% in",
            electionType,
            showTurnout: true,
            sourceRace: turnoutSourceCounty,
            marginVotes: Math.abs(
                (Number(ranked[0]?.currentVotes) || 0)
                - (Number(ranked[1]?.currentVotes) || 0)
            ),
            marginPoints: total > 0
                ? Math.abs(
                    (Number(ranked[0]?.currentVotes) || 0)
                    - (Number(ranked[1]?.currentVotes) || 0)
                ) / total * 100
                : 0,
            candidates: ranked.map(candidate => {
                const finalVotes = Number(candidate.currentVotes) || 0;
                const firstRoundCandidate = getFirstRoundCandidate(candidate);
                const firstRoundVotes = Number(
                    firstRoundCandidate?.votes
                    ?? firstRoundCandidate?.currentVotes
                ) || 0;
                const finalPct = total > 0 ? (finalVotes / total) * 100 : 0;
                const firstRoundPct = sourceCountyVotes > 0
                    ? (firstRoundVotes / sourceCountyVotes) * 100
                    : 0;
                return {
                    source: candidate,
                    name: getPanelCandidateName(candidate),
                    party: getCandidateVariantPartyKey(candidate),
                    candidateColour: candidate.candidateColour,
                    votes: finalVotes,
                    pctDelta: finalPct - firstRoundPct
                };
            }),
            totalVotes: total,
            totalLabel: "Final RCV total"
        });
        return true;
    };
    const FLIP_PATTERN_SIZE = 7;
    const FLIP_STRIPE_WIDTH = 1.75;
    const FLIP_STRIPE_X = FLIP_PATTERN_SIZE / 2;
    const FLIP_STRIPE_COLOUR = "#ffffff";

    const FLIP_STRIPE_OPACITY = "0.65";
    const createHatchPattern = (backColour, foreColour) => {
        const mainPatternElem = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        mainPatternElem.setAttribute("width", "10");
        mainPatternElem.setAttribute("height", "10");
        mainPatternElem.setAttribute("patternUnits", "userSpaceOnUse");
        mainPatternElem.setAttribute("patternTransform", "rotate(45 0 0)");
        const backRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        backRect.setAttribute("x", "0");
        backRect.setAttribute("y", "0");
        backRect.setAttribute("width", "10");
        backRect.setAttribute("height", "10");
        backRect.setAttribute("fill", backColour);
        mainPatternElem.appendChild(backRect);
        const foreRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        foreRect.setAttribute("x", "0");
        foreRect.setAttribute("y", "0");
        foreRect.setAttribute("width", "5");
        foreRect.setAttribute("height", "10");
        foreRect.setAttribute("fill", foreColour);
        mainPatternElem.appendChild(foreRect);
        return mainPatternElem;
    };
    const createPartyPattern = (party1, party2) => {
        const partyCol1 = (party1.charAt(0) === "I") ? (config.partyColours.I[party1.charAt(1)])
                                : (config.partyColours[party1.charAt(0)]);
        const partyCol2 = (party2.charAt(0) === "I") ? (config.partyColours.I[party2.charAt(1)])
                                : (config.partyColours[party2.charAt(0)]);
        const partyColStr1 = stringifyColour(partyCol1);
        const partyColStr2 = stringifyColour(partyCol2);
        const pattern = createHatchPattern(partyColStr1, partyColStr2);
        pattern.setAttribute("id", party1 + ":" + party2);
        return pattern;
    };
    const createGainPattern = (party) => {
        const partyCol = party.charAt(0) === "I"
            ? (config.partyColours.I[party.charAt(1)] || config.partyColours.I.default)
            : config.partyColours[party.charAt(0)];
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        pattern.setAttribute("width", String(FLIP_PATTERN_SIZE));
        pattern.setAttribute("height", String(FLIP_PATTERN_SIZE));
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("patternTransform", "rotate(45 0 0)");
        const backRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        backRect.setAttribute("x", "0");
        backRect.setAttribute("y", "0");
        backRect.setAttribute("width", String(FLIP_PATTERN_SIZE));
        backRect.setAttribute("height", String(FLIP_PATTERN_SIZE));
        backRect.setAttribute("fill", stringifyColour(partyCol));
        pattern.appendChild(backRect);
        const gainLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        gainLine.setAttribute("x1", String(FLIP_STRIPE_X));
        gainLine.setAttribute("y1", "0");
        gainLine.setAttribute("x2", String(FLIP_STRIPE_X));
        gainLine.setAttribute("y2", String(FLIP_PATTERN_SIZE));
        gainLine.setAttribute(
            "style",
            `stroke: ${FLIP_STRIPE_COLOUR}; stroke-width: ${FLIP_STRIPE_WIDTH}; stroke-opacity: ${FLIP_STRIPE_OPACITY};`
        );
        pattern.appendChild(gainLine);
        pattern.setAttribute("id", party + ":gain");
        return pattern;
    };
    const ensureStatewideFlipPattern = (svgMap, stateId, baseColour) => {
        if(!svgMap || !baseColour) return null;
        const patternId = `bm-statewide-flip-${String(stateId || "state")}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        let pattern = svgMap.querySelector(`[id="${patternId}"]`);
        if(!pattern) {
            const SVG_NS = "http://www.w3.org/2000/svg";
            let defs = svgMap.querySelector("defs");
            if(!defs) {
                defs = document.createElementNS(SVG_NS, "defs");
                svgMap.insertBefore(defs, svgMap.firstChild);
            }
            pattern = document.createElementNS(SVG_NS, "pattern");
            pattern.setAttribute("id", patternId);
            pattern.setAttribute("width", String(FLIP_PATTERN_SIZE));
            pattern.setAttribute("height", String(FLIP_PATTERN_SIZE));
            pattern.setAttribute("patternUnits", "userSpaceOnUse");
            pattern.setAttribute("patternTransform", "rotate(45 0 0)");

            const background = document.createElementNS(SVG_NS, "rect");
            background.setAttribute("data-role", "background");
            background.setAttribute("x", "0");
            background.setAttribute("y", "0");
            background.setAttribute("width", String(FLIP_PATTERN_SIZE));
            background.setAttribute("height", String(FLIP_PATTERN_SIZE));
            pattern.appendChild(background);

            const stripe = document.createElementNS(SVG_NS, "line");
            stripe.setAttribute("x1", String(FLIP_STRIPE_X));
            stripe.setAttribute("y1", "0");
            stripe.setAttribute("x2", String(FLIP_STRIPE_X));
            stripe.setAttribute("y2", String(FLIP_PATTERN_SIZE));
            stripe.setAttribute("stroke", FLIP_STRIPE_COLOUR);
            stripe.setAttribute("stroke-width", String(FLIP_STRIPE_WIDTH));
            stripe.setAttribute("stroke-opacity", FLIP_STRIPE_OPACITY);
            pattern.appendChild(stripe);
            defs.appendChild(pattern);
        }
        pattern.querySelector('[data-role="background"]')?.setAttribute("fill", baseColour);
        return patternId;
    };
    const ensureGovernorCountyFlipPattern = (svgMap, countyName, baseColour) => {
        if(!svgMap || !baseColour) return null;
        const patternId = `bm-governor-county-flip-${String(countyName || "county")}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        let pattern = svgMap.querySelector(`[id="${patternId}"]`);
        if(!pattern) {
            const SVG_NS = "http://www.w3.org/2000/svg";
            let defs = svgMap.querySelector("defs");
            if(!defs) {
                defs = document.createElementNS(SVG_NS, "defs");
                svgMap.insertBefore(defs, svgMap.firstChild);
            }
            pattern = document.createElementNS(SVG_NS, "pattern");
            pattern.setAttribute("id", patternId);
            pattern.setAttribute("width", String(FLIP_PATTERN_SIZE));
            pattern.setAttribute("height", String(FLIP_PATTERN_SIZE));
            pattern.setAttribute("patternUnits", "userSpaceOnUse");
            pattern.setAttribute("patternTransform", "rotate(45 0 0)");

            const background = document.createElementNS(SVG_NS, "rect");
            background.setAttribute("data-role", "background");
            background.setAttribute("x", "0");
            background.setAttribute("y", "0");
            background.setAttribute("width", String(FLIP_PATTERN_SIZE));
            background.setAttribute("height", String(FLIP_PATTERN_SIZE));
            pattern.appendChild(background);

            const darkStripe = document.createElementNS(SVG_NS, "line");
            darkStripe.setAttribute("data-role", "flip-stripe");
            darkStripe.setAttribute("x1", String(FLIP_STRIPE_X));
            darkStripe.setAttribute("y1", "0");
            darkStripe.setAttribute("x2", String(FLIP_STRIPE_X));
            darkStripe.setAttribute("y2", String(FLIP_PATTERN_SIZE));
            darkStripe.setAttribute("stroke", FLIP_STRIPE_COLOUR);
            darkStripe.setAttribute("stroke-width", String(FLIP_STRIPE_WIDTH));
            darkStripe.setAttribute("stroke-opacity", FLIP_STRIPE_OPACITY);
            pattern.appendChild(darkStripe);
            defs.appendChild(pattern);
        }
        pattern.querySelector('[data-role="background"]')?.setAttribute("fill", baseColour);
        return patternId;
    };
    const createHousePrimaryPartialPattern = () => {
        const pattern = createHatchPattern("#ffd400", "#ffffff");
        pattern.setAttribute("id", "bm-house-primary-partial");
        return pattern;
    };
    const createHousePrimaryPartyPattern = (parties) => {
        const normalizedParties = Array.from(new Set(parties.map(normalizeHousePrimaryParty))).sort();
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        const stripeWidth = 8;
        pattern.setAttribute("id", `bm-house-primary-party-${normalizedParties.join("-").toLowerCase()}`);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", String(stripeWidth * normalizedParties.length));
        pattern.setAttribute("height", "12");
        pattern.setAttribute("patternTransform", "rotate(28)");
        normalizedParties.forEach((party, index) => {
            const stripe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            stripe.setAttribute("x", String(index * stripeWidth));
            stripe.setAttribute("y", "0");
            stripe.setAttribute("width", String(stripeWidth));
            stripe.setAttribute("height", "12");
            stripe.setAttribute("fill", getHousePrimaryPartyColour(party));
            pattern.appendChild(stripe);
        });
        return pattern;
    };
    const createCandidateColourPattern = (patternId, colours) => {
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        const stripeWidth = 9;
        pattern.setAttribute("id", patternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", String(stripeWidth * colours.length));
        pattern.setAttribute("height", "14");
        pattern.setAttribute("patternTransform", "rotate(28)");
        colours.forEach((colour, index) => {
            const stripe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            stripe.setAttribute("x", String(index * stripeWidth));
            stripe.setAttribute("y", "0");
            stripe.setAttribute("width", String(stripeWidth));
            stripe.setAttribute("height", "14");
            stripe.setAttribute("fill", colour);
            pattern.appendChild(stripe);
        });
        return pattern;
    };
    const ensureCandidateColourPattern = (svgRoot, patternId, candidates, race) => {
        if(!svgRoot || !Array.isArray(candidates) || candidates.length < 2) return null;
        if(svgRoot.querySelector(`[id="${patternId}"]`)) return patternId;
        let defs = String(svgRoot.tagName || "").toLowerCase() === "defs"
            ? svgRoot
            : svgRoot.querySelector("defs");
        if(!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svgRoot.insertBefore(defs, svgRoot.firstChild);
        }
        const colours = candidates.map(candidate =>
            stringifyColour(getCandidateColourForRace(candidate, race))
        );
        defs.appendChild(createCandidateColourPattern(patternId, colours));
        return patternId;
    };
    const createHousePrimaryPatterns = (defs) => {
        defs.appendChild(createHousePrimaryPartialPattern());
        const parties = ["D", "R", "I", "ID", "IR"];
        for (let mask = 1; mask < (1 << parties.length); mask++) {
            const selectedParties = parties.filter((_party, index) => (mask & (1 << index)) !== 0);
            if (selectedParties.length > 1) {
                defs.appendChild(createHousePrimaryPartyPattern(selectedParties));
            }
        }
    };
    const createCrossHatches = (svgElem) => {
        svgElem.appendChild(createPartyPattern("D", "R"));
        svgElem.appendChild(createPartyPattern("R", "D"));
        svgElem.appendChild(createPartyPattern("D", "ID"));
        svgElem.appendChild(createPartyPattern("D", "IR"));
        svgElem.appendChild(createPartyPattern("R", "ID"));
        svgElem.appendChild(createPartyPattern("R", "IR"));
        svgElem.appendChild(createPartyPattern("ID", "D"));
        svgElem.appendChild(createPartyPattern("ID", "R"));
        svgElem.appendChild(createPartyPattern("IR", "D"));
        svgElem.appendChild(createPartyPattern("IR", "R"));
        svgElem.appendChild(createPartyPattern("ID", "IR"));
        svgElem.appendChild(createPartyPattern("IR", "ID"));
        svgElem.appendChild(createGainPattern("D"));
        svgElem.appendChild(createGainPattern("R"));
        svgElem.appendChild(createGainPattern("ID"));
        svgElem.appendChild(createGainPattern("IR"));
    };
    const hideMapTooltip = () => {
        tooltipDiv.setAttribute("style", "display: none;");
        tooltipComponents.properties.visible = false;
        tooltipComponents.properties.targetDistrict = null;

        tooltipComponents.properties.positionedX = null;
        tooltipComponents.properties.positionedY = null;
        tooltipComponents.properties.positionedLeft = null;
        tooltipComponents.properties.positionedTop = null;
        houseDistrictTooltipTarget = null;
    };
    tooltipDiv.addEventListener("mouseenter", hideMapTooltip);
    const tooltipShowsNoElection = () => (
        tooltipComponents.noElection
        && tooltipComponents.noElection.style.display !== "none"
    );
    const positionMapTooltip = (event) => {
        if(!event || !Number.isFinite(Number(event.pageX)) || !Number.isFinite(Number(event.pageY))) return;
        const yPosition = Math.min(event.pageY + 10, window.innerHeight - tooltipDiv.offsetHeight);
        tooltipDiv.setAttribute("style", `left: ${event.pageX + 10}px; top: ${yPosition}px;`);
    };
    const getHouseDistricts = (stateId, live = false) => {
        const stateSummary = resultProxies.usHouse[String(stateId || "").toLowerCase()];
        const freshStateSummary = getFreshHouseStateSummary(stateId, stateSummary, live);
        return Array.isArray(freshStateSummary?.districts) ? freshStateSummary.districts : [];
    };
    const getFreshHouseStateSummary = (stateId, stateSummary, live) => {
        if (!Array.isArray(stateSummary?.districts)) return stateSummary;
        let liveHouseDistricts = [];
        try {
            liveHouseDistricts = Array.isArray(electNightUSH?.elections) ? electNightUSH.elections : [];
        } catch {
            liveHouseDistricts = [];
        }
        if (!liveHouseDistricts.length) return stateSummary;
        const normalizedStateId = String(stateId || "").toLowerCase();
        const freshDistrictsByNumber = new Map();
        liveHouseDistricts.forEach(district => {
            if (String(district?.state || "").toLowerCase() !== normalizedStateId) return;
            const districtNumber = Number(district?.district);
            if (Number.isFinite(districtNumber)) freshDistrictsByNumber.set(districtNumber, district);
        });
        if (!freshDistrictsByNumber.size) return stateSummary;
        return {
            ...stateSummary,
            districts: stateSummary.districts.map((district, index) => {
                const districtNumber = Number(district?.district);
                return freshDistrictsByNumber.get(Number.isFinite(districtNumber) ? districtNumber : index + 1) || district;
            })
        };
    };
    const getGeneralHouseDistricts = (stateId, live = false) => {
        const districts = getHouseDistricts(stateId, live);
        return districts.length > 0 && districts.every(district => Array.isArray(district?.cands))
            ? districts
            : [];
    };
    const isHousePrimaryDistrict = (district) => {
        return !Array.isArray(district?.cands)
            && (
                Array.isArray(district?.dem?.cands)
                || Array.isArray(district?.rep?.cands)
                || Array.isArray(district?.allCands?.cands)
            );
    };
    const getHousePrimaryDistrictGroups = (district) => {
        return [district?.dem, district?.rep, district?.allCands]
            .filter(group => Array.isArray(group?.cands) && group.cands.length > 0);
    };
    const isProjectedHousePrimaryGroup = (group) => {
        return group?.pW === true
            || group?.PW === true
            || group?.projected === true
            || group?.called === true
            || group?.call === true
            || group?.winnerProjected === true
            || group?.projectedWinner === true
            || (group?.cands || []).some(candidate =>
                candidate?.pW === true
                || candidate?.PW === true
                || candidate?.projected === true
                || candidate?.called === true
                || candidate?.call === true
                || candidate?.winnerProjected === true
                || candidate?.projectedWinner === true
            );
    };
    const isProjectedHousePrimaryDistrict = (district) => {
        return getHousePrimaryDistrictGroups(district).some(isProjectedHousePrimaryGroup);
    };
    const normalizeHousePrimaryCandidateAffiliation = (
        party,
        caucus,
        fallbackParty = "I"
    ) => {
        const normalizedParty = String(party || fallbackParty)
            .replace(/[^A-Za-z]/g, "")
            .toUpperCase();
        if (normalizedParty === "D" || normalizedParty === "DEM" || normalizedParty === "DEMOCRAT") {
            return "D";
        }
        if (normalizedParty === "R" || normalizedParty === "REP" || normalizedParty === "REPUBLICAN") {
            return "R";
        }
        if (normalizedParty === "ID" || normalizedParty === "IR") return normalizedParty;
        const normalizedCaucus = String(caucus || "")
            .replace(/[^A-Za-z]/g, "")
            .toUpperCase();
        if (normalizedCaucus.startsWith("D")) return "ID";
        if (normalizedCaucus.startsWith("R")) return "IR";
        return "I";
    };
    const getHousePrimaryCandidateParty = (candidate, fallbackParty = "I") => {
        if (candidate?.party) {
            return normalizeHousePrimaryCandidateAffiliation(
                candidate.party,
                candidate.caucusParty || candidate.caucus,
                fallbackParty
            );
        }
        try {
            const candArray = findCandByID([candidate.id])[0];
            const wrappedCandObj = Executive.data.characters.wrapCharacter(candArray, "candidate");
            return normalizeHousePrimaryCandidateAffiliation(
                wrappedCandObj?.extendedAttribs?.party,
                wrappedCandObj?.caucusParty
                    || wrappedCandObj?.extendedAttribs?.caucusParty
                    || wrappedCandObj?.extendedAttribs?.caucus,
                fallbackParty
            );
        } catch {
            return fallbackParty;
        }
    };
    const normalizeHousePrimaryParty = party => {
        const normalized = String(party || "I").replace(/[^A-Za-z]/g, "").toUpperCase();
        if (normalized === "D" || normalized === "DEM" || normalized === "DEMOCRAT") return "D";
        if (normalized === "R" || normalized === "REP" || normalized === "REPUBLICAN") return "R";
        if (normalized === "ID") return "ID";
        if (normalized === "IR") return "IR";
        return "I";
    };
    const getHousePrimaryPartyColour = party => {
        const normalized = normalizeHousePrimaryParty(party);
        if (normalized === "ID") return stringifyColour(config.partyColours.I.D);
        if (normalized === "IR") return stringifyColour(config.partyColours.I.R);
        if (normalized === "I") return stringifyColour(config.partyColours.I.default);
        return stringifyColour(config.partyColours[normalized] || config.partyColours.I.default);
    };
    const ELECTION_MARGIN_SATURATION_RAMP = Object.freeze([
        [0, 0.78],
        [0.001, 0.80],
        [0.005, 0.84],
        [0.01, 0.87],
        [0.03, 0.91],
        [0.05, 0.94],
        [0.10, 0.98],
        [0.15, 0.99],
        [0.20, 1],
        [0.30, 1.02],
        [0.45, 1.04],
        [0.60, 1.06],
        [0.75, 1.07],
        [0.90, 1.08],
        [1, 1.09]
    ]);
    const ELECTION_MARGIN_LIGHTNESS_RAMP = Object.freeze([
        [0, 90],
        [0.001, 84],
        [0.005, 75],
        [0.01, 73],
        [0.03, 70],
        [0.05, 66],
        [0.10, 61],
        [0.15, 57],
        [0.20, 50],
        [0.30, 44],
        [0.45, 40],
        [0.60, 37],
        [0.75, 34],
        [0.90, 30],
        [1, 26]
    ]);
    const normalizeElectionMargin = margin => Math.min(
        1,
        Math.max(0, Math.abs(Number(margin) || 0))
    );
    const getElectionMarginRampValue = (margin, ramp) => {
        const normalizedMargin = normalizeElectionMargin(margin);
        for(let index = 1; index < ramp.length; index += 1) {
            const [upperMargin, upperValue] = ramp[index];
            if(normalizedMargin > upperMargin) continue;
            const [lowerMargin, lowerValue] = ramp[index - 1];
            const progress = upperMargin === lowerMargin
                ? 1
                : (normalizedMargin - lowerMargin) / (upperMargin - lowerMargin);
            return lowerValue + ((upperValue - lowerValue) * progress);
        }
        return ramp[ramp.length - 1][1];
    };
    const getAbsoluteElectionMarginScaleNum = margin =>
        getElectionMarginRampValue(margin, ELECTION_MARGIN_SATURATION_RAMP);
    const getElectionMarginColour = (baseColour, margin) => {
        const normalizedMargin = normalizeElectionMargin(margin);
        const saturationScale = getAbsoluteElectionMarginScaleNum(normalizedMargin);
        const hue = Number(baseColour?.h) || 0;
        const baseSaturation = Math.min(100, Math.max(0, Number(baseColour?.s) || 0));
        return {
            h: hue,
            s: Math.min(100, baseSaturation * saturationScale),
            l: getElectionMarginRampValue(
                normalizedMargin,
                ELECTION_MARGIN_LIGHTNESS_RAMP
            )
        };
    };
    const getPrimaryPartySequencePatternId = (prefix, parties) => {
        return `${prefix}-${parties.map(normalizeHousePrimaryParty).join("-").toLowerCase()}`;
    };
    const ensurePrimaryPartySequencePattern = (svgMap, prefix, parties) => {
        const normalizedParties = parties.map(normalizeHousePrimaryParty).filter(Boolean);
        if (!svgMap || normalizedParties.length <= 1) return null;
        const patternId = getPrimaryPartySequencePatternId(prefix, normalizedParties);
        if (svgMap.querySelector(`[id="${patternId}"]`)) return patternId;
        let defs = svgMap.querySelector("defs");
        if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svgMap.insertBefore(defs, svgMap.firstChild);
        }
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        const stripeWidth = 8;
        pattern.setAttribute("id", patternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", String(stripeWidth * normalizedParties.length));
        pattern.setAttribute("height", "12");
        pattern.setAttribute("patternTransform", "rotate(28)");
        normalizedParties.forEach((party, index) => {
            const stripe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            stripe.setAttribute("x", String(index * stripeWidth));
            stripe.setAttribute("y", "0");
            stripe.setAttribute("width", String(stripeWidth));
            stripe.setAttribute("height", "12");
            stripe.setAttribute("fill", getHousePrimaryPartyColour(party));
            pattern.appendChild(stripe);
        });
        defs.appendChild(pattern);
        return patternId;
    };
    const getHousePrimaryProjectedGroups = district => {
        return getHousePrimaryDistrictGroups(district).filter(isProjectedHousePrimaryGroup);
    };
    const getHousePrimaryAdvanceCount = (district, stateId) => {
        const candidates = district?.allCands?.cands || [];
        const candidateCount = candidates.length;
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        const normalizeCount = value => {
            const count = Math.floor(Number(value));
            if (!Number.isFinite(count) || count <= 0) return null;
            return candidateCount > 0 ? Math.min(count, candidateCount) : count;
        };
        const isEnabledOption = value =>
            value === true || value === 1 || String(value || "").toLowerCase() === "true";
        const nationalNonpartisanPrimary = [
            readRuntimeValue("junglePrimary"),
            Executive?.data?.junglePrimary,
            Executive?.data?.advancedOptions?.junglePrimary
        ].some(isEnabledOption);
        const nationalAdvanceCount = [
            readRuntimeValue("nonPartisanAdv"),
            Executive?.data?.nonPartisanAdv,
            Executive?.data?.advancedOptions?.nonPartisanAdv
        ]
            .map(normalizeCount)
            .find(count => count !== null);
        const stateNonpartisanPrimary = isEnabledOption(state?.junglePrimary);
        const stateAdvanceCount = [
            state?.nonPartisanAdv,
            state?.elections?.nonPartisanAdv,
            state?.electionOptions?.nonPartisanAdv,
            state?.options?.nonPartisanAdv
        ]
            .map(normalizeCount)
            .find(count => count !== null);
        if(nationalNonpartisanPrimary && nationalAdvanceCount !== undefined) {
            return nationalAdvanceCount;
        }
        if(stateNonpartisanPrimary && stateAdvanceCount !== undefined) {
            return stateAdvanceCount;
        }
        if(!stateNonpartisanPrimary && nationalAdvanceCount !== undefined) {
            return nationalAdvanceCount;
        }
        const explicitlyAdvancingCount = candidates.filter(candidate =>
            candidate?.pW === true
            || candidate?.PW === true
            || candidate?.projected === true
            || candidate?.called === true
            || candidate?.call === true
            || candidate?.winnerProjected === true
            || candidate?.projectedWinner === true
            || candidate?.advancing === true
            || candidate?.advances === true
            || candidate?.qualifiedForGeneral === true
        ).length;
        if(explicitlyAdvancingCount > 0) return explicitlyAdvancingCount;
        const raceSources = [
            district,
            district?.allCands,
            district?.allPri
        ];
        const fallbackSources = [
            state,
            state?.elections,
            state?.electionOptions,
            state?.options,
            Executive?.data,
            Executive?.data?.advancedOptions
        ];
        const optionNames = [
            "nonPartisanAdv",
            "advancingCount",
            "advanceCount",
            "candidatesWhoAdvance",
            "runoffCount"
        ];
        for (const source of raceSources) {
            if (!source || typeof source !== "object") continue;
            for (const optionName of optionNames) {
                const count = normalizeCount(source[optionName]);
                if (count !== null) return count;
            }
        }
        for (const optionName of optionNames) {
            const count = normalizeCount(readRuntimeValue(optionName));
            if (count !== null) return count;
        }
        for (const source of fallbackSources) {
            if (!source || typeof source !== "object") continue;
            for (const optionName of optionNames) {
                const count = normalizeCount(source[optionName]);
                if (count !== null) return count;
            }
        }
        return candidateCount > 0 ? Math.min(2, candidateCount) : 2;
    };
    const getHousePrimaryNonpartisanAdvancers = (district, live, stateId) => {
        const stateElectData = getHouseStateElectionData(stateId);
        const candidates = (district?.allCands?.cands || []).map(candidate => {
            const visibleVotes = getHousePrimaryVisibleVotes(candidate, stateElectData, live);
            return {
                ...candidate,
                party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I")),
                currentVotes: live === true ? visibleVotes : candidate?.currentVotes,
                visibleVotes
            };
        });
        if (!candidates.length) return [];
        const sortedCandidates = candidates.slice().sort((candidateA, candidateB) =>
            candidateB.visibleVotes - candidateA.visibleVotes
        );
        if (sortedCandidates[0].visibleVotes <= 0) return [];
        const advancingCount = getHousePrimaryAdvanceCount(district, stateId);
        return sortedCandidates.slice(0, advancingCount);
    };
    const isHousePrimaryGroupComplete = (group, live, stateId) => {
        if (live !== true || isProjectedHousePrimaryGroup(group)) return true;
        const candidates = group?.cands || [];
        const stateElectData = getHouseStateElectionData(stateId);
        const finalVotes = candidates.reduce(
            (total, candidate) => total + (Number(candidate?.votes) || 0),
            0
        );
        const visibleVotes = candidates.reduce(
            (total, candidate) => total + getHousePrimaryVisibleVotes(candidate, stateElectData, true),
            0
        );
        return finalVotes > 0 && visibleVotes >= finalVotes * 0.999;
    };
    const getHousePrimaryCandidatePatternId = (stateId, districtNumber) =>
        `bm-house-primary-candidates-${String(stateId).toLowerCase()}-${districtNumber}`;
    const createHousePrimaryCandidatePatterns = (defs, stateId, districts, live) => {
        const stateElectData = getHouseStateElectionData(stateId);
        districts.forEach((district, index) => {
            const allCandidates = (district?.allCands?.cands || []).map(candidate => {
                const visibleVotes = getHousePrimaryVisibleVotes(candidate, stateElectData, live);
                return {
                    ...candidate,
                    party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I")),
                    currentVotes: live === true ? visibleVotes : candidate?.currentVotes,
                    visibleVotes
                };
            });
            const isNonpartisan = (district?.dem?.cands || []).length === 0
                && (district?.rep?.cands || []).length === 0
                && allCandidates.length > 0;
            if(!isNonpartisan) return;
            if(!isHousePrimaryGroupComplete(district.allCands, live, stateId)) return;
            const advancingCandidates = getHousePrimaryNonpartisanAdvancers(district, live, stateId);
            if(advancingCandidates.length < 2) return;
            const patternId = getHousePrimaryCandidatePatternId(
                stateId,
                getHouseDistrictNumber(district, index)
            );
            if(defs.querySelector(`[id="${patternId}"]`)) return;
            const colours = advancingCandidates.map(candidate =>
                stringifyColour(getCandidateColourForRace(candidate, {
                    cands: allCandidates,
                    colourScope: `house-primary:${String(stateId || "").toLowerCase()}:${getHouseDistrictNumber(district, index)}:N`
                }))
            );
            defs.appendChild(createCandidateColourPattern(patternId, colours));
        });
    };
    const isStatewidePrimaryRace = race => {
        return !Array.isArray(race?.cands)
            && (
                Array.isArray(race?.dem?.cands)
                || Array.isArray(race?.rep?.cands)
                || Array.isArray(race?.allCands?.cands)
            );
    };
    const getPresidentialPrimaryArchive = party => {
        try {
            if(party === "D") {
                return typeof presPrimaryDemArray !== "undefined"
                    ? presPrimaryDemArray
                    : globalThis.presPrimaryDemArray;
            }
            return typeof presPrimaryRepArray !== "undefined"
                ? presPrimaryRepArray
                : globalThis.presPrimaryRepArray;
        } catch {
            return null;
        }
    };
    const getArchivedPresidentialPrimaryGroup = (stateId, party) => {
        const stateName = Executive?.data?.states?.[String(stateId || "").toLowerCase()]?.name;
        const archive = getPresidentialPrimaryArchive(party);
        const stateResult = archive?.states?.find(state =>
            String(state?.name || "").trim().toLowerCase()
            === String(stateName || "").trim().toLowerCase()
        );
        if(!stateResult || !Array.isArray(stateResult.candidates)) return null;
        const candidates = stateResult.candidates.map(candidate => {
            const votes = Math.max(0, Number(
                candidate?.totVotes ?? candidate?.votes ?? candidate?.currentVotes
            ) || 0);
            return {
                ...candidate,
                party,
                votes,
                currentVotes: votes
            };
        });
        if(!candidates.some(candidate => candidate.votes > 0)) return null;
        return {
            ...stateResult,
            cands: candidates,
            totalVotes: candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
            totalCurrVotes: candidates.reduce((sum, candidate) => sum + candidate.currentVotes, 0)
        };
    };
    const getStatewideRaceForMap = (electionType, stateId, options = {}) => {
        const stateKey = String(stateId || "").toLowerCase();
        const proxyRace = resultProxies[electionType]?.[stateKey];
        if(electionType !== "president") return proxyRace;
        const allowArchive = options.allowArchive !== false;
        const hasLivePrimaryGroupProgress = group => {
            const candidates = Array.isArray(group?.cands) ? group.cands : [];
            if(!candidates.length) return false;
            return candidates.some(candidate => Number(candidate?.currentVotes) > 0)
                || Number(group?.totalCurrVotes) > 0;
        };
        if(!allowArchive) return proxyRace;
        const presidentialPrimaryPageOpen = Boolean(
            document.getElementById("presElectDemPTab")
            || document.getElementById("presElectRepPTab")
            || isStatewidePrimaryRace(proxyRace)
        );
        if(!presidentialPrimaryPageOpen) return proxyRace;
        const archivedDem = getArchivedPresidentialPrimaryGroup(stateKey, "D");
        const archivedRep = getArchivedPresidentialPrimaryGroup(stateKey, "R");
        if(!archivedDem && !archivedRep) return proxyRace;
        return {
            ...(proxyRace || {}),
            state: stateKey,
            dem: hasLivePrimaryGroupProgress(proxyRace?.dem) ? proxyRace.dem : (archivedDem || proxyRace?.dem),
            rep: hasLivePrimaryGroupProgress(proxyRace?.rep) ? proxyRace.rep : (archivedRep || proxyRace?.rep),
            allCands: proxyRace?.allCands
        };
    };
    const resetPresidentialPrimaryCountyView = () => {
        if(lastMapElectionType !== "president") return;
        onCountyMap = false;
        activeMap = "US";
        activePrimaryCountyParty = null;
        activePrimaryCountyElectionType = null;
        activeCountyMapMode = MAP_MODES.MARGIN;
        removePrimaryCountyPartyControls();
        setMapModeControlsVisible(true);
        clearStatewideTurnoutFloatingUi();
        tooltipDiv.style.display = "none";
        tooltipComponents.properties.visible = false;
        tooltipComponents.properties.targetDistrict = null;
        if(presidentialPrimaryResetTimer) clearTimeout(presidentialPrimaryResetTimer);
        presidentialPrimaryResetTimer = setTimeout(() => {
            presidentialPrimaryResetTimer = null;
            if(modShuttingDown) return;
            if(typeof lastMapPageRefresh === "function") lastMapPageRefresh();
        }, 0);
    };
    const handlePresidentialPrimaryTabClick = event => {
        if(!(event.target instanceof Element)) return;
        const target = event.target.closest(
            "#presElectDemPTab, #presElectRepPTab, button, [role='tab'], input[type='button']"
        );
        if(!target) return;
        const id = String(target.id || "");
        const label = String(
            target.innerText || target.textContent || target.getAttribute("value") || ""
        ).trim().toLowerCase();
        const isDemocraticTab = id === "presElectDemPTab"
            || label === "democrats"
            || label === "democratic primary";
        const isRepublicanTab = id === "presElectRepPTab"
            || label === "republicans"
            || label === "republican primary";
        if(isDemocraticTab || isRepublicanTab) resetPresidentialPrimaryCountyView();
    };
    const installPresidentialPrimaryTabReset = () => {
        if(presidentialPrimaryTabResetInstalled || typeof document === "undefined") return;
        presidentialPrimaryTabResetInstalled = true;
        document.addEventListener("click", handlePresidentialPrimaryTabClick, true);
    };
    const isEligibleStatewidePrimaryCountyRace = (
        electionType,
        stateId,
        race = null,
        selectedParty = null
    ) => {
        if(!["president", "usSenate", "governor"].includes(electionType)) return false;
        const currentRace = electionType === "president"
            ? getStatewideRaceForMap(electionType, stateId, { allowArchive: !lastMapLive })
            : (race || resultProxies[electionType]?.[stateId]);
        if(!isStatewidePrimaryRace(currentRace)) return false;
        if(lastMapLive && !hasLiveStatewidePrimaryRaceStarted(stateId, currentRace, selectedParty)) return false;
        const parties = getAvailablePrimaryParties(stateId, electionType);
        if(!parties.length) return false;
        if(electionType === "president") {
            const party = selectedParty || getActivePresidentialPrimaryParty();
            return parties.includes(party)
                && (
                    lastMapLive
                        ? isPrimaryPartyStarted(stateId, party, electionType)
                        : isPrimaryPartyFullyReported(stateId, party, electionType)
                )
                && Boolean(buildPrimaryCountyResults(stateId, party, electionType));
        }
        if(!lastMapLive && !isPrimaryStateFullyReported(stateId, electionType)) return false;
        return parties.some(party => Boolean(
            (!lastMapLive || isPrimaryPartyStarted(stateId, party, electionType))
            && buildPrimaryCountyResults(stateId, party, electionType)
        ));
    };
    const removePrimaryCountyPartyControls = () => {
        document.getElementById("bm-primary-county-party-controls")?.remove();
        document.getElementById("bm-primary-county-view-controls")?.remove();
        document.querySelectorAll(".bm-primary-county-map-host").forEach(host =>
            host.classList.remove("bm-primary-county-map-host"));
    };
    const removePresidentialPrimaryNationalControls = () => {
        document.getElementById("bm-presidential-primary-national-controls")?.remove();
        document.querySelectorAll(".bm-presidential-primary-national-map-host").forEach(host =>
            host.classList.remove("bm-presidential-primary-national-map-host"));
    };
    const isPresidentialPrimaryNationalMap = (electionType, resultColours, live) => {
        if(electionType !== "president" || onCountyMap) return false;
        if(
            document.getElementById("presElectDemPTab")
            || document.getElementById("presElectRepPTab")
            || isPrimaryElectionNightPage()
        ) return true;
        return Object.keys(resultColours || {}).some(stateId =>
            isStatewidePrimaryRace(getStatewideRaceForMap(
                electionType,
                stateId,
                { allowArchive: !live }
            ))
        );
    };
    const ensurePresidentialPrimaryNationalControls = (
        svgMap,
        resultColours,
        electionType,
        live,
        projected
    ) => {
        removePresidentialPrimaryNationalControls();
        if(!svgMap?.parentElement || !isPresidentialPrimaryNationalMap(electionType, resultColours, live)) {
            return null;
        }
        const mapHost = svgMap.parentElement;
        mapHost.classList.add("bm-presidential-primary-national-map-host");
        const controls = document.createElement("div");
        controls.id = "bm-presidential-primary-national-controls";
        controls.classList.toggle("bm-presidential-primary-national-controls-page", !live);
        const referenceButton = live
            ? (document.getElementById("eNightProjectB")
                || document.getElementById("presElectDemPTab")
                || document.getElementById("presElectRepPTab"))
            : null;
        const referenceStyle = referenceButton ? getComputedStyle(referenceButton) : null;
        const selectMode = nextMode => {
            if(presidentialPrimaryNationalMapMode === nextMode) return;
            playClick();
            presidentialPrimaryNationalMapMode = nextMode;
            hideMapTooltip();
            controls.querySelectorAll("[data-presidential-primary-map-mode]").forEach(button => {
                button.classList.toggle(
                    "bm-presidential-primary-national-active",
                    button.dataset.presidentialPrimaryMapMode === nextMode
                );
                button.setAttribute(
                    "aria-pressed",
                    button.dataset.presidentialPrimaryMapMode === nextMode ? "true" : "false"
                );
            });
            updateMap(svgMap, resultColours, electionType, live, projected);
        };
        [
            { mode: MAP_MODES.WINNER, label: "Winner" },
            { mode: MAP_MODES.MARGIN, label: "Margin" }
        ].forEach(({ mode, label }) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.presidentialPrimaryMapMode = mode;
            button.textContent = label;
            button.classList.toggle(
                "bm-presidential-primary-national-active",
                presidentialPrimaryNationalMapMode === mode
            );
            button.setAttribute(
                "aria-pressed",
                presidentialPrimaryNationalMapMode === mode ? "true" : "false"
            );
            if(referenceStyle) {
                ["font", "padding", "border", "border-radius", "background", "color", "box-shadow"]
                    .forEach(property => button.style.setProperty(
                        property,
                        referenceStyle.getPropertyValue(property)
                    ));
            }
            button.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                selectMode(mode);
            };
            controls.appendChild(button);
        });
        mapHost.appendChild(controls);
        const positionControls = () => {
            if(!svgMap.isConnected || !controls.isConnected) return;
            const hostBounds = mapHost.getBoundingClientRect();
            const mapBounds = svgMap.getBoundingClientRect();
            controls.style.top = `${mapBounds.top - hostBounds.top + 10}px`;
            controls.style.left = `${Math.max(
                mapBounds.left - hostBounds.left + 10,
                mapBounds.right - hostBounds.left - controls.offsetWidth - 10
            )}px`;
        };
        requestAnimationFrame(positionControls);
        setTimeout(positionControls, 0);
        return controls;
    };
    const ensurePrimaryCountyViewControls = (
        mapHost,
        svgMap,
        returnButton,
        electionType,
        live
    ) => {
        document.getElementById("bm-primary-county-view-controls")?.remove();
        const activeRace = getStatewideRaceForMap(electionType, activeMap, { allowArchive: !live });
        if(
            !onCountyMap
            || !["president", "usSenate", "governor"].includes(electionType)
            || (!Array.isArray(activeRace?.cands) && !isStatewidePrimaryRace(activeRace))
        ) return null;
        const rcvContext = getRcvMapFinalContext(
            electionType,
            activeMap,
            activeRace,
            live
        );
        if(!rcvContext && /-rcv$/.test(activeCountyMapMode)) {
            activeCountyMapMode = MAP_MODES.MARGIN;
        }
        const governorFlipModeAvailable = !rcvContext && isGovernorCountyFlipModeAvailable(
            electionType,
            activeMap,
            activeRace,
            live
        );
        if(activeCountyMapMode === MAP_MODES.FLIP_COUNTIES && !governorFlipModeAvailable) {
            activeCountyMapMode = MAP_MODES.WINNER;
        }
        const controls = document.createElement("div");
        controls.id = "bm-primary-county-view-controls";
        controls.classList.toggle("bm-has-rcv-map-controls", Boolean(rcvContext));
        const returnButtonStyle = returnButton ? getComputedStyle(returnButton) : null;
        const selectCountyMapMode = nextMode => {
            playClick();
            hideMapTooltip();
            tooltipComponents.properties.electionType = null;
            tooltipComponents.properties.districtId = null;
            tooltipComponents.properties.countyView = null;
            if(precinctResultsController?.isActive?.()) {
                precinctResultsController.deactivate({ nextMode });
            }

            activeCountyMapMode = nextMode;
            controls.querySelectorAll("[data-map-mode]").forEach(control => {
                control.className = control.dataset.mapMode === nextMode
                    ? "bm-primary-county-view-active"
                    : "";
            });
            updateCountyMap(svgMap, electionType, live);
        };
        const countyViewModes = [
            { mode: "projections", mapMode: MAP_MODES.WINNER, label: "Winner" },
            { mode: "margins", mapMode: MAP_MODES.MARGIN, label: "Margin" }
        ];
        if(governorFlipModeAvailable) {
            countyViewModes.splice(1, 0, {
                mode: "flips",
                mapMode: MAP_MODES.FLIP_COUNTIES,
                label: "Flip Counties"
            });
        }
        countyViewModes.forEach(({ mode, mapMode, label }) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.primaryCountyView = mode;
            button.dataset.mapMode = mapMode;
            button.textContent = label;
            button.className = activeCountyMapMode === mapMode
                ? "bm-primary-county-view-active"
                : "";
            if(returnButtonStyle) {
                ["font", "padding", "border", "border-radius", "background", "color", "box-shadow"]
                    .forEach(property => button.style.setProperty(
                        property,
                        returnButtonStyle.getPropertyValue(property)
                    ));
            }
            button.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                selectCountyMapMode(mapMode);
            };
            controls.appendChild(button);
        });
        if(rcvContext) {
            [
                { mode: MAP_MODES.WINNER_RCV, label: "W. RCV" },
                { mode: MAP_MODES.MARGIN_RCV, label: "M. RCV" }
            ].forEach(({ mode, label }) => {
                const button = document.createElement("button");
                button.type = "button";
                button.dataset.mapMode = mode;
                button.textContent = label;
                button.className = activeCountyMapMode === mode
                    ? "bm-primary-county-view-active"
                    : "";
                if(returnButtonStyle) {
                    ["font", "padding", "border", "border-radius", "background", "color", "box-shadow"]
                        .forEach(property => button.style.setProperty(
                            property,
                            returnButtonStyle.getPropertyValue(property)
                        ));
                }
                button.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectCountyMapMode(mode);
                };
                controls.appendChild(button);
            });
        }
        mapHost.insertBefore(controls, svgMap);
        const positionControls = () => {
            if(!svgMap.isConnected || !controls.isConnected) return;
            const hostBounds = mapHost.getBoundingClientRect();
            const mapBounds = svgMap.getBoundingClientRect();
            const mapLeft = mapBounds.left - hostBounds.left;
            const mapTop = mapBounds.top - hostBounds.top;
            const mapWidth = mapBounds.width || svgMap.clientWidth;
            const mapRight = mapLeft + mapWidth;
            const returnWidth = Math.ceil(returnButton?.getBoundingClientRect().width || 0);
            const hasRcvControls = controls.classList.contains(
                "bm-has-rcv-map-controls"
            );
            if(returnWidth > 0) {
                if(hasRcvControls) {
                    const rcvColumnGap = 10;
                    const rcvPrecinctButton = controls.querySelector(
                        "#bm-precincts-rcv-button"
                    );
                    let rcvPrecinctWidth = returnWidth;
                    if(rcvPrecinctButton) {
                        const style = getComputedStyle(rcvPrecinctButton);
                        const canvas = document.createElement("canvas");
                        const canvasContext = canvas.getContext("2d");
                        if(canvasContext) {
                            canvasContext.font = style.font;
                            const textWidth = canvasContext.measureText(
                                rcvPrecinctButton.textContent?.trim() || ""
                            ).width;
                            const horizontalChrome = [
                                "padding-left", "padding-right",
                                "border-left-width", "border-right-width"
                            ].reduce(
                                (total, property) =>
                                    total
                                    + (
                                        parseFloat(
                                            style.getPropertyValue(property)
                                        ) || 0
                                    ),
                                0
                            );
                            rcvPrecinctWidth = Math.ceil(
                                textWidth + horizontalChrome + 4
                            );
                        }
                    }
                    const mainButtonWidth = Math.max(122, rcvPrecinctWidth);
                    controls.style.setProperty(
                        "--bm-rcv-main-button-width",
                        `${mainButtonWidth}px`
                    );
                    controls.style.setProperty(
                        "--bm-rcv-half-button-width",
                        `${
                            Math.max(
                                42,
                                (returnWidth - rcvColumnGap) / 2
                            )
                        }px`
                    );
                    controls.style.width = `${
                        mainButtonWidth + returnWidth + rcvColumnGap
                    }px`;
                    controls.style.setProperty(
                        "column-gap",
                        `${rcvColumnGap}px`,
                        "important"
                    );
                    controls.querySelectorAll("button").forEach(button => {
                        const isPrecinctColumnButton =
                            button.id === "eNightPrecinctsB"
                            || button.id === "bm-precincts-rcv-button";
                        button.style.width = isPrecinctColumnButton
                            ? `${mainButtonWidth}px`
                            : "100%";
                        button.style.minWidth = isPrecinctColumnButton
                            ? `${mainButtonWidth}px`
                            : "0";
                    });
                } else {
                    controls.style.removeProperty("--bm-rcv-main-button-width");
                    controls.style.removeProperty("--bm-rcv-half-button-width");
                    controls.style.removeProperty("width");
                    controls.querySelectorAll("button").forEach(button => {
                        button.style.width = `${returnWidth}px`;
                        button.style.removeProperty("min-width");
                    });
                }
            }
            if(live === false && !hasRcvControls) {
                const precinctButton = controls.querySelector("#eNightPrecinctsB");
                const projectButton = controls.querySelector(
                    "[data-primary-county-view='projections']"
                );
                const returnBounds = returnButton?.getBoundingClientRect();
                const projectWidth = projectButton?.getBoundingClientRect().width || returnWidth;
                if(
                    precinctButton
                    && returnBounds?.width > 0
                    && projectWidth > 0
                ) {
                    const controlGap = 7;
                    const mapEdgeInset = 8;
                    const returnRight = returnBounds.right - hostBounds.left;
                    const availablePrecinctWidth = mapRight
                        - mapEdgeInset
                        - projectWidth
                        - controlGap
                        - returnRight
                        - controlGap;
                    precinctButton.style.setProperty(
                        "width",
                        `${Math.max(82, availablePrecinctWidth)}px`,
                        "important"
                    );
                }
            }
            controls.style.top = `${mapTop + 8}px`;
            controls.style.left = `${Math.max(
                mapLeft + 8,
                mapRight - controls.offsetWidth - 8
            )}px`;
        };
        requestAnimationFrame(positionControls);
        setTimeout(positionControls, 0);
        return controls;
    };
    const ensurePrimaryCountyPartyControls = (
        container,
        canvasElem,
        svgMap,
        electionType,
        live
    ) => {
        removePrimaryCountyPartyControls();
        if(electionType === "president") return;
        if(!onCountyMap || !isEligibleStatewidePrimaryCountyRace(electionType, activeMap)) return;
        const allParties = getAvailablePrimaryParties(activeMap, electionType);
        const parties = live
            ? allParties.filter(party =>
                isPrimaryPartyStarted(activeMap, party, electionType)
            )
            : allParties;
        if(!parties.length) return;
        if(parties.length === 1 && parties[0] === "N") return;
        container.classList.add("bm-primary-county-map-host");
        if(!parties.includes(activePrimaryCountyParty)) activePrimaryCountyParty = parties[0];
        const controls = document.createElement("div");
        controls.id = "bm-primary-county-party-controls";
        const returnButton = document.getElementById(
            live ? "eNightReturnB" : "ePageReturnB"
        ) || document.getElementById("ePageReturnB2");
        const returnButtonStyle = returnButton ? getComputedStyle(returnButton) : null;
        parties.forEach(party => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.primaryCountyParty = party;
            button.textContent = party === "D"
                ? "Democratic Primary"
                : (party === "R" ? "Republican Primary" : "Nonpartisan Primary");
            button.className = party === activePrimaryCountyParty
                ? "bm-primary-county-party-active"
                : "";
            if(returnButtonStyle) {
                ["font", "padding", "border", "border-radius", "background", "color", "box-shadow"]
                    .forEach(property => button.style.setProperty(
                        property,
                        returnButtonStyle.getPropertyValue(property)
                    ));
            }
            button.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                if(activePrimaryCountyParty === party) return;
                playClick();
                activePrimaryCountyParty = party;
                controls.querySelectorAll("[data-primary-county-party]").forEach(controlButton => {
                    controlButton.className = controlButton.dataset.primaryCountyParty === party
                        ? "bm-primary-county-party-active"
                        : "";
                });
                tooltipDiv.style.display = "none";
                tooltipComponents.properties.visible = false;
                tooltipComponents.properties.targetDistrict = null;
                updatePrimaryCountyMap(svgMap, electionType, live);
            };
            controls.appendChild(button);
        });
        if(returnButton?.parentElement === container) {
            returnButton.insertAdjacentElement("afterend", controls);
        } else {
            container.insertBefore(controls, canvasElem);
        }
    };
    const isElectionNightFinished = () => {
        try {
            const pageText = String(document.body?.innerText || document.body?.textContent || "");
            const clockMatch = pageText.match(/\(\s*(\d+):(\d{2})\s*\)/);
            if(clockMatch) {
                return Number(clockMatch[1]) === 0 && Number(clockMatch[2]) === 0;
            }
        } catch {}
        const timeValue = Number(readRuntimeValue("electNightTime"));
        return Number.isFinite(timeValue) && timeValue <= 0;
    };
    const getPrimaryVisibleVotes = (candidate, live, stateElectData = null) => {
        const finalVotes = Number(candidate?.votes) || 0;
        if (live !== true) return finalVotes;
        if (isElectionNightFinished()) return finalVotes;
        const currentVotes = Number(candidate?.currentVotes);
        if (Number.isFinite(currentVotes) && currentVotes > 0) return currentVotes;
        const currentIndex = Number(stateElectData?.indx);
        const updates = Array.isArray(candidate?.updates) ? candidate.updates : [];
        if (updates.length && Number.isFinite(currentIndex) && currentIndex > 0) {
            const updateIndex = Math.min(Math.max(0, currentIndex), updates.length - 1);
            const progress = Number(updates[updateIndex]);
            if (Number.isFinite(progress) && progress > 0) return finalVotes * progress;
        }
        return 0;
    };
    const isPrimaryGroupComplete = (group, live, stateElectData = null) => {
        if (live !== true) return true;
        if (isProjectedHousePrimaryGroup(group)) return true;
        const candidates = group?.cands || [];
        const finalVotes = candidates.reduce((total, candidate) => total + (Number(candidate?.votes) || 0), 0);
        const currentVotes = candidates.reduce((total, candidate) =>
            total + getPrimaryVisibleVotes(candidate, true, stateElectData), 0);
        return finalVotes > 0 && currentVotes / finalVotes >= 0.999;
    };
    const getFreshStatewidePrimaryRace = (stateId, race, live, electionType) => {
        if (live === true && isStatewidePrimaryRace(race)) {
            try {
                refreshLiveStateResultsForTooltip(electionType, stateId);
            } catch { }
        }
        return resultProxies[electionType]?.[String(stateId || "").toLowerCase()] || race;
    };
    const getStatewidePrimaryAdvancingParties = (race, live, stateId) => {
        if (!isStatewidePrimaryRace(race)) return [];
        const stateElectData = getHouseStateElectionData(stateId);
        const demCandidates = race?.dem?.cands || [];
        const repCandidates = race?.rep?.cands || [];
        const allCandidates = race?.allCands?.cands || [];
        const isNonpartisanPrimary = demCandidates.length === 0 && repCandidates.length === 0 && allCandidates.length > 0;
        if (isNonpartisanPrimary) {
            if (!isPrimaryGroupComplete(race.allCands, live, stateElectData)) return [];
            const sortedCandidates = allCandidates
                .map(candidate => ({
                    ...candidate,
                    party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I")),
                    visibleVotes: getPrimaryVisibleVotes(candidate, live, stateElectData)
                }))
                .filter(candidate => candidate.visibleVotes > 0)
                .sort((candidateA, candidateB) => candidateB.visibleVotes - candidateA.visibleVotes);
            if (!sortedCandidates.length) return [];
            const advanceCount = getHousePrimaryAdvanceCount(race, stateId);
            return sortedCandidates.slice(0, advanceCount).map(candidate => candidate.party || "I");
        }
        return [
            { party: "D", group: race?.dem, candidates: demCandidates },
            { party: "R", group: race?.rep, candidates: repCandidates }
        ].flatMap(group => {
            if (!group.candidates.length) return [];
            if (!isPrimaryGroupComplete(group.group, live, stateElectData)) return [];
            const winner = group.candidates
                .map(candidate => ({
                    ...candidate,
                    visibleVotes: getPrimaryVisibleVotes(candidate, live, stateElectData)
                }))
                .filter(candidate => candidate.visibleVotes > 0)
                .sort((candidateA, candidateB) => candidateB.visibleVotes - candidateA.visibleVotes)[0];
            return winner ? [group.party] : [];
        });
    };
    const getStatewidePartisanPrimaryVoteWinner = (stateId, race, live) => {
        if (!isStatewidePrimaryRace(race)) return null;
        const stateElectData = getHouseStateElectionData(stateId);
        const voteTotals = { D: 0, R: 0, I: 0, ID: 0, IR: 0 };
        [
            { party: "D", candidates: race?.dem?.cands || [] },
            { party: "R", candidates: race?.rep?.cands || [] },
            { party: null, candidates: race?.allCands?.cands || [] }
        ].forEach(group => {
            const sourceGroup = group.party === "D"
                ? race?.dem
                : (group.party === "R" ? race?.rep : race?.allCands);
            if(live === true && !hasLiveStatewidePrimaryGroupStarted(stateId, sourceGroup)) return;
            group.candidates.forEach(candidate => {
                const party = normalizeHousePrimaryParty(
                    group.party || getHousePrimaryCandidateParty(candidate, "I")
                );
                voteTotals[party] += getPrimaryVisibleVotes(candidate, live, stateElectData);
            });
        });
        const sortedParties = Object.entries(voteTotals)
            .filter(([_party, votes]) => votes > 0)
            .sort((partyA, partyB) => partyB[1] - partyA[1]);
        if (!sortedParties.length) return null;
        const [winnerParty, winnerVotes] = sortedParties[0];
        const secondVotes = sortedParties[1]?.[1] || 0;
        const totalVotes = Object.values(voteTotals).reduce((total, votes) => total + votes, 0);
        return {
            party: winnerParty,
            margin: totalVotes > 0 ? (winnerVotes - secondVotes) / totalVotes : 0,
            tied: sortedParties.length > 1 && sortedParties[0][1] === sortedParties[1][1]
        };
    };
    const getStatewidePartisanPrimaryStateColour = (stateId, race, live) => {
        const winner = getStatewidePartisanPrimaryVoteWinner(stateId, race, live);
        if (!winner) return null;
        if (winner.tied) return stringifyColour(config.partyColours.HouseTie);
        const normalizedParty = normalizeHousePrimaryParty(winner.party);
        const baseColour = normalizedParty === "ID"
            ? config.partyColours.I.D
            : (normalizedParty === "IR"
                ? config.partyColours.I.R
                : (normalizedParty === "I"
                    ? config.partyColours.I.default
                    : config.partyColours[normalizedParty]));
        if (!baseColour) return null;
        return stringifyColour(getElectionMarginColour(baseColour, winner.margin));
    };
    const getStatewidePrimaryPartyCandidateColour = (stateId, race, live, party) => {
        const normalizedParty = normalizeHousePrimaryParty(party);
        const group = normalizedParty === "D"
            ? race?.dem
            : (normalizedParty === "R" ? race?.rep : null);
        if(live === true && !hasLiveStatewidePrimaryGroupStarted(stateId, group)) return null;
        const candidates = Array.isArray(group?.cands) ? group.cands : [];
        if(!candidates.length) return null;
        const stateElectData = getHouseStateElectionData(stateId);
        const candidateRace = candidates.map(candidate => {
            const affiliation = getPrimaryCandidateAffiliation(candidate, normalizedParty);
            return {
                ...candidate,
                party: affiliation.party,
                caucus: affiliation.caucus,
                caucusParty: affiliation.caucusParty,
                visibleVotes: getPrimaryVisibleVotes(candidate, live, stateElectData)
            };
        });
        const sortedCandidates = candidateRace
            .filter(candidate => candidate.visibleVotes > 0)
            .sort((candidateA, candidateB) => candidateB.visibleVotes - candidateA.visibleVotes);
        if(!sortedCandidates.length) return null;
        const winner = sortedCandidates[0];
        const baseColour = getCandidateColourForRace(winner, {
            cands: candidateRace,
            colourScope: `presidential-primary:${String(stateId || "").toLowerCase()}:${normalizedParty}`
        });
        if(presidentialPrimaryNationalMapMode !== MAP_MODES.MARGIN) {
            return stringifyColour(baseColour);
        }
        const totalVisibleVotes = sortedCandidates.reduce(
            (total, candidate) => total + candidate.visibleVotes,
            0
        );
        const runnerUpVotes = sortedCandidates[1]?.visibleVotes || 0;
        const margin = totalVisibleVotes > 0
            ? (winner.visibleVotes - runnerUpVotes) / totalVisibleVotes
            : 0;
        return stringifyColour(getElectionMarginColour(baseColour, margin));
    };
    const hasPrimaryGroupStarted = group => {
        const candidates = Array.isArray(group?.cands) ? group.cands : [];
        const finalVotes = candidates.reduce(
            (sum, candidate) => sum + Math.max(0, Number(candidate?.votes) || 0),
            0
        );
        if(isElectionNightFinished() && finalVotes > 0) return true;
        if(
            finalVotes > 0
            && (
                Number(group?.totalCurrVotes) >= finalVotes
                || candidates.every(candidate =>
                    Number(candidate?.currentVotes) >= Math.max(0, Number(candidate?.votes) || 0)
                )
            )
        ) return true;
        return Number(group?.totalCurrVotes) > 0
            || candidates.some(candidate => Number(candidate?.currentVotes) > 0);
    };
    const getStatewidePrimaryStateFill = (svgMap, stateId, race, live, electionType) => {
        const freshRace = getFreshStatewidePrimaryRace(stateId, race, live, electionType);
        if(live === true && !hasLiveStatewidePrimaryRaceStarted(stateId, freshRace)) return null;
        const demCandidates = freshRace?.dem?.cands || [];
        const repCandidates = freshRace?.rep?.cands || [];
        const allCandidates = freshRace?.allCands?.cands || [];
        const isNonpartisanPrimary = demCandidates.length === 0 && repCandidates.length === 0 && allCandidates.length > 0;
        if (!isNonpartisanPrimary) {
            if(electionType === "president") {
                return getStatewidePrimaryPartyCandidateColour(
                    stateId,
                    freshRace,
                    live,
                    getActivePresidentialPrimaryParty() || "D"
                );
            }
            return getStatewidePartisanPrimaryStateColour(stateId, freshRace, live);
        }
        const stateElectData = getHouseStateElectionData(stateId);
        const candidates = allCandidates
            .map(candidate => ({
                ...candidate,
                party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I")),
                visibleVotes: getPrimaryVisibleVotes(candidate, live, stateElectData)
            }))
            .filter(candidate => candidate.visibleVotes > 0);
        if(!candidates.length) return null;
        const sortedCandidates = candidates.slice().sort((a, b) => b.visibleVotes - a.visibleVotes);
        if(!isPrimaryGroupComplete(freshRace.allCands, live, stateElectData)) {
            return stringifyColour(getCandidateColourForRace(sortedCandidates[0], {
                cands: candidates,
                colourScope: `statewide-primary:${String(stateId || "").toLowerCase()}:N`
            }));
        }
        const advanceCount = getHousePrimaryAdvanceCount(freshRace, stateId);
        const advancingCandidates = sortedCandidates.slice(0, advanceCount);
        if(advancingCandidates.length < 2) {
            return stringifyColour(getCandidateColourForRace(advancingCandidates[0], {
                cands: candidates,
                colourScope: `statewide-primary:${String(stateId || "").toLowerCase()}:N`
            }));
        }
        const patternId = `bm-${electionType}-primary-candidates-${String(stateId).toLowerCase()}`;
        ensureCandidateColourPattern(svgMap, patternId, advancingCandidates, {
            cands: candidates,
            colourScope: `statewide-primary:${String(stateId || "").toLowerCase()}:N`
        });
        return `url(#${patternId})`;
    };
    const getHouseStateElectionData = stateId => {
        try {
            return (allStElectData || []).find(electData =>
                String(electData?.id || electData?.state || "").toLowerCase() === String(stateId || "").toLowerCase()
            );
        } catch {
            return null;
        }
    };
    const hasHouseStateStartedCounting = stateId => {
        const stateElectData = getHouseStateElectionData(stateId);
        const stateIndex = Number(stateElectData?.indx);
        if (Number.isFinite(stateIndex) && stateIndex > 0) return true;
        if (Array.isArray(stateElectData?.counties)) {
            return stateElectData.counties.some(countyData => {
                const countyIndex = Number(countyData?.indx);
                return Number.isFinite(countyIndex) && countyIndex > 0;
            });
        }
        return false;
    };
    const hasLiveStatewidePrimaryGroupStarted = (stateId, group) => {
        const candidates = Array.isArray(group?.cands) ? group.cands : [];
        if(!candidates.length) return false;
        const stateElectData = getHouseStateElectionData(stateId);
        if(stateElectData && !hasHouseStateStartedCounting(stateId)) return false;
        return candidates.some(candidate =>
            getPrimaryVisibleVotes(candidate, true, stateElectData) > 0
        ) || Number(group?.totalCurrVotes) > 0;
    };
    const hasLiveStatewidePrimaryRaceStarted = (stateId, race, selectedParty = null) => {
        if(!isStatewidePrimaryRace(race)) return false;
        const stateElectData = getHouseStateElectionData(stateId);
        if(stateElectData && !hasHouseStateStartedCounting(stateId)) return false;
        const party = normalizeHousePrimaryParty(selectedParty || "");
        if(party === "D") return hasLiveStatewidePrimaryGroupStarted(stateId, race?.dem);
        if(party === "R") return hasLiveStatewidePrimaryGroupStarted(stateId, race?.rep);
        if(party === "N") return hasLiveStatewidePrimaryGroupStarted(stateId, race?.allCands);
        return hasLiveStatewidePrimaryGroupStarted(stateId, race?.dem)
            || hasLiveStatewidePrimaryGroupStarted(stateId, race?.rep)
            || hasLiveStatewidePrimaryGroupStarted(stateId, race?.allCands);
    };
    const getHousePrimaryVisibleVotes = (candidate, stateElectData, live) => {
        const finalVotes = Number(candidate?.votes) || 0;
        if (!live) return finalVotes;
        const currentVotes = Number(candidate?.currentVotes);
        if (Number.isFinite(currentVotes) && currentVotes > 0) return currentVotes;
        const currentIndex = Number(stateElectData?.indx);
        const updates = Array.isArray(candidate?.updates) ? candidate.updates : [];
        if (updates.length && Number.isFinite(currentIndex) && currentIndex > 0) {
            const updateIndex = Math.min(Math.max(0, currentIndex), updates.length - 1);
            const progress = Number(updates[updateIndex]);
            if (Number.isFinite(progress) && progress > 0) return finalVotes * progress;
        }
        return 0;
    };
    const getHousePrimaryStateVoteWinner = (stateId, stateSummary, live) => {
        const districts = Array.isArray(stateSummary?.districts) ? stateSummary.districts : [];
        if (!districts.length || !districts.some(isHousePrimaryDistrict)) return null;
        const voteTotals = { D: 0, R: 0, I: 0, ID: 0, IR: 0 };
        const stateElectData = getHouseStateElectionData(stateId);
        const useLiveVisibleVotes = live === true;
        districts.forEach(district => {
            const districtSnapshot = getLiveHouseDistrictSnapshot(stateId, district, live);
            [
                { party: "D", candidates: districtSnapshot?.dem?.cands || [] },
                { party: "R", candidates: districtSnapshot?.rep?.cands || [] },
                { party: null, candidates: districtSnapshot?.allCands?.cands || [] }
            ].forEach(group => {
                group.candidates.forEach(candidate => {
                    const party = normalizeHousePrimaryParty(
                        group.party || getHousePrimaryCandidateParty(candidate, "I")
                    );
                    voteTotals[party] += useLiveVisibleVotes
                        ? getHousePrimaryVisibleVotes(candidate, stateElectData, true)
                        : (Number(candidate?.votes) || 0);
                });
            });
        });
        const sortedParties = Object.entries(voteTotals)
            .filter(([_party, votes]) => votes > 0)
            .sort((partyA, partyB) => partyB[1] - partyA[1]);
        if (!sortedParties.length) return null;
        const [winnerParty, winnerVotes] = sortedParties[0];
        const secondVotes = sortedParties[1]?.[1] || 0;
        const totalVotes = Object.values(voteTotals).reduce((total, votes) => total + votes, 0);
        const tied = sortedParties.length > 1 && sortedParties[0][1] === sortedParties[1][1];
        return {
            party: winnerParty,
            votes: winnerVotes,
            margin: totalVotes > 0 ? (winnerVotes - secondVotes) / totalVotes : 0,
            tied
        };
    };
    const getHouseGeneralStateVoteWinner = (stateId, stateSummary, live) => {
        stateSummary = getFreshHouseStateSummary(stateId, stateSummary, live);
        const districts = Array.isArray(stateSummary?.districts) ? stateSummary.districts : [];
        if (!districts.length || districts.some(isHousePrimaryDistrict)) return null;
        const voteTotals = { D: 0, R: 0, I: 0, ID: 0, IR: 0 };
        const stateElectData = getHouseStateElectionData(stateId);
        districts.forEach(district => {
            const districtSnapshot = getLiveHouseDistrictSnapshot(stateId, district, live);
            (districtSnapshot?.cands || []).forEach(candidate => {
                const party = normalizeHousePrimaryParty(candidate?.party || "I");
                const votes = live === true
                    ? getHousePrimaryVisibleVotes(candidate, stateElectData, true)
                    : (Number(candidate?.votes) || 0);
                voteTotals[party] += votes;
            });
        });
        const sortedParties = Object.entries(voteTotals)
            .filter(([_party, votes]) => votes > 0)
            .sort((partyA, partyB) => partyB[1] - partyA[1]);
        if (!sortedParties.length) return null;
        const [winnerParty, winnerVotes] = sortedParties[0];
        const secondVotes = sortedParties[1]?.[1] || 0;
        const totalVotes = Object.values(voteTotals).reduce((total, votes) => total + votes, 0);
        return {
            party: winnerParty,
            margin: totalVotes > 0 ? (winnerVotes - secondVotes) / totalVotes : 0,
            tied: sortedParties.length > 1 && sortedParties[0][1] === sortedParties[1][1]
        };
    };
    const getHouseStatePopularVoteColour = (stateId, stateSummary, live) => {
        const winner = getHouseGeneralStateVoteWinner(stateId, stateSummary, live);
        if (!winner) return null;
        if (winner.tied) return stringifyColour(config.partyColours.HouseTie);
        const normalizedParty = normalizeHousePrimaryParty(winner.party);
        const baseColour = normalizedParty === "ID"
            ? config.partyColours.I.D
            : (normalizedParty === "IR"
                ? config.partyColours.I.R
                : (normalizedParty === "I"
                    ? config.partyColours.I.default
                    : config.partyColours[normalizedParty]));
        if (!baseColour) return null;
        return stringifyColour(getElectionMarginColour(baseColour, winner.margin));
    };
    const isHousePrimaryState = stateSummary => {
        return Array.isArray(stateSummary?.districts)
            && stateSummary.districts.some(isHousePrimaryDistrict);
    };
    const getHousePrimaryStateColour = (stateId, stateSummary, live) => {
        const winner = getHousePrimaryStateVoteWinner(stateId, stateSummary, live);
        if (!winner) return null;
        if (winner.tied) return stringifyColour(config.partyColours.HouseTie);
        const normalizedParty = normalizeHousePrimaryParty(winner.party);
        const baseColour = normalizedParty === "ID"
            ? config.partyColours.I.D
            : (normalizedParty === "IR"
                ? config.partyColours.I.R
                : (normalizedParty === "I"
                    ? config.partyColours.I.default
                    : config.partyColours[normalizedParty]));
        if (!baseColour) return null;
        return stringifyColour(getElectionMarginColour(baseColour, winner.margin));
    };
    const hasVisibleHousePrimaryStateVotes = (stateId, stateSummary, live) => {
        return Boolean(getHousePrimaryStateVoteWinner(stateId, stateSummary, live));
    };
    const getHouseDistrictGridDistricts = (stateId, live = false) => {
        const districts = getHouseDistricts(stateId, live);
        return districts.length > 0 && districts.every(district =>
            Array.isArray(district?.cands) || isHousePrimaryDistrict(district)
        )
            ? districts
            : [];
    };
    const getHouseDistrictNumber = (district, index) => {
        const rawDistrict = district?.district
            ?? district?.districtNumber
            ?? district?.districtNum
            ?? district?.districtId
            ?? district?.districtID
            ?? district?.houseDistrict
            ?? district?.seat
            ?? district?.officeDistrict;
        const number = Number(rawDistrict);
        if (Number.isFinite(number) && number > 0) return number;
        const parsedNumber = Number(String(rawDistrict || "").match(/(\d{1,2})(?!.*\d)/)?.[1]);
        if (Number.isFinite(parsedNumber) && parsedNumber > 0) return parsedNumber;
        return index + 1;
    };
    const getHousePoliticiansForState = stateId => {
        const normalizedStateId = String(stateId || "").toLowerCase();
        const stateMembers = Executive?.data?.politicians?.usHouse?.[normalizedStateId];
        const members = Array.isArray(stateMembers) ? stateMembers.slice() : [];
        return members
            .map((member, index) => {
                const characterArray = Array.isArray(member)
                    ? member
                    : (member?.characterArray || member?.character || member?.candArray);
                let wrapped = member;
                if(Array.isArray(characterArray)) {
                    try {
                        wrapped = Executive?.data?.characters?.wrapCharacter(characterArray, "candidate") || member;
                    } catch {}
                }
                return {
                    source: member,
                    characterArray,
                    wrapped,
                    district: getHouseDistrictNumber(
                        member?.district !== undefined
                            || member?.districtNumber !== undefined
                            || member?.districtNum !== undefined
                            || member?.districtId !== undefined
                            || member?.districtID !== undefined
                            || member?.houseDistrict !== undefined
                            || member?.seat !== undefined
                            || member?.officeDistrict !== undefined
                            ? member
                            : wrapped,
                        index
                    )
                };
            })
            .sort((memberA, memberB) => getHouseDistrictNumber(memberA, 0) - getHouseDistrictNumber(memberB, 0));
    };
    const getHousePoliticianValue = politician => politician?.wrapped || politician?.source || politician;
    const getHousePoliticianParty = politician => {
        const value = getHousePoliticianValue(politician);
        const affiliation = String(
            value?.extendedAttribs?.party
            || value?.party
            || ""
        ).toLowerCase();
        const caucus = String(
            value?.caucusParty
            || value?.caucus
            || value?.extendedAttribs?.caucusParty
            || value?.extendedAttribs?.caucus
            || ""
        ).toLowerCase();
        if(affiliation.includes("ind") || affiliation === "i") {
            if(caucus.includes("dem") || caucus === "d") return "ID";
            if(caucus.includes("rep") || caucus === "r") return "IR";
            return "I";
        }
        if(affiliation.includes("dem") || affiliation === "d") return "D";
        if(affiliation.includes("rep") || affiliation === "r") return "R";
        if(caucus.includes("dem") || caucus === "d") return "D";
        if(caucus.includes("rep") || caucus === "r") return "R";
        return "I";
    };
    const getHousePoliticianPartyLabel = politician => {
        const party = getHousePoliticianParty(politician);
        if(party === "D") return "Democratic Party";
        if(party === "R") return "Republican Party";
        if(party === "ID") return "Independent (D)";
        if(party === "IR") return "Independent (R)";
        return "Independent";
    };
    const getHousePoliticianName = politician => {
        const value = getHousePoliticianValue(politician);
        const direct = String(
            value?.name
            || value?.fullName
            || value?.displayName
            || politician?.source?.name
            || politician?.source?.fullName
            || politician?.source?.displayName
            || ""
        ).trim();
        if(direct) return direct;
        const attributes = value?.extendedAttribs || {};
        const firstName = attributes.firstName
            || attributes.first
            || attributes.fName
            || value?.firstName
            || value?.first
            || "";
        const lastName = attributes.lastName
            || attributes.last
            || attributes.lName
            || value?.lastName
            || value?.last
            || "";
        const resolvedName = `${firstName} ${lastName}`.trim();
        if(resolvedName) return resolvedName;
        const characterArray = politician?.characterArray;
        if(Array.isArray(characterArray)) {
            const candidateEnum = Executive?.enums?.characterArray?.candidate || {};
            const arrayFirstName = characterArray[candidateEnum.first ?? candidateEnum.firstName ?? 4];
            const arrayLastName = characterArray[candidateEnum.last ?? candidateEnum.lastName ?? 5];
            const arrayName = `${arrayFirstName || ""} ${arrayLastName || ""}`.trim();
            if(arrayName) return arrayName;
        }
        return "Unknown Representative";
    };
    const getHousePoliticianFill = politician => {
        const value = getHousePoliticianValue(politician);
        try {
            return stringifyColour(getPoliticianColour(value));
        } catch {
            const party = getHousePoliticianParty(politician);
            if(party === "D" || party === "R") return stringifyColour(config.partyColours[party]);
            if(party === "ID") return stringifyColour(config.partyColours.I.D);
            if(party === "IR") return stringifyColour(config.partyColours.I.R);
            return stringifyColour(config.partyColours.I.default);
        }
    };
    let housePoliticianTooltip = null;
    const ensureHousePoliticianTooltip = () => {
        if(housePoliticianTooltip?.isConnected) return housePoliticianTooltip;
        housePoliticianTooltip = document.createElement("div");
        housePoliticianTooltip.id = "bm-house-politician-tooltip";
        document.body.appendChild(housePoliticianTooltip);
        return housePoliticianTooltip;
    };
    const hideHousePoliticianTooltip = () => {
        if(housePoliticianTooltip) {
            housePoliticianTooltip.style.display = "none";
            delete housePoliticianTooltip.dataset.districtKey;
        }
    };
    const positionHousePoliticianTooltip = event => {
        if(!housePoliticianTooltip || housePoliticianTooltip.style.display === "none") return;
        const rect = housePoliticianTooltip.getBoundingClientRect();
        const left = Math.min(event.clientX + 14, window.innerWidth - rect.width - 8);
        const top = Math.min(event.clientY + 14, window.innerHeight - rect.height - 8);
        housePoliticianTooltip.style.left = `${Math.max(8, left)}px`;
        housePoliticianTooltip.style.top = `${Math.max(8, top)}px`;
    };
    const showHousePoliticianTooltip = (event, stateId, districtNumber, politician) => {
        const tooltip = ensureHousePoliticianTooltip();
        const party = getHousePoliticianParty(politician);
        const partyLabel = getHousePoliticianPartyLabel(politician);
        const stateCode = String(stateId || "").toUpperCase();
        const stateName = String(Executive?.data?.states?.[String(stateId || "").toLowerCase()]?.name || stateCode);
        const name = getHousePoliticianName(politician);
        const partyColour = getHousePoliticianFill(politician);
        const districtKey = `${stateCode}-${districtNumber}-${name}`;
        if(tooltip.dataset.districtKey !== districtKey) {
            tooltip.dataset.districtKey = districtKey;
            tooltip.className = `party-${party}`;
            tooltip.style.setProperty("--bm-house-politician-party-color", partyColour);
            tooltip.innerHTML = `
                <div class="bm-house-politician-info">
                    <strong>Rep. ${escapeHtml(name)}</strong>
                    <span class="bm-house-politician-party" style="color: ${partyColour};">${escapeHtml(partyLabel)}</span>
                    <span class="bm-house-politician-district">${escapeHtml(stateName)} - District ${districtNumber}</span>
                </div>
            `;
        }
        tooltip.style.display = "flex";
        positionHousePoliticianTooltip(event);
    };
    const attachHousePoliticianDistrictEvents = (element, stateId, districtNumber, politician) => {
        element.addEventListener("mouseenter", event => showHousePoliticianTooltip(event, stateId, districtNumber, politician));
        element.addEventListener("mousemove", positionHousePoliticianTooltip);
        element.addEventListener("focus", event => {
            const rect = element.getBoundingClientRect();
            showHousePoliticianTooltip({
                clientX: rect.left + (rect.width / 2),
                clientY: rect.top + (rect.height / 2)
            }, stateId, districtNumber, politician);
        });
        element.addEventListener("mouseleave", hideHousePoliticianTooltip);
        element.addEventListener("blur", hideHousePoliticianTooltip);
    };
    const getMountedMapCanvas = (canvasElem, live) => {
        return document.getElementById(canvasElem?.id || "")
            || document.getElementById(live ? "electNightCanvas" : "electPageCanvas")
            || canvasElem;
    };
    const isUnprojectedHouseDistrictTooCloseToCall = (district) => {
        if(!district || district.pW === true || !Array.isArray(district?.cands) || district.cands.length < 2) return false;
        const totalExpectedVotes = Number(district.totalVotes)
            || district.cands.reduce((total, candidate) => total + (Number(candidate?.votes) || 0), 0);
        const totalCurrentVotes = Number(district.totalCurrVotes)
            || district.cands.reduce((total, candidate) => total + (Number(candidate?.currentVotes) || 0), 0);
        if(totalExpectedVotes <= 0 || totalCurrentVotes <= 0) return false;
        const reported = (totalCurrentVotes / totalExpectedVotes) * 100;
        if(reported < 65) return false;
        const sortedCandidates = district.cands.slice().sort((candidateA, candidateB) =>
            (Number(candidateB?.currentVotes) || 0) - (Number(candidateA?.currentVotes) || 0)
        );
        const topVotes = Number(sortedCandidates[0]?.currentVotes) || 0;
        const secondVotes = Number(sortedCandidates[1]?.currentVotes) || 0;
        if(topVotes <= 0 || secondVotes < 0) return false;
        const pctDiff = ((topVotes - secondVotes) / totalCurrentVotes) * 100;
        const start = 65, end = 95;
        const maxThr = 5.0, minThr = 1.5;
        const r = Math.max(0, Math.min(1, (reported - start) / (end - start)));
        const k = 1.8;
        const threshold = minThr + (maxThr - minThr) * (1 - Math.pow(r, k));
        return pctDiff <= threshold;
    };
    const getHouseDistrictFill = (stateId, district, live, gainPatternIds, districtNumber = null) => {
        district = getLiveHouseDistrictSnapshot(stateId, district, live);
        if (isHousePrimaryDistrict(district)) {
            const stateElectData = getHouseStateElectionData(stateId);
            const primaryCandidates = [
                ...(district.dem?.cands || []).map(candidate => ({ ...candidate, party: "D" })),
                ...(district.rep?.cands || []).map(candidate => ({ ...candidate, party: "R" })),
                ...(district.allCands?.cands || []).map(candidate => ({
                    ...candidate,
                    party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I"))
                }))
            ];
            if (!primaryCandidates.length) return "#b9b9b9";
            const candidatesWithVisibleVotes = primaryCandidates.map(candidate => {
                const candidateVisibleVotes = getHousePrimaryVisibleVotes(candidate, stateElectData, live);
                return {
                    ...candidate,
                    currentVotes: live === true ? candidateVisibleVotes : candidate?.currentVotes,
                    visibleVotes: candidateVisibleVotes
                };
            });
            const sortedCandidates = candidatesWithVisibleVotes.slice().sort(
                (candidateA, candidateB) => candidateB.visibleVotes - candidateA.visibleVotes
            );
            const winner = sortedCandidates[0];
            const visibleVotes = winner?.visibleVotes || 0;
            if (visibleVotes <= 0) return "#b9b9b9";
            const isNonpartisanPrimary = (district.dem?.cands || []).length === 0
                && (district.rep?.cands || []).length === 0
                && (district.allCands?.cands || []).length > 0;
            if (isNonpartisanPrimary) {
                const primaryComplete = isHousePrimaryGroupComplete(district.allCands, live, stateId);
                const advancingCandidates = primaryComplete
                    ? getHousePrimaryNonpartisanAdvancers(district, live, stateId)
                    : [];
                if (advancingCandidates.length > 1) {
                    return `url(#${getHousePrimaryCandidatePatternId(
                        stateId,
                        districtNumber || getHouseDistrictNumber(district, 0)
                    )})`;
                }
                return stringifyColour(getCandidateColourForRace(winner, {
                    cands: candidatesWithVisibleVotes,
                    colourScope: `house-primary:${String(stateId || "").toLowerCase()}:${districtNumber || getHouseDistrictNumber(district, 0)}:N`
                }));
            }
            const projectedGroups = getHousePrimaryProjectedGroups(district);
            if (live === true && !projectedGroups.length) return "#b9b9b9";
            const partisanGroupCount = [district.dem, district.rep]
                .filter(group => Array.isArray(group?.cands) && group.cands.length > 0)
                .length;
            if (live === true && partisanGroupCount > projectedGroups.length) return "url(#bm-house-primary-partial)";
            const partyVisibleVotes = {};
            candidatesWithVisibleVotes.forEach(candidate => {
                const party = normalizeHousePrimaryParty(candidate.party);
                if (!party) return;
                partyVisibleVotes[party] = (partyVisibleVotes[party] || 0)
                    + (Number(candidate.visibleVotes) || 0);
            });
            const rankedParties = Object.entries(partyVisibleVotes)
                .filter(([, partyVotes]) => partyVotes > 0)
                .sort((partyA, partyB) => partyB[1] - partyA[1]);
            if (rankedParties.length > 1 && rankedParties[0][1] === rankedParties[1][1]) {
                return stringifyColour(config.partyColours.HouseTie);
            }
            const winningParty = rankedParties[0]?.[0]
                || getCandidateVariantPartyKey(winner);
            return getHousePrimaryPartyColour(winningParty);
        }
        if (!Array.isArray(district?.cands) || district.cands.length === 0) return "#b9b9b9";
        if (!shouldRevealHouseDistrictResults(district, live)) return "#b9b9b9";
        if (live === true && houseDistrictGridMode === "projections" && district.pW !== true) {
            return isUnprojectedHouseDistrictTooCloseToCall(district) ? "#FFD60C" : "#b9b9b9";
        }
        const finalVoteTotal = district.cands.reduce(
            (total, candidate) => total + (Number(candidate?.votes) || 0),
            0
        );
        const currentVoteTotal = district.cands.reduce(
            (total, candidate) => total + (Number(candidate?.currentVotes) || 0),
            0
        );
        const useFinalVotes = (
            live !== true
            && (finalVoteTotal > 0 || currentVoteTotal <= 0)
        )
            || (live === true && houseDistrictGridMode === "projections" && district.pW === true)
            || (
                district.cands.every(candidate => (Number(candidate?.currentVotes) || 0) === 0)
                && district.pW === true
                && document.body?.innerText?.match(/\(\s*0:00\s*\)/)
            );
        const sortedCandidates = district.cands.slice().sort((candidateA, candidateB) => {
            const getVotes = candidate => Number(candidate?.[useFinalVotes ? "votes" : "currentVotes"]) || 0;
            return getVotes(candidateB) - getVotes(candidateA);
        });
        const winner = sortedCandidates[0];
        const flipData = getHouseDistrictFlipData(stateId, district, live);
        if (houseDistrictGridMode !== "margins" && flipData.flipped && gainPatternIds?.[flipData.winnerParty]) {
            return `url(#${gainPatternIds[flipData.winnerParty]})`;
        }
        const visibleVotes = Number(winner?.[useFinalVotes ? "votes" : "currentVotes"]) || 0;
        if (visibleVotes <= 0) return "#b9b9b9";
        if (houseDistrictGridMode !== "margins") return stringifyColour(getCandidateColourForRace(winner, district));
        const voteKey = useFinalVotes ? "votes" : "currentVotes";
        const secondVotes = Number(sortedCandidates[1]?.[voteKey]) || 0;
        const totalVotes = sortedCandidates.reduce(
            (total, candidate) => total + (Number(candidate?.[voteKey]) || 0),
            0
        );
        const margin = totalVotes > 0 ? Math.max(0, (visibleVotes - secondVotes) / totalVotes) : 0;
        const baseColour = getCandidateColourForRace(winner, district);
        return stringifyColour(getElectionMarginColour(baseColour, margin));
    };
    const getHouseDistrictGainPatternIds = (stateId, live) => {
        return ["D", "R", "ID", "IR", "I"].reduce((patternIds, party) => {
            patternIds[party] = `bm-house-district-${stateId}-${live ? "live" : "page"}-${party.toLowerCase()}-gain`;
            return patternIds;
        }, {});
    };
    const getHouseStateDistrictMapCandidates = (stateId) => {
        const rawStateId = String(stateId || "").trim();
        const normalizedStateId = rawStateId.toLowerCase();
        const stateName = String(Executive?.data?.states?.[normalizedStateId]?.name || "").trim();
        const matchingStateName = Object.keys(stateNameToCode).find(name => name.toLowerCase() === normalizedStateId);
        const stateCode = String(
            stateNameToCode[stateName]
            || stateNameToCode[matchingStateName]
            || (/^[a-z]{2}$/i.test(rawStateId) ? rawStateId : "")
        ).toLowerCase();
        const fileIds = [normalizedStateId, stateCode]
            .filter(Boolean)
            .filter((value, index, array) => array.indexOf(value) === index);
        return fileIds.map(fileId => Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep
            + "states-house" + path.sep + `${fileId}-house.svg`);
    };
    const getHouseDistrictSvgNumber = (element, fallbackNumber) => {
        const explicitValues = [
            element?.dataset?.district,
            element?.dataset?.districtNumber,
            element?.getAttribute?.("data-district"),
            element?.getAttribute?.("data-district-number"),
            element?.getAttribute?.("district")
        ].filter(Boolean);
        for (const value of explicitValues) {
            const number = Number(String(value).match(/\d{1,2}/)?.[0]);
            if (Number.isFinite(number) && number > 0) return number;
        }
        const labelValues = [
            element?.getAttribute?.("id"),
            element?.getAttribute?.("class")
        ].filter(Boolean);
        for (const value of labelValues) {
            const text = String(value).trim();
            const match = text.match(/^(?:[a-z]{2}|district|cd|dist)[-_\s]*(\d{1,2})$/i)
                || text.match(/(?:^|[-_\s])(?:district|cd|dist)[-_\s]*(\d{1,2})(?:$|[-_\s])/i)
                || text.match(/^[a-z][a-z .'-]+-(\d{1,2})$/i);
            if (match) {
                const number = Number(match[1]);
                if (Number.isFinite(number) && number > 0) return number;
            }
        }
        return fallbackNumber;
    };
    const getHouseDistrictSvgAncestorTransform = (pathElement, sourceSvg) => {
        const transforms = [];
        let parent = pathElement?.parentElement;
        while (parent && parent !== sourceSvg) {
            const transform = parent.getAttribute?.("transform");
            if (transform) transforms.unshift(transform);
            parent = parent.parentElement;
        }
        return transforms.join(" ");
    };
    const houseDistrictSvgShapeSelector = "path, polygon, rect, circle, ellipse";
    const getHouseDistrictSvgShapeElements = element => {
        if (!element) return [];
        if (element.matches?.(houseDistrictSvgShapeSelector)) return [element];
        return Array.from(element.querySelectorAll?.(houseDistrictSvgShapeSelector) || []);
    };
    const hasHouseDistrictSvgShapes = element => getHouseDistrictSvgShapeElements(element).length > 0;
    const isHouseDistrictSvgDescendantOf = (element, ancestors) => {
        let parent = element?.parentElement;
        while (parent) {
            if (ancestors.has(parent)) return true;
            parent = parent.parentElement;
        }
        return false;
    };
    const createHouseDistrictSvgCandidate = (elements, districtNumber, sourceSvg) => ({
        elements: elements.filter(Boolean).map(element => ({
            element,
            ancestorTransform: getHouseDistrictSvgAncestorTransform(element, sourceSvg)
        })),
        districtNumber
    });
    const getHouseDistrictSvgMappedElements = (sourceSvg, districtNumbers) => {
        const expectedNumbers = new Set(districtNumbers);
        const sourceElements = Array.from(sourceSvg.querySelectorAll(`${houseDistrictSvgShapeSelector}, g`))
            .filter(hasHouseDistrictSvgShapes);
        if (expectedNumbers.size !== districtNumbers.length) return null;
        const allNumberedElements = sourceElements
            .map(element => ({
                element,
                districtNumber: getHouseDistrictSvgNumber(element, null)
            }))
            .filter(item => Number.isFinite(item.districtNumber) && item.districtNumber > 0);
        const svgDistrictNumbers = new Set(allNumberedElements.map(item => item.districtNumber));
        if (svgDistrictNumbers.size > 0) {
            const exactDistrictMatch = svgDistrictNumbers.size === expectedNumbers.size
                && Array.from(svgDistrictNumbers).every(number => expectedNumbers.has(number));
            if (!exactDistrictMatch) return null;
        }
        const numberedElements = allNumberedElements
            .filter(item => expectedNumbers.has(item.districtNumber));
        const numberedElementSet = new Set(numberedElements.map(item => item.element));
        const groupedByNumber = new Map();
        numberedElements
            .filter(item => !isHouseDistrictSvgDescendantOf(item.element, numberedElementSet))
            .forEach(item => {
                if (!groupedByNumber.has(item.districtNumber)) groupedByNumber.set(item.districtNumber, []);
                groupedByNumber.get(item.districtNumber).push(item.element);
            });
        if (groupedByNumber.size === districtNumbers.length) {
            return districtNumbers.map(number =>
                createHouseDistrictSvgCandidate(groupedByNumber.get(number), number, sourceSvg)
            );
        }
        const paths = Array.from(sourceSvg.querySelectorAll(houseDistrictSvgShapeSelector));
        if (paths.length === districtNumbers.length) {
            return paths.map((pathElement, index) =>
                createHouseDistrictSvgCandidate([pathElement], districtNumbers[index], sourceSvg)
            );
        }
        return null;
    };
    const loadHouseStateDistrictSvg = (stateId, districts) => {
        const filePath = getHouseStateDistrictMapCandidates(stateId).find(candidatePath => fs.existsSync(candidatePath));
        if (!filePath) return null;
        let documentNode = null;
        try {
            documentNode = new DOMParser().parseFromString(fs.readFileSync(filePath, "utf8"), "image/svg+xml");
        } catch {
            return null;
        }
        const sourceSvg = documentNode?.documentElement;
        if (!sourceSvg || String(sourceSvg.tagName || "").toLowerCase() !== "svg") return null;
        const districtNumbers = districts
            .map((district, index) => getHouseDistrictNumber(district, index))
            .sort((a, b) => a - b);
        const mappedElements = getHouseDistrictSvgMappedElements(sourceSvg, districtNumbers);
        if (!mappedElements) {
            console.warn("House district SVG skipped; unable to match districts", {
                stateId,
                filePath,
                expectedDistricts: districtNumbers.length,
                shapeCount: sourceSvg.querySelectorAll(houseDistrictSvgShapeSelector).length
            });
            return null;
        }
        return {
            sourceSvg,
            mappedPaths: mappedElements,
            filePath
        };
    };
    const getHouseStateDistrictSvgBounds = sourceSvg => {
        if (typeof document === "undefined" || !document.body || !sourceSvg?.cloneNode) return null;
        if (sourceSvg.querySelector("[transform]")) return null;
        const clone = sourceSvg.cloneNode(true);
        clone.style.position = "absolute";
        clone.style.left = "-10000px";
        clone.style.top = "-10000px";
        clone.style.opacity = "0";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        Array.from(clone.querySelectorAll("path")).forEach(pathElement => {
            if (typeof pathElement.getBBox !== "function") return;
            try {
                const box = pathElement.getBBox();
                if (!box || box.width <= 0 || box.height <= 0) return;
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
            } catch {}
        });
        clone.remove();
        if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) return null;
        const padding = Math.max(4, Math.min(maxX - minX, maxY - minY) * 0.015);
        return {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };
    };
    const refreshHouseDistrictGridFills = (forceDataRefresh = false) => {
        const overlay = document.getElementById("bm-house-district-grid");
        if (!overlay || !houseDistrictGridState) return;
        const now = Date.now();
        if (!forceDataRefresh && now - lastHouseDistrictGridFillRefresh < 250) return;
        lastHouseDistrictGridFillRefresh = now;
        const stateId = String(houseDistrictGridState).toLowerCase();
        const live = overlay.dataset.live === "true";
        const gainPatternIds = getHouseDistrictGainPatternIds(stateId, live);
        const districtsByNumber = new Map(
            getHouseDistrictGridDistricts(stateId, live).map((district, index) => [
                getHouseDistrictNumber(district, index),
                district
            ])
        );
        const defs = overlay.querySelector("defs");
        if(defs) {
            createHousePrimaryCandidatePatterns(
                defs,
                stateId,
                Array.from(districtsByNumber.values()),
                live
            );
        }
        overlay.querySelectorAll(".bm-house-district-hex").forEach(hex => {
            const districtNumber = Number(hex.dataset.districtNumber);
            const district = districtsByNumber.get(districtNumber);
            const shapes = hex.querySelectorAll(".bm-house-district-hex-shape, .bm-house-state-district-shape");
            if (!district || shapes.length === 0) return;
            const fill = getHouseDistrictFill(stateId, district, live, gainPatternIds, districtNumber);
            shapes.forEach(shape => shape.setAttribute("fill", fill));
        });
    };
    const refreshActiveHouseDistrictTooltip = () => {
        const overlay = document.getElementById("bm-house-district-grid");
        if (!overlay || !houseDistrictGridState || !houseDistrictTooltipTarget) return;
        if (tooltipComponents.properties.visible === false) return;
        if (tooltipComponents.properties.electionType !== "usHouseDistrict") return;
        const live = overlay.dataset.live === "true";
        refreshHouseDistrictGridFills(true);
        updateHouseDistrictTooltip(houseDistrictGridState, houseDistrictTooltipTarget, true, live);
    };
    const attachHouseDistrictGridEvents = (element, stateId, districtNumber, district, live) => {
        const districtKey = `${stateId}-${districtNumber}`;
        const showDistrictTooltip = (event, force = false) => {
            if (houseDistrictGridDragging) return;
            tooltipComponents.properties.visible = true;
            tooltipComponents.properties.targetDistrict = districtKey;
            houseDistrictTooltipTarget = district;
            updateHouseDistrictTooltip(stateId, district, force, live);
            if(event) positionMapTooltip(event);
        };
        element.addEventListener("mouseenter", event => {
            showDistrictTooltip(event, true);
        });
        element.addEventListener("mousemove", event => {
            if (
                tooltipComponents.properties.targetDistrict !== districtKey
                || tooltipComponents.properties.electionType !== "usHouseDistrict"
                || tooltipComponents.properties.visible === false
            ) {
                showDistrictTooltip(event, true);
                return;
            }
            positionMapTooltip(event);
        });
        element.addEventListener("focus", event => {
            showDistrictTooltip(event, true);
        });
        element.addEventListener("mouseleave", hideMapTooltip);
    };
    const setMapModeControlsVisible = visible => {
        ["eNightProjectB", "eNightMarginB", "eNightShiftB", "eNightTurnoutB", "bm-turnout-mode-controls", "ePageProjectB", "ePageMarginB"].forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (!button) return;
            if (visible) button.style.removeProperty("display");
            else button.style.setProperty("display", "none", "important");
        });
    };
    const syncStatewideTurnoutControls = (svgMap, electionType, live, options = {}) => {
        const onClickPageFunc = options?.onClickPageFunc || null;
        const supportedElection = ["president", "usSenate", "governor"].includes(electionType);
        if(!live || isPrimaryElectionNightPage() || !supportedElection) {
            if(statewideTurnoutMapMode === electionType) statewideTurnoutMapMode = null;
            removeStatewideTurnoutControls();
            return;
        }
        const availabilityKey = getStatewideTurnoutAvailabilityKey(electionType);
        const allRacesReported = areAllStatewideRacesFullyReported(electionType);
        if(allRacesReported) {
            statewideTurnoutAvailableElections.add(availabilityKey);
        } else {
            statewideTurnoutAvailableElections.delete(availabilityKey);
        }
        if(!statewideTurnoutAvailableElections.has(availabilityKey)) {
            if(statewideTurnoutMapMode === electionType) statewideTurnoutMapMode = null;
            if(statewideShiftMapMode === electionType) statewideShiftMapMode = null;
            removeStatewideTurnoutControls();
            return;
        }
        if(onCountyMap && isStatewideTurnoutModeSelected(electionType)) {
            resetStatewideTurnoutMapSelection();
        }
        if(onCountyMap) {
            removeStatewideTurnoutControls();
            return;
        }
        const marginButton = document.getElementById("eNightMarginB");
        const projectButton = document.getElementById("eNightProjectB");
        if(!marginButton?.parentElement) return;
        let shiftButton = document.getElementById("eNightShiftB");
        if(!shiftButton) {
            shiftButton = document.createElement("button");
            shiftButton.id = "eNightShiftB";
            shiftButton.type = "button";
            shiftButton.className = "eNightMarginB";
        }
        const comparisonYear = getStatewideShiftComparisonYear(electionType);
        shiftButton.textContent = `Shift vs ${comparisonYear || "previous"}`;
        let turnoutButton = document.getElementById("eNightTurnoutB");
        if(!turnoutButton) {
            turnoutButton = document.createElement("button");
            turnoutButton.id = "eNightTurnoutB";
            turnoutButton.type = "button";
            turnoutButton.textContent = "Turnout";
            turnoutButton.className = "eNightMarginB";
        }
        marginButton.insertAdjacentElement("afterend", shiftButton);
        shiftButton.insertAdjacentElement("afterend", turnoutButton);
        const positionComparisonButtons = () => {
            if(!marginButton.isConnected || !shiftButton.isConnected || !turnoutButton.isConnected) return;
            const gap = 7;
            shiftButton.style.setProperty("--bm-shift-height", `${marginButton.offsetHeight}px`);
            const shiftLeft = marginButton.offsetLeft + marginButton.offsetWidth + gap;
            shiftButton.style.setProperty("--bm-shift-left", `${shiftLeft}px`);
            const turnoutLeft = shiftLeft + shiftButton.offsetWidth + gap;
            turnoutButton.style.setProperty("--bm-turnout-left", `${turnoutLeft}px`);
        };
        requestAnimationFrame(positionComparisonButtons);
        setTimeout(positionComparisonButtons, 0);
        const mapHost = svgMap?.parentElement;
        if(mapHost) mapHost.classList.add("bm-turnout-map-host");
        let modeControls = document.getElementById("bm-turnout-mode-controls");
        if(!modeControls) {
            modeControls = document.createElement("div");
            modeControls.id = "bm-turnout-mode-controls";
            modeControls.innerHTML = `
                <button type="button" class="bm-turnout-submode-button" data-turnout-view="current">Current election</button>
                <button type="button" class="bm-turnout-submode-button" data-turnout-view="comparison">Previous election</button>
            `;
        }
        if(mapHost && modeControls.parentElement !== mapHost) mapHost.appendChild(modeControls);
        installStatewideTurnoutMapController(svgMap, electionType);
        const refreshControls = () => {
            const active = isStatewideTurnoutModeSelected(electionType);
            const shiftActive = isStatewideShiftModeSelected(electionType);
            document.body?.classList.toggle("bm-turnout-mode-active", active);
            document.body?.classList.toggle("bm-shift-mode-active", shiftActive);
            if(active || shiftActive) {
                resetNativeElectionNightMapModeButtons({ suppressProjectObserver: true });
                hideNativeMapTooltipForTurnout();
            }
            setClassNameIfChanged(turnoutButton, active ? "eNightMarginBActive" : "eNightMarginB");
            setClassNameIfChanged(shiftButton, shiftActive ? "eNightMarginBActive" : "eNightMarginB");
            modeControls.classList.toggle("active", active);
            modeControls.querySelectorAll("[data-turnout-view]").forEach(button => {
                const selected = button.dataset.turnoutView === statewideTurnoutMapView;
                button.classList.toggle("bm-turnout-submode-active", selected);
            });
        };
        const deactivateNativeMapButtons = () => {
            resetNativeElectionNightMapModeButtons({ suppressProjectObserver: true });
        };
        const renderSelectedTurnoutView = (view, reason) => {
            renderStatewideTurnoutNationalMap({
                svgMap,
                electionType,
                live,
                view,
                reason,
                refreshControls,
                deactivateNativeMapButtons,
                onClickPageFunc
            });
        };
        const runTurnoutAction = (event, action) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            playClick();
            action();
        };
        turnoutButton.onmousedown = null;
        turnoutButton.onclick = event => {
            runTurnoutAction(event, () => {
                resetStatewideShiftMode();
                renderSelectedTurnoutView("current", "turnout-button-click");
            });
        };
        shiftButton.onmousedown = null;
        shiftButton.onclick = event => {
            runTurnoutAction(event, () => {
                resetStatewideTurnoutMode();
                statewideShiftMapMode = electionType;
                statewideShiftComparisonYear = comparisonYear;
                resetStatewideTurnoutMapSelection();
                resetNativeElectionNightMapModeButtons({ suppressProjectObserver: true });
                updateStatewideShiftMap(svgMap, electionType, live);
                refreshControls();
            });
        };
        modeControls.querySelectorAll("[data-turnout-view]").forEach(button => {
            button.onmousedown = null;
            button.onclick = event => {
                runTurnoutAction(event, () => renderSelectedTurnoutView(button.dataset.turnoutView, `submode-${button.dataset.turnoutView}-click`));
            };
        });
        [projectButton, marginButton].forEach(nativeButton => {
            if(!nativeButton || nativeButton.dataset.bmTurnoutResetBound === "true") return;
            nativeButton.dataset.bmTurnoutResetBound = "true";
            nativeButton.addEventListener("click", () => {
                const wasTurnoutActive = isStatewideTurnoutModeSelected(electionType);
                const wasShiftActive = isStatewideShiftModeSelected(electionType);
                resetStatewideTurnoutMode();
                resetStatewideShiftMode();
                refreshControls();
                if(!wasTurnoutActive && !wasShiftActive) return;
                suppressElectionNightProjectObserverUntil = Date.now() + 160;
                setTimeout(() => {
                    const activeSvgMap = document.getElementById(`${electionType}-map-live`) || svgMap;
                    const canvas = document.getElementById("electNightCanvas");
                    if(!activeSvgMap?.isConnected || !canvas?.isConnected) return;
                    let colours = {};
                    try {
                        colours = JSON.parse(activeSvgMap.getAttribute("data-colours") || "{}");
                    } catch {}
                    newElectNightMap(canvas, colours, 0, electionType);
                }, 0);
            });
        });
        refreshControls();
    };
    const keepMapModeControlsHidden = shouldRemainHidden => {
        setMapModeControlsVisible(false);
        [0, 50].forEach(delay => {
            setTimeout(() => {
                if (shouldRemainHidden()) setMapModeControlsVisible(false);
            }, delay);
        });
    };
    const hideHouseControlBanner = () => {
        const banner = document.getElementById("bm-house-banner");
        if (!banner) return;
        banner.classList.remove("show", "house-control-r", "house-control-d", "house-control-t");
        banner.innerHTML = "";
    };
    const removeHouseDistrictGrid = () => {
        hideHousePoliticianTooltip();
        const overlay = document.getElementById("bm-house-district-grid");
        if (overlay) {
            const host = overlay.parentElement;
            overlay.remove();
            if (host) {
                host.classList.remove("bm-house-district-grid-host");
                host.style.removeProperty("width");
                host.style.removeProperty("height");
            }
        }
        const returnButton = document.getElementById("bm-house-district-return");
        if (returnButton) returnButton.remove();
        const gridControls = document.getElementById("bm-house-district-controls");
        if (gridControls) gridControls.remove();
        const zoomControls = document.getElementById("bm-house-district-zoom-controls");
        if (zoomControls) zoomControls.remove();
        document.querySelectorAll(".better-maps-container.bm-house-national-map-hidden").forEach(hiddenMap => {
            hiddenMap.classList.remove("bm-house-national-map-hidden");
            hiddenMap.style.removeProperty("display");
        });
        setMapModeControlsVisible(true);
    };
    const renderHouseDistrictGrid = (svgMap, canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        const politicianMode = electionType === "usHousePol";
        const activeGridState = politicianMode ? housePoliticianDistrictGridState : houseDistrictGridState;
        if ((electionType !== "usHouse" && !politicianMode) || !activeGridState) return;
        const stateId = String(activeGridState).toLowerCase();
        const mountedSvgMap = document.getElementById(electionType + "-map" + (live ? "-live" : "")) || svgMap;
        const mountedCanvasElem = getMountedMapCanvas(canvasElem, live);
        const districts = politicianMode
            ? getHousePoliticiansForState(stateId)
            : getHouseDistrictGridDistricts(stateId, live);
        const isPrimaryDistrictGrid = !politicianMode && districts.some(isHousePrimaryDistrict);
        const existingOverlay = document.getElementById("bm-house-district-grid");
        if (
            existingOverlay?.isConnected
            && existingOverlay.dataset.stateId === stateId
            && existingOverlay.dataset.live === String(live)
            && existingOverlay.dataset.politicianMode === String(politicianMode)
        ) {
            const mapWidth = Number(mountedSvgMap?.getAttribute("width")) || 620;
            const mapHeight = Number(mountedSvgMap?.getAttribute("height")) || 560;
            const host = existingOverlay.parentElement || mountedSvgMap?.parentElement;
            if(host) {
                host.classList.add("bm-house-district-grid-host");
                host.style.width = `${mapWidth}px`;
                host.style.height = `${mapHeight}px`;
            }
            if(mountedSvgMap?.isConnected) {
                mountedSvgMap.classList.add("bm-house-national-map-hidden");
                mountedSvgMap.style.display = "none";
            }
            if(!politicianMode) refreshHouseDistrictGridFills(true);
            keepMapModeControlsHidden(() => Boolean(
                politicianMode ? housePoliticianDistrictGridState : houseDistrictGridState
            ));
            if(document.getElementById("bm-house-district-return")
                && document.getElementById("bm-house-district-zoom-controls")
                && (politicianMode
                    || document.getElementById("bm-house-district-controls")
                    || districts.some(isHousePrimaryDistrict))) {
                return;
            }
        }
        removeHouseDistrictGrid();
        if (houseDistrictGridZoomState !== stateId) {
            houseDistrictGridZoom = 1;
            houseDistrictGridPanX = 0;
            houseDistrictGridPanY = 0;
            houseDistrictGridZoomState = stateId;
        }
        if (
            districts.length === 0
            || (!politicianMode && districts.length <= 1)
            || !mountedSvgMap?.isConnected
            || !mountedSvgMap.parentElement
        ) {
            if(politicianMode) housePoliticianDistrictGridState = null;
            else houseDistrictGridState = null;
            return;
        }
        const districtsByNumber = new Map(
            districts.map((district, index) => [getHouseDistrictNumber(district, index), district])
        );
        const host = mountedSvgMap.parentElement;
        const mapWidth = Number(mountedSvgMap.getAttribute("width")) || 620;
        const mapHeight = Number(mountedSvgMap.getAttribute("height")) || 560;
        host.classList.add("bm-house-district-grid-host");
        host.style.width = `${mapWidth}px`;
        host.style.height = `${mapHeight}px`;
        mountedSvgMap.classList.add("bm-house-national-map-hidden");
        mountedSvgMap.style.display = "none";
        const overlay = document.createElement("div");
        overlay.id = "bm-house-district-grid";
        overlay.className = "bm-house-district-grid";
        overlay.dataset.stateId = stateId;
        overlay.dataset.live = String(live);
        overlay.dataset.politicianMode = String(politicianMode);
        const svgNamespace = "http://www.w3.org/2000/svg";
        const stageViewport = document.createElement("div");
        stageViewport.classList.add("bm-house-district-grid-viewport");
        const stage = document.createElementNS(svgNamespace, "svg");
        stage.classList.add("bm-house-district-grid-stage");
        stageViewport.appendChild(stage);
        overlay.appendChild(stageViewport);
        const clampHouseDistrictPan = () => {
            const zoom = Math.max(1, Math.min(7, houseDistrictGridZoom));
            if (zoom <= 1) {
                houseDistrictGridPanX = 0;
                houseDistrictGridPanY = 0;
                return;
            }
            const baseWidth = parseFloat(stage.style.width) || stage.clientWidth || 1;
            const baseHeight = parseFloat(stage.style.height) || stage.clientHeight || 1;
            const viewportWidth = stageViewport.clientWidth || availableGridWidth || baseWidth;
            const viewportHeight = stageViewport.clientHeight || availableGridHeight || baseHeight;
            const maxPanX = Math.max(0, ((baseWidth * zoom) - viewportWidth) / 2);
            const maxPanY = Math.max(0, ((baseHeight * zoom) - viewportHeight) / 2);
            houseDistrictGridPanX = Math.max(-maxPanX, Math.min(maxPanX, houseDistrictGridPanX));
            houseDistrictGridPanY = Math.max(-maxPanY, Math.min(maxPanY, houseDistrictGridPanY));
        };
        const applyHouseDistrictZoom = () => {
            const zoom = Math.max(1, Math.min(7, houseDistrictGridZoom));
            houseDistrictGridZoom = zoom;
            clampHouseDistrictPan();
            stage.style.transform = `translate(${houseDistrictGridPanX}px, ${houseDistrictGridPanY}px) scale(${zoom})`;
            stage.style.transformOrigin = "center center";
            stage.style.setProperty("--bm-house-district-stroke-width", `${Math.max(0.35, 1.25 / zoom)}px`);
            stage.style.setProperty("--bm-house-district-hover-stroke-width", `${Math.max(0.45, 1.6 / zoom)}px`);
            stageViewport.classList.toggle("is-zoomed", zoom > 1);
            const zoomControls = document.getElementById("bm-house-district-zoom-controls");
            if (zoomControls) {
                const minusButton = zoomControls.querySelector("[data-action='minus']");
                const resetButton = zoomControls.querySelector("[data-action='reset']");
                if (minusButton) minusButton.disabled = zoom <= 1;
                if (resetButton) resetButton.disabled = zoom <= 1;
            }
        };
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartPanX = 0;
        let dragStartPanY = 0;
        const finishHouseDistrictDrag = () => {
            houseDistrictGridDragging = false;
            stageViewport.classList.remove("is-dragging");
            activeHouseDistrictDragCleanup?.();
            activeHouseDistrictDragCleanup = null;
        };
        const moveHouseDistrictDrag = event => {
            if (!houseDistrictGridDragging) return;
            houseDistrictGridPanX = dragStartPanX + (event.clientX - dragStartX);
            houseDistrictGridPanY = dragStartPanY + (event.clientY - dragStartY);
            applyHouseDistrictZoom();
        };
        stageViewport.addEventListener("mousedown", event => {
            if (houseDistrictGridZoom <= 1 || event.button !== 0) return;
            event.preventDefault();
            hideMapTooltip();
            houseDistrictGridDragging = true;
            stageViewport.classList.add("is-dragging");
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            dragStartPanX = houseDistrictGridPanX;
            dragStartPanY = houseDistrictGridPanY;
            document.addEventListener("mousemove", moveHouseDistrictDrag);
            document.addEventListener("mouseup", finishHouseDistrictDrag);
            activeHouseDistrictDragCleanup = () => {
                document.removeEventListener("mousemove", moveHouseDistrictDrag);
                document.removeEventListener("mouseup", finishHouseDistrictDrag);
                stageViewport.classList.remove("is-dragging");
                houseDistrictGridDragging = false;
            };
        });
        const gridTopSpace = 86;
        const gridBottomSpace = 12;
        const gridSideSpace = 36;
        const availableGridWidth = Math.max(140, mapWidth - gridSideSpace);
        const availableGridHeight = Math.max(140, mapHeight - gridTopSpace - gridBottomSpace);
        overlay.style.setProperty("--bm-house-district-grid-top-space", `${gridTopSpace}px`);
        const columns = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(districts.length * 1.5))));
        const hexWidth = 58;
        const hexHeight = 66;
        const rowStep = hexHeight * 0.75;
        const strokeInset = 1;
        const rows = Math.ceil(districts.length / columns);
        const gridWidth = (columns * hexWidth) + (hexWidth / 2) + (strokeInset * 2);
        const gridHeight = hexHeight + ((rows - 1) * rowStep) + (strokeInset * 2);
        const gridScale = Math.min(1, availableGridWidth / gridWidth, availableGridHeight / gridHeight);
        stage.setAttribute("width", String(gridWidth));
        stage.setAttribute("height", String(gridHeight));
        stage.setAttribute("viewBox", `0 0 ${gridWidth} ${gridHeight}`);
        stage.setAttribute("aria-label", "House districts");
        stage.style.width = `${gridWidth * gridScale}px`;
        stage.style.height = `${gridHeight * gridScale}px`;
        applyHouseDistrictZoom();
        const defs = document.createElementNS(svgNamespace, "defs");
        const gainPatternIds = politicianMode ? {} : getHouseDistrictGainPatternIds(stateId, live);
        if(!politicianMode) {
            ["D", "R", "ID", "IR", "I"].forEach(party => {
                const pattern = createGainPattern(party);
                const patternId = gainPatternIds[party];
                pattern.setAttribute("id", patternId);
                defs.appendChild(pattern);
            });
        }
        if (isPrimaryDistrictGrid) {
            createHousePrimaryPatterns(defs);
            createHousePrimaryCandidatePatterns(defs, stateId, districts, live);
        }
        stage.appendChild(defs);
        const stateDistrictSvg = loadHouseStateDistrictSvg(stateId, districts);
        if (stateDistrictSvg) {
            const sourceSvg = stateDistrictSvg.sourceSvg;
            const sourceBounds = getHouseStateDistrictSvgBounds(sourceSvg);
            const sourceWidth = Number(sourceBounds?.width) || Number(sourceSvg.getAttribute("width")) || 800;
            const sourceHeight = Number(sourceBounds?.height) || Number(sourceSvg.getAttribute("height")) || 500;
            const sourceViewBox = sourceBounds
                ? `${sourceBounds.x} ${sourceBounds.y} ${sourceBounds.width} ${sourceBounds.height}`
                : (sourceSvg.getAttribute("viewBox") || `0 0 ${sourceWidth} ${sourceHeight}`);
            const mapScale = Math.min(1, availableGridWidth / sourceWidth, availableGridHeight / sourceHeight);
            overlay.classList.add("bm-house-state-district-map");
            stage.setAttribute("width", String(sourceWidth));
            stage.setAttribute("height", String(sourceHeight));
            stage.setAttribute("viewBox", sourceViewBox);
            stage.setAttribute("preserveAspectRatio", "xMidYMid meet");
            stage.setAttribute("aria-label", `${stateId.toUpperCase()} House districts`);
            stage.style.width = `${sourceWidth * mapScale}px`;
            stage.style.height = `${sourceHeight * mapScale}px`;
            applyHouseDistrictZoom();
            stageViewport.addEventListener("wheel", event => {
                if (event.deltaY === 0) return;
                event.preventDefault();
                event.stopPropagation();

                const previousZoom = houseDistrictGridZoom;
                const direction = event.deltaY < 0 ? 1 : -1;
                const nextZoom = Math.max(1, Math.min(7, previousZoom + (direction * 0.5)));
                if (nextZoom === previousZoom) return;

                const viewportBounds = stageViewport.getBoundingClientRect();
                const cursorOffsetX = event.clientX - (viewportBounds.left + (viewportBounds.width / 2));
                const cursorOffsetY = event.clientY - (viewportBounds.top + (viewportBounds.height / 2));
                const zoomRatio = nextZoom / previousZoom;

                houseDistrictGridPanX = cursorOffsetX
                    - (zoomRatio * (cursorOffsetX - houseDistrictGridPanX));
                houseDistrictGridPanY = cursorOffsetY
                    - (zoomRatio * (cursorOffsetY - houseDistrictGridPanY));
                houseDistrictGridZoom = nextZoom;
                applyHouseDistrictZoom();
            }, { passive: false });
            stateDistrictSvg.mappedPaths
                .slice()
                .sort((pathA, pathB) => pathA.districtNumber - pathB.districtNumber)
                .forEach(pathData => {
                    const district = districtsByNumber.get(pathData.districtNumber);
                    if (!district) return;
                    const districtGroup = document.createElementNS(svgNamespace, "g");
                    districtGroup.classList.add("bm-house-district-hex", "bm-house-state-district");
                    districtGroup.setAttribute("tabindex", "0");
                    districtGroup.setAttribute("role", "button");
                    districtGroup.setAttribute("aria-label", `District ${pathData.districtNumber}`);
                    districtGroup.dataset.districtNumber = String(pathData.districtNumber);
                    pathData.elements.forEach(elementData => {
                        const elementWrapper = document.createElementNS(svgNamespace, "g");
                        const districtElement = elementData.element.cloneNode(true);
                        if (elementData.ancestorTransform) {
                            elementWrapper.setAttribute("transform", elementData.ancestorTransform);
                        }
                        getHouseDistrictSvgShapeElements(districtElement).forEach(shape => {
                            shape.classList.add("bm-house-state-district-shape");
                            shape.removeAttribute("style");
                            shape.removeAttribute("fill");
                            shape.removeAttribute("opacity");
                            shape.setAttribute("fill", politicianMode
                                ? getHousePoliticianFill(district)
                                : getHouseDistrictFill(
                                    stateId,
                                    district,
                                    live,
                                    gainPatternIds,
                                    pathData.districtNumber
                                ));
                        });
                        elementWrapper.appendChild(districtElement);
                        districtGroup.appendChild(elementWrapper);
                    });
                    if(politicianMode) {
                        attachHousePoliticianDistrictEvents(
                            districtGroup,
                            stateId,
                            pathData.districtNumber,
                            district
                        );
                    } else {
                        attachHouseDistrictGridEvents(districtGroup, stateId, pathData.districtNumber, district, live);
                    }
                    stage.appendChild(districtGroup);
                });
        } else {
            districts
            .slice()
            .sort((districtA, districtB) => getHouseDistrictNumber(districtA, 0) - getHouseDistrictNumber(districtB, 0))
            .forEach((district, index) => {
                const districtNumber = getHouseDistrictNumber(district, index);
                const row = Math.floor(index / columns);
                const column = index % columns;
                const xPosition = strokeInset + (column * hexWidth) + ((row % 2) * (hexWidth / 2));
                const yPosition = strokeInset + (row * rowStep);
                const points = [
                    `${xPosition + (hexWidth / 2)},${yPosition}`,
                    `${xPosition + hexWidth},${yPosition + (hexHeight / 4)}`,
                    `${xPosition + hexWidth},${yPosition + ((hexHeight * 3) / 4)}`,
                    `${xPosition + (hexWidth / 2)},${yPosition + hexHeight}`,
                    `${xPosition},${yPosition + ((hexHeight * 3) / 4)}`,
                    `${xPosition},${yPosition + (hexHeight / 4)}`
                ].join(" ");
                const hex = document.createElementNS(svgNamespace, "g");
                const polygon = document.createElementNS(svgNamespace, "polygon");
                const label = document.createElementNS(svgNamespace, "text");
                hex.classList.add("bm-house-district-hex");
                hex.setAttribute("tabindex", "0");
                hex.setAttribute("role", "button");
                hex.setAttribute("aria-label", `District ${districtNumber}`);
                hex.dataset.districtNumber = String(districtNumber);
                polygon.classList.add("bm-house-district-hex-shape");
                polygon.setAttribute("points", points);
                polygon.setAttribute("fill", politicianMode
                    ? getHousePoliticianFill(district)
                    : getHouseDistrictFill(stateId, district, live, gainPatternIds, districtNumber));
                label.classList.add("bm-house-district-hex-label");
                label.setAttribute("x", String(xPosition + (hexWidth / 2)));
                label.setAttribute("y", String(yPosition + (hexHeight / 2)));
                label.textContent = String(districtNumber);
                hex.appendChild(polygon);
                hex.appendChild(label);
                if(politicianMode) {
                    attachHousePoliticianDistrictEvents(hex, stateId, districtNumber, district);
                } else {
                    attachHouseDistrictGridEvents(hex, stateId, districtNumber, district, live);
                }
                stage.appendChild(hex);
            });
        }
        host.appendChild(overlay);
        if(!politicianMode) hideHouseControlBanner();
        const returnButton = document.createElement("button");
        returnButton.id = "bm-house-district-return";
        returnButton.textContent = "Return to U.S. House";
        returnButton.onclick = () => {
            playClick();
            if(politicianMode) housePoliticianDistrictGridState = null;
            else houseDistrictGridState = null;
            houseDistrictGridZoom = 1;
            houseDistrictGridZoomState = null;
            houseDistrictGridPanX = 0;
            houseDistrictGridPanY = 0;
            activeMap = "US";
            hideMapTooltip();
            hideHousePoliticianTooltip();
            removeHouseDistrictGrid();
            onClickPageFunc();
            setTimeout(() => {
                const currentCanvasElem = getMountedMapCanvas(mountedCanvasElem, live);
                if (currentCanvasElem?.isConnected) {
                    renderMap(currentCanvasElem, resultColours, electionType, live, onClickPageFunc, projected);
                }
            }, 0);
        };
        host.appendChild(returnButton);
        if (!politicianMode && !isPrimaryDistrictGrid) {
            const gridControls = document.createElement("div");
            gridControls.id = "bm-house-district-controls";
            const projectionButton = document.createElement("button");
            const marginButton = document.createElement("button");
            projectionButton.textContent = "Projections";
            marginButton.textContent = "Margins";
            projectionButton.className = "bm-house-district-mode-button";
            marginButton.className = "bm-house-district-mode-button";
            const updateGridModeButtons = () => {
                projectionButton.classList.toggle("active", houseDistrictGridMode === "projections");
                marginButton.classList.toggle("active", houseDistrictGridMode === "margins");
            };
            projectionButton.onclick = () => {
                playClick();
                houseDistrictGridMode = "projections";
                updateGridModeButtons();
                refreshHouseDistrictGridFills(true);
            };
            marginButton.onclick = () => {
                playClick();
                houseDistrictGridMode = "margins";
                updateGridModeButtons();
                refreshHouseDistrictGridFills(true);
            };
            gridControls.appendChild(projectionButton);
            gridControls.appendChild(marginButton);
            host.appendChild(gridControls);
            updateGridModeButtons();
        }
        const zoomControls = document.createElement("div");
        zoomControls.id = "bm-house-district-zoom-controls";
        const makeZoomButton = (label, action, title) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "bm-house-district-zoom-button";
            button.textContent = label;
            button.title = title;
            button.dataset.action = action;
            button.onclick = () => {
                playClick();
                if (action === "plus") houseDistrictGridZoom += 0.5;
                else if (action === "minus") houseDistrictGridZoom -= 0.5;
                else {
                    houseDistrictGridZoom = 1;
                    houseDistrictGridPanX = 0;
                    houseDistrictGridPanY = 0;
                }
                applyHouseDistrictZoom();
            };
            return button;
        };
        zoomControls.appendChild(makeZoomButton("+", "plus", "Zoom in"));
        zoomControls.appendChild(makeZoomButton("-", "minus", "Zoom out"));
        zoomControls.appendChild(makeZoomButton("Reset", "reset", "Reset zoom"));
        host.appendChild(zoomControls);
        applyHouseDistrictZoom();
        keepMapModeControlsHidden(() => Boolean(
            politicianMode ? housePoliticianDistrictGridState : houseDistrictGridState
        ));
    };
    const queueHouseDistrictGridRender = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        let attempts = 0;
        const tryRender = () => {
            const activeGridState = electionType === "usHousePol"
                ? housePoliticianDistrictGridState
                : houseDistrictGridState;
            if (!activeGridState || (electionType !== "usHouse" && electionType !== "usHousePol")) return;
            const mountedSvgMap = document.getElementById(electionType + "-map" + (live ? "-live" : ""));
            const mountedCanvasElem = getMountedMapCanvas(canvasElem, live);
            if (mountedSvgMap?.isConnected && mountedCanvasElem?.isConnected) {
                renderHouseDistrictGrid(mountedSvgMap, mountedCanvasElem, resultColours, electionType, live, onClickPageFunc, projected);
                return;
            }
            attempts++;
            if (attempts < 6) setTimeout(tryRender, 30);
        };
        setTimeout(tryRender, 0);
    };
    const syncPrecinctResults = (svgMap, electionType, live) => {
        if(!precinctResultsController || isHydratingMsnbcElectionData) return;
        const stateId = String(activeMap || "").toUpperCase();
        const race = onCountyMap
            ? getStatewideRaceWithMapSubdivisions(electionType, stateId, live)
            : null;
        const rcvContext = onCountyMap
            ? getRcvMapFinalContext(electionType, stateId, race, live)
            : null;
        precinctResultsController.sync({
            svgMap,
            host: svgMap?.parentElement || null,
            electionType,
            live,
            onCountyMap,
            stateId,
            race,
            rcvRace: rcvContext?.virtualRace || null,
            isPrimary: isStatewidePrimaryRace(race)
                || (live === true && isPrimaryElectionNightPage())
        });
    };
    let lastNativePrimaryPanelRefreshAt = 0;
    const nativePanelSelectedStateByElectionType = Object.create(null);
    const lastNativeSelectedPanelRefreshAtByElectionType = Object.create(null);
    let nativePrimaryPanelSelectionTimer = null;
    const getNativeElectionNightUpdateFunction = electionType => {
        const functionNamesByType = {
            president: [
                "eNightPUpdate",
                "eNightPresUpdate",
                "eNightPresidentUpdate",
                "electNightPUpdate",
                "electNightPresUpdate",
                "electNightPresidentUpdate"
            ],
            usSenate: [
                "eNightUSSUpdate",
                "eNightSenateUpdate",
                "electNightUSSUpdate",
                "electNightSenateUpdate"
            ],
            governor: [
                "eNightGovUpdate",
                "eNightGovernorUpdate",
                "electNightGovUpdate",
                "electNightGovernorUpdate"
            ]
        };
        return (functionNamesByType[electionType] || [])
            .map(readRuntimeFunction)
            .find(Boolean) || null;
    };
    const refreshNativePrimaryPanel = (electionType, live) => {
        if(live !== true || onCountyMap) return;
        if(!["president", "usSenate", "governor"].includes(electionType)) return;
        const stateId = String(activeMap || "").toUpperCase();
        if(!stateId || stateId === "US") return;
        const activeRace = getStatewideRaceForMap(electionType, stateId, { allowArchive: !live });
        if(!isStatewidePrimaryRace(activeRace) && !isPrimaryElectionNightPage()) return;
        const now = Date.now();
        if(now - lastNativePrimaryPanelRefreshAt < 180) return;
        const updateFunction = getNativeElectionNightUpdateFunction(electionType);
        if(!updateFunction) return;
        lastNativePrimaryPanelRefreshAt = now;
        const previousActiveMap = activeMap;
        const previousOnCountyMap = onCountyMap;
        const previousLastMapElectionType = lastMapElectionType;
        try {
            activeMap = stateId;
            onCountyMap = false;
            updateFunction();
        } catch {}
        finally {
            activeMap = previousActiveMap;
            onCountyMap = previousOnCountyMap;
            lastMapElectionType = previousLastMapElectionType;
        }
    };
    const rememberNativePanelSelectedState = (electionType, stateId) => {
        if(!["president", "usSenate", "governor"].includes(electionType)) return;
        const normalizedStateId = String(stateId || "").trim().toUpperCase();
        if(!normalizedStateId || normalizedStateId === "US") return;
        nativePanelSelectedStateByElectionType[electionType] = normalizedStateId;
    };
    const getLivePrimaryPanelStateIds = electionType => {
        if(!["president", "usSenate", "governor"].includes(electionType)) return [];
        const stateIds = [];
        const addStateId = value => {
            const rawValue = String(value || "").trim();
            const cleanedValue = rawValue
                .replace(/\b(?:presidential|democratic|republican|nonpartisan)?\s*primar(?:y|ies)\b.*$/i, "")
                .trim();
            const stateId = getElectionNightPanelStateCode(cleanedValue || rawValue);
            if(
                !stateId
                || stateId === "US"
                || !Executive?.data?.states?.[String(stateId).toLowerCase()]
                || stateIds.includes(stateId)
            ) return;
            stateIds.push(stateId);
        };
        getLiveStatewideRaces(electionType).forEach(race => {
            [
                race?.state,
                race?.stateCode,
                race?.stateID,
                race?.id,
                race?.district,
                race?.name
            ].some(value => {
                const previousLength = stateIds.length;
                addStateId(value);
                return stateIds.length > previousLength;
            });
        });
        if(stateIds.length) return stateIds;
        Object.keys(resultProxies[electionType] || {}).forEach(stateId => {
            const race = getStatewideRaceForMap(electionType, stateId, { allowArchive: false });
            if(hasLiveStatewidePrimaryRaceStarted(stateId, race)) addStateId(stateId);
        });
        return stateIds;
    };
    const syncNativePrimaryPanelSelection = (electionType, live) => {
        if(
            live !== true
            || onCountyMap
            || !isPrimaryElectionNightPage()
            || !["president", "usSenate", "governor"].includes(electionType)
        ) return;
        const stateIds = getLivePrimaryPanelStateIds(electionType);
        if(!stateIds.length) return;
        const rememberedState = nativePanelSelectedStateByElectionType[electionType];
        const targetState = stateIds.includes(rememberedState)
            ? rememberedState
            : stateIds[0];
        rememberNativePanelSelectedState(electionType, targetState);
        if(nativePrimaryPanelSelectionTimer) clearTimeout(nativePrimaryPanelSelectionTimer);
        nativePrimaryPanelSelectionTimer = setTimeout(() => {
            nativePrimaryPanelSelectionTimer = null;
            if(
                modShuttingDown
                || onCountyMap
                || lastMapElectionType !== electionType
                || !isPrimaryElectionNightPage()
            ) return;
            const updateFunction = getNativeElectionNightUpdateFunction(electionType);
            if(!updateFunction) return;
            const previousActiveMap = activeMap;
            const previousOnCountyMap = onCountyMap;
            const previousLastMapElectionType = lastMapElectionType;
            try {
                activeMap = targetState;
                onCountyMap = false;
                lastNativePrimaryPanelRefreshAt = Date.now();
                updateFunction();
            } catch {}
            finally {
                activeMap = previousActiveMap;
                onCountyMap = previousOnCountyMap;
                lastMapElectionType = previousLastMapElectionType;
            }
        }, 0);
    };
    const refreshSelectedNativeStatePanel = (electionType, live) => {
        if(live !== true || onCountyMap) return;
        if(!["president", "usSenate", "governor"].includes(electionType)) return;
        if(isPrimaryElectionNightPage()) return;
        const stateId = nativePanelSelectedStateByElectionType[electionType];
        if(!stateId) return;
        const selectedRace = getStatewideRaceForMap(
            electionType,
            stateId,
            { allowArchive: false }
        );
        if(!selectedRace || isStatewidePrimaryRace(selectedRace)) return;
        const now = Date.now();
        const lastRefresh = lastNativeSelectedPanelRefreshAtByElectionType[electionType] || 0;
        if(now - lastRefresh < 180) return;
        const updateFunction = getNativeElectionNightUpdateFunction(electionType);
        if(!updateFunction) return;
        lastNativeSelectedPanelRefreshAtByElectionType[electionType] = now;
        const previousActiveMap = activeMap;
        const previousOnCountyMap = onCountyMap;
        const previousLastMapElectionType = lastMapElectionType;
        try {
            activeMap = stateId;
            onCountyMap = false;
            updateFunction();
        } catch {}
        finally {
            activeMap = previousActiveMap;
            onCountyMap = previousOnCountyMap;
            lastMapElectionType = previousLastMapElectionType;
        }
    };
    const refreshActivePrimaryCountyMap = () => {
        if(!onCountyMap || !activePrimaryCountyParty) return;
        if(!["president", "usSenate", "governor"].includes(lastMapElectionType)) return;
        const svgMap = document.getElementById(`${lastMapElectionType}-map${lastMapLive ? "-live" : ""}`);
        if(svgMap?.isConnected) {
            updateCountyMap(svgMap, lastMapElectionType, lastMapLive);
        }
        if(tooltipComponents.properties.targetDistrict !== null) {
            updateTooltip(
                lastMapElectionType,
                tooltipComponents.properties.targetDistrict,
                true,
                lastMapLive,
                onCountyMap
            );
            if(tooltipComponents.properties.visible !== false) {
                showRememberedMapTooltip();
            }
        }
    };
    const scheduleElectionNightSkipEndRefresh = delay => {
        const timer = setTimeout(() => {
            electionNightSkipEndRefreshTimers.delete(timer);
            if(!modShuttingDown) refreshActivePrimaryCountyMap();
        }, delay);
        electionNightSkipEndRefreshTimers.add(timer);
    };
    const handleElectionNightSkipEndClick = event => {
        const target = event.target instanceof Element
            ? event.target.closest("button, input, div, span")
            : null;
        const label = String(
            target?.value
            || target?.innerText
            || target?.textContent
            || ""
        );
        if(!/\bSkip to End\b/i.test(label)) return;
        scheduleElectionNightSkipEndRefresh(80);
        scheduleElectionNightSkipEndRefresh(350);
        scheduleElectionNightSkipEndRefresh(900);
    };
    const installElectionNightSkipEndPrimaryRefresh = () => {
        if(electionNightSkipEndPrimaryRefreshInstalled || typeof document === "undefined") return;
        electionNightSkipEndPrimaryRefreshInstalled = true;
        document.addEventListener("click", handleElectionNightSkipEndClick, true);
    };
    const removeStateCountyZoom = () => {
        stateCountyZoomController?.destroy?.();
        stateCountyZoomController = null;
        document.getElementById("bm-state-county-zoom-controls")?.remove();
    };
    const getCountyStateIdFromSvg = svgMap => {
        const source = String(svgMap?.getAttribute("data-source") || "")
            .replace(/\\/g, "/");
        const match = source.match(/\/data\/counties\/([^/]+)\.svg$/i);
        return match ? match[1].toUpperCase() : null;
    };
    const ensureStateCountyZoom = (mapHost, svgMap, electionType) => {
        const stateId = getCountyStateIdFromSvg(svgMap);
        const eligible = Boolean(stateId)
            && ["president", "usSenate", "governor"].includes(electionType)
            && mapHost?.isConnected
            && svgMap?.isConnected;
        if(!eligible) {
            if(!stateCountyZoomController?.svgMap?.isConnected) {
                removeStateCountyZoom();
            }
            return;
        }
        if(
            stateCountyZoomController?.svgMap === svgMap
            && stateCountyZoomController?.stateId === stateId
        ) {
            if(!stateCountyZoomController.controls?.isConnected && mapHost?.isConnected) {
                mapHost.appendChild(stateCountyZoomController.controls);
            }

            stateCountyZoomController.applyZoom?.();
            stateCountyZoomController.positionControls();
            return;
        }
        removeStateCountyZoom();

        const SVG_NS = "http://www.w3.org/2000/svg";
        const contentGroup = Array.from(svgMap.children).find(element =>
            String(element.tagName || "").toLowerCase() === "g"
            && !element.classList.contains("bm-state-county-zoom-stage")
        );
        if(!contentGroup) return;
        const stage = document.createElementNS(SVG_NS, "g");
        stage.classList.add("bm-state-county-zoom-stage");
        contentGroup.parentNode.insertBefore(stage, contentGroup);
        stage.appendChild(contentGroup);
        const citiesGroup = svgMap.querySelector("#cities");
        const citiesOriginalParent = citiesGroup?.parentNode || null;
        const citiesOriginalNextSibling = citiesGroup?.nextSibling || null;
        if(citiesGroup && citiesGroup.parentNode !== contentGroup) {
            contentGroup.appendChild(citiesGroup);
        }

        const MIN_ZOOM = 1;
        const MAX_ZOOM = 6;
        const ZOOM_STEP = 0.75;
        const WHEEL_ZOOM_STEP = 0.25;
        let zoom = MIN_ZOOM;
        let panX = 0;
        let panY = 0;
        let dragging = null;
        let suppressNextClick = false;
        let replacementObserver = null;
        const listeners = [];
        const listen = (target, type, handler, options) => {
            target.addEventListener(type, handler, options);
            listeners.push(() => target.removeEventListener(type, handler, options));
        };
        const getViewBox = () => {
            const viewBox = svgMap.viewBox?.baseVal;
            if(viewBox?.width > 0 && viewBox?.height > 0) return viewBox;
            return {
                x: 0,
                y: 0,
                width: Number(svgMap.getAttribute("width")) || svgMap.clientWidth || 1,
                height: Number(svgMap.getAttribute("height")) || svgMap.clientHeight || 1
            };
        };
        const updateCityZoom = () => {
            if(!citiesGroup) return;
            const cityLevel = zoom >= 2.6 ? "3" : (zoom >= 1.5 ? "2" : "1");
            svgMap.setAttribute("data-city-zoom", cityLevel);
            const inverseZoom = 1 / Math.max(zoom, 1);
            citiesGroup.querySelectorAll(".city").forEach(city => {
                const isLevel2 = city.classList.contains("lvl2");
                const isLevel3 = city.classList.contains("lvl3");
                const isVisible = (!isLevel2 && !isLevel3)
                    || (isLevel2 && Number(cityLevel) >= 2)
                    || (isLevel3 && Number(cityLevel) >= 3);

                city.setAttribute("display", isVisible ? "inline" : "none");
                city.style.setProperty("display", isVisible ? "inline" : "none");

                const x = city.getAttribute("data-x");
                const y = city.getAttribute("data-y");
                if(x === null || y === null) return;
                city.setAttribute(
                    "transform",
                    `translate(${x} ${y}) scale(${inverseZoom})`
                );
            });
        };
        const applyZoom = () => {
            const viewBox = getViewBox();
            const centerX = viewBox.x + (viewBox.width / 2);
            const centerY = viewBox.y + (viewBox.height / 2);
            stage.setAttribute(
                "transform",
                `translate(${centerX + panX} ${centerY + panY}) scale(${zoom}) translate(${-centerX} ${-centerY})`
            );
            svgMap.classList.toggle("bm-state-county-can-pan", zoom > MIN_ZOOM);
            const controls = document.getElementById("bm-state-county-zoom-controls");
            const minus = controls?.querySelector("[data-action='minus']");
            const reset = controls?.querySelector("[data-action='reset']");
            const plus = controls?.querySelector("[data-action='plus']");
            if(minus) minus.disabled = zoom <= MIN_ZOOM;
            if(reset) reset.disabled = zoom <= MIN_ZOOM;
            if(plus) plus.disabled = zoom >= MAX_ZOOM;
            updateCityZoom();
        };
        const controls = document.createElement("div");
        controls.id = "bm-state-county-zoom-controls";
        const createButton = (label, action, title) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "bm-house-district-zoom-button";
            button.textContent = label;
            button.title = title;
            button.dataset.action = action;
            listen(button, "click", event => {
                event.preventDefault();
                event.stopPropagation();
                playClick();
                if(action === "plus") {
                    zoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
                } else if(action === "minus") {
                    zoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
                } else {
                    zoom = MIN_ZOOM;
                    panX = 0;
                    panY = 0;
                }
                if(zoom === MIN_ZOOM) {
                    panX = 0;
                    panY = 0;
                }
                applyZoom();
            });
            return button;
        };
        controls.appendChild(createButton("+", "plus", "Zoom in"));
        controls.appendChild(createButton("-", "minus", "Zoom out"));
        controls.appendChild(createButton("Reset", "reset", "Reset zoom"));
        mapHost.appendChild(controls);

        const positionControls = () => {
            if(!controls.isConnected || !svgMap.isConnected || !mapHost.isConnected) return;
            const hostBounds = mapHost.getBoundingClientRect();
            const mapBounds = svgMap.getBoundingClientRect();
            const controlsBounds = controls.getBoundingClientRect();
            controls.style.left = `${Math.max(
                mapBounds.left - hostBounds.left + 8,
                mapBounds.right - hostBounds.left - controlsBounds.width - 10
            )}px`;
            controls.style.top = `${Math.max(
                mapBounds.top - hostBounds.top + 8,
                mapBounds.bottom - hostBounds.top - controlsBounds.height - 10
            )}px`;
        };
        const toSvgDelta = (deltaX, deltaY) => {
            const bounds = svgMap.getBoundingClientRect();
            const viewBox = getViewBox();
            return {
                x: deltaX * viewBox.width / Math.max(1, bounds.width),
                y: deltaY * viewBox.height / Math.max(1, bounds.height)
            };
        };
        const getSvgPointAtEvent = event => {
            const matrix = svgMap.getScreenCTM?.();
            if(!matrix) return null;
            const point = svgMap.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            return point.matrixTransform(matrix.inverse());
        };
        const setZoomAtPoint = (nextZoom, anchor = null) => {
            const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
            if(boundedZoom === zoom) return;
            if(anchor) {
                const viewBox = getViewBox();
                const centerX = viewBox.x + (viewBox.width / 2);
                const centerY = viewBox.y + (viewBox.height / 2);

                panX += (zoom - boundedZoom) * (anchor.x - centerX);
                panY += (zoom - boundedZoom) * (anchor.y - centerY);
            }
            zoom = boundedZoom;
            if(zoom === MIN_ZOOM) {
                panX = 0;
                panY = 0;
            }
            applyZoom();
        };
        listen(svgMap, "wheel", event => {
            if(event.deltaY === 0) return;
            const direction = event.deltaY < 0 ? 1 : -1;
            setZoomAtPoint(
                zoom + (direction * WHEEL_ZOOM_STEP),
                getSvgPointAtEvent(event)
            );
            event.preventDefault();
            event.stopPropagation();
        }, { passive: false });
        listen(svgMap, "pointerdown", event => {
            if(event.button !== 0 || zoom <= MIN_ZOOM) return;
            dragging = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                panX,
                panY,
                moved: false,
                captured: false
            };
        });
        listen(svgMap, "pointermove", event => {
            if(!dragging || dragging.pointerId !== event.pointerId) return;
            const deltaX = event.clientX - dragging.clientX;
            const deltaY = event.clientY - dragging.clientY;
            if(!dragging.moved && Math.hypot(deltaX, deltaY) < 3) return;
            if(!dragging.moved) {
                dragging.moved = true;

                svgMap.setPointerCapture?.(event.pointerId);
                dragging.captured = true;
            }
            const delta = toSvgDelta(deltaX, deltaY);
            panX = dragging.panX + delta.x;
            panY = dragging.panY + delta.y;
            applyZoom();
            event.preventDefault();
        });
        const stopDragging = event => {
            if(!dragging || (event?.pointerId !== undefined && dragging.pointerId !== event.pointerId)) return;
            suppressNextClick = dragging.moved;
            dragging = null;
        };
        listen(svgMap, "pointerup", stopDragging);
        listen(svgMap, "pointercancel", stopDragging);
        listen(svgMap, "lostpointercapture", stopDragging);
        listen(svgMap, "click", event => {
            if(!suppressNextClick) return;
            suppressNextClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        const controller = {
            svgMap,
            stateId,
            stage,
            controls,
            applyZoom,
            positionControls,
            destroy: () => {
                replacementObserver?.disconnect();
                listeners.splice(0).forEach(removeListener => removeListener());
                controls.remove();
                svgMap.classList.remove("bm-state-county-can-pan");
                svgMap.setAttribute("data-city-zoom", "1");
                if(citiesGroup) {
                    citiesGroup.querySelectorAll(".city").forEach(city => {
                        const isDetailedCity = city.classList.contains("lvl2")
                            || city.classList.contains("lvl3");
                        city.setAttribute("display", isDetailedCity ? "none" : "inline");
                        city.style.setProperty("display", isDetailedCity ? "none" : "inline");
                        const x = city.getAttribute("data-x");
                        const y = city.getAttribute("data-y");
                        if(x === null || y === null) return;
                        city.setAttribute("transform", `translate(${x} ${y}) scale(1)`);
                    });
                    if(citiesOriginalParent?.isConnected) {
                        if(citiesOriginalNextSibling?.parentNode === citiesOriginalParent) {
                            citiesOriginalParent.insertBefore(citiesGroup, citiesOriginalNextSibling);
                        } else {
                            citiesOriginalParent.appendChild(citiesGroup);
                        }
                    }
                }
                if(stage.isConnected && contentGroup.isConnected) {
                    stage.parentNode.insertBefore(contentGroup, stage);
                    stage.remove();
                }
            }
        };
        stateCountyZoomController = controller;
        replacementObserver = new MutationObserver(() => {
            requestAnimationFrame(() => {
                if(stateCountyZoomController !== controller) return;
                if(svgMap.isConnected) {
                    if(!controls.isConnected && mapHost.isConnected) {
                        mapHost.appendChild(controls);
                    }
                    if(citiesGroup && citiesGroup.parentNode !== contentGroup) {
                        contentGroup.appendChild(citiesGroup);
                    }
                    applyZoom();
                    positionControls();
                    return;
                }

                const replacement = document.getElementById(svgMap.id);
                removeStateCountyZoom();
                if(
                    replacement?.isConnected
                    && getCountyStateIdFromSvg(replacement)
                ) {
                    ensureStateCountyZoom(
                        replacement.parentElement,
                        replacement,
                        replacement.getAttribute("data-type") || electionType
                    );
                }
            });
        });

        replacementObserver.observe(mapHost, { childList: true });
        applyZoom();
        requestAnimationFrame(positionControls);
        setTimeout(positionControls, 0);
    };
    const STATEWIDE_COUNTY_MAP_ELECTION_TYPES = Object.freeze(["president", "usSenate", "governor"]);
    const isStatewideCountyMapElectionType = electionType =>
        STATEWIDE_COUNTY_MAP_ELECTION_TYPES.includes(electionType);
    const resolveCarriedPrimaryCountyParty = (electionType, stateId, live) => {
        if(!isStatewideCountyMapElectionType(electionType)) return null;
        const race = getStatewideRaceForMap(electionType, stateId, { allowArchive: !live });
        if(!isStatewidePrimaryRace(race)) return null;
        if(electionType === "president") {
            const presidentialParty = getActivePresidentialPrimaryParty();
            if(presidentialParty) return presidentialParty;
        }
        const allParties = getAvailablePrimaryParties(stateId, electionType);
        const parties = live === true
            ? allParties.filter(party => isPrimaryPartyStarted(stateId, party, electionType))
            : allParties;
        if(!parties.length) return null;
        return parties.includes("D") ? "D" : parties[0];
    };
    const renderMap = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        if(isHydratingMsnbcElectionData || !canvasElem?.parentElement) return;
        const container = canvasElem.parentElement;
        lastMapLive = live === true;
        lastMapPageRefresh = onClickPageFunc;
        let countyReturnButton = null;
        let svgMap = document.getElementById(electionType + "-map" + (live ? "-live" : ""));
        let isProjected = (projected === undefined) ? false : projected;
        if(document.getElementById(!live ? "ePageProjectB" : "eNightProjectB")){
            isProjected = document.getElementById(!live ? "ePageProjectB" : "eNightProjectB").getAttribute("class")
                === (!live ? "ePageProjectBActive" : "eNightProjectBActive");
        }
        if(lastUpdateDataHook !== null) {
            Executive.functions.deregisterPostHook("electNightUpdateData", lastUpdateDataHook);
            lastUpdateDataHook = null;
        }
        if(electionType !== lastMapElectionType) {
            const keepCountyDrilldown = onCountyMap
                && Boolean(activeMap)
                && activeMap !== "US"
                && isStatewideCountyMapElectionType(electionType)
                && isStatewideCountyMapElectionType(lastMapElectionType);
            removeStateCountyZoom();
            if(!isHydratingMsnbcElectionData) {
                precinctResultsController?.destroy();
            }
            if(!keepCountyDrilldown) onCountyMap = false;
            activePrimaryCountyParty = keepCountyDrilldown
                ? resolveCarriedPrimaryCountyParty(electionType, activeMap, live)
                : null;
            activePrimaryCountyElectionType = activePrimaryCountyParty ? electionType : null;
            removePrimaryCountyPartyControls();
            if(statewideTurnoutMapMode !== electionType) statewideTurnoutMapMode = null;
            if(statewideShiftMapMode !== electionType) statewideShiftMapMode = null;
            houseDistrictGridState = null;
            housePoliticianDistrictGridState = null;
            removeHouseDistrictGrid();
        }
        lastMapElectionType = electionType;
        if(isStatewideTurnoutModeSelected(electionType) && onCountyMap) {
            resetStatewideTurnoutMapSelection();
        }
        if(isStatewideShiftModeSelected(electionType) && onCountyMap) {
            resetStatewideTurnoutMapSelection();
        }
        let mapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep +
            ((electionType === "president") ? "presidential.svg" : "states.svg");
        if(onCountyMap){
            const selectedRace = getStatewideRaceForMap(electionType, activeMap, { allowArchive: !live });
            const primaryCountyRace = isEligibleStatewidePrimaryCountyRace(
                electionType,
                activeMap,
                selectedRace,
                activePrimaryCountyParty
            );
            if(!selectedRace) onCountyMap = false;
            else if(!selectedRace.cands && !primaryCountyRace) onCountyMap = false;
            else if(
                !primaryCountyRace
                && live
                && selectedRace.totalCurrVotes !== undefined
                && selectedRace.totalCurrVotes === 0
            ) onCountyMap = false;
        }
        if(onCountyMap){
            const countyMapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep + "counties" + path.sep +
                activeMap.toLowerCase() + ".svg";
            if(fs.existsSync(countyMapPath)) mapPath = countyMapPath;
            else onCountyMap = false;
        }
        if(onCountyMap){
            keepMapModeControlsHidden(() => onCountyMap);
            container.querySelectorAll("#ePageReturnB, #ePageReturnB2, #eNightReturnB")
                .forEach(existingButton => existingButton.remove());
            const returnButton = document.createElement("button");
            countyReturnButton = returnButton;
            returnButton.setAttribute("id", projected ? "ePageReturnB2" : (live ? "eNightReturnB" : "ePageReturnB"));
            returnButton.textContent = "Return to U.S. Map";
            returnButton.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                playClick();
                const selectedState = activeMap;
                onCountyMap = false;
                activePrimaryCountyParty = null;
                activePrimaryCountyElectionType = null;
                activeCountyMapMode = MAP_MODES.MARGIN;
                removePrimaryCountyPartyControls();
                setMapModeControlsVisible(true);
                clearStatewideTurnoutFloatingUi();
                try {
                    rememberNativePanelSelectedState(electionType, selectedState);
                    activeMap = selectedState;
                    onClickPageFunc();
                } finally {
                    activeMap = "US";
                }
            };
            container.insertBefore(returnButton, canvasElem);
            syncRcvResultsButton(container, canvasElem, electionType, live, projected);
        } else {
            const returnPresButton = document.getElementById("ePageReturnB2");
            if(returnPresButton) returnPresButton.remove();
            removePrimaryCountyPartyControls();
            removeRcvResultsButton();
        }
        if(!svgMap || svgMap.getAttribute("data-type") !== electionType || svgMap.getAttribute("data-source") !== mapPath){
            const origWidth = +(canvasElem.getAttribute("width").substring(0, canvasElem.getAttribute("width").length - 2));
            const origHeight = +(canvasElem.getAttribute("height").substring(0, canvasElem.getAttribute("height").length - 2));
            const mapDataText = fs.readFileSync(mapPath, "utf8");
            const mapData = (new DOMParser()).parseFromString(mapDataText, "image/svg+xml");
            if(onCountyMap) {
                mapData.documentElement.removeAttribute("viewBox");
                mapData.querySelector("script#city-zoom")?.remove();
                mapData.documentElement.setAttribute("data-city-zoom", "1");
            }
            if(svgMap && (svgMap.getAttribute("data-type") !== electionType || svgMap.getAttribute("data-source") !== mapPath)) svgMap.remove();
            {
                svgMap = mapData.documentElement;
                const baseWidth = +svgMap.getAttribute("width");
                const baseHeight = +svgMap.getAttribute("height");
                const containerDiv = document.createElement("div");
                svgMap.setAttribute("id", electionType + "-map" + (live ? "-live" : ""));
                svgMap.setAttribute("class", "better-maps-container")
                svgMap.setAttribute("width", origWidth);
                svgMap.setAttribute("height", origHeight);
                svgMap.setAttribute("data-type", electionType);
                svgMap.setAttribute("data-source", mapPath);
                containerDiv.appendChild(svgMap);
                container.insertBefore(containerDiv, canvasElem);
                canvasElem.setAttribute("style", "display: none;");
                createCrossHatches(svgMap);
                const hasNativeViewBox = Boolean(svgMap.getAttribute("viewBox"));
                const countyTopSafeArea = onCountyMap ? Math.min(72, origHeight * 0.16) : 0;
                const availableMapHeight = Math.max(1, origHeight - countyTopSafeArea);
                const scaleFactor = hasNativeViewBox
                    ? 1
                    : Math.min(origWidth / baseWidth, availableMapHeight / baseHeight);
                if(hasNativeViewBox && countyTopSafeArea > 0) {
                    const viewBoxValues = String(svgMap.getAttribute("viewBox") || "")
                        .trim()
                        .split(/[\s,]+/)
                        .map(Number);
                    if(
                        viewBoxValues.length === 4
                        && viewBoxValues.every(Number.isFinite)
                        && viewBoxValues[2] > 0
                        && viewBoxValues[3] > 0
                    ) {
                        const safeRatio = Math.min(0.3, countyTopSafeArea / origHeight);
                        const topPadding = viewBoxValues[3] * safeRatio / (1 - safeRatio);
                        svgMap.setAttribute(
                            "viewBox",
                            `${viewBoxValues[0]} ${viewBoxValues[1] - topPadding} ${viewBoxValues[2]} ${viewBoxValues[3] + topPadding}`
                        );
                    }
                }
                const outlineGroup = svgMap.getElementsByTagName("g")[0];

                const statePaths = Array.from(outlineGroup.children).filter(element =>
                    element.getAttribute("id") !== "cities"
                );
                for(let i = 0; i < statePaths.length; i++){
                    const stateId = statePaths[i].getAttribute("id");
                    statePaths[i].setAttribute("id", stateId.toLowerCase() + "-state-path" + (live ? "-live" : ""));
                    statePaths[i].setAttribute("class", "better-maps-state-path");
                    statePaths[i].setAttribute("style", "fill: #cccccc;");
                    if(onCountyMap) {
                        statePaths[i].addEventListener("mouseenter", event => {
                            const countyPath = event.currentTarget;
                            if(countyPath?.parentNode?.lastElementChild !== countyPath) {
                                countyPath.parentNode.appendChild(countyPath);
                            }

                            const cityLayer = svgMap.querySelector("#cities");
                            if(
                                cityLayer?.parentNode
                                && cityLayer.parentNode.lastElementChild !== cityLayer
                            ) {
                                cityLayer.parentNode.appendChild(cityLayer);
                            }
                        });
                    }
                    if(!onCountyMap){
                        statePaths[i].addEventListener("click", (event) => {
                            if(isStatewideShiftModeSelected(electionType)) {
                                event.preventDefault();
                                event.stopImmediatePropagation();
                                resetStatewideTurnoutMapSelection();
                                updateStatewideShiftMap(svgMap, electionType, live);
                                return;
                            }
                            if(isStatewideTurnoutModeSelected(electionType)) {
                                event.preventDefault();
                                event.stopImmediatePropagation();
                                resetStatewideTurnoutMapSelection();
                                updateStatewideTurnoutMap(svgMap, electionType, live);
                                return;
                            }
                            if (
                                electionType === "usHouse"
                                && live
                                && !hasVisibleHouseStateResults(stateId, true)
                            ) {
                                tooltipComponents.properties.visible = true;
                                tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                                updateHouseStateTooltip(stateId.toLowerCase(), true, live);
                                return;
                            }
                            if(electionType === "president" && isPrimaryElectionNightPage()) {
                                event.preventDefault();
                                event.stopPropagation();
                                event.stopImmediatePropagation();
                                const presidentialParty = getActivePresidentialPrimaryParty();
                                if(!isEligibleStatewidePrimaryCountyRace(
                                    electionType,
                                    stateId,
                                    null,
                                    presidentialParty
                                )) {
                                    playClick();
                                    activePrimaryCountyParty = null;
                                    activePrimaryCountyElectionType = null;
                                    onCountyMap = false;
                                    tooltipComponents.properties.visible = true;
                                    tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                                    updateTooltip(electionType, stateId.toLowerCase(), true, live, false);
                                    showRememberedMapTooltip();
                                    return;
                                }
                                activePrimaryCountyParty = presidentialParty;
                                activePrimaryCountyElectionType = electionType;
                                activeCountyMapMode = MAP_MODES.WINNER;
                            }
                            const selectedRace = getStatewideRaceForMap(electionType, stateId, { allowArchive: !live });
                            if(
                                ["president", "usSenate", "governor"].includes(electionType)
                                && isStatewidePrimaryRace(selectedRace)
                            ) {
                                event.preventDefault();
                                event.stopPropagation();
                                event.stopImmediatePropagation();
                                const presidentialParty = electionType === "president"
                                    ? getActivePresidentialPrimaryParty()
                                    : null;
                                if(!isEligibleStatewidePrimaryCountyRace(
                                    electionType,
                                    stateId,
                                    selectedRace,
                                    presidentialParty
                                )) {
                                    playClick();
                                    activePrimaryCountyParty = null;
                                    activePrimaryCountyElectionType = null;
                                    onCountyMap = false;
                                    tooltipComponents.properties.visible = true;
                                    tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                                    updateTooltip(electionType, stateId.toLowerCase(), true, live, false);
                                    showRememberedMapTooltip();
                                    return;
                                }
                                const allParties = getAvailablePrimaryParties(stateId, electionType);
                                const parties = live
                                    ? allParties.filter(party =>
                                        isPrimaryPartyStarted(stateId, party, electionType)
                                    )
                                    : allParties;
                                if(!parties.length) return;
                                activePrimaryCountyParty = presidentialParty
                                    || (parties.includes("D") ? "D" : parties[0]);
                                activePrimaryCountyElectionType = electionType;
                                activeCountyMapMode = MAP_MODES.WINNER;
                            } else {
                                activePrimaryCountyParty = null;
                                activePrimaryCountyElectionType = null;
                            }
                            if(["president", "usSenate", "governor"].includes(electionType)) {
                                activeCountyMapMode = (activePrimaryCountyElectionType || activePrimaryCountyParty)
                                    ? MAP_MODES.WINNER
                                    : MAP_MODES.MARGIN;
                            }
                            playClick();
                            rememberNativePanelSelectedState(electionType, stateId);
                            activeMap = stateId;
                            if(electionType === "usHouse") {
                                if (houseDistrictGridZoomState !== stateId.toLowerCase()) {
                                    houseDistrictGridZoom = 1;
                                    houseDistrictGridPanX = 0;
                                    houseDistrictGridPanY = 0;
                                    houseDistrictGridZoomState = null;
                                }
                                houseDistrictGridState = getHouseDistrictGridDistricts(stateId, live).length > 1
                                    ? stateId.toLowerCase()
                                    : null;
                                houseDistrictGridMode = "projections";
                                if (houseDistrictGridState) hideMapTooltip();
                            } else if(electionType === "usHousePol") {
                                if (houseDistrictGridZoomState !== stateId.toLowerCase()) {
                                    houseDistrictGridZoom = 1;
                                    houseDistrictGridPanX = 0;
                                    houseDistrictGridPanY = 0;
                                    houseDistrictGridZoomState = null;
                                }
                                housePoliticianDistrictGridState = getHousePoliticiansForState(stateId).length > 1
                                    ? stateId.toLowerCase()
                                    : null;
                                if(housePoliticianDistrictGridState) {
                                    hideMapTooltip();
                                    hideHousePoliticianTooltip();
                                }
                            }
                            if(electionType === "president") activeCampMap = Executive.data.states[stateId.toLowerCase()];
                            if(electionType !== "usHouse" && electionType !== "usHousePol"
                                && electionType !== "governorPol" && electionType !== "usSenatePol"){
                                onCountyMap = true;
                                tooltipDiv.setAttribute("style", "display: none;");
                                tooltipComponents.properties.visible = false;
                                tooltipComponents.properties.targetDistrict = null;
                            }
                            removeMarginThroughNightChart();
                            onClickPageFunc();
                            queueMarginThroughNightChartUpdate();
                            if(electionType === "usHouse" || electionType === "usHousePol") {
                                queueHouseDistrictGridRender(canvasElem, resultColours, electionType, live, onClickPageFunc, projected);
                            }
                        });
                    }
                    if(electionType !== "usHousePol" && electionType !== "governorPol" && electionType !== "usSenatePol"){
                        statePaths[i].addEventListener("mousemove", (event) => {
                            if(isStatewideTurnoutModeSelected(electionType)) {
                                event.preventDefault();
                                event.stopImmediatePropagation();
                                const stateIdUpper = String(stateId || "").toUpperCase();
                                hideNativeMapTooltipForTurnout();
                                const details = statewideTurnoutDetailsByState.get(stateIdUpper);
                                if(details) showStatewideTurnoutTooltip(event, details);
                                else removeStatewideTurnoutTooltip();
                                return;
                            }
                            if(isStatewideShiftModeSelected(electionType)) {
                                event.preventDefault();
                                event.stopImmediatePropagation();
                                hideNativeMapTooltipForTurnout();
                                const shiftDetails = statewideShiftDetailsByState.get(
                                    String(stateId || "").toUpperCase()
                                );
                                if(shiftDetails) showStatewideShiftTooltip(event, shiftDetails);
                                else removeStatewideShiftTooltip();
                                return;
                            }
                            removeStatewideShiftTooltip();
                            tooltipComponents.properties.visible = true;
                            tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                            rememberMapTooltipPointer(
                                event,
                                stateId,
                                electionType
                            );
                            removeStatewideTurnoutTooltip();
                            const rcvCountyMode = isRenderedRcvCountyMode(svgMap);
                            if(rcvCountyMode) {
                                if(!renderRcvCountyMapTooltip(electionType, stateId, live)) {
                                    hideMapTooltip();
                                    return;
                                }
                            } else if(electionType === "usHouse") {
                                updateHouseStateTooltip(stateId.toLowerCase(), false, live);
                            } else {
                                updateTooltip(electionType, stateId.toLowerCase(), false, live, onCountyMap);
                            }
                            if(tooltipShowsNoElection()) {
                                hideMapTooltip();
                                return;
                            }
                            showRememberedMapTooltip();
                        });
                        statePaths[i].addEventListener("mouseleave", event => {
                            if(
                                isStatewideTurnoutModeSelected(electionType)
                                || isStatewideShiftModeSelected(electionType)
                            ) {
                                clearStatewideTurnoutFloatingUi();
                                return;
                            }
                            rememberMapTooltipPointer(event, stateId, electionType);
                            requestAnimationFrame(() => {
                                if(
                                    tooltipComponents.properties.targetDistrict
                                    !== stateId.toLowerCase()
                                ) return;
                                if(pointerStillTargetsMapDistrict(event, stateId, electionType)) {
                                    tooltipComponents.properties.visible = true;
                                    showRememberedMapTooltip();
                                    return;
                                }
                                tooltipDiv.style.setProperty("display", "none", "important");
                                removeStatewideTurnoutTooltip();
                                tooltipComponents.properties.visible = false;
                                tooltipComponents.properties.targetDistrict = null;
                            });
                        });
                    }
                }
                if(!hasNativeViewBox) {
                    const preTransform = outlineGroup.getAttribute("transform");
                    const xOffset = (origWidth - (baseWidth * scaleFactor)) / 2;
                    const yOffset = countyTopSafeArea
                        + ((availableMapHeight - (baseHeight * scaleFactor)) / 2);
                    outlineGroup.setAttribute(
                        "transform",
                        `${(preTransform === null ? "" : preTransform)} translate(${xOffset}, ${yOffset}) scale(${scaleFactor})`
                    );
                }
                if(onCountyMap) updateCountyMap(svgMap, electionType, live);
                else updateMap(svgMap, resultColours, electionType, live, isProjected);
            };
        } else {
            if(onCountyMap) updateCountyMap(svgMap, electionType, live);
            else updateMap(svgMap, resultColours, electionType, live, isProjected);
        }
        ensurePrimaryCountyPartyControls(
            container,
            canvasElem,
            svgMap,
            electionType,
            live
        );
        ensurePresidentialPrimaryNationalControls(
            svgMap,
            resultColours,
            electionType,
            live,
            isProjected
        );
        if(onCountyMap && svgMap?.parentElement) {
            const returnButton = countyReturnButton || document.getElementById(
                projected ? "ePageReturnB2" : (live ? "eNightReturnB" : "ePageReturnB")
            );
            const mapHost = svgMap.parentElement;
            mapHost.classList.add("bm-county-map-host");

            mapHost.classList.toggle("bm-county-map-host-page", live === false);
            if(returnButton && returnButton.parentElement !== mapHost) {
                mapHost.insertBefore(returnButton, svgMap);
            }
            returnButton?.classList.add("bm-county-return-button");
            const positionReturnButton = () => {
                if(!returnButton?.isConnected || !svgMap.isConnected) return;
                const hostBounds = mapHost.getBoundingClientRect();
                const mapBounds = svgMap.getBoundingClientRect();
                returnButton.style.top = `${mapBounds.top - hostBounds.top + 8}px`;
                returnButton.style.left = `${mapBounds.left - hostBounds.left + 8}px`;
            };
            requestAnimationFrame(positionReturnButton);
            setTimeout(positionReturnButton, 0);
            ensurePrimaryCountyViewControls(
                mapHost,
                svgMap,
                returnButton,
                electionType,
                live
            );
        }
        ensureStateCountyZoom(svgMap?.parentElement, svgMap, electionType);
        syncStatewideTurnoutControls(svgMap, electionType, live, { onClickPageFunc });
        syncPrecinctResults(svgMap, electionType, live);
        renderHouseDistrictGrid(svgMap, canvasElem, resultColours, electionType, live, onClickPageFunc, projected);
        syncNativePrimaryPanelSelection(electionType, live);
        if(live && electionType !== "usHousePol"){
            lastUpdateDataHook = Executive.functions.registerPostHook("electNightUpdateData", () => {
                refreshNativePrimaryPanel(electionType, live);
                refreshSelectedNativeStatePanel(electionType, live);
                syncStatewideTurnoutControls(svgMap, electionType, live, { onClickPageFunc });
                syncPrecinctResults(svgMap, electionType, live);
                if(onCountyMap && electionType === "governor") {
                    const governorRace = getStatewideRaceForMap(
                        electionType,
                        activeMap,
                        { allowArchive: false }
                    );
                    const shouldShowFlipControl = isGovernorCountyFlipModeAvailable(
                        electionType,
                        activeMap,
                        governorRace,
                        live
                    );
                    const hasFlipControl = Boolean(document.querySelector(
                        "#bm-primary-county-view-controls [data-map-mode='flip-counties']"
                    ));

                    if(shouldShowFlipControl !== hasFlipControl && svgMap?.parentElement) {
                        const returnButton = countyReturnButton || document.getElementById(
                            projected ? "ePageReturnB2" : "eNightReturnB"
                        );
                        ensurePrimaryCountyViewControls(
                            svgMap.parentElement,
                            svgMap,
                            returnButton,
                            electionType,
                            live
                        );
                        syncPrecinctResults(svgMap, electionType, live);
                    }
                }
                if(isStatewideTurnoutModeSelected(electionType) && !onCountyMap) {
                    updateStatewideTurnoutMap(svgMap, electionType, live);
                } else if(isStatewideShiftModeSelected(electionType) && !onCountyMap) {
                    updateStatewideShiftMap(svgMap, electionType, live);
                } else if(
                    onCountyMap
                    && activePrimaryCountyParty
                    && activePrimaryCountyElectionType === electionType
                    && ["president", "usSenate", "governor"].includes(electionType)
                ) {
                    updateCountyMap(svgMap, electionType, live);
                } else if((electionType === "usHouse" || electionType === "usSenate" || electionType === "governor")
                    && !onCountyMap
                    && !(electionType === "usHouse" && houseDistrictGridState)) {
                    updateMap(svgMap, resultColours, electionType, live, isProjected);
                }
                if(electionType === "usHouse" && houseDistrictGridState) {
                    refreshHouseDistrictGridFills(true);
                    setTimeout(() => refreshHouseDistrictGridFills(true), 0);
                }
                if(isStatewideTurnoutModeSelected(electionType)) {
                    tooltipDiv.setAttribute("style", "display: none !important;");
                    tooltipComponents.properties.visible = false;
                    tooltipComponents.properties.targetDistrict = null;
                    return;
                }
                if(tooltipComponents.properties.targetDistrict !== null) {
                    const rcvCountyMode = isRenderedRcvCountyMode(svgMap);
                    if(rcvCountyMode) {
                        renderRcvCountyMapTooltip(
                            electionType,
                            tooltipComponents.properties.targetDistrict,
                            live
                        );
                    } else if(electionType === "usHouse" && houseDistrictGridState && houseDistrictTooltipTarget) {
                        updateHouseDistrictTooltip(houseDistrictGridState, houseDistrictTooltipTarget, true, live);
                    } else if(electionType === "usHouse") updateHouseStateTooltip(tooltipComponents.properties.targetDistrict, true, live);
                    else updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
                    if(tooltipComponents.properties.visible !== false) {
                        showRememberedMapTooltip();
                    }
                }
            });
        }
        if(isStatewideTurnoutModeSelected(electionType)) {
            tooltipDiv.setAttribute("style", "display: none !important;");
            tooltipComponents.properties.visible = false;
            tooltipComponents.properties.targetDistrict = null;
        } else if(tooltipComponents.properties.targetDistrict !== null) {
            const rcvCountyMode = isRenderedRcvCountyMode(svgMap);
            if(rcvCountyMode) {
                renderRcvCountyMapTooltip(
                    electionType,
                    tooltipComponents.properties.targetDistrict,
                    live
                );
            } else if(electionType === "usHouse" && houseDistrictGridState && houseDistrictTooltipTarget) {
                updateHouseDistrictTooltip(houseDistrictGridState, houseDistrictTooltipTarget, true, live);
            } else if(electionType === "usHouse") updateHouseStateTooltip(tooltipComponents.properties.targetDistrict, true, live);
            else updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
            if(tooltipComponents.properties.visible !== false) {
                showRememberedMapTooltip();
            }
        }
        if(live) queueMarginThroughNightChartUpdate();
    };
    const newElectPageMap = (canvasElem, resultColours, arg2, electionType) => {
        if(electionType !== "usSenate" && electionType !== "usHouse"
            && electionType !== "governor" && electionType !== "president")
            return originalElectPageMap(canvasElem, resultColours, arg2, electionType);
        let onClickPageFunc = null;
        switch(electionType){
            case "usSenate":
                onClickPageFunc = senateElectPage
                break;
            case "usHouse":
                onClickPageFunc = houseElectPage
                break;
            case "governor":
                onClickPageFunc = governorElectPage
                break;
            case "president":
                onClickPageFunc = () => {
                    renderMap(canvasElem, resultColours, electionType, false, onClickPageFunc, true, true);
                    updateStDetails();
                };
                break;
        }
        renderMap(canvasElem, resultColours, electionType, false, onClickPageFunc,
            ((electionType === "president") ? true : undefined)
        );
    };
    const newElectNightMap = (canvasElem, resultColours, arg2, electionType) => {
        if(electionType !== "usSenate" && electionType !== "usHouse"
            && electionType !== "governor" && electionType !== "president")
            return originalElectNightMap(canvasElem, resultColours, arg2, electionType);
        let onClickPageFunc = null;
        switch(electionType){
            case "usSenate":
                onClickPageFunc = electNightUSSFunc;
                break;
            case "usHouse":
                onClickPageFunc = electNightUSHFunc;
                break;
            case "governor":
                onClickPageFunc = electNightGovFunc;
                break;
            case "president":
                onClickPageFunc = electNightPresFunc;
                if(electNightP.elections[0].cands === undefined) onClickPageFunc = electNightPPFunc;
                break;
        }
        renderMap(canvasElem, resultColours, electionType, true, onClickPageFunc);
    };
    const newSimUSCanvas = (canvasElem, resultColours, arg2) => {
        renderMap(canvasElem, resultColours, "president", false, presElectPage);
    };
    const newSummaryNationMap = (canvasElem, resultColours, arg2, arg3) => {
        let electionType = "";
        if(openPolPage1 === "nation"){
            electionType = (openPolPage2 === "legislate1") ? "usHousePol" : "usSenatePol";
        } else {
            electionType = "governorPol";
        }
        let onClickPageFunc = null;
        switch(electionType){
            case "usSenatePol":
                onClickPageFunc = senatePolProfMenu;
                break;
            case "usHousePol":
                onClickPageFunc = housePolProfMenu;
                break;
            case "governorPol":
                onClickPageFunc = govPolProfMenu;
                break;
        }
        renderMap(canvasElem, resultColours, electionType, false, onClickPageFunc, true);
    };
    const createMapChangeObserver = (electionType) => () => {
        electionNightMapButtonObservers.get(electionType)?.disconnect();
        electionNightMapButtonObservers.delete(electionType);
        const projectButton = document.getElementById("eNightProjectB");
        if(projectButton){
            const buttonObserver = new MutationObserver((mutationList, observer) => {
                for(const mutation of mutationList){
                    if(mutation.type === "attributes" && mutation.attributeName === "class"){
                        if(isStatewideTurnoutModeSelected(electionType) || isStatewideShiftModeSelected(electionType)) return;
                        if(Date.now() < suppressElectionNightProjectObserverUntil) return;
                        const svgMap = document.getElementById(electionType + "-map-live");
                        if(svgMap){
                            newElectNightMap(document.getElementById("electNightCanvas"), JSON.parse(svgMap.getAttribute("data-colours")), 0, electionType);
                        }
                    }
                }
            });
            buttonObserver.observe(projectButton, {attributes: true});
            electionNightMapButtonObservers.set(electionType, buttonObserver);
        }
    };
    const addPartyID = () => {
        if(activeMap === "US") return;
        let sidePaneContainer = document.getElementById("electPageInn2Gen");
        if(!sidePaneContainer) sidePaneContainer = document.getElementById("electPageInn2Pri");
        const titleParagraph = sidePaneContainer.getElementsByClassName("electNightInnP")[0];
        const state = Executive.data.states[activeMap.toLowerCase()];
        const partyIDContainer = document.createElement("p");
        partyIDContainer.setAttribute("class", "summaryInnTopPRight");
        const demSpan = document.createElement("span");
        demSpan.setAttribute("style", "color: hsl(210, 100%, 60%);");
        demSpan.innerText = "D: " + Math.round(state.demPop * 100).toString() + "%";
        partyIDContainer.appendChild(demSpan);
        const repSpan = document.createElement("span");
        repSpan.setAttribute("style", "color: hsl(0, 100%, 60%);");
        repSpan.innerText = " R: " + Math.round(state.repPop * 100).toString() + "%";
        partyIDContainer.appendChild(repSpan);
        const indNode = document.createTextNode(" I: " + Math.round(state.indPop * 100).toString() + "%")
        partyIDContainer.appendChild(indNode);
        titleParagraph.appendChild(partyIDContainer);
    };
    let msnbcElectionPanelStylesInjected = false;
    let msnbcElectionPanelObserver = null;
    let msnbcElectionPanelRefreshTimer = null;
    let msnbcElectionPanelHydrationTimer = null;
    let msnbcElectionPanelHydrationIndex = 0;
    let msnbcPollModalActiveChart = null;
    let msnbcStatesMapTextCache = null;
    let msnbcLatestNativeSenateCounts = null;

    let msnbcSenateModelOffset = null;
    let msnbcLastSenateDataLogTime = 0;
    let msnbcInitialSenateChamberSnapshot = null;
    const msnbcVoteOfficeRaceCache = new WeakMap();
    let houseBaseTabRefreshInProgress = false;
    let lastHouseBaseTabRefreshKey = "";
    const msnbcElectionRaceHydrationTimestamps = {};
    const msnbcElectionPanelState = {
        view: "hub",
        activeRace: "president",
        roadSubview: "map",
        selectedVoteOffice: "house",
        selectedYear: null,
        selectedStateCode: null,
        selectedCountyName: null,
        comparisonCount: 0,
        hiddenHistoryYears: []
    };
    const MSNBC_VOTE_BY_OFFICE_CATEGORIES = Object.freeze([
        { key: "house", label: "House", liveVar: "electNightUSH", tabPattern: /^(?:U\.S\.\s*)?House$/i },
        { key: "senate", label: "Senate", liveVar: "electNightUSS", tabPattern: /^(?:U\.S\.\s*)?Senate$/i },
        { key: "governor", label: "Governor", liveVar: "electNightG", tabPattern: /^Governor$/i },
        { key: "stateHouse", label: "State House", liveVar: "electNightStH", tabPattern: /^State House$/i, playerStateOnly: true },
        { key: "stateSenate", label: "State Senate", liveVar: "electNightStS", tabPattern: /^State Senate$/i, playerStateOnly: true }
    ]);
    const MSNBC_MAX_HISTORY_COMPARISONS = 4;
    const readRuntimeValue = (name) => {
        try {
            if(Object.prototype.hasOwnProperty.call(globalThis, name)) return globalThis[name];
        } catch {}
        try {
            return Function(`return (typeof ${name} !== "undefined") ? ${name} : undefined;`)();
        } catch {}
        return undefined;
    };
    const readRuntimeFunction = (name) => {
        const value = readRuntimeValue(name);
        return typeof value === "function" ? value : null;
    };
    const formatWholeNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.round(number).toLocaleString("en-US") : "0";
    };
    const formatPercentValue = (value, denominator) => {
        const number = Number(value);
        const total = Number(denominator);
        if(!Number.isFinite(number) || !Number.isFinite(total) || total <= 0) return "0.0%";
        return ((number / total) * 100).toFixed(1) + "%";
    };
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const escapeRegExp = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const getRcvCandidateKey = (candidate, index = 0) => {
        const id = candidate?.id ?? candidate?.candID ?? candidate?.candidateId ?? candidate?.candidateID;
        if(id !== undefined && id !== null) return `id:${id}`;
        const name = String(
            candidate?.name
            || candidate?.fullName
            || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
            || `Candidate ${index + 1}`
        ).trim();
        return `name:${name.toLowerCase()}|${index}`;
    };
    const getRcvCandidateName = (candidate, index = 0) => {
        try {
            const panelName = getPanelCandidateName(candidate);
            if(panelName) return String(panelName).trim();
        } catch {}
        return String(
            candidate?.name
            || candidate?.fullName
            || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
            || candidate?.lastName
            || `Candidate ${index + 1}`
        ).trim();
    };
    const getRcvRaceReporting = (race, live = true) => {
        if(live !== true) return 100;
        const expected = Number(race?.totalVotes) || (race?.cands || []).reduce(
            (sum, candidate) => sum + (Number(candidate?.votes) || 0),
            0
        );
        const counted = Number(race?.totalCurrVotes) || (race?.cands || []).reduce(
            (sum, candidate) => sum + (Number(candidate?.currentVotes) || 0),
            0
        );
        if(expected <= 0) return 0;
        return Math.max(0, Math.min(100, (counted / expected) * 100));
    };
    const RCV_EXPLICIT_FLAG_PATTERN = /^(?:rankchoicevotelaw|(?:use|uses|enable|enables|enabled|has|is)?rankedchoice(?:voting)?(?:law|active|enabled|used)?|(?:use|uses|enable|enables|enabled|has|is)?rcv(?:law|active|enabled|used)?|(?:use|uses|enable|enables|enabled|has|is)?instantrunoff(?:voting)?(?:law|active|enabled|used)?|preferentialvoting(?:law|active|enabled|used)?)$/i;
    const normalizeRcvFlagKey = value => String(value || "").replace(/[^a-z0-9]/gi, "");
    const isEnabledRcvValue = value =>
        value === true
        || value === 1
        || (typeof value === "string" && /^(?:true|yes|enabled|active|on|rcv|ranked)/i.test(value.trim()));
    const readRcvPath = (root, path) => {
        if(!root || typeof root !== "object") return undefined;
        let current = root;
        for(const part of String(path || "").split(".").filter(Boolean)) {
            if(!current || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
            current = current[part];
        }
        return current;
    };
    const isNationalRcvEnabled = () => {
        const roots = [
            Executive?.data?.nationStats,
            Executive?.mods?.saveData?.nationStats,
            readRuntimeValue("nationStats"),
            Executive?.data?.advancedOptions,
            Executive?.mods?.saveData?.advancedOptions,
            readRuntimeValue("advancedOptions")
        ];
        const paths = [
            "rankChoiceVoteLaw",
            "rankedChoiceVoting",
            "nationalRankChoiceVoteLaw",
            "advancedOptions.rankChoiceVoteLaw"
        ];
        return roots.some(root => paths.some(path => isEnabledRcvValue(readRcvPath(root, path))));
    };
    const getRcvBooleanFlag = (sources, keyPattern = RCV_EXPLICIT_FLAG_PATTERN) => {
        const queue = (Array.isArray(sources) ? sources : [sources])
            .filter(source => source && typeof source === "object")
            .map(source => ({ source, depth: 0 }));
        const visited = new Set();
        while(queue.length) {
            const { source, depth } = queue.shift();
            if(visited.has(source)) continue;
            visited.add(source);
            for(const [key, value] of Object.entries(source)) {
                const normalizedKey = normalizeRcvFlagKey(key);
                if(/^(?:norcv|disablercv|rcvdisabled)$/i.test(normalizedKey)) continue;
                if(keyPattern.test(normalizedKey)) {
                    if(isEnabledRcvValue(value)) return true;
                }
                if(depth < 3 && value && typeof value === "object" && !Array.isArray(value)) {
                    queue.push({ source: value, depth: depth + 1 });
                }
            }
        }
        return false;
    };
    const isRcvResultsRace = (electionType, stateCode, race) => {
        if(electionType === "mayor") return false;
        if(!["usSenate", "usHouse", "governor"].includes(electionType)) return false;
        if(!race || !Array.isArray(race.cands) || race.cands.length < 2) return false;
        const normalizedStateCode = String(stateCode || race.state || "").toUpperCase();
        const state = Executive?.data?.states?.[normalizedStateCode.toLowerCase()];
        if(isNationalRcvEnabled()) return true;
        if(getRcvBooleanFlag(
            [
                race,
                state,
                state?.elections,
                state?.electionOptions,
                state?.options
            ],
            RCV_EXPLICIT_FLAG_PATTERN
        )) return true;
        if(
            getRcvRaceReporting(race, true) >= 99.999
            && Array.isArray(race.counties)
            && race.cands.length > 2
        ) {
            const initialTotals = race.cands.map(() => 0);
            race.counties.forEach(county => {
                const countyCandidates = Array.isArray(county?.cands) ? county.cands : [];
                race.cands.forEach((_candidate, index) => {
                    const countyCandidate = countyCandidates[index];
                    initialTotals[index] += Math.max(
                        0,
                        Number(countyCandidate?.votes ?? countyCandidate?.currentVotes) || 0
                    );
                });
            });
            const transferEvidence = race.cands.some((candidate, index) =>
                initialTotals[index] > 0
                && getRcvCandidateVotes(candidate, race, false) === 0
            );
            if(transferEvidence) return true;
        }
        return (normalizedStateCode === "ME" || normalizedStateCode === "AK")
            && race.cands.length > 2;
    };
    const getRcvCandidateVotes = (candidate, race, live = true) => {
        const currentVotes = Number(candidate?.currentVotes);
        if(live === true && Number.isFinite(currentVotes)) return Math.max(0, Math.round(currentVotes));
        return Math.max(0, Math.round(Number(candidate?.votes) || 0));
    };
    const createRcvSnapshot = (electionType, stateCode, race, source, live = true) => {
        if(!isRcvResultsRace(electionType, stateCode, race)) return null;
        const candidates = race.cands.map((candidate, index) => ({
            key: getRcvCandidateKey(candidate, index),
            id: candidate?.id ?? candidate?.candID ?? null,
            name: getRcvCandidateName(candidate, index),
            party: getCandidateVariantPartyKey(candidate) || "I",
            votes: getRcvCandidateVotes(candidate, race, live)
        }));
        const total = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
        return {
            electionType,
            stateCode: String(stateCode || "").toUpperCase(),
            source,
            timestamp: Date.now(),
            reportingPercent: getRcvRaceReporting(race, live),
            candidates,
            total,
            projected: race?.pW === true
        };
    };
    const getRcvCountyInitialSnapshot = (electionType, stateCode, race) => {
        const sourceRace = race;
        if(!Array.isArray(sourceRace?.counties) || !Array.isArray(sourceRace?.cands)) return null;
        const totals = sourceRace.cands.map(() => 0);
        sourceRace.counties.forEach(county => {
            const countyCandidates = Array.isArray(county?.cands) ? county.cands : [];
            sourceRace.cands.forEach((stateCandidate, stateIndex) => {
                const stateKey = getRcvCandidateKey(stateCandidate, stateIndex);
                let countyCandidate = countyCandidates.find((candidate, countyIndex) =>
                    getRcvCandidateKey(candidate, countyIndex) === stateKey
                );
                if(!countyCandidate) {
                    const stateName = getRcvCandidateName(stateCandidate, stateIndex).toLowerCase();
                    countyCandidate = countyCandidates.find((candidate, countyIndex) =>
                        getRcvCandidateName(candidate, countyIndex).toLowerCase() === stateName
                    );
                }
                if(!countyCandidate) countyCandidate = countyCandidates[stateIndex];
                totals[stateIndex] += Math.max(0, Math.round(
                    Number(countyCandidate?.votes ?? countyCandidate?.currentVotes) || 0
                ));
            });
        });
        const candidates = sourceRace.cands.map((candidate, index) => ({
            key: getRcvCandidateKey(candidate, index),
            id: candidate?.id ?? candidate?.candID ?? null,
            name: getRcvCandidateName(candidate, index),
            party: getCandidateVariantPartyKey(candidate) || "I",
            votes: totals[index]
        }));
        const total = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
        if(total <= 0) return null;
        return {
            electionType,
            stateCode: String(stateCode || "").toUpperCase(),
            source: "county-first-preferences",
            timestamp: 0,
            reportingPercent: 100,
            candidates,
            total,
            projected: false
        };
    };
    const getRcvMapFinalContext = (electionType, stateCode, race, live = true) => {
        if(!isRcvResultsRace(electionType, stateCode, race)) return null;
        const lastValidContext = race && typeof race === "object"
            ? rcvMapContextByRace.get(race) || null
            : null;

        if(getRcvRaceReporting(race, live) < 99.999) return lastValidContext;
        if(!Array.isArray(race?.counties) || race.counties.length === 0) {
            return lastValidContext;
        }
        const finalCandidates = race.cands
            .map((candidate, index) => ({
                source: candidate,
                index,
                key: getRcvCandidateKey(candidate, index),
                name: getRcvCandidateName(candidate, index),
                party: getCandidateVariantPartyKey(candidate) || "I",
                ideology: getChanceCandidateIdeology(
                    candidate,
                    getCandidateVariantPartyKey(candidate)
                ),
                votes: getRcvCandidateVotes(candidate, race, live)
            }))
            .filter(candidate => candidate.votes > 0);
        if(finalCandidates.length !== 2) return lastValidContext;
        finalCandidates.sort((a, b) => b.votes - a.votes || a.key.localeCompare(b.key));
        const [finalistA, finalistB] = finalCandidates;
        const normalizeName = value => String(value || "")
            .replace(/\s+county$/i, "")
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
        const getCountyCandidate = (county, stateCandidate, stateIndex) => {
            const candidates = Array.isArray(county?.cands) ? county.cands : [];
            const stateKey = getRcvCandidateKey(stateCandidate, stateIndex);
            return candidates.find((candidate, index) =>
                getRcvCandidateKey(candidate, index) === stateKey)
                || candidates.find((candidate, index) =>
                    getRcvCandidateName(candidate, index).toLowerCase()
                    === getRcvCandidateName(stateCandidate, stateIndex).toLowerCase())
                || candidates[stateIndex]
                || null;
        };
        const countySignature = race.counties.map((county, countyIndex) => [
            normalizeName(county?.name || county?.id || countyIndex),
            (county?.cands || []).map(candidate =>
                Math.max(0, Math.round(Number(candidate?.votes ?? candidate?.currentVotes) || 0))
            ).join(",")
        ].join(":")).join("|");
        const cacheKey = [
            electionType,
            String(stateCode || "").toUpperCase(),
            finalistA.key,
            finalistA.votes,
            finalistB.key,
            finalistB.votes,
            countySignature
        ].join("::");
        if(rcvMapResultsCache.has(cacheKey)) {
            const cachedContext = rcvMapResultsCache.get(cacheKey);
            rcvMapContextByRace.set(race, cachedContext);
            return cachedContext;
        }
        const units = race.counties.map((county, countyIndex) => {
            const candidates = race.cands.map((stateCandidate, stateIndex) => {
                const countyCandidate = getCountyCandidate(county, stateCandidate, stateIndex);
                const party = getCandidateVariantPartyKey(stateCandidate) || "I";
                return {
                    key: getRcvCandidateKey(stateCandidate, stateIndex),
                    votes: Math.max(0, Math.round(
                        Number(countyCandidate?.votes ?? countyCandidate?.currentVotes) || 0
                    )),
                    ideology: getChanceCandidateIdeology(stateCandidate, party)
                };
            });
            const turnoutWeight = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
            const ideologyWeight = candidates.reduce((sum, candidate) =>
                sum + (candidate.votes * candidate.ideology), 0);
            return {
                key: normalizeName(county?.name || county?.id || countyIndex),
                name: county?.name || `County ${countyIndex + 1}`,
                source: county,
                candidates,
                turnoutWeight,
                ideology: turnoutWeight > 0 ? ideologyWeight / turnoutWeight : 0
            };
        });
        const countyResults = buildRcvFinalResultsForUnits({
            units,
            finalistA,
            finalistB,
            finalVotesA: finalistA.votes,
            finalVotesB: finalistB.votes
        });
        const allocatedA = countyResults.reduce((sum, county) => sum + county.votesA, 0);
        const allocatedB = countyResults.reduce((sum, county) => sum + county.votesB, 0);
        if(allocatedA !== finalistA.votes || allocatedB !== finalistB.votes) {
            throw new Error(
                `RCV county allocation mismatch: ${allocatedA}/${allocatedB} `
                + `expected ${finalistA.votes}/${finalistB.votes}`
            );
        }
        const virtualCandidates = [finalistA, finalistB].map(finalist => ({
            ...finalist.source,
            name: finalist.name,
            party: finalist.party,
            votes: finalist.votes,
            currentVotes: finalist.votes,
            candidateColour: stringifyColour(
                getCandidateColourForRace(finalist.source, race)
            )
        }));
        const virtualRace = {
            ...race,
            cands: virtualCandidates,
            counties: countyResults.map(result => ({
                ...result.source,
                name: result.name,
                totalVotes: result.totalVotes,
                totalCurrVotes: result.totalVotes,
                cands: [
                    {
                        ...virtualCandidates[0],
                        votes: result.votesA,
                        currentVotes: result.votesA
                    },
                    {
                        ...virtualCandidates[1],
                        votes: result.votesB,
                        currentVotes: result.votesB
                    }
                ],
                bmRcvFinalCounty: true
            })),
            totalVotes: finalistA.votes + finalistB.votes,
            totalCurrVotes: finalistA.votes + finalistB.votes,
            bmRcvFinal: true
        };
        const result = {
            cacheKey,
            finalistA,
            finalistB,
            countyResults,
            virtualRace
        };
        rcvMapResultsCache.set(cacheKey, result);
        rcvMapContextByRace.set(race, result);
        return result;
    };
    const compareRcvResults = (start, end) => {
        const endByKey = new Map(end.candidates.map(candidate => [candidate.key, candidate]));
        const startByKey = new Map(start.candidates.map(candidate => [candidate.key, candidate]));
        const transfers = end.candidates
            .map(candidate => ({
                key: candidate.key,
                name: candidate.name,
                party: candidate.party,
                votes: Math.max(0, candidate.votes - (startByKey.get(candidate.key)?.votes || 0))
            }))
            .filter(candidate => candidate.votes > 0)
            .sort((a, b) => b.votes - a.votes);
        const transferredVotes = transfers.reduce((sum, candidate) => sum + candidate.votes, 0);
        return {
            initialCandidates: start.candidates,
            finalCandidates: end.candidates,
            transfers: transfers.map(candidate => ({
                ...candidate,
                percent: transferredVotes > 0 ? (candidate.votes / transferredVotes) * 100 : 0
            }))
        };
    };
    const getRcvPartyColour = party => {
        const normalized = normalizePanelPartyCode(party) || "I";
        if(normalized === "D") return "#1688D4";
        if(normalized === "R") return "#E02A2A";
        if(normalized === "ID") return "#91B6DB";
        if(normalized === "IR") return "#D48987";
        return "#888888";
    };
    const renderRcvCandidateRows = candidates => {
        const total = candidates.reduce((sum, candidate) => sum + (Number(candidate.votes) || 0), 0);
        const rows = candidates
            .slice()
            .sort((a, b) => b.votes - a.votes)
            .map(candidate => `
                <div class="bm-rcv-candidate-row">
                    <span class="bm-rcv-swatch" style="background:${getRcvPartyColour(candidate.party)};"></span>
                    <strong>${escapeHtml(candidate.name)}</strong>
                    <span>${formatWholeNumber(candidate.votes)}</span>
                    <span>${formatPercentValue(candidate.votes, total)}</span>
                </div>
            `).join("");
        return `
            ${rows}
            <div class="bm-rcv-total-row">
                <strong>Total reported</strong>
                <span>${formatWholeNumber(total)}</span>
            </div>
        `;
    };
    const closeRcvResultsModal = () => {
        if(rcvResultsEscapeListener) {
            document.removeEventListener("keydown", rcvResultsEscapeListener);
            rcvResultsEscapeListener = null;
        }
        if(rcvResultsModal) rcvResultsModal.remove();
        rcvResultsModal = null;
        const resultsButton = document.getElementById("bm-rcv-results-button");
        if(resultsButton) resultsButton.style.display = "";
    };
    const openRcvResultsModal = (electionType, stateCode, race, live = true) => {
        closeRcvResultsModal();
        if(!firstRoundRequiredRcvTransfers(electionType, stateCode, race)) return;
        const initialSnapshot = getRcvCountyInitialSnapshot(electionType, stateCode, race);
        const finalSnapshot = createRcvSnapshot(electionType, stateCode, race, "current-final", live);
        if(!initialSnapshot || !finalSnapshot) return;
        const results = compareRcvResults(initialSnapshot, finalSnapshot);
        const stateName = Executive?.data?.states?.[String(stateCode).toLowerCase()]?.name || stateCode;
        const raceLabel = electionType === "usSenate"
            ? "U.S. Senate"
            : electionType === "mayor"
                ? "City Mayor"
                : "Governor";
        const overlay = document.createElement("div");
        overlay.id = "bm-rcv-results-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.innerHTML = `
            <div class="bm-rcv-results-modal">
                <header>
                    <div>
                        <span>RANKED-CHOICE VOTING</span>
                        <h2>${escapeHtml(stateName)} ${raceLabel} Results</h2>
                    </div>
                    <button type="button" class="bm-rcv-close" aria-label="Close">&times;</button>
                </header>
                <div class="bm-rcv-results-body">
                    <section class="bm-rcv-round">
                        <h3>Results</h3>
                        <div class="bm-rcv-round-columns">
                            <div><h4>Start of count</h4>${renderRcvCandidateRows(results.initialCandidates)}</div>
                            <div><h4>Final result</h4>${renderRcvCandidateRows(results.finalCandidates)}</div>
                        </div>
                        <div class="bm-rcv-transfer-summary">
                            ${results.transfers.length ? results.transfers.map(transfer => `
                                <span>
                                    <strong>${escapeHtml(transfer.name)}</strong>
                                    +${formatWholeNumber(transfer.votes)}
                                    (${transfer.percent.toFixed(1)}%)
                                </span>
                            `).join("") : "<span>No transferred votes recorded.</span>"}
                        </div>
                    </section>
                </div>
            </div>
        `;
        overlay.addEventListener("click", event => {
            if(event.target === overlay || event.target.closest(".bm-rcv-close")) closeRcvResultsModal();
        });
        rcvResultsEscapeListener = event => {
            if(event.key !== "Escape" || !rcvResultsModal) return;
            closeRcvResultsModal();
        };
        document.addEventListener("keydown", rcvResultsEscapeListener);
        document.body.appendChild(overlay);
        rcvResultsModal = overlay;
        const resultsButton = document.getElementById("bm-rcv-results-button");
        if(resultsButton) resultsButton.style.display = "none";
    };
    const removeRcvResultsButton = () => {
        document.getElementById("bm-rcv-results-button")?.remove();
    };
    const firstRoundRequiredRcvTransfers = (electionType, stateCode, race) => {
        const initialSnapshot = getRcvCountyInitialSnapshot(
            electionType,
            stateCode,
            race
        );
        if(!initialSnapshot || initialSnapshot.total <= 0) return false;
        const leaderVotes = initialSnapshot.candidates.reduce(
            (maximum, candidate) =>
                Math.max(maximum, Math.max(0, Number(candidate?.votes) || 0)),
            0
        );
        return leaderVotes * 2 <= initialSnapshot.total;
    };
    const styleRcvResultsButtonLikeElectionNight = button => {
        const electionNightButton = document.getElementById("bm-msnbc-election-btn");
        if(!button || !electionNightButton) return;
        const sourceStyle = getComputedStyle(electionNightButton);
        [
            "border", "border-radius", "padding", "color", "background",
            "box-shadow", "font-family", "font-size", "font-weight",
            "font-style", "line-height", "letter-spacing", "text-transform"
        ].forEach(property => {
            button.style.setProperty(property, sourceStyle.getPropertyValue(property));
        });
        const sourceBounds = electionNightButton.getBoundingClientRect();
        if(sourceBounds.width > 0) {
            button.style.setProperty("width", `${sourceBounds.width}px`);
        }
        if(sourceBounds.height > 0) {
            button.style.setProperty("height", `${sourceBounds.height}px`);
        }
    };
    const syncRcvResultsButton = (container, canvasElem, electionType, live, projected) => {
        removeRcvResultsButton();
        if(rcvResultsModal) return;
        if(!onCountyMap || (electionType !== "usSenate" && electionType !== "governor")) return;
        const stateCode = String(activeMap || "").toUpperCase();
        const race = resultProxies[electionType]?.[stateCode];
        if(!race || !isRcvResultsRace(electionType, stateCode, race)) return;
        if(getRcvRaceReporting(race, live) < 99.999) return;
        if(!firstRoundRequiredRcvTransfers(electionType, stateCode, race)) return;
        const button = document.createElement("button");
        button.id = "bm-rcv-results-button";
        button.type = "button";
        button.textContent = "Results RCV";
        button.classList.toggle("election-night-active", isElectionNightPanelAvailable());
        button.onclick = () => {
            playClick();
            openRcvResultsModal(electionType, stateCode, race, live);
        };
        document.body.appendChild(button);
        styleRcvResultsButtonLikeElectionNight(button);
    };
    const getElectionNightPanelYear = () => {
        const currentYearValue = Number(readRuntimeValue("currentYear"));
        if(Number.isFinite(currentYearValue)) return currentYearValue;
        const yearText = String(document.body?.innerText || "").match(/\b(20\d{2}|21\d{2})\b/);
        return yearText ? Number(yearText[1]) : null;
    };
    const isMsnbcPresidentialElectionYear = () => {
        const year = Number(getElectionNightPanelYear());
        return Number.isFinite(year) && year % 4 === 0;
    };
    const isMsnbcFederalElectionYear = () => {
        const year = Number(getElectionNightPanelYear());
        return Number.isFinite(year) && year % 2 === 0;
    };
    const getMsnbcVoteOfficeCategory = key => MSNBC_VOTE_BY_OFFICE_CATEGORIES.find(
        category => category.key === key
    ) || MSNBC_VOTE_BY_OFFICE_CATEGORIES[0];
    const getMsnbcPlayerStateCode = () => {
        const player = Executive?.data?.characters?.player;
        const stateIndex = Executive?.enums?.characterArray?.candidate?.stateId;
        const rawState = player?.stateId
            ?? player?.state
            ?? (Array.isArray(player) && Number.isInteger(stateIndex) ? player[stateIndex] : "");
        const directCode = getElectionNightPanelStateCode(rawState);
        if(directCode) return String(directCode).toUpperCase();
        const nativeHeading = String(document.body?.innerText || "").match(
            /\b([A-Za-z .'-]+?)\s+State\s+(?:House|Senate)\s+Elections\b/i
        );
        return nativeHeading ? String(getElectionNightPanelStateCode(nativeHeading[1]) || "").toUpperCase() : "";
    };
    const getMsnbcVoteOfficeRaceCandidates = race => {
        if(Array.isArray(race?.cands)) return race.cands;
        if(Array.isArray(race?.candidates)) return race.candidates;
        return [];
    };
    const getMsnbcVoteOfficeRaces = category => {
        const source = readRuntimeValue(category?.liveVar);
        if(source && typeof source === "object") {
            const cachedRaces = msnbcVoteOfficeRaceCache.get(source);
            if(cachedRaces?.length) return cachedRaces;
        }
        const races = [];
        const queue = Array.isArray(source) ? source.slice() : [source];
        const visited = new Set();
        while(queue.length) {
            const node = queue.shift();
            if(!node || typeof node !== "object" || visited.has(node)) continue;
            visited.add(node);
            if(getMsnbcVoteOfficeRaceCandidates(node).length > 0) {
                races.push(node);
                continue;
            }
            const collections = [
                node.elections,
                node.races,
                node.districts,
                node.states,
                node.results,
                node.stateHDistricts,
                node.stateSDistricts
            ];
            let foundCollection = false;
            collections.forEach(collection => {
                if(!Array.isArray(collection)) return;
                queue.push(...collection);
                foundCollection = true;
            });
            if(!foundCollection) {
                Object.values(node).forEach(value => {
                    if(!value || typeof value !== "object") return;
                    if(Array.isArray(value)) {
                        queue.push(...value);
                        return;
                    }
                    if(getMsnbcVoteOfficeRaceCandidates(value).length > 0
                        || Array.isArray(value.elections)
                        || Array.isArray(value.races)
                        || Array.isArray(value.districts)) {
                        queue.push(value);
                    }
                });
            }
        }
        const scopedRaces = category?.playerStateOnly
            ? races.filter(race => {
                const playerStateCode = getMsnbcPlayerStateCode();
                if(!playerStateCode) return true;
                const raceStateValue = race?.state ?? race?.stateId ?? race?.stateID ?? race?.stateCode;
                if(raceStateValue === undefined || raceStateValue === null || raceStateValue === "") return true;
                const raceStateCode = getElectionNightPanelStateCode(raceStateValue);
                return !raceStateCode || String(raceStateCode).toUpperCase() === playerStateCode;
            })
            : races;
        if(scopedRaces.length && source && typeof source === "object") {
            msnbcVoteOfficeRaceCache.set(source, scopedRaces);
        }
        return scopedRaces;
    };
    const getMsnbcElectionNightTabLabels = () => {
        const tabHost = document.getElementById("electNightTabDiv");
        if(!tabHost) return [];
        return Array.from(tabHost.querySelectorAll("button"))
            .filter(button => {
                if(!button?.isConnected) return false;
                try {
                    const style = window.getComputedStyle(button);
                    return style.display !== "none" && style.visibility !== "hidden";
                } catch {
                    return true;
                }
            })
            .map(button => String(button.innerText || button.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
    };
    const hasMsnbcVoteOfficeData = category => {
        const tabLabels = getMsnbcElectionNightTabLabels();
        if(tabLabels.length > 0 && category?.tabPattern instanceof RegExp) {
            const hasElectionNightTab = tabLabels.some(label => category.tabPattern.test(label));
            if(!hasElectionNightTab) return false;
        }
        return getMsnbcVoteOfficeRaces(category).length > 0;
    };
    const getMsnbcAvailableVoteOfficeCategories = () => isMsnbcPrimaryElectionContext()
        ? []
        : MSNBC_VOTE_BY_OFFICE_CATEGORIES.filter(hasMsnbcVoteOfficeData);
    const getMsnbcAvailableRaces = () => {
        const races = [];
        if(isMsnbcPresidentialElectionYear() && hasGeneralElectionNightRaceData("electNightP")) races.push("president");
        if(hasGeneralElectionNightRaceData("electNightG")) races.push("governor");
        if(isMsnbcFederalElectionYear() && hasGeneralElectionNightRaceData("electNightUSS")) races.push("senate");
        return races;
    };
    const hasMsnbcHouseElectionNightData = () => {
        if(!isMsnbcFederalElectionYear()) return false;
        const houseNight = readRuntimeValue("electNightUSH");
        return Array.isArray(houseNight?.elections)
            && houseNight.elections.some(district =>
                Array.isArray(district?.cands) && district.cands.length > 0
            );
    };
    const getMsnbcAvailableSections = () => {
        if(isMsnbcPrimaryElectionContext()) {
            return {
                president: false,
                road270: false,
                battlegroundPolls: false,
                senateControl: false,
                houseControl: false,
                senateRace: false,
                governorRace: false,
                voteByOffice: false
            };
        }
        const availableRaces = getMsnbcAvailableRaces();
        const hasPresident = availableRaces.includes("president");
        const hasSenate = availableRaces.includes("senate");
        const hasGovernor = availableRaces.includes("governor");
        const hasHouse = hasMsnbcHouseElectionNightData();
        const hasVoteByOffice = getMsnbcAvailableVoteOfficeCategories().length > 0;
        return {
            president: hasPresident,
            road270: hasPresident,
            battlegroundPolls: hasPresident,
            senateControl: hasSenate,
            houseControl: hasHouse,
            senateRace: hasSenate,
            governorRace: hasGovernor,
            voteByOffice: hasVoteByOffice
        };
    };
    const hasAnyMsnbcElectionNightSection = () => {
        const sections = getMsnbcAvailableSections();
        return Object.values(sections).some(Boolean);
    };
    const shouldOpenMsnbcDirectGovernorByState = () => {
        const sections = getMsnbcAvailableSections();
        return sections.governorRace
            && !sections.president
            && !sections.road270
            && !sections.battlegroundPolls
            && !sections.senateControl
            && !sections.houseControl
            && !sections.senateRace
            && !sections.voteByOffice;
    };
    const getMsnbcFirstAvailableRace = () => {
        const availableRaces = getMsnbcAvailableRaces();
        return availableRaces.includes("president")
            ? "president"
            : availableRaces.includes("governor")
                ? "governor"
                : availableRaces.includes("senate")
                    ? "senate"
                    : "governor";
    };
    const isMsnbcPanelRaceAvailable = (race) => {
        const sections = getMsnbcAvailableSections();
        if(race === "president") return sections.president;
        if(race === "senate") return sections.senateRace;
        if(race === "governor") return sections.governorRace;
        return false;
    };
    const isMsnbcPanelViewAvailable = (view, race = msnbcElectionPanelState.activeRace) => {
        if(isMsnbcPrimaryElectionContext()) return false;
        const sections = getMsnbcAvailableSections();
        if(view === "hub") return true;
        if(view === "road270") return sections.road270;
        if(view === "roadBattlegrounds") return sections.road270;
        if(view === "battlegroundPolls") return sections.battlegroundPolls;
        if(view === "senateControl") return sections.senateControl;
        if(view === "houseControl") return sections.houseControl;
        if(view === "voteByOffice") return sections.voteByOffice;
        if(view === "race") return isMsnbcPanelRaceAvailable(race);
        return false;
    };
    const getMsnbcInitialPanelRoute = () => shouldOpenMsnbcDirectGovernorByState()
        ? { view: "race", race: "governor" }
        : { view: "hub", race: getMsnbcFirstAvailableRace() };
    const normalizePanelPartyCode = (value) => {
        const text = String(value || "").trim().toLowerCase();
        if(text === "d" || text.includes("dem")) return "D";
        if(text === "r" || text.includes("rep")) return "R";
        if(text === "i" || text.includes("ind")) return "I";
        return "";
    };
    const getElectionNightPanelStateCode = (value) => {
        const text = String(value || "").trim();
        if(!text) return "";
        const lower = text.toLowerCase();
        if(Executive?.data?.states?.[lower]) return lower.toUpperCase();
        return stateNameToCode[text] || stateNameToCode[Object.keys(stateNameToCode).find(name => name.toLowerCase() === lower)] || text.toUpperCase();
    };
    const getElectionNightPanelStateName = (value) => {
        const code = getElectionNightPanelStateCode(value).toLowerCase();
        return Executive?.data?.states?.[code]?.name || String(value || "");
    };
    const getElectionNightPanelStateElectoralVotes = (value) => {
        const code = getElectionNightPanelStateCode(value).toLowerCase();
        const state = Executive?.data?.states?.[code];
        return Number(state?.electoralNum ?? state?.electoralVotes ?? state?.electors ?? state?.ev) || 0;
    };
    const getMsnbcSplitElectoralStateDistricts = (stateCode) => {
        const normalizedStateCode = String(stateCode || "").toUpperCase();
        if(normalizedStateCode !== "ME" && normalizedStateCode !== "NE") return [];
        const houseNight = readRuntimeValue("electNightUSH");
        if(!Array.isArray(houseNight?.elections)) return [];
        return houseNight.elections.filter(district =>
            getElectionNightPanelStateCode(district?.state || district?.district || district?.name) === normalizedStateCode
        );
    };
    const isMsnbcRaceCalled = (race) => {
        if(!race || !Array.isArray(race?.cands)) return false;
        const totalCurrVotes = Number(race.totalCurrVotes) || 0;
        const totalVotes = Number(race.totalVotes) || 0;
        return race.pW === true
            || race.projected === true
            || race.called === true
            || (totalVotes > 0 && totalCurrVotes >= totalVotes);
    };
    const getMsnbcRaceLeader = (race) => {
        if(!race || !Array.isArray(race?.cands)) return null;
        return race.cands.slice().sort((candidateA, candidateB) =>
            (Number(candidateB.currentVotes ?? candidateB.votes ?? candidateB.totVotes) || 0)
            - (Number(candidateA.currentVotes ?? candidateA.votes ?? candidateA.totVotes) || 0)
        )[0] || null;
    };
    const getMsnbcCandidateParty = (candidate) => {
        return normalizePanelPartyCode(
            candidate?.party
            || candidate?.caucus
            || candidate?.caucusParty
            || candidate?.extendedAttribs?.party
        );
    };
    const addMsnbcElectoralVotesByParty = (totalsByCandidate, state, party, electoralVotes) => {
        const votes = Math.max(0, Number(electoralVotes) || 0);
        if(votes <= 0) return;
        const candidate = (state?.candidates || []).find(stateCandidate =>
            normalizePanelPartyCode(stateCandidate.party) === party
        );
        if(!candidate) return;
        const key = getElectionNightPanelCandidateKey(candidate);
        if(!totalsByCandidate[key]) {
            totalsByCandidate[key] = { ...candidate, electoralVotes: 0 };
        }
        totalsByCandidate[key].electoralVotes += votes;
    };
    const addMsnbcStateElectoralVotes = (totalsByCandidate, state, options = {}) => {
        const includeUnprojectedState = options.includeUnprojectedState === true;
        const totalElectoralVotes = getElectionNightPanelStateElectoralVotes(state?.code);
        if(totalElectoralVotes <= 0) return;
        const winner = getMsnbcLeadingCandidate(state);
        if(!winner) return;
        const winnerParty = normalizePanelPartyCode(winner.party);
        const splitDistricts = getMsnbcSplitElectoralStateDistricts(state?.code);
        if(splitDistricts.length === 0) {
            if(!state.projected && !includeUnprojectedState) return;
            addMsnbcElectoralVotesByParty(totalsByCandidate, state, winnerParty, totalElectoralVotes);
            return;
        }
        const districtElectoralVotes = Math.min(splitDistricts.length, Math.max(0, totalElectoralVotes - 2));
        const statewideElectoralVotes = Math.max(0, totalElectoralVotes - districtElectoralVotes);
        if(state.projected || includeUnprojectedState) {
            addMsnbcElectoralVotesByParty(totalsByCandidate, state, winnerParty, statewideElectoralVotes);
        }
        splitDistricts
            .slice()
            .sort((districtA, districtB) => (Number(districtA?.district) || 0) - (Number(districtB?.district) || 0))
            .slice(0, districtElectoralVotes)
            .forEach(district => {
                if(!isMsnbcRaceCalled(district)) {
                    if(state.projected || includeUnprojectedState) {
                        addMsnbcElectoralVotesByParty(totalsByCandidate, state, winnerParty, 1);
                    }
                    return;
                }
                const districtParty = getMsnbcCandidateParty(getMsnbcRaceLeader(district));
                addMsnbcElectoralVotesByParty(totalsByCandidate, state, districtParty || winnerParty, 1);
            });
    };
    const addMsnbcDirectElectoralTotal = (totals, party, electoralVotes) => {
        const normalizedParty = normalizePanelPartyCode(party);
        const votes = Number(electoralVotes);
        if(!normalizedParty || !Number.isFinite(votes) || votes <= 0) return;
        totals[normalizedParty] = (totals[normalizedParty] || 0) + votes;
    };
    const getMsnbcPresidentialCandidatePartyOrder = () => {
        const presidentialNight = readRuntimeValue("electNightP");
        const firstStateRace = presidentialNight?.elections?.find(stateRace =>
            Array.isArray(stateRace?.cands) && stateRace.cands.length
        );
        return (firstStateRace?.cands || []).map(getMsnbcCandidateParty);
    };
    const addMsnbcDirectElectoralTotalsFromObject = (totals, source) => {
        if(!source || typeof source !== "object") return;
        const sourceParty = getMsnbcCandidateParty(source);
        const sourceVotes = source.electoralVotes ?? source.electoralVote ?? source.electors ?? source.ev;
        if(sourceParty && sourceVotes !== undefined) addMsnbcDirectElectoralTotal(totals, sourceParty, sourceVotes);
        const partyOrder = getMsnbcPresidentialCandidatePartyOrder();
        Object.entries(source).forEach(([key, value]) => {
            if(typeof value !== "number") return;
            const numericIndex = Number(key);
            if(Number.isInteger(numericIndex) && partyOrder[numericIndex]) {
                addMsnbcDirectElectoralTotal(totals, partyOrder[numericIndex], value);
                return;
            }
            addMsnbcDirectElectoralTotal(totals, key, value);
        });
    };
    const getMsnbcDirectPresidentialElectoralTotals = () => {
        const presidentialNight = readRuntimeValue("electNightP");
        const totals = {};
        const directSources = [
            presidentialNight?.electoralVotes,
            presidentialNight?.electoralVote,
            presidentialNight?.electoralVoteTotals,
            presidentialNight?.electoralTotals,
            presidentialNight?.ev,
            presidentialNight?.electors
        ].filter(source => source !== undefined && source !== null);
        directSources.forEach(source => {
            if(source instanceof Map) {
                addMsnbcDirectElectoralTotalsFromObject(totals, Object.fromEntries(source));
                return;
            }
            if(Array.isArray(source)) {
                const partyOrder = getMsnbcPresidentialCandidatePartyOrder();
                if(source.every(value => typeof value === "number")) {
                    source.forEach((votes, index) => addMsnbcDirectElectoralTotal(totals, partyOrder[index], votes));
                } else {
                    source.forEach(entry => addMsnbcDirectElectoralTotalsFromObject(totals, entry));
                }
                return;
            }
            addMsnbcDirectElectoralTotalsFromObject(totals, source);
        });
        addMsnbcDirectElectoralTotal(totals, "D", presidentialNight?.demElectoralVotes ?? presidentialNight?.demElectors ?? presidentialNight?.demEV ?? presidentialNight?.dEV);
        addMsnbcDirectElectoralTotal(totals, "R", presidentialNight?.repElectoralVotes ?? presidentialNight?.repElectors ?? presidentialNight?.repEV ?? presidentialNight?.rEV);
        return Object.values(totals).some(value => Number(value) > 0) ? totals : null;
    };
    const getMsnbcNativePresidentialScoreText = () => {
        const overlayText = String(document.getElementById("bm-msnbc-election-overlay")?.innerText || "");
        const pageText = String(document.body?.innerText || document.body?.textContent || "");
        const cleanText = overlayText ? pageText.replace(overlayText, "") : pageText;
        const normalizedText = cleanText.replace(/\s+/g, " ").trim();
        const titleMatch = normalizedText.match(/\b(?:20\d{2}|21\d{2})\s+Presidential Election\b/i);
        if(!titleMatch) return normalizedText;
        return normalizedText.slice(titleMatch.index, titleMatch.index + 500);
    };
    const getMsnbcNativeCandidateElectoralVotes = (candidate, sourceText) => {
        const names = [
            candidate?.name,
            getPanelCandidateName(candidate)
        ]
            .map(name => String(name || "").trim())
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);
        for(const name of names) {
            const patternName = escapeRegExp(name);
            const beforeMatch = sourceText.match(new RegExp(`(?:^|\\s)(\\d{1,3})\\s+${patternName}\\b`, "i"));
            const afterMatch = sourceText.match(new RegExp(`\\b${patternName}\\s+(\\d{1,3})(?:\\s|$)`, "i"));
            const value = Number(beforeMatch?.[1] ?? afterMatch?.[1]);
            if(Number.isFinite(value) && value >= 0 && value <= 538) return value;
        }
        return null;
    };
    const getMsnbcNativePresidentialRoadTotals = (entry) => {
        if(entry?.race !== "president" || entry?.current !== true) return null;
        const sourceText = getMsnbcNativePresidentialScoreText();
        if(!sourceText) return null;
        const totals = (entry?.candidates || [])
            .map(candidate => {
                const electoralVotes = getMsnbcNativeCandidateElectoralVotes(candidate, sourceText);
                return Number.isFinite(electoralVotes) ? { ...candidate, electoralVotes } : null;
            })
            .filter(Boolean);
        const totalElectoralVotes = totals.reduce((sum, candidate) => sum + Number(candidate.electoralVotes || 0), 0);
        if(totals.length < 2 || totalElectoralVotes <= 0 || totalElectoralVotes > 538) return null;
        return totals.sort((a, b) => Number(b.electoralVotes) - Number(a.electoralVotes));
    };
    const getMsnbcDirectRoadTotals = (entry) => {
        if(entry?.race !== "president" || entry?.current !== true) return null;
        const nativeTotals = getMsnbcNativePresidentialRoadTotals(entry);
        if(nativeTotals) return nativeTotals;
        const directTotals = getMsnbcDirectPresidentialElectoralTotals();
        if(!directTotals) return null;
        const candidatesByParty = {};
        (entry?.candidates || []).forEach(candidate => {
            const party = normalizePanelPartyCode(candidate.party);
            if(party && !candidatesByParty[party]) candidatesByParty[party] = candidate;
        });
        const totals = Object.entries(directTotals)
            .map(([party, electoralVotes]) => {
                const candidate = candidatesByParty[party];
                return candidate ? { ...candidate, electoralVotes } : null;
            })
            .filter(Boolean)
            .sort((a, b) => Number(b.electoralVotes) - Number(a.electoralVotes));
        return totals.length ? totals : null;
    };
    const getElectionNightPanelCandidateKey = (candidate) => String(candidate?.id ?? candidate?.name ?? "unknown");
    const hasGeneralElectionNightRaceData = (liveVarName) => {
        const electNight = readRuntimeValue(liveVarName);
        return Array.isArray(electNight?.elections)
            && electNight.elections.some(election =>
                Array.isArray(election?.cands) && election.cands.length > 0
            );
    };
    const isPrimaryElectionNightPage = () => {
        const text = String(document.body?.innerText || "");
        if(/\b(Presidential Primaries|Primary Election|Democratic Primary|Republican Primary|Primary Results|Primar(?:y|ies))\b/i.test(text)) {
            return true;
        }
        if(document.querySelector(
            '[data-bm-primary-election="true"], '
            + '#bm-presidential-primary-national-controls, '
            + '#bm-primary-county-party-controls'
        )) {
            return true;
        }
        if(/\bGeneral Election\b/i.test(text)) {
            return false;
        }
        return hasPrimaryElectionNightRaceData();
    };
    const hasPrimaryElectionNightRaceData = () => {
        const hasPrimaryCandidateGroup = race => !Array.isArray(race?.cands)
            && [race?.dem, race?.rep, race?.allCands].some(group => (
                Array.isArray(group?.cands) && group.cands.length > 0
            ));
        return ["electNightP", "electNightUSH", "electNightUSS", "electNightG"]
            .some(liveVarName => {
                const electionNight = readRuntimeValue(liveVarName);
                return Array.isArray(electionNight?.elections)
                    && electionNight.elections.some(hasPrimaryCandidateGroup);
            });
    };
    const isMsnbcPrimaryElectionContext = () => {
        if(isPrimaryElectionNightPage()) return true;
        const text = String(document.body?.innerText || "");
        const hasElectionNightUi = text.includes("Skip to End") && Boolean(
            document.getElementById("electNightDiv")
            || document.getElementById("electNightTabDiv")
            || document.getElementById("electNightCanvas")
            || document.getElementById("electNightMainDiv")
        );
        return hasElectionNightUi && hasPrimaryElectionNightRaceData();
    };
    const isElectionNightPanelAvailable = () => {
        if(document.querySelector(".bm-special-election-night")) return false;
        if(isMsnbcPrimaryElectionContext()) return false;
        if(!hasAnyMsnbcElectionNightSection()) return false;
        const text = String(document.body?.innerText || "");
        const hasElectionNightUi = text.includes("Skip to End")
            && (document.getElementById("electNightCanvas")
                || document.getElementById("eNightProjectB")
                || /\bElection\b/i.test(text));
        return Boolean(hasElectionNightUi);
    };
    const isElectionNightScreenOpen = () => {
        if(!document.body) return false;
        const text = String(document.body.innerText || "");
        if(!text.includes("Skip to End")) return false;
        const electionNightRoot = document.getElementById("electNightDiv");
        const electionNightTabs = document.getElementById("electNightTabDiv");
        const electionNightCanvas = document.getElementById("electNightCanvas");
        const electionNightMain = document.getElementById("electNightMainDiv");
        return Boolean(
            electionNightRoot?.isConnected
            || electionNightTabs?.isConnected
            || electionNightCanvas?.isConnected
            || electionNightMain?.isConnected
        );
    };
    const isElectionNightPlaybackPaused = () => {
        const speedButtons = Array.from(document.querySelectorAll(
            "#electNightSpeedDiv .eNightSpeedCnvAct, "
            + "#electNightSpeedDiv .eNightSpeedCnvInA"
        ));
        if(speedButtons.length) {
            const activeIndex = speedButtons.findIndex(button =>
                button.classList.contains("eNightSpeedCnvAct")
            );
            if(activeIndex >= 0) return activeIndex === 0;
        }
        const speedValue = readRuntimeValue("electNightSpeed");
        const speedText = String(speedValue ?? "").toLowerCase();
        return speedText.includes("pause")
            || speedText.includes("stop")
            || (
                speedValue !== undefined
                && speedValue !== null
                && Number(speedValue) === 0
            );
    };
    const ELECTION_NIGHT_THEME_STORAGE_KEY = "better-maps-nbc-election-night-music";
    const readElectionNightThemeEnabled = () => {
        try {
            const storedValue = globalThis.localStorage?.getItem(
                ELECTION_NIGHT_THEME_STORAGE_KEY
            );
            if(storedValue === null || storedValue === undefined) return true;
            return storedValue !== "off" && storedValue !== "false" && storedValue !== "0";
        } catch {
            return electionNightThemeEnabled;
        }
    };
    const isElectionNightThemeOptionElementVisible = element => {
        if(!element?.isConnected) return false;
        try {
            const style = getComputedStyle(element);
            if(style.display === "none" || style.visibility === "hidden") return false;
        } catch {}
        return typeof element.getClientRects !== "function"
            || element.getClientRects().length > 0;
    };
    const isElectionNightThemeOptionsOpen = () => Boolean(
        isElectionNightThemeOptionElementVisible(
            document.getElementById("bm-election-night-theme-option")
        )
        || Array.from(document.querySelectorAll("h1, h2, h3, h4, label, div"))
            .some(element => isElectionNightThemeOptionElementVisible(element)
                && /^Music Volume:?$/i.test(
                String(element.textContent || "").replace(/\s+/g, " ").trim()
            ))
    );
    const updateElectionNightThemeOptionButtons = () => {
        document.querySelectorAll("[data-bm-election-night-theme]").forEach(button => {
            const selected = (button.dataset.bmElectionNightTheme === "on")
                === electionNightThemeEnabled;
            button.classList.toggle("bm-election-night-theme-selected", selected);
            button.setAttribute("aria-pressed", selected ? "true" : "false");
        });
    };
    const setElectionNightThemeEnabled = enabled => {
        electionNightThemeEnabled = enabled === true;
        try {
            globalThis.localStorage?.setItem(
                ELECTION_NIGHT_THEME_STORAGE_KEY,
                electionNightThemeEnabled ? "on" : "off"
            );
        } catch {}
        updateElectionNightThemeOptionButtons();
        if(!electionNightThemeEnabled) {
            pauseElectionNightTheme();
            return;
        }
        syncElectionNightTheme();
    };
    const findElectionNightThemeOptionHeading = pattern =>
        Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, label, div, p"))
            .find(element => isElectionNightThemeOptionElementVisible(element)
                && pattern.test(
                String(element.textContent || "").replace(/\s+/g, " ").trim()
            )) || null;
    const getStandaloneOptionsSection = (heading, followingHeading) => {
        if(!heading || !followingHeading) return null;
        let section = heading;
        while(
            section.parentElement
            && !section.parentElement.contains(followingHeading)
        ) {
            section = section.parentElement;
        }
        return section === heading ? heading.parentElement : section;
    };
    const ensureElectionNightThemeOptionControl = () => {
        const existing = document.getElementById("bm-election-night-theme-option");
        if(existing) {
            updateElectionNightThemeOptionButtons();
            return existing;
        }
        const musicHeading = findElectionNightThemeOptionHeading(/^Music Volume:?$/i);
        const soundHeading = findElectionNightThemeOptionHeading(/^Sound Volume:?$/i);
        if(!musicHeading || !soundHeading) return null;
        const musicSection = getStandaloneOptionsSection(musicHeading, soundHeading);
        if(!musicSection?.parentElement) return null;

        const section = document.createElement(
            /^(DIV|SECTION|ARTICLE)$/i.test(musicSection.tagName)
                ? musicSection.tagName.toLowerCase()
                : "div"
        );
        section.id = "bm-election-night-theme-option";
        section.className = `${musicSection.className || ""} bm-election-night-theme-option`.trim();
        section.style.cssText = musicSection.style.cssText || "";
        section.style.removeProperty("height");
        section.style.removeProperty("min-height");

        const title = musicHeading.cloneNode(false);
        title.removeAttribute("id");
        title.textContent = "NBC Election Night Music:";
        title.classList.add("bm-election-night-theme-title");
        section.appendChild(title);

        const controls = document.createElement("div");
        controls.className = "bm-election-night-theme-buttons";
        [
            ["on", "On", true],
            ["off", "Off", false]
        ].forEach(([value, label, enabled]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.bmElectionNightTheme = value;
            button.textContent = label;
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                setElectionNightThemeEnabled(enabled);
            });
            controls.appendChild(button);
        });
        section.appendChild(controls);
        musicSection.insertAdjacentElement("afterend", section);
        updateElectionNightThemeOptionButtons();
        return section;
    };
    const getElectionNightThemeSource = () => {
        const soundPath = path.join(
            Executive.mods.getRelativePathPrefix(),
            "data",
            "sounds",
            "NBC_News_Election_Theme.ogg"
        );
        const normalizedPath = soundPath.replace(/\\/g, "/");
        if(/^[a-z]:\//i.test(normalizedPath)) {
            return `file:///${encodeURI(normalizedPath)}`;
        }
        try {
            return new URL(normalizedPath, document.baseURI).href;
        } catch {
            return normalizedPath;
        }
    };
    const ensureElectionNightThemeAudio = () => {
        if(electionNightThemeAudio) return electionNightThemeAudio;
        const soundPath = path.join(
            Executive.mods.getRelativePathPrefix(),
            "data",
            "sounds",
            "NBC_News_Election_Theme.ogg"
        );
        if(!fs.existsSync(soundPath)) return null;
        const audio = new Audio(getElectionNightThemeSource());
        audio.id = "bm-election-night-theme-audio";
        audio.preload = "auto";
        audio.loop = true;
        audio.playbackRate = 1;
        audio.defaultPlaybackRate = 1;
        electionNightThemeAudio = audio;
        return audio;
    };
    const pauseElectionNightTheme = ({ reset = false } = {}) => {
        if(!electionNightThemeAudio) return;
        electionNightThemeAudio.pause();
        electionNightThemePlayPending = false;
        if(reset) {
            try {
                electionNightThemeAudio.currentTime = 0;
            } catch {}
        }
    };
    const syncElectionNightTheme = () => {
        ensureElectionNightThemeOptionControl();
        const screenOpen = isElectionNightScreenOpen();
        const optionsOpen = isElectionNightThemeOptionsOpen();
        if(screenOpen) {
            electionNightThemeSessionActive = true;
            electionNightThemeLastScreenSeenAt = Date.now();
        }
        const optionsOpenedFromElectionNight = optionsOpen
            && electionNightThemeSessionActive;
        if(!screenOpen && !optionsOpenedFromElectionNight) {
            if(electionNightThemeLastScreenSeenAt > 0
                && Date.now() - electionNightThemeLastScreenSeenAt < 2000) {
                return;
            }
            pauseElectionNightTheme({ reset: true });
            const pageText = String(document.body?.innerText || "");
            if(/\bMain Menu\b/i.test(pageText)
                || (/\bOffice\b/i.test(pageText) && /\bCampaign\b/i.test(pageText))) {
                electionNightThemeSessionActive = false;
                electionNightThemeLastScreenSeenAt = 0;
            }
            return;
        }
        if(!electionNightThemeEnabled) {
            pauseElectionNightTheme();
            return;
        }
        if(!optionsOpenedFromElectionNight && isElectionNightPlaybackPaused()) {
            pauseElectionNightTheme();
            return;
        }
        const audio = ensureElectionNightThemeAudio();
        if(!audio || !audio.paused || electionNightThemePlayPending) return;
        audio.playbackRate = 1;
        electionNightThemePlayPending = true;
        const playResult = audio.play();
        if(playResult?.then) {
            playResult.then(() => {
                electionNightThemePlayPending = false;
            }).catch(error => {
                electionNightThemePlayPending = false;
                globalThis.bmElectionNightThemeError = error;
            });
        } else {
            electionNightThemePlayPending = false;
        }
    };
    const handleElectionNightThemeClick = () => {
        if(modShuttingDown) return;
        if(electionNightThemeClickTimer) clearTimeout(electionNightThemeClickTimer);
        electionNightThemeClickTimer = setTimeout(() => {
            electionNightThemeClickTimer = null;
            if(!modShuttingDown) syncElectionNightTheme();
        }, 0);
    };
    const installElectionNightTheme = () => {
        if(modShuttingDown || electionNightThemeMonitor || typeof Audio !== "function") return;
        electionNightThemeEnabled = readElectionNightThemeEnabled();
        ensureElectionNightThemeOptionControl();
        electionNightThemeMonitor = setInterval(() => {
            if(!modShuttingDown) syncElectionNightTheme();
        }, 350);
        document.addEventListener("click", handleElectionNightThemeClick, true);
        syncElectionNightTheme();
    };
    const injectMsnbcElectionPanelStyles = () => {
        if(msnbcElectionPanelStylesInjected || !document.head) return;
        msnbcElectionPanelStylesInjected = true;
        const style = document.createElement("style");
        style.id = "bm-msnbc-election-panel-style";
        style.textContent = `
            #bm-msnbc-election-btn {
                position: fixed;
                left: 18px;
                right: auto;
                bottom: 18px;
                z-index: 2147483646;
                border: 0;
                border-radius: 8px;
                padding: 10px 15px;
                color: #fff;
                background: #111827;
                box-shadow: 0 4px 14px rgba(0,0,0,0.32);
                font-family: "Oswald", Arial, sans-serif;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }
            #bm-msnbc-election-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                background: rgba(4,9,18,0.68);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: "Oswald", Arial, sans-serif;
            }
            #bm-msnbc-election-overlay *,
            #bm-msnbc-poll-overlay,
            #bm-msnbc-poll-overlay * {
                font-family: "Oswald", Arial, sans-serif !important;
            }
            #bm-msnbc-election-panel {
                width: 100%;
                height: 100%;
                max-width: none;
                max-height: none;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                background: #d9e0e3;
                box-sizing: border-box;
            }
            .bm-msnbc-election-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 12px 16px;
                color: #fff;
                background: linear-gradient(90deg, #163c80, #990000);
            }
            .bm-msnbc-election-title {
                font-size: 25px;
                font-weight: 900;
                letter-spacing: 0;
                text-transform: uppercase;
            }
            .bm-msnbc-election-close {
                border: 1px solid #fff;
                color: #fff;
                background: rgba(0,0,0,0.25);
                padding: 7px 12px;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }
            .bm-msnbc-tabs {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #cfd7da;
                border-bottom: 1px solid #b5c0c5;
            }
            .bm-msnbc-tabs.hidden {
                display: none;
            }
            .bm-msnbc-tabs.compact {
                justify-content: space-between;
            }
            .bm-msnbc-tab {
                border: 0;
                color: #0b1420;
                background: #eff3f5;
                padding: 8px 13px;
                font-size: 14px;
                font-weight: 900;
                text-transform: uppercase;
                cursor: pointer;
            }
            .bm-msnbc-tab.active {
                color: #fff;
                background: #111827;
            }
            .bm-msnbc-tab[disabled] {
                opacity: 0.45;
                cursor: default;
            }
            .bm-msnbc-back-btn {
                border: 0;
                color: #fff;
                background: #111827;
                padding: 8px 14px;
                font-size: 14px;
                font-weight: 900;
                text-transform: uppercase;
                cursor: pointer;
            }
            .bm-msnbc-view-label {
                color: #172536;
                font-size: 16px;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-body {
                flex: 1 1 auto;
                display: grid;
                grid-template-columns: 392px 1fr 86px;
                gap: 0;
                min-height: 0;
                background: #dce4e7;
            }
            .bm-msnbc-candidates {
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
                background: #dbe2e5;
                border-right: 1px solid #aab5ba;
            }
            .bm-msnbc-candidate-list {
                flex: 1 1 auto;
                min-height: 0;
                overflow-x: hidden;
                overflow-y: auto;
                overscroll-behavior: contain;
                scrollbar-gutter: stable;
                scrollbar-color: #71808a #d5dee2;
                scrollbar-width: thin;
            }
            .bm-msnbc-candidate-list::-webkit-scrollbar {
                width: 10px;
            }
            .bm-msnbc-candidate-list::-webkit-scrollbar-track {
                background: #d5dee2;
            }
            .bm-msnbc-candidate-list::-webkit-scrollbar-thumb {
                background: #71808a;
                border: 2px solid #d5dee2;
                border-radius: 8px;
            }
            .bm-msnbc-office-title {
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                padding: 12px 10px;
                color: #111;
                background: #eef3f5;
                border-bottom: 1px solid #b7c1c6;
                font-size: 31px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-office-name {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .bm-msnbc-needed {
                flex: 0 0 auto;
                min-width: 0;
                font-size: 20px;
                color: #69747a;
                text-align: right;
                text-transform: uppercase;
                white-space: nowrap;
            }
            .bm-msnbc-needed:empty {
                display: none;
            }
            .bm-msnbc-battleground {
                display: inline-block;
                color: #111;
                background: #ffd51a;
                padding: 5px 8px;
                font-size: 15px;
                line-height: 1;
                font-weight: 900;
                vertical-align: middle;
            }
            .bm-msnbc-scope-label {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 7px 14px;
                color: #1b2a36;
                background: #d5dee2;
                border-bottom: 1px solid #aeb9bf;
                font-size: 20px;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-reporting {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                min-width: 78px;
                color: #111;
                font-size: 17px;
                line-height: 1;
                white-space: nowrap;
            }
            .bm-msnbc-reporting-bar {
                width: 66px;
                height: 5px;
                margin-top: 5px;
                background: #aeb6ba;
                border-top: 1px solid rgba(0,0,0,0.2);
            }
            .bm-msnbc-reporting-fill {
                display: block;
                height: 100%;
                background: #f2cf20;
            }
            .bm-msnbc-call-status {
                padding: 6px 14px;
                color: #111;
                background: #ffd51a;
                font-size: 18px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-candidate-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 108px;
                min-height: clamp(92px, calc((100vh - 270px) / 3), 112px);
                border-bottom: 1px solid #a9b3b8;
                background: #eef2f4;
            }
            .bm-msnbc-candidate-row.no-results {
                grid-template-columns: 1fr;
            }
            .bm-msnbc-candidate-row.D .bm-msnbc-name-block { background: #0487E6; }
            .bm-msnbc-candidate-row.R .bm-msnbc-name-block { background: #DD2929; }
            .bm-msnbc-candidate-row.I .bm-msnbc-name-block { background: #777; }
            .bm-msnbc-name-block {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: center;
                padding: 12px;
                color: #fff;
                font-size: 31px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
                overflow: hidden;
                white-space: nowrap;
            }
            .bm-msnbc-projected-winner-mark {
                position: absolute;
                top: 8px;
                left: 8px;
                z-index: 2;
                margin: 0;
            }
            .bm-msnbc-name-block[data-full-name]:hover::after {
                content: attr(data-full-name);
                position: absolute;
                left: 14px;
                top: 12px;
                z-index: 30;
                max-width: min(310px, calc(100% - 28px));
                padding: 8px 11px;
                color: #f8fbff;
                background: rgba(12,25,38,0.96);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 4px;
                box-shadow: 0 10px 24px rgba(0,0,0,0.34);
                font-family: Arial, sans-serif;
                font-size: 16px;
                font-weight: 900;
                line-height: 1.05;
                letter-spacing: 0;
                text-align: left;
                text-transform: uppercase;
                white-space: normal;
                pointer-events: none;
            }
            .bm-msnbc-name-line {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                max-width: 100%;
                min-width: 0;
            }
            .bm-msnbc-candidate-name {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                cursor: help;
            }
            .bm-msnbc-vote-difference {
                position: absolute;
                right: 12px;
                bottom: 14px;
                max-width: 100%;
                font-size: 15px;
                line-height: 1;
                font-weight: 500;
                text-transform: none;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .bm-msnbc-stat-block {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 0 8px;
                background: #f5f7f8;
                color: #102333;
                font-weight: 900;
                text-align: center;
            }
            .bm-msnbc-percent {
                font-size: 29px;
                line-height: 1;
            }
            .bm-msnbc-votes {
                margin-top: 10px;
                font-size: 15px;
                color: #50616c;
            }
            .bm-msnbc-map-wrap {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #263746;
                min-height: 0;
                overflow: hidden;
            }
            .bm-msnbc-map-needed {
                position: absolute;
                top: 14px;
                right: 22px;
                z-index: 3;
                color: #d5dde1;
                font-size: 20px;
                line-height: 1;
                font-weight: 900;
                letter-spacing: 0;
                text-transform: uppercase;
                text-align: right;
            }
            .bm-msnbc-map-wrap svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            .bm-msnbc-map-wrap path,
            .bm-msnbc-map-wrap polygon {
                stroke: #91a1ad !important;
                stroke-width: 1.5 !important;
                cursor: pointer;
            }
            .bm-msnbc-history-toggle {
                position: absolute;
                left: 10px;
                bottom: 10px;
                z-index: 7;
                width: 28px;
                height: 26px;
                border: 0;
                color: #fff;
                background: rgba(12,24,36,0.78);
                font-size: 18px;
                font-weight: 900;
                cursor: pointer;
            }
            .bm-msnbc-history-panel {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                z-index: 4;
                display: flex;
                align-items: stretch;
                gap: 0;
                padding: 0;
                background: rgba(38,55,70,0.78);
                border-left: 1px solid rgba(160,174,184,0.42);
                box-shadow: 5px 0 12px rgba(0,0,0,0.18);
            }
            .bm-msnbc-history-close {
                position: absolute;
                right: 7px;
                top: 5px;
                width: 18px;
                height: 18px;
                border: 0;
                color: #263746;
                background: transparent;
                font-family: Arial, sans-serif;
                font-size: 19px;
                font-weight: 900;
                line-height: 16px;
                cursor: pointer;
                opacity: 0.9;
            }
            .bm-msnbc-history-close:hover {
                color: #990000;
                opacity: 1;
            }
            .bm-msnbc-history-card {
                position: relative;
                width: 128px;
                min-height: 100%;
                box-sizing: border-box;
                color: #111;
                background: rgba(238,243,245,0.92);
                border-right: 1px solid rgba(150,165,176,0.55);
                box-shadow: 4px 0 9px rgba(38,55,70,0.13);
                font-weight: 900;
                text-transform: uppercase;
                align-self: stretch;
                display: flex;
                flex-direction: column;
            }
            .bm-msnbc-history-title {
                box-sizing: border-box;
                min-height: var(--bm-msnbc-history-header-height, 74px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 8px 22px 8px 22px;
                color: #3f4b52;
                background: #d5dde1;
                font-size: 13px;
                line-height: 1;
                text-align: center;
                white-space: nowrap;
            }
            .bm-msnbc-history-total {
                margin-top: 4px;
                color: #52636e;
                font-size: 11px;
                line-height: 1;
                font-weight: 900;
                white-space: nowrap;
            }
            .bm-msnbc-history-heading {
                white-space: nowrap;
            }
            .bm-msnbc-history-row {
                position: relative;
                box-sizing: border-box;
                min-height: var(--bm-msnbc-history-row-height, 112px);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 10px 8px;
                border-top: 1px solid #c2cbd0;
                text-align: center;
            }
            .bm-msnbc-history-row[data-full-name]:hover::after {
                content: attr(data-full-name);
                position: absolute;
                left: 50%;
                top: 11px;
                z-index: 30;
                max-width: 220px;
                padding: 7px 10px;
                color: #f8fbff;
                background: rgba(12,25,38,0.96);
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 4px;
                box-shadow: 0 10px 22px rgba(0,0,0,0.34);
                font-family: Arial, sans-serif;
                font-size: 13px;
                font-weight: 900;
                line-height: 1.05;
                letter-spacing: 0;
                text-align: center;
                text-transform: uppercase;
                white-space: normal;
                transform: translateX(-50%);
                pointer-events: none;
            }
            .bm-msnbc-history-row.winner {
                color: #fff;
                border-top-color: rgba(255,255,255,0.22);
            }
            .bm-msnbc-history-row.winner.D { background: #0487E6; }
            .bm-msnbc-history-row.winner.R { background: #DD2929; }
            .bm-msnbc-history-row.winner.I { background: #777; }
            .bm-msnbc-history-row.winner .bm-msnbc-history-votes {
                color: rgba(255,255,255,0.88);
                border-top-color: rgba(255,255,255,0.34);
            }
            .bm-msnbc-history-row.D { color: #0487E6; }
            .bm-msnbc-history-row.R { color: #DD2929; }
            .bm-msnbc-history-row.I { color: #666666; }
            .bm-msnbc-history-row.winner.D,
            .bm-msnbc-history-row.winner.R,
            .bm-msnbc-history-row.winner.I { color: #fff; }
            .bm-msnbc-history-name {
                font-size: 19px;
                line-height: 1;
                width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                cursor: help;
            }
            .bm-msnbc-history-pct {
                margin-top: 4px;
                font-size: 24px;
                line-height: 1;
                width: 100%;
            }
            .bm-msnbc-history-votes {
                margin-top: 5px;
                padding-top: 4px;
                color: #53606a;
                font-size: 13px;
                line-height: 1;
                border-top: 2px solid rgba(83,96,106,0.35);
                min-width: 58px;
                width: max-content;
                max-width: 92px;
                text-align: center;
            }
            .bm-msnbc-years {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 7px;
                padding: 12px 8px;
                background: #16212d;
                border-left: 1px solid #344556;
            }
            .bm-msnbc-year-btn {
                width: 68px;
                border: 0;
                padding: 7px 0;
                color: #fff;
                background: #344556;
                font-size: 13px;
                font-weight: 900;
                cursor: pointer;
            }
            .bm-msnbc-year-btn.active {
                color: #111;
                background: #f2d22e;
            }
            .bm-msnbc-empty {
                padding: 40px;
                font-size: 20px;
                font-weight: 900;
                color: #111;
            }
            .bm-msnbc-body.hub,
            .bm-msnbc-body.road,
            .bm-msnbc-body.board,
            .bm-msnbc-body.vote-office {
                display: block;
                overflow: hidden;
                background: #e2e8ea;
            }
            .bm-msnbc-hub {
                box-sizing: border-box;
                height: 100%;
                padding: 22px 28px 28px;
                background: #dfe6e8;
            }
            .bm-msnbc-hub-grid {
                height: 100%;
                display: grid;
                grid-template-columns: 1fr 1fr 1.18fr 0.9fr 0.9fr;
                grid-template-rows: 1fr 1fr;
                gap: 10px;
            }
            .bm-msnbc-hub-tile {
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                align-items: stretch;
                border: 2px solid #c5ced2;
                background: #eef3f5;
                color: #0b1420;
                padding: 18px;
                overflow: hidden;
                text-align: left;
                font-family: Arial, sans-serif;
                cursor: pointer;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45), 0 1px 4px rgba(0,0,0,0.15);
            }
            .bm-msnbc-hub-tile:hover {
                border-color: #83929a;
                background: #f7fafb;
            }
            .bm-msnbc-hub-tile::before {
                content: "";
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                height: 5px;
                background: #163c80;
            }
            .bm-msnbc-hub-tile:nth-child(2n)::before {
                background: #990000;
            }
            .bm-msnbc-hub-tile.main {
                grid-column: span 2;
            }
            .bm-msnbc-hub-tile.large {
                grid-column: span 2;
            }
            .bm-msnbc-hub-tile.wide {
                grid-column: span 2;
            }
            .bm-msnbc-hub-tile.compact-title {
                padding-left: 14px;
                padding-right: 14px;
            }
            .bm-msnbc-hub-tile-title {
                position: relative;
                z-index: 2;
                max-width: calc(100% - 8px);
                color: #111;
                font-size: 26px;
                line-height: 1.04;
                font-weight: 900;
                text-transform: uppercase;
                white-space: normal;
                overflow-wrap: normal;
            }
            .bm-msnbc-hub-tile.compact-title .bm-msnbc-hub-tile-title {
                max-width: 100%;
                font-size: 24px;
                line-height: 1.03;
            }
            .bm-msnbc-hub-tile.stacked-title .bm-msnbc-hub-tile-title {
                white-space: pre-line;
            }
            .bm-msnbc-hub-tile.main .bm-msnbc-hub-tile-title,
            .bm-msnbc-hub-tile.large .bm-msnbc-hub-tile-title,
            .bm-msnbc-hub-tile.wide .bm-msnbc-hub-tile-title {
                font-size: 29px;
            }
            .bm-msnbc-hub-tile-sub {
                position: relative;
                z-index: 2;
                margin-top: 8px;
                max-width: calc(100% - 16px);
                color: #54636b;
                font-size: 14px;
                line-height: 1.15;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-hub-mark {
                position: absolute;
                right: 16px;
                bottom: 12px;
                color: rgba(19,136,216,0.22);
                font-size: 88px;
                line-height: 1;
                font-weight: 900;
            }
            .bm-msnbc-hub-bars {
                position: absolute;
                left: 18px;
                bottom: 20px;
                display: flex;
                gap: 7px;
                align-items: flex-end;
                z-index: 2;
            }
            .bm-msnbc-hub-bars span {
                display: block;
                width: 19px;
                background: #0487E6;
            }
            .bm-msnbc-hub-bars span:nth-child(2n) { background: #DD2929; }
            .bm-msnbc-hub-bars span:nth-child(1) { height: 44px; }
            .bm-msnbc-hub-bars span:nth-child(2) { height: 68px; }
            .bm-msnbc-hub-bars span:nth-child(3) { height: 54px; }
            .bm-msnbc-hub-bars span:nth-child(4) { height: 82px; }
            .bm-msnbc-vote-office {
                box-sizing: border-box;
                height: 100%;
                display: grid;
                grid-template-rows: auto minmax(0, 1fr);
                padding: 22px 32px 30px;
                color: #101820;
                background: #dfe6e8;
            }
            .bm-msnbc-vote-office-toolbar {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 28px;
                padding: 0 0 16px;
                border-bottom: 5px solid #172536;
            }
            .bm-msnbc-vote-office-heading {
                font-size: 31px;
                line-height: 0.95;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-vote-office-heading small {
                display: block;
                margin-top: 9px;
                color: #53646e;
                font-size: 14px;
                line-height: 1;
                font-weight: 900;
            }
            .bm-msnbc-vote-office-select-wrap {
                display: flex;
                flex-direction: column;
                gap: 5px;
                min-width: 230px;
                color: #53646e;
                font-size: 12px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-vote-office-select {
                width: 100%;
                border: 2px solid #172536;
                border-radius: 0;
                padding: 8px 34px 8px 10px;
                color: #101820;
                background: #f4f7f8;
                font-size: 18px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
                cursor: pointer;
            }
            .bm-msnbc-vote-office-content {
                min-height: 0;
                display: grid;
                grid-template-columns: minmax(390px, 0.9fr) minmax(470px, 1.1fr);
                align-items: center;
                gap: 58px;
                padding: 28px 26px 16px;
            }
            .bm-msnbc-vote-office-name {
                margin-bottom: 16px;
                color: #172536;
                font-size: 52px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-vote-office-rows {
                border-top: 1px solid #aeb9be;
            }
            .bm-msnbc-vote-office-row {
                display: grid;
                grid-template-columns: 130px minmax(150px, 1fr) 92px;
                align-items: baseline;
                gap: 18px;
                padding: 15px 0 13px;
                border-bottom: 1px solid #aeb9be;
            }
            .bm-msnbc-vote-office-party {
                font-size: 25px;
                line-height: 1;
                font-weight: 900;
            }
            .bm-msnbc-vote-office-row.D .bm-msnbc-vote-office-party,
            .bm-msnbc-vote-office-row.D .bm-msnbc-vote-office-pct { color: #0487E6; }
            .bm-msnbc-vote-office-row.R .bm-msnbc-vote-office-party,
            .bm-msnbc-vote-office-row.R .bm-msnbc-vote-office-pct { color: #DD2929; }
            .bm-msnbc-vote-office-row.I .bm-msnbc-vote-office-party,
            .bm-msnbc-vote-office-row.I .bm-msnbc-vote-office-pct { color: #686f73; }
            .bm-msnbc-vote-office-votes {
                font-size: 28px;
                line-height: 1;
                font-weight: 700;
                text-align: right;
            }
            .bm-msnbc-vote-office-pct {
                font-size: 29px;
                line-height: 1;
                font-weight: 900;
                text-align: right;
            }
            .bm-msnbc-vote-office-visual {
                min-width: 0;
            }
            .bm-msnbc-vote-office-margin {
                margin-bottom: 18px;
                color: #172536;
                font-size: 54px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-vote-office-margin.D { color: #0487E6; }
            .bm-msnbc-vote-office-margin.R { color: #DD2929; }
            .bm-msnbc-vote-office-margin.tie { color: #686f73; }
            .bm-msnbc-vote-office-bar {
                height: 62px;
                display: flex;
                overflow: hidden;
                border: 4px solid #172536;
                background: #c8d0d4;
            }
            .bm-msnbc-vote-office-segment {
                height: 100%;
                min-width: 0;
            }
            .bm-msnbc-vote-office-segment.D { background: #0487E6; }
            .bm-msnbc-vote-office-segment.R { background: #DD2929; }
            .bm-msnbc-vote-office-segment.I { background: #777777; }
            .bm-msnbc-vote-office-legend {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-top: 11px;
                color: #53646e;
                font-size: 15px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-vote-office-empty {
                grid-column: 1 / -1;
                align-self: center;
                color: #53646e;
                font-size: 25px;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-road-layout {
                height: 100%;
                display: grid;
                grid-template-columns: 285px 1fr;
                min-height: 0;
                background: #263746;
            }
            .bm-msnbc-road-score {
                display: grid;
                grid-template-rows: auto minmax(0, 1fr);
                background: #223243;
                border-right: 1px solid #475865;
                min-height: 0;
            }
            .bm-msnbc-road-logo {
                grid-column: 1 / -1;
                padding: 13px 12px;
                color: #eef3f5;
                background: #172536;
                font-size: 29px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-road-needed-fixed {
                grid-column: 1 / -1;
                padding: 10px 8px 8px;
                color: #ffd51a;
                background: #1a2939;
                border-top: 1px solid rgba(255,255,255,0.08);
                font-size: 21px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
            }
            .bm-msnbc-road-candidate {
                position: relative;
                color: #fff;
                font-weight: 900;
                text-transform: uppercase;
                overflow: hidden;
            }
            .bm-msnbc-road-race {
                position: relative;
                grid-column: 1 / -1;
                display: grid;
                grid-template-rows: 108px 38px 94px 1fr;
                min-height: 0;
                background: #1a2939;
            }
            .bm-msnbc-road-heads,
            .bm-msnbc-road-score-row,
            .bm-msnbc-road-bar-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                min-width: 0;
            }
            .bm-msnbc-road-heads {
                background: #223243;
            }
            .bm-msnbc-road-head {
                position: relative;
                min-width: 0;
                min-height: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border-right: 1px solid rgba(255,255,255,0.14);
                overflow: hidden;
            }
            .bm-msnbc-road-head:last-child,
            .bm-msnbc-road-score-cell:last-child,
            .bm-msnbc-road-bar-cell:last-child {
                border-right: 0;
            }
            .bm-msnbc-road-portrait {
                width: 78px;
                height: 78px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #5b6c78;
                border: 2px solid rgba(255,255,255,0.22);
                overflow: hidden;
            }
            .bm-msnbc-road-portrait img {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: contain;
                object-position: center bottom;
                image-rendering: auto;
            }
            .bm-msnbc-road-head.D .bm-msnbc-road-portrait { background: #0487E6; }
            .bm-msnbc-road-head.R .bm-msnbc-road-portrait { background: #DD2929; }
            .bm-msnbc-road-head.I .bm-msnbc-road-portrait { background: #777; }
            .bm-msnbc-road-name-strip {
                display: grid;
                grid-template-columns: 1fr 1fr;
            }
            .bm-msnbc-road-name {
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 0;
                padding: 8px 7px;
                color: #fff;
                font-size: 18px;
                line-height: 1;
                font-weight: 900;
                text-align: center;
                text-transform: uppercase;
                white-space: normal;
                overflow-wrap: anywhere;
                border-right: 1px solid rgba(255,255,255,0.18);
            }
            .bm-msnbc-road-name:last-child {
                border-right: 0;
            }
            .bm-msnbc-road-name.D { background: #0487E6; }
            .bm-msnbc-road-name.R { background: #DD2929; }
            .bm-msnbc-road-name.I { background: #777; }
            .bm-msnbc-road-score-row {
                position: relative;
                align-items: end;
                background: #203244;
                border-bottom: 2px dotted rgba(255,255,255,0.76);
            }
            .bm-msnbc-road-score-cell {
                min-width: 0;
                padding: 12px 4px 15px;
                color: #fff;
                border-right: 1px solid rgba(255,255,255,0.14);
                font-size: 54px;
                line-height: 0.92;
                font-weight: 900;
                text-align: center;
                text-shadow: 0 2px 5px rgba(0,0,0,0.42);
            }
            .bm-msnbc-road-bar-row {
                position: relative;
                min-height: 0;
                background: #172536;
            }
            .bm-msnbc-road-bar-cell {
                position: relative;
                min-width: 0;
                min-height: 0;
                border-right: 1px solid rgba(255,255,255,0.14);
                overflow: hidden;
            }
            .bm-msnbc-road-fill {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: var(--bm-msnbc-road-fill, 0%);
                min-height: 8px;
                opacity: 0.96;
                transition: height 180ms ease-out;
            }
            .bm-msnbc-road-fill.D { background: #0487E6; }
            .bm-msnbc-road-fill.R { background: #DD2929; }
            .bm-msnbc-road-fill.I { background: #777; }
            .bm-msnbc-road-candidate.D .bm-msnbc-road-fill { background: #0487E6; }
            .bm-msnbc-road-candidate.R .bm-msnbc-road-fill { background: #DD2929; }
            .bm-msnbc-road-candidate.I .bm-msnbc-road-fill { background: #777; }
            .bm-msnbc-road-270-line {
                position: absolute;
                left: 0;
                right: 0;
                top: 240px;
                z-index: 3;
                pointer-events: none;
            }
            .bm-msnbc-road-270-badge {
                position: absolute;
                left: 50%;
                top: -14px;
                transform: translateX(-50%);
                padding: 3px 7px;
                color: #ffd51a;
                background: #111827;
                border: 1px solid rgba(255,213,26,0.45);
                font-size: 17px;
                font-weight: 900;
                text-align: center;
            }
            .bm-msnbc-road-needed {
                display: none;
            }
            .bm-msnbc-road-map {
                position: relative;
                min-width: 0;
                min-height: 0;
            }
            .bm-msnbc-road-subnav {
                position: absolute;
                top: 14px;
                right: 16px;
                z-index: 5;
            }
            .bm-msnbc-road-subnav button {
                border: 0;
                padding: 9px 12px;
                color: #111;
                background: #ffd51a;
                font-size: 14px;
                font-weight: 900;
                text-transform: uppercase;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(0,0,0,0.28);
            }
            .bm-msnbc-road-map .bm-msnbc-map-wrap {
                height: 100%;
            }
            .bm-msnbc-board {
                box-sizing: border-box;
                height: 100%;
                padding: 16px 28px 24px;
                overflow: auto;
                color: #101820;
                background: #eef2f4;
            }
            .bm-msnbc-board-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding-bottom: 12px;
                border-bottom: 8px solid #3c3c3c;
                font-size: 31px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-board-subtitle {
                color: #5c676e;
                font-size: 15px;
                font-weight: 900;
            }
            .bm-msnbc-bg-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px 28px;
                margin-top: 22px;
            }
            .bm-msnbc-bg-row {
                display: grid;
                grid-template-columns: minmax(214px, 0.95fr) minmax(168px, 1.15fr) 58px;
                align-items: stretch;
                min-height: 46px;
                background: #fff;
                border: 1px solid #c3ccd0;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-bg-row.poll {
                grid-template-columns: minmax(168px, 0.62fr) minmax(220px, 1.38fr);
            }
            .bm-msnbc-bg-row.poll .bm-msnbc-bg-state {
                grid-template-columns: minmax(0, 1fr) 54px;
                padding-right: 14px;
            }
            .bm-msnbc-bg-state {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 26px;
                align-items: center;
                gap: 6px;
                min-width: 0;
                padding: 0 9px;
                color: #5d656b;
                font-size: 24px;
                line-height: 1;
                overflow: hidden;
            }
            .bm-msnbc-bg-state-name {
                min-width: 0;
                line-height: 0.95;
                white-space: normal;
            }
            .bm-msnbc-bg-state-name.compact {
                font-size: 21px;
            }
            .bm-msnbc-bg-state small {
                flex: 0 0 auto;
                margin-left: 0;
                color: #8a9297;
                font-size: 15px;
                text-align: right;
            }
            .bm-msnbc-bg-leader {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 0 10px;
                color: #fff;
                font-size: 23px;
                line-height: 1;
            }
            .bm-msnbc-bg-leader.center {
                justify-content: center;
                text-align: center;
            }
            .bm-msnbc-bg-leader.D { background: #0487E6; }
            .bm-msnbc-bg-leader.R { background: #DD2929; }
            .bm-msnbc-bg-leader.I { background: #777; }
            .bm-msnbc-bg-leader.tie { background: #777; }
            .bm-msnbc-bg-leader.pending { background: #777; }
            .bm-msnbc-bg-report {
                display: flex;
                align-items: center;
                justify-content: center;
                color: #333;
                background: #f4f6f7;
                font-size: 17px;
                line-height: 0.95;
                text-align: center;
            }
            .bm-msnbc-senate-control {
                height: 100%;
                display: grid;
                grid-template-columns: 1fr;
                align-items: center;
                justify-items: center;
                padding: 12px 18px 18px;
                box-sizing: border-box;
                background:
                    radial-gradient(circle at 18% 20%, rgba(255,255,255,0.85) 0 2px, transparent 2.5px),
                    radial-gradient(circle at 78% 28%, rgba(255,255,255,0.75) 0 2px, transparent 2.5px),
                    linear-gradient(180deg, #eef2f4, #e3eaee);
                background-size: 150px 150px, 220px 220px, auto;
            }
            .bm-msnbc-senate-card {
                width: min(1040px, calc(100% - 16px));
                height: min(560px, calc(100% - 10px));
                display: flex;
                flex-direction: column;
                border: 2px solid #c2ccd1;
                background: rgba(255,255,255,0.96);
                padding: 18px 30px 22px;
                text-align: center;
                box-shadow: 0 14px 30px rgba(26,36,45,0.16), inset 0 1px 0 rgba(255,255,255,0.88);
            }
            .bm-msnbc-senate-title {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 10px;
                color: #111;
                font-size: 40px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
            }
            .bm-msnbc-senate-seat-total {
                color: #9aa2a7;
                font-size: 23px;
                font-weight: 900;
            }
            .bm-msnbc-senate-bars {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 108px minmax(0, 1fr);
                align-items: stretch;
                column-gap: 10px;
                margin: 0 auto 34px;
                max-width: 900px;
                width: 100%;
            }
            .bm-msnbc-senate-party-bar {
                display: flex;
                align-items: center;
                min-height: 58px;
                color: #fff;
                font-size: 38px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
                box-shadow: 0 8px 16px rgba(25,32,40,0.18);
            }
            .bm-msnbc-senate-party-bar.D { background: #0487E6; }
            .bm-msnbc-senate-party-bar.R { background: #DD2929; }
            .bm-msnbc-senate-party-letter {
                font-size: 38px;
                padding: 0 18px;
            }
            .bm-msnbc-senate-party-bar.R .bm-msnbc-senate-party-letter {
                margin-left: auto;
            }
            .bm-msnbc-senate-party-count {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 52px;
                height: 44px;
                padding: 0 6px;
                color: inherit;
                background: #fff;
                font-size: 34px;
                line-height: 1;
            }
            .bm-msnbc-senate-party-bar.D .bm-msnbc-senate-party-count {
                margin-left: auto;
                margin-right: 12px;
            }
            .bm-msnbc-senate-party-bar.R .bm-msnbc-senate-party-count {
                margin-left: 12px;
                margin-right: 6px;
            }
            .bm-msnbc-senate-party-bar.D .bm-msnbc-senate-party-count { color: #0487E6; }
            .bm-msnbc-senate-party-bar.R .bm-msnbc-senate-party-count { color: #DD2929; }
            .bm-msnbc-senate-separator {
                display: none;
            }
            .bm-msnbc-senate-win {
                display: none;
                flex: 0 0 16px;
                margin-right: 8px;
            }
            .bm-msnbc-senate-win.visible {
                display: inline-block;
            }
            .bm-msnbc-senate-undecided {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #3a3a3a;
                font-size: 13px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
                text-align: center;
                pointer-events: none;
                transform: translateY(3px);
            }
            .bm-msnbc-senate-undecided strong {
                font-size: 30px;
                line-height: 1;
            }
            .bm-msnbc-senate-control-call {
                align-self: center;
                margin: -20px auto 8px;
                padding: 8px 18px 7px;
                color: #fff;
                font-size: 21px;
                line-height: 1;
                font-weight: 900;
                letter-spacing: 0.02em;
                text-transform: uppercase;
                box-shadow: 0 5px 12px rgba(25,32,40,0.18);
            }
            .bm-msnbc-senate-control-call.D { background: #0487E6; }
            .bm-msnbc-senate-control-call.R { background: #DD2929; }
            .bm-msnbc-senate-arc {
                position: relative;
                flex: 0 0 440px;
                width: min(1080px, 98%);
                min-height: 440px;
                margin: -42px auto 0;
                overflow: visible;
                border-bottom: 1px solid rgba(0,0,0,0.08);
            }
            .bm-msnbc-senate-chamber {
                position: absolute;
                left: 50%;
                bottom: 14px;
                width: min(1040px, 96%);
                max-width: 100%;
                height: 440px;
                transform: translateX(-50%);
            }
            .bm-msnbc-senate-svg,
            .bm-msnbc-house-svg {
                width: 100%;
                height: 100%;
                display: block;
                overflow: visible;
            }
            .bm-msnbc-house-card .bm-msnbc-senate-bars {
                margin-bottom: 6px;
            }
            .bm-msnbc-house-card .bm-msnbc-senate-control-call {
                margin: 4px auto 8px;
            }
            .bm-msnbc-house-card .bm-msnbc-senate-arc {
                flex-basis: 440px;
                min-height: 440px;
                margin: -34px auto 0;
                width: min(1040px, 98%);
            }
            .bm-msnbc-house-card .bm-msnbc-senate-chamber {
                bottom: 8px;
                width: min(1040px, 98%);
                height: 440px;
            }
            .bm-msnbc-senate-seat-segment {
                opacity: 0;
                animation: bmMsnbcSenateSeatIn 420ms ease-out forwards;
                animation-delay: var(--bm-seat-delay, 0ms);
                transform-origin: 550px 400px;
            }
            .bm-msnbc-senate-seat-top {
                transition: filter 120ms ease, opacity 120ms ease;
            }
            .bm-msnbc-senate-seat-hit:hover .bm-msnbc-senate-seat-top {
                filter: brightness(1.08);
            }
            @keyframes bmMsnbcSenateSeatIn {
                from { opacity: 0; transform: translateY(22px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #bm-msnbc-poll-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,0.50);
                font-family: Georgia, "Times New Roman", serif;
            }
            #bm-msnbc-poll-panel {
                position: relative;
                width: min(1290px, calc(100vw - 22px));
                height: min(735px, calc(100vh - 22px));
                box-sizing: border-box;
                overflow: auto;
                padding: 8px 22px 24px;
                color: #000;
                background: #eeeeee;
                border: 1px solid #777;
                box-shadow: 0 10px 26px rgba(0,0,0,0.38);
            }
            .bm-msnbc-poll-close {
                position: sticky;
                top: 0;
                float: right;
                z-index: 5;
                width: 36px;
                height: 36px;
                border: 2px solid #990000;
                border-radius: 3px;
                color: #000;
                background: #ff2020;
                font-family: Georgia, "Times New Roman", serif;
                font-size: 25px;
                font-weight: 900;
                line-height: 30px;
                cursor: pointer;
            }
            .bm-msnbc-poll-title {
                margin: 0 46px 4px 0;
                text-align: center;
                font-size: 25px;
                line-height: 1.05;
                font-weight: 900;
            }
            .bm-msnbc-poll-chart-shell {
                width: calc(100% - 84px);
                margin: 4px auto 8px;
                border: 1px solid #000;
                border-radius: 8px;
                background: #eeeeee;
            }
            .bm-msnbc-poll-chart {
                display: block;
                width: 100%;
                height: 500px;
                cursor: crosshair;
            }
            .bm-msnbc-poll-week-title {
                margin: 8px 42px 4px;
                font-size: 26px;
                line-height: 1;
                font-weight: 900;
            }
            .bm-msnbc-poll-table {
                width: calc(100% - 84px);
                margin: 0 auto 8px;
                border-collapse: collapse;
                background: #d8d8d8;
                font-size: 22px;
                line-height: 1.05;
            }
            .bm-msnbc-poll-table th,
            .bm-msnbc-poll-table td {
                border: 1px solid #000;
                padding: 2px 4px;
                text-align: left;
            }
            .bm-msnbc-poll-table th {
                font-weight: 900;
            }
            .bm-msnbc-poll-table .party-D { color: #0487E6; }
            .bm-msnbc-poll-table .party-R { color: #DD2929; }
            .bm-msnbc-poll-table .party-I { color: #555555; }
        `;
        document.head.appendChild(style);
    };
    const getPanelCandidateName = (candidate) => {
        const raw = String(candidate?.name || "");
        const pieces = raw.trim().split(/\s+/).filter(Boolean);
        return pieces.length ? pieces[pieces.length - 1] : raw;
    };
    const getPanelCandidateInitials = (candidate) => {
        const raw = String(candidate?.name || "");
        const pieces = raw.trim().split(/\s+/).filter(Boolean);
        const sourcePieces = pieces.length > 1 ? [pieces[0], pieces[pieces.length - 1]] : pieces;
        return sourcePieces
            .map(piece => piece.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2) || "?";
    };
    const isMsnbcCandidateIncumbent = (candidate) => {
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        const candidateName = getMsnbcCandidateDisplayName(candidate);
        return candidate?.incumbent === true
            || candidate?.incumbent === 1
            || String(candidate?.incumbent || "").toLowerCase() === "true"
            || candidate?.isIncumbent === true
            || candidate?.inc === true
            || candidate?.incumb === true
            || /\*$/.test(String(candidate?.name || candidate?.fullName || candidateName || "").trim())
            || wrapped?.incumbent === true
            || wrapped?.incumbent === 1
            || String(wrapped?.incumbent || "").toLowerCase() === "true"
            || wrapped?.isIncumbent === true
            || wrapped?.inc === true
            || wrapped?.incumb === true
            || /\*$/.test(String(wrapped?.name || wrapped?.fullName || "").trim());
    };
    const getPanelCandidateVotes = (candidate, live) => {
        const value = live ? (candidate?.currentVotes ?? candidate?.votes ?? candidate?.totVotes)
            : (candidate?.totVotes ?? candidate?.votes ?? candidate?.currentVotes);
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };
    const getMsnbcStateElectData = (stateCode) => {
        const allStateElectionData = readRuntimeValue("allStElectData");
        if(!Array.isArray(allStateElectionData)) return null;
        const normalizedStateCode = String(stateCode || "").toUpperCase();
        return allStateElectionData.find(electData =>
            String(electData?.id || electData?.state || "").toUpperCase() === normalizedStateCode
        ) || null;
    };
    const hasMsnbcOfficialVisibleVotes = (stateRace) => {
        return (Number(stateRace?.totalCurrVotes) || 0) > 0
            || (Array.isArray(stateRace?.cands) && stateRace.cands.some(candidate =>
                (Number(candidate?.currentVotes) || 0) > 0
            ));
    };
    const shouldUseOfficialCandidateVotes = (stateRace) => {
        if(!Array.isArray(stateRace?.cands) || stateRace.cands.length === 0) return false;
        const officialCandidateTotal = stateRace.cands.reduce(
            (sum, candidate) => sum + (Number(candidate?.currentVotes) || 0),
            0
        );
        const officialRaceTotal = Number(stateRace?.totalCurrVotes) || 0;
        if(officialCandidateTotal <= 0 || officialRaceTotal <= 0) return false;
        return Math.abs(officialCandidateTotal - officialRaceTotal) <= Math.max(2, officialRaceTotal * 0.002);
    };
    const getPanelCurrentCandidateVotes = (candidate, stateRace = null, options = {}) => {
        const hasOfficialVisibleVotes = hasMsnbcOfficialVisibleVotes(stateRace);
        const officialCurrentVotes = Number(candidate?.currentVotes);
        if(options.source === "official" && hasOfficialVisibleVotes && Number.isFinite(officialCurrentVotes) && officialCurrentVotes >= 0) {
            return officialCurrentVotes;
        }
        const finalVotes = Number(candidate?.votes ?? candidate?.totVotes) || 0;
        const updates = Array.isArray(candidate?.updates) ? candidate.updates : [];
        if(options.source !== "official" && finalVotes > 0 && updates.length) {
            const stateCode = options.stateCode
                || getMarginThroughNightStateCodeFromRace(stateRace)
                || getMsnbcElectionStateCode(stateRace);
            const stateElectData = getMsnbcStateElectData(stateCode);
            const updateIndex = Number(stateElectData?.indx ?? stateRace?.indx);
            if(Number.isFinite(updateIndex) && updateIndex > 0) {
                const progress = Number(updates[Math.min(Math.max(0, updateIndex), updates.length - 1)]);
                if(Number.isFinite(progress)) return finalVotes * Math.max(0, progress);
            }
        }
        if(hasOfficialVisibleVotes && Number.isFinite(officialCurrentVotes) && officialCurrentVotes >= 0) {
            return officialCurrentVotes;
        }
        return 0;
    };
    const getMsnbcRaceConfig = (race) => {
        if(race === "senate") {
            return {
                race,
                liveVar: "electNightUSS",
                archiveVar: "usSenateArchive",
                title: "U.S. SENATE",
                stateTitle: "SENATE",
                historyLabel: "SEN",
                neededText: "SENATE<br>RACE"
            };
        }
        if(race === "governor") {
            return {
                race,
                liveVar: "electNightG",
                archiveVar: "allGovArchive",
                title: "GOVERNOR",
                stateTitle: "GOVERNOR",
                historyLabel: "GOV",
                neededText: "GOVERNOR<br>RACE"
            };
        }
        return {
            race: "president",
            liveVar: "electNightP",
            archiveVar: "presidentArchive",
            title: "PRESIDENT",
            stateTitle: "PRESIDENT",
            historyLabel: "PRES",
            neededText: "270<br>NEEDED"
        };
    };
    const getMsnbcElectionStateCode = (stateRace) => {
        return getElectionNightPanelStateCode(stateRace?.state || stateRace?.district || stateRace?.name);
    };
    const getMsnbcStateTotalVotes = (stateRace, candidates) => {
        const candidateTotal = (candidates || []).reduce((sum, candidate) => sum + Number(candidate.votes || 0), 0);
        if(candidateTotal > 0) return candidateTotal;
        const totalCurrVotes = Number(stateRace?.totalCurrVotes);
        if(Number.isFinite(totalCurrVotes) && totalCurrVotes > 0) return totalCurrVotes;
        return 0;
    };
    const getMarginThroughNightRaceConfig = (electionType) => {
        if(electionType === "president") return { race: "president", liveVar: "electNightP", label: "President" };
        if(electionType === "usSenate") return { race: "senate", liveVar: "electNightUSS", label: "Senate" };
        if(electionType === "governor") return { race: "governor", liveVar: "electNightG", label: "Governor" };
        return null;
    };
    const getMarginThroughNightElectionTypeFromText = (text) => {
        const normalizedText = String(text || "");
        if(/\bPresidential Election\b|\bPresident(?:ial)? Results\b/i.test(normalizedText)) return "president";
        if(/\bSenate Election\b|\bU\.S\.\s+Senate\b|\bSenate Results\b/i.test(normalizedText)) return "usSenate";
        if(/\bGovernor Election\b|\bGovernor Results\b/i.test(normalizedText)) return "governor";
        return "";
    };
    const getActiveElectionNightTabContext = () => {
        const tabs = document.getElementById("electNightTabDiv");
        if(!tabs) return null;
        const activeButton = Array.from(tabs.querySelectorAll("button")).find(button =>
            button.classList.contains("electNightTabO")
            || button.getAttribute("aria-selected") === "true"
        );
        if(!activeButton) return null;
        const label = String(activeButton.innerText || activeButton.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        let electionType = "";
        if(/^President$/i.test(label)) electionType = "president";
        else if(/^(?:U\.S\.\s*)?Senate$/i.test(label)) electionType = "usSenate";
        else if(/^Governor$/i.test(label)) electionType = "governor";
        return { button: activeButton, label, electionType };
    };
    const getCurrentMarginThroughNightElectionType = (host = null) => {
        const activeTabContext = getActiveElectionNightTabContext();
        if(activeTabContext) return activeTabContext.electionType;
        const textSources = [
            host,
            document.getElementById("electNightInn2"),
            document.getElementById("electNightInn2Gen"),
            document.getElementById("electPageInn2Gen"),
            document.body
        ]
            .filter(Boolean)
            .map(element => String(element.innerText || element.textContent || ""))
            .filter(Boolean);
        for(const text of textSources) {
            const electionType = getMarginThroughNightElectionTypeFromText(text);
            if(electionType) return electionType;
        }
        if(getMarginThroughNightRaceConfig(lastMapElectionType)) return lastMapElectionType;
        return lastMapElectionType;
    };
    const getMarginThroughNightStateCodeFromRace = (stateRace) => {
        const values = [stateRace?.state, stateRace?.stateCode, stateRace?.stateID, stateRace?.id, stateRace?.district, stateRace?.name].filter(Boolean);
        for(const value of values) {
            const code = getElectionNightPanelStateCode(value);
            if(Executive?.data?.states?.[String(code || "").toLowerCase()]) return String(code).toUpperCase();
        }
        const text = values.join(" ").toLowerCase();
        const matchedStateName = Object.keys(stateNameToCode).find(stateName =>
            text.includes(String(stateName || "").toLowerCase())
        );
        return matchedStateName ? stateNameToCode[matchedStateName] : "";
    };
    const isMarginThroughNightRaceForState = (stateRace, stateCode) => {
        const normalizedStateCode = String(stateCode || "").toUpperCase();
        if(!normalizedStateCode || normalizedStateCode === "US") return false;
        const raceStateCode = getMarginThroughNightStateCodeFromRace(stateRace);
        if(raceStateCode === normalizedStateCode) return true;
        const stateName = Executive?.data?.states?.[normalizedStateCode.toLowerCase()]?.name;
        if(!stateName) return false;
        return [stateRace?.state, stateRace?.stateCode, stateRace?.stateID, stateRace?.id, stateRace?.district, stateRace?.name]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(String(stateName).toLowerCase()));
    };
    const getMarginThroughNightFallbackStateRace = (electionType, stateCode) => {
        const normalizedStateCode = String(stateCode || "").toLowerCase();
        if(electionType !== "president" || !normalizedStateCode || normalizedStateCode === "us") return null;
        const presidentProxyRace = resultProxies?.president?.[normalizedStateCode];
        if(!presidentProxyRace || !Array.isArray(presidentProxyRace.cands)) return null;
        return {
            ...presidentProxyRace,
            state: stateCode,
            stateCode: String(stateCode || "").toUpperCase()
        };
    };
    const getMarginThroughNightStateRace = (electionType, stateCode) => {
        const raceConfig = getMarginThroughNightRaceConfig(electionType);
        if(!raceConfig || !stateCode || String(stateCode).toUpperCase() === "US") return null;
        const electNight = readRuntimeValue(raceConfig.liveVar);
        if(Array.isArray(electNight?.elections)) {
            const liveRace = electNight.elections.find(stateRace => isMarginThroughNightRaceForState(stateRace, stateCode));
            if(liveRace) return liveRace;
        }
        return getMarginThroughNightFallbackStateRace(electionType, stateCode);
    };
    const getMarginThroughNightStateCodeFromText = (text) => {
        const normalizedText = String(text || "").toLowerCase();
        if(!normalizedText) return "";
        const stateEntry = Object.entries(Executive?.data?.states || {})
            .map(([code, state]) => ({ code: String(code).toUpperCase(), name: String(state?.name || "") }))
            .filter(entry => entry.name)
            .sort((a, b) => b.name.length - a.name.length)
            .find(entry => normalizedText.includes(entry.name.toLowerCase()));
        return stateEntry?.code || "";
    };
    const getMarginThroughNightRaceStateCodeFromText = (electionType, text) => {
        const normalizedText = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
        if(!normalizedText || !/(?:results|general election|presidential election|president election|senate election|governor election)/i.test(normalizedText)) return "";
        const raceConfig = getMarginThroughNightRaceConfig(electionType);
        const electNight = readRuntimeValue(raceConfig?.liveVar);
        if(!Array.isArray(electNight?.elections)) return "";
        const races = electNight.elections
            .filter(stateRace => Array.isArray(stateRace?.cands) && stateRace.cands.length > 0)
            .map(stateRace => {
                const code = getMarginThroughNightStateCodeFromRace(stateRace) || getMsnbcElectionStateCode(stateRace);
                const name = getElectionNightPanelStateName(code);
                return { code: String(code || "").toUpperCase(), name: String(name || ""), stateRace };
            })
            .filter(race => race.code && race.code !== "US" && race.name)
            .sort((a, b) => b.name.length - a.name.length);
        const matchedRace = races.find(race => normalizedText.includes(race.name.toLowerCase()));
        return matchedRace?.code || "";
    };
    const getMarginThroughNightVisibleTextSources = (host = null) => {
        return [
            host,
            document.getElementById("electNightInn2Gen"),
            document.getElementById("electPageInn2Gen"),
            document.getElementById("electNightInn2")
        ]
            .filter(Boolean)
            .map(element => String(element.innerText || element.textContent || ""))
            .filter(Boolean);
    };
    const getMarginThroughNightVisibleStateCode = (host = null, electionTypeOverride = null) => {
        const electionType = electionTypeOverride || getCurrentMarginThroughNightElectionType(host);
        const activeStateCode = getElectionNightPanelStateCode(activeMap);
        if(activeStateCode && activeStateCode !== "US"
            && getMarginThroughNightStateRace(electionType, activeStateCode)) {
            return activeStateCode;
        }
        for(const text of getMarginThroughNightVisibleTextSources(host)) {
            const raceStateCode = getMarginThroughNightRaceStateCodeFromText(electionType, text);
            if(raceStateCode && getMarginThroughNightStateRace(electionType, raceStateCode)) {
                return raceStateCode;
            }
        }
        for(const text of getMarginThroughNightVisibleTextSources(host)) {
            const textStateCode = getMarginThroughNightStateCodeFromText(text);
            if(textStateCode && getMarginThroughNightStateRace(electionType, textStateCode)) {
                return textStateCode;
            }
        }
        return "";
    };
    const isMarginThroughNightEligible = () => {
        if(!isElectionNightPanelAvailable() || isPrimaryElectionNightPage()) return false;
        const electionType = getCurrentMarginThroughNightElectionType();
        if(!getMarginThroughNightRaceConfig(electionType)) return false;
        const stateCode = getMarginThroughNightVisibleStateCode(null, electionType);
        if(!stateCode || stateCode === "US") return false;
        const stateRace = getMarginThroughNightStateRace(electionType, stateCode);
        return hasMarginThroughNightOpposition(stateRace);
    };
    const getMarginThroughNightHistoryKey = (electionType, stateRace, stateCode) => {
        const raceConfig = getMarginThroughNightRaceConfig(electionType);
        const raceName = String(stateRace?.district || stateRace?.name || stateRace?.state || stateCode || "").replace(/\s+/g, " ").trim();
        const electionYear = Number(readRuntimeValue("currentYear"));
        const candidateSignature = Array.isArray(stateRace?.cands)
            ? stateRace.cands.map((candidate, index) => {
                const identity = String(
                    candidate?.id
                    ?? candidate?.candidateId
                    ?? candidate?.politicianId
                    ?? candidate?.polId
                    ?? candidate?.name
                    ?? getPanelCandidateName(candidate)
                    ?? index
                ).replace(/\s+/g, " ").trim().toLowerCase();
                const party = normalizePanelPartyCode(
                    candidate?.party || candidate?.caucus || candidate?.caucusParty
                ) || "I";
                return `${identity}:${party}`;
            }).sort().join(",")
            : "";
        return `${Number.isFinite(electionYear) ? electionYear : "year"}|${raceConfig?.race || electionType}|${String(stateCode || "").toUpperCase()}|${raceName}|${candidateSignature}`;
    };
    const getMarginCandidateColour = (candidate, fallbackParty, race = null) => {
        try {
            const colour = race ? getCandidateColourForRace(candidate, race) : getCandidateColour(candidate);
            if(colour) return stringifyColour(colour);
        } catch {}
        const party = normalizePanelPartyCode(candidate?.party || candidate?.caucus || candidate?.caucusParty || fallbackParty);
        try {
            if(party === "D" || party === "R") return stringifyColour(config.partyColours[party]);
            if(party === "I") return stringifyColour(config.partyColours.I.default);
        } catch {}
        return "#888888";
    };
    const getMarginRowPartisanSide = (row) => {
        const sideParty = String(row?.sideParty || row?.party || "").toUpperCase();
        if(sideParty === "D" || sideParty === "ID") return "upper";
        if(sideParty === "R" || sideParty === "IR") return "lower";
        return "";
    };
    const getMarginReferenceRows = (candidateVoteRows) => {
        if(!Array.isArray(candidateVoteRows) || candidateVoteRows.length < 2) return null;
        const rankedRows = candidateVoteRows
            .slice()
            .filter(row => Number.isFinite(Number(row.votes)))
            .sort((rowA, rowB) => Number(rowB.votes) - Number(rowA.votes));
        if(rankedRows.length < 2) return null;
        const upperRow = rankedRows.find(row => getMarginRowPartisanSide(row) === "upper");
        const lowerRow = rankedRows.find(row => getMarginRowPartisanSide(row) === "lower");
        if(upperRow && lowerRow) return { blueRow: upperRow, redRow: lowerRow };
        return { blueRow: rankedRows[0], redRow: rankedRows[1] };
    };
    const hasMarginThroughNightOpposition = (stateRace) => {
        return Array.isArray(stateRace?.cands) && stateRace.cands.filter(candidate =>
            String(getPanelCandidateName(candidate) || "").trim()
        ).length >= 2;
    };
    const isMarginProjectedFlag = (value) => {
        return value?.pW === true
            || value?.PW === true
            || value?.projected === true
            || value?.called === true
            || value?.call === true
            || value?.winnerProjected === true
            || value?.projectedWinner === true;
    };
    const getMarginProjectedCandidateRow = (stateRace, candidateRows) => {
        if(!Array.isArray(candidateRows) || candidateRows.length === 0) return null;
        const flaggedRow = candidateRows.find(row => isMarginProjectedFlag(row.candidate));
        if(flaggedRow) return flaggedRow;
        if(!isMarginProjectedFlag(stateRace)) return null;
        return candidateRows.slice().sort((rowA, rowB) => Number(rowB.votes) - Number(rowA.votes))[0] || null;
    };
    const buildMarginThroughNightPoint = (electionType, stateRace, options = {}) => {
        if(!getMarginThroughNightRaceConfig(electionType) || !stateRace || !Array.isArray(stateRace.cands)) return null;
        const stateCode = getMarginThroughNightStateCodeFromRace(stateRace) || getMsnbcElectionStateCode(stateRace);
        if(!stateCode || stateCode === "US") return null;
        if(!stateRace || !Array.isArray(stateRace.cands)) return null;
        if(!hasMarginThroughNightOpposition(stateRace)) return null;
        if(!shouldUseOfficialCandidateVotes(stateRace)) return null;
        const voteSource = "official";
        const candidateVoteRows = stateRace.cands.map((candidate, candidateIndex) => {
            const votes = getPanelCurrentCandidateVotes(candidate, stateRace, { source: voteSource });
            const party = normalizePanelPartyCode(candidate?.party || candidate?.caucus || candidate?.caucusParty) || "I";
            const sideParty = getCandidateVariantPartyKey(candidate);
            return {
                candidate,
                candidateIndex,
                name: getPanelCandidateName(candidate),
                party,
                sideParty,
                votes: Math.round(votes),
                colour: getMarginCandidateColour(candidate, party, stateRace),
                ideology: getChanceCandidateIdeology(candidate, sideParty || party)
            };
        });
        const totalCurrVotes = candidateVoteRows.reduce((sum, row) => sum + (Number(row.votes) || 0), 0);
        const totalExpectedVotes = Number(stateRace.totalVotes) || stateRace.cands.reduce(
            (sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0),
            0
        );
        if(totalCurrVotes <= 0 || totalExpectedVotes <= 0) return null;
        const referenceRows = getMarginReferenceRows(candidateVoteRows);
        if(!referenceRows) return null;
        const { blueRow, redRow } = referenceRows;
        const blueVotes = blueRow.votes || 0;
        const redVotes = redRow.votes || 0;
        const reportingPercent = Math.max(0, Math.min(100, Math.round((totalCurrVotes / totalExpectedVotes) * 1000) / 10));
        const bluePercent = Math.round((blueVotes / totalCurrVotes) * 1000) / 10;
        const redPercent = Math.round((redVotes / totalCurrVotes) * 1000) / 10;
        const margin = Math.round((bluePercent - redPercent) * 10) / 10;
        if(!Number.isFinite(reportingPercent) || reportingPercent <= 0) return null;
        const projectedRow = getMarginProjectedCandidateRow(stateRace, candidateVoteRows);
        const candidates = candidateVoteRows.map(row => ({
            name: row.name,
            party: row.party,
            sideParty: row.sideParty,
            candidateIndex: row.candidateIndex,
            votes: row.votes,
            percent: Math.round(((row.votes / totalCurrVotes) * 1000)) / 10,
            colour: row.colour,
            ideology: row.ideology,
            projected: projectedRow === row
        }));
        return {
            reportingPercent,
            blueCandidateName: blueRow.name,
            redCandidateName: redRow.name,
            blueVotes: Math.round(blueVotes),
            redVotes: Math.round(redVotes),
            bluePercent,
            redPercent,
            margin,
            blueColour: blueRow.colour,
            redColour: redRow.colour,
            candidates,
            raceProjected: Boolean(projectedRow),
            projectedCandidateName: projectedRow?.name || "",
            totalVotes: totalExpectedVotes,
            totalCurrVotes,
            chanceProjection: options.includeChanceProjection === false
                ? null
                : buildChanceZoneProjection(stateRace, candidateVoteRows, stateCode, electionType),
            voteSource,
            stateCode,
            key: getMarginThroughNightHistoryKey(electionType, stateRace, stateCode)
        };
    };
    const buildMarginThroughNightPointFromNative = (electionType, stateRace, nativeOverride) => {
        if(!nativeOverride || !Array.isArray(stateRace?.cands)) return null;
        if(!hasMarginThroughNightOpposition(stateRace)) return null;
        const stateCode = getMarginThroughNightStateCodeFromRace(stateRace) || getMsnbcElectionStateCode(stateRace);
        const reportingPercent = Number(nativeOverride.reportedPct);
        if(!Number.isFinite(reportingPercent) || reportingPercent <= 0) return null;
        if(stateRace.cands.some((_candidate, index) => !Number.isFinite(Number(nativeOverride.votesByIndex?.[index])))) return null;
        const candidateVoteRows = stateRace.cands.map((candidate, index) => {
            const party = normalizePanelPartyCode(candidate?.party || candidate?.caucus || candidate?.caucusParty) || "I";
            const votes = Number(nativeOverride.votesByIndex?.[index]);
            const sideParty = getCandidateVariantPartyKey(candidate);
            return {
                candidate,
                candidateIndex: index,
                name: getPanelCandidateName(candidate),
                party,
                sideParty,
                votes: Number.isFinite(votes) ? Math.round(votes) : 0,
                colour: getMarginCandidateColour(candidate, party, stateRace),
                ideology: getChanceCandidateIdeology(candidate, sideParty || party)
            };
        });
        if(candidateVoteRows.some(row => row.votes <= 0) && candidateVoteRows.every(row => row.votes <= 0)) return null;
        const totalCurrVotes = candidateVoteRows.reduce((sum, row) => sum + (Number(row.votes) || 0), 0);
        if(totalCurrVotes <= 0) return null;
        const referenceRows = getMarginReferenceRows(candidateVoteRows);
        if(!referenceRows) return null;
        const { blueRow, redRow } = referenceRows;
        const bluePercent = Math.round((blueRow.votes / totalCurrVotes) * 1000) / 10;
        const redPercent = Math.round((redRow.votes / totalCurrVotes) * 1000) / 10;
        const totalExpectedVotes = Number(stateRace.totalVotes) || stateRace.cands.reduce(
            (sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0),
            0
        );
        const projectedRow = getMarginProjectedCandidateRow(stateRace, candidateVoteRows);
        return {
            reportingPercent,
            blueCandidateName: blueRow.name,
            redCandidateName: redRow.name,
            blueVotes: blueRow.votes,
            redVotes: redRow.votes,
            bluePercent,
            redPercent,
            margin: Math.round((bluePercent - redPercent) * 10) / 10,
            blueColour: blueRow.colour,
            redColour: redRow.colour,
            candidates: candidateVoteRows.map(row => ({
                name: row.name,
                party: row.party,
                sideParty: row.sideParty,
                candidateIndex: row.candidateIndex,
                votes: row.votes,
                percent: Math.round((row.votes / totalCurrVotes) * 1000) / 10,
                colour: row.colour,
                ideology: row.ideology,
                projected: projectedRow === row
            })),
            raceProjected: Boolean(projectedRow),
            projectedCandidateName: projectedRow?.name || "",
            totalVotes: totalExpectedVotes,
            totalCurrVotes,
            chanceProjection: buildChanceZoneProjection(stateRace, candidateVoteRows, stateCode, electionType),
            voteSource: "native",
            stateCode,
            key: getMarginThroughNightHistoryKey(electionType, stateRace, stateCode)
        };
    };
    const getMarginThroughNightPoint = (stateCodeOverride = null) => {
        const electionType = getCurrentMarginThroughNightElectionType();
        const stateCode = stateCodeOverride || getMarginThroughNightVisibleStateCode(null, electionType);
        if(!isElectionNightPanelAvailable() || isPrimaryElectionNightPage()) return null;
        if(!getMarginThroughNightRaceConfig(electionType)) return null;
        if(!stateCode || stateCode === "US") return null;
        const stateRace = getMarginThroughNightStateRace(electionType, stateCode);
        return buildMarginThroughNightPoint(electionType, stateRace);
    };
    const normalizeMarginThroughNightPoint = (point) => {
        if(!point || !Array.isArray(point.candidates)) return point;
        const candidates = point.candidates.map(candidate => ({
            ...candidate,
            votes: Math.max(0, Number(candidate?.votes) || 0)
        }));
        const totalCurrVotes = candidates.reduce((sum, candidate) => sum + (Number(candidate.votes) || 0), 0);
        if(totalCurrVotes <= 0) return point;
        const normalizedCandidates = candidates.map(candidate => ({
            ...candidate,
            percent: Math.round(((Number(candidate.votes) || 0) / totalCurrVotes) * 1000) / 10
        }));
        const blueCandidate = normalizedCandidates.find(candidate => candidate.name === point.blueCandidateName)
            || normalizedCandidates.find(candidate => candidate.party === "D");
        const redCandidate = normalizedCandidates.find(candidate => candidate.name === point.redCandidateName)
            || normalizedCandidates.find(candidate => candidate.party === "R");
        if(!blueCandidate || !redCandidate) return {
            ...point,
            candidates: normalizedCandidates,
            totalCurrVotes
        };
        const blueVotes = Number(blueCandidate.votes) || 0;
        const redVotes = Number(redCandidate.votes) || 0;
        const bluePercent = Math.round((blueVotes / totalCurrVotes) * 1000) / 10;
        const redPercent = Math.round((redVotes / totalCurrVotes) * 1000) / 10;
        return {
            ...point,
            candidates: normalizedCandidates,
            totalCurrVotes,
            blueVotes,
            redVotes,
            bluePercent,
            redPercent,
            margin: Math.round((bluePercent - redPercent) * 10) / 10
        };
    };
    const getMarginThroughNightSourcePriority = (point) => {
        if(point?.voteSource === "native") return 3;
        if(point?.voteSource === "official") return 2;
        if(point?.voteSource === "updates") return 1;
        return 0;
    };
    const recordMarginThroughNightPointValue = (point) => {
        if(!point) return null;
        const history = marginThroughNightHistories.get(point.key) || [];
        const reportingPercent = Number(point.reportingPercent);
        const nearbyNativePoint = history.find(historyPoint =>
            historyPoint.voteSource === "native"
            && Number.isFinite(reportingPercent)
            && Math.abs(Number(historyPoint.reportingPercent) - reportingPercent) < 1
        );
        if(point.voteSource !== "native"
            && nearbyNativePoint
            && getMarginThroughNightSourcePriority(nearbyNativePoint) > getMarginThroughNightSourcePriority(point)) {
            return history;
        }
        if(point.voteSource === "native" && Number.isFinite(reportingPercent)) {
            for(let index = history.length - 1; index >= 0; index--) {
                const historyPoint = history[index];
                if(historyPoint.voteSource !== "native"
                    && Math.abs(Number(historyPoint.reportingPercent) - reportingPercent) < 1) {
                    history.splice(index, 1);
                }
            }
        }
        const existingPoint = history.find(historyPoint =>
            Number(historyPoint.reportingPercent) === Number(point.reportingPercent)
        );
        const normalizedPoint = normalizeMarginThroughNightPoint(point);
        if(!existingPoint) {
            history.push(normalizedPoint);
            history.sort((a, b) => Number(a.reportingPercent) - Number(b.reportingPercent));
            marginThroughNightHistories.set(point.key, history);
        } else {
            const incomingPriority = getMarginThroughNightSourcePriority(point);
            const existingPriority = getMarginThroughNightSourcePriority(existingPoint);
            if(incomingPriority >= existingPriority || point.voteSource === "native") {
                Object.assign(existingPoint, normalizedPoint);
            }
            history.sort((a, b) => Number(a.reportingPercent) - Number(b.reportingPercent));
        }
        return history;
    };
    const hydrateMarginThroughNightBackgroundRaces = (force = false) => {
        [
            { electionType: "president", race: "president" },
            { electionType: "usSenate", race: "senate" },
            { electionType: "governor", race: "governor" }
        ].forEach(({ electionType, race }) => {
            const raceConfig = getMarginThroughNightRaceConfig(electionType);
            const electNight = readRuntimeValue(raceConfig?.liveVar);
            const hasLiveRaces = Array.isArray(electNight?.elections)
                && electNight.elections.some(stateRace => Array.isArray(stateRace?.cands) && stateRace.cands.length > 0);
            if(hasLiveRaces) hydrateMsnbcElectionRaceData(race, force);
        });
    };
    const recordAllMarginThroughNightPoints = () => {
        if(!isElectionNightPanelAvailable() || isPrimaryElectionNightPage()) return;
        hydrateMarginThroughNightBackgroundRaces(false);
        ["president", "usSenate", "governor"].forEach(electionType => {
            const raceConfig = getMarginThroughNightRaceConfig(electionType);
            const electNight = readRuntimeValue(raceConfig?.liveVar);
            const stateRaces = Array.isArray(electNight?.elections) ? electNight.elections.slice() : [];
            if(electionType === "president" && resultProxies?.president) {
                Object.entries(resultProxies.president).forEach(([stateCode, stateRace]) => {
                    if(Array.isArray(stateRace?.cands)) {
                        stateRaces.push({
                            ...stateRace,
                            state: stateCode,
                            stateCode: String(stateCode || "").toUpperCase()
                        });
                    }
                });
            }
            stateRaces.forEach(stateRace => {
                recordMarginThroughNightPointValue(buildMarginThroughNightPoint(electionType, stateRace, {
                    includeChanceProjection: false
                }));
            });
        });
    };
    const recordMarginThroughNightPoint = () => {
        const point = getMarginThroughNightPoint();
        return point ? recordMarginThroughNightPointValue(point) : null;
    };
    const getMarginPointColour = (point) => {
        if(!point || Number(point.margin) === 0) return "#888888";
        return Number(point.margin) > 0 ? (point.blueColour || "#888888") : (point.redColour || "#888888");
    };
    const getMarginTooltipSoftColour = (point) => {
        const colour = getMarginPointColour(point);
        const hslMatch = String(colour).match(/hsl\(\s*([0-9.]+)\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*\)/i);
        if(hslMatch) return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, 0.12)`;
        const hexMatch = String(colour).match(/^#([0-9a-f]{6})$/i);
        if(hexMatch) {
            const value = hexMatch[1];
            const red = parseInt(value.slice(0, 2), 16);
            const green = parseInt(value.slice(2, 4), 16);
            const blue = parseInt(value.slice(4, 6), 16);
            return `rgba(${red}, ${green}, ${blue}, 0.12)`;
        }
        return "rgba(136, 136, 136, 0.12)";
    };
    const getMarginPointLabel = (point) => {
        const margin = Number(point?.margin) || 0;
        if(margin > 0) return `${point.blueCandidateName} +${Math.abs(margin).toFixed(1)} pts`;
        if(margin < 0) return `${point.redCandidateName} +${Math.abs(margin).toFixed(1)} pts`;
        return "EVEN";
    };
    const getChanceCandidateSide = (candidate) => {
        const sideParty = String(candidate?.sideParty || candidate?.party || "").toUpperCase();
        if(sideParty === "D" || sideParty === "ID") return "left";
        if(sideParty === "R" || sideParty === "IR") return "right";
        return "";
    };
    const getChanceCandidateMajorParty = candidate => {
        const normalizeMajorParty = value => {
            const party = String(value || "").trim().toUpperCase();
            if(party === "D" || party === "DEM" || party.startsWith("DEMOCRAT")) return "D";
            if(party === "R" || party === "REP" || party.startsWith("REPUBLICAN")) return "R";
            return "";
        };
        const sideParty = String(candidate?.sideParty || "").trim();
        if(sideParty) {
            return normalizeMajorParty(sideParty);
        }
        const variantParty = String(getCandidateVariantPartyKey(candidate) || "").trim();
        if(variantParty) {
            return normalizeMajorParty(variantParty);
        }
        return normalizeMajorParty(candidate?.party);
    };
    const chanceCandidateIdeologyCache = new Map();
    const chanceMeterVisualValues = new Map();
    const getChanceIdeologyLabelScore = (value, dimension = "") => {
        const label = String(value ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
        if(!label) return null;
        if(label.includes("very liberal") || label.includes("ultra liberal") || label.includes("progressive")) return -2;
        if(label === "liberal" || label.includes(" liberal")) return -1;
        if(label.includes("very conservative") || label.includes("ultra conservative")) return 2;
        if(label === "conservative" || label.includes(" conservative")) return 1;
        if(label.includes("moderate") || label.includes("centrist")) return 0;
        if(label.includes("libertarian")) {
            if(dimension === "fiscal") return 1.25;
            if(dimension === "social") return -1.25;
            return 0;
        }
        return null;
    };
    const getChanceCandidateIdeology = (candidate, fallbackParty = "") => {
        const candidateId = candidate?.id ?? candidate?.candidateId ?? candidate?.charID ?? "";
        const party = String(fallbackParty || getCandidateVariantPartyKey(candidate) || "").toUpperCase();
        const candidateIdentity = candidateId || getPanelCandidateName(candidate) || "candidate";
        const cacheKey = `${candidateIdentity}|${party}`;
        if(chanceCandidateIdeologyCache.has(cacheKey)) {
            return chanceCandidateIdeologyCache.get(cacheKey);
        }
        let rawCandidate = null;
        let wrappedCandidate = null;
        try {
            rawCandidate = candidateId ? findCandByID([candidateId])[0] : null;
            wrappedCandidate = rawCandidate
                ? Executive.data.characters.wrapCharacter(rawCandidate, "candidate")
                : null;
        } catch {}
        const extended = wrappedCandidate?.extendedAttribs || {};
        const sources = [candidate, extended, wrappedCandidate, rawCandidate].filter(Boolean);
        const findField = names => {
            const normalizedNames = names.map(name => String(name).toLowerCase());
            for(const source of sources) {
                if(Array.isArray(source)) continue;
                for(const [key, value] of Object.entries(source || {})) {
                    if(normalizedNames.includes(String(key).toLowerCase()) && value != null) return value;
                }
            }
            return null;
        };
        const fiscalValue = findField([
            "fiscalIdeology", "economicIdeology", "fiscal", "economicView", "fiscalView"
        ]) ?? (Array.isArray(rawCandidate) ? rawCandidate[6] : null);
        const socialValue = findField([
            "socialIdeology", "social", "socialView", "socialPolicy"
        ]) ?? (Array.isArray(rawCandidate) ? rawCandidate[7] : null);
        const fiscalScore = getChanceIdeologyLabelScore(fiscalValue, "fiscal");
        const socialScore = getChanceIdeologyLabelScore(socialValue, "social");
        const knownScores = [fiscalScore, socialScore].filter(Number.isFinite);
        let ideology = knownScores.length
            ? knownScores.reduce((sum, score) => sum + score, 0) / knownScores.length
            : null;
        if(!Number.isFinite(ideology)) {
            ideology = party === "D" || party === "ID"
                ? -1
                : (party === "R" || party === "IR" ? 1 : 0);
        }
        ideology = Math.max(-2, Math.min(2, ideology));
        chanceCandidateIdeologyCache.set(cacheKey, ideology);
        return ideology;
    };
    const orderChanceCandidatePair = (candidateA, candidateB) => {
        const majorPartyA = getChanceCandidateMajorParty(candidateA);
        const majorPartyB = getChanceCandidateMajorParty(candidateB);
        if(majorPartyA && majorPartyB && majorPartyA !== majorPartyB) {
            return majorPartyA === "D"
                ? { leftCandidate: candidateA, rightCandidate: candidateB }
                : { leftCandidate: candidateB, rightCandidate: candidateA };
        }
        const scoreA = Number.isFinite(Number(candidateA?.ideology))
            ? Number(candidateA.ideology)
            : getChanceCandidateIdeology(candidateA, candidateA?.party);
        const scoreB = Number.isFinite(Number(candidateB?.ideology))
            ? Number(candidateB.ideology)
            : getChanceCandidateIdeology(candidateB, candidateB?.party);
        if(Math.abs(scoreA - scoreB) > 0.001) {
            return scoreA < scoreB
                ? { leftCandidate: candidateA, rightCandidate: candidateB }
                : { leftCandidate: candidateB, rightCandidate: candidateA };
        }
        const sideA = getChanceCandidateSide(candidateA);
        const sideB = getChanceCandidateSide(candidateB);
        if(sideA !== sideB) {
            if(sideA === "left" || sideB === "right") {
                return { leftCandidate: candidateA, rightCandidate: candidateB };
            }
            if(sideB === "left" || sideA === "right") {
                return { leftCandidate: candidateB, rightCandidate: candidateA };
            }
        }
        return String(candidateA?.name || "").localeCompare(String(candidateB?.name || "")) <= 0
            ? { leftCandidate: candidateA, rightCandidate: candidateB }
            : { leftCandidate: candidateB, rightCandidate: candidateA };
    };
    const getChanceSeededRandom = (seed) => {
        let hash = 2166136261;
        const text = String(seed || "");
        for(let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        hash += hash << 13; hash ^= hash >>> 7;
        hash += hash << 3; hash ^= hash >>> 17;
        hash += hash << 5;
        return ((hash >>> 0) / 4294967296);
    };
    const getChanceSeededNormal = (seed) => {
        const a = Math.max(0.0001, getChanceSeededRandom(`${seed}|a`));
        const b = Math.max(0.0001, getChanceSeededRandom(`${seed}|b`));
        return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
    };
    const getChanceCountyCurrentVotes = (countyCandidate, countyElectData) => {
        const officialCurrentVotes = Number(countyCandidate?.currentVotes);
        const finalVotes = Number(countyCandidate?.votes ?? countyCandidate?.totVotes) || 0;
        const updates = Array.isArray(countyCandidate?.updates) ? countyCandidate.updates : [];
        const updateIndex = Number(countyElectData?.indx);
        if(finalVotes > 0 && updates.length && Number.isFinite(updateIndex) && updateIndex > 0) {
            const progress = Number(updates[Math.min(Math.max(0, updateIndex), updates.length - 1)]);
            if(Number.isFinite(progress) && progress >= 0) {
                const updatedVotes = finalVotes * progress;
                return Number.isFinite(officialCurrentVotes) && officialCurrentVotes >= 0
                    ? Math.max(officialCurrentVotes, updatedVotes)
                    : updatedVotes;
            }
        }
        if(Number.isFinite(officialCurrentVotes) && officialCurrentVotes >= 0) return officialCurrentVotes;
        return 0;
    };
    const getChanceCountyCandidate = (county, stateCandidate, candidateIndex) => {
        const countyCandidates = Array.isArray(county?.cands) ? county.cands : [];
        if(countyCandidates[candidateIndex]) return countyCandidates[candidateIndex];
        const stateName = String(stateCandidate?.name || "").trim().toLowerCase();
        return countyCandidates.find(candidate =>
            String(candidate?.name || "").trim().toLowerCase() === stateName
        ) || null;
    };
    const normalizeChanceShares = (shares) => {
        const clipped = shares.map(value => Math.max(0.0001, Number(value) || 0));
        const total = clipped.reduce((sum, value) => sum + value, 0);
        if(total <= 0) return clipped.map(() => 1 / Math.max(1, clipped.length));
        return clipped.map(value => value / total);
    };
    const getChanceNumericField = (sources, names) => {
        const normalizedNames = names.map(name => String(name).toLowerCase());
        for(const source of sources) {
            if(!source || typeof source !== "object") continue;
            for(const [key, value] of Object.entries(source)) {
                if(!normalizedNames.includes(String(key).toLowerCase())) continue;
                const number = Number(value);
                if(Number.isFinite(number) && number >= 0) return number;
            }
        }
        return NaN;
    };
    const normalizeChanceCountyName = (value) => String(value || "")
        .toLowerCase()
        .replace(/\b(county|parish|borough|municipality|census area|city and borough)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
    const findChanceCountyData = (container, countyName, depth = 0, seen = new Set()) => {
        if(!container || depth > 3) return null;
        if(typeof container === "object") {
            if(seen.has(container)) return null;
            seen.add(container);
        }
        const targetName = normalizeChanceCountyName(countyName);
        if(!targetName) return null;
        if(Array.isArray(container)) {
            for(const entry of container) {
                const match = findChanceCountyData(entry, countyName, depth + 1, seen);
                if(match) return match;
            }
            return null;
        }
        if(typeof container !== "object") return null;
        const entryName = container.name
            || container.countyName
            || container.county
            || container.displayName
            || container.fullName;
        if(entryName && normalizeChanceCountyName(entryName) === targetName) return container;
        for(const [key, value] of Object.entries(container)) {
            if(normalizeChanceCountyName(key) === targetName && value && typeof value === "object") return value;
        }
        for(const key of ["counties", "countyStats", "countyElectStats", "countyData", "countyDemographics", "electStats", "demographics"]) {
            const match = findChanceCountyData(container[key], countyName, depth + 1, seen);
            if(match) return match;
        }
        return null;
    };
    const getChanceCountyIdeologyShares = (county, candidateVoteRows, stateCode, countyElectData) => {
        const stateData = Executive?.data?.states?.[String(stateCode || "").toLowerCase()];
        const supplementalCountyData = findChanceCountyData([
            stateData?.counties,
            stateData?.countyStats,
            stateData?.countyElectStats,
            stateData?.countyData,
            stateData?.countyDemographics,
            stateData?.electStats,
            stateData?.demographics,
            countyElectData,
            county?.sourceCounty
        ], county?.name);
        const sources = [
            county,
            supplementalCountyData,
            county?.stats,
            county?.demographics,
            county?.partisanship,
            county?.partySupport
        ];
        const dem = getChanceNumericField(sources, ["demPop", "democratPop", "democraticShare", "demShare", "dShare"]);
        const rep = getChanceNumericField(sources, ["repPop", "republicanPop", "republicanShare", "repShare", "rShare"]);
        const ind = getChanceNumericField(sources, ["indPop", "independentPop", "independentShare", "indShare", "iShare"]);
        if(!Number.isFinite(dem) || !Number.isFinite(rep) || dem + rep <= 0) return null;
        const blockTotals = {
            left: Math.max(0, dem),
            right: Math.max(0, rep),
            other: Number.isFinite(ind) ? Math.max(0, ind) : 0
        };
        const blockCounts = candidateVoteRows.reduce((counts, candidate) => {
            const side = getChanceCandidateSide(candidate);
            counts[side || "other"] = (counts[side || "other"] || 0) + 1;
            return counts;
        }, { left: 0, right: 0, other: 0 });
        return normalizeChanceShares(candidateVoteRows.map(candidate => {
            const side = getChanceCandidateSide(candidate) || "other";
            const count = Math.max(1, blockCounts[side] || 1);
            return blockTotals[side] / count;
        }));
    };
    const getChanceConfidenceCap = (reportingPercent, options = {}) => {
        const reporting = Math.max(0, Math.min(100, Number(reportingPercent) || 0));
        if(options.rankedChoicePending === true) return 82;
        if(reporting < 5) return 58;
        if(reporting < 15) return 63;
        if(reporting < 25) return 68;
        if(reporting < 35) return 74;
        if(reporting < 50) return 82;
        if(reporting < 70) return 88;
        if(reporting < 90) return 94;
        return 97;
    };
    const getChanceBooleanFlag = (sources, keyPattern) => {
        const queue = (Array.isArray(sources) ? sources : [sources])
            .filter(source => source && typeof source === "object")
            .map(source => ({ source, depth: 0 }));
        const visited = new Set();
        while(queue.length) {
            const { source, depth } = queue.shift();
            if(!source || typeof source !== "object" || visited.has(source)) continue;
            visited.add(source);
            for(const [key, value] of Object.entries(source)) {
                if(keyPattern.test(normalizeRcvFlagKey(key))) {
                    if(value === true || value === 1) return true;
                    if(typeof value === "string" && /^(?:true|yes|enabled|active|rcv|ranked)/i.test(value.trim())) return true;
                }
                if(depth < 2 && value && typeof value === "object" && !Array.isArray(value)) {
                    queue.push({ source: value, depth: depth + 1 });
                }
            }
        }
        return false;
    };
    const isChanceRankedChoiceRace = (stateRace, stateCode) => {
        const normalizedStateCode = String(stateCode || "").toUpperCase();
        const stateData = Executive?.data?.states?.[normalizedStateCode.toLowerCase()];
        if(isNationalRcvEnabled()) return true;
        const explicit = getChanceBooleanFlag(
            [stateRace, stateData],
            RCV_EXPLICIT_FLAG_PATTERN
        );
        if(explicit) return true;
        return (normalizedStateCode === "ME" || normalizedStateCode === "AK")
            && Array.isArray(stateRace?.cands)
            && stateRace.cands.length > 2;
    };
    const chanceZoneProjectionCache = new Map();
    const buildChanceZoneProjection = (stateRace, candidateVoteRows, stateCode, electionType = "") => {
        if(!stateRace || !Array.isArray(stateRace.counties) || !Array.isArray(stateRace.cands)) return null;
        if(!Array.isArray(candidateVoteRows) || candidateVoteRows.length < 2) return null;
        const topTwoRows = candidateVoteRows
            .slice()
            .sort((rowA, rowB) => Number(rowB.votes) - Number(rowA.votes))
            .slice(0, 2);
        if(topTwoRows.length < 2 || topTwoRows.some(row => !getChanceCandidateSide(row))) return null;
        const allStateElectionData = readRuntimeValue("allStElectData");
        const normalizedStateCode = String(stateCode || getMarginThroughNightStateCodeFromRace(stateRace) || getMsnbcElectionStateCode(stateRace) || "").toLowerCase();
        const stateElectData = (Array.isArray(allStateElectionData) ? allStateElectionData : [])
            .find(electData => String(electData?.id || electData?.state || "").toLowerCase() === normalizedStateCode);
        const countyElectDataByName = new Map((Array.isArray(stateElectData?.counties) ? stateElectData.counties : [])
            .map(countyData => [String(countyData?.name || ""), countyData]));
        const zones = stateRace.counties.map((county, zoneIndex) => {
            const countyElectData = countyElectDataByName.get(String(county?.name || ""));
            const expectedVotes = stateRace.cands.map((stateCandidate, candidateIndex) => {
                const countyCandidate = getChanceCountyCandidate(county, stateCandidate, candidateIndex);
                return Number(countyCandidate?.votes ?? countyCandidate?.totVotes) || 0;
            });
            const currentVotes = stateRace.cands.map((stateCandidate, candidateIndex) => {
                const countyCandidate = getChanceCountyCandidate(county, stateCandidate, candidateIndex);
                return getChanceCountyCurrentVotes(countyCandidate, countyElectData);
            });
            const expectedTotal = expectedVotes.reduce((sum, value) => sum + value, 0);
            const currentTotal = currentVotes.reduce((sum, value) => sum + value, 0);
            if(expectedTotal <= 0) return null;
            const territorialShares = getChanceCountyIdeologyShares(county, candidateVoteRows, stateCode, countyElectData);
            return {
                key: `${String(county?.name || "zone")}|${zoneIndex}`,
                name: String(county?.name || `Zone ${zoneIndex + 1}`),
                expectedVotes,
                currentVotes,
                expectedTotal,
                currentTotal: Math.min(currentTotal, expectedTotal),
                territorialShares,
                actualShares: currentTotal > 0
                    ? normalizeChanceShares(currentVotes.map(value => value / currentTotal))
                    : null,
                reportingShare: Math.max(0, Math.min(1, currentTotal / expectedTotal))
            };
        }).filter(Boolean);
        const totalExpectedVotes = zones.reduce((sum, zone) => sum + zone.expectedTotal, 0);
        const totalCurrentVotes = zones.reduce((sum, zone) => sum + zone.currentTotal, 0);
        if(zones.length < 2 || totalExpectedVotes <= 0 || totalCurrentVotes <= 0) return null;
        const candidateCount = stateRace.cands.length;
        const currentTotals = new Array(candidateCount).fill(0);
        zones.forEach(zone => {
            zone.currentVotes.forEach((votes, candidateIndex) => {
                currentTotals[candidateIndex] += Number(votes) || 0;
            });
        });
        const statewideCurrentShares = normalizeChanceShares(currentTotals);
        const reportingShare = Math.max(0, Math.min(1, totalCurrentVotes / totalExpectedVotes));

        const priorWeightedTotals = new Array(candidateCount).fill(0);
        let priorWeight = 0;
        zones.forEach(zone => {
            if(!zone.territorialShares) return;
            zone.territorialShares.forEach((share, candidateIndex) => {
                priorWeightedTotals[candidateIndex] += (Number(share) || 0) * zone.expectedTotal;
            });
            priorWeight += zone.expectedTotal;
        });
        const statewidePriorShares = priorWeight > 0
            ? normalizeChanceShares(priorWeightedTotals)
            : statewideCurrentShares;
        const swingDamp = 0.75 * Math.sqrt(reportingShare);
        const partisanSwing = statewideCurrentShares.map((share, candidateIndex) =>
            (share - (statewidePriorShares[candidateIndex] ?? share)) * swingDamp);
        zones.forEach(zone => {
            const localReliability = zone.actualShares
                ? Math.min(0.88, 0.08 + (0.80 * Math.pow(zone.reportingShare, 1.35)))
                : 0;
            const priorShares = zone.territorialShares
                ? normalizeChanceShares(zone.territorialShares.map((share, candidateIndex) =>
                    Math.max(0, (Number(share) || 0) + partisanSwing[candidateIndex])))
                : statewideCurrentShares;
            zone.estimateMethod = zone.actualShares
                ? (zone.territorialShares ? "visible vote + county partisan prior" : "visible-vote blend")
                : (zone.territorialShares ? "county partisan prior" : "statewide visible prior");
            zone.estimatedShares = normalizeChanceShares(statewideCurrentShares.map((stateShare, candidateIndex) => {
                const priorShare = priorShares[candidateIndex] ?? stateShare;
                const localShare = zone.actualShares?.[candidateIndex] ?? priorShare;
                return (localShare * localReliability) + (priorShare * (1 - localReliability));
            }));
            zone.estimateUncertainty = Math.min(
                0.18,
                0.025 + (0.13 * Math.pow(1 - zone.reportingShare, 0.72))
                    + (zone.territorialShares ? 0 : 0.025)
            );
        });
        const rankedChoice = isChanceRankedChoiceRace(stateRace, stateCode);
        const sortedCurrentTotals = currentTotals.slice().sort((a, b) => b - a);
        const currentLeaderShare = totalCurrentVotes > 0 ? (sortedCurrentTotals[0] || 0) / totalCurrentVotes : 0;
        const rankedChoicePending = rankedChoice
            && candidateCount > 2
            && reportingShare < 0.9995
            && currentLeaderShare < 0.51;
        const projectionCacheKey = [
            electionType,
            normalizedStateCode,
            Math.round(reportingShare * 200),
            Math.round(totalExpectedVotes / 1000),
            candidateVoteRows.map(row => Math.round((Number(row.votes) || 0) / 2500)).join(",")
        ].join("|");
        if(chanceZoneProjectionCache.has(projectionCacheKey)) {
            return chanceZoneProjectionCache.get(projectionCacheKey);
        }
        const simulations = 240;
        const winCounts = new Array(candidateCount).fill(0);
        const sharedVolatility = 0.018 + (0.060 * Math.pow(1 - reportingShare, 0.72));
        for(let simulation = 0; simulation < simulations; simulation++) {
            const totals = currentTotals.slice();
            const sharedErrors = new Array(candidateCount).fill(0).map((_value, candidateIndex) =>
                getChanceSeededNormal(`${electionType}|${stateCode}|shared|${simulation}|${candidateIndex}`) * sharedVolatility
            );
            zones.forEach(zone => {
                const pendingVotes = Math.max(0, zone.expectedTotal - zone.currentTotal);
                if(pendingVotes <= 0) return;
                const zoneVolatility = Math.min(
                    0.095,
                    zone.estimateUncertainty
                        * (0.65 + (0.35 / Math.sqrt(Math.max(1, pendingVotes / 50000))))
                );
                const projectedShares = normalizeChanceShares(zone.estimatedShares.map((share, candidateIndex) => {
                    const noise = getChanceSeededNormal(`${stateCode}|${zone.key}|${simulation}|${candidateIndex}`) * zoneVolatility;
                    return share + sharedErrors[candidateIndex] + noise;
                }));
                projectedShares.forEach((share, candidateIndex) => {
                    totals[candidateIndex] += pendingVotes * share;
                });
            });
            if(rankedChoice && candidateCount > 2) {
                const rankedIndexes = totals
                    .map((votes, candidateIndex) => ({ candidateIndex, votes }))
                    .sort((a, b) => b.votes - a.votes);
                const totalVotes = totals.reduce((sum, votes) => sum + votes, 0);
                if(totalVotes > 0 && rankedIndexes[0].votes / totalVotes < 0.5) {
                    const finalists = rankedIndexes.slice(0, 2);
                    rankedIndexes.slice(2).forEach(eliminated => {
                        const transferableVotes = totals[eliminated.candidateIndex] * 0.88;
                        const eliminatedSide = getChanceCandidateSide(candidateVoteRows[eliminated.candidateIndex]);
                        const firstSide = getChanceCandidateSide(candidateVoteRows[finalists[0].candidateIndex]);
                        const secondSide = getChanceCandidateSide(candidateVoteRows[finalists[1].candidateIndex]);
                        let firstShare = 0.5 + (getChanceSeededNormal(`${stateCode}|rcv|${simulation}|${eliminated.candidateIndex}`) * 0.12);
                        if(eliminatedSide && firstSide !== secondSide) {
                            if(eliminatedSide === firstSide) firstShare += 0.18;
                            if(eliminatedSide === secondSide) firstShare -= 0.18;
                        }
                        firstShare = Math.max(0.12, Math.min(0.88, firstShare));
                        totals[finalists[0].candidateIndex] += transferableVotes * firstShare;
                        totals[finalists[1].candidateIndex] += transferableVotes * (1 - firstShare);
                        totals[eliminated.candidateIndex] -= transferableVotes;
                    });
                }
            }
            let winnerIndex = 0;
            for(let candidateIndex = 1; candidateIndex < totals.length; candidateIndex++) {
                if(totals[candidateIndex] > totals[winnerIndex]) winnerIndex = candidateIndex;
            }
            winCounts[winnerIndex]++;
        }
        const candidateProbabilities = winCounts.map(count => (count / simulations) * 100);
        let leaderIndex = 0;
        for(let index = 1; index < candidateProbabilities.length; index++) {
            if(candidateProbabilities[index] > candidateProbabilities[leaderIndex]) leaderIndex = index;
        }
        const leaderRow = candidateVoteRows[leaderIndex];
        if(!leaderRow || !getChanceCandidateSide(leaderRow)) return null;
        const reportingPercent = reportingShare * 100;
        const rawProbability = candidateProbabilities[leaderIndex];
        const calibrationWeight = 0.38 + (0.57 * Math.pow(reportingShare, 0.82));
        const calibratedProbability = 50 + ((rawProbability - 50) * calibrationWeight);
        const confidenceCap = getChanceConfidenceCap(reportingPercent, { rankedChoicePending });
        const cappedProbability = Math.min(calibratedProbability, confidenceCap);
        const zoneSummaries = zones
            .map(zone => {
                const visibleLeaderIndex = zone.actualShares
                    ? zone.actualShares.reduce((bestIndex, share, index, shares) => share > shares[bestIndex] ? index : bestIndex, 0)
                    : null;
                const estimatedLeaderIndex = zone.estimatedShares
                    .reduce((bestIndex, share, index, shares) => share > shares[bestIndex] ? index : bestIndex, 0);
                return {
                    name: zone.name,
                    reportingPercent: zone.reportingShare * 100,
                    currentTotal: zone.currentTotal,
                    expectedTotal: zone.expectedTotal,
                    pendingTotal: Math.max(0, zone.expectedTotal - zone.currentTotal),
                    estimateMethod: zone.estimateMethod,
                    visibleLeaderName: visibleLeaderIndex === null ? "" : candidateVoteRows[visibleLeaderIndex]?.name || "",
                    visibleLeaderPercent: visibleLeaderIndex === null ? null : (zone.actualShares[visibleLeaderIndex] * 100),
                    estimatedLeaderName: candidateVoteRows[estimatedLeaderIndex]?.name || "",
                    estimatedLeaderPercent: zone.estimatedShares[estimatedLeaderIndex] * 100,
                    estimatedLeaderLow: Math.max(0, (zone.estimatedShares[estimatedLeaderIndex] - zone.estimateUncertainty) * 100),
                    estimatedLeaderHigh: Math.min(100, (zone.estimatedShares[estimatedLeaderIndex] + zone.estimateUncertainty) * 100),
                    hasCountyPrior: Boolean(zone.territorialShares)
                };
            })
            .sort((zoneA, zoneB) => zoneB.pendingTotal - zoneA.pendingTotal);
        const projection = {
            method: "zones",
            probability: cappedProbability,
            rawProbability,
            calibratedProbability,
            confidenceCap,
            leaderIndex,
            leaderName: leaderRow.name,
            candidateProbabilities,
            candidateNames: candidateVoteRows.map(row => row.name),
            reportingShare,
            simulations,
            rankedChoice,
            rankedChoicePending,
            zoneCount: zones.length,
            totalExpectedVotes,
            totalCurrentVotes,
            sharedVolatility,
            zoneSummaries
        };
        chanceZoneProjectionCache.set(projectionCacheKey, projection);
        if(chanceZoneProjectionCache.size > 80) {
            chanceZoneProjectionCache.delete(chanceZoneProjectionCache.keys().next().value);
        }
        return projection;
    };
    const getChanceOfWinningData = (point) => {
        const reporting = Math.max(0, Math.min(100, Number(point?.reportingPercent) || 0));
        if(!point || reporting <= 0 || (Number(point.totalCurrVotes) || 0) <= 0) return null;
        const candidates = (Array.isArray(point?.candidates) ? point.candidates : [])
            .filter(candidate => Number.isFinite(Number(candidate.votes)) && Number(candidate.votes) >= 0)
            .slice()
            .sort((candidateA, candidateB) => Number(candidateB.votes) - Number(candidateA.votes));
        if(candidates.length < 2) return null;
        const displayedCandidates = candidates.slice(0, 2);
        const projectedCandidate = displayedCandidates.find(candidate => candidate.projected === true)
            || (point?.raceProjected === true
                ? displayedCandidates.find(candidate => String(candidate.name || "") === String(point.projectedCandidateName || ""))
                : null);
        const { leftCandidate, rightCandidate } = orderChanceCandidatePair(
            displayedCandidates[0],
            displayedCandidates[1]
        );
        const voteLeader = displayedCandidates[0];
        const voteRunnerUp = displayedCandidates[1];
        const reportingShare = Math.max(0.01, reporting / 100);

        const currentVoteTotal = Number(point.totalCurrVotes) || 0;
        const expectedVoteTotal = Math.max(currentVoteTotal, Number(point.totalVotes) || 0);
        const remainingVotes = Math.max(0, expectedVoteTotal - currentVoteTotal);
        const marginVotes = Math.abs((Number(voteLeader.votes) || 0) - (Number(voteRunnerUp.votes) || 0));
        const voteLeadRatio = remainingVotes > 0 ? (marginVotes / remainingVotes) : 6;
        const marginProbabilityForVoteLeader = 50 + (49 * Math.tanh(voteLeadRatio * 1.6));

        let simProbabilityForVoteLeader = null;
        if(point?.chanceProjection && !projectedCandidate && reporting < 99.95) {
            const probabilities = point.chanceProjection.candidateProbabilities || [];
            const leaderSim = Number(probabilities[Number(voteLeader.candidateIndex)]);
            const runnerSim = Number(probabilities[Number(voteRunnerUp.candidateIndex)]);
            if(Number.isFinite(leaderSim) && Number.isFinite(runnerSim) && (leaderSim + runnerSim) > 0) {
                simProbabilityForVoteLeader = (leaderSim / (leaderSim + runnerSim)) * 100;
            }
        }

        const marginWeight = Math.pow(reportingShare, 1.5);
        const leaderProbability = simProbabilityForVoteLeader === null
            ? marginProbabilityForVoteLeader
            : (marginProbabilityForVoteLeader * marginWeight)
                + (simProbabilityForVoteLeader * (1 - marginWeight));
        let leader;
        let runnerUp;
        let probability;
        if(leaderProbability >= 50) {
            leader = voteLeader;
            runnerUp = voteRunnerUp;
            probability = leaderProbability;
        } else {
            leader = voteRunnerUp;
            runnerUp = voteLeader;
            probability = 100 - leaderProbability;
        }
        if(reporting >= 99.95 && Number(displayedCandidates[0].votes) > Number(displayedCandidates[1].votes)) {
            leader = displayedCandidates[0];
            runnerUp = displayedCandidates[1];
            probability = 100;
        } else if(projectedCandidate) {
            leader = projectedCandidate;
            runnerUp = displayedCandidates.find(candidate => candidate !== leader) || runnerUp;
            probability = 99;
        }
        if(reporting < 99.95 && !projectedCandidate) {
            probability = Math.min(probability, getChanceConfidenceCap(reporting));
        }
        probability = Math.max(50, Math.min(100, probability));
        const leaderIsLeft = leader === leftCandidate;
        const meterValue = leaderIsLeft
            ? 50 - (probability - 50)
            : 50 + (probability - 50);
        const decided = Boolean(projectedCandidate)
            || (reporting >= 99.95 && Number(leader.votes) > Number(runnerUp.votes));
        const statusText = decided
            ? "wins"
            : probability >= 85
                ? "very likely"
                : probability >= 65
                    ? "likely"
                    : probability >= 55
                        ? "favored"
                        : "Toss-up";
        return {
            leader,
            runnerUp,
            leftCandidate,
            rightCandidate,
            probability,
            meterValue,
            decided,
            statusText,
            label: probability >= 95 ? "VERY LIKELY" : probability >= 80 ? "LIKELY" : probability >= 65 ? "LEAN" : "TOSSUP"
        };
    };
    const describeArc = (cx, cy, radius, startValue, endValue) => {
        const toPoint = value => {
            const angle = (180 - (value * 1.8)) * (Math.PI / 180);
            return {
                x: cx + (radius * Math.cos(angle)),
                y: cy - (radius * Math.sin(angle))
            };
        };
        const start = toPoint(startValue);
        const end = toPoint(endValue);
        const largeArc = Math.abs(endValue - startValue) > 50 ? 1 : 0;
        return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    };
    const describeDonutSegment = (cx, cy, outerRadius, innerRadius, startValue, endValue) => {
        const toPoint = (value, radius) => {
            const angle = (180 - (value * 1.8)) * (Math.PI / 180);
            return {
                x: cx + (radius * Math.cos(angle)),
                y: cy - (radius * Math.sin(angle))
            };
        };
        const outerStart = toPoint(startValue, outerRadius);
        const outerEnd = toPoint(endValue, outerRadius);
        const innerEnd = toPoint(endValue, innerRadius);
        const innerStart = toPoint(startValue, innerRadius);
        const largeArc = Math.abs(endValue - startValue) > 50 ? 1 : 0;
        return [
            `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
            `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
            `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
            "Z"
        ].join(" ");
    };
    const renderChanceOfWinningMeter = (point) => {
        const data = getChanceOfWinningData(point);
        if(!data) {
            return `
                <div class="bm-chance-card">
                    <div class="bm-chance-empty">Chance data will appear as results come in</div>
                </div>
            `;
        }
        const cx = 210;
        const cy = 198;
        const outerRadius = 184;
        const innerRadius = 86;
        const needleLength = outerRadius - 52;
        const getVisualCandidateIdentity = candidate => String(
            candidate?.id
            ?? candidate?.candidateIndex
            ?? candidate?.name
            ?? "candidate"
        ).trim().toLowerCase();
        const visualKey = [
            point?.key || `${point?.stateCode || "state"}|chance`,
            getVisualCandidateIdentity(data.leftCandidate),
            getVisualCandidateIdentity(data.rightCandidate)
        ].join("|");
        const rawTargetMeterValue = Number(data.meterValue);
        const rawTargetProbability = Number(data.probability);
        const targetMeterValue = Math.max(0, Math.min(
            100,
            Number.isFinite(rawTargetMeterValue) ? rawTargetMeterValue : 50
        ));
        const targetProbability = Math.max(0, Math.min(
            100,
            Number.isFinite(rawTargetProbability) ? rawTargetProbability : 50
        ));
        const previousVisual = chanceMeterVisualValues.get(visualKey);
        const visualNow = performance.now();
        const previousDuration = Math.max(0, Number(previousVisual?.duration) || 0);
        const previousProgress = previousDuration > 0
            ? Math.max(0, Math.min(1, (visualNow - Number(previousVisual?.startedAt || 0)) / previousDuration))
            : 1;
        const previousEasedProgress = 1 - Math.pow(1 - previousProgress, 3);
        const interpolatePreviousValue = (startKey, targetKey, fallback) => {
            const start = Number(previousVisual?.[startKey]);
            const target = Number(previousVisual?.[targetKey]);
            if(!Number.isFinite(start) || !Number.isFinite(target)) return fallback;
            return start + ((target - start) * previousEasedProgress);
        };
        const initialMeterValue = previousVisual
            ? interpolatePreviousValue("startMeterValue", "meterValue", targetMeterValue)
            : targetMeterValue;
        const initialProbability = previousVisual
            ? interpolatePreviousValue("startProbability", "probability", targetProbability)
            : targetProbability;
        const transitionDistance = Math.max(
            Math.abs(targetMeterValue - initialMeterValue),
            Math.abs(targetProbability - initialProbability)
        );
        const transitionDuration = transitionDistance < 0.1
            ? 0
            : Math.round(Math.max(650, Math.min(1400, 600 + (transitionDistance * 18))));
        const initialNeedleRotation = (initialMeterValue * 1.8) - 180;
        const targetNeedleRotation = (targetMeterValue * 1.8) - 180;
        chanceMeterVisualValues.set(visualKey, {
            startMeterValue: initialMeterValue,
            startProbability: initialProbability,
            meterValue: targetMeterValue,
            probability: targetProbability,
            startedAt: visualNow,
            duration: transitionDuration
        });
        if(chanceMeterVisualValues.size > 160) {
            chanceMeterVisualValues.delete(chanceMeterVisualValues.keys().next().value);
        }
        const leaderColour = data.leader.colour || "#888888";
        const mixGaugeColour = (colour, strength) => {
            try {
                return d3.interpolateRgb("#E6E6E6", colour || "#888888")(strength);
            } catch {
                return colour || "#888888";
            }
        };
        const leftColour = data.leftCandidate?.colour || "#1E5AA8";
        const rightColour = data.rightCandidate?.colour || "#B93220";
        const segments = [
            { start: 0, end: 15, colour: mixGaugeColour(leftColour, 1), label: "VERY LIKELY" },
            { start: 15, end: 31, colour: mixGaugeColour(leftColour, 0.62), label: "LIKELY" },
            { start: 31, end: 41, colour: mixGaugeColour(leftColour, 0.3), label: "LEAN" },
            { start: 41, end: 59, colour: "#E6E6E6", label: "TOSSUP" },
            { start: 59, end: 69, colour: mixGaugeColour(rightColour, 0.3), label: "LEAN" },
            { start: 69, end: 85, colour: mixGaugeColour(rightColour, 0.62), label: "LIKELY" },
            { start: 85, end: 100, colour: mixGaugeColour(rightColour, 1), label: "VERY LIKELY" }
        ];
        const needleColour = segments.find(segment =>
            data.meterValue >= segment.start && data.meterValue <= segment.end
        )?.colour || "#b72d22";
        const winnerPulseDelay = -(Date.now() % 2000);
        const favoriteClassName = data.decided
            ? "bm-chance-favorite bm-chance-favorite-winner"
            : "bm-chance-favorite";
        const favoriteAnimationStyle = data.decided
            ? `animation-delay:${winnerPulseDelay}ms;`
            : "";
        const isTossupStatus = !data.decided && data.statusText === "Toss-up";
        const favoriteText = isTossupStatus
            ? "Toss-up"
            : `${data.leader.name} ${data.statusText}`;
        const favoriteColour = isTossupStatus ? "#6f7378" : leaderColour;
        const chanceDetailText = isTossupStatus
            ? ""
            : `${Math.round(data.probability)}% LIKELY`;
        const matchupName = candidate => getPanelCandidateName(candidate).replace(/\*+$/, "");
        const matchupText = `${matchupName(data.leftCandidate)} vs ${matchupName(data.rightCandidate)}`;
        const labelRadius = innerRadius + ((outerRadius - innerRadius) * 0.52);
        const labelPositions = segments.map(segment => {
            const value = (segment.start + segment.end) / 2;
            const angle = (180 - (value * 1.8)) * (Math.PI / 180);
            return {
                x: cx + (labelRadius * Math.cos(angle)),
                y: cy - (labelRadius * Math.sin(angle))
            };
        });
        return `
            <div class="bm-chance-card" style="--chance-colour:${escapeHtml(leaderColour)};">
                <svg class="bm-chance-meter" viewBox="0 0 420 254" role="img" aria-label="Chance of winning"
                    data-chance-target-rotation="${targetNeedleRotation.toFixed(3)}"
                    data-chance-start-probability="${initialProbability.toFixed(3)}"
                    data-chance-target-probability="${targetProbability.toFixed(3)}"
                    data-chance-transition-duration="${transitionDuration}">
                    <path d="${describeArc(cx, cy, outerRadius + 7, 0, 100)}" class="bm-chance-outer"></path>
                    ${segments.map(segment => `
                        <path d="${describeDonutSegment(cx, cy, outerRadius, innerRadius, segment.start + 0.35, segment.end - 0.35)}" fill="${escapeHtml(segment.colour)}" class="bm-chance-segment"></path>
                    `).join("")}
                    ${segments.map((segment, index) => `
                        <text x="${labelPositions[index].x}" y="${labelPositions[index].y}" class="bm-chance-segment-label" text-anchor="middle">${segment.label}</text>
                    `).join("")}
                    <line x1="${cx}" y1="${cy}" x2="${cx + needleLength}" y2="${cy}" class="bm-chance-needle"
                        style="--needle-colour:${escapeHtml(needleColour)};transform-origin:${cx}px ${cy}px;transform:rotate(${initialNeedleRotation.toFixed(3)}deg);transition:transform ${transitionDuration}ms cubic-bezier(0.22, 0.61, 0.36, 1);"></line>
                    <circle cx="${cx}" cy="${cy}" r="11" class="bm-chance-pivot" style="--needle-colour:${escapeHtml(needleColour)};"></circle>
                </svg>
                <div class="${favoriteClassName}" style="color:${escapeHtml(favoriteColour)};${favoriteAnimationStyle}">${escapeHtml(favoriteText)}</div>
                ${chanceDetailText ? `<div class="bm-chance-percent"><span class="bm-chance-percent-value">${Math.round(initialProbability)}</span>% LIKELY</div>` : ""}
                <div class="bm-chance-matchup">${escapeHtml(matchupText)}</div>
            </div>
        `;
    };
    const animateChanceOfWinningMeter = container => {
        const meter = container?.querySelector?.(".bm-chance-meter[data-chance-target-rotation]");
        if(!meter) return;
        const needle = meter.querySelector(".bm-chance-needle");
        const probabilityElement = container.querySelector(".bm-chance-percent-value");
        const targetRotation = Number(meter.dataset.chanceTargetRotation);
        const startProbability = Number(meter.dataset.chanceStartProbability);
        const targetProbability = Number(meter.dataset.chanceTargetProbability);
        const duration = Math.max(0, Number(meter.dataset.chanceTransitionDuration) || 0);
        requestAnimationFrame(() => {
            if(needle && Number.isFinite(targetRotation)) {
                needle.style.transform = `rotate(${targetRotation}deg)`;
            }
            if(!probabilityElement
                || !Number.isFinite(startProbability)
                || !Number.isFinite(targetProbability)
                || duration <= 0) {
                if(probabilityElement && Number.isFinite(targetProbability)) {
                    probabilityElement.textContent = String(Math.round(targetProbability));
                }
                return;
            }
            const startedAt = performance.now();
            const animateProbability = currentTime => {
                if(!probabilityElement.isConnected) return;
                const progress = Math.max(0, Math.min(1, (currentTime - startedAt) / duration));
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const displayedProbability = startProbability
                    + ((targetProbability - startProbability) * easedProgress);
                probabilityElement.textContent = String(Math.round(displayedProbability));
                if(progress < 1) requestAnimationFrame(animateProbability);
            };
            requestAnimationFrame(animateProbability);
        });
    };
    const removeMarginThroughNightChart = () => {
        document.getElementById("bm-margin-through-night")?.remove();
        if(marginThroughNightTooltip) marginThroughNightTooltip.style.display = "none";
    };
    const findMarginThroughNightHost = () => {
        const overlay = document.getElementById("bm-msnbc-election-overlay");
        const isUsable = element => {
            if(!element || overlay?.contains(element)) return false;
            const text = String(element.innerText || element.textContent || "");
            if(!/\bReporting\b/i.test(text)) return false;
            if(!/\bElection\b/i.test(text)) return false;
            if(/\b(?:Primary|Primaries)\b/i.test(text)) return false;
            if(/\b(?:U\.S\.\s+House\s+(?:Elections|Results)|House\s+Results|House\s+District)\b/i.test(text)) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 300 && rect.height > 160;
        };
        const innerExplicit = [
            document.getElementById("electNightInn2Gen"),
            document.getElementById("electPageInn2Gen")
        ].find(isUsable);
        if(innerExplicit) return innerExplicit;
        const fallbackInner = [
            document.getElementById("electNightInn2Gen"),
            document.getElementById("electPageInn2Gen")
        ].find(element => element && element.isConnected && !overlay?.contains(element));
        if(fallbackInner) return fallbackInner;
        const outerExplicit = document.getElementById("electNightInn2");
        if(isUsable(outerExplicit)) return outerExplicit;
        const hosts = Array.from(document.querySelectorAll("div")).filter(isUsable);
        return hosts
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                return (bRect.width * bRect.height) - (aRect.width * aRect.height);
            })[0] || null;
    };
    const findPresidentialMarginThroughNightHost = (stateCode, stateRace) => {
        const stateName = getElectionNightPanelStateName(stateCode);
        if(!stateName || !Array.isArray(stateRace?.cands)) return null;
        const overlay = document.getElementById("bm-msnbc-election-overlay");
        const candidateNames = stateRace.cands
            .map(candidate => getPanelCandidateName(candidate))
            .filter(Boolean);
        const isVisibleNode = element => {
            if(!element || overlay?.contains(element)) return false;
            if(element.closest?.("#bm-margin-through-night, #bm-margin-through-night-tooltip")) return false;
            try {
                const style = window.getComputedStyle(element);
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && element.getClientRects().length > 0;
            } catch {
                return false;
            }
        };
        return Array.from(document.querySelectorAll("div, table"))
            .filter(isVisibleNode)
            .map(element => ({
                element,
                text: String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim()
            }))
            .filter(block => block.text.length > 0
                && block.text.length < 5000
                && new RegExp(`\\b${escapeRegExp(stateName)}\\b`, "i").test(block.text)
                && /\bGeneral Election\b/i.test(block.text)
                && /\bReporting\b/i.test(block.text)
                && candidateNames.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(block.text)))
            .sort((a, b) => a.text.length - b.text.length)[0]?.element || null;
    };
    const getMarginThroughNightMountPoint = (host) => {
        return {
            parent: host,
            before: null
        };
    };
    const ensureMarginThroughNightTooltip = () => {
        if(marginThroughNightTooltip) return marginThroughNightTooltip;
        marginThroughNightTooltip = document.createElement("div");
        marginThroughNightTooltip.id = "bm-margin-through-night-tooltip";
        marginThroughNightTooltip.style.display = "none";
        document.body.appendChild(marginThroughNightTooltip);
        return marginThroughNightTooltip;
    };
    const formatMarginThroughNightTooltip = (point) => {
        const candidateRows = (Array.isArray(point.candidates) && point.candidates.length
            ? point.candidates
            : [
                {
                    name: point.blueCandidateName,
                    votes: Number(point.blueVotes) || 0,
                    percent: Number(point.bluePercent) || 0,
                    colour: point.blueColour || "#888888"
                },
                {
                    name: point.redCandidateName,
                    votes: Number(point.redVotes) || 0,
                    percent: Number(point.redPercent) || 0,
                    colour: point.redColour || "#888888"
                }
            ]).slice().sort((candidateA, candidateB) => Number(candidateB.votes) - Number(candidateA.votes));
        return `
            <div class="bm-margin-tooltip-pin"></div>
            <div class="bm-margin-tooltip-head">
                <span>Reporting</span>
                <strong>${Number(point.reportingPercent).toFixed(1)}%</strong>
            </div>
            <div class="bm-margin-tooltip-divider"></div>
            ${candidateRows.map(candidate => `
                <div class="bm-margin-tooltip-candidate" style="--candidate-colour:${escapeHtml(candidate.colour)};">
                    <span class="bm-margin-tooltip-swatch"></span>
                    <span class="bm-margin-tooltip-name">${escapeHtml(candidate.name)}</span>
                    <span class="bm-margin-tooltip-value">${formatWholeNumber(candidate.votes)} - ${candidate.percent.toFixed(1)}%</span>
                </div>
            `).join("")}
            <div class="bm-margin-tooltip-margin">
                <span>Margin</span>
                <strong>${escapeHtml(getMarginPointLabel(point))}</strong>
            </div>
        `;
    };
    const getDistanceToSegment = (point, segmentStart, segmentEnd) => {
        const dx = segmentEnd.x - segmentStart.x;
        const dy = segmentEnd.y - segmentStart.y;
        if(dx === 0 && dy === 0) return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
        const t = Math.max(0, Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / (dx * dx + dy * dy)));
        const x = segmentStart.x + (t * dx);
        const y = segmentStart.y + (t * dy);
        return Math.hypot(point.x - x, point.y - y);
    };
    const attachMarginThroughNightInteractions = (container, points, pointPositions) => {
        const svg = container.querySelector("svg");
        if(!svg || !points.length) return;
        const tooltip = ensureMarginThroughNightTooltip();
        const viewBox = svg.viewBox?.baseVal;
        const svgCoordinateWidth = Number(viewBox?.width) || 620;
        const svgCoordinateHeight = Number(viewBox?.height) || 190;
        const getTooltipPlacement = (anchor, tooltipRect) => {
            const gap = 16;
            const margin = 8;
            const viewport = {
                left: margin,
                top: margin,
                right: window.innerWidth - margin,
                bottom: window.innerHeight - margin
            };
            const placements = [
                { name: "top", left: anchor.x - (tooltipRect.width / 2), top: anchor.y - tooltipRect.height - gap },
                { name: "bottom", left: anchor.x - (tooltipRect.width / 2), top: anchor.y + gap },
                { name: "right", left: anchor.x + gap, top: anchor.y - (tooltipRect.height / 2) },
                { name: "left", left: anchor.x - tooltipRect.width - gap, top: anchor.y - (tooltipRect.height / 2) }
            ];
            const withOverflow = placements.map(placement => {
                const overflow = Math.max(0, viewport.left - placement.left)
                    + Math.max(0, placement.left + tooltipRect.width - viewport.right)
                    + Math.max(0, viewport.top - placement.top)
                    + Math.max(0, placement.top + tooltipRect.height - viewport.bottom);
                return { ...placement, overflow };
            });
            const best = withOverflow.find(placement => placement.overflow === 0)
                || withOverflow.sort((a, b) => a.overflow - b.overflow)[0];
            return {
                name: best.name,
                left: Math.max(viewport.left, Math.min(best.left, viewport.right - tooltipRect.width)),
                top: Math.max(viewport.top, Math.min(best.top, viewport.bottom - tooltipRect.height))
            };
        };
        const showTooltip = (point, event, anchorPosition, svgRect) => {
            const colour = getMarginPointColour(point);
            tooltip.innerHTML = formatMarginThroughNightTooltip(point);
            tooltip.style.setProperty("--margin-colour", colour);
            tooltip.style.setProperty("--margin-soft-colour", getMarginTooltipSoftColour(point));
            tooltip.style.borderTopColor = colour;
            tooltip.style.display = "block";
            const tooltipRect = tooltip.getBoundingClientRect();
            const anchor = anchorPosition && svgRect
                ? {
                    x: svgRect.left + ((anchorPosition.x / svgCoordinateWidth) * svgRect.width),
                    y: svgRect.top + ((anchorPosition.y / svgCoordinateHeight) * svgRect.height)
                }
                : { x: event.clientX, y: event.clientY };
            const placement = getTooltipPlacement(anchor, tooltipRect);
            tooltip.dataset.placement = placement.name;
            tooltip.style.left = `${placement.left}px`;
            tooltip.style.top = `${placement.top}px`;
        };
        const hideTooltip = () => {
            tooltip.style.display = "none";
        };
        svg.addEventListener("mousemove", event => {
            const rect = svg.getBoundingClientRect();
            const mouse = {
                x: ((event.clientX - rect.left) / rect.width) * svgCoordinateWidth,
                y: ((event.clientY - rect.top) / rect.height) * svgCoordinateHeight
            };
            let nearest = { index: -1, distance: Infinity };
            pointPositions.forEach((position, index) => {
                const distance = Math.hypot(mouse.x - position.x, mouse.y - position.y);
                if(distance < nearest.distance) nearest = { index, distance };
            });
            for(let index = 1; index < pointPositions.length; index++) {
                const distance = getDistanceToSegment(mouse, pointPositions[index - 1], pointPositions[index]);
                if(distance < nearest.distance) nearest = { index, distance };
            }
            if(nearest.index >= 0 && nearest.distance <= 18) {
                showTooltip(points[nearest.index], event, pointPositions[nearest.index], rect);
            }
            else hideTooltip();
        });
        svg.addEventListener("mouseleave", hideTooltip);
    };
    const renderMarginThroughNightChart = () => {
        if(!isElectionNightPanelAvailable() || isPrimaryElectionNightPage()) {
            globalThis.bmMarginThroughNightDebug = { reason: "not-election-night-or-primary", lastMapElectionType };
            removeMarginThroughNightChart();
            return;
        }
        let host = findMarginThroughNightHost();
        if(!host) {
            globalThis.bmMarginThroughNightDebug = { reason: "host-not-found", lastMapElectionType };
            removeMarginThroughNightChart();
            return;
        }
        const electionType = getCurrentMarginThroughNightElectionType(host);
        if(!getMarginThroughNightRaceConfig(electionType)) {
            globalThis.bmMarginThroughNightDebug = {
                reason: "unsupported-election-type",
                electionType,
                lastMapElectionType,
                hostText: String(host.innerText || host.textContent || "").slice(0, 240)
            };
            removeMarginThroughNightChart();
            return;
        }
        const stateCode = getMarginThroughNightVisibleStateCode(host, electionType);
        const stateRace = getMarginThroughNightStateRace(electionType, stateCode);
        if(!stateRace || !Array.isArray(stateRace.cands) || stateRace.cands.length === 0) {
            globalThis.bmMarginThroughNightDebug = {
                reason: "state-race-not-found",
                electionType,
                stateCode,
                lastMapElectionType,
                hostText: String(host.innerText || host.textContent || "").slice(0, 240)
            };
            removeMarginThroughNightChart();
            return;
        }
        if(!hasMarginThroughNightOpposition(stateRace)) {
            globalThis.bmMarginThroughNightDebug = {
                reason: "no-opposing-candidate",
                electionType,
                stateCode,
                candidateCount: Array.isArray(stateRace.cands) ? stateRace.cands.length : 0,
                hostText: String(host.innerText || host.textContent || "").slice(0, 240)
            };
            removeMarginThroughNightChart();
            return;
        }
        if(electionType === "president") {
            const presidentialHost = findPresidentialMarginThroughNightHost(
                stateCode,
                stateRace
            );
            if(onCountyMap && !presidentialHost) {
                globalThis.bmMarginThroughNightDebug = {
                    reason: "presidential-state-host-not-ready",
                    electionType,
                    stateCode
                };
                removeMarginThroughNightChart();
                return;
            }
            host = presidentialHost || host;
        }
        const marginRaceConfig = getMarginThroughNightRaceConfig(electionType);
        const nativeOverride = getMsnbcNativeStateResultsOverride(
            stateCode,
            stateRace,
            getMsnbcRaceConfig(marginRaceConfig?.race)
        );
        const visibleReportedPct = Number(nativeOverride?.reportedPct);
        const visibleCountHasNotStarted = Number.isFinite(visibleReportedPct)
            && visibleReportedPct <= 0;
        const historyKey = getMarginThroughNightHistoryKey(
            electionType,
            stateRace,
            stateCode
        );
        if(visibleCountHasNotStarted) {
            marginThroughNightHistories.delete(historyKey);
            chanceMeterVisualValues.delete(historyKey);
        }
        const nativePoint = visibleCountHasNotStarted
            ? null
            : buildMarginThroughNightPointFromNative(
                electionType,
                stateRace,
                nativeOverride
            );
        if(nativePoint) recordMarginThroughNightPointValue(nativePoint);
        const currentPoint = visibleCountHasNotStarted
            ? null
            : nativePoint || getMarginThroughNightPoint(stateCode);
        let container = document.getElementById("bm-margin-through-night");
        if(!container) {
            container = document.createElement("div");
            container.id = "bm-margin-through-night";
        }
        const mountPoint = getMarginThroughNightMountPoint(host);
        if(mountPoint.before !== container
            && (container.parentElement !== mountPoint.parent || container.nextSibling !== mountPoint.before)) {
            mountPoint.parent.insertBefore(container, mountPoint.before);
        }
        const points = currentPoint
            ? (marginThroughNightHistories.get(currentPoint.key) || [])
                .filter(point => Number(point.reportingPercent) <= Number(currentPoint.reportingPercent) + 0.05)
                .slice()
            : [];
        globalThis.bmMarginThroughNightDebug = {
            reason: "rendered",
            electionType,
            stateCode,
            pointCount: points.length,
            hasNativePoint: Boolean(nativePoint),
            hasCurrentPoint: Boolean(currentPoint),
            historyKey
        };
        const header = `<div class="bm-margin-night-title">MARGIN THROUGH THE NIGHT</div>`;
        const chanceHeader = `<div class="bm-chance-night-title">CHANCE OF WINNING</div>`;
        if(points.length < 1) {
            container.innerHTML = `
                <div class="bm-election-night-insights">
                    <div class="bm-margin-panel">
                        ${header}
                        <div class="bm-margin-night-empty">Margin data will appear as results come in</div>
                    </div>
                    <div class="bm-chance-panel">
                        ${chanceHeader}
                        ${renderChanceOfWinningMeter(currentPoint)}
                    </div>
                </div>
            `;
            animateChanceOfWinningMeter(container);
            return;
        }
        const chart = { width: 480, height: 188, left: 48, right: 14, top: 18, bottom: 32 };
        const plotWidth = chart.width - chart.left - chart.right;
        const plotHeight = chart.height - chart.top - chart.bottom;
        const maxAbsMargin = Math.max(10, Math.ceil(Math.max(...points.map(point => Math.abs(Number(point.margin) || 0))) / 5) * 5);
        const xFor = point => chart.left + ((Math.max(0, Math.min(100, Number(point.reportingPercent) || 0)) / 100) * plotWidth);
        const yFor = point => chart.top + (((maxAbsMargin - (Number(point.margin) || 0)) / (maxAbsMargin * 2)) * plotHeight);
        const pointPositions = points.map(point => ({ x: xFor(point), y: yFor(point) }));
        const evenY = chart.top + (plotHeight / 2);
        const gridX = [0, 25, 50, 75, 100].map(value => chart.left + ((value / 100) * plotWidth));
        const segments = points.slice(1).map((point, index) => {
            const start = pointPositions[index];
            const end = pointPositions[index + 1];
            return `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="${getMarginPointColour(point)}" stroke-width="3.1" stroke-linecap="round"></line>`;
        }).join("");
        const latest = points[points.length - 1];
        const latestColour = getMarginPointColour(latest);
        const latestLabel = getMarginPointLabel(latest);
        container.innerHTML = `
            <div class="bm-election-night-insights">
                <div class="bm-margin-panel">
                    ${header}
                    <div class="bm-margin-night-card">
                        <svg viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="Margin through the night">
                            ${gridX.map(x => `<line x1="${x.toFixed(2)}" y1="${chart.top}" x2="${x.toFixed(2)}" y2="${chart.top + plotHeight}" class="bm-margin-grid"></line>`).join("")}
                            <line x1="${chart.left}" y1="${chart.top}" x2="${chart.left + plotWidth}" y2="${chart.top}" class="bm-margin-grid"></line>
                            <line x1="${chart.left}" y1="${evenY}" x2="${chart.left + plotWidth}" y2="${evenY}" class="bm-margin-even-line"></line>
                            <line x1="${chart.left}" y1="${chart.top + plotHeight}" x2="${chart.left + plotWidth}" y2="${chart.top + plotHeight}" class="bm-margin-grid"></line>
                            <text x="${chart.left - 8}" y="${chart.top + 4}" class="bm-margin-axis-label" text-anchor="end">+${maxAbsMargin}</text>
                            <text x="${chart.left - 8}" y="${evenY + 4}" class="bm-margin-even-label" text-anchor="end">EVEN</text>
                            <text x="${chart.left - 8}" y="${chart.top + plotHeight + 4}" class="bm-margin-axis-label" text-anchor="end">-${maxAbsMargin}</text>
                            ${[0, 25, 50, 75, 100].map(value => `<text x="${(chart.left + ((value / 100) * plotWidth)).toFixed(2)}" y="${chart.height - 8}" class="bm-margin-axis-label" text-anchor="${value === 0 ? "start" : value === 100 ? "end" : "middle"}">${value}%</text>`).join("")}
                            ${segments}
                            ${points.map((point, index) => {
                                const position = pointPositions[index];
                                const isLatest = index === points.length - 1;
                                return `<circle cx="${position.x.toFixed(2)}" cy="${position.y.toFixed(2)}" r="${isLatest ? 6.2 : 4.4}" fill="${getMarginPointColour(point)}" stroke="${isLatest ? "#17365d" : "#ffffff"}" stroke-width="${isLatest ? 1.8 : 1.2}"></circle>`;
                            }).join("")}
                        </svg>
                        <div class="bm-margin-night-latest" style="color:${latestColour};"><span style="background:${latestColour};"></span>${escapeHtml(latestLabel)}</div>
                    </div>
                </div>
                <div class="bm-chance-panel">
                    ${chanceHeader}
                    ${renderChanceOfWinningMeter(currentPoint || latest)}
                </div>
            </div>
        `;
        animateChanceOfWinningMeter(container);
        attachMarginThroughNightInteractions(container, points, pointPositions);
    };
    const updateMarginThroughNightChart = () => {
        const previousActiveMap = typeof activeMap !== "undefined" ? activeMap : undefined;
        const previousOnCountyMap = typeof onCountyMap !== "undefined" ? onCountyMap : undefined;
        const previousLastMapElectionType = lastMapElectionType;
        try {
            recordAllMarginThroughNightPoints();
            renderMarginThroughNightChart();
        } finally {
            if(previousActiveMap !== undefined) activeMap = previousActiveMap;
            if(previousOnCountyMap !== undefined) onCountyMap = previousOnCountyMap;
            lastMapElectionType = previousLastMapElectionType;
        }
    };
    const runWithPreservedMapSelection = (callback) => {
        const previousActiveMap = typeof activeMap !== "undefined" ? activeMap : undefined;
        const previousOnCountyMap = typeof onCountyMap !== "undefined" ? onCountyMap : undefined;
        const previousLastMapElectionType = lastMapElectionType;
        try {
            return callback();
        } finally {
            if(previousActiveMap !== undefined) activeMap = previousActiveMap;
            if(previousOnCountyMap !== undefined) onCountyMap = previousOnCountyMap;
            lastMapElectionType = previousLastMapElectionType;
        }
    };
    const queueMarginThroughNightChartUpdate = (minimumDelay = 90) => {
        if(marginThroughNightUpdateQueued || marginThroughNightUpdateTimer) return;
        marginThroughNightUpdateQueued = true;
        const elapsed = Date.now() - marginThroughNightLastUpdateAt;
        const delay = Math.max(Number(minimumDelay) || 0, 140 - elapsed);
        marginThroughNightUpdateTimer = setTimeout(() => {
            marginThroughNightUpdateTimer = null;
            marginThroughNightUpdateQueued = false;
            marginThroughNightLastUpdateAt = Date.now();
            updateMarginThroughNightChart();
        }, delay);
    };
    const queueMarginThroughNightChartUpdateBurst = () => {
        queueMarginThroughNightChartUpdate(60);
        setTimeout(() => queueMarginThroughNightChartUpdate(80), 280);
    };
    const installMarginThroughNightObserver = () => {
        if(marginThroughNightObserver || !document.body) return;
        marginThroughNightObserver = new MutationObserver(mutations => {
            const shouldUpdate = mutations.some(mutation => {
                const target = mutation.target;
                const element = target?.nodeType === 1 ? target : target?.parentElement;
                if(!element) return false;
                if(element.closest?.("#bm-margin-through-night, #bm-margin-through-night-tooltip, #bm-msnbc-election-overlay")) {
                    return false;
                }
                if(element.closest?.("#electNightTabDiv")) return true;
                const text = String(element.innerText || element.textContent || "");
                return Boolean(
                    element.closest?.("#electNightInn2, #electNightInn2Gen, #electPageInn2Gen")
                    || element.querySelector?.("#electNightInn2, #electNightInn2Gen, #electPageInn2Gen")
                    || (/\bResults\b/i.test(text) && /\bGeneral Election\b/i.test(text))
                    || (/\bReporting\b/i.test(text) && /\bElection\b/i.test(text))
                );
            });
            if(shouldUpdate) queueMarginThroughNightChartUpdate();
        });
        marginThroughNightObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["class", "aria-selected"]
        });
        queueMarginThroughNightChartUpdate(50);
        setTimeout(() => queueMarginThroughNightChartUpdate(80), 350);
    };
    const getMsnbcNativeStateResultsOverride = (stateCode, stateRace, raceConfig = null) => {
        const stateName = getElectionNightPanelStateName(stateCode);
        if(!stateName || !Array.isArray(stateRace?.cands)) return null;
        const overlay = document.getElementById("bm-msnbc-election-overlay");
        const isVisibleNode = element => {
            if(!element || overlay?.contains(element)) return false;
            if(element.closest?.("#bm-margin-through-night, #bm-margin-through-night-tooltip")) return false;
            try {
                const style = window.getComputedStyle(element);
                return style.display !== "none"
                    && style.visibility !== "hidden"
                    && element.getClientRects().length > 0;
            } catch {
                return false;
            }
        };
        const getNativeResultText = element => {
            if(!element) return "";
            const clone = element.cloneNode(true);
            clone.querySelectorAll?.("#bm-margin-through-night, #bm-margin-through-night-tooltip").forEach(child => child.remove());
            return String(clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
        };
        const raceTitle = String(raceConfig?.stateTitle || raceConfig?.title || "")
            .replace(/^U\.S\.\s+/i, "")
            .trim();
        const resultTitlePattern = new RegExp(
            `${escapeRegExp(stateName)}\\s+(?:Results|(?:General\\s+)?${escapeRegExp(raceTitle)}\\s+Election|(?:Presidential|President|Governor|Senate)\\s+Election)`,
            "i"
        );
        const candidates = stateRace.cands.map(candidate => ({
            fullName: String(candidate?.name || ""),
            lastName: getPanelCandidateName(candidate)
        }));
        const blocks = Array.from(document.querySelectorAll("div, table"))
            .filter(isVisibleNode)
            .map(element => ({
                element,
                text: getNativeResultText(element)
            }))
            .filter(block => block.text.length > 0
                && block.text.length < 5000
                && resultTitlePattern.test(block.text)
                && /General Election/i.test(block.text)
                && candidates.some(candidate =>
                    new RegExp(`\\b${escapeRegExp(candidate.lastName)}\\b`, "i").test(block.text)
                ))
            .sort((a, b) => a.text.length - b.text.length);
        const blockText = blocks[0]?.text || "";
        if(!blockText) return null;
        const reportingMatch = blockText.match(/(\d+(?:\.\d+)?)\s*%\s*Reporting/i);
        const reportedPct = reportingMatch ? Number(reportingMatch[1]) : null;
        const votesByIndex = [];
        candidates.forEach((candidate, index) => {
            const namePattern = new RegExp(`\\b${escapeRegExp(candidate.lastName)}\\b`, "i");
            const match = namePattern.exec(blockText);
            if(!match) return;
            let nextCandidateIndex = blockText.length;
            candidates.forEach((otherCandidate, otherIndex) => {
                if(otherIndex === index) return;
                const otherMatch = new RegExp(`\\b${escapeRegExp(otherCandidate.lastName)}\\b`, "i").exec(blockText.slice(match.index + match[0].length));
                if(otherMatch) {
                    nextCandidateIndex = Math.min(nextCandidateIndex, match.index + match[0].length + otherMatch.index);
                }
            });
            const segment = blockText.slice(match.index, nextCandidateIndex);
            const numberPctMatches = Array.from(segment.matchAll(/([0-9][0-9,]*)\s+\d+(?:\.\d+)?\s*%/g));
            const voteMatch = numberPctMatches[numberPctMatches.length - 1];
            if(!voteMatch) return;
            const votes = Number(String(voteMatch[1] || "").replace(/,/g, ""));
            if(Number.isFinite(votes)) votesByIndex[index] = votes;
        });
        if(!Number.isFinite(reportedPct) && votesByIndex.filter(Number.isFinite).length === 0) return null;
        return { reportedPct, votesByIndex };
    };
    const getMsnbcRaceUpdateFunctionNames = (race) => {
        if(race === "house") {
            return [
                "eNightUSHUpdate", "eNightUSHouseUpdate", "eNightHouseUpdate",
                "electNightUSHUpdate", "electNightUSHouseUpdate", "electNightHouseUpdate"
            ];
        }
        if(race === "stateHouse") {
            return ["eNightStHUpdate", "electNightStHUpdate"];
        }
        if(race === "stateSenate") {
            return ["eNightStSUpdate", "electNightStSUpdate"];
        }
        if(race === "senate") {
            return [
                "eNightUSSUpdate", "eNightSenateUpdate", "electNightUSSUpdate", "electNightSenateUpdate"
            ];
        }
        if(race === "governor") {
            return [
                "eNightGovUpdate", "eNightGovernorUpdate", "electNightGovUpdate", "electNightGovernorUpdate"
            ];
        }
        return [
            "eNightPUpdate", "eNightPresUpdate", "eNightPresidentUpdate", "electNightPUpdate", "electNightPresUpdate", "electNightPresidentUpdate"
        ];
    };
    const getMsnbcRaceProjectionFunctionNames = (race) => {
        if(race === "house") {
            return [
                "eNightUSHProjectW", "eNightUSHouseProjectW", "eNightHouseProjectW",
                "electNightUSHProjectW", "electNightUSHouseProjectW", "electNightHouseProjectW"
            ];
        }
        if(race === "stateHouse") {
            return ["eNightStHProjectW", "electNightStHProjectW"];
        }
        if(race === "stateSenate") {
            return ["eNightStSProjectW", "electNightStSProjectW"];
        }
        if(race === "senate") {
            return [
                "eNightUSSProjectW", "eNightUSSenateProjectW", "eNightSenateProjectW",
                "electNightUSSProjectW", "electNightUSSenateProjectW", "electNightSenateProjectW"
            ];
        }
        if(race === "governor") {
            return [
                "eNightGovProjectW", "eNightGovernorProjectW",
                "electNightGovProjectW", "electNightGovernorProjectW"
            ];
        }
        return [
            "eNightPresProjectW", "eNightPresidentProjectW", "eNightPProjectW",
            "electNightPresProjectW", "electNightPresidentProjectW", "electNightPProjectW"
        ];
    };
    const hydrateMsnbcElectionRaceData = (race, force = false) => {
        const now = Date.now();
        if(!force && now - (msnbcElectionRaceHydrationTimestamps[race] || 0) < 350) return;
        msnbcElectionRaceHydrationTimestamps[race] = now;
        if(race === "house") projectMsnbcHouseRacesFromElectionData();
        const projectionFunctions = Array.from(new Set(
            getMsnbcRaceProjectionFunctionNames(race)
                .map(readRuntimeFunction)
                .filter(Boolean)
        ));
        const updateFunctions = Array.from(new Set(
            getMsnbcRaceUpdateFunctionNames(race)
                .map(readRuntimeFunction)
                .filter(Boolean)
        ));
        if(!projectionFunctions.length && !updateFunctions.length) return;
        const previousActiveMap = typeof activeMap !== "undefined" ? activeMap : undefined;
        const previousOnCountyMap = typeof onCountyMap !== "undefined" ? onCountyMap : undefined;
        const previousLastMapElectionType = lastMapElectionType;
        const previousHouseDistrictGridState = houseDistrictGridState;
        const previousHydratingMsnbcElectionData = isHydratingMsnbcElectionData;
        const originalGetElement = document.getElementById;
        const dummyElem = document.createElement("div");
        const dummyContext = new Proxy({}, {
            get: (_target, property) => {
                if(property === "measureText") return () => ({ width: 0 });
                if(property === "getImageData") return () => ({ data: [] });
                return () => {};
            },
            set: () => true
        });
        dummyElem.getContext = () => dummyContext;
        try {
            isHydratingMsnbcElectionData = true;
            if(typeof activeMap !== "undefined") {
                const usesPlayerState = race === "stateHouse" || race === "stateSenate";
                activeMap = usesPlayerState
                    ? (getMsnbcPlayerStateCode() || previousActiveMap || "US")
                    : "US";
            }
            document.getElementById = () => dummyElem;
            projectionFunctions.forEach(projectionFunction => {
                try { projectionFunction(); } catch {}
            });
            updateFunctions.forEach(updateFunction => {
                try { updateFunction(); } catch {}
            });
        } catch {}
        finally {
            document.getElementById = originalGetElement;
            dummyElem.remove();
            if(previousActiveMap !== undefined) activeMap = previousActiveMap;
            if(previousOnCountyMap !== undefined) onCountyMap = previousOnCountyMap;
            lastMapElectionType = previousLastMapElectionType;
            houseDistrictGridState = previousHouseDistrictGridState;
            isHydratingMsnbcElectionData = previousHydratingMsnbcElectionData;
        }
    };
    const hydrateMsnbcElectionData = (force = false) => {
        const races = getMsnbcBackgroundHydrationRaces();
        races.forEach(race => hydrateMsnbcElectionRaceData(race, force));
    };
    const stopMsnbcElectionPanelHydration = () => {
        if(msnbcElectionPanelHydrationTimer) {
            clearInterval(msnbcElectionPanelHydrationTimer);
            msnbcElectionPanelHydrationTimer = null;
        }
    };
    const getMsnbcBackgroundHydrationRaces = () => {
        const availableRaces = getMsnbcAvailableRaces();
        const availableVoteOfficeKeys = new Set(
            getMsnbcAvailableVoteOfficeCategories().map(category => category.key)
        );
        return ["house", "senate", "president", "governor", "stateHouse", "stateSenate"]
            .filter(race => {
                if(race === "president") return availableRaces.includes(race);
                return availableVoteOfficeKeys.has(race);
            });
    };
    const hydrateMsnbcElectionDataStaggered = (force = false) => {
        const races = getMsnbcBackgroundHydrationRaces();
        if(!races.length) return;
        const race = races[msnbcElectionPanelHydrationIndex % races.length];
        msnbcElectionPanelHydrationIndex++;
        hydrateMsnbcElectionRaceData(race, force);
    };
    const startMsnbcElectionPanelHydration = (overlay) => {
        stopMsnbcElectionPanelHydration();
        msnbcElectionPanelHydrationIndex = 0;
        if(getMsnbcAvailableRaces().includes("senate")) {
            getMsnbcFullSenateCountsFromGlobalState();
            hydrateMsnbcElectionRaceData("senate", true);
            logMsnbcSenateElectionNightData(getSenateElectionNightData());
            msnbcElectionPanelHydrationIndex = 1;
        }
        msnbcElectionPanelHydrationTimer = setInterval(() => {
            if(!overlay?.isConnected) {
                stopMsnbcElectionPanelHydration();
                return;
            }
            hydrateMsnbcElectionDataStaggered(false);
        }, 2500);
    };
    const isMsnbcBattlegroundState = (state) => {
        const threshold = 5;
        const totalVotes = Number(state?.totalVotes) || 0;
        if(totalVotes > 0 && Array.isArray(state?.candidates)) {
            const byParty = {};
            state.candidates.forEach(candidate => {
                const party = normalizePanelPartyCode(candidate.party) || "I";
                byParty[party] = (byParty[party] || 0) + (Number(candidate.votes) || 0);
            });
            const ranked = Object.entries(byParty)
                .map(([party, votes]) => ({ party, pct: (votes / totalVotes) * 100 }))
                .sort((a, b) => b.pct - a.pct);
            if(ranked.length >= 2) return Math.abs(ranked[0].pct - ranked[1].pct) <= threshold;
        }
        const stateCode = String(state?.code || "").toLowerCase();
        const stateData = Executive?.data?.states?.[stateCode];
        if(!stateData) return false;
        const toPct = value => {
            const number = Number(value);
            if(!Number.isFinite(number)) return NaN;
            return number <= 1 ? number * 100 : number;
        };
        const ranked = [
            toPct(stateData.demPop),
            toPct(stateData.repPop),
            toPct(stateData.indPop)
        ].filter(Number.isFinite).sort((a, b) => b - a);
        return ranked.length >= 2 && Math.abs(ranked[0] - ranked[1]) <= threshold;
    };
    const isMsnbcGameBattlegroundState = (state) => {
        const explicitValues = [
            state?.battleground,
            state?.isBattleground,
            state?.swing,
            state?.sourceRace?.battleground,
            state?.sourceRace?.isBattleground,
            state?.sourceRace?.swing
        ];
        if(explicitValues.some(value => value === true || value === 1 || String(value).toLowerCase() === "true")) return true;
        const stateCode = String(state?.code || "").toLowerCase();
        const stateData = Executive?.data?.states?.[stateCode];
        if(!stateData) return false;
        const toPct = value => {
            const number = Number(value);
            if(!Number.isFinite(number)) return NaN;
            return number <= 1 ? number * 100 : number;
        };
        const ranked = [
            toPct(stateData.demPop),
            toPct(stateData.repPop),
            toPct(stateData.indPop)
        ].filter(Number.isFinite).sort((a, b) => b - a);
        return ranked.length >= 2 && Math.abs(ranked[0] - ranked[1]) <= 5;
    };
    const getMsnbcProjectedStatusText = (state) => {
        if(!state?.current || !state || Number(state.totalVotes) <= 0 || state.projected === true) return "";
        const reported = Number(state.reportedPct) || 0;
        if(reported >= 10 && reported < 65) return "Too Early To Call";
        if(reported < 65 || !Array.isArray(state.candidates) || state.candidates.length < 2) return "";
        const sortedCandidates = state.candidates.slice().sort((a, b) => Number(b.votes) - Number(a.votes));
        const topVotes = Number(sortedCandidates[0]?.votes) || 0;
        const secondVotes = Number(sortedCandidates[1]?.votes) || 0;
        const totalVotes = Number(state.totalVotes) || 0;
        if(totalVotes <= 0) return "";
        const pctDiff = ((topVotes - secondVotes) / totalVotes) * 100;
        const start = 65;
        const end = 95;
        const maxThreshold = 5.0;
        const minThreshold = 1.5;
        const progress = Math.max(0, Math.min(1, (reported - start) / (end - start)));
        const curve = 1.8;
        const threshold = minThreshold + (maxThreshold - minThreshold) * (1 - Math.pow(progress, curve));
        return pctDiff <= threshold ? "Too Close To Call" : "";
    };
    const getMsnbcOfficialSelectedStateDisplayScope = (state) => {
        const sourceRace = state?.sourceRace;
        if(!state?.current || !sourceRace || !Array.isArray(sourceRace.cands)) return state;
        const candidates = sourceRace.cands.map(candidate => ({
            name: String(candidate.name || "Unknown"),
            party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
            votes: getPanelCurrentCandidateVotes(candidate, sourceRace, { source: "official" }),
            id: candidate.id ?? null,
            sourceCandidate: candidate,
            incumbent: isMsnbcCandidateIncumbent(candidate)
        }));
        const totalVotes = candidates.reduce((sum, candidate) => sum + (Number(candidate.votes) || 0), 0);
        const totalExpectedVotes = Number(state.totalExpectedVotes)
            || Number(sourceRace.totalVotes)
            || sourceRace.cands.reduce((sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0), 0);
        const reportedPct = totalVotes > 0 && totalExpectedVotes > 0
            ? (totalVotes / totalExpectedVotes) * 100
            : 0;
        return {
            ...state,
            candidates,
            totalVotes,
            reportedPct
        };
    };
    const getMsnbcArchivedCandidateColourParty = candidate => {
        const rawParty = candidate?.party?.name
            || candidate?.party?.id
            || candidate?.party
            || candidate?.partyKey
            || candidate?.extendedAttribs?.party
            || candidate?.extendedAttribs?.partyKey
            || "";
        const compactParty = String(rawParty).replace(/[^A-Za-z]/g, "").toUpperCase();
        if([
            "ID", "INDD", "INDDEM", "INDEPENDENTD", "INDEPENDENTDEM",
            "INDEPENDENTDEMOCRAT", "INDEPENDENTDEMOCRATS"
        ].includes(compactParty)) return "ID";
        if([
            "IR", "INDR", "INDREP", "INDEPENDENTR", "INDEPENDENTREP",
            "INDEPENDENTREPUBLICAN", "INDEPENDENTREPUBLICANS"
        ].includes(compactParty)) return "IR";
        return getStatewideShiftCandidateParty(candidate);
    };
    const buildArchivePanelEntry = (archiveEntry, raceConfig) => {
        const sourceStates = raceConfig.race === "president"
            ? (archiveEntry?.exitPoll?.states || [])
            : (archiveEntry?.elections || []);
        if(!Array.isArray(sourceStates) || sourceStates.length === 0) return null;
        const states = sourceStates.map(state => {
            const candidates = (state.candidates || state.cands || []).map(candidate => {
                const colourParty = getMsnbcArchivedCandidateColourParty(candidate);
                return {
                    name: String(candidate.name || "Unknown"),
                    party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
                    colourParty,
                    sourceCandidate: candidate,
                    votes: Number(candidate.totVotes ?? candidate.votes) || 0,
                    id: candidate.id ?? null,
                    incumbent: isMsnbcCandidateIncumbent(candidate)
                };
            });
            const stateCode = raceConfig.race === "president"
                ? getElectionNightPanelStateCode(state.name)
                : getElectionNightPanelStateCode(state.state || state.district || state.name);
            return {
                name: getElectionNightPanelStateName(stateCode),
                code: stateCode,
                year: Number(archiveEntry.year),
                race: raceConfig.race,
                totalVotes: Number(state.totVotes ?? state.totalVotes) || candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
                candidates
            };
        });
        const candidateTotals = {};
        states.forEach(state => {
            state.candidates.forEach(candidate => {
                const key = getElectionNightPanelCandidateKey(candidate);
                if(!candidateTotals[key]) {
                    candidateTotals[key] = { ...candidate, votes: 0, electoralVotes: 0 };
                }
                candidateTotals[key].votes += candidate.votes;
            });
            const winner = state.candidates.slice().sort((a, b) => b.votes - a.votes)[0];
            if(winner) {
                const key = getElectionNightPanelCandidateKey(winner);
                candidateTotals[key].electoralVotes += getElectionNightPanelStateElectoralVotes(state.code);
            }
        });
        const candidates = Object.values(candidateTotals).sort((a, b) => b.votes - a.votes);
        return {
            year: Number(archiveEntry.year),
            current: false,
            race: raceConfig.race,
            candidates,
            states,
            totalVotes: candidates.reduce((sum, candidate) => sum + candidate.votes, 0)
        };
    };
    const buildCurrentPanelEntry = (raceConfig) => {
        const electNight = readRuntimeValue(raceConfig.liveVar);
        if(!Array.isArray(electNight?.elections)) return null;
        const states = electNight.elections
            .filter(stateRace => Array.isArray(stateRace?.cands) && stateRace.cands.length)
            .map(stateRace => {
                const stateCode = getMsnbcElectionStateCode(stateRace);
                const selectedOverrideStateCode = String(msnbcElectionPanelState.selectedStateCode || "").toUpperCase();
                const nativeOverride = selectedOverrideStateCode && selectedOverrideStateCode === String(stateCode || "").toUpperCase()
                    ? getMsnbcNativeStateResultsOverride(stateCode, stateRace, raceConfig)
                    : null;
                const candidates = stateRace.cands.map((candidate, candidateIndex) => ({
                    name: String(candidate.name || "Unknown"),
                    party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
                    portrait: [candidate.portraitSrc, candidate.portrait, candidate.photo, candidate.image]
                        .find(value => typeof value === "string" && value.trim()) || "",
                    sourceCandidate: candidate,
                    votes: Number.isFinite(nativeOverride?.votesByIndex?.[candidateIndex])
                        ? nativeOverride.votesByIndex[candidateIndex]
                        : getPanelCurrentCandidateVotes(candidate, stateRace, { source: "official" }),
                    id: candidate.id ?? null,
                    incumbent: isMsnbcCandidateIncumbent(candidate)
                }));
                const totalCurrVotes = getMsnbcStateTotalVotes(stateRace, candidates);
                const totalExpectedVotes = Number(stateRace.totalVotes) || stateRace.cands.reduce(
                    (sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0),
                    0
                );
                const reportedPct = Number.isFinite(nativeOverride?.reportedPct)
                    ? nativeOverride.reportedPct
                    : (totalExpectedVotes > 0 ? (totalCurrVotes / totalExpectedVotes) * 100 : 0);
                const fullyReported = Number.isFinite(reportedPct) && reportedPct >= 100
                    || (totalExpectedVotes > 0 && totalCurrVotes >= totalExpectedVotes);
                return {
                    name: getElectionNightPanelStateName(stateCode),
                    code: stateCode,
                    totalVotes: totalCurrVotes,
                    totalExpectedVotes,
                    reportedPct,
                    projected: stateRace.pW === true || fullyReported,
                    current: true,
                    candidates,
                    sourceRace: stateRace
                };
            });
        if(states.length === 0) return null;
        const candidateTotals = {};
        states.forEach(state => {
            state.candidates.forEach(candidate => {
                const key = getElectionNightPanelCandidateKey(candidate);
                if(!candidateTotals[key]) {
                    candidateTotals[key] = { ...candidate, votes: 0, electoralVotes: 0 };
                }
                candidateTotals[key].votes += candidate.votes;
            });
            addMsnbcStateElectoralVotes(candidateTotals, state, { includeUnprojectedState: state.totalVotes > 0 });
        });
        const candidates = Object.values(candidateTotals).sort((a, b) => b.votes - a.votes);
        return {
            year: getElectionNightPanelYear(),
            current: true,
            race: raceConfig.race,
            candidates,
            states,
            totalVotes: candidates.reduce((sum, candidate) => sum + candidate.votes, 0)
        };
    };
    const getMsnbcCountySvgPath = (stateCode) => Executive.mods.getRelativePathPrefix()
        + path.sep + "data" + path.sep + "counties" + path.sep + String(stateCode || "").toLowerCase() + ".svg";
    const normalizeMsnbcCountyName = (value) => String(value || "")
        .toLowerCase()
        .replace(/\s+county$/i, "")
        .replace(/\s+city$/i, "")
        .replace(/[^a-z0-9]/g, "");
    const buildCurrentPresidentialCountyEntries = (state) => {
        const stateRace = state?.sourceRace;
        if(!stateRace || !Array.isArray(stateRace.counties)) return [];
        const stateCode = String(state.code || "").toLowerCase();
        const allStateElectionData = readRuntimeValue("allStElectData");
        const stateElectData = (Array.isArray(allStateElectionData) ? allStateElectionData : [])
            .find(electData => String(electData?.id || "").toLowerCase() === stateCode);
        return stateRace.counties.map(county => {
            let totalVotes = 0;
            let totalExpectedVotes = 0;
            const candidates = (county.cands || []).map(candidate => {
                const countyElectData = stateElectData?.counties?.find(candCountyData => candCountyData?.name === county.name);
                const updateIndex = Number(countyElectData?.indx);
                const updateShare = Number.isInteger(updateIndex) && updateIndex > 0 && Array.isArray(candidate.updates)
                    ? Number(candidate.updates[updateIndex])
                    : 0;
                const votes = Number(candidate.votes) * (Number.isFinite(updateShare) ? updateShare : 0);
                const normalizedVotes = Number.isFinite(votes) ? votes : 0;
                totalVotes += normalizedVotes;
                totalExpectedVotes += Number(candidate.votes) || 0;
                return {
                    name: String(candidate.name || "Unknown"),
                    party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
                    votes: normalizedVotes,
                    id: candidate.id ?? null
                };
            });
            return {
                name: String(county.name || ""),
                code: state.code,
                totalVotes,
                reportedPct: totalExpectedVotes > 0 ? (totalVotes / totalExpectedVotes) * 100 : 0,
                candidates
            };
        });
    };
    const getMsnbcPanelEntries = (race) => {
        const raceConfig = getMsnbcRaceConfig(race);
        const entries = [];
        const currentEntry = buildCurrentPanelEntry(raceConfig);
        if(currentEntry) entries.push(currentEntry);
        const archive = readRuntimeValue(raceConfig.archiveVar);
        if(Array.isArray(archive)) {
            archive
                .filter(entry => entry?.category === "general" && (raceConfig.race !== "president" || entry?.exitPoll))
                .map(entry => buildArchivePanelEntry(entry, raceConfig))
                .filter(Boolean)
                .sort((a, b) => Number(b.year) - Number(a.year))
                .forEach(entry => {
                    if(!entries.some(existingEntry => Number(existingEntry.year) === Number(entry.year))) {
                        entries.push(entry);
                    }
                });
        }
        return entries
            .filter(entry => Number.isFinite(Number(entry.year)))
            .sort((a, b) => Number(b.year) - Number(a.year))
            .slice(0, 5);
    };
    const getMsnbcSelectedEntry = (entries) => {
        if(entries.length === 0) return null;
        const selectedYear = Number(msnbcElectionPanelState.selectedYear);
        return entries.find(entry => Number(entry.year) === selectedYear) || entries[0];
    };
    const getMsnbcArchivedColourCandidate = candidate => {
        const sourceCandidate = candidate?.sourceCandidate || candidate;
        const colourParty = candidate?.colourParty || getMsnbcArchivedCandidateColourParty(sourceCandidate);
        return {
            ...sourceCandidate,
            party: colourParty || sourceCandidate?.party,
            votes: Number(candidate?.votes ?? sourceCandidate?.totVotes ?? sourceCandidate?.votes) || 0
        };
    };
    const getMsnbcCandidateColour = (candidate, scope, fallback = "#777777") => {
        if(!candidate) return fallback;
        const sourceRace = scope?.sourceRace;
        const sourceCandidate = sourceRace
            ? (candidate.sourceCandidate || candidate)
            : getMsnbcArchivedColourCandidate(candidate);
        const colourRace = sourceRace && Array.isArray(sourceRace.cands)
            ? sourceRace
            : {
                cands: (scope?.candidates || []).map(getMsnbcArchivedColourCandidate),
                projected: scope?.projected === true,
                colourScope: `msnbc:${scope?.year || "current"}:${scope?.race || "race"}:${scope?.code || scope?.name || "national"}`
            };
        try {
            return stringifyColour(getCandidateColourForRace(sourceCandidate, colourRace));
        } catch {
            return fallback;
        }
    };
    const getMsnbcMapFill = (state) => {
        if(!state || Number(state.totalVotes) <= 0) return "#71818e";
        const winner = state?.candidates?.slice().sort((a, b) => b.votes - a.votes)[0];
        const party = normalizePanelPartyCode(winner?.party);
        if(party === "D") return getMsnbcCandidateColour(winner, state, "#0487E6");
        if(party === "R") return getMsnbcCandidateColour(winner, state, "#DD2929");
        if(party === "I") return getMsnbcCandidateColour(winner, state, "#777777");
        return "#71818e";
    };
    const findMsnbcCountyEntry = (countyEntries, countyName) => {
        const normalizedCountyName = normalizeMsnbcCountyName(countyName);
        return (countyEntries || []).find(county =>
            normalizeMsnbcCountyName(county.name) === normalizedCountyName
        ) || null;
    };
    const renderMsnbcHistoryComparisons = (host, entries, currentEntry, selectedState, raceConfig, panel) => {
        if(!host || !currentEntry?.current || !selectedState || msnbcElectionPanelState.comparisonCount <= 0) return;
        const hiddenYears = new Set((msnbcElectionPanelState.hiddenHistoryYears || []).map(Number));
        const comparisonEntries = entries
            .filter(entry => !entry.current && Number(entry.year) < Number(currentEntry.year))
            .slice(0, Math.min(MSNBC_MAX_HISTORY_COMPARISONS, Number(msnbcElectionPanelState.comparisonCount) || 0))
            .filter(entry => !hiddenYears.has(Number(entry.year)));
        if(comparisonEntries.length === 0) return;
        const cards = comparisonEntries.map(entry => {
            const state = (entry.states || []).find(candidateState =>
                String(candidateState.code || "").toUpperCase() === String(selectedState.code || "").toUpperCase()
            );
            if(!state) return "";
            const totalVotes = Number(state.totalVotes) || 0;
            const candidates = (state.candidates || [])
                .slice()
                .sort((a, b) => Number(b.votes) - Number(a.votes))
                .filter(candidate => Number(candidate.votes) > 0)
                .slice(0, 4);
            return `
                <div class="bm-msnbc-history-card" data-history-year="${escapeHtml(entry.year)}">
                    <button class="bm-msnbc-history-close" data-history-year="${escapeHtml(entry.year)}" title="Close">&times;</button>
                    <div class="bm-msnbc-history-title">
                        <div class="bm-msnbc-history-heading">${escapeHtml(entry.year)} | ${escapeHtml(raceConfig.historyLabel)}</div>
                        ${totalVotes > 0 ? `<div class="bm-msnbc-history-total">${formatWholeNumber(totalVotes)}</div>` : ""}
                    </div>
                    ${candidates.map((candidate, candidateIndex) => {
                        const party = normalizePanelPartyCode(candidate.party) || "I";
                        const candidateName = getPanelCandidateName(candidate);
                        const pct = totalVotes > 0 ? ((Number(candidate.votes) / totalVotes) * 100).toFixed(1) : "0.0";
                        const winnerClass = candidateIndex === 0 ? " winner" : "";
                        return `
                            <div class="bm-msnbc-history-row ${party}${winnerClass}" data-full-name="${escapeHtml(candidateName)}" title="${escapeHtml(candidateName)}">
                                <div class="bm-msnbc-history-name">${escapeHtml(candidateName)}</div>
                                <div class="bm-msnbc-history-pct">${pct}%</div>
                                <div class="bm-msnbc-history-votes">${formatWholeNumber(candidate.votes)}</div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }).join("");
        if(!cards.trim()) return;
        const historyPanel = document.createElement("div");
        historyPanel.className = "bm-msnbc-history-panel";
        historyPanel.innerHTML = cards;
        historyPanel.querySelectorAll(".bm-msnbc-history-close").forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();
                const year = Number(button.dataset.historyYear);
                if(Number.isFinite(year) && !msnbcElectionPanelState.hiddenHistoryYears.includes(year)) {
                    msnbcElectionPanelState.hiddenHistoryYears.push(year);
                }
                renderMsnbcPanelContent(panel);
            });
        });
        host.appendChild(historyPanel);
    };
    const renderMsnbcMap = (host, entry, onStateClick, fillGetter = getMsnbcMapFill) => {
        if(!host) return;
        host.innerHTML = "";
        const mapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep + "states.svg";
        if(msnbcStatesMapTextCache === null) msnbcStatesMapTextCache = fs.readFileSync(mapPath, "utf8");
        const mapText = msnbcStatesMapTextCache;
        const mapDocument = (new DOMParser()).parseFromString(mapText, "image/svg+xml");
        const svg = mapDocument.documentElement;
        const width = Number(svg.getAttribute("width")) || 939;
        const height = Number(svg.getAttribute("height")) || 593;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        host.classList.remove("county-map");
        const statesByCode = {};
        (entry?.states || []).forEach(state => {
            statesByCode[String(state.code || "").toUpperCase()] = state;
        });
        const outlineGroup = svg.getElementsByTagName("g")[0];
        Array.from(outlineGroup?.children || []).forEach(pathElement => {
            const stateCode = String(pathElement.getAttribute("id") || "").toUpperCase();
            pathElement.setAttribute("style", `fill: ${fillGetter(statesByCode[stateCode], stateCode)};`);
            pathElement.addEventListener("click", event => {
                event.stopPropagation();
                if(typeof onStateClick === "function") onStateClick(stateCode);
            });
        });
        host.appendChild(svg);
    };
    const resetMsnbcPanelSelection = () => {
        msnbcElectionPanelState.selectedYear = null;
        msnbcElectionPanelState.selectedStateCode = null;
        msnbcElectionPanelState.selectedCountyName = null;
        msnbcElectionPanelState.comparisonCount = 0;
        msnbcElectionPanelState.hiddenHistoryYears = [];
    };
    const getMsnbcLeadingCandidate = (state) => {
        return (state?.candidates || [])
            .slice()
            .sort((a, b) => Number(b.votes) - Number(a.votes))[0] || null;
    };
    const getMsnbcPartyFill = (party) => {
        const normalizedParty = normalizePanelPartyCode(party);
        if(normalizedParty === "D") return "#0487E6";
        if(normalizedParty === "R") return "#DD2929";
        if(normalizedParty === "I") return "#777777";
        return "#71818e";
    };
    const getMsnbcPartyClass = (party) => normalizePanelPartyCode(party) || "I";
    const getMsnbcRoadMapFill = (state) => {
        if(!state) return "#71818e";
        if(state.projected === true) return getMsnbcPartyFill(getMsnbcLeadingCandidate(state)?.party);
        if(isMsnbcGameBattlegroundState(state)) return "#d8b91f";
        return "#71818e";
    };
    const getMsnbcRaceEntry = (race) => {
        const entries = getMsnbcPanelEntries(race);
        return getMsnbcSelectedEntry(entries);
    };
    const getMsnbcRoadTotals = (entry) => {
        const directTotals = getMsnbcDirectRoadTotals(entry);
        if(directTotals) return directTotals.slice(0, 3);
        const totalsByCandidate = {};
        (entry?.states || []).forEach(state => {
            if(state.projected !== true) return;
            addMsnbcStateElectoralVotes(totalsByCandidate, state);
        });
        return Object.values(totalsByCandidate)
            .sort((a, b) => Number(b.electoralVotes) - Number(a.electoralVotes))
            .slice(0, 3);
    };
    const getMsnbcConfiguredElectoralTotal = () => {
        return Object.values(Executive?.data?.states || {}).reduce((sum, state) =>
            sum + (Number(state?.electoralNum ?? state?.electoralVotes ?? state?.electors ?? state?.ev) || 0),
            0
        );
    };
    const getMsnbcRoadElectoralTotal = (entry) => {
        const configuredTotal = getMsnbcConfiguredElectoralTotal();
        if(configuredTotal > 0) return configuredTotal;
        const entryTotal = (entry?.states || []).reduce((sum, state) =>
            sum + getElectionNightPanelStateElectoralVotes(state.code),
            0
        );
        return entryTotal > 0 ? entryTotal : 538;
    };
    const getMsnbcRoadNeededVotes = (entry) => {
        const total = getMsnbcRoadElectoralTotal(entry);
        return Math.floor(total / 2) + 1;
    };
    const getMsnbcRoadScale = (entry) => {
        const neededVotes = getMsnbcRoadNeededVotes(entry);
        const maxCandidateVotes = getMsnbcRoadTotals(entry).reduce((maxVotes, candidate) =>
            Math.max(maxVotes, Number(candidate.electoralVotes) || 0),
            0
        );
        return Math.max(1, neededVotes, maxCandidateVotes);
    };
    const getMsnbcHouseControlPartyFromElectionData = () => {
        const houseNight = readRuntimeValue("electNightUSH");
        if(!Array.isArray(houseNight?.elections)) return "";
        const counts = { D: 0, R: 0 };
        houseNight.elections.forEach(district => {
            if(!district || !Array.isArray(district?.cands)) return;
            const totalCurrVotes = Number(district.totalCurrVotes) || 0;
            const totalVotes = Number(district.totalVotes) || 0;
            const decided = district.pW === true
                || district.projected === true
                || district.called === true
                || (totalVotes > 0 && totalCurrVotes >= totalVotes);
            if(!decided) return;
            const winner = district.cands.slice().sort((a, b) =>
                (Number(b.currentVotes ?? b.votes ?? b.totVotes) || 0)
                - (Number(a.currentVotes ?? a.votes ?? a.totVotes) || 0)
            )[0];
            const party = getMsnbcSeatControlPartyCode(winner);
            if(party === "D" || party === "R") counts[party]++;
        });
        if(counts.D >= 218 && counts.D > counts.R) return "D";
        if(counts.R >= 218 && counts.R > counts.D) return "R";
        return "";
    };
    const getMsnbcHouseControlPartyFromPoliticians = () => {
        const house = Executive?.data?.politicians?.usHouse;
        if(!house) return "";
        const members = Array.isArray(house) ? house : Object.values(house).flat();
        const counts = { D: 0, R: 0 };
        members.forEach(member => {
            const party = getMsnbcSeatControlPartyCode(member);
            if(party === "D" || party === "R") counts[party]++;
        });
        if(counts.D >= 218 && counts.D > counts.R) return "D";
        if(counts.R >= 218 && counts.R > counts.D) return "R";
        return "";
    };
    const getMsnbcHouseControlTieBreakerParty = () => {
        return getMsnbcHouseControlPartyFromElectionData()
            || getMsnbcHouseControlPartyFromPoliticians();
    };
    const getMsnbcHousePoliticianCounts = () => {
        const house = Executive?.data?.politicians?.usHouse;
        if(!house) return null;
        const members = Array.isArray(house) ? house : Object.values(house).flat();
        const counts = { D: 0, R: 0, I: 0, U: 0, total: 435 };
        members.forEach(member => {
            const party = getMsnbcSeatControlPartyCode(member);
            if(party === "D" || party === "R") counts[party]++;
            else counts.I++;
        });
        const assigned = counts.D + counts.R + counts.I;
        if(assigned > 0 && assigned < counts.total) counts.U = counts.total - assigned;
        return assigned > 0 ? counts : null;
    };
    const getMsnbcHouseSortedCandidates = (district, useFinalVotes = false) => {
        return (district?.cands || []).slice().sort((candidateA, candidateB) => {
            const votesA = Number(candidateA?.[useFinalVotes ? "votes" : "currentVotes"] ?? candidateA?.votes ?? candidateA?.totVotes) || 0;
            const votesB = Number(candidateB?.[useFinalVotes ? "votes" : "currentVotes"] ?? candidateB?.votes ?? candidateB?.totVotes) || 0;
            return votesB - votesA;
        });
    };
    const getMsnbcSeatControlPartyCode = (candidate) => {
        const directParty = getMsnbcCandidatePartyCode(candidate);
        if(directParty === "D" || directParty === "R") return directParty;
        const variantParty = getCandidateVariantPartyKey(candidate);
        if(variantParty === "ID") return "D";
        if(variantParty === "IR") return "R";
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        const caucusParty = normalizePanelPartyCode(
            candidate?.caucusParty
            || candidate?.caucus
            || candidate?.extendedAttribs?.caucusParty
            || candidate?.extendedAttribs?.caucus
            || wrapped?.caucusParty
            || wrapped?.caucus
            || wrapped?.extendedAttribs?.caucusParty
            || wrapped?.extendedAttribs?.caucus
        );
        if(caucusParty === "D" || caucusParty === "R") return caucusParty;
        return directParty || "I";
    };
    const projectMsnbcHouseRacesFromElectionData = () => {
        const houseNight = readRuntimeValue("electNightUSH");
        const races = Array.isArray(houseNight?.elections) ? houseNight.elections : [];
        if(!races.length) return 0;
        let projectedCount = 0;
        races.forEach(district => {
            if(!district || !Array.isArray(district?.cands) || district.pW === true) return;
            const candidates = district.cands;
            const totalCurrVotes = Number(district.totalCurrVotes) || candidates.reduce(
                (sum, candidate) => sum + (Number(candidate?.currentVotes) || 0),
                0
            );
            const totalVotes = Number(district.totalVotes) || candidates.reduce(
                (sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0),
                0
            );
            const fullyCounted = totalVotes > 0 && totalCurrVotes >= totalVotes;
            const useFinalVotes = candidates.length === 1 || fullyCounted;
            const calledCandidate = candidates.find(candidate =>
                candidate?.pW === true
                || candidate?.projected === true
                || candidate?.projectedWinner === true
                || candidate?.called === true
            );
            const sortedCandidates = getMsnbcHouseSortedCandidates(district, useFinalVotes);
            const winner = calledCandidate || sortedCandidates[0];
            if(!winner) return;
            const secondVotes = sortedCandidates.length > 1
                ? (Number(sortedCandidates[1]?.[useFinalVotes ? "votes" : "currentVotes"] ?? sortedCandidates[1]?.votes ?? sortedCandidates[1]?.totVotes) || 0)
                : 0;
            const winnerVotes = Number(winner?.[useFinalVotes ? "votes" : "currentVotes"] ?? winner?.votes ?? winner?.totVotes) || 0;
            const remainingVotes = Math.max(0, totalVotes - totalCurrVotes);
            const mathematicallySafe = totalVotes > 0
                && totalCurrVotes > 0
                && winnerVotes > secondVotes + remainingVotes;
            const reportedPct = totalVotes > 0 ? (totalCurrVotes / totalVotes) * 100 : 0;
            const voteMarginPct = totalCurrVotes > 0 ? ((winnerVotes - secondVotes) / totalCurrVotes) * 100 : 0;
            const projectionThresholdStart = 65;
            const projectionThresholdEnd = 95;
            const maxThreshold = 5.0;
            const minThreshold = 1.5;
            const thresholdProgress = Math.max(0, Math.min(1, (reportedPct - projectionThresholdStart) / (projectionThresholdEnd - projectionThresholdStart)));
            const closeCallThreshold = minThreshold + (maxThreshold - minThreshold) * (1 - Math.pow(thresholdProgress, 1.8));
            const callableByMargin = candidates.length >= 2
                && reportedPct >= projectionThresholdStart
                && voteMarginPct > closeCallThreshold;
            const alreadyCalled = district.projected === true
                || district.called === true
                || Boolean(calledCandidate);
            if(candidates.length === 1 || fullyCounted || mathematicallySafe || callableByMargin || alreadyCalled) {
                district.pW = true;
                winner.pW = true;
                projectedCount++;
            }
        });
        return projectedCount;
    };
    const isMsnbcHouseRaceDecided = (district) => {
        if(!district || !Array.isArray(district?.cands)) return false;
        const totalCurrVotes = Number(district.totalCurrVotes) || 0;
        const totalVotes = Number(district.totalVotes) || 0;
        return district.cands.length === 1
            || district.pW === true
            || district.projected === true
            || district.called === true
            || district.cands.some(candidate =>
                candidate?.pW === true
                || candidate?.projected === true
                || candidate?.projectedWinner === true
                || candidate?.called === true
            )
            || (totalVotes > 0 && totalCurrVotes >= totalVotes);
    };
    const getMsnbcHouseRaceWinnerParty = (district) => {
        if(!district || !Array.isArray(district?.cands)) return "";
        const totalCurrVotes = Number(district.totalCurrVotes) || 0;
        const totalVotes = Number(district.totalVotes) || 0;
        const useFinalVotes = district.cands.length === 1
            || district.pW === true && totalCurrVotes <= 0
            || (totalVotes > 0 && totalCurrVotes >= totalVotes);
        const winner = getMsnbcHouseSortedCandidates(district, useFinalVotes)[0];
        return getMsnbcSeatControlPartyCode(winner);
    };
    const getMsnbcVisiblePageLinesWithoutOverlay = () => {
        const overlayText = String(document.getElementById("bm-msnbc-election-overlay")?.innerText || "");
        const pageText = String(document.body?.innerText || document.body?.textContent || "");
        const cleanText = overlayText ? pageText.replace(overlayText, "") : pageText;
        return cleanText
            .split(/\r?\n/)
            .map(line => line.replace(/\s+/g, " ").trim())
            .filter(Boolean);
    };
    const readMsnbcPartyCountFromLine = (line, label) => {
        const beforeMatch = String(line || "").match(new RegExp(`(?:^|\\b)(\\d+)\\s+${label}\\b`, "i"));
        if(beforeMatch) return Number(beforeMatch[1]);
        const afterMatch = String(line || "").match(new RegExp(`\\b${label}\\s+(\\d+)\\b`, "i"));
        if(afterMatch) return Number(afterMatch[1]);
        return null;
    };
    const getMsnbcHouseControlCountsFromNativePage = () => {
        const lines = getMsnbcVisiblePageLinesWithoutOverlay();
        const titleIndex = lines.findIndex(line => /\bU\.S\. House Elections\b/i.test(line));
        if(titleIndex < 0) return null;
        let demSeats = null;
        let repSeats = null;
        const headerLines = lines.slice(titleIndex + 1, titleIndex + 12);
        for(const line of headerLines) {
            if(/^(Projections|Margins|Select a state to view election results\.?)$/i.test(line)) break;
            if(demSeats === null) demSeats = readMsnbcPartyCountFromLine(line, "Democrats");
            if(repSeats === null) repSeats = readMsnbcPartyCountFromLine(line, "Republicans");
            if(Number.isFinite(demSeats) && Number.isFinite(repSeats)) {
                if(demSeats < 0 || repSeats < 0 || demSeats + repSeats > 435) return null;
                return {
                    D: demSeats,
                    R: repSeats,
                    I: 0,
                    U: Math.max(0, 435 - demSeats - repSeats),
                    total: 435,
                    source: "native-page"
                };
            }
        }
        return null;
    };
    const getMsnbcHouseControlCountsFromElectionData = () => {
        const houseNight = readRuntimeValue("electNightUSH");
        const races = Array.isArray(houseNight?.elections) ? houseNight.elections : [];
        if(races.length >= 100) {
            const counts = { D: 0, R: 0, I: 0, U: 0, total: 435 };
            races.forEach(district => {
                if(!Array.isArray(district?.cands)) return;
                if(!isMsnbcHouseRaceDecided(district)) {
                    counts.U++;
                    return;
                }
                const party = getMsnbcHouseRaceWinnerParty(district);
                if(party === "D" || party === "R") counts[party]++;
                else counts.I++;
            });
            const assigned = counts.D + counts.R + counts.I + counts.U;
            if(assigned <= 0) return getMsnbcHousePoliticianCounts() || { D: 0, R: 0, I: 0, U: 435, total: 435 };
            if(assigned > 0 && assigned < counts.total) counts.U += counts.total - assigned;
            if(assigned > counts.total) {
                const overflow = assigned - counts.total;
                counts.U = Math.max(0, counts.U - overflow);
            }
            return counts;
        }
        return null;
    };
    const getMsnbcHouseDecidedSeatCount = (counts) => {
        if(!counts) return -1;
        return (Number(counts.D) || 0) + (Number(counts.R) || 0) + (Number(counts.I) || 0);
    };
    const getMsnbcHouseControlCounts = () => {
        projectMsnbcHouseRacesFromElectionData();
        const electionCounts = getMsnbcHouseControlCountsFromElectionData();
        const nativeCounts = getMsnbcHouseControlCountsFromNativePage();
        if(electionCounts && nativeCounts) {
            return getMsnbcHouseDecidedSeatCount(electionCounts) >= getMsnbcHouseDecidedSeatCount(nativeCounts)
                ? electionCounts
                : nativeCounts;
        }
        if(electionCounts && getMsnbcHouseDecidedSeatCount(electionCounts) > 0) return electionCounts;
        if(nativeCounts) return nativeCounts;
        return electionCounts || getMsnbcHousePoliticianCounts() || { D: 0, R: 0, I: 0, U: 435, total: 435 };
    };
    const getHouseElectionNightData = () => {
        projectMsnbcHouseRacesFromElectionData();
        const counts = getMsnbcHouseControlCountsFromElectionData();
        if(!counts) return null;
        const democratSeats = Math.max(0, Number(counts.D) || 0);
        const republicanSeats = Math.max(0, Number(counts.R) || 0);
        const independentSeats = Math.max(0, Number(counts.I) || 0);
        const undecidedSeats = Math.max(0, 435 - democratSeats - republicanSeats);
        return {
            democratSeats,
            republicanSeats,
            independentSeats,
            undecidedSeats,
            total: 435,
            source: counts.source || "electNightUSH"
        };
    };
    const updateHouseBaseState = (houseData) => {
        if(!houseData) return null;
        const houseNight = readRuntimeValue("electNightUSH");
        if(houseNight && typeof houseNight === "object") {
            houseNight.democratSeats = houseData.democratSeats;
            houseNight.republicanSeats = houseData.republicanSeats;
            houseNight.independentSeats = houseData.independentSeats;
            houseNight.undecidedSeats = houseData.undecidedSeats;
            houseNight.totalSeats = 435;
            houseNight.projectedDemocratSeats = houseData.democratSeats;
            houseNight.projectedRepublicanSeats = houseData.republicanSeats;
        }
        try {
            globalThis.__betterMapsHouseElectionNightData = {
                ...houseData,
                timestamp: Date.now()
            };
        } catch {}
        return houseData;
    };
    const isNativeHouseElectionPageVisible = () => {
        const overlay = document.getElementById("bm-msnbc-election-overlay");
        const pageText = String(document.body?.innerText || document.body?.textContent || "");
        const overlayText = String(overlay?.innerText || "");
        const nativeText = overlayText ? pageText.replace(overlayText, "") : pageText;
        return /\bU\.S\. House Elections\b/i.test(nativeText);
    };
    const isHouseStateDistrictViewActive = () => {
        return lastMapElectionType === "usHouse"
            && (
                Boolean(houseDistrictGridState)
                || (typeof activeMap !== "undefined" && activeMap && String(activeMap).toUpperCase() !== "US")
            );
    };
    const refreshHouseTab = (houseData, options = {}) => {
        if(!houseData || houseBaseTabRefreshInProgress) return false;
        const key = `${houseData.democratSeats}|${houseData.republicanSeats}|${houseData.independentSeats}|${houseData.undecidedSeats}`;
        if(options.force !== true && key === lastHouseBaseTabRefreshKey) return false;
        lastHouseBaseTabRefreshKey = key;
        console.log("House base tab refreshed from Election Night", {
            democratSeats: houseData.democratSeats,
            republicanSeats: houseData.republicanSeats,
            undecidedSeats: houseData.undecidedSeats,
            total: houseData.democratSeats + houseData.republicanSeats + houseData.undecidedSeats
        });
        if(isHouseStateDistrictViewActive()) return false;
        if(!isNativeHouseElectionPageVisible()) return false;
        const nativeRefresh = readRuntimeFunction("electNightUSHFunc");
        if(!nativeRefresh) return false;
        houseBaseTabRefreshInProgress = true;
        try {
            nativeRefresh();
            return true;
        } catch (error) {
            try { console.warn("House base tab refresh failed", error); } catch {}
            return false;
        } finally {
            houseBaseTabRefreshInProgress = false;
        }
    };
    const refreshHouseBaseTabFromElectionNight = (options = {}) => {
        if(houseBaseTabRefreshInProgress) return null;
        const isStateDistrictView = isHouseStateDistrictViewActive();
        if(!isStateDistrictView) {
            try { hydrateMsnbcElectionRaceData("house", options.force === true); } catch {}
        }
        const houseData = updateHouseBaseState(getHouseElectionNightData());
        if(isStateDistrictView) return houseData;
        refreshHouseTab(houseData, options);
        return houseData;
    };
    const getMsnbcHouseControlParty = (counts) => {
        if(!counts) return "";
        const demSeats = Number(counts.D) || 0;
        const repSeats = Number(counts.R) || 0;
        if(demSeats >= 218 && demSeats > repSeats) return "D";
        if(repSeats >= 218 && repSeats > demSeats) return "R";
        return "";
    };
    const getMsnbcPartyFromCharacterLike = (value) => {
        if(!value) return "";
        try {
            if(Array.isArray(value)) {
                const directParty = normalizePanelPartyCode(value[0]);
                if(directParty === "D" || directParty === "R") return directParty;
                const wrapped = Executive?.data?.characters?.wrapCharacter(value, "candidate");
                return normalizePanelPartyCode(
                    wrapped?.extendedAttribs?.party
                    || wrapped?.caucusParty
                    || wrapped?.party
                );
            }
            return normalizePanelPartyCode(
                value?.extendedAttribs?.party
                || value?.caucusParty
                || value?.party
                || value?.partyId
                || value?.partyID
                || value?.partyCode
            );
        } catch {}
        return "";
    };
    const getMsnbcCurrentPresidentParty = () => {
        const sources = [
            readRuntimeValue("usPresident"),
            globalThis?.usPresident,
            Executive?.data?.usPresident,
            Executive?.data?.president,
            Executive?.data?.officeHolders?.president,
            Executive?.data?.executive?.president,
            Executive?.data?.federal?.president,
            Executive?.data?.politicians?.president,
            Executive?.data?.politicians?.usPresident,
            Executive?.data?.politicians?.executive?.president,
            readRuntimeValue("vicePresident"),
            globalThis?.vicePresident,
            Executive?.data?.vicePresident,
            Executive?.data?.politicians?.vicePresident,
            readRuntimeValue("presidentElect"),
            readRuntimeValue("vicePresidentElect"),
            globalThis?.presidentElect,
            globalThis?.vicePresidentElect,
            Executive?.data?.presidentElect,
            Executive?.data?.vicePresidentElect
        ];
        for(const source of sources) {
            const party = getMsnbcPartyFromCharacterLike(source);
            if(party === "D" || party === "R") return party;
        }
        const storedParty = normalizePanelPartyCode(
            readRuntimeValue("nationStats")?.presWinParty
            || readRuntimeValue("stateStats")?.presWinParty
            || globalThis?.nationStats?.presWinParty
            || globalThis?.stateStats?.presWinParty
        );
        return storedParty === "D" || storedParty === "R" ? storedParty : "";
    };
    const getMsnbcPresidentialSenateTieBreakerParty = () => {
        const entry = getMsnbcRaceEntry("president");
        if(!entry) return "";
        const totals = getMsnbcRoadTotals(entry);
        if(!totals.length) return "";
        const neededVotes = getMsnbcRoadNeededVotes(entry);
        const rankedTotals = totals.slice().sort((a, b) =>
            (Number(b.electoralVotes) || 0) - (Number(a.electoralVotes) || 0)
        );
        const first = rankedTotals[0];
        const second = rankedTotals[1];
        const firstElectors = Number(first?.electoralVotes) || 0;
        const secondElectors = Number(second?.electoralVotes) || 0;
        if(firstElectors >= neededVotes && firstElectors > secondElectors) {
            return getMsnbcPartyClass(first.party);
        }
        const electoralTotal = getMsnbcRoadElectoralTotal(entry);
        const assignedElectors = rankedTotals.reduce((sum, candidate) =>
            sum + (Number(candidate.electoralVotes) || 0), 0
        );
        if(assignedElectors >= electoralTotal && firstElectors === secondElectors) {
            return getMsnbcHouseControlTieBreakerParty();
        }
        return "";
    };
    const getMsnbcSenateControlParty = (counts) => {
        if(!counts) return "";
        const demSeats = Number(counts.D) || 0;
        const repSeats = Number(counts.R) || 0;
        if(demSeats >= 51 && demSeats > repSeats) return "D";
        if(repSeats >= 51 && repSeats > demSeats) return "R";
        if(demSeats === 50 && repSeats === 50) {
            const hasPresidentialRace = getMsnbcAvailableRaces().includes("president");
            const tieBreakerParty = hasPresidentialRace
                ? getMsnbcPresidentialSenateTieBreakerParty()
                : getMsnbcCurrentPresidentParty();
            if(tieBreakerParty === "D" || tieBreakerParty === "R") return tieBreakerParty;
        }
        return "";
    };
    const getMsnbcVoteLeaderData = (state) => {
        const totalVotes = Number(state?.totalVotes) || 0;
        const sortedCandidates = (state?.candidates || [])
            .slice()
            .sort((a, b) => Number(b.votes) - Number(a.votes));
        const first = sortedCandidates[0];
        const second = sortedCandidates[1];
        if(!first || !second || totalVotes <= 0) {
            return { leader: first || null, margin: 0, tied: true };
        }
        const firstPct = (Number(first.votes) / totalVotes) * 100;
        const secondPct = (Number(second.votes) / totalVotes) * 100;
        const margin = firstPct - secondPct;
        return { leader: first, margin, tied: Math.abs(margin) < 0.05 };
    };
    const getMsnbcLatestPollAverage = (race, stateCode, year = null) => {
        const filters = {
            electionType: getMsnbcPollElectionType(race),
            stateID: String(stateCode || "").toUpperCase(),
            category: "general",
            party: "",
            currentWeek: null,
            year: Number(year) || getElectionNightPanelYear()
        };
        const weeklyAverages = getPollWeeklyAverages(filters);
        return weeklyAverages[weeklyAverages.length - 1] || null;
    };
    const getMsnbcPollLeaderData = (weekData) => {
        const candidates = (weekData?.candidates || []).slice().sort((a, b) => Number(b.pct) - Number(a.pct));
        const first = candidates[0];
        const second = candidates[1];
        if(!first || !second) return { leader: first || null, margin: 0, tied: true };
        const firstPct = Number.isFinite(Number(first.displayPct)) ? Number(first.displayPct) : Number(first.pct) || 0;
        const secondPct = Number.isFinite(Number(second.displayPct)) ? Number(second.displayPct) : Number(second.pct) || 0;
        const margin = firstPct - secondPct;
        return { leader: first, margin, tied: Math.abs(margin) < 0.05 };
    };
    const formatMsnbcSignedMargin = (margin) => {
        const number = Number(margin);
        if(!Number.isFinite(number) || Math.abs(number) < 0.05) return "TIED";
        return `+${Math.abs(number).toFixed(1)}`;
    };
    const getMsnbcBattlegroundStates = (entry) => {
        return (entry?.states || [])
            .filter(state => isMsnbcGameBattlegroundState(state))
            .sort((a, b) => {
                const evDiff = getElectionNightPanelStateElectoralVotes(b.code) - getElectionNightPanelStateElectoralVotes(a.code);
                return evDiff !== 0 ? evDiff : String(a.code || "").localeCompare(String(b.code || ""));
            });
    };
    const setMsnbcBodyMode = (panel, mode) => {
        const body = panel.querySelector(".bm-msnbc-body");
        if(body) body.className = `bm-msnbc-body${mode ? ` ${mode}` : ""}`;
        return body;
    };
    const openMsnbcView = (panel, view, race = null) => {
        if(race && msnbcElectionPanelState.activeRace !== race) {
            msnbcElectionPanelState.activeRace = race;
            resetMsnbcPanelSelection();
        }
        if(msnbcElectionPanelState.view !== view) {
            msnbcElectionPanelState.view = view;
            if(view !== "race") resetMsnbcPanelSelection();
        }
        renderMsnbcPanelContent(panel);
    };
    const renderMsnbcPanelNav = (panel) => {
        const nav = panel.querySelector(".bm-msnbc-tabs");
        if(!nav) return;
        if(msnbcElectionPanelState.view === "hub") {
            nav.className = "bm-msnbc-tabs hidden";
            nav.innerHTML = "";
            return;
        }
        const viewLabels = {
            road270: `Presidential Road to ${getMsnbcRoadNeededVotes(getMsnbcRaceEntry("president"))}`,
            roadBattlegrounds: "Uncalled Battleground States",
            battlegroundPolls: "Battlegrounds + Polls",
            senateControl: "Senate",
            houseControl: "House",
            voteByOffice: "Vote By Office"
        };
        const raceLabels = {
            president: "Presidential States",
            senate: "Senate By State",
            governor: "Governor By State"
        };
        const label = msnbcElectionPanelState.view === "race"
            ? raceLabels[msnbcElectionPanelState.activeRace] || "Election Results"
            : viewLabels[msnbcElectionPanelState.view] || "Election Night";
        nav.className = "bm-msnbc-tabs compact";
        nav.innerHTML = `
            <button class="bm-msnbc-back-btn" id="bm-msnbc-back-to-hub">Back</button>
            <div class="bm-msnbc-view-label">${escapeHtml(label)}</div>
        `;
        nav.querySelector("#bm-msnbc-back-to-hub")?.addEventListener("click", () => {
            openMsnbcView(panel, "hub");
        });
    };
    const renderMsnbcHub = (panel) => {
        const body = setMsnbcBodyMode(panel, "hub");
        if(!body) return;
        const sections = getMsnbcAvailableSections();
        const hasPresident = sections.president;
        const roadNeeded = hasPresident ? getMsnbcRoadNeededVotes(getMsnbcRaceEntry("president")) : 270;
        const tiles = [
            { title: "President", sub: "National vote and state results", mark: "P", view: "race", race: "president", enabled: sections.president },
            { title: `Road to ${roadNeeded}`, sub: "Projected electoral map", mark: String(roadNeeded), view: "road270", enabled: sections.road270, className: "main" },
            { title: "Senate", sub: "Control board", mark: "S", view: "senateControl", enabled: sections.senateControl },
            { title: "House", sub: "Control board", mark: "H", view: "houseControl", enabled: sections.houseControl },
            { title: "Senate By State", sub: "State races", mark: "ST", view: "race", race: "senate", enabled: sections.senateRace },
            { title: "Governor By State", sub: "State races", mark: "G", view: "race", race: "governor", enabled: sections.governorRace },
            { title: "Vote By\nOffice", sub: "Total votes and vote share", mark: "VO", view: "voteByOffice", enabled: sections.voteByOffice, className: "stacked-title" },
            { title: "Battlegrounds + Polls", sub: "Latest weekly averages", mark: "BG", view: "battlegroundPolls", enabled: sections.battlegroundPolls, className: "wide" }
        ].filter(tile => tile.enabled);
        body.innerHTML = `
            <div class="bm-msnbc-hub">
                <div class="bm-msnbc-hub-grid">
                    ${tiles.map(tile => `
                        <button class="bm-msnbc-hub-tile ${escapeHtml(tile.className || "")}"
                            data-view="${escapeHtml(tile.view)}"
                            data-race="${escapeHtml(tile.race || "")}">
                            <div class="bm-msnbc-hub-tile-title">${escapeHtml(tile.title)}</div>
                            <div class="bm-msnbc-hub-tile-sub">${escapeHtml(tile.sub)}</div>
                            <div class="bm-msnbc-hub-mark">${escapeHtml(tile.mark)}</div>
                            <div class="bm-msnbc-hub-bars"><span></span><span></span><span></span><span></span></div>
                        </button>
                    `).join("") || `<div class="bm-msnbc-empty">No general election results found yet.</div>`}
                </div>
            </div>
        `;
        body.querySelectorAll(".bm-msnbc-hub-tile").forEach(tile => {
            tile.addEventListener("click", () => {
                if(tile.disabled) return;
                openMsnbcView(panel, tile.dataset.view || "hub", tile.dataset.race || null);
            });
        });
    };
    const getMsnbcVoteOfficeCandidateVotes = (candidate, race, category) => {
        const candidates = getMsnbcVoteOfficeRaceCandidates(race);
        const getCurrentVotes = raceCandidate => Number(
            raceCandidate?.currentVotes
            ?? raceCandidate?.currVotes
            ?? raceCandidate?.countedVotes
        );
        const updateVotes = getPanelCurrentCandidateVotes(candidate, race, {
            stateCode: category?.playerStateOnly ? getMsnbcPlayerStateCode() : ""
        });
        const hasVisibleVotes = (Number(race?.totalCurrVotes ?? race?.currentVotes) || 0) > 0
            || candidates.some(raceCandidate => (getCurrentVotes(raceCandidate) || 0) > 0);
        if(hasVisibleVotes || (Number.isFinite(updateVotes) && updateVotes > 0)) {
            const currentVotes = getCurrentVotes(candidate);
            const officialVotes = Number.isFinite(currentVotes) && currentVotes >= 0 ? currentVotes : 0;
            const sequencedVotes = Number.isFinite(updateVotes) && updateVotes >= 0 ? updateVotes : 0;
            return Math.max(officialVotes, sequencedVotes);
        }
        const expectedVotes = Number(race?.totalVotes) || 0;
        const reportedVotes = Number(race?.totalCurrVotes) || 0;
        if(expectedVotes > 0 && reportedVotes >= expectedVotes) {
            return Math.max(0, Number(candidate?.votes ?? candidate?.totVotes) || 0);
        }
        return 0;
    };
    const getMsnbcVoteOfficePartyGroup = candidate => {
        const rawParty = String(
            candidate?.party
            || candidate?.extendedAttribs?.party
            || candidate?.affiliation
            || candidate?.caucusParty
            || candidate?.caucus
            || (Array.isArray(candidate) ? candidate[0] : "")
            || ""
        ).trim();
        const compactParty = rawParty.replace(/[^A-Za-z]/g, "").toUpperCase();
        if(/independent/i.test(rawParty)
            || ["I", "ID", "IR", "IND", "INDD", "INDR", "INDDEM", "INDREP"].includes(compactParty)) {
            return "I";
        }
        const party = normalizePanelPartyCode(rawParty);
        return party === "D" || party === "R" ? party : "I";
    };
    const getMsnbcVoteOfficeTotals = category => {
        const totals = { D: 0, R: 0, I: 0 };
        getMsnbcVoteOfficeRaces(category).forEach(race => {
            getMsnbcVoteOfficeRaceCandidates(race).forEach(candidate => {
                const group = getMsnbcVoteOfficePartyGroup(candidate);
                totals[group] += getMsnbcVoteOfficeCandidateVotes(candidate, race, category);
            });
        });
        totals.total = totals.D + totals.R + totals.I;
        return totals;
    };
    const renderMsnbcVoteByOffice = panel => {
        const body = setMsnbcBodyMode(panel, "vote-office");
        if(!body) return;
        const availableCategories = getMsnbcAvailableVoteOfficeCategories();
        if(!availableCategories.length) {
            body.innerHTML = `<div class="bm-msnbc-empty">No vote-by-office results are available for this election night.</div>`;
            return;
        }
        const availableKeys = new Set(availableCategories.map(category => category.key));
        if(!availableKeys.has(msnbcElectionPanelState.selectedVoteOffice)) {
            msnbcElectionPanelState.selectedVoteOffice = availableCategories[0]?.key || "house";
        }
        const category = getMsnbcVoteOfficeCategory(msnbcElectionPanelState.selectedVoteOffice);
        hydrateMsnbcElectionRaceData(category.key);
        const totals = getMsnbcVoteOfficeTotals(category);
        const percentages = {
            D: totals.total > 0 ? (totals.D / totals.total) * 100 : 0,
            R: totals.total > 0 ? (totals.R / totals.total) * 100 : 0,
            I: totals.total > 0 ? (totals.I / totals.total) * 100 : 0
        };
        const marginValue = totals.total > 0
            ? (Math.abs(totals.D - totals.R) / totals.total) * 100
            : 0;
        const marginParty = totals.D === totals.R ? "tie" : (totals.D > totals.R ? "D" : "R");
        const marginText = marginParty === "tie" ? "Tie" : `${marginParty} +${marginValue.toFixed(1)}`;
        const rows = [
            { party: "D", label: "DEM", votes: totals.D, percentage: percentages.D },
            { party: "R", label: "GOP", votes: totals.R, percentage: percentages.R },
            { party: "I", label: "IND/OTHER", votes: totals.I, percentage: percentages.I }
        ].sort((rowA, rowB) => {
            const voteDifference = rowB.votes - rowA.votes;
            if(voteDifference !== 0) return voteDifference;
            return ["D", "R", "I"].indexOf(rowA.party) - ["D", "R", "I"].indexOf(rowB.party);
        });
        body.innerHTML = `
            <div class="bm-msnbc-vote-office">
                <div class="bm-msnbc-vote-office-toolbar">
                    <div class="bm-msnbc-vote-office-heading">
                        Vote By Office
                        <small>Total votes and vote share</small>
                    </div>
                    <label class="bm-msnbc-vote-office-select-wrap">
                        Office
                        <select class="bm-msnbc-vote-office-select" id="bm-msnbc-vote-office-select">
                            ${availableCategories.map(option => `
                                <option value="${escapeHtml(option.key)}"
                                    ${option.key === category.key ? "selected" : ""}>
                                    ${escapeHtml(option.label)}
                                </option>
                            `).join("")}
                        </select>
                    </label>
                </div>
                <div class="bm-msnbc-vote-office-content">
                    <div class="bm-msnbc-vote-office-table">
                        <div class="bm-msnbc-vote-office-name">${escapeHtml(category.label)}</div>
                        <div class="bm-msnbc-vote-office-rows">
                            ${rows.map(row => `
                                <div class="bm-msnbc-vote-office-row ${row.party}">
                                    <div class="bm-msnbc-vote-office-party">${escapeHtml(row.label)}</div>
                                    <div class="bm-msnbc-vote-office-votes">${formatWholeNumber(row.votes)}</div>
                                    <div class="bm-msnbc-vote-office-pct">${row.percentage.toFixed(1)}%</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                    <div class="bm-msnbc-vote-office-visual">
                        <div class="bm-msnbc-vote-office-margin ${marginParty}">${escapeHtml(marginText)}</div>
                        <div class="bm-msnbc-vote-office-bar" aria-label="${escapeHtml(category.label)} vote share">
                            ${rows.map(row => `
                                <div class="bm-msnbc-vote-office-segment ${row.party}"
                                    style="width: ${row.percentage.toFixed(6)}%;"></div>
                            `).join("")}
                        </div>
                        <div class="bm-msnbc-vote-office-legend">
                            ${rows.map(row => `<span>${escapeHtml(row.label)} ${row.percentage.toFixed(1)}%</span>`).join("")}
                        </div>
                    </div>
                </div>
            </div>
        `;
        body.querySelector("#bm-msnbc-vote-office-select")?.addEventListener("change", event => {
            const nextCategory = getMsnbcVoteOfficeCategory(event.currentTarget.value);
            if(!availableKeys.has(nextCategory.key)) return;
            msnbcElectionPanelState.selectedVoteOffice = nextCategory.key;
            renderMsnbcVoteByOffice(panel);
        });
    };
    const renderMsnbcRoadTo270 = (panel) => {
        hydrateMsnbcElectionRaceData("president");
        const body = setMsnbcBodyMode(panel, "road");
        const entry = getMsnbcRaceEntry("president");
        if(!body || !entry) {
            if(body) body.innerHTML = `<div class="bm-msnbc-empty">No presidential results found yet.</div>`;
            return;
        }
        const totals = getMsnbcRoadTotals(entry);
        const scoreCandidates = totals.length ? totals : (entry.candidates || []).slice(0, 2).map(candidate => ({ ...candidate, electoralVotes: 0 }));
        const roadCandidates = scoreCandidates.slice(0, 2);
        const roadNeeded = getMsnbcRoadNeededVotes(entry);
        const roadScale = getMsnbcRoadScale(entry);
        const neededPosition = Math.max(0, Math.min(100, (roadNeeded / roadScale) * 100));
        body.innerHTML = `
            <div class="bm-msnbc-road-layout">
                <div class="bm-msnbc-road-score">
                    <div class="bm-msnbc-road-logo">Road to ${escapeHtml(roadNeeded)}</div>
                    <div class="bm-msnbc-road-race" style="--bm-msnbc-road-needed-position: ${neededPosition.toFixed(2)}%;">
                        <div class="bm-msnbc-road-270-line"><span class="bm-msnbc-road-270-badge">${escapeHtml(roadNeeded)}</span></div>
                        <div class="bm-msnbc-road-heads">
                            ${roadCandidates.map(candidate => {
                                const party = getMsnbcPartyClass(candidate.party);
                                const portraitSource = getCandidateBannerPortraitSource(candidate);
                                return `
                                    <div class="bm-msnbc-road-head ${party}">
                                        <div class="bm-msnbc-road-portrait" aria-label="Portrait of ${escapeHtml(candidate.name || getPanelCandidateName(candidate))}">
                                            ${portraitSource ? `<img src="${escapeHtml(portraitSource)}" alt="">` : ""}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                            ${roadCandidates.length < 2 ? `<div class="bm-msnbc-road-head"></div>` : ""}
                        </div>
                        <div class="bm-msnbc-road-name-strip">
                            ${roadCandidates.map(candidate => {
                                const party = getMsnbcPartyClass(candidate.party);
                                return `<div class="bm-msnbc-road-name ${party}">${escapeHtml(getPanelCandidateName(candidate))}</div>`;
                            }).join("")}
                            ${roadCandidates.length < 2 ? `<div class="bm-msnbc-road-name"></div>` : ""}
                        </div>
                        <div class="bm-msnbc-road-score-row">
                            ${roadCandidates.map(candidate => `
                                <div class="bm-msnbc-road-score-cell">${formatWholeNumber(Math.max(0, Number(candidate.electoralVotes) || 0))}</div>
                            `).join("")}
                            ${roadCandidates.length < 2 ? `<div class="bm-msnbc-road-score-cell">0</div>` : ""}
                        </div>
                        <div class="bm-msnbc-road-bar-row">
                            ${roadCandidates.map(candidate => {
                                const party = getMsnbcPartyClass(candidate.party);
                                const electoralVotes = Math.max(0, Number(candidate.electoralVotes) || 0);
                                const fillPct = Math.max(0, Math.min(100, (electoralVotes / roadScale) * 100));
                                return `
                                    <div class="bm-msnbc-road-bar-cell bm-msnbc-road-candidate ${party}">
                                        <div class="bm-msnbc-road-fill ${party}" style="--bm-msnbc-road-fill: ${fillPct.toFixed(2)}%;"></div>
                                    </div>
                                `;
                            }).join("")}
                            ${roadCandidates.length < 2 ? `<div class="bm-msnbc-road-bar-cell"></div>` : ""}
                        </div>
                    </div>
                </div>
                <div class="bm-msnbc-road-map">
                    <div class="bm-msnbc-road-subnav">
                        <button id="bm-msnbc-road-battlegrounds">Uncalled Battlegrounds</button>
                    </div>
                    <div class="bm-msnbc-map-wrap" id="bm-msnbc-road-map-wrap"></div>
                </div>
            </div>
        `;
        body.querySelector("#bm-msnbc-road-battlegrounds")?.addEventListener("click", () => {
            openMsnbcView(panel, "roadBattlegrounds");
        });
        renderMsnbcMap(body.querySelector("#bm-msnbc-road-map-wrap"), entry, stateCode => {
            msnbcElectionPanelState.view = "race";
            msnbcElectionPanelState.activeRace = "president";
            msnbcElectionPanelState.selectedStateCode = stateCode;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
            renderMsnbcPanelContent(panel);
        }, getMsnbcRoadMapFill);
    };
    const renderMsnbcRoadBattlegrounds = (panel) => {
        hydrateMsnbcElectionRaceData("president");
        const body = setMsnbcBodyMode(panel, "board");
        const entry = getMsnbcRaceEntry("president");
        if(!body || !entry) return;
        const battlegrounds = getMsnbcBattlegroundStates(entry)
            .filter(state => state.projected !== true)
            .slice(0, 10);
        body.innerHTML = `
            <div class="bm-msnbc-board">
                <div class="bm-msnbc-board-header">
                    <span>Uncalled Battleground States</span>
                    <span class="bm-msnbc-board-subtitle">Point spread | Reporting</span>
                </div>
                <div class="bm-msnbc-bg-grid">
                    ${battlegrounds.map(state => {
                        const ev = getElectionNightPanelStateElectoralVotes(state.code);
                        const stateName = String(state.name || "");
                        const compactStateNameClass = stateName.replace(/\s+/g, "").length >= 12 ? " compact" : "";
                        const voteData = getMsnbcVoteLeaderData(state);
                        const leader = voteData.leader;
                        const party = getMsnbcPartyClass(leader?.party);
                        const reportedPct = Math.max(0, Math.min(100, Math.round(Number(state.reportedPct) || 0)));
                        const pendingReport = reportedPct <= 0;
                        const leaderText = pendingReport
                            ? "PENDING REPORT"
                            : (voteData.tied || !leader ? "TIED" : getPanelCandidateName(leader));
                        const leaderDisplayText = pendingReport
                            ? "PENDING REPORT"
                            : (voteData.tied || !leader
                            ? "TIED"
                            : `${leaderText} ${formatMsnbcSignedMargin(voteData.margin)}`);
                        const leaderClass = pendingReport ? "pending" : (voteData.tied ? "tie" : party);
                        return `
                            <div class="bm-msnbc-bg-row">
                                <div class="bm-msnbc-bg-state">
                                    <span class="bm-msnbc-bg-state-name${compactStateNameClass}">${escapeHtml(stateName)}</span>
                                    <small>${escapeHtml(ev)}</small>
                                </div>
                                <div class="bm-msnbc-bg-leader center ${leaderClass}">${escapeHtml(leaderDisplayText)}</div>
                                <div class="bm-msnbc-bg-report">${reportedPct}%<br>IN</div>
                            </div>
                        `;
                    }).join("") || `<div class="bm-msnbc-empty">No uncalled battleground states right now.</div>`}
                </div>
            </div>
        `;
    };
    const renderMsnbcBattlegroundPolls = (panel) => {
        hydrateMsnbcElectionRaceData("president");
        const body = setMsnbcBodyMode(panel, "board");
        const entry = getMsnbcRaceEntry("president");
        if(!body || !entry) return;
        const battlegrounds = getMsnbcBattlegroundStates(entry).slice(0, 14);
        body.innerHTML = `
            <div class="bm-msnbc-board">
                <div class="bm-msnbc-board-header">
                    <span>Battleground States</span>
                    <span class="bm-msnbc-board-subtitle">Average of latest polling week</span>
                </div>
                <div class="bm-msnbc-bg-grid">
                    ${battlegrounds.map(state => {
                        const average = getMsnbcLatestPollAverage("president", state.code, entry.year);
                        const pollData = getMsnbcPollLeaderData(average);
                        const leader = pollData.leader;
                        const party = getMsnbcPartyClass(leader?.party);
                        const leaderText = pollData.tied || !leader ? "TIED" : leader.name;
                        const leaderDisplayText = pollData.tied || !leader
                            ? "TIED"
                            : `${leaderText} ${formatMsnbcSignedMargin(pollData.margin)}`;
                        const weekText = average ? `W${average.week}` : "NO POLL";
                        return `
                            <div class="bm-msnbc-bg-row poll">
                                <div class="bm-msnbc-bg-state">${escapeHtml(state.code)} <small>${escapeHtml(weekText)}</small></div>
                                <div class="bm-msnbc-bg-leader center ${pollData.tied ? "tie" : party}">${escapeHtml(leaderDisplayText)}</div>
                            </div>
                        `;
                    }).join("") || `<div class="bm-msnbc-empty">No battleground polling found yet.</div>`}
                </div>
            </div>
        `;
    };
    const getMsnbcWrappedCharacterLike = (value, type = "candidate") => {
        if(!value) return null;
        if(!Array.isArray(value)) return value;
        try {
            return Executive?.data?.characters?.wrapCharacter(value, type) || null;
        } catch {
            return null;
        }
    };
    const getMsnbcCandidatePartyCode = (candidate) => {
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        return normalizePanelPartyCode(
            candidate?.party
            || candidate?.caucus
            || candidate?.caucusParty
            || candidate?.extendedAttribs?.party
            || candidate?.extendedAttribs?.caucusParty
            || wrapped?.party
            || wrapped?.caucus
            || wrapped?.caucusParty
            || wrapped?.extendedAttribs?.party
            || wrapped?.extendedAttribs?.caucusParty
        );
    };
    const getMsnbcCandidateDisplayName = (candidate) => {
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        return String(
            candidate?.name
            || candidate?.fullName
            || candidate?.displayName
            || [candidate?.first, candidate?.last].filter(Boolean).join(" ")
            || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
            || wrapped?.name
            || wrapped?.fullName
            || wrapped?.displayName
            || [wrapped?.first, wrapped?.last].filter(Boolean).join(" ")
            || [wrapped?.firstName, wrapped?.lastName].filter(Boolean).join(" ")
            || "Unknown"
        );
    };
    const getMsnbcSenateAffiliationParty = (candidate) => {
        if(candidate === undefined || candidate === null) return "I";
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        const rawParty = String(
            candidate?.party
            || candidate?.extendedAttribs?.party
            || wrapped?.party
            || wrapped?.extendedAttribs?.party
            || (Array.isArray(candidate) ? candidate[0] : "")
            || ""
        ).trim();
        const compactParty = rawParty.replace(/[^A-Za-z]/g, "").toUpperCase();
        if(["ID", "INDD", "INDDEM", "INDEPENDENTD", "INDEPENDENTDEM", "INDEPENDENTDEMOCRAT"].includes(compactParty)) {
            return "D";
        }
        if(["IR", "INDR", "INDREP", "INDEPENDENTR", "INDEPENDENTREP", "INDEPENDENTREPUBLICAN"].includes(compactParty)) {
            return "R";
        }
        const registeredParty = normalizePanelPartyCode(rawParty);
        if(registeredParty === "D" || registeredParty === "R") return registeredParty;
        const rawCaucus = String(
            candidate?.caucusParty
            || candidate?.caucus
            || candidate?.extendedAttribs?.caucusParty
            || candidate?.extendedAttribs?.caucus
            || wrapped?.caucusParty
            || wrapped?.caucus
            || wrapped?.extendedAttribs?.caucusParty
            || wrapped?.extendedAttribs?.caucus
            || ""
        ).trim();
        const compactCaucus = rawCaucus.replace(/[^A-Za-z]/g, "").toUpperCase();
        if(["ID", "D", "DEM", "DEMOCRAT", "DEMOCRATS"].includes(compactCaucus)) return "D";
        if(["IR", "R", "REP", "REPUBLICAN", "REPUBLICANS"].includes(compactCaucus)) return "R";
        const caucusParty = normalizePanelPartyCode(rawCaucus);
        return caucusParty === "D" || caucusParty === "R" ? caucusParty : "I";
    };
    const getMsnbcSenateMemberParty = (member) => {
        return getMsnbcSenateAffiliationParty(member);
    };
    const getMsnbcSenateMemberState = (member) => {
        const wrapped = getMsnbcWrappedCharacterLike(member, "candidate");
        return getElectionNightPanelStateCode(
            member?.state
            || member?.stateId
            || member?.stateID
            || member?.abbr
            || member?.stateCode
            || member?.extendedAttribs?.state
            || wrapped?.state
            || wrapped?.stateId
            || wrapped?.stateID
            || wrapped?.abbr
            || wrapped?.stateCode
            || wrapped?.extendedAttribs?.state
            || ""
        );
    };
    const getMsnbcSenateMembersByState = () => {
        const senate = Executive?.data?.politicians?.usSenate || readRuntimeValue("usSenate");
        const byState = {};
        const seenMembers = new Set();
        const getMemberKey = (member, stateCode) => {
            const wrapped = getMsnbcWrappedCharacterLike(member, "candidate");
            const identity = member?.id ?? member?.ID ?? member?.characterID ?? member?.characterId
                ?? member?.politicianID ?? member?.politicianId ?? wrapped?.id ?? wrapped?.ID
                ?? wrapped?.characterID ?? wrapped?.characterId ?? wrapped?.politicianID ?? wrapped?.politicianId;
            if(identity !== undefined && identity !== null && String(identity).trim()) {
                return `${stateCode}:id:${String(identity).trim().toLowerCase()}`;
            }
            const name = String(
                member?.name || member?.fullName
                || [member?.first, member?.last].filter(Boolean).join(" ")
                || [member?.firstName, member?.lastName].filter(Boolean).join(" ")
                || wrapped?.name || wrapped?.fullName
                || [wrapped?.first, wrapped?.last].filter(Boolean).join(" ")
                || [wrapped?.firstName, wrapped?.lastName].filter(Boolean).join(" ")
                || ""
            ).trim().replace(/\s+/g, " ").toLowerCase();
            return name ? `${stateCode}:name:${name}` : "";
        };
        const addMember = (member, fallbackState = "") => {
            if(!member || typeof member !== "object") return;
            const stateCode = getMsnbcSenateMemberState(member) || getElectionNightPanelStateCode(fallbackState);
            if(!stateCode) return;
            const memberKey = getMemberKey(member, stateCode);
            if(memberKey && seenMembers.has(memberKey)) return;
            if(memberKey) seenMembers.add(memberKey);
            if(!byState[stateCode]) byState[stateCode] = [];
            byState[stateCode].push(member);
        };
        const addSource = source => {
            if(Array.isArray(source)) {
                source.forEach(member => addMember(member));
            } else if(source && typeof source === "object") {
                Object.entries(source).forEach(([stateKey, value]) => {
                    if(Array.isArray(value)) {
                        value.forEach(member => addMember(member, stateKey));
                        return;
                    }
                    if(value?.senior || value?.junior) {
                        addMember(value.senior, stateKey);
                        addMember(value.junior, stateKey);
                        return;
                    }
                    addMember(value, stateKey);
                });
            }
        };
        addSource(senate);

        const currentMemberTotal = () => Object.values(byState).reduce(
            (total, members) => total + members.length,
            0
        );
        if(currentMemberTotal() < 80) {
            ["usSenate1Array", "usSenate2Array", "usSenate3Array"].forEach(arrayName => {
                addSource(readRuntimeValue(arrayName));
                addSource(Executive?.data?.[arrayName]);
                addSource(Executive?.data?.politicians?.[arrayName]);
            });
        }
        return byState;
    };
    const getMsnbcSenateMemberSnapshot = (member) => {
        const wrapped = getMsnbcWrappedCharacterLike(member, "candidate");
        const party = getMsnbcSenateMemberParty(member);
        return {
            party,
            caucusParty: party,
            state: getMsnbcSenateMemberState(member),
            id: member?.id ?? member?.ID ?? member?.candID ?? member?.candidateID ?? member?.candidateId
                ?? member?.characterID ?? member?.characterId ?? wrapped?.id ?? wrapped?.ID
                ?? wrapped?.candID ?? wrapped?.candidateID ?? wrapped?.candidateId
                ?? wrapped?.characterID ?? wrapped?.characterId ?? null,
            name: String(
                member?.name || member?.fullName || member?.displayName
                || [member?.first, member?.last].filter(Boolean).join(" ")
                || [member?.firstName, member?.lastName].filter(Boolean).join(" ")
                || wrapped?.name || wrapped?.fullName || wrapped?.displayName
                || [wrapped?.first, wrapped?.last].filter(Boolean).join(" ")
                || [wrapped?.firstName, wrapped?.lastName].filter(Boolean).join(" ")
                || ""
            ),
            first: member?.first ?? wrapped?.first ?? member?.firstName ?? wrapped?.firstName ?? "",
            last: member?.last ?? wrapped?.last ?? member?.lastName ?? wrapped?.lastName ?? "",
            extendedAttribs: {
                party,
                caucusParty: party,
                state: getMsnbcSenateMemberState(member)
            }
        };
    };
    const getMsnbcSenateCandidateLastName = (candidate) => {
        const wrapped = getMsnbcWrappedCharacterLike(candidate, "candidate");
        const rawName = String(candidate?.name || wrapped?.name || wrapped?.fullName || "");
        const parts = rawName.trim().split(/\s+/).filter(Boolean);
        return (parts[parts.length - 1] || rawName).toLowerCase();
    };
    const getMsnbcSenateMemberLastName = (member) => {
        const wrapped = getMsnbcWrappedCharacterLike(member, "candidate");
        const rawName = String(member?.last || member?.lastName || member?.name || member?.fullName
            || wrapped?.last || wrapped?.lastName || wrapped?.name || wrapped?.fullName || "");
        const parts = rawName.trim().split(/\s+/).filter(Boolean);
        return (parts[parts.length - 1] || rawName).toLowerCase();
    };
    const getMsnbcSenateIdentityValues = (value) => {
        const values = new Set();
        if(!value || typeof value !== "object") return values;
        const wrapped = getMsnbcWrappedCharacterLike(value, "candidate");
        [
            value.id, value.ID, value.candID, value.candidateID, value.candidateId,
            value.characterID, value.characterId, value.politicianID, value.politicianId,
            value.extendedAttribs?.id, value.extendedAttribs?.ID,
            value.extendedAttribs?.candidateID, value.extendedAttribs?.candidateId,
            value.extendedAttribs?.characterID, value.extendedAttribs?.characterId,
            wrapped?.id, wrapped?.ID, wrapped?.candID, wrapped?.candidateID, wrapped?.candidateId,
            wrapped?.characterID, wrapped?.characterId, wrapped?.politicianID, wrapped?.politicianId,
            wrapped?.extendedAttribs?.id, wrapped?.extendedAttribs?.ID,
            wrapped?.extendedAttribs?.candidateID, wrapped?.extendedAttribs?.candidateId,
            wrapped?.extendedAttribs?.characterID, wrapped?.extendedAttribs?.characterId
        ].forEach(id => {
            if(id !== undefined && id !== null && String(id).trim()) values.add(String(id).trim().toLowerCase());
        });
        return values;
    };
    const getMsnbcSenateComparableNames = (value) => {
        const names = new Set();
        const wrapped = getMsnbcWrappedCharacterLike(value, "candidate");
        [
            value?.name, value?.fullName, value?.displayName,
            [value?.first, value?.last].filter(Boolean).join(" "),
            [value?.firstName, value?.lastName].filter(Boolean).join(" "),
            wrapped?.name, wrapped?.fullName, wrapped?.displayName,
            [wrapped?.first, wrapped?.last].filter(Boolean).join(" "),
            [wrapped?.firstName, wrapped?.lastName].filter(Boolean).join(" ")
        ].forEach(name => {
            const normalizedName = String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
            if(normalizedName) names.add(normalizedName);
        });
        return names;
    };

    const isMsnbcSameSenatePerson = (candidate, member, strict = false) => {
        const candidateIds = getMsnbcSenateIdentityValues(candidate);
        const memberIds = getMsnbcSenateIdentityValues(member);
        if(candidateIds.size && memberIds.size) {
            for(const id of candidateIds) {
                if(memberIds.has(id)) return true;
            }
        }
        const candidateNames = getMsnbcSenateComparableNames(candidate);
        const memberNames = getMsnbcSenateComparableNames(member);
        if(candidateNames.size && memberNames.size) {
            for(const name of candidateNames) {
                if(memberNames.has(name)) return true;
            }
        }
        if(strict) return false;
        const candidateLastName = getMsnbcSenateCandidateLastName(candidate);
        const memberLastName = getMsnbcSenateMemberLastName(member);
        return Boolean(candidateLastName && memberLastName && candidateLastName === memberLastName);
    };

    const findMsnbcSenateMemberIndex = (person, stateCode, stateMembers, usedMemberIndexes) => {
        const isFree = index => !usedMemberIndexes.has(`${stateCode}:${index}`);
        const strongIndex = stateMembers.findIndex((member, index) =>
            isFree(index) && isMsnbcSameSenatePerson(person, member, true)
        );
        if(strongIndex >= 0) return strongIndex;
        const personLastName = getMsnbcSenateCandidateLastName(person);
        if(!personLastName) return -1;
        const surnameMatches = [];
        stateMembers.forEach((member, index) => {
            if(!isFree(index)) return;
            if(getMsnbcSenateMemberLastName(member) === personLastName) surnameMatches.push(index);
        });
        return surnameMatches.length === 1 ? surnameMatches[0] : -1;
    };
    const removeMsnbcSenateSeatFromCounts = (counts, party) => {
        const normalizedParty = getMsnbcPartyClass(party);
        if(counts[normalizedParty] > 0) {
            counts[normalizedParty]--;
            return true;
        }
        return false;
    };
    const getMsnbcSenatePartyHintFromValue = (value) => {
        if(value === undefined || value === null) return "";
        if(typeof value === "string") return getMsnbcPartyClass(value);
        const wrapped = getMsnbcWrappedCharacterLike(value, "candidate");
        if(typeof value !== "object") return "";
        return getMsnbcPartyClass(
            value.caucusParty
            || value.extendedAttribs?.caucusParty
            || wrapped?.caucusParty
            || wrapped?.extendedAttribs?.caucusParty
            || value.party
            || value.caucus
            || value.caucusParty
            || value.incumbentParty
            || value.previousParty
            || value.priorParty
            || value.oldParty
            || value.seatParty
            || value.heldBy
            || value.holderParty
            || value.extendedAttribs?.party
            || wrapped?.party
            || wrapped?.caucus
            || wrapped?.extendedAttribs?.party
        );
    };
    const getMsnbcSenateRacePartyHint = (sourceRace) => {
        if(!sourceRace || typeof sourceRace !== "object") return "";
        const directKeys = [
            "incumbentParty", "incumbParty", "previousParty", "priorParty", "oldParty",
            "lastParty", "seatParty", "heldBy", "holderParty", "defendingParty",
            "defenderParty", "retiringParty", "openSeatParty", "incumbent",
            "currentSenator", "senator", "senior", "junior"
        ];
        for(const key of directKeys) {
            const party = getMsnbcSenatePartyHintFromValue(sourceRace[key]);
            if(party && party !== "I") return party;
        }
        for(const [key, value] of Object.entries(sourceRace)) {
            if(Array.isArray(value)) continue;
            if(!/(incumb|previous|prior|old|last|seat|hold|holder|defend|retir)/i.test(key)) continue;
            const party = getMsnbcSenatePartyHintFromValue(value);
            if(party && party !== "I") return party;
        }
        return "";
    };
    const getMsnbcSenatePreviousWinnerParty = (stateCode) => {
        const archive = readRuntimeValue("usSenateArchive");
        if(!Array.isArray(archive)) return "";
        const normalizedState = String(stateCode || "").toUpperCase();
        const currentYear = Number(getElectionNightPanelYear());
        const hasCurrentYear = Number.isFinite(currentYear);
        const archives = archive
            .filter(entry => !hasCurrentYear || Number(entry?.year) < currentYear)
            .sort((a, b) => hasCurrentYear
                ? Math.abs(Number(a?.year) - (currentYear - 6)) - Math.abs(Number(b?.year) - (currentYear - 6))
                : Number(b?.year) - Number(a?.year));
        for(const archiveEntry of archives) {
            const states = Array.isArray(archiveEntry?.elections) ? archiveEntry.elections : [];
            const stateRace = states.find(state =>
                getElectionNightPanelStateCode(state?.state || state?.district || state?.name) === normalizedState
            );
            const candidates = stateRace?.candidates || stateRace?.cands || [];
            if(!Array.isArray(candidates) || !candidates.length) continue;
            const winner = candidates.slice().sort((a, b) =>
                (Number(b?.totVotes ?? b?.votes) || 0) - (Number(a?.totVotes ?? a?.votes) || 0)
            )[0];
            const party = getMsnbcSenateAffiliationParty(winner);
            if(party && party !== "I") return party;
        }
        return "";
    };
    const findMsnbcSenateIncumbentParty = (state, membersByState, usedMemberIndexes) => {
        const stateCode = String(state?.code || "").toUpperCase();
        const stateMembers = membersByState[stateCode] || [];
        const candidates = Array.isArray(state?.sourceRace?.cands) ? state.sourceRace.cands : state?.candidates || [];
        const incumbentCandidate = candidates.find(candidate => isMsnbcCandidateIncumbent(candidate));
        if(incumbentCandidate) {
            const matchedIndex = findMsnbcSenateMemberIndex(
                incumbentCandidate,
                stateCode,
                stateMembers,
                usedMemberIndexes
            );
            if(matchedIndex >= 0) {
                usedMemberIndexes.add(`${stateCode}:${matchedIndex}`);
                return getMsnbcSenateMemberParty(stateMembers[matchedIndex]);
            }
            return getMsnbcSenateAffiliationParty(incumbentCandidate);
        }

        for(const candidate of candidates) {
            const matchedIndex = stateMembers.findIndex((member, index) =>
                !usedMemberIndexes.has(`${stateCode}:${index}`)
                && isMsnbcSameSenatePerson(candidate, member, true)
            );
            if(matchedIndex >= 0) {
                usedMemberIndexes.add(`${stateCode}:${matchedIndex}`);
                return getMsnbcSenateMemberParty(stateMembers[matchedIndex]);
            }
        }

        const unusedIndexes = stateMembers
            .map((_member, index) => index)
            .filter(index => !usedMemberIndexes.has(`${stateCode}:${index}`));
        if(unusedIndexes.length) {
            const unusedParties = new Set(
                unusedIndexes.map(index => getMsnbcSenateMemberParty(stateMembers[index]))
            );
            if(unusedParties.size === 1) {
                usedMemberIndexes.add(`${stateCode}:${unusedIndexes[0]}`);
                return getMsnbcSenateMemberParty(stateMembers[unusedIndexes[0]]);
            }
        }
        const racePartyHint = getMsnbcSenateRacePartyHint(state?.sourceRace);
        if(racePartyHint && racePartyHint !== "I") return racePartyHint;
        const previousWinnerParty = getMsnbcSenatePreviousWinnerParty(stateCode);
        if(previousWinnerParty && previousWinnerParty !== "I") return previousWinnerParty;

        return "";
    };
    const buildMsnbcCurrentSenateStateFromGlobalRace = (stateRace) => {
        if(!Array.isArray(stateRace?.cands) || !stateRace.cands.length) return null;
        const stateCode = getMsnbcElectionStateCode(stateRace);
        const candidates = stateRace.cands.map(candidate => {
            const currentVotes = getPanelCurrentCandidateVotes(candidate, stateRace, { source: "official" });
            const finalVotes = Number(candidate?.votes ?? candidate?.totVotes) || 0;
            return {
                name: getMsnbcCandidateDisplayName(candidate),
                party: getMsnbcSenateAffiliationParty(candidate),
                votes: stateRace?.pW === true && currentVotes <= 0 ? finalVotes : currentVotes,
                id: candidate?.id ?? null,
                incumbent: isMsnbcCandidateIncumbent(candidate)
            };
        });
        const totalCurrVotes = getMsnbcStateTotalVotes(stateRace, candidates);
        const totalExpectedVotes = Number(stateRace?.totalVotes) || stateRace.cands.reduce(
            (sum, candidate) => sum + (Number(candidate?.votes ?? candidate?.totVotes) || 0),
            0
        );
        const reportedPct = totalExpectedVotes > 0 ? (totalCurrVotes / totalExpectedVotes) * 100 : 0;
        const fullyReported = Number.isFinite(reportedPct) && reportedPct >= 100
            || (totalExpectedVotes > 0 && totalCurrVotes >= totalExpectedVotes);
        return {
            name: getElectionNightPanelStateName(stateCode),
            code: stateCode,
            totalVotes: totalCurrVotes,
            totalExpectedVotes,
            reportedPct,
            projected: stateRace?.pW === true,
            current: true,
            candidates,
            sourceRace: stateRace
        };
    };
    const getMsnbcCurrentSenateStatesFromGlobalState = () => {
        const electNight = readRuntimeValue("electNightUSS");
        if(!Array.isArray(electNight?.elections)) return [];
        return electNight.elections
            .map(buildMsnbcCurrentSenateStateFromGlobalRace)
            .filter(Boolean);
    };
    const createMsnbcFullSenateChamberSnapshot = () => {
        const rawMembersByState = getMsnbcSenateMembersByState();
        const membersByState = {};
        Object.entries(rawMembersByState).forEach(([stateCode, members]) => {
            membersByState[stateCode] = (members || []).map(getMsnbcSenateMemberSnapshot);
        });
        const counts = { D: 0, R: 0, I: 0 };
        Object.values(membersByState).flat().forEach(member => {
            const party = getMsnbcSenateMemberParty(member);
            if(counts[party] !== undefined) counts[party]++;
        });
        return {
            counts,
            membersByState,
            total: counts.D + counts.R + counts.I,
            year: Number(getElectionNightPanelYear()) || null
        };
    };
    const getMsnbcFullSenateCountsFromGlobalState = () => {
        const year = Number(getElectionNightPanelYear()) || null;
        if(!msnbcInitialSenateChamberSnapshot
            || msnbcInitialSenateChamberSnapshot.year !== year
            || msnbcInitialSenateChamberSnapshot.total < 80) {
            msnbcInitialSenateChamberSnapshot = createMsnbcFullSenateChamberSnapshot();
        }
        return msnbcInitialSenateChamberSnapshot;
    };
    const getMsnbcSenateCountsFromElectionData = (senateData) => {
        if(!senateData) return null;
        const democratSeats = Math.max(0, Number(senateData.democratSeats) || 0);
        const republicanSeats = Math.max(0, Number(senateData.republicanSeats) || 0);
        const totalSeats = Math.max(100, Number(senateData.totalSeats) || 100);
        return {
            D: democratSeats,
            R: republicanSeats,
            I: 0,
            U: Math.max(0, totalSeats - democratSeats - republicanSeats),
            total: totalSeats,
            gainedD: Math.max(0, Number(senateData.gainedDemocratSeats) || 0),
            gainedR: Math.max(0, Number(senateData.gainedRepublicanSeats) || 0),
            projectedD: Math.max(0, Number(senateData.projectedDemocratSeats) || 0),
            projectedR: Math.max(0, Number(senateData.projectedRepublicanSeats) || 0),
            source: senateData.source || "global"
        };
    };
    const getMsnbcNumericProperty = (source, keys) => {
        if(!source || typeof source !== "object") return null;
        for(const key of keys) {
            const value = source[key];
            const number = Number(value);
            if(Number.isFinite(number)) return number;
        }
        return null;
    };
    const normalizeMsnbcDirectSenateCounts = (source) => {
        if(!source || typeof source !== "object") return null;
        const democratSeats = getMsnbcNumericProperty(source, [
            "democratSeats", "democraticSeats", "demSeats", "demSeatCount",
            "democratSeatCount", "democraticSeatCount", "dSeats", "D"
        ]);
        const republicanSeats = getMsnbcNumericProperty(source, [
            "republicanSeats", "repSeats", "repSeatCount", "republicanSeatCount",
            "rSeats", "R"
        ]);
        if(!Number.isFinite(democratSeats) || !Number.isFinite(republicanSeats)) return null;
        if(democratSeats < 0 || republicanSeats < 0 || democratSeats + republicanSeats > 100) return null;
        if(democratSeats + republicanSeats < 50) return null;
        return {
            democratSeats,
            republicanSeats,
            undecidedSeats: Math.max(0, 100 - democratSeats - republicanSeats),
            projectedDemocratSeats: getMsnbcNumericProperty(source, ["projectedDemocratSeats", "projectedDemSeats", "projectedD"]) || 0,
            projectedRepublicanSeats: getMsnbcNumericProperty(source, ["projectedRepublicanSeats", "projectedRepSeats", "projectedR"]) || 0,
            gainedDemocratSeats: getMsnbcNumericProperty(source, ["gainedDemocratSeats", "democratGains", "demGains", "gainedD"]) || 0,
            gainedRepublicanSeats: getMsnbcNumericProperty(source, ["gainedRepublicanSeats", "republicanGains", "repGains", "gainedR"]) || 0,
            totalSeats: 100,
            source: "global-direct"
        };
    };
    const getMsnbcDirectSenateElectionNightData = () => {
        const electNight = readRuntimeValue("electNightUSS");
        const candidates = [
            electNight,
            electNight?.senate,
            electNight?.control,
            electNight?.seatCounts,
            electNight?.seats,
            electNight?.projectedSeats,
            electNight?.results
        ];
        for(const source of candidates) {
            const counts = normalizeMsnbcDirectSenateCounts(source);
            if(counts) return counts;
        }
        return null;
    };
    const doesMsnbcSenateSnapshotContainFinalWinners = (raceStates, chamber) => {
        if(!raceStates.length || !raceStates.every(isMsnbcSenateStateDecided)) return false;
        return raceStates.every(state => {
            const winner = getMsnbcLeadingCandidate(state);
            const stateMembers = chamber?.membersByState?.[String(state?.code || "").toUpperCase()] || [];

            return Boolean(winner && stateMembers.some(member => isMsnbcSameSenatePerson(winner, member, true)));
        });
    };
    const getSenateElectionNightData = () => {
        const totalSeats = 100;
        const directCounts = getMsnbcDirectSenateElectionNightData();
        if(directCounts) return directCounts;
        const raceStates = getMsnbcCurrentSenateStatesFromGlobalState();
        if(!raceStates.length) return null;
        const chamber = getMsnbcFullSenateCountsFromGlobalState();
        if(chamber.total < 80) return null;
        if(doesMsnbcSenateSnapshotContainFinalWinners(raceStates, chamber)) {
            const projectedDemocratSeats = raceStates.filter(state =>
                getMsnbcPartyClass(getMsnbcLeadingCandidate(state)?.party) === "D"
            ).length;
            const projectedRepublicanSeats = raceStates.filter(state =>
                getMsnbcPartyClass(getMsnbcLeadingCandidate(state)?.party) === "R"
            ).length;
            return {
                democratSeats: Math.max(0, Number(chamber.counts.D) || 0),
                republicanSeats: Math.max(0, Number(chamber.counts.R) || 0),
                undecidedSeats: 0,
                projectedDemocratSeats,
                projectedRepublicanSeats,
                gainedDemocratSeats: 0,
                gainedRepublicanSeats: 0,
                totalSeats,
                source: "post-election-roster"
            };
        }
        const counts = { ...chamber.counts };
        const usedMemberIndexes = new Set();
        let projectedDemocratSeats = 0;
        let projectedRepublicanSeats = 0;
        let gainedDemocratSeats = 0;
        let gainedRepublicanSeats = 0;
        let uncalledRaces = 0;
        raceStates.forEach(state => {
            const incumbentParty = findMsnbcSenateIncumbentParty(state, chamber.membersByState, usedMemberIndexes);
            removeMsnbcSenateSeatFromCounts(counts, incumbentParty);
            if(!isMsnbcSenateStateDecided(state)) {
                uncalledRaces++;
                return;
            }
            const winner = getMsnbcLeadingCandidate(state);
            const winnerParty = getMsnbcPartyClass(winner?.party);
            if(counts[winnerParty] !== undefined) counts[winnerParty]++;
            if(winnerParty === "D") projectedDemocratSeats++;
            if(winnerParty === "R") projectedRepublicanSeats++;
            if(incumbentParty && incumbentParty !== winnerParty) {
                if(winnerParty === "D") gainedDemocratSeats++;
                if(winnerParty === "R") gainedRepublicanSeats++;
            }
        });
        let democratSeats = Math.max(0, counts.D);
        let republicanSeats = Math.max(0, counts.R);
        let excessAssignedSeats = Math.max(0, democratSeats + republicanSeats - (totalSeats - uncalledRaces));
        while(excessAssignedSeats > 0) {
            if(democratSeats >= republicanSeats && democratSeats > 0) democratSeats--;
            else if(republicanSeats > 0) republicanSeats--;
            else break;
            excessAssignedSeats--;
        }
        if(democratSeats + republicanSeats > totalSeats) {
            const overflow = democratSeats + republicanSeats - totalSeats;
            if(republicanSeats >= democratSeats) republicanSeats = Math.max(0, republicanSeats - overflow);
            else democratSeats = Math.max(0, democratSeats - overflow);
            console.warn("Senate election night data exceeded 100 seats; clamped overflow.", {
                democratSeats,
                republicanSeats,
                overflow
            });
        }
        const undecidedSeats = Math.max(0, totalSeats - democratSeats - republicanSeats);
        return {
            democratSeats,
            republicanSeats,
            undecidedSeats,
            projectedDemocratSeats,
            projectedRepublicanSeats,
            gainedDemocratSeats,
            gainedRepublicanSeats,
            totalSeats,
            source: "global"
        };
    };
    const logMsnbcSenateElectionNightData = (senateData) => {
        const now = Date.now();
        if(!senateData || now - msnbcLastSenateDataLogTime < 1500) return;
        msnbcLastSenateDataLogTime = now;
        console.log("Loaded senate data without opening Senate tab", senateData);
    };
    try {
        globalThis.getSenateElectionNightData = getSenateElectionNightData;
    } catch {}

    const readMsnbcConfidentNativeSenateCounts = () => {
        const overlay = document.getElementById("bm-msnbc-election-overlay");
        const outsideOverlay = element => !overlay || !overlay.contains(element);
        const normalizeText = value => String(value || "").replace(/\s+/g, " ").trim();
        const headerPattern = /Senate Elections.{0,500}?(\d{1,3})\s*Democrats?.{0,400}?Republicans?\s*(\d{1,3})/i;
        const accept = (rawD, rawR, source) => {
            const D = Number(rawD);
            const R = Number(rawR);
            if(!Number.isFinite(D) || !Number.isFinite(R) || D < 0 || R < 0 || D + R > 100) return null;
            return { D, R, I: 0, U: 100 - D - R, total: 100, source };
        };
        try {
            const bodyMatch = normalizeText(document.body?.innerText).match(headerPattern);
            if(bodyMatch) {
                const counts = accept(bodyMatch[1], bodyMatch[2], "native-body-header");
                if(counts) return counts;
            }
            const elements = Array.from(document.querySelectorAll("body *")).filter(outsideOverlay);
            const titleElements = elements.filter(element =>
                /^Senate Elections$/i.test(normalizeText(element.textContent))
            );
            for(const title of titleElements) {
                let container = title.parentElement;
                for(let depth = 0; container && container !== document.body && depth < 8; depth++) {
                    const match = normalizeText(container.textContent).match(headerPattern);
                    if(match) {
                        const counts = accept(match[1], match[2], "native-header");
                        if(counts) return counts;
                    }
                    container = container.parentElement;
                }
            }
        } catch {}
        return null;
    };
    const getMsnbcSenateControlCountsFromPage = () => {
        const confidentCounts = readMsnbcConfidentNativeSenateCounts();
        if(confidentCounts) return confidentCounts;
        const overlayText = String(document.getElementById("bm-msnbc-election-overlay")?.innerText || "");
        const pageText = String(document.body?.innerText || "").replace(overlayText, "");
        const currentYear = Number(getElectionNightPanelYear());
        const useNativeCounts = (nativeCounts) => {
            if(!nativeCounts
                || !Number.isFinite(nativeCounts.D)
                || !Number.isFinite(nativeCounts.R)
                || nativeCounts.D < 0
                || nativeCounts.R < 0
                || nativeCounts.D + nativeCounts.R > 100) {
                return null;
            }
            msnbcLatestNativeSenateCounts = {
                D: nativeCounts.D,
                R: nativeCounts.R,
                I: 0,
                U: Math.max(0, 100 - nativeCounts.D - nativeCounts.R),
                total: 100,
                _year: currentYear
            };
            return msnbcLatestNativeSenateCounts;
        };
        const officialPageCounts = typeof getSenateControlCountsFromPage === "function"
            ? getSenateControlCountsFromPage()
            : null;
        const officialCounts = useNativeCounts(officialPageCounts);
        if(officialCounts) return officialCounts;
        const readPartyCount = (text, label) => {
            const beforeMatch = text.match(new RegExp(`(?:^|\\b)(\\d{1,3})\\s+${label}s?\\b`, "i"));
            if(beforeMatch) return Number(beforeMatch[1]);
            const afterMatch = text.match(new RegExp(`\\b${label}s?\\s+(\\d{1,3})\\b`, "i"));
            if(afterMatch) return Number(afterMatch[1]);
            return null;
        };
        const parseSenateHeaderText = (text) => {
            const senateIndex = String(text || "").search(/\bSenate Elections\b/i);
            if(senateIndex < 0) return null;
            const afterTitle = String(text).slice(senateIndex)
                .split(/\b(?:Gained|Projections|Margins|Select a state to view election results\.?)\b/i)[0]
                .replace(/\s+/g, " ")
                .trim();
            const democratSeats = readPartyCount(afterTitle, "Democrat");
            const republicanSeats = readPartyCount(afterTitle, "Republican");
            if(!Number.isFinite(democratSeats) || !Number.isFinite(republicanSeats)) return null;
            if(democratSeats < 0 || republicanSeats < 0 || democratSeats + republicanSeats > 100) return null;
            return { D: democratSeats, R: republicanSeats };
        };
        const getNativePageLines = () => {
            return String(document.body?.innerText || "")
                .split(/\r?\n/)
                .map(line => line.replace(/\s+/g, " ").trim())
                .filter(Boolean);
        };
        const parseNativeSenateHeaderLines = () => {
            const lines = getNativePageLines();
            const titleIndex = lines.findIndex(line => /\bSenate Elections\b/i.test(line));
            if(titleIndex < 0) return null;
            const titleLineCounts = parseSenateHeaderText(lines[titleIndex]);
            if(titleLineCounts) return titleLineCounts;
            let democratSeats = null;
            let republicanSeats = null;
            const headerLines = lines.slice(titleIndex + 1, titleIndex + 14);
            for(const line of headerLines) {
                if(/\b(?:Gained|Projections|Margins|Select a state to view election results\.?)\b/i.test(line)) break;
                if(democratSeats === null) democratSeats = readPartyCount(line, "Democrat");
                if(republicanSeats === null) republicanSeats = readPartyCount(line, "Republican");
                if(Number.isFinite(democratSeats) && Number.isFinite(republicanSeats)) {
                    if(democratSeats < 0 || republicanSeats < 0 || democratSeats + republicanSeats > 100) return null;
                    return { D: democratSeats, R: republicanSeats };
                }
            }
            return null;
        };
        const getNativePageTextSnippets = () => {
            try {
                return Array.from(new Set(
                    Array.from(document.querySelectorAll("body *"))
                        .filter(element => !overlay?.contains(element))
                        .map(element => String(element.innerText || element.textContent || "")
                            .replace(/\s+/g, " ")
                            .trim())
                        .filter(Boolean)
                ));
            } catch {
                return [];
            }
        };
        const readNativePartySnippet = (snippets, label) => {
            const exactBefore = new RegExp(`^\\s*(\\d{1,3})\\s+${label}s?\\s*$`, "i");
            const exactAfter = new RegExp(`^\\s*${label}s?\\s+(\\d{1,3})\\s*$`, "i");
            const looseBefore = new RegExp(`\\b(\\d{1,3})\\s+${label}s?\\b`, "i");
            const looseAfter = new RegExp(`\\b${label}s?\\s+(\\d{1,3})\\b`, "i");
            const exactMatches = [];
            const looseMatches = [];
            snippets.forEach(text => {
                const exactMatch = text.match(exactBefore) || text.match(exactAfter);
                if(exactMatch) {
                    exactMatches.push({ value: Number(exactMatch[1]), length: text.length });
                    return;
                }
                if(text.length <= 120) {
                    const looseMatch = text.match(looseBefore) || text.match(looseAfter);
                    if(looseMatch) looseMatches.push({ value: Number(looseMatch[1]), length: text.length });
                }
            });
            exactMatches.sort((a, b) => a.length - b.length);
            looseMatches.sort((a, b) => a.length - b.length);
            return exactMatches[0]?.value ?? looseMatches[0]?.value ?? null;
        };
        let nativeCounts = parseNativeSenateHeaderLines();
        const nativeSnippets = getNativePageTextSnippets();
        if(!nativeCounts && nativeSnippets.some(text => /\bSenate Elections\b/i.test(text))) {
            const democratSeats = readNativePartySnippet(nativeSnippets, "Democrat");
            const republicanSeats = readNativePartySnippet(nativeSnippets, "Republican");
            if(Number.isFinite(democratSeats)
                && Number.isFinite(republicanSeats)
                && democratSeats >= 0
                && republicanSeats >= 0
                && democratSeats + republicanSeats <= 100) {
                nativeCounts = { D: democratSeats, R: republicanSeats };
            }
        }
        try {
            const candidates = nativeSnippets
                .filter(text => /\bSenate Elections\b/i.test(text)
                    && /\bDemocrats?\b/i.test(text)
                    && /\bRepublicans?\b/i.test(text))
                .sort((a, b) => a.length - b.length);
            if(!nativeCounts) {
                for(const text of candidates) {
                    nativeCounts = parseSenateHeaderText(text);
                    if(nativeCounts) break;
                }
            }
        } catch {}
        if(!nativeCounts) nativeCounts = parseSenateHeaderText(pageText);
        if(!nativeCounts) return null;
        return useNativeCounts(nativeCounts);
    };
    const isMsnbcSenateStateDecided = (state) => {
        const sourceRace = state?.sourceRace || state;
        if(sourceRace?.pW === true) return true;
        if(sourceRace?.projectedWinner === true || sourceRace?.called === true) return true;
        return Array.isArray(sourceRace?.cands) && sourceRace.cands.some(candidate =>
            candidate?.pW === true
            || candidate?.projectedWinner === true
        );
    };
    const getMsnbcSenateControlCounts = (useNativePageCounts = false) => {
        const globalElectionData = getSenateElectionNightData();
        const globalCounts = getMsnbcSenateCountsFromElectionData(globalElectionData);
        if(globalCounts) return globalCounts;
        const nativeCounts = useNativePageCounts ? getMsnbcSenateControlCountsFromPage() : null;
        if(nativeCounts) return nativeCounts;
        const { membersByState, counts: fullCounts, total: fullTotal } = getMsnbcFullSenateCountsFromGlobalState();
        const hasFullChamber = fullTotal >= 80;
        try {
            const entry = getMsnbcRaceEntry("senate");
            const raceStates = Array.isArray(entry?.states) ? entry.states : [];
            if(hasFullChamber && raceStates.length && raceStates.every(isMsnbcSenateStateDecided)) {
                return { ...fullCounts, U: 0, total: fullTotal };
            }
            const counts = hasFullChamber ? { ...fullCounts } : { D: 0, R: 0, I: 0 };
            let undecided = 0;
            const usedMemberIndexes = new Set();
            raceStates.forEach(state => {
                const incumbentParty = findMsnbcSenateIncumbentParty(state, membersByState, usedMemberIndexes);
                if(hasFullChamber) removeMsnbcSenateSeatFromCounts(counts, incumbentParty);
                if(isMsnbcSenateStateDecided(state)) {
                    const winner = getMsnbcLeadingCandidate(state);
                    const winnerParty = getMsnbcPartyClass(winner?.party);
                    if(counts[winnerParty] !== undefined) counts[winnerParty]++;
                } else {
                    undecided++;
                }
            });
            const chamberTotal = hasFullChamber ? fullTotal : 100;
            let overflow = Math.max(0, counts.D + counts.R + counts.I + undecided - chamberTotal);
            while(overflow > 0) {
                const largestParty = counts.D >= counts.R && counts.D >= counts.I
                    ? "D"
                    : counts.R >= counts.I
                        ? "R"
                        : "I";
                if(counts[largestParty] > 0) counts[largestParty]--;
                overflow--;
            }
            return { ...counts, U: undecided, total: chamberTotal };
        } catch {}
        return { ...fullCounts, U: 0, total: fullCounts.D + fullCounts.R + fullCounts.I || 100 };
    };
    const describeSeatSegment = (cx, cy, innerR, outerR, startAngle, endAngle, yScale) => {
        const toPoint = (radius, angle) => {
            const radians = (angle * Math.PI) / 180;
            return {
                x: cx + Math.cos(radians) * radius,
                y: cy + Math.sin(radians) * radius * yScale
            };
        };
        const outerStart = toPoint(outerR, startAngle);
        const outerEnd = toPoint(outerR, endAngle);
        const innerEnd = toPoint(innerR, endAngle);
        const innerStart = toPoint(innerR, startAngle);
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        return [
            `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
            `A ${outerR.toFixed(2)} ${(outerR * yScale).toFixed(2)} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
            `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
            `A ${innerR.toFixed(2)} ${(innerR * yScale).toFixed(2)} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
            "Z"
        ].join(" ");
    };
    const describeSeatFrontFace = (cx, cy, outerR, startAngle, endAngle, yScale, depth) => {
        const toPoint = (angle, yOffset = 0) => {
            const radians = (angle * Math.PI) / 180;
            return {
                x: cx + Math.cos(radians) * outerR,
                y: cy + Math.sin(radians) * outerR * yScale + yOffset
            };
        };
        const topStart = toPoint(startAngle);
        const topEnd = toPoint(endAngle);
        const bottomEnd = toPoint(endAngle, depth);
        const bottomStart = toPoint(startAngle, depth);
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        return [
            `M ${topStart.x.toFixed(2)} ${topStart.y.toFixed(2)}`,
            `A ${outerR.toFixed(2)} ${(outerR * yScale).toFixed(2)} 0 ${largeArc} 1 ${topEnd.x.toFixed(2)} ${topEnd.y.toFixed(2)}`,
            `L ${bottomEnd.x.toFixed(2)} ${bottomEnd.y.toFixed(2)}`,
            `A ${outerR.toFixed(2)} ${(outerR * yScale).toFixed(2)} 0 ${largeArc} 0 ${bottomStart.x.toFixed(2)} ${bottomStart.y.toFixed(2)}`,
            "Z"
        ].join(" ");
    };
    const describeSenateRadialLine = (cx, cy, innerR, outerR, angle, yScale) => {
        const radians = (angle * Math.PI) / 180;
        const innerX = cx + Math.cos(radians) * innerR;
        const innerY = cy + Math.sin(radians) * innerR * yScale;
        const outerX = cx + Math.cos(radians) * outerR;
        const outerY = cy + Math.sin(radians) * outerR * yScale;
        return `M ${innerX.toFixed(2)} ${innerY.toFixed(2)} L ${outerX.toFixed(2)} ${outerY.toFixed(2)}`;
    };
    const buildMsnbcSenateChamberGeometry = () => {
        const rows = [
            { count: 12, innerR: 170, outerR: 205 },
            { count: 16, innerR: 215, outerR: 250 },
            { count: 20, innerR: 260, outerR: 295 },
            { count: 24, innerR: 305, outerR: 340 },
            { count: 28, innerR: 350, outerR: 390 }
        ];
        const cx = 550;
        const cy = 400;
        const startAngle = 180;
        const endAngle = 360;
        const yScale = 0.66;
        const gapDeg = 0;
        const bands = rows.map((row, rowIndex) => ({
            rowIndex,
            ...row,
            path: describeSeatSegment(cx, cy, row.innerR, row.outerR, startAngle, endAngle, yScale),
            lipPath: describeSeatSegment(cx, cy, row.outerR - 9, row.outerR, startAngle, endAngle, yScale)
        }));
        const dividerAngles = Array.from({ length: 11 }, (_value, index) =>
            startAngle + ((endAngle - startAngle) / 12) * (index + 1)
        );
        const seats = [];
        rows.forEach((row, rowIndex) => {
            const step = (endAngle - startAngle) / row.count;
            for(let index = 0; index < row.count; index++) {
                const seatStart = startAngle + (index * step) + (gapDeg / 2);
                const seatEnd = startAngle + ((index + 1) * step) - (gapDeg / 2);
                seats.push({
                    rowIndex,
                    midAngle: (seatStart + seatEnd) / 2,
                    path: describeSeatSegment(cx, cy, row.innerR + 0.8, row.outerR - 1.2, seatStart, seatEnd, yScale),
                    sidePath: describeSeatFrontFace(cx, cy, row.outerR - 1.2, seatStart, seatEnd, yScale, 7)
                });
            }
        });
        return { rows, bands, seats, dividerAngles, cx, cy, startAngle, endAngle, yScale };
    };
    const getMsnbcSenateSeatColor = (party) => {
        if(party === "D") return "#159bd7";
        if(party === "R") return "#e31837";
        if(party === "U") return "#f2f2f2";
        return "#f7f7f7";
    };
    const getMsnbcSenateSeatDepthColor = (party) => {
        if(party === "D") return "#0e6fa6";
        if(party === "R") return "#b7152b";
        if(party === "U") return "#d0d0d0";
        return "#d7d7d7";
    };
    const getMsnbcSenateSeatBuckets = (counts) => {
        const totalSeats = 100;
        const demSeats = Math.max(0, Math.min(totalSeats, Number(counts.D) || 0));
        const rawRepSeats = Math.max(0, Number(counts.R) || 0);
        const assignedSeats = demSeats + rawRepSeats;
        if(assignedSeats > totalSeats) {
            console.warn("[better-maps] Senate seat totals exceed 100; clamping undecided seats to 0.", { D: demSeats, R: rawRepSeats });
        }
        const repSeats = Math.max(0, Math.min(totalSeats - demSeats, rawRepSeats));
        const undecidedSeats = Math.max(0, totalSeats - demSeats - repSeats);
        return { totalSeats, demSeats, repSeats, assignedSeats: demSeats + repSeats, undecidedSeats };
    };
    const buildMsnbcSenatePartyBlocks = (counts, geometry) => {
        const buckets = getMsnbcSenateSeatBuckets(counts);
        return geometry.seats
            .slice()
            .sort((a, b) => a.midAngle - b.midAngle || a.rowIndex - b.rowIndex)
            .map((seat, index) => {
                const party = index < buckets.demSeats
                    ? "D"
                    : index >= buckets.totalSeats - buckets.repSeats
                        ? "R"
                        : "U";
                const title = party === "D"
                    ? `Seat ${index + 1} - Democrat`
                    : party === "R"
                        ? `Seat ${index + 1} - Republican`
                        : `Seat ${index + 1} - Undecided`;
                return { ...seat, party, title };
            });
    };
    const renderMsnbcSenateSvg = (counts) => {
        const geometry = buildMsnbcSenateChamberGeometry();
        const partyBlocks = buildMsnbcSenatePartyBlocks(counts, geometry);
        return `
            <svg class="bm-msnbc-senate-svg" viewBox="0 0 1100 520" role="img" aria-label="Senate seat control chart">
                <defs>
                    <filter id="bm-msnbc-senate-floor-shadow" x="-20%" y="-20%" width="140%" height="180%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
                        <feOffset dx="0" dy="22" result="offsetblur"/>
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.22"/>
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id="bm-msnbc-senate-base-shadow" x="-20%" y="-20%" width="140%" height="170%">
                        <feDropShadow dx="0" dy="13" stdDeviation="7" flood-color="#4d5961" flood-opacity="0.24"/>
                    </filter>
                    <filter id="bm-msnbc-senate-seat-shadow" x="-20%" y="-20%" width="140%" height="170%">
                        <feDropShadow dx="0" dy="8" stdDeviation="3.5" flood-color="#26313a" flood-opacity="0.30"/>
                    </filter>
                    <linearGradient id="bm-msnbc-senate-base-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#ffffff"/>
                        <stop offset="0.55" stop-color="#f7f8f9"/>
                        <stop offset="1" stop-color="#dde3e7"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-senate-base-side" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#dfe4e8"/>
                        <stop offset="1" stop-color="#bfc7cd"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-senate-blue-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#27a9e8"/>
                        <stop offset="1" stop-color="#0876b9"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-senate-red-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#f04a43"/>
                        <stop offset="1" stop-color="#c9201f"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-senate-undecided-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#ffffff"/>
                        <stop offset="1" stop-color="#eceff1"/>
                    </linearGradient>
                </defs>
                <path d="M 98 438 C 226 506, 874 506, 1002 438 C 850 488, 250 488, 98 438 Z" fill="rgba(60,70,78,0.16)" filter="url(#bm-msnbc-senate-floor-shadow)"></path>
                <path d="${describeSeatSegment(550, 400, 154, 408, 180, 360, 0.66)}" transform="translate(0 24)" fill="#d0d0d0" opacity="0.58" filter="url(#bm-msnbc-senate-base-shadow)"></path>
                <path d="${describeSeatSegment(550, 400, 160, 400, 180, 360, 0.66)}" transform="translate(0 12)" fill="#ececec" opacity="0.82"></path>
                <g filter="url(#bm-msnbc-senate-base-shadow)">
                    ${geometry.bands.map(band => `
                        <path d="${band.path}" transform="translate(0 15)" fill="url(#bm-msnbc-senate-base-side)" stroke="#aeb7be" stroke-width="2.2" opacity="0.78"></path>
                    `).join("")}
                    ${geometry.bands.map(band => `
                        <path d="${band.lipPath}" transform="translate(0 7)" fill="#c9d0d6" opacity="0.58"></path>
                    `).join("")}
                </g>
                <g opacity="0.58">
                    ${geometry.bands.map(band => geometry.dividerAngles.map(angle => `
                        <path d="${describeSenateRadialLine(geometry.cx, geometry.cy, band.innerR + 1, band.outerR - 1, angle, geometry.yScale)}" stroke="#9fa8ae" stroke-width="1.25" stroke-linecap="round"></path>
                    `).join("")).join("")}
                    ${geometry.bands.map(band => `
                        <path d="${band.path}" fill="none" stroke="#aeb6bc" stroke-width="1.25" opacity="0.7"></path>
                    `).join("")}
                </g>
                <g filter="url(#bm-msnbc-senate-seat-shadow)">
                    ${partyBlocks.map(block => `
                        <path d="${block.sidePath}" fill="${getMsnbcSenateSeatDepthColor(block.party)}" opacity="${block.party === "U" ? "0.62" : "0.86"}"></path>
                    `).join("")}
                </g>
                <g>
                    ${partyBlocks.map((block, index) => `
                        <g class="bm-msnbc-senate-seat-hit">
                            <title>${escapeHtml(block.title)}</title>
                            <path class="bm-msnbc-senate-seat-segment bm-msnbc-senate-seat-top" d="${block.path}" fill="${block.party === "D" ? "url(#bm-msnbc-senate-blue-top)" : block.party === "R" ? "url(#bm-msnbc-senate-red-top)" : "url(#bm-msnbc-senate-undecided-top)"}" stroke="#8f989f" stroke-width="1.25" style="--bm-seat-delay: ${Math.min(520, index * 5)}ms;"></path>
                        </g>
                    `).join("")}
                </g>
                <path d="${describeSenateRadialLine(geometry.cx, geometry.cy, 154, 392, 270, geometry.yScale)}" stroke="#ffffff" stroke-width="6" stroke-linecap="butt" opacity="0.96"></path>
                <path d="${describeSenateRadialLine(geometry.cx, geometry.cy, 154, 392, 270, geometry.yScale)}" stroke="#cfd5d9" stroke-width="1.2" stroke-linecap="butt" opacity="0.65"></path>
                <line x1="550" y1="298" x2="550" y2="455" stroke="#ffffff" stroke-width="6" opacity="0.96"></line>
                <line x1="550" y1="298" x2="550" y2="455" stroke="#cfd5d9" stroke-width="1.2" opacity="0.65"></line>
            </svg>
        `;
    };

    const reconcileMsnbcSenateCounts = (nativeCounts, modelCounts) => {
        const year = Number(getElectionNightPanelYear()) || null;
        const usable = counts => counts
            && Number.isFinite(counts.D)
            && Number.isFinite(counts.R);
        if(usable(nativeCounts) && usable(modelCounts)

            && nativeCounts.D + nativeCounts.R === modelCounts.D + modelCounts.R) {
            msnbcSenateModelOffset = {
                D: nativeCounts.D - modelCounts.D,
                R: nativeCounts.R - modelCounts.R,
                year
            };
        }
        if(nativeCounts) return nativeCounts;
        if(!usable(modelCounts)) return modelCounts;
        const offset = msnbcSenateModelOffset;
        if(!offset) return modelCounts;
        if(offset.year !== null && year !== null && offset.year !== year) return modelCounts;

        if(offset.D + offset.R !== 0) return modelCounts;
        const D = modelCounts.D + offset.D;
        const R = modelCounts.R + offset.R;
        if(D < 0 || R < 0 || D + R > 100) return modelCounts;
        return { ...modelCounts, D, R };
    };
    const renderMsnbcSenateControl = (panel) => {
        const body = setMsnbcBodyMode(panel, "board");
        if(!body) return;
        getMsnbcFullSenateCountsFromGlobalState();
        hydrateMsnbcElectionRaceData("senate");
        const senateData = getSenateElectionNightData();
        logMsnbcSenateElectionNightData(senateData);
        const modelCounts = getMsnbcSenateCountsFromElectionData(senateData)
            || getMsnbcSenateControlCounts();

        const nativeCounts = readMsnbcConfidentNativeSenateCounts();
        const counts = reconcileMsnbcSenateCounts(nativeCounts, modelCounts);
        const decidedSeats = Math.max(0, counts.D) + Math.max(0, counts.R) + Math.max(0, counts.I);
        const chamberSeats = Math.max(100, Number(counts.total) || decidedSeats);
        const senateSeatBuckets = getMsnbcSenateSeatBuckets(counts);
        const undecidedSeats = senateSeatBuckets.undecidedSeats;
        const senateControlParty = getMsnbcSenateControlParty(counts);
        const renderKey = `${counts.D}|${counts.R}|${counts.I}|${undecidedSeats}|${chamberSeats}|${senateControlParty}`;
        if(body.dataset.msnbcSenateRenderKey === renderKey && body.querySelector(".bm-msnbc-senate-control")) return;
        body.dataset.msnbcSenateRenderKey = renderKey;
        const senateSvg = renderMsnbcSenateSvg(counts);
        body.innerHTML = `
            <div class="bm-msnbc-senate-control">
                <div class="bm-msnbc-senate-card">
                    <div class="bm-msnbc-senate-title">
                        <span>Senate At This Hour</span>
                        <span class="bm-msnbc-senate-seat-total">${formatWholeNumber(chamberSeats)} Seats</span>
                    </div>
                    <div class="bm-msnbc-senate-bars">
                        <div class="bm-msnbc-senate-party-bar D">
                            <span class="bm-msnbc-senate-party-letter">D</span>
                            <span class="bm-msnbc-senate-party-count">${formatWholeNumber(counts.D)}</span>
                            <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon bm-msnbc-senate-win ${senateControlParty === "D" ? "visible" : ""}">
                                <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                            </svg>
                        </div>
                        <div class="bm-msnbc-senate-separator"></div>
                        <div class="bm-msnbc-senate-undecided">
                            <strong>${formatWholeNumber(undecidedSeats)}</strong>
                            <span>Undecided</span>
                        </div>
                        <div class="bm-msnbc-senate-party-bar R">
                            <span class="bm-msnbc-senate-party-count">${formatWholeNumber(counts.R)}</span>
                            <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon bm-msnbc-senate-win ${senateControlParty === "R" ? "visible" : ""}">
                                <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                            </svg>
                            <span class="bm-msnbc-senate-party-letter">R</span>
                        </div>
                    </div>
                    ${senateControlParty ? `
                        <div class="bm-msnbc-senate-control-call ${senateControlParty}">
                            ${senateControlParty === "D" ? "Democrats" : "Republicans"} win control of the Senate
                        </div>
                    ` : ""}
                    <div class="bm-msnbc-senate-arc">
                        <div class="bm-msnbc-senate-chamber">
                            ${senateSvg}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };
    const buildMsnbcHouseChamberGeometry = () => {
        const rows = [
            { count: 31, leftCount: 15, rightCount: 16, innerR: 190, outerR: 208 },
            { count: 36, leftCount: 18, rightCount: 18, innerR: 213, outerR: 231 },
            { count: 41, leftCount: 21, rightCount: 20, innerR: 236, outerR: 254 },
            { count: 46, leftCount: 23, rightCount: 23, innerR: 259, outerR: 277 },
            { count: 51, leftCount: 25, rightCount: 26, innerR: 282, outerR: 300 },
            { count: 56, leftCount: 28, rightCount: 28, innerR: 305, outerR: 323 },
            { count: 61, leftCount: 31, rightCount: 30, innerR: 328, outerR: 346 },
            { count: 66, leftCount: 33, rightCount: 33, innerR: 351, outerR: 369 },
            { count: 47, leftCount: 23, rightCount: 23, centerSeat: true, innerR: 374, outerR: 392 }
        ];
        const cx = 550;
        const cy = 390;
        const startAngle = 180;
        const endAngle = 360;
        const yScale = 0.66;
        const bands = rows.map(row => ({
            ...row,
            path: describeSeatSegment(cx, cy, row.innerR, row.outerR, startAngle, endAngle, yScale)
        }));
        const seats = [];
        rows.forEach((row, rowIndex) => {
            const centerAngle = 270;
            const centerSeatWidth = row.centerSeat ? (endAngle - startAngle) / row.count : 0;
            const centerStart = centerAngle - (centerSeatWidth / 2);
            const centerEnd = centerAngle + (centerSeatWidth / 2);
            const halves = [
                { count: row.leftCount, start: startAngle, end: row.centerSeat ? centerStart : centerAngle },
                { count: row.rightCount, start: row.centerSeat ? centerEnd : centerAngle, end: endAngle }
            ];
            halves.forEach(half => {
                if(half.count <= 0) return;
                const step = (half.end - half.start) / half.count;
                for(let index = 0; index < half.count; index++) {
                    const seatStart = half.start + (index * step);
                    const seatEnd = half.start + ((index + 1) * step);
                    seats.push({
                        rowIndex,
                        midAngle: (seatStart + seatEnd) / 2,
                        path: describeSeatSegment(cx, cy, row.innerR + 0.5, row.outerR - 0.7, seatStart, seatEnd, yScale),
                        sidePath: describeSeatFrontFace(cx, cy, row.outerR - 0.7, seatStart, seatEnd, yScale, 4)
                    });
                }
            });
            if(row.centerSeat) {
                seats.push({
                    rowIndex,
                    midAngle: centerAngle,
                    path: describeSeatSegment(cx, cy, row.innerR + 0.5, row.outerR - 0.7, centerStart, centerEnd, yScale),
                    sidePath: describeSeatFrontFace(cx, cy, row.outerR - 0.7, centerStart, centerEnd, yScale, 4),
                    centerSeat: true
                });
            }
        });
        return { rows, bands, seats, cx, cy, yScale };
    };
    const getMsnbcHouseSeatBuckets = (counts) => {
        const totalSeats = 435;
        const demSeats = Math.max(0, Math.min(totalSeats, Number(counts.D) || 0));
        const rawRepSeats = Math.max(0, Number(counts.R) || 0);
        const repSeats = Math.max(0, Math.min(totalSeats - demSeats, rawRepSeats));
        const undecidedSeats = Math.max(0, totalSeats - demSeats - repSeats - (Number(counts.I) || 0));
        return { totalSeats, demSeats, repSeats, undecidedSeats };
    };
    const buildMsnbcHousePartyBlocks = (counts, geometry) => {
        const buckets = getMsnbcHouseSeatBuckets(counts);
        return geometry.seats
            .slice()
            .sort((a, b) => a.midAngle - b.midAngle || a.rowIndex - b.rowIndex)
            .map((seat, index) => {
                const seatNumber = index + 1;
                const party = seatNumber <= buckets.demSeats
                    ? "D"
                    : seatNumber > buckets.totalSeats - buckets.repSeats
                        ? "R"
                        : "U";
                const title = party === "D"
                    ? `Seat ${seatNumber} - Democrat`
                    : party === "R"
                        ? `Seat ${seatNumber} - Republican`
                        : `Seat ${seatNumber} - Undecided`;
                return { ...seat, party, title };
            });
    };
    const renderMsnbcHouseSvg = (counts) => {
        const geometry = buildMsnbcHouseChamberGeometry();
        const partyBlocks = buildMsnbcHousePartyBlocks(counts, geometry);
        return `
            <svg class="bm-msnbc-house-svg" viewBox="0 0 1100 520" role="img" aria-label="House seat control chart">
                <defs>
                    <filter id="bm-msnbc-house-base-shadow" x="-20%" y="-20%" width="140%" height="170%">
                        <feDropShadow dx="0" dy="12" stdDeviation="6" flood-color="#4d5961" flood-opacity="0.22"/>
                    </filter>
                    <linearGradient id="bm-msnbc-house-blue-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#27a9e8"/>
                        <stop offset="1" stop-color="#0876b9"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-house-red-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#f04a43"/>
                        <stop offset="1" stop-color="#c9201f"/>
                    </linearGradient>
                    <linearGradient id="bm-msnbc-house-undecided-top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="#ffffff"/>
                        <stop offset="1" stop-color="#eceff1"/>
                    </linearGradient>
                </defs>
                <path d="M 92 434 C 240 490, 860 490, 1008 434 C 830 478, 270 478, 92 434 Z" fill="rgba(60,70,78,0.15)"></path>
                <g filter="url(#bm-msnbc-house-base-shadow)">
                    ${geometry.bands.map(band => `
                        <path d="${band.path}" transform="translate(0 10)" fill="#dfe4e8" stroke="#aeb7be" stroke-width="2" opacity="0.72"></path>
                    `).join("")}
                </g>
                <g>
                    ${partyBlocks.map(block => `
                        <path d="${block.sidePath}" fill="${getMsnbcSenateSeatDepthColor(block.party)}" opacity="${block.party === "U" ? "0.56" : "0.82"}"></path>
                    `).join("")}
                </g>
                <g>
                    ${partyBlocks.map((block, index) => `
                        <g class="bm-msnbc-senate-seat-hit">
                            <title>${escapeHtml(block.title)}</title>
                            <path class="bm-msnbc-senate-seat-segment bm-msnbc-senate-seat-top" d="${block.path}" fill="${block.party === "D" ? "url(#bm-msnbc-house-blue-top)" : block.party === "R" ? "url(#bm-msnbc-house-red-top)" : "url(#bm-msnbc-house-undecided-top)"}" stroke="#8f989f" stroke-width="1.1" style="--bm-seat-delay: ${Math.min(420, index * 4)}ms;"></path>
                        </g>
                    `).join("")}
                </g>
                <line x1="550" y1="128" x2="550" y2="444" stroke="#ffffff" stroke-width="6" opacity="0.98"></line>
                <line x1="550" y1="128" x2="550" y2="444" stroke="#cfd5d9" stroke-width="1.2" opacity="0.68"></line>
            </svg>
        `;
    };
    const renderMsnbcHouseControl = (panel) => {
        const body = setMsnbcBodyMode(panel, "board");
        if(!body) return;
        hydrateMsnbcElectionRaceData("house");
        const counts = getMsnbcHouseControlCounts();
        const chamberSeats = Math.max(435, Number(counts.total) || 435);
        const buckets = getMsnbcHouseSeatBuckets(counts);
        const houseControlParty = getMsnbcHouseControlParty(counts);
        const renderKey = `${counts.D}|${counts.R}|${counts.I}|${buckets.undecidedSeats}|${chamberSeats}|${houseControlParty}`;
        if(body.dataset.msnbcHouseRenderKey === renderKey && body.querySelector(".bm-msnbc-house-control")) return;
        body.dataset.msnbcHouseRenderKey = renderKey;
        body.innerHTML = `
            <div class="bm-msnbc-senate-control bm-msnbc-house-control">
                <div class="bm-msnbc-senate-card bm-msnbc-house-card">
                    <div class="bm-msnbc-senate-title">
                        <span>House At This Hour</span>
                        <span class="bm-msnbc-senate-seat-total">${formatWholeNumber(chamberSeats)} Seats</span>
                    </div>
                    <div class="bm-msnbc-senate-bars">
                        <div class="bm-msnbc-senate-party-bar D">
                            <span class="bm-msnbc-senate-party-letter">D</span>
                            <span class="bm-msnbc-senate-party-count">${formatWholeNumber(counts.D)}</span>
                            <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon bm-msnbc-senate-win ${houseControlParty === "D" ? "visible" : ""}">
                                <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                            </svg>
                        </div>
                        <div class="bm-msnbc-senate-undecided">
                            <strong>${formatWholeNumber(buckets.undecidedSeats)}</strong>
                            <span>Undecided</span>
                        </div>
                        <div class="bm-msnbc-senate-party-bar R">
                            <span class="bm-msnbc-senate-party-count">${formatWholeNumber(counts.R)}</span>
                            <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon bm-msnbc-senate-win ${houseControlParty === "R" ? "visible" : ""}">
                                <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                            </svg>
                            <span class="bm-msnbc-senate-party-letter">R</span>
                        </div>
                    </div>
                    ${houseControlParty ? `
                        <div class="bm-msnbc-senate-control-call ${houseControlParty}">
                            ${houseControlParty === "D" ? "Democrats" : "Republicans"} win control of the House
                        </div>
                    ` : ""}
                    <div class="bm-msnbc-senate-arc">
                        <div class="bm-msnbc-senate-chamber">
                            ${renderMsnbcHouseSvg(counts)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };
    const renderMsnbcRaceContent = (panel, race) => {
        const previousCandidateList = panel.querySelector(".bm-msnbc-candidate-list");
        const previousCandidateScrollKey = previousCandidateList?.dataset.scrollKey || "";
        const previousCandidateScrollTop = previousCandidateList?.scrollTop || 0;
        setMsnbcBodyMode(panel, "");
        const raceConfig = getMsnbcRaceConfig(race);
        const entries = getMsnbcPanelEntries(raceConfig.race);
        const entry = getMsnbcSelectedEntry(entries);
        if(!entry) {
            panel.querySelector(".bm-msnbc-body").innerHTML = `<div class="bm-msnbc-empty">No ${escapeHtml(raceConfig.title.toLowerCase())} general results found yet.</div>`;
            return;
        }
        msnbcElectionPanelState.selectedYear = entry.year;
        const selectedState = entry.states.find(state =>
            String(state.code || "").toUpperCase() === String(msnbcElectionPanelState.selectedStateCode || "").toUpperCase()
        );
        const isCurrentSelectedState = Boolean(entry.current && selectedState);
        const selectedStateDisplayScope = isCurrentSelectedState
            ? getMsnbcOfficialSelectedStateDisplayScope(selectedState)
            : selectedState;
        const displayScope = selectedStateDisplayScope || (raceConfig.race === "president" ? entry : null);
        const displayTitle = selectedState
            ? `${selectedState.name}`
            : raceConfig.race === "president"
                ? `${entry.year} ${raceConfig.title}`
                : raceConfig.title;
        const displaySubTitle = selectedState ? `${selectedState.code} | STATEWIDE` : "";
        const displayReportedPct = isCurrentSelectedState
            ? Math.max(0, Math.min(100, Math.round(Number(selectedStateDisplayScope.reportedPct) || 0)))
            : null;
        const neededText = "";
        const presidentialNeededText = raceConfig.race === "president"
            ? `${getMsnbcRoadNeededVotes(entry)} NEEDED`
            : raceConfig.neededText.replace(/<br\s*\/?>/gi, " ");
        const mapNeededText = !selectedState && raceConfig.race === "president"
            ? presidentialNeededText
            : "";
        const displayTotalVotes = Number(displayScope?.totalVotes) || 0;
        const hasVisibleResults = displayTotalVotes > 0;
        const statusText = getMsnbcProjectedStatusText(selectedStateDisplayScope);
        const topCandidates = (displayScope?.candidates || [])
            .slice()
            .sort((a, b) => Number(b.votes) - Number(a.votes));
        const candidateScrollKey = [
            raceConfig.race,
            entry.year,
            selectedState?.code || "national"
        ].join(":");
        const emptyStatePrompt = !displayScope
            ? `<div class="bm-msnbc-empty">Select a state to view ${escapeHtml(raceConfig.title.toLowerCase())} results.</div>`
            : "";
        const topVoteDifference = topCandidates.length >= 2
            ? Math.max(0, (Number(topCandidates[0]?.votes) || 0) - (Number(topCandidates[1]?.votes) || 0))
            : 0;
        const showProjectedWinnerMark = selectedStateDisplayScope?.projected === true
            && ["president", "senate", "governor"].includes(raceConfig.race);
        const candidateRows = topCandidates.map((candidate, index) => {
            const party = normalizePanelPartyCode(candidate.party) || "I";
            const candidateColour = getMsnbcCandidateColour(candidate, displayScope);
            const pct = displayTotalVotes > 0 ? ((candidate.votes / displayTotalVotes) * 100).toFixed(1) : "0.0";
            const displayCandidateName = `${getPanelCandidateName(candidate)}${candidate.incumbent ? "*" : ""}`;
            const projectedWinnerMark = index === 0 && hasVisibleResults && showProjectedWinnerMark
                ? `<svg viewBox="0 0 14 14" stroke-width="2" aria-label="Projected winner" class="winner-icon bm-msnbc-senate-win visible bm-msnbc-projected-winner-mark">
                        <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                   </svg>`
                : "";
            const differenceText = index === 0 && hasVisibleResults && topVoteDifference > 0
                ? `<div class="bm-msnbc-vote-difference">Difference: ${formatWholeNumber(topVoteDifference)}</div>`
                : "";
            return `
                <div class="bm-msnbc-candidate-row ${party}${hasVisibleResults ? "" : " no-results"}">
                    <div class="bm-msnbc-name-block" style="background: ${escapeHtml(candidateColour)}" data-full-name="${escapeHtml(displayCandidateName)}" title="${escapeHtml(displayCandidateName)}">
                        ${projectedWinnerMark}
                        <div class="bm-msnbc-name-line">
                            <span class="bm-msnbc-candidate-name">${escapeHtml(displayCandidateName)}</span>
                        </div>
                        ${differenceText}
                    </div>
                    ${hasVisibleResults ? `
                        <div class="bm-msnbc-stat-block">
                            <div class="bm-msnbc-percent">${pct}%</div>
                            <div class="bm-msnbc-votes">${formatWholeNumber(candidate.votes)}</div>
                        </div>
                    ` : ""}
                </div>
            `;
        }).join("");
        panel.querySelector(".bm-msnbc-body").innerHTML = `
            <div class="bm-msnbc-candidates">
                <div class="bm-msnbc-office-title">
                    <span class="bm-msnbc-office-name">${escapeHtml(displayTitle)}</span>
                    <span class="bm-msnbc-needed">${neededText}</span>
                </div>
                ${displaySubTitle ? `
                    <div class="bm-msnbc-scope-label">
                        <span>${escapeHtml(displaySubTitle)}</span>
                        ${displayReportedPct !== null ? `
                            <span class="bm-msnbc-reporting">
                                ${displayReportedPct}% IN
                                <span class="bm-msnbc-reporting-bar">
                                    <span class="bm-msnbc-reporting-fill" style="width: ${displayReportedPct}%"></span>
                                </span>
                            </span>
                        ` : ""}
                    </div>
                ` : ""}
                ${statusText ? `<div class="bm-msnbc-call-status">${escapeHtml(statusText)}</div>` : ""}
                <div class="bm-msnbc-candidate-list" data-scroll-key="${escapeHtml(candidateScrollKey)}">
                    ${emptyStatePrompt || candidateRows}
                </div>
            </div>
            <div class="bm-msnbc-map-wrap" id="bm-msnbc-map-wrap">
                ${mapNeededText ? `<div class="bm-msnbc-map-needed">${escapeHtml(mapNeededText)}</div>` : ""}
            </div>
            <div class="bm-msnbc-years">
                ${entries.map(yearEntry => `
                    <button class="bm-msnbc-year-btn ${Number(yearEntry.year) === Number(entry.year) ? "active" : ""}"
                        data-year="${escapeHtml(yearEntry.year)}">${escapeHtml(yearEntry.year)}</button>
                `).join("")}
            </div>
        `;
        const candidateList = panel.querySelector(".bm-msnbc-candidate-list");
        if(candidateList && previousCandidateScrollKey === candidateScrollKey) {
            candidateList.scrollTop = previousCandidateScrollTop;
        }
        panel.querySelectorAll(".bm-msnbc-year-btn").forEach(button => {
            button.addEventListener("click", () => {
                msnbcElectionPanelState.selectedYear = Number(button.dataset.year);
                msnbcElectionPanelState.selectedStateCode = null;
                msnbcElectionPanelState.selectedCountyName = null;
                msnbcElectionPanelState.comparisonCount = 0;
                msnbcElectionPanelState.hiddenHistoryYears = [];
                renderMsnbcRaceContent(panel, raceConfig.race);
            });
        });
        const mapWrap = panel.querySelector("#bm-msnbc-map-wrap");
        const baseMapFillGetter = raceConfig.race === "president" && entry.current
            ? getMsnbcRoadMapFill
            : getMsnbcMapFill;
        const mapFillGetter = (state, stateCode) => {
            const stateForFill = entry.current && state
                ? getMsnbcOfficialSelectedStateDisplayScope(state)
                : state;
            return baseMapFillGetter(stateForFill, stateCode);
        };
        renderMsnbcMap(mapWrap, entry, stateCode => {
            msnbcElectionPanelState.selectedStateCode = stateCode;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
            renderMsnbcRaceContent(panel, raceConfig.race);
        }, mapFillGetter);
        if(mapNeededText && mapWrap) {
            const neededBadge = document.createElement("div");
            neededBadge.className = "bm-msnbc-map-needed";
            neededBadge.textContent = mapNeededText;
            mapWrap.appendChild(neededBadge);
        }
        if(isCurrentSelectedState && mapWrap) {
            const leftPanel = panel.querySelector(".bm-msnbc-candidates");
            const historyHeaderHeight = [
                leftPanel?.querySelector(".bm-msnbc-office-title"),
                leftPanel?.querySelector(".bm-msnbc-scope-label"),
                leftPanel?.querySelector(".bm-msnbc-call-status")
            ].reduce((sum, element) => sum + (element?.offsetHeight || 0), 0);
            const candidateRowHeight = leftPanel?.querySelector(".bm-msnbc-candidate-row")?.offsetHeight || 112;
            mapWrap.style.setProperty("--bm-msnbc-history-header-height", `${historyHeaderHeight}px`);
            mapWrap.style.setProperty("--bm-msnbc-history-row-height", `${candidateRowHeight}px`);
            const historyToggle = document.createElement("button");
            historyToggle.className = "bm-msnbc-history-toggle";
            historyToggle.textContent = "\u00bb";
            historyToggle.title = "Previous results";
            historyToggle.addEventListener("click", event => {
                event.stopPropagation();
                const maxComparisons = Math.min(MSNBC_MAX_HISTORY_COMPARISONS, entries.filter(yearEntry =>
                    !yearEntry.current && Number(yearEntry.year) < Number(entry.year)
                ).length);
                const currentCount = Number(msnbcElectionPanelState.comparisonCount) || 0;
                const visibleCount = entries
                    .filter(yearEntry => !yearEntry.current && Number(yearEntry.year) < Number(entry.year))
                    .slice(0, Math.min(MSNBC_MAX_HISTORY_COMPARISONS, currentCount))
                    .filter(yearEntry => !(msnbcElectionPanelState.hiddenHistoryYears || []).includes(Number(yearEntry.year)))
                    .length;
                if(currentCount >= maxComparisons && visibleCount === 0) {
                    msnbcElectionPanelState.hiddenHistoryYears = [];
                    msnbcElectionPanelState.comparisonCount = Math.min(1, maxComparisons);
                } else {
                    msnbcElectionPanelState.comparisonCount = Math.min(maxComparisons, currentCount + 1);
                }
                renderMsnbcRaceContent(panel, raceConfig.race);
            });
            mapWrap.appendChild(historyToggle);
            renderMsnbcHistoryComparisons(mapWrap, entries, entry, selectedState, raceConfig, panel);
        }
    };
    const renderMsnbcPanelContent = (panel) => {
        const availableRaces = getMsnbcAvailableRaces();
        refreshHouseBaseTabFromElectionNight({ reason: "msnbc-render" });
        queueMarginThroughNightChartUpdate();
        if(!availableRaces.includes(msnbcElectionPanelState.activeRace)) {
            msnbcElectionPanelState.activeRace = availableRaces[0] || "governor";
            msnbcElectionPanelState.selectedYear = null;
            msnbcElectionPanelState.selectedStateCode = null;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
                msnbcElectionPanelState.hiddenHistoryYears = [];
        }
        if(!isMsnbcPanelViewAvailable(msnbcElectionPanelState.view, msnbcElectionPanelState.activeRace)) {
            const route = getMsnbcInitialPanelRoute();
            msnbcElectionPanelState.view = route.view;
            msnbcElectionPanelState.activeRace = route.race;
            resetMsnbcPanelSelection();
        }
        renderMsnbcPanelNav(panel);
        if(msnbcElectionPanelState.view === "hub") {
            renderMsnbcHub(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "road270") {
            renderMsnbcRoadTo270(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "roadBattlegrounds") {
            renderMsnbcRoadBattlegrounds(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "battlegroundPolls") {
            renderMsnbcBattlegroundPolls(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "senateControl") {
            renderMsnbcSenateControl(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "houseControl") {
            renderMsnbcHouseControl(panel);
            return;
        }
        if(msnbcElectionPanelState.view === "voteByOffice") {
            renderMsnbcVoteByOffice(panel);
            return;
        }
        msnbcElectionPanelState.view = "race";
        hydrateMsnbcElectionRaceData(msnbcElectionPanelState.activeRace);
        renderMsnbcRaceContent(panel, msnbcElectionPanelState.activeRace);
    };
    const openMsnbcElectionPanel = () => {
        if(!isElectionNightPanelAvailable()) return;
        const existingOverlay = document.getElementById("bm-msnbc-election-overlay");
        if(existingOverlay) existingOverlay.remove();
        if(msnbcElectionPanelRefreshTimer) {
            clearInterval(msnbcElectionPanelRefreshTimer);
            msnbcElectionPanelRefreshTimer = null;
        }
        stopMsnbcElectionPanelHydration();
        const availableRaces = getMsnbcAvailableRaces();
        if(!availableRaces.includes(msnbcElectionPanelState.activeRace)) {
            msnbcElectionPanelState.activeRace = availableRaces[0] || "governor";
            msnbcElectionPanelState.selectedYear = null;
            msnbcElectionPanelState.selectedStateCode = null;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
        }
        const initialRoute = getMsnbcInitialPanelRoute();
        msnbcElectionPanelState.view = initialRoute.view;
        msnbcElectionPanelState.activeRace = initialRoute.race;
        resetMsnbcPanelSelection();
        const overlay = document.createElement("div");
        overlay.id = "bm-msnbc-election-overlay";
        overlay.innerHTML = `
            <div id="bm-msnbc-election-panel">
                <div class="bm-msnbc-election-header">
                    <div class="bm-msnbc-election-title">Election Night ${escapeHtml(getElectionNightPanelYear() || "")} | MSNBC</div>
                    <button class="bm-msnbc-election-close" id="bm-msnbc-election-close">Close</button>
                </div>
                <div class="bm-msnbc-tabs"></div>
                <div class="bm-msnbc-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        const panel = overlay.querySelector("#bm-msnbc-election-panel");
        const closePanel = () => {
            if(msnbcElectionPanelRefreshTimer) {
                clearInterval(msnbcElectionPanelRefreshTimer);
                msnbcElectionPanelRefreshTimer = null;
            }
            stopMsnbcElectionPanelHydration();
            refreshHouseBaseTabFromElectionNight({ force: true, reason: "msnbc-close" });
            overlay.remove();
        };
        document.getElementById("bm-msnbc-election-close")?.addEventListener("click", closePanel);
        overlay.addEventListener("click", event => {
            if(event.target === overlay) closePanel();
        });
        renderMsnbcPanelContent(panel);
        startMsnbcElectionPanelHydration(overlay);
        msnbcElectionPanelRefreshTimer = setInterval(() => {
            if(!overlay.isConnected) {
                clearInterval(msnbcElectionPanelRefreshTimer);
                msnbcElectionPanelRefreshTimer = null;
                stopMsnbcElectionPanelHydration();
                return;
            }
            if(document.activeElement?.id === "bm-msnbc-vote-office-select") return;
            renderMsnbcPanelContent(panel);
        }, 1500);
    };

    const getChanceSimulationElectionType = (value) => {
        if(value === "senate") return "usSenate";
        if(value === "governor") return "governor";
        return "president";
    };
    const getChanceSimulationRaceOptions = (raceValue) => {
        const electionType = getChanceSimulationElectionType(raceValue);
        const raceConfig = getMarginThroughNightRaceConfig(electionType);
        const electNight = readRuntimeValue(raceConfig?.liveVar);
        const races = Array.isArray(electNight?.elections) ? electNight.elections : [];
        return races
            .filter(stateRace => Array.isArray(stateRace?.cands) && stateRace.cands.length >= 2)
            .map(stateRace => {
                const code = getMarginThroughNightStateCodeFromRace(stateRace) || getMsnbcElectionStateCode(stateRace);
                return {
                    code: String(code || "").toUpperCase(),
                    name: getElectionNightPanelStateName(code),
                    stateRace
                };
            })
            .filter(option => option.code && option.code !== "US")
            .sort((optionA, optionB) => optionA.name.localeCompare(optionB.name));
    };
    const renderChanceSimulationDiagnostics = (panel) => {
        const body = panel?.querySelector(".bm-chance-debug-body");
        const raceSelect = panel?.querySelector("#bm-chance-debug-race");
        const stateSelect = panel?.querySelector("#bm-chance-debug-state");
        if(!body || !raceSelect || !stateSelect) return;
        const electionType = getChanceSimulationElectionType(raceSelect.value);
        const option = getChanceSimulationRaceOptions(raceSelect.value)
            .find(raceOption => raceOption.code === stateSelect.value);
        if(!option) {
            body.innerHTML = `<div class="bm-chance-debug-note">No live race data is available for this selection.</div>`;
            return;
        }
        const point = buildMarginThroughNightPoint(electionType, option.stateRace);
        const projection = point?.chanceProjection;
        const chance = point ? getChanceOfWinningData(point) : null;
        if(!point || !projection || !chance) {
            body.innerHTML = `
                <div class="bm-chance-debug-note">
                    The race does not yet have enough visible statewide and county data to run the simulation.
                </div>
            `;
            return;
        }
        const candidateRows = (point.candidates || [])
            .map(candidate => {
                const candidateIndex = Number(candidate.candidateIndex);
                const rawProbability = Number(projection.candidateProbabilities?.[candidateIndex]) || 0;
                return `
                    <tr>
                        <td>${escapeHtml(candidate.name)}</td>
                        <td>${escapeHtml(candidate.sideParty || candidate.party)}</td>
                        <td>${formatWholeNumber(candidate.votes)}</td>
                        <td>${Number(candidate.percent || 0).toFixed(1)}%</td>
                        <td>${rawProbability.toFixed(1)}% simulation wins</td>
                    </tr>
                `;
            })
            .join("");
        const zoneRows = (projection.zoneSummaries || []).map(zone => `
            <tr>
                <td>${escapeHtml(zone.name)}</td>
                <td>${Number(zone.reportingPercent || 0).toFixed(1)}%</td>
                <td>${formatWholeNumber(zone.currentTotal)}</td>
                <td>${formatWholeNumber(zone.pendingTotal)}</td>
                <td>${escapeHtml(zone.visibleLeaderName || "No visible vote")}${zone.visibleLeaderPercent === null ? "" : ` (${Number(zone.visibleLeaderPercent).toFixed(1)}%)`}</td>
                <td>
                    ${escapeHtml(zone.estimatedLeaderName || "")}
                    (${Number(zone.estimatedLeaderPercent || 0).toFixed(1)}%;
                    range ${Number(zone.estimatedLeaderLow || 0).toFixed(1)}–${Number(zone.estimatedLeaderHigh || 0).toFixed(1)}%)
                </td>
                <td>${escapeHtml(zone.estimateMethod || "")}</td>
            </tr>
        `).join("");
        body.innerHTML = `
            <div class="bm-chance-debug-summary">
                <div class="bm-chance-debug-stat"><span>Displayed chance</span><strong>${escapeHtml(chance.leader?.name || projection.leaderName)} ${Number(chance.probability || 0).toFixed(1)}%</strong></div>
                <div class="bm-chance-debug-stat"><span>Raw simulations</span><strong>${Number(projection.rawProbability || 0).toFixed(1)}%</strong></div>
                <div class="bm-chance-debug-stat"><span>Calibrated</span><strong>${Number(projection.calibratedProbability || 0).toFixed(1)}%</strong></div>
                <div class="bm-chance-debug-stat"><span>Confidence cap</span><strong>${Number(projection.confidenceCap || 0).toFixed(1)}%</strong></div>
                <div class="bm-chance-debug-stat"><span>Reporting</span><strong>${(Number(projection.reportingShare || 0) * 100).toFixed(1)}%</strong></div>
                <div class="bm-chance-debug-stat"><span>Simulations</span><strong>${formatWholeNumber(projection.simulations)}</strong></div>
                <div class="bm-chance-debug-stat"><span>Zones used</span><strong>${formatWholeNumber(projection.zoneCount)}</strong></div>
                <div class="bm-chance-debug-stat"><span>Pending votes</span><strong>${formatWholeNumber((Number(projection.totalExpectedVotes) || 0) - (Number(projection.totalCurrentVotes) || 0))}</strong></div>
            </div>
            <div class="bm-chance-debug-note">
                County candidate final totals are not used as partisan forecasts. County totals are used only to estimate turnout volume; visible votes determine the pending-vote blend.
            </div>
            ${projection.rankedChoice ? `
                <div class="bm-chance-debug-note">
                    Ranked-choice handling: ${projection.rankedChoicePending ? "transfers remain uncertain and the confidence ceiling is active." : "the race is marked as RCV, but no pending-transfer ceiling is currently required."}
                </div>
            ` : ""}
            <table class="bm-chance-debug-table">
                <thead><tr><th>Candidate</th><th>Block</th><th>Current votes</th><th>Current share</th><th>Simulation result</th></tr></thead>
                <tbody>${candidateRows}</tbody>
            </table>
            <table class="bm-chance-debug-table">
                <thead><tr><th>County / zone</th><th>Reported</th><th>Counted</th><th>Pending</th><th>Visible leader</th><th>Pending-vote estimate</th><th>Estimate basis</th></tr></thead>
                <tbody>${zoneRows}</tbody>
            </table>
        `;
    };
    const populateChanceSimulationStateSelect = (panel, preferredStateCode = "") => {
        const raceSelect = panel?.querySelector("#bm-chance-debug-race");
        const stateSelect = panel?.querySelector("#bm-chance-debug-state");
        if(!raceSelect || !stateSelect) return;
        const options = getChanceSimulationRaceOptions(raceSelect.value);
        stateSelect.innerHTML = options.map(option =>
            `<option value="${escapeHtml(option.code)}">${escapeHtml(option.name)}</option>`
        ).join("");
        const preferred = String(preferredStateCode || "").toUpperCase();
        if(preferred && options.some(option => option.code === preferred)) stateSelect.value = preferred;
        renderChanceSimulationDiagnostics(panel);
    };
    const openChanceSimulationsPanel = () => {
        document.getElementById("bm-chance-simulations-overlay")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "bm-chance-simulations-overlay";
        overlay.innerHTML = `
            <div id="bm-chance-simulations-panel">
                <div class="bm-chance-debug-head">
                    <strong>Simulations Chance of Winning</strong>
                    <button type="button" id="bm-chance-debug-close">Close</button>
                </div>
                <div class="bm-chance-debug-controls">
                    <label>Election
                        <select id="bm-chance-debug-race">
                            <option value="president">Presidential</option>
                            <option value="senate">Senate</option>
                            <option value="governor">Governor</option>
                        </select>
                    </label>
                    <label>State
                        <select id="bm-chance-debug-state"></select>
                    </label>
                    <button type="button" id="bm-chance-debug-refresh">Refresh simulation</button>
                </div>
                <div class="bm-chance-debug-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        const panel = overlay.querySelector("#bm-chance-simulations-panel");
        const raceSelect = panel?.querySelector("#bm-chance-debug-race");
        const availableRace = ["president", "senate", "governor"]
            .find(race => getChanceSimulationRaceOptions(race).length > 0) || "president";
        if(raceSelect) raceSelect.value = availableRace;
        const visibleStateCode = getMarginThroughNightVisibleStateCode(null, getChanceSimulationElectionType(availableRace));
        populateChanceSimulationStateSelect(panel, visibleStateCode);
        let refreshTimer = null;
        const closePanel = () => {
            if(refreshTimer) clearInterval(refreshTimer);
            overlay.remove();
        };
        panel?.querySelector("#bm-chance-debug-close")?.addEventListener("click", closePanel);
        panel?.querySelector("#bm-chance-debug-race")?.addEventListener("change", () => populateChanceSimulationStateSelect(panel));
        panel?.querySelector("#bm-chance-debug-state")?.addEventListener("change", () => renderChanceSimulationDiagnostics(panel));
        panel?.querySelector("#bm-chance-debug-refresh")?.addEventListener("click", () => {
            chanceZoneProjectionCache.clear();
            renderChanceSimulationDiagnostics(panel);
        });
        overlay.addEventListener("click", event => {
            if(event.target === overlay) closePanel();
        });
        refreshTimer = setInterval(() => {
            if(!overlay.isConnected) {
                clearInterval(refreshTimer);
                return;
            }
            renderChanceSimulationDiagnostics(panel);
        }, 2000);
    };

    const updateMsnbcElectionButtonVisibility = () => {
        const button = document.getElementById("bm-msnbc-election-btn");
        if(!button) return;
        const primaryElection = isMsnbcPrimaryElectionContext();
        const visible = !primaryElection && isElectionNightPanelAvailable();
        button.style.display = visible ? "block" : "none";
        button.disabled = !visible;
        button.setAttribute("aria-hidden", visible ? "false" : "true");

        if(primaryElection) {
            document.getElementById("bm-msnbc-election-overlay")?.remove();
            if(msnbcElectionPanelRefreshTimer) {
                clearInterval(msnbcElectionPanelRefreshTimer);
                msnbcElectionPanelRefreshTimer = null;
            }
            stopMsnbcElectionPanelHydration();
        }

        const nextText = `Election Night ${getElectionNightPanelYear() || ""}`.trim();
        if(button.textContent !== nextText) button.textContent = nextText;
        styleRcvResultsButtonLikeElectionNight(
            document.getElementById("bm-rcv-results-button")
        );
    };
    const createMsnbcElectionPanelButton = () => {
        if(modShuttingDown) return;
        if(!document.body) {
            if(msnbcElectionButtonInstallTimer) clearTimeout(msnbcElectionButtonInstallTimer);
            msnbcElectionButtonInstallTimer = setTimeout(() => {
                msnbcElectionButtonInstallTimer = null;
                createMsnbcElectionPanelButton();
            }, 100);
            return;
        }
        injectMsnbcElectionPanelStyles();
        if(!document.getElementById("bm-msnbc-election-btn")) {
            const button = document.createElement("button");
            button.id = "bm-msnbc-election-btn";
            button.textContent = "Election Night";
            button.style.display = "none";
            button.addEventListener("click", openMsnbcElectionPanel);
            document.body.appendChild(button);
        }

        updateMsnbcElectionButtonVisibility();
    };
    const installMsnbcElectionPanel = () => {
        try {
            if(modShuttingDown) return;
            createMsnbcElectionPanelButton();
            if(msnbcElectionPanelObserver || !document.body) return;
            msnbcElectionPanelObserver = true;
            if(!msnbcElectionButtonVisibilityTimer) {
                msnbcElectionButtonVisibilityTimer = setInterval(() => {
                    if(!modShuttingDown) updateMsnbcElectionButtonVisibility();
                }, 1000);
            }
        } catch (error) {
            globalThis.bmMsnbcElectionPanelError = error;
        }
    };
    const roundPollDisplayValue = (value) => {
        const number = Number(value);
        if(!Number.isFinite(number)) return null;
        return Math.round((number + Number.EPSILON) * 10) / 10;
    };
    const formatPollDisplayValue = (value) => {
        const rounded = roundPollDisplayValue(value);
        if(rounded === null) return "";
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };
    const formatPollPercentageValue = (value) => `${formatPollDisplayValue(value)}%`;
    const formatPollAveragePercentageValue = (value) => {
        const rounded = roundPollDisplayValue(value);
        return `${(rounded ?? 0).toFixed(1)}%`;
    };
    const getValidPollSample = (poll) => {
        const rawSample = poll?.sample ?? poll?.respondents ?? poll?.sampleSize;
        if(typeof rawSample === "number"){
            return Number.isFinite(rawSample) && rawSample > 0 ? rawSample : null;
        }
        const normalized = String(rawSample ?? "").trim().replace(/,/g, "");
        if(!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
        const sample = Number(normalized);
        return Number.isFinite(sample) && sample > 0 ? sample : null;
    };
    const formatPollPercentageText = (text) => {
        return String(text || "").replace(/(\d+(?:\.\d+)?)%/g, (_match, value) => {
            const number = Number(value);
            return Number.isFinite(number) ? formatPollPercentageValue(number) : value + "%";
        });
    };
    const formatPollLeaderText = (text) => {
        return String(text || "").replace(/([+-])\s*(\d+(?:\.\d+)?)/g, (_match, sign, value) => {
            const number = Number(value);
            return Number.isFinite(number) ? sign + formatPollDisplayValue(number) : sign + value;
        });
    };
    const formatPollLeaderCell = (cell) => {
        const currentText = String(cell?.textContent || "");
        if(!cell.dataset.bmPollRawLeader || currentText !== cell.dataset.bmPollFormattedLeader){
            cell.dataset.bmPollRawLeader = currentText;
        }
        const leaderText = cell.dataset.bmPollRawLeader;
        const marginMatch = leaderText.match(/([+-])\s*(\d+(?:\.\d+)?)/);
        if(marginMatch){
            const margin = Number(marginMatch[2]);
            if(Number.isFinite(margin) && margin <= 0){
                cell.textContent = "Tie";
                cell.style.color = "black";
                cell.dataset.bmPollFormattedLeader = "Tie";
                return;
            }
        }
        const formattedText = formatPollLeaderText(leaderText);
        if(currentText !== formattedText) cell.textContent = formattedText;
        cell.dataset.bmPollFormattedLeader = formattedText;
    };
    const formatTextNodes = (element, formatter) => {
        if(!element) return;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node = walker.nextNode();
        while(node){
            textNodes.push(node);
            node = walker.nextNode();
        }
        textNodes.forEach(textNode => {
            const formattedText = formatter(textNode.nodeValue);
            if(formattedText !== textNode.nodeValue) textNode.nodeValue = formattedText;
        });
    };
    const formatIndependentPollDecimals = () => {
        updateWeightedPollAverageRows();
        const pollTables = document.querySelectorAll("table.indPollTitleTbl, table.indPollTitleTbl2");
        pollTables.forEach(table => {
            const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
            if(headerCells.length === 0) return;
            const headers = headerCells.map(cell => String(cell.textContent || "").trim());
            const electionIndex = headers.findIndex(header => header === "Election");
            const resultsIndex = headers.findIndex(header => header === "Results");
            const leaderIndex = headers.findIndex(header => header === "Leader");
            if(resultsIndex === -1 && leaderIndex === -1) return;
            Array.from(table.rows).slice(1).forEach(row => {
                const isAverageRow = electionIndex !== -1
                    && String(row.cells[electionIndex]?.textContent || "").trim().toUpperCase() === "AVERAGE";
                if(!isAverageRow && resultsIndex !== -1 && row.cells[resultsIndex]){
                    formatTextNodes(row.cells[resultsIndex], formatPollPercentageText);
                }
                if(leaderIndex !== -1 && row.cells[leaderIndex]){
                    formatPollLeaderCell(row.cells[leaderIndex]);
                }
            });
        });
    };
    function hasIndependentPollSurface() {
        return Boolean(document.querySelector(
            "table.indPollTitleTbl, table.indPollTitleTbl2, #pollDetailCanvas, #pollDetailCanvas2, canvas.pollDetailCanvas, #pollDetailDiv canvas, #pollDetailCanvDiv canvas, #bm-msnbc-poll-overlay"
        ));
    }
    const queueIndependentPollDecimalFormatting = () => {
        if(!hasIndependentPollSurface()) return;
        if(independentPollFormatTimer) clearTimeout(independentPollFormatTimer);
        independentPollFormatQueued = true;
        independentPollFormatTimer = setTimeout(() => {
            independentPollFormatTimer = null;
            independentPollFormatQueued = false;
            if(!hasIndependentPollSurface()) return;
            pollAveragePointCenterCache = new WeakMap();
            pollAverageRawPointCenterCache = new WeakMap();
            pollAverageWeightedGraphCache = new WeakMap();
            formatIndependentPollDecimals();
            removePollAverageGraphOverlays();
            applyWeightedPollAveragesToNativeGraphs();
            attachPollAverageCanvasTooltips();
            syncPollBattlegroundFilter();
        }, 60);
    };
    const isElementVisible = (element) => {
        if(!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none"
            && style.visibility !== "hidden"
            && element.getClientRects().length > 0;
    };
    const POLL_BATTLEGROUND_FILTER_VALUE = "__bm_battleground_states__";
    const isIndependentPollFilterSelectCacheValid = filters => {
        if(!filters || !Object.values(filters).every(select => select?.isConnected)) return false;
        const electionOptions = Array.from(filters.election.options || []).map(option => String(option.textContent || "").trim());
        const stateOptions = Array.from(filters.state.options || []).map(option => String(option.textContent || "").trim());
        return electionOptions.includes("President")
            && electionOptions.includes("Governor")
            && stateOptions.includes("National");
    };
    const getIndependentPollFilterSelects = () => {
        if(isIndependentPollFilterSelectCacheValid(independentPollFilterSelectsCache)) {
            return independentPollFilterSelectsCache;
        }
        const selects = Array.from(document.querySelectorAll("select")).filter(isElementVisible);
        for(let index = 0; index <= selects.length - 4; index++){
            const group = selects.slice(index, index + 4);
            const optionTexts = group.map(select =>
                Array.from(select.options || []).map(option => String(option.textContent || "").trim())
            );
            const isPollGroup = optionTexts[0].includes("President")
                && optionTexts[0].includes("Governor")
                && optionTexts[1].includes("National")
                && optionTexts[2].includes("Primary")
                && optionTexts[2].includes("General");
            if(isPollGroup) {
                independentPollFilterSelectsCache = {
                    election: group[0],
                    state: group[1],
                    category: group[2],
                    party: group[3]
                };
                return independentPollFilterSelectsCache;
            }
        }
        independentPollFilterSelectsCache = null;
        return null;
    };
    const ensurePollBattlegroundStateOption = stateSelect => {
        if(!stateSelect) return null;
        let option = Array.from(stateSelect.options || []).find(entry =>
            entry.value === POLL_BATTLEGROUND_FILTER_VALUE
        );
        if(option) return option;
        option = document.createElement("option");
        option.value = POLL_BATTLEGROUND_FILTER_VALUE;
        option.textContent = "Battleground States";
        option.dataset.bmBattlegroundFilter = "true";
        const nationalOption = Array.from(stateSelect.options || []).find(entry =>
            String(entry.textContent || "").trim() === "National"
        );
        if(nationalOption?.nextSibling) {
            stateSelect.insertBefore(option, nationalOption.nextSibling);
        } else {
            stateSelect.appendChild(option);
        }
        return option;
    };
    const getPollBattlegroundStateCodes = () => {
        if(pollBattlegroundStateCodesCache) return pollBattlegroundStateCodesCache;
        const states = Executive?.data?.states || {};
        pollBattlegroundStateCodesCache = new Set(Object.keys(states)
            .filter(code => isMsnbcGameBattlegroundState({ code }))
            .map(code => String(code).toUpperCase()));
        return pollBattlegroundStateCodesCache;
    };
    const findPollWeekHeadingForTable = table => {
        let sibling = table?.previousElementSibling || null;
        while(sibling){
            if(/^H[1-3]$/.test(sibling.tagName || "") && parsePollWeekHeading(sibling.textContent)) {
                return sibling;
            }
            if(sibling.matches?.("table.indPollTitleTbl, table.indPollTitleTbl2")) break;
            sibling = sibling.previousElementSibling;
        }
        return null;
    };
    const clearPollBattlegroundRowFiltering = () => {
        document.querySelectorAll("[data-bm-battleground-row]").forEach(row => {
            row.style.removeProperty("display");
            delete row.dataset.bmBattlegroundRow;
        });
        document.querySelectorAll("[data-bm-battleground-table]").forEach(table => {
            table.style.removeProperty("display");
            delete table.dataset.bmBattlegroundTable;
        });
        document.querySelectorAll("[data-bm-battleground-heading]").forEach(heading => {
            heading.style.removeProperty("display");
            delete heading.dataset.bmBattlegroundHeading;
        });
    };
    const applyPollBattlegroundRowFiltering = () => {
        if(!pollBattlegroundFilterActive) return;
        const battlegroundStates = getPollBattlegroundStateCodes();
        if(battlegroundStates.size === 0) return;
        document.querySelectorAll("table.indPollTitleTbl, table.indPollTitleTbl2").forEach(table => {
            const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
            const electionIndex = headerCells.findIndex(cell =>
                String(cell.textContent || "").trim() === "Election"
            );
            if(electionIndex < 0) return;
            let visibleRows = 0;
            Array.from(table.rows).slice(1).forEach(row => {
                const electionText = String(row.cells[electionIndex]?.textContent || "").trim();
                const stateMatch = electionText.match(/-\s*([A-Z]{2})\b/);
                const visible = Boolean(stateMatch && battlegroundStates.has(stateMatch[1]));
                row.dataset.bmBattlegroundRow = "true";
                row.style.display = visible ? "" : "none";
                if(visible) visibleRows++;
            });
            const visible = visibleRows > 0;
            table.dataset.bmBattlegroundTable = "true";
            table.style.display = visible ? "" : "none";
            const heading = findPollWeekHeadingForTable(table);
            if(heading){
                heading.dataset.bmBattlegroundHeading = "true";
                heading.style.display = visible ? "" : "none";
            }
        });
    };
    const syncPollBattlegroundFilter = () => {
        const filters = getIndependentPollFilterSelects();
        if(!filters) return;
        ensurePollBattlegroundStateOption(filters.state);
        if(!pollBattlegroundFilterActive) return;
        filters.state.value = POLL_BATTLEGROUND_FILTER_VALUE;
        applyPollBattlegroundRowFiltering();
    };
    const queuePollBattlegroundFilterSync = (delay = 0) => {
        if(pollBattlegroundFilterRefreshTimer) clearTimeout(pollBattlegroundFilterRefreshTimer);
        pollBattlegroundFilterRefreshTimer = setTimeout(() => {
            pollBattlegroundFilterRefreshTimer = null;
            if(!modShuttingDown) syncPollBattlegroundFilter();
        }, delay);
    };
    const restorePollBattlegroundResults = () => {
        if(pollBattlegroundResultsRestoreTimer) clearTimeout(pollBattlegroundResultsRestoreTimer);
        pollBattlegroundResultsRestoreTimer = null;
        const restoreState = pollBattlegroundResultsRestoreState;
        pollBattlegroundResultsRestoreState = null;
        if(!restoreState?.source || !Array.isArray(restoreState.snapshot)) return;
        restoreState.source.length = 0;
        restoreState.snapshot.forEach(poll => restoreState.source.push(poll));
    };
    const temporarilyLimitPollResultsToBattlegrounds = () => {
        restorePollBattlegroundResults();
        const source = getIndependentPollResultsData();
        if(!Array.isArray(source) || source.length === 0) return;
        const battlegroundStates = getPollBattlegroundStateCodes();
        if(battlegroundStates.size === 0) return;
        const snapshot = source.slice();
        const filtered = snapshot.filter(poll =>
            battlegroundStates.has(String(poll?.stateID || "").toUpperCase())
        );
        pollBattlegroundResultsRestoreState = { source, snapshot };
        source.length = 0;
        filtered.forEach(poll => source.push(poll));
        pollBattlegroundResultsRestoreTimer = setTimeout(restorePollBattlegroundResults, 0);
    };
    const handlePollBattlegroundFilterChange = event => {
        const filters = getIndependentPollFilterSelects();
        if(!filters || !Object.values(filters).includes(event.target)) return;
        if(event.target === filters.state){
            if(filters.state.value === POLL_BATTLEGROUND_FILTER_VALUE) {
                if(pollBattlegroundFilterActive) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    queuePollBattlegroundFilterSync(0);
                    return;
                }
                pollBattlegroundFilterActive = true;
            } else if(pollBattlegroundFilterActive) {
                pollBattlegroundFilterActive = false;
                restorePollBattlegroundResults();
                clearPollBattlegroundRowFiltering();
                return;
            }
        }
        if(!pollBattlegroundFilterActive) return;
        const allOption = Array.from(filters.state.options || []).find(option =>
            String(option.textContent || "").trim() === "All"
        );
        temporarilyLimitPollResultsToBattlegrounds();
        if(allOption) filters.state.value = allOption.value;
        queuePollBattlegroundFilterSync(30);
    };
    const installPollBattlegroundFilter = () => {
        if(!pollBattlegroundFilterInstalled){
            document.addEventListener("change", handlePollBattlegroundFilterChange, true);
            window.addEventListener("change", restorePollBattlegroundResults, false);
            pollBattlegroundFilterInstalled = true;
        }
        queuePollBattlegroundFilterSync(0);
    };
    const isPollAverageCanvasElement = (canvas) => {
        if(!canvas || canvas.tagName?.toLowerCase() !== "canvas") return false;
        const id = String(canvas.id || "");
        return id === "pollDetailCanvas"
            || id === "pollDetailCanvas2"
            || canvas.classList?.contains("pollDetailCanvas")
            || Boolean(canvas.closest?.("#pollDetailDiv, #pollDetailCanvDiv"));
    };
    const recordPollAverageCanvasPoint = (context, x, y, radius) => {
        const canvas = context?.canvas;
        if(!isPollAverageCanvasElement(canvas)) return;
        const width = canvas.width || canvas.getBoundingClientRect?.().width || 0;
        const height = canvas.height || canvas.getBoundingClientRect?.().height || 0;
        if(!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || width <= 0 || height <= 0) return;
        if(radius < 2 || radius > 9) return;
        if(x < width * 0.035 || x > width * 0.975 || y < height * 0.045 || y > height * 0.90) return;
        let record = pollAverageCanvasPointLog.get(canvas);
        if(!record || record.width !== canvas.width || record.height !== canvas.height){
            record = { width: canvas.width, height: canvas.height, points: [] };
            pollAverageCanvasPointLog.set(canvas, record);
        }
        record.points.push({ x, y, radius });
        if(record.points.length > 1600) record.points.splice(0, record.points.length - 1600);
    };
    const installPollAverageCanvasRecorder = () => {
        if(pollAverageCanvasRecorderInstalled || typeof CanvasRenderingContext2D === "undefined") return;
        pollAverageCanvasRecorderInstalled = true;
        const proto = CanvasRenderingContext2D.prototype;
        const originalArc = proto.arc;
        const originalClearRect = proto.clearRect;
        if(typeof originalArc === "function"){
            proto.arc = function(x, y, radius, ...args) {
                recordPollAverageCanvasPoint(this, x, y, radius);
                return originalArc.call(this, x, y, radius, ...args);
            };
        }
        if(typeof originalClearRect === "function"){
            proto.clearRect = function(x, y, width, height) {
                const canvas = this?.canvas;
                if(isPollAverageCanvasElement(canvas)
                    && width >= (canvas.width || 0) * 0.75
                    && height >= (canvas.height || 0) * 0.75){
                    pollAverageCanvasPointLog.delete(canvas);
                }
                return originalClearRect.call(this, x, y, width, height);
            };
        }
    };
    const normalizePollElectionType = (text) => {
        const value = String(text || "").toLowerCase();
        if(value.includes("president")) return "president";
        if(value.includes("senate")) return "usSenate";
        if(value.includes("governor") || value.includes("gubernatorial")) return "governor";
        return null;
    };
    const normalizePollCategory = (text) => {
        const value = String(text || "").toLowerCase();
        if(value.includes("general")) return "general";
        if(value.includes("primary")) return "primary";
        return null;
    };
    const normalizePollPrimaryParty = (text) => {
        const value = String(text || "").toLowerCase();
        if(value.includes("dem")) return "D";
        if(value.includes("rep")) return "R";
        return "";
    };
    const getSelectedPollOptionText = (select) => {
        if(!select) return "";
        const option = select.options?.[select.selectedIndex];
        return String(option?.textContent || select.value || "").trim();
    };
    const getPollResultsModalFilters = () => {
        const visibleTextNodes = Array.from(document.querySelectorAll("h1, h2, h3, div, p"))
            .filter(isElementVisible)
            .map(element => String(element.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const titleText = visibleTextNodes.find(text =>
            /(?:Presidential|President|U\.?S\.?\s*Senate|Senate|Gubernatorial|Governor)\s+(?:Election|Primary\s*\(\s*(?:Democrat(?:ic)?|Republican)\s*\))\s*-\s*[A-Z]{2}/i.test(text)
        );
        if(!titleText) return null;
        const primaryMatch = titleText.match(
            /(Presidential|President|U\.?S\.?\s*Senate|Senate|Gubernatorial|Governor)\s+Primary\s*\(\s*(Democrat(?:ic)?|Republican)\s*\)\s*-\s*([A-Z]{2})/i
        );
        const generalMatch = titleText.match(
            /(Presidential|President|U\.?S\.?\s*Senate|Senate|Gubernatorial|Governor)\s+Election\s*-\s*([A-Z]{2})/i
        );
        const raceMatch = primaryMatch || generalMatch;
        if(!raceMatch) return null;
        const electionType = normalizePollElectionType(raceMatch[1]);
        const category = primaryMatch ? "primary" : "general";
        const party = primaryMatch ? normalizePollPrimaryParty(primaryMatch[2]) : "";
        const stateID = String(
            primaryMatch ? primaryMatch[3] : generalMatch[2]
        ).toUpperCase();
        const weekTexts = visibleTextNodes.filter(text => /Week\s+\d+,\s+\d{4}/i.test(text));
        const parsedWeeks = weekTexts
            .map(parsePollWeekHeading)
            .filter(weekData => weekData && Number.isFinite(weekData.week));
        const latestWeek = parsedWeeks
            .slice()
            .sort((a, b) => {
                const yearDiff = (Number(b.year) || 0) - (Number(a.year) || 0);
                return yearDiff !== 0 ? yearDiff : (Number(b.week) || 0) - (Number(a.week) || 0);
            })[0];
        const titleYearMatch = titleText.match(/\b(19|20|21)\d{2}\b/);
        return {
            electionType,
            stateID,
            category,
            party,
            currentWeek: latestWeek?.week ?? null,
            year: latestWeek?.year ?? (titleYearMatch ? Number(titleYearMatch[0]) : null)
        };
    };
    const getPollPageFilters = () => {
        const visibleSelects = Array.from(document.querySelectorAll("select")).filter(isElementVisible);
        if(visibleSelects.length < 3) return getPollResultsModalFilters();
        const electionText = getSelectedPollOptionText(visibleSelects[0]);
        const stateText = getSelectedPollOptionText(visibleSelects[1]);
        const categoryText = getSelectedPollOptionText(visibleSelects[2]);
        const partyText = getSelectedPollOptionText(visibleSelects[3]);
        const electionType = normalizePollElectionType(electionText);
        const category = normalizePollCategory(categoryText);
        const party = category === "primary" ? normalizePollPrimaryParty(partyText) : "";
        const stateID = stateNameToCode[stateText] || stateText.toUpperCase();
        if(!electionType || !category || !stateID || stateText === "All") return null;
        const pageText = String(document.body?.innerText || "");
        const weekHeader = Array.from(document.querySelectorAll("h1, h2, h3"))
            .map(element => String(element.textContent || ""))
            .find(text => /Week\s+\d+,\s+\d{4}/i.test(text));
        const weekMatch = String(weekHeader || pageText).match(/Week\s+(\d+),\s+(\d{4})/i);
        const currentWeek = weekMatch ? Number(weekMatch[1]) : null;
        const year = weekMatch ? Number(weekMatch[2]) : null;
        return { electionType, stateID, category, party, currentWeek, year };
    };
    const getPollCandidateKey = (candidate) => {
        const candidateName = String(
            candidate?.fullName
            || candidate?.name
            || [candidate?.first, candidate?.last].filter(Boolean).join(" ")
            || candidate?.last
            || candidate?.first
            || ""
        )
            .replace(/\*/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        if(candidateName) return `${candidateName}|${getPollPartyCode(candidate) || "I"}`;
        if(candidate?.id !== undefined && candidate?.id !== null) return `id:${candidate.id}`;
        return `unknown|${getPollPartyCode(candidate) || "I"}`;
    };
    const getPollCandidateId = (candidate) => {
        const id = Number(candidate?.id);
        return Number.isFinite(id) ? id : null;
    };
    const getPollCandidateName = (candidate) => {
        return String(candidate?.last || candidate?.first || "Candidate").trim();
    };
    const parsePollPartyCode = value => {
        const party = String(value || "").toLowerCase();
        if(party.includes("ind")) return "I";
        if(party.includes("dem")) return "D";
        if(party.includes("rep")) return "R";
        return "";
    };
    const getPollPartyCode = (candidate) => {
        const candidateId = getPollCandidateId(candidate);
        if(candidateId !== null && typeof globalThis.findCandByID === "function"){
            try {
                const rawCandidate = globalThis.findCandByID([candidateId])?.[0];
                if(rawCandidate){
                    const wrapped = Executive?.data?.characters?.wrapCharacter?.(rawCandidate, "candidate");
                    const profileParty = wrapped?.extendedAttribs?.party
                        || wrapped?.party
                        || rawCandidate?.party;
                    const profileCode = parsePollPartyCode(profileParty);
                    if(profileCode) return profileCode;
                }
            } catch(_err) {}
        }
        return parsePollPartyCode(candidate?.party || candidate?.caucus);
    };
    const getElectionCandidateId = (candidate) => {
        const id = Number(candidate?.id ?? candidate?.candID ?? candidate?.candidateId);
        return Number.isFinite(id) ? id : null;
    };
    const normalizePollCandidateName = (name) => {
        return String(name || "")
            .replace(/\*/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    };
    const getElectionCandidateLastName = (candidate) => {
        const rawName = candidate?.last
            || candidate?.lastName
            || candidate?.name
            || candidate?.fullName
            || "";
        const parts = normalizePollCandidateName(rawName).split(" ").filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "";
    };
    const getCharacterLastName = (character) => {
        if(Array.isArray(character)){
            const candidateEnum = Executive?.enums?.characterArray?.candidate || {};
            const indexes = [
                candidateEnum.last,
                candidateEnum.lastName,
                candidateEnum.lName,
                5
            ];
            for(const index of indexes){
                const value = Number(index);
                if(Number.isInteger(value) && character[value]) return getElectionCandidateLastName({ name: character[value] });
            }
            return "";
        }
        return getElectionCandidateLastName(character);
    };
    const getCharacterPartyCode = (character) => {
        if(Array.isArray(character)){
            const partyValue = character.find(value => {
                const text = String(value || "").toLowerCase();
                return text === "democrat" || text === "republican" || text === "independent";
            });
            return getPollPartyCode({ party: partyValue });
        }
        return getPollPartyCode({
            party: character?.party || character?.caucusParty || character?.caucus
        });
    };
    const getStateIdFromValue = (value) => {
        const stateID = String(value || "").trim();
        if(stateID.length !== 2) return "";
        const state = Executive?.data?.states?.[stateID.toLowerCase()];
        return state ? stateID.toUpperCase() : "";
    };
    const getCharacterCandidateId = (character) => {
        const idIndex = Executive?.enums?.characterArray?.candidate?.candidateId ?? 111;
        const id = Number(Array.isArray(character) ? character[idIndex] : character?.candidateId);
        return Number.isFinite(id) ? id : null;
    };
    const getCharacterStateId = (character) => {
        const stateIndex = Executive?.enums?.characterArray?.candidate?.stateId ?? 127;
        if(Array.isArray(character)){
            const directState = getStateIdFromValue(character[stateIndex]);
            if(directState) return directState;
            const discoveredState = character.find(value => getStateIdFromValue(value));
            return getStateIdFromValue(discoveredState);
        }
        return String(character?.stateId || character?.state || character?.abbr || character?.stateCode || "").toUpperCase();
    };
    const candidateMatchesPollCandidate = (electionCandidate, pollCandidate) => {
        if(!electionCandidate || !pollCandidate) return false;
        const pollCandidateId = getPollCandidateId(pollCandidate);
        const electionCandidateId = getElectionCandidateId(electionCandidate);
        if(pollCandidateId !== null && electionCandidateId !== null && pollCandidateId === electionCandidateId) return true;
        const pollName = normalizePollCandidateName(getPollCandidateName(pollCandidate));
        const electionName = getElectionCandidateLastName(electionCandidate);
        if(!pollName || !electionName || pollName !== electionName) return false;
        const pollParty = getPollPartyCode(pollCandidate);
        const electionParty = getPollPartyCode(electionCandidate);
        return !pollParty || !electionParty || pollParty === electionParty;
    };
    const addPollRaceCandidateLists = (race, lists) => {
        if(!race || typeof race !== "object") return;
        if(Array.isArray(race.cands)) lists.push(race.cands);
        if(Array.isArray(race.allCands?.cands)) lists.push(race.allCands.cands);
        if(Array.isArray(race.dem?.cands)) lists.push(race.dem.cands);
        if(Array.isArray(race.rep?.cands)) lists.push(race.rep.cands);
        if(Array.isArray(race.districts)) race.districts.forEach(district => addPollRaceCandidateLists(district, lists));
    };
    const getPollRaceCandidateLists = (poll) => {
        const lists = [];
        const stateID = String(poll?.stateID || "").toUpperCase();
        try {
            const proxy = resultProxies?.[poll?.electType];
            if(proxy && stateID) addPollRaceCandidateLists(proxy[stateID], lists);
        } catch(_err) {}
        try {
            const stateRace = Array.isArray(globalThis.allStElectData)
                ? globalThis.allStElectData.find(electData => String(electData?.id || electData?.state || "").toUpperCase() === stateID)
                : null;
            addPollRaceCandidateLists(stateRace, lists);
        } catch(_err) {}
        return lists;
    };
    const isPollCandidateRaceIncumbent = (candidate, poll) => {
        const candidateLists = getPollRaceCandidateLists(poll);
        return candidateLists.some(list => {
            return list.some(electionCandidate => {
                return electionCandidate?.incumbent === true
                    && candidateMatchesPollCandidate(electionCandidate, candidate);
            });
        });
    };
    const isMatchingOfficeHolder = (character, candidate, stateID = null) => {
        if(!character || !candidate) return false;
        const characterStateID = getCharacterStateId(character);
        if(stateID && characterStateID && characterStateID !== String(stateID).toUpperCase()) return false;
        const pollCandidateId = getPollCandidateId(candidate);
        const characterCandidateId = getCharacterCandidateId(character);
        if(pollCandidateId !== null && characterCandidateId !== null && pollCandidateId === characterCandidateId) return true;
        const pollName = normalizePollCandidateName(getPollCandidateName(candidate));
        const characterName = getCharacterLastName(character);
        if(!pollName || !characterName || pollName !== characterName) return false;
        const pollParty = getPollPartyCode(candidate);
        const characterParty = getCharacterPartyCode(character);
        return !pollParty || !characterParty || pollParty === characterParty;
    };
    const isPollCandidateIncumbent = (candidate, poll) => {
        if(candidate?.incumbent === true) return true;
        if(!candidate || !poll) return false;
        if(isPollCandidateRaceIncumbent(candidate, poll)) return true;
        const stateID = String(poll.stateID || "").toUpperCase();
        try {
            if(poll.electType === "president"){
                return isMatchingOfficeHolder(globalThis.usPresident, candidate);
            }
            if(poll.electType === "governor"){
                return Array.isArray(globalThis.allGovernors)
                    && globalThis.allGovernors.some(governor => isMatchingOfficeHolder(governor, candidate, stateID));
            }
            if(poll.electType === "usSenate"){
                return Array.isArray(globalThis.usSenate)
                    && globalThis.usSenate.some(senator => isMatchingOfficeHolder(senator, candidate, stateID));
            }
        } catch(_err) {}
        return false;
    };
    const getDisplayedPollPct = (pct) => roundPollDisplayValue(pct) ?? 0;
    const pollRatingColours = {
        TOSS_UP: "#F6D66F",
        D: {
            solid: "#08527E",
            likely: "#287EAE",
            lean: "#58ABD2",
            tilt: "#B7E1F3"
        },
        R: {
            solid: "#A71C1C",
            likely: "#D63333",
            lean: "#E27373",
            tilt: "#F2C4C4"
        },
        I: {
            solid: "#666666",
            likely: "#888888",
            lean: "#AAAAAA",
            tilt: "#BBBBBB"
        }
    };
    const pollPartyColours = {
        D: "#0487E6",
        R: "#DD2929",
        I: "#777777"
    };
    const pollLeaderBaseColours = {
        D: pollPartyColours.D,
        R: pollPartyColours.R,
        I: "#000000"
    };
    const escapePollHTML = (value) => {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[char]));
    };
    const getPollContrastText = (hexColour) => {
        const hex = String(hexColour || "").replace("#", "");
        if(hex.length !== 6) return "#111111";
        const red = parseInt(hex.substring(0, 2), 16);
        const green = parseInt(hex.substring(2, 4), 16);
        const blue = parseInt(hex.substring(4, 6), 16);
        const luminance = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
        return luminance > 150 ? "#111111" : "#FFFFFF";
    };
    const getPollRating = (party, margin) => {
        const marginValue = Math.abs(Number(margin) || 0);
        const partyKey = (party === "D" || party === "R" || party === "I") ? party : "I";
        if(marginValue < 1){
            return {
                label: "Tossup",
                colour: pollRatingColours.TOSS_UP,
                textColour: "#111111"
            };
        }
        let ratingKey = "solid";
        if(marginValue < 3) ratingKey = "tilt";
        else if(marginValue < 7) ratingKey = "lean";
        else if(marginValue < 15) ratingKey = "likely";
        const labelPrefix = ratingKey.charAt(0).toUpperCase() + ratingKey.slice(1);
        const colour = pollRatingColours[partyKey]?.[ratingKey] || pollRatingColours.I[ratingKey];
        return {
            label: `${labelPrefix} ${partyKey}`,
            colour,
            textColour: getPollContrastText(colour)
        };
    };
    const installPollAverageTooltipStyles = () => {
        if(document.getElementById("bm-poll-average-tooltip-styles")) return;
        const style = document.createElement("style");
        style.id = "bm-poll-average-tooltip-styles";
        style.textContent = `
            #bm-poll-average-tooltip .bm-poll-card {
                min-width: 280px;
                max-width: 360px;
                padding: 15px 17px 13px;
                border: 1px solid rgba(0,0,0,0.13);
                border-radius: 18px;
                background: rgba(255,255,255,0.98);
                box-shadow: 0 8px 22px rgba(0,0,0,0.25);
                color: #111111;
                font-family: Arial, Helvetica, sans-serif;
            }
            #bm-poll-average-tooltip .bm-poll-title {
                margin-bottom: 10px;
                font-size: 18px;
                line-height: 1;
                font-weight: 900;
                letter-spacing: 0.03em;
                text-transform: uppercase;
            }
            #bm-poll-average-tooltip .bm-poll-rating {
                display: inline-block;
                margin-bottom: 14px;
                padding: 5px 12px 6px;
                border-radius: 8px;
                box-shadow: inset 0 -2px rgba(0,0,0,0.16);
                font-size: 18px;
                line-height: 1;
                font-weight: 900;
            }
            #bm-poll-average-tooltip .bm-poll-header,
            #bm-poll-average-tooltip .bm-poll-row,
            #bm-poll-average-tooltip .bm-poll-margin {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                column-gap: 18px;
                align-items: center;
            }
            #bm-poll-average-tooltip .bm-poll-header {
                padding-bottom: 8px;
                border-bottom: 3px solid #dedede;
                color: #858585;
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 0.05em;
                text-transform: uppercase;
            }
            #bm-poll-average-tooltip .bm-poll-row {
                min-height: 36px;
                padding: 8px 0;
                border-bottom: 1px solid #e7e7e7;
            }
            #bm-poll-average-tooltip .bm-poll-name {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 18px;
                font-weight: 900;
            }
            #bm-poll-average-tooltip .bm-party-pill {
                display: inline-block;
                min-width: 18px;
                margin-left: 6px;
                padding: 2px 5px 3px;
                border-radius: 6px;
                color: #ffffff;
                text-align: center;
                font-size: 13px;
                line-height: 1;
                font-weight: 900;
                vertical-align: middle;
            }
            #bm-poll-average-tooltip .bm-poll-pct {
                font-size: 20px;
                line-height: 1;
                font-weight: 900;
                white-space: nowrap;
            }
            #bm-poll-average-tooltip .bm-poll-undecided-row .bm-poll-name,
            #bm-poll-average-tooltip .bm-poll-undecided-row .bm-poll-pct {
                color: #777777;
            }
            #bm-poll-average-tooltip .bm-poll-margin {
                padding-top: 11px;
            }
            #bm-poll-average-tooltip .bm-margin-label {
                color: #8a8a8a;
                font-size: 18px;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }
            #bm-poll-average-tooltip .bm-margin-value {
                font-size: 20px;
                line-height: 1;
                font-weight: 900;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    };
    const parsePollWeekHeading = (text) => {
        const match = String(text || "").match(/Week\s+(\d+),\s+(\d{4})/i);
        return match ? { week: Number(match[1]), year: Number(match[2]) } : null;
    };
    const getPollTableWeek = (table) => {
        const tableRect = table.getBoundingClientRect();
        const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
            .map(element => ({ element, ...parsePollWeekHeading(element.textContent) }))
            .filter(heading => Number.isFinite(heading.week) && isElementVisible(heading.element))
            .map(heading => ({ ...heading, rect: heading.element.getBoundingClientRect() }))
            .filter(heading => heading.rect.top <= tableRect.top + 1)
            .sort((a, b) => b.rect.top - a.rect.top);
        return headings[0] || null;
    };
    const parsePollAverageResultsText = (text) => {
        return String(text || "").split(",")
            .map(part => part.match(/^\s*([^:]+):\s*(\d+(?:\.\d+)?)%/))
            .filter(Boolean)
            .map(match => ({
                name: match[1].trim(),
                pct: Number(match[2]),
                pctText: `${match[2]}%`
            }));
    };
    const getVisiblePollAverageForWeek = (week, year = null) => {
        const pollTables = Array.from(document.querySelectorAll("table.indPollTitleTbl, table.indPollTitleTbl2"));
        for(const table of pollTables){
            const tableWeek = getPollTableWeek(table);
            if(!tableWeek || tableWeek.week !== week) continue;
            if(Number.isFinite(year) && tableWeek.year !== year) continue;
            const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
            const headers = headerCells.map(cell => String(cell.textContent || "").trim());
            const electionIndex = headers.findIndex(header => header === "Election");
            const resultsIndex = headers.findIndex(header => header === "Results");
            const leaderIndex = headers.findIndex(header => header === "Leader");
            if(electionIndex === -1 || resultsIndex === -1) continue;
            const dataRows = Array.from(table.rows).slice(1);
            let averageRow = dataRows.find(row => {
                return String(row.cells[electionIndex]?.textContent || "").trim().toUpperCase() === "AVERAGE";
            });
            if(!averageRow && dataRows.length === 1) averageRow = dataRows[0];
            if(!averageRow) continue;
            const results = parsePollAverageResultsText(averageRow.cells[resultsIndex]?.textContent);
            if(results.length === 0) continue;
            return {
                results,
                leaderText: leaderIndex !== -1 ? String(averageRow.cells[leaderIndex]?.textContent || "").trim() : ""
            };
        }
        return null;
    };
    const isIndependentPollResultsArray = (value) => {
        return Array.isArray(value) && value.some(poll => {
            return poll && typeof poll === "object"
                && typeof poll.electType === "string"
                && typeof poll.stateID === "string"
                && typeof poll.category === "string"
                && Array.isArray(poll.results);
        });
    };
    const getIndependentPollResultsData = () => {
        if(typeof indPollResults !== "undefined" && isIndependentPollResultsArray(indPollResults)) return indPollResults;
        if(isIndependentPollResultsArray(globalThis?.indPollResults)) return globalThis.indPollResults;
        if(typeof Executive !== "undefined" && isIndependentPollResultsArray(Executive?.data?.indPollResults)) return Executive.data.indPollResults;
        if(isIndependentPollResultsArray(independentPollResultsCache)) return independentPollResultsCache;
        const now = Date.now();
        if(now - lastIndependentPollScan < 1000) return [];
        lastIndependentPollScan = now;
        const symbolNames = Array.isArray(Executive?.symbols?.vars) ? Executive.symbols.vars : Object.keys(globalThis);
        for(const symbolName of symbolNames){
            try {
                const value = globalThis[symbolName];
                if(isIndependentPollResultsArray(value)){
                    independentPollResultsCache = value;
                    return value;
                }
            } catch(_err) {}
        }
        return [];
    };
    const getPollWeeklyAverages = (filtersOverride = null) => {
        const filters = filtersOverride || getPollPageFilters();
        if(!filters) return [];
        const pollResults = getIndependentPollResultsData();
        if(pollResults.length === 0) return [];
        const cacheKey = [
            filters.electionType,
            filters.stateID,
            filters.category,
            filters.party || "",
            Number.isFinite(filters.currentWeek) ? filters.currentWeek : "",
            Number.isFinite(filters.year) ? filters.year : ""
        ].join("|");
        const now = Date.now();
        if(pollWeeklyAveragesCache
            && pollWeeklyAveragesCache.source === pollResults
            && pollWeeklyAveragesCache.sourceLength === pollResults.length
            && pollWeeklyAveragesCache.key === cacheKey
            && now - pollWeeklyAveragesCache.createdAt < 5000){
            return pollWeeklyAveragesCache.value;
        }
        let polls = pollResults.filter(poll => {
            return poll?.electType === filters.electionType
                && poll?.stateID === filters.stateID
                && poll?.category === filters.category
                && (filters.category !== "primary"
                    || !filters.party
                    || getPollPartyCode(poll) === filters.party);
        });
        if(filters.category === "general" && filters.electionType !== "president"){
            polls = polls.filter(poll => Number(poll.week) !== 19);
        }
        const isPresidentialPrimary = filters.electionType === "president"
            && filters.category === "primary";
        if(Number.isFinite(filters.year)){
            const cyclePolls = polls.filter(poll => {
                const pollYear = Number(poll.year);
                return pollYear === filters.year
                    || (isPresidentialPrimary && pollYear === filters.year - 1);
            });
            if(cyclePolls.length > 0) polls = cyclePolls;
        }
        if(Number.isFinite(filters.currentWeek)){
            const currentPolls = polls.filter(poll => {
                const pollYear = Number(poll.year);
                if(!Number.isFinite(filters.year) || !Number.isFinite(pollYear)) {
                    return Number(poll.week) <= filters.currentWeek;
                }
                return pollYear < filters.year
                    || (pollYear === filters.year && Number(poll.week) <= filters.currentWeek);
            });
            if(currentPolls.length > 0) polls = currentPolls;
        }
        if(polls.length === 0) return [];
        const weekly = new Map();
        polls.forEach(poll => {
            const week = Number(poll.week);
            const year = Number(poll.year);
            const sample = getValidPollSample(poll);
            if(sample === null) return;
            if(!Number.isFinite(week) || !Array.isArray(poll.results) || poll.results.length === 0) return;
            const candidateVotes = poll.results.reduce((sum, candidate) => sum + (Number(candidate.votes) || 0), 0);
            const totalVotes = candidateVotes + (Number(poll.undecided) || 0);
            if(totalVotes <= 0) return;
            const weekKey = `${Number.isFinite(year) ? year : ""}|${week}`;
            if(!weekly.has(weekKey)) weekly.set(weekKey, { week, year, candidates: new Map() });
            const weekData = weekly.get(weekKey);
            poll.results.forEach(candidate => {
                const key = getPollCandidateKey(candidate);
                if(!weekData.candidates.has(key)){
                    weekData.candidates.set(key, {
                        name: getPollCandidateName(candidate),
                        party: getPollPartyCode(candidate)
                            || (filters.category === "primary" ? filters.party : ""),
                        incumbent: false,
                        weightedPctTotal: 0,
                        sampleTotal: 0,
                        totalPct: 0,
                        polls: 0
                    });
                }
                const candidateData = weekData.candidates.get(key);
                if(isPollCandidateIncumbent(candidate, poll)) candidateData.incumbent = true;
                const candidatePct = ((Number(candidate.votes) || 0) / totalVotes) * 100;
                candidateData.weightedPctTotal += candidatePct * sample;
                candidateData.sampleTotal += sample;
                candidateData.totalPct += candidatePct;
                candidateData.polls++;
            });
        });
        const weeksWithPolls = Array.from(weekly.values())
            .sort((a, b) => {
                const yearDiff = (Number(a.year) || 0) - (Number(b.year) || 0);
                return yearDiff !== 0 ? yearDiff : a.week - b.week;
            })
            .map(weekData => {
                const candidates = Array.from(weekData.candidates.values())
                    .filter(candidate => candidate.sampleTotal > 0)
                    .map(candidate => {
                        const pct = candidate.weightedPctTotal / candidate.sampleTotal;
                        return {
                            name: candidate.name,
                            party: candidate.party,
                            incumbent: candidate.incumbent,
                            pct,
                            simplePct: candidate.polls > 0 ? candidate.totalPct / candidate.polls : pct,
                            displayPct: getDisplayedPollPct(pct)
                        };
                    })
                    .sort((a, b) => b.pct - a.pct);
                return { week: weekData.week, year: weekData.year, candidates };
            })
            .filter(weekData => weekData.candidates.length > 0);
        pollWeeklyAveragesCache = {
            source: pollResults,
            sourceLength: pollResults.length,
            key: cacheKey,
            createdAt: Date.now(),
            value: weeksWithPolls
        };
        return weeksWithPolls;
    };
    const getPollLeaderData = (candidates) => {
        const sortedCandidates = (candidates || []).slice().sort((a, b) => {
            const pctDifference = Number(b?.pct) - Number(a?.pct);
            if(Number.isFinite(pctDifference) && pctDifference !== 0) return pctDifference;
            return String(a?.name || "").localeCompare(String(b?.name || ""));
        });
        const first = sortedCandidates[0];
        const second = sortedCandidates[1];
        if(!first || !second) return { leader: first || null, margin: 0, text: "Tie" };
        const firstDisplayPct = roundPollDisplayValue(first.pct);
        const secondDisplayPct = roundPollDisplayValue(second.pct);
        const margin = Number(firstDisplayPct) - Number(secondDisplayPct);
        if(!Number.isFinite(margin) || margin <= 0){
            return { leader: null, margin: 0, text: "Tie" };
        }
        return {
            leader: first,
            margin,
            text: `${first.name} ${formatPollLeaderMarginValue(margin)}`
        };
    };
    const getNativePollLeaderColour = (table, leaderIndex, electionIndex, weekData, leader) => {
        const party = leader?.party || "";
        if(party !== "D" && party !== "R") return pollLeaderBaseColours.I;
        const individualRows = Array.from(table.rows).slice(1).filter(row =>
            electionIndex === -1
            || String(row.cells[electionIndex]?.textContent || "").trim().toUpperCase() !== "AVERAGE"
        );
        for(const row of individualRows){
            const sourceCell = row.cells[leaderIndex];
            if(!sourceCell) continue;
            const leaderMatch = String(sourceCell.textContent || "").trim().match(/^(.+?)\s+[+-]\s*\d/);
            if(!leaderMatch) continue;
            const sourceLeader = findPollWeekCandidate(weekData, leaderMatch[1]);
            if(sourceLeader?.party !== party) continue;
            const colourSource = sourceCell.querySelector("[style*='color']") || sourceCell;
            const computedColour = window.getComputedStyle(colourSource).color;
            if(computedColour && computedColour !== "rgb(0, 0, 0)") return computedColour;
        }
        return pollLeaderBaseColours[party];
    };
    const updateWeightedPollAverageRows = () => {
        const weeklyAverages = getPollWeeklyAverages();
        if(weeklyAverages.length === 0) return;
        const averagesByWeek = new Map(weeklyAverages.map(weekData => [
            `${Number.isFinite(Number(weekData.year)) ? Number(weekData.year) : ""}|${weekData.week}`,
            weekData
        ]));
        document.querySelectorAll("table.indPollTitleTbl, table.indPollTitleTbl2").forEach(table => {
            const tableWeek = getPollTableWeek(table);
            if(!tableWeek) return;
            const weekData = averagesByWeek.get(`${Number.isFinite(Number(tableWeek.year)) ? Number(tableWeek.year) : ""}|${tableWeek.week}`);
            if(!weekData) return;
            const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
            const headers = headerCells.map(cell => String(cell.textContent || "").trim());
            const electionIndex = headers.findIndex(header => header === "Election");
            const resultsIndex = headers.findIndex(header => header === "Results");
            const leaderIndex = headers.findIndex(header => header === "Leader");
            if(electionIndex === -1 || resultsIndex === -1) return;
            const averageRow = Array.from(table.rows).slice(1).find(row =>
                String(row.cells[electionIndex]?.textContent || "").trim().toUpperCase() === "AVERAGE"
            );
            if(!averageRow) return;
            const resultsText = weekData.candidates
                .map(candidate => `${candidate.name}: ${formatPollAveragePercentageValue(candidate.pct)}`)
                .join(", ");
            const resultsCell = averageRow.cells[resultsIndex];
            if(resultsCell && resultsCell.textContent !== resultsText) resultsCell.textContent = resultsText;
            if(leaderIndex === -1 || !averageRow.cells[leaderIndex]) return;
            const leaderData = getPollLeaderData(weekData.candidates);
            const leaderCell = averageRow.cells[leaderIndex];
            if(leaderCell.textContent !== leaderData.text) leaderCell.textContent = leaderData.text;
            leaderCell.dataset.bmPollRawLeader = leaderData.text;
            leaderCell.dataset.bmPollFormattedLeader = leaderData.text;
            leaderCell.style.color = leaderData.leader
                ? getNativePollLeaderColour(table, leaderIndex, electionIndex, weekData, leaderData.leader)
                : pollLeaderBaseColours.I;
        });
    };
    const ensurePollAverageTooltip = () => {
        installPollAverageTooltipStyles();
        if(pollAverageTooltip) return pollAverageTooltip;
        pollAverageTooltip = document.createElement("div");
        pollAverageTooltip.id = "bm-poll-average-tooltip";
        pollAverageTooltip.style.position = "fixed";
        pollAverageTooltip.style.display = "none";
        pollAverageTooltip.style.pointerEvents = "none";
        pollAverageTooltip.style.zIndex = "99999";
        pollAverageTooltip.style.background = "transparent";
        pollAverageTooltip.style.border = "0";
        pollAverageTooltip.style.boxShadow = "none";
        pollAverageTooltip.style.padding = "0";
        pollAverageTooltip.style.fontFamily = "Arial, Helvetica, sans-serif";
        pollAverageTooltip.style.fontSize = "16px";
        pollAverageTooltip.style.lineHeight = "1.2";
        pollAverageTooltip.style.whiteSpace = "nowrap";
        document.body.appendChild(pollAverageTooltip);
        return pollAverageTooltip;
    };
    const findPollWeekCandidate = (weekData, name) => {
        const candidateName = String(name || "").trim().toLowerCase();
        return weekData.candidates.find(candidate => String(candidate.name || "").trim().toLowerCase() === candidateName);
    };
    const formatPollLeaderMarginValue = (value) => {
        const number = Number(String(value || "").replace(/\s+/g, ""));
        if(!Number.isFinite(number)) return String(value || "").replace(/\s+/g, "");
        return `${number < 0 ? "-" : "+"}${formatPollDisplayValue(Math.abs(number))}`;
    };
    const isRoundedPollMarginTie = (value) => {
        const number = Number(String(value || "").replace(/\s+/g, ""));
        return Number.isFinite(number) && Math.abs(number) <= Number.EPSILON;
    };
    const renderPollAverageTooltipCard = (week, year, candidates, marginParty, marginValue, leaderText, options = {}) => {
        const rating = getPollRating(marginParty, marginValue);
        const marginColour = pollLeaderBaseColours[marginParty] || pollLeaderBaseColours.I;
        const weekLabel = Number.isFinite(Number(year)) ? `${week}, ${year}` : week;
        const sortedCandidates = candidates.slice().sort((a, b) => {
            const pctDiff = (Number(b.pct) || 0) - (Number(a.pct) || 0);
            if(pctDiff !== 0) return pctDiff;
            return String(a.name || "").localeCompare(String(b.name || ""));
        });
        const rowsHTML = sortedCandidates.map(candidate => {
            const party = candidate.party || "";
            const partyColour = pollPartyColours[party] || "#777777";
            const displayName = `${candidate.name}${candidate.incumbent ? "*" : ""}`;
            const partyPill = party
                ? `<span class="bm-party-pill" style="background:${partyColour};">${escapePollHTML(party)}</span>`
                : "";
            return `
                <div class="bm-poll-row">
                    <div class="bm-poll-name">${escapePollHTML(displayName)}${partyPill}</div>
                    <div class="bm-poll-pct" style="color:${partyColour};">${escapePollHTML(candidate.pctText)}</div>
                </div>
            `;
        }).join("");
        const displayedTotal = sortedCandidates.reduce(
            (total, candidate) => total + Math.max(0, Number(candidate.pct) || 0),
            0
        );
        const undecidedPct = Math.max(0, roundPollDisplayValue(100 - displayedTotal) ?? 0);
        const undecidedText = formatPollAveragePercentageValue(undecidedPct);
        const undecidedRowHTML = undecidedPct > 0 ? `
            <div class="bm-poll-row bm-poll-undecided-row">
                <div class="bm-poll-name">Undecided</div>
                <div class="bm-poll-pct">${undecidedText}</div>
            </div>
        ` : "";
        return `
            <div class="bm-poll-card">
                <div class="bm-poll-title">AVERAGE - WEEK ${escapePollHTML(weekLabel)}</div>
                ${options.primary ? "" : `<div class="bm-poll-rating" style="background:${rating.colour}; color:${rating.textColour};">${escapePollHTML(rating.label)}</div>`}
                <div class="bm-poll-header">
                    <span>Candidate</span>
                    <span>Est. Share</span>
                </div>
                ${rowsHTML}
                ${undecidedRowHTML}
                <div class="bm-poll-margin">
                    <span class="bm-margin-label">Leader:</span>
                    <span class="bm-margin-value" style="color:${marginColour};">${escapePollHTML(leaderText)}</span>
                </div>
            </div>
        `;
    };
    const formatPollAverageTooltipHTML = (weekData, filtersOverride = null) => {
        const activeFilters = filtersOverride || getPollPageFilters();
        const isPrimary = activeFilters?.category === "primary";
        const visibleAverage = filtersOverride ? null : getVisiblePollAverageForWeek(weekData.week, weekData.year);
        const visibleAverageMatchesSeries = visibleAverage?.results?.some(candidate => {
            return Boolean(findPollWeekCandidate(weekData, candidate.name));
        });
        if(visibleAverage && visibleAverageMatchesSeries){
            const candidates = visibleAverage.results.map(candidate => {
                const matchingCandidate = findPollWeekCandidate(weekData, candidate.name);
                return {
                    name: candidate.name,
                    party: matchingCandidate?.party || "",
                    incumbent: Boolean(matchingCandidate?.incumbent),
                    pct: Number(matchingCandidate?.pct) || 0,
                    pctText: formatPollAveragePercentageValue(matchingCandidate?.pct)
                };
            });
            const leaderData = getPollLeaderData(weekData.candidates);
            return renderPollAverageTooltipCard(
                weekData.week,
                weekData.year,
                candidates,
                leaderData.leader?.party || "",
                leaderData.margin,
                leaderData.text,
                { primary: isPrimary }
            );
        }
        const topCandidates = weekData.candidates.slice(0, 3);
        const candidates = topCandidates.map(candidate => ({
            name: candidate.name,
            party: candidate.party,
            incumbent: Boolean(candidate.incumbent),
            pct: Math.max(0, Number(candidate.pct) || 0),
            pctText: formatPollAveragePercentageValue(candidate.pct)
        }));
        const leaderData = getPollLeaderData(weekData.candidates);
        return renderPollAverageTooltipCard(
            weekData.week,
            weekData.year,
            candidates,
            leaderData.leader?.party || "",
            leaderData.margin,
            leaderData.text,
            { primary: isPrimary }
        );
    };
    const getMsnbcPollElectionType = (race) => {
        if(race === "senate") return "usSenate";
        if(race === "governor") return "governor";
        return "president";
    };
    const getMsnbcPollFiltersForState = (raceConfig, entry, selectedState) => {
        const stateID = String(selectedState?.code || "").toUpperCase();
        if(!entry?.current || !stateID) return null;
        return {
            electionType: getMsnbcPollElectionType(raceConfig?.race),
            stateID,
            category: "general",
            party: "",
            currentWeek: null,
            year: Number(entry?.year) || getElectionNightPanelYear()
        };
    };
    const getMsnbcPollDataForState = (raceConfig, entry, selectedState) => {
        const filters = getMsnbcPollFiltersForState(raceConfig, entry, selectedState);
        if(!filters) return { filters: null, weeklyAverages: [] };
        return {
            filters,
            weeklyAverages: getPollWeeklyAverages(filters)
        };
    };
    const getPollCandidatePct = (candidate, totalVotes) => {
        const directPct = Number(candidate?.pct ?? candidate?.percent ?? candidate?.share);
        if(Number.isFinite(directPct)) return Math.max(0, Math.min(100, directPct));
        const votes = Number(candidate?.votes) || 0;
        return totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    };
    const getMsnbcPollResultText = (poll) => {
        const candidates = Array.isArray(poll?.results) ? poll.results : [];
        const candidateVotes = candidates.reduce((sum, candidate) => sum + (Number(candidate?.votes) || 0), 0);
        const totalVotes = candidateVotes + (Number(poll?.undecided) || 0);
        return candidates
            .slice()
            .sort((a, b) => getPollCandidatePct(b, totalVotes) - getPollCandidatePct(a, totalVotes))
            .slice(0, 4)
            .map(candidate => {
                const pct = getPollCandidatePct(candidate, totalVotes);
                return `${getPollCandidateName(candidate)}: ${formatPollPercentageValue(pct)}`;
            })
            .join(", ");
    };
    const getMsnbcPollLeader = (poll) => {
        const leaderText = String(poll?.leaderText || "").trim();
        if(leaderText) return formatPollLeaderText(leaderText);
        const candidates = Array.isArray(poll?.results) ? poll.results : [];
        const candidateVotes = candidates.reduce((sum, candidate) => sum + (Number(candidate?.votes) || 0), 0);
        const totalVotes = candidateVotes + (Number(poll?.undecided) || 0);
        const sortedCandidates = candidates
            .slice()
            .sort((a, b) => getPollCandidatePct(b, totalVotes) - getPollCandidatePct(a, totalVotes));
        const first = sortedCandidates[0];
        const second = sortedCandidates[1];
        if(!first || !second) return "";
        const margin = getPollCandidatePct(first, totalVotes) - getPollCandidatePct(second, totalVotes);
        return isRoundedPollMarginTie(margin)
            ? "Tie"
            : `${getPollCandidateName(first)} ${formatPollLeaderMarginValue(margin)}`;
    };
    const getMsnbcPollLeaderParty = (poll) => {
        const candidates = Array.isArray(poll?.results) ? poll.results : [];
        const candidateVotes = candidates.reduce((sum, candidate) => sum + (Number(candidate?.votes) || 0), 0);
        const totalVotes = candidateVotes + (Number(poll?.undecided) || 0);
        const leaderName = String(getMsnbcPollLeader(poll)).replace(/[+-]\s*\d+(?:\.\d+)?\s*$/, "").trim();
        const matchedLeader = candidates.find(candidate =>
            normalizePollCandidateName(getPollCandidateName(candidate)) === normalizePollCandidateName(leaderName)
        );
        if(matchedLeader) return getPollPartyCode(matchedLeader);
        const sortedCandidates = candidates
            .slice()
            .sort((a, b) => getPollCandidatePct(b, totalVotes) - getPollCandidatePct(a, totalVotes));
        return getPollPartyCode(sortedCandidates[0]);
    };
    const getMsnbcPollRows = (filters) => {
        if(!filters) return [];
        return getIndependentPollResultsData()
            .filter(poll => {
                return poll?.electType === filters.electionType
                    && String(poll?.stateID || "").toUpperCase() === filters.stateID
                    && poll?.category === filters.category
                    && (!Number.isFinite(filters.year) || Number(poll?.year) === Number(filters.year))
                    && (!Number.isFinite(filters.currentWeek) || Number(poll?.week) <= Number(filters.currentWeek));
            })
            .sort((a, b) => {
                const yearDiff = (Number(b?.year) || 0) - (Number(a?.year) || 0);
                if(yearDiff !== 0) return yearDiff;
                const weekDiff = (Number(b?.week) || 0) - (Number(a?.week) || 0);
                if(weekDiff !== 0) return weekDiff;
                return String(a?.pollster || "").localeCompare(String(b?.pollster || ""));
            })
            .slice(0, 36);
    };
    const drawMsnbcPollResultsChart = (canvas, weeklyAverages, activeIndex = null) => {
        if(!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const cssWidth = Math.max(600, Math.round(rect.width || canvas.clientWidth || 1040));
        const cssHeight = Math.max(360, Math.round(rect.height || canvas.clientHeight || 500));
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        const context = canvas.getContext("2d");
        if(!context) return null;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);
        context.fillStyle = "#eeeeee";
        context.fillRect(0, 0, cssWidth, cssHeight);
        const plotLeft = 78;
        const plotRight = cssWidth - 176;
        const plotTop = 44;
        const plotBottom = cssHeight - 48;
        const plotWidth = Math.max(1, plotRight - plotLeft);
        const plotHeight = Math.max(1, plotBottom - plotTop);
        let series = getPollGraphSeries(weeklyAverages).slice(0, 4);
        if(series.length === 0 && weeklyAverages.length === 1) {
            series = (weeklyAverages[0].candidates || []).slice(0, 4).map(candidate => ({
                name: candidate.name,
                party: candidate.party || "",
                points: [{
                    index: 0,
                    week: weeklyAverages[0].week,
                    pct: Number(candidate.pct) || 0,
                    displayPct: Number.isFinite(candidate.displayPct)
                        ? candidate.displayPct
                        : getDisplayedPollPct(candidate.pct)
                }]
            }));
        }
        const maxPct = Math.max(
            10,
            ...weeklyAverages.flatMap(weekData => (weekData.candidates || []).slice(0, 4).map(candidate => Number(candidate.pct) || 0))
        );
        const yMax = Math.max(10, Math.ceil((maxPct + 6) / 5) * 5);
        const xForIndex = (index) => {
            if(weeklyAverages.length <= 1) return plotLeft + (plotWidth / 2);
            return plotLeft + (plotWidth * (index / (weeklyAverages.length - 1)));
        };
        const yForPct = (pct) => plotBottom - ((Math.max(0, Math.min(yMax, Number(pct) || 0)) / yMax) * plotHeight);
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = "#111";
        context.font = "32px Georgia, 'Times New Roman', serif";
        context.fillText("Weekly Average", cssWidth / 2, 4);
        context.strokeStyle = "#cfcfcf";
        context.lineWidth = 1;
        context.fillStyle = "#111";
        context.font = "16px Georgia, 'Times New Roman', serif";
        context.textAlign = "right";
        context.textBaseline = "middle";
        for(let tick = 0; tick <= 6; tick++){
            const value = (yMax / 6) * tick;
            const y = yForPct(value);
            context.beginPath();
            context.moveTo(plotLeft, y);
            context.lineTo(plotRight, y);
            context.stroke();
            context.fillText(value.toFixed(1), plotLeft - 7, y);
        }
        context.strokeStyle = "#999";
        context.beginPath();
        context.moveTo(plotLeft, plotTop);
        context.lineTo(plotLeft, plotBottom);
        context.lineTo(plotRight, plotBottom);
        context.stroke();
        context.textAlign = "center";
        context.textBaseline = "top";
        weeklyAverages.forEach((weekData, index) => {
            if(index % Math.max(1, Math.ceil(weeklyAverages.length / 7)) !== 0 && index !== weeklyAverages.length - 1) return;
            context.fillText(String(index), xForIndex(index), plotBottom + 10);
        });
        if(Number.isInteger(activeIndex) && weeklyAverages[activeIndex]){
            const markerX = xForIndex(activeIndex);
            context.strokeStyle = "#8d8d8d";
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(markerX, plotTop + 4);
            context.lineTo(markerX, plotBottom);
            context.stroke();
            context.fillStyle = "#777";
            context.font = "12px Arial, sans-serif";
            const weekData = weeklyAverages[activeIndex];
            context.fillText(`Week ${weekData.week}, ${weekData.year || ""}`.trim(), markerX, plotTop + 9);
        }
        series.forEach(candidateSeries => {
            const colour = pollPartyColours[candidateSeries.party] || "#777777";
            context.strokeStyle = colour;
            context.lineWidth = 4;
            context.beginPath();
            candidateSeries.points.forEach((point, pointIndex) => {
                const x = xForIndex(point.index);
                const y = yForPct(point.pct);
                if(pointIndex === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            });
            context.stroke();
            candidateSeries.points.forEach(point => {
                const x = xForIndex(point.index);
                const y = yForPct(point.pct);
                context.beginPath();
                context.arc(x, y, 6, 0, Math.PI * 2);
                context.fillStyle = colour;
                context.fill();
                context.lineWidth = 3;
                context.strokeStyle = "#eeeeee";
                context.stroke();
            });
        });
        const legendX = plotRight + 34;
        let legendY = plotTop + Math.max(130, plotHeight * 0.44);
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.font = "18px Georgia, 'Times New Roman', serif";
        series.forEach(candidateSeries => {
            const colour = pollPartyColours[candidateSeries.party] || "#777777";
            context.fillStyle = colour;
            context.fillRect(legendX, legendY - 15, 30, 30);
            context.fillStyle = "#111";
            context.fillText(candidateSeries.name, legendX + 36, legendY);
            legendY += 34;
        });
        const xCenters = weeklyAverages.map((_weekData, index) => xForIndex(index));
        canvas._bmMsnbcPollChart = { plotLeft, plotRight, plotTop, plotBottom, xCenters };
        return canvas._bmMsnbcPollChart;
    };
    const getMsnbcPollChartIndexFromEvent = (event, canvas, weeklyAverages) => {
        const chart = canvas?._bmMsnbcPollChart;
        if(!chart || !Array.isArray(chart.xCenters) || chart.xCenters.length === 0) return null;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        let bestIndex = 0;
        let bestDistance = Infinity;
        chart.xCenters.forEach((center, index) => {
            const distance = Math.abs(center - x);
            if(distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });
        return weeklyAverages[bestIndex] ? bestIndex : null;
    };
    const openMsnbcPollResultsModal = (raceConfig, entry, selectedState) => {
        const { filters, weeklyAverages } = getMsnbcPollDataForState(raceConfig, entry, selectedState);
        if(!filters || weeklyAverages.length === 0) return;
        const existingOverlay = document.getElementById("bm-msnbc-poll-overlay");
        if(existingOverlay) existingOverlay.remove();
        hidePollAverageTooltip();
        const pollRows = getMsnbcPollRows(filters);
        const rowsByWeek = new Map();
        pollRows.forEach(poll => {
            const week = Number(poll?.week);
            const year = Number(poll?.year);
            const key = `${Number.isFinite(year) ? year : ""}|${Number.isFinite(week) ? week : ""}`;
            if(!rowsByWeek.has(key)) rowsByWeek.set(key, { week, year, polls: [] });
            rowsByWeek.get(key).polls.push(poll);
        });
        const electionTitle = `${raceConfig?.stateTitle || raceConfig?.title || "Election"} Election - ${filters.stateID}`;
        const tableHTML = Array.from(rowsByWeek.values()).map(group => {
            const weekLabel = Number.isFinite(group.week)
                ? `Week ${group.week}, ${Number.isFinite(group.year) ? group.year : ""}`.trim().replace(/,\s*$/, "")
                : "Recent Polls";
            return `
                <div class="bm-msnbc-poll-week-title">${escapeHtml(weekLabel)}</div>
                <table class="bm-msnbc-poll-table">
                    <tr>
                        <th>Election</th>
                        <th>Pollster</th>
                        <th>Sample</th>
                        <th>Results</th>
                        <th>Leader</th>
                    </tr>
                    ${group.polls.map(poll => {
                        const leaderParty = getMsnbcPollLeaderParty(poll);
                        const sample = getValidPollSample(poll);
                        return `
                            <tr>
                                <td>${escapeHtml(electionTitle)}</td>
                                <td>${escapeHtml(poll?.pollster || poll?.source || "Poll")}</td>
                                <td>${sample !== null ? escapeHtml(formatWholeNumber(sample)) : ""}</td>
                                <td>${escapeHtml(formatPollPercentageText(poll?.resultsText || getMsnbcPollResultText(poll)))}</td>
                                <td class="party-${escapeHtml(leaderParty || "I")}">${escapeHtml(getMsnbcPollLeader(poll))}</td>
                            </tr>
                        `;
                    }).join("")}
                </table>
            `;
        }).join("");
        const overlay = document.createElement("div");
        overlay.id = "bm-msnbc-poll-overlay";
        overlay.innerHTML = `
            <div id="bm-msnbc-poll-panel">
                <button class="bm-msnbc-poll-close" title="Close">X</button>
                <h2 class="bm-msnbc-poll-title">${escapeHtml(electionTitle)}</h2>
                <div class="bm-msnbc-poll-chart-shell">
                    <canvas class="bm-msnbc-poll-chart"></canvas>
                </div>
                ${tableHTML || `<div class="bm-msnbc-empty">No poll rows found for this race.</div>`}
            </div>
        `;
        document.body.appendChild(overlay);
        const closeModal = () => {
            hidePollAverageTooltip();
            msnbcPollModalActiveChart = null;
            overlay.remove();
        };
        overlay.querySelector(".bm-msnbc-poll-close")?.addEventListener("click", closeModal);
        overlay.addEventListener("click", event => {
            if(event.target === overlay) closeModal();
        });
        const canvas = overlay.querySelector(".bm-msnbc-poll-chart");
        const redrawChart = (activeIndex = null) => {
            msnbcPollModalActiveChart = drawMsnbcPollResultsChart(canvas, weeklyAverages, activeIndex);
        };
        redrawChart(weeklyAverages.length - 1);
        canvas.addEventListener("mousemove", event => {
            const activeIndex = getMsnbcPollChartIndexFromEvent(event, canvas, weeklyAverages);
            if(activeIndex === null) return;
            redrawChart(activeIndex);
            const tooltip = ensurePollAverageTooltip();
            tooltip.innerHTML = formatPollAverageTooltipHTML(weeklyAverages[activeIndex], filters);
            const offset = 16;
            const tooltipWidth = tooltip.offsetWidth || 280;
            const tooltipHeight = tooltip.offsetHeight || 120;
            let left = event.clientX + offset;
            let top = event.clientY + offset;
            if(left + tooltipWidth > window.innerWidth - 8) left = event.clientX - tooltipWidth - offset;
            if(top + tooltipHeight > window.innerHeight - 8) top = event.clientY - tooltipHeight - offset;
            tooltip.style.left = `${Math.max(8, left)}px`;
            tooltip.style.top = `${Math.max(8, top)}px`;
            tooltip.style.display = "block";
        });
        canvas.addEventListener("mouseleave", () => {
            hidePollAverageTooltip();
            redrawChart(weeklyAverages.length - 1);
        });
        window.setTimeout(() => redrawChart(weeklyAverages.length - 1), 0);
    };
    const isPollAverageGraphCanvas = (canvas) => {
        if(canvas?.tagName?.toLowerCase() !== "canvas") return false;
        if(canvas.classList.contains("bm-poll-graph-overlay")) return false;
        const rect = canvas.getBoundingClientRect();
        return isElementVisible(canvas)
            && rect.width >= 250
            && rect.height >= 150
            && rect.width >= rect.height * 1.25;
    };
    const getPollAverageGraphElement = (targetElement) => {
        if(isPollAverageGraphCanvas(targetElement)) return targetElement;
        const canvases = Array.from(targetElement.querySelectorAll?.("canvas") || []);
        return canvases.find(isPollAverageGraphCanvas) || null;
    };
    const getPollAverageGraphCanvases = () => {
        return Array.from(new Set([
            ...document.querySelectorAll("#pollDetailCanvas, #pollDetailCanvas2, canvas.pollDetailCanvas"),
            ...document.querySelectorAll("#pollDetailDiv canvas, #pollDetailCanvDiv canvas"),
            ...document.querySelectorAll("canvas")
        ])).filter(isPollAverageGraphCanvas);
    };
    const getPollGraphSeriesKey = (candidate) => {
        return `${normalizePollCandidateName(candidate?.name)}|${candidate?.party || ""}`;
    };
    const getPollGraphSeries = (weeklyAverages) => {
        const seriesMap = new Map();
        weeklyAverages.forEach((weekData, weekIndex) => {
            weekData.candidates.forEach(candidate => {
                const key = getPollGraphSeriesKey(candidate);
                if(!seriesMap.has(key)){
                    seriesMap.set(key, {
                        key,
                        name: candidate.name,
                        party: candidate.party || "",
                        incumbent: Boolean(candidate.incumbent),
                        points: []
                    });
                }
                if(candidate.incumbent) seriesMap.get(key).incumbent = true;
                seriesMap.get(key).points.push({
                    index: weekIndex,
                    week: weekData.week,
                    pct: Number(candidate.pct) || 0,
                    simplePct: Number(candidate.simplePct) || Number(candidate.pct) || 0,
                    displayPct: Number.isFinite(candidate.displayPct)
                        ? candidate.displayPct
                        : getDisplayedPollPct(candidate.pct)
                });
            });
        });
        return Array.from(seriesMap.values())
            .filter(series => series.points.length >= 2);
    };
    const getConfiguredPollGraphSeriesColours = (series, weeklyAverages, filtersOverride = null) => {
        const filters = filtersOverride || getPollPageFilters() || {};
        const latestWeek = weeklyAverages[weeklyAverages.length - 1] || {};
        const electionYear = Number(filters.year) || Number(latestWeek.year) || "current";
        const ballotParty = filters.party || series.find(item => item.party)?.party || "I";
        const colourScope = filters.category === "primary" && filters.electionType === "president"
            ? `presidential-primary:${String(filters.stateID || "polls").toLowerCase()}:${ballotParty}`
            : [
                "polls",
                electionYear,
                filters.electionType || "election",
                filters.category || "general",
                filters.stateID || "all",
                ballotParty
            ].join(":");
        const candidates = series.map(item => {
            const latestPoint = item.points[item.points.length - 1];
            const rankingVotes = Math.max(0, Number(latestPoint?.pct) || 0) * 1000000;
            return {
                name: item.name,
                party: item.party || "I",
                incumbent: Boolean(item.incumbent),
                currentVotes: rankingVotes,
                votes: rankingVotes
            };
        });
        const race = {
            year: electionYear,
            electionType: filters.electionType,
            stateId: filters.stateID,
            colourScope,
            cands: candidates,
            pW: false
        };
        return candidates.map(candidate => {
            if(getCandidateVariantPartyKey(candidate).startsWith("I")) return pollPartyColours.I;
            return stringifyColour(getCandidateColourForRace(candidate, race));
        });
    };
    const normalizePollAverageCenters = (centers, targetLength) => {
        if(!Array.isArray(centers) || centers.length < 2 || targetLength < 2) return null;
        const sortedCenters = centers
            .slice()
            .sort((a, b) => a - b)
            .filter((center, index, array) => index === 0 || Math.abs(center - array[index - 1]) > 5);
        if(sortedCenters.length < 2) return null;
        if(sortedCenters.length === targetLength) return sortedCenters;
        if(sortedCenters.length > targetLength){
            return Array.from({ length: targetLength }, (_value, index) => {
                const sourceIndex = Math.round(index * (sortedCenters.length - 1) / (targetLength - 1));
                return sortedCenters[sourceIndex];
            });
        }
        const firstCenter = sortedCenters[0];
        const lastCenter = sortedCenters[sortedCenters.length - 1];
        return Array.from({ length: targetLength }, (_value, index) => {
            return firstCenter + ((lastCenter - firstCenter) * (index / (targetLength - 1)));
        });
    };
    const getPollGraphPlotRight = (width, legendLeft = null) => {
        const rightPadding = Math.max(95, Math.min(145, width * 0.105));
        const fallbackRight = Math.min(width * 0.90, width - rightPadding);
        if(Number.isFinite(legendLeft)) return Math.max(width * 0.20, Math.min(fallbackRight, legendLeft - 24));
        return fallbackRight;
    };
    const getPollGraphPointScanRight = (width) => {
        return Math.min(width * 0.965, width - 18);
    };
    const getPollAverageXCenters = (graphElement, weeklyAverages, graphWidth = null) => {
        const width = graphWidth
            || graphElement.width
            || graphElement.getBoundingClientRect().width;
        const height = graphElement.height || graphElement.getBoundingClientRect().height;
        const firstWeek = weeklyAverages[0];
        const lastWeek = weeklyAverages[weeklyAverages.length - 1];
        const scaleKey = [
            graphElement.width || width,
            height,
            weeklyAverages.length,
            firstWeek?.year || "",
            firstWeek?.week || "",
            lastWeek?.year || "",
            lastWeek?.week || ""
        ].join("|");
        const cachedScale = graphElement._bmPollNativeXScale;
        if(cachedScale?.key === scaleKey && Array.isArray(cachedScale.centers)) {
            const sourceWidth = graphElement.width || width;
            const scale = sourceWidth > 0 ? width / sourceWidth : 1;
            return cachedScale.centers.map(center => center * scale);
        }
        let legendLeft = null;
        try {
            const context = graphElement.getContext?.("2d");
            const image = context?.getImageData(0, 0, graphElement.width, graphElement.height)?.data;
            if(image) legendLeft = getPollGraphLegendLeft(image, graphElement.width, graphElement.height);
        } catch(_err) {}
        const legendBoxSize = Math.max(18, Math.round(height * 0.06));
        const dataRight = Number.isFinite(legendLeft)
            ? legendLeft - legendBoxSize
            : width * 0.82;
        const detectedCenters = [
            ...(getPollAverageRecordedPointCenters(graphElement) || []),
            ...(getPollAverageRawPointCenters(graphElement) || [])
        ].filter(center => Number.isFinite(center) && center < dataRight);
        const dataLeft = detectedCenters.length > 0
            ? Math.min(...detectedCenters)
            : width * 0.055;
        const plotRight = Math.max(dataLeft + 1, dataRight);
        const stableCenters = Array.from({ length: weeklyAverages.length }, (_value, index) => {
            if(weeklyAverages.length <= 1) return dataLeft;
            return dataLeft + ((plotRight - dataLeft) * (index / (weeklyAverages.length - 1)));
        });
        graphElement._bmPollNativeXScale = {
            key: scaleKey,
            centers: stableCenters.slice()
        };
        return stableCenters;
    };
    const getPollGraphChartMetrics = (graphElement, weeklyAverages, series, xCenters = null) => {
        const width = graphElement.width || graphElement.getBoundingClientRect().width;
        const height = graphElement.height || graphElement.getBoundingClientRect().height;
        const maxPct = Math.max(1, ...series.flatMap(item => item.points.map(point => point.pct)));
        const yMax = Math.max(10, maxPct * 1.25);
        const centers = xCenters || getPollAverageXCenters(graphElement, weeklyAverages, width);
        const plotLeft = centers[0] ?? (width * 0.085);
        const plotRight = centers[centers.length - 1] ?? Math.max(plotLeft + 1, Math.min(width * 0.835, width - 170));
        const plotTop = height * 0.075;
        const plotBottom = height * 0.86;
        const xForIndex = (index) => {
            return centers[index] ?? plotLeft;
        };
        const yForPct = (pct) => {
            return plotBottom - ((Math.max(0, Math.min(yMax, pct)) / yMax) * (plotBottom - plotTop));
        };
        return { width, height, plotLeft, plotRight, plotTop, plotBottom, yMax, xForIndex, yForPct };
    };
    const drawPollGraphWeekMarker = (context, metrics, weeklyAverages, activeIndex, activeX = null) => {
        if(!Number.isInteger(activeIndex) || !weeklyAverages[activeIndex]) return;
        const markerX = Number.isFinite(activeX) ? activeX : metrics.xForIndex(activeIndex);
        const labelY = metrics.plotTop + 13;
        const lineTop = labelY + 8;
        context.strokeStyle = "rgba(0, 0, 0, 0.38)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(markerX + 1, lineTop);
        context.lineTo(markerX + 1, metrics.plotBottom);
        context.stroke();
        context.fillStyle = "rgba(0, 0, 0, 0.58)";
        context.font = "700 12px Arial, Helvetica, sans-serif";
        context.textAlign = "center";
        const activeWeek = weeklyAverages[activeIndex];
        const markerLabel = Number.isFinite(Number(activeWeek.year))
            ? `Week ${activeWeek.week}, ${activeWeek.year}`
            : `Week ${activeWeek.week}`;
        context.fillText(markerLabel, markerX, labelY);
        context.textAlign = "left";
    };
    const getPollGraphCanvasBackground = (graphElement, metrics = null) => {
        try {
            const sourceContext = graphElement.getContext("2d");
            if(metrics){
                const left = Math.max(0, Math.floor(metrics.plotLeft + 2));
                const top = Math.max(0, Math.floor(metrics.plotTop + 2));
                const width = Math.max(1, Math.floor(metrics.plotRight - metrics.plotLeft - 4));
                const height = Math.max(1, Math.floor(metrics.plotBottom - metrics.plotTop - 4));
                const imageData = sourceContext?.getImageData(left, top, width, height)?.data;
                if(imageData){
                    const colours = new Map();
                    for(let offset = 0; offset < imageData.length; offset += 16){
                        if(imageData[offset + 3] < 220) continue;
                        const key = `${imageData[offset]},${imageData[offset + 1]},${imageData[offset + 2]}`;
                        colours.set(key, (colours.get(key) || 0) + 1);
                    }
                    const dominant = Array.from(colours.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
                    if(dominant){
                        const [red, green, blue] = dominant.split(",").map(Number);
                        return { red, green, blue, css: `rgb(${red}, ${green}, ${blue})` };
                    }
                }
            }
            const pixel = sourceContext?.getImageData(1, 1, 1, 1)?.data;
            if(pixel && pixel[3] > 0){
                return { red: pixel[0], green: pixel[1], blue: pixel[2], css: `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})` };
            }
        } catch(_err) {}
        return { red: 238, green: 238, blue: 238, css: "#eeeeee" };
    };
    const getNativePollGraphVerticalBounds = (graphElement, fallbackTop, fallbackBottom) => {
        try {
            const width = graphElement.width;
            const height = graphElement.height;
            const context = graphElement.getContext("2d");
            const image = context.getImageData(0, 0, width, height).data;
            const startX = Math.max(0, Math.floor(width * 0.075));
            const endX = Math.min(width - 1, Math.floor(width * 0.92));
            const candidateRows = [];
            for(let y = Math.floor(height * 0.045); y <= Math.floor(height * 0.95); y++){
                let hits = 0;
                for(let x = startX; x <= endX; x += 2){
                    const offset = ((y * width) + x) * 4;
                    const red = image[offset];
                    const green = image[offset + 1];
                    const blue = image[offset + 2];
                    const max = Math.max(red, green, blue);
                    const min = Math.min(red, green, blue);
                    if(image[offset + 3] >= 220 && max >= 150 && max <= 225 && max - min <= 8) hits++;
                }
                if(hits >= ((endX - startX) / 2) * 0.38) candidateRows.push(y);
            }
            const gridRows = [];
            candidateRows.forEach(y => {
                const last = gridRows[gridRows.length - 1];
                if(last && y - last[last.length - 1] <= 1) last.push(y);
                else gridRows.push([y]);
            });
            const centers = gridRows.map(rows => rows.reduce((sum, y) => sum + y, 0) / rows.length);
            if(centers.length >= 6){
                return { top: centers[0], bottom: centers[centers.length - 1], detected: true };
            }
        } catch(_err) {}
        return { top: fallbackTop, bottom: fallbackBottom, detected: false };
    };
    const normalizeNativePollGraphBackground = (context, graphElement) => {
        try {
            const width = graphElement.width;
            const height = graphElement.height;
            const image = context.getImageData(0, 0, width, height);
            for(let offset = 0; offset < image.data.length; offset += 4){
                const red = image.data[offset];
                const green = image.data[offset + 1];
                const blue = image.data[offset + 2];
                const alpha = image.data[offset + 3];
                const max = Math.max(red, green, blue);
                const min = Math.min(red, green, blue);
                const transparentBackground = alpha <= 8;
                const lightNeutralBackground = alpha >= 220 && min >= 185 && max - min <= 12;
                if(transparentBackground || lightNeutralBackground){
                    image.data[offset] = 238;
                    image.data[offset + 1] = 238;
                    image.data[offset + 2] = 238;
                    image.data[offset + 3] = 255;
                }
            }
            context.putImageData(image, 0, 0);
        } catch(_err) {}
    };
    const eraseNativePollGraphSeries = (context, graphElement, metrics) => {
        const { width, height, plotLeft, plotRight, plotTop, plotBottom } = metrics;
        const pointRadius = Math.max(5, height * 0.012);
        const left = Math.max(0, Math.floor(plotLeft - pointRadius - 3));
        let right = Math.min(width - 1, Math.ceil(plotRight + pointRadius + 3));
        const top = Math.max(0, Math.floor(plotTop));
        const bottom = Math.min(height - 1, Math.ceil(plotBottom));
        if(right <= left || bottom <= top) return;
        try {
            const canvasImage = context.getImageData(0, 0, width, height).data;
            const legendLeft = getPollGraphLegendLeft(canvasImage, width, height);
            if(Number.isFinite(legendLeft)){
                right = Math.floor(legendLeft - pointRadius - 4);
            } else {
                right = Math.max(right, Math.floor(width * 0.82));
            }
            right = Math.min(width - 1, right);
            const regionWidth = right - left + 1;
            const regionHeight = bottom - top + 1;
            context.fillStyle = "#EEEEEE";
            context.fillRect(left, top, regionWidth, regionHeight);
        } catch(_err) {}
    };
    const getNativePollGraphSeriesColours = (graphElement, series) => {
        const cached = pollAverageNativeColourCache.get(graphElement);
        const seriesKey = series.map(item => `${item.key}:${item.party || "I"}`).join("|");
        if(cached
            && cached.width === graphElement.width
            && cached.height === graphElement.height
            && cached.seriesKey === seriesKey){
            return cached.colours;
        }
        const fallbackColours = series.map(item => {
            if(item.party === "R") return "#FF0000";
            if(item.party === "D") return "#0487E6";
            return "#888888";
        });
        try {
            const sourceContext = graphElement.getContext("2d");
            const width = graphElement.width;
            const height = graphElement.height;
            const imageData = sourceContext.getImageData(Math.floor(width * 0.60), 0, Math.ceil(width * 0.40), height);
            const counts = new Map();
            for(let offset = 0; offset < imageData.data.length; offset += 4){
                const alpha = imageData.data[offset + 3];
                if(alpha < 220) continue;
                const red = imageData.data[offset];
                const green = imageData.data[offset + 1];
                const blue = imageData.data[offset + 2];
                const max = Math.max(red, green, blue);
                const min = Math.min(red, green, blue);
                const saturated = max >= 105 && max - min >= 38;
                const candidateGrey = max >= 80 && max <= 180 && max - min <= 28;
                if(!saturated && !candidateGrey) continue;
                const key = `${red},${green},${blue}`;
                const y = Math.floor((offset / 4) / imageData.width);
                const entry = counts.get(key) || { red, green, blue, count: 0, totalY: 0 };
                entry.count++;
                entry.totalY += y;
                counts.set(key, entry);
            }
            const minimumCount = Math.max(20, Math.round(width * height * 0.000035));
            const dominantColours = Array.from(counts.values())
                .filter(entry => entry.count >= minimumCount)
                .sort((a, b) => b.count - a.count)
                .reduce((selected, entry) => {
                    const duplicate = selected.some(existing =>
                        Math.abs(existing.red - entry.red)
                        + Math.abs(existing.green - entry.green)
                        + Math.abs(existing.blue - entry.blue) < 24
                    );
                    if(!duplicate) selected.push(entry);
                    return selected;
                }, [])
                .slice(0, series.length)
                .sort((a, b) => (a.totalY / a.count) - (b.totalY / b.count));
            if(dominantColours.length === series.length){
                const colours = dominantColours.map(entry => `rgb(${entry.red}, ${entry.green}, ${entry.blue})`);
                pollAverageNativeColourCache.set(graphElement, {
                    width,
                    height,
                    seriesKey,
                    colours
                });
                return colours;
            }
        } catch(_err) {}
        return fallbackColours;
    };
    const drawWeightedPollGraph = (context, graphElement, metrics, weeklyAverages, series, seriesColours) => {
        const { width, height, plotLeft, plotRight, plotTop, plotBottom, xForIndex } = metrics;
        const pointRadius = Math.max(5, height * 0.012);
        const simpleMaxPct = Math.max(
            1,
            ...series.flatMap(item => item.points.map(point => Number(point.simplePct) || Number(point.pct) || 0))
        );
        const yMax = Math.max(10, simpleMaxPct * (7 / 6));
        const yForPct = pct => {
            const safePct = Math.max(0, Math.min(yMax, Number(pct) || 0));
            return plotBottom - ((safePct / yMax) * (plotBottom - plotTop));
        };
        if(context.canvas !== graphElement) context.drawImage(graphElement, 0, 0, width, height);
        normalizeNativePollGraphBackground(context, graphElement);
        eraseNativePollGraphSeries(context, graphElement, metrics);

        series.forEach((item, seriesIndex) => {
            const colour = seriesColours[seriesIndex] || pollPartyColours[item.party] || "#888888";
            const points = item.points
                .map(point => ({ x: xForIndex(point.index), y: yForPct(point.pct) }))
                .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
            if(points.length === 0) return;
            context.strokeStyle = colour;
            context.lineWidth = Math.max(3, height * 0.007);
            context.lineJoin = "round";
            context.lineCap = "round";
            context.beginPath();
            points.forEach((point, index) => {
                if(index === 0) context.moveTo(point.x, point.y);
                else context.lineTo(point.x, point.y);
            });
            context.stroke();
            points.forEach(point => {
                context.beginPath();
                context.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
                context.fillStyle = colour;
                context.fill();
                context.strokeStyle = "#ffffff";
                context.lineWidth = Math.max(2, height * 0.004);
                context.stroke();
            });
        });
    };
    const drawCompleteWeightedPollGraph = (graphElement, weeklyAverages, series, seriesColours) => {
        const context = graphElement?.getContext?.("2d");
        if(!context || weeklyAverages.length < 2 || series.length === 0) return;
        const width = graphElement.width || Math.round(graphElement.getBoundingClientRect().width);
        const height = graphElement.height || Math.round(graphElement.getBoundingClientRect().height);
        if(width <= 0 || height <= 0) return;
        const plotLeft = Math.max(58, width * 0.055);
        const legendWidth = Math.max(155, width * 0.16);
        const plotRight = Math.max(plotLeft + 40, width - legendWidth);
        const plotTop = Math.max(42, height * 0.09);
        const plotBottom = Math.max(plotTop + 80, height - Math.max(42, height * 0.09));
        const maxPct = Math.max(
            1,
            ...series.flatMap(item => item.points.flatMap(point => [
                Number(point.pct) || 0,
                Number(point.simplePct) || 0
            ]))
        );
        const yMax = Math.max(10, maxPct * (7 / 6));
        const xCenters = Array.from({ length: weeklyAverages.length }, (_value, index) => {
            return plotLeft + ((plotRight - plotLeft) * (index / (weeklyAverages.length - 1)));
        });
        const yForPct = pct => {
            const safePct = Math.max(0, Math.min(yMax, Number(pct) || 0));
            return plotBottom - ((safePct / yMax) * (plotBottom - plotTop));
        };

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#EEEEEE";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#111111";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.font = `${Math.max(24, Math.round(height * 0.064))}px Georgia, 'Times New Roman', serif`;
        context.fillText("Weekly Average", width / 2, 3);

        context.strokeStyle = "#8F8F8F";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(plotLeft, plotTop);
        context.lineTo(plotLeft, plotBottom);
        context.lineTo(plotRight, plotBottom);
        context.stroke();

        context.fillStyle = "#111111";
        context.font = `${Math.max(13, Math.round(height * 0.032))}px Georgia, 'Times New Roman', serif`;
        context.textAlign = "right";
        context.textBaseline = "middle";
        for(let tick = 0; tick <= 7; tick++){
            const value = (yMax / 7) * tick;
            const y = plotBottom - ((tick / 7) * (plotBottom - plotTop));
            context.fillText(value.toFixed(1), plotLeft - 8, y);
        }

        context.textAlign = "center";
        context.textBaseline = "top";
        const labelStep = Math.max(1, Math.ceil(weeklyAverages.length / 6));
        weeklyAverages.forEach((_weekData, index) => {
            if(index % labelStep === 0) context.fillText(String(index), xCenters[index], plotBottom + 10);
        });

        const pointRadius = Math.max(5, height * 0.012);
        series.forEach((item, seriesIndex) => {
            const colour = seriesColours[seriesIndex] || pollPartyColours[item.party] || "#777777";
            const points = item.points
                .map(point => ({
                    x: xCenters[point.index],
                    y: yForPct(point.pct)
                }))
                .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
            if(points.length === 0) return;
            context.strokeStyle = colour;
            context.lineWidth = Math.max(3, height * 0.006);
            context.lineJoin = "round";
            context.lineCap = "round";
            context.beginPath();
            points.forEach((point, index) => {
                if(index === 0) context.moveTo(point.x, point.y);
                else context.lineTo(point.x, point.y);
            });
            context.stroke();
            points.forEach(point => {
                context.beginPath();
                context.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
                context.fillStyle = colour;
                context.fill();
                context.strokeStyle = "#FFFFFF";
                context.lineWidth = Math.max(2, height * 0.004);
                context.stroke();
            });
        });

        const legendRowHeight = Math.max(30, height * 0.068);
        const legendHeight = series.length * legendRowHeight;
        const legendX = plotRight + Math.max(20, width * 0.018);
        let legendY = Math.max(plotTop + 24, ((plotTop + plotBottom - legendHeight) / 2));
        context.font = `${Math.max(15, Math.round(height * 0.036))}px Georgia, 'Times New Roman', serif`;
        context.textAlign = "left";
        context.textBaseline = "middle";
        series.forEach((item, index) => {
            const colour = seriesColours[index] || pollPartyColours[item.party] || "#777777";
            const swatchSize = Math.max(22, Math.min(30, legendRowHeight - 4));
            context.fillStyle = colour;
            context.fillRect(legendX, legendY - (swatchSize / 2), swatchSize, swatchSize);
            context.fillStyle = "#111111";
            context.fillText(item.name, legendX + swatchSize + 7, legendY);
            legendY += legendRowHeight;
        });

        const firstWeek = weeklyAverages[0];
        const lastWeek = weeklyAverages[weeklyAverages.length - 1];
        graphElement._bmPollNativeXScale = {
            key: [
                width,
                height,
                weeklyAverages.length,
                firstWeek?.year || "",
                firstWeek?.week || "",
                lastWeek?.year || "",
                lastWeek?.week || ""
            ].join("|"),
            centers: xCenters.slice()
        };
    };
    const drawPollAverageOverlay = (graphElement, overlay, weeklyAverages, activeIndex = null, activeX = null) => {
        const series = getPollGraphSeries(weeklyAverages).slice(0, 10);
        const context = overlay.getContext("2d");
        if(!context || series.length === 0) return;
        const rect = graphElement.getBoundingClientRect();
        const parentRect = graphElement.parentElement?.getBoundingClientRect?.();
        const width = graphElement.width || Math.round(rect.width);
        const height = graphElement.height || Math.round(rect.height);
        if(overlay.width !== width) overlay.width = width;
        if(overlay.height !== height) overlay.height = height;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.style.left = parentRect ? `${rect.left - parentRect.left}px` : `${graphElement.offsetLeft}px`;
        overlay.style.top = parentRect ? `${rect.top - parentRect.top}px` : `${graphElement.offsetTop}px`;
        const baseMetrics = getPollGraphChartMetrics(graphElement, weeklyAverages, series);
        const nativeVerticalBounds = getNativePollGraphVerticalBounds(
            graphElement,
            baseMetrics.plotTop,
            baseMetrics.plotBottom
        );
        const metrics = {
            ...baseMetrics,
            plotTop: nativeVerticalBounds.top,
            plotBottom: nativeVerticalBounds.bottom
        };
        const seriesColours = getConfiguredPollGraphSeriesColours(series, weeklyAverages);
        let weightedGraph = pollAverageWeightedGraphCache.get(overlay);
        if(!weightedGraph
            || weightedGraph.weeklyAverages !== weeklyAverages
            || weightedGraph.width !== width
            || weightedGraph.height !== height
            || weightedGraph.seriesColours.join("|") !== seriesColours.join("|")){
            const baseCanvas = document.createElement("canvas");
            baseCanvas.width = width;
            baseCanvas.height = height;
            const baseContext = baseCanvas.getContext("2d");
            if(baseContext) drawWeightedPollGraph(baseContext, graphElement, metrics, weeklyAverages, series, seriesColours);
            weightedGraph = {
                weeklyAverages,
                width,
                height,
                seriesColours,
                canvas: baseCanvas
            };
            pollAverageWeightedGraphCache.set(overlay, weightedGraph);
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.drawImage(weightedGraph.canvas, 0, 0);
        drawPollGraphWeekMarker(context, metrics, weeklyAverages, activeIndex, activeX);
    };
    const removePollAverageGraphOverlays = () => {
        document.querySelectorAll("canvas.bm-poll-graph-overlay").forEach(overlay => overlay.remove());
    };
    const applyWeightedPollAveragesToNativeGraphs = () => {
        const weeklyAverages = getPollWeeklyAverages();
        if(weeklyAverages.length < 2) return;
        const series = getPollGraphSeries(weeklyAverages).slice(0, 10);
        if(series.length === 0) return;
        getPollAverageGraphCanvases().forEach(graphElement => {
            const context = graphElement.getContext("2d");
            if(!context) return;
            const seriesColours = getConfiguredPollGraphSeriesColours(series, weeklyAverages);
            drawCompleteWeightedPollGraph(graphElement, weeklyAverages, series, seriesColours);
        });
    };
    const ensurePollAverageWeekMarker = () => {
        if(pollAverageWeekMarker?.isConnected) return pollAverageWeekMarker;
        const marker = document.createElement("div");
        marker.className = "bm-poll-week-marker";
        marker.style.position = "fixed";
        marker.style.width = "0";
        marker.style.pointerEvents = "none";
        marker.style.zIndex = "99998";
        marker.style.display = "none";

        const label = document.createElement("span");
        label.style.position = "absolute";
        label.style.top = "0";
        label.style.left = "0";
        label.style.transform = "translateX(-50%)";
        label.style.whiteSpace = "nowrap";
        label.style.color = "rgba(0, 0, 0, 0.62)";
        label.style.font = "700 12px Arial, Helvetica, sans-serif";

        const line = document.createElement("span");
        line.style.position = "absolute";
        line.style.top = "18px";
        line.style.left = "0";
        line.style.bottom = "0";
        line.style.borderLeft = "2px solid rgba(0, 0, 0, 0.34)";

        marker.append(label, line);
        document.body.appendChild(marker);
        pollAverageWeekMarker = marker;
        return marker;
    };
    const showPollAverageWeekMarker = (graphElement, weeklyAverages, index, markerX) => {
        if(!graphElement || !weeklyAverages[index]) return;
        const rect = graphElement.getBoundingClientRect();
        const sourceWidth = graphElement.width || rect.width;
        const cssX = sourceWidth > 0 ? markerX * (rect.width / sourceWidth) : markerX;
        const marker = ensurePollAverageWeekMarker();
        const activeWeek = weeklyAverages[index];
        marker.firstElementChild.textContent = Number.isFinite(Number(activeWeek.year))
            ? `Week ${activeWeek.week}, ${activeWeek.year}`
            : `Week ${activeWeek.week}`;
        marker.style.left = `${rect.left + cssX}px`;
        marker.style.top = `${rect.top + (rect.height * 0.075)}px`;
        marker.style.height = `${rect.height * 0.785}px`;
        marker.style.display = "block";
    };
    const hidePollAverageWeekMarker = () => {
        if(pollAverageWeekMarker) pollAverageWeekMarker.style.display = "none";
    };
    const isPollAveragePointPixel = (red, green, blue, alpha) => {
        if(alpha < 100) return false;
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const colouredPoint = maxChannel > 105 && (maxChannel - minChannel) > 24;
        const neutralPoint = maxChannel <= 180 && (maxChannel - minChannel) <= 24;
        return colouredPoint || neutralPoint;
    };
    const getPollGraphLegendLeft = (imageData, width, height) => {
        const startX = Math.floor(width * 0.66);
        const endX = Math.floor(width * 0.96);
        const startY = Math.floor(height * 0.20);
        const endY = Math.floor(height * 0.82);
        const threshold = Math.max(16, Math.floor(height * 0.034));
        let clusterStart = null;
        let clusterEnd = null;
        for(let x = startX; x <= endX; x++){
            let hits = 0;
            for(let y = startY; y <= endY; y++){
                const index = ((y * width) + x) * 4;
                if(isPollAveragePointPixel(imageData[index], imageData[index + 1], imageData[index + 2], imageData[index + 3])) hits++;
            }
            if(hits >= threshold){
                if(clusterStart === null) clusterStart = x;
                clusterEnd = x;
            } else if(clusterStart !== null) {
                if(clusterEnd - clusterStart >= 14) return clusterStart;
                clusterStart = null;
                clusterEnd = null;
            }
        }
        return (clusterStart !== null && clusterEnd - clusterStart >= 14) ? clusterStart : null;
    };
    const recolourNativePollGraphLegend = (context, graphElement, seriesColours) => {
        if(!context || !graphElement || seriesColours.length === 0) return;
        try {
            const width = graphElement.width;
            const height = graphElement.height;
            const image = context.getImageData(0, 0, width, height);
            const startX = Math.floor(width * 0.72);
            const endX = Math.floor(width * 0.94);
            const startY = Math.floor(height * 0.18);
            const endY = Math.floor(height * 0.85);
            const regionWidth = endX - startX + 1;
            const regionHeight = endY - startY + 1;
            const mask = new Uint8Array(regionWidth * regionHeight);
            const isLegendFill = offset => {
                const red = image.data[offset];
                const green = image.data[offset + 1];
                const blue = image.data[offset + 2];
                const alpha = image.data[offset + 3];
                if(alpha < 220) return false;
                const max = Math.max(red, green, blue);
                const min = Math.min(red, green, blue);
                return (max > 105 && max - min > 24)
                    || (max <= 180 && max - min <= 24);
            };
            for(let y = 0; y < regionHeight; y++){
                for(let x = 0; x < regionWidth; x++){
                    const sourceOffset = ((((startY + y) * width) + startX + x) * 4);
                    if(isLegendFill(sourceOffset)) mask[(y * regionWidth) + x] = 1;
                }
            }
            const visited = new Uint8Array(mask.length);
            const boxes = [];
            for(let y = 0; y < regionHeight; y++){
                for(let x = 0; x < regionWidth; x++){
                    const startIndex = (y * regionWidth) + x;
                    if(mask[startIndex] !== 1 || visited[startIndex] === 1) continue;
                    const queue = [[x, y]];
                    visited[startIndex] = 1;
                    let cursor = 0;
                    let minX = x;
                    let maxX = x;
                    let minY = y;
                    let maxY = y;
                    let area = 0;
                    while(cursor < queue.length){
                        const [currentX, currentY] = queue[cursor++];
                        area++;
                        minX = Math.min(minX, currentX);
                        maxX = Math.max(maxX, currentX);
                        minY = Math.min(minY, currentY);
                        maxY = Math.max(maxY, currentY);
                        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
                            const nextX = currentX + dx;
                            const nextY = currentY + dy;
                            if(nextX < 0 || nextX >= regionWidth || nextY < 0 || nextY >= regionHeight) return;
                            const nextIndex = (nextY * regionWidth) + nextX;
                            if(mask[nextIndex] !== 1 || visited[nextIndex] === 1) return;
                            visited[nextIndex] = 1;
                            queue.push([nextX, nextY]);
                        });
                    }
                    const boxWidth = maxX - minX + 1;
                    const boxHeight = maxY - minY + 1;
                    if(boxWidth >= 14
                        && boxHeight >= 14
                        && boxWidth <= 60
                        && boxHeight <= 60
                        && area >= boxWidth * boxHeight * 0.55){
                        boxes.push({
                            left: startX + minX,
                            top: startY + minY,
                            width: boxWidth,
                            height: boxHeight
                        });
                    }
                }
            }
            boxes.sort((a, b) => a.top - b.top).slice(0, seriesColours.length).forEach((box, index) => {
                const squareSize = Math.min(
                    box.width,
                    box.height,
                    Math.max(18, Math.round(height * 0.065))
                );
                context.fillStyle = seriesColours[index];
                context.fillRect(box.left, box.top, squareSize, squareSize);
            });
        } catch(_err) {}
    };
    const isPollAverageAxisPointPixel = (red, green, blue, alpha) => {
        if(alpha < 100) return false;
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        return maxChannel >= 85 && maxChannel <= 185 && (maxChannel - minChannel) <= 24;
    };
    const getPollAverageCentersFromColumns = (columns) => {
        const centers = [];
        let clusterStart = null;
        let clusterEnd = null;
        let lastColumn = null;
        let clusterEntries = [];
        const getColumnX = (column) => typeof column === "number" ? column : Number(column?.x);
        const getColumnWeight = (column) => Math.max(1, Number(column?.hits) || 1);
        const pushCluster = () => {
            if(clusterStart === null || clusterEnd === null) return;
            const clusterWidth = clusterEnd - clusterStart + 1;
            if(clusterWidth >= 4 && clusterWidth <= 22){
                const weighted = clusterEntries.reduce((sum, entry) => {
                    return {
                        x: sum.x + (getColumnX(entry) * getColumnWeight(entry)),
                        weight: sum.weight + getColumnWeight(entry)
                    };
                }, { x: 0, weight: 0 });
                centers.push(weighted.weight > 0 ? weighted.x / weighted.weight : (clusterStart + clusterEnd) / 2);
            }
        };
        columns.forEach(entry => {
            const column = getColumnX(entry);
            if(!Number.isFinite(column)) return;
            if(clusterStart === null || column - lastColumn > 2){
                pushCluster();
                clusterStart = column;
                clusterEntries = [];
            }
            clusterEnd = column;
            lastColumn = column;
            clusterEntries.push(entry);
        });
        pushCluster();
        const mergedCenters = [];
        centers.sort((a, b) => a - b).forEach(center => {
            const lastCenter = mergedCenters[mergedCenters.length - 1];
            if(lastCenter !== undefined && Math.abs(center - lastCenter) <= 5){
                mergedCenters[mergedCenters.length - 1] = (lastCenter + center) / 2;
            } else {
                mergedCenters.push(center);
            }
        });
        return mergedCenters;
    };
    const getPollAveragePointCentersFromColumns = (columns) => {
        const centers = [];
        let clusterStart = null;
        let clusterEnd = null;
        let lastColumn = null;
        let clusterEntries = [];
        const getColumnX = (column) => typeof column === "number" ? column : Number(column?.x);
        const getColumnWeight = (column) => Math.max(1, Number(column?.hits) || 1);
        const weightedCenter = (entries) => {
            const weighted = entries.reduce((sum, entry) => {
                return {
                    x: sum.x + (getColumnX(entry) * getColumnWeight(entry)),
                    weight: sum.weight + getColumnWeight(entry)
                };
            }, { x: 0, weight: 0 });
            return weighted.weight > 0 ? weighted.x / weighted.weight : null;
        };
        const pushPeakGroup = (entries) => {
            if(entries.length === 0) return;
            const start = getColumnX(entries[0]);
            const end = getColumnX(entries[entries.length - 1]);
            const width = end - start + 1;
            if(width < 2 || width > 18) return;
            const center = weightedCenter(entries);
            if(Number.isFinite(center)) centers.push(center);
        };
        const pushCluster = () => {
            if(clusterStart === null || clusterEnd === null) return;
            const clusterWidth = clusterEnd - clusterStart + 1;
            if(clusterWidth >= 4 && clusterWidth <= 22){
                const center = weightedCenter(clusterEntries);
                if(Number.isFinite(center)) centers.push(center);
                return;
            }
            const maxHits = Math.max(...clusterEntries.map(getColumnWeight));
            const peakThreshold = Math.max(8, maxHits * 0.55);
            const peakEntries = clusterEntries.filter((entry, index, entries) => {
                const hits = getColumnWeight(entry);
                const prev = index > 0 ? getColumnWeight(entries[index - 1]) : 0;
                const next = index < entries.length - 1 ? getColumnWeight(entries[index + 1]) : 0;
                return hits >= peakThreshold && hits >= prev && hits >= next;
            });
            let peakGroup = [];
            let previousPeakX = null;
            peakEntries.forEach(entry => {
                const column = getColumnX(entry);
                if(previousPeakX !== null && column - previousPeakX > 3){
                    pushPeakGroup(peakGroup);
                    peakGroup = [];
                }
                peakGroup.push(entry);
                previousPeakX = column;
            });
            pushPeakGroup(peakGroup);
        };
        columns.forEach(entry => {
            const column = getColumnX(entry);
            if(!Number.isFinite(column)) return;
            if(clusterStart === null || column - lastColumn > 2){
                pushCluster();
                clusterStart = column;
                clusterEntries = [];
            }
            clusterEnd = column;
            lastColumn = column;
            clusterEntries.push(entry);
        });
        pushCluster();
        const mergedCenters = [];
        centers.sort((a, b) => a - b).forEach(center => {
            const lastCenter = mergedCenters[mergedCenters.length - 1];
            if(lastCenter !== undefined && Math.abs(center - lastCenter) <= 5){
                mergedCenters[mergedCenters.length - 1] = (lastCenter + center) / 2;
            } else {
                mergedCenters.push(center);
            }
        });
        return mergedCenters;
    };
    const getPollAverageRecordedPointCenters = (graphElement) => {
        const record = pollAverageCanvasPointLog.get(graphElement);
        if(!record || record.width !== graphElement.width || record.height !== graphElement.height) return null;
        const width = graphElement.width || graphElement.getBoundingClientRect().width;
        const height = graphElement.height || graphElement.getBoundingClientRect().height;
        const scanRight = getPollGraphPointScanRight(width);
        const points = record.points
            .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)
                && point.x >= width * 0.035
                && point.x <= scanRight
                && point.y >= height * 0.045
                && point.y <= height * 0.90)
            .sort((a, b) => a.x - b.x);
        if(points.length < 2) return null;
        const centers = [];
        let cluster = [];
        const pushCluster = () => {
            if(cluster.length === 0) return;
            const weighted = cluster.reduce((sum, point) => {
                const weight = Math.max(1, Number(point.radius) || 1);
                return {
                    x: sum.x + (point.x * weight),
                    weight: sum.weight + weight
                };
            }, { x: 0, weight: 0 });
            if(weighted.weight > 0) centers.push(weighted.x / weighted.weight);
        };
        points.forEach(point => {
            const lastPoint = cluster[cluster.length - 1];
            if(lastPoint && point.x - lastPoint.x > 6){
                pushCluster();
                cluster = [];
            }
            cluster.push(point);
        });
        pushCluster();
        return centers.length >= 2 ? centers : null;
    };
    const getPollAverageRawPointCenters = (graphElement) => {
        if(graphElement.tagName?.toLowerCase() !== "canvas") return null;
        const cached = pollAverageRawPointCenterCache.get(graphElement);
        if(cached?.width === graphElement.width && cached?.height === graphElement.height) return cached.centers;
        const context = graphElement.getContext?.("2d");
        if(!context) return null;
        try {
            const width = graphElement.width;
            const height = graphElement.height;
            const imageData = context.getImageData(0, 0, width, height).data;
            const minX = Math.floor(width * 0.045);
            const maxX = Math.floor(Math.max(minX + 20, getPollGraphPointScanRight(width)));
            const minY = Math.floor(height * 0.07);
            const maxY = Math.floor(height * 0.86);
            const threshold = Math.max(6, Math.floor(height * 0.012));
            const columns = [];
            for(let x = minX; x <= maxX; x++){
                let hits = 0;
                for(let y = minY; y <= maxY; y++){
                    const index = ((y * width) + x) * 4;
                    if(isPollAveragePointPixel(imageData[index], imageData[index + 1], imageData[index + 2], imageData[index + 3])) hits++;
                }
                if(hits >= threshold) columns.push({ x, hits });
            }
            const centers = getPollAveragePointCentersFromColumns(columns);
            const usableCenters = centers.length >= 2 ? centers : null;
            if(usableCenters){
                pollAverageRawPointCenterCache.set(graphElement, {
                    width: graphElement.width,
                    height: graphElement.height,
                    centers: usableCenters
                });
            }
            return usableCenters;
        } catch(_err) {
            return null;
        }
    };
    const getPollAveragePointCenters = (graphElement, weeklyAverages) => {
        if(graphElement.tagName?.toLowerCase() !== "canvas" || weeklyAverages.length < 2) return null;
        const cached = pollAveragePointCenterCache.get(graphElement);
        if(cached?.width === graphElement.width && cached?.height === graphElement.height
            && cached?.length === weeklyAverages.length && cached?.centers) return cached.centers;
        const context = graphElement.getContext?.("2d");
        if(!context) return null;
        try {
            const width = graphElement.width;
            const height = graphElement.height;
            const imageData = context.getImageData(0, 0, width, height).data;
            const minX = Math.floor(width * 0.045);
            const maxX = Math.floor(Math.max(minX + 20, getPollGraphPointScanRight(width)));
            const recordedCenters = getPollAverageRecordedPointCenters(graphElement);
            const usableRecordedCenters = recordedCenters?.length === weeklyAverages.length
                ? recordedCenters
                : null;
            if(usableRecordedCenters){
                pollAveragePointCenterCache.set(graphElement, {
                    width: graphElement.width,
                    height: graphElement.height,
                    length: weeklyAverages.length,
                    centers: usableRecordedCenters
                });
                return usableRecordedCenters;
            }
            const rawCenters = getPollAverageRawPointCenters(graphElement);
            const usableCenters = rawCenters?.length === weeklyAverages.length
                ? rawCenters
                : null;
            if(usableCenters){
                pollAveragePointCenterCache.set(graphElement, {
                    width: graphElement.width,
                    height: graphElement.height,
                    length: weeklyAverages.length,
                    centers: usableCenters
                });
                return usableCenters;
            }
            const axisMinY = Math.floor(height * 0.80);
            const axisMaxY = Math.floor(height * 0.95);
            const axisThreshold = Math.max(4, Math.floor(height * 0.008));
            const axisColumns = [];
            for(let x = minX; x <= maxX; x++){
                let hits = 0;
                for(let y = axisMinY; y <= axisMaxY; y++){
                    const index = ((y * width) + x) * 4;
                    if(isPollAverageAxisPointPixel(imageData[index], imageData[index + 1], imageData[index + 2], imageData[index + 3])) hits++;
                }
                if(hits >= axisThreshold) axisColumns.push({ x, hits });
            }
            const axisCenters = getPollAverageCentersFromColumns(axisColumns);
            const normalizedAxisCenters = axisCenters.length === weeklyAverages.length
                ? axisCenters
                : null;
            if(normalizedAxisCenters){
                pollAveragePointCenterCache.set(graphElement, {
                    width: graphElement.width,
                    height: graphElement.height,
                    length: weeklyAverages.length,
                    centers: normalizedAxisCenters
                });
            }
            if(normalizedAxisCenters) return normalizedAxisCenters;
            const normalizedRawCenters = rawCenters?.length >= 2
                ? normalizePollAverageCenters(rawCenters, weeklyAverages.length)
                : null;
            if(normalizedRawCenters){
                pollAveragePointCenterCache.set(graphElement, {
                    width: graphElement.width,
                    height: graphElement.height,
                    length: weeklyAverages.length,
                    centers: normalizedRawCenters
                });
            }
            return normalizedRawCenters;
        } catch(_err) {
            return null;
        }
    };
    const getPollAverageIndexFromMouse = (event, graphElement, rect, graphWidth, weeklyAverages) => {
        const x = (event.clientX - rect.left) * (graphWidth / rect.width);
        const xCenters = getPollAverageXCenters(graphElement, weeklyAverages, graphWidth);
        if(Array.isArray(xCenters) && xCenters.length === weeklyAverages.length){
            const nearest = xCenters.reduce((best, center, index) => {
                const distance = Math.abs(center - x);
                return distance < best.distance ? { index, distance } : best;
            }, { index: -1, distance: Infinity });
            const spacing = xCenters.length > 1 ? Math.abs(xCenters[1] - xCenters[0]) : 16;
            const tolerance = Math.max(14, spacing * 0.65);
            return nearest.distance <= tolerance ? nearest.index : -1;
        }
        const plotLeft = graphWidth * 0.085;
        const plotRight = Math.max(plotLeft + 1, getPollGraphPlotRight(graphWidth));
        if(x < plotLeft - 12 || x > plotRight + 12) return -1;
        const ratio = Math.max(0, Math.min(1, (x - plotLeft) / (plotRight - plotLeft)));
        return Math.max(0, Math.min(weeklyAverages.length - 1, Math.round(ratio * (weeklyAverages.length - 1))));
    };
    const getPollAverageSelectionFromMouse = (event, graphElement, rect, graphWidth, weeklyAverages) => {
        const x = (event.clientX - rect.left) * (graphWidth / rect.width);
        const xCenters = getPollAverageXCenters(graphElement, weeklyAverages, graphWidth);
        if(Array.isArray(xCenters) && xCenters.length === weeklyAverages.length){
            const nearest = xCenters.reduce((best, center, index) => {
                const distance = Math.abs(center - x);
                return distance < best.distance ? { index, distance } : best;
            }, { index: -1, distance: Infinity });
            const averageSpacing = xCenters.length > 1
                ? (xCenters[xCenters.length - 1] - xCenters[0]) / Math.max(1, xCenters.length - 1)
                : 16;
            const edgePadding = Math.max(12, averageSpacing * 0.55);
            if(x < xCenters[0] - edgePadding || x > xCenters[xCenters.length - 1] + edgePadding) {
                return { index: -1, markerX: null };
            }
            return {
                index: nearest.index,
                markerX: xCenters[nearest.index]
            };
        }
        const index = getPollAverageIndexFromMouse(event, graphElement, rect, graphWidth, weeklyAverages);
        if(index === -1) return { index: -1, markerX: null };
        const plotLeft = graphWidth * 0.085;
        const plotRight = Math.max(plotLeft + 1, getPollGraphPlotRight(graphWidth));
        const markerX = weeklyAverages.length <= 1
            ? plotLeft
            : plotLeft + ((plotRight - plotLeft) * (index / (weeklyAverages.length - 1)));
        return {
            index,
            markerX
        };
    };
    const showPollAverageTooltip = (event, targetElement, boundGraphElement = null) => {
        const graphElement = boundGraphElement?.isConnected
            && isPollAverageGraphCanvas(boundGraphElement)
            ? boundGraphElement
            : getPollAverageGraphElement(targetElement);
        if(!graphElement) {
            hidePollAverageTooltip();
            return;
        }
        if(typeof document.elementFromPoint === "function") {
            const topElement = document.elementFromPoint(event.clientX, event.clientY);
            const graphIsCanvas = graphElement.tagName?.toLowerCase() === "canvas";
            const visibleCanvas = topElement?.closest?.("canvas") || null;
            const pointerIsOnGraph = graphIsCanvas
                ? visibleCanvas === graphElement
                : Boolean(
                    visibleCanvas
                    && graphElement.contains?.(visibleCanvas)
                );
            if(!pointerIsOnGraph) {
                hidePollAverageTooltip();
                return;
            }
        }
        const weeklyAverages = getPollWeeklyAverages();
        if(weeklyAverages.length === 0) {
            hidePollAverageTooltip();
            return;
        }
        const rect = graphElement.getBoundingClientRect();
        if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom){
            hidePollAverageTooltip();
            return;
        }
        const graphWidth = graphElement.tagName?.toLowerCase() === "canvas" && graphElement.width
            ? graphElement.width
            : rect.width;
        const selection = getPollAverageSelectionFromMouse(event, graphElement, rect, graphWidth, weeklyAverages);
        const index = selection.index;
        if(index === -1){
            hidePollAverageTooltip();
            return;
        }
        pollAverageActiveIndex = index;
        pollAverageActiveX = selection.markerX;
        pollAverageActiveGraph = graphElement;
        showPollAverageWeekMarker(graphElement, weeklyAverages, index, selection.markerX);
        const tooltip = ensurePollAverageTooltip();
        tooltip.innerHTML = formatPollAverageTooltipHTML(weeklyAverages[index]);
        const offset = 14;
        const tooltipWidth = tooltip.offsetWidth || 210;
        const tooltipHeight = tooltip.offsetHeight || 90;
        let left = event.clientX + offset;
        let top = event.clientY + offset;
        if(left + tooltipWidth > window.innerWidth - 8) left = event.clientX - tooltipWidth - offset;
        if(top + tooltipHeight > window.innerHeight - 8) top = event.clientY - tooltipHeight - offset;
        tooltip.style.left = `${Math.max(8, left)}px`;
        tooltip.style.top = `${Math.max(8, top)}px`;
        tooltip.style.display = "block";
    };
    const hidePollAverageTooltip = () => {
        if(pollAverageTooltip) pollAverageTooltip.style.display = "none";
        hidePollAverageWeekMarker();
        pollAverageActiveIndex = null;
        pollAverageActiveX = null;
        pollAverageActiveGraph = null;
    };
    const attachPollAverageCanvasTooltips = () => {
        const filters = getPollPageFilters();
        if(!filters) return;
        const canvases = new Set(getPollAverageGraphCanvases());
        const targets = new Set([
            ...document.querySelectorAll("#pollDetailDiv, #pollDetailCanvDiv")
        ]);
        canvases.forEach(canvas => {
            targets.add(canvas);
            if(canvas.parentElement) targets.add(canvas.parentElement);
        });
        let attachedCount = 0;
        targets.forEach(target => {
            const rect = target.getBoundingClientRect();
            if(!isElementVisible(target) || rect.width < 250 || rect.height < 150) return;
            if(pollAverageTooltipTargets.has(target)) return;
            const graphElement = getPollAverageGraphElement(target);
            if(!graphElement) return;
            pollAverageTooltipTargets.add(target);
            target.style.cursor = "crosshair";
            target.addEventListener(
                "mouseenter",
                event => showPollAverageTooltip(event, target, graphElement)
            );
            target.addEventListener(
                "mousemove",
                event => showPollAverageTooltip(event, target, graphElement)
            );
            target.addEventListener("mouseleave", hidePollAverageTooltip);
            attachedCount++;
        });
        globalThis.bmPollAverageTooltipDebug = {
            attachedCount,
            filters,
            pollResults: getIndependentPollResultsData().length,
            targetCount: targets.size
        };
    };
    const scheduleIndependentPollFollowup = delay => {
        const timer = setTimeout(() => {
            independentPollObserverFollowupTimers.delete(timer);
            if(!modShuttingDown) queueIndependentPollDecimalFormatting();
        }, delay);
        independentPollObserverFollowupTimers.add(timer);
    };
    const installIndependentPollObserver = () => {
        if(modShuttingDown) return;
        installPollAverageCanvasRecorder();
        if(independentPollObserver) return;
        if(!document.body) {
            if(independentPollObserverInstallTimer) clearTimeout(independentPollObserverInstallTimer);
            independentPollObserverInstallTimer = setTimeout(() => {
                independentPollObserverInstallTimer = null;
                installIndependentPollObserver();
            }, 100);
            return;
        }
        installPollBattlegroundFilter();
        independentPollObserver = new MutationObserver(mutations => {
            const hoverSelector = "#bm-poll-average-tooltip, .bm-poll-week-marker";
            const isHoverElement = node => {
                const element = node?.nodeType === 1 ? node : node?.parentElement;
                return Boolean(element?.matches?.(hoverSelector) || element?.closest?.(hoverSelector));
            };
            const shouldRefresh = mutations.some(mutation => {
                if(isHoverElement(mutation.target)) return false;
                const changedNodes = [
                    ...Array.from(mutation.addedNodes || []),
                    ...Array.from(mutation.removedNodes || [])
                ];
                return changedNodes.length === 0 || !changedNodes.every(isHoverElement);
            });
            if(shouldRefresh) {
                queueIndependentPollDecimalFormatting();
                if(!hasIndependentPollSurface()) queuePollBattlegroundFilterSync(100);
            }
        });
        independentPollObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        queueIndependentPollDecimalFormatting();
        scheduleIndependentPollFollowup(250);
        scheduleIndependentPollFollowup(1000);
        scheduleIndependentPollFollowup(2000);
        scheduleIndependentPollFollowup(4000);
    };
    const handleModPageExit = () => mod.destroy();
    mod.destroy = () => {
        if(modShuttingDown) return;
        modShuttingDown = true;
        window.removeEventListener("pagehide", handleModPageExit, true);
        window.removeEventListener("beforeunload", handleModPageExit, true);
        document.removeEventListener("click", handleElectionNightThemeClick, true);
        document.removeEventListener("click", handlePresidentialPrimaryTabClick, true);
        document.removeEventListener("click", handleElectionNightSkipEndClick, true);
        activeHouseDistrictDragCleanup?.();
        activeHouseDistrictDragCleanup = null;
        if(rcvResultsEscapeListener) {
            document.removeEventListener("keydown", rcvResultsEscapeListener);
            rcvResultsEscapeListener = null;
        }
        statewideTurnoutDocumentListenerRemovers.forEach(removeListener => removeListener());
        statewideTurnoutDocumentListenerRemovers.length = 0;
        statewideTurnoutDocumentControllerInstalled = false;
        presidentialPrimaryTabResetInstalled = false;
        electionNightSkipEndPrimaryRefreshInstalled = false;
        if(presidentialPrimaryResetTimer) clearTimeout(presidentialPrimaryResetTimer);
        if(nativePrimaryPanelSelectionTimer) clearTimeout(nativePrimaryPanelSelectionTimer);
        if(electionNightThemeClickTimer) clearTimeout(electionNightThemeClickTimer);
        if(msnbcElectionButtonInstallTimer) clearTimeout(msnbcElectionButtonInstallTimer);
        if(independentPollObserverInstallTimer) clearTimeout(independentPollObserverInstallTimer);
        if(independentPollFormatTimer) clearTimeout(independentPollFormatTimer);
        if(pollBattlegroundFilterRefreshTimer) clearTimeout(pollBattlegroundFilterRefreshTimer);
        if(pollBattlegroundResultsRestoreTimer) clearTimeout(pollBattlegroundResultsRestoreTimer);
        if(marginThroughNightUpdateTimer) clearTimeout(marginThroughNightUpdateTimer);
        presidentialPrimaryResetTimer = null;
        nativePrimaryPanelSelectionTimer = null;
        electionNightThemeClickTimer = null;
        msnbcElectionButtonInstallTimer = null;
        independentPollObserverInstallTimer = null;
        independentPollFormatTimer = null;
        pollBattlegroundFilterRefreshTimer = null;
        pollBattlegroundResultsRestoreTimer = null;
        independentPollFormatQueued = false;
        pollBattlegroundFilterActive = false;
        restorePollBattlegroundResults();
        pollBattlegroundStateCodesCache = null;
        independentPollFilterSelectsCache = null;
        if(pollBattlegroundFilterInstalled) {
            document.removeEventListener("change", handlePollBattlegroundFilterChange, true);
            window.removeEventListener("change", restorePollBattlegroundResults, false);
            pollBattlegroundFilterInstalled = false;
        }
        clearPollBattlegroundRowFiltering();
        pollWeeklyAveragesCache = null;
        marginThroughNightUpdateTimer = null;
        marginThroughNightUpdateQueued = false;
        Object.keys(nativePanelSelectedStateByElectionType).forEach(key => {
            delete nativePanelSelectedStateByElectionType[key];
        });
        independentPollObserverFollowupTimers.forEach(timer => clearTimeout(timer));
        independentPollObserverFollowupTimers.clear();
        electionNightSkipEndRefreshTimers.forEach(timer => clearTimeout(timer));
        electionNightSkipEndRefreshTimers.clear();
        if(electionNightThemeMonitor) clearInterval(electionNightThemeMonitor);
        if(msnbcElectionButtonVisibilityTimer) clearInterval(msnbcElectionButtonVisibilityTimer);
        if(msnbcElectionPanelRefreshTimer) clearInterval(msnbcElectionPanelRefreshTimer);
        if(msnbcElectionPanelHydrationTimer) clearInterval(msnbcElectionPanelHydrationTimer);
        if(houseDistrictTooltipRefreshTimer) clearInterval(houseDistrictTooltipRefreshTimer);
        if(tooltipComponents.pollClosingTimer) clearInterval(tooltipComponents.pollClosingTimer);
        electionNightThemeMonitor = null;
        msnbcElectionButtonVisibilityTimer = null;
        msnbcElectionPanelRefreshTimer = null;
        msnbcElectionPanelHydrationTimer = null;
        houseDistrictTooltipRefreshTimer = null;
        tooltipComponents.pollClosingTimer = null;
        independentPollObserver?.disconnect();
        marginThroughNightObserver?.disconnect();
        independentPollObserver = null;
        marginThroughNightObserver = null;
        electionNightMapButtonObservers.forEach(observer => observer?.disconnect?.());
        electionNightMapButtonObservers.clear();
        msnbcElectionPanelObserver = null;
        try {
            stateCountyZoomController?.destroy?.();
        } catch(error) {}
        try {
            precinctResultsController?.destroy?.();
        } catch(error) {}
        try {
            cityMayoralMap?.destroy?.();
        } catch(error) {}
        try {
            specialElectionNight?.destroy?.();
        } catch(error) {}
        try {
            ballotMeasuresSubmod?.destroy?.();
        } catch(error) {}
        try {
            votingBooth?.destroy?.();
        } catch(error) {}
        stateCountyZoomController = null;
        precinctResultsController = null;
        cityMayoralMap = null;
        specialElectionNight = null;
        ballotMeasuresSubmod = null;
        votingBooth = null;
        globalThis.bmPrecinctResults = null;
        globalThis.bmCityMayoralMap = null;
        removePresidentialPrimaryNationalControls();
        pauseElectionNightTheme({ reset: true });
        if(electionNightThemeAudio) {
            electionNightThemeAudio.pause();
            electionNightThemeAudio = null;
        }
        electionNightThemePlayPending = false;
        if(lastUpdateDataHook !== null) {
            try {
                Executive.functions.deregisterPostHook("electNightUpdateData", lastUpdateDataHook);
            } catch(error) {}
            lastUpdateDataHook = null;
        }
        for(let index = managedPostHooks.length - 1; index >= 0; index -= 1) {
            const hook = managedPostHooks[index];
            try {
                Executive.functions.deregisterPostHook(hook.functionName, hook.index);
            } catch(error) {}
        }
        managedPostHooks.length = 0;
        [
            "bm-msnbc-election-overlay",
            "bm-msnbc-poll-overlay",
            "bm-msnbc-election-btn",
            "bm-chance-simulations-overlay"
        ].forEach(id => document.getElementById(id)?.remove());
        pollAverageTooltip?.remove();
        pollAverageWeekMarker?.remove();
        marginThroughNightTooltip?.remove();
        rcvResultsModal?.remove();
        pollAverageTooltip = null;
        pollAverageWeekMarker = null;
        marginThroughNightTooltip = null;
        rcvResultsModal = null;
        modInitialized = false;
    };
    mod.init = () => {
        if(modInitialized) return;
        modInitialized = true;
        modShuttingDown = false;
        window.addEventListener("pagehide", handleModPageExit, true);
        window.addEventListener("beforeunload", handleModPageExit, true);
        Executive.styles.registerStyle("styles/general.css");
        Executive.styles.registerStyle("styles/special-election-night.css");
        Executive.styles.registerStyle("styles/voting-booth.css");
        Executive.styles.registerThemeAwareStyle("styles/light.css", "styles/dark.css");
        const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
        config = JSON.parse(configText);
        ballotMeasuresSubmod = createBallotMeasuresSubmod({
            fs,
            path,
            basePath: Executive.mods.getRelativePathPrefix(),
            getCurrentYear: () => Number(
                typeof currentYear !== "undefined"
                    ? currentYear
                    : globalThis.currentYear
            ),
            getCurrentWeek: () => Number(
                typeof weekNum !== "undefined"
                    ? weekNum
                    : globalThis.weekNum
            ),
            getElectionNightTime: () => Number(
                typeof electNightTime !== "undefined"
                    ? electNightTime
                    : globalThis.electNightTime
            ),
            getElectionNightMaxTime: () => Number(
                typeof electNightMaxTime !== "undefined"
                    ? electNightMaxTime
                    : globalThis.electNightMaxTime
            ),
            playClick: () => {
                if(typeof playClick === "function") playClick();
            }
        });
        ballotMeasuresSubmod.install();
        const getCandidateCharacterArrayForParty = candidate => {
            if(Array.isArray(candidate)) return candidate;
            for(const key of ["characterArray", "character", "candArray", "array"]) {
                try {
                    if(Array.isArray(candidate?.[key])) return candidate[key];
                } catch {}
            }
            try {
                const candidateId = candidate?.id
                    ?? candidate?.ID
                    ?? candidate?.candID
                    ?? candidate?.candidateId
                    ?? candidate?.candidateID
                    ?? candidate?.characterId
                    ?? candidate?.characterID;
                if(candidateId !== undefined && candidateId !== null) {
                    const found = findCandByID([candidateId])?.[0];
                    if(Array.isArray(found)) return found;
                    if(Array.isArray(found?.characterArray)) return found.characterArray;
                }
            } catch {}
            return null;
        };

        const readPartyFromCharacterArray = characterArray => {
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            let extended = null;
            try { extended = characterArray?.[candidateEnum.extendedAttribs ?? 178]; } catch {}
            let caucus = "";
            try { caucus = String(characterArray?.[candidateEnum.caucusParty ?? 0] ?? "").trim(); } catch {}
            return { party: String(extended?.party ?? "").trim(), caucus };
        };

        const resolveActualCandidateParty = candidate => {
            if(!candidate) return null;
            let party = "";
            let caucus = "";
            const characterArray = getCandidateCharacterArrayForParty(candidate);
            if(characterArray) {
                const read = readPartyFromCharacterArray(characterArray);
                party = read.party;
                caucus = read.caucus;
            }
            if(!party) {
                try {
                    party = String(
                        candidate?.extendedAttribs?.party ?? candidate?.party ?? ""
                    ).trim();
                } catch {}
            }
            if(!caucus) {
                try {
                    caucus = String(
                        candidate?.caucusParty
                        ?? candidate?.caucus
                        ?? candidate?.extendedAttribs?.caucusParty
                        ?? ""
                    ).trim();
                } catch {}
            }
            if(!party) return null;
            const partyInitial = party.charAt(0).toUpperCase();
            if(partyInitial === "D") return "D";
            if(partyInitial === "R") return "R";
            if(partyInitial === "I") {
                const caucusInitial = caucus.charAt(0).toUpperCase();
                if(caucusInitial === "D") return "ID";
                if(caucusInitial === "R") return "IR";
                return "I";
            }
            return null;
        };
        const resolvePrimaryCandidatePartyKey = resolveActualCandidateParty;

        const getCandidateIdentityKey = candidate => {
            if(!candidate) return "";
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            const characterArray = getCandidateCharacterArrayForParty(candidate);
            let identity = null;
            try {
                identity = characterArray?.[candidateEnum.candidateId ?? 111]
                    ?? candidate?.candidateId
                    ?? candidate?.id
                    ?? candidate?.candID;
            } catch {}
            const normalizedId = String(identity ?? "").trim();
            if(normalizedId && normalizedId !== "0") return `id:${normalizedId}`;
            let first = "";
            let last = "";
            try {
                first = characterArray?.[candidateEnum.firstName ?? 4] ?? candidate?.firstName ?? "";
                last = characterArray?.[candidateEnum.lastName ?? 5] ?? candidate?.lastName ?? "";
            } catch {}
            const name = `${first} ${last}`.replace(/\s+/g, " ").trim().toLowerCase();
            return name ? `name:${name}` : "";
        };

        const PRESIDENTIAL_TICKETS = [
            {
                party: "D",
                nominees: ["demPresNominee", "demPresidentNominee", "demNominee"],
                runningMates: ["demRunningMate", "demVPNominee", "demVP", "potentDemVicePres"]
            },
            {
                party: "R",
                nominees: ["repPresNominee", "repPresidentNominee", "repNominee"],
                runningMates: ["repRunningMate", "repVPNominee", "repVP", "potentRepVicePres"]
            }
        ];

        const resolveNominationTicketParty = candidate => {
            const identity = getCandidateIdentityKey(candidate);
            if(identity) {
                for(const ticket of PRESIDENTIAL_TICKETS) {
                    for(const name of ticket.nominees) {
                        let nominee = null;
                        try { nominee = readRuntimeValue(name); } catch {}
                        if(!nominee || (Array.isArray(nominee) && nominee.length === 0)) continue;
                        if(getCandidateIdentityKey(nominee) === identity) return ticket.party;
                    }
                }
            }
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            const characterArray = getCandidateCharacterArrayForParty(candidate);
            let caucus = "";
            try {
                caucus = String(
                    characterArray?.[candidateEnum.caucusParty ?? 0]
                    ?? candidate?.caucusParty
                    ?? candidate?.caucus
                    ?? ""
                ).trim().charAt(0).toUpperCase();
            } catch {}
            if(caucus === "D" || caucus === "R") return caucus;
            const ownParty = String(candidate?.party ?? "").trim().charAt(0).toUpperCase();
            return ownParty === "D" || ownParty === "R" ? ownParty : "";
        };

        const resolveTicketRunningMateName = ticketPartyKey => {
            const ticket = PRESIDENTIAL_TICKETS.find(entry => entry.party === ticketPartyKey);
            if(!ticket) return "";
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            const readName = value => {
                if(!value) return "";
                const source = Array.isArray(value) && Array.isArray(value[0]) ? value[0] : value;
                if(Array.isArray(source)) {
                    const first = source[candidateEnum.firstName ?? 4];
                    const last = source[candidateEnum.lastName ?? 5];
                    return [first, last]
                        .filter(part => typeof part === "string" && part.trim())
                        .join(" ")
                        .trim();
                }
                if(typeof source === "object") {
                    return [source.firstName, source.lastName]
                        .filter(part => typeof part === "string" && part.trim())
                        .join(" ")
                        .trim();
                }
                return typeof source === "string" ? source.trim() : "";
            };
            for(const name of ticket.runningMates) {
                let value = null;
                try { value = readRuntimeValue(name); } catch {}
                const resolved = readName(value);
                if(resolved) return resolved;
            }
            return "";
        };
        votingBooth = createVotingBooth({
            getCurrentYear: () => Number(
                typeof currentYear !== "undefined"
                    ? currentYear
                    : globalThis.currentYear
            ),
            getBallotMeasures: stateId => {
                try {
                    const store = ballotMeasuresSubmod?.getStore?.();
                    const measures = Array.isArray(store?.measures) ? store.measures : [];
                    const catalogue = Array.isArray(ballotMeasuresSubmod?.catalogue)
                        ? ballotMeasuresSubmod.catalogue
                        : [];
                    const year = Number(
                        typeof currentYear !== "undefined" ? currentYear : globalThis.currentYear
                    );
                    const normalizedState = String(stateId || "").toUpperCase();
                    return measures
                        .filter(measure => {
                            const measureState = String(measure?.stateId || "").toUpperCase();
                            if(measureState && normalizedState && measureState !== normalizedState) {
                                return false;
                            }
                            const measureYear = Number(measure?.electionYear);
                            return !Number.isFinite(year)
                                || !Number.isFinite(measureYear)
                                || measureYear === year;
                        })
                        .map(measure => {
                            const entry = catalogue.find(
                                catalogueEntry => catalogueEntry?.id === measure?.catalogueId
                            ) || {};
                            return {
                                title: entry.title || measure?.title || "",
                                question: entry.question || entry.description || "",
                                stateId: measure?.stateId || ""
                            };
                        })
                        .filter(measure => measure.title);
                } catch {
                    return [];
                }
            },
            resolveCandidateParty: candidate => {
                try {
                    const resolved = resolveActualCandidateParty(candidate);
                    if(resolved === "ID") return { party: "I", caucus: "D" };
                    if(resolved === "IR") return { party: "I", caucus: "R" };
                    if(resolved === "I") return { party: "I", caucus: "" };
                    if(resolved === "D" || resolved === "R") return { party: resolved, caucus: "" };
                    return null;
                } catch {
                    return null;
                }
            },
            isRankedChoiceRace: (electionType, stateId, race) => {
                try {
                    return Boolean(isRcvResultsRace(electionType, stateId, race));
                } catch {
                    return false;
                }
            },
            resolveTicketParty: candidate => {
                try {
                    return resolveNominationTicketParty(candidate);
                } catch {
                    return "";
                }
            },
            getRunningMateForTicket: ticketPartyKey => {
                try {
                    return resolveTicketRunningMateName(ticketPartyKey);
                } catch {
                    return "";
                }
            },
            debugCandidateShape: candidate => {
                try {
                    if(votingBoothShapeDumped) return;
                    votingBoothShapeDumped = true;
                    const characterArray = getCandidateCharacterArrayForParty(candidate);
                    let ownKeys = [];
                    try { ownKeys = Object.keys(candidate || {}).slice(0, 60); } catch {}
                    fs.writeFileSync(
                        Executive.mods.getRelativePathPrefix() + path.sep + "voting-booth-debug.json",
                        JSON.stringify({
                            isArray: Array.isArray(candidate),
                            type: typeof candidate,
                            length: candidate?.length,
                            ownKeys,
                            hasExtendedAttribs: Boolean(candidate?.extendedAttribs),
                            extendedAttribsParty: candidate?.extendedAttribs?.party ?? null,
                            directParty: candidate?.party ?? null,
                            caucusParty: candidate?.caucusParty ?? candidate?.caucus ?? null,
                            idFields: {
                                id: candidate?.id ?? null,
                                candidateId: candidate?.candidateId ?? null,
                                candID: candidate?.candID ?? null
                            },
                            foundCharacterArray: Array.isArray(characterArray),
                            characterArrayLength: characterArray?.length ?? null,
                            characterArraySlot0: characterArray?.[0] ?? null,
                            characterArrayParty: characterArray?.[178]?.party ?? null,
                            resolved: resolveActualCandidateParty(candidate)
                        }, null, 2),
                        "utf8"
                    );
                } catch {}
            },
            playClick: () => {
                if(typeof playClick === "function") playClick();
            }
        });
        votingBooth.install();
        specialElectionNight = createSpecialElectionNight({
            fs,
            path,
            basePath: Executive.mods.getRelativePathPrefix(),
            getCurrentYear: () => Number(
                typeof currentYear !== "undefined"
                    ? currentYear
                    : globalThis.currentYear
            ),
            getCurrentWeek: () => Number(
                typeof weekNum !== "undefined"
                    ? weekNum
                    : globalThis.weekNum
            ),
            getActiveEvents: () => (
                typeof activeEvents !== "undefined"
                    ? activeEvents
                    : globalThis.activeEvents
            ),
            getHouseElectionNight: () => (
                typeof electNightUSH !== "undefined"
                    ? electNightUSH
                    : globalThis.electNightUSH
            ),
            getSenateElectionNight: () => (
                typeof electNightUSS !== "undefined"
                    ? electNightUSS
                    : globalThis.electNightUSS
            ),
            getStateNews: () => (
                typeof stateNews !== "undefined" && Array.isArray(stateNews)
                    ? stateNews
                    : globalThis.stateNews
            ),
            getNationNews: () => (
                typeof nationNews !== "undefined" && Array.isArray(nationNews)
                    ? nationNews
                    : globalThis.nationNews
            ),
            getHouseDistricts: stateId => {
                const rawDistricts = typeof houseDistricts !== "undefined" && Array.isArray(houseDistricts)
                    ? houseDistricts
                    : globalThis.houseDistricts;
                if(!stateId) return rawDistricts;
                const currentDistricts = getHouseDistricts(stateId, true);
                if(currentDistricts.length) return currentDistricts;
                const stateCode = String(stateId).toUpperCase();
                return Array.isArray(rawDistricts)
                    ? rawDistricts.filter(district => String(
                        district?.state
                        ?? district?.stateId
                        ?? district?.stateID
                        ?? district?.stateCode
                        ?? ""
                    ).toUpperCase() === stateCode)
                    : [];
            },
            getStateHouseElectStats: () => (
                typeof stateHouseElectStats !== "undefined"
                    ? stateHouseElectStats
                    : globalThis.stateHouseElectStats
            ),
            getStateSenateElectStats: () => (
                typeof stateSenateElectStats !== "undefined"
                    ? stateSenateElectStats
                    : globalThis.stateSenateElectStats
            ),
            getRuntimeValue: name => readRuntimeValue(name),
            getCandidateById: id => {
                try {
                    const matches = findCandByID([id]);
                    return Array.isArray(matches) ? matches[0] : matches;
                } catch {
                    return null;
                }
            },
            playClick: () => {
                if(typeof playClick === "function") playClick();
            }
        });
        specialElectionNight.install();
        const resolvePrecinctStatewideCandidate = (candidate, race) => {
            return resolveElectionCandidate(candidate, race?.cands || []);
        };
        precinctResultsController = createPrecinctResultsController({
            fs,
            path,
            getBasePath: () => Executive.mods.getRelativePathPrefix(),
            getCandidateName: candidate => getPanelCandidateName(candidate),
            getCandidateParty: candidate => getCandidateVariantPartyKey(candidate),
            getCandidateSource: (candidate, race) =>
                resolvePrecinctStatewideCandidate(candidate, race),
            getCandidateIdeology: candidate => getChanceCandidateIdeology(
                candidate,
                getCandidateVariantPartyKey(candidate)
            ),
            getCandidateColour: (candidate, race) => stringifyColour(
                getCandidateColourForRace(
                    resolvePrecinctStatewideCandidate(candidate, race),
                    race
                )
            ),
            createMarginColourResolver: race => {
                const baseColourCache = new WeakMap();
                return (candidate, margin) => {
                    if(!candidate) return stringifyColour(config.partyColours.HouseTie);
                    const statewideCandidate = resolvePrecinctStatewideCandidate(
                        candidate,
                        race
                    );
                    let baseColour = baseColourCache.get(statewideCandidate);
                    if(!baseColour) {
                        baseColour = getCandidateColourForRace(statewideCandidate, race);
                        baseColourCache.set(statewideCandidate, baseColour);
                    }
                    return stringifyColour(getElectionMarginColour(baseColour, margin));
                };
            },
            getResultsTooltip: () => tooltipDiv,
            renderResultsTooltip: renderPrecinctResultsTooltip,
            hideResultsTooltip: hidePrecinctResultsTooltip,
            deactivateTurnout: resetStatewideTurnoutMode,
            hideNativeTooltip: hideNativeMapTooltipForTurnout,
            onActiveChange: precinctsActive => {
                const controls = document.getElementById("bm-state-county-zoom-controls");
                if(!controls) return;
                if(precinctsActive) {
                    controls.style.setProperty("display", "none", "important");
                } else {
                    controls.style.removeProperty("display");
                    stateCountyZoomController?.positionControls?.();
                }
            },
            getActiveMapMode: () => activeCountyMapMode,
            setActiveMapMode: mode => {
                activeCountyMapMode = Object.values(MAP_MODES).includes(mode)
                    ? mode
                    : MAP_MODES.MARGIN;
                document.querySelectorAll("#bm-primary-county-view-controls [data-map-mode]")
                    .forEach(button => {
                        button.classList.toggle(
                            "bm-primary-county-view-active",
                            button.dataset.mapMode === activeCountyMapMode
                        );
                    });
            },
            refreshCountyMap: () => {
                if(cityMayoralMap?.isActive?.()) {
                    cityMayoralMap.refresh();
                    return;
                }
                const svg = document.getElementById(
                    `${lastMapElectionType}-map${lastMapLive ? "-live" : ""}`
                );
                if(svg?.isConnected && onCountyMap) {
                    updateCountyMap(svg, lastMapElectionType, lastMapLive);
                }
            },
            playClick
        });
        globalThis.bmPrecinctResults = precinctResultsController;
        cityMayoralMap = createCityMayoralMap({
            fs,
            path,
            os,
            Executive,
            getBasePath: () => Executive.mods.getRelativePathPrefix(),
            readRuntimeValue,

            getPlayerCharacter: () => {
                try {
                    if(typeof player !== "undefined" && player) return player;
                } catch {}
                try {
                    return Executive?.data?.characters?.player || null;
                } catch {
                    return null;
                }
            },
            getCandidateById: id => {
                try {
                    const matches = findCandByID([id]);
                    return Array.isArray(matches) ? matches[0] : matches;
                } catch {
                    return null;
                }
            },
            precinctResultsController,
            getCandidateName: candidate => getPanelCandidateName(candidate),
            getCandidateParty: candidate => getCandidateVariantPartyKey(candidate),
            getCandidateColour: (candidate, race) => stringifyColour(
                getCandidateColourForRace(candidate?.source || candidate, race)
            ),
            createMarginColourResolver: race => {
                const baseColourCache = new WeakMap();
                return (candidate, margin) => {
                    const sourceCandidate = candidate?.source || candidate;
                    if(!sourceCandidate) return stringifyColour(config.partyColours.HouseTie);
                    let baseColour = baseColourCache.get(sourceCandidate);
                    if(!baseColour) {
                        baseColour = getCandidateColourForRace(sourceCandidate, race);
                        baseColourCache.set(sourceCandidate, baseColour);
                    }
                    return stringifyColour(getElectionMarginColour(baseColour, margin));
                };
            },
            getCandidateProfile: candidate => candidate?.source || candidate,
            renderResultsTooltip: renderPrecinctResultsTooltip,
            hideResultsTooltip: hidePrecinctResultsTooltip,
            playClick
        });
        cityMayoralMap.install();
        globalThis.bmCityMayoralMap = cityMayoralMap;
        configurePrimaryCountyResults({
            getElectionType: () => activePrimaryCountyElectionType || lastMapElectionType,
            getRace: (stateId, electionType) => getStatewideRaceForMap(electionType, stateId, { allowArchive: !lastMapLive }),
            getElectionData: stateId => getHouseStateElectionData(stateId),
            getStateData: stateId => Executive?.data?.states?.[String(stateId || "").toLowerCase()],
            getPrimaryCountySubdivisions: stateId => {
                if(String(stateId || "").toUpperCase() !== "DC") return null;
                return getDcWardBaselines().map(ward => {
                    const total = ward.D + ward.R + ward.I;
                    const majorPartyTotal = ward.D + ward.R;
                    return {
                        name: ward.name,
                        ward: ward.ward,
                        population: total,
                        registeredVoters: total,
                        democrat: ward.D,
                        republican: ward.R,
                        partisanLean: majorPartyTotal > 0
                            ? (ward.D - ward.R) / majorPartyTotal
                            : 0
                    };
                });
            },
            getVisibleVotes: (candidate, stateId, electionType) => {
                if(lastMapLive && electionType === "president") {
                    if(isElectionNightFinished()) return Math.max(0, Number(candidate?.votes) || 0);
                    const currentVotes = Number(candidate?.currentVotes);
                    return Number.isFinite(currentVotes) && currentVotes > 0
                        ? currentVotes
                        : 0;
                }
                return getPrimaryVisibleVotes(
                    candidate,
                    lastMapLive,
                    getHouseStateElectionData(stateId)
                );
            },
            getCandidateParty: candidate => {
                try {
                    return resolveActualCandidateParty(candidate);
                } catch {
                    return null;
                }
            },
            getCandidateProfile: candidate => {
                try {
                    const rawCandidate = findCandByID([candidate?.id])[0];
                    if(!rawCandidate) return candidate;
                    const wrapped = Executive.data.characters.wrapCharacter(rawCandidate, "candidate");
                    return {
                        ...rawCandidate,
                        ...wrapped,
                        ...(wrapped?.extendedAttribs || {})
                    };
                } catch {
                    return candidate;
                }
            }
        });
        installPresidentialPrimaryTabReset();
        setPrimaryCountyResultResolver((electionType, stateId, countyName) => {
            if(
                onCountyMap
                && electionType === "president"
                && String(stateId || "").toUpperCase() === "DC"
                && !activePrimaryCountyParty
            ) {
                const dcRace = getStatewideRaceWithMapSubdivisions(
                    electionType,
                    stateId,
                    lastMapLive
                );
                const normalizedWardName = normalizePrimaryCountyName(countyName, stateId);
                const ward = dcRace?.counties?.find(candidateWard =>
                    normalizePrimaryCountyName(candidateWard.name, stateId) === normalizedWardName
                    || normalizePrimaryCountyName(candidateWard.id, stateId) === normalizedWardName
                );
                if(ward) return ward;
            }
            if(!onCountyMap
                || activePrimaryCountyElectionType !== electionType
                || !activePrimaryCountyParty) return null;
            const countyResult = getPrimaryCountyResult(
                stateId,
                activePrimaryCountyParty,
                countyName,
                electionType
            );
            if(!countyResult) return null;
            const countyTurnout = getPrimaryCountyTurnout(
                stateId,
                countyName,
                electionType
            );
            return {
                ...countyResult,
                turnoutVotes: countyTurnout.totalVotes,
                turnoutCurrentVotes: countyTurnout.totalCurrVotes,
                turnoutReporting: countyTurnout.reporting,
                turnoutFullyReported: countyTurnout.fullyReported
            };
        });
        createTooltip();
        if (!houseDistrictTooltipRefreshTimer) {
            houseDistrictTooltipRefreshTimer = setInterval(() => {
                if(!modShuttingDown) refreshActiveHouseDistrictTooltip();
            }, 500);
        }
        Executive.functions.registerReplacement("electPageMap", newElectPageMap);
        Executive.functions.registerReplacement("electNightMap", newElectNightMap);
        Executive.functions.registerReplacement("eSimUSCanvas", newSimUSCanvas);
        Executive.functions.registerReplacement("summaryNationMap", newSummaryNationMap);
        const openVotingBoothForElectionNight = () => {
            try { votingBooth?.openForElectionNight(); } catch {}
        };
        ["electNightPresFunc", "electNightUSSFunc", "electNightUSHFunc", "electNightGovFunc"]
            .forEach(functionName => {
                try {
                    Executive.functions.registerPreHook(
                        functionName,
                        openVotingBoothForElectionNight
                    );
                } catch {
                    registerManagedPostHook(functionName, openVotingBoothForElectionNight);
                }
            });
        registerManagedPostHook("electNightUSSFunc", createMapChangeObserver("usSenate"));
        registerManagedPostHook("electNightUSSFunc", queueMarginThroughNightChartUpdate);
        registerManagedPostHook("electNightUSHFunc", createMapChangeObserver("usHouse"));
        registerManagedPostHook("electNightUSHFunc", () => {
            refreshHouseBaseTabFromElectionNight({ reason: "house-native-render" });
        });
        registerManagedPostHook("electNightGovFunc", createMapChangeObserver("governor"));
        registerManagedPostHook("electNightGovFunc", queueMarginThroughNightChartUpdate);
        registerManagedPostHook("electNightPresFunc", createMapChangeObserver("president"));
        registerManagedPostHook("electNightPresFunc", queueMarginThroughNightChartUpdateBurst);
        registerManagedPostHook("electNightUpdateData", () => {
            runWithPreservedMapSelection(() => {
                hydrateMarginThroughNightBackgroundRaces(false);
                if(onCountyMap !== true && !isHouseStateDistrictViewActive()) {
                    refreshHouseBaseTabFromElectionNight({ reason: "election-night-update" });
                }
            });
            queueMarginThroughNightChartUpdateBurst();
            if(onCountyMap && (lastMapElectionType === "usSenate" || lastMapElectionType === "governor")) {
                const canvas = document.getElementById("electNightCanvas");
                if(canvas?.parentElement) {
                    syncRcvResultsButton(
                        canvas.parentElement,
                        canvas,
                        lastMapElectionType,
                        true,
                        false
                    );
                }
            }
        });
        if(config.showPanePartyID === true){
            registerManagedPostHook("houseElectPage", addPartyID);
            registerManagedPostHook("senateElectPage", addPartyID);
            registerManagedPostHook("governorElectPage", addPartyID);
        }
        registerManagedPostHook("independentPolls", queueIndependentPollDecimalFormatting);
        registerManagedPostHook("addIntroMenu", () => {
            if(Executive.game?.loaded) handleModPageExit();
        });
        installIndependentPollObserver();
        installMarginThroughNightObserver();
        installElectionNightTheme();
        installElectionNightSkipEndPrimaryRefresh();
        try {
            installMsnbcElectionPanel();
        } catch (error) {
            globalThis.bmMsnbcElectionPanelError = error;
        }
    };
    module.exports = mod;
}
