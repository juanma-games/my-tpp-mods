/* Better Election Maps – better-maps/tooltip.js
   Versión con tabla ("Candidate | Party | Votes | %").
   Se pinta el fondo del candidato proyectado ganador (a nivel estatal)
   con el color del partido, y se añade una columna a la izquierda para
   mostrar información del estado.
*/

{
    const resultProxies = require("./proxies.js");
    const { getCandidateColour, stringifyColour } = require("./colours.js");

    // Creamos el contenedor principal del tooltip
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.display = "none";
    tooltipDiv.setAttribute("id", "better-maps-tooltip");

    // Objeto para guardar referencias a los sub-elementos
    const tooltipComponents = {};

    /************************************************************
     * 1) Crea la fila (tr) para cada candidato en la tabla.
     *    Se añade el fondo del candidato proyectado ganador a nivel estatal.
     ************************************************************/
    function createCandidateRow(candidate, district, live, isProjectedWinner, isFirst) {
        // Nombre del candidato + asterisco si es incumbente
        const candidateName = candidate.name.split(" ").slice(1).join(" ") +
            (candidate.incumbent ? " * " : "");

        // Calcula votos y %
        const candVotes = live ? candidate.currentVotes : candidate.votes;
        const distVotes = live ? district.totalCurrVotes : district.totalVotes;
        const pct = distVotes > 0 ? ((candVotes / distVotes) * 100).toFixed(1) : "0.0";

        // Crea la fila
        const row = document.createElement("tr");

        // Columna 1: Candidate (sin la columna de estado, ya que se añadirá aparte)
        const cellCandidate = document.createElement("td");
        cellCandidate.classList.add("cellCandidate");
        cellCandidate.innerText = candidateName;
        row.appendChild(cellCandidate);

        // Columna 2: Party
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

        // Columna 3: Votes
        const cellVotes = document.createElement("td");
        cellVotes.innerText = Math.round(candVotes).toLocaleString();
        row.appendChild(cellVotes);

        // Columna 4: %
        const cellPct = document.createElement("td");
        cellPct.classList.add("cellPct");
        cellPct.innerText = pct + "%";
        row.appendChild(cellPct);

        return row;
    }


    /************************************************************
     * 2) Crea una tabla con THEAD y TBODY, incluyendo la columna de Estado.
     ************************************************************/
    function createResultsTable() {
        const table = document.createElement("table");
        table.className = "bm-table-results";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        // Nueva columna para State
        const thState = document.createElement("th");
        thState.innerText = "State";
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


    /************************************************************
     * 3) Reemplaza createNewEntries para generar la tabla.
     ************************************************************/
    function createNewEntries(currentDistrict, live, fillTop, primary, countyView) {
        tooltipComponents.electors.setAttribute("style", "display: none;");
        const percentReported = Math.round(
            (currentDistrict.totalCurrVotes / currentDistrict.totalVotes) * 100
        );
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

        const { table, tbody } = createResultsTable();
        while (tooltipComponents.entries.firstChild) {
            tooltipComponents.entries.removeChild(tooltipComponents.entries.firstChild);
        }
        tooltipComponents.entries.appendChild(table);

        // Agregar filas de candidatos
        sortedCands.forEach((cand, index) => {
            const isProjectedWinner = !countyView && (cand === (live ? currentWinner : winner));
            const row = createCandidateRow(cand, currentDistrict, live, isProjectedWinner, index === 0);
            tbody.appendChild(row);
        });
        

        // Insertamos la celda de State en la primera fila, abarcando todas las filas de candidatos
        const candidateRows = tbody.rows;
        if (candidateRows.length > 0) {
            
            const stateCell = document.createElement("td");
            stateCell.classList.add("stateCell");

            stateCell.rowSpan = candidateRows.length;
            stateCell.style.textAlign = "left";
            stateCell.style.verticalAlign = "top";
            // Se asume que tooltipComponents.title contiene el nombre del estado,
            // tooltipComponents.electors los votos electorales y tooltipComponents.reporting el % de reporting.
            stateCell.innerHTML = `
                <div class="state-info" style="margin:0; padding:0; text-align: left;">
                    <div class="state-name">${tooltipComponents.title.innerText}</div>
                    <div class="state-electors">${tooltipComponents.electors.innerText}</div>
                    <div class="state-reporting">${tooltipComponents.reporting.innerText}</div>
                </div>
            `;
            // Insertar la celda al inicio de la primera fila
            candidateRows[0].insertBefore(stateCell, candidateRows[0].firstChild);
        }

        // Lógica para pintar el ganador
        if ((currentDistrict.pW === true || !live) && !countyView && winner) {
            if (fillTop) {
                tooltipComponents.winnerLine.setAttribute(
                    "style",
                    `background-color: ${stringifyColour(getCandidateColour(winner))}; height: 10px;`
                );

                // Obtenemos la primera fila (que corresponde al ganador) y la primera celda (Candidate)
                const table = tooltipComponents.entries.querySelector("table");
                if (table && table.tBodies && table.tBodies[0] && table.tBodies[0].rows.length > 0) {
                    // La primera fila tiene ahora una celda extra al principio (State),
                    // así que la celda de candidate es la segunda (índice 1)
                    const winnerRow = table.tBodies[0].rows[0];
                    const winnerCell = winnerRow.cells[1];

                    // Clases CSS para cada partido
                    const partyClasses = {
                        "R": "winner-r",  // Rojo para Republicanos
                        "D": "winner-d",  // Azul para Demócratas
                        "I": "winner-i"   // Gris para Independientes
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
            }
        }

        // Lógica para mostrar "TOO CLOSE TO CALL" en vivo.
        if (live && !countyView && percentReported >= 50 && !currentDistrict.pW && currentDistrict.totalVotes > 0) {
            const percentageDifference = ( (sortedCands[0].votes || sortedCands[0].currentVotes) - (sortedCands[1] ? (sortedCands[1].votes || sortedCands[1].currentVotes) : 0) ) / currentDistrict.totalVotes * 100;
            if (percentageDifference < 4) {
                tooltipComponents.closeCallMessage.style.display = "block";
                tooltipComponents.closeCallMessage.innerText = "TOO CLOSE TO CALL";
            } else {
                tooltipComponents.closeCallMessage.style.display = "none";
                tooltipComponents.closeCallMessage.innerText = "";
            }
        } else {
            tooltipComponents.closeCallMessage.style.display = "none";
            tooltipComponents.closeCallMessage.innerText = "";
        }
    }


    /************************************************************
     * 4) updateTooltip (igual que el original, pero llama a createNewEntries)
     ************************************************************/
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
                tooltipComponents.notCounting.removeAttribute("style");
            } else {
                createNewEntries(currentDistrict, live, true, false, countyView);
            }
        }
    }


    /************************************************************
     * 5) Crea el tooltip en el DOM (igual que en el original)
     ************************************************************/
    function createTooltip() {
        tooltipComponents.properties = {
            visible: true,
            targetDistrict: null,
            electionType: "",
            districtId: ""
        };

        tooltipComponents.winnerLine = document.createElement("div");
        tooltipComponents.winnerLine.setAttribute("id", "better-maps-tooltip-win-line");
        tooltipComponents.winnerLine.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.winnerLine);

        tooltipComponents.header = document.createElement("div");
        tooltipComponents.header.setAttribute("id", "better-maps-tooltip-header");
        tooltipDiv.appendChild(tooltipComponents.header);
        

        tooltipComponents.title = document.createElement("div");
        tooltipComponents.title.setAttribute("id", "better-maps-tooltip-title");
        /*tooltipComponents.header.appendChild(tooltipComponents.title);*/

        tooltipComponents.reporting = document.createElement("div");
        tooltipComponents.reporting.setAttribute("id", "better-maps-tooltip-reporting");
        /*tooltipComponents.header.appendChild(tooltipComponents.reporting);*/

        // Se crea el elemento para el mensaje "TOO CLOSE TO CALL"
        tooltipComponents.closeCallMessage = document.createElement("div");
        tooltipComponents.closeCallMessage.setAttribute("id", "better-maps-tooltip-closecall");
        tooltipComponents.closeCallMessage.style.display = "none";
        tooltipDiv.appendChild(tooltipComponents.closeCallMessage);

        /*const divider = document.createElement("hr");
        tooltipDiv.appendChild(divider);*/

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

        tooltipComponents.electors = document.createElement("div");
        tooltipComponents.electors.setAttribute("id", "better-maps-tooltip-electors");
        tooltipComponents.electors.style.display = "none";
        /*tooltipDiv.appendChild(tooltipComponents.electors);*/

        document.body.appendChild(tooltipDiv);
    }

    module.exports = {
        tooltipDiv,
        tooltipComponents,
        updateTooltip,
        createTooltip
    };
};
