/* Better Election Maps (NBC NEWS EDITIION) – better-maps/tooltip.js
*/

{
    const resultProxies = require("./proxies.js");
    const { getCandidateColour, stringifyColour } = require("./colours.js");
    const config = require("./config.json");
  
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.display = "none";
    tooltipDiv.setAttribute("id", "better-maps-tooltip");

    const tooltipComponents = {};

    function createCandidateRow(candidate, district, live, isProjectedWinner, isFirst) {
        const candidateName = candidate.name.split(" ").slice(1).join(" ") +
            (candidate.incumbent ? " * " : "");

        const candVotes = live ? candidate.currentVotes : candidate.votes;
        const distVotes = live ? district.totalCurrVotes : district.totalVotes;
        const pct = distVotes > 0 ? ((candVotes / distVotes) * 100).toFixed(2) : "0.00";

        const row = document.createElement("tr");

        const cellCandidate = document.createElement("td");
        cellCandidate.classList.add("cellCandidate");
        cellCandidate.innerText = candidateName;
        row.appendChild(cellCandidate);

        const cellParty = document.createElement("td");
        const divParty = document.createElement("div");
        divParty.innerText = candidate.party || "";
        if (candidate.party === "R") {
            cellParty.classList.add("party-r");
            divParty.classList.add("letter-party-r");
        } else if (candidate.party === "D") {
            cellParty.classList.add("party-d");
            divParty.classList.add("letter-party-d");
        } else if (candidate.party === "I") {
            cellParty.classList.add("party-i");
            divParty.classList.add("letter-party-i");
        }
        cellParty.appendChild(divParty);
        row.appendChild(cellParty);

        const cellVotes = document.createElement("td");
        cellVotes.classList.add("cellVotes");
        cellVotes.innerText = Math.round(candVotes).toLocaleString("en-US");
        row.appendChild(cellVotes);

        const cellPct = document.createElement("td");
        cellPct.classList.add("cellPct");
        cellPct.innerText = pct + "%";
        row.appendChild(cellPct);

        return row;
    }

    function createResultsTable(firstColLabel = "State") {
        const table = document.createElement("table");
        table.className = "bm-table-results";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const thState = document.createElement("th");
        thState.innerText = firstColLabel;
        thState.className = "thState";
        headerRow.appendChild(thState);

        const thCandidate = document.createElement("th");
        thCandidate.innerText = "Candidate";
        headerRow.appendChild(thCandidate);

        const thParty = document.createElement("th");
        thParty.innerText = "Party";
        headerRow.appendChild(thParty);

        const thVotes = document.createElement("th");
        thVotes.innerText = "Votes";
        headerRow.appendChild(thVotes);

        const thPct = document.createElement("th");
        thPct.innerText = "Pct.";
        headerRow.appendChild(thPct);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        table.appendChild(tbody);

        return { table, tbody };
    }

    const BG_THRESHOLD = 5;

    function updateBattlegroundBadge(stateCell, tooltipComponents, countyView, currentDistrict, live) {
    try {
        if (!stateCell || countyView) return;

        const elType = tooltipComponents?.properties?.electionType;
        if (!(elType === "president" || elType === "governor" || elType === "usSenate")) return;

        const stId = (tooltipComponents?.properties?.districtId || "").toLowerCase();
        if (!stId || stId === "us") return;

        const host = stateCell.querySelector(".state-info") || stateCell;
        let bgDiv = host.querySelector(".battlegroundState");
        if (!bgDiv) {
        bgDiv = document.createElement("div");
        bgDiv.className = "battlegroundState";
        bgDiv.style.marginTop = "6px";
        bgDiv.style.fontSize = "12px";
        host.appendChild(bgDiv);
        }

        const total = live ? currentDistrict?.totalCurrVotes : currentDistrict?.totalVotes;
        let topTwo = null;

        if (currentDistrict && Array.isArray(currentDistrict.cands) && total > 0) {
        const byParty = {};
        currentDistrict.cands.forEach(c => {
            const p = c.party || "O";
            const v = live ? (c.currentVotes || 0) : (c.votes || 0);
            byParty[p] = (byParty[p] || 0) + v;
        });
        const ranked = Object.entries(byParty)
            .map(([party, votes]) => ({ party, pct: (votes / total) * 100 }))
            .sort((a, b) => b.pct - a.pct);
        if (ranked.length >= 2) topTwo = [ranked[0], ranked[1]];
        }

        if (!topTwo) {
        const st = Executive?.data?.states?.[stId] ??
                    window?.[stId + "Stats"] ??
                    globalThis?.[stId + "Stats"];
        if (!st) { bgDiv.style.display = "none"; bgDiv.innerHTML = ""; return; }

        const toPct = v => (typeof v === "number" ? (v <= 1 ? v * 100 : v) : NaN);
        const list = [
            { party: "D", pct: toPct(st.demPop) },
            { party: "R", pct: toPct(st.repPop) },
            { party: "I", pct: toPct(st.indPop) }
        ].filter(x => Number.isFinite(x.pct))
        .sort((a, b) => b.pct - a.pct);

        if (list.length >= 2) topTwo = [list[0], list[1]];
        else { bgDiv.style.display = "none"; bgDiv.innerHTML = ""; return; }
        }

        const margin = Math.abs(topTwo[0].pct - topTwo[1].pct);
        if (margin <= BG_THRESHOLD) {
        bgDiv.style.display = "inline-block";
        bgDiv.innerHTML =
           `<span class="badge-battleground">Battleground</span>`;
        } else {
        bgDiv.style.display = "none";
        bgDiv.innerHTML = "";
        }
    } catch {}
    }

    function _niceInt(n, locale="en-US"){ return Math.round(n).toLocaleString(locale); }

    function getPanel(tc, key, factory){
    if (!tc[key]) {
        tc[key] = factory();
        tc.panelHost.appendChild(tc[key]);
    }
    return tc[key];
    }

    function _stableRandomBool(key){
        let h = 0;
        for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
        return (h & 1) === 1;
    }

    function resetPanels(tc){
    if (!tc?.panelHost) return;
    Array.from(tc.panelHost.children).forEach(el => { el.style.display = "none"; });
    }

    function updateReportedPanel(tc, currentDistrict, live, countyView){
    const allowed = new Set(["president","governor","usSenate"]);
    const et = tc?.properties?.electionType;

    if (countyView || !allowed.has(et)) {
        if (tc.reportedPanel) tc.reportedPanel.style.display = "none";
        if (tc.panelHost) tc.panelHost.style.display = "none";
    return;
    }

    const total = Math.max(0, Math.round(currentDistrict.totalVotes || 0));
    const reported = Math.max(0, Math.round(live ? (currentDistrict.totalCurrVotes||0) : total));
    if (total === 0){
        if (tc.reportedPanel) tc.reportedPanel.style.display = "none";
        if (tc.panelHost) tc.panelHost.style.display = "none"; 
    return;
    }

    let fracIn = NaN;

    const m = (tc.reporting?.innerText || "").match(/([\d.,]+)\s*%/);
    if (m) {
    const num = m[1].replace(/\./g, "").replace(",", ".");
    fracIn = parseFloat(num) / 100;
    }

    if (!Number.isFinite(fracIn) || fracIn <= 0) {
    fracIn = total > 0 ? (reported / total) : 0; 
    }
    let expected = Math.round(fracIn > 0 ? (reported / fracIn) : total);
    const step  = 50000;
    const etKey = tc?.properties?.electionType || "";
    const stKey = tc?.properties?.districtId  || "";
    const pctKey = String(Math.round(fracIn * 1000));
    const goUp = _stableRandomBool(`${etKey}|${stKey}|${pctKey}`);

    let expectedRounded = goUp
    ? Math.ceil(expected / step) * step   
    : Math.floor(expected / step) * step; 

    if (expectedRounded < reported) {
    expectedRounded = Math.ceil(Math.max(expected, reported) / step) * step;
    }

    const lockKey = `${et || ""}|${(tc?.properties?.districtId || "").toLowerCase()}`;

    tc.expectedVoteLocks = tc.expectedVoteLocks || Object.create(null);

    if (typeof tc.expectedVoteLocks[lockKey] === "number") {
    let locked = tc.expectedVoteLocks[lockKey];

    if (locked < reported) {
        locked = Math.ceil(reported / step) * step;
        tc.expectedVoteLocks[lockKey] = locked;
    }

    expectedRounded = locked;
    } else {
    tc.expectedVoteLocks[lockKey] = expectedRounded;
    }

    const remaining = Math.max(0, expectedRounded - reported);

    const HIDE_AT = 0.985;
    const SHOW_AGAIN_BELOW = 0.990;

    let progressToExpected = expectedRounded > 0 ? (reported / expectedRounded) : 0;

    tc._expectedUI = tc._expectedUI || Object.create(null);
    const uiKey = `${etKey}|${stKey}`;
    const prev = tc._expectedUI[uiKey] || { maxProgress: 0, hidden: false };

    const monotonicProgress = Math.max(prev.maxProgress, progressToExpected);

    let hidden = prev.hidden;
    if (!hidden && monotonicProgress >= HIDE_AT) hidden = true;
    else if (hidden && monotonicProgress < SHOW_AGAIN_BELOW) hidden = false;

    tc._expectedUI[uiKey] = { maxProgress: monotonicProgress, hidden };

    if (hidden) {
    if (tc.reportedPanel) tc.reportedPanel.style.display = "none";
    if (tc.panelHost) tc.panelHost.style.display = "none";
    return;
    }

    if (tc.panelHost) tc.panelHost.style.display = "flex";

    const panel = getPanel(tc, "reportedPanel", () => {
        const el = document.createElement("div");
        el.className = "bm-panel-reported";
        el.innerHTML = `
        <div class="bm-expected">
            <div class="bx-title">EXPECTED VOTE</div>
            <div class="bx-body">
            <span class="val-expected"></span>
            <span class="bx-sub">ESTIMATED</span>
            </div>
        </div>

        <div class="bm-middle">
           <div class="bm-barWrap">
            <div class="bm-bar">
                <div class="bm-fill"></div>
                <div class="bm-pointer"></div>
            </div>
            </div>

            <div class="bm-right">
            <div class="bm-box bm-remaining">
                <div class="val-remaining"></div>
                <div class="label-remaining">REMAINING</div>
            </div>

            <div class="bm-box bm-reported">
                <div class="val-reported"></div>
                <div class="label-reported">REPORTED</div>
            </div>
            </div>
        </div>
        `;
    return el;
    });

    const pct = Math.max(0, Math.min(100, (reported / total) * 100));
    panel.querySelector(".bm-fill").style.height = `${pct.toFixed(1)}%`;
    panel.querySelector(".val-reported").textContent = _niceInt(reported);

    const expEl = panel.querySelector(".val-expected");
    if (expEl) expEl.textContent = _niceInt(expectedRounded);

    const remEl = panel.querySelector(".val-remaining");
    if (remEl) remEl.textContent = _niceInt(remaining);

    const pointer = panel.querySelector(".bm-pointer");
    if (pointer) {
    const posFromTop = 100 - pct;          

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const safeTop = clamp(posFromTop, 3.9, 96.1);

    pointer.style.top = `${safeTop.toFixed(2)}%`;
    }
    panel.style.display = "flex";
    }

    function createNewEntries(currentDistrict, live, fillTop, primary, countyView) {
        tooltipComponents.electors.setAttribute("style", "display: none;");
        const percentReported = (currentDistrict.totalVotes > 0)
        ? Math.round((currentDistrict.totalCurrVotes / currentDistrict.totalVotes) * 100)
        : 0;
        if (!primary) {
            tooltipComponents.reporting.innerText = percentReported.toLocaleString() + "% in";
        }

        const sortedCands = currentDistrict.cands.slice().sort((a, b) => {
            if (live) return b.currentVotes - a.currentVotes;
            return b.votes - a.votes;
        });

        let highestTotal = 0;
        let winner = null;
        sortedCands.forEach(cand => {
            const totalVotes = live ? cand.currentVotes : cand.votes;
            if (totalVotes >= highestTotal) {
                highestTotal = totalVotes;
                winner = cand;
            }
        });

        let currentWinner = winner;
        if (live) {
            let currentHighestTotal = 0;
            sortedCands.forEach(cand => {
                if (cand.currentVotes >= currentHighestTotal) {
                    currentHighestTotal = cand.currentVotes;
                    currentWinner = cand;
                }
            });
        }

        const { table, tbody } = createResultsTable(countyView ? "County" : "State");

        const host = tooltipComponents.panelHost;

        [...tooltipComponents.entries.children].forEach(ch => {
        if (ch !== host) ch.remove();
        });

        tooltipComponents.entries.appendChild(table);
        tooltipComponents.entries.appendChild(host);
        if (primary) {
        if (host) {
            host.style.display = "none";
        }
        } else {
        tooltipComponents.entries.appendChild(host);
        host.style.display = "flex";
        }
        resetPanels(tooltipComponents);

        sortedCands.forEach((cand, index) => {
            const isProjectedWinner = !countyView && (cand === (live ? currentWinner : winner));
            const row = createCandidateRow(cand, currentDistrict, live, isProjectedWinner, index === 0);
            tbody.appendChild(row);
        });

        if (tooltipComponents.seatGainMessage) {
        tooltipComponents.seatGainMessage.style.display = "none";
        tooltipComponents.seatGainMessage.innerHTML = "";
        }
        
 
        if (tooltipComponents.projectedWinnerMessage) {
        tooltipComponents.projectedWinnerMessage.style.display = "none";
        tooltipComponents.projectedWinnerMessage.innerHTML = "";
        }
        if (tooltipComponents.turnout) {
        tooltipComponents.turnout.style.display = "none";
        tooltipComponents.turnout.innerHTML = "";
        }
        

        const candidateRows = tbody.rows;
        if (candidateRows.length > 0) {
            
            const stateCell = document.createElement("td");
            stateCell.classList.add("stateCell");

            stateCell.rowSpan = candidateRows.length;
            stateCell.style.textAlign = "left";
            stateCell.style.verticalAlign = "top";
            stateCell.innerHTML = `
                <div class="state-info" style="margin:0; padding:0; text-align: left;">
                    <div class="state-name">${tooltipComponents.title.innerText}</div>
                    <div class="state-electors">${tooltipComponents.electors.innerText}</div>
                    <div class="state-reporting">${tooltipComponents.reporting.innerText}</div>
                </div>
            `;
            candidateRows[0].insertBefore(stateCell, candidateRows[0].firstChild);

            (() => {
            const stateInfo = stateCell.querySelector(".state-info") || stateCell;

            updateBattlegroundBadge(stateCell, tooltipComponents, countyView);
            if (!primary && live) {
                updateReportedPanel(tooltipComponents, currentDistrict, live, countyView);
            } else {
            host.style.display = "none";
            }
            let extras = stateCell.querySelector(".state-extras");
            if (!extras) {
                extras = document.createElement("div");
                extras.className = "state-extras";
                extras.style.marginTop = "6px";
                extras.style.display = "grid";
                extras.style.gap = "4px";          
                stateInfo.appendChild(extras);
            }

            let diffDiv = stateCell.querySelector(".state-difference");
            if (!diffDiv) {
                diffDiv = document.createElement("div");
                diffDiv.className = "state-difference";
                diffDiv.style.fontSize = "12px";
                diffDiv.style.opacity = "0.85";
                extras.appendChild(diffDiv);
            }

            const cands = (currentDistrict.cands || []).slice();
            if (cands.length >= 2) {
                const byVotes = (a, b) =>
                (live ? (b.currentVotes || 0) - (a.currentVotes || 0)
                        : (b.votes || 0)        - (a.votes || 0));
                const [first, second] = cands.sort(byVotes);

                const v1 = live ? (first.currentVotes || 0) : (first.votes || 0);
                const v2 = live ? (second.currentVotes || 0) : (second.votes || 0);
                const diffVotes = Math.abs(v1 - v2);

                const total = live ? (currentDistrict.totalCurrVotes || 0)
                                : (currentDistrict.totalVotes || 0);
                const pctStr = (total > 0) ? ` (${((diffVotes / total) * 100).toFixed(2)}%)` : "";

                diffDiv.style.display = "block";
                diffDiv.textContent = `Margin: ${Math.round(diffVotes).toLocaleString("en-US")}${pctStr}`;
            } else {
                diffDiv.style.display = "none";
                diffDiv.textContent = "";
            }
            })();

        }


        {
        const tDiv = tooltipComponents.turnout;

        const et = tooltipComponents?.properties?.electionType;
        const allowed = et === "president" || et === "usSenate" || et === "governor";

        const tot = Number(currentDistrict.totalVotes) || 0;
        const cur = Number(currentDistrict.totalCurrVotes) || 0;
        const reported = (tot > 0) ? (cur / tot) : 0;
        const allCounted = reported >= 0.999;
        const showTurnout = (allowed && !countyView && currentDistrict.pW === true && allCounted);

        if (!tDiv) {

        } else if (showTurnout) {
            resetPanels(tooltipComponents);                             
            if (tooltipComponents.panelHost) tooltipComponents.panelHost.style.display = "none";

            const stId = (tooltipComponents?.properties?.districtId || "").toLowerCase();
            const st   = Executive?.data?.states?.[stId];

            const pop = Number(st?.pop) || 0;        
            let reg   = Number(st?.regVoters);       
            if (!Number.isFinite(reg)) reg = 0;
            const regFrac = (reg > 1 ? reg / 100 : reg);

            const registered = Math.round(pop * regFrac);  
            const finalVotes = Math.round(tot);            

            if (registered > 0 && finalVotes > 0) {
            const turnoutPct = Math.max(0, Math.min(100, (finalVotes / registered) * 100));
            const n = (x) => x.toLocaleString("en-US");
            tDiv.style.display = "block";
            tDiv.className = "state-turnout";
            tDiv.innerHTML =
                `<span>Turnout: ${turnoutPct.toFixed(1)}%</span>`;
            } else {
            tDiv.style.display = "none";
            tDiv.textContent = "";
            if (tooltipComponents.panelHost) tooltipComponents.panelHost.style.display = "flex";
            }
        } else {
            tDiv.style.display = "none";
            tDiv.textContent = "";
        }
        }

        if ((currentDistrict.pW === true || !live) && !countyView && winner) {
            if (fillTop) {
                tooltipComponents.winnerLine.setAttribute(
                    "style",
                    `background-color: ${stringifyColour(getCandidateColour(winner))}; height: 10px;`
                );

                const table = tooltipComponents.entries.querySelector("table");
                if (table && table.tBodies && table.tBodies[0] && table.tBodies[0].rows.length > 0) {
                    const winnerRow = table.tBodies[0].rows[0];
                    const winnerCell = winnerRow.cells[1];

                    const partyClasses = {
                        "R": "winner-r",  
                        "D": "winner-d",  
                        "I": "winner-i"   
                    };

                    if (partyClasses[winner.party]) {
                        winnerCell.classList.add(partyClasses[winner.party]);
                    }

                const candidateName = winnerCell.innerText.trim();
                winnerCell.innerHTML = `<span class="candidate-wrapper">
                    ${candidateName} &nbsp;
                    <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                    <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                    </svg>
                </span>`;
                }
                tooltipComponents.projectedWinnerMessage.style.display = "block";
                tooltipComponents.projectedWinnerMessage.innerHTML = `
                    <span class="candidate-wrapper">
                      PROJECTED WINNER &nbsp; <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                            <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                        </svg>
                    </span>`;
            }
        }

       if (
            winner &&
            currentDistrict.pW === true &&
            tooltipComponents.properties.electionType !== "president" &&
            (tooltipComponents.properties.electionType === "governor" ||
            tooltipComponents.properties.electionType === "usSenate") &&
            Array.isArray(currentDistrict.cands) && currentDistrict.cands.length > 0
        ) {
    
            (() => {
                const electionType = tooltipComponents.properties.electionType;
                const districtId   = (tooltipComponents.properties.districtId || "").toLowerCase();

                function getGovernorPartyFromExecutive(stateIdLower) {
                    try {
                        const st = Executive.data.states[stateIdLower];
                        if (!st) return { party: null, caucus: null };
                        const candidates = [
                            st.governor, st.governorObj, st.currentGovernor, st.gov,
                            st.officeHolders?.governor, st.executive?.governor,
                            st.governorID, st.currentGovernorID
                        ].filter(v => v != null);
                        if (!candidates.length) return { party: null, caucus: null };
                        const val = candidates[0];
                        if (typeof val === "object" && val.extendedAttribs) {
                            const p = val.extendedAttribs.party;
                            const party = p ? p.charAt(0) : null;
                            const caucus = (party === "I") ? (val.caucusParty || null) : null;
                            return { party, caucus };
                        }
                        const arr = findCandByID([val]);
                        if (Array.isArray(arr) && arr[0]) {
                            const wrapped = Executive.data.characters.wrapCharacter(arr[0], "candidate");
                            const p = wrapped?.extendedAttribs?.party;
                            const party = p ? p.charAt(0) : null;
                            const caucus = (party === "I") ? (wrapped?.caucusParty || null) : null;
                            return { party, caucus };
                        }
                        return { party: null, caucus: null };
                    } catch {
                        return { party: null, caucus: null };
                    }
                }

                const curParty  = winner.party;
                const curCaucus = winner.caucus || winner.caucusParty || null;
                let prevParty = null, prevCaucus = null;

                try {
                    let arr = null, gap = null;
                    if (electionType === "usSenate") { arr = usSenateArchive; gap = 6; }
                    else if (electionType === "governor") { arr = allGovArchive; gap = 4; }
                    if (arr && arr.length) {
                        const lastYear = arr[0].year - gap;
                        const last = arr.find(a => a.category === "general" && a.year === lastYear);
                        if (last) {
                            const full = Executive.data.states[districtId]?.name || "";
                            const prevDist = last.elections.find(d => (d.district || "").toLowerCase().trim() === full.toLowerCase().trim());
                            const prevCands = (prevDist?.cands || prevDist?.candidates || []).slice().sort((a,b)=>b.votes-a.votes);
                            if (prevCands.length) {
                                prevParty  = prevCands[0].party || null;
                                prevCaucus = prevCands[0].caucus || prevCands[0].caucusParty || null;
                            }
                        }
                    }
                } catch {}

                if (!prevParty) {
                    try {
                        const inc = (currentDistrict.cands || []).find(c => c.incumbent === true);
                        if (inc) {
                            prevParty  = inc.party || null;
                            prevCaucus = inc.caucus || inc.caucusParty || null;
                        }
                    } catch {}
                }

                if (!prevParty && electionType === "governor") {
                    const prev = getGovernorPartyFromExecutive(districtId);
                    prevParty  = prev.party;
                    prevCaucus = prev.caucus;
                }

                function mapFullPartyToAcronym(full) {
                    if (!full) return null;
                    const f = ("" + full).toLowerCase();
                    if (f.startsWith("dem")) return "D";
                    if (f.startsWith("rep")) return "R";
                    if (f.startsWith("ind")) return "I";
                    return full.charAt(0).toUpperCase();
                }

                function getStateCode2(districtIdLower) {
                    const st = Executive.data.states[districtIdLower];
                    return (st?.abbr || st?.abbrev || st?.code || st?.postal || st?.short || st?.shortName || st?.id || districtIdLower).toString().toUpperCase();
                }

                if (!prevParty && electionType === "governor") {
                    try {
                        const code2 = getStateCode2(districtId);
                        const candidatesLists = [
                            Executive.data.states[districtId]?.allGovernors,
                            Executive.data.allGovernors,
                            Executive.save?.allGovernors,
                            Executive?.gameData?.allGovernors
                        ].filter(a => Array.isArray(a) && a.length);
                        let found = null;
                        for (const list of candidatesLists) {
                            found = list.find(entry => Array.isArray(entry) && (entry[127] + "").toUpperCase() === code2);
                            if (found) break;
                        }
                        if (found) {
                            prevParty = mapFullPartyToAcronym(found[0]);
                        }
                    } catch (e) {
                        console.warn("[allGovernors] fallback error:", e);
                    }
                }

                const flipped = !!prevParty && (
                    prevParty !== curParty ||
                    ((prevParty === "I" || curParty === "I") && (prevCaucus !== curCaucus))
                );
                
                tooltipComponents.seatGainMessage.style.display = "none";
                tooltipComponents.seatGainMessage.innerHTML = "";

                   if (flipped) {
                    tooltipComponents.projectedWinnerMessage.innerHTML = `
                        <span class="candidate-wrapper">
                            PROJECTED WINNER &nbsp; <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                                <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                            </svg>
                            <div class="flipProjectedWinner"><svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-iconFLIP">
                                <line x1="7" y1="2" x2="7" y2="12"></line>
                                <line x1="2" y1="7" x2="12" y2="7"></line>
                            </svg>&nbsp;FLIP</div>
                        </span>`;
                    tooltipComponents.seatGainMessage.style.display = "inline-block";
                    tooltipComponents.seatGainMessage.style.display = "none";
                    tooltipComponents.seatGainMessage.innerHTML = "";
                } else {
                    tooltipComponents.seatGainMessage.style.display = "none";
                    tooltipComponents.seatGainMessage.innerHTML = "";
                    tooltipComponents.projectedWinnerMessage.style.display = "block";
                    tooltipComponents.projectedWinnerMessage.innerHTML = `
                    <span class="candidate-wrapper">
                        PROJECTED WINNER &nbsp;<svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                            <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                        </svg>
                    </span>`;
                }
                })();
        }


        if (live && !countyView && !currentDistrict.pW) {
        tooltipComponents.winnerLine.style.display = "none";

        const totalVotes = currentDistrict.totalVotes || 0;
        const currVotes  = currentDistrict.totalCurrVotes || 0;
        const reported   = (totalVotes > 0) ? (currVotes / totalVotes) * 100 : 0;
        const baseTotal  = live ? currVotes : totalVotes;

        if (tooltipComponents.earlyCallMessage) {
            tooltipComponents.earlyCallMessage.style.display = "none";
            tooltipComponents.earlyCallMessage.innerText = "";
        }
        if (tooltipComponents.closeCallMessage) {        
            tooltipComponents.closeCallMessage.style.display = "none";
            tooltipComponents.closeCallMessage.innerText = "";
        }
        
        if (tooltipComponents.turnout) {
        tooltipComponents.turnout.style.display = "none";
        tooltipComponents.turnout.innerHTML = "";
        }

        if (reported >= 10 && reported < 65) {
            if (tooltipComponents.earlyCallMessage) {
            tooltipComponents.earlyCallMessage.style.display = "block";
            tooltipComponents.earlyCallMessage.innerText = "TOO EARLY TO CALL";
            }
        }
        else if (reported >= 65 && baseTotal > 0 && Array.isArray(sortedCands) && sortedCands.length >= 2) {
            const topVotes    = live ? (sortedCands[0].currentVotes || 0) : (sortedCands[0].votes || 0);
            const secondVotes = live ? (sortedCands[1].currentVotes || 0) : (sortedCands[1].votes || 0);
            const pctDiff     = ((topVotes - secondVotes) / baseTotal) * 100;

            const start = 65, end = 95;
            const maxThr = 5.0, minThr = 1.5;
            const r = Math.max(0, Math.min(1, (reported - start) / (end - start)));
            const k = 1.8;
            const threshold = minThr + (maxThr - minThr) * (1 - Math.pow(r, k));
        if (pctDiff <= threshold) {
            tooltipComponents.closeCallMessage.style.display = "block";
            tooltipComponents.closeCallMessage.innerText = "TOO CLOSE TO CALL";
        }
        }
        } else {
        if (tooltipComponents.earlyCallMessage) {
            tooltipComponents.earlyCallMessage.style.display = "none";
            tooltipComponents.earlyCallMessage.innerText = "";
        }
        if (tooltipComponents.closeCallMessage) {
        tooltipComponents.closeCallMessage.style.display = "none";
        tooltipComponents.closeCallMessage.innerText = "";
        }
        
        }


    }

    function updateTooltip(electionType, districtId, force, live, countyView) {
        if (tooltipComponents.properties.visible === false) return;

        if (
            electionType === tooltipComponents.properties.electionType &&
            districtId === tooltipComponents.properties.districtId &&
            force !== true
        ) {
            return;
        }

        tooltipComponents.properties.electionType = electionType;
        tooltipComponents.properties.districtId = districtId;

        let currentResults = resultProxies[electionType];
        let currentDistrict = currentResults[districtId];

        if (countyView) {
            const actualStDistrict = currentResults[activeMap];
            if (actualStDistrict === undefined) {
                currentDistrict = undefined;
            } else {
                const origCounty = actualStDistrict.counties.filter(candCounty => {
                    const truncatedName = candCounty.name.substring(0, candCounty.name.lastIndexOf(" "));
                    const replacedName = candCounty.name.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
                    const truncatedReplacedName = truncatedName.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
                    return (replacedName === districtId || truncatedReplacedName === districtId);
                })[0];

                const stateElectData = allStElectData.filter(electData => (electData.id === activeMap))[0];
                let totalCurrVotes = 0;
                let totalVotes = 0;
                const newCounty = {
                    name: origCounty.name,
                    cands: origCounty.cands.map(candObj => {
                        const newCandObj = Object.assign({}, candObj);
                        if (!live) {
                            newCandObj.currentVotes = newCandObj.votes;
                        } else {
                            const countyElectData = stateElectData.counties.filter(candCountyData => (candCountyData.name === origCounty.name))[0];
                            newCandObj.currentVotes = newCandObj.votes * candObj.updates[countyElectData.indx];
                        }
                        totalCurrVotes += newCandObj.currentVotes;
                        totalVotes += newCandObj.votes;
                        return newCandObj;
                    })
                };
                newCounty.totalCurrVotes = totalCurrVotes;
                newCounty.totalVotes = totalVotes;
                currentDistrict = newCounty;
            }
        }

        if (electionType === "president" && !live && currentDistrict === undefined) {
            const filteredDemStates = presPrimaryDemArray.states.filter(stateObj => (stateObj.name === Executive.data.states[districtId].name));
            const filteredRepStates = presPrimaryRepArray.states.filter(stateObj => (stateObj.name === Executive.data.states[districtId].name));
            if (filteredDemStates.length !== 0) {
                const demPrimState = filteredDemStates[0];
                const repPrimState = filteredRepStates[0];
                currentDistrict = {
                    dem: {
                        cands: demPrimState.candidates.map(cand => {
                            cand.votes = cand.totVotes;
                            return cand;
                        })
                    },
                    rep: {
                        cands: repPrimState.candidates.map(cand => {
                            cand.votes = cand.totVotes;
                            return cand;
                        })
                    }
                };
            }
        }

        tooltipComponents.title.innerText = countyView
            ? currentDistrict.name.substring(0, currentDistrict.name.lastIndexOf(" "))
            : Executive.data.states[districtId].name.toUpperCase();

        tooltipComponents.winnerLine.setAttribute("style", "display: none;");
        tooltipComponents.notCounting.setAttribute("style", "display: none;");
        tooltipComponents.reporting.innerText = "";

        while (tooltipComponents.entries.firstChild) {
            tooltipComponents.entries.firstChild.remove();
        }

        if (currentDistrict === undefined) {
            if (tooltipComponents.seatGainMessage) {
                tooltipComponents.seatGainMessage.style.display = "none";
                tooltipComponents.seatGainMessage.innerHTML = "";
            }
            if (tooltipComponents.projectedWinnerMessage) {
                tooltipComponents.projectedWinnerMessage.style.display = "none";
                tooltipComponents.projectedWinnerMessage.innerHTML = "";
            }
            if (tooltipComponents.earlyCallMessage) {
                tooltipComponents.earlyCallMessage.style.display = "none";
                tooltipComponents.earlyCallMessage.innerHTML = "";
            }
            if (tooltipComponents.closeCallMessage) {
                tooltipComponents.closeCallMessage.style.display = "none";
                tooltipComponents.closeCallMessage.innerHTML = "";
            }
            if (tooltipComponents.turnout) {
            tooltipComponents.turnout.style.display = "none";
            tooltipComponents.turnout.innerHTML = "";
            }

            tooltipComponents.noElection.removeAttribute("style");
            return;
        } else {
            tooltipComponents.noElection.setAttribute("style", "display: none;");
        }

        if (currentDistrict.cands === undefined) {
            if (live && electionType !== "president") {
                const prevActiveMap = activeMap;
                activeMap = districtId.toUpperCase();
                const dummyElem = document.createElement("div");
                const originalGetElement = document.getElementById;
                document.getElementById = () => dummyElem;
                try {
                    eNightUSSUpdate();
                } catch { }
                document.getElementById = originalGetElement;
                dummyElem.remove();
                activeMap = prevActiveMap;
            }
            if (currentDistrict.dem.cands.length === 0 && currentDistrict.rep.cands.length === 0) {
                let voteTotal = 0;
                let newCandArray = [];
                currentDistrict.allCands.cands.forEach(candidate => {
                    voteTotal += (live ? ((candidate.currentVotes === undefined) ? 0 : candidate.currentVotes) : candidate.votes);
                    const newCand = Object.assign({}, candidate);
                    const candArray = findCandByID([candidate.id])[0];
                    const wrappedCandObj = Executive.data.characters.wrapCharacter(candArray, "candidate");
                    if (wrappedCandObj.extendedAttribs.party === "Independent") {
                        newCand.caucus = wrappedCandObj.caucusParty.substring(0, 1);
                    }
                    newCand.party = wrappedCandObj.extendedAttribs.party.substring(0, 1);
                    newCandArray.push(newCand);
                });
                if (live && voteTotal === 0) {
                    if (tooltipComponents.seatGainMessage) {
                        tooltipComponents.seatGainMessage.style.display = "none";
                        tooltipComponents.seatGainMessage.innerHTML = "";
                    }
                    if (tooltipComponents.projectedWinnerMessage) {
                        tooltipComponents.projectedWinnerMessage.style.display = "none";
                        tooltipComponents.projectedWinnerMessage.innerHTML = "";
                    }
                    if (tooltipComponents.earlyCallMessage) {
                        tooltipComponents.earlyCallMessage.style.display = "none";
                        tooltipComponents.earlyCallMessage.innerHTML = "";
                    }
                    if (tooltipComponents.closeCallMessage) {
                        tooltipComponents.closeCallMessage.style.display = "none";
                        tooltipComponents.closeCallMessage.innerHTML = "";
                    }
                    if (tooltipComponents.turnout) {
                    tooltipComponents.turnout.style.display = "none";
                    tooltipComponents.turnout.innerHTML = "";
                    }
                        tooltipComponents.notCounting.removeAttribute("style");
                        return;
                    }
                const fakeDistrict = {
                    totalVotes: voteTotal,
                    totalCurrVotes: voteTotal,
                    cands: newCandArray,
                    pW: false
                };
                createNewEntries(fakeDistrict, live, false, true, countyView);
            } else {
                if (currentDistrict.dem.cands.length !== 0) {
                    let demVoteTotal = 0;
                    let newDemCandArray = [];
                    currentDistrict.dem.cands.forEach(candidate => {
                        demVoteTotal += (live ? ((candidate.currentVotes === undefined) ? 0 : candidate.currentVotes) : candidate.votes);
                        const newCand = Object.assign({}, candidate);
                        newCand.party = "D";
                        newDemCandArray.push(newCand);
                    });
                    const demFakeDistrict = {
                        totalVotes: demVoteTotal,
                        totalCurrVotes: demVoteTotal,
                        cands: newDemCandArray,
                        pW: false
                    };
                    if (live && demVoteTotal === 0) {
                        if (tooltipComponents.seatGainMessage) {
                            tooltipComponents.seatGainMessage.style.display = "none";
                            tooltipComponents.seatGainMessage.innerHTML = "";
                        }
                        if (tooltipComponents.projectedWinnerMessage) {
                            tooltipComponents.projectedWinnerMessage.style.display = "none";
                            tooltipComponents.projectedWinnerMessage.innerHTML = "";
                        }
                        if (tooltipComponents.earlyCallMessage) {
                        tooltipComponents.earlyCallMessage.style.display = "none";
                        tooltipComponents.earlyCallMessage.innerHTML = "";
                        }
                        if (tooltipComponents.closeCallMessage) {
                            tooltipComponents.closeCallMessage.style.display = "none";
                            tooltipComponents.closeCallMessage.innerHTML = "";
                        }
                        if (tooltipComponents.turnout) {
                        tooltipComponents.turnout.style.display = "none";
                        tooltipComponents.turnout.innerHTML = "";
                        }
                            tooltipComponents.notCounting.removeAttribute("style");
                            return;
                        }
                    createNewEntries(demFakeDistrict, live, false, true, countyView);
                    if (currentDistrict.rep.cands.length !== 0) {
                        tooltipComponents.entries.appendChild(document.createElement("hr"));
                    }
                }
                if (currentDistrict.rep.cands.length !== 0) {
                    let repVoteTotal = 0;
                    let newRepCandArray = [];
                    currentDistrict.rep.cands.forEach(candidate => {
                        repVoteTotal += (live ? ((candidate.currentVotes === undefined) ? 0 : candidate.currentVotes) : candidate.votes);
                        const newCand = Object.assign({}, candidate);
                        newCand.party = "R";
                        newRepCandArray.push(newCand);
                    });
                    const repFakeDistrict = {
                        totalVotes: repVoteTotal,
                        totalCurrVotes: repVoteTotal,
                        cands: newRepCandArray,
                        pW: false
                    };
                    createNewEntries(repFakeDistrict, live, false, true, countyView);
                }
            }
        } else {
            if (electionType === "president" && !countyView && !(live && currentDistrict.totalCurrVotes === 0)) {
                tooltipComponents.electors.innerText = `${Executive.data.states[districtId].electoralNum} electoral votes`;
                tooltipComponents.electors.removeAttribute("style");
            } else {
                tooltipComponents.electors.innerText = "";
                tooltipComponents.electors.setAttribute("style", "display: none;");
            }
            if (live && currentDistrict.totalCurrVotes === 0) {
                if (tooltipComponents.seatGainMessage) {
                    tooltipComponents.seatGainMessage.style.display = "none";
                    tooltipComponents.seatGainMessage.innerHTML = "";
                }
                if (tooltipComponents.projectedWinnerMessage) {
                    tooltipComponents.projectedWinnerMessage.style.display = "none";
                     tooltipComponents.projectedWinnerMessage.innerHTML = "";
                }
                if (tooltipComponents.earlyCallMessage) {
                    tooltipComponents.earlyCallMessage.style.display = "none";
                     tooltipComponents.earlyCallMessage.innerHTML = "";
                }
                if (tooltipComponents.closeCallMessage) {
                    tooltipComponents.closeCallMessage.style.display = "none";
                     tooltipComponents.closeCallMessage.innerHTML = "";
                }
                if (tooltipComponents.turnout) {
                tooltipComponents.turnout.style.display = "none";
                tooltipComponents.turnout.innerHTML = "";
                }
                tooltipComponents.notCounting.removeAttribute("style");
            } else {
                createNewEntries(currentDistrict, live, true, false, countyView);
            }
        }
    }

    function createTooltip() {
        tooltipComponents.properties = {
            visible: true,
            targetDistrict: null,
            electionType: "",
            districtId: ""
        };
        tooltipComponents.expectedVoteLocks = Object.create(null);


        tooltipComponents.winnerLine = document.createElement("div");
        tooltipComponents.winnerLine.setAttribute("id", "better-maps-tooltip-win-line");
        tooltipComponents.winnerLine.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.winnerLine);

        tooltipComponents.header = document.createElement("div");
        tooltipComponents.header.setAttribute("id", "better-maps-tooltip-header");
        tooltipDiv.appendChild(tooltipComponents.header);

        tooltipComponents.title = document.createElement("div");
        tooltipComponents.title.setAttribute("id", "better-maps-tooltip-title");

        tooltipComponents.reporting = document.createElement("div");
        tooltipComponents.reporting.setAttribute("id", "better-maps-tooltip-reporting");

        tooltipComponents.projectedWinnerMessage = document.createElement("div");
        tooltipComponents.projectedWinnerMessage.setAttribute("id", "better-maps-tooltip-projectedwinner");
        tooltipComponents.projectedWinnerMessage.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.projectedWinnerMessage);

        tooltipComponents.turnout = document.createElement("div");
        tooltipComponents.turnout.setAttribute("id", "better-maps-tooltip-turnout");
        tooltipComponents.turnout.style.display = "none";
        tooltipDiv.insertBefore(tooltipComponents.turnout, tooltipComponents.projectedWinnerMessage);

        tooltipComponents.seatGainMessage = document.createElement("div");
        tooltipComponents.seatGainMessage.setAttribute("id", "better-maps-tooltip-seatgain");
        tooltipComponents.seatGainMessage.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.seatGainMessage);

        tooltipComponents.earlyCallMessage = document.createElement("div");
        tooltipComponents.earlyCallMessage.setAttribute("id", "better-maps-tooltip-earlycall");
        tooltipComponents.earlyCallMessage.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.earlyCallMessage);

        tooltipComponents.closeCallMessage = document.createElement("div");
        tooltipComponents.closeCallMessage.setAttribute("id", "better-maps-tooltip-closecall");
        tooltipComponents.closeCallMessage.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.closeCallMessage);

        tooltipComponents.noElection = document.createElement("div");
        tooltipComponents.noElection.innerText = "No election was held in this state this cycle.";
        tooltipComponents.noElection.setAttribute("id", "better-maps-tooltip-no-election");
        tooltipComponents.noElection.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.noElection);

        tooltipComponents.notCounting = document.createElement("div");
        tooltipComponents.notCounting.innerText = "This state has not begun counting yet.";
        tooltipComponents.notCounting.setAttribute("id", "better-maps-tooltip-not-counted");
        tooltipComponents.notCounting.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.notCounting);

        tooltipComponents.entries = document.createElement("div");
        tooltipComponents.entries.setAttribute("id", "better-maps-tooltip-entries");
        tooltipDiv.appendChild(tooltipComponents.entries);

        tooltipComponents.panelHost = document.createElement("div");
        tooltipComponents.panelHost.id = "better-maps-tooltip-panels";
        tooltipComponents.entries.appendChild(tooltipComponents.panelHost);

        /*tooltipComponents.footer = document.createElement("div");
        tooltipComponents.footer.setAttribute("id", "better-maps-tooltip-footer");
        tooltipComponents.footer.innerHTML = `
        <div>
            ${LOGO_SVG}
        </div>
        `;
        tooltipDiv.appendChild(tooltipComponents.footer);*/


        tooltipComponents.electors = document.createElement("div");
        tooltipComponents.electors.setAttribute("id", "better-maps-tooltip-electors");
        tooltipComponents.electors.style.display = "none";
        document.body.appendChild(tooltipDiv);
    }

    module.exports = {
        tooltipDiv,
        tooltipComponents,
        updateTooltip,
        createTooltip
    };
};