{
    const {
        normalizeCountyJurisdictionKey,
        countyKeysEquivalent
    } = require("./precinct-results.js");
    const SVG_NS = "http://www.w3.org/2000/svg";
    const STYLE_ID = "bm-city-mayor-map-style";
    const LAYOUT_ID = "bm-city-mayor-layout";
    const MAP_PANEL_ID = "bm-city-mayor-map-panel";
    const RESULTS_PANEL_ID = "bm-city-mayor-results-panel";
    const TOOLTIP_ID = "bm-city-mayor-tooltip";
    const CONTROLS_ID = "bm-city-mayor-map-controls";
    const MAP_ID = "mayor-map-live";
    const STATE_IDS = new Set([
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
        "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
        "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX",
        "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    ]);
    const COUNTY_LABEL_PATTERN = /\b(county|parish|borough|census area|municipality|city and borough)\b/i;

    const normalizeText = value => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&(?:apos|#0*39|#x0*27);/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/_/g, " ")
        .replace(/[\u2018\u2019']/g, "")
        .replace(/\bst[.]?\b/g, "saint")
        .replace(/&/g, " and ")
        .replace(
            /\b(city and borough|census area|county|parish|borough|municipality)\b/g,
            " "
        )
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const escapeHtml = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const readNumber = value => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };

    const formatWholeNumber = value => Math.max(0, Math.round(readNumber(value)))
        .toLocaleString("en-US");

    const splitCountyNames = value => {
        const values = Array.isArray(value) ? value : [value];
        return values.flatMap(entry => {
            if(entry && typeof entry === "object") {
                return splitCountyNames(
                    entry.name
                    ?? entry.countyName
                    ?? entry.county
                    ?? entry.id
                    ?? ""
                );
            }
            return String(entry ?? "")
                .split(/\s*(?:,|;|\|)\s*/)
                .map(name => name.trim())
                .filter(Boolean);
        });
    };

    const getObjectLabel = value => {
        if(value === null || value === undefined) return "";
        if(typeof value !== "object") return String(value);
        return String(
            value.name
            ?? value.countyName
            ?? value.cityName
            ?? value.stateId
            ?? value.state
            ?? value.id
            ?? value.code
            ?? ""
        );
    };

    const normalizeCandidatePartyToken = value => {
        const label = getObjectLabel(value).trim().toUpperCase();
        if(label === "ID" || label === "I-D") return "ID";
        if(label === "IR" || label === "I-R") return "IR";
        if(label === "I" || label.startsWith("IND")) return "I";
        if(label === "D" || label.startsWith("DEM")) return "D";
        if(label === "R" || label.startsWith("REP")) return "R";
        return "";
    };

    const resolveCityMayoralCandidateAffiliation = (candidate, visualPartyValue = "") => {
        const candidates = [candidate, candidate?.source, candidate?.source?.source]
            .filter(value => value && typeof value === "object");
        const visualParty = normalizeCandidatePartyToken(visualPartyValue);
        const rawParty = candidates
            .map(value => normalizeCandidatePartyToken(
                value?.party || value?.extendedAttribs?.party
            ))
            .find(Boolean) || "";
        const rawCaucus = candidates
            .map(value => normalizeCandidatePartyToken(
                value?.caucusParty
                || value?.caucus
                || value?.extendedAttribs?.caucusParty
                || value?.extendedAttribs?.caucus
            ))
            .find(value => value === "D" || value === "R") || "";
        const variant = visualParty || rawParty || "I";

        if(variant === "ID" || variant === "IR") {
            const caucusParty = variant.charAt(1);
            return { party: "I", caucusParty, visualParty: variant };
        }
        if(rawParty === "ID" || rawParty === "IR") {
            const caucusParty = rawParty.charAt(1);
            return { party: "I", caucusParty, visualParty: rawParty };
        }
        if(variant === "I" || rawParty === "I") {
            const caucusParty = rawCaucus
                || (visualParty === "D" || visualParty === "R" ? visualParty : "");
            return {
                party: "I",
                caucusParty,
                visualParty: caucusParty ? `I${caucusParty}` : "I"
            };
        }
        if(variant === "D" || variant === "R") {
            return { party: variant, caucusParty: "", visualParty: variant };
        }
        return { party: "I", caucusParty: rawCaucus, visualParty: rawCaucus ? `I${rawCaucus}` : "I" };
    };

    const findExactTextElement = (text, root = document) => {
        const normalizedTarget = String(text || "").replace(/\s+/g, " ").trim();
        const candidates = root.querySelectorAll("h1, h2, h3, p, div, span");
        return Array.from(candidates).find(element => {
            if(element.children.length > 0) return false;
            return String(element.textContent || "").replace(/\s+/g, " ").trim()
                === normalizedTarget;
        }) || null;
    };

    const findField = (roots, keys, maxDepth = 4) => {
        const wanted = new Set(keys.map(key => String(key).toLowerCase()));
        const queue = (Array.isArray(roots) ? roots : [roots])
            .filter(value => value && typeof value === "object")
            .map(value => ({ value, depth: 0 }));
        const seen = new Set();
        let visited = 0;
        while(queue.length && visited < 2500) {
            const current = queue.shift();
            const value = current.value;
            if(!value || typeof value !== "object" || seen.has(value)) continue;
            seen.add(value);
            visited++;
            let entries = [];
            try { entries = Object.entries(value); } catch { entries = []; }
            for(const [key, child] of entries) {
                if(wanted.has(String(key).toLowerCase())) {
                    const labels = splitCountyNames(child);
                    const label = labels.length
                        ? labels.join(", ")
                        : getObjectLabel(child).trim();
                    if(label) return label;
                }
            }
            if(current.depth >= maxDepth) continue;
            for(const [, child] of entries) {
                if(!child || typeof child !== "object") continue;
                if(Array.isArray(child) && child.length > 100) continue;
                queue.push({ value: child, depth: current.depth + 1 });
            }
        }
        return "";
    };

    const findRaceNode = root => {
        if(!root || typeof root !== "object") return null;
        const queue = [{ value: root, depth: 0 }];
        const seen = new Set();
        const matches = [];
        let visited = 0;
        while(queue.length && visited < 1200) {
            const current = queue.shift();
            const value = current.value;
            if(!value || typeof value !== "object" || seen.has(value)) continue;
            seen.add(value);
            visited++;
            if(Array.isArray(value.cands) && value.cands.length >= 2) {
                let score = 100 - (current.depth * 8);
                if("totalCurrVotes" in value) score += 30;
                if("totalVotes" in value) score += 20;
                if("pW" in value || "projectedWinner" in value) score += 10;
                matches.push({ value, score });
            }
            if(current.depth >= 5) continue;
            let children = [];
            try { children = Object.values(value); } catch { children = []; }
            children.forEach(child => {
                if(!child || typeof child !== "object") return;
                if(Array.isArray(child) && child.length > 100) return;
                queue.push({ value: child, depth: current.depth + 1 });
            });
        }
        matches.sort((a, b) => b.score - a.score);
        return matches[0]?.value || null;
    };

    const createCityMayoralMap = options => {
        const fs = options.fs;
        const path = options.path;
        const os = options.os;
        const Executive = options.Executive;
        const precinctResultsController = options.precinctResultsController;
        const svgTextCache = new Map();
        const countyIdentifierCache = new Map();
        let observer = null;
        let liveRefreshTimer = null;
        let refreshFrame = null;
        let wrapper = null;
        let mapPanel = null;
        let resultsPanel = null;
        let nativeRacePanel = null;
        let nativeParent = null;
        let nativeNextSibling = null;
        let activeSvg = null;
        let activeCountyPath = null;
        let activeRace = null;
        let activeSyntheticRace = null;
        let activeStateId = "";
        let activeCountyName = "";
        let activeCityName = "";
        let renderKey = "";
        let installed = false;
        let ownsPrecinctContext = false;
        let savedPlayerLocationCache = null;
        let lastSaveFallbackAttempt = 0;
        let activeMapMode = "winner";
        let lastNativeSnapshot = null;
        let lastNativeSnapshotKey = "";
        let countyTooltipHovered = false;
        let lastTooltipPointer = null;
        let lastTooltipSignature = null;
        let lastRenderedTooltip = null;

        const getCountyKey = (value, stateId) =>
            normalizeCountyJurisdictionKey(value, stateId);

        const getCountyIdentifiersForState = stateId => {
            const normalizedState = String(stateId || "").trim().toLowerCase();
            if(!normalizedState) return [];
            if(countyIdentifierCache.has(normalizedState)) {
                return countyIdentifierCache.get(normalizedState);
            }
            const file = path.join(
                options.getBasePath(), "data", "counties", `${normalizedState}.svg`
            );
            let identifiers = [];
            try {
                const text = fs.readFileSync(file, "utf8");
                identifiers = Array.from(text.matchAll(
                    /<(?:path|polygon|polyline|rect)\b[^>]*\bid="([^"]+)"/gi
                ))
                    .map(match => match[1])
                    .filter(identifier =>
                        identifier
                        && identifier !== "cities"
                        && !/^(?:canvas_background|background|outline|path\d+)$/i
                            .test(identifier)
                    );
            } catch {}
            identifiers = Array.from(new Set(identifiers));
            countyIdentifierCache.set(normalizedState, identifiers);
            return identifiers;
        };

        const injectStyles = () => {
            if(document.getElementById(STYLE_ID)) return;
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = `
                #${LAYOUT_ID} {
                    display: grid;
                    grid-template-columns: minmax(0, 46%) minmax(0, 54%);
                    gap: 6px;
                    width: calc(100% - 8px);
                    height: calc(100vh - 126px);
                    min-height: 430px;
                    margin: 3px 4px 0;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                #${MAP_PANEL_ID}, #${RESULTS_PANEL_ID} {
                    min-width: 0;
                    min-height: 0;
                    border: 1px solid #222;
                    border-radius: 5px;
                    box-sizing: border-box;
                }
                #${MAP_PANEL_ID} {
                    position: relative;
                    overflow: hidden;
                    background: linear-gradient(#565656, #c9c9c9);
                }
                #${RESULTS_PANEL_ID} {
                    overflow: auto;
                    background: #f2f2f2;
                }
                #${RESULTS_PANEL_ID} > .eNElectionDiv {
                    width: calc(100% - 4px) !important;
                    margin: 2px !important;
                    box-sizing: border-box;
                }
                #${MAP_PANEL_ID} > svg.${MAP_ID} {
                    display: block;
                    width: 100% !important;
                    height: 100% !important;
                    overflow: visible;
                }
                #${MAP_PANEL_ID} .bm-city-mayor-county-path {
                    cursor: default;
                    stroke: #fff;
                    stroke-width: 1.7;
                    vector-effect: non-scaling-stroke;
                    transition: filter 120ms ease, opacity 120ms ease;
                }
                #${MAP_PANEL_ID} .bm-city-mayor-county-path:hover {
                    filter: brightness(1.08);
                }
                #${MAP_PANEL_ID} .bm-city-mayor-county-path.bm-city-mayor-precinct-ready {
                    cursor: pointer;
                }
                #${MAP_PANEL_ID} .bm-city-mayor-inactive-county {
                    fill: #777 !important;
                    stroke: #a9a9a9 !important;
                    pointer-events: none !important;
                    cursor: default !important;
                    opacity: .72;
                }
                #${MAP_PANEL_ID} > #eNightPrecinctsB {
                    position: absolute !important;
                    z-index: 8;
                    top: 8px !important;
                    right: auto !important;
                    left: 166px !important;
                    width: 150px !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 1px 8px;
                    font: 21px Georgia, serif;
                    border: 1px solid #222;
                    border-radius: 5px;
                    background: #e5e5e5;
                    box-shadow: 2px 2px 4px rgba(0,0,0,.25);
                }
                #${MAP_PANEL_ID}.bm-precinct-host-active > #eNightPrecinctsB {
                    display: none !important;
                }
                #${CONTROLS_ID} {
                    position: absolute;
                    z-index: 9;
                    top: 8px;
                    right: auto;
                    left: 8px;
                    display: grid;
                    width: 150px;
                    gap: 4px;
                }
                #${CONTROLS_ID} button {
                    height: 29px;
                    padding: 1px 8px;
                    border: 1px solid #222;
                    border-radius: 5px;
                    background: #e5e5e5;
                    box-shadow: 2px 2px 4px rgba(0,0,0,.25);
                    font: 21px Georgia, serif;
                    line-height: 23px;
                }
                #${CONTROLS_ID} button.bm-city-mayor-mode-active {
                    background: #3b9df1;
                }
                #${MAP_PANEL_ID}.bm-precinct-host-active > #${CONTROLS_ID} {
                    display: none !important;
                }
                #${TOOLTIP_ID} {
                    position: fixed;
                    z-index: 1000000;
                    display: none;
                    width: min(520px, calc(100vw - 24px));
                    padding: 10px 12px 8px;
                    box-sizing: border-box;
                    border: 1px solid #222;
                    border-top: 9px solid var(--bm-mayor-accent, #888);
                    background: #f3f3f3;
                    box-shadow: 3px 4px 10px rgba(0,0,0,.3);
                    color: #101010;
                    font-family: Oswald, Arial Narrow, Arial, sans-serif;
                    pointer-events: none;
                }
                #${TOOLTIP_ID} .bm-city-mayor-status {
                    display: inline-block;
                    margin: 0 0 8px;
                    padding: 4px 8px;
                    background: #ffd800;
                    font-size: 21px;
                    font-weight: 700;
                }
                #${TOOLTIP_ID} .bm-city-mayor-head {
                    display: grid;
                    grid-template-columns: minmax(120px, 1.05fr) minmax(230px, 2.25fr);
                    gap: 8px;
                    align-items: end;
                    margin-bottom: 3px;
                    font-size: 18px;
                    font-weight: 600;
                }
                #${TOOLTIP_ID} .bm-city-mayor-place strong {
                    display: block;
                    font-size: 22px;
                    line-height: 1.05;
                    text-transform: uppercase;
                }
                #${TOOLTIP_ID} .bm-city-mayor-row {
                    display: grid;
                    grid-template-columns: minmax(120px, 1.05fr) minmax(150px, 1.45fr) 32px 86px 70px;
                    gap: 7px;
                    align-items: center;
                    min-height: 42px;
                    border-bottom: 1px solid #c6c6c6;
                    font-size: 20px;
                }
                #${TOOLTIP_ID} .bm-city-mayor-row > span:nth-child(4),
                #${TOOLTIP_ID} .bm-city-mayor-row > strong {
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }
                #${TOOLTIP_ID} .bm-city-mayor-party {
                    justify-self: center;
                    min-width: 20px;
                    padding: 1px 2px;
                    border-radius: 3px;
                    color: #fff;
                    text-align: center;
                    font-size: 16px;
                    font-weight: 700;
                }
                #${TOOLTIP_ID} .bm-city-mayor-foot {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 12px;
                    margin-top: 7px;
                    font-size: 17px;
                    font-weight: 600;
                }
                @media (max-width: 900px) {
                    #${LAYOUT_ID} { grid-template-columns: minmax(0, 44%) minmax(0, 56%); }
                }
            `;
            document.head.appendChild(style);
        };

        const isMayorTab = () => {
            const tabs = document.getElementById("electNightTabDiv");
            const activeButton = tabs && Array.from(tabs.querySelectorAll("button")).find(button =>
                button.classList.contains("electNightTabO")
                || button.getAttribute("aria-selected") === "true"
            );
            if(activeButton) {
                return /^Mayor$/i.test(
                    String(activeButton.textContent || "").replace(/\s+/g, " ").trim()
                );
            }
            return Boolean(findExactTextElement("City Mayoral Election"));
        };

        const getRuntimeRace = () => {
            const roots = [
                options.readRuntimeValue?.("electNightM"),
                options.readRuntimeValue?.("cityElectData"),
                options.readRuntimeValue?.("mayorElectData"),
                options.readRuntimeValue?.("mayorCands")
            ];
            for(const root of roots) {
                if(Array.isArray(root) && root.length >= 2 && root.every(candidate =>
                    candidate && typeof candidate === "object"
                )) {
                    return { cands: root };
                }
                const race = findRaceNode(root);
                if(race) return race;
            }
            return null;
        };

        const getCandidateCurrentVotes = candidate => {
            const values = [
                candidate?.currentVotes,
                candidate?.currVotes,
                candidate?.totalCurrVotes,
                candidate?.currentVote,
                candidate?.reportVotes
            ];
            const match = values.find(value => Number.isFinite(Number(value)));
            return match === undefined ? 0 : Math.max(0, readNumber(match));
        };

        const getCandidateFinalVotes = candidate => {
            const values = [candidate?.votes, candidate?.totVotes, candidate?.finalVotes];
            const match = values.find(value => Number.isFinite(Number(value)));
            return match === undefined
                ? getCandidateCurrentVotes(candidate)
                : Math.max(0, readNumber(match));
        };

        const getRaceTotals = race => {
            const candidates = Array.isArray(race?.cands) ? race.cands : [];
            const currentCandidateTotal = candidates.reduce(
                (sum, candidate) => sum + getCandidateCurrentVotes(candidate),
                0
            );
            const finalCandidateTotal = candidates.reduce(
                (sum, candidate) => sum + getCandidateFinalVotes(candidate),
                0
            );
            const current = readNumber(race?.totalCurrVotes)
                || readNumber(race?.currentVotes)
                || currentCandidateTotal;
            const expected = readNumber(race?.totalVotes)
                || readNumber(race?.totVotes)
                || finalCandidateTotal;
            return {
                current: Math.max(0, current),
                expected: Math.max(0, expected),
                reported: expected > 0 ? Math.min(100, (current / expected) * 100) : 0
            };
        };

        const resolveStateId = roots => {
            const rawState = findField(roots, [
                "stateId", "stateID", "stateCode", "homeState", "residenceState", "state"
            ]);
            const stateEntries = Object.entries(Executive?.data?.states || {});
            const normalized = normalizeText(rawState);
            const match = stateEntries.find(([key, state]) =>
                normalizeText(key) === normalized
                || normalizeText(state?.id) === normalized
                || normalizeText(state?.stateId) === normalized
                || normalizeText(state?.name) === normalized
            );
            return String(match?.[0] || rawState || "").toUpperCase();
        };

        const findCountyFromCity = (stateId, cityValue) => {
            const targetCity = normalizeText(cityValue);
            if(!targetCity) return "";
            const stateData = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
            const roots = [
                stateData,
                Executive?.data?.cities,
                Executive?.data?.cityData,
                Executive?.data?.municipalities
            ].filter(Boolean);
            const queue = roots.map(value => ({ value, depth: 0 }));
            const seen = new Set();
            let visited = 0;
            while(queue.length && visited < 12000) {
                const current = queue.shift();
                const value = current.value;
                if(!value || typeof value !== "object" || seen.has(value)) continue;
                seen.add(value);
                visited++;
                const ownName = normalizeText(
                    value.name ?? value.cityName ?? value.city ?? value.id ?? ""
                );
                if(ownName && ownName === targetCity) {
                    const county = findField([value], [
                        "countyName", "countyId", "countyID", "homeCounty",
                        "county", "counties", "countyList", "jurisdictions"
                    ], 3);
                    if(county) return county;
                }
                if(current.depth >= 6) continue;
                let children = [];
                try { children = Object.values(value); } catch { children = []; }
                children.forEach(child => {
                    if(!child || typeof child !== "object") return;
                    if(Array.isArray(child) && child.length > 500) return;
                    queue.push({ value: child, depth: current.depth + 1 });
                });
            }
            return "";
        };

        const getVisibleMayorCityName = () => {
            const headings = Array.from(document.querySelectorAll(
                "h1, h2, h3, h4, p, div, span, .eNTitle, [class*='Title'], [class*='title']"
            ));
            for(const heading of headings) {
                if(heading.children.length > 0) continue;
                const text = String(heading.textContent || "").replace(/\s+/g, " ").trim();
                const match = text.match(/^(.+?)\s+Mayoral Election$/i);
                if(!match || /^City$/i.test(match[1])) continue;
                return match[1].trim();
            }
            return "";
        };

        const getCharacterArray = value => {
            if(Array.isArray(value)) return value;
            const arrayKeys = [
                "characterArray", "candidateArray", "candArray",
                "candidate", "character", "raw", "source", "data", "values"
            ];
            for(const key of arrayKeys) {
                try {
                    if(Array.isArray(value?.[key])) return value[key];
                } catch {}
            }
            return null;
        };

        const getCharacterLocationSources = value => {
            const sources = [];
            const queue = [{ value, depth: 0 }];
            const seen = new Set();
            const nestedKeys = [
                "characterArray", "candidateArray", "candArray",
                "candidate", "character", "characterData",
                "raw", "source", "sourceCandidate", "originalCandidate",
                "baseCandidate", "wrappedCandidate", "wrappedCharacter",
                "data", "values", "array", "record",
                "person", "politician", "player",
                "residence", "location", "home", "address",
                "attributes", "extendedAttribs",
                "_character", "_data", "_source"
            ];
            while(queue.length) {
                const current = queue.shift();
                const source = current.value;
                if(
                    !source
                    || (typeof source !== "object" && !Array.isArray(source))
                    || seen.has(source)
                ) {
                    continue;
                }
                seen.add(source);
                sources.push(source);
                if(current.depth >= 4) continue;
                nestedKeys.forEach(key => {
                    let child;
                    try { child = source?.[key]; } catch { child = null; }
                    if(
                        child
                        && (typeof child === "object" || Array.isArray(child))
                        && !seen.has(child)
                    ) {
                        queue.push({ value: child, depth: current.depth + 1 });
                    }
                });
            }
            return sources;
        };

        const getCharacterIdentityValues = value => {
            const identities = new Set();
            const candidateEnum = Executive?.enums?.characterArray?.candidate || {};
            getCharacterLocationSources(value).forEach(source => {
                const character = getCharacterArray(source) || source;
                const values = [
                    source?.id,
                    source?.ID,
                    source?.candidateId,
                    source?.candidateID,
                    source?.characterId,
                    source?.characterID,
                    source?.politicianId,
                    source?.politicianID
                ];
                if(Array.isArray(character)) {
                    values.push(
                        character[candidateEnum.candidateId ?? 111],
                        character[111]
                    );
                }
                values.forEach(identity => {
                    const normalized = String(identity ?? "").trim();
                    if(normalized && normalized !== "0") identities.add(normalized);
                });
            });
            return identities;
        };

        const getCharacterLocation = value => {
            const sources = getCharacterLocationSources(value);
            if(!sources.length) {
                return { stateId: "", countyName: "" };
            }
            const candidateEnum = Executive?.enums?.characterArray?.candidate || {};
            const directSlotEntries = [];
            const stateCandidates = [];
            const explicitCountyCandidates = [];
            sources.forEach(source => {
                const character = getCharacterArray(source) || source;
                const readSlot = index => {
                    if(!Number.isInteger(index)) return undefined;
                    try { return character[index]; } catch { return undefined; }
                };
                const slotCount = Math.max(
                    Number.isFinite(Number(character?.length))
                        ? Number(character.length)
                        : 0,
                    190
                );
                for(let index = 0; index < Math.min(slotCount, 260); index++) {
                    const slotValue = readSlot(index);
                    if(typeof slotValue === "string" && slotValue.trim()) {
                        directSlotEntries.push({ index, value: slotValue.trim() });
                    }
                }
                stateCandidates.push(
                    readSlot(candidateEnum.stateId ?? 127),
                    readSlot(127),
                    source?.stateId,
                    source?.stateID,
                    source?.stateCode,
                    source?.homeState,
                    source?.residenceState,
                    source?.state,
                    source?.residence?.stateId,
                    source?.residence?.state
                );
                explicitCountyCandidates.push(
                    readSlot(candidateEnum.countyName),
                    readSlot(candidateEnum.countyId),
                    readSlot(candidateEnum.county),
                    readSlot(128),
                    readSlot(123),
                    source?.countyName,
                    source?.countyId,
                    source?.countyID,
                    source?.homeCounty,
                    source?.residenceCounty,
                    source?.county,
                    source?.residence?.countyName,
                    source?.residence?.county
                );
            });
            const directSlots = directSlotEntries.map(entry => entry.value);
            stateCandidates.push(...directSlots);
            const stateId = stateCandidates
                .map(candidate => {
                    const raw = getObjectLabel(candidate).trim();
                    const upper = raw.toUpperCase();
                    if(STATE_IDS.has(upper)) return upper;
                    const normalized = normalizeText(raw);
                    const stateMatch = Object.entries(Executive?.data?.states || {})
                        .find(([key, state]) =>
                            normalizeText(key) === normalized
                            || normalizeText(state?.id) === normalized
                            || normalizeText(state?.stateId) === normalized
                            || normalizeText(state?.name) === normalized
                        );
                    return String(stateMatch?.[0] || "").toUpperCase();
                })
                .find(candidate => STATE_IDS.has(candidate)) || "";
            const isUsableCounty = candidate => candidate
                && normalizeText(candidate) !== "none"
                && !STATE_IDS.has(String(candidate).trim().toUpperCase());
            const stateCountyIdentifiers = stateId
                ? getCountyIdentifiersForState(stateId)
                : [];
            const getMappedCounty = candidate => {
                const label = getObjectLabel(candidate).trim();
                if(!isUsableCounty(label)) return "";
                if(
                    stateId === "DC"
                    && getCountyKey(label, stateId) === "district of columbia"
                ) {
                    return "District of Columbia";
                }
                if(!stateCountyIdentifiers.length) return label;
                return stateCountyIdentifiers.find(identifier =>
                    countyKeysEquivalent(
                        getCountyKey(label, stateId),
                        getCountyKey(identifier, stateId)
                    )
                ) || "";
            };
            const explicitCounty = explicitCountyCandidates
                .map(getMappedCounty)
                .find(Boolean) || "";
            const mappedCounty = stateId
                ? stateCountyIdentifiers.find(identifier =>
                    directSlotEntries.some(entry =>
                        entry.index >= 120
                        && countyKeysEquivalent(
                            getCountyKey(entry.value, stateId),
                            getCountyKey(identifier, stateId)
                        )
                    )
                ) || ""
                : "";
            const scannedCounty = mappedCounty || directSlots
                .filter(candidate => COUNTY_LABEL_PATTERN.test(candidate))
                .map(getMappedCounty)
                .find(Boolean) || "";
            const countyName = explicitCounty || scannedCounty;

            return { stateId, countyName, explicitCounty, scannedCounty };
        };

        const getRawExecutivePlayer = () => {
            const characters = Executive?.data?.characters;
            if(!characters || typeof characters !== "object") return null;

            const playerDescriptor = Object.getOwnPropertyDescriptor(characters, "player");
            const originalWrapCharacter = characters.wrapCharacter;
            if(typeof playerDescriptor?.get === "function"
                && typeof originalWrapCharacter === "function") {
                try {
                    characters.wrapCharacter = character => character;
                    return playerDescriptor.get.call(characters) || null;
                } catch {
                    return null;
                } finally {
                    characters.wrapCharacter = originalWrapCharacter;
                }
            }

            try { return characters.player || null; } catch { return null; }
        };

        const extractTopLevelArray = (text, propertyName) => {
            const marker = `"${propertyName}"`;
            const markerIndex = String(text || "").indexOf(marker);
            if(markerIndex < 0) return "";
            const start = text.indexOf("[", markerIndex + marker.length);
            if(start < 0) return "";
            let depth = 0;
            let inString = false;
            let escaped = false;
            for(let index = start; index < text.length; index++) {
                const character = text[index];
                if(inString) {
                    if(escaped) escaped = false;
                    else if(character === "\\") escaped = true;
                    else if(character === "\"") inString = false;
                    continue;
                }
                if(character === "\"") {
                    inString = true;
                    continue;
                }
                if(character === "[") depth++;
                if(character === "]") {
                    depth--;
                    if(depth === 0) return text.slice(start, index + 1);
                }
            }
            return "";
        };

        const getRuntimeMayorState = () => {
            const names = [
                "mayorCands", "mayorCandList", "mayorCandArrayD",
                "mayorCandArrayR", "mayorCandArrayI", "mayorCand1", "mayorCand2"
            ];
            for(const name of names) {
                let root;
                try { root = options.readRuntimeValue?.(name); } catch { continue; }
                const stack = [{ value: root, depth: 0 }];
                while(stack.length) {
                    const { value, depth } = stack.pop();
                    if(value == null || depth > 5) continue;
                    const character = getCharacterArray(value);
                    if(character && character !== value) {
                        const location = getCharacterLocation(value);
                        if(location.stateId) return location.stateId;
                        continue;
                    }
                    if(Array.isArray(value)) {
                        for(const item of value) stack.push({ value: item, depth: depth + 1 });
                    }
                }
            }
            return "";
        };

        const getSavedPlayerLocation = (hintState, expectedNameTokens = []) => {
            const visibleText = normalizeText(globalThis.document?.body?.textContent || "");
            const paddedVisible = ` ${visibleText} `;

            const compactVisible = visibleText.replace(/ /g, "");

            const nameTokensPresent = tokens => {
                if(tokens.length === 0 || tokens.some(token => token.length < 2)) return false;
                return tokens.every(token => paddedVisible.includes(` ${token} `))
                    || compactVisible.includes(tokens.join(""));
            };
            const getPlayerNameTokens = savedPlayer => [savedPlayer?.[4], savedPlayer?.[5]]
                .map(part => normalizeText(part))
                .filter(part => part.length >= 2);

            if(savedPlayerLocationCache) {
                const cache = savedPlayerLocationCache;
                const cachedTokens = Array.isArray(cache.nameTokens) ? cache.nameTokens : [];

                const nameOnScreen = cachedTokens.length > 0 && nameTokensPresent(cachedTokens);
                const nameMatchesPlayer = expectedNameTokens.length > 0
                    && cachedTokens.join("|") === expectedNameTokens.join("|");
                const stateStillMatches = !hintState
                    || normalizeText(cache.stateId) === normalizeText(hintState);
                const cacheIsFresh = Date.now() - readNumber(cache.checkedAt) < 4000;
                if(stateStillMatches && cacheIsFresh && (nameOnScreen || nameMatchesPlayer)) {
                    return cache;
                }
                if(!stateStillMatches || (!nameOnScreen && !nameMatchesPlayer)) {
                    savedPlayerLocationCache = null;
                }
            }
            if(Date.now() - lastSaveFallbackAttempt < 4000) {
                return savedPlayerLocationCache;
            }
            lastSaveFallbackAttempt = Date.now();
            const saveDirectories = [];
            const addSaveDirectory = directory => {
                const normalized = String(directory || "").trim();
                if(normalized && !saveDirectories.includes(normalized)) {
                    saveDirectories.push(normalized);
                }
            };
            let localAppData = "";
            try {
                localAppData = typeof process !== "undefined"
                    ? process?.env?.LOCALAPPDATA || ""
                    : globalThis?.process?.env?.LOCALAPPDATA || "";
            } catch {}
            if(!fs?.readdirSync || !path?.join) return null;
            if(localAppData) {
                addSaveDirectory(path.join(
                    localAppData,
                    "the_political_process",
                    "User Data",
                    "Default",
                    "saveFiles",
                    "campaignSaves"
                ));
            }
            try {
                const homeDirectory = os?.homedir?.();
                if(homeDirectory) {
                    addSaveDirectory(path.join(
                        homeDirectory,
                        "AppData",
                        "Local",
                        "the_political_process",
                        "User Data",
                        "Default",
                        "saveFiles",
                        "campaignSaves"
                    ));
                }
            } catch {}
            try {
                const nwDataPath = globalThis?.nw?.App?.dataPath;
                if(nwDataPath) {
                    addSaveDirectory(path.join(nwDataPath, "saveFiles", "campaignSaves"));
                }
            } catch {}
            let saveFiles = [];
            for(const saveDirectory of saveDirectories) {
                try {
                    saveFiles.push(...fs.readdirSync(saveDirectory)
                        .filter(fileName => /[.]json$/i.test(fileName))
                        .map(fileName => {
                            const fullPath = path.join(saveDirectory, fileName);
                            return { fullPath, modified: fs.statSync(fullPath).mtimeMs || 0 };
                        }));
                } catch {}
            }
            saveFiles = Array.from(new Map(saveFiles.map(file => [file.fullPath, file])).values())
                .sort((a, b) => b.modified - a.modified)
                .slice(0, 12);
            if(saveFiles.length === 0) return null;
            let newestValidLocation = null;
            const validLocations = [];
            for(const saveFile of saveFiles) {
                let descriptor = null;
                try {
                    descriptor = fs.openSync(saveFile.fullPath, "r");
                    const byteLength = Math.min(768 * 1024, fs.fstatSync(descriptor).size);
                    const buffer = Buffer.alloc(byteLength);
                    const bytesRead = fs.readSync(descriptor, buffer, 0, byteLength, 0);
                    const prefix = buffer.toString("utf8", 0, bytesRead);
                    const playerJson = extractTopLevelArray(prefix, "player");
                    if(!playerJson) continue;
                    const savedPlayer = JSON.parse(playerJson);
                    const location = getCharacterLocation(savedPlayer);
                    const nameTokens = getPlayerNameTokens(savedPlayer);
                    if(!location.stateId || !location.countyName || !nameTokens.length) continue;
                    const record = {
                        ...location,
                        playerName: nameTokens.join(" "),
                        nameTokens,
                        checkedAt: Date.now()
                    };
                    validLocations.push(record);
                    if(!newestValidLocation) {
                        newestValidLocation = record;
                    }

                    const matchesRuntimePlayer = expectedNameTokens.length > 0
                        && nameTokens.join("|") === expectedNameTokens.join("|");
                    if(!matchesRuntimePlayer && !nameTokensPresent(nameTokens)) continue;
                    savedPlayerLocationCache = record;
                    return savedPlayerLocationCache;
                } catch {
                } finally {
                    if(descriptor !== null) {
                        try { fs.closeSync(descriptor); } catch {}
                    }
                }
            }

            if(hintState) {
                const inState = validLocations.find(location =>
                    normalizeText(location.stateId) === normalizeText(hintState));
                if(inState) {
                    savedPlayerLocationCache = {
                        ...inState,
                        hintState,
                        checkedAt: Date.now()
                    };
                    return savedPlayerLocationCache;
                }
            }

            const unambiguous = newestValidLocation && validLocations.every(location =>
                normalizeText(location.stateId) === normalizeText(newestValidLocation.stateId)
                && normalizeText(location.countyName) === normalizeText(newestValidLocation.countyName)
            );
            savedPlayerLocationCache = unambiguous ? newestValidLocation : null;
            return savedPlayerLocationCache;
        };

        const resolveLocation = race => {
            const playerRoots = [];
            const seenRoots = new Set();
            const addPlayerRoot = value => {
                if(!value || (typeof value !== "object" && !Array.isArray(value))) return;
                if(seenRoots.has(value)) return;
                seenRoots.add(value);
                playerRoots.push(value);
                const rawCharacter = getCharacterArray(value);
                if(rawCharacter && rawCharacter !== value && !seenRoots.has(rawCharacter)) {
                    seenRoots.add(rawCharacter);
                    playerRoots.push(rawCharacter);
                }
            };

            addPlayerRoot(getRawExecutivePlayer());

            try { addPlayerRoot(options.getPlayerCharacter?.()); } catch {}
            [
                "player", "playerArray", "playerCharacter", "playerData",
                "playerCandidate", "candidatePlayer", "currentPlayer"
            ].forEach(name => {
                try { addPlayerRoot(options.readRuntimeValue?.(name)); } catch {}
            });
            let wrappedPlayer = null;
            try { wrappedPlayer = Executive?.data?.characters?.player; } catch {}
            addPlayerRoot(wrappedPlayer);
            try { addPlayerRoot(Executive?.data?.characters?.playerArray); } catch {}
            try { addPlayerRoot(Executive?.data?.characters?.rawPlayer); } catch {}
            try { addPlayerRoot(Executive?.data?.characters?.playerCharacter); } catch {}
            try { addPlayerRoot(Executive?.data?.player); } catch {}
            try { addPlayerRoot(Executive?.data?.candidatePlayer); } catch {}
            const unresolvedPlayerRoots = playerRoots.slice();
            unresolvedPlayerRoots.forEach(root => {
                getCharacterIdentityValues(root).forEach(identity => {
                    try { addPlayerRoot(options.getCandidateById?.(identity)); } catch {}
                });
            });
            const playerLocations = playerRoots
                .map(getCharacterLocation)
                .filter(location => location.stateId || location.countyName);

            const raceRoots = [race, ...(Array.isArray(race?.cands) ? race.cands : [])]
                .filter(value => value && typeof value === "object");
            const raceLocations = raceRoots
                .map(getCharacterLocation)
                .filter(location => location.stateId || location.countyName);
            const raceState = raceLocations.find(location => location.stateId)?.stateId
                || resolveStateId(raceRoots)
                || getRuntimeMayorState();
            const raceCounty = raceLocations.find(location => location.explicitCounty)?.explicitCounty
                || raceLocations.find(location => location.scannedCounty)?.scannedCounty
                || findField(raceRoots, [
                    "countyName", "countyId", "countyID", "homeCounty", "residenceCounty",
                    "county", "counties", "countyList", "jurisdictions"
                ], 5);
            const raceCountyCandidates = splitCountyNames(raceCounty);
            const cityName = getVisibleMayorCityName()
                || findField(raceRoots, [
                    "cityName", "cityId", "cityID", "municipalityName", "municipality", "city"
                ], 5);
            const hasCompletePlayerLocation = playerLocations.some(location =>
                location.stateId && location.countyName
            );
            const expectedPlayerNameTokens = playerRoots
                .map(root => getCharacterArray(root) || root)
                .map(character => [
                    normalizeText(character?.firstName ?? character?.first ?? character?.[4]),
                    normalizeText(character?.lastName ?? character?.last ?? character?.[5])
                ].filter(token => token.length >= 2))
                .find(tokens => tokens.length > 0) || [];

            const hintState = playerLocations.find(location => location.stateId)?.stateId
                || raceState
                || "";
            const savedLocation = hasCompletePlayerLocation
                ? null
                : getSavedPlayerLocation(hintState, expectedPlayerNameTokens);
            const rawPlayerState = playerLocations.find(location => location.stateId)?.stateId
                || savedLocation?.stateId
                || raceState
                || "";
            const stateId = String(
                rawPlayerState
                || wrappedPlayer?.stateId
                || wrappedPlayer?.state
                || resolveStateId(playerRoots)
                || ""
            ).trim().toUpperCase();

            const playerExplicitCounty = playerLocations.find(location => location.explicitCounty)?.explicitCounty || "";
            const playerScannedCounty = playerLocations.find(location => location.scannedCounty)?.scannedCounty || "";
            const cityCounty = findCountyFromCity(stateId || raceState, cityName);
            const countyCandidates = [];
            const addCounty = value => {
                splitCountyNames(value).forEach(trimmed => {
                    if(!countyCandidates.some(existing =>
                        normalizeText(existing) === normalizeText(trimmed)
                    )) {
                        countyCandidates.push(trimmed);
                    }
                });
            };
            addCounty(playerExplicitCounty);
            addCounty(savedLocation?.countyName);
            addCounty(playerScannedCounty);
            addCounty(findField(playerRoots, [
                "countyName", "countyId", "countyID", "homeCounty", "residenceCounty", "county"
            ], 3));
            addCounty(cityCounty);
            addCounty(raceCountyCandidates);

            const playerState = String(playerLocations.find(location => location.stateId)?.stateId || "").trim().toUpperCase();
            const savedState = String(savedLocation?.stateId || "").trim().toUpperCase();
            const raceStateUpper = String(raceState || "").trim().toUpperCase();
            const locationCandidates = [];
            const addPair = (state, county) => {
                const stateCode = String(state || "").trim().toUpperCase();
                if(!STATE_IDS.has(stateCode)) return;
                splitCountyNames(county).forEach(countyName => {
                    if(locationCandidates.some(pair =>
                        pair.stateId === stateCode
                        && normalizeText(pair.countyName) === normalizeText(countyName)
                    )) return;
                    locationCandidates.push({ stateId: stateCode, countyName });
                });
            };

            addPair(playerState, playerExplicitCounty);
            addPair(playerState, playerScannedCounty);
            addPair(savedState, savedLocation?.countyName);
            addPair(stateId || raceStateUpper, cityCounty);
            raceCountyCandidates.forEach(county => addPair(raceStateUpper, county));

            countyCandidates.forEach(county => addPair(stateId, county));
            const primaryPair = locationCandidates[0];
            const resolvedStateId = primaryPair ? primaryPair.stateId : stateId;
            const countyName = primaryPair ? primaryPair.countyName : (countyCandidates[0] || "");
            return {
                stateId: resolvedStateId,
                cityName,
                countyName,
                countyCandidates,
                locationCandidates
            };
        };

        const getCountyElements = svg => {
            const citiesGroup = svg.querySelector("#cities");
            const isCounty = element => {
                const tag = String(element.tagName || "").toLowerCase();
                return Boolean(element.id)
                    && element.id !== "cities"
                    && ["path", "polygon", "polyline", "rect"].includes(tag)
                    && (!citiesGroup || !citiesGroup.contains(element));
            };
            const mainGroup = svg.querySelector("g");
            const direct = mainGroup ? Array.from(mainGroup.children).filter(isCounty) : [];
            if(direct.length) return direct;

            return Array.from(svg.querySelectorAll("path, polygon, polyline, rect")).filter(isCounty);
        };

        const findCountyElementExact = (elements, countyName, stateId = "") => {
            const target = getCountyKey(countyName, stateId);
            if(!target) return null;
            return elements.find(element => countyKeysEquivalent(
                getCountyKey(element.id, stateId),
                target
            )) || null;
        };

        const findCountyElement = (elements, countyName, stateId = "") => {
            const exact = findCountyElementExact(elements, countyName, stateId);
            if(exact) return exact;
            const target = getCountyKey(countyName, stateId);
            if(!target) return null;
            const close = elements.filter(element => {
                const key = getCountyKey(element.id, stateId);
                return key && (key.includes(target) || target.includes(key));
            });
            return close.length === 1 ? close[0] : null;
        };

        const findCountyElementFromCandidates = (elements, countyNames, stateId = "") => {
            const names = (Array.isArray(countyNames) ? countyNames : [countyNames]).filter(Boolean);
            for(const name of names) {
                const exact = findCountyElementExact(elements, name, stateId);
                if(exact) return exact;
            }
            for(const name of names) {
                const fuzzy = findCountyElement(elements, name, stateId);
                if(fuzzy) return fuzzy;
            }
            return null;
        };

        const findCountyElementFromCity = (svg, elements, cityName) => {
            const target = normalizeText(cityName);
            if(!target || typeof DOMPoint !== "function") return null;
            const city = Array.from(svg.querySelectorAll("#cities .city")).find(element =>
                normalizeText(element.querySelector("text")?.textContent) === target
            );
            if(!city) return null;
            const x = readNumber(city.getAttribute("data-x"));
            const y = readNumber(city.getAttribute("data-y"));
            const point = new DOMPoint(x, y);
            return elements.find(element => {
                try { return typeof element.isPointInFill === "function" && element.isPointInFill(point); }
                catch { return false; }
            }) || null;
        };

        const getMapText = stateId => {
            const normalizedState = String(stateId || "").toLowerCase();
            if(svgTextCache.has(normalizedState)) return svgTextCache.get(normalizedState);
            const file = path.join(
                options.getBasePath(), "data", "counties", `${normalizedState}.svg`
            );
            if(!fs.existsSync(file)) return "";
            const text = fs.readFileSync(file, "utf8");
            svgTextCache.set(normalizedState, text);
            return text;
        };

        const fitSvgToCounty = (svg, countyPath) => {
            try {
                const box = countyPath.getBBox();
                if(!(box.width > 0) || !(box.height > 0)) return;

                const padding = Math.max(box.width, box.height) * 0.62;
                svg.setAttribute(
                    "viewBox",
                    `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${box.height + padding * 2}`
                );
            } catch {}
        };

        const renderMap = (stateId, countyNames, cityName) => {
            if(!mapPanel) return false;
            const sourceText = getMapText(stateId);
            if(!sourceText) return false;
            const parsed = new DOMParser().parseFromString(sourceText, "image/svg+xml");
            const svg = parsed.documentElement;
            if(!svg || String(svg.nodeName).toLowerCase() !== "svg") return false;
            svg.querySelectorAll("script").forEach(script => script.remove());
            svg.id = MAP_ID;
            svg.classList.add(MAP_ID);
            svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            const elements = getCountyElements(svg);
            mapPanel.appendChild(svg);
            let countyPath = findCountyElementFromCandidates(elements, countyNames, stateId)
                || findCountyElementFromCity(svg, elements, cityName);
            if(
                !countyPath
                && String(stateId || "").toUpperCase() === "DC"
                && countyNames.some(name =>
                    getCountyKey(name, stateId) === "district of columbia"
                )
            ) {
                const wardPaths = elements.filter(element =>
                    /^ward[-_ ]?\d+$/i.test(String(element.id || ""))
                );
                if(wardPaths.length) {
                    const group = parsed.createElementNS(SVG_NS, "g");
                    group.id = "District_of_Columbia";
                    wardPaths[0].parentElement?.appendChild(group);
                    wardPaths.forEach(element => group.appendChild(element));
                    countyPath = group;
                }
            }
            if(!countyPath) {
                svg.remove();
                return false;
            }
            const resolvedCountyName = countyPath.id.replace(/_/g, " ");
            elements.forEach(element => {
                if(element !== countyPath && !countyPath.contains(element)) {
                    element.classList.add("bm-city-mayor-inactive-county");
                    element.removeAttribute("tabindex");
                    element.setAttribute("aria-hidden", "true");
                }
            });
            svg.querySelector("#cities")?.remove();
            countyPath.classList.add("better-maps-state-path", "bm-city-mayor-county-path");
            countyPath.setAttribute("data-county", resolvedCountyName);
            countyPath.setAttribute("data-county-name", resolvedCountyName);
            activeSvg = svg;
            activeCountyPath = countyPath;
            activeCountyName = resolvedCountyName;
            requestAnimationFrame(() => fitSvgToCounty(svg, countyPath));
            return true;
        };

        const getCandidateAffiliation = candidate =>
            resolveCityMayoralCandidateAffiliation(
                candidate,
                options.getCandidateParty?.(candidate)
            );

        const getCandidateParty = candidate => getCandidateAffiliation(candidate).party;

        const applyCandidateAffiliation = (record, candidate = record) => {
            const affiliation = getCandidateAffiliation(candidate);
            return {
                ...record,
                party: affiliation.party,
                caucus: affiliation.caucusParty,
                caucusParty: affiliation.caucusParty,
                visualParty: affiliation.visualParty
            };
        };

        const getPartyColour = (party, visualParty = party) => visualParty === "ID"
            ? "#91b7dc"
            : visualParty === "IR"
                ? "#df8a8a"
                : party === "D"
                    ? "#168bd2"
                    : party === "R" ? "#e52b32" : "#858585";

        const getCandidateDisplayName = candidate => String(
            candidate?.name
            || candidate?.fullName
            || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
            || options.getCandidateName?.(candidate)
            || "Candidate"
        ).replace(/\*+$/, "").trim();

        const parseMayorCandidateSegment = value => {
            const text = String(value || "").replace(/\s+/g, " ").trim();
            const percentages = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
            const percentage = percentages.length
                ? readNumber(percentages[percentages.length - 1][1])
                : 0;
            const commaNumbers = Array.from(text.matchAll(/\+?\d{1,3}(?:,\d{3})+(?![\d.])/g))
                .map(match => match[0])
                .filter(token => !token.startsWith("+"));
            const votes = commaNumbers.length
                ? readNumber(commaNumbers[commaNumbers.length - 1].replace(/,/g, ""))
                : 0;
            return { votes: Math.max(0, votes), percentage: Math.max(0, percentage) };
        };

        const getMayorPanelText = racePanel => String(
            racePanel?.innerText || racePanel?.textContent || ""
        ).replace(/\s+/g, " ").trim();

        const extractMayorVotePairs = panelText => {
            const pairs = [];
            const pattern = /(^|[^\d.+-])(\d{1,3}(?:,\d{3})*|\d+)\s+(\d+(?:\.\d+)?)\s*%/g;
            let match = null;
            while((match = pattern.exec(String(panelText || "")))) {
                const votes = readNumber(match[2].replace(/,/g, ""));
                const percentage = readNumber(match[3]);

                if(votes < 0 || percentage < 0 || percentage > 100) continue;
                pairs.push({ votes, percentage, index: match.index });
            }
            return pairs;
        };

        const extractMayorVotePairsFromDom = racePanel => {
            if(!racePanel?.querySelectorAll) return [];
            const ownText = element => String(element?.textContent || "")
                .replace(/\s+/g, " ")
                .trim();
            const isLeaf = element => element && element.children.length === 0;
            const percentageLeaves = Array.from(racePanel.querySelectorAll("*"))
                .filter(element => isLeaf(element)
                    && /^\d+(?:\.\d+)?\s*%$/.test(ownText(element)));
            const pairs = [];
            percentageLeaves.forEach(percentageLeaf => {
                let row = percentageLeaf.parentElement;
                for(let depth = 0; row && racePanel.contains(row) && depth < 6; depth++, row = row.parentElement) {
                    const leaves = Array.from(row.querySelectorAll("*"))
                        .filter(isLeaf)
                        .map(element => ownText(element));
                    const percentages = leaves.filter(text => /^\d+(?:\.\d+)?\s*%$/.test(text));
                    if(percentages.length !== 1) continue;
                    const voteTokens = leaves.filter(text => /^\d{1,3}(?:,\d{3})+$/.test(text)
                        || /^\d+$/.test(text));
                    if(voteTokens.length === 0) continue;
                    const percentage = readNumber(ownText(percentageLeaf).replace("%", ""));
                    const votes = readNumber(voteTokens[voteTokens.length - 1].replace(/,/g, ""));
                    if(percentage < 0 || percentage > 100 || votes < 0) break;
                    pairs.push({ votes, percentage, element: percentageLeaf });
                    break;
                }
            });
            return pairs;
        };

        const readNativeRaceSnapshot = (racePanel, race) => {
            const sourceCandidates = Array.isArray(race?.cands) ? race.cands : [];
            if(!racePanel || sourceCandidates.length < 2) return null;
            const panelText = getMayorPanelText(racePanel);
            const reportingMatch = panelText.match(/(\d+(?:\.\d+)?)\s*%\s*Reporting/i);
            const reported = reportingMatch ? Math.min(100, readNumber(reportingMatch[1])) : 0;
            const lowerText = panelText.toLowerCase();
            const indexed = sourceCandidates.map((candidate, candidateIndex) => {
                const fullName = getCandidateDisplayName(candidate);
                const surname = fullName.split(/\s+/).filter(Boolean).pop() || fullName;
                let index = lowerText.indexOf(fullName.toLowerCase());
                if(index < 0) index = lowerText.indexOf(surname.toLowerCase());
                return { candidate, candidateIndex, fullName, index };
            }).filter(entry => entry.index >= 0).sort((a, b) => a.index - b.index);
            const parsedByCandidate = new Map();
            indexed.forEach((entry, index) => {
                const end = indexed[index + 1]?.index ?? panelText.length;
                parsedByCandidate.set(
                    entry.candidate,
                    parseMayorCandidateSegment(panelText.slice(entry.index, end))
                );
            });
            const domPairs = extractMayorVotePairsFromDom(racePanel);
            const visiblePairs = domPairs.length >= 2
                ? domPairs
                : extractMayorVotePairs(panelText);
            const orderedCandidates = indexed.length === sourceCandidates.length
                ? indexed.map(entry => entry.candidate)
                : sourceCandidates;

            orderedCandidates.forEach((candidate, index) => {
                const parsed = parsedByCandidate.get(candidate);
                const visiblePair = visiblePairs[index];
                if(!visiblePair) return;
                if(!parsed || (parsed.votes <= 0 && visiblePair.votes > 0)) {
                    parsedByCandidate.set(candidate, {
                        votes: visiblePair.votes,
                        percentage: visiblePair.percentage
                    });
                }
            });
            const currentTotal = sourceCandidates.reduce(
                (sum, candidate) => sum + (parsedByCandidate.get(candidate)?.votes || 0),
                0
            );
            if(currentTotal <= 0 && reported > 0) return null;
            const expectedTotal = reported > 0
                ? Math.max(currentTotal, Math.round(currentTotal * 100 / reported))
                : Math.max(currentTotal, getRaceTotals(race).expected);
            const candidates = sourceCandidates.map(candidate => {
                const parsed = parsedByCandidate.get(candidate);
                const currentVotes = parsed ? parsed.votes : getCandidateCurrentVotes(candidate);
                const finalVotes = reported >= 99.9
                    ? currentVotes
                    : (currentTotal > 0
                        ? Math.round(expectedTotal * currentVotes / currentTotal)
                        : getCandidateFinalVotes(candidate));
                return applyCandidateAffiliation({
                    ...candidate,
                    source: candidate,
                    name: getCandidateDisplayName(candidate),
                    votes: Math.max(currentVotes, finalVotes),
                    currentVotes
                }, candidate);
            });
            return {
                cands: candidates,
                totalCurrVotes: currentTotal,
                totalVotes: reported >= 99.9 ? currentTotal : expectedTotal,
                reported
            };
        };

        const buildSyntheticRace = (race, countyName, nativeSnapshot = null) => {
            const sourceRace = nativeSnapshot || race;
            const candidates = (sourceRace?.cands || []).map(candidate =>
                applyCandidateAffiliation({
                    ...candidate,
                    name: getCandidateDisplayName(candidate),
                    votes: getCandidateFinalVotes(candidate),
                    currentVotes: getCandidateCurrentVotes(candidate)
                }, candidate)
            );
            const totals = getRaceTotals(sourceRace);
            const synthetic = {
                ...race,
                stateId: activeStateId,
                cands: candidates,
                totalVotes: totals.expected,
                totalCurrVotes: totals.current
            };
            synthetic.counties = [{
                name: countyName,
                id: countyName,
                stateId: activeStateId,
                cands: candidates,
                totalVotes: totals.expected,
                totalCurrVotes: totals.current
            }];
            return synthetic;
        };

        const getRankedCurrentCandidates = race => (race?.cands || [])
            .map(candidate => applyCandidateAffiliation({
                source: candidate,
                name: getCandidateDisplayName(candidate),
                votes: getCandidateCurrentVotes(candidate)
            }, candidate))
            .sort((a, b) => b.votes - a.votes);

        const getStatusText = (race, totals, ranked) => {
            if(totals.current <= 0) return "PENDING REPORT";
            if(totals.reported >= 99.9) return "PROJECTED WINNER";
            const margin = totals.current > 0 && ranked.length > 1
                ? ((ranked[0].votes - ranked[1].votes) / totals.current) * 100
                : 0;
            if(totals.reported >= 65 && margin <= 2) return "TOO CLOSE TO CALL";
            const threshold = totals.reported < 25 ? 25 : totals.reported < 45 ? 18 : 12;
            return totals.reported >= 10 && totals.reported < 65 && margin <= threshold
                ? "TOO EARLY TO CALL"
                : "";
        };

        const getDisplayedRace = () => activeSyntheticRace;

        const isEnabledFlag = value => value === true
            || value === 1
            || String(value || "").trim().toLowerCase() === "true";

        const isMayorFlip = leader => {
            if(!leader) return false;

            if(/\+\s*Seat\s+Gain/i.test(String(nativeRacePanel?.textContent || ""))) {
                return true;
            }
            const leaderSource = leader.source?.source || leader.source || leader;
            const flagNames = ["seatGain", "gain", "flipped", "flip", "partyGain"];
            if(flagNames.some(name =>
                isEnabledFlag(leaderSource?.[name])
                || isEnabledFlag(activeRace?.[name])
                || isEnabledFlag(activeSyntheticRace?.[name])
            )) return true;
            const incumbent = (activeSyntheticRace?.cands || []).find(candidate =>
                isEnabledFlag(candidate?.incumbent)
                || isEnabledFlag(candidate?.source?.incumbent)
            );
            return Boolean(
                incumbent
                && getCandidateParty(incumbent) !== getCandidateParty(leaderSource)
            );
        };

        const renderTooltip = (event, renderOpts = {}) => {
            const displayedRace = getDisplayedRace();
            if(!displayedRace || typeof options.renderResultsTooltip !== "function") return;
            const totals = getRaceTotals(displayedRace);
            const ranked = getRankedCurrentCandidates(displayedRace);

            const projectedForSignature = totals.reported >= 99.9 && totals.current > 0;
            const signature = `${Math.round(totals.current)}|${Math.round(totals.reported * 10)}|`
                + `${projectedForSignature ? "P" : "-"}|`
                + ranked.map(candidate => `${candidate.name}:${Math.round(candidate.votes)}`).join(",");
            if(
                renderOpts.skipIfUnchanged
                && signature === lastTooltipSignature
                && lastRenderedTooltip?.isConnected
            ) {
                positionTooltip(event, lastRenderedTooltip);
                return;
            }
            const leader = totals.current > 0 ? ranked[0] : null;
            const runnerUp = totals.current > 0 ? ranked[1] : null;
            const marginVotes = leader && runnerUp ? leader.votes - runnerUp.votes : 0;
            const marginPct = totals.current > 0
                ? (marginVotes / totals.current) * 100
                : 0;
            const statusText = getStatusText(displayedRace, totals, ranked);
            const projectedWinner = totals.reported >= 99.9 && totals.current > 0;
            const tooltip = options.renderResultsTooltip({
                electionType: "mayor",
                territoryType: "County",
                territoryName: activeCountyName,
                territoryContext: "",
                reportingText: `${Math.round(totals.reported)}% in`,
                statusText,
                projectedWinner,
                flip: projectedWinner && isMayorFlip(leader),
                candidates: ranked.map(candidate => ({
                    source: candidate.source,
                    name: candidate.name,
                    party: candidate.party,
                    caucus: candidate.caucusParty,
                    caucusParty: candidate.caucusParty,
                    visualParty: candidate.visualParty,
                    candidateColour: options.getCandidateColour?.(
                        candidate.source,
                        displayedRace
                    ) || getPartyColour(candidate.party, candidate.visualParty),
                    votes: candidate.votes
                })),
                totalVotes: totals.current,
                marginVotes,
                marginPoints: marginPct,
                totalLabel: "Total reported",
                showTurnout: true,
                sourceRace: displayedRace.counties?.[0] || displayedRace
            });
            if(!tooltip) return;
            lastTooltipSignature = signature;
            lastRenderedTooltip = tooltip;
            positionTooltip(event, tooltip);
        };

        const positionTooltip = (event, tooltip) => {
            const gap = 14;
            const bounds = tooltip.getBoundingClientRect();
            let left = readNumber(event?.clientX) + gap;
            let top = readNumber(event?.clientY) + gap;
            if(left + bounds.width > window.innerWidth - 8) {
                left = readNumber(event?.clientX) - bounds.width - gap;
            }
            if(top + bounds.height > window.innerHeight - 8) {
                top = readNumber(event?.clientY) - bounds.height - gap;
            }
            tooltip.style.left = `${Math.max(8, left)}px`;
            tooltip.style.top = `${Math.max(8, top)}px`;
        };

        const hideTooltip = () => {
            lastTooltipSignature = null;
            lastRenderedTooltip = null;
            options.hideResultsTooltip?.();
        };

        const rememberTooltipPointer = event => {
            countyTooltipHovered = true;
            lastTooltipPointer = {
                clientX: readNumber(event?.clientX),
                clientY: readNumber(event?.clientY)
            };
            renderTooltip(lastTooltipPointer, { skipIfUnchanged: true });
        };

        const leaveCountyTooltip = () => {
            countyTooltipHovered = false;
            lastTooltipPointer = null;
            hideTooltip();
        };

        const pointerOnActiveCounty = target =>
            Boolean(activeCountyPath)
            && (target === activeCountyPath || activeCountyPath.contains(target));

        const bindMapEvents = () => {
            if(!mapPanel || mapPanel.dataset.bmMayorHoverBound === "true") return;
            mapPanel.dataset.bmMayorHoverBound = "true";
            mapPanel.addEventListener("mousemove", event => {
                if(pointerOnActiveCounty(event.target)) rememberTooltipPointer(event);
                else if(countyTooltipHovered) leaveCountyTooltip();
            });
            mapPanel.addEventListener("mouseleave", () => {
                if(countyTooltipHovered) leaveCountyTooltip();
            });
        };

        const ensureMapControls = () => {
            if(!mapPanel?.isConnected) return;
            let controls = document.getElementById(CONTROLS_ID);
            if(
                controls
                && controls.querySelectorAll("button").length !== 2
            ) {
                controls.remove();
                controls = null;
            }
            if(!controls) {
                controls = document.createElement("div");
                controls.id = CONTROLS_ID;
                const buttonDefinitions = [
                    ["winner", "Winner"],
                    ["margin", "Margin"]
                ];
                buttonDefinitions.forEach(([mode, label]) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.dataset.cityMayorMapMode = mode;
                    button.dataset.mapMode = mode;
                    button.textContent = label;
                    button.addEventListener("click", () => {
                        activeMapMode = mode;
                        options.playClick?.();
                        ensureMapControls();
                        updateMapFill();
                        if(countyTooltipHovered && lastTooltipPointer) {
                            renderTooltip(lastTooltipPointer, { skipIfUnchanged: true });
                        }
                    });
                    controls.appendChild(button);
                });
                mapPanel.appendChild(controls);
            }

            if(!precinctResultsController?.isActive?.()) {
                controls.style.removeProperty("display");
                controls.querySelectorAll("button").forEach(button =>
                    button.style.removeProperty("display")
                );
            }
            controls.querySelectorAll("button").forEach(button => {
                button.classList.toggle(
                    "bm-city-mayor-mode-active",
                    button.dataset.cityMayorMapMode === activeMapMode
                );
            });
        };

        const updateMapFill = () => {
            ensureMapControls();
            const displayedRace = getDisplayedRace();
            if(!activeCountyPath || !displayedRace) return;
            const ranked = getRankedCurrentCandidates(displayedRace);
            const totals = getRaceTotals(displayedRace);
            const leader = totals.current > 0 ? ranked[0]?.source : null;
            const runnerUp = totals.current > 0 ? ranked[1]?.source : null;
            const margin = totals.current > 0 && leader && runnerUp
                ? Math.max(0, (getCandidateCurrentVotes(leader) - getCandidateCurrentVotes(runnerUp)) / totals.current)
                : 0;
            const marginResolver = leader && /^margin/.test(activeMapMode)
                ? options.createMarginColourResolver?.(displayedRace, [margin])
                : null;
            const colour = leader
                ? (marginResolver?.(leader, margin)
                    || options.getCandidateColour?.(leader, displayedRace)
                    || "#888")
                : "#ffffff";
            activeCountyPath.style.fill = String(colour);
        };

        const findNativeRacePanel = () => {
            const title = findExactTextElement("Mayor General Election");
            if(!title) return null;
            const ancestors = [];
            let current = title.parentElement;
            for(let depth = 0; current && depth < 7; depth++, current = current.parentElement) {
                ancestors.push(current);
            }
            const completePanel = ancestors.find(element => {
                if(element.id === RESULTS_PANEL_ID || element.id === LAYOUT_ID) return false;
                const text = getMayorPanelText(element);
                return /%\s*Reporting/i.test(text)
                    && (
                        extractMayorVotePairsFromDom(element).length >= 2
                        || extractMayorVotePairs(text).length >= 2
                    );
            });
            return completePanel
                || title.closest(".eNElectionDiv")
                || title.closest("[id*='Election']")
                || title.parentElement?.parentElement
                || null;
        };

        const mountLayout = racePanel => {
            if(!racePanel?.isConnected) return false;
            if(wrapper?.isConnected && resultsPanel?.contains(racePanel)) {
                nativeRacePanel = racePanel;
                return true;
            }

            if(wrapper?.isConnected && mapPanel?.isConnected && resultsPanel?.isConnected) {
                nativeParent = racePanel.parentElement || nativeParent;
                nativeNextSibling = racePanel.nextSibling;
                resultsPanel.replaceChildren(racePanel);
                nativeRacePanel = racePanel;
                return true;
            }
            if(wrapper?.isConnected) teardown({ restoreNative: true, destroyPrecincts: true });
            nativeRacePanel = racePanel;
            nativeParent = racePanel.parentElement;
            nativeNextSibling = racePanel.nextSibling;
            wrapper = document.createElement("div");
            wrapper.id = LAYOUT_ID;
            mapPanel = document.createElement("div");
            mapPanel.id = MAP_PANEL_ID;
            resultsPanel = document.createElement("div");
            resultsPanel.id = RESULTS_PANEL_ID;
            nativeParent.insertBefore(wrapper, racePanel);
            wrapper.append(mapPanel, resultsPanel);
            resultsPanel.appendChild(racePanel);
            return true;
        };

        const teardown = ({ restoreNative = true, destroyPrecincts = true } = {}) => {
            hideTooltip();
            if(
                destroyPrecincts
                && (ownsPrecinctContext || precinctResultsController?.isActive?.())
            ) {
                precinctResultsController?.destroy?.();
                ownsPrecinctContext = false;
            }
            if(
                restoreNative
                && nativeRacePanel?.isConnected
                && nativeParent?.isConnected
                && resultsPanel?.contains(nativeRacePanel)
            ) {
                if(nativeNextSibling?.parentNode === nativeParent) {
                    nativeParent.insertBefore(nativeRacePanel, nativeNextSibling);
                } else {
                    nativeParent.insertBefore(nativeRacePanel, wrapper);
                }
            }
            wrapper?.remove();
            wrapper = null;
            mapPanel = null;
            resultsPanel = null;
            activeSvg = null;
            activeCountyPath = null;
            activeRace = null;
            activeSyntheticRace = null;
            activeMapMode = "winner";
            countyTooltipHovered = false;
            lastTooltipPointer = null;
            renderKey = "";
        };

        const syncPrecincts = () => {
            if(!activeSvg?.isConnected || !mapPanel?.isConnected || !activeSyntheticRace) return;
            const totals = getRaceTotals(activeSyntheticRace);
            if(totals.reported < 99.9 || totals.current <= 0) {
                if(ownsPrecinctContext || precinctResultsController?.isActive?.()) {
                    precinctResultsController?.destroy?.();
                    ownsPrecinctContext = false;
                }
                activeCountyPath?.classList.remove("bm-city-mayor-precinct-ready");
                return;
            }

            const synchronized = precinctResultsController?.sync?.({
                svgMap: activeSvg,
                host: mapPanel,
                electionType: "mayor",
                live: true,
                onCountyMap: true,
                stateId: activeStateId,
                race: activeSyntheticRace,
                isPrimary: false,
                suppressEntryButton: true,
                nativeViewControls: document.getElementById(CONTROLS_ID)
            }) === true;
            ownsPrecinctContext = synchronized;
            activeCountyPath?.classList.toggle(
                "bm-city-mayor-precinct-ready",
                synchronized
            );
        };

        const refreshNow = () => {
            refreshFrame = null;
            if(!isMayorTab()) {
                if(wrapper?.isConnected) teardown({ restoreNative: true });
                return false;
            }

            if(precinctResultsController?.isActive?.() === true) return true;
            injectStyles();
            const race = getRuntimeRace();
            const racePanel = findNativeRacePanel();
            if(!race || !racePanel || !mountLayout(racePanel)) return false;
            const location = resolveLocation(race);
            if(!location.stateId || !location.countyName) {
                mapPanel.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:700 22px Oswald,Arial,sans-serif;text-align:center;padding:24px">
                    Player county unavailable
                </div>`;
                return false;
            }
            activeRace = race;
            activeCityName = location.cityName;
            const locationPairs = (Array.isArray(location.locationCandidates) && location.locationCandidates.length)
                ? location.locationCandidates
                : [{ stateId: location.stateId, countyName: location.countyName }];
            const nextKey = [
                locationPairs.map(pair => `${pair.stateId}:${normalizeText(pair.countyName)}`).join(","),
                normalizeText(location.cityName),
                racePanel === nativeRacePanel ? "same" : "new"
            ].join("|");
            if(!activeSvg?.isConnected || renderKey !== nextKey) {
                if(ownsPrecinctContext || precinctResultsController?.isActive?.()) {
                    precinctResultsController?.destroy?.();
                    ownsPrecinctContext = false;
                }
                mapPanel.replaceChildren();
                activeSvg = null;
                activeCountyPath = null;
                activeMapMode = "winner";

                let renderedPair = false;
                for(const pair of locationPairs) {
                    if(renderMap(pair.stateId, [pair.countyName], location.cityName)) {
                        activeStateId = pair.stateId;
                        renderedPair = true;
                        break;
                    }
                }
                if(!renderedPair) {
                    activeStateId = location.stateId;
                    activeCountyName = location.countyName;
                    mapPanel.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:700 22px Oswald,Arial,sans-serif;text-align:center;padding:24px">
                        ${escapeHtml(location.countyName || location.cityName)}<br><small>County map unavailable</small>
                    </div>`;
                    return false;
                }
                renderKey = nextKey;
                bindMapEvents();
            }
            const snapshotKey = [
                activeStateId,
                normalizeText(activeCountyName),
                ...(race?.cands || []).map(getCandidateDisplayName)
            ].join("|");

            const snapshotRoots = Array.from(new Set([
                racePanel,
                nativeRacePanel,
                resultsPanel,
                racePanel?.parentElement,
                racePanel?.parentElement?.parentElement
            ].filter(root => root?.isConnected)));
            let nativeSnapshot = snapshotRoots
                .map(root => readNativeRaceSnapshot(root, race))
                .filter(Boolean)
                .sort((a, b) => (
                    readNumber(b.totalCurrVotes) - readNumber(a.totalCurrVotes)
                    || readNumber(b.reported) - readNumber(a.reported)
                ))[0] || null;
            if(nativeSnapshot) {
                const previousTotal = lastNativeSnapshotKey === snapshotKey
                    ? readNumber(lastNativeSnapshot?.totalCurrVotes)
                    : -1;
                if(previousTotal > readNumber(nativeSnapshot.totalCurrVotes)) {
                    nativeSnapshot = lastNativeSnapshot;
                } else {
                    lastNativeSnapshot = nativeSnapshot;
                    lastNativeSnapshotKey = snapshotKey;
                }
            } else if(lastNativeSnapshotKey === snapshotKey) {
                nativeSnapshot = lastNativeSnapshot;
            }
            activeSyntheticRace = buildSyntheticRace(
                race,
                activeCountyName,
                nativeSnapshot
            );
            if(activeMapMode !== "winner" && activeMapMode !== "margin") {
                activeMapMode = "winner";
            }
            updateMapFill();
            syncPrecincts();

            ensureMapControls();

            if(
                countyTooltipHovered
                && lastTooltipPointer
                && !precinctResultsController?.isActive?.()
            ) {
                renderTooltip(lastTooltipPointer, { skipIfUnchanged: true });
            }
            return true;
        };

        const refresh = () => {
            if(refreshFrame !== null) return;
            refreshFrame = requestAnimationFrame(refreshNow);
        };

        const install = () => {
            if(installed) return;
            installed = true;
            injectStyles();
            ["electNightMayorFunc", "eNightMayorUpdate", "electNightUpdateData"]
                .forEach(functionName => {
                    try { Executive.functions.registerPostHook(functionName, refresh); }
                    catch {}
                });
            observer = new MutationObserver(mutations => {
                const tooltipEl = document.getElementById("better-maps-tooltip");
                if(tooltipEl && mutations.every(mutation => tooltipEl.contains(mutation.target))) {
                    return;
                }
                refresh();
            });
            observer.observe(document.body, {
                childList: true,
                characterData: true,
                subtree: true
            });

            liveRefreshTimer = setInterval(() => {
                if(isMayorTab()) refresh();
            }, 250);
            document.addEventListener("click", event => {
                const button = event.target?.closest?.("#electNightTabDiv button");
                if(button) setTimeout(refresh, 0);
            }, true);
            refresh();
        };

        const destroy = () => {
            observer?.disconnect();
            observer = null;
            if(liveRefreshTimer !== null) clearInterval(liveRefreshTimer);
            liveRefreshTimer = null;
            if(refreshFrame !== null) cancelAnimationFrame(refreshFrame);
            refreshFrame = null;
            teardown({ restoreNative: true });
            document.getElementById(TOOLTIP_ID)?.remove();
            installed = false;
        };

        return {
            install,
            destroy,
            refresh,
            getPlayerLocation: resolveLocation,
            isActive: () => Boolean(wrapper?.isConnected && isMayorTab())
        };
    };

    module.exports = {
        createCityMayoralMap,
        normalizeCityMayoralCountyName: normalizeText,
        resolveCityMayoralCandidateAffiliation
    };
}
