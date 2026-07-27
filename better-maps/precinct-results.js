{
    const SVG_NS = "http://www.w3.org/2000/svg";
    const SUPPORTED_ELECTIONS = new Set(["president", "usSenate", "governor", "mayor"]);
    const TOSSUP_COLOUR = "#c6c6c6";
    const NO_PRECINCT_DATA_COLOUR = "#5c5b5b";

    const normalizeCountyName = value => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b([a-z]+)[\u2019']s\b/g, "$1s")
        .replace(/\bst[.]?\b/g, "saint")
        .replace(/&/g, " and ")
        .replace(
            /\b(city and borough|census area|county|parish|borough|municipality)\b/g,
            " "
        )
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const VIRGINIA_INDEPENDENT_CITIES = new Set([
        "alexandria", "bristol", "buena vista", "charlottesville", "chesapeake",
        "colonial heights", "covington", "danville", "emporia", "fairfax",
        "falls church", "franklin", "fredericksburg", "galax", "hampton",
        "harrisonburg", "hopewell", "lexington", "lynchburg", "manassas",
        "manassas park", "martinsville", "newport news", "norfolk", "norton",
        "petersburg", "poquoson", "portsmouth", "radford", "richmond", "roanoke",
        "salem", "staunton", "suffolk", "virginia beach", "waynesboro",
        "williamsburg", "winchester"
    ]);
    const VIRGINIA_CITY_COUNTY_COLLISIONS = new Set([
        "fairfax", "franklin", "richmond", "roanoke"
    ]);

    const getCountyJurisdictionKey = (value, stateId = "", jurisdictionCode = "") => {
        const rawName = String(value || "").trim();
        const jurisdictionName = rawName.replace(/_/g, " ");
        const normalized = normalizeCountyName(rawName);
        const normalizedState = String(stateId || "").toUpperCase();
        const numericCode = String(jurisdictionCode || "").replace(/\D/g, "");
        if(normalizedState === "VA") {
            const normalizedWords = normalized.replace(/\s+/g, " ").trim();
            const hasCitySuffix = /\bcity\s*$/i.test(jurisdictionName);
            const hasCountySuffix = /\bcounty\s*$/i.test(jurisdictionName);
            const baseName = normalizedWords.replace(/\s+city$/, "").trim();
            const isIndependentCity = VIRGINIA_INDEPENDENT_CITIES.has(baseName)
                && !hasCountySuffix;
            if(isIndependentCity) {
                return VIRGINIA_CITY_COUNTY_COLLISIONS.has(baseName)
                    ? `${baseName} city`
                    : baseName;
            }
            if(
                hasCountySuffix
                && VIRGINIA_CITY_COUNTY_COLLISIONS.has(normalizedWords)
            ) {
                return `${normalizedWords} county`;
            }

            if(
                !hasCitySuffix
                && !hasCountySuffix
                && VIRGINIA_CITY_COUNTY_COLLISIONS.has(normalizedWords)
                && /_county$/i.test(rawName)
            ) {
                return `${normalizedWords} county`;
            }
        }
        if(normalizedState === "MO" && normalized === "saint louis") {
            if(/\bcounty\b/i.test(jurisdictionName) || /(?:^|29)189$/.test(numericCode)) {
                return "saint louis county";
            }
            if(
                /\bcity\b/i.test(jurisdictionName)
                || /\bst[.]\s*louis\b/i.test(jurisdictionName)
                || /(?:^|29)510$/.test(numericCode)
            ) {
                return "saint louis city";
            }
            return "saint louis county";
        }
        if(normalizedState === "MD" && normalized === "baltimore") {
            if(/\bcounty\b/i.test(jurisdictionName) || /(?:^|24)005$/.test(numericCode)) {
                return "baltimore county";
            }
            if(/\bcity\b/i.test(jurisdictionName) || /(?:^|24)510$/.test(numericCode)) {
                return "baltimore city";
            }
            return "baltimore city";
        }
        return normalized;
    };

    const countyKeysEquivalent = (left, right) => {
        const leftKey = String(left || "").trim();
        const rightKey = String(right || "").trim();
        if(!leftKey || !rightKey) return false;
        if(leftKey === rightKey) return true;
        return leftKey.replace(/\s+/g, "") === rightKey.replace(/\s+/g, "");
    };

    const readNumber = value => {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : 0;
    };

    const getCandidateVotes = candidate =>
        Math.max(0, Math.round(readNumber(candidate?.votes ?? candidate?.currentVotes)));

    const getCandidateIdentity = candidate => String(
        candidate?.id
        ?? candidate?.candID
        ?? candidate?.candidateId
        ?? candidate?.name
        ?? candidate?.fullName
        ?? "candidate"
    ).trim().toLowerCase();

    const getRaceTotal = race => {
        const candidateTotal = (race?.cands || []).reduce(
            (sum, candidate) => sum + getCandidateVotes(candidate),
            0
        );
        return candidateTotal || readNumber(race?.totalVotes);
    };

    const isFullyReported = (race, live = true) => {
        if(!race || !Array.isArray(race.cands) || race.cands.length < 2) return false;
        if(live === false) return getRaceTotal(race) > 0;
        const expected = readNumber(race.totalVotes)
            || race.cands.reduce((sum, candidate) => sum + readNumber(candidate?.votes), 0);
        const counted = readNumber(race.totalCurrVotes)
            || race.cands.reduce((sum, candidate) => sum + readNumber(candidate?.currentVotes), 0);
        return expected > 0 && counted > 0 && counted >= expected * 0.999;
    };

    const getCandidateName = (candidate, callback) => {
        const callbackName = callback?.(candidate);
        return callbackName
            || candidate?.name
            || candidate?.fullName
            || [candidate?.firstName || candidate?.first, candidate?.lastName || candidate?.last]
                .filter(Boolean)
                .join(" ")
            || "Candidate";
    };

    const getPartyKey = (candidate, callback) => {
        const callbackParty = String(callback?.(candidate) || "").toUpperCase();
        if(["D", "R", "ID", "IR", "I"].includes(callbackParty)) return callbackParty;
        const rawParty = String(
            candidate?.party || candidate?.extendedAttribs?.party || ""
        ).toUpperCase();
        if(rawParty === "ID" || rawParty === "I-D") return "ID";
        if(rawParty === "IR" || rawParty === "I-R") return "IR";
        if(rawParty === "D" || rawParty.startsWith("DEM")) return "D";
        if(rawParty === "R" || rawParty.startsWith("REP")) return "R";
        return "I";
    };

    const getMarginRating = (candidate, marginPoints, resolveColour) => {
        const margin = Math.abs(Number(marginPoints) || 0);
        const key = margin < 1
            ? "tossup"
            : margin < 3
                ? "tilt"
                : margin < 7
                    ? "lean"
                    : margin < 15
                        ? "likely"
                        : "solid";
        const partyKey = candidate?.party === "D" || candidate?.party === "R"
            ? candidate.party
            : "I";
        return {
            key,
            label: key === "tossup"
                ? "Tossup"
                : `${key.charAt(0).toUpperCase()}${key.slice(1)} ${partyKey}`,
            colour: resolveColour?.(
                candidate?.source || candidate,
                Math.max(0, margin / 100)
            ) || TOSSUP_COLOUR
        };
    };

    const allocateExact = (total, weights) => {
        const target = Math.max(0, Math.round(Number(total) || 0));
        if(weights.length === 0) return [];
        let normalized = weights.map(weight => Math.max(0, Number(weight) || 0));
        let weightTotal = normalized.reduce((sum, weight) => sum + weight, 0);
        if(weightTotal <= 0) {
            return normalized.map(() => 0);
        }
        const exact = normalized.map(weight => (target * weight) / weightTotal);
        const allocated = exact.map(Math.floor);
        let remainder = target - allocated.reduce((sum, value) => sum + value, 0);
        exact
            .map((value, index) => ({ index, fraction: value - allocated[index] }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
            .slice(0, remainder)
            .forEach(entry => allocated[entry.index]++);
        return allocated;
    };

    const createPrecinctResultsController = options => {
        const fs = options.fs;
        const path = options.path;
        const svgTextCache = new Map();
        const svgTemplateCache = new Map();
        const simulationCache = new Map();
        const inferredCountyCache = new Map();
        const preloadedStateKeys = new Set();
        const precinctElementCache = new WeakMap();
        const countyKeyCache = new WeakMap();
        const stateSimulationCache = new WeakMap();
        const paintedStateCache = new WeakMap();
        const directCountyClickBound = new WeakSet();
        let context = null;
        let active = false;
        let activationPending = false;
        let detailCountyKey = null;
        let activeSvg = null;
        let eventRemovers = [];
        let pinnedPrecinctId = null;
        let zoom = 1;
        let panX = 0;
        let panY = 0;
        let zoomAnchor = null;
        let dragging = null;
        let lastButtonActionAt = 0;
        let nativeViewModeBeforePrecincts = null;
        let detailRenderToken = 0;
        let activeRaceVariant = "normal";
        const PRECINCT_MIN_ZOOM = 1;
        const PRECINCT_MAX_ZOOM = 20;
        const PRECINCT_BUTTON_ZOOM_STEP = 1;
        const PRECINCT_WHEEL_ZOOM_STEP = 0.25;
        const getActiveRace = () => (
            activeRaceVariant === "rcv" && context?.rcvRace
                ? context.rcvRace
                : context?.race
        );
        const getReturnMapMode = () => {
            if(activeRaceVariant === "rcv") {
                return nativeViewModeBeforePrecincts === "margin-rcv"
                    ? "margin-rcv"
                    : "winner-rcv";
            }
            if(nativeViewModeBeforePrecincts === "flip-counties") return "flip-counties";
            return nativeViewModeBeforePrecincts === "winner"
                ? "winner"
                : "margin";
        };

        const listen = (target, eventName, handler, options) => {
            if(!target?.addEventListener) return;
            target.addEventListener(eventName, handler, options);
            eventRemovers.push(() => {
                try {
                    target.removeEventListener(eventName, handler, options);
                } catch {}
            });
        };

        const clearEventListeners = () => {
            eventRemovers.splice(0).forEach(removeListener => removeListener());
        };

        const clearHeavyPrecinctCaches = () => {
            svgTextCache.clear();
            svgTemplateCache.clear();
            simulationCache.clear();
            inferredCountyCache.clear();
            preloadedStateKeys.clear();
        };

        const getTooltip = () => {
            const sharedTooltip = options.getResultsTooltip?.();
            if(sharedTooltip) return sharedTooltip;
            let tooltip = document.getElementById("bm-precinct-tooltip");
            if(!tooltip) {
                tooltip = document.createElement("div");
                tooltip.id = "bm-precinct-tooltip";
                document.body.appendChild(tooltip);
            }
            return tooltip;
        };

        const hideTooltip = () => {
            if(options.hideResultsTooltip) {
                options.hideResultsTooltip();
                return;
            }
            const tooltip = document.getElementById("bm-precinct-tooltip");
            if(tooltip) tooltip.style.display = "none";
        };

        const setMapStatus = (message, error = false) => {
            let status = document.getElementById("bm-precinct-status");
            if(!message) {
                status?.remove();
                return;
            }
            if(!status) {
                status = document.createElement("div");
                status.id = "bm-precinct-status";
                context?.host?.appendChild(status);
            }
            status.classList.toggle("error", error);
            status.textContent = message;
        };

        const positionTooltip = event => {
            const tooltip = getTooltip();
            const offset = 13;
            const width = tooltip.offsetWidth || 280;
            const height = tooltip.offsetHeight || 150;
            let left = event.clientX + offset;
            let top = event.clientY + offset;
            if(left + width > window.innerWidth - 8) left = event.clientX - width - offset;
            if(top + height > window.innerHeight - 8) top = event.clientY - height - offset;
            tooltip.style.left = `${Math.max(8, left)}px`;
            tooltip.style.top = `${Math.max(8, top)}px`;
        };

        const showTooltip = (event, data) => {
            const tooltip = options.renderResultsTooltip?.(data) || getTooltip();
            if(!options.renderResultsTooltip) {
                tooltip.textContent = "";
                tooltip.style.display = "flex";
            }
            positionTooltip(event);
        };

        const slugifyPrecinctStateName = value => String(value || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        const getSvgPathCandidates = stateId => {
            const normalizedStateId = String(stateId || "").trim().toLowerCase();
            const stateName = Executive?.data?.states?.[normalizedStateId]?.name;
            const stateSlug = slugifyPrecinctStateName(stateName);
            const directory = path.join(options.getBasePath(), "data", "states-precincts");
            const candidates = [];
            if(normalizedStateId === "dc") {
                candidates.push(path.join(directory, "district-of-columbia-precincts.svg"));
            }
            if(stateSlug) candidates.push(path.join(directory, `${stateSlug}-precincts.svg`));
            if(normalizedStateId) {
                candidates.push(path.join(directory, `${normalizedStateId}-precincts.svg`));
                candidates.push(path.join(directory, `${normalizedStateId}.svg`));
            }
            return Array.from(new Set(candidates));
        };

        const getSvgPath = stateId => getSvgPathCandidates(stateId)
            .find(filePath => fs.existsSync(filePath))
            || getSvgPathCandidates(stateId)[0];

        const getSvgText = stateId => {
            const key = String(stateId || "").toUpperCase();
            if(svgTextCache.has(key)) return svgTextCache.get(key);
            const filePath = getSvgPath(key);
            if(!filePath || !fs.existsSync(filePath)) return null;
            const text = fs.readFileSync(filePath, "utf8");
            svgTextCache.set(key, text);
            return text;
        };

        const getSvgTemplate = stateId => {
            const key = String(stateId || "").toUpperCase();
            if(svgTemplateCache.has(key)) return svgTemplateCache.get(key);
            svgTemplateCache.forEach((_template, cachedKey) => {
                if(cachedKey !== key) svgTemplateCache.delete(cachedKey);
            });
            const text = getSvgText(stateId);
            if(!text) return null;
            const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
            if(documentNode.querySelector("parsererror")) return null;
            const svg = documentNode.documentElement;
            svgTemplateCache.set(key, svg);
            return svg;
        };

        const createSvg = stateId => {
            const svg = getSvgTemplate(stateId);
            if(!svg) return null;
            svg.id = "bm-precinct-map";
            svg.classList.add(
                "better-maps-container",
                "bm-precinct-map",
                "bm-precinct-state-overview"
            );
            svg.classList.remove(
                "has-county-hover",
                "bm-precinct-county-detail",
                "bm-precinct-can-pan"
            );
            svg.setAttribute("width", context.svgMap.getAttribute("width") || "100%");
            svg.setAttribute("height", context.svgMap.getAttribute("height") || "100%");
            svg.setAttribute("aria-label", `${stateId} precinct margin map`);
            return svg;
        };

        const createCountySvg = (stateId, countyKey, sourceElements = []) => {
            const template = getSvgTemplate(stateId);
            if(!template) return null;
            const selectedElements = sourceElements.filter(element =>
                element?.tagName?.toLowerCase() === "path"
                && getCountyKey(element) === countyKey
            );
            if(
                selectedElements.length
                && selectedElements[0].parentElement !== template
                && selectedElements.every(element =>
                    element.parentElement === selectedElements[0].parentElement)
            ) {
                const svg = template.cloneNode(false);
                Array.from(template.children).forEach(child => {
                    const tagName = child.tagName?.toLowerCase();
                    if(tagName === "defs" || tagName === "style") {
                        svg.appendChild(child.cloneNode(true));
                    }
                });
                const sourceGroup = selectedElements[0].parentElement;
                const group = sourceGroup.cloneNode(false);
                selectedElements.forEach(element =>
                    group.appendChild(element.cloneNode(true)));
                svg.appendChild(group);
                svg.id = "bm-precinct-map";
                svg.classList.add(
                    "better-maps-container",
                    "bm-precinct-map",
                    "bm-precinct-county-detail"
                );
                svg.classList.remove(
                    "has-county-hover",
                    "bm-precinct-can-pan",
                    "bm-precinct-state-overview"
                );
                svg.style.removeProperty("pointer-events");
                svg.querySelectorAll(".county-hover, .precinct-hover").forEach(element => {
                    element.classList.remove("county-hover", "precinct-hover");
                });
                svg.setAttribute("width", context.svgMap.getAttribute("width") || "100%");
                svg.setAttribute("height", context.svgMap.getAttribute("height") || "100%");
                svg.setAttribute("aria-label", `${stateId} county precinct margin map`);
                return svg;
            }
            const cloneBranch = source => {
                const tagName = source.tagName?.toLowerCase();
                if(tagName === "path" && source.hasAttribute("data-dem")) {
                    return getCountyKey(source) === countyKey
                        ? source.cloneNode(true)
                        : null;
                }
                if(tagName === "defs" || tagName === "style") {
                    return source.cloneNode(true);
                }
                const clone = source.cloneNode(false);
                Array.from(source.children || []).forEach(child => {
                    const childClone = cloneBranch(child);
                    if(childClone) clone.appendChild(childClone);
                });
                return clone.children.length ? clone : null;
            };
            const svg = template.cloneNode(false);
            Array.from(template.children).forEach(child => {
                const childClone = cloneBranch(child);
                if(childClone) svg.appendChild(childClone);
            });
            svg.id = "bm-precinct-map";
            svg.classList.add(
                "better-maps-container",
                "bm-precinct-map",
                "bm-precinct-county-detail"
            );
            svg.classList.remove(
                "has-county-hover",
                "bm-precinct-can-pan",
                "bm-precinct-state-overview"
            );
            svg.style.removeProperty("pointer-events");
            svg.querySelectorAll(".county-hover, .precinct-hover").forEach(element => {
                element.classList.remove("county-hover", "precinct-hover");
            });
            svg.setAttribute("width", context.svgMap.getAttribute("width") || "100%");
            svg.setAttribute("height", context.svgMap.getAttribute("height") || "100%");
            svg.setAttribute("aria-label", `${stateId} county precinct margin map`);
            return svg;
        };

        const getPrecinctElements = svg => {
            if(!svg) return [];
            if(precinctElementCache.has(svg)) return precinctElementCache.get(svg);
            const elements = Array.from(svg.querySelectorAll("path[data-dem][data-rep]"));
            precinctElementCache.set(svg, elements);
            return elements;
        };

        const getCountyDisplayName = element =>
            element.getAttribute("data-county-name")
            || element.getAttribute("data-county")
            || "Unknown county";

        const getCountyKey = element => {
            if(countyKeyCache.has(element)) return countyKeyCache.get(element);
            const key = getCountyJurisdictionKey(
                getCountyDisplayName(element),
                context?.stateId,
                element.getAttribute("data-county-fips") || element.getAttribute("data-county")
            );
            countyKeyCache.set(element, key);
            return key;
        };

        const inferMissingCountyMetadata = svg => {
            const precincts = getPrecinctElements(svg);
            const stateCache = inferredCountyCache.get(context.stateId) || new Map();
            precincts.forEach(element => {
                const countyName = stateCache.get(element.id);
                if(countyName) {
                    element.setAttribute("data-county", countyName);
                    element.setAttribute("data-county-name", countyName);
                    countyKeyCache.delete(element);
                }
            });
            const countyRaceMap = getCountyRaceMap(getActiveRace());
            const unresolved = precincts.filter(element => {
                const countyName = getCountyDisplayName(element);
                if(
                    context.stateId === "DC"
                    && normalizeCountyName(countyName) === "district of columbia"
                ) return true;
                return !findCountyRace(getCountyKey(element), countyName, countyRaceMap);
            });
            if(!unresolved.length) return;

            const countyFile = path.join(
                options.getBasePath(),
                "data",
                "counties",
                `${context.stateId.toLowerCase()}.svg`
            );
            if(!fs.existsSync(countyFile)) return;
            const countyDocument = new DOMParser().parseFromString(
                fs.readFileSync(countyFile, "utf8"),
                "image/svg+xml"
            );
            if(countyDocument.querySelector("parsererror")) return;
            const countySvg = countyDocument.documentElement;
            countySvg.classList.add("bm-precinct-county-reference");
            countySvg.setAttribute("aria-hidden", "true");
            if(!countySvg.getAttribute("viewBox")) {
                const countyWidth = parseFloat(countySvg.getAttribute("width")) || 1;
                const countyHeight = parseFloat(countySvg.getAttribute("height")) || 1;
                countySvg.setAttribute("viewBox", `0 0 ${countyWidth} ${countyHeight}`);
            }
            countySvg.setAttribute("width", svg.getAttribute("width") || "100%");
            countySvg.setAttribute("height", svg.getAttribute("height") || "100%");
            context.host.appendChild(countySvg);
            const countyPaths = Array.from(countySvg.querySelectorAll("path[id]"))
                .filter(element => typeof element.isPointInFill === "function");
            const getCombinedBounds = elements => {
                let bounds = null;
                elements.forEach(element => {
                    try {
                        const box = element.getBBox();
                        if(!bounds) {
                            bounds = {
                                x: box.x,
                                y: box.y,
                                right: box.x + box.width,
                                bottom: box.y + box.height
                            };
                        } else {
                            bounds.x = Math.min(bounds.x, box.x);
                            bounds.y = Math.min(bounds.y, box.y);
                            bounds.right = Math.max(bounds.right, box.x + box.width);
                            bounds.bottom = Math.max(bounds.bottom, box.y + box.height);
                        }
                    } catch {}
                });
                if(!bounds) return null;
                return {
                    ...bounds,
                    width: Math.max(1, bounds.right - bounds.x),
                    height: Math.max(1, bounds.bottom - bounds.y)
                };
            };
            const dcPrecinctBounds = context.stateId === "DC"
                ? getCombinedBounds(precincts)
                : null;
            const dcWardBounds = context.stateId === "DC"
                ? getCombinedBounds(countyPaths)
                : null;

            const toLocalPoint = (sourceElement, targetElement, point) => {
                try {
                    if(dcPrecinctBounds && dcWardBounds) {
                        const localPoint = countySvg.createSVGPoint();
                        localPoint.x = dcWardBounds.x
                            + (((point.x - dcPrecinctBounds.x) / dcPrecinctBounds.width)
                                * dcWardBounds.width);
                        localPoint.y = dcWardBounds.y
                            + (((point.y - dcPrecinctBounds.y) / dcPrecinctBounds.height)
                                * dcWardBounds.height);
                        return localPoint;
                    }
                    const sourceMatrix = sourceElement.getCTM();
                    const targetMatrix = targetElement.getCTM();
                    if(!sourceMatrix || !targetMatrix) return null;
                    return new DOMPoint(point.x, point.y)
                        .matrixTransform(sourceMatrix)
                        .matrixTransform(targetMatrix.inverse());
                } catch {
                    return null;
                }
            };
            unresolved.forEach(precinct => {
                let testPoints = [];
                let centerPoint = null;
                try {
                    const box = precinct.getBBox();
                    centerPoint = {
                        x: box.x + (box.width / 2),
                        y: box.y + (box.height / 2)
                    };
                    const addInteriorPoint = point => {
                        try {
                            const svgPoint = svg.createSVGPoint();
                            svgPoint.x = point.x;
                            svgPoint.y = point.y;
                            if(
                                typeof precinct.isPointInFill !== "function"
                                || precinct.isPointInFill(svgPoint)
                            ) {
                                testPoints.push(point);
                            }
                        } catch {}
                    };
                    addInteriorPoint(centerPoint);
                    if(context.stateId === "DC") {
                        [0.18, 0.34, 0.5, 0.66, 0.82].forEach(xFraction => {
                            [0.18, 0.34, 0.5, 0.66, 0.82].forEach(yFraction => {
                                addInteriorPoint({
                                    x: box.x + (box.width * xFraction),
                                    y: box.y + (box.height * yFraction)
                                });
                            });
                        });
                    } else {
                        testPoints.push(
                            { x: box.x + (box.width * 0.25), y: box.y + (box.height * 0.25) },
                            { x: box.x + (box.width * 0.75), y: box.y + (box.height * 0.75) }
                        );
                        const length = precinct.getTotalLength();
                        if(Number.isFinite(length) && length > 0) {
                            [0.17, 0.37, 0.63, 0.83].forEach(fraction => {
                                const point = precinct.getPointAtLength(length * fraction);
                                testPoints.push({ x: point.x, y: point.y });
                            });
                        }
                    }
                    if(!testPoints.length) testPoints.push(centerPoint);
                } catch {}
                let match = null;
                let bestInsideScore = 0;
                for(const countyPath of countyPaths) {
                    const insideScore = testPoints.reduce((score, point) => {
                        const localPoint = toLocalPoint(precinct, countyPath, point);
                        try {
                            return score + (
                                localPoint && countyPath.isPointInFill(localPoint) ? 1 : 0
                            );
                        } catch {
                            return score;
                        }
                    }, 0);
                    if(insideScore > bestInsideScore) {
                        bestInsideScore = insideScore;
                        match = countyPath;
                    }
                }
                if(!match && context.stateId === "DC" && centerPoint) {
                    let shortestDistance = Number.POSITIVE_INFINITY;
                    countyPaths.forEach(countyPath => {
                        const localPoint = toLocalPoint(
                            precinct,
                            countyPath,
                            centerPoint
                        );
                        if(!localPoint) return;
                        try {
                            const length = countyPath.getTotalLength();
                            if(!Number.isFinite(length) || length <= 0) return;
                            const sampleCount = 72;
                            let distance = Number.POSITIVE_INFINITY;
                            for(let index = 0; index <= sampleCount; index++) {
                                const boundaryPoint = countyPath.getPointAtLength(
                                    length * index / sampleCount
                                );
                                const dx = boundaryPoint.x - localPoint.x;
                                const dy = boundaryPoint.y - localPoint.y;
                                distance = Math.min(distance, (dx * dx) + (dy * dy));
                            }
                            if(distance < shortestDistance) {
                                shortestDistance = distance;
                                match = countyPath;
                            }
                        } catch {}
                    });
                }
                if(!match) return;
                const countyName = String(match.id || "")
                    .replace(/-state-path(?:-live)?$/, "")
                    .replace(/[-_]+/g, " ")
                    .replace(/^ward\s+(\d+)$/i, "Ward $1")
                    .trim();
                if(!countyName) return;
                precinct.setAttribute("data-county", countyName);
                precinct.setAttribute("data-county-name", countyName);
                if(context.stateId === "DC") {
                    precinct.setAttribute(
                        "data-ward",
                        match.getAttribute("data-ward")
                            || String(match.id || "").replace(/\D/g, "")
                    );
                }
                countyKeyCache.delete(precinct);
                stateCache.set(precinct.id, countyName);
            });
            countySvg.remove();
            inferredCountyCache.set(context.stateId, stateCache);
        };

        const getRaceCountyKey = county => {
            const rawName = String(county?.name || "").trim();
            const stateId = String(context?.stateId || "").toUpperCase();
            const jurisdictionCode = String(
                county?.fips
                ?? county?.countyFips
                ?? county?.countyFIPS
                ?? county?.countyID
                ?? county?.id
                ?? ""
            ).replace(/\D/g, "");
            return getCountyJurisdictionKey(rawName, stateId, jurisdictionCode);
        };

        const getCountyRaceMap = race => {
            const map = new Map();
            (race?.counties || []).forEach(county => {
                const key = getRaceCountyKey(county);
                if(key && !map.has(key)) map.set(key, county);
            });
            return map;
        };

        const findCountyRace = (countyKey, countyName, countyRaceMap) => {
            if(countyRaceMap.has(countyKey)) return countyRaceMap.get(countyKey);
            const equivalent = Array.from(countyRaceMap.entries())
                .filter(([key]) => countyKeysEquivalent(key, countyKey));
            if(equivalent.length === 1) return equivalent[0][1];
            if(
                context.stateId === "DC"
                && countyRaceMap.size === 0
                && Array.isArray(getActiveRace()?.cands)
            ) {
                return {
                    ...getActiveRace(),
                    name: "District of Columbia"
                };
            }
            const numericCounty = String(countyName || "").trim();
            const exactNumeric = (getActiveRace()?.counties || []).find(county =>
                String(county?.id ?? county?.fips ?? county?.countyID ?? "").replace(/^0+/, "")
                === numericCounty.replace(/^0+/, "")
            );
            if(exactNumeric) return exactNumeric;
            const candidates = Array.from(countyRaceMap.entries())
                .filter(([key]) => key.includes(countyKey) || countyKey.includes(key));
            return candidates.length === 1 ? candidates[0][1] : null;
        };

        const getSimulationKey = (countyKey, countyRace) => {
            const signature = (countyRace?.cands || [])
                .map(candidate => [
                    candidate?.id ?? getCandidateName(candidate, options.getCandidateName),
                    getPartyKey(candidate, options.getCandidateParty),
                    Number(options.getCandidateIdeology?.(candidate)) || 0,
                    getCandidateVotes(candidate)
                ].join(":"))
                .join("|");
            return `v7|${context.stateId}|${context.electionType}|${countyKey}|${signature}`;
        };

        const buildCountySimulation = (countyKey, countyName, elements, countyRace) => {
            const cacheKey = getSimulationKey(countyKey, countyRace);
            if(simulationCache.has(cacheKey)) {
                const cached = simulationCache.get(cacheKey);
                const elementsById = new Map(elements.map(element => [element.id, element]));
                return {
                    ...cached,
                    precincts: cached.precincts.map((precinct, index) => ({
                        ...precinct,
                        element: elementsById.get(precinct.id) || elements[index] || null
                    }))
                };
            }
            if(!countyRace || !Array.isArray(countyRace.cands) || !elements.length) return null;

            const candidates = countyRace.cands.map(candidate => ({
                source: candidate,
                name: getCandidateName(candidate, options.getCandidateName),
                party: getPartyKey(candidate, options.getCandidateParty),
                candidateColour: options.getCandidateColour?.(candidate, getActiveRace()) || "",
                votes: getCandidateVotes(candidate),
                identity: getCandidateIdentity(candidate),
                ideology: Math.max(
                    -2,
                    Math.min(
                        2,
                        Number(options.getCandidateIdeology?.(candidate)) || 0
                    )
                )
            }));
            candidates.forEach(candidate => {
                candidate.baselineParty = candidate.party === "D" || candidate.party === "R"
                    ? candidate.party
                    : "I";
            });
            const candidatesByBaselineParty = new Map();
            candidates.forEach(candidate => {
                if(candidate.votes <= 0) return;
                if(!candidatesByBaselineParty.has(candidate.baselineParty)) {
                    candidatesByBaselineParty.set(candidate.baselineParty, []);
                }
                candidatesByBaselineParty.get(candidate.baselineParty).push(candidate);
            });
            candidatesByBaselineParty.forEach(group => {
                group.sort((candidateA, candidateB) =>
                    candidateA.identity.localeCompare(candidateB.identity));
                const ideologies = group.map(candidate => candidate.ideology);
                const ideologyRange = Math.max(...ideologies) - Math.min(...ideologies);
                if(group.length > 1 && ideologyRange < 0.08) {
                    const center = ideologies.reduce((sum, value) => sum + value, 0)
                        / ideologies.length;
                    const spread = Math.min(0.9, 0.32 * (group.length - 1));
                    group.forEach((candidate, index) => {
                        const relativePosition = group.length > 1
                            ? (index / (group.length - 1)) - 0.5
                            : 0;
                        candidate.simulationIdeology = Math.max(
                            -2,
                            Math.min(2, center + (relativePosition * spread))
                        );
                    });
                } else {
                    group.forEach(candidate => {
                        candidate.simulationIdeology = candidate.ideology;
                    });
                }
            });
            const precincts = elements.map((element, index) => {
                const baselineD = readNumber(element.getAttribute("data-dem"));
                const baselineR = readNumber(element.getAttribute("data-rep"));
                const baselineI = readNumber(element.getAttribute("data-ind"));
                const baselineTotal = readNumber(element.getAttribute("data-total"))
                    || baselineD + baselineR + baselineI;
                const hasBaselineData = baselineTotal > 0;
                return {
                    id: element.id || `${context.stateId}-${countyKey}-${index + 1}`,
                    name: element.getAttribute("data-name") || `Precinct ${index + 1}`,
                    element,
                    hasBaselineData,
                    baseline: {
                        D: baselineD,
                        R: baselineR,
                        I: baselineI,
                        total: baselineTotal
                    },
                    candidates: []
                };
            });

            candidates.forEach((candidate, candidateIndex) => {
                const baselineParty = candidate.baselineParty;
                const partyGroup = candidatesByBaselineParty.get(baselineParty) || [];
                const partyGroupIndex = partyGroup.indexOf(candidate);
                const partyBaselineTotal = precincts.reduce(
                    (sum, precinct) => sum + precinct.baseline[baselineParty],
                    0
                );
                const weights = precincts.map(precinct => {
                    if(!precinct.hasBaselineData) return 0;
                    const baseWeight = partyBaselineTotal > 0
                        ? precinct.baseline[baselineParty]
                        : (precinct.baseline.total || 1);
                    if(partyGroup.length < 2 || partyGroupIndex < 0) return baseWeight;
                    const democraticVotes = precinct.baseline.D;
                    const republicanVotes = precinct.baseline.R;
                    const independentVotes = precinct.baseline.I;
                    const partisanVotes = democraticVotes + republicanVotes;
                    const allBaselineVotes = partisanVotes + independentVotes;
                    const independentShare = allBaselineVotes > 0
                        ? independentVotes / allBaselineVotes
                        : 0;
                    const precinctIdeology = partisanVotes > 0
                        ? (
                            ((republicanVotes - democraticVotes) / partisanVotes)
                            * 2
                            * (1 - (independentShare * 0.35))
                        )
                        : 0;
                    const ideologicalDistance = Math.abs(
                        precinctIdeology - candidate.simulationIdeology
                    );
                    const affinity = 0.08 + Math.exp(
                        -0.5 * Math.pow(ideologicalDistance / 0.65, 2)
                    );
                    return baseWeight * affinity;
                });
                const allocations = allocateExact(candidate.votes, weights);
                precincts.forEach((precinct, precinctIndex) => {
                    precinct.candidates[candidateIndex] = {
                        ...candidate,
                        votes: allocations[precinctIndex]
                    };
                });
            });

            precincts.forEach(precinct => {
                precinct.totalVotes = precinct.candidates.reduce(
                    (sum, candidate) => sum + candidate.votes,
                    0
                );
                precinct.candidates.forEach(candidate => {
                    candidate.percent = precinct.totalVotes > 0
                        ? (candidate.votes / precinct.totalVotes) * 100
                        : 0;
                });
                const ranked = precinct.candidates.slice().sort((a, b) => b.votes - a.votes);
                precinct.winner = ranked[0] || null;
                precinct.runnerUp = ranked[1] || null;
                precinct.marginPoints = precinct.totalVotes > 0
                    ? ((precinct.winner?.votes || 0) - (precinct.runnerUp?.votes || 0))
                        / precinct.totalVotes * 100
                    : 0;
                precinct.rating = null;
            });

            const officialTotal = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
            const officialRanked = candidates.slice().sort((a, b) => b.votes - a.votes);
            const officialMargin = officialTotal > 0
                ? ((officialRanked[0]?.votes || 0) - (officialRanked[1]?.votes || 0))
                    / officialTotal * 100
                : 0;
            const result = {
                key: countyKey,
                name: countyRace?.name || countyName,
                sourceRace: countyRace,
                candidates,
                precincts,
                totalVotes: officialTotal,
                winner: officialRanked[0] || null,
                runnerUp: officialRanked[1] || null,
                marginPoints: officialMargin,
                rating: null
            };
            simulationCache.set(cacheKey, {
                ...result,
                precincts: result.precincts.map(precinct => {
                    const cachedPrecinct = { ...precinct };
                    delete cachedPrecinct.element;
                    return cachedPrecinct;
                })
            });
            return result;
        };

        const getStateSimulationSignature = () => {
            const race = getActiveRace();
            const statewide = (race?.cands || []).map(candidate => [
                getCandidateIdentity(candidate),
                getPartyKey(candidate, options.getCandidateParty),
                getCandidateVotes(candidate)
            ].join(":")).join("|");
            const counties = (race?.counties || []).map(county => [
                getRaceCountyKey(county),
                (county?.cands || []).map(candidate => [
                    getCandidateIdentity(candidate),
                    getCandidateVotes(candidate)
                ].join(":")).join(",")
            ].join("=")).join("|");
            return `${context?.stateId}|${context?.electionType}|${statewide}|${counties}`;
        };

        const applySimulationRatings = simulations => {
            const precinctMargins = Array.from(simulations.values())
                .flatMap(simulation => simulation.precincts)
                .map(precinct => Math.max(0, precinct.marginPoints / 100));
            const resolveColour = options.createMarginColourResolver?.(
                getActiveRace(),
                precinctMargins
            );
            simulations.forEach(simulation => {
                simulation.precincts.forEach(precinct => {
                    precinct.rating = !precinct.hasBaselineData
                        ? {
                            key: "no-data",
                            label: "No precinct data",
                            colour: NO_PRECINCT_DATA_COLOUR
                        }
                        : precinct.totalVotes > 0
                        ? getMarginRating(
                            precinct.winner,
                            precinct.marginPoints,
                            resolveColour
                        )
                        : {
                            key: "tossup",
                            label: "No results",
                            colour: TOSSUP_COLOUR
                        };
                });
                simulation.rating = getMarginRating(
                    simulation.winner,
                    simulation.marginPoints,
                    resolveColour
                );
            });
            return simulations;
        };

        const buildSimulations = svg => {
            const signature = getStateSimulationSignature();
            const cachedState = stateSimulationCache.get(svg);
            if(cachedState?.signature === signature) return cachedState.simulations;
            const elementsByCounty = new Map();
            getPrecinctElements(svg).forEach(element => {
                const key = getCountyKey(element);
                if(!key) return;
                if(!elementsByCounty.has(key)) elementsByCounty.set(key, []);
                elementsByCounty.get(key).push(element);
            });
            const countyRaceMap = getCountyRaceMap(getActiveRace());
            const simulations = new Map();
            elementsByCounty.forEach((elements, countyKey) => {
                const displayName = getCountyDisplayName(elements[0]);
                const countyRace = findCountyRace(countyKey, displayName, countyRaceMap);
                const simulation = buildCountySimulation(
                    countyKey,
                    displayName,
                    elements,
                    countyRace
                );
                if(simulation) simulations.set(countyKey, simulation);
            });
            applySimulationRatings(simulations);
            stateSimulationCache.set(svg, { signature, simulations });
            return simulations;
        };

        const normalizeCandidateMatchText = value => String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

        const getCandidateMatchKeys = candidate => {
            const source = candidate?.source || candidate;
            const identity = String(
                candidate?.identity || getCandidateIdentity(source) || ""
            ).trim().toLowerCase();
            const name = normalizeCandidateMatchText(
                candidate?.name || getCandidateName(source, options.getCandidateName)
            );
            const party = String(
                candidate?.party || getPartyKey(source, options.getCandidateParty) || "I"
            ).trim().toUpperCase();
            const keys = [];
            if(identity && identity !== "candidate") keys.push(`id:${identity}`);
            if(name) {
                keys.push(`name-party:${name}|${party}`);
                keys.push(`name:${name}`);
            }
            return keys;
        };

        const addRcvPctDeltas = (
            finalCandidates,
            finalTotal,
            initialCandidates,
            initialTotal
        ) => {
            if(activeRaceVariant !== "rcv") return finalCandidates;
            const initialByKey = new Map();
            (Array.isArray(initialCandidates) ? initialCandidates : []).forEach(candidate => {
                getCandidateMatchKeys(candidate).forEach(key => {
                    if(!initialByKey.has(key)) initialByKey.set(key, candidate);
                });
            });
            return (Array.isArray(finalCandidates) ? finalCandidates : []).map(candidate => {
                const initialCandidate = getCandidateMatchKeys(candidate)
                    .map(key => initialByKey.get(key))
                    .find(Boolean);
                if(!initialCandidate) return candidate;
                const finalPct = finalTotal > 0
                    ? (getCandidateVotes(candidate) / finalTotal) * 100
                    : 0;
                const initialPct = initialTotal > 0
                    ? (getCandidateVotes(initialCandidate) / initialTotal) * 100
                    : 0;
                return {
                    ...candidate,
                    pctDelta: finalPct - initialPct
                };
            });
        };

        const getInitialCountyRace = simulation => {
            const initialCountyMap = getCountyRaceMap(context?.race);
            return findCountyRace(
                simulation?.key || "",
                simulation?.name || "",
                initialCountyMap
            );
        };

        const buildInitialCountySimulation = simulation => {
            const initialCountyRace = getInitialCountyRace(simulation);
            if(!initialCountyRace) return null;
            const elements = (simulation?.precincts || [])
                .map(precinct => precinct.element)
                .filter(Boolean);
            if(!elements.length) return null;
            return buildCountySimulation(
                simulation.key,
                simulation.name,
                elements,
                initialCountyRace
            );
        };

        const scheduleStatePreload = () => {
            if(!context) return;
            const stateId = context.stateId;
            const electionType = context.electionType;
            const preloadKey = `${stateId}|${electionType}`;
            if(preloadedStateKeys.has(preloadKey)) return;
            preloadedStateKeys.add(preloadKey);
            const preload = () => {
                if(
                    !context
                    || context.stateId !== stateId
                    || context.electionType !== electionType
                ) {
                    preloadedStateKeys.delete(preloadKey);
                    return;
                }
                try {
                    const template = getSvgTemplate(stateId);
                    if(
                        stateId === "AK"
                        && template
                        && context?.stateId === stateId
                        && context?.svgMap?.isConnected
                    ) {
                        ensureCountyMetadataForDirectEntry(template);
                    }
                } catch {
                    preloadedStateKeys.delete(preloadKey);
                }
            };
            if(typeof requestIdleCallback === "function") {
                requestIdleCallback(preload, { timeout: 1200 });
            } else {
                setTimeout(preload, 0);
            }
        };

        const countyTooltipData = simulation => {
            const initialCountyRace = activeRaceVariant === "rcv"
                ? getInitialCountyRace(simulation)
                : null;
            return {
                territoryType: activeRaceVariant === "rcv" || context?.electionType === "mayor"
                    ? "County"
                    : "",
                territoryName: simulation.name,
                territoryContext: activeRaceVariant === "rcv"
                    ? "Final RCV"
                    : "",
                reportingText: "100% in",
                electionType: context?.electionType,
                showTurnout: true,
                sourceRace: simulation.sourceRace,
                marginVotes: (simulation.winner?.votes || 0) - (simulation.runnerUp?.votes || 0),
                marginPoints: simulation.marginPoints,
                candidates: addRcvPctDeltas(
                    simulation.candidates,
                    simulation.totalVotes,
                    initialCountyRace?.cands,
                    getRaceTotal(initialCountyRace)
                ),
                totalVotes: simulation.totalVotes,
                totalLabel: activeRaceVariant === "rcv"
                    ? "Final RCV total"
                    : "Total reported"
            };
        };

        const precinctTooltipData = (simulation, precinct) => {
            const initialSimulation = activeRaceVariant === "rcv"
                ? buildInitialCountySimulation(simulation)
                : null;
            const initialPrecinct = initialSimulation?.precincts?.find(candidatePrecinct =>
                candidatePrecinct.id === precinct.id
            );
            return {
                territoryType: "Precinct",
                territoryName: precinct.name,
                territoryContext: activeRaceVariant === "rcv"
                    ? `${simulation.name} - Final RCV`
                    : simulation.name,
                electionType: context?.electionType,
                showTurnout: false,
                marginVotes: (precinct.winner?.votes || 0) - (precinct.runnerUp?.votes || 0),
                marginPoints: precinct.marginPoints,
                candidates: addRcvPctDeltas(
                    precinct.candidates,
                    precinct.totalVotes,
                    initialPrecinct?.candidates,
                    initialPrecinct?.totalVotes || 0
                ),
                totalVotes: precinct.totalVotes,
                totalLabel: activeRaceVariant === "rcv"
                    ? "Final RCV total"
                    : "Estimated total"
            };
        };

        const clearCountyHover = svg => {
            svg?.classList.remove("has-county-hover");
            svg?.querySelectorAll(".county-hover").forEach(element =>
                element.classList.remove("county-hover"));
        };

        const setCountyHover = (svg, simulation) => {
            clearCountyHover(svg);
            svg?.classList.add("has-county-hover");
            simulation?.precincts.forEach(precinct => {
                precinct.element?.classList.add("county-hover");
            });
        };

        const removeTemporaryUi = ({ preserveStatus = false } = {}) => {
            clearEventListeners();
            clearCountyHover(activeSvg);
            activeSvg?.querySelectorAll(".precinct-hover").forEach(element =>
                element.classList.remove("precinct-hover"));
            activeSvg?.remove();
            activeSvg = null;
            document.getElementById("bm-precinct-county-toolbar")?.remove();
            document.getElementById("bm-precinct-return-state")?.remove();
            document.getElementById("bm-precinct-zoom-controls")?.remove();
            if(!preserveStatus) document.getElementById("bm-precinct-status")?.remove();
            document.querySelectorAll(".bm-precinct-county-reference").forEach(element =>
                element.remove());
            hideTooltip();
            pinnedPrecinctId = null;
            dragging = null;
        };

        const setPrecinctHostActive = enabled => {
            const host = context?.host;
            if(!host) return;
            host.classList.toggle("bm-precinct-host", enabled);
            host.classList.toggle(
                "bm-precinct-host-page",
                enabled && context?.live === false
            );
        };

        const restoreNativeControlAnchors = () => {
            const host = context?.host;
            const svgMap = context?.svgMap;
            if(!host?.isConnected || !svgMap?.isConnected) return;
            host.classList.add("bm-county-map-host");
            const returnButton = context.nativeReturnButton;
            const viewControls = context.nativeViewControls;
            const isCityMayoralContext = context?.electionType === "mayor"
                || viewControls?.id === "bm-city-mayor-map-controls";
            const restoreCityMayoralControlAnchor = () => {
                if(!isCityMayoralContext || !viewControls?.isConnected) return;
                ["top", "right", "bottom", "left"].forEach(property => {
                    viewControls.style.removeProperty(property);
                });
            };
            if(returnButton?.isConnected && returnButton.parentElement !== host) {
                host.insertBefore(returnButton, svgMap);
            }
            if(viewControls?.isConnected && viewControls.parentElement !== host) {
                host.insertBefore(viewControls, svgMap);
            }
            const positionControls = () => {
                if(!host.isConnected || !svgMap.isConnected) return;
                const hostBounds = host.getBoundingClientRect();
                const mapBounds = svgMap.getBoundingClientRect();
                if(mapBounds.width <= 0 || mapBounds.height <= 0) return;
                const mapLeft = mapBounds.left - hostBounds.left;
                const mapTop = mapBounds.top - hostBounds.top;
                const mapRight = mapLeft + mapBounds.width;
                if(returnButton?.isConnected) {
                    returnButton.style.setProperty("position", "absolute", "important");
                    returnButton.style.setProperty("margin", "0", "important");
                    returnButton.style.left = `${mapLeft + 8}px`;
                    returnButton.style.top = `${mapTop + 8}px`;
                }
                if(isCityMayoralContext) {
                    restoreCityMayoralControlAnchor();
                } else if(viewControls?.isConnected) {
                    viewControls.style.top = `${mapTop + 8}px`;
                    viewControls.style.left = `${Math.max(
                        mapLeft + 8,
                        mapRight - viewControls.offsetWidth - 8
                    )}px`;
                }
                positionButtonBesideProjections();
            };

            restoreCityMayoralControlAnchor();
            requestAnimationFrame(positionControls);
            setTimeout(positionControls, 0);
            setTimeout(positionControls, 60);
        };

        const restoreNativeMap = () => {
            const returnMode = getReturnMapMode();
            if(context?.svgMap) context.svgMap.style.removeProperty("display");
            if(context?.nativeReturnButton) context.nativeReturnButton.style.removeProperty("display");
            if(context?.suppressEntryButton) {
                document.getElementById("eNightPrecinctsB")?.remove();
            } else {
                document.getElementById("eNightPrecinctsB")?.style.removeProperty("display");
            }
            document.getElementById("bm-precincts-rcv-button")?.style.removeProperty("display");
            context?.nativeViewControls
                ?.querySelectorAll("[data-map-mode], [data-primary-county-view]")
                .forEach(button => {
                    button.style.removeProperty("display");
                    button.classList.toggle(
                        "bm-primary-county-view-active",
                        button.dataset.mapMode === returnMode
                    );
                });
            setPrecinctHostActive(false);
            document.body?.classList.remove("bm-precinct-mode-active");
            restoreNativeControlAnchors();
        };

        const deactivate = ({ removeButton = false, nextMode = "" } = {}) => {
            const wasActive = active;
            const modeToRestore = nextMode || (wasActive ? getReturnMapMode() : "");
            removeTemporaryUi();
            restoreNativeMap();
            clearHeavyPrecinctCaches();
            active = false;
            activationPending = false;
            options.onActiveChange?.(false);
            detailCountyKey = null;
            const button = document.getElementById("eNightPrecinctsB");
            if(removeButton) {
                button?.remove();
            }
            else if(button) button.className = "";
            if(modeToRestore) options.setActiveMapMode?.(modeToRestore);
            activeRaceVariant = "normal";
            if(wasActive && !removeButton) options.refreshCountyMap?.();
        };

        const getProjectionButton = () =>
            context?.host?.querySelector(
                "#bm-primary-county-view-controls [data-primary-county-view='projections']"
            )
            || context?.host?.querySelector(
                "#bm-city-mayor-map-controls [data-city-mayor-map-mode='margin']"
            )
            || document.getElementById("eNightProjectB")
            || document.getElementById("ePageProjectB");

        const getNeutralReturnStyleButton = () =>
            context?.host?.querySelector(
                "#bm-city-mayor-map-controls button:not(.bm-city-mayor-mode-active)"
            )
            || getProjectionButton();

        const positionButtonBesideProjections = () => {
            const button = document.getElementById("eNightPrecinctsB");
            const projectButton = getProjectionButton();
            if(!button || !projectButton || !context?.host?.isConnected) return;
            const gap = 7;
            const getAvailableButtonWidth = projectBounds => {
                let width = context.live === false
                    ? Math.max(82, projectBounds.width - 44)
                    : projectBounds.width;
                const returnBounds = context.nativeReturnButton?.getBoundingClientRect();
                const mapBounds = context.svgMap?.getBoundingClientRect();
                if(
                    context.live === false
                    && returnBounds?.width > 0
                    && mapBounds?.width > 0
                ) {
                    width = Math.min(
                        width,
                        Math.max(
                            82,
                            mapBounds.right
                                - returnBounds.right
                                - projectBounds.width
                                - (gap * 2)
                        )
                    );
                }
                return width;
            };
            const countyControls = projectButton.closest("#bm-primary-county-view-controls");
            if(countyControls) {
                countyControls.classList.add("bm-has-precincts");
                if(button.parentElement !== countyControls) {
                    countyControls.insertBefore(button, projectButton);
                }
                const projectBounds = projectButton.getBoundingClientRect();
                const flipButton = countyControls.querySelector(
                    "[data-map-mode='flip-counties']"
                );
                const projectStyle = getComputedStyle(projectButton);
                [
                    "font", "padding", "border", "border-radius", "background",
                    "color", "box-shadow", "line-height", "letter-spacing"
                ].forEach(property => {
                    button.style.setProperty(property, projectStyle.getPropertyValue(property));
                });
                if(projectBounds.width > 0) {
                    const availableWidth = getAvailableButtonWidth(projectBounds);

                    const buttonWidth = context.live === false && flipButton
                        ? Math.max(122, Math.min(140, availableWidth))
                        : availableWidth;
                    button.style.setProperty("width", `${buttonWidth}px`, "important");
                    if(context.live === false && flipButton) {
                        flipButton.style.setProperty(
                            "width",
                            `${buttonWidth}px`,
                            "important"
                        );
                        countyControls.style.setProperty(
                            "grid-template-columns",
                            `${buttonWidth}px ${projectBounds.width}px`
                        );
                    } else {
                        countyControls.style.removeProperty("grid-template-columns");
                    }
                }
                if(projectBounds.height > 0) {
                    button.style.setProperty("height", `${projectBounds.height}px`, "important");
                }
                button.style.setProperty("position", "static", "important");
                button.style.removeProperty("left");
                button.style.removeProperty("top");
                button.style.setProperty("margin", "0", "important");
                if(context.live === false && !flipButton) {
                    button.style.setProperty("margin-left", `${gap}px`, "important");
                } else {
                    button.style.removeProperty("margin-left");
                }
                return;
            }
            const hostBounds = context.host.getBoundingClientRect();
            const projectBounds = projectButton.getBoundingClientRect();
            if(projectBounds.width <= 0 || projectBounds.height <= 0) return;
            const projectStyle = getComputedStyle(projectButton);
            [
                "font", "padding", "border", "border-radius", "background",
                "color", "box-shadow", "line-height", "letter-spacing"
            ].forEach(property => {
                button.style.setProperty(property, projectStyle.getPropertyValue(property));
            });
            const buttonWidth = getAvailableButtonWidth(projectBounds);
            button.style.setProperty(
                "left",
                `${projectBounds.left - hostBounds.left - buttonWidth - gap}px`,
                "important"
            );
            button.style.setProperty(
                "top",
                `${projectBounds.top - hostBounds.top}px`,
                "important"
            );
            button.style.setProperty("width", `${buttonWidth}px`, "important");
            button.style.setProperty("height", `${projectBounds.height}px`, "important");
            button.style.setProperty("margin", "0", "important");
        };

        const applyZoom = () => {
            const stage = activeSvg?.querySelector(".bm-precinct-zoom-stage");
            if(!stage) return;
            const viewBox = activeSvg.viewBox?.baseVal;
            const centerX = (viewBox?.x || 0) + ((viewBox?.width || 0) / 2);
            const centerY = (viewBox?.y || 0) + ((viewBox?.height || 0) / 2);
            stage.setAttribute(
                "transform",
                `translate(${centerX + panX} ${centerY + panY}) scale(${zoom}) translate(${-centerX} ${-centerY})`
            );
            const minus = document.querySelector("#bm-precinct-zoom-controls [data-action='minus']");
            if(minus) minus.disabled = zoom <= PRECINCT_MIN_ZOOM;
            activeSvg.classList.toggle("bm-precinct-can-pan", zoom > PRECINCT_MIN_ZOOM);
        };

        const getZoomCenter = () => {
            const viewBox = activeSvg?.viewBox?.baseVal;
            return {
                x: (viewBox?.x || 0) + ((viewBox?.width || 0) / 2),
                y: (viewBox?.y || 0) + ((viewBox?.height || 0) / 2)
            };
        };

        const getContentPointAtEvent = (svg, event) => {
            try {
                const point = svg.createSVGPoint();
                point.x = event.clientX;
                point.y = event.clientY;
                const rootPoint = point.matrixTransform(svg.getScreenCTM().inverse());
                const center = getZoomCenter();
                return {
                    x: center.x + ((rootPoint.x - center.x - panX) / zoom),
                    y: center.y + ((rootPoint.y - center.y - panY) / zoom)
                };
            } catch {
                return null;
            }
        };

        const setZoomAtPoint = (nextZoom, anchor = null) => {
            const boundedZoom = Math.max(
                PRECINCT_MIN_ZOOM,
                Math.min(PRECINCT_MAX_ZOOM, nextZoom)
            );
            if(boundedZoom === zoom) return;
            if(anchor) {
                const center = getZoomCenter();
                panX += (zoom - boundedZoom) * (anchor.x - center.x);
                panY += (zoom - boundedZoom) * (anchor.y - center.y);
            }
            zoom = boundedZoom;
            if(zoom === PRECINCT_MIN_ZOOM) {
                panX = 0;
                panY = 0;
            }
            applyZoom();
        };

        const installZoomControls = () => {
            const controls = document.createElement("div");
            controls.id = "bm-precinct-zoom-controls";
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
                    options.playClick?.();
                    if(action === "plus") {
                        setZoomAtPoint(zoom + PRECINCT_BUTTON_ZOOM_STEP, zoomAnchor);
                    } else if(action === "minus") {
                        setZoomAtPoint(zoom - PRECINCT_BUTTON_ZOOM_STEP, zoomAnchor);
                    } else {
                        zoom = PRECINCT_MIN_ZOOM;
                        panX = 0;
                        panY = 0;
                        zoomAnchor = null;
                        applyZoom();
                    }
                });
                return button;
            };
            controls.appendChild(createButton("+", "plus", "Zoom in"));
            controls.appendChild(createButton("-", "minus", "Zoom out"));
            controls.appendChild(createButton("Reset", "reset", "Reset zoom"));
            context.host.appendChild(controls);
            applyZoom();
        };

        const positionPrecinctOverlayControls = () => {
            if(!activeSvg?.isConnected || !context?.host?.isConnected) return;
            const hostBounds = context.host.getBoundingClientRect();
            const mapBounds = activeSvg.getBoundingClientRect();
            if(mapBounds.width <= 0 || mapBounds.height <= 0) return;
            const mapLeft = mapBounds.left - hostBounds.left;
            const mapTop = mapBounds.top - hostBounds.top;
            const toolbar = document.getElementById("bm-precinct-county-toolbar");
            if(toolbar) {
                toolbar.style.left = `${mapLeft + 8}px`;
                toolbar.style.top = `${mapTop + 8}px`;
                toolbar.style.maxWidth = `${Math.max(120, mapBounds.width - 16)}px`;
            }
            const returnButton = document.getElementById("bm-precinct-return-state");
            if(returnButton && !toolbar?.contains(returnButton)) {
                returnButton.style.left = `${mapLeft + 8}px`;
                returnButton.style.top = `${mapTop + 8}px`;
            }
            const zoomControls = document.getElementById("bm-precinct-zoom-controls");
            if(zoomControls) {
                const controlsBounds = zoomControls.getBoundingClientRect();
                zoomControls.style.right = "auto";
                zoomControls.style.bottom = "auto";
                zoomControls.style.left = `${Math.max(
                    mapLeft + 8,
                    mapLeft + mapBounds.width - controlsBounds.width - 10
                )}px`;
                zoomControls.style.top = `${Math.max(
                    mapTop + 8,
                    mapTop + mapBounds.height - controlsBounds.height - 10
                )}px`;
            }
            const status = document.getElementById("bm-precinct-status");
            if(status) {
                status.style.left = `${mapLeft + (mapBounds.width / 2)}px`;
                status.style.top = `${mapTop + (mapBounds.height / 2)}px`;
            }
        };

        const schedulePrecinctOverlayPosition = () => {
            requestAnimationFrame(positionPrecinctOverlayControls);
            setTimeout(positionPrecinctOverlayControls, 0);
            setTimeout(positionPrecinctOverlayControls, 60);
        };

        const wrapZoomStage = svg => {
            const stage = document.createElementNS(SVG_NS, "g");
            stage.classList.add("bm-precinct-zoom-stage");
            while(svg.firstChild) stage.appendChild(svg.firstChild);
            svg.appendChild(stage);
            return stage;
        };

        const cropToCounty = (svg, visibleElements) => {
            let bounds = null;
            visibleElements.forEach(element => {
                try {
                    const box = element.getBBox();
                    if(box.width <= 0 && box.height <= 0) return;
                    if(!bounds) {
                        bounds = { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height };
                    } else {
                        bounds.x = Math.min(bounds.x, box.x);
                        bounds.y = Math.min(bounds.y, box.y);
                        bounds.right = Math.max(bounds.right, box.x + box.width);
                        bounds.bottom = Math.max(bounds.bottom, box.y + box.height);
                    }
                } catch {}
            });
            if(!bounds) return;
            const width = Math.max(1, bounds.right - bounds.x);
            const height = Math.max(1, bounds.bottom - bounds.y);
            const padding = Math.max(width, height) * 0.08;
            svg.setAttribute(
                "viewBox",
                `${bounds.x - padding} ${bounds.y - padding} ${width + (padding * 2)} ${height + (padding * 2)}`
            );
        };

        const installPan = svg => {
            svg.setAttribute("draggable", "false");
            svg.setAttribute("focusable", "false");
            svg.removeAttribute("tabindex");
            listen(svg, "dragstart", event => {
                event.preventDefault();
                event.stopPropagation();
            });
            listen(svg, "selectstart", event => {
                event.preventDefault();
                event.stopPropagation();
            });
            listen(svg, "contextmenu", event => {
                event.preventDefault();
                event.stopPropagation();
            });
            listen(svg, "wheel", event => {
                if(!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
                event.preventDefault();
                event.stopPropagation();
                zoomAnchor = getContentPointAtEvent(svg, event) || zoomAnchor;
                setZoomAtPoint(
                    zoom + (event.deltaY < 0 ? PRECINCT_WHEEL_ZOOM_STEP : -PRECINCT_WHEEL_ZOOM_STEP),
                    zoomAnchor
                );
            }, { passive: false });
            listen(svg, "pointerdown", event => {
                if(event.button !== 0 && event.button !== 2) return;
                event.preventDefault();
                if(svg.contains(document.activeElement)) {
                    document.activeElement?.blur?.();
                }
                if(zoom <= PRECINCT_MIN_ZOOM) return;
                dragging = {
                    x: event.clientX,
                    y: event.clientY,
                    panX,
                    panY
                };
                svg.setPointerCapture?.(event.pointerId);
            });
            listen(svg, "pointermove", event => {
                if(!dragging) {
                    zoomAnchor = getContentPointAtEvent(svg, event) || zoomAnchor;
                    return;
                }
                const rect = svg.getBoundingClientRect();
                const viewBox = svg.viewBox.baseVal;
                panX = dragging.panX + ((event.clientX - dragging.x) * viewBox.width / rect.width);
                panY = dragging.panY + ((event.clientY - dragging.y) * viewBox.height / rect.height);
                applyZoom();
                event.preventDefault();
            });
            const stopDrag = () => { dragging = null; };
            listen(svg, "pointerup", stopDrag);
            listen(svg, "pointercancel", stopDrag);
            listen(svg, "pointerleave", stopDrag);
        };

        const ensureCountyMetadataForDirectEntry = template => {
            const elements = getPrecinctElements(template);
            const metadataComplete = elements.every(element =>
                element.hasAttribute("data-county")
                || element.hasAttribute("data-county-name")
            );
            const dcNeedsWardInference = context.stateId === "DC"
                && elements.some(element =>
                    normalizeCountyName(getCountyDisplayName(element)) === "district of columbia"
                );
            if(metadataComplete && !dcNeedsWardInference) return;
            const previousStyle = template.getAttribute("style");
            template.setAttribute("width", context.svgMap.getAttribute("width") || "100%");
            template.setAttribute("height", context.svgMap.getAttribute("height") || "100%");
            template.style.position = "absolute";
            template.style.inset = "0";
            template.style.visibility = "hidden";
            template.style.pointerEvents = "none";
            context.host.appendChild(template);
            try {
                inferMissingCountyMetadata(template);
            } finally {
                template.remove();
                if(previousStyle === null) template.removeAttribute("style");
                else template.setAttribute("style", previousStyle);
            }
        };

        const buildDirectCountySimulations = countyIdentifier => {
            const template = getSvgTemplate(context.stateId);
            if(!template) return null;
            ensureCountyMetadataForDirectEntry(template);
            const countyRaceMap = getCountyRaceMap(getActiveRace());
            const requestedKey = getCountyJurisdictionKey(
                countyIdentifier,
                context.stateId
            );
            const requestedRace = findCountyRace(
                requestedKey,
                countyIdentifier,
                countyRaceMap
            );
            const raceKey = getRaceCountyKey(requestedRace);
            const allElements = getPrecinctElements(template);
            let elements = allElements.filter(element => {
                const key = getCountyKey(element);
                return countyKeysEquivalent(key, requestedKey)
                    || (raceKey && countyKeysEquivalent(key, raceKey));
            });
            if(!elements.length) {
                const candidateKeys = Array.from(new Set(
                    allElements.map(element => getCountyKey(element)).filter(Boolean)
                )).filter(key =>
                    countyKeysEquivalent(key, requestedKey)
                    || (raceKey && countyKeysEquivalent(key, raceKey))
                    || key.includes(requestedKey)
                    || requestedKey.includes(key)
                    || (raceKey && (key.includes(raceKey) || raceKey.includes(key)))
                );
                if(candidateKeys.length === 1) {
                    elements = allElements.filter(element =>
                        getCountyKey(element) === candidateKeys[0]);
                }
            }
            if(!elements.length) return null;
            const countyKey = getCountyKey(elements[0]);
            const displayName = getCountyDisplayName(elements[0]);
            const countyRace = requestedRace || findCountyRace(
                countyKey,
                displayName,
                countyRaceMap
            );
            const simulation = buildCountySimulation(
                countyKey,
                displayName,
                elements,
                countyRace
            );
            if(!simulation) return null;
            return applySimulationRatings(new Map([[countyKey, simulation]]));
        };

        const renderCountyDetail = (countyKey, simulations) => {
            const simulation = simulations.get(countyKey);
            if(!simulation) return;
            const renderToken = ++detailRenderToken;
            detailCountyKey = countyKey;
            zoom = 1;
            panX = 0;
            panY = 0;
            zoomAnchor = null;
            const precinctButton = document.getElementById("eNightPrecinctsB");
            precinctButton?.style.setProperty("display", "none", "important");
            document.getElementById("bm-precincts-rcv-button")
                ?.style.setProperty("display", "none", "important");
            if(context.nativeReturnButton) {
                context.nativeReturnButton.style.setProperty("display", "none", "important");
            }
            hideTooltip();
            requestAnimationFrame(() => {
                if(
                    renderToken !== detailRenderToken
                    || !active
                    || detailCountyKey !== countyKey
                ) return;
                try {
                    const sourceElements = simulation.precincts
                        .map(precinct => precinct.element)
                        .filter(Boolean);
                    removeTemporaryUi();
                    const svg = createCountySvg(
                        context.stateId,
                        countyKey,
                        sourceElements
                    );
                    if(!svg) throw new Error(`Could not load ${simulation.name}.`);
                    activeSvg = svg;
                    context.host.appendChild(svg);
                    activationPending = false;
                    context.svgMap.style.setProperty("display", "none", "important");
                    const precinctById = new Map(
                        simulation.precincts.map(precinct => [precinct.id, precinct])
                    );
                    const precinctByElement = new WeakMap();
                    const visibleElements = getPrecinctElements(svg);
                    visibleElements.forEach(element => {
                        const precinct = precinctById.get(element.id);
                        if(!precinct) return;
                        precinctByElement.set(element, precinct);
                        element.style.fill = precinct.rating.colour;
                        element.classList.add("bm-precinct-path", "bm-precinct-detail-path");
                        element.removeAttribute("tabindex");
                        element.setAttribute("focusable", "false");
                    });
                    const getEventPrecinct = target => {
                        const element = target?.closest?.(".bm-precinct-detail-path");
                        return element && svg.contains(element) ? element : null;
                    };
                    listen(svg, "mouseover", event => {
                        const element = getEventPrecinct(event.target);
                        const precinct = element && precinctByElement.get(element);
                        if(!precinct) return;
                        if(pinnedPrecinctId && pinnedPrecinctId !== precinct.id) {
                            pinnedPrecinctId = null;
                        }
                        element.classList.add("precinct-hover");
                        showTooltip(event, precinctTooltipData(simulation, precinct));
                    });
                    listen(svg, "mousemove", event => {
                        const element = getEventPrecinct(event.target);
                        const precinct = element && precinctByElement.get(element);
                        if(precinct) {
                            positionTooltip(event);
                        }
                    });
                    listen(svg, "mouseout", event => {
                        const element = getEventPrecinct(event.target);
                        const precinct = element && precinctByElement.get(element);
                        if(!precinct) return;
                        const relatedElement = getEventPrecinct(event.relatedTarget);
                        if(relatedElement === element) return;
                        element.classList.remove("precinct-hover");
                        if(!pinnedPrecinctId) hideTooltip();
                    });
                    listen(svg, "click", event => {
                        const element = getEventPrecinct(event.target);
                        const precinct = element && precinctByElement.get(element);
                        if(!precinct) return;
                        event.preventDefault();
                        event.stopPropagation();
                        pinnedPrecinctId = pinnedPrecinctId === precinct.id ? null : precinct.id;
                        showTooltip(event, precinctTooltipData(simulation, precinct));
                    });
                    cropToCounty(svg, visibleElements);
                    wrapZoomStage(svg);
                    installPan(svg);

                    const toolbar = document.createElement("div");
                    toolbar.id = "bm-precinct-county-toolbar";
                    const returnButton = document.createElement("button");
                    returnButton.id = "bm-precinct-return-state";
                    returnButton.type = "button";
                    returnButton.textContent = "Return to State Map";
                    returnButton.className = "eNightMarginB";

                    const nativeModeButton = getNeutralReturnStyleButton();
                    if(nativeModeButton) {
                        const nativeStyle = getComputedStyle(nativeModeButton);
                        [
                            "font", "padding", "border", "border-radius", "background",
                            "color", "box-shadow", "line-height", "letter-spacing"
                        ].forEach(property => {
                            returnButton.style.setProperty(
                                property,
                                nativeStyle.getPropertyValue(property)
                            );
                        });
                    }
                    if(context.nativeReturnButtonSize) {
                        const returnButtonWidth = Math.max(
                            205,
                            context.nativeReturnButtonSize.width + 35
                        );
                        returnButton.style.setProperty(
                            "min-width",
                            `${returnButtonWidth}px`,
                            "important"
                        );
                        returnButton.style.setProperty(
                            "width",
                            `${returnButtonWidth}px`,
                            "important"
                        );
                        returnButton.style.setProperty("white-space", "nowrap", "important");
                        returnButton.style.setProperty(
                            "height",
                            `${context.nativeReturnButtonSize.height}px`,
                            "important"
                        );
                    }
                    listen(returnButton, "click", event => {
                        event.preventDefault();
                        event.stopPropagation();
                        options.playClick?.();
                        deactivate({
                            nextMode: getReturnMapMode()
                        });
                        options.refreshCountyMap?.();
                        positionButtonBesideProjections();
                    });
                    const countyTitle = document.createElement("div");
                    countyTitle.id = "bm-precinct-county-title";
                    const countyTitleLabel = document.createElement("span");
                    countyTitleLabel.textContent = "County:";
                    const countyTitleName = document.createElement("strong");
                    countyTitleName.textContent = String(simulation.name || "")
                        .replace(/\s+County$/i, "");
                    countyTitle.appendChild(countyTitleLabel);
                    countyTitle.appendChild(countyTitleName);
                    toolbar.appendChild(returnButton);
                    toolbar.appendChild(countyTitle);
                    context.host.appendChild(toolbar);
                    installZoomControls();
                    listen(window, "resize", schedulePrecinctOverlayPosition);
                    schedulePrecinctOverlayPosition();
                    setMapStatus(null);
                } catch(error) {
                    activationPending = false;
                    console.error("Precinct county could not be rendered", error);
                    setMapStatus(
                        `County precinct error: ${error?.message || String(error)}`,
                        true
                    );
                }
            });
        };

        const renderStateView = () => {
            const renderToken = ++detailRenderToken;
            const returningFromCountyDetail = detailCountyKey !== null;
            detailCountyKey = null;
            hideTooltip();
            document.getElementById("eNightPrecinctsB")
                ?.style.setProperty("display", "none", "important");
            document.getElementById("bm-precincts-rcv-button")
                ?.style.setProperty("display", "none", "important");
            context.nativeReturnButton
                ?.style.setProperty("display", "none", "important");
            if(returningFromCountyDetail) {
                context.svgMap?.style.setProperty("display", "none", "important");
            } else {
                context.svgMap?.style.removeProperty("display");
            }
            const cachedTemplate = svgTemplateCache.get(context.stateId);
            const cachedSignature = getStateSimulationSignature();
            const alreadyPainted = cachedTemplate
                && paintedStateCache.get(cachedTemplate) === cachedSignature;
            setMapStatus(alreadyPainted ? null : "Loading precinct results…");
            requestAnimationFrame(() => setTimeout(() => {
            if(
                renderToken !== detailRenderToken
                || !active
                || detailCountyKey !== null
            ) return;
            removeTemporaryUi({ preserveStatus: true });
            document.getElementById("eNightPrecinctsB")
                ?.style.setProperty("display", "none", "important");
            if(context.nativeReturnButton) {
                context.nativeReturnButton.style.setProperty("display", "none", "important");
            }
            const svg = createSvg(context.stateId);
            if(!svg) {
                activationPending = false;
                setMapStatus(`Could not load the ${context.stateId} precinct map.`, true);
                return;
            }
            activeSvg = svg;
            context.host.appendChild(svg);
            activationPending = false;
            context.svgMap.style.setProperty("display", "none", "important");
            const returnButton = document.createElement("button");
            returnButton.id = "bm-precinct-return-state";
            returnButton.type = "button";
            returnButton.textContent = "Return to State Map";
            returnButton.className = "eNightMarginB";
            const nativeModeButton = getNeutralReturnStyleButton();
            if(nativeModeButton) {
                const nativeStyle = getComputedStyle(nativeModeButton);
                [
                    "font", "padding", "border", "border-radius", "background",
                    "color", "box-shadow", "line-height", "letter-spacing"
                ].forEach(property => {
                    returnButton.style.setProperty(
                        property,
                        nativeStyle.getPropertyValue(property)
                    );
                });
            }
            if(context.nativeReturnButtonSize) {
                const returnButtonWidth = Math.max(
                    205,
                    context.nativeReturnButtonSize.width + 35
                );
                returnButton.style.setProperty(
                    "min-width",
                    `${returnButtonWidth}px`,
                    "important"
                );
                returnButton.style.setProperty(
                    "width",
                    `${returnButtonWidth}px`,
                    "important"
                );
                returnButton.style.setProperty("white-space", "nowrap", "important");
                returnButton.style.setProperty(
                    "height",
                    `${context.nativeReturnButtonSize.height}px`,
                    "important"
                );
            }
            listen(returnButton, "click", event => {
                event.preventDefault();
                event.stopPropagation();
                options.playClick?.();
                deactivate({
                    nextMode: getReturnMapMode()
                });
                options.refreshCountyMap?.();
                positionButtonBesideProjections();
            });
            context.host.appendChild(returnButton);
            listen(window, "resize", schedulePrecinctOverlayPosition);
            schedulePrecinctOverlayPosition();
            requestAnimationFrame(() => {
                if(!active || activeSvg !== svg || !svg.isConnected) return;
                try {
                    inferMissingCountyMetadata(svg);
                    const simulations = buildSimulations(svg);
                    const precinctByElement = new WeakMap();
                    simulations.forEach(simulation => {
                        simulation.precincts.forEach(precinct => {
                            if(precinct.element) {
                                precinctByElement.set(precinct.element, precinct);
                            }
                        });
                    });
                    const elements = getPrecinctElements(svg);
                    let elementIndex = 0;
                    let matchedCount = 0;
                    const finishRender = (paintingComplete = false) => {
                        if(!paintingComplete) return;
                        if(matchedCount === 0) {
                            throw new Error("No precinct could be matched to an official county result.");
                        }
                        setMapStatus(null);
                    };
                    finishRender();
                    if(paintedStateCache.get(svg) === getStateSimulationSignature()) {
                        matchedCount = elements.reduce(
                            (count, element) =>
                                count + (precinctByElement.has(element) ? 1 : 0),
                            0
                        );
                        finishRender(true);
                        return;
                    }
                    const paintNextChunk = () => {
                        if(!active || activeSvg !== svg || !svg.isConnected) return;
                        try {
                            const chunkEnd = Math.min(elements.length, elementIndex + 600);
                            for(; elementIndex < chunkEnd; elementIndex++) {
                                const element = elements[elementIndex];
                                const precinct = precinctByElement.get(element);
                                if(!precinct) {
                                    element.style.fill = "#d2d2d2";
                                    element.classList.add("bm-precinct-unmatched");
                                    continue;
                                }
                                element.classList.remove(
                                    "bm-precinct-unmatched",
                                    "county-hover",
                                    "precinct-hover"
                                );
                                element.style.fill = precinct.rating.colour;
                                element.classList.add("bm-precinct-path");
                                matchedCount++;
                            }
                            if(elementIndex < elements.length) {
                                setMapStatus(
                                    `Loading precinct results… ${Math.round((elementIndex / elements.length) * 100)}%`
                                );
                                requestAnimationFrame(paintNextChunk);
                                return;
                            }
                            paintedStateCache.set(svg, getStateSimulationSignature());
                            finishRender(true);
                        } catch(error) {
                            console.error("Precinct results could not be rendered", error);
                            setMapStatus(
                                `Precinct map error: ${error?.message || String(error)}`,
                                true
                            );
                        }
                    };
                    paintNextChunk();
                } catch(error) {
                    console.error("Precinct results could not be rendered", error);
                    setMapStatus(
                        `Precinct map error: ${error?.message || String(error)}`,
                        true
                    );
                }
            });
            }, alreadyPainted ? 0 : 80));
        };

        const activateDirectCounty = countyIdentifier => {
            const sourceMode = options.getActiveMapMode?.() || "";
            activeRaceVariant = /-rcv$/.test(sourceMode)
                ? "rcv"
                : "normal";
            if(!context || active || !isFullyReported(getActiveRace(), context.live)) return;
            options.deactivateTurnout?.();
            options.hideNativeTooltip?.();
            const selectedNativeView = context.nativeViewControls?.querySelector(
                ".bm-primary-county-view-active[data-primary-county-view]"
            );
            nativeViewModeBeforePrecincts = sourceMode
                || selectedNativeView?.dataset.mapMode
                || (selectedNativeView?.dataset.primaryCountyView === "projections"
                    ? "winner"
                    : "margin");
            active = true;
            activationPending = true;
            options.onActiveChange?.(true);
            options.setActiveMapMode?.(
                activeRaceVariant === "rcv" ? "precincts-rcv" : "precincts"
            );
            document.body?.classList.add("bm-precinct-mode-active");
            setPrecinctHostActive(true);
            context.nativeViewControls
                ?.querySelectorAll("[data-map-mode], [data-primary-county-view]")
                .forEach(button => {
                    button.classList.remove("bm-primary-county-view-active");
                    button.style.setProperty("display", "none", "important");
                });
            document.getElementById("eNightPrecinctsB")
                ?.style.setProperty("display", "none", "important");
            document.getElementById("bm-precincts-rcv-button")
                ?.style.setProperty("display", "none", "important");
            setMapStatus("Loading county precincts…");
            const activationContext = context;
            requestAnimationFrame(() => setTimeout(() => {
                const stillSameMap = active
                    && context
                    && context.stateId === activationContext.stateId
                    && context.electionType === activationContext.electionType;
                if(!stillSameMap) {
                    activationPending = false;
                    return;
                }
                try {
                    const simulations = buildDirectCountySimulations(countyIdentifier);
                    const countyKey = simulations?.keys().next().value;
                    if(!countyKey) {
                        throw new Error(`No precinct data found for ${countyIdentifier}.`);
                    }
                    options.playClick?.();
                    renderCountyDetail(countyKey, simulations);
                } catch(error) {
                    console.error("Direct precinct county entry failed", error);
                    deactivate();
                }
            }, 0));
        };

        const ensureDirectCountyClicks = () => {
            if(!context?.svgMap || active) return;
            context.svgMap.querySelectorAll(".better-maps-state-path").forEach(element => {
                if(directCountyClickBound.has(element)) return;
                directCountyClickBound.add(element);
                element.addEventListener("click", event => {
                    if(active || !context || context.svgMap !== element.ownerSVGElement) return;
                    const countyIdentifier = element.getAttribute("data-county-name")
                        || element.getAttribute("data-county")
                        || String(element.id || "")
                            .replace(/-state-path(?:-live)?$/, "")
                            .replace(/_/g, " ");
                    if(!countyIdentifier) return;
                    event.preventDefault();
                    event.stopPropagation();
                    activateDirectCounty(countyIdentifier);
                });
            });
        };

        const activate = () => {
            activeRaceVariant = "normal";
            if(!context || !isFullyReported(getActiveRace(), context.live)) return;
            options.deactivateTurnout?.();
            options.hideNativeTooltip?.();
            const selectedNativeView = context.nativeViewControls?.querySelector(
                ".bm-primary-county-view-active[data-primary-county-view]"
            );
            nativeViewModeBeforePrecincts = selectedNativeView?.dataset.mapMode
                || (selectedNativeView?.dataset.primaryCountyView === "projections"
                    ? "winner"
                    : "margin");
            active = true;
            activationPending = true;
            options.onActiveChange?.(true);
            options.setActiveMapMode?.("precincts");
            document.body?.classList.add("bm-precinct-mode-active");
            setPrecinctHostActive(true);
            context.nativeViewControls
                ?.querySelectorAll("[data-map-mode], [data-primary-county-view]")
                .forEach(button => {
                    button.classList.remove("bm-primary-county-view-active");
                    button.style.setProperty("display", "none", "important");
                });
            const button = document.getElementById("eNightPrecinctsB");
            if(button) {
                button.className = "bm-precinct-active";
                button.style.setProperty("display", "none", "important");
            }
            renderStateView();
        };

        const activateRcv = () => {
            if(!context?.rcvRace || active) return;
            activeRaceVariant = "rcv";
            if(!isFullyReported(getActiveRace(), context.live)) {
                activeRaceVariant = "normal";
                return;
            }
            options.deactivateTurnout?.();
            options.hideNativeTooltip?.();
            nativeViewModeBeforePrecincts = "winner-rcv";
            active = true;
            activationPending = true;
            options.onActiveChange?.(true);
            options.setActiveMapMode?.("precincts-rcv");
            document.body?.classList.add("bm-precinct-mode-active");
            setPrecinctHostActive(true);
            context.nativeViewControls
                ?.querySelectorAll("[data-map-mode], [data-primary-county-view]")
                .forEach(button => {
                    button.classList.remove("bm-primary-county-view-active");
                    button.style.setProperty("display", "none", "important");
                });
            document.getElementById("eNightPrecinctsB")
                ?.style.setProperty("display", "none", "important");
            document.getElementById("bm-precincts-rcv-button")
                ?.style.setProperty("display", "none", "important");
            renderStateView();
        };

        const toggle = () => {
            if(active) deactivate();
            else activate();
            positionButtonBesideProjections();
        };

        const ensureButton = () => {
            let button = document.getElementById("eNightPrecinctsB");
            if(context?.suppressEntryButton) {
                button?.remove();
                return;
            }
            if(!button) {
                button = document.createElement("button");
                button.id = "eNightPrecinctsB";
                button.type = "button";
                button.textContent = "Precincts";
            }
            button.dataset.mapMode = "precincts";
            button.className = active && activeRaceVariant === "normal"
                ? "bm-precinct-active"
                : "";
            if(button.parentElement !== context.host) {
                context.host.insertBefore(button, context.svgMap);
            }
            positionButtonBesideProjections();
            requestAnimationFrame(positionButtonBesideProjections);
            setTimeout(positionButtonBesideProjections, 0);
            const runButtonAction = event => {
                event.preventDefault();
                event.stopPropagation();
                const now = Date.now();
                if(now - lastButtonActionAt < 350) return;
                lastButtonActionAt = now;
                try {
                    options.playClick?.();
                    toggle();
                } catch(error) {
                    console.error("Precincts mode failed", error);
                    setMapStatus(
                        `Precinct activation error: ${error?.message || String(error)}`,
                        true
                    );
                }
            };
            button.onpointerdown = null;
            button.onmousedown = runButtonAction;
            button.onclick = runButtonAction;
        };

        const ensureRcvButton = () => {
            let button = document.getElementById("bm-precincts-rcv-button");
            if(!context?.rcvRace || context?.suppressEntryButton) {
                button?.remove();
                return;
            }
            if(!button) {
                button = document.createElement("button");
                button.id = "bm-precincts-rcv-button";
                button.type = "button";
                button.textContent = "Precincts RCV";
            }
            button.dataset.mapMode = "precincts-rcv";
            button.className = options.getActiveMapMode?.() === "precincts-rcv"
                ? "bm-primary-county-view-active"
                : "";
            const controls = context.nativeViewControls;
            const reference = controls?.querySelector("[data-primary-county-view='projections']");
            if(controls && button.parentElement !== controls) {
                controls.insertBefore(button, reference || controls.firstChild);
            }
            if(reference) {
                const style = getComputedStyle(reference);
                ["font", "padding", "border", "border-radius", "background", "color", "box-shadow"]
                    .forEach(property => button.style.setProperty(
                        property,
                        style.getPropertyValue(property)
                    ));
            }
            button.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                options.playClick?.();
                activateRcv();
            };
        };

        const sync = nextContext => {
            const stateId = String(nextContext?.stateId || "").toUpperCase();
            const supported = nextContext?.onCountyMap === true
                && SUPPORTED_ELECTIONS.has(nextContext?.electionType)
                && nextContext?.isPrimary !== true
                && stateId !== "US"
                && isFullyReported(nextContext?.race, nextContext?.live)
                && Boolean(nextContext?.svgMap?.isConnected)
                && Boolean(nextContext?.host);
            const fileAvailable = supported && fs.existsSync(getSvgPath(stateId));
            if(!fileAvailable) {
                deactivate({ removeButton: true });
                context = null;
                return false;
            }
            const changed = context
                && (
                    context.stateId !== stateId
                    || context.electionType !== nextContext.electionType
                    || context.svgMap !== nextContext.svgMap
                );
            if(changed) deactivate({ removeButton: true });
            const nativeReturnButton = nextContext.host.querySelector(
                "#eNightReturnB, #ePageReturnB, #ePageReturnB2"
            );
            const nativeReturnBounds = nativeReturnButton?.getBoundingClientRect();
            context = {
                ...nextContext,
                stateId,
                host: nextContext.host,
                nativeReturnButton,
                nativeReturnButtonSize: nativeReturnBounds?.width > 0
                    && nativeReturnBounds?.height > 0
                    ? {
                        width: nativeReturnBounds.width,
                        height: nativeReturnBounds.height
                    }
                    : (context?.nativeReturnButtonSize || null),
                nativeViewControls: nextContext.nativeViewControls
                    || nextContext.host.querySelector(
                        "#bm-primary-county-view-controls, #bm-city-mayor-map-controls"
                    )
            };
            if(active && activeRaceVariant === "rcv" && !context.rcvRace) {
                deactivate({ nextMode: "margin" });
                options.refreshCountyMap?.();
            }
            if(
                context.nativeReturnButton
                && context.nativeReturnButton.dataset.bmPrecinctCleanupBound !== "true"
            ) {
                context.nativeReturnButton.dataset.bmPrecinctCleanupBound = "true";
                context.nativeReturnButton.addEventListener("click", () => {
                    deactivate({ removeButton: true });
                }, true);
            }

            if(active && !activationPending && !activeSvg?.isConnected) {
                deactivate({ nextMode: getReturnMapMode() });
            }

            ensureButton();
            ensureRcvButton();
            ensureDirectCountyClicks();
            if(active) {
                document.getElementById("eNightPrecinctsB")
                    ?.style.setProperty("display", "none", "important");
                document.getElementById("bm-precincts-rcv-button")
                    ?.style.setProperty("display", "none", "important");
                if(activeSvg?.isConnected) {
                    context.svgMap.style.setProperty("display", "none", "important");
                }
                context.nativeViewControls
                    ?.querySelectorAll("[data-map-mode], [data-primary-county-view]")
                    .forEach(button => {
                        button.classList.remove("bm-primary-county-view-active");
                        button.style.setProperty("display", "none", "important");
                    });
            }
            return true;
        };

        const destroy = () => {
            deactivate({ removeButton: true });
            context = null;
        };

        const validateCurrentCountyTotals = () => {
            if(!activeSvg || !context) return [];
            return Array.from(buildSimulations(activeSvg).values()).map(simulation => {
                const expected = new Map(simulation.candidates.map(candidate => [
                    `${candidate.name}|${candidate.party}`,
                    candidate.votes
                ]));
                const actual = new Map();
                simulation.precincts.forEach(precinct => {
                    precinct.candidates.forEach(candidate => {
                        const key = `${candidate.name}|${candidate.party}`;
                        actual.set(key, (actual.get(key) || 0) + candidate.votes);
                    });
                });
                return {
                    county: simulation.name,
                    exact: Array.from(expected.entries()).every(
                        ([key, votes]) => actual.get(key) === votes
                    )
                };
            });
        };

        return {
            sync,
            destroy,
            deactivate,
            activate,
            activateRcv,
            toggle,
            isActive: () => active,
            validateCurrentCountyTotals
        };
    };

    module.exports = {
        createPrecinctResultsController,
        normalizeCountyJurisdictionKey: getCountyJurisdictionKey,
        countyKeysEquivalent
    };
}