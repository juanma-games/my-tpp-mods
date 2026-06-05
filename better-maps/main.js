{
    const path = require("path");
    const fs = require("fs");
    const d3 = require("./third-party/d3.v7.min.js");
    const resultProxies = require("./proxies.js");
    const {getCandidateColour, getPoliticianColour, stringifyColour} = require("./colours.js");
    const mod = {};
    const originalElectPageMap = Executive.functions.getOriginalFunction("electPageMap");
    const originalElectNightMap = Executive.functions.getOriginalFunction("electNightMap");
    const originalSummaryNationMap = Executive.functions.getOriginalFunction("summaryNationMap");
    const { tooltipDiv, tooltipComponents, updateTooltip, updateHouseStateTooltip, updateHouseDistrictTooltip, getHouseDistrictFlipData, shouldRevealHouseDistrictResults, getLiveHouseDistrictSnapshot, hasVisibleHouseStateResults, refreshLiveStateResultsForTooltip, createTooltip, updateSenateControlBanner, updateHouseControlBanner } = require("./tooltip.js");
    let config = null;
    let onCountyMap = false;
    let lastMapElectionType = "none";
    let houseDistrictGridState = null;
    let houseDistrictTooltipTarget = null;
    let houseDistrictGridMode = "projections";
    let houseDistrictTooltipRefreshTimer = null;
    let lastHouseDistrictGridFillRefresh = 0;
    let lastUpdateDataHook = null;
    let independentPollObserver = null;
    let independentPollFormatQueued = false;
    let pollAverageTooltip = null;
    let independentPollResultsCache = null;
    let lastIndependentPollScan = 0;
    let pollAveragePointCenterCache = new WeakMap();
    let pollAverageRawPointCenterCache = new WeakMap();
    let pollAverageCanvasPointLog = new WeakMap();
    let pollAverageCanvasRecorderInstalled = false;
    const pollAverageTooltipTargets = new WeakSet();
    const pollAverageVisualOverlays = new WeakMap();
    let pollAverageActiveIndex = null;
    let pollAverageActiveX = null;
    let pollAverageActiveGraph = null;
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
        "District of Columbia": "DC", "National": "national"
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
    const getPreviousPresidentialWinnerParty = (stateId) => {
        let archive = null;
        try {
            archive = (typeof presidentArchive !== "undefined") ? presidentArchive : globalThis.presidentArchive;
        } catch {}
        if(!Array.isArray(archive)) return null;
        let gameYear = null;
        try {
            gameYear = Number((typeof currentYear !== "undefined") ? currentYear : globalThis.currentYear);
        } catch {}
        const previousGeneral = archive
            .filter(entry => entry.category === "general"
                && (!Number.isFinite(gameYear) || Number(entry.year) < gameYear))
            .sort((a, b) => Number(b.year) - Number(a.year))[0];
        if(!previousGeneral) return null;
        const stateName = Executive.data.states[stateId.toLowerCase()]?.name;
        const previousState = (previousGeneral.exitPoll?.states || previousGeneral.states || [])
            .find(state => state.name === stateName);
        if(!previousState) return null;
        const previousWinner = (previousState.candidates || previousState.cands || [])
            .slice()
            .sort((cand1, cand2) => Number(cand2.totVotes ?? cand2.votes ?? 0) - Number(cand1.totVotes ?? cand1.votes ?? 0))[0];
        return previousWinner?.party || null;
    };
    const updateMap = (svgMap, resultColours, electionType, live, projected) => {
        svgMap.setAttribute("data-colours", JSON.stringify(resultColours));
        const resultKeys = Object.keys(resultColours);
        if (electionType === "usHouse" && live) {
            svgMap.querySelectorAll(".better-maps-state-path").forEach(path => {
                path.style.fill = "#cccccc";
            });
        }
        const raceInfoCache = {};
        const majorities = [];
        let majorityScale = null;
        if(electionType === "usHouse" || electionType === "usHousePol") {
            majorityScale = d3.scaleLinear(
                d3.extent([0, 1]),
                [0.625, 1.375]
            );
        } else if(!projected) {
            resultKeys.forEach(stateId => {
                const currentDistrict = resultProxies[electionType][stateId];
                if(currentDistrict !== undefined && currentDistrict.cands !== undefined) {
                    raceInfoCache[stateId] = getRaceInfo(currentDistrict, live);
                    const distMajority = raceInfoCache[stateId].currentLead / (live ? currentDistrict.totalCurrVotes : currentDistrict.totalVotes);
                    if(distMajority !== 1) majorities.push(distMajority);
                    raceInfoCache[stateId].currentMajority = distMajority;
                }
            });
            if(config.useRelativeColourScale){
                if(majorities.length > 0){
                    majorityScale = d3.scaleLinear(
                        d3.extent(majorities),
                        [0.625, 1.375]
                    );
                };
            } else {
                majorityScale = d3.scaleLinear(
                    d3.extent([0, 0.35]),
                    [0.625, 1.375]
                );
            }
        }
        resultKeys.forEach(stateId => {
            const currentDistrict = resultProxies[electionType][stateId];
            const isHousePrimaryStateMap = electionType === "usHouse" && isHousePrimaryState(currentDistrict);
            if (electionType === "usHouse" && live) {
                if (!hasHouseStateStartedCounting(stateId)) {
                    d3.select("#" + stateId + "-state-path-live")
                        .style("fill", "#cccccc");
                    return;
                }
                const hasRealHouseResults = currentDistrict && (
                    isHousePrimaryStateMap
                        ? hasVisibleHousePrimaryStateVotes(stateId, currentDistrict, true)
                        : hasVisibleHouseStateResults(stateId, true)
                );
                if (!hasRealHouseResults) {
                    d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                        .style("fill", "#cccccc");
                    return;
                }
            }
            if ((electionType === "usSenate" || electionType === "governor") && isStatewidePrimaryRace(currentDistrict)) {
                const primaryFill = getStatewidePrimaryStateFill(svgMap, stateId, currentDistrict, live, electionType);
                d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                    .style("fill", primaryFill || "#cccccc");
                return;
            }
            if(currentDistrict !== undefined && (electionType === "usHouse" || electionType === "usHousePol"
                || electionType === "governorPol" || electionType === "usSenatePol"
                || currentDistrict.cands !== undefined)) {
                let raceInfo = null;
                let newColour = null;
                if(electionType === "usHouse" || electionType === "usHousePol") {
                    if (isHousePrimaryStateMap) {
                        newColour = getHousePrimaryStateColour(stateId, currentDistrict, live) || "#cccccc";
                    } else {
                        newColour = getHouseStatePopularVoteColour(stateId, currentDistrict, live);
                        if (!newColour) {
                    const leadParty = (currentDistrict.projectedDem > currentDistrict.projectedRep) ? "D" : "R";
                    const baseColour = config.partyColours[leadParty];
                    const majority = ((leadParty === "D") ? (currentDistrict.projectedDem - currentDistrict.projectedRep) : (currentDistrict.projectedRep - currentDistrict.projectedDem))
                                        / (currentDistrict.projectedDem + currentDistrict.projectedRep);
                    if(currentDistrict.projectedDem - currentDistrict.projectedRep === 0) newColour = stringifyColour(config.partyColours.HouseTie);
                    else {
                        const scaleNum = (majority * 0.5) + 0.5;
                        const inverseLightness = (100 - baseColour.l) * scaleNum;
                        newColour = stringifyColour({
                            h: baseColour.h,
                            s: baseColour.s * scaleNum,
                            l: Math.max(100 - inverseLightness, 15)
                        });
                    }
                        }
                    }
                } else if (electionType === "usSenatePol") {
                    if(currentDistrict.senior.extendedAttribs.party === currentDistrict.junior.extendedAttribs.party){
                        newColour = stringifyColour(getPoliticianColour(currentDistrict.senior));
                    } else {
                        const seniorAcronym = (currentDistrict.senior.extendedAttribs.party === "Independent")
                            ? ("I" + currentDistrict.senior.caucusParty.charAt(0))
                            : currentDistrict.senior.caucusParty.charAt(0);
                        const juniorAcronym = (currentDistrict.junior.extendedAttribs.party === "Independent")
                            ? ("I" + currentDistrict.junior.caucusParty.charAt(0))
                            : currentDistrict.junior.caucusParty.charAt(0);
                        newColour = `url(#${seniorAcronym}:${juniorAcronym})`;
                    }
                } else if (electionType === "governorPol") {
                    newColour = stringifyColour(getPoliticianColour(currentDistrict));
                } else if(projected) {
                    let lastElectionYear = null;
                    let lastElectionArray = null;
                    if(electionType === "usSenate"){
                        lastElectionArray = usSenateArchive;
                        lastElectionYear = lastElectionArray[0].year - 6;
                    }
                    if(electionType === "governor"){
                        lastElectionArray = allGovArchive;
                        lastElectionYear = lastElectionArray[0].year - 4;
                    }
                    raceInfo = getRaceInfo(currentDistrict, live);
                    newColour = (currentDistrict.pW === true) ? stringifyColour(getCandidateColour(raceInfo.finalWinner))
                        : (!live ? stringifyColour(getCandidateColour(raceInfo.currentLeader)) : resultColours[stateId]);
                    const isPresidentialGeneral = electionType === "president" && (!live
                        || (typeof electNightP !== "undefined" && electNightP.elections?.[0]?.cands !== undefined));
                    if(isPresidentialGeneral && currentDistrict.pW === true){
                        const previousWinnerParty = getPreviousPresidentialWinnerParty(stateId);
                        const currentWinner = raceInfo.finalWinner || raceInfo.currentLeader;
                        if(previousWinnerParty && previousWinnerParty !== currentWinner.party){
                            const currentWinnerCaucus = currentWinner.caucus || currentWinner.caucusParty || currentWinner.party;
                            const fillId = ((currentWinner.party === "I") ? ("I" + currentWinnerCaucus)
                                : currentWinnerCaucus) + ":gain";
                            newColour = `url(#${fillId})`;
                        }
                    }
                    if(lastElectionYear !== null && currentDistrict.pW === true){
                    const lastElections = lastElectionArray.filter(archiveArray => (archiveArray.category === "general" && archiveArray.year === lastElectionYear));
                    if(lastElections.length !== 0){
                        const lastElection = lastElections[0];
                        const distFullName = Executive.data.states[stateId.toLowerCase()].name;
                        const lastDistricts = lastElection.elections.filter(dist => dist.district === distFullName);
                        if(lastDistricts.length !== 0){
                            const oldRaceInfo = getRaceInfo(lastDistricts[0], false);
                            if(oldRaceInfo.currentLeader.party !== raceInfo.currentLeader.party
                                || oldRaceInfo.currentLeader.caucus !== raceInfo.currentLeader.caucus){
                                const fillId = ((raceInfo.currentLeader.party === "I") ? ("I" + raceInfo.currentLeader.caucus)
                                    : raceInfo.currentLeader.caucus) + ":gain";
                                newColour = `url(#${fillId})`;
                            }
                        }
                    }
                }
                } else {
                    raceInfo = raceInfoCache[stateId];
                    if(raceInfo === undefined || raceInfo.currentLead === 0) newColour = resultColours[stateId];
                    else {
                        const baseColour = getCandidateColour(raceInfo.currentLeader);
                        const scaleNum = (raceInfo.currentMajority !== 1) ? majorityScale(raceInfo.currentMajority)
                            : majorityScale(d3.max(majorities));
                        const inverseLightness = (100 - baseColour.l) * scaleNum;
                        newColour = stringifyColour({
                            h: baseColour.h,
                            s: baseColour.s * scaleNum,
                            l: Math.max(100 - inverseLightness, 15)
                        });
                    }
                }
                d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                    .style("fill", newColour);
            } else d3.select("#" + stateId + "-state-path" + (live ? "-live" : ""))
                .style("fill", resultColours[stateId]);
        });
        if (electionType === "usSenate") {
            try { updateSenateControlBanner({ live, onCountyMap, svgMap }); } catch (e) {}
            const houseEl = document.getElementById("bm-house-banner");
            if (houseEl) { houseEl.classList.remove("show"); houseEl.innerHTML = ""; }
        } else if (electionType === "usHouse") {
            try { updateHouseControlBanner({ live, onCountyMap, svgMap }); } catch (e) {}
            const senateEl = document.getElementById("bm-senate-banner");
            if (senateEl) { senateEl.classList.remove("show"); senateEl.innerHTML = ""; }
        } else {
            const senateEl = document.getElementById("bm-senate-banner");
            if (senateEl) { senateEl.classList.remove("show"); senateEl.innerHTML = ""; }
            const houseEl = document.getElementById("bm-house-banner");
            if (houseEl) { houseEl.classList.remove("show"); houseEl.innerHTML = ""; }
        }
    };
    const updateCountyMap = (svgMap, electionType, live) => {
        const currentOrigCounties = resultProxies[electionType][activeMap].counties;
        const newCounties = [];
        const stateElectData = allStElectData.filter(electData => (electData.id === activeMap))[0];
        const majorities = [];
        const raceInfoCache = {};
        currentOrigCounties.forEach(origCounty => {
            let totalCurrVotes = 0;
            let totalVotes = 0;
            const newCounty = {
                name: origCounty.name,
                cands: origCounty.cands.map(candObj => {
                    const newCandObj = Object.assign({}, candObj);
                    if(!live){
                        newCandObj.currentVotes = newCandObj.votes;
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
            if(distMajority !== 1) majorities.push(distMajority);
            raceInfoCache[newCounty.name].currentMajority = distMajority;
        });
        let majorityScale = null;
        if(config.useRelativeColourScale){
            if(majorities.length > 0){
                majorityScale = d3.scaleLinear(
                    d3.extent(majorities),
                    [0.625, 1.375]
                );
            };
        } else {
            majorityScale = d3.scaleLinear(
                d3.extent([0, 0.35]),
                [0.625, 1.375]
            );
        }
        newCounties.forEach(county => {
            raceInfo = raceInfoCache[county.name];
            const baseColour = getCandidateColour(raceInfo.currentLeader);
            const scaleNum = (raceInfo.currentMajority !== 1) ? majorityScale(raceInfo.currentMajority)
                : majorityScale(d3.max(majorities));
            const inverseLightness = (100 - baseColour.l) * scaleNum;
            newColour = stringifyColour({
                h: baseColour.h,
                s: baseColour.s * scaleNum,
                l: Math.max(100 - inverseLightness, 15)
            });
            const croppedCountyName = county.name.substring(0, county.name.lastIndexOf(" "));
            const replacedFullName = county.name.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
            const replacedCroppedName = croppedCountyName.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
            if(document.getElementById(replacedFullName + "-state-path" + (live ? "-live" : ""))){
                d3.select("#" + replacedFullName + "-state-path" + (live ? "-live" : ""))
                    .style("fill", newColour);
            } else d3.select("#" + replacedCroppedName + "-state-path" + (live ? "-live" : ""))
                .style("fill", newColour);
        });
    };
    const createHatchPattern = (backColour, foreColour) => {
        const mainPatternElem = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        mainPatternElem.setAttribute("width", "10");
        mainPatternElem.setAttribute("height", "10");
        mainPatternElem.setAttribute("patternTransform", "rotate(45 0 0)");
        mainPatternElem.setAttribute("patternUnits", "userSpaceOnUse");
        const backRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        backRect.setAttribute("x", "0");
        backRect.setAttribute("y", "0");
        backRect.setAttribute("width", "10");
        backRect.setAttribute("height", "10");
        backRect.setAttribute("fill", backColour);
        mainPatternElem.appendChild(backRect);
        const hatchLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hatchLine.setAttribute("x1", "0");
        hatchLine.setAttribute("y1", "0");
        hatchLine.setAttribute("x2", "0");
        hatchLine.setAttribute("y2", "10");
        hatchLine.setAttribute("style", `stroke: ${foreColour}; stroke-width: 8;`);
        mainPatternElem.appendChild(hatchLine);
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
        const partyCol = (party.charAt(0) === "I") ? (config.partyColours.I[party.charAt(1)])
                                : (config.partyColours[party.charAt(0)]);
        const partyColDarker = Object.assign({}, partyCol);
        partyColDarker.l = Math.max(partyCol.l - 10, 0);
        const pattern = createHatchPattern(stringifyColour(partyCol), stringifyColour(partyColDarker));
        pattern.setAttribute("id", party + ":gain");
        return pattern;
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
        houseDistrictTooltipTarget = null;
    };
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
    const getHousePrimaryCandidateParty = (candidate, fallbackParty = "I") => {
        if (candidate?.party) return String(candidate.party).replace(/[^A-Za-z]/g, "").toUpperCase() || fallbackParty;
        try {
            const candArray = findCandByID([candidate.id])[0];
            const wrappedCandObj = Executive.data.characters.wrapCharacter(candArray, "candidate");
            if (wrappedCandObj.extendedAttribs.party === "Independent") return "I";
            return wrappedCandObj.extendedAttribs.party.substring(0, 1).toUpperCase();
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
    const getAbsoluteElectionMarginScaleNum = margin => {
        return 0.625 + ((Math.min(0.35, Math.max(0, Number(margin) || 0)) / 0.35) * 0.75);
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
        const candidateCount = district?.allCands?.cands?.length || 0;
        const normalizeCount = value => {
            const count = Math.floor(Number(value));
            if (!Number.isFinite(count) || count <= 0) return null;
            return candidateCount > 0 ? Math.min(count, candidateCount) : count;
        };
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        const sources = [
            district,
            district?.allCands,
            district?.allPri,
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
        for (const source of sources) {
            if (!source || typeof source !== "object") continue;
            for (const optionName of optionNames) {
                const count = normalizeCount(source[optionName]);
                if (count !== null) return count;
            }
        }
        return candidateCount > 0 ? Math.min(2, candidateCount) : 2;
    };
    const getHousePrimaryNonpartisanAdvancerParties = (district, live, stateId) => {
        const candidates = (district?.allCands?.cands || []).map(candidate => ({
            ...candidate,
            party: normalizeHousePrimaryParty(getHousePrimaryCandidateParty(candidate, "I"))
        }));
        if (!candidates.length) return [];
        const voteKey = live === true ? "currentVotes" : "votes";
        const sortedCandidates = candidates.slice().sort((candidateA, candidateB) =>
            (Number(candidateB?.[voteKey]) || 0) - (Number(candidateA?.[voteKey]) || 0)
        );
        if ((Number(sortedCandidates[0]?.[voteKey]) || 0) <= 0) return [];
        const advancingCount = getHousePrimaryAdvanceCount(district, stateId);
        return sortedCandidates.slice(0, advancingCount).map(candidate => candidate.party || "I");
    };
    const isStatewidePrimaryRace = race => {
        return !Array.isArray(race?.cands)
            && (
                Array.isArray(race?.dem?.cands)
                || Array.isArray(race?.rep?.cands)
                || Array.isArray(race?.allCands?.cands)
            );
    };
    const getPrimaryVisibleVotes = (candidate, live, stateElectData = null) => {
        const finalVotes = Number(candidate?.votes) || 0;
        if (live !== true) return finalVotes;
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
        const scaleNum = getAbsoluteElectionMarginScaleNum(winner.margin);
        const inverseLightness = (100 - baseColour.l) * scaleNum;
        return stringifyColour({
            h: baseColour.h,
            s: baseColour.s * scaleNum,
            l: Math.max(100 - inverseLightness, 15)
        });
    };
    const getStatewidePrimaryStateFill = (svgMap, stateId, race, live, electionType) => {
        const freshRace = getFreshStatewidePrimaryRace(stateId, race, live, electionType);
        const demCandidates = freshRace?.dem?.cands || [];
        const repCandidates = freshRace?.rep?.cands || [];
        const allCandidates = freshRace?.allCands?.cands || [];
        const isNonpartisanPrimary = demCandidates.length === 0 && repCandidates.length === 0 && allCandidates.length > 0;
        if (!isNonpartisanPrimary) {
            return getStatewidePartisanPrimaryStateColour(stateId, freshRace, live);
        }
        const parties = getStatewidePrimaryAdvancingParties(freshRace, live, stateId);
        if (!parties.length) return null;
        const normalizedParties = parties.map(normalizeHousePrimaryParty);
        const uniqueParties = Array.from(new Set(normalizedParties));
        if (uniqueParties.length === 1) return getHousePrimaryPartyColour(uniqueParties[0]);
        const patternId = ensurePrimaryPartySequencePattern(svgMap, `bm-${electionType}-primary-party`, normalizedParties);
        return patternId ? `url(#${patternId})` : getHousePrimaryPartyColour(normalizedParties[0]);
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
        const scaleNum = getAbsoluteElectionMarginScaleNum(winner.margin);
        const inverseLightness = (100 - baseColour.l) * scaleNum;
        return stringifyColour({
            h: baseColour.h,
            s: baseColour.s * scaleNum,
            l: Math.max(100 - inverseLightness, 15)
        });
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
        const scaleNum = 0.7 + ((Math.min(0.35, winner.margin) / 0.35) * 0.45);
        const inverseLightness = (100 - baseColour.l) * scaleNum;
        return stringifyColour({
            h: baseColour.h,
            s: baseColour.s * scaleNum,
            l: Math.max(100 - inverseLightness, 15)
        });
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
        const number = Number(district?.district);
        return Number.isFinite(number) && number > 0 ? number : index + 1;
    };
    const getMountedMapCanvas = (canvasElem, live) => {
        return document.getElementById(canvasElem?.id || "")
            || document.getElementById(live ? "electNightCanvas" : "electPageCanvas")
            || canvasElem;
    };
    const getHouseDistrictFill = (stateId, district, live, gainPatternIds) => {
        district = getLiveHouseDistrictSnapshot(stateId, district, live);
        if (isHousePrimaryDistrict(district)) {
            const primaryCandidates = [
                ...(district.dem?.cands || []).map(candidate => ({ ...candidate, party: "D" })),
                ...(district.rep?.cands || []).map(candidate => ({ ...candidate, party: "R" })),
                ...(district.allCands?.cands || []).map(candidate => ({ ...candidate, party: candidate.party || "I" }))
            ];
            if (!primaryCandidates.length) return "#b9b9b9";
            const useFinalVotes = live !== true;
            const voteKey = useFinalVotes ? "votes" : "currentVotes";
            const sortedCandidates = primaryCandidates.slice().sort((candidateA, candidateB) =>
                (Number(candidateB?.[voteKey]) || 0) - (Number(candidateA?.[voteKey]) || 0)
            );
            const winner = sortedCandidates[0];
            const visibleVotes = Number(winner?.[voteKey]) || 0;
            if (visibleVotes <= 0) return "#b9b9b9";
            const isNonpartisanPrimary = (district.dem?.cands || []).length === 0
                && (district.rep?.cands || []).length === 0
                && (district.allCands?.cands || []).length > 0;
            if (isNonpartisanPrimary) {
                if (live === true && !isProjectedHousePrimaryGroup(district.allCands)) return "#b9b9b9";
                const parties = getHousePrimaryNonpartisanAdvancerParties(district, live, stateId);
                if (!parties.length) return "#b9b9b9";
                const uniqueParties = Array.from(new Set(parties.map(normalizeHousePrimaryParty)));
                if (uniqueParties.length === 1) return getHousePrimaryPartyColour(uniqueParties[0]);
                return `url(#bm-house-primary-party-${uniqueParties.sort().join("-").toLowerCase()})`;
            }
            const projectedGroups = getHousePrimaryProjectedGroups(district);
            if (live === true && !projectedGroups.length) return "#b9b9b9";
            const partisanGroupCount = [district.dem, district.rep]
                .filter(group => Array.isArray(group?.cands) && group.cands.length > 0)
                .length;
            if (live === true && partisanGroupCount > projectedGroups.length) return "url(#bm-house-primary-partial)";
            return "#ffd400";
        }
        if (!Array.isArray(district?.cands) || district.cands.length === 0) return "#b9b9b9";
        if (!shouldRevealHouseDistrictResults(district, live)) return "#b9b9b9";
        if (live === true && houseDistrictGridMode === "projections" && district.pW !== true) return "#b9b9b9";
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
        if (houseDistrictGridMode === "projections" && flipData.flipped && gainPatternIds?.[flipData.winnerParty]) {
            return `url(#${gainPatternIds[flipData.winnerParty]})`;
        }
        const visibleVotes = Number(winner?.[useFinalVotes ? "votes" : "currentVotes"]) || 0;
        if (visibleVotes <= 0) return "#b9b9b9";
        if (houseDistrictGridMode !== "margins") return stringifyColour(getCandidateColour(winner));
        const voteKey = useFinalVotes ? "votes" : "currentVotes";
        const secondVotes = Number(sortedCandidates[1]?.[voteKey]) || 0;
        const totalVotes = sortedCandidates.reduce(
            (total, candidate) => total + (Number(candidate?.[voteKey]) || 0),
            0
        );
        const margin = totalVotes > 0 ? Math.max(0, (visibleVotes - secondVotes) / totalVotes) : 0;
        const scaleNum = 0.625 + ((Math.min(0.35, margin) / 0.35) * 0.75);
        const baseColour = getCandidateColour(winner);
        const inverseLightness = (100 - baseColour.l) * scaleNum;
        return stringifyColour({
            h: baseColour.h,
            s: baseColour.s * scaleNum,
            l: Math.max(100 - inverseLightness, 15)
        });
    };
    const getHouseDistrictGainPatternIds = (stateId, live) => {
        return ["D", "R", "ID", "IR"].reduce((patternIds, party) => {
            patternIds[party] = `bm-house-district-${stateId}-${live ? "live" : "page"}-${party.toLowerCase()}-gain`;
            return patternIds;
        }, {});
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
        overlay.querySelectorAll(".bm-house-district-hex").forEach(hex => {
            const districtNumber = Number(hex.dataset.districtNumber);
            const district = districtsByNumber.get(districtNumber);
            const polygon = hex.querySelector(".bm-house-district-hex-shape");
            if (!district || !polygon) return;
            polygon.setAttribute("fill", getHouseDistrictFill(stateId, district, live, gainPatternIds));
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
    const setMapModeControlsVisible = visible => {
        ["eNightProjectB", "eNightMarginB", "ePageProjectB", "ePageMarginB"].forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (!button) return;
            if (visible) button.style.removeProperty("display");
            else button.style.setProperty("display", "none", "important");
        });
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
        const hiddenMap = document.querySelector(".better-maps-container.bm-house-national-map-hidden");
        if (hiddenMap) {
            hiddenMap.classList.remove("bm-house-national-map-hidden");
            hiddenMap.style.removeProperty("display");
        }
        setMapModeControlsVisible(true);
    };
    const renderHouseDistrictGrid = (svgMap, canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        removeHouseDistrictGrid();
        if (electionType !== "usHouse" || !houseDistrictGridState) return;
        const stateId = String(houseDistrictGridState).toLowerCase();
        const districts = getHouseDistrictGridDistricts(stateId, live);
        const isPrimaryDistrictGrid = districts.some(isHousePrimaryDistrict);
        const mountedSvgMap = document.getElementById(electionType + "-map" + (live ? "-live" : "")) || svgMap;
        const mountedCanvasElem = getMountedMapCanvas(canvasElem, live);
        if (districts.length <= 1 || !mountedSvgMap?.isConnected || !mountedSvgMap.parentElement) {
            houseDistrictGridState = null;
            return;
        }
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
        overlay.dataset.live = String(live);
        const svgNamespace = "http://www.w3.org/2000/svg";
        const stage = document.createElementNS(svgNamespace, "svg");
        stage.classList.add("bm-house-district-grid-stage");
        overlay.appendChild(stage);
        const columns = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(districts.length * 1.5))));
        const hexWidth = 58;
        const hexHeight = 66;
        const rowStep = hexHeight * 0.75;
        const strokeInset = 1;
        const rows = Math.ceil(districts.length / columns);
        const gridWidth = (columns * hexWidth) + (hexWidth / 2) + (strokeInset * 2);
        const gridHeight = hexHeight + ((rows - 1) * rowStep) + (strokeInset * 2);
        const gridTopSpace = 86;
        const gridBottomSpace = 12;
        const gridSideSpace = 36;
        const availableGridWidth = Math.max(140, mapWidth - gridSideSpace);
        const availableGridHeight = Math.max(140, mapHeight - gridTopSpace - gridBottomSpace);
        const gridScale = Math.min(1, availableGridWidth / gridWidth, availableGridHeight / gridHeight);
        overlay.style.setProperty("--bm-house-district-grid-top-space", `${gridTopSpace}px`);
        stage.setAttribute("width", String(gridWidth));
        stage.setAttribute("height", String(gridHeight));
        stage.setAttribute("viewBox", `0 0 ${gridWidth} ${gridHeight}`);
        stage.setAttribute("aria-label", "House districts");
        stage.style.width = `${gridWidth * gridScale}px`;
        stage.style.height = `${gridHeight * gridScale}px`;
        const defs = document.createElementNS(svgNamespace, "defs");
        const gainPatternIds = getHouseDistrictGainPatternIds(stateId, live);
        ["D", "R", "ID", "IR"].forEach(party => {
            const pattern = createGainPattern(party);
            const patternId = gainPatternIds[party];
            pattern.setAttribute("id", patternId);
            defs.appendChild(pattern);
        });
        if (isPrimaryDistrictGrid) createHousePrimaryPatterns(defs);
        stage.appendChild(defs);
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
                polygon.setAttribute("fill", getHouseDistrictFill(stateId, district, live, gainPatternIds));
                label.classList.add("bm-house-district-hex-label");
                label.setAttribute("x", String(xPosition + (hexWidth / 2)));
                label.setAttribute("y", String(yPosition + (hexHeight / 2)));
                label.textContent = String(districtNumber);
                hex.appendChild(polygon);
                hex.appendChild(label);
                const districtKey = `${stateId}-${districtNumber}`;
                const showDistrictTooltip = (event, force = false) => {
                    tooltipComponents.properties.visible = true;
                    tooltipComponents.properties.targetDistrict = districtKey;
                    houseDistrictTooltipTarget = district;
                    updateHouseDistrictTooltip(stateId, district, force, live);
                    if(event) positionMapTooltip(event);
                };
                hex.addEventListener("mouseenter", event => {
                    showDistrictTooltip(event, true);
                });
                hex.addEventListener("mousemove", event => {
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
                hex.addEventListener("focus", event => {
                    showDistrictTooltip(event, true);
                });
                hex.addEventListener("mouseleave", hideMapTooltip);
                stage.appendChild(hex);
            });
        host.appendChild(overlay);
        hideHouseControlBanner();
        const returnButton = document.createElement("button");
        returnButton.id = "bm-house-district-return";
        returnButton.textContent = "Return to U.S. Map";
        returnButton.onclick = () => {
            playClick();
            houseDistrictGridState = null;
            activeMap = "US";
            hideMapTooltip();
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
        if (!isPrimaryDistrictGrid) {
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
        keepMapModeControlsHidden(() => Boolean(houseDistrictGridState));
    };
    const queueHouseDistrictGridRender = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        let attempts = 0;
        const tryRender = () => {
            if (!houseDistrictGridState || electionType !== "usHouse") return;
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
    const renderMap = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        const container = canvasElem.parentElement;
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
            onCountyMap = false;
            houseDistrictGridState = null;
            removeHouseDistrictGrid();
        }
        lastMapElectionType = electionType;
        let mapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep +
            ((electionType === "president") ? "presidential.svg" : "states.svg");
        if(onCountyMap){
            if(!resultProxies[electionType][activeMap]) onCountyMap = false;
            else if(!resultProxies[electionType][activeMap].cands) onCountyMap = false;
            else if(live && resultProxies[electionType][activeMap].totalCurrVotes !== undefined
                && resultProxies[electionType][activeMap].totalCurrVotes === 0) onCountyMap = false;
        }
        if(onCountyMap){
            const countyMapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep + "counties" + path.sep +
                activeMap.toLowerCase() + ".svg";
            if(fs.existsSync(countyMapPath)) mapPath = countyMapPath;
            else onCountyMap = false;
        }
        if(onCountyMap){
            keepMapModeControlsHidden(() => onCountyMap);
            const returnButton = document.createElement("button");
            returnButton.setAttribute("id", projected ? "ePageReturnB2" : (live ? "eNightReturnB" : "ePageReturnB"));
            returnButton.textContent = "Return to U.S. Map";
            returnButton.onclick = () => {
                playClick();
                onCountyMap = false;
                setMapModeControlsVisible(true);
                tooltipDiv.setAttribute("style", "display: none;");
                tooltipComponents.properties.visible = false;
                tooltipComponents.properties.targetDistrict = null;
                onClickPageFunc();
            };
            if(projected) container.appendChild(returnButton);
            else container.insertBefore(returnButton, canvasElem);
        } else {
            const returnPresButton = document.getElementById("ePageReturnB2");
            if(returnPresButton) returnPresButton.remove();
        }
        if(!svgMap || svgMap.getAttribute("data-type") !== electionType || svgMap.getAttribute("data-source") !== mapPath){
            const origWidth = +(canvasElem.getAttribute("width").substring(0, canvasElem.getAttribute("width").length - 2));
            const origHeight = +(canvasElem.getAttribute("height").substring(0, canvasElem.getAttribute("height").length - 2));
            const mapDataText = fs.readFileSync(mapPath, "utf8");
            const mapData = (new DOMParser()).parseFromString(mapDataText, "image/svg+xml");
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
                const scaleFactor = Math.min(origWidth / baseWidth, origHeight / baseHeight);
                const outlineGroup = svgMap.getElementsByTagName("g")[0];
                const statePaths = outlineGroup.children;
                for(let i = 0; i < statePaths.length; i++){
                    const stateId = statePaths[i].getAttribute("id");
                    statePaths[i].setAttribute("id", stateId.toLowerCase() + "-state-path" + (live ? "-live" : ""));
                    statePaths[i].setAttribute("class", "better-maps-state-path");
                    statePaths[i].setAttribute("style", "fill: #cccccc;");
                    if(!onCountyMap){
                        statePaths[i].addEventListener("click", (event) => {
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
                            playClick();
                            activeMap = stateId;
                            if(electionType === "usHouse") {
                                houseDistrictGridState = getHouseDistrictGridDistricts(stateId, live).length > 1
                                    ? stateId.toLowerCase()
                                    : null;
                                houseDistrictGridMode = "projections";
                                if (houseDistrictGridState) hideMapTooltip();
                            }
                            if(electionType === "president") activeCampMap = Executive.data.states[stateId.toLowerCase()];
                            if(electionType !== "usHouse" && electionType !== "usHousePol"
                                && electionType !== "governorPol" && electionType !== "usSenatePol"){
                                onCountyMap = true;
                                tooltipDiv.setAttribute("style", "display: none;");
                                tooltipComponents.properties.visible = false;
                                tooltipComponents.properties.targetDistrict = null;
                            }
                            onClickPageFunc();
                            if(electionType === "usHouse") {
                                queueHouseDistrictGridRender(canvasElem, resultColours, electionType, live, onClickPageFunc, projected);
                            }
                        });
                    }
                    if(electionType !== "usHousePol" && electionType !== "governorPol" && electionType !== "usSenatePol"){
                        statePaths[i].addEventListener("mousemove", (event) => {
                            tooltipComponents.properties.visible = true;
                            tooltipComponents.properties.targetDistrict = stateId.toLowerCase();
                            if(electionType === "usHouse") updateHouseStateTooltip(stateId.toLowerCase(), false, live);
                            else updateTooltip(electionType, stateId.toLowerCase(), false, live, onCountyMap);
                            const yPosition = Math.min(event.pageY + 10, window.innerHeight - tooltipDiv.offsetHeight);
                            tooltipDiv.setAttribute("style", `left: ${event.pageX + 10}px; top: ${yPosition}px;`);
                        });
                        statePaths[i].addEventListener("mouseleave", (event) => {
                            tooltipDiv.setAttribute("style", "display: none;");
                            tooltipComponents.properties.visible = false;
                            tooltipComponents.properties.targetDistrict = null;
                        });
                    }
                }
                const preTransform = outlineGroup.getAttribute("transform");
                if(scaleFactor === (origWidth / baseWidth)){
                    outlineGroup.setAttribute("transform", `${(preTransform === null ? "" : preTransform)} translate(0, ${(origHeight / 2) - ((baseHeight * scaleFactor) / 2)}) scale(${scaleFactor})`);
                } else {
                    outlineGroup.setAttribute("transform", `${(preTransform === null ? "" : preTransform)} translate(${(origWidth / 2) - ((baseWidth * scaleFactor) / 2)}, 0) scale(${scaleFactor})`);
                }
                if(onCountyMap) updateCountyMap(svgMap, electionType, live);
                else updateMap(svgMap, resultColours, electionType, live, isProjected);
            };
        } else {
            if(onCountyMap) updateCountyMap(svgMap, electionType, live);
            else updateMap(svgMap, resultColours, electionType, live, isProjected);
        }
        renderHouseDistrictGrid(svgMap, canvasElem, resultColours, electionType, live, onClickPageFunc, projected);
        if(live && electionType !== "usHousePol"){
            lastUpdateDataHook = Executive.functions.registerPostHook("electNightUpdateData", () => {
                if((electionType === "usHouse" || electionType === "usSenate" || electionType === "governor") && !onCountyMap) {
                    updateMap(svgMap, resultColours, electionType, live, isProjected);
                }
                if(electionType === "usHouse" && houseDistrictGridState) {
                    refreshHouseDistrictGridFills(true);
                    setTimeout(() => refreshHouseDistrictGridFills(true), 0);
                }
                if(tooltipComponents.properties.targetDistrict !== null) {
                    if(electionType === "usHouse" && houseDistrictGridState && houseDistrictTooltipTarget) {
                        updateHouseDistrictTooltip(houseDistrictGridState, houseDistrictTooltipTarget, true, live);
                    } else if(electionType === "usHouse") updateHouseStateTooltip(tooltipComponents.properties.targetDistrict, true, live);
                    else updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
                }
            });
        }
        if(tooltipComponents.properties.targetDistrict !== null) {
            if(electionType === "usHouse" && houseDistrictGridState && houseDistrictTooltipTarget) {
                updateHouseDistrictTooltip(houseDistrictGridState, houseDistrictTooltipTarget, true, live);
            } else if(electionType === "usHouse") updateHouseStateTooltip(tooltipComponents.properties.targetDistrict, true, live);
            else updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
        }
    };
    const newElectPageMap = (canvasElem, resultColours, arg2, electionType) => {
        Executive.mods.saveData.testProp = "This is another test.";
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
        const projectButton = document.getElementById("eNightProjectB");
        if(projectButton){
            const buttonObserver = new MutationObserver((mutationList, observer) => {
                for(const mutation of mutationList){
                    if(mutation.type === "attributes" && mutation.attributeName === "class"){
                        const svgMap = document.getElementById(electionType + "-map-live");
                        if(svgMap){
                            newElectNightMap(document.getElementById("electNightCanvas"), JSON.parse(svgMap.getAttribute("data-colours")), 0, electionType);
                        }
                    }
                }
            });
            buttonObserver.observe(projectButton, {attributes: true});
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
    const msnbcElectionRaceHydrationTimestamps = {};
    const msnbcElectionPanelState = {
        activeRace: "president",
        selectedYear: null,
        selectedStateCode: null,
        selectedCountyName: null,
        comparisonCount: 0,
        hiddenHistoryYears: []
    };
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
    const getMsnbcAvailableRaces = () => {
        return isMsnbcPresidentialElectionYear()
            ? ["president", "governor", "senate"]
            : ["governor", "senate"];
    };
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
        const presidentialNight = readRuntimeValue("electNightP");
        if(Array.isArray(presidentialNight?.elections)
            && presidentialNight.elections.length > 0
            && presidentialNight.elections[0]?.cands === undefined) {
            return true;
        }
        return false;
    };
    const isElectionNightPanelAvailable = () => {
        if(isPrimaryElectionNightPage()) return false;
        const text = String(document.body?.innerText || "");
        const hasElectionNightUi = text.includes("Skip to End")
            && (document.getElementById("electNightCanvas")
                || document.getElementById("eNightProjectB")
                || /\bElection\b/i.test(text));
        return Boolean(hasElectionNightUi);
    };
    const injectMsnbcElectionPanelStyles = () => {
        if(msnbcElectionPanelStylesInjected || !document.head) return;
        msnbcElectionPanelStylesInjected = true;
        const style = document.createElement("style");
        style.id = "bm-msnbc-election-panel-style";
        style.textContent = `
            #bm-msnbc-election-btn {
                position: fixed;
                right: 18px;
                bottom: 72px;
                z-index: 2147483646;
                border: 0;
                border-radius: 8px;
                padding: 10px 15px;
                color: #fff;
                background: #111827;
                box-shadow: 0 4px 14px rgba(0,0,0,0.32);
                font-family: Arial, sans-serif;
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
                font-family: Arial, sans-serif;
            }
            #bm-msnbc-election-panel {
                width: min(1180px, calc(100vw - 44px));
                height: min(720px, calc(100vh - 16px));
                max-height: none;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                background: #d9e0e3;
                border: 4px solid #101720;
                box-shadow: 0 10px 32px rgba(0,0,0,0.42);
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
                gap: 6px;
                padding: 10px 12px 0;
                background: #cfd7da;
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
            .bm-msnbc-body {
                flex: 1 1 auto;
                display: grid;
                grid-template-columns: 392px 1fr 86px;
                gap: 0;
                min-height: 0;
                background: #dce4e7;
            }
            .bm-msnbc-candidates {
                min-height: 0;
                overflow: hidden;
                background: #dbe2e5;
                border-right: 1px solid #aab5ba;
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
            .bm-msnbc-candidate-row.D .bm-msnbc-name-block { background: #1388d8; }
            .bm-msnbc-candidate-row.R .bm-msnbc-name-block { background: #de3329; }
            .bm-msnbc-candidate-row.I .bm-msnbc-name-block { background: #777; }
            .bm-msnbc-name-block {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: center;
                padding: 12px 12px 0;
                color: #fff;
                font-size: 31px;
                line-height: 1;
                font-weight: 900;
                text-transform: uppercase;
                overflow: hidden;
                white-space: nowrap;
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
                align-self: flex-end;
                max-width: 100%;
                margin-top: 30px;
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
            .bm-msnbc-history-row.winner.D { background: #1388d8; }
            .bm-msnbc-history-row.winner.R { background: #de3329; }
            .bm-msnbc-history-row.winner.I { background: #777; }
            .bm-msnbc-history-row.winner .bm-msnbc-history-votes {
                color: rgba(255,255,255,0.88);
                border-top-color: rgba(255,255,255,0.34);
            }
            .bm-msnbc-history-row.D { color: #026eb6; }
            .bm-msnbc-history-row.R { color: #cc0000; }
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
        `;
        document.head.appendChild(style);
    };
    const getPanelCandidateName = (candidate) => {
        const raw = String(candidate?.name || "");
        const pieces = raw.trim().split(/\s+/).filter(Boolean);
        return pieces.length ? pieces[pieces.length - 1] : raw;
    };
    const isMsnbcCandidateIncumbent = (candidate) => {
        return candidate?.incumbent === true
            || candidate?.incumbent === 1
            || String(candidate?.incumbent || "").toLowerCase() === "true"
            || candidate?.isIncumbent === true
            || candidate?.inc === true
            || candidate?.incumb === true;
    };
    const getPanelCandidateVotes = (candidate, live) => {
        const value = live ? (candidate?.currentVotes ?? candidate?.votes ?? candidate?.totVotes)
            : (candidate?.totVotes ?? candidate?.votes ?? candidate?.currentVotes);
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };
    const getPanelCurrentCandidateVotes = (candidate, stateRace = null) => {
        const number = Number(candidate?.currentVotes);
        if(Number.isFinite(number) && number > 0) return number;
        const finalVotes = Number(candidate?.votes ?? candidate?.totVotes) || 0;
        const updates = Array.isArray(candidate?.updates) ? candidate.updates : [];
        if(finalVotes > 0 && updates.length) {
            const stateCode = getMsnbcElectionStateCode(stateRace);
            let stateElectData = null;
            try {
                stateElectData = (allStElectData || []).find(electData =>
                    String(electData?.id || electData?.state || "").toUpperCase() === String(stateCode || "").toUpperCase()
                );
            } catch {}
            const updateIndex = Number(stateElectData?.indx ?? stateRace?.indx);
            if(Number.isFinite(updateIndex) && updateIndex > 0) {
                const progress = Number(updates[Math.min(Math.max(0, updateIndex), updates.length - 1)]);
                if(Number.isFinite(progress) && progress > 0) return finalVotes * progress;
            }
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
        const totalCurrVotes = Number(stateRace?.totalCurrVotes);
        if(Number.isFinite(totalCurrVotes) && totalCurrVotes > 0) return totalCurrVotes;
        return (candidates || []).reduce((sum, candidate) => sum + Number(candidate.votes || 0), 0);
    };
    const getMsnbcRaceUpdateFunctionNames = (race) => {
        if(race === "senate") {
            return [
                "eNightUSSUpdate", "eNightSenateUpdate", "electNightUSSUpdate", "electNightSenateUpdate",
                "electNightUSSFunc", "electNightSenateFunc"
            ];
        }
        if(race === "governor") {
            return [
                "eNightGovUpdate", "eNightGovernorUpdate", "electNightGovUpdate", "electNightGovernorUpdate",
                "electNightGovFunc", "electNightGovernorFunc"
            ];
        }
        return [
            "eNightPUpdate", "eNightPresUpdate", "eNightPresidentUpdate", "electNightPUpdate", "electNightPresUpdate", "electNightPresidentUpdate",
            "electNightPresFunc", "electNightPFunc"
        ];
    };
    const hydrateMsnbcElectionRaceData = (race, force = false) => {
        const now = Date.now();
        if(!force && now - (msnbcElectionRaceHydrationTimestamps[race] || 0) < 900) return;
        msnbcElectionRaceHydrationTimestamps[race] = now;
        const updateFunctions = Array.from(new Set(
            getMsnbcRaceUpdateFunctionNames(race)
                .map(readRuntimeFunction)
                .filter(Boolean)
        ));
        if(!updateFunctions.length) return;
        const previousActiveMap = typeof activeMap !== "undefined" ? activeMap : undefined;
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
            if(typeof activeMap !== "undefined") activeMap = "US";
            document.getElementById = () => dummyElem;
            updateFunctions.forEach(updateFunction => {
                try { updateFunction(); } catch {}
            });
        } catch {}
        finally {
            document.getElementById = originalGetElement;
            dummyElem.remove();
            if(previousActiveMap !== undefined) activeMap = previousActiveMap;
        }
    };
    const hydrateMsnbcElectionData = (force = false) => {
        getMsnbcAvailableRaces().forEach(race => hydrateMsnbcElectionRaceData(race, force));
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
    const buildArchivePanelEntry = (archiveEntry, raceConfig) => {
        const sourceStates = raceConfig.race === "president"
            ? (archiveEntry?.exitPoll?.states || [])
            : (archiveEntry?.elections || []);
        if(!Array.isArray(sourceStates) || sourceStates.length === 0) return null;
        const states = sourceStates.map(state => {
            const candidates = (state.candidates || state.cands || []).map(candidate => ({
                name: String(candidate.name || "Unknown"),
                party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
                votes: Number(candidate.totVotes ?? candidate.votes) || 0,
                id: candidate.id ?? null,
                incumbent: isMsnbcCandidateIncumbent(candidate)
            }));
            const stateCode = raceConfig.race === "president"
                ? getElectionNightPanelStateCode(state.name)
                : getElectionNightPanelStateCode(state.state || state.district || state.name);
            return {
                name: getElectionNightPanelStateName(stateCode),
                code: stateCode,
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
                const candidates = stateRace.cands.map(candidate => ({
                    name: String(candidate.name || "Unknown"),
                    party: normalizePanelPartyCode(candidate.party || candidate.caucus || candidate.caucusParty),
                    votes: getPanelCurrentCandidateVotes(candidate, stateRace),
                    id: candidate.id ?? null,
                    incumbent: isMsnbcCandidateIncumbent(candidate)
                }));
                const totalCurrVotes = getMsnbcStateTotalVotes(stateRace, candidates);
                return {
                    name: getElectionNightPanelStateName(stateCode),
                    code: stateCode,
                    totalVotes: totalCurrVotes,
                    reportedPct: Number(stateRace.totalVotes) > 0 ? (totalCurrVotes / Number(stateRace.totalVotes)) * 100 : 0,
                    projected: stateRace.pW === true,
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
            if(state.projected || state.totalVotes > 0) {
                const winner = state.candidates.slice().sort((a, b) => b.votes - a.votes)[0];
                if(winner) {
                    const key = getElectionNightPanelCandidateKey(winner);
                    candidateTotals[key].electoralVotes += getElectionNightPanelStateElectoralVotes(state.code);
                }
            }
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
                const updateShare = Number.isInteger(updateIndex) && Array.isArray(candidate.updates)
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
    const getMsnbcMapFill = (state) => {
        if(!state || Number(state.totalVotes) <= 0) return "#71818e";
        const winner = state?.candidates?.slice().sort((a, b) => b.votes - a.votes)[0];
        const party = normalizePanelPartyCode(winner?.party);
        if(party === "D") return "#026eb6";
        if(party === "R") return "#cc0000";
        if(party === "I") return "#777777";
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
    const renderMsnbcMap = (host, entry, onStateClick) => {
        if(!host) return;
        host.innerHTML = "";
        const mapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep + "states.svg";
        const mapText = fs.readFileSync(mapPath, "utf8");
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
            pathElement.setAttribute("style", `fill: ${getMsnbcMapFill(statesByCode[stateCode])};`);
            pathElement.addEventListener("click", event => {
                event.stopPropagation();
                if(typeof onStateClick === "function") onStateClick(stateCode);
            });
        });
        host.appendChild(svg);
    };
    const renderMsnbcRaceContent = (panel, race) => {
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
        const displayScope = selectedState || (raceConfig.race === "president" ? entry : null);
        const displayTitle = selectedState
            ? `${selectedState.name}`
            : raceConfig.race === "president"
                ? `${entry.year} ${raceConfig.title}`
                : raceConfig.title;
        const displaySubTitle = selectedState ? `${selectedState.code} | STATEWIDE` : "";
        const displayReportedPct = isCurrentSelectedState
            ? Math.max(0, Math.min(100, Math.round(Number(selectedState.reportedPct) || 0)))
            : null;
        const neededText = "";
        const mapNeededText = !selectedState && raceConfig.race === "president"
            ? raceConfig.neededText.replace(/<br\s*\/?>/gi, " ")
            : "";
        const displayTotalVotes = Number(displayScope?.totalVotes) || 0;
        const hasVisibleResults = displayTotalVotes > 0;
        const statusText = getMsnbcProjectedStatusText(selectedState);
        const topCandidates = (displayScope?.candidates || [])
            .slice()
            .sort((a, b) => Number(b.votes) - Number(a.votes))
            .slice(0, 4);
        const emptyStatePrompt = !displayScope
            ? `<div class="bm-msnbc-empty">Select a state to view ${escapeHtml(raceConfig.title.toLowerCase())} results.</div>`
            : "";
        const topVoteDifference = topCandidates.length >= 2
            ? Math.max(0, (Number(topCandidates[0]?.votes) || 0) - (Number(topCandidates[1]?.votes) || 0))
            : 0;
        const candidateRows = topCandidates.map((candidate, index) => {
            const party = normalizePanelPartyCode(candidate.party) || "I";
            const pct = displayTotalVotes > 0 ? ((candidate.votes / displayTotalVotes) * 100).toFixed(1) : "0.0";
            const displayCandidateName = `${getPanelCandidateName(candidate)}${candidate.incumbent ? "*" : ""}`;
            const differenceText = index === 0 && hasVisibleResults && topVoteDifference > 0
                ? `<div class="bm-msnbc-vote-difference">Difference: ${formatWholeNumber(topVoteDifference)}</div>`
                : "";
            return `
                <div class="bm-msnbc-candidate-row ${party}${hasVisibleResults ? "" : " no-results"}">
                    <div class="bm-msnbc-name-block" data-full-name="${escapeHtml(displayCandidateName)}" title="${escapeHtml(displayCandidateName)}">
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
                ${emptyStatePrompt || candidateRows}
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
        renderMsnbcMap(mapWrap, entry, stateCode => {
            msnbcElectionPanelState.selectedStateCode = stateCode;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
            renderMsnbcRaceContent(panel, raceConfig.race);
        });
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
        hydrateMsnbcElectionData();
        const availableRaces = getMsnbcAvailableRaces();
        if(!availableRaces.includes(msnbcElectionPanelState.activeRace)) {
            msnbcElectionPanelState.activeRace = availableRaces[0] || "governor";
            msnbcElectionPanelState.selectedYear = null;
            msnbcElectionPanelState.selectedStateCode = null;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
        }
        panel.querySelectorAll(".bm-msnbc-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.race === msnbcElectionPanelState.activeRace);
        });
        renderMsnbcRaceContent(panel, msnbcElectionPanelState.activeRace);
    };
    const openMsnbcElectionPanel = () => {
        const existingOverlay = document.getElementById("bm-msnbc-election-overlay");
        if(existingOverlay) existingOverlay.remove();
        if(msnbcElectionPanelRefreshTimer) {
            clearInterval(msnbcElectionPanelRefreshTimer);
            msnbcElectionPanelRefreshTimer = null;
        }
        const availableRaces = getMsnbcAvailableRaces();
        hydrateMsnbcElectionData(true);
        if(!availableRaces.includes(msnbcElectionPanelState.activeRace)) {
            msnbcElectionPanelState.activeRace = availableRaces[0] || "governor";
            msnbcElectionPanelState.selectedYear = null;
            msnbcElectionPanelState.selectedStateCode = null;
            msnbcElectionPanelState.selectedCountyName = null;
            msnbcElectionPanelState.comparisonCount = 0;
            msnbcElectionPanelState.hiddenHistoryYears = [];
        }
        const tabLabels = {
            president: "President",
            governor: "Governor",
            senate: "Senate"
        };
        const overlay = document.createElement("div");
        overlay.id = "bm-msnbc-election-overlay";
        overlay.innerHTML = `
            <div id="bm-msnbc-election-panel">
                <div class="bm-msnbc-election-header">
                    <div class="bm-msnbc-election-title">Election Night ${escapeHtml(getElectionNightPanelYear() || "")} | MSNBC</div>
                    <button class="bm-msnbc-election-close" id="bm-msnbc-election-close">Close</button>
                </div>
                <div class="bm-msnbc-tabs">
                    ${availableRaces.map(race => `
                        <button class="bm-msnbc-tab ${race === msnbcElectionPanelState.activeRace ? "active" : ""}" data-race="${escapeHtml(race)}">${escapeHtml(tabLabels[race] || race)}</button>
                    `).join("")}
                </div>
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
            overlay.remove();
        };
        document.getElementById("bm-msnbc-election-close")?.addEventListener("click", closePanel);
        overlay.addEventListener("click", event => {
            if(event.target === overlay) closePanel();
        });
        panel.querySelectorAll(".bm-msnbc-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const nextRace = tab.dataset.race || "president";
                if(msnbcElectionPanelState.activeRace !== nextRace) {
                    msnbcElectionPanelState.selectedYear = null;
                    msnbcElectionPanelState.selectedStateCode = null;
                    msnbcElectionPanelState.selectedCountyName = null;
                    msnbcElectionPanelState.comparisonCount = 0;
                    msnbcElectionPanelState.hiddenHistoryYears = [];
                }
                msnbcElectionPanelState.activeRace = nextRace;
                renderMsnbcPanelContent(panel);
            });
        });
        renderMsnbcPanelContent(panel);
        msnbcElectionPanelRefreshTimer = setInterval(() => {
            if(!overlay.isConnected) {
                clearInterval(msnbcElectionPanelRefreshTimer);
                msnbcElectionPanelRefreshTimer = null;
                return;
            }
            renderMsnbcPanelContent(panel);
        }, 1000);
    };
    const updateMsnbcElectionButtonVisibility = () => {
        const button = document.getElementById("bm-msnbc-election-btn");
        if(!button) return;
        const visible = isElectionNightPanelAvailable();
        button.style.display = visible ? "block" : "none";
        const nextText = `Election Night ${getElectionNightPanelYear() || ""}`.trim();
        if(button.textContent !== nextText) button.textContent = nextText;
    };
    const createMsnbcElectionPanelButton = () => {
        if(!document.body) {
            setTimeout(createMsnbcElectionPanelButton, 100);
            return;
        }
        injectMsnbcElectionPanelStyles();
        if(document.getElementById("bm-msnbc-election-btn")) {
            updateMsnbcElectionButtonVisibility();
            return;
        }
        const button = document.createElement("button");
        button.id = "bm-msnbc-election-btn";
        button.textContent = "Election Night";
        button.addEventListener("click", openMsnbcElectionPanel);
        document.body.appendChild(button);
        updateMsnbcElectionButtonVisibility();
    };
    const installMsnbcElectionPanel = () => {
        try {
            createMsnbcElectionPanelButton();
            if(msnbcElectionPanelObserver || !document.body) return;
            msnbcElectionPanelObserver = true;
            setInterval(updateMsnbcElectionButtonVisibility, 1000);
        } catch (error) {
            globalThis.bmMsnbcElectionPanelError = error;
        }
    };
    const formatPollPercentageText = (text) => {
        return String(text || "").replace(/(\d+(?:\.\d+)?)%/g, (_match, value) => {
            const number = Number(value);
            return Number.isFinite(number) ? Math.round(number).toString() + "%" : value + "%";
        });
    };
    const formatPollLeaderText = (text) => {
        return String(text || "").replace(/([+-])\s*(\d+(?:\.\d+)?)/g, (_match, sign, value) => {
            const number = Number(value);
            return Number.isFinite(number) ? sign + Math.round(number).toString() : sign + value;
        });
    };
    const formatPollLeaderCell = (cell) => {
        const leaderText = String(cell?.textContent || "");
        const marginMatch = leaderText.match(/([+-])\s*(\d+(?:\.\d+)?)/);
        if(marginMatch){
            const margin = Number(marginMatch[2]);
            if(Number.isFinite(margin) && Math.round(margin) === 0){
                cell.textContent = "Tie";
                cell.style.color = "black";
                return;
            }
        }
        formatTextNodes(cell, formatPollLeaderText);
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
        const pollTables = document.querySelectorAll("table.indPollTitleTbl, table.indPollTitleTbl2");
        pollTables.forEach(table => {
            const headerCells = Array.from(table.querySelectorAll("tr:first-child th"));
            if(headerCells.length === 0) return;
            const headers = headerCells.map(cell => String(cell.textContent || "").trim());
            const resultsIndex = headers.findIndex(header => header === "Results");
            const leaderIndex = headers.findIndex(header => header === "Leader");
            if(resultsIndex === -1 && leaderIndex === -1) return;
            Array.from(table.rows).slice(1).forEach(row => {
                if(resultsIndex !== -1 && row.cells[resultsIndex]){
                    formatTextNodes(row.cells[resultsIndex], formatPollPercentageText);
                }
                if(leaderIndex !== -1 && row.cells[leaderIndex]){
                    formatPollLeaderCell(row.cells[leaderIndex]);
                }
            });
        });
    };
    const queueIndependentPollDecimalFormatting = () => {
        if(independentPollFormatQueued) return;
        independentPollFormatQueued = true;
        setTimeout(() => {
            independentPollFormatQueued = false;
            pollAveragePointCenterCache = new WeakMap();
            pollAverageRawPointCenterCache = new WeakMap();
            formatIndependentPollDecimals();
            stylePollAverageGraphs(pollAverageActiveIndex, pollAverageActiveX);
            attachPollAverageCanvasTooltips();
        }, 0);
    };
    const isElementVisible = (element) => {
        if(!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none"
            && style.visibility !== "hidden"
            && element.getClientRects().length > 0;
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
        if(value.includes("governor")) return "governor";
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
    const getPollPageFilters = () => {
        const visibleSelects = Array.from(document.querySelectorAll("select")).filter(isElementVisible);
        if(visibleSelects.length < 3) return null;
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
        if(candidate?.id !== undefined && candidate?.id !== null) return String(candidate.id);
        return `${candidate?.first || ""}|${candidate?.last || ""}|${candidate?.party || ""}`;
    };
    const getPollCandidateId = (candidate) => {
        const id = Number(candidate?.id);
        return Number.isFinite(id) ? id : null;
    };
    const getPollCandidateName = (candidate) => {
        return String(candidate?.last || candidate?.first || "Candidate").trim();
    };
    const getPollPartyCode = (candidate) => {
        const party = String(candidate?.party || candidate?.caucus || "").toLowerCase();
        if(party.includes("dem")) return "D";
        if(party.includes("rep")) return "R";
        if(party.includes("ind")) return "I";
        return "";
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
    const getDisplayedPollPct = (pct) => {
        const number = Number(pct);
        return Number.isFinite(number) ? Math.round(number) : 0;
    };
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
        D: "#026eb6",
        R: "#cc0000",
        I: "#777777"
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
    const getPollWeeklyAverages = () => {
        const filters = getPollPageFilters();
        const pollResults = getIndependentPollResultsData();
        if(!filters || pollResults.length === 0) return [];
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
                        party: getPollPartyCode(candidate),
                        incumbent: false,
                        totalPct: 0,
                        totalDisplayPct: 0,
                        polls: 0
                    });
                }
                const candidateData = weekData.candidates.get(key);
                if(isPollCandidateIncumbent(candidate, poll)) candidateData.incumbent = true;
                const candidatePct = ((Number(candidate.votes) || 0) / totalVotes) * 100;
                candidateData.totalPct += candidatePct;
                candidateData.totalDisplayPct += getDisplayedPollPct(candidatePct);
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
                    .map(candidate => ({
                        name: candidate.name,
                        party: candidate.party,
                        incumbent: candidate.incumbent,
                        pct: candidate.polls > 0 ? candidate.totalPct / candidate.polls : 0,
                        displayPct: candidate.polls > 0 ? Math.floor(candidate.totalDisplayPct / candidate.polls) : 0
                    }))
                    .sort((a, b) => b.pct - a.pct);
                return { week: weekData.week, year: weekData.year, candidates };
            })
            .filter(weekData => weekData.candidates.length > 0);
        return weeksWithPolls;
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
        return `${number < 0 ? "-" : "+"}${Math.round(Math.abs(number))}`;
    };
    const isRoundedPollMarginTie = (value) => {
        const number = Number(String(value || "").replace(/\s+/g, ""));
        return Number.isFinite(number) && Math.round(Math.abs(number)) === 0;
    };
    const renderPollAverageTooltipCard = (week, year, candidates, marginParty, marginValue, leaderText, options = {}) => {
        const rating = getPollRating(marginParty, marginValue);
        const marginColour = pollPartyColours[marginParty] || "#666666";
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
        return `
            <div class="bm-poll-card">
                <div class="bm-poll-title">AVERAGE - WEEK ${escapePollHTML(weekLabel)}</div>
                ${options.primary ? "" : `<div class="bm-poll-rating" style="background:${rating.colour}; color:${rating.textColour};">${escapePollHTML(rating.label)}</div>`}
                <div class="bm-poll-header">
                    <span>Candidate</span>
                    <span>Est. Share</span>
                </div>
                ${rowsHTML}
                <div class="bm-poll-margin">
                    <span class="bm-margin-label">Leader:</span>
                    <span class="bm-margin-value" style="color:${marginColour};">${escapePollHTML(leaderText)}</span>
                </div>
            </div>
        `;
    };
    const formatPollAverageTooltipHTML = (weekData) => {
        const isPrimary = getPollPageFilters()?.category === "primary";
        const visibleAverage = getVisiblePollAverageForWeek(weekData.week, weekData.year);
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
                    pct: candidate.pct,
                    pctText: candidate.pctText || `${candidate.pct}%`
                };
            });
            let marginParty = "";
            let marginValue = 0;
            let leaderText = "Tie";
            const leaderMatch = visibleAverage.leaderText.match(/^\s*(.+?)\s*([+-]\s*\d+(?:\.\d+)?)\s*$/);
            if(leaderMatch){
                const leaderName = leaderMatch[1].trim();
                const leaderCandidate = findPollWeekCandidate(weekData, leaderName);
                const fallbackLeader = candidates
                    .slice()
                    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))[0];
                const displayLeaderName = leaderCandidate?.name || fallbackLeader?.name || leaderName;
                const margin = formatPollLeaderMarginValue(leaderMatch[2]);
                marginParty = leaderCandidate?.party || fallbackLeader?.party || "";
                marginValue = Math.abs(Number(margin));
                leaderText = isRoundedPollMarginTie(leaderMatch[2])
                    ? "Tie"
                    : `${displayLeaderName} ${margin}`;
            } else if(!/tie/i.test(visibleAverage.leaderText)) {
                const sortedVisibleCandidates = candidates
                    .slice()
                    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0));
                const first = sortedVisibleCandidates[0];
                const second = sortedVisibleCandidates[1];
                if(first && second){
                    const margin = first.pct - second.pct;
                    marginParty = first.party || "";
                    marginValue = Math.abs(margin);
                    leaderText = isRoundedPollMarginTie(margin)
                        ? "Tie"
                        : `${first.name} ${formatPollLeaderMarginValue(margin)}`;
                }
            }
            return renderPollAverageTooltipCard(weekData.week, weekData.year, candidates, marginParty, marginValue, leaderText, { primary: isPrimary });
        }
        const topCandidates = weekData.candidates.slice(0, 3);
        const formatAveragePct = (candidate) => {
            if(Number.isFinite(candidate?.displayPct)) return Math.max(0, candidate.displayPct);
            return Math.max(0, Math.floor(Number(candidate?.pct) || 0));
        };
        const candidates = topCandidates.map(candidate => ({
            name: candidate.name,
            party: candidate.party,
            incumbent: Boolean(candidate.incumbent),
            pct: formatAveragePct(candidate),
            pctText: `${formatAveragePct(candidate)}%`
        }));
        const first = topCandidates[0];
        const second = topCandidates[1];
        let marginParty = "";
        let marginValue = 0;
        let leaderText = "Tie";
        if(first && second){
            const margin = formatAveragePct(first) - formatAveragePct(second);
            marginParty = first.party || "";
            marginValue = Math.abs(margin);
            leaderText = isRoundedPollMarginTie(margin)
                ? "Tie"
                : `${first.name} ${formatPollLeaderMarginValue(margin)}`;
        }
        return renderPollAverageTooltipCard(weekData.week, weekData.year, candidates, marginParty, marginValue, leaderText, { primary: isPrimary });
    };
    const getPollAverageGraphElement = (targetElement) => {
        if(targetElement.tagName?.toLowerCase() === "canvas") return targetElement;
        const canvases = Array.from(targetElement.querySelectorAll?.("canvas") || []);
        return canvases.find(canvas => {
            const rect = canvas.getBoundingClientRect();
            return isElementVisible(canvas) && rect.width >= 250 && rect.height >= 150;
        }) || targetElement;
    };
    const getPollAverageGraphCanvases = () => {
        return Array.from(new Set([
            ...document.querySelectorAll("#pollDetailCanvas, #pollDetailCanvas2, canvas.pollDetailCanvas"),
            ...document.querySelectorAll("#pollDetailDiv canvas, #pollDetailCanvDiv canvas"),
            ...document.querySelectorAll("canvas")
        ])).filter(canvas => {
            const rect = canvas.getBoundingClientRect();
            return !canvas.classList.contains("bm-poll-graph-overlay")
                && isElementVisible(canvas)
                && rect.width >= 250
                && rect.height >= 150;
        });
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
                        points: []
                    });
                }
                seriesMap.get(key).points.push({
                    index: weekIndex,
                    week: weekData.week,
                    pct: Number(candidate.pct) || 0,
                    displayPct: Number.isFinite(candidate.displayPct)
                        ? candidate.displayPct
                        : Math.round(Number(candidate.pct) || 0)
                });
            });
        });
        return Array.from(seriesMap.values())
            .filter(series => series.points.length >= 2)
            .sort((a, b) => {
                const aLast = a.points[a.points.length - 1]?.pct || 0;
                const bLast = b.points[b.points.length - 1]?.pct || 0;
                return bLast - aLast;
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
        const pointCenters = getPollAveragePointCenters(graphElement, weeklyAverages);
        const normalizedCenters = normalizePollAverageCenters(pointCenters, weeklyAverages.length);
        const width = graphWidth
            || graphElement.width
            || graphElement.getBoundingClientRect().width;
        if(normalizedCenters) return normalizedCenters;
        const plotLeft = width * 0.085;
        const plotRight = Math.max(plotLeft + 1, getPollGraphPlotRight(width));
        const fallbackCenters = Array.from({ length: weeklyAverages.length }, (_value, index) => {
            if(weeklyAverages.length <= 1) return plotLeft;
            return plotLeft + ((plotRight - plotLeft) * (index / (weeklyAverages.length - 1)));
        });
        return fallbackCenters;
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
    const drawPollAverageOverlay = (graphElement, overlay, weeklyAverages, activeIndex = null, activeX = null) => {
        const series = getPollGraphSeries(weeklyAverages).slice(0, 3);
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
        const metrics = getPollGraphChartMetrics(graphElement, weeklyAverages, series);
        context.clearRect(0, 0, overlay.width, overlay.height);
        drawPollGraphWeekMarker(context, metrics, weeklyAverages, activeIndex, activeX);
    };
    const stylePollAverageGraphs = (activeIndex = null, activeX = null) => {
        const weeklyAverages = getPollWeeklyAverages();
        if(weeklyAverages.length < 2) return;
        getPollAverageGraphCanvases().forEach(graphElement => {
            const parent = graphElement.parentElement;
            if(!parent) return;
            if(window.getComputedStyle(parent).position === "static") parent.style.position = "relative";
            let overlay = pollAverageVisualOverlays.get(graphElement);
            if(!overlay || overlay.parentElement !== parent){
                overlay = document.createElement("canvas");
                overlay.className = "bm-poll-graph-overlay";
                overlay.style.position = "absolute";
                overlay.style.pointerEvents = "none";
                overlay.style.zIndex = "2";
                overlay.style.display = "block";
                parent.appendChild(overlay);
                pollAverageVisualOverlays.set(graphElement, overlay);
            }
            const isActiveGraph = graphElement === pollAverageActiveGraph;
            drawPollAverageOverlay(
                graphElement,
                overlay,
                weeklyAverages,
                isActiveGraph ? activeIndex : null,
                isActiveGraph ? activeX : null
            );
        });
    };
    const isPollAveragePointPixel = (red, green, blue, alpha) => {
        if(alpha < 100) return false;
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        return maxChannel > 130 && (maxChannel - minChannel) > 80;
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
    const showPollAverageTooltip = (event, targetElement) => {
        const weeklyAverages = getPollWeeklyAverages();
        if(weeklyAverages.length === 0) {
            hidePollAverageTooltip();
            return;
        }
        const graphElement = getPollAverageGraphElement(targetElement);
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
        stylePollAverageGraphs(index, selection.markerX);
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
        pollAverageActiveIndex = null;
        pollAverageActiveX = null;
        pollAverageActiveGraph = null;
        stylePollAverageGraphs(null, null);
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
            pollAverageTooltipTargets.add(target);
            target.style.cursor = "crosshair";
            target.addEventListener("mouseenter", event => showPollAverageTooltip(event, target));
            target.addEventListener("mousemove", event => showPollAverageTooltip(event, target));
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
    const installIndependentPollObserver = () => {
        installPollAverageCanvasRecorder();
        if(independentPollObserver) return;
        if(!document.body) {
            setTimeout(installIndependentPollObserver, 100);
            return;
        }
        independentPollObserver = new MutationObserver(queueIndependentPollDecimalFormatting);
        independentPollObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        queueIndependentPollDecimalFormatting();
        setTimeout(queueIndependentPollDecimalFormatting, 250);
        setTimeout(queueIndependentPollDecimalFormatting, 1000);
        setTimeout(queueIndependentPollDecimalFormatting, 2000);
        setTimeout(queueIndependentPollDecimalFormatting, 4000);
    };
    mod.init = () => {
        Executive.styles.registerStyle("styles/general.css");
        Executive.styles.registerThemeAwareStyle("styles/light.css", "styles/dark.css");
        const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
        config = JSON.parse(configText);
        createTooltip();
        if (!houseDistrictTooltipRefreshTimer) {
            houseDistrictTooltipRefreshTimer = setInterval(refreshActiveHouseDistrictTooltip, 500);
        }
        Executive.functions.registerReplacement("electPageMap", newElectPageMap);
        Executive.functions.registerReplacement("electNightMap", newElectNightMap);
        Executive.functions.registerReplacement("eSimUSCanvas", newSimUSCanvas);
        Executive.functions.registerReplacement("summaryNationMap", newSummaryNationMap);
        Executive.functions.registerPostHook("electNightUSSFunc", createMapChangeObserver("usSenate"));
        Executive.functions.registerPostHook("electNightUSHFunc", createMapChangeObserver("usHouse"));
        Executive.functions.registerPostHook("electNightGovFunc", createMapChangeObserver("governor"));
        Executive.functions.registerPostHook("electNightPresFunc", createMapChangeObserver("president"));
        if(config.showPanePartyID === true){
            Executive.functions.registerPostHook("houseElectPage", addPartyID);
            Executive.functions.registerPostHook("senateElectPage", addPartyID);
            Executive.functions.registerPostHook("governorElectPage", addPartyID);
        }
        Executive.functions.registerPostHook("independentPolls", queueIndependentPollDecimalFormatting);
        installIndependentPollObserver();
        try {
            installMsnbcElectionPanel();
        } catch (error) {
            globalThis.bmMsnbcElectionPanelError = error;
        }
    };
    module.exports = mod;
}
