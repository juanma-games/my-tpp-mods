"use strict";


const createVotingBooth = (options = {}) => {
    const OVERLAY_ID = "bm-voting-booth";

    let overlay = null;
    let ballot = null;
    let selections = new Map();
    let rankings = new Map();
    let lastCycleKey = "";
    let installed = false;

    const readRuntimeValue = name => {
        if(typeof globalThis !== "undefined" && globalThis[name] !== undefined) {
            return globalThis[name];
        }
        try {
            return (0, eval)(name);
        } catch {
            return undefined;
        }
    };

    const playClick = () => {
        try { options.playClick?.(); } catch {}
    };


    let resumeSpeedIndex = -1;
    let pauseRetryTimer = null;

    const getSpeedButtons = () => Array.from(document.querySelectorAll(
        "#electNightSpeedDiv .eNightSpeedCnvAct, #electNightSpeedDiv .eNightSpeedCnvInA"
    ));

    const pausePlayback = () => {
        const buttons = getSpeedButtons();
        if(buttons.length === 0) return false;
        const activeIndex = buttons.findIndex(button =>
            button.classList.contains("eNightSpeedCnvAct")
        );
        if(activeIndex <= 0) return true;
        resumeSpeedIndex = activeIndex;
        try { buttons[0].click(); } catch {}
        return true;
    };

    const pausePlaybackWhenReady = () => {
        if(pausePlayback()) return;
        let attempts = 0;
        clearInterval(pauseRetryTimer);
        pauseRetryTimer = setInterval(() => {
            attempts++;
            if(pausePlayback() || attempts > 20 || !overlay) {
                clearInterval(pauseRetryTimer);
                pauseRetryTimer = null;
            }
        }, 50);
    };

    const resumePlayback = () => {
        clearInterval(pauseRetryTimer);
        pauseRetryTimer = null;
        if(resumeSpeedIndex < 0) return;
        const buttons = getSpeedButtons();
        try { buttons[resumeSpeedIndex]?.click(); } catch {}
        resumeSpeedIndex = -1;
    };

    const getObjectLabel = value => {
        if(value === null || value === undefined) return "";
        if(typeof value === "string") return value.trim();
        if(typeof value === "number") return String(value);
        if(typeof value === "object") {
            for(const key of ["name", "countyName", "label", "title", "id", "county", "stateId"]) {
                try {
                    const nested = value[key];
                    if(typeof nested === "string" && nested.trim()) return nested.trim();
                    if(typeof nested === "number") return String(nested);
                } catch {}
            }
        }
        return "";
    };

    const getCurrentYear = () => {
        const year = Number(options.getCurrentYear?.() ?? readRuntimeValue("currentYear"));
        return Number.isFinite(year) ? year : null;
    };


    const getRawPlayerCharacter = () => {
        const characters = (() => {
            try { return Executive?.data?.characters; } catch { return null; }
        })();
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

    const getPlayerCharacterArray = () => {
        const raw = getRawPlayerCharacter();
        if(Array.isArray(raw)) return raw;
        for(const key of ["characterArray", "character", "candArray", "array", "data"]) {
            try {
                if(Array.isArray(raw?.[key])) return raw[key];
            } catch {}
        }
        return null;
    };

    const getPlayerSources = () => {
        const sources = [];
        let player = null;
        try { player = Executive?.data?.characters?.player || null; } catch {}
        const raw = getRawPlayerCharacter();
        if(raw && raw !== player && typeof raw === "object" && !Array.isArray(raw)) {
            sources.push(raw);
        }
        if(player) {
            sources.push(player);
            ["extendedAttribs", "residence", "location", "home", "character", "data"]
                .forEach(key => {
                    try {
                        const nested = player[key];
                        if(nested && typeof nested === "object") sources.push(nested);
                    } catch {}
                });
        }
        return sources;
    };

    const readPlayerField = (propertyNames, enumNames, fallbackSlots = []) => {
        const sources = getPlayerSources();
        for(const source of sources) {
            for(const name of propertyNames) {
                try {
                    const value = source?.[name];
                    if(value !== undefined && value !== null && String(value).trim() !== "") {
                        return value;
                    }
                } catch {}
            }
        }
        const characterArray = getPlayerCharacterArray();
        if(!Array.isArray(characterArray)) return null;
        const candidateEnum = (() => {
            try { return Executive?.enums?.characterArray?.candidate || {}; } catch { return {}; }
        })();
        const slots = [
            ...enumNames.map(name => candidateEnum[name]),
            ...fallbackSlots
        ];
        for(const slot of slots) {
            if(!Number.isInteger(slot)) continue;
            try {
                const value = characterArray[slot];
                if(value !== undefined && value !== null && String(value).trim() !== "") {
                    return value;
                }
            } catch {}
        }
        return null;
    };


    const PROFILE_CACHE_KEY = "better-maps-voting-booth-player-profile";
    const PROFILE_LABELS = {
        county: /^county$/i,
        stateId: /^state$/i,
        congressionalDistrict: /^congressional district$/i,
        stateHouseDistrict: /^state house district$/i,
        stateSenateDistrict: /^state senate district$/i
    };
    let cachedProfile = null;
    let profileScrapeTimer = null;
    let electionNightWatchTimer = null;

    const scrapePlayerProfilePage = () => {
        let cells = [];
        try { cells = Array.from(document.querySelectorAll("td, th")); } catch { return null; }
        if(cells.length === 0) return null;
        const found = {};
        cells.forEach(cell => {
            const label = String(cell.textContent || "").replace(/\s+/g, " ").trim();
            if(!label) return;
            const valueCell = cell.nextElementSibling;
            if(!valueCell) return;
            const value = String(valueCell.textContent || "").replace(/\s+/g, " ").trim();
            if(!value) return;
            Object.entries(PROFILE_LABELS).forEach(([key, pattern]) => {
                if(found[key] === undefined && pattern.test(label)) found[key] = value;
            });
        });
        const hasDistrict = ["congressionalDistrict", "stateHouseDistrict", "stateSenateDistrict"]
            .some(key => found[key] !== undefined);
        return hasDistrict ? found : null;
    };

    const rememberPlayerProfile = () => {
        const scraped = scrapePlayerProfilePage();
        if(!scraped) return null;
        cachedProfile = scraped;
        try {
            globalThis.localStorage?.setItem(PROFILE_CACHE_KEY, JSON.stringify(scraped));
        } catch {}
        return scraped;
    };

    const getCachedPlayerProfile = () => {
        if(cachedProfile) return cachedProfile;
        try {
            const stored = globalThis.localStorage?.getItem(PROFILE_CACHE_KEY);
            if(stored) cachedProfile = JSON.parse(stored);
        } catch {}
        return cachedProfile;
    };

    const classifyDistrictKey = (key, districtNumber, found) => {
        if(!Number.isFinite(districtNumber)) return;
        const lower = String(key).toLowerCase();
        if(/cong|ushouse|usrep|federal/.test(lower)) {
            if(found.congressional === undefined) found.congressional = districtNumber;
        } else if(/statesen|stsen|senate|upper/.test(lower)) {
            if(found.stateSenate === undefined) found.stateSenate = districtNumber;
        } else if(/statehouse|sthouse|house|assembly|rep|lower/.test(lower)) {
            if(found.stateHouse === undefined) found.stateHouse = districtNumber;
        }
    };

    const collectPlayerDistricts = () => {
        const found = {};
        const characterArray = getPlayerCharacterArray();
        if(Array.isArray(characterArray)) {
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            Object.keys(candidateEnum).forEach(name => {
                if(!/dist/i.test(name)) return;
                const slot = candidateEnum[name];
                if(!Number.isInteger(slot)) return;
                let value = null;
                try { value = parseDistrictNumber(getObjectLabel(characterArray[slot]) || characterArray[slot]); } catch {}
                classifyDistrictKey(name, value, found);
            });
        }
        getPlayerSources().forEach(source => {
            let keys = [];
            try { keys = Object.keys(source || {}); } catch {}
            keys.forEach(key => {
                if(!/dist/i.test(key)) return;
                let districtNumber = null;
                try { districtNumber = parseDistrictNumber(getObjectLabel(source[key]) || source[key]); } catch {}
                classifyDistrictKey(key, districtNumber, found);
            });
        });
        return found;
    };

    const normalizeStateId = value => {
        const raw = String(value ?? "").trim();
        if(!raw) return "";
        const upper = raw.toUpperCase();
        try {
            if(Executive?.data?.states?.[upper.toLowerCase()]) return upper;
            const match = Object.entries(Executive?.data?.states || {}).find(([key, state]) =>
                String(state?.name || "").toLowerCase() === raw.toLowerCase()
                || key.toLowerCase() === raw.toLowerCase()
            );
            if(match) return String(match[0]).toUpperCase();
        } catch {}
        return upper.length === 2 ? upper : "";
    };

    const parseDistrictNumber = value => {
        const direct = Number(value);
        if(Number.isFinite(direct) && direct > 0) return direct;
        const match = String(value ?? "").match(/(\d+)/);
        const parsed = Number(match?.[1]);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    const normalizePartyKey = value => {
        const compact = String(value ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
        if(compact.startsWith("DEMOCRAT") || compact === "D" || compact === "DEM") return "D";
        if(compact.startsWith("REPUBLIC") || compact === "R" || compact === "REP") return "R";
        return "";
    };

    const getPlayerPartyKey = () => {
        const direct = normalizePartyKey(getObjectLabel(readPlayerField(
            ["party", "partyKey", "partyId", "registration", "registeredParty"],
            ["party", "partyId"],
            [0]
        )));
        if(direct) return direct;
        const characterArray = getPlayerCharacterArray();
        if(Array.isArray(characterArray)) {
            for(let index = 0; index < Math.min(12, characterArray.length); index++) {
                const key = normalizePartyKey(characterArray[index]);
                if(key) return key;
            }
        }
        return "I";
    };

    const getPlayerProfile = () => {
        const stateId = normalizeStateId(getObjectLabel(readPlayerField(
            ["stateId", "stateID", "stateCode", "state", "homeState", "residenceState"],
            ["stateId", "state"],
            [127]
        )));
        const county = getObjectLabel(readPlayerField(
            ["countyName", "county", "countyId", "homeCounty", "residenceCounty"],
            ["countyName", "county", "countyId"],
            [128]
        )) || String(getCachedPlayerProfile()?.county || "").trim();
        const scanned = collectPlayerDistricts();
        const scraped = getCachedPlayerProfile() || {};
        const readDistrict = (propertyNames, enumNames, scannedValue, scrapedValue) =>
            parseDistrictNumber(scrapedValue)
            ?? parseDistrictNumber(getObjectLabel(readPlayerField(propertyNames, enumNames)))
            ?? scannedValue
            ?? null;
        const congressionalDistrict = readDistrict(
            ["congressionalDistrict", "usHouseDistrict", "congressDistrict", "cd"],
            ["congressionalDistrict", "usHouseDistrict"],
            scanned.congressional,
            scraped.congressionalDistrict
        );
        const stateHouseDistrict = readDistrict(
            ["stateHouseDistrict", "stHouseDistrict", "stateHouseDist"],
            ["stateHouseDistrict", "stHouseDistrict"],
            scanned.stateHouse,
            scraped.stateHouseDistrict
        );
        const stateSenateDistrict = readDistrict(
            ["stateSenateDistrict", "stSenateDistrict", "stateSenateDist"],
            ["stateSenateDistrict", "stSenateDistrict"],
            scanned.stateSenate,
            scraped.stateSenateDistrict
        );
        let name = "";
        try {
            const player = Executive?.data?.characters?.player;
            name = [player?.firstName, player?.lastName].filter(Boolean).join(" ")
                || String(player?.name || "").trim();
        } catch {}
        return {
            name,
            stateId,
            county,
            congressionalDistrict,
            stateHouseDistrict,
            stateSenateDistrict
        };
    };


    const raceOrdinalDistricts = new WeakMap();

    const getElections = globalName => {
        let source = null;
        try { source = readRuntimeValue(globalName); } catch { return []; }
        if(!source || typeof source !== "object") return [];
        const races = [];
        const pushAll = (collection, queue) => {
            collection.forEach((item, index) => queue.push({ node: item, ordinal: index }));
        };
        const queue = [];
        if(Array.isArray(source)) pushAll(source, queue);
        else queue.push({ node: source, ordinal: null });
        const visited = new Set();
        while(queue.length) {
            if(visited.size > 20000) break;
            const entry = queue.shift();
            const node = entry?.node;
            if(!node || typeof node !== "object" || visited.has(node)) continue;
            visited.add(node);
            const candidates = Array.isArray(node.cands)
                ? node.cands
                : (Array.isArray(node.candidates) ? node.candidates : null);
            const isPrimaryShaped = Array.isArray(node.dem?.cands)
                || Array.isArray(node.rep?.cands)
                || Array.isArray(node.allCands?.cands);
            if((candidates && candidates.length > 0) || isPrimaryShaped) {
                if(Number.isInteger(entry.ordinal)) {
                    raceOrdinalDistricts.set(node, entry.ordinal + 1);
                }
                races.push(node);
                continue;
            }
            let foundCollection = false;
            [
                node.elections, node.races, node.districts, node.states,
                node.results, node.stateHDistricts, node.stateSDistricts
            ].forEach(collection => {
                if(!Array.isArray(collection)) return;
                pushAll(collection, queue);
                foundCollection = true;
            });
            if(!foundCollection) {
                Object.entries(node).forEach(([key, value]) => {
                    if(!value || typeof value !== "object") return;
                    if(Array.isArray(value)) {
                        pushAll(value, queue);
                        return;
                    }
                    const keyDistrict = parseDistrictNumber(key);
                    queue.push({ node: value, ordinal: keyDistrict ? keyDistrict - 1 : null });
                });
            }
        }
        return races;
    };

    const discoverElectionGlobals = patterns => {
        let keys = [];
        try { keys = Object.keys(globalThis); } catch { return []; }
        return keys.filter(key =>
            /^electNight/i.test(key) && patterns.some(pattern => pattern.test(key))
        );
    };

    const getElectionsFromAny = (explicitNames, patterns) => {
        for(const name of explicitNames) {
            const races = getElections(name);
            if(races.length) return races;
        }
        for(const name of discoverElectionGlobals(patterns)) {
            if(explicitNames.includes(name)) continue;
            const races = getElections(name);
            if(races.length) return races;
        }
        return [];
    };

    const OFFICE_SOURCES = {
        mayor: {
            names: ["electNightM", "electNightMayor"],
            patterns: [/^electNightM$/i, /mayor/i]
        },
        cityCouncil: {
            names: ["electNightCC", "electNightCityCouncil", "electNightCouncil"],
            patterns: [/council/i, /^electNightCC/i]
        },
        schoolBoard: {
            names: ["electNightSB", "electNightSchoolBoard", "electNightSchool"],
            patterns: [/school/i, /^electNightSB/i]
        },
        ballotMeasure: {
            names: ["electNightBM", "electNightBallotMeasure", "electNightMeasure", "electNightRef"],
            patterns: [/measure/i, /referend/i, /ballot/i, /^electNightBM/i]
        }
    };

    const getRaceDistrict = race => parseDistrictNumber(
        race?.district
        ?? race?.districtNumber
        ?? race?.districtNum
        ?? race?.dist
        ?? race?.seat
        ?? race?.name
    ) ?? (raceOrdinalDistricts.get(race) ?? null);

    const getElectionNightTabLabels = () => {
        try {
            const tabs = document.getElementById("electNightTabDiv");
            if(!tabs) return null;
            const labels = Array.from(tabs.querySelectorAll("button"))
                .map(button => String(button.innerText || button.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase())
                .filter(Boolean);
            return labels.length ? labels : null;
        } catch {
            return null;
        }
    };

    const isOfficeOnTheBallotThisCycle = (tabLabels, patterns) => {
        if(!patterns.length) return true;
        if(!tabLabels) return true;
        return tabLabels.some(label => patterns.some(pattern => pattern.test(label)));
    };

    const matchesState = (race, stateId) => {
        const raceState = String(
            race?.state ?? race?.stateId ?? race?.stateID ?? race?.stateCode ?? ""
        ).trim().toUpperCase();
        return raceState !== "" && raceState === String(stateId ?? "").toUpperCase();
    };

    const findStatewideRace = (globalName, stateId) => {
        if(!stateId) return null;
        return getElections(globalName).find(race => matchesState(race, stateId)) || null;
    };

    const findDistrictRace = (globalName, stateId, districtNumber, raceOptions = {}) => {
        if(!stateId) return null;
        const races = getElections(globalName);
        if(races.length === 0) return null;
        const stateRaces = races.filter(race => matchesState(race, stateId));
        const pool = stateRaces.length
            ? stateRaces
            : (raceOptions.playerStateOnly ? races : []);
        if(pool.length === 0) return null;
        if(Number.isFinite(districtNumber)) {
            const exact = pool.find(race => getRaceDistrict(race) === districtNumber);
            if(exact) return exact;
            if(raceOptions.playerStateOnly
                && pool.every(race => !Number.isFinite(getRaceDistrict(race)))
                && districtNumber <= pool.length) {
                return pool[districtNumber - 1];
            }
        }
        return pool.length === 1 ? pool[0] : null;
    };

    const getCandidateName = candidate => {
        const full = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ").trim();
        return full
            || String(candidate?.name || candidate?.fullName || "").replace(/\*+$/, "").trim()
            || "Unnamed candidate";
    };

    const getPartyLabel = (candidate, fallbackPartyKey = "", dumpShape = false) => {
        if(dumpShape) {
            try { options.debugCandidateShape?.(candidate); } catch {}
        }
        const fallback = String(fallbackPartyKey || "").trim().toUpperCase();
        let party = "";
        let caucus = "";
        try {
            const resolved = options.resolveCandidateParty?.(candidate, fallback);
            if(resolved?.party) {
                party = String(resolved.party).trim().toUpperCase();
                caucus = String(resolved.caucus || resolved.caucusParty || "")
                    .trim().charAt(0).toUpperCase();
            }
        } catch {}
        if(!party) {
            party = String(
                candidate?.party
                ?? candidate?.extendedAttribs?.party
                ?? ""
            ).trim().toUpperCase();
        }
        if(!caucus) {
            caucus = String(
                candidate?.caucus
                ?? candidate?.caucusParty
                ?? candidate?.extendedAttribs?.caucusParty
                ?? candidate?.extendedAttribs?.caucus
                ?? ""
            ).trim().charAt(0).toUpperCase();
        }
        if(!party) party = fallback;
        if(party.startsWith("D")) return "DEM";
        if(party.startsWith("R")) return "REP";
        if(party.startsWith("I") || party === "") {
            if(caucus === "D") return "IND-D";
            if(caucus === "R") return "IND-R";
            return "IND";
        }
        return party.slice(0, 5);
    };


    const RUNNING_MATE_KEY = /running.?mate|vice.?pres|^vp$/i;

    const readCharacterName = value => {
        if(!value || typeof value !== "object") return "";
        if(Array.isArray(value)) {
            let candidateEnum = {};
            try { candidateEnum = Executive?.enums?.characterArray?.candidate || {}; } catch {}
            const first = value[candidateEnum.firstName ?? 4];
            const last = value[candidateEnum.lastName ?? 5];
            if(typeof first !== "string" && typeof last !== "string") return "";
            return [first, last]
                .filter(part => typeof part === "string" && part.trim())
                .join(" ")
                .trim();
        }
        const first = value.firstName ?? value.first;
        const last = value.lastName ?? value.last;
        if(typeof first !== "string" && typeof last !== "string") return "";
        return [first, last]
            .filter(part => typeof part === "string" && part.trim())
            .join(" ")
            .trim();
    };

    const resolveTicketPartyKey = (candidate, fallbackPartyKey = "") => {
        let ticket = "";
        try {
            ticket = String(options.resolveTicketParty?.(candidate) || "").trim().toUpperCase();
        } catch {}
        if(ticket === "D" || ticket === "R") return ticket;
        const caucus = String(candidate?.caucusParty ?? candidate?.caucus ?? "")
            .trim().charAt(0).toUpperCase();
        if(caucus === "D" || caucus === "R") return caucus;
        const ownParty = String(candidate?.party ?? "").trim().charAt(0).toUpperCase();
        if(ownParty === "D" || ownParty === "R") return ownParty;
        return String(fallbackPartyKey || "").trim().toUpperCase();
    };

    const getRunningMateName = (candidate, ticketPartyKey) => {
        if(!candidate || typeof candidate !== "object") return "";
        const ownName = getCandidateName(candidate).toLowerCase();
        const isOtherPerson = name => Boolean(name) && name.toLowerCase() !== ownName;

        const namedSources = [candidate, candidate.source, candidate.candidate, candidate.character]
            .filter(source => source && typeof source === "object");
        for(const source of namedSources) {
            let keys = [];
            try { keys = Object.keys(source); } catch {}
            for(const key of keys) {
                if(!RUNNING_MATE_KEY.test(key)) continue;
                const value = source[key];
                const name = readCharacterName(value)
                    || (typeof value === "string" ? value.trim() : "");
                if(isOtherPerson(name)) return name;
            }
        }

        if(ticketPartyKey) {
            let name = "";
            try { name = String(options.getRunningMateForTicket?.(ticketPartyKey) || "").trim(); } catch {}
            if(isOtherPerson(name)) return name;
        }
        return "";
    };

    const isIncumbent = candidate => Boolean(
        candidate?.incumbent === true
        || candidate?.incumbent === 1
        || candidate?.extendedAttribs?.incumbent === true
    );

    const pickRaceFromPool = (races, stateId, districtNumber) => {
        if(races.length === 0) return null;
        const stateRaces = races.filter(race => matchesState(race, stateId));
        const pool = stateRaces.length ? stateRaces : races;
        if(Number.isFinite(districtNumber)) {
            const exact = pool.find(race => getRaceDistrict(race) === districtNumber);
            if(exact) return exact;
            if(pool.every(race => !Number.isFinite(getRaceDistrict(race)))
                && districtNumber <= pool.length) {
                return pool[districtNumber - 1];
            }
        }
        return pool.length === 1 ? pool[0] : null;
    };

    const getProvidedBallotMeasures = stateId => {
        try {
            const provided = options.getBallotMeasures?.(stateId);
            return Array.isArray(provided) ? provided : [];
        } catch {
            return [];
        }
    };

    const collectBallotMeasures = () => {
        const source = OFFICE_SOURCES.ballotMeasure;
        const names = [
            ...source.names,
            ...discoverElectionGlobals(source.patterns)
        ];
        const measures = [];
        const visited = new Set();
        names.forEach(name => {
            let root = null;
            try { root = readRuntimeValue(name); } catch { return; }
            if(!root || typeof root !== "object") return;
            const queue = [root];
            while(queue.length) {
                if(visited.size > 5000) break;
                const node = queue.shift();
                if(!node || typeof node !== "object" || visited.has(node)) continue;
                visited.add(node);
                const title = ["title", "name", "measureName", "question", "shortTitle"]
                    .map(key => (typeof node[key] === "string" ? node[key].trim() : ""))
                    .find(Boolean);
                const looksLikeMeasure = title && Object.keys(node).some(key => /^(?:yes|no)/i.test(key));
                if(looksLikeMeasure) {
                    measures.push(node);
                    continue;
                }
                Object.values(node).forEach(value => {
                    if(!value || typeof value !== "object") return;
                    if(Array.isArray(value)) queue.push(...value);
                    else queue.push(value);
                });
            }
        });
        return measures;
    };

    const buildMeasureContest = (measure, index) => {
        const title = ["title", "name", "measureName", "shortTitle"]
            .map(key => (typeof measure[key] === "string" ? measure[key].trim() : ""))
            .find(Boolean);
        if(!title) return null;
        const question = ["question", "description", "summary", "text"]
            .map(key => (typeof measure[key] === "string" ? measure[key].trim() : ""))
            .find(Boolean);
        return {
            key: `measure:${index}`,
            title,
            voteFor: question || "Vote for not more than 1",
            isMeasure: true,
            choices: [
                { id: `measure:${index}:yes`, name: "YES", party: "" },
                { id: `measure:${index}:no`, name: "NO", party: "" }
            ]
        };
    };

    const isPrimaryRace = race => Boolean(
        race
        && !Array.isArray(race.cands)
        && (
            Array.isArray(race.dem?.cands)
            || Array.isArray(race.rep?.cands)
            || Array.isArray(race.allCands?.cands)
        )
    );

    const hasPartisanPrimaryGroups = race => Boolean(
        (Array.isArray(race?.dem?.cands) && race.dem.cands.length)
        || (Array.isArray(race?.rep?.cands) && race.rep.cands.length)
    );

    const getPrimaryCandidates = (race, partyKey) => {
        if(!isPrimaryRace(race)) return { cands: [], groupParty: null };
        if(!hasPartisanPrimaryGroups(race)) {
            return {
                cands: Array.isArray(race.allCands?.cands) ? race.allCands.cands : [],
                groupParty: null
            };
        }
        const group = partyKey === "D" ? race.dem : (partyKey === "R" ? race.rep : null);
        return {
            cands: Array.isArray(group?.cands) ? group.cands : [],
            groupParty: group && Array.isArray(group.cands) && group.cands.length ? partyKey : null
        };
    };

    const buildContest = (key, title, race, voteFor = "Vote for not more than 1", contestOptions = {}) => {
        const primary = Array.isArray(race?.cands)
            ? { cands: race.cands, groupParty: null }
            : getPrimaryCandidates(race, contestOptions.primaryPartyKey);
        const candidates = primary.cands;
        if(candidates.length === 0) return null;
        const rankedChoice = Boolean(
            Array.isArray(race?.cands)
            && candidates.length > 1
            && contestOptions.electionType
            && (() => {
                try {
                    return options.isRankedChoiceRace?.(
                        contestOptions.electionType,
                        contestOptions.stateId,
                        race
                    );
                } catch {
                    return false;
                }
            })()
        );
        return {
            key,
            title,
            voteFor: rankedChoice
                ? "Rank the candidates in order of preference"
                : voteFor,
            isPrimary: !Array.isArray(race?.cands) && isPrimaryRace(race),
            primaryGroupParty: primary.groupParty,
            isRanked: rankedChoice,
            rankColumns: rankedChoice ? Math.min(candidates.length, 5) : 0,
            choices: candidates.map((candidate, index) => ({
                id: `${key}:${index}`,
                name: getCandidateName(candidate),
                party: getPartyLabel(candidate, primary.groupParty, index === 0),
                incumbent: isIncumbent(candidate),
                runningMate: contestOptions.withRunningMate
                    ? getRunningMateName(
                        candidate,
                        resolveTicketPartyKey(candidate, primary.groupParty)
                    )
                    : ""
            }))
        };
    };

    const buildBallot = () => {
        const profile = getPlayerProfile();
        const tabLabels = getElectionNightTabLabels();
        const primaryPartyKey = getPlayerPartyKey();
        const contests = [];
        const add = (patterns, contest) => {
            if(contest && isOfficeOnTheBallotThisCycle(tabLabels, patterns)) contests.push(contest);
        };

        const presidentialRace = findStatewideRace("electNightP", profile.stateId);
        const presidentialPrimary = isPrimaryRace(presidentialRace);
        add([/^president$/], buildContest(
            "president",
            presidentialPrimary
                ? "President of the United States"
                : "President and Vice President of the United States",
            presidentialRace,
            "Vote for not more than 1",
            { withRunningMate: !presidentialPrimary, primaryPartyKey }
        ));
        add([/^u\.?s\.? senate$/, /^senate$/], buildContest(
            "usSenate",
            "United States Senator",
            findStatewideRace("electNightUSS", profile.stateId),
            "Vote for not more than 1",
            { primaryPartyKey, electionType: "usSenate", stateId: profile.stateId }
        ));
        add([/^u\.?s\.? house$/, /^house$/], buildContest(
            "usHouse",
            `United States Representative, District ${profile.congressionalDistrict ?? "?"}`,
            findDistrictRace("electNightUSH", profile.stateId, profile.congressionalDistrict),
            "Vote for not more than 1",
            { primaryPartyKey, electionType: "usHouse", stateId: profile.stateId }
        ));
        add([/^governor$/], buildContest(
            "governor",
            "Governor",
            findStatewideRace("electNightG", profile.stateId),
            "Vote for not more than 1",
            { primaryPartyKey, electionType: "governor", stateId: profile.stateId }
        ));
        add([/^state senate$/], buildContest(
            "stateSenate",
            `State Senator, District ${profile.stateSenateDistrict ?? "?"}`,
            findDistrictRace(
                "electNightStS",
                profile.stateId,
                profile.stateSenateDistrict,
                { playerStateOnly: true }
            ),
            "Vote for not more than 1",
            { primaryPartyKey }
        ));
        add([/^state house$/], buildContest(
            "stateHouse",
            `State Representative, District ${profile.stateHouseDistrict ?? "?"}`,
            findDistrictRace(
                "electNightStH",
                profile.stateId,
                profile.stateHouseDistrict,
                { playerStateOnly: true }
            ),
            "Vote for not more than 1",
            { primaryPartyKey }
        ));
        add([/^mayor$/], buildContest(
            "mayor",
            "Mayor",
            pickRaceFromPool(
                getElectionsFromAny(OFFICE_SOURCES.mayor.names, OFFICE_SOURCES.mayor.patterns),
                profile.stateId,
                null
            ),
            "Vote for not more than 1",
            { primaryPartyKey }
        ));
        add([/^city council$/, /^council$/], buildContest(
            "cityCouncil",
            "City Council, District 1",
            pickRaceFromPool(
                getElectionsFromAny(
                    OFFICE_SOURCES.cityCouncil.names,
                    OFFICE_SOURCES.cityCouncil.patterns
                ),
                profile.stateId,
                1
            ),
            "Vote for not more than 1",
            { primaryPartyKey }
        ));
        add([/^school$/, /^school board$/], buildContest(
            "schoolBoard",
            "School Board, District 1",
            pickRaceFromPool(
                getElectionsFromAny(
                    OFFICE_SOURCES.schoolBoard.names,
                    OFFICE_SOURCES.schoolBoard.patterns
                ),
                profile.stateId,
                1
            ),
            "Vote for not more than 1",
            { primaryPartyKey }
        ));
        const hasPrimaryContests = contests.some(contest => contest.isPrimary);
        if(!hasPrimaryContests) {
            const seenMeasureTitles = new Set();
            [...getProvidedBallotMeasures(profile.stateId), ...collectBallotMeasures()]
                .filter(measure => {
                    const measureState = String(
                        measure?.state ?? measure?.stateId ?? measure?.stateCode ?? ""
                    ).trim().toUpperCase();
                    return !measureState || measureState === String(profile.stateId).toUpperCase();
                })
                .filter(measure => {
                    const title = String(measure?.title || measure?.name || "").trim().toLowerCase();
                    if(!title || seenMeasureTitles.has(title)) return false;
                    seenMeasureTitles.add(title);
                    return true;
                })
                .forEach((measure, index) => add([], buildMeasureContest(measure, index)));
        }

        const primaryContests = contests.filter(contest => contest.isPrimary);
        const partyLabels = { D: "Democratic Primary Election", R: "Republican Primary Election" };
        const everyContestIsOwnParty = primaryContests.length > 0
            && primaryContests.every(contest => contest.primaryGroupParty);
        const ballotKind = primaryContests.length === 0
            ? "General Election"
            : (everyContestIsOwnParty && partyLabels[primaryPartyKey]
                ? partyLabels[primaryPartyKey]
                : "Primary Election");
        return { profile, contests, ballotKind };
    };


    const escapeHtml = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const getElectionDayLabel = year => {
        if(!Number.isFinite(year)) return "";
        const november = new Date(year, 10, 1);
        const day = november.getDay();
        const firstMonday = 1 + ((8 - day) % 7);
        const electionDay = firstMonday + 1;
        return `November ${electionDay}, ${year}`;
    };

    const getStateName = stateId => {
        try {
            return Executive?.data?.states?.[String(stateId || "").toLowerCase()]?.name || stateId;
        } catch {
            return stateId;
        }
    };

    const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

    const renderRankedContest = contest => {
        const ranks = Array.from({ length: contest.rankColumns }, (_value, index) => index + 1);
        const contestRanks = rankings.get(contest.key) || new Map();
        return `
        <section class="bm-ballot-contest bm-ballot-ranked">
            <h3 class="bm-ballot-office">${escapeHtml(contest.title)}</h3>
            <p class="bm-ballot-votefor">Rank the candidates in order of preference</p>
            <table class="bm-ballot-rank-grid">
                <thead>
                    <tr>
                        <th scope="col"></th>
                        ${ranks.map(rank => `
                            <th scope="col">${escapeHtml(ORDINALS[rank - 1] || `${rank}th`)}</th>
                        `).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${contest.choices.map(choice => `
                        <tr>
                            <th scope="row">
                                <span class="bm-ballot-choice-name">${escapeHtml(choice.name)}</span>
                                ${choice.party
                                    ? `<span class="bm-ballot-choice-party">${escapeHtml(choice.party)}</span>`
                                    : ""}
                                ${choice.incumbent
                                    ? `<span class="bm-ballot-incumbent">(Incumbent)</span>`
                                    : ""}
                            </th>
                            ${ranks.map(rank => `
                                <td>
                                    <button type="button"
                                        class="bm-ballot-rank-cell${
                                            contestRanks.get(rank) === choice.id
                                                ? " bm-ballot-choice-selected"
                                                : ""
                                        }"
                                        data-rank-contest="${escapeHtml(contest.key)}"
                                        data-rank="${rank}"
                                        data-choice="${escapeHtml(choice.id)}"
                                        aria-label="${escapeHtml(choice.name)} ${escapeHtml(ORDINALS[rank - 1] || rank)}">
                                        <span class="bm-ballot-oval" aria-hidden="true"></span>
                                    </button>
                                </td>
                            `).join("")}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </section>
    `;
    };

    const renderContest = contest => contest.isRanked ? renderRankedContest(contest) : `
        <section class="bm-ballot-contest${contest.isMeasure ? " bm-ballot-measure" : ""}">
            <h3 class="bm-ballot-office">${escapeHtml(contest.title)}</h3>
            <p class="bm-ballot-votefor">${escapeHtml(contest.voteFor)}</p>
            <ul class="bm-ballot-choices">
                ${contest.choices.map(choice => `
                    <li>
                        <button type="button" class="bm-ballot-choice"
                            data-contest="${escapeHtml(contest.key)}"
                            data-choice="${escapeHtml(choice.id)}">
                            <span class="bm-ballot-oval" aria-hidden="true"></span>
                            <span class="bm-ballot-choice-names">
                                <span class="bm-ballot-choice-name">${escapeHtml(choice.name)}</span>
                                ${choice.runningMate
                                    ? `<span class="bm-ballot-running-mate">${escapeHtml(choice.runningMate)}</span>`
                                    : ""}
                            </span>
                            ${choice.party
                                ? `<span class="bm-ballot-choice-party">${escapeHtml(choice.party)}</span>`
                                : ""}
                            ${choice.incumbent
                                ? `<span class="bm-ballot-incumbent">(Incumbent)</span>`
                                : ""}
                        </button>
                    </li>
                `).join("")}
            </ul>
        </section>
    `;

    const renderBallotSheet = () => {
        const { profile, contests } = ballot;
        const year = getCurrentYear();
        const location = [profile.county, getStateName(profile.stateId)]
            .filter(Boolean)
            .join(", ");
        return `
            <div class="bm-ballot-sheet" role="document">
                <header class="bm-ballot-header">
                    <h1>Official Ballot</h1>
                    <p class="bm-ballot-subtitle">${escapeHtml(ballot.ballotKind || "General Election")}</p>
                    <p class="bm-ballot-place">${escapeHtml(location)}</p>
                    <p class="bm-ballot-date">${escapeHtml(getElectionDayLabel(year))}</p>
                </header>
                <p class="bm-ballot-instructions">
                    To vote, completely fill in the oval to the left of your choice.
                    You may leave any contest blank.
                </p>
                <div class="bm-ballot-columns">
                    ${contests.map(renderContest).join("")}
                </div>
                <footer class="bm-ballot-footer">
                    <span class="bm-ballot-progress"></span>
                    <button type="button" class="bm-ballot-button" data-action="review">
                        Review ballot
                    </button>
                </footer>
            </div>
        `;
    };

    const getChoiceById = (contest, choiceId) =>
        contest.choices.find(choice => choice.id === choiceId) || null;

    const renderReview = () => {
        const rows = ballot.contests.map(contest => {
            if(contest.isRanked) {
                const contestRanks = rankings.get(contest.key);
                const ordered = contestRanks
                    ? [...contestRanks.entries()]
                        .sort((first, second) => first[0] - second[0])
                        .map(([rank, id]) => `${rank}. ${getChoiceById(contest, id)?.name || ""}`)
                    : [];
                return `
                    <li class="${ordered.length ? "" : "bm-ballot-review-blank"}">
                        <span class="bm-ballot-review-office">${escapeHtml(contest.title)}</span>
                        <span class="bm-ballot-review-choice">${
                            ordered.length
                                ? escapeHtml(ordered.join("  ·  "))
                                : "No ranking made"
                        }</span>
                    </li>
                `;
            }
            const choiceId = selections.get(contest.key);
            const choice = choiceId ? getChoiceById(contest, choiceId) : null;
            const label = choice ? choice.name : "No selection made";
            return `
                <li class="${choiceId ? "" : "bm-ballot-review-blank"}">
                    <span class="bm-ballot-review-office">${escapeHtml(contest.title)}</span>
                    <span class="bm-ballot-review-choice">${escapeHtml(label)}</span>
                </li>
            `;
        }).join("");
        const blanks = ballot.contests.filter(contest => (
            contest.isRanked ? !rankings.has(contest.key) : !selections.get(contest.key)
        )).length;
        return `
            <div class="bm-ballot-sheet bm-ballot-review" role="document">
                <header class="bm-ballot-header">
                    <h1>Review Your Ballot</h1>
                    <p class="bm-ballot-subtitle">
                        ${blanks > 0
                            ? `You have left ${blanks} contest${blanks === 1 ? "" : "s"} blank.`
                            : "You have made a selection in every contest."}
                    </p>
                </header>
                <ul class="bm-ballot-review-list">${rows}</ul>
                <footer class="bm-ballot-footer">
                    <button type="button" class="bm-ballot-button bm-ballot-button-secondary"
                        data-action="back">Back to ballot</button>
                    <button type="button" class="bm-ballot-button" data-action="cast">
                        Cast ballot
                    </button>
                </footer>
            </div>
        `;
    };

    const renderCasting = () => `
        <div class="bm-ballot-sheet bm-ballot-casting" role="document">
            <div class="bm-ballot-scanner">
                <div class="bm-ballot-scanner-slot"></div>
                <div class="bm-ballot-scanner-paper"></div>
            </div>
            <p class="bm-ballot-scanner-status">Scanning ballot…</p>
        </div>
    `;

    const renderCast = () => `
        <div class="bm-ballot-sheet bm-ballot-cast" role="document">
            <div class="bm-ballot-sticker">I Voted</div>
            <h1>Your ballot has been cast</h1>
            <p class="bm-ballot-subtitle">Thank you for voting.</p>
            <footer class="bm-ballot-footer">
                <button type="button" class="bm-ballot-button" data-action="close">
                    Go to election night
                </button>
            </footer>
        </div>
    `;


    const updateProgress = () => {
        const progress = overlay?.querySelector(".bm-ballot-progress");
        if(!progress || !ballot) return;
        const marked = ballot.contests.filter(contest => (
            contest.isRanked ? rankings.has(contest.key) : selections.has(contest.key)
        )).length;
        progress.textContent = `${marked} of ${ballot.contests.length} contests marked`;
    };

    const paintSelections = () => {
        overlay?.querySelectorAll(".bm-ballot-choice").forEach(button => {
            const contestKey = button.dataset.contest;
            const isSelected = selections.get(contestKey) === button.dataset.choice;
            button.classList.toggle("bm-ballot-choice-selected", isSelected);
        });
        overlay?.querySelectorAll(".bm-ballot-rank-cell").forEach(cell => {
            const contestRanks = rankings.get(cell.dataset.rankContest);
            const isSelected = contestRanks?.get(Number(cell.dataset.rank)) === cell.dataset.choice;
            cell.classList.toggle("bm-ballot-choice-selected", Boolean(isSelected));
        });
        updateProgress();
    };

    const showBallot = () => {
        overlay.innerHTML = renderBallotSheet();
        paintSelections();
    };

    const close = () => {
        overlay?.remove();
        overlay = null;
        ballot = null;
        resumePlayback();
    };

    const castBallot = () => {
        overlay.innerHTML = renderCasting();
        setTimeout(() => {
            if(!overlay) return;
            overlay.innerHTML = renderCast();
        }, 2000);
    };

    const handleClick = event => {
        const rankCell = event.target?.closest?.(".bm-ballot-rank-cell");
        if(rankCell) {
            event.preventDefault();
            playClick();
            const contestKey = rankCell.dataset.rankContest;
            const rank = Number(rankCell.dataset.rank);
            const choiceId = rankCell.dataset.choice;
            const contestRanks = new Map(rankings.get(contestKey) || []);
            if(contestRanks.get(rank) === choiceId) {
                contestRanks.delete(rank);
            } else {
                [...contestRanks.entries()].forEach(([existingRank, existingChoice]) => {
                    if(existingChoice === choiceId) contestRanks.delete(existingRank);
                });
                contestRanks.set(rank, choiceId);
            }
            if(contestRanks.size) rankings.set(contestKey, contestRanks);
            else rankings.delete(contestKey);
            paintSelections();
            return;
        }
        const choiceButton = event.target?.closest?.(".bm-ballot-choice");
        if(choiceButton) {
            event.preventDefault();
            playClick();
            const contestKey = choiceButton.dataset.contest;
            const choiceId = choiceButton.dataset.choice;
            if(selections.get(contestKey) === choiceId) selections.delete(contestKey);
            else selections.set(contestKey, choiceId);
            paintSelections();
            return;
        }
        const actionButton = event.target?.closest?.("[data-action]");
        if(!actionButton) return;
        event.preventDefault();
        playClick();
        const action = actionButton.dataset.action;
        if(action === "review") overlay.innerHTML = renderReview();
        else if(action === "back") showBallot();
        else if(action === "cast") castBallot();
        else if(action === "close") close();
    };

    const open = () => {
        if(overlay) return false;
        const built = buildBallot();
        if(!built.profile.stateId || built.contests.length === 0) return false;
        ballot = built;
        selections = new Map();
        rankings = new Map();
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.addEventListener("click", handleClick);
        document.body.appendChild(overlay);
        showBallot();
        pausePlaybackWhenReady();
        return true;
    };

    const MAX_OPEN_ATTEMPTS = 20;
    let attemptedCycleKey = "";
    let openAttempts = 0;

    const openForElectionNight = () => {
        const year = getCurrentYear();
        const week = Number(readRuntimeValue("weekNum"));
        const cycleKey = `${year ?? ""}:${Number.isFinite(week) ? week : ""}`;
        if(cycleKey === ":" || cycleKey === lastCycleKey) return false;
        if(cycleKey !== attemptedCycleKey) {
            attemptedCycleKey = cycleKey;
            openAttempts = 0;
        }
        if(openAttempts >= MAX_OPEN_ATTEMPTS) return false;
        openAttempts++;
        const opened = open();
        if(opened) lastCycleKey = cycleKey;
        return opened;
    };

    const isElectionNightOnScreen = () => {
        try {
            return Boolean(
                document.getElementById("electNightTabDiv")
                || document.getElementById("electNightMainDiv")
            );
        } catch {
            return false;
        }
    };

    const watchForElectionNight = () => {
        if(!isElectionNightOnScreen()) return;
        openForElectionNight();
    };

    const install = () => {
        if(installed) return;
        installed = true;
        rememberPlayerProfile();
        profileScrapeTimer = setInterval(rememberPlayerProfile, 4000);
        electionNightWatchTimer = setInterval(watchForElectionNight, 350);
    };

    const destroy = () => {
        close();
        attemptedCycleKey = "";
        openAttempts = 0;
        clearInterval(profileScrapeTimer);
        profileScrapeTimer = null;
        clearInterval(electionNightWatchTimer);
        electionNightWatchTimer = null;
        installed = false;
        lastCycleKey = "";
    };

    return {
        install,
        open,
        openForElectionNight,
        close,
        destroy,
        isOpen: () => Boolean(overlay),
        buildBallot
    };
};

module.exports = {
    createVotingBooth
};
