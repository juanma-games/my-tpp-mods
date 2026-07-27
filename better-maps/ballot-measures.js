{
    const YES_COLOUR = "#ff5a0a";
    const NO_COLOUR = "#6559b5";
    const NEUTRAL_COLOUR = "#d7d7d7";
    const SVG_NS = "http://www.w3.org/2000/svg";

    const STATE_NAMES = {
        AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
        CA: "California", CO: "Colorado", CT: "Connecticut", DC: "Washington D.C.",
        DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii",
        ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
        KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
        MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
        MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
        NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
        NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
        OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
        SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
        UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
        WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
    };

    const MEASURE_CATALOGUE = [
        {
            id: "protect_abortion_rights",
            category: "Rights & Social Issues",
            title: "Protect the Right to Abortion",
            question: "Shall state law protect access to abortion and prohibit a statewide abortion ban?",
            description: "Repeals a statewide abortion prohibition and protects legal access to abortion.",
            supportKey: "ProChoice",
            priorityKey: "AbortPri",
            lawKey: "illegalAbortion",
            activeCheckLaws: [
                { key: "abortLaw.allowAll", value: true }
            ],
            extraLaws: [
                { key: "abortionRightsProtected", value: true },
                { key: "abortLaw", value: { allowAll: true, gestWeek: 40, waitPer: 0, ultraS: false, heartB: false, counsel: false, parNote: false, parConsent: false, except: { mLife: true, mHealth: true, assault: true, bDefect: true } } }
            ],
            lawValue: false,
            alignment: "D"
        },
        {
            id: "prohibit_abortion",
            category: "Rights & Social Issues",
            title: "Prohibit Abortion",
            question: "Shall state law prohibit abortion except where otherwise required by law?",
            description: "Establishes a statewide prohibition on abortion.",
            supportKey: "IllegalAbortion",
            priorityKey: "AbortPri",
            lawKey: "illegalAbortion",
            extraLaws: [
                { key: "abortionRightsProtected", value: false },
                { key: "abortLaw", value: { allowAll: false, gestWeek: 0, waitPer: 0, ultraS: false, heartB: false, counsel: false, parNote: false, parConsent: false, except: { mLife: true, mHealth: false, assault: false, bDefect: false } } }
            ],
            lawValue: true,
            alignment: "R"
        },
        {
            id: "legalize_marijuana",
            category: "Rights & Social Issues",
            title: "Legalize Cannabis Possession and Sale",
            question: "Shall possession and regulated sale of cannabis be legal for adults?",
            description: "Legalizes adult possession and regulated sale of cannabis.",
            supportKey: "RecUse",
            priorityKey: "CriPri",
            lawKey: "legalMarijuana",
            activeCheckLaws: [
                { key: "legalMarijuana", value: true }
            ],
            extraLaws: [
                { key: "legalMarijuanaPoss", value: true },
                { key: "legalMarijuanaSale", value: true },
                { key: "marijuanaTaxLaw", value: true }
            ],
            lawValue: true,
            alignment: "D"
        },
        {
            id: "prohibit_marijuana",
            category: "Rights & Social Issues",
            title: "Prohibit Cannabis Possession and Sale",
            question: "Shall possession and sale of recreational cannabis be prohibited?",
            description: "Repeals adult-use cannabis legalization.",
            supportKey: "RecUse",
            invertSupport: true,
            priorityKey: "CriPri",
            lawKey: "legalMarijuana",
            activeCheckLaws: [
                { key: "legalMarijuana", value: false }
            ],
            extraLaws: [
                { key: "legalMarijuanaPoss", value: false },
                { key: "legalMarijuanaSale", value: false },
                { key: "marijuanaTaxLaw", value: false }
            ],
            lawValue: false,
            alignment: "R"
        },
        {
            id: "expand_medicaid",
            category: "Health Care",
            title: "Medicaid Expansion",
            question: "Shall the state expand eligibility for Medicaid?",
            description: "Expands Medicaid eligibility under state law.",
            supportKey: "ExpandMedicaid",
            priorityKey: "HealthPri",
            lawKey: "medicaidExpansion",
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_medicaid_expansion",
            category: "Health Care",
            title: "Repeal Medicaid Expansion",
            question: "Shall the state's Medicaid expansion be repealed?",
            description: "Repeals Medicaid expansion under state law.",
            supportKey: "ExpandMedicaid",
            invertSupport: true,
            priorityKey: "HealthPri",
            lawKey: "medicaidExpansion",
            lawValue: false,
            alignment: "R"
        },
        {
            id: "universal_background_checks",
            category: "Guns",
            title: "Universal Background Checks",
            question: "Shall background checks be required for all firearm purchases in this state?",
            description: "Requires universal background checks for firearm purchases.",
            supportKey: "GunCheck",
            priorityKey: "GunPri",
            lawKey: "uniGunCheckLaw",
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_background_checks",
            category: "Guns",
            title: "Repeal Universal Background Checks",
            question: "Shall the state's universal firearm background-check requirement be repealed?",
            description: "Repeals the universal background-check requirement.",
            supportKey: "GunCheck",
            invertSupport: true,
            priorityKey: "GunPri",
            lawKey: "uniGunCheckLaw",
            lawValue: false,
            alignment: "R"
        },
        {
            id: "assault_weapons_ban",
            category: "Guns",
            title: "Assault Weapons Ban",
            question: "Shall assault weapons be prohibited under state law?",
            description: "Creates a statewide assault-weapons ban.",
            supportKey: "BanAssault",
            priorityKey: "GunPri",
            lawKey: "assaultGunBan",
            extraLaws: [
                { key: "assaultWeaponBan", value: true },
                { key: "assaultWeaponsBan", value: true },
                { key: "banAssaultWeapons", value: true }
            ],
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_assault_weapons_ban",
            category: "Guns",
            title: "Repeal Assault Weapons Ban",
            question: "Shall the state's assault-weapons ban be repealed?",
            description: "Repeals the statewide assault-weapons ban.",
            supportKey: "BanAssault",
            invertSupport: true,
            priorityKey: "GunPri",
            lawKey: "assaultGunBan",
            extraLaws: [
                { key: "assaultWeaponBan", value: false },
                { key: "assaultWeaponsBan", value: false },
                { key: "banAssaultWeapons", value: false }
            ],
            lawValue: false,
            alignment: "R"
        },
        {
            id: "handgun_ban",
            category: "Guns",
            title: "Handgun Ban",
            question: "Shall handguns be prohibited under state law?",
            description: "Creates a statewide handgun ban.",
            supportKey: "HandGunBan",
            priorityKey: "GunPri",
            lawKey: "handgunBanLaw",
            extraLaws: [
                { key: "handGunBanLaw", value: true },
                { key: "handgunBan", value: true }
            ],
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_handgun_ban",
            category: "Guns",
            title: "Repeal Handgun Ban",
            question: "Shall the state's handgun ban be repealed?",
            description: "Repeals the statewide handgun ban.",
            supportKey: "HandGunBan",
            invertSupport: true,
            priorityKey: "GunPri",
            lawKey: "handgunBanLaw",
            extraLaws: [
                { key: "handGunBanLaw", value: false },
                { key: "handgunBan", value: false }
            ],
            lawValue: false,
            alignment: "R"
        },
        {
            id: "ranked_choice_voting",
            category: "Elections & Democracy",
            title: "Ranked-Choice Voting",
            question: "Shall ranked-choice voting be used in applicable state elections?",
            description: "Adopts ranked-choice voting for applicable elections.",
            supportKey: "RankChoice",
            priorityKey: "GovPri",
            lawKey: "rankChoiceVoteLaw",
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_ranked_choice",
            category: "Elections & Democracy",
            title: "Repeal Ranked-Choice Voting",
            question: "Shall ranked-choice voting be repealed for state elections?",
            description: "Repeals ranked-choice voting.",
            supportKey: "RankChoice",
            invertSupport: true,
            priorityKey: "GovPri",
            lawKey: "rankChoiceVoteLaw",
            lawValue: false,
            alignment: "R"
        },
        {
            id: "voter_identification",
            category: "Elections & Democracy",
            title: "Voter ID Laws",
            question: "Shall voters be required to present identification before voting?",
            description: "Establishes a voter-identification requirement.",
            supportKey: "VoteID",
            priorityKey: "GovPri",
            lawKey: "voterIDLaw",
            extraLaws: [
                { key: "voterIDExcept", value: true }
            ],
            lawValue: true,
            alignment: "R"
        },
        {
            id: "repeal_voter_identification",
            category: "Elections & Democracy",
            title: "Repeal Voter ID Laws",
            question: "Shall the state's voter-identification requirement be repealed?",
            description: "Repeals the voter-identification requirement.",
            supportKey: "VoteID",
            invertSupport: true,
            priorityKey: "GovPri",
            lawKey: "voterIDLaw",
            extraLaws: [
                { key: "voterIDExcept", value: false }
            ],
            lawValue: false,
            alignment: "D"
        },
        {
            id: "mail_in_voting",
            category: "Elections & Democracy",
            title: "Mail-in Voting",
            question: "Shall voting by mail be broadly available in this state?",
            description: "Expands mail-in voting under state law.",
            supportKey: "MailVote",
            priorityKey: "GovPri",
            lawKey: "mailVote",
            extraLaws: [
                { key: "absenteeVote", value: true }
            ],
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_mail_in_voting",
            category: "Elections & Democracy",
            title: "Repeal Mail-in Voting",
            question: "Shall broad mail-in voting be repealed?",
            description: "Repeals broad mail-in voting.",
            supportKey: "MailVote",
            invertSupport: true,
            priorityKey: "GovPri",
            lawKey: "mailVote",
            extraLaws: [
                { key: "absenteeVote", value: false }
            ],
            lawValue: false,
            alignment: "R"
        },
        {
            id: "independent_redistricting",
            category: "Elections & Democracy",
            title: "Independent Redistricting Commission",
            question: "Shall an independent commission draw legislative district lines?",
            description: "Moves redistricting from the legislature to an independent commission.",
            supportKey: "IndRedist",
            priorityKey: "GovPri",
            lawKey: "redistrictRules",
            lawValue: { type: "ind", veto: false, cmpct: true, noFavor: true, intact: true, margin: 0.5, compete: true },
            alignment: "D"
        },
        {
            id: "restore_legislative_redistricting",
            category: "Elections & Democracy",
            title: "Restore Legislative Redistricting",
            question: "Shall the legislature regain authority to draw district lines?",
            description: "Restores legislative control over redistricting.",
            supportKey: "IndRedist",
            invertSupport: true,
            priorityKey: "GovPri",
            lawKey: "redistrictRules",
            lawValue: { type: "leg", veto: true, cmpct: false, noFavor: false, intact: false, margin: 0.5, compete: false },
            alignment: "R"
        },
        {
            id: "minimum_wage_increase",
            category: "Economy & Major Reforms",
            title: "Minimum Wage Increase",
            question: "Shall the state minimum wage be increased?",
            description: "Raises the state minimum wage.",
            supportKey: "MinWage",
            priorityKey: "EcoPri",
            lawKey: "minWage",
            lawValue: "increase-minimum-wage",
            alignment: "D"
        },
        {
            id: "reduce_minimum_wage",
            category: "Economy & Major Reforms",
            title: "Reduce Minimum Wage",
            question: "Shall the state minimum wage be reduced?",
            description: "Reduces the state minimum wage.",
            supportKey: "MinWage",
            invertSupport: true,
            priorityKey: "EcoPri",
            lawKey: "minWage",
            lawValue: "reduce-minimum-wage",
            alignment: "R"
        },
        {
            id: "universal_preschool",
            category: "Education",
            title: "Universal Preschool",
            question: "Shall the state establish universal preschool?",
            description: "Creates universal preschool.",
            supportKey: "PreSchool",
            priorityKey: "EduPri",
            lawKey: "universalPreschool",
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_universal_preschool",
            category: "Education",
            title: "Repeal Universal Preschool",
            question: "Shall universal preschool be repealed?",
            description: "Repeals universal preschool.",
            supportKey: "PreSchool",
            invertSupport: true,
            priorityKey: "EduPri",
            lawKey: "universalPreschool",
            lawValue: false,
            alignment: "R"
        },
        {
            id: "free_community_college",
            category: "Education",
            title: "Free Community College",
            question: "Shall the state make community college tuition-free for eligible residents?",
            description: "Creates a free community-college program.",
            supportKey: "CommColl",
            priorityKey: "EduPri",
            lawKey: "freeCommColl",
            lawValue: true,
            alignment: "D"
        },
        {
            id: "repeal_free_community_college",
            category: "Education",
            title: "Repeal Free Community College",
            question: "Shall the state's free community-college program be repealed?",
            description: "Repeals free community college.",
            supportKey: "CommColl",
            invertSupport: true,
            priorityKey: "EduPri",
            lawKey: "freeCommColl",
            lawValue: false,
            alignment: "R"
        }
    ];

    const clamp = (value, minimum, maximum) =>
        Math.max(minimum, Math.min(maximum, Number(value) || 0));

    const normalizeName = value => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\bst[.]?\b/g, "saint")
        .replace(/&/g, " and ")
        .replace(/\b(county|parish|borough|municipality|census area)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const isInternalSvgName = value =>
        /^(path|polygon|polyline|rect|shape|g|layer)\s*\d+$/i.test(
            String(value || "").trim()
        );

        const getCountyElementKeys = element => {
            const rawValues = [
                element?.getAttribute?.("data-county-name"),
                element?.getAttribute?.("data-county"),
                element?.getAttribute?.("data-name"),
                element?.getAttribute?.("id"),
                element?.getAttribute?.("inkscape:label")
            ];
        const keys = [];
        rawValues.forEach(rawValue => {
            const key = normalizeName(rawValue);
            if(!key || isInternalSvgName(key) || keys.includes(key)) return;
            keys.push(key);
        });
        return keys;
    };

    const getCountyLookupCandidates = key => {
        const normalized = normalizeName(key);
        if(!normalized) return [];
        const candidates = [normalized];
        if(normalized.endsWith(" city")) {
            candidates.push(normalized.replace(/\s+city$/, ""));
        } else {
            candidates.push(`${normalized} city`);
        }
        return Array.from(new Set(candidates));
    };

    const hashString = value => {
        let hash = 2166136261;
        const text = String(value || "");
        for(let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };

    const seededUnit = seed => {
        let value = hashString(seed) || 1;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967295;
    };

    const formatVotes = value => Math.max(0, Math.round(Number(value) || 0))
        .toLocaleString("en-US");

    const mixWithWhite = (hex, strength) => {
        const cleaned = String(hex).replace("#", "");
        const full = cleaned.length === 3
            ? cleaned.split("").map(character => character + character).join("")
            : cleaned.padEnd(6, "0").slice(0, 6);
        const amount = clamp(strength, 0, 1);
        const channels = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
        const mixed = channels.map(channel =>
            Math.round(255 - (255 - channel) * amount)
                .toString(16)
                .padStart(2, "0")
        );
        return `#${mixed.join("")}`;
    };

    const marginStrength = margin => {
        const absolute = Math.abs(Number(margin) || 0);
        if(absolute < 1) return 0.22;
        if(absolute < 3) return 0.35;
        if(absolute < 7) return 0.5;
        if(absolute < 15) return 0.7;
        return 0.96;
    };

    const getRule = () => {
        return {
            threshold: 0.5,
            label: "More Yes votes than No votes"
        };
    };

    const allocateIntegers = (weights, target) => {
        const safeTarget = Math.max(0, Math.round(Number(target) || 0));
        const safeWeights = weights.map(value => Math.max(0, Number(value) || 0));
        const weightTotal = safeWeights.reduce((sum, value) => sum + value, 0);
        if(!safeWeights.length) return [];
        if(weightTotal <= 0) {
            const result = safeWeights.map(() => 0);
            for(let index = 0; index < safeTarget; index++) {
                result[index % result.length]++;
            }
            return result;
        }
        const exact = safeWeights.map(weight => safeTarget * weight / weightTotal);
        const result = exact.map(Math.floor);
        let remainder = safeTarget - result.reduce((sum, value) => sum + value, 0);
        exact
            .map((value, index) => ({ index, fraction: value - result[index] }))
            .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
            .slice(0, remainder)
            .forEach(entry => result[entry.index]++);
        return result;
    };

    const logit = probability => {
        const bounded = clamp(probability, 0.001, 0.999);
        return Math.log(bounded / (1 - bounded));
    };

    const logistic = value => 1 / (1 + Math.exp(-value));

    const calibrateProbabilities = (rawProbabilities, weights, targetShare) => {
        const target = clamp(targetShare, 0.001, 0.999);
        let low = -12;
        let high = 12;
        for(let iteration = 0; iteration < 64; iteration++) {
            const offset = (low + high) / 2;
            let weighted = 0;
            let total = 0;
            rawProbabilities.forEach((probability, index) => {
                const weight = Math.max(0, Number(weights[index]) || 0);
                weighted += logistic(logit(probability) + offset) * weight;
                total += weight;
            });
            const share = total > 0 ? weighted / total : target;
            if(share < target) low = offset;
            else high = offset;
        }
        const offset = (low + high) / 2;
        return rawProbabilities.map(probability =>
            logistic(logit(probability) + offset)
        );
    };

    const createBallotMeasuresSubmod = options => {
        const fs = options.fs;
        const path = options.path;
        const basePath = options.basePath;
        let installed = false;
        let legislationHook = null;
        let electionUpdateHook = null;
        let electionTabObserver = null;
        let lifecycleTimer = null;
        let activeMeasureId = null;
        let activeMapMode = "winner";
        let activeMapLevel = "national";
        let activeCountyKey = "";
        let activeCountyName = "";
        let previousStateMapMode = "winner";
        let overlay = null;
        let tooltip = null;
        let lastRenderedReporting = -1;
        let reportingMeasureId = "";
        let maximumObservedReporting = 0;
        let lastElectionNightTime = null;
        let lastElectionNightMaximum = null;
        let electionNightSessionActive = false;
        let electionNightMissingSince = 0;
        let simulationCacheKey = "";
        let simulationCache = null;
        let activeLegislationObject = null;
        const svgTextCache = new Map();

        const readRuntimeValue = name => {
            if(globalThis[name] !== undefined) return globalThis[name];
            try {
                return (0, eval)(name);
            } catch {
                return undefined;
            }
        };

        const callRuntimeFunction = (name, ...args) => {
            const target = readRuntimeValue(name);
            if(typeof target === "function") return target(...args);
            return undefined;
        };

        const getCurrentYear = () => Number(
            options.getCurrentYear?.() ?? readRuntimeValue("currentYear")
        );
        const getCurrentWeek = () => Number(
            options.getCurrentWeek?.() ?? readRuntimeValue("weekNum")
        );

        const getPlayerState = () => {
            try {
                return normalizeStateId(String(
                    Executive.data.characters.player.stateId
                    || Executive.data.characters.player.state
                    || ""
                ));
            } catch {
                return "";
            }
        };

        const normalizeStateId = value => {
            const rawValue = String(value || "").trim();
            const upperValue = rawValue.toUpperCase();
            if(STATE_NAMES[upperValue]) return upperValue;
            const normalizedName = normalizeName(rawValue);
            const match = Object.entries(STATE_NAMES).find(([_id, name]) =>
                normalizeName(name) === normalizedName
            );
            return match ? match[0] : upperValue;
        };

        const stateRecordMatchesId = (stats, stateId) => {
            if(!stats || typeof stats !== "object") return false;
            const targetId = normalizeStateId(stateId);
            return [
                stats.id,
                stats.state,
                stats.stateId,
                stats.abbr,
                stats.name
            ].some(value => value !== undefined && normalizeStateId(value) === targetId);
        };

        const getStateStats = stateId => {
            try {
                const normalizedStateId = normalizeStateId(stateId);
                return Executive.data.states[String(normalizedStateId || "").toLowerCase()];
            } catch {
                return null;
            }
        };

        const getStateStatsTargets = stateId => {
            const targets = [];
            const addTarget = stats => {
                if(stats && typeof stats === "object" && !targets.includes(stats)) {
                    targets.push(stats);
                }
            };
            const normalizedStateId = normalizeStateId(stateId);
            const stateKey = String(normalizedStateId || "").toLowerCase();
            addTarget(getStateStats(stateId));
            addTarget(readRuntimeValue(`${stateKey}Stats`));
            const runtimeStateStats = readRuntimeValue("stateStats");
            if(normalizeStateId(getPlayerState()) === normalizedStateId
                || stateRecordMatchesId(runtimeStateStats, normalizedStateId)) {
                addTarget(runtimeStateStats);
            }
            return targets;
        };

        const getEffectiveStateStats = stateId => {
            const merged = {};
            getStateStatsTargets(stateId).forEach(stats => {
                Object.assign(merged, stats);
            });
            return Object.keys(merged).length ? merged : null;
        };

        const getPrimaryVisibleStateStats = stateId => {
            const normalizedStateId = normalizeStateId(stateId);
            const runtimeStateStats = readRuntimeValue("stateStats");
            if(normalizeStateId(getPlayerState()) === normalizedStateId
                || stateRecordMatchesId(runtimeStateStats, normalizedStateId)) {
                return runtimeStateStats || getStateStats(stateId);
            }
            return getStateStats(stateId) || readRuntimeValue(
                `${String(normalizedStateId || "").toLowerCase()}Stats`
            );
        };

        const readVisibleCannabisLegislationValue = () => {
            if(typeof document === "undefined") return null;
            const readStatusFromVisibleText = () => {
                const sources = [
                    document.body?.innerText,
                    document.body?.textContent
                ].filter(Boolean);
                for(const source of sources) {
                    const compactSource = String(source || "").replace(/\s+/g, " ");
                    const lines = String(source || "")
                        .split(/\r?\n/)
                        .map(line => line.replace(/\s+/g, " ").trim())
                        .filter(Boolean);
                    for(let index = 0; index < lines.length; index += 1) {
                        if(!/^cannabis legality$/i.test(lines[index])) continue;
                        const nearby = lines.slice(index, index + 8).join(" ");
                        if(/\bInactive\b/i.test(nearby)) return false;
                        if(/\bActive\b/i.test(nearby)) return true;
                    }
                    const compactMatch = compactSource
                        .match(/\bCannabis Legality\b(?:(?!\bDescription\b).){0,240}\b(Inactive|Active)\b/i);
                    const reverseCompactMatch = compactSource
                        .match(/\b(Inactive|Active)\b(?:(?!\bDescription\b).){0,160}\bCannabis Legality\b/i);
                    const statusMatch = compactMatch || reverseCompactMatch;
                    if(statusMatch) {
                        return statusMatch[1].toLowerCase() === "active";
                    }
                }
                const cannabisContainers = Array.from(document.querySelectorAll("body *"))
                    .map(element => ({
                        element,
                        text: String(element?.textContent || "").replace(/\s+/g, " ").trim()
                    }))
                    .filter(record =>
                        /\bCannabis Legality\b/i.test(record.text)
                        && /\b(Inactive|Active)\b/i.test(record.text)
                    )
                    .sort((left, right) => left.text.length - right.text.length);
                for(const record of cannabisContainers) {
                    const compactMatch = record.text
                        .match(/\bCannabis Legality\b(?:(?!\bDescription\b).){0,240}\b(Inactive|Active)\b/i);
                    const reverseCompactMatch = record.text
                        .match(/\b(Inactive|Active)\b(?:(?!\bDescription\b).){0,160}\bCannabis Legality\b/i);
                    const statusMatch = compactMatch || reverseCompactMatch;
                    if(statusMatch) {
                        return statusMatch[1].toLowerCase() === "active";
                    }
                }
                return null;
            };
            const visibleTextStatus = readStatusFromVisibleText();
            if(typeof visibleTextStatus === "boolean") return visibleTextStatus;
            const textMatches = element =>
                String(element?.textContent || "").trim().toLowerCase() === "cannabis legality";
            const title = Array.from(document.querySelectorAll("h1,h2,h3,h4,legend,div,span,strong"))
                .find(textMatches);
            if(!title) return null;
            let container = title.parentElement;
            for(let depth = 0; container && depth < 6; depth += 1, container = container.parentElement) {
                const statusElement = Array.from(
                    container.querySelectorAll("span,small,strong,button,div")
                ).find(element => /^(active|inactive)$/i.test(
                    String(element?.textContent || "").trim()
                ));
                const visibleStatus = String(statusElement?.textContent || "")
                    .trim()
                    .toLowerCase();
                if(visibleStatus === "inactive") return false;
                if(visibleStatus === "active") return true;
                const buttons = Array.from(container.querySelectorAll("button"))
                    .filter(button => /^(true|false)$/i.test(String(button.textContent || "").trim()));
                const trueButton = buttons.find(button =>
                    /^true$/i.test(String(button.textContent || "").trim())
                );
                const falseButton = buttons.find(button =>
                    /^false$/i.test(String(button.textContent || "").trim())
                );
                if(!trueButton || !falseButton) continue;
                const trueSelected = trueButton.getAttribute("aria-pressed") === "true";
                const falseSelected = falseButton.getAttribute("aria-pressed") === "true";
                if(trueSelected !== falseSelected) return trueSelected;
                const buttonLooksActive = (button, activeClass) => {
                    const className = String(button.className || "");
                    if(/\blegisIdleButton\b/.test(className)) return false;
                    try {
                        const colour = getComputedStyle(button).backgroundColor;
                        const match = String(colour || "").match(
                            /rgba?\((\d+),\s*(\d+),\s*(\d+)/i
                        );
                        if(!match) return false;
                        const red = Number(match[1]);
                        const green = Number(match[2]);
                        const blue = Number(match[3]);
                        const isGrey = Math.abs(red - green) < 18
                            && Math.abs(green - blue) < 18;
                        if(isGrey) return false;
                        return activeClass === "legisTrueButton"
                            ? green > red && green > blue
                            : red > green && red > blue;
                    } catch {
                        return new RegExp(`\\b${activeClass}\\b`).test(className);
                    }
                };
                const trueActive = buttonLooksActive(trueButton, "legisTrueButton");
                const falseActive = buttonLooksActive(falseButton, "legisFalseButton");
                if(trueActive !== falseActive) return trueActive;
            }
            return null;
        };

        const readCannabisLegalityObjectValue = source => {
            const seen = new Set();
            const visit = value => {
                if(!value || typeof value !== "object" || seen.has(value)) return null;
                seen.add(value);
                const directLegality = getByPath(value, "legalMarijuana");
                if(typeof directLegality === "boolean") return directLegality;
                const idText = [
                    value.id,
                    value.key,
                    value.name,
                    value.title,
                    value.lawKey,
                    value.description
                ].map(part => String(part || "")).join(" ");
                const isCannabisLegality = (
                    /\blegalMarijuana\b/i.test(idText)
                    || /\bCannabis Legality\b/i.test(idText)
                    || /\bLegality of Cannabis\b/i.test(idText)
                    || /sale and possession of cannabis.*legal or illegal/i.test(idText)
                ) && !/\bTax\b/i.test(idText);
                const proposed = value.value
                    ?? value.val
                    ?? value.setting
                    ?? value.active
                    ?? value.policy
                    ?? value.lawValue;
                if(isCannabisLegality && typeof proposed === "boolean") {
                    return proposed;
                }
                for(const child of Object.values(value)) {
                    const found = visit(child);
                    if(found !== null) return found;
                }
                return null;
            };
            return visit(source);
        };

        const getCannabisVisibleStateStats = stateId => {
            const baseStats = getEffectiveStateStats(stateId)
                || getPrimaryVisibleStateStats(stateId)
                || {};
            const stats = { ...baseStats };
            const legalityValue = readVisibleCannabisLegislationValue()
                ?? readCannabisLegalityObjectValue(stats)
                ?? readCannabisLegalityObjectValue(activeLegislationObject);
            if(typeof legalityValue === "boolean") {
                stats.__bmCannabisLegalOverride = legalityValue;
                stats.legalMarijuana = legalityValue;
            }
            return stats;
        };

        const getStore = () => {
            if(!Executive?.game?.loaded) return null;
            const saveData = Executive.mods.saveData;
            if(!saveData.ballotMeasures || typeof saveData.ballotMeasures !== "object") {
                saveData.ballotMeasures = {
                    version: 1,
                    measures: []
                };
            }
            if(!Array.isArray(saveData.ballotMeasures.measures)) {
                saveData.ballotMeasures.measures = [];
            }
            return saveData.ballotMeasures;
        };

        const findCatalogueEntry = id =>
            MEASURE_CATALOGUE.find(entry => entry.id === id) || null;

        const cloneLawValue = value => {
            if(value && typeof value === "object") {
                try {
                    return JSON.parse(JSON.stringify(value));
                } catch {
                    return { ...value };
                }
            }
            return value;
        };

        const getResolvedLawValue = (catalogue, stats, measure = null, proposedValue = null) => {
            if(proposedValue !== null && proposedValue !== undefined) {
                return catalogue?.lawKey === "minWage"
                    ? Math.round(clamp(proposedValue, 5, 20) * 20) / 20
                    : cloneLawValue(proposedValue);
            }
            if(measure && Object.prototype.hasOwnProperty.call(measure, "requestedLawValue")) {
                return cloneLawValue(measure.requestedLawValue);
            }
            if(measure && Object.prototype.hasOwnProperty.call(measure, "resolvedLawValue")) {
                return cloneLawValue(measure.resolvedLawValue);
            }
            if(catalogue?.lawValue === "increase-minimum-wage") {
                const current = clamp(stats?.minWage, 5, 20) || 7.25;
                return Math.min(20, Math.round((current + 2.5) * 20) / 20);
            }
            if(catalogue?.lawValue === "reduce-minimum-wage") {
                const current = clamp(stats?.minWage, 5, 20) || 7.25;
                return Math.max(5, Math.round((current - 2.5) * 20) / 20);
            }
            return cloneLawValue(catalogue?.lawValue);
        };

        const getCatalogueLawChanges = (catalogue, stats, measure = null) => {
            if(!catalogue) return [];
            const changes = [
                { key: catalogue.lawKey, value: getResolvedLawValue(catalogue, stats, measure) }
            ];
            if(catalogue.secondaryLaw) changes.push(catalogue.secondaryLaw);
            (catalogue.extraLaws || []).forEach(change => changes.push(change));
            return changes
                .filter(change => change?.key)
                .map(change => ({
                    key: change.key,
                    value: cloneLawValue(change.value)
                }));
        };

        const lawValuesEqual = (left, right) =>
            JSON.stringify(cloneLawValue(left)) === JSON.stringify(cloneLawValue(right));

        const getByPath = (target, key) => String(key || "")
            .split(".")
            .filter(Boolean)
            .reduce((current, part) => current?.[part], target);

        const hasByPath = (target, key) => {
            const parts = String(key || "").split(".").filter(Boolean);
            let current = target;
            for(const part of parts) {
                if(!current || !Object.prototype.hasOwnProperty.call(current, part)) {
                    return false;
                }
                current = current[part];
            }
            return true;
        };

        const setByPath = (target, key, value) => {
            const parts = String(key || "").split(".").filter(Boolean);
            if(!parts.length) return;
            let current = target;
            parts.slice(0, -1).forEach(part => {
                if(!current[part] || typeof current[part] !== "object") current[part] = {};
                current = current[part];
            });
            current[parts[parts.length - 1]] = cloneLawValue(value);
        };

        const getActiveCheckLawChanges = (catalogue, stats) => {
            if(!catalogue) return [];
            if(Array.isArray(catalogue.activeCheckLaws)) {
                return catalogue.activeCheckLaws.map(change => ({
                    key: change.key,
                    value: cloneLawValue(change.value)
                }));
            }
            return getCatalogueLawChanges(catalogue, stats);
        };

        const readCannabisLawFlag = (stats, keys) => {
            for(const key of keys) {
                if(Object.prototype.hasOwnProperty.call(stats, key)
                    && typeof stats[key] === "boolean") {
                    return stats[key] === true;
                }
            }
            return null;
        };

        const isCannabisCatalogueAlreadyLaw = (catalogue, stats) => {
            if(typeof stats?.__bmCannabisLegalOverride === "boolean") {
                return catalogue.id === "legalize_marijuana"
                    ? stats.__bmCannabisLegalOverride
                    : !stats.__bmCannabisLegalOverride;
            }
            const cannabisLegality = readCannabisLawFlag(stats, [
                "legalMarijuana"
            ]);
            if(catalogue.id === "legalize_marijuana") {
                return cannabisLegality === true;
            }
            if(catalogue.id === "prohibit_marijuana") {
                return cannabisLegality === false;
            }
            return false;
        };

        const isAbortionCatalogueAlreadyLaw = (catalogue, stats) => {
            const abortLaw = stats?.abortLaw || {};
            if(catalogue.id === "protect_abortion_rights") {
                return stats?.illegalAbortion === false;
            }
            if(catalogue.id === "prohibit_abortion") {
                return stats?.illegalAbortion === true
                    || (
                        abortLaw.allowAll === false
                        && Number(abortLaw.gestWeek) <= 0
                    );
            }
            return false;
        };

        const isRedistrictCatalogueAlreadyLaw = (catalogue, stats) => {
            const currentType = String(stats?.redistrictRules?.type || "").toLowerCase();
            if(catalogue.id === "independent_redistricting") return currentType === "ind";
            if(catalogue.id === "restore_legislative_redistricting") return currentType === "leg";
            return false;
        };

        const readStateBooleanAlias = (stats, keys) => {
            for(const key of keys) {
                if(hasByPath(stats, key) && typeof getByPath(stats, key) === "boolean") {
                    return getByPath(stats, key) === true;
                }
            }
            return false;
        };

        const isGunCatalogueAlreadyLaw = (catalogue, stats) => {
            const aliasMap = {
                assault_weapons_ban: [
                    "assaultGunBan",
                    "assaultWeaponBan",
                    "assaultWeaponsBan",
                    "banAssaultWeapons"
                ],
                repeal_assault_weapons_ban: [
                    "assaultGunBan",
                    "assaultWeaponBan",
                    "assaultWeaponsBan",
                    "banAssaultWeapons"
                ],
                handgun_ban: [
                    "handgunBanLaw",
                    "handGunBanLaw",
                    "handgunBan"
                ],
                repeal_handgun_ban: [
                    "handgunBanLaw",
                    "handGunBanLaw",
                    "handgunBan"
                ]
            };
            const aliases = aliasMap[catalogue?.id];
            if(!aliases) return null;
            const active = readStateBooleanAlias(stats, aliases);
            return active === (catalogue.lawValue === true);
        };

        const isBaseBooleanCatalogueAlreadyLaw = (catalogue, stats) => {
            const ids = new Set([
                "ranked_choice_voting",
                "repeal_ranked_choice",
                "voter_identification",
                "repeal_voter_identification",
                "mail_in_voting",
                "repeal_mail_in_voting",
                "non_partisan_primaries",
                "restore_party_primaries"
            ]);
            if(!ids.has(catalogue?.id)) return null;
            const current = getByPath(stats, catalogue.lawKey) === true;
            return current === (catalogue.lawValue === true);
        };

        const readRuntimePath = path => {
            const parts = String(path || "").split(".").filter(Boolean);
            const roots = [
                typeof Executive !== "undefined" ? Executive?.data : null,
                typeof Executive !== "undefined" ? Executive?.data?.advancedOptions : null,
                typeof Executive !== "undefined" ? Executive?.mods?.saveData : null,
                typeof globalThis !== "undefined" ? globalThis : null
            ];
            for(const root of roots) {
                if(!root) continue;
                let current = root;
                let found = true;
                for(const part of parts) {
                    if(!current || !Object.prototype.hasOwnProperty.call(current, part)) {
                        found = false;
                        break;
                    }
                    current = current[part];
                }
                if(found) return current;
            }
            return undefined;
        };

        const anyRuntimeFlagEnabled = keys =>
            keys.some(key => readRuntimePath(key) === true);

        const hasAnyRuntimeFlag = keys =>
            keys.some(key => readRuntimePath(key) !== undefined);

        const readPathFromRoot = (root, path) => {
            if(!root) return undefined;
            const parts = String(path || "").split(".").filter(Boolean);
            let current = root;
            for(const part of parts) {
                if(!current || !Object.prototype.hasOwnProperty.call(current, part)) {
                    return undefined;
                }
                current = current[part];
            }
            return current;
        };

        const readNationalPolicyValue = path => {
            const cleanPath = String(path || "")
                .replace(/^advancedOptions\./, "")
                .replace(/^nationStats\./, "");
            const roots = [
                typeof Executive !== "undefined" ? Executive?.data?.nationStats : null,
                typeof Executive !== "undefined" ? Executive?.mods?.saveData?.nationStats : null,
                readRuntimeValue("nationStats"),
                typeof Executive !== "undefined" ? Executive?.data?.advancedOptions : null,
                typeof Executive !== "undefined" ? Executive?.mods?.saveData?.advancedOptions : null
            ];
            for(const root of roots) {
                const value = readPathFromRoot(root, cleanPath);
                if(value !== undefined) return value;
            }
            return undefined;
        };

        const anyNationalFlagEnabled = keys =>
            keys.some(key => readNationalPolicyValue(key) === true);

        const nationalRedistrictingIsFederal = () => {
            const type = String(
                readNationalPolicyValue("redistrictRules.type")
                ?? readNationalPolicyValue("redistrictingRules.type")
                ?? ""
            ).toLowerCase();
            return type === "ind"
                || type === "independent"
                || anyNationalFlagEnabled([
                    "independentRedistricting",
                    "indRedistricting",
                    "nationalIndependentRedistricting"
                ]);
        };

        const isNationalPolicyActiveForCatalogue = catalogue => {
            const keysByCatalogue = {
                ranked_choice_voting: [
                    "rankChoiceVoteLaw",
                    "rankedChoiceVoting",
                    "nationalRankChoiceVoteLaw",
                    "advancedOptions.rankChoiceVoteLaw"
                ],
                repeal_ranked_choice: [
                    "rankChoiceVoteLaw",
                    "rankedChoiceVoting",
                    "nationalRankChoiceVoteLaw",
                    "advancedOptions.rankChoiceVoteLaw"
                ],
                voter_identification: [
                    "voterIDLaw",
                    "voterIdLaw",
                    "nationalVoterIDLaw",
                    "advancedOptions.voterIDLaw"
                ],
                repeal_voter_identification: [
                    "voterIDLaw",
                    "voterIdLaw",
                    "nationalVoterIDLaw",
                    "advancedOptions.voterIDLaw"
                ],
                mail_in_voting: [
                    "mailVote",
                    "voteByMail",
                    "nationalMailVote",
                    "advancedOptions.mailVote"
                ],
                repeal_mail_in_voting: [
                    "mailVote",
                    "voteByMail",
                    "nationalMailVote",
                    "advancedOptions.mailVote"
                ],
                non_partisan_primaries: [
                    "junglePrimary",
                    "nonpartisanPrimary",
                    "openPrimaryAllCandidates",
                    "advancedOptions.junglePrimary"
                ],
                restore_party_primaries: [
                    "junglePrimary",
                    "nonpartisanPrimary",
                    "openPrimaryAllCandidates",
                    "advancedOptions.junglePrimary"
                ],
                independent_redistricting: [
                    "independentRedistricting",
                    "indRedistricting",
                    "nationalIndependentRedistricting",
                    "advancedOptions.independentRedistricting"
                ],
                restore_legislative_redistricting: [
                    "independentRedistricting",
                    "indRedistricting",
                    "nationalIndependentRedistricting",
                    "advancedOptions.independentRedistricting"
                ]
            };
            if(catalogue?.id === "independent_redistricting"
                || catalogue?.id === "restore_legislative_redistricting") {
                return nationalRedistrictingIsFederal();
            }
            const keys = keysByCatalogue[catalogue?.id] || [];
            return anyNationalFlagEnabled(keys);
        };

        const isAbortionStateJurisdictionEnabled = () => {
            const keys = [
                "stateAbortion",
                "nationStats.stateAbortion",
                "statesHaveJurisdictionOverAbortionPolicy",
                "statesHaveJurisdictionOverAbortion",
                "statesAbortionJurisdiction",
                "stateAbortionJurisdiction",
                "abortionStateJurisdiction",
                "stateAbortJurisdiction",
                "advancedOptions.stateAbortion",
                "advancedOptions.statesHaveJurisdictionOverAbortionPolicy",
                "advancedOptions.stateAbortionJurisdiction"
            ];
            return hasAnyRuntimeFlag(keys)
                ? anyRuntimeFlagEnabled(keys)
                : true;
        };

        const getCatalogueUnavailableReason = (catalogue, stats) => {
            if(!catalogue) return "Unavailable";
            if(catalogue.id === "protect_abortion_rights" || catalogue.id === "prohibit_abortion") {
                if(!isAbortionStateJurisdictionEnabled()) {
                    return "Federal law";
                }
            }
            if(isNationalPolicyActiveForCatalogue(catalogue)) {
                return "Federal law";
            }
            return "";
        };

        const isCatalogueAlreadyLaw = (catalogue, stats) => {
            if(!catalogue || !stats || catalogue.lawKey === "minWage") return false;
            if(catalogue.id === "protect_abortion_rights" || catalogue.id === "prohibit_abortion") {
                return isAbortionCatalogueAlreadyLaw(catalogue, stats);
            }
            if(catalogue.id === "legalize_marijuana" || catalogue.id === "prohibit_marijuana") {
                return isCannabisCatalogueAlreadyLaw(catalogue, stats);
            }
            if(catalogue.id === "independent_redistricting" || catalogue.id === "restore_legislative_redistricting") {
                return isRedistrictCatalogueAlreadyLaw(catalogue, stats);
            }
            const gunAlreadyLaw = isGunCatalogueAlreadyLaw(catalogue, stats);
            if(gunAlreadyLaw !== null) return gunAlreadyLaw;
            const baseBooleanAlreadyLaw = isBaseBooleanCatalogueAlreadyLaw(catalogue, stats);
            if(baseBooleanAlreadyLaw !== null) return baseBooleanAlreadyLaw;
            const changes = getActiveCheckLawChanges(catalogue, stats);
            return changes.length > 0
                && changes.every(change => {
                    if(hasByPath(stats, change.key)) {
                        return lawValuesEqual(getByPath(stats, change.key), change.value);
                    }
                    return change.value === false;
                });
        };

        const getPolicyDifficultyPenalty = (stats, catalogue, resolvedLawValue) => {
            if(!catalogue || !stats) return 0;
            if(catalogue.lawKey === "minWage") {
                const current = clamp(stats.minWage, 5, 20) || 7.25;
                const target = clamp(resolvedLawValue, 5, 20) || current;
                const distance = Math.abs(target - current);
                return Math.min(14, distance * 2.4);
            }
            const current = stats[catalogue.lawKey];
            const changingExistingLaw = !lawValuesEqual(current, resolvedLawValue);
            const majorReformPenalty = /^Economy|Rights|Guns/i.test(catalogue.category || "")
                ? 2.4
                : 1.4;
            return changingExistingLaw ? majorReformPenalty : 0;
        };

        const isElectionNightInterfaceActive = () => {
            if(typeof options.isElectionNightActive === "function") {
                return options.isElectionNightActive() === true;
            }
            if(typeof document === "undefined") return false;
            const pageText = String(document.body?.innerText || document.body?.textContent || "");
            if(/Do you want to watch the election night coverage\?/i.test(pageText)) {
                return false;
            }
            return Boolean(
                document.getElementById("electNightDiv")
                && (
                    document.getElementById("electNightTabDiv")
                    || document.getElementById("electNightCanvas")
                    || document.getElementById("electNightSpeedDiv")
                )
            );
        };

        const getScheduledMeasureForYear = year => {
            const store = getStore();
            const playerState = getPlayerState();
            return store?.measures.find(measure =>
                Number(measure.electionYear) === Number(year)
                && String(measure.stateId).toUpperCase() === playerState
                && !["withdrawn"].includes(measure.status)
            ) || null;
        };

        const getMeasureById = id =>
            getStore()?.measures.find(measure => measure.id === id) || null;

        const readPartyValue = (stats, prefix, key, fallback = 50) => {
            const value = Number(stats?.[`${prefix}${key}`]);
            return Number.isFinite(value) ? clamp(value, 0, 100) : fallback;
        };

        const readMeasureSupport = (stats, prefix, catalogue) => {
            if(catalogue?.id === "protect_abortion_rights") {
                const proChoice = readPartyValue(stats, prefix, "ProChoice");
                const illegalAbortion = readPartyValue(stats, prefix, "IllegalAbortion");
                return (proChoice + (100 - illegalAbortion)) / 2;
            }
            if(catalogue?.id === "prohibit_abortion") {
                const proChoice = readPartyValue(stats, prefix, "ProChoice");
                const illegalAbortion = readPartyValue(stats, prefix, "IllegalAbortion");
                return (illegalAbortion + (100 - proChoice)) / 2;
            }
            const support = readPartyValue(stats, prefix, catalogue.supportKey);
            return catalogue.invertSupport ? 100 - support : support;
        };

        const readPriority = (stats, prefix, key) => {
            const raw = stats?.[`${prefix}${key}`];
            const value = Number(raw?.total ?? raw?.base ?? raw);
            return Number.isFinite(value) ? clamp(value, 0, 100) : 40;
        };

        const archiveHasStateRace = (archiveName, stateId, year, cycleLength) => {
            const archive = readRuntimeValue(archiveName);
            if(!Array.isArray(archive)) return false;
            const stateName = normalizeName(STATE_NAMES[stateId] || stateId);
            return archive.some(entry => {
                const archiveYear = Number(entry?.year);
                if(
                    !Number.isFinite(archiveYear)
                    || Math.abs(year - archiveYear) % cycleLength !== 0
                    || !Array.isArray(entry?.elections)
                ) {
                    return false;
                }
                return entry.elections.some(election => {
                    const district = normalizeName(
                        election?.stateId
                        || election?.state
                        || election?.district
                    );
                    return district === normalizeName(stateId)
                        || district === stateName;
                });
            });
        };

        const getConcurrentElectionContext = (stateId, year) => {
            const electionYear = Number(year);
            const normalizedState = String(stateId || "").toUpperCase();
            const presidential = electionYear % 4 === 0;
            const federalMidterm = electionYear % 4 === 2;
            const senate = archiveHasStateRace(
                "usSenateArchive",
                normalizedState,
                electionYear,
                6
            );
            const archivedGovernor = archiveHasStateRace(
                "allGovArchive",
                normalizedState,
                electionYear,
                4
            );
            const offYearGovernor = (
                electionYear % 4 === 1
                    && ["NJ", "VA"].includes(normalizedState)
            ) || (
                electionYear % 4 === 3
                    && ["KY", "LA", "MS"].includes(normalizedState)
            );
            const governor = archivedGovernor || offYearGovernor;
            if(presidential) {
                return {
                    key: "presidential",
                    label: "Presidential election",
                    turnoutMultiplier: 1,
                    presidential,
                    senate,
                    governor
                };
            }
            if(federalMidterm) {
                return {
                    key: "midterm",
                    label: senate || governor
                        ? "Midterm with statewide races"
                        : "Midterm election",
                    turnoutMultiplier: Math.min(
                        0.91,
                        0.78 + (senate ? 0.05 : 0) + (governor ? 0.06 : 0)
                    ),
                    presidential,
                    senate,
                    governor
                };
            }
            if(governor) {
                return {
                    key: "off-year-governor",
                    label: "Off-year governor election",
                    turnoutMultiplier: 0.68,
                    presidential,
                    senate,
                    governor
                };
            }
            return {
                key: "ballot-only",
                label: "Ballot measure only",
                turnoutMultiplier: 0.46,
                presidential,
                senate,
                governor
            };
        };

        const calculateMeasureFundamentals = (
            stateId,
            catalogue,
            year,
            proposedLawValue = null
        ) => {
            const stats = getStateStats(stateId);
            const electionContext = getConcurrentElectionContext(stateId, year);
            const resolvedLawValue = getResolvedLawValue(
                catalogue,
                stats,
                null,
                proposedLawValue
            );
            const populations = {
                dem: clamp(stats?.demPop, 0, 1),
                rep: clamp(stats?.repPop, 0, 1),
                ind: clamp(stats?.indPop, 0, 1)
            };
            const populationTotal = populations.dem + populations.rep + populations.ind || 1;
            Object.keys(populations).forEach(key => populations[key] /= populationTotal);
            const support = {
                dem: readMeasureSupport(stats, "dem", catalogue),
                rep: readMeasureSupport(stats, "rep", catalogue),
                ind: readMeasureSupport(stats, "ind", catalogue)
            };
            const priority = {
                dem: readPriority(stats, "dem", catalogue.priorityKey),
                rep: readPriority(stats, "rep", catalogue.priorityKey),
                ind: readPriority(stats, "ind", catalogue.priorityKey)
            };
            const weightedSupport =
                populations.dem * support.dem
                + populations.rep * support.rep
                + populations.ind * support.ind;
            const salience =
                populations.dem * priority.dem
                + populations.rep * priority.rep
                + populations.ind * priority.ind;
            const difficultyPenalty = getPolicyDifficultyPenalty(
                stats,
                catalogue,
                resolvedLawValue
            );
            const resultVolatility = 7.5 + (100 - salience) * 0.11;
            const noise = (
                seededUnit(`${stateId}|${catalogue.id}|${year}|result`) - 0.5
            ) * 2 * resultVolatility;
            const yesShare = clamp(
                (weightedSupport + noise - difficultyPenalty) / 100,
                0.04,
                0.96
            );
            const population = Math.max(1000, Number(stats?.pop) || 1000000);
            const registration = clamp(stats?.regVoters, 0.25, 0.95) || 0.58;
            const baseTurnout = clamp(stats?.generalTurnout, 0.25, 0.92) || 0.62;
            const completion = 0.58 + 0.42 * (salience / 100);
            const totalVotes = Math.max(
                100,
                Math.round(
                    population
                    * registration
                    * baseTurnout
                    * completion
                    * electionContext.turnoutMultiplier
                )
            );
            const eligibleVoters = Math.max(1, Math.round(population * registration));
            const yesVotes = Math.round(totalVotes * yesShare);
            return {
                support,
                priority,
                populations,
                electionContext,
                salience,
                yesShare,
                totalVotes,
                eligibleVoters,
                turnoutPercent: totalVotes / eligibleVoters * 100,
                yesVotes,
                noVotes: totalVotes - yesVotes,
                resolvedLawValue,
                difficultyPenalty
            };
        };

        const getFundamentalsSignature = (stateId, catalogue, year, fundamentals) => {
            const stats = getStateStats(stateId);
            return JSON.stringify({
                catalogueId: catalogue.id,
                year: Number(year),
                population: Number(stats?.pop) || 0,
                registration: Number(stats?.regVoters) || 0,
                generalTurnout: Number(stats?.generalTurnout) || 0,
                populations: fundamentals.populations,
                support: fundamentals.support,
                priority: fundamentals.priority,
                electionContext: fundamentals.electionContext,
                resolvedLawValue: fundamentals.resolvedLawValue,
                difficultyPenalty: fundamentals.difficultyPenalty
            });
        };

        const applyMeasureFundamentals = (measure, fundamentals, signature) => {
            measure.finalYesVotes = fundamentals.yesVotes;
            measure.finalNoVotes = fundamentals.noVotes;
            measure.totalVotes = fundamentals.totalVotes;
            measure.eligibleVoters = fundamentals.eligibleVoters;
            measure.turnoutPercent = fundamentals.turnoutPercent;
            measure.yesShare = fundamentals.yesShare;
            measure.salience = fundamentals.salience;
            measure.support = fundamentals.support;
            measure.priority = fundamentals.priority;
            measure.populations = fundamentals.populations;
            measure.electionContext = fundamentals.electionContext;
            measure.resolvedLawValue = cloneLawValue(fundamentals.resolvedLawValue);
            if(!Object.prototype.hasOwnProperty.call(measure, "requestedLawValue")) {
                measure.requestedLawValue = cloneLawValue(fundamentals.resolvedLawValue);
            }
            measure.difficultyPenalty = fundamentals.difficultyPenalty;
            measure.fundamentalsSignature = signature;
            measure.turnoutModelVersion = 3;
            simulationCacheKey = "";
        };

        const refreshScheduledMeasureFundamentals = measure => {
            if(!measure || measure.status !== "scheduled" || measure.applied) return false;
            const currentYear = getCurrentYear();
            const currentWeek = getCurrentWeek();
            const electionYear = Number(measure.electionYear);
            if(
                currentYear > electionYear
                || (currentYear === electionYear && currentWeek > 45)
            ) {
                return false;
            }
            if(currentYear === electionYear && currentWeek === 45) {
                if(getReporting() > 0 || measure.fundamentalsFrozen === true) {
                    measure.fundamentalsFrozen = true;
                    return false;
                }
            }
            const catalogue = findCatalogueEntry(measure.catalogueId);
            if(!catalogue) return false;
            const requestedLawValue = getResolvedLawValue(
                catalogue,
                getStateStats(measure.stateId),
                measure
            );
            const fundamentals = calculateMeasureFundamentals(
                measure.stateId,
                catalogue,
                measure.electionYear,
                requestedLawValue
            );
            const signature = getFundamentalsSignature(
                measure.stateId,
                catalogue,
                measure.electionYear,
                fundamentals
            );
            if(signature === measure.fundamentalsSignature) return false;
            applyMeasureFundamentals(measure, fundamentals, signature);
            return true;
        };

        const scheduleMeasure = (catalogueId, settings = {}) => {
            const store = getStore();
            const stateId = getPlayerState();
            const currentYear = getCurrentYear();
            const currentWeek = getCurrentWeek();
            const catalogue = findCatalogueEntry(catalogueId);
            if(!store) throw new Error("The ballot-measure save store is not available.");
            if(!stateId) throw new Error("The player's state could not be identified.");
            if(!catalogue) throw new Error("The selected law could not be identified.");
            const unavailableReason = getCatalogueUnavailableReason(
                catalogue,
                getStateStats(stateId)
            );
            if(unavailableReason) {
                throw new Error(`This referendum cannot be proposed because ${unavailableReason.toLowerCase()} controls this policy.`);
            }
            if(!Number.isFinite(currentYear) || !Number.isFinite(currentWeek)) {
                throw new Error("The current game year or week could not be read.");
            }
            if(store.measures.some(measure =>
                Number(measure.proposedYear) === currentYear
                && String(measure.stateId).toUpperCase() === stateId
                && measure.status !== "withdrawn"
            )) {
                throw new Error("Only one ballot measure may be introduced per year.");
            }
            const electionYear = currentWeek < 45 ? currentYear : currentYear + 1;
            const rule = getRule(stateId);
            const fundamentals = calculateMeasureFundamentals(
                stateId,
                catalogue,
                electionYear,
                settings.resolvedLawValue
            );
            const measure = {
                id: `bm-${stateId}-${currentYear}-${catalogue.id}`,
                catalogueId: catalogue.id,
                stateId,
                stateName: STATE_NAMES[stateId] || stateId,
                proposedYear: currentYear,
                proposedWeek: currentWeek,
                electionYear,
                applyYear: electionYear + 1,
                type: "ordinary-law",
                threshold: rule.threshold,
                thresholdLabel: rule.label,
                status: "scheduled",
                primaryAdvanceCount: catalogue.id === "non_partisan_primaries"
                    ? Math.round(clamp(settings.primaryAdvanceCount || 2, 2, 5))
                    : undefined,
                finalYesVotes: fundamentals.yesVotes,
                finalNoVotes: fundamentals.noVotes,
                totalVotes: fundamentals.totalVotes,
                eligibleVoters: fundamentals.eligibleVoters,
                turnoutPercent: fundamentals.turnoutPercent,
                yesShare: fundamentals.yesShare,
                salience: fundamentals.salience,
                support: fundamentals.support,
                priority: fundamentals.priority,
                populations: fundamentals.populations,
                electionContext: fundamentals.electionContext,
                resolvedLawValue: cloneLawValue(fundamentals.resolvedLawValue),
                requestedLawValue: cloneLawValue(fundamentals.resolvedLawValue),
                difficultyPenalty: fundamentals.difficultyPenalty,
                fundamentalsSignature: getFundamentalsSignature(
                    stateId,
                    catalogue,
                    electionYear,
                    fundamentals
                ),
                turnoutModelVersion: 3,
                applied: false
            };
            store.measures.push(measure);
            simulationCacheKey = "";
            return measure;
        };

        const markFinalResult = measure => {
            if(!measure || ["passed", "notPassed", "applied"].includes(measure.status)) return;
            const yesVotes = Math.max(0, Number(measure.finalYesVotes) || 0);
            const noVotes = Math.max(0, Number(measure.finalNoVotes) || 0);
            const total = yesVotes + noVotes;
            const yesShare = total > 0 ? yesVotes / total : 0;
            const passed = measure.threshold <= 0.5
                ? yesVotes > noVotes
                : yesShare >= measure.threshold;
            measure.status = passed ? "passed" : "notPassed";
            measure.decidedYear = Number(measure.electionYear);
            measure.decidedWeek = 45;
        };

        const syncMeasureTurnout = measure => {
            if(!measure) return;
            const stats = getStateStats(measure.stateId);
            const population = Math.max(1, Number(stats?.pop) || 0);
            const registration = clamp(stats?.regVoters, 0.25, 0.95) || 0;
            const estimatedRegistered = population > 1 && registration > 0
                ? Math.round(population * registration)
                : 0;
            const storedEligible = Math.max(0, Number(measure.eligibleVoters) || 0);
            const eligibleVoters = estimatedRegistered || storedEligible;
            const totalVotes = Math.max(
                0,
                Number(measure.totalVotes)
                    || (Number(measure.finalYesVotes) || 0)
                        + (Number(measure.finalNoVotes) || 0)
            );
            if(eligibleVoters > 0) {
                measure.eligibleVoters = eligibleVoters;
                measure.turnoutPercent = clamp(
                    totalVotes / eligibleVoters * 100,
                    0,
                    100
                );
            }
            measure.turnoutModelVersion = 3;
        };

        const ensureElectionContextTurnout = measure => {
            if(!measure) return;
            if(Number(measure.turnoutModelVersion) < 2 && !measure.applied) {
                const context = getConcurrentElectionContext(
                    measure.stateId,
                    measure.electionYear
                );
                const previousTotal = Math.max(100, Number(measure.totalVotes) || 100);
                const adjustedTotal = Math.max(
                    100,
                    Math.round(previousTotal * context.turnoutMultiplier)
                );
                const yesShare = clamp(
                    Number(measure.yesShare)
                        || Number(measure.finalYesVotes) / previousTotal,
                    0,
                    1
                );
                measure.totalVotes = adjustedTotal;
                measure.finalYesVotes = Math.round(adjustedTotal * yesShare);
                measure.finalNoVotes = adjustedTotal - measure.finalYesVotes;
                measure.electionContext = context;
            }
            syncMeasureTurnout(measure);
            simulationCacheKey = "";
        };

        const applyPassedMeasures = () => {
            const store = getStore();
            if(!store) return;
            const year = getCurrentYear();
            const week = getCurrentWeek();
            store.measures.forEach(measure => {
                refreshScheduledMeasureFundamentals(measure);
                if(
                    measure.status === "scheduled"
                    || (
                        year === Number(measure.electionYear)
                        && week < 45
                        && !measure.applied
                    )
                ) {
                    ensureElectionContextTurnout(measure);
                }
                if(
                    year === Number(measure.electionYear)
                    && week < 45
                    && !measure.applied
                    && ["passed", "notPassed"].includes(measure.status)
                ) {
                    measure.status = "scheduled";
                    delete measure.decidedYear;
                    delete measure.decidedWeek;
                }
                if(
                    measure.status === "scheduled"
                    && !isElectionNightInterfaceActive()
                    && (
                        year > Number(measure.electionYear)
                        || (year === Number(measure.electionYear) && week > 45)
                    )
                ) {
                    markFinalResult(measure);
                }
                if(
                    ["passed", "applied"].includes(measure.status)
                    && (
                        year > Number(measure.applyYear)
                        || (year === Number(measure.applyYear) && week >= 1)
                    )
                ) {
                    const catalogue = findCatalogueEntry(measure.catalogueId);
                    const statsTargets = getStateStatsTargets(measure.stateId);
                    if(catalogue && statsTargets.length) {
                        statsTargets.forEach(stats => {
                            getCatalogueLawChanges(catalogue, stats, measure)
                                .forEach(change => {
                                    setByPath(stats, change.key, change.value);
                                });
                        });
                        if(catalogue.id === "non_partisan_primaries") {
                            const advanceCount = Math.round(
                                clamp(measure.primaryAdvanceCount || 2, 2, 5)
                            );
                            statsTargets.forEach(stats => {
                                [
                                    "nonPartisanAdv",
                                    "advancingCount",
                                    "advanceCount",
                                    "candidatesWhoAdvance"
                                ].forEach(key => {
                                    stats[key] = advanceCount;
                                });
                                ["elections", "electionOptions", "options"].forEach(key => {
                                    if(!stats[key] || typeof stats[key] !== "object") {
                                        stats[key] = {};
                                    }
                                    stats[key].nonPartisanAdv = advanceCount;
                                });
                            });
                            [
                                "nonPartisanAdv",
                                "advancingCount",
                                "advanceCount",
                                "candidatesWhoAdvance",
                                "primaryMaxStH",
                                "primaryMaxStS",
                                "primaryMaxUSH",
                                "primaryMaxUSS",
                                "primaryMaxG"
                            ].forEach(key => {
                                if(typeof globalThis !== "undefined"
                                    && Object.prototype.hasOwnProperty.call(globalThis, key)) {
                                    globalThis[key] = advanceCount;
                                }
                                if(Executive?.mods?.saveData
                                    && Object.prototype.hasOwnProperty.call(Executive.mods.saveData, key)) {
                                    Executive.mods.saveData[key] = advanceCount;
                                }
                            });
                        } else if(catalogue.id === "restore_party_primaries") {
                            statsTargets.forEach(stats => {
                                [
                                    "nonPartisanAdv",
                                    "advancingCount",
                                    "advanceCount",
                                    "candidatesWhoAdvance"
                                ].forEach(key => {
                                    delete stats[key];
                                });
                                ["elections", "electionOptions", "options"].forEach(key => {
                                    if(stats[key] && typeof stats[key] === "object") {
                                        delete stats[key].nonPartisanAdv;
                                    }
                                });
                            });
                        }
                        measure.applied = true;
                        measure.status = "applied";
                        if(!measure.appliedYear) measure.appliedYear = year;
                        if(!measure.appliedWeek) measure.appliedWeek = week;
                    }
                }
            });
        };

        const createElement = (tag, className, text) => {
            const element = document.createElement(tag);
            if(className) element.className = className;
            if(text !== undefined) element.textContent = text;
            return element;
        };

        const formatDollars = value =>
            `$${(Math.round((Number(value) || 0) * 20) / 20).toFixed(2)}`;

        const getMeasureQuestion = (catalogue, measure = null, resolvedLawValue = null) => {
            if(!catalogue) return "";
            if(catalogue.lawKey !== "minWage") return catalogue.question || "";
            const target = Number(
                resolvedLawValue ?? measure?.resolvedLawValue
            );
            if(!Number.isFinite(target) || target <= 0) return catalogue.question || "";
            const direction = catalogue.lawValue === "reduce-minimum-wage"
                ? "reduced"
                : "increased";
            return `Shall the state minimum wage be ${direction} to ${formatDollars(target)}?`;
        };

        const getMinimumWageBounds = (catalogue, stats) => {
            const current = Math.round(clamp(stats?.minWage, 5, 20) * 20) / 20 || 7.25;
            const increasing = catalogue?.lawValue === "increase-minimum-wage";
            const minimum = increasing
                ? Math.min(20, current + 0.05)
                : 5;
            const maximum = increasing
                ? 20
                : Math.max(5, current - 0.05);
            const fallback = increasing
                ? Math.min(20, current + 2.5)
                : Math.max(5, current - 2.5);
            return {
                current,
                minimum: Math.round(minimum * 20) / 20,
                maximum: Math.round(maximum * 20) / 20,
                fallback: Math.round(fallback * 20) / 20,
                increasing,
                available: increasing ? current < 20 : current > 5
            };
        };

        const showMinimumWageTargetPopup = (catalogue, onConfirm) => {
            document.getElementById("bm-min-wage-popup")?.remove();
            const stats = getStateStats(getPlayerState());
            const bounds = getMinimumWageBounds(catalogue, stats);
            const popup = createElement("div", "bm-min-wage-popup");
            popup.id = "bm-min-wage-popup";
            popup.innerHTML = `
                <div class="bm-min-wage-card">
                    <button type="button" class="bm-min-wage-close">X</button>
                    <h2>${catalogue.title}</h2>
                    <p>Current state minimum wage: <strong>${formatDollars(bounds.current)}</strong></p>
                    ${bounds.available ? `
                        <label>
                            Proposed minimum wage
                            <input class="bm-min-wage-range" type="range"
                                min="${bounds.minimum}" max="${bounds.maximum}"
                                step="0.05" value="${bounds.fallback}">
                        </label>
                        <input class="bm-min-wage-number" type="number"
                            min="${bounds.minimum}" max="${bounds.maximum}"
                            step="0.05" value="${bounds.fallback}">
                        <strong class="bm-min-wage-value">${formatDollars(bounds.fallback)}</strong>
                        <div class="bm-min-wage-actions">
                            <button type="button" class="bm-min-wage-cancel">Cancel</button>
                            <button type="button" class="bm-min-wage-apply">Use this amount</button>
                        </div>
                    ` : `
                        <p class="bm-min-wage-unavailable">
                            The current wage is already at the ${bounds.increasing ? "maximum" : "minimum"} allowed by the game.
                        </p>
                        <div class="bm-min-wage-actions">
                            <button type="button" class="bm-min-wage-cancel">Close</button>
                        </div>
                    `}
                </div>
            `;
            const close = () => popup.remove();
            popup.querySelector(".bm-min-wage-close").onclick = close;
            popup.querySelector(".bm-min-wage-cancel").onclick = close;
            const range = popup.querySelector(".bm-min-wage-range");
            const number = popup.querySelector(".bm-min-wage-number");
            const valueLabel = popup.querySelector(".bm-min-wage-value");
            const setValue = value => {
                const rounded = Math.round(clamp(value, bounds.minimum, bounds.maximum) * 20) / 20;
                if(range) range.value = String(rounded);
                if(number) number.value = rounded.toFixed(2);
                if(valueLabel) valueLabel.textContent = formatDollars(rounded);
                return rounded;
            };
            range?.addEventListener("input", () => setValue(range.value));
            number?.addEventListener("input", () => setValue(number.value));
            popup.querySelector(".bm-min-wage-apply")?.addEventListener("click", () => {
                const target = setValue(number?.value ?? range?.value ?? bounds.fallback);
                onConfirm(target);
                close();
            });
            document.getElementById("bm-referendum-modal")?.appendChild(popup);
        };

        const showPrimaryAdvancePopup = onConfirm => {
            document.getElementById("bm-primary-advance-popup")?.remove();
            const popup = createElement("div", "bm-min-wage-popup bm-primary-advance-popup");
            popup.id = "bm-primary-advance-popup";
            popup.innerHTML = `
                <div class="bm-min-wage-card bm-primary-advance-card">
                    <button type="button" class="bm-min-wage-close">X</button>
                    <h2>Non-Partisan Primaries</h2>
                    <p>
                        Select how many candidates advance to the general election.
                        This number must be between <strong>2</strong> and <strong>5</strong>.
                    </p>
                    <label>
                        Candidates advancing
                        <input class="bm-primary-advance-range" type="range"
                            min="2" max="5" step="1" value="2">
                    </label>
                    <input class="bm-primary-advance-number" type="number"
                        min="2" max="5" step="1" value="2">
                    <strong class="bm-primary-advance-value">Top 2</strong>
                    <div class="bm-min-wage-actions">
                        <button type="button" class="bm-min-wage-cancel">Cancel</button>
                        <button type="button" class="bm-min-wage-apply">Use this number</button>
                    </div>
                </div>
            `;
            const close = () => popup.remove();
            popup.querySelector(".bm-min-wage-close").onclick = close;
            popup.querySelector(".bm-min-wage-cancel").onclick = close;
            const range = popup.querySelector(".bm-primary-advance-range");
            const number = popup.querySelector(".bm-primary-advance-number");
            const valueLabel = popup.querySelector(".bm-primary-advance-value");
            const setValue = value => {
                const rounded = Math.round(clamp(Number(value) || 2, 2, 5));
                if(range) range.value = String(rounded);
                if(number) number.value = String(rounded);
                if(valueLabel) valueLabel.textContent = `Top ${rounded}`;
                return rounded;
            };
            range?.addEventListener("input", () => setValue(range.value));
            number?.addEventListener("input", () => setValue(number.value));
            popup.querySelector(".bm-min-wage-apply")?.addEventListener("click", () => {
                const advanceCount = setValue(number?.value ?? range?.value ?? 2);
                onConfirm(advanceCount);
                close();
            });
            document.getElementById("bm-referendum-modal")?.appendChild(popup);
        };

        const removeReferendumModal = () =>
            document.getElementById("bm-referendum-modal")?.remove();

        const showReferendumModal = () => {
            removeReferendumModal();
            const stateId = getPlayerState();
            const year = getCurrentYear();
            const week = getCurrentWeek();
            const store = getStore();
            if(week < 1 || week > 6) {
                return;
            }
            const existing = store?.measures.find(measure =>
                Number(measure.proposedYear) === year
                && String(measure.stateId).toUpperCase() === stateId
                && measure.status !== "withdrawn"
            );
            const backdrop = createElement("div", "bm-referendum-modal", "");
            backdrop.id = "bm-referendum-modal";
            const folder = createElement("div", "bm-referendum-folder");
            backdrop.appendChild(folder);
            const close = createElement("button", "bm-referendum-close", "X");
            close.type = "button";
            close.onclick = removeReferendumModal;
            folder.appendChild(close);
            folder.appendChild(createElement("h1", "", "Referendum"));
            folder.appendChild(createElement(
                "p",
                "bm-referendum-intro",
                `Select one law to place on the ${STATE_NAMES[stateId] || stateId} ballot. Only one measure may be introduced each year.`
            ));
            if(existing) {
                const entry = findCatalogueEntry(existing.catalogueId);
                const notice = createElement("div", "bm-referendum-existing");
                notice.innerHTML = `
                    <strong>Measure already scheduled for ${existing.electionYear}</strong>
                    <span>${entry?.title || existing.catalogueId}</span>
                    <span>${existing.thresholdLabel}</span>
                `;
                folder.appendChild(notice);
            } else {
                const ruleRow = createElement("div", "bm-referendum-rule-row");
                ruleRow.innerHTML = `
                    <strong>Ordinary state law</strong>
                    <span>${getRule(stateId).label}</span>
                    <span>Election: week 45</span>
                `;
                folder.appendChild(ruleRow);
                const feedback = createElement("div", "bm-referendum-feedback");
                feedback.setAttribute("role", "status");
                folder.appendChild(feedback);
                const list = createElement("div", "bm-referendum-law-list");
                folder.appendChild(list);
                let selectedCatalogueId = null;
                let selectedResolvedLawValue = null;
                let selectedPrimaryAdvanceCount = null;
                const updateSelectedReferendum = (
                    catalogueId,
                    resolvedLawValue = null,
                    primaryAdvanceCount = null
                ) => {
                    selectedCatalogueId = catalogueId;
                    selectedResolvedLawValue = resolvedLawValue;
                    selectedPrimaryAdvanceCount = primaryAdvanceCount;
                    const catalogue = findCatalogueEntry(selectedCatalogueId);
                    feedback.textContent = "";
                    list.querySelectorAll(".bm-referendum-law").forEach(card => {
                        const selected = card.dataset.catalogueId === selectedCatalogueId;
                        card.classList.toggle("selected", selected);
                        const cardButton = card.querySelector("[data-select-referendum]");
                        if(cardButton && !cardButton.disabled) {
                            cardButton.textContent = selected ? "Selected" : "Select";
                        }
                    });
                    selectedLabel.textContent = catalogue
                        ? `${catalogue.title}${resolvedLawValue !== null
                            ? ` (${formatDollars(resolvedLawValue)})`
                            : ""}${primaryAdvanceCount !== null
                                ? ` (top ${primaryAdvanceCount})`
                                : ""}`
                        : "None selected";
                    confirm.disabled = !catalogue;
                };
                MEASURE_CATALOGUE.forEach(catalogue => {
                    const card = createElement("article", "bm-referendum-law");
                    card.dataset.catalogueId = catalogue.id;
                    const stateStats = (
                        catalogue.id === "legalize_marijuana"
                        || catalogue.id === "prohibit_marijuana"
                    )
                        ? getCannabisVisibleStateStats(stateId)
                        : getEffectiveStateStats(stateId);
                    const alreadyActive = isCatalogueAlreadyLaw(catalogue, stateStats);
                    const unavailableReason = getCatalogueUnavailableReason(catalogue, stateStats);
                    const minWageBounds = catalogue.lawKey === "minWage"
                        ? getMinimumWageBounds(catalogue, stateStats)
                        : null;
                    const unavailableMinimumWage = minWageBounds
                        ? !minWageBounds.available
                        : false;
                    card.innerHTML = `
                        <div>
                            <small>${catalogue.category}</small>
                            <h2>${catalogue.title}</h2>
                            <p>${catalogue.lawKey === "minWage"
                                ? `${catalogue.question} Select an amount before proposing.`
                                : catalogue.question}</p>
                            ${catalogue.lawKey === "minWage" ? `
                                <p class="bm-referendum-current-law">
                                    Current: ${formatDollars(minWageBounds.current)}
                                </p>
                            ` : ""}
                        </div>
                    `;
                    const select = createElement(
                        "button",
                        "bm-referendum-select",
                        unavailableReason
                            ? unavailableReason
                            : alreadyActive
                                ? "Already law"
                                : unavailableMinimumWage
                                    ? "At limit"
                                    : "Select"
                    );
                    select.type = "button";
                    select.disabled = alreadyActive || Boolean(unavailableReason) || unavailableMinimumWage;
                    select.dataset.selectReferendum = catalogue.id;
                    card.appendChild(select);
                    list.appendChild(card);
                });
                const footer = createElement("div", "bm-referendum-footer");
                footer.innerHTML = `
                    <div class="bm-referendum-selection">
                        <small>Selected law</small>
                        <strong>None selected</strong>
                    </div>
                    <button type="button" class="bm-referendum-cancel">Cancel</button>
                    <button type="button" class="bm-referendum-confirm" disabled>
                        Propose Referendum
                    </button>
                `;
                folder.appendChild(footer);
                const selectedLabel = footer.querySelector(".bm-referendum-selection strong");
                const confirm = footer.querySelector(".bm-referendum-confirm");
                footer.querySelector(".bm-referendum-cancel").onclick = removeReferendumModal;
                list.onclick = event => {
                    const select = event.target.closest("[data-select-referendum]");
                    if(!select || select.disabled) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const catalogueId = select.dataset.selectReferendum;
                    const selectedCatalogue = findCatalogueEntry(catalogueId);
                    if(selectedCatalogue?.lawKey === "minWage") {
                        showMinimumWageTargetPopup(selectedCatalogue, target =>
                            updateSelectedReferendum(catalogueId, target)
                        );
                        return;
                    }
                    if(selectedCatalogue?.id === "non_partisan_primaries") {
                        showPrimaryAdvancePopup(
                            advanceCount => updateSelectedReferendum(
                                catalogueId,
                                null,
                                advanceCount
                            )
                        );
                        return;
                    }
                    updateSelectedReferendum(catalogueId);
                };
                confirm.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    feedback.classList.remove("error", "success");
                    if(!selectedCatalogueId) {
                        feedback.classList.add("error");
                        feedback.textContent = "Select a law before proposing the referendum.";
                        return;
                    }
                    try {
                        const measure = scheduleMeasure(selectedCatalogueId, {
                            resolvedLawValue: selectedResolvedLawValue,
                            primaryAdvanceCount: selectedPrimaryAdvanceCount
                        });
                        const catalogue = findCatalogueEntry(selectedCatalogueId);
                        feedback.classList.add("success");
                        feedback.textContent =
                            `${catalogue.title} has been scheduled for week 45 of ${measure.electionYear}.`;
                        confirm.disabled = true;
                        list.querySelectorAll("button").forEach(button => button.disabled = true);
                        setTimeout(removeReferendumModal, 900);
                    } catch(error) {
                        feedback.classList.add("error");
                        feedback.textContent = error?.message || String(error);
                    }
                };
                list.scrollTop = 0;
            }
            document.body.appendChild(backdrop);
        };

        const getPlayerJobIds = () => {
            try {
                return Object.values(Executive.data.characters.player.jobs || {})
                    .map(job => String(job?.id || ""))
                    .filter(Boolean);
            } catch {
                return [];
            }
        };

        const canPlayerProposeReferendum = () => {
            const eligibleJobs = new Set([
                "stateHouse",
                "stateSenate",
                "governor"
            ]);
            return getPlayerJobIds().some(jobId => eligibleJobs.has(jobId));
        };

        const canIntroduceReferendumThisWeek = () => {
            const week = getCurrentWeek();
            return week >= 1 && week <= 6;
        };

        const installReferendumButton = args => {
            setTimeout(() => {
                const lawObject = args?.[0];
                activeLegislationObject = lawObject || null;
                const sidebar = document.getElementById("compBillEffInfoD");
                const supportedEditor = lawObject?.district === "state"
                    || lawObject?.district === "nation";
                if(!sidebar || !supportedEditor || !canPlayerProposeReferendum()) return;
                const updateReferendumButtonState = button => {
                    const enabled = canIntroduceReferendumThisWeek();
                    button.disabled = !enabled;
                    button.title = enabled
                        ? "Place one state law on the next annual general-election ballot."
                        : "Referendums can only be introduced between weeks 1 and 6.";
                    button.classList.toggle("bm-referendum-disabled", !enabled);
                };
                const alignSubmitLegislationButton = () =>
                    Array.from(document.querySelectorAll("button"))
                        .filter(candidate =>
                            /^submit legislation$/i.test(
                                String(candidate.textContent || "").trim()
                            ))
                        .forEach(candidate =>
                            candidate.classList.add("bm-legislation-submit-button")
                        );
                if(document.getElementById("compBillReferendumB")) {
                    updateReferendumButtonState(document.getElementById("compBillReferendumB"));
                    alignSubmitLegislationButton();
                    return;
                }
                const button = createElement("button", "compBillEffB", "Referendum");
                button.id = "compBillReferendumB";
                button.type = "button";
                updateReferendumButtonState(button);
                button.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(button.disabled || !canIntroduceReferendumThisWeek()) return;
                    if(options.playClick) options.playClick();
                    else callRuntimeFunction("playClick");
                    showReferendumModal();
                };
                const firstButton = sidebar.querySelector("button");
                if(firstButton) sidebar.insertBefore(button, firstButton);
                else sidebar.appendChild(button);
                alignSubmitLegislationButton();
            }, 0);
        };

        const getStateReportingWindow = (measure, maximum) => {
            const stats = getStateStats(measure?.stateId);
            let pollClose = Number(
                stats?.pollClose
                    ?? stats?.electInfo?.pollClose
            );
            if(!Number.isFinite(pollClose)) pollClose = 200;
            pollClose = clamp(pollClose, 0, Math.max(0, maximum - 1));
            const availableTime = Math.max(1, maximum - pollClose);
            const completionShare = 0.78
                + seededUnit(`${measure?.stateId}|${measure?.electionYear}|reporting-window`) * 0.12;
            return {
                pollClose,
                completionTime: Math.min(
                    maximum,
                    pollClose + availableTime * completionShare
                )
            };
        };

        const resetElectionNightReportingRuntime = (measureId = reportingMeasureId) => {
            reportingMeasureId = String(measureId || "");
            maximumObservedReporting = 0;
            lastElectionNightTime = null;
            lastElectionNightMaximum = null;
        };

        const restoreUndecidedLiveMeasure = (measure, reporting) => {
            if(
                !measure
                || measure.applied === true
                || reporting >= 0.999999
                || Number(measure.electionYear) !== getCurrentYear()
                || getCurrentWeek() !== 45
                || !["passed", "notPassed"].includes(measure.status)
            ) {
                return;
            }

            measure.status = "scheduled";
            delete measure.decidedYear;
            delete measure.decidedWeek;
        };

        const getReporting = () => {
            const time = Number(
                options.getElectionNightTime?.()
                    ?? readRuntimeValue("electNightTime")
            );
            const maximum = Number(
                options.getElectionNightMaxTime?.()
                    ?? readRuntimeValue("electNightMaxTime")
            );
            const measure = getScheduledMeasureForYear(getCurrentYear())
                || getMeasureById(activeMeasureId);
            const measureId = String(measure?.id || activeMeasureId || "");
            if(reportingMeasureId !== measureId) {
                resetElectionNightReportingRuntime(measureId);
            }
            const electionNightActive = isElectionNightInterfaceActive();
            const hasElectionNightClock = electionNightActive
                && Number.isFinite(time)
                && Number.isFinite(maximum)
                && maximum > 0;
            if(electionNightActive && !electionNightSessionActive) {
                resetElectionNightReportingRuntime(measureId);
            }
            if(
                hasElectionNightClock
                && (
                    (Number.isFinite(lastElectionNightTime) && time < lastElectionNightTime - 0.001)
                    || (
                        Number.isFinite(lastElectionNightMaximum)
                        && Math.abs(maximum - lastElectionNightMaximum) > 0.001
                    )
                )
            ) {
                resetElectionNightReportingRuntime(measureId);
            }
            electionNightSessionActive = electionNightActive;
            let reporting = 0;
            if(hasElectionNightClock && measure) {
                const window = getStateReportingWindow(measure, maximum);
                reporting = time <= window.pollClose
                    ? 0
                    : clamp(
                        (time - window.pollClose)
                            / Math.max(1, window.completionTime - window.pollClose),
                        0,
                        1
                    );
                lastElectionNightTime = time;
                lastElectionNightMaximum = maximum;
            }
            if(
                !hasElectionNightClock
                && !electionNightActive
                && ["passed", "notPassed", "applied"].includes(measure?.status)
            ) {
                reporting = 1;
            }
            maximumObservedReporting = Math.max(
                maximumObservedReporting,
                reporting
            );
            restoreUndecidedLiveMeasure(measure, maximumObservedReporting);
            return maximumObservedReporting;
        };

        const getSvgText = (folder, stateId) => {
            const key = `${folder}|${stateId}`;
            if(svgTextCache.has(key)) return svgTextCache.get(key);
            const file = path.join(
                basePath,
                "data",
                folder,
                `${String(stateId || "").trim().toLowerCase()}.svg`
            );
            if(!fs.existsSync(file)) return null;
            const text = fs.readFileSync(file, "utf8");
            svgTextCache.set(key, text);
            return text;
        };

        const parseSvg = text => {
            if(!text) return null;
            const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
            const svg = documentNode.documentElement;
            if(svg?.localName !== "svg") return null;
            const width = Number(svg.getAttribute("width")) || 810;
            const height = Number(svg.getAttribute("height")) || 810;
            if(!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
            svg.removeAttribute("width");
            svg.removeAttribute("height");
            return document.importNode(svg, true);
        };

        const buildSimulation = measure => {
            const cacheKey = `${measure.id}|${measure.finalYesVotes}|${measure.finalNoVotes}`;
            if(simulationCacheKey === cacheKey && simulationCache) return simulationCache;
            const support = measure.support || { dem: 50, rep: 50, ind: 50 };
            const stateStats = getStateStats(measure.stateId);
            const countyDefinitions = measure.stateId === "DC"
                ? Array.from({ length: 8 }, (_unused, index) => ({
                    name: `Ward ${index + 1}`,
                    pop: (Number(stateStats?.pop) || 700000) / 8,
                    regVoters: stateStats?.regVoters,
                    generalTurnout: stateStats?.generalTurnout,
                    demPop: clamp(
                        Number(stateStats?.demPop)
                            + (seededUnit(`DC|ward|${index + 1}`) - 0.5) * 0.1,
                        0,
                        1
                    ),
                    repPop: stateStats?.repPop,
                    indPop: stateStats?.indPop
                }))
                : Array.isArray(stateStats?.counties)
                    ? stateStats.counties
                    : [];
            const countyWeights = countyDefinitions.map(county => {
                const population = Math.max(1, Number(county?.pop) || 1);
                const registration = clamp(county?.regVoters, 0.2, 0.95) || 0.55;
                const turnout = clamp(county?.generalTurnout, 0.2, 0.95) || 0.6;
                return population * registration * turnout;
            });
            const countyRawProbabilities = countyDefinitions.map(county => {
                const dem = clamp(county?.demPop, 0, 1);
                const rep = clamp(county?.repPop, 0, 1);
                const ind = clamp(county?.indPop, 0, 1);
                const partyTotal = dem + rep + ind || 1;
                return clamp(
                    (
                        dem * support.dem
                        + rep * support.rep
                        + ind * support.ind
                    ) / partyTotal / 100,
                    0.015,
                    0.985
                );
            });
            const countyProbabilities = calibrateProbabilities(
                countyRawProbabilities,
                countyWeights,
                measure.yesShare
            );
            const countyTotals = allocateIntegers(countyWeights, measure.totalVotes);
            const countyExpectedYes = countyTotals.map(
                (total, index) => total * countyProbabilities[index]
            );
            const countyYes = allocateIntegers(
                countyExpectedYes,
                measure.finalYesVotes
            );
            let countyOverflow = 0;
            countyYes.forEach((yesVotes, index) => {
                if(yesVotes > countyTotals[index]) {
                    countyOverflow += yesVotes - countyTotals[index];
                    countyYes[index] = countyTotals[index];
                }
            });
            if(countyOverflow > 0) {
                countyDefinitions
                    .map((_county, index) => ({
                        index,
                        capacity: countyTotals[index] - countyYes[index],
                        probability: countyProbabilities[index]
                    }))
                    .sort((a, b) => b.probability - a.probability)
                    .forEach(entry => {
                        if(countyOverflow <= 0) return;
                        const addition = Math.min(entry.capacity, countyOverflow);
                        countyYes[entry.index] += addition;
                        countyOverflow -= addition;
                    });
            }
            const counties = countyDefinitions.map((county, index) => {
                const name = String(county?.name || `County ${index + 1}`)
                    .replace(/\s+County$/i, "")
                    .replace(/\s+Parish$/i, "");
                const totalVotes = countyTotals[index];
                const population = Math.max(1, Number(county?.pop) || 1);
                const registration = clamp(county?.regVoters, 0.2, 0.95) || 0.55;
                const eligibleVoters = Math.max(1, Math.round(population * registration));
                const yesVotes = countyYes[index];
                const noVotes = totalVotes - yesVotes;
                const yesPercent = totalVotes > 0 ? yesVotes / totalVotes * 100 : 0;
                return {
                    name,
                    key: normalizeName(name),
                    totalVotes,
                    eligibleVoters,
                    turnoutPercent: totalVotes / eligibleVoters * 100,
                    yesVotes,
                    noVotes,
                    yesPercent,
                    noPercent: totalVotes > 0 ? noVotes / totalVotes * 100 : 0,
                    winner: yesVotes > noVotes
                        ? "yes"
                        : noVotes > yesVotes
                            ? "no"
                            : "tie",
                    margin: totalVotes > 0
                        ? Math.abs(yesVotes - noVotes) / totalVotes * 100
                        : 0
                };
            });
            const countyMap = new Map(counties.map(county => [county.key, county]));
            simulationCache = { counties, countyMap };
            simulationCacheKey = cacheKey;
            return simulationCache;
        };

        const getDisplayResult = (result, reporting) => {
            const reportedTotal = Math.round(result.totalVotes * reporting);
            const finalYesShare = result.totalVotes > 0
                ? result.yesVotes / result.totalVotes
                : 0;
            const earlyLean = (seededUnit(`${result.name || result.id}|report`) - 0.5)
                * 0.18
                * Math.pow(1 - reporting, 0.72);
            const yesShare = clamp(finalYesShare + earlyLean, 0, 1);
            const yesVotes = Math.round(reportedTotal * yesShare);
            const noVotes = reportedTotal - yesVotes;
            return {
                ...result,
                totalVotes: reportedTotal,
                yesVotes,
                noVotes,
                yesPercent: reportedTotal > 0 ? yesVotes / reportedTotal * 100 : 0,
                noPercent: reportedTotal > 0 ? noVotes / reportedTotal * 100 : 0,
                winner: yesVotes > noVotes ? "yes" : noVotes > yesVotes ? "no" : "tie",
                margin: reportedTotal > 0
                    ? Math.abs(yesVotes - noVotes) / reportedTotal * 100
                    : 0
            };
        };

        const getUnitReporting = (measure, result, globalReporting) => {
            const reporting = clamp(globalReporting, 0, 1);
            if(reporting <= 0) return 0;
            if(reporting >= 0.999999) return 1;
            const identity = `${measure.id}|${result.name || result.id}`;
            const voteShare = clamp(
                (Number(result.totalVotes) || 0)
                    / Math.max(1, Number(measure.totalVotes) || 1),
                0,
                0.45
            );
            const largeCountyDrag = clamp(voteShare * 7, 0, 1.35);
            const openingReport = Math.max(
                0.025,
                0.10
                    - largeCountyDrag * 0.045
                    + seededUnit(`${identity}|opening-report`) * 0.045
            );
            const exponent = 0.58
                + seededUnit(`${identity}|speed`) * 0.72
                + largeCountyDrag;
            return clamp(
                openingReport
                    + (1 - openingReport) * Math.pow(reporting, exponent),
                openingReport,
                0.995
            );
        };

        const getCallStatus = (measure, snapshot) => {
            if(snapshot.reporting >= 0.999999) {
                const passed = snapshot.yesVotes > snapshot.noVotes;
                return {
                    key: passed ? "passed" : "failed",
                    text: passed ? "PASSED" : "NOT PASSED",
                    symbol: passed ? "✓" : "✕"
                };
            }
            if((Number(snapshot.totalVotes) || 0) <= 0 || snapshot.reporting <= 0) {
                return {
                    key: "not-started",
                    text: "",
                    symbol: ""
                };
            }
            if(snapshot.reporting < 0.10) {
                return {
                    key: "counting",
                    text: "",
                    symbol: ""
                };
            }
            const margin = Math.abs(snapshot.yesPercent - snapshot.noPercent);
            if(snapshot.reporting < 0.65) {
                return {
                    key: "too-early",
                    text: "TOO EARLY TO CALL",
                    symbol: ""
                };
            }
            const start = 0.65;
            const end = 0.95;
            const maxThreshold = 5.0;
            const minThreshold = 1.5;
            const progress = clamp((snapshot.reporting - start) / (end - start), 0, 1);
            const threshold = minThreshold
                + (maxThreshold - minThreshold) * (1 - Math.pow(progress, 1.8));
            const close = margin <= threshold;
            return {
                key: close ? "too-close" : "counting",
                text: close ? "TOO CLOSE TO CALL" : "",
                symbol: ""
            };
        };

        const formatReportingPercent = reporting => {
            const percent = clamp(reporting, 0, 1) * 100;
            if(percent >= 99.9999) return "100%";
            return `${percent.toFixed(1)}%`;
        };

        const decisionIcon = passed => passed
            ? `
                <em class="bm-ballot-decision-icon yes" aria-label="Passed">
                    <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true">
                        <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                    </svg>
                </em>
            `
            : `
                <em class="bm-ballot-decision-icon no" aria-label="Not passed">
                    <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true">
                        <line x1="3" y1="3" x2="11" y2="11"></line>
                        <line x1="11" y1="3" x2="3" y2="11"></line>
                    </svg>
                </em>
            `;

        const buildStateSnapshot = (measure, globalReporting) => {
            const simulation = buildSimulation(measure);
            let yesVotes = 0;
            let noVotes = 0;
            const countySnapshots = new Map();
            simulation.counties.forEach(county => {
                const reporting = getUnitReporting(measure, county, globalReporting);
                const display = getDisplayResult(county, reporting);
                countySnapshots.set(county.key, { ...display, reporting });
                yesVotes += display.yesVotes;
                noVotes += display.noVotes;
            });
            const totalVotes = yesVotes + noVotes;
            const expectedVotes = Math.max(1, Number(measure.totalVotes) || 1);
            const reporting = clamp(totalVotes / expectedVotes, 0, 1);
            const snapshot = {
                name: measure.stateName,
                totalVotes,
                expectedVotes,
                remainingVotes: Math.max(0, expectedVotes - totalVotes),
                reporting,
                yesVotes,
                noVotes,
                yesPercent: totalVotes > 0 ? yesVotes / totalVotes * 100 : 0,
                noPercent: totalVotes > 0 ? noVotes / totalVotes * 100 : 0,
                winner: yesVotes > noVotes ? "yes" : noVotes > yesVotes ? "no" : "tie",
                margin: totalVotes > 0
                    ? Math.abs(yesVotes - noVotes) / totalVotes * 100
                    : 0,
                turnoutPercent: Number(measure.turnoutPercent) || 0,
                countySnapshots
            };
            snapshot.call = getCallStatus(measure, snapshot);
            return snapshot;
        };

        const hasBallotStateStartedCounting = snapshot =>
            Number(snapshot?.totalVotes) > 0 && Number(snapshot?.reporting) > 0;

        const ensureTooltip = () => {
            if(tooltip?.isConnected) return tooltip;
            tooltip = createElement("div", "bm-ballot-tooltip");
            tooltip.id = "bm-ballot-tooltip";
            document.body.appendChild(tooltip);
            return tooltip;
        };

        const hideTooltip = () => {
            if(tooltip) tooltip.style.display = "none";
        };

        const positionBallotTooltip = (event, node) => {
            const width = node.offsetWidth || 520;
            const height = node.offsetHeight || 260;
            let left = event.clientX + 14;
            let top = event.clientY + 14;
            if(left + width > window.innerWidth - 8) left = event.clientX - width - 14;
            if(top + height > window.innerHeight - 8) top = event.clientY - height - 14;
            node.style.left = `${Math.max(8, left)}px`;
            node.style.top = `${Math.max(8, top)}px`;
        };

        const showInactiveStateTooltip = (event, stateId) => {
            const node = ensureTooltip();
            node.classList.add("inactive");
            node.classList.remove(
                "not-counting",
                "complete",
                "state-result",
                "local-result",
                "with-expected"
            );
            node.style.removeProperty("--bm-ballot-result-colour");
            node.innerHTML = `
                <div class="bm-ballot-tooltip-title">
                    <small>Ballot Measure</small>
                    <strong>${STATE_NAMES[stateId] || stateId}</strong>
                    <span>No ballot measures to vote on.</span>
                </div>
            `;
            node.style.display = "block";
            positionBallotTooltip(event, node);
        };

        const showNotCountingTooltip = (event, stateName) => {
            const node = ensureTooltip();
            node.classList.add("not-counting");
            node.classList.remove(
                "inactive",
                "complete",
                "state-result",
                "local-result",
                "with-expected"
            );
            node.style.removeProperty("--bm-ballot-result-colour");
            node.innerHTML = `
                <div class="bm-ballot-not-counting-card">
                    <small>${String(stateName || "This state").toUpperCase()}</small>
                    <strong>This state has not begun counting yet.</strong>
                </div>
            `;
            node.style.display = "block";
            positionBallotTooltip(event, node);
        };

        const showResultTooltip = (
            event,
            result,
            reporting,
            label,
            measure,
            precomputed = false
        ) => {
            const display = precomputed ? result : getDisplayResult(result, reporting);
            const expectedVotes = precomputed
                ? Number(display.expectedVotes) || Number(measure?.totalVotes) || 0
                : Number(result.totalVotes) || 0;
            const reportedVotes = Number(display.totalVotes) || 0;
            const expectedReporting = expectedVotes > 0
                ? clamp(reportedVotes / expectedVotes, 0, 1)
                : 0;
            if(label === "State" && expectedReporting <= 0) {
                showNotCountingTooltip(event, result.name || measure?.stateName);
                return;
            }
            const call = label === "State"
                ? (display.call || getCallStatus(measure, {
                    ...display,
                    reporting: expectedReporting
                }))
                : {
                    key: String(label || "result").toLowerCase(),
                    text: `${String(label || "Result").toUpperCase()} RESULT`,
                    symbol: ""
                };
            const turnout = Number(result.turnoutPercent);
            const showTurnout = expectedReporting >= 0.999999
                && Number.isFinite(turnout);
            const isStateResult = label === "State";
            const node = ensureTooltip();
            node.classList.remove("inactive");
            node.classList.remove("not-counting");
            node.classList.toggle("complete", expectedReporting >= 0.999999);
            node.classList.toggle("state-result", isStateResult);
            node.classList.toggle("local-result", !isStateResult);
            const complete = expectedReporting >= 0.999999;
            node.classList.remove("with-expected");
            const winner = display.yesVotes > display.noVotes ? "yes" : "no";
            const marginVotes = Math.abs(display.yesVotes - display.noVotes);
            const margin = reportedVotes > 0
                ? marginVotes / reportedVotes * 100
                : 0;
            if(isStateResult) {
                node.style.setProperty(
                    "--bm-ballot-result-colour",
                    winner === "no" ? "var(--bm-ballot-no)" : "var(--bm-ballot-yes)"
                );
            } else {
                node.style.removeProperty("--bm-ballot-result-colour");
            }
            const tooltipResponses = [
                { key: "yes", label: "Yes", votes: display.yesVotes, percent: display.yesPercent },
                { key: "no", label: "No", votes: display.noVotes, percent: display.noPercent }
            ].sort((responseA, responseB) =>
                responseB.votes - responseA.votes
                || (responseA.key === "yes" ? -1 : 1)
            );
            const tooltipResponseRows = tooltipResponses.map((response, index) => {
                const responseWon = isStateResult
                    && complete
                    && winner === response.key;
                return `
                    <tr class="${responseWon ? `winner-row ${response.key}` : ""}">
                        ${index === 0 ? `
                            <td class="bm-ballot-tooltip-state" rowspan="2">
                                <strong>${isStateResult
                                    ? String(result.name || "").toUpperCase()
                                    : result.name}</strong>
                                <span>${formatReportingPercent(expectedReporting)} in</span>
                                <small>Margin: ${formatVotes(marginVotes)} (${margin.toFixed(2)}%)</small>
                            </td>
                        ` : ""}
                        <td class="bm-ballot-tooltip-candidate ${response.key} ${responseWon ? "winner" : ""}">
                            <i></i><b>${response.label}</b>${responseWon
                                ? decisionIcon(response.key === "yes")
                                : ""}
                        </td>
                        <td class="bm-ballot-tooltip-votes">${formatVotes(response.votes)}</td>
                        <td class="bm-ballot-tooltip-pct">${response.percent.toFixed(2)}%</td>
                    </tr>
                `;
            }).join("");
            node.innerHTML = `
                ${isStateResult && call.text ? `
                    <div class="bm-ballot-tooltip-status ${call.key}">
                        <span>${call.text}</span>
                        ${complete ? decisionIcon(call.key === "passed") : ""}
                    </div>
                ` : ""}
                ${showTurnout
                    ? `<div class="bm-ballot-tooltip-turnout">Turnout: ${turnout.toFixed(1)}%</div>`
                    : ""}
                <div class="bm-ballot-tooltip-layout">
                    <table class="bm-ballot-tooltip-table">
                        <colgroup>
                            <col class="bm-ballot-tooltip-label-col">
                            <col class="bm-ballot-tooltip-response-col">
                            <col class="bm-ballot-tooltip-votes-col">
                            <col class="bm-ballot-tooltip-pct-col">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>${label}</th>
                                <th>Response</th>
                                <th>Votes</th>
                                <th>Pct.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tooltipResponseRows}
                            ${complete ? `
                                <tr class="bm-ballot-tooltip-total">
                                    <td></td>
                                    <td>Total reported</td>
                                    <td>${formatVotes(reportedVotes)}</td>
                                    <td></td>
                                </tr>
                            ` : ""}
                        </tbody>
                    </table>
                </div>
            `;
            node.style.display = "block";
            positionBallotTooltip(event, node);
        };

        const colourForResult = (result, mode) => {
            if(!result || result.totalVotes <= 0 || result.winner === "tie") return NEUTRAL_COLOUR;
            const base = result.winner === "yes" ? YES_COLOUR : NO_COLOUR;
            return mode === "winner"
                ? base
                : mixWithWhite(base, marginStrength(result.margin));
        };

        const renderNationalMap = (host, measure, reporting, mode) => {
            const svg = parseSvg(getSvgText("", "presidential"));
            if(!svg) {
                host.textContent = "The national ballot-measure map is unavailable.";
                return;
            }
            svg.classList.add("bm-ballot-map-svg", "bm-ballot-national-svg");
            const snapshot = buildStateSnapshot(measure, reporting);
            Object.keys(STATE_NAMES).forEach(stateId => {
                const state = svg.querySelector(`[id="${stateId}"]`);
                if(!state) return;
                const hasMeasure = stateId === measure.stateId;
                const canEnterState = hasMeasure && hasBallotStateStartedCounting(snapshot);
                state.style.fill = hasMeasure
                    ? colourForResult(snapshot, mode)
                    : "#c8c9ca";
                state.style.stroke = hasMeasure ? "#ffd60c" : "#ffffff";
                state.style.strokeWidth = hasMeasure ? "2.6" : "1";
                state.style.cursor = canEnterState ? "pointer" : "default";
                const show = event => {
                    if(hasMeasure) {
                        showResultTooltip(
                            event,
                            snapshot,
                            snapshot.reporting,
                            "State",
                            measure,
                            true
                        );
                    } else {
                        showInactiveStateTooltip(event, stateId);
                    }
                };
                state.addEventListener("mouseenter", show);
                state.addEventListener("mousemove", show);
                state.addEventListener("mouseleave", hideTooltip);
                if(hasMeasure) {
                    state.addEventListener("click", event => {
                        event.preventDefault();
                        event.stopPropagation();
                        if(!hasBallotStateStartedCounting(snapshot)) {
                            showResultTooltip(
                                event,
                                snapshot,
                                snapshot.reporting,
                                "State",
                                measure,
                                true
                            );
                            return;
                        }
                        activeMapLevel = "state";
                        activeMapMode = "winner";
                        lastRenderedReporting = -1;
                        hideTooltip();
                        renderBallotOverlay(true);
                    });
                }
            });
            host.appendChild(svg);
        };

        const renderCountyMap = (host, measure, reporting, mode) => {
            const simulation = buildSimulation(measure);
            const stateSnapshot = buildStateSnapshot(measure, reporting);
            const svg = parseSvg(getSvgText("counties", measure.stateId));
            if(!svg) {
                host.textContent = `County map unavailable for ${measure.stateName}.`;
                return;
            }
            svg.classList.add("bm-ballot-map-svg");
            const byCounty = new Map();
            simulation.counties.forEach(county => {
                byCounty.set(county.key, county);
                const withoutCity = county.key.replace(/\s+city$/, "");
                if(withoutCity && !byCounty.has(withoutCity)) {
                    byCounty.set(withoutCity, county);
                }
                if(!county.key.endsWith(" city") && !byCounty.has(`${county.key} city`)) {
                    byCounty.set(`${county.key} city`, county);
                }
            });
            svg.querySelectorAll("path[id], polygon[id]").forEach(element => {
                let county = null;
                const elementKeys = getCountyElementKeys(element);
                for(const key of elementKeys) {
                    county = getCountyLookupCandidates(key)
                        .map(candidate => byCounty.get(candidate))
                        .find(Boolean);
                    if(county) break;
                }
                if(!county) return;
                const countySnapshot = stateSnapshot.countySnapshots.get(county.key);
                const countyReporting = countySnapshot?.reporting
                    ?? getUnitReporting(measure, county, reporting);
                const display = countySnapshot || getDisplayResult(county, countyReporting);
                element.style.fill = colourForResult(display, mode);
                element.style.stroke = "#ffffff";
                element.style.strokeWidth = "1.4";
                element.style.cursor = "default";
                element.addEventListener("mouseenter", event =>
                    showResultTooltip(
                        event,
                        county,
                        countyReporting,
                        "County",
                        measure
                    ));
                element.addEventListener("mousemove", event =>
                    showResultTooltip(
                        event,
                        county,
                        countyReporting,
                        "County",
                        measure
                    ));
                element.addEventListener("mouseleave", hideTooltip);
            });
            host.appendChild(svg);
        };

        const renderMeasureSummary = (host, measure, reporting) => {
            const catalogue = findCatalogueEntry(measure.catalogueId);
            const snapshot = buildStateSnapshot(measure, reporting);
            const complete = isElectionNightInterfaceActive()
                ? snapshot.reporting >= 0.999999
                : snapshot.reporting >= 0.999999
                    || ["passed", "notPassed", "applied"].includes(measure.status);
            if(complete && measure.status === "scheduled") markFinalResult(measure);
            const passed = ["passed", "applied"].includes(measure.status);
            const call = complete
                ? {
                    key: passed ? "passed" : "failed",
                    text: passed ? "PASSED" : "NOT PASSED",
                    symbol: passed ? "&#10003;" : "&#10005;"
                }
                : snapshot.call;
            const summaryResponses = [
                { key: "yes", label: "Yes", votes: snapshot.yesVotes, percent: snapshot.yesPercent },
                { key: "no", label: "No", votes: snapshot.noVotes, percent: snapshot.noPercent }
            ].sort((responseA, responseB) =>
                responseB.votes - responseA.votes
                || (responseA.key === "yes" ? -1 : 1)
            );
            const summaryResponseRows = summaryResponses.map(response => {
                const responseWon = complete
                    && (
                        (response.key === "yes" && passed)
                        || (response.key === "no" && !passed)
                    );
                return `
                    <div class="bm-ballot-response ${response.key} ${responseWon ? "winner" : ""}">
                        <span><i></i>${response.label} ${responseWon
                            ? decisionIcon(response.key === "yes")
                            : ""}</span>
                        <b>${formatVotes(response.votes)}</b>
                        <strong>${response.percent.toFixed(1)}%</strong>
                    </div>
                `;
            }).join("");
            host.innerHTML = `
                ${call.text ? `
                    <div class="bm-ballot-status ${call.key}">
                        <span>${call.text}</span>
                        ${complete ? decisionIcon(passed) : ""}
                    </div>
                ` : ""}
                <div class="bm-ballot-measure-heading">
                    <small>${measure.stateName}</small>
                    <h2>${catalogue?.title || measure.catalogueId}</h2>
                    <p>${getMeasureQuestion(catalogue, measure)}</p>
                    <b>${measure.thresholdLabel}</b>
                </div>
                <div class="bm-ballot-response-header">
                    <span>Response</span><span>Votes</span><span>Pct.</span>
                </div>
                ${summaryResponseRows}
                <div class="bm-ballot-reporting">
                    <span>${formatReportingPercent(snapshot.reporting)} expected votes in</span>
                    ${complete
                        ? `<b>Turnout: ${(Number(measure.turnoutPercent) || 0).toFixed(1)}%</b>`
                        : ""}
                    <div><i style="width:${(snapshot.reporting * 100).toFixed(2)}%"></i></div>
                </div>
                <div class="bm-ballot-effective">
                    ${complete && passed
                        ? `Approved by voters in ${measure.electionYear}; the new law takes effect in week 1 of ${measure.applyYear}.`
                        : complete
                            ? `Voters rejected the proposal in ${measure.electionYear}; state law will not change.`
                            : `Election night ${measure.electionYear}`}
                </div>
            `;
        };

        const renderBallotOverlay = (force = false) => {
            if(!overlay?.isConnected || !activeMeasureId) return;
            const measure = getMeasureById(activeMeasureId);
            if(!measure) return;
            const reporting = getReporting();
            if(!force && Math.abs(reporting - lastRenderedReporting) < 0.002) return;
            lastRenderedReporting = reporting;
            const mapHost = overlay.querySelector(".bm-ballot-map-host");
            const summaryHost = overlay.querySelector(".bm-ballot-summary");
            if(!mapHost || !summaryHost) return;
            if(activeMapLevel === "county") {
                activeMapLevel = "state";
                activeCountyKey = "";
                activeCountyName = "";
            }
            mapHost.textContent = "";
            overlay.classList.toggle("national", activeMapLevel === "national");
            overlay.classList.toggle("county", activeMapLevel === "county");
            if(activeMapLevel === "national") {
                renderNationalMap(mapHost, measure, reporting, activeMapMode);
            } else {
                renderCountyMap(mapHost, measure, reporting, activeMapMode);
            }
            renderMeasureSummary(summaryHost, measure, reporting);
            const countyLabel = overlay.querySelector(".bm-ballot-county-label");
            if(countyLabel) countyLabel.textContent = `County: ${activeCountyName}`;
            overlay.querySelectorAll("[data-ballot-map-mode]").forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.ballotMapMode === activeMapMode
                );
            });
            syncBallotTabSelection();
        };

        const syncBallotTabSelection = () => {
            if(!overlay?.isConnected || !activeMeasureId) return;
            const tabs = document.getElementById("electNightTabDiv");
            const ballotTab = document.getElementById("bm-elect-night-tab");
            if(!tabs || !ballotTab) return;
            Array.from(tabs.querySelectorAll("button"))
                .filter(candidate => candidate !== ballotTab)
                .forEach(candidate => {
                    if(candidate.classList.contains("electNightTabO")) {
                        candidate.classList.remove("electNightTabO");
                        candidate.classList.add("electNightTabC");
                    }
                });
            if(!ballotTab.classList.contains("electNightTabO")) {
                ballotTab.classList.remove("electNightTabC");
                ballotTab.classList.add("electNightTabO");
            }
        };

        const normalizeElectionNightCloseButton = () => {
            const skipButton = Array.from(document.querySelectorAll("button"))
                .find(button => /skip to end/i.test(button.textContent || ""));
            const controls = skipButton?.parentElement;
            if(!controls) return;
            const closeButton = Array.from(controls.querySelectorAll("button"))
                .find(button =>
                    button !== skipButton
                    && (
                        button.classList.contains("bm-election-night-close-normalized")
                        || /^[x×]$/i.test(String(button.textContent || "").trim())
                    )
                );
            if(!closeButton) return;
            if(closeButton.querySelector("svg")) return;
            closeButton.innerHTML = `
                <svg viewBox="0 0 18 18" aria-hidden="true">
                    <line x1="4" y1="4" x2="14" y2="14"></line>
                    <line x1="14" y1="4" x2="4" y2="14"></line>
                </svg>
            `;
            closeButton.setAttribute("aria-label", "Close");
            closeButton.classList.add("bm-election-night-close-normalized");
        };

        const closeBallotOverlay = () => {
            overlay?.remove();
            overlay = null;
            activeMeasureId = null;
            hideTooltip();
            document.getElementById("bm-elect-night-tab")?.classList.remove("electNightTabO");
            document.getElementById("bm-elect-night-tab")?.classList.add("electNightTabC");
        };

        const openBallotOverlay = (measure, preserveView = false) => {
            closeBallotOverlay();
            activeMeasureId = measure.id;
            if(!preserveView) {
                activeMapMode = "winner";
                activeMapLevel = "national";
                activeCountyKey = "";
                activeCountyName = "";
                previousStateMapMode = "winner";
            }
            lastRenderedReporting = -1;
            const electionNight = document.getElementById("electNightDiv");
            if(!electionNight) return;
            overlay = createElement("section", "bm-ballot-election-overlay");
            overlay.id = "bm-ballot-election-overlay";
            overlay.innerHTML = `
                <div class="bm-ballot-election-title">
                    <h1>${measure.electionYear} Ballot Measure</h1>
                    <span>${measure.stateName}</span>
                </div>
                <div class="bm-ballot-election-grid">
                    <div class="bm-ballot-map-panel">
                        <div class="bm-ballot-map-controls">
                            <button class="bm-ballot-return-national" type="button">
                                Return to U.S. Map
                            </button>
                            <button class="bm-ballot-return-state" type="button">
                                Return to State Map
                            </button>
                            <span class="bm-ballot-county-label"></span>
                            <button data-ballot-map-mode="winner">Winner</button>
                            <button data-ballot-map-mode="margin">Margin</button>
                        </div>
                        <div class="bm-ballot-map-host"></div>
                    </div>
                    <aside class="bm-ballot-summary"></aside>
                </div>
            `;
            electionNight.appendChild(overlay);
            overlay.querySelector(".bm-ballot-return-national").onclick = () => {
                if(options.playClick) options.playClick();
                else callRuntimeFunction("playClick");
                activeMapLevel = "national";
                activeMapMode = "winner";
                lastRenderedReporting = -1;
                hideTooltip();
                renderBallotOverlay(true);
            };
            overlay.querySelector(".bm-ballot-return-state").onclick = () => {
                if(options.playClick) options.playClick();
                else callRuntimeFunction("playClick");
                activeMapLevel = "state";
                activeMapMode = previousStateMapMode;
                activeCountyKey = "";
                activeCountyName = "";
                lastRenderedReporting = -1;
                hideTooltip();
                renderBallotOverlay(true);
            };
            overlay.querySelectorAll("[data-ballot-map-mode]").forEach(button => {
                button.onclick = () => {
                    if(options.playClick) options.playClick();
                    else callRuntimeFunction("playClick");
                    activeMapMode = button.dataset.ballotMapMode;
                    lastRenderedReporting = -1;
                    renderBallotOverlay(true);
                };
            });
            const tab = document.getElementById("bm-elect-night-tab");
            Array.from(document.querySelectorAll("#electNightTabDiv button"))
                .filter(candidate => candidate !== tab)
                .forEach(candidate => {
                    candidate.classList.remove("electNightTabO");
                    candidate.classList.add("electNightTabC");
                });
            tab?.classList.remove("electNightTabC");
            tab?.classList.add("electNightTabO");
            renderBallotOverlay(true);
        };

        const ensureElectionNightTab = () => {
            if(typeof document === "undefined") return;
            const electionNight = document.getElementById("electNightDiv");
            const tabs = document.getElementById("electNightTabDiv");
            if(!electionNight || !tabs) {
                if(activeMeasureId) {
                    if(!electionNightMissingSince) electionNightMissingSince = Date.now();
                    if(Date.now() - electionNightMissingSince < 1200) return;
                }
                closeBallotOverlay();
                return;
            }
            electionNightMissingSince = 0;
            normalizeElectionNightCloseButton();
            const retainedMeasure = activeMeasureId
                ? getMeasureById(activeMeasureId)
                : null;
            if(getCurrentWeek() !== 45 && !retainedMeasure) {
                document.getElementById("bm-elect-night-tab")?.remove();
                closeBallotOverlay();
                return;
            }
            const measure = retainedMeasure
                || getScheduledMeasureForYear(getCurrentYear());
            if(!measure) {
                document.getElementById("bm-elect-night-tab")?.remove();
                closeBallotOverlay();
                return;
            }
            let button = document.getElementById("bm-elect-night-tab");
            if(!button) {
                button = createElement("button", "electNightTabC", "Ballot Measure");
                button.id = "bm-elect-night-tab";
                button.type = "button";
                button.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if(options.playClick) options.playClick();
                    else callRuntimeFunction("playClick");
                    openBallotOverlay(measure);
                };
                const governor = Array.from(tabs.querySelectorAll("button")).find(candidate =>
                    /^governor/i.test(candidate.textContent.trim())
                );
                if(governor?.nextSibling) tabs.insertBefore(button, governor.nextSibling);
                else tabs.appendChild(button);
            }
            Array.from(tabs.querySelectorAll("button"))
                .filter(candidate => candidate !== button)
                .forEach(candidate => {
                    if(candidate.dataset.bmBallotCloseBound === "true") return;
                    candidate.dataset.bmBallotCloseBound = "true";
                    candidate.addEventListener("click", event => {
                        if(
                            !event.isTrusted
                            && activeMeasureId
                            && overlay?.isConnected
                        ) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                            syncBallotTabSelection();
                            return;
                        }
                        closeBallotOverlay();
                    }, true);
                });
            if(activeMeasureId === measure.id) {
                if(!overlay?.isConnected) openBallotOverlay(measure, true);
                else syncBallotTabSelection();
            }
        };

        const lifecycleTick = () => {
            try {
                if(!Executive?.game?.loaded) return;
                applyPassedMeasures();
                ensureElectionNightTab();
                if(overlay?.isConnected) renderBallotOverlay();
            } catch(error) {
                console.error("Ballot Measures lifecycle failed", error);
            }
        };

        const install = () => {
            if(installed) return;
            installed = true;
            Executive.styles.registerStyle("styles/ballot-measures.css");
            legislationHook = Executive.functions.registerPostHook(
                "complexBillMenu",
                installReferendumButton
            );
            electionUpdateHook = Executive.functions.registerPostHook(
                "electNightUpdateData",
                () => {
                    ensureElectionNightTab();
                    if(overlay?.isConnected) renderBallotOverlay(true);
                }
            );
            if(document.body) {
                electionTabObserver = new MutationObserver(ensureElectionNightTab);
                electionTabObserver.observe(document.body, {
                    childList: true
                });
            }
            lifecycleTimer = setInterval(lifecycleTick, 1000);
            Executive.game.onGameLoad.registerListener(() => {
                simulationCacheKey = "";
                simulationCache = null;
                resetElectionNightReportingRuntime("");
                electionNightSessionActive = false;
                setTimeout(lifecycleTick, 0);
            });
            lifecycleTick();
        };

        const destroy = () => {
            closeBallotOverlay();
            removeReferendumModal();
            document.getElementById("bm-elect-night-tab")?.remove();
            tooltip?.remove();
            tooltip = null;
            electionTabObserver?.disconnect();
            electionTabObserver = null;
            if(lifecycleTimer) clearInterval(lifecycleTimer);
            lifecycleTimer = null;
            if(legislationHook !== null) {
                Executive.functions.deregisterPostHook("complexBillMenu", legislationHook);
            }
            if(electionUpdateHook !== null) {
                Executive.functions.deregisterPostHook("electNightUpdateData", electionUpdateHook);
            }
            installed = false;
        };

        return {
            install,
            destroy,
            scheduleMeasure,
            runLifecycle: lifecycleTick,
            isGeneralElectionWeek: () => getCurrentWeek() === 45,
            getReporting,
            getConcurrentElectionContext,
            getRule,
            getStore,
            catalogue: MEASURE_CATALOGUE
        };
    };

    module.exports = {
        createBallotMeasuresSubmod,
        getBallotMeasureRule: getRule,
        BALLOT_MEASURE_CATALOGUE: MEASURE_CATALOGUE
    };
}