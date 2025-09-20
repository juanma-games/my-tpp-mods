/* Better Election Maps – better-maps/main.js
   The main body of the Better Election Maps mod to be loaded first by Executive. */

/* Wrapping everything possible here in a block is good practice to avoid exposing arbitrary
   globals to other loaded mods. */
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

    const { tooltipDiv, tooltipComponents, updateTooltip, createTooltip, updateSenateControlBanner } = require("./tooltip.js");

    let config = null;

    let onCountyMap = false;
    let lastMapElectionType = "none";

    let lastUpdateDataHook = null;

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

    const updateMap = (svgMap, resultColours, electionType, live, projected) => {
        svgMap.setAttribute("data-colours", JSON.stringify(resultColours));

        const resultKeys = Object.keys(resultColours);

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
                /* This is the old colour scale behaviour. */
                if(majorities.length > 0){
                    majorityScale = d3.scaleLinear(
                        d3.extent(majorities),
                        [0.625, 1.375]
                    );
                };
            } else {
                /* Newer, shinier and probably more rational absolute scales. */
                majorityScale = d3.scaleLinear(
                    d3.extent([0, 0.35]),
                    [0.625, 1.375]
                );
            }
        }

        resultKeys.forEach(stateId => {
            const currentDistrict = resultProxies[electionType][stateId];

            if(currentDistrict !== undefined && (electionType === "usHouse" || electionType === "usHousePol" 
                || electionType === "governorPol" || electionType === "usSenatePol" 
                || currentDistrict.cands !== undefined)) {
                let raceInfo = null;
                let newColour = null;

                if(electionType === "usHouse" || electionType === "usHousePol") {
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
        try { updateSenateControlBanner(); } catch (e) {}
        } else {
        const el = document.getElementById("bm-senate-banner");
        if (el) { el.classList.remove("show"); el.innerHTML = ""; }
        }

    };

    const updateCountyMap = (svgMap, electionType, live) => {
        const currentOrigCounties = resultProxies[electionType][activeMap].counties;
        const newCounties = [];

        /* The live county map determines the current votes in each county
           by multiplying the final total votes by a value in an updates
           array. The value to be used for each candidate in each county is
           determined by an index given for that county. We need to do this
           ourselves by getting the index from allStElectData. */
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
            /* This is the old colour scale behaviour. */
            if(majorities.length > 0){
                majorityScale = d3.scaleLinear(
                    d3.extent(majorities),
                    [0.625, 1.375]
                );
            };
        } else {
            /* Newer, shinier and probably more rational absolute scales. */
            majorityScale = d3.scaleLinear(
                d3.extent([0, 0.35]),
                [0.625, 1.375]
            );
        }

        /* After all this, we're now ready to colour the map! */
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

            /* The SVGs contain county names without 'County' appended, so we need
               to cut this off. However, Maryland has Baltimore County and Baltimore
               City districts, so we need to check for the full name just in case as
               a workaround. */
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
        /* Create a single hatch fill SVG pattern. */
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

    const createCrossHatches = (svgElem) => {
        /* To show seat gains and mixed seats (like in the Politicians->Federal->Senate display), we
           want to create stripes that can be used as fills in place of solid colours. We need to
           create SVG patterns to represent the possible configurations.
           
           This code is silly, but it works. */
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

    const renderMap = (canvasElem, resultColours, electionType, live, onClickPageFunc, projected) => {
        const container = canvasElem.parentElement;
        let svgMap = document.getElementById(electionType + "-map" + (live ? "-live" : ""));

        let isProjected = (projected === undefined) ? false : projected;
        if(document.getElementById(!live ? "ePageProjectB" : "eNightProjectB")){
            /* Determine whether the currently displayed map is a projection map or a margin map. */
            isProjected = document.getElementById(!live ? "ePageProjectB" : "eNightProjectB").getAttribute("class")
                === (!live ? "ePageProjectBActive" : "eNightProjectBActive");
        }

        /* We want to remove the tooltip update hook if it exists from before. */
        if(lastUpdateDataHook !== null) {
            Executive.functions.deregisterPostHook("electNightUpdateData", lastUpdateDataHook);
            lastUpdateDataHook = null;
        }

        /* If we were in county view, check that we're still in county view. */
        if(electionType !== lastMapElectionType) onCountyMap = false;
        lastMapElectionType = electionType;

        let mapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep +
            ((electionType === "president") ? "presidential.svg" : "states.svg");

        /* If we're in county view, make sure that's valid – check we're not on a primary,
           selecting a state which didn't have elections or selecting a state which hasn't
           started counting yet. */
        if(onCountyMap){
            if(!resultProxies[electionType][activeMap]) onCountyMap = false;
            else if(!resultProxies[electionType][activeMap].cands) onCountyMap = false;
            else if(resultProxies[electionType][activeMap].totalCurrVotes !== undefined
                && resultProxies[electionType][activeMap].totalCurrVotes === 0) onCountyMap = false;
        }

        /* If we're in county view, swap the map. */
        if(onCountyMap){
            const countyMapPath = Executive.mods.getRelativePathPrefix() + path.sep + "data" + path.sep + "counties" + path.sep +
                activeMap.toLowerCase() + ".svg";
            
            if(fs.existsSync(countyMapPath)) mapPath = countyMapPath;
            else onCountyMap = false;
        }

        /* If we're in county view, we also need to change the buttons in the top-left. */
        if(onCountyMap){
            const projectButton = document.getElementById(live ? "eNightProjectB" : "ePageProjectB");
            const marginButton = document.getElementById(live ? "eNightMarginB" : "ePageMarginB");

            if(projectButton && marginButton){
                projectButton.setAttribute("style", "display: none;");
                marginButton.setAttribute("style", "display: none;");
            }

            const returnButton = document.createElement("button");
            returnButton.setAttribute("id", projected ? "ePageReturnB2" : (live ? "eNightReturnB" : "ePageReturnB"));
            returnButton.textContent = "Return to U.S. Map";

            returnButton.onclick = () => {
                playClick();

                onCountyMap = false;

                /* As we're switching away from county map and there might not be a
                    state where the cursor currently is, hide the tooltip. */
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
                            playClick();

                            activeMap = stateId;
                            if(electionType === "president") activeCampMap = Executive.data.states[stateId.toLowerCase()];

                            if(electionType !== "usHouse" && electionType !== "usHousePol"
                                && electionType !== "governorPol" && electionType !== "usSenatePol"){
                                onCountyMap = true;
                                
                                /* As we're switching to the county map and there might not be a
                                   county where the cursor currently is, hide the tooltip. */
                                tooltipDiv.setAttribute("style", "display: none;");
                                tooltipComponents.properties.visible = false;
                                tooltipComponents.properties.targetDistrict = null;
                            }

                            onClickPageFunc();
                        });
                    }

                    if(electionType !== "usHouse" && electionType !== "usHousePol"
                        && electionType !== "governorPol" && electionType !== "usSenatePol"){
                        statePaths[i].addEventListener("mousemove", (event) => {
                            tooltipComponents.properties.visible = true;
                            tooltipComponents.properties.targetDistrict = stateId.toLowerCase();

                            updateTooltip(electionType, stateId.toLowerCase(), false, live, onCountyMap);

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

        /* We want a hook to update the tooltip if it's appropriate in live primaries. */
        if(live && electionType !== "usHouse" && electionType !== "usHousePol"){
            lastUpdateDataHook = Executive.functions.registerPostHook("electNightUpdateData", () => {
                if(tooltipComponents.properties.targetDistrict !== null)
                    updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
            });
        }

        /* Finally, update the tooltip where appropriate. */
        if(tooltipComponents.properties.targetDistrict !== null)
            updateTooltip(electionType, tooltipComponents.properties.targetDistrict, true, live, onCountyMap);
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

                /* We need to check if this is a primary – the function is different. */
                if(electNightP.elections[0].cands === undefined) onClickPageFunc = electNightPPFunc;
                break;
        }

        renderMap(canvasElem, resultColours, electionType, true, onClickPageFunc);
    };

    const newSimUSCanvas = (canvasElem, resultColours, arg2) => {
        renderMap(canvasElem, resultColours, "president", false, presElectPage);
    };

    const newSummaryNationMap = (canvasElem, resultColours, arg2, arg3) => {
        /* The game doesn't pass a reliable election type to summaryNationMap – for whatever reason,
           it's always usSenate even if the player is on the House/Governor page. As such, we need
           to detect it ourselves using the current open page. */
        let electionType = "";

        if(openPolPage1 === "nation"){
            electionType = (openPolPage2 === "legislate1") ? "usHousePol" : "usSenatePol";
        } else {
            /* The only other map outside of the nation options is the governor map. */
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
                    /* The button change affects the class of the button elements. */
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

    mod.init = () => {
        /* Add the stylesheets for UI components. */
        Executive.styles.registerStyle("styles/general.css");
        Executive.styles.registerThemeAwareStyle("styles/light.css", "styles/dark.css");

        /* Load the mod configuration file. */
        const configText = fs.readFileSync(Executive.mods.getRelativePathPrefix() + path.sep + "config.json", "utf8");
        config = JSON.parse(configText);

        /* We'll create one tooltip UI component now which is used whenever the player hovers over part of a map.
           We can use the same tooltip for every map widget, because you can't hover over two maps at once, duh. */
        createTooltip();

        Executive.functions.registerReplacement("electPageMap", newElectPageMap);
        Executive.functions.registerReplacement("electNightMap", newElectNightMap);
        Executive.functions.registerReplacement("eSimUSCanvas", newSimUSCanvas);
        Executive.functions.registerReplacement("summaryNationMap", newSummaryNationMap);

        /* On the election night view, updates to the Projections and Margins buttons occur after electNightMap is
           called. We therefore need to add a post-hook to the electNightUSSFunc and electNightGovFunc functions to
           create MutationObservers to track changes and re-render the map. */
        Executive.functions.registerPostHook("electNightUSSFunc", createMapChangeObserver("usSenate"));
        Executive.functions.registerPostHook("electNightGovFunc", createMapChangeObserver("governor"));
        Executive.functions.registerPostHook("electNightPresFunc", createMapChangeObserver("president"));

        if(config.showPanePartyID === true){
            Executive.functions.registerPostHook("houseElectPage", addPartyID);
            Executive.functions.registerPostHook("senateElectPage", addPartyID);
            Executive.functions.registerPostHook("governorElectPage", addPartyID);
        }
    };

    module.exports = mod;
}