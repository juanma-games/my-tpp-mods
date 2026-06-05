{
    const resultProxies = require("./proxies.js");
    const { getCandidateColour, stringifyColour } = require("./colours.js");
    const config = require("./config.json");
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.display = "none";
    tooltipDiv.setAttribute("id", "better-maps-tooltip");
    const tooltipComponents = {};
    let lastPresidentialPrimaryParty = "D";
    let lastPresidentialPrimaryPartyTrusted = false;
    let presidentialPrimaryWatcherInstalled = false;
    let lastPresidentialBackgroundRefreshTime = 0;
    const candidatePctDeltaCache = new Map();
    const candidatePortraitCharacterCache = new Map();
    const candidatePortraitImageCache = new Map();
    const candidatePortraitPaletteCache = new Map();
    const candidatePortraitRenderJobs = new Map();
    const candidatePortraitRenderQueue = [];
    let candidatePortraitActiveJob = null;
    let candidatePortraitRenderHost = null;
    let nativeHouseDistrictSnapshotCache = {
        stateId: "",
        timestamp: 0,
        snapshots: new Map()
    };
    const pollClosingClock = {
        key: "",
        lastRealTime: 0,
        displayedRemaining: null,
        lastTargetRemaining: null,
        lastRenderedSecond: null,
        speedKey: "",
        wasPaused: false,
        pollClose: null,
        stateId: ""
    };
    const electionUpdateClock = {
        lastRealTime: 0,
        intervalSeconds: null,
        intervalSecondsBySpeed: {},
        electionNightTimeScale: null,
        electionNightTimeScaleBySpeed: {},
        lastElectionNightTime: null,
        speedKey: "",
        hookRegistered: false,
        paused: false,
        pauseStartedAt: 0,
        frozenNextUpdateRemaining: null
    };
    const RESULT_REVEAL_LEAD_SECONDS = 3;
    const INDIANA_POLL_CLOSING_COUNTDOWN_SECONDS = 3.75;
    const ELECTION_NIGHT_SPEED_FALLBACK_INTERVAL_SECONDS = {
        1: 12,
        2: 8,
        3: 4,
        4: 2,
        5: 1
    };
    const ELECTION_NIGHT_SPEED_FALLBACK_TIME_SCALE = {
        1: 0.25,
        2: 0.5,
        3: 1,
        4: 2,
        5: 4
    };
    const POLL_CLOSE_RESULT_CALIBRATION_SECONDS = {
        100: 2.95,
        150: 2.95,
        200: -3.25,
        250: -3.25,
        300: 2.95,
        400: 2.95,
        500: 2.95,
        600: 2.95,
        700: -3.25
    };
    function updatePctDeltaBadge(cellPct, candidate, pctNumber, rowOptions = {}) {
        if (!rowOptions.showPctDelta || !cellPct || !candidate) return;
        const candidateId = candidate.id ?? candidate.candID ?? candidate.name;
        const deltaKey = `${rowOptions.deltaKeyPrefix || "race"}|${candidateId}`;
        const previousPct = candidatePctDeltaCache.get(deltaKey);
        candidatePctDeltaCache.set(deltaKey, pctNumber);
        if (!Number.isFinite(previousPct)) return;
        const delta = pctNumber - previousPct;
        const roundedDelta = Math.round(delta * 10) / 10;
        if (Math.abs(roundedDelta) < 0.1) return;
        const badge = document.createElement("span");
        badge.className = "pct-delta-badge pct-delta-" + String(candidate.party || "i").toLowerCase();
        if (rowOptions.compactPctDelta === true) {
            badge.classList.add("pct-delta-primary");
        }
        const signClass = roundedDelta > 0 ? "pct-delta-sign-plus" : "pct-delta-sign-minus";
        badge.innerHTML = `<span class="pct-delta-sign ${signClass}" aria-hidden="true"></span><span>${Math.abs(roundedDelta).toFixed(1)}%</span>`;
        cellPct.appendChild(badge);
        setTimeout(() => badge.remove(), 1100);
    }
    function readRuntimeValue(name) {
        try {
            if (typeof globalThis !== "undefined" && globalThis[name] !== undefined) return globalThis[name];
        } catch { }
        try {
            if (typeof window !== "undefined" && window[name] !== undefined) return window[name];
        } catch { }
        try {
            return Function(`return (typeof ${name} !== "undefined") ? ${name} : undefined;`)();
        } catch {
            return undefined;
        }
    }
    function formatPollCloseCountdown(seconds) {
        const numericSeconds = Number(seconds) || 0;
        const safeSeconds = Math.max(0, Math.round(numericSeconds));
        const minutes = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    function getElectionNightSpeedButtonIndex() {
        try {
            const buttons = Array.from(document.querySelectorAll("#electNightSpeedDiv .eNightSpeedCnvAct, #electNightSpeedDiv .eNightSpeedCnvInA"));
            const activeIndex = buttons.findIndex(button => button.classList.contains("eNightSpeedCnvAct"));
            return activeIndex >= 0 ? activeIndex : null;
        } catch {
            return null;
        }
    }
    function getElectionNightSpeedKey() {
        const buttonIndex = getElectionNightSpeedButtonIndex();
        if (Number.isFinite(buttonIndex)) return `button-${buttonIndex}`;
        const speedValue = readRuntimeValue("electNightSpeed");
        if (speedValue !== undefined && speedValue !== null) return `runtime-${String(speedValue)}`;
        return "unknown";
    }
    function getElectionNightSpeedFallbackInterval(speedKey) {
        const buttonMatch = /^button-(\d+)$/.exec(String(speedKey || ""));
        if (!buttonMatch) return null;
        const buttonIndex = Number(buttonMatch[1]);
        const fallback = ELECTION_NIGHT_SPEED_FALLBACK_INTERVAL_SECONDS[buttonIndex];
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    }
    function getElectionNightSpeedFallbackTimeScale(speedKey) {
        const buttonMatch = /^button-(\d+)$/.exec(String(speedKey || ""));
        if (!buttonMatch) return null;
        const buttonIndex = Number(buttonMatch[1]);
        const fallback = ELECTION_NIGHT_SPEED_FALLBACK_TIME_SCALE[buttonIndex];
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    }
    function syncElectionUpdateSpeedState(now = Date.now()) {
        const speedKey = getElectionNightSpeedKey();
        if (speedKey === electionUpdateClock.speedKey) return;
        electionUpdateClock.speedKey = speedKey;
        const learnedInterval = electionUpdateClock.intervalSecondsBySpeed[speedKey];
        const fallbackInterval = getElectionNightSpeedFallbackInterval(speedKey);
        const learnedScale = electionUpdateClock.electionNightTimeScaleBySpeed[speedKey];
        const fallbackScale = getElectionNightSpeedFallbackTimeScale(speedKey);
        electionUpdateClock.intervalSeconds = Number.isFinite(learnedInterval)
            ? learnedInterval
            : (Number.isFinite(fallbackInterval) ? fallbackInterval : electionUpdateClock.intervalSeconds);
        electionUpdateClock.electionNightTimeScale = Number.isFinite(learnedScale)
            ? learnedScale
            : (Number.isFinite(fallbackScale) ? fallbackScale : electionUpdateClock.electionNightTimeScale);
        electionUpdateClock.lastRealTime = now;
        electionUpdateClock.lastElectionNightTime = getEstimatedElectionNightTime();
        electionUpdateClock.frozenNextUpdateRemaining = null;
    }
    function isElectionNightPaused() {
        const speedButtonIndex = getElectionNightSpeedButtonIndex();
        if (speedButtonIndex !== null) return speedButtonIndex === 0;
        const speedValue = readRuntimeValue("electNightSpeed");
        const speedText = String(speedValue ?? "").toLowerCase();
        return speedText.includes("pause")
            || speedText.includes("stop")
            || Number(speedValue) === 0;
    }
    function syncElectionUpdatePauseState(now = Date.now()) {
        const paused = isElectionNightPaused();
        if (paused && !electionUpdateClock.paused) {
            electionUpdateClock.paused = true;
            electionUpdateClock.pauseStartedAt = now;
            electionUpdateClock.frozenNextUpdateRemaining = getSecondsUntilNextObservedElectionUpdate(false);
        } else if (!paused && electionUpdateClock.paused) {
            const pausedDuration = Math.max(0, now - electionUpdateClock.pauseStartedAt);
            if (electionUpdateClock.lastRealTime > 0) {
                electionUpdateClock.lastRealTime += pausedDuration;
            }
            electionUpdateClock.paused = false;
            electionUpdateClock.pauseStartedAt = 0;
            electionUpdateClock.frozenNextUpdateRemaining = null;
        }
    }
    function recordElectionUpdateTick() {
        const now = Date.now();
        const currentElectionNightTime = getEstimatedElectionNightTime();
        syncElectionUpdateSpeedState(now);
        syncElectionUpdatePauseState(now);
        if (electionUpdateClock.lastRealTime > 0 && !electionUpdateClock.paused) {
            const elapsedSeconds = (now - electionUpdateClock.lastRealTime) / 1000;
            if (elapsedSeconds >= 0.25 && elapsedSeconds <= 120) {
                const speedKey = electionUpdateClock.speedKey || getElectionNightSpeedKey();
                const previousSpeedInterval = electionUpdateClock.intervalSecondsBySpeed[speedKey];
                const nextSpeedInterval = Number.isFinite(previousSpeedInterval)
                    ? (previousSpeedInterval * 0.65) + (elapsedSeconds * 0.35)
                    : elapsedSeconds;
                electionUpdateClock.intervalSecondsBySpeed[speedKey] = nextSpeedInterval;
                electionUpdateClock.intervalSeconds = nextSpeedInterval;
                const previousElectionNightTime = electionUpdateClock.lastElectionNightTime;
                const gameTimeDelta = currentElectionNightTime - previousElectionNightTime;
                if (
                    Number.isFinite(currentElectionNightTime)
                    && Number.isFinite(previousElectionNightTime)
                    && gameTimeDelta > 0
                ) {
                    const observedScale = gameTimeDelta / elapsedSeconds;
                    if (Number.isFinite(observedScale) && observedScale > 0 && observedScale <= 20) {
                        const previousScale = electionUpdateClock.electionNightTimeScaleBySpeed[speedKey];
                        const nextScale = Number.isFinite(previousScale)
                            ? (previousScale * 0.65) + (observedScale * 0.35)
                            : observedScale;
                        electionUpdateClock.electionNightTimeScaleBySpeed[speedKey] = nextScale;
                        electionUpdateClock.electionNightTimeScale = nextScale;
                    }
                }
            }
        }
        electionUpdateClock.lastRealTime = now;
        electionUpdateClock.lastElectionNightTime = currentElectionNightTime;
        electionUpdateClock.frozenNextUpdateRemaining = null;
        refreshVisibleControlBanners();
    }
    function ensureElectionUpdateClockHook() {
        if (electionUpdateClock.hookRegistered) return;
        electionUpdateClock.hookRegistered = true;
        try {
            Executive.functions.registerPostHook("electNightUpdateData", recordElectionUpdateTick);
        } catch { }
    }
    function getSecondsUntilNextObservedElectionUpdate(syncPause = true) {
        const now = Date.now();
        syncElectionUpdateSpeedState(now);
        if (syncPause) syncElectionUpdatePauseState(now);
        if (!Number.isFinite(electionUpdateClock.intervalSeconds) || electionUpdateClock.intervalSeconds <= 0) {
            return null;
        }
        if (electionUpdateClock.paused) {
            return Number.isFinite(electionUpdateClock.frozenNextUpdateRemaining)
                ? electionUpdateClock.frozenNextUpdateRemaining
                : electionUpdateClock.intervalSeconds;
        }
        if (electionUpdateClock.lastRealTime <= 0) return null;
        const elapsedSeconds = Math.max(0, (now - electionUpdateClock.lastRealTime) / 1000);
        const remainingSeconds = Math.max(0, electionUpdateClock.intervalSeconds - elapsedSeconds);
        electionUpdateClock.frozenNextUpdateRemaining = remainingSeconds;
        return remainingSeconds;
    }
    function getEstimatedElectionNightTime() {
        return Number(readRuntimeValue("electNightTime"));
    }
    function getElectionNightTimeScale() {
        const speedKey = getElectionNightSpeedKey();
        const learnedScale = electionUpdateClock.electionNightTimeScaleBySpeed[speedKey];
        if (Number.isFinite(learnedScale) && learnedScale > 0) return learnedScale;
        const fallbackScale = getElectionNightSpeedFallbackTimeScale(speedKey);
        if (Number.isFinite(fallbackScale) && fallbackScale > 0) return fallbackScale;
        return Number.isFinite(electionUpdateClock.electionNightTimeScale) && electionUpdateClock.electionNightTimeScale > 0
            ? electionUpdateClock.electionNightTimeScale
            : 1;
    }
    function convertElectionNightSecondsToRealSeconds(seconds) {
        const numericSeconds = Number(seconds) || 0;
        const timeScale = getElectionNightTimeScale();
        return timeScale > 0 ? numericSeconds / timeScale : numericSeconds;
    }
    function hasFinalVotesAvailable(currentDistrict) {
        return Array.isArray(currentDistrict?.cands)
            && currentDistrict.cands.some(candidate => Number(candidate?.votes) > 0);
    }
    function getCandidateVoteTotal(currentDistrict, voteKey) {
        if (!Array.isArray(currentDistrict?.cands)) return 0;
        return currentDistrict.cands.reduce(
            (total, candidate) => total + (Number(candidate?.[voteKey]) || 0),
            0
        );
    }
    function normalizeLiveDistrictVoteTotals(currentDistrict) {
        if (!currentDistrict || !Array.isArray(currentDistrict.cands)) return currentDistrict;
        const candidateCurrentVotes = getCandidateVoteTotal(currentDistrict, "currentVotes");
        const candidateFinalVotes = getCandidateVoteTotal(currentDistrict, "votes");
        const totalCurrVotes = Number(currentDistrict.totalCurrVotes) || candidateCurrentVotes;
        const totalVotes = Number(currentDistrict.totalVotes) || candidateFinalVotes;
        if (
            totalCurrVotes === Number(currentDistrict.totalCurrVotes)
            && totalVotes === Number(currentDistrict.totalVotes)
        ) {
            return currentDistrict;
        }
        return {
            ...currentDistrict,
            totalCurrVotes,
            totalVotes
        };
    }
    function hasVisibleLiveVotes(currentDistrict) {
        return (Number(currentDistrict?.totalCurrVotes) || 0) > 0
            || getCandidateVoteTotal(currentDistrict, "currentVotes") > 0;
    }
    function shouldRevealHouseDistrictResults(currentDistrict, live = true) {
        return live !== true
            || hasVisibleLiveVotes(currentDistrict)
            || isElectionNightFinished();
    }
    function shouldUseFinalVotesForCompletedLiveDistrict(currentDistrict) {
        const normalizedDistrict = normalizeLiveDistrictVoteTotals(currentDistrict);
        const currentVotes = Number(normalizedDistrict?.totalCurrVotes) || 0;
        const totalVotes = Number(normalizedDistrict?.totalVotes) || 0;
        return currentVotes === 0
            && totalVotes > 0
            && normalizedDistrict?.pW === true
            && hasFinalVotesAvailable(normalizedDistrict)
            && isElectionNightFinished();
    }
    function getLiveDisplayDistrict(currentDistrict) {
        const normalizedDistrict = normalizeLiveDistrictVoteTotals(currentDistrict);
        if (!shouldUseFinalVotesForCompletedLiveDistrict(normalizedDistrict)) return normalizedDistrict;
        return {
            ...normalizedDistrict,
            totalCurrVotes: normalizedDistrict.totalVotes,
            cands: normalizedDistrict.cands.map(candidate => ({
                ...candidate,
                currentVotes: Number(candidate.currentVotes) > 0 ? candidate.currentVotes : candidate.votes
            }))
        };
    }
    function getPollCloseData(districtId, currentDistrict) {
        const stateId = (districtId || "").toLowerCase();
        const state = Executive?.data?.states?.[stateId];
        const pollClose = Number(
            currentDistrict?.pollClose
            ?? (pollClosingClock.stateId === stateId ? pollClosingClock.pollClose : undefined)
            ?? state?.pollClose
            ?? state?.electInfo?.pollClose
        );
        const electionNightTime = getEstimatedElectionNightTime();
        if (!Number.isFinite(pollClose) || !Number.isFinite(electionNightTime)) return null;
        return { stateId, pollClose, electionNightTime };
    }
    function getStateElectionData(stateId) {
        try {
            return (allStElectData || []).find(electData =>
                String(electData?.id || "").toLowerCase() === String(stateId || "").toLowerCase()
            );
        } catch {
            return null;
        }
    }
    function stateHasVisibleVotesAtTickOffset(stateId, currentDistrict, tickOffset) {
        const stateElectData = getStateElectionData(stateId);
        if (!stateElectData || !Array.isArray(stateElectData.counties) || !Array.isArray(currentDistrict?.counties)) {
            return false;
        }
        return currentDistrict.counties.some(county => {
            const countyElectData = stateElectData.counties.find(candCountyData =>
                candCountyData?.name === county?.name
            );
            const currentIndex = Number(countyElectData?.indx);
            if (!Number.isFinite(currentIndex)) return false;
            const targetIndex = currentIndex + tickOffset;
            return (county.cands || []).some(candidate =>
                Number(candidate?.updates?.[targetIndex]) > 0
            );
        });
    }
    function getMaxStateTickOffset(stateId, currentDistrict) {
        const stateElectData = getStateElectionData(stateId);
        if (!stateElectData || !Array.isArray(stateElectData.counties) || !Array.isArray(currentDistrict?.counties)) {
            return 0;
        }
        let maxOffset = 0;
        currentDistrict.counties.forEach(county => {
            const countyElectData = stateElectData.counties.find(candCountyData =>
                candCountyData?.name === county?.name
            );
            const currentIndex = Number(countyElectData?.indx);
            if (!Number.isFinite(currentIndex)) return;
            const maxUpdates = Math.max(
                0,
                ...(county.cands || []).map(candidate => Array.isArray(candidate.updates) ? candidate.updates.length : 0)
            );
            maxOffset = Math.max(maxOffset, Math.max(0, maxUpdates - currentIndex - 1));
        });
        return maxOffset;
    }
    function getTicksUntilStateHasVotes(stateId, currentDistrict) {
        const currentVotes = Number(currentDistrict?.totalCurrVotes) || 0;
        const firstOffset = currentVotes > 0 ? 0 : 1;
        const maxOffset = getMaxStateTickOffset(stateId, currentDistrict);
        for (let tickOffset = firstOffset; tickOffset <= maxOffset; tickOffset++) {
            if (stateHasVisibleVotesAtTickOffset(stateId, currentDistrict, tickOffset)) {
                return tickOffset;
            }
        }
        return null;
    }
    function getSecondsUntilStateHasVotes(stateId, currentDistrict) {
        const ticksUntilVotes = getTicksUntilStateHasVotes(stateId, currentDistrict);
        const intervalSeconds = electionUpdateClock.intervalSeconds;
        const secondsUntilNextUpdate = getSecondsUntilNextObservedElectionUpdate();
        if (
            ticksUntilVotes === null
            || !Number.isFinite(intervalSeconds)
            || intervalSeconds <= 0
            || !Number.isFinite(secondsUntilNextUpdate)
        ) {
            return null;
        }
        if (ticksUntilVotes <= 0) return 0;
        const estimatedSeconds = secondsUntilNextUpdate + (Math.max(0, ticksUntilVotes - 2) * intervalSeconds);
        return Math.max(0, estimatedSeconds - RESULT_REVEAL_LEAD_SECONDS);
    }
    function getPollCloseTargetRemainingSeconds(districtId, currentDistrict, electionType) {
        if (shouldUseFinalVotesForCompletedLiveDistrict(currentDistrict)) return null;
        if ((Number(currentDistrict?.totalCurrVotes) || 0) > 0) return null;
        const data = getPollCloseData(districtId, currentDistrict);
        if (!data) return null;
        if (data.pollClose <= 0) {
            return data.stateId === "in" ? INDIANA_POLL_CLOSING_COUNTDOWN_SECONDS : null;
        }
        const pollCloseRemaining = convertElectionNightSecondsToRealSeconds(Math.max(0, data.pollClose - data.electionNightTime));
        const resultRemaining = getSecondsUntilStateHasVotes(data.stateId, currentDistrict);
        const calibrationSeconds = POLL_CLOSE_RESULT_CALIBRATION_SECONDS[Math.round(data.pollClose)] || 0;
        const applyCalibration = remainingSeconds => Math.max(0, remainingSeconds + calibrationSeconds);
        if (Number.isFinite(resultRemaining)) {
            return applyCalibration(Math.max(pollCloseRemaining, resultRemaining));
        }
        return pollCloseRemaining > 0 ? applyCalibration(pollCloseRemaining) : null;
    }
    function getPollCloseRemainingSeconds(districtId, currentDistrict, electionType) {
        return getPollCloseTargetRemainingSeconds(districtId, currentDistrict, electionType);
    }
    function getSmoothPollCloseRemainingSeconds(districtId, currentDistrict, electionType) {
        const targetRemaining = getPollCloseRemainingSeconds(districtId, currentDistrict, electionType);
        if (targetRemaining === null) {
            pollClosingClock.key = "";
            pollClosingClock.displayedRemaining = null;
            pollClosingClock.lastTargetRemaining = null;
            pollClosingClock.lastRenderedSecond = null;
            return null;
        }
        const key = `${electionType || ""}|${(districtId || "").toLowerCase()}`;
        const now = Date.now();
        const resetClock = pollClosingClock.key !== key
            || pollClosingClock.displayedRemaining === null
            || pollClosingClock.lastRealTime <= 0;
        if (resetClock) {
            pollClosingClock.key = key;
            pollClosingClock.lastRealTime = now;
            pollClosingClock.displayedRemaining = Math.max(0, targetRemaining);
            pollClosingClock.lastTargetRemaining = Math.max(0, targetRemaining);
            pollClosingClock.lastRenderedSecond = Math.ceil(pollClosingClock.displayedRemaining);
            return pollClosingClock.lastRenderedSecond;
        }
        const paused = isElectionNightPaused();
        const elapsedSeconds = paused ? 0 : Math.max(0, (now - pollClosingClock.lastRealTime) / 1000);
        const safeTargetRemaining = Math.max(0, targetRemaining);
        const previousTargetRemaining = pollClosingClock.lastTargetRemaining;
        const targetMovedBy = Number.isFinite(previousTargetRemaining)
            ? Math.max(0, previousTargetRemaining - safeTargetRemaining)
            : 0;
        let visualRemaining = Math.max(0, pollClosingClock.displayedRemaining);
        if (safeTargetRemaining <= 0) {
            visualRemaining = 0;
        } else if (targetMovedBy >= elapsedSeconds * 0.35) {
            visualRemaining = Math.min(visualRemaining, safeTargetRemaining);
        } else {
            visualRemaining = Math.max(0, visualRemaining - elapsedSeconds);
            visualRemaining = Math.min(visualRemaining, safeTargetRemaining);
        }
        pollClosingClock.displayedRemaining = visualRemaining;
        pollClosingClock.lastTargetRemaining = safeTargetRemaining;
        pollClosingClock.lastRenderedSecond = Math.ceil(visualRemaining);
        pollClosingClock.lastRealTime = now;
        return pollClosingClock.lastRenderedSecond;
    }
    function showNotCountingFallback(message = "This state has not begun counting yet.") {
        tooltipDiv.classList.remove("bm-polls-closing-tooltip");
        tooltipComponents.notCounting.dataset.pollClosingState = "";
        tooltipComponents.notCounting.dataset.pollClosingElection = "";
        tooltipComponents.notCounting.innerText = message;
    }
    function showNotCountingMessage(message) {
        showNotCountingFallback(message);
        tooltipComponents.notCounting.removeAttribute("style");
    }
    function updatePollClosingTime() {
        if (!tooltipComponents.notCounting || tooltipComponents.notCounting.style.display === "none") return;
        const stateId = tooltipComponents.notCounting.dataset.pollClosingState;
        if (!stateId) return;
        const electionType = tooltipComponents.notCounting.dataset.pollClosingElection;
        const currentDistrict = electionType ? resultProxies[electionType]?.[stateId] : null;
        if (shouldUseFinalVotesForCompletedLiveDistrict(currentDistrict)) {
            updateTooltip(electionType, stateId, true, true, false);
            return;
        }
        const remainingSeconds = getSmoothPollCloseRemainingSeconds(stateId, currentDistrict, electionType);
        const timeElem = tooltipComponents.notCounting.querySelector(".bm-polls-closing-time");
        if (timeElem && remainingSeconds !== null && remainingSeconds > 0) {
            timeElem.textContent = formatPollCloseCountdown(remainingSeconds);
        } else if (timeElem) {
            showNotCountingFallback();
        }
    }
    function startPollClosingTimer() {
        if (tooltipComponents.pollClosingTimer) return;
        tooltipComponents.pollClosingTimer = setInterval(updatePollClosingTime, 250);
    }
    function showPollClosingMessage(districtId, currentDistrict, electionType) {
        const remainingSeconds = getSmoothPollCloseRemainingSeconds(districtId, currentDistrict, electionType);
        if (remainingSeconds === null || remainingSeconds <= 0) {
            showNotCountingFallback();
        } else {
            tooltipDiv.classList.add("bm-polls-closing-tooltip");
            tooltipComponents.notCounting.dataset.pollClosingState = (districtId || "").toLowerCase();
            tooltipComponents.notCounting.dataset.pollClosingElection = electionType || "";
            tooltipComponents.notCounting.innerHTML = `
                <div class="bm-polls-closing-card">
                    <div class="bm-polls-closing-label">POLL CLOSING IN</div>
                    <div class="bm-polls-closing-time">${formatPollCloseCountdown(remainingSeconds)}</div>
                </div>
            `;
            startPollClosingTimer();
        }
        tooltipComponents.notCounting.removeAttribute("style");
    }
    function getCandidateDisplayName(candidate) {
        const rawName = String(
            candidate?.name
            || candidate?.fullName
            || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ")
            || ""
        ).trim();
        const parts = rawName.split(/\s+/).filter(Boolean);
        const lastName = String(
            candidate?.last
            || candidate?.lastName
            || (parts.length > 1 ? parts.slice(1).join(" ") : parts[0])
            || "Candidate"
        ).trim();
        return lastName + (candidate?.incumbent ? "\u00a0*" : "");
    }
    function getCandidatePortraitSearchNames(candidate, displayName) {
        const names = new Set();
        const cleanDisplay = String(displayName || "")
            .replace(/\*/g, "")
            .replace(/\u00a0/g, " ")
            .trim();
        const rawName = String(candidate?.name || candidate?.fullName || "").trim();
        const parts = rawName.split(/\s+/).filter(Boolean);
        const lastName = String(candidate?.last || candidate?.lastName || parts[parts.length - 1] || "").trim();
        [cleanDisplay, rawName, lastName].forEach(name => {
            if (name && name.length >= 2) names.add(name.toLowerCase());
        });
        return Array.from(names);
    }
    function isVisibleCandidatePortraitSource(element) {
        if (!element || tooltipDiv.contains(element)) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 36 || rect.height < 36) return false;
        if (rect.width > 180 || rect.height > 180) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none"
            && style.visibility !== "hidden"
            && Number(style.opacity || 1) > 0;
    }
    function normalizeCandidatePartyText(value) {
        return String(value || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    }
    function getCandidateVisualPartyKey(candidate) {
        const partyParts = [
            candidate?.party,
            candidate?.partyKey,
            candidate?.partyName,
            candidate?.partyLabel,
            candidate?.partyID,
            candidate?.partyId,
            candidate?.partyCode,
            candidate?.affiliation,
            candidate?.politicalParty,
            candidate?.displayParty,
            candidate?.extendedAttribs?.party,
            candidate?.extendedAttribs?.partyKey,
            candidate?.extendedAttribs?.partyName,
            candidate?.extendedAttribs?.affiliation
        ].map(normalizeCandidatePartyText).filter(Boolean);
        const caucusParts = [
            candidate?.caucus,
            candidate?.caucusParty,
            candidate?.caucusPartyKey,
            candidate?.extendedAttribs?.caucus,
            candidate?.extendedAttribs?.caucusParty,
            candidate?.extendedAttribs?.caucusPartyKey
        ].map(normalizeCandidatePartyText).filter(Boolean);
        const rawParty = partyParts[0] || "I";
        const demTokens = ["D", "DEM", "DEMOCRAT", "DEMOCRATS"];
        const repTokens = ["R", "REP", "REPUBLICAN", "REPUBLICANS"];
        const independentTokens = ["I", "IND", "INDEPENDENT", "INDEPENDENTS"];
        const indDemTokens = ["ID", "INDD", "INDEPENDENTD", "INDDEM", "INDEPENDENTDEM", "INDEPENDENTDEMOCRAT", "INDEPENDENTDEMOCRATS"];
        const indRepTokens = ["IR", "INDR", "INDEPENDENTR", "INDREP", "INDEPENDENTREP", "INDEPENDENTREPUBLICAN", "INDEPENDENTREPUBLICANS"];
        const isDemocrat = rawParty === "D" || rawParty === "DEM" || rawParty === "DEMOCRAT" || rawParty === "DEMOCRATS";
        const isRepublican = rawParty === "R" || rawParty === "REP" || rawParty === "REPUBLICAN" || rawParty === "REPUBLICANS";
        const hasCaucusParty = caucusParts.some(caucus =>
            demTokens.includes(caucus)
            || repTokens.includes(caucus)
            || indDemTokens.includes(caucus)
            || indRepTokens.includes(caucus)
        );
        const isPlainIndependent = independentTokens.includes(rawParty) && !hasCaucusParty;
        const isIndependentDemocrat = partyParts.some(party =>
            indDemTokens.includes(party)
            || (party.startsWith("IND") && party.includes("DEM"))
        )
            || caucusParts.some(caucus => demTokens.includes(caucus) || indDemTokens.includes(caucus));
        const isIndependentRepublican = partyParts.some(party =>
            indRepTokens.includes(party)
            || (party.startsWith("IND") && party.includes("REP"))
        )
            || caucusParts.some(caucus => repTokens.includes(caucus) || indRepTokens.includes(caucus));
        if (isDemocrat) return "D";
        if (isRepublican) return "R";
        if (isPlainIndependent) return "I";
        if (isIndependentDemocrat) return "ID";
        if (isIndependentRepublican) return "IR";
        return "I";
    }
    function getCandidateProjectionPartyKey(candidate) {
        const party = normalizeCandidatePartyText(candidate?.party);
        if (party === "I" || party === "IND" || party === "INDEPENDENT" || party === "INDEPENDENTS") return "I";
        if (party === "ID" || party === "I-D") return "ID";
        if (party === "IR" || party === "I-R") return "IR";
        if (party === "D" || party === "DEM" || party === "DEMOCRAT" || party === "DEMOCRATS") return "D";
        if (party === "R" || party === "REP" || party === "REPUBLICAN" || party === "REPUBLICANS") return "R";
        return getCandidateVisualPartyKey(candidate);
    }
    function getCandidateAvatarPalette(candidate) {
        const visualParty = getCandidateVisualPartyKey(candidate);
        const isDemocrat = visualParty === "D";
        const isRepublican = visualParty === "R";
        const isIndependentDemocrat = visualParty === "ID";
        const isIndependentRepublican = visualParty === "IR";
        if (isDemocrat) return { fill: "#0081CC", stroke: "#0081CC" };
        if (isRepublican) return { fill: "#990000", stroke: "#990000" };
        if (isIndependentDemocrat) {
            const colour = stringifyColour(config.partyColours.I.D);
            return { fill: "#E6F2FF", stroke: colour };
        }
        if (isIndependentRepublican) {
            const colour = stringifyColour(config.partyColours.I.R);
            return { fill: "#FFF5F5", stroke: colour };
        }
        return { fill: "#7A7A7A", stroke: "#7A7A7A" };
    }
    function applyCandidateAvatarPalette(element, candidateOrPalette) {
        if (!element || !candidateOrPalette) return;
        const palette = candidateOrPalette.fill && candidateOrPalette.stroke
            ? candidateOrPalette
            : getCandidateAvatarPalette(candidateOrPalette);
        element.style.setProperty("--bm-candidate-avatar-fill", palette.fill);
        element.style.setProperty("--bm-candidate-avatar-stroke", palette.stroke);
        element.style.backgroundColor = palette.fill;
    }
    function getRenderedPortraitBounds(sourceCanvas) {
        const sourceWidth = sourceCanvas.width || sourceCanvas.getBoundingClientRect().width;
        const sourceHeight = sourceCanvas.height || sourceCanvas.getBoundingClientRect().height;
        try {
            const pixels = sourceCanvas.getContext("2d").getImageData(0, 0, sourceWidth, sourceHeight).data;
            let left = sourceWidth;
            let top = sourceHeight;
            let right = -1;
            let bottom = -1;
            for (let y = 0; y < sourceHeight; y++) {
                for (let x = 0; x < sourceWidth; x++) {
                    if (pixels[((y * sourceWidth + x) * 4) + 3] === 0) continue;
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);
                }
            }
            if (right >= left && bottom >= top) {
                return {
                    x: left,
                    y: top,
                    width: right - left + 1,
                    height: bottom - top + 1
                };
            }
        } catch { }
        return {
            x: 0,
            y: 0,
            width: sourceWidth,
            height: sourceHeight
        };
    }
    function getCanvasCssRgb(context, colour) {
        const previousFill = context.fillStyle;
        context.fillStyle = colour;
        const normalized = String(context.fillStyle || "");
        context.fillStyle = previousFill;
        const hex = normalized.match(/^#([0-9a-f]{6})$/i);
        if (hex) {
            const value = parseInt(hex[1], 16);
            return {
                r: (value >> 16) & 255,
                g: (value >> 8) & 255,
                b: value & 255
            };
        }
        const rgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgb) {
            return {
                r: Number(rgb[1]),
                g: Number(rgb[2]),
                b: Number(rgb[3])
            };
        }
        return null;
    }
    function isNeutralAvatarBackgroundPixel(data, index) {
        const alpha = data[index + 3];
        if (alpha < 24) return true;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const average = (red + green + blue) / 3;
        return max - min <= 24 && average >= 80 && average <= 245;
    }
    function recolourEdgeConnectedAvatarBackground(canvas, palette) {
        const context = canvas.getContext("2d");
        const replacement = getCanvasCssRgb(context, palette.fill);
        if (!replacement) return;
        const width = canvas.width;
        const height = canvas.height;
        const image = context.getImageData(0, 0, width, height);
        const data = image.data;
        const visited = new Uint8Array(width * height);
        const queue = [];
        const radius = Math.min(width, height) / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const addSeed = (x, y) => {
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            const dx = x + 0.5 - centerX;
            const dy = y + 0.5 - centerY;
            if (Math.sqrt((dx * dx) + (dy * dy)) > radius) return;
            const pixel = (y * width) + x;
            if (visited[pixel]) return;
            const index = pixel * 4;
            if (!isNeutralAvatarBackgroundPixel(data, index)) return;
            visited[pixel] = 1;
            queue.push(pixel);
        };
        for (let x = 0; x < width; x++) {
            addSeed(x, 0);
            addSeed(x, height - 1);
        }
        for (let y = 0; y < height; y++) {
            addSeed(0, y);
            addSeed(width - 1, y);
        }
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const pixel = queue[cursor];
            const x = pixel % width;
            const y = Math.floor(pixel / width);
            const index = pixel * 4;
            data[index] = replacement.r;
            data[index + 1] = replacement.g;
            data[index + 2] = replacement.b;
            data[index + 3] = 255;
            addSeed(x + 1, y);
            addSeed(x - 1, y);
            addSeed(x, y + 1);
            addSeed(x, y - 1);
        }
        if (queue.length > 0) context.putImageData(image, 0, 0);
    }
    function createCircularCandidatePortrait(sourceCanvas, candidate) {
        const avatarCssSize = 32;
        const pixelRatio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
        const avatarSize = avatarCssSize * pixelRatio;
        const canvas = document.createElement("canvas");
        canvas.width = avatarSize;
        canvas.height = avatarSize;
        canvas.className = "bm-candidate-avatar";
        canvas.style.width = `${avatarCssSize}px`;
        canvas.style.height = `${avatarCssSize}px`;
        applyCandidateAvatarPalette(canvas, candidate);
        const ctx = canvas.getContext("2d");
        const sourceBounds = getRenderedPortraitBounds(sourceCanvas);
        const sourceWidth = sourceBounds.width || avatarCssSize;
        const sourceHeight = sourceBounds.height || avatarCssSize;
        const portraitScale = Math.min(avatarSize / sourceWidth, avatarSize / sourceHeight);
        const portraitWidth = sourceWidth * portraitScale;
        const portraitHeight = sourceHeight * portraitScale;
        const portraitX = (avatarSize - portraitWidth) / 2;
        const portraitY = (avatarSize - portraitHeight) / 2;
        const palette = getCandidateAvatarPalette(candidate);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarSize / 2, avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = palette.fill;
        ctx.fillRect(0, 0, avatarSize, avatarSize);
        ctx.drawImage(
            sourceCanvas,
            sourceBounds.x,
            sourceBounds.y,
            sourceWidth,
            sourceHeight,
            portraitX,
            portraitY,
            portraitWidth,
            portraitHeight
        );
        ctx.restore();
        recolourEdgeConnectedAvatarBackground(canvas, palette);
        const outerRingWidth = pixelRatio * 1.25;
        ctx.beginPath();
        ctx.arc(
            avatarSize / 2,
            avatarSize / 2,
            (avatarSize / 2) - (outerRingWidth / 2),
            0,
            Math.PI * 2
        );
        ctx.strokeStyle = palette.stroke;
        ctx.lineWidth = outerRingWidth;
        ctx.stroke();
        return canvas;
    }
    function getOriginalRuntimeFunction(name) {
        try {
            const getOriginalFunction = Executive?.functions?.getOriginalFunction;
            if (typeof getOriginalFunction !== "function") return null;
            const originalFunction = getOriginalFunction.call(Executive.functions, name);
            return typeof originalFunction === "function" ? originalFunction : null;
        } catch {
            return null;
        }
    }
    function getCandidateFinder() {
        try {
            if (typeof findCandByID === "function") return findCandByID;
        } catch { }
        const runtimeFinder = readRuntimeValue("findCandByID");
        if (typeof runtimeFinder === "function") return runtimeFinder;
        try {
            if (typeof Executive?.functions?.findCandByID === "function") {
                return Executive.functions.findCandByID;
            }
        } catch { }
        const originalFinder = getOriginalRuntimeFunction("findCandByID");
        if (typeof originalFinder === "function") return originalFinder;
        return null;
    }
    function getCandidateRenderer() {
        try {
            if (typeof drawCandidate === "function") return drawCandidate;
        } catch { }
        const runtimeRenderer = readRuntimeValue("drawCandidate");
        if (typeof runtimeRenderer === "function") return runtimeRenderer;
        try {
            if (typeof Executive?.functions?.drawCandidate === "function") {
                return Executive.functions.drawCandidate;
            }
        } catch { }
        const originalRenderer = getOriginalRuntimeFunction("drawCandidate");
        if (typeof originalRenderer === "function") return originalRenderer;
        return null;
    }
    function normalizeCandidatePortraitName(value) {
        return String(value || "")
            .replace(/\*/g, "")
            .replace(/\u00a0/g, " ")
            .trim()
            .toLowerCase();
    }
    function getCandidatePortraitLastName(candidate) {
        const rawName = candidate?.last
            || candidate?.lastName
            || candidate?.name
            || candidate?.fullName
            || "";
        const parts = normalizeCandidatePortraitName(rawName).split(/\s+/).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : "";
    }
    function getCharacterPortraitLastName(character) {
        if (!Array.isArray(character)) return getCandidatePortraitLastName(character);
        const candidateEnum = Executive?.enums?.characterArray?.candidate || {};
        const indexes = [
            candidateEnum.last,
            candidateEnum.lastName,
            candidateEnum.lName,
            5
        ];
        for (const index of indexes) {
            const numericIndex = Number(index);
            if (!Number.isInteger(numericIndex) || !character[numericIndex]) continue;
            const lastName = getCandidatePortraitLastName({ name: character[numericIndex] });
            if (lastName) return lastName;
        }
        try {
            const wrapped = Executive?.data?.characters?.wrapCharacter(character, "candidate");
            return getCandidatePortraitLastName(wrapped);
        } catch { }
        return "";
    }
    function getCharacterPortraitId(character) {
        if (!Array.isArray(character)) return null;
        const idIndex = Executive?.enums?.characterArray?.candidate?.candidateId ?? 111;
        const id = Number(character[idIndex]);
        return Number.isFinite(id) ? id : null;
    }
    function getCandidatePortraitPartyCode(candidate) {
        const party = String(candidate?.party || candidate?.caucusParty || candidate?.caucus || "").toLowerCase();
        if (party.includes("dem") || party === "d") return "D";
        if (party.includes("rep") || party === "r") return "R";
        if (party.includes("ind") || party === "i") return "I";
        return "";
    }
    function getCharacterPortraitPartyCode(character) {
        if (!Array.isArray(character)) return getCandidatePortraitPartyCode(character);
        const partyValue = character.find(value => {
            const text = String(value || "").toLowerCase();
            return text === "democrat" || text === "republican" || text === "independent";
        });
        if (partyValue) return getCandidatePortraitPartyCode({ party: partyValue });
        try {
            const wrapped = Executive?.data?.characters?.wrapCharacter(character, "candidate");
            return getCandidatePortraitPartyCode(wrapped?.extendedAttribs || wrapped);
        } catch { }
        return "";
    }
    function getCandidatePortraitStateCode(candidate) {
        return String(candidate?.stateId || candidate?.state || candidate?.abbr || candidate?.stateCode || "")
            .trim()
            .toUpperCase();
    }
    function getCandidatePortraitDistrictCode(candidate) {
        return String(
            candidate?.district
            ?? candidate?.districtId
            ?? candidate?.districtID
            ?? candidate?.districtNum
            ?? candidate?.houseDistrict
            ?? candidate?.seat
            ?? ""
        ).trim().toUpperCase();
    }
    function getCandidatePortraitId(candidate) {
        const candidateId = candidate?.id
            ?? candidate?.candID
            ?? candidate?.candId
            ?? candidate?.candidateId
            ?? candidate?.characterId
            ?? candidate?.ID;
        if (String(candidateId ?? "").trim() === "") return null;
        return candidateId !== undefined && candidateId !== null ? candidateId : null;
    }
    function getCandidatePortraitCacheKey(candidate) {
        const candidateId = getCandidatePortraitId(candidate);
        if (candidateId !== undefined && candidateId !== null) return `id:${candidateId}`;
        return [
            "candidate",
            getCandidatePortraitLastName(candidate),
            getCandidatePortraitPartyCode(candidate),
            getCandidatePortraitStateCode(candidate),
            getCandidatePortraitDistrictCode(candidate)
        ].join("|");
    }
    function createCachedCandidatePortrait(cacheKey, candidate = null) {
        const src = candidatePortraitImageCache.get(cacheKey);
        if (!src) return null;
        const image = document.createElement("img");
        image.className = "bm-candidate-avatar";
        image.src = src;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        const palette = candidate ? getCandidateAvatarPalette(candidate) : candidatePortraitPaletteCache.get(cacheKey);
        if (palette) applyCandidateAvatarPalette(image, palette);
        return image;
    }
    function cacheCandidatePortrait(canvas, cacheKey, candidate = null) {
        if (candidate) {
            candidatePortraitPaletteCache.set(cacheKey, getCandidateAvatarPalette(candidate));
            applyCandidateAvatarPalette(canvas, candidate);
        }
        try {
            candidatePortraitImageCache.set(cacheKey, canvas.toDataURL("image/png"));
        } catch { }
        return canvas;
    }
    function getCharacterPortraitStateCode(character) {
        if (!Array.isArray(character)) return getCandidatePortraitStateCode(character);
        const stateIndex = Executive?.enums?.characterArray?.candidate?.stateId ?? 127;
        const directState = String(character[stateIndex] || "").trim().toUpperCase();
        if (directState.length === 2) return directState;
        try {
            const wrapped = Executive?.data?.characters?.wrapCharacter(character, "candidate");
            return getCandidatePortraitStateCode(wrapped);
        } catch { }
        return "";
    }
    function getCharacterPortraitDistrictCode(character) {
        if (!Array.isArray(character)) return getCandidatePortraitDistrictCode(character);
        try {
            const wrapped = Executive?.data?.characters?.wrapCharacter(character, "candidate");
            return getCandidatePortraitDistrictCode(wrapped);
        } catch { }
        return "";
    }
    function isCandidateCharacterArray(value) {
        if (!Array.isArray(value)) return false;
        if (getCharacterPortraitId(value) !== null) return true;
        const lastNameValue = value[Executive?.enums?.characterArray?.candidate?.last ?? 5];
        return value.length >= 80
            && (typeof lastNameValue === "string" || typeof lastNameValue === "number")
            && Boolean(getCharacterPortraitLastName(value));
    }
    function addCandidateCharacterArrays(value, output, depth = 0, seen = new Set()) {
        if (!value || depth > 4 || seen.has(value)) return;
        if (typeof value === "object") seen.add(value);
        if (isCandidateCharacterArray(value)) {
            output.push(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(entry => addCandidateCharacterArrays(entry, output, depth + 1, seen));
            return;
        }
        if (typeof value !== "object") return;
        [
            value.cands,
            value.candidates,
            value.candidate,
            value.characterArray,
            value.character,
            value.candArray,
            value.allCands,
            value.dem,
            value.rep,
            value.elections,
            value.districts,
            value.states
        ].forEach(entry => addCandidateCharacterArrays(entry, output, depth + 1, seen));
    }
    function addCandidateCharacterContainer(value, output) {
        if (!value) return;
        if (Array.isArray(value)) {
            addCandidateCharacterArrays(value, output);
            return;
        }
        if (typeof value !== "object") return;
        Object.values(value).forEach(entry => addCandidateCharacterArrays(entry, output));
    }
    function getKnownCandidateCharacterArrays() {
        const characters = [];
        const add = value => addCandidateCharacterContainer(value, characters);
        [
            "presPrimaryDemArray",
            "presPrimaryRepArray",
            "presidentDemCands",
            "presidentRepCands",
            "presidentCands",
            "demPresIncumbent",
            "repPresIncumbent",
            "allStElectData",
            "electNightP",
            "electNightUSS",
            "electNightG",
            "electNightUSH",
            "allGovernors",
            "allGovCands",
            "primaryArrayAllG",
            "potentialGovernor",
            "persistentG",
            "govCandArrayD",
            "govCandArrayR",
            "govCandArrayI",
            "usSenate",
            "usSenate1Array",
            "usSenate2Array",
            "usSenate3Array",
            "usSenateCands",
            "primaryArrayUSS",
            "potentialUSSenate",
            "persistentUSS",
            "usSenateCandArrayD",
            "usSenateCandArrayR",
            "usSenateCandArrayI",
            "tempDemOpp1",
            "tempDemOpp2",
            "tempDemOpp3",
            "tempRepOpp1",
            "tempRepOpp2",
            "tempRepOpp3",
            "usHouse",
            "usHouseCands",
            "persistentAll",
            "usPresident"
        ].forEach(name => add(readRuntimeValue(name)));
        try {
            add(Executive?.data?.allGovernors);
            addCandidateCharacterContainer(Executive?.data?.politicians?.governors, characters);
            addCandidateCharacterContainer(Executive?.data?.politicians?.usSenate, characters);
            addCandidateCharacterContainer(Executive?.data?.politicians?.usPresident, characters);
            Object.values(Executive?.data?.states || {}).forEach(state => add(state?.allGovernors));
        } catch { }
        return characters;
    }
    function findKnownCandidateCharacter(candidate) {
        const rawCandidateId = getCandidatePortraitId(candidate);
        const candidateId = rawCandidateId !== null ? Number(rawCandidateId) : NaN;
        const lastName = getCandidatePortraitLastName(candidate);
        const party = getCandidatePortraitPartyCode(candidate);
        const state = getCandidatePortraitStateCode(candidate);
        const district = getCandidatePortraitDistrictCode(candidate);
        const cacheKey = Number.isFinite(candidateId)
            ? `id:${candidateId}`
            : `name:${lastName}|party:${party}|state:${state}|district:${district}`;
        if (candidatePortraitCharacterCache.has(cacheKey)) {
            return candidatePortraitCharacterCache.get(cacheKey);
        }
        const characters = getKnownCandidateCharacterArrays();
        const matchedById = Number.isFinite(candidateId)
            ? characters.find(character => getCharacterPortraitId(character) === candidateId)
            : null;
        const matchingNames = matchedById
            ? []
            : characters.filter(character => lastName && getCharacterPortraitLastName(character) === lastName);
        const contextMatches = matchingNames.filter(character => {
                const characterParty = getCharacterPortraitPartyCode(character);
                const characterState = getCharacterPortraitStateCode(character);
                const characterDistrict = getCharacterPortraitDistrictCode(character);
                const partyMatches = !party || !characterParty || characterParty === party;
                const stateMatches = !state || !characterState || characterState === state;
                const districtMatches = !district || (characterDistrict && characterDistrict === district);
                return partyMatches && stateMatches && districtMatches;
            });
        const matchedByName = matchedById
            || (contextMatches.length === 1 ? contextMatches[0] : null)
            || (!district && matchingNames.length === 1 ? matchingNames[0] : null);
        if (matchedByName) candidatePortraitCharacterCache.set(cacheKey, matchedByName);
        return matchedByName || null;
    }
    function getCandidateCharacterArray(candidate) {
        const directCharacter = candidate?.characterArray
            || candidate?.character
            || candidate?.portrait
            || candidate?.candArray;
        if (Array.isArray(directCharacter)) return directCharacter;
        const candidateId = getCandidatePortraitId(candidate);
        if (candidateId !== undefined && candidateId !== null) {
            try {
                const findCandidate = getCandidateFinder();
                if (typeof findCandidate === "function") {
                    const matches = findCandidate([candidateId]);
                    if (Array.isArray(matches) && Array.isArray(matches[0])) return matches[0];
                }
            } catch { }
        }
        return findKnownCandidateCharacter(candidate);
    }
    function canvasHasRenderedPortrait(canvas) {
        try {
            const ctx = canvas.getContext("2d");
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let index = 3; index < pixels.length; index += 4) {
                if (pixels[index] > 0) return true;
            }
        } catch { }
        return false;
    }
    function renderCandidatePortrait(candidate) {
        return createCachedCandidatePortrait(getCandidatePortraitCacheKey(candidate), candidate);
    }
    function getCandidatePortraitRenderHost() {
        if (candidatePortraitRenderHost?.isConnected) return candidatePortraitRenderHost;
        candidatePortraitRenderHost = document.createElement("div");
        candidatePortraitRenderHost.setAttribute("aria-hidden", "true");
        candidatePortraitRenderHost.style.cssText = [
            "position:fixed",
            "left:-10000px",
            "top:-10000px",
            "width:360px",
            "height:495px",
            "overflow:hidden",
            "pointer-events:none"
        ].join(";");
        document.body.appendChild(candidatePortraitRenderHost);
        return candidatePortraitRenderHost;
    }
    function replaceVisibleCandidatePortraitPlaceholders(cacheKey) {
        tooltipDiv.querySelectorAll(".bm-candidate-avatar-placeholder").forEach(placeholder => {
            if (placeholder.dataset.candidatePortraitKey !== cacheKey) return;
            const portrait = createCachedCandidatePortrait(cacheKey);
            if (portrait) placeholder.replaceWith(portrait);
        });
    }
    function cleanUpCandidatePortraitJob(job) {
        if (job.sourceCanvas?.isConnected) job.sourceCanvas.remove();
        candidatePortraitRenderJobs.delete(job.cacheKey);
        if (candidatePortraitActiveJob === job) candidatePortraitActiveJob = null;
        processNextCandidatePortraitRenderJob();
    }
    function processNextCandidatePortraitRenderJob() {
        if (candidatePortraitActiveJob || candidatePortraitRenderQueue.length === 0) return;
        const job = candidatePortraitRenderQueue.shift();
        candidatePortraitActiveJob = job;
        const finish = () => {
            const portrait = cacheCandidatePortrait(
                createCircularCandidatePortrait(job.sourceCanvas, job.candidate),
                job.cacheKey,
                job.candidate
            );
            const callbacks = job.callbacks.slice();
            replaceVisibleCandidatePortraitPlaceholders(job.cacheKey);
            cleanUpCandidatePortraitJob(job);
            callbacks.forEach(callback => {
                const cached = createCachedCandidatePortrait(job.cacheKey, job.candidate);
                callback(cached || portrait.cloneNode(true));
            });
        };
        const pollRenderedPortrait = () => {
            if (!job.character) job.character = getCandidateCharacterArray(job.candidate);
            if (typeof job.drawCharacter !== "function") job.drawCharacter = getCandidateRenderer();
            if (job.character && typeof job.drawCharacter === "function" && !job.sourceCanvas) {
                job.sourceCanvas = document.createElement("canvas");
                job.sourceCanvas.width = 360;
                job.sourceCanvas.height = 495;
                getCandidatePortraitRenderHost().appendChild(job.sourceCanvas);
                try {
                    job.drawCharacter(job.character, job.sourceCanvas, "candidate", 0.3);
                } catch { }
            }
            if (job.sourceCanvas && canvasHasRenderedPortrait(job.sourceCanvas)) {
                finish();
                return;
            }
            if (job.attempts >= 8) {
                cleanUpCandidatePortraitJob(job);
                return;
            }
            const retryDelay = Math.min(80 + (job.attempts * 70), 500);
            job.attempts++;
            setTimeout(() => {
                if (job.sourceCanvas && job.character && typeof job.drawCharacter === "function") {
                    try {
                        job.drawCharacter(job.character, job.sourceCanvas, "candidate", 0.3);
                    } catch { }
                }
                pollRenderedPortrait();
            }, retryDelay);
        };
        pollRenderedPortrait();
    }
    function requestCandidatePortrait(candidate, onReady) {
        const cacheKey = getCandidatePortraitCacheKey(candidate);
        candidatePortraitPaletteCache.set(cacheKey, getCandidateAvatarPalette(candidate));
        const cachedPortrait = createCachedCandidatePortrait(cacheKey, candidate);
        if (cachedPortrait) {
            onReady(cachedPortrait);
            return;
        }
        const activeJob = candidatePortraitRenderJobs.get(cacheKey);
        if (activeJob) {
            activeJob.callbacks.push(onReady);
            return;
        }
        try {
            const job = {
                cacheKey,
                candidate,
                callbacks: [onReady],
                attempts: 0,
                character: null,
                drawCharacter: null,
                sourceCanvas: null
            };
            candidatePortraitRenderJobs.set(cacheKey, job);
            candidatePortraitRenderQueue.push(job);
            processNextCandidatePortraitRenderJob();
        } catch { }
    }
    function cloneCandidatePortraitMedia(media, candidate) {
        const tag = media?.tagName?.toLowerCase();
        if (tag === "canvas") {
            try {
                return createCircularCandidatePortrait(media, candidate);
            } catch (_err) {
                return null;
            }
        }
        if (tag === "img") {
            const src = media.currentSrc || media.src;
            if (!src) return null;
            const img = document.createElement("img");
            img.className = "bm-candidate-avatar";
            img.src = src;
            img.alt = "";
            img.setAttribute("aria-hidden", "true");
            applyCandidateAvatarPalette(img, candidate);
            return img;
        }
        return null;
    }
    function isPlausibleCandidatePortraitRow(node, media) {
        if (!node || !media) return false;
        const nodeRect = node.getBoundingClientRect();
        const mediaRect = media.getBoundingClientRect();
        return nodeRect.width >= mediaRect.width
            && nodeRect.height >= mediaRect.height
            && nodeRect.width <= 900
            && nodeRect.height <= 180
            && mediaRect.left >= nodeRect.left - 2
            && mediaRect.right <= nodeRect.right + 2
            && mediaRect.top >= nodeRect.top - 2
            && mediaRect.bottom <= nodeRect.bottom + 2;
    }
    function findVisibleCandidatePortrait(candidate, displayName) {
        const searchNames = getCandidatePortraitSearchNames(candidate, displayName);
        if (!searchNames.length) return null;
        const mediaNodes = Array.from(document.querySelectorAll("canvas, img"));
        for (const media of mediaNodes) {
            if (!isVisibleCandidatePortraitSource(media)) continue;
            let node = media.parentElement;
            for (let depth = 0; node && depth < 8; depth++) {
                if (tooltipDiv.contains(node)) break;
                const text = String(node.innerText || node.textContent || "")
                    .replace(/\s+/g, " ")
                    .toLowerCase();
                if (
                    text
                    && searchNames.some(name => text.includes(name))
                    && isPlausibleCandidatePortraitRow(node, media)
                ) {
                    const cloned = cloneCandidatePortraitMedia(media, candidate);
                    if (cloned) return cloned;
                }
                node = node.parentElement;
            }
        }
        return null;
    }
    function createCandidateAvatarPlaceholder(candidate) {
        const placeholder = document.createElement("span");
        placeholder.className = "bm-candidate-avatar bm-candidate-avatar-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        applyCandidateAvatarPalette(placeholder, candidate);
        return placeholder;
    }
    function createWinnerIconElement() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 14 14");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("winner-icon");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", "none");
        path.setAttribute("d", "M12,3.5l-6.81,7L2,7.8");
        svg.appendChild(path);
        return svg;
    }
    function renderCandidateCellContent(cellCandidate, candidate, options = {}) {
        if (!cellCandidate) return;
        const displayName = getCandidateDisplayName(candidate);
        cellCandidate.textContent = "";
        const wrapper = document.createElement("span");
        wrapper.className = "candidate-wrapper bm-candidate-name-wrapper";
        const avatarKey = getCandidatePortraitCacheKey(candidate);
        candidatePortraitPaletteCache.set(avatarKey, getCandidateAvatarPalette(candidate));
        const hasCandidateId = getCandidatePortraitId(candidate) !== null;
        const avatar = (
            renderCandidatePortrait(candidate)
            || (!hasCandidateId ? findVisibleCandidatePortrait(candidate, displayName) : null)
            || createCandidateAvatarPlaceholder(candidate)
        );
        applyCandidateAvatarPalette(avatar, candidate);
        wrapper.appendChild(avatar);
        if (avatar.classList.contains("bm-candidate-avatar-placeholder")) {
            avatar.dataset.candidatePortraitKey = avatarKey;
            requestCandidatePortrait(candidate, portrait => {
                if (portrait) avatar.replaceWith(portrait);
            });
        }
        const nameSpan = document.createElement("span");
        nameSpan.className = "bm-candidate-name-text";
        nameSpan.textContent = displayName;
        wrapper.appendChild(nameSpan);
        if (options.showTick) {
            wrapper.appendChild(createWinnerIconElement());
        }
        cellCandidate.appendChild(wrapper);
    }
    function createCandidateRow(candidate, district, live, isProjectedWinner, isFirst, rowOptions = {}) {
        const candVotes = live ? candidate.currentVotes : candidate.votes;
        const distVotes = live ? district.totalCurrVotes : district.totalVotes;
        const pctNumber = distVotes > 0 ? (candVotes / distVotes) * 100 : 0;
        const pct = pctNumber.toFixed(2);
        const row = document.createElement("tr");
        const cellCandidate = document.createElement("td");
        cellCandidate.classList.add("cellCandidate");
        renderCandidateCellContent(cellCandidate, candidate);
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
        updatePctDeltaBadge(cellPct, candidate, pctNumber, rowOptions);
        row.appendChild(cellPct);
        if (rowOptions.showDelegates === true) {
            const cellDelegates = document.createElement("td");
            cellDelegates.classList.add("cellDelegates");
            cellDelegates.innerText = Math.round(Number(candidate.delegates) || 0).toLocaleString("en-US");
            row.appendChild(cellDelegates);
        }
        return row;
    }
    function createResultsTable(firstColLabel = "State", options = {}) {
        const table = document.createElement("table");
        table.className = "bm-table-results";
        const colGroup = document.createElement("colgroup");
        const widths = ["112px", "auto", "56px", "96px", "72px"];
        if (options.showDelegates === true) widths.push("84px");
        widths.forEach(width => {
            const col = document.createElement("col");
            col.style.width = width;
            colGroup.appendChild(col);
        });
        table.appendChild(colGroup);
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
        thParty.style.textAlign = "center";
        headerRow.appendChild(thParty);
        const thVotes = document.createElement("th");
        thVotes.innerText = "Votes";
        thVotes.style.textAlign = "right";
        headerRow.appendChild(thVotes);
        const thPct = document.createElement("th");
        thPct.innerText = "Pct.";
        thPct.style.textAlign = "right";
        headerRow.appendChild(thPct);
        if (options.showDelegates === true) {
            const thDelegates = document.createElement("th");
            thDelegates.innerText = "Delegates";
            thDelegates.style.textAlign = "right";
            headerRow.appendChild(thDelegates);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        table.appendChild(tbody);
        return { table, tbody };
    }
    function resetHouseStateTooltipMessages() {
        tooltipComponents.winnerLine.setAttribute("style", "display: none;");
        tooltipComponents.notCounting.setAttribute("style", "display: none;");
        tooltipComponents.noElection.setAttribute("style", "display: none;");
        tooltipComponents.reporting.innerText = "";
        tooltipComponents.electors.innerText = "";
        tooltipComponents.electors.setAttribute("style", "display: none;");
        tooltipDiv.classList.remove("bm-detached-primary-tooltip");
        tooltipDiv.classList.remove("bm-polls-closing-tooltip");
        tooltipComponents.entries.classList.remove("bm-primary-stack");
        [
            tooltipComponents.seatGainMessage,
            tooltipComponents.projectedWinnerMessage,
            tooltipComponents.earlyCallMessage,
            tooltipComponents.closeCallMessage
        ].forEach(message => {
            if (!message) return;
            message.style.display = "none";
            message.innerHTML = "";
        });
        if (tooltipComponents.turnout) {
            tooltipComponents.turnout.style.display = "none";
            tooltipComponents.turnout.innerHTML = "";
        }
        while (tooltipComponents.entries.firstChild) {
            tooltipComponents.entries.firstChild.remove();
        }
    }
    function getHouseSummaryParty(candidate) {
        const party = String(candidate?.party || "").toUpperCase();
        if (party === "ID" || party === "I-D") return "ID";
        if (party === "IR" || party === "I-R") return "IR";
        if (party.startsWith("IND") && party.includes("DEM")) return "ID";
        if (party.startsWith("IND") && party.includes("REP")) return "IR";
        if (party === "D" || party.startsWith("DEM")) return "D";
        if (party === "R" || party.startsWith("REP")) return "R";
        if (party === "I" || party.startsWith("IND")) return "I";
        return "I";
    }
    function getHouseSummaryVotes(candidate, district, stateElectData, live) {
        const finalVotes = Number(candidate?.votes) || 0;
        if (!live) return finalVotes;
        const currentVotes = Number(candidate?.currentVotes);
        if (Number.isFinite(currentVotes) && currentVotes > 0) return currentVotes;
        const currentIndex = Number(stateElectData?.indx);
        const updates = Array.isArray(candidate?.updates) ? candidate.updates : [];
        if (updates.length && Number.isFinite(currentIndex) && currentIndex > 0) {
            const updateIndex = Math.min(Math.max(0, currentIndex), updates.length - 1);
            const progress = Number(updates[updateIndex]);
            if (Number.isFinite(progress)) return finalVotes * progress;
        }
        return 0;
    }
    function hasVisibleHouseStateResults(stateId, live = true) {
        if (!live) return true;
        const normalizedStateId = String(stateId || "").toLowerCase();
        const districts = resultProxies.usHouse[normalizedStateId]?.districts || [];
        const stateElectData = getStateElectionData(normalizedStateId);
        return districts.some(district =>
            getHouseSummaryCandidates(district).some(candidate =>
                getHouseSummaryVotes(candidate, district, stateElectData, true) > 0
            )
        );
    }
    function getNativeHouseVoteNodes(container) {
        if (!container) return [];
        return Array.from(container.querySelectorAll("*")).filter(node => {
            const text = String(node.textContent || "").trim();
            if (!/^\d{1,3}(?:,\d{3})*$/.test(text)) return false;
            return !Array.from(node.children || []).some(child =>
                String(child.textContent || "").trim() === text
            );
        });
    }
    function getNativeHousePrimaryCandidateGroups(district) {
        if (!isHousePrimaryDistrict(district)) return [];
        return [
            { key: "dem", candidates: district?.dem?.cands || [] },
            { key: "rep", candidates: district?.rep?.cands || [] },
            { key: "allCands", candidates: district?.allCands?.cands || [] }
        ].filter(group => group.candidates.length > 0);
    }
    function getNativeHouseDistrictCandidates(district) {
        if (Array.isArray(district?.cands)) return district.cands;
        return getNativeHousePrimaryCandidateGroups(district)
            .flatMap(group => group.candidates);
    }
    function getNativeHouseDistrictContainer(header, district) {
        let node = header?.parentElement;
        const candidateCount = getNativeHouseDistrictCandidates(district).length;
        while (node && node !== document.body) {
            const text = String(node.textContent || "");
            if (/\d+%\s*Reporting/i.test(text) && getNativeHouseVoteNodes(node).length >= candidateCount) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }
    function getNativeHouseCandidateVoteIndex(voteNode, container, candidates) {
        let node = voteNode?.parentElement;
        while (node && node !== container?.parentElement) {
            const text = String(node.textContent || "").replace(/\s+/g, " ").toLowerCase();
            const matches = candidates
                .map((candidate, index) => ({
                    index,
                    names: getCandidatePortraitSearchNames(candidate, getCandidateDisplayName(candidate))
                }))
                .filter(candidate => candidate.names.some(name => text.includes(name)));
            if (matches.length === 1) return matches[0].index;
            if (node === container) break;
            node = node.parentElement;
        }
        return null;
    }
    function readNativeHouseDistrictSnapshots(stateId) {
        const normalizedStateId = String(stateId || "").toLowerCase();
        const now = Date.now();
        if (
            nativeHouseDistrictSnapshotCache.stateId === normalizedStateId
            && now - nativeHouseDistrictSnapshotCache.timestamp < 500
        ) {
            return nativeHouseDistrictSnapshotCache.snapshots;
        }
        const snapshots = new Map();
        const districts = resultProxies.usHouse[normalizedStateId]?.districts || [];
        const districtsByNumber = new Map(
            districts.map(district => [Number(district?.district), district])
        );
        const stateCode = normalizedStateId.toUpperCase();
        const headerPattern = new RegExp(`^${stateCode}\\s*-\\s*(\\d+)$`, "i");
        Array.from(document.querySelectorAll("body *")).forEach(header => {
            if (tooltipDiv.contains(header)) return;
            const match = String(header.textContent || "").trim().match(headerPattern);
            if (!match) return;
            const districtNumber = Number(match[1]);
            const district = districtsByNumber.get(districtNumber);
            const nativeCandidates = getNativeHouseDistrictCandidates(district);
            if (!district || !nativeCandidates.length) return;
            const container = getNativeHouseDistrictContainer(header, district);
            if (!container) return;
            const reportingMatch = String(container.textContent || "").match(/(\d+)%\s*Reporting/i);
            const reporting = reportingMatch ? Number(reportingMatch[1]) : 0;
            const voteNodes = getNativeHouseVoteNodes(container);
            const votes = new Array(nativeCandidates.length).fill(0);
            const assignedCandidateIndexes = new Set();
            const unusedVotes = [];
            voteNodes.forEach(voteNode => {
                const value = Number(String(voteNode.textContent || "").replace(/,/g, ""));
                if (!Number.isFinite(value)) return;
                const candidateIndex = getNativeHouseCandidateVoteIndex(voteNode, container, nativeCandidates);
                if (candidateIndex === null || assignedCandidateIndexes.has(candidateIndex)) {
                    unusedVotes.push(value);
                    return;
                }
                votes[candidateIndex] = value;
                assignedCandidateIndexes.add(candidateIndex);
            });
            nativeCandidates.forEach((_candidate, candidateIndex) => {
                if (assignedCandidateIndexes.has(candidateIndex) || !unusedVotes.length) return;
                votes[candidateIndex] = unusedVotes.shift();
            });
            if (reporting === 0 || votes.some(value => value > 0)) {
                const primaryGroups = getNativeHousePrimaryCandidateGroups(district);
                if (primaryGroups.length > 0) {
                    const primaryVotes = {};
                    let offset = 0;
                    primaryGroups.forEach(group => {
                        primaryVotes[group.key] = votes.slice(offset, offset + group.candidates.length);
                        offset += group.candidates.length;
                    });
                    snapshots.set(districtNumber, { reporting, votes, primaryVotes });
                } else {
                    snapshots.set(districtNumber, { reporting, votes });
                }
            }
        });
        nativeHouseDistrictSnapshotCache = {
            stateId: normalizedStateId,
            timestamp: now,
            snapshots
        };
        return snapshots;
    }
    function getLiveHouseDistrictSnapshot(stateId, district, live = true) {
        if (!live || !district) return district;
        const electionNightFinished = isElectionNightFinished();
        const nativeSnapshot = readNativeHouseDistrictSnapshots(stateId).get(Number(district.district));
        if (isHousePrimaryDistrict(district)) {
            let totalCurrVotes = 0;
            let totalVotes = 0;
            const updatePrimaryGroup = (groupKey) => {
                const group = district?.[groupKey];
                if (!Array.isArray(group?.cands)) return group;
                let groupCurrentVotes = 0;
                let groupFinalVotes = 0;
                const cands = group.cands.map((candidate, candidateIndex) => {
                    const finalVotes = Number(candidate?.votes) || 0;
                    const storedCurrentVotes = Number(candidate?.currentVotes);
                    const hasStoredCurrentVotes = candidate?.currentVotes !== undefined
                        && candidate?.currentVotes !== null
                        && Number.isFinite(storedCurrentVotes);
                    let currentVotes = Number.isFinite(nativeSnapshot?.primaryVotes?.[groupKey]?.[candidateIndex])
                        ? nativeSnapshot.primaryVotes[groupKey][candidateIndex]
                        : hasStoredCurrentVotes
                        ? storedCurrentVotes
                        : 0;
                    if (!hasStoredCurrentVotes && electionNightFinished && currentVotes <= 0) {
                        currentVotes = finalVotes;
                    }
                    totalCurrVotes += currentVotes;
                    totalVotes += finalVotes;
                    groupCurrentVotes += currentVotes;
                    groupFinalVotes += finalVotes;
                    return { ...candidate, currentVotes };
                });
                const hasNativeGroupVotes = Array.isArray(nativeSnapshot?.primaryVotes?.[groupKey]);
                const groupFullyCounted = groupFinalVotes > 0
                    && groupCurrentVotes >= groupFinalVotes * 0.999
                    && (hasNativeGroupVotes || electionNightFinished || Number(nativeSnapshot?.reporting) >= 100);
                return {
                    ...group,
                    cands,
                    pW: isProjectedPrimaryGroup(group) || groupFullyCounted
                };
            };
            return {
                ...district,
                dem: updatePrimaryGroup("dem"),
                rep: updatePrimaryGroup("rep"),
                allCands: updatePrimaryGroup("allCands"),
                totalCurrVotes,
                totalVotes: Number(district.totalVotes) || totalVotes
            };
        }
        if (!Array.isArray(district.cands)) return district;
        let totalCurrVotes = 0;
        let totalVotes = 0;
        const cands = district.cands.map((candidate, candidateIndex) => {
            const finalVotes = Number(candidate?.votes) || 0;
            const storedCurrentVotes = Number(candidate?.currentVotes);
            const hasStoredCurrentVotes = candidate?.currentVotes !== undefined
                && candidate?.currentVotes !== null
                && Number.isFinite(storedCurrentVotes);
            let currentVotes = Number.isFinite(nativeSnapshot?.votes?.[candidateIndex])
                ? nativeSnapshot.votes[candidateIndex]
                : hasStoredCurrentVotes
                ? storedCurrentVotes
                : 0;
            if (!hasStoredCurrentVotes && electionNightFinished && district.pW === true) {
                currentVotes = finalVotes;
            }
            totalCurrVotes += currentVotes;
            totalVotes += finalVotes;
            return { ...candidate, currentVotes };
        });
        return {
            ...district,
            cands,
            totalCurrVotes,
            totalVotes: Number(district.totalVotes) || totalVotes
        };
    }
    function getHouseSummaryCandidate(candidate, fallbackParty) {
        if (!candidate) return null;
        if (candidate.party || candidate.caucus || candidate.caucusParty) return candidate;
        let party = fallbackParty;
        let caucus = "";
        try {
            const character = getCandidateCharacterArray(candidate);
            const wrapped = Array.isArray(character)
                ? Executive?.data?.characters?.wrapCharacter(character, "candidate")
                : null;
            const attributes = wrapped?.extendedAttribs || wrapped || {};
            party = attributes.party || getCharacterPortraitPartyCode(character) || fallbackParty;
            caucus = attributes.caucus || attributes.caucusParty || "";
        } catch { }
        return { ...candidate, party, caucus };
    }
    function getHouseSummaryCandidates(district) {
        if (Array.isArray(district?.cands)) {
            return district.cands.map(candidate => getHouseSummaryCandidate(candidate, "I")).filter(Boolean);
        }
        const candidates = [];
        const addCandidates = (source, fallbackParty) => {
            (source?.cands || []).forEach(candidate => {
                const summaryCandidate = getHouseSummaryCandidate(candidate, fallbackParty);
                if (summaryCandidate) candidates.push(summaryCandidate);
            });
        };
        addCandidates(district?.dem, "D");
        addCandidates(district?.rep, "R");
        addCandidates(district?.allCands, "I");
        return candidates;
    }
    function getPreviousHouseGeneralElection() {
        let archive = null;
        try {
            archive = (typeof usHouseArchive !== "undefined") ? usHouseArchive : globalThis.usHouseArchive;
        } catch { }
        const electionYear = getElectionYear();
        return (Array.isArray(archive) ? archive : [])
            .filter(entry =>
                entry?.category === "general"
                && (!Number.isFinite(electionYear) || Number(entry.year) < electionYear)
            )
            .sort((a, b) => Number(b.year) - Number(a.year))[0];
    }
    function getPreviousHouseDistrictWinner(stateId, districtNumber) {
        const previousGeneral = getPreviousHouseGeneralElection();
        const stateName = String(Executive?.data?.states?.[stateId]?.name || "").toLowerCase();
        const previousDistrict = (previousGeneral?.elections || []).find(election =>
            String(election?.district || "").toLowerCase() === `${stateName} - district ${districtNumber}`
        );
        return (previousDistrict?.cands || previousDistrict?.candidates || [])
            .slice()
            .sort((a, b) => (Number(b.votes ?? b.totVotes) || 0) - (Number(a.votes ?? a.totVotes) || 0))[0] || null;
    }
    function getHouseDistrictsForState(stateId) {
        const stateSummary = resultProxies.usHouse[String(stateId || "").toLowerCase()];
        return Array.isArray(stateSummary?.districts) ? stateSummary.districts : [];
    }
    function getHouseDistrictFlipData(stateId, district, live = true) {
        if (
            !district?.pW
            || !Array.isArray(district?.cands)
            || district.cands.length === 0
            || !shouldRevealHouseDistrictResults(district, live)
        ) {
            return { flipped: false, winnerParty: null, previousParty: null };
        }
        const winner = district.cands.slice()
            .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0))[0];
        const districtNumber = Number(district.district);
        const previousWinner = getPreviousHouseDistrictWinner(String(stateId || "").toLowerCase(), districtNumber)
            || district.cands.find(candidate => candidate?.incumbent === true);
        const winnerParty = getHouseSummaryParty(winner);
        const previousParty = getHouseSummaryParty(previousWinner);
        const hasExplicitGain = typeof district.gain === "boolean";
        return {
            flipped: hasExplicitGain
                ? district.gain
                : Boolean(previousWinner && previousParty !== winnerParty),
            winnerParty,
            previousParty
        };
    }
    function getPreviousHouseSeatCounts(districtId, districts) {
        const counts = { R: 0, D: 0, ID: 0, IR: 0, I: 0 };
        const addWinner = candidate => {
            if (!candidate) return;
            counts[getHouseSummaryParty(candidate)]++;
        };
        const previousGeneral = getPreviousHouseGeneralElection();
        const stateName = String(Executive?.data?.states?.[districtId]?.name || "").toLowerCase();
        const previousDistricts = (previousGeneral?.elections || []).filter(election =>
            String(election?.district || "").toLowerCase().startsWith(stateName + " - district ")
        );
        (districts || []).forEach(district => {
            const incumbent = getHouseSummaryCandidates(district)
                .find(candidate => candidate?.incumbent === true);
            if (incumbent) {
                addWinner(incumbent);
                return;
            }
            const districtNumber = Number(district?.district);
            const previousDistrict = previousDistricts.find(election =>
                String(election?.district || "").toLowerCase() === `${stateName} - district ${districtNumber}`
            );
            const previousWinner = (previousDistrict?.cands || previousDistrict?.candidates || [])
                .slice()
                .sort((a, b) => (Number(b.votes ?? b.totVotes) || 0) - (Number(a.votes ?? a.totVotes) || 0))[0];
            addWinner(previousWinner);
        });
        return counts;
    }
    function updateHouseDistrictTooltipExtras(stateId, currentDistrict) {
        if (!currentDistrict?.pW) return;
        const flipData = getHouseDistrictFlipData(stateId, currentDistrict, true);
        if (
            flipData.flipped
            && tooltipComponents.projectedWinnerMessage
            && tooltipComponents.projectedWinnerMessage.style.display !== "none"
            && !tooltipComponents.projectedWinnerMessage.querySelector(".flipProjectedWinner")
        ) {
            const flipBadge = document.createElement("div");
            flipBadge.className = "flipProjectedWinner";
            flipBadge.innerHTML = `<svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-iconFLIP">
                <line x1="7" y1="2" x2="7" y2="12"></line>
                <line x1="2" y1="7" x2="12" y2="7"></line>
            </svg>&nbsp;FLIP`;
            tooltipComponents.projectedWinnerMessage.querySelector(".candidate-wrapper")?.appendChild(flipBadge);
        }
        const totalVotes = Number(currentDistrict.totalVotes) || 0;
        const currentVotes = Number(currentDistrict.totalCurrVotes) || 0;
        if (!tooltipComponents.turnout || totalVotes <= 0 || currentVotes / totalVotes < 0.999) return;
        const stateDistrictCount = getHouseDistrictsForState(stateId).length || 1;
        const turnoutText = getStateTurnoutText(totalVotes, stateId, stateDistrictCount);
        if (!turnoutText) return;
        tooltipComponents.turnout.style.display = "block";
        tooltipComponents.turnout.className = "state-turnout";
        tooltipComponents.turnout.textContent = turnoutText;
    }
    function updateHouseStateTooltip(districtId, force, live) {
        if (tooltipComponents.properties.visible === false) return;
        if (
            tooltipComponents.properties.electionType === "usHouse"
            && tooltipComponents.properties.districtId === districtId
            && force !== true
        ) {
            return;
        }
        tooltipComponents.properties.electionType = "usHouse";
        tooltipComponents.properties.districtId = districtId;
        resetHouseStateTooltipMessages();
        const stateName = Executive?.data?.states?.[districtId]?.name;
        tooltipComponents.title.innerText = String(stateName || districtId || "").toUpperCase();
        const stateSummary = resultProxies.usHouse[districtId];
        const districts = Array.isArray(stateSummary?.districts) ? stateSummary.districts : [];
        if (!districts.length) {
            tooltipComponents.noElection.removeAttribute("style");
            return;
        }
        const partyRows = {
            R: { label: "Republicans", partyLabel: "R", votes: 0, seats: 0 },
            D: { label: "Democrats", partyLabel: "D", votes: 0, seats: 0 },
            ID: { label: "Independent D", partyLabel: "I-D", votes: 0, seats: 0 },
            IR: { label: "Independent R", partyLabel: "I-R", votes: 0, seats: 0 },
            I: { label: "Independents", partyLabel: "I", votes: 0, seats: 0 }
        };
        const stateElectData = getStateElectionData(districtId);
        const isPrimary = districts.some(district =>
            !Array.isArray(district?.cands)
            && (
                Array.isArray(district?.dem?.cands)
                || Array.isArray(district?.rep?.cands)
                || Array.isArray(district?.allCands?.cands)
            )
        );
        let totalFinalVotes = 0;
        districts.forEach(district => {
            const candidates = getHouseSummaryCandidates(district);
            if (!candidates.length) return;
            candidates.forEach(candidate => {
                const key = getHouseSummaryParty(candidate);
                partyRows[key].votes += getHouseSummaryVotes(candidate, district, stateElectData, live);
                totalFinalVotes += Number(candidate.votes) || 0;
            });
            if (!isPrimary && (!live || district.pW === true)) {
                const winner = candidates.slice().sort((a, b) =>
                    (Number(b.votes) || 0) - (Number(a.votes) || 0)
                )[0];
                if (winner) partyRows[getHouseSummaryParty(winner)].seats++;
            }
        });
        const visibleRows = ["R", "D", "ID", "IR", "I"]
            .map(key => ({ key, ...partyRows[key] }))
            .filter(row => row.votes > 0)
            .sort((a, b) => b.votes - a.votes);
        const totalVotes = visibleRows.reduce((sum, row) => sum + row.votes, 0);
        if (live && totalVotes <= 0) {
            showNotCountingMessage();
            return;
        }
        const reportingRatio = !live || totalFinalVotes <= 0
            ? 1
            : Math.max(0, Math.min(1, totalVotes / totalFinalVotes));
        const reportingPct = Math.round(reportingRatio * 100);
        const allCounted = !live || reportingRatio >= 0.999;
        const turnoutText = allCounted ? getStateTurnoutText(totalVotes) : "";
        if (turnoutText && tooltipComponents.turnout) {
            tooltipComponents.turnout.style.display = "block";
            tooltipComponents.turnout.className = "state-turnout";
            tooltipComponents.turnout.textContent = turnoutText;
        }
        const previousSeatCounts = !isPrimary
            ? getPreviousHouseSeatCounts(districtId, districts)
            : null;
        const topRows = visibleRows.slice(0, 2);
        const marginText = topRows.length >= 2
            ? `Margin: ${Math.round(Math.abs(topRows[0].votes - topRows[1].votes)).toLocaleString("en-US")} (${(Math.abs(topRows[0].votes - topRows[1].votes) / totalVotes * 100).toFixed(2)}%)`
            : "";
        const table = document.createElement("table");
        table.className = "bm-table-results bm-house-summary-table";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        const headerLabels = ["State", "Candidate", "Party", "Votes", "Pct."];
        if (!isPrimary) headerLabels.push("Seats");
        headerLabels.forEach((label, index) => {
            const th = document.createElement("th");
            th.textContent = label;
            if (index >= 3) th.style.textAlign = "right";
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        visibleRows.forEach((partyRow, index) => {
            const row = document.createElement("tr");
            if (index === 0) {
                const stateCell = document.createElement("td");
                stateCell.className = "stateCell";
                stateCell.rowSpan = visibleRows.length;
                const reportingText = `<div class="state-reporting">${reportingPct}% in</div>`;
                const marginBlock = marginText
                    ? `<div class="state-difference">${marginText}</div>`
                    : "";
                stateCell.innerHTML = `<div class="state-info"><div class="state-name">${tooltipComponents.title.innerText}</div>${reportingText}${marginBlock}</div>`;
                row.appendChild(stateCell);
            }
            const candidateCell = document.createElement("td");
            candidateCell.className = "cellCandidate";
            candidateCell.textContent = partyRow.label;
            row.appendChild(candidateCell);
            const partyCell = document.createElement("td");
            const partyBadge = document.createElement("div");
            partyBadge.textContent = partyRow.partyLabel;
            partyBadge.className = partyRow.key === "R"
                ? "letter-party-r"
                : (partyRow.key === "D" ? "letter-party-d" : "letter-party-i");
            partyCell.appendChild(partyBadge);
            row.appendChild(partyCell);
            const votesCell = document.createElement("td");
            votesCell.className = "cellVotes";
            votesCell.textContent = Math.round(partyRow.votes).toLocaleString("en-US");
            row.appendChild(votesCell);
            const pctCell = document.createElement("td");
            pctCell.className = "cellPct";
            pctCell.textContent = `${(totalVotes > 0 ? (partyRow.votes / totalVotes) * 100 : 0).toFixed(2)}%`;
            row.appendChild(pctCell);
            if (!isPrimary) {
                const seatsCell = document.createElement("td");
                seatsCell.className = "bm-house-seats";
                const seatDelta = partyRow.seats - (Number(previousSeatCounts?.[partyRow.key]) || 0);
                const seatDeltaText = allCounted
                    ? (seatDelta > 0 ? `(+${seatDelta})` : (seatDelta < 0 ? `(${seatDelta})` : "(=)"))
                    : "";
                seatsCell.appendChild(document.createTextNode(`${partyRow.seats} ${partyRow.seats === 1 ? "seat" : "seats"}`));
                if (seatDeltaText) {
                    const seatDeltaBadge = document.createElement("span");
                    seatDeltaBadge.className = "bm-house-seat-delta";
                    seatDeltaBadge.classList.add(
                        seatDelta > 0
                            ? "bm-house-seat-delta-gain"
                            : (seatDelta < 0 ? "bm-house-seat-delta-loss" : "bm-house-seat-delta-even")
                    );
                    seatDeltaBadge.textContent = seatDeltaText;
                    seatsCell.appendChild(seatDeltaBadge);
                }
                row.appendChild(seatsCell);
            }
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        tooltipComponents.entries.appendChild(table);
    }
    function getFreshHouseDistrict(stateId, district, live) {
        if (!live || !district) return district;
        try {
            const districtNumber = Number(district.district);
            const matchingDistrict = (electNightUSH?.elections || []).find(candidateDistrict =>
                String(candidateDistrict?.state || "").toLowerCase() === String(stateId || "").toLowerCase()
                && Number(candidateDistrict?.district) === districtNumber
            );
            return matchingDistrict || district;
        } catch {
            return district;
        }
    }
    function getFinalHouseDistrictDisplay(district) {
        if (!district || !Array.isArray(district.cands)) return district;
        const finalVoteTotal = district.cands.reduce((sum, candidate) =>
            sum + (Number(candidate?.votes) || 0), 0
        );
        if (finalVoteTotal <= 0) return district;
        return {
            ...district,
            totalVotes: Number(district.totalVotes) > 0 ? Number(district.totalVotes) : finalVoteTotal,
            totalCurrVotes: Number(district.totalCurrVotes) > 0 ? Number(district.totalCurrVotes) : finalVoteTotal,
            cands: district.cands.map(candidate => ({
                ...candidate,
                currentVotes: Number(candidate?.currentVotes) > 0
                    ? Number(candidate.currentVotes)
                    : (Number(candidate?.votes) || 0)
            }))
        };
    }
    function isHousePrimaryDistrict(district) {
        return !Array.isArray(district?.cands)
            && (
                Array.isArray(district?.dem?.cands)
                || Array.isArray(district?.rep?.cands)
                || Array.isArray(district?.allCands?.cands)
            );
    }
    function getHousePrimaryCandidateParty(candidate, fallbackParty = "I") {
        return getHousePrimaryCandidateAffiliation(candidate, fallbackParty).party;
    }
    function getHousePrimaryCandidateAffiliation(candidate, fallbackParty = "I") {
        if (candidate?.party) {
            return {
                party: candidate.party,
                caucus: candidate.caucus || candidate.caucusParty || "",
                caucusParty: candidate.caucusParty || candidate.caucus || ""
            };
        }
        try {
            const candArray = findCandByID([candidate.id])[0];
            const wrappedCandObj = Executive.data.characters.wrapCharacter(candArray, "candidate");
            const partyName = String(wrappedCandObj?.extendedAttribs?.party || "");
            const caucusParty = String(
                wrappedCandObj?.caucusParty
                || wrappedCandObj?.extendedAttribs?.caucusParty
                || wrappedCandObj?.extendedAttribs?.caucus
                || ""
            );
            if (partyName === "Independent") {
                return {
                    party: "I",
                    caucus: caucusParty.substring(0, 1),
                    caucusParty
                };
            }
            return {
                party: partyName.substring(0, 1) || fallbackParty,
                caucus: "",
                caucusParty: ""
            };
        } catch {
            return {
                party: fallbackParty,
                caucus: "",
                caucusParty: ""
            };
        }
    }
    function buildHousePrimaryDisplayDistrict(candidates, party, live, context = {}) {
        let currentVoteTotal = 0;
        let finalVoteTotal = 0;
        const newCandArray = candidates.map(candidate => {
            const newCandidate = { ...candidate };
            if (context.stateId && !newCandidate.stateId && !newCandidate.state) newCandidate.stateId = context.stateId;
            if (context.district && !newCandidate.district) newCandidate.district = context.district;
            const affiliation = party
                ? {
                    party,
                    caucus: candidate?.caucus || candidate?.caucusParty || "",
                    caucusParty: candidate?.caucusParty || candidate?.caucus || ""
                }
                : getHousePrimaryCandidateAffiliation(candidate, "I");
            newCandidate.party = affiliation.party;
            newCandidate.caucus = affiliation.caucus || newCandidate.caucus || "";
            newCandidate.caucusParty = affiliation.caucusParty || newCandidate.caucusParty || "";
            const finalVotes = Number(candidate?.votes) || 0;
            const currentVotes = live ? (Number(candidate?.currentVotes) || 0) : finalVotes;
            newCandidate.currentVotes = currentVotes;
            currentVoteTotal += currentVotes;
            finalVoteTotal += finalVotes;
            return newCandidate;
        });
        return {
            totalVotes: finalVoteTotal,
            totalCurrVotes: live ? currentVoteTotal : finalVoteTotal,
            cands: newCandArray,
            pW: false
        };
    }
    function isProjectedPrimaryGroup(group) {
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
    }
    function isPrimaryGroupFullyCounted(group, live) {
        if (live !== true) return true;
        const candidates = group?.cands || [];
        const finalVotes = candidates.reduce((total, candidate) => total + (Number(candidate?.votes) || 0), 0);
        const currentVotes = candidates.reduce((total, candidate) => total + (Number(candidate?.currentVotes) || 0), 0);
        return finalVotes > 0 && currentVotes / finalVotes >= 0.999;
    }
    function updateHousePrimaryDistrictTooltip(stateId, currentDistrict, live) {
        const demCandidates = currentDistrict?.dem?.cands || [];
        const repCandidates = currentDistrict?.rep?.cands || [];
        const allCandidates = currentDistrict?.allCands?.cands || [];
        const isNonpartisanPrimary = demCandidates.length === 0 && repCandidates.length === 0;
        const housePrimaryTurnoutOptions = {
            turnoutStateId: stateId,
            turnoutDistrictDivisor: getHouseDistrictsForState(stateId).length || 1
        };
        const totalCurrentVotes = [...demCandidates, ...repCandidates, ...allCandidates].reduce(
            (total, candidate) => total + (live ? (Number(candidate?.currentVotes) || 0) : (Number(candidate?.votes) || 0)),
            0
        );
        if (live && totalCurrentVotes <= 0) {
            showNotCountingMessage("This district has not begun counting yet.");
            return;
        }
        if (isNonpartisanPrimary) {
            const fakeDistrict = buildHousePrimaryDisplayDistrict(allCandidates, null, live, {
                stateId,
                district: currentDistrict?.district
            });
            const markNonpartisanAdvancers = live !== true || isProjectedPrimaryGroup(currentDistrict?.allCands);
            createNewEntries(fakeDistrict, live, false, true, false, {
                markAdvancing: markNonpartisanAdvancers,
                advancingCount: getNonpartisanPrimaryAdvanceCount("usHouse", currentDistrict, stateId),
                turnoutVotes: fakeDistrict.totalVotes,
                ...housePrimaryTurnoutOptions
            });
            return;
        }
        const showDemPrimary = demCandidates.length > 0;
        const showRepPrimary = repCandidates.length > 0;
        const showSectionLabels = showDemPrimary && showRepPrimary;
        const totalPrimaryTurnoutVotes = [...demCandidates, ...repCandidates].reduce(
            (total, candidate) => total + (Number(candidate?.votes) || 0),
            0
        );
        const currentPrimaryTurnoutVotes = [...demCandidates, ...repCandidates].reduce(
            (total, candidate) => total + (live ? (Number(candidate?.currentVotes) || 0) : (Number(candidate?.votes) || 0)),
            0
        );
        let renderedPrimarySection = false;
        if (showDemPrimary) {
            const demFakeDistrict = buildHousePrimaryDisplayDistrict(demCandidates, "D", live, {
                stateId,
                district: currentDistrict?.district
            });
            createNewEntries(demFakeDistrict, live, false, true, false, {
                append: renderedPrimarySection,
                sectionLabel: showSectionLabels ? "DEMOCRATIC PRIMARY" : "",
                stackSections: showSectionLabels,
                sectionParty: "D",
                markWinner: live !== true || isProjectedPrimaryGroup(currentDistrict?.dem),
                turnoutVotes: totalPrimaryTurnoutVotes,
                turnoutTotalVotes: totalPrimaryTurnoutVotes,
                turnoutCurrentVotes: currentPrimaryTurnoutVotes,
                showTurnout: true,
                ...housePrimaryTurnoutOptions
            });
            renderedPrimarySection = true;
        }
        if (showRepPrimary) {
            const repFakeDistrict = buildHousePrimaryDisplayDistrict(repCandidates, "R", live, {
                stateId,
                district: currentDistrict?.district
            });
            createNewEntries(repFakeDistrict, live, false, true, false, {
                append: renderedPrimarySection,
                sectionLabel: showSectionLabels ? "REPUBLICAN PRIMARY" : "",
                stackSections: showSectionLabels,
                sectionParty: "R",
                markWinner: live !== true || isProjectedPrimaryGroup(currentDistrict?.rep),
                turnoutVotes: totalPrimaryTurnoutVotes,
                turnoutTotalVotes: totalPrimaryTurnoutVotes,
                turnoutCurrentVotes: currentPrimaryTurnoutVotes,
                showTurnout: true,
                ...housePrimaryTurnoutOptions
            });
        }
    }
    function updateHouseDistrictTooltip(stateId, district, force, live) {
        if (tooltipComponents.properties.visible === false || !district) return;
        const currentDistrict = getLiveHouseDistrictSnapshot(
            stateId,
            getFreshHouseDistrict(stateId, district, live),
            live
        );
        const districtNumber = Number(currentDistrict.district) || 0;
        const districtKey = `${String(stateId || "").toLowerCase()}-${districtNumber}`;
        if (
            tooltipComponents.properties.electionType === "usHouseDistrict"
            && tooltipComponents.properties.districtId === districtKey
            && force !== true
        ) {
            return;
        }
        tooltipComponents.properties.electionType = "usHouseDistrict";
        tooltipComponents.properties.districtId = districtKey;
        resetHouseStateTooltipMessages();
        const stateName = Executive?.data?.states?.[String(stateId || "").toLowerCase()]?.name;
        tooltipComponents.title.innerText = `${String(stateName || stateId || "").toUpperCase()} - DISTRICT ${districtNumber}`;
        while (tooltipComponents.entries.firstChild) {
            tooltipComponents.entries.firstChild.remove();
        }
        if (isHousePrimaryDistrict(currentDistrict)) {
            updateHousePrimaryDistrictTooltip(stateId, currentDistrict, live);
            return;
        }
        if (!Array.isArray(currentDistrict.cands) || currentDistrict.cands.length === 0) {
            tooltipComponents.noElection.removeAttribute("style");
            return;
        }
        const displayDistrict = live ? getLiveDisplayDistrict(currentDistrict) : getFinalHouseDistrictDisplay(currentDistrict);
        if (live && (Number(displayDistrict.totalCurrVotes) || 0) === 0) {
            showNotCountingMessage("This district has not begun counting yet.");
            return;
        }
        createNewEntries(displayDistrict, live, true, false, false);
        updateHouseDistrictTooltipExtras(stateId, displayDistrict);
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
    function rememberPresidentialPrimaryParty(party, trusted = true) {
        lastPresidentialPrimaryParty = party;
        if (trusted) lastPresidentialPrimaryPartyTrusted = true;
        return party;
    }
    function getPresidentialPrimaryPartyFromElement(element) {
        let currentElement = element;
        while (currentElement && currentElement !== document.body) {
            const id = String(currentElement.id || "");
            if (id === "presElectDemPTab") return "D";
            if (id === "presElectRepPTab") return "R";
            const text = String(currentElement.innerText || currentElement.textContent || "").trim().toLowerCase();
            if (text === "democrats" || text === "democratic primary") return "D";
            if (text === "republicans" || text === "republican primary") return "R";
            currentElement = currentElement.parentElement;
        }
        return null;
    }
    function installPresidentialPrimaryWatchers() {
        if (presidentialPrimaryWatcherInstalled || typeof document === "undefined") return;
        presidentialPrimaryWatcherInstalled = true;
        document.addEventListener("click", event => {
            const party = getPresidentialPrimaryPartyFromElement(event.target);
            if (party) rememberPresidentialPrimaryParty(party);
        }, true);
    }
    function getActivePresidentialPrimaryParty() {
        installPresidentialPrimaryWatchers();
        const activeElementParty = getPresidentialPrimaryPartyFromElement(document.activeElement);
        if (activeElementParty) return rememberPresidentialPrimaryParty(activeElementParty);
        const demTab = document.getElementById("presElectDemPTab");
        const repTab = document.getElementById("presElectRepPTab");
        const tabLooksOpen = (tab) => {
            if (!tab) return false;
            const className = String(tab.className || "");
            const ariaSelected = tab.getAttribute("aria-selected");
            return tab.disabled === true
                || ariaSelected === "true"
                || /(^|[^a-z])(open|active|selected|current)([^a-z]|$)/i.test(className)
                || /(?:^|\s)[A-Za-z0-9_-]*C(?:\s|$)/.test(className);
        };
        const demOpen = tabLooksOpen(demTab);
        const repOpen = tabLooksOpen(repTab);
        if (demOpen && !repOpen) return rememberPresidentialPrimaryParty("D");
        if (repOpen && !demOpen) return rememberPresidentialPrimaryParty("R");
        const pageState = globalThis.openElectPage3;
        if (typeof pageState === "string") {
            const lowerState = pageState.toLowerCase();
            if (!lastPresidentialPrimaryPartyTrusted && lowerState.includes("dem")) {
                return rememberPresidentialPrimaryParty("D", false);
            }
            if (!lastPresidentialPrimaryPartyTrusted && lowerState.includes("rep")) {
                return rememberPresidentialPrimaryParty("R", false);
            }
        }
        return lastPresidentialPrimaryParty;
    }
    installPresidentialPrimaryWatchers();
    function getElectionNightStateUpdateFunction(electionType) {
        if (electionType === "governor" && typeof eNightGovUpdate === "function") return eNightGovUpdate;
        if (electionType === "usSenate" && typeof eNightUSSUpdate === "function") return eNightUSSUpdate;
        return null;
    }
    function refreshLiveStateResultsForTooltip(electionType, districtId) {
        const updateFunction = getElectionNightStateUpdateFunction(electionType);
        if (!updateFunction || !districtId) return;
        const previousActiveMap = activeMap;
        const originalGetElement = document.getElementById;
        const dummyElem = document.createElement("div");
        const dummyContext = new Proxy({}, {
            get: (_target, property) => {
                if (property === "measureText") return () => ({ width: 0 });
                return () => {};
            },
            set: () => true
        });
        dummyElem.getContext = () => dummyContext;
        activeMap = districtId.toUpperCase();
        document.getElementById = () => dummyElem;
        try {
            updateFunction();
        } catch { }
        finally {
            document.getElementById = originalGetElement;
            dummyElem.remove();
            activeMap = previousActiveMap;
        }
    }
    function getNonpartisanPrimaryAdvanceCount(electionType, currentDistrict, districtId) {
        const optionNames = [
            "nonPartisanAdv",
            "advancingCount",
            "advanceCount",
            "candidatesWhoAdvance",
            "runoffCount"
        ];
        const state = Executive?.data?.states?.[(districtId || "").toLowerCase()];
        const sources = [
            currentDistrict,
            currentDistrict?.allCands,
            currentDistrict?.allPri,
            state,
            state?.elections,
            state?.electionOptions,
            state?.options,
            Executive?.data,
            Executive?.data?.advancedOptions
        ];
        const candidateCount = currentDistrict?.allCands?.cands?.length
            || currentDistrict?.cands?.length
            || 0;
        const normalizeCount = (value) => {
            const count = Math.floor(Number(value));
            if (!Number.isFinite(count) || count <= 0) return null;
            return candidateCount > 0 ? Math.min(count, candidateCount) : count;
        };
        const readGlobalOption = (name) => {
            try {
                if (typeof globalThis !== "undefined" && globalThis[name] !== undefined) return globalThis[name];
            } catch { }
            try {
                if (typeof window !== "undefined" && window[name] !== undefined) return window[name];
            } catch { }
            try {
                return Function(`return (typeof ${name} !== "undefined") ? ${name} : undefined;`)();
            } catch {
                return undefined;
            }
        };
        for (const source of sources) {
            if (!source || typeof source !== "object") continue;
            for (const name of optionNames) {
                const count = normalizeCount(source[name]);
                if (count !== null) return count;
            }
        }
        for (const name of optionNames) {
            const count = normalizeCount(readGlobalOption(name));
            if (count !== null) return count;
        }
        return candidateCount > 0 ? Math.min(2, candidateCount) : 2;
    }
    function getStateTurnoutText(finalVotes, explicitStateId = null, districtDivisor = 1) {
        const stateId = String(explicitStateId || tooltipComponents?.properties?.districtId || "").toLowerCase();
        const state = Executive?.data?.states?.[stateId];
        const population = Number(state?.pop) || 0;
        let registeredVoters = Number(state?.regVoters);
        if (!Number.isFinite(registeredVoters)) registeredVoters = 0;
        const registeredFraction = registeredVoters > 1 ? registeredVoters / 100 : registeredVoters;
        const registered = Math.round((population * registeredFraction) / Math.max(1, Number(districtDivisor) || 1));
        const votes = Math.round(Number(finalVotes) || 0);
        if (registered <= 0 || votes <= 0) return "";
        const turnoutPct = Math.max(0, Math.min(100, (votes / registered) * 100));
        return `Turnout: ${turnoutPct.toFixed(1)}%`;
    }
    function normalizeCountyLookupName(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\b(county|parish|borough|municipality|census area|city and borough)\b/g, "")
            .replace(/[^a-z0-9]/g, "");
    }
    function getNamedNumber(source, names) {
        if (!source || typeof source !== "object") return null;
        for (const name of names) {
            const value = Number(source[name]);
            if (Number.isFinite(value) && value > 0) return value;
        }
        return null;
    }
    function findCountyDataByName(container, countyName, depth = 0, seen = new Set()) {
        if (!container || depth > 3) return null;
        if (typeof container === "object") {
            if (seen.has(container)) return null;
            seen.add(container);
        }
        const targetName = normalizeCountyLookupName(countyName);
        if (!targetName) return null;
        if (Array.isArray(container)) {
            for (const entry of container) {
                const match = findCountyDataByName(entry, countyName, depth + 1, seen);
                if (match) return match;
            }
            return null;
        }
        if (typeof container !== "object") return null;
        const entryName = container.name
            || container.countyName
            || container.county
            || container.displayName
            || container.fullName;
        if (entryName && normalizeCountyLookupName(entryName) === targetName) return container;
        for (const [key, value] of Object.entries(container)) {
            if (normalizeCountyLookupName(key) === targetName && value && typeof value === "object") return value;
        }
        for (const key of ["counties", "countyStats", "countyElectStats", "countyData", "countyDemographics", "electStats", "demographics"]) {
            const match = findCountyDataByName(container[key], countyName, depth + 1, seen);
            if (match) return match;
        }
        return null;
    }
    function getCountyRegisteredVoters(county, stateId) {
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        const countyData = findCountyDataByName([
            state?.counties,
            state?.countyStats,
            state?.countyElectStats,
            state?.countyData,
            state?.countyDemographics,
            state?.electStats,
            state?.demographics,
            getStateElectionData(stateId)?.counties,
            county?.sourceCounty,
            county
        ], county?.name);
        const population = getNamedNumber(countyData, ["pop", "population", "countyPop", "totalPop"])
            || getNamedNumber(county, ["pop", "population", "countyPop", "totalPop"]);
        if (!population) return 0;
        const directRegistered = getNamedNumber(countyData, [
            "registeredVoters",
            "registered",
            "registeredPopulation",
            "registeredPop",
            "totalRegistered",
            "totRegistered",
            "regVoterTotal",
            "registeredVoterTotal"
        ]);
        if (directRegistered) {
            return directRegistered <= 100 && population > 1000
                ? Math.round(population * (directRegistered / 100))
                : Math.round(directRegistered);
        }
        let registeredFraction = getNamedNumber(countyData, [
            "regVoters",
            "voterRegistration",
            "registeredFraction",
            "regFraction"
        ]);
        if (!registeredFraction) registeredFraction = Number(state?.regVoters) || 0;
        if (!Number.isFinite(registeredFraction) || registeredFraction <= 0) return 0;
        if (registeredFraction > 1) registeredFraction /= 100;
        return Math.round(population * registeredFraction);
    }
    function getCountyTurnoutText(county, live) {
        const electionType = tooltipComponents?.properties?.electionType;
        if (!["president", "usSenate", "usHouse", "governor"].includes(electionType)) return "";
        const totalVotes = Number(county?.totalVotes) || 0;
        const currentVotes = Number(county?.totalCurrVotes) || 0;
        if (totalVotes <= 0) return "";
        if (live && currentVotes / totalVotes < 0.999) return "";
        const stateId = county?.stateId || county?.state || activeMap;
        const registered = getCountyRegisteredVoters(county, stateId);
        const votes = Math.round(live ? currentVotes : totalVotes);
        if (registered <= 0 || votes <= 0) return "";
        const turnoutPct = Math.max(0, Math.min(100, (votes / registered) * 100));
        return `Turnout: ${turnoutPct.toFixed(1)}%`;
    }
    function getPresidentialPrimaryCandidateDelegates(candidate, party, districtId) {
        const primaryArray = party === "D"
            ? ((typeof presPrimaryDemArray !== "undefined") ? presPrimaryDemArray : globalThis.presPrimaryDemArray)
            : ((typeof presPrimaryRepArray !== "undefined") ? presPrimaryRepArray : globalThis.presPrimaryRepArray);
        const stateName = Executive?.data?.states?.[districtId]?.name;
        const stateResult = primaryArray?.states?.find(state => state.name === stateName);
        const candidateId = Number(candidate?.id);
        const candidateName = String(candidate?.name || "").trim().toLowerCase();
        const stateCandidate = stateResult?.candidates?.find(resultCandidate => {
            const resultId = Number(resultCandidate?.id);
            if (Number.isFinite(candidateId) && Number.isFinite(resultId)) return resultId === candidateId;
            return String(resultCandidate?.name || "").trim().toLowerCase() === candidateName;
        });
        return Number(stateCandidate?.delegates ?? candidate?.delegates) || 0;
    }
    function createNewEntries(currentDistrict, live, fillTop, primary, countyView, options = {}) {
        tooltipComponents.electors.setAttribute("style", "display: none;");
        const candidateFinalVoteTotal = (currentDistrict.cands || []).reduce(
            (total, candidate) => total + (Number(candidate?.votes) || 0),
            0
        );
        const candidateCurrentVoteTotal = (currentDistrict.cands || []).reduce(
            (total, candidate) => total + (Number(candidate?.currentVotes) || 0),
            0
        );
        const totalDistrictVotes = Number(currentDistrict.totalVotes) || candidateFinalVoteTotal;
        const reportedDistrictVotes = live
            ? (Number(currentDistrict.totalCurrVotes) || candidateCurrentVoteTotal)
            : totalDistrictVotes;
        const percentReported = totalDistrictVotes > 0
            ? Math.round((reportedDistrictVotes / totalDistrictVotes) * 100)
            : 0;
        tooltipComponents.reporting.innerText = percentReported.toLocaleString() + "% in";
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
        const { table, tbody } = createResultsTable(countyView ? "County" : "State", options);
        if (primary) {
            table.classList.add("bm-primary-results-table");
            if (options.showDelegates === true) {
                table.classList.add("bm-presidential-primary-results-table");
            }
        } else {
            table.classList.add("bm-general-results-table");
            table.classList.add("bm-general-results-table-" + String(tooltipComponents?.properties?.electionType || "").toLowerCase());
        }
        const host = tooltipComponents.panelHost;
        if (!options.append) {
            tooltipComponents.entries.classList.toggle("bm-primary-stack", options.stackSections === true);
            tooltipDiv.classList.toggle("bm-detached-primary-tooltip", options.stackSections === true);
            [...tooltipComponents.entries.children].forEach(ch => {
            if (ch !== host) ch.remove();
            });
        }
        const tableContainer = document.createElement("div");
        tableContainer.className = "bm-primary-section";
        if (options.sectionLabel) {
            const sectionTitle = document.createElement("div");
            sectionTitle.className = "bm-primary-section-title";
            if (options.sectionParty) {
                sectionTitle.classList.add("bm-primary-section-title-" + options.sectionParty.toLowerCase());
            }
            sectionTitle.textContent = options.sectionLabel;
            tableContainer.appendChild(sectionTitle);
        }
        if (primary && !countyView && options.showTurnout !== false) {
            const totalVotes = Number(options.turnoutTotalVotes ?? totalDistrictVotes) || 0;
            const currentVotes = Number(options.turnoutCurrentVotes ?? (live ? reportedDistrictVotes : totalVotes)) || 0;
            const turnoutVotes = Number(options.turnoutVotes ?? totalVotes) || 0;
            const allCounted = totalVotes > 0 && (currentVotes / totalVotes) >= 0.999;
            const turnoutText = allCounted
                ? getStateTurnoutText(
                    turnoutVotes,
                    options.turnoutStateId,
                    options.turnoutDistrictDivisor
                )
                : "";
            if (turnoutText) {
                const primaryTurnout = document.createElement("div");
                primaryTurnout.className = "bm-primary-turnout";
                primaryTurnout.textContent = turnoutText;
                if (!options.sectionLabel && options.markWinner !== true && options.markAdvancing !== true) {
                    tableContainer.classList.add("bm-primary-section-turnout-row");
                }
                tableContainer.appendChild(primaryTurnout);
            }
        }
        tableContainer.appendChild(table);
        const useTableContainer = primary || options.sectionLabel || options.stackSections || options.markWinner === true || options.markAdvancing === true;
        tooltipComponents.entries.appendChild(useTableContainer ? tableContainer : table);
        if (!host.parentElement || host.parentElement !== tooltipComponents.entries) {
            tooltipComponents.entries.appendChild(host);
        }
        if (primary) {
        if (host) {
            host.style.display = "none";
        }
        } else {
        tooltipComponents.entries.appendChild(host);
        host.style.display = "flex";
        }
        if (!options.append) resetPanels(tooltipComponents);
        const deltaKeyPrefix = [
            tooltipComponents?.properties?.electionType || "election",
            tooltipComponents?.properties?.districtId || "district",
            countyView ? "county" : "state",
            primary ? "primary" : "general",
            options.sectionParty || (options.markAdvancing === true ? "all" : "main")
        ].join("|");
        sortedCands.forEach((cand, index) => {
            const isProjectedWinner = !countyView && (cand === (live ? currentWinner : winner));
            const row = createCandidateRow(cand, currentDistrict, live, isProjectedWinner, index === 0, {
                showPctDelta: live,
                deltaKeyPrefix,
                compactPctDelta: primary,
                showDelegates: options.showDelegates === true
            });
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
            if (!primary) {
                updateBattlegroundBadge(stateCell, tooltipComponents, countyView);
            }
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
                const total = live ? reportedDistrictVotes
                                : totalDistrictVotes;
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
        const countyTurnoutText = countyView && !primary
            ? getCountyTurnoutText(currentDistrict, live)
            : "";
        if (countyTurnoutText && tDiv) {
            tDiv.style.display = "block";
            tDiv.className = "state-turnout";
            tDiv.innerHTML = `<span>${countyTurnoutText}</span>`;
            return;
        }
        const et = tooltipComponents?.properties?.electionType;
        const allowed = et === "president" || et === "usSenate" || et === "governor";
        const tot = totalDistrictVotes;
        const cur = live ? reportedDistrictVotes : tot;
        const reported = (tot > 0) ? (cur / tot) : 0;
        const allCounted = reported >= 0.999;
        const showTurnout = allowed && !primary && !countyView && allCounted && (!live || currentDistrict.pW === true);
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
        const primaryAdvancingCount = Math.min(
            Math.max(0, Math.floor(Number(options.advancingCount) || 0)),
            sortedCands.length
        );
        const markPrimaryWinner = options.markWinner === true && !countyView && winner && highestTotal > 0;
        const markPrimaryAdvancers = options.markAdvancing === true && !countyView && primaryAdvancingCount > 0 && highestTotal > 0;
        const advancingPartyStats = {};
        if (markPrimaryAdvancers) {
            sortedCands.slice(0, primaryAdvancingCount).forEach(candidate => {
                const party = candidate.party || "I";
                const votes = live ? (candidate.currentVotes || 0) : (candidate.votes || 0);
                if (!advancingPartyStats[party]) advancingPartyStats[party] = { count: 0, maxVotes: 0 };
                advancingPartyStats[party].count += 1;
                advancingPartyStats[party].maxVotes = Math.max(advancingPartyStats[party].maxVotes, votes);
            });
        }
        const markCandidateCell = (row, candidate, showTick = true) => {
            if (!row || !candidate) return;
            const candidateCell = row.cells[(row.cells.length >= 5) ? 1 : 0];
            if (!candidateCell) return;
            const partyClasses = {
                "R": "winner-r",
                "D": "winner-d",
                "ID": "winner-id",
                "IR": "winner-ir",
                "I": "winner-i"
            };
            const visualParty = getCandidateProjectionPartyKey(candidate);
            if (partyClasses[visualParty]) {
                candidateCell.classList.add(partyClasses[visualParty]);
            }
            candidateCell.style.backgroundColor = "";
            candidateCell.style.color = "";
            if (!showTick) {
                const party = candidate.party || "I";
                const stats = advancingPartyStats[party];
                const partyRgb = { D: "4, 135, 230", R: "221, 41, 41", I: "122, 122, 122" }[party];
                if (stats && stats.count > 1 && stats.maxVotes > 0 && partyRgb) {
                    const votes = live ? (candidate.currentVotes || 0) : (candidate.votes || 0);
                    const strength = 0.38 + (0.52 * (votes / stats.maxVotes));
                    candidateCell.classList.add("bm-primary-vote-shade");
                    candidateCell.style.backgroundColor = `rgba(${partyRgb}, ${strength.toFixed(3)})`;
                    candidateCell.style.color = strength >= 0.5 ? "#fff" : "#111";
                }
            }
            renderCandidateCellContent(candidateCell, candidate, { showTick });
        };
        if (markPrimaryWinner || markPrimaryAdvancers) {
            const primaryBadge = document.createElement("div");
            primaryBadge.className = "bm-primary-winner-badge";
            primaryBadge.innerHTML = markPrimaryAdvancers
                ? `<span class="candidate-wrapper">ADVANCING TO GENERAL ELECTION</span>`
                : `<span class="candidate-wrapper">
                PROJECTED WINNER &nbsp; <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                    <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                </svg>
            </span>`;
            tableContainer.insertBefore(primaryBadge, table);
        }
        if (markPrimaryAdvancers && table.tBodies && table.tBodies[0]) {
            for (let i = 0; i < primaryAdvancingCount; i++) {
                markCandidateCell(table.tBodies[0].rows[i], sortedCands[i], true);
            }
        }
        if ((markPrimaryWinner || currentDistrict.pW === true || !live) && !countyView && winner) {
            if (fillTop || markPrimaryWinner) {
                if (!markPrimaryWinner) {
                    tooltipComponents.winnerLine.setAttribute(
                        "style",
                        `background-color: ${stringifyColour(getCandidateColour(winner))}; height: 10px;`
                    );
                }
                const winnerTable = table;
                if (winnerTable && winnerTable.tBodies && winnerTable.tBodies[0] && winnerTable.tBodies[0].rows.length > 0) {
                    const winnerRow = winnerTable.tBodies[0].rows[0];
                    const winnerCell = winnerRow.cells[(winnerRow.cells.length >= 5) ? 1 : 0];
                    const partyClasses = {
                        "R": "winner-r",
                        "D": "winner-d",
                        "I": "winner-i",
                        "ID": "winner-id",
                        "IR": "winner-ir"
                    };
                    const visualParty = getCandidateProjectionPartyKey(winner);
                    if (partyClasses[visualParty]) {
                        winnerCell.classList.add(partyClasses[visualParty]);
                    }
                renderCandidateCellContent(winnerCell, winner, { showTick: true });
                }
                if (!markPrimaryWinner) {
                    tooltipComponents.projectedWinnerMessage.style.display = "block";
                    tooltipComponents.projectedWinnerMessage.innerHTML = `
                    <span class="candidate-wrapper">
                      PROJECTED WINNER &nbsp; <svg viewBox="0 0 14 14" stroke-width="2" aria-hidden="true" class="winner-icon">
                            <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                        </svg>
                    </span>`;
                }
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
        if (!primary && live && !countyView && !currentDistrict.pW) {
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
                    ...origCounty,
                    name: origCounty.name,
                    stateId: activeMap,
                    sourceCounty: origCounty,
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
        tooltipComponents.electors.innerText = "";
        tooltipComponents.electors.setAttribute("style", "display: none;");
        tooltipDiv.classList.remove("bm-detached-primary-tooltip");
        tooltipDiv.classList.remove("bm-polls-closing-tooltip");
        tooltipComponents.entries.classList.remove("bm-primary-stack");
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
                refreshLiveStateResultsForTooltip(electionType, districtId);
                currentDistrict = currentResults[districtId] || currentDistrict;
            }
            if (currentDistrict.dem.cands.length === 0 && currentDistrict.rep.cands.length === 0) {
                let currentVoteTotal = 0;
                let finalVoteTotal = 0;
                let newCandArray = [];
                currentDistrict.allCands.cands.forEach(candidate => {
                    currentVoteTotal += live ? (Number(candidate.currentVotes) || 0) : (Number(candidate.votes) || 0);
                    finalVoteTotal += Number(candidate.votes) || 0;
                    const newCand = Object.assign({}, candidate);
                    if (!newCand.stateId && !newCand.state) newCand.stateId = districtId;
                    if (!newCand.district && currentDistrict?.district) newCand.district = currentDistrict.district;
                    const candArray = findCandByID([candidate.id])[0];
                    const wrappedCandObj = Executive.data.characters.wrapCharacter(candArray, "candidate");
                    if (wrappedCandObj.extendedAttribs.party === "Independent") {
                        newCand.caucus = wrappedCandObj.caucusParty.substring(0, 1);
                    }
                    newCand.party = wrappedCandObj.extendedAttribs.party.substring(0, 1);
                    newCandArray.push(newCand);
                });
                if (live && currentVoteTotal === 0) {
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
                        showNotCountingMessage();
                        return;
                }
                const fakeDistrict = {
                    totalVotes: finalVoteTotal,
                    totalCurrVotes: currentVoteTotal,
                    cands: newCandArray,
                    pW: false
                };
                const markNonpartisanAdvancers = live !== true
                    || isProjectedPrimaryGroup(currentDistrict?.allCands)
                    || isPrimaryGroupFullyCounted(currentDistrict?.allCands, live);
                createNewEntries(fakeDistrict, live, false, true, countyView, {
                    markAdvancing: markNonpartisanAdvancers,
                    advancingCount: getNonpartisanPrimaryAdvanceCount(electionType, currentDistrict, districtId),
                    turnoutVotes: finalVoteTotal
                });
            } else {
                const activePresPrimaryParty = electionType === "president"
                    ? getActivePresidentialPrimaryParty()
                    : null;
                const showDemPrimary = currentDistrict.dem.cands.length !== 0
                    && activePresPrimaryParty !== "R";
                const showRepPrimary = currentDistrict.rep.cands.length !== 0
                    && activePresPrimaryParty !== "D";
                const showSectionLabels = showDemPrimary && showRepPrimary;
                const totalPrimaryTurnoutVotes = [...currentDistrict.dem.cands, ...currentDistrict.rep.cands]
                    .reduce((total, candidate) => total + (Number(candidate.votes) || 0), 0);
                let renderedPrimarySection = false;
                if (showDemPrimary) {
                    let demCurrentVoteTotal = 0;
                    let demFinalVoteTotal = 0;
                    let newDemCandArray = [];
                    currentDistrict.dem.cands.forEach(candidate => {
                        demCurrentVoteTotal += live ? (Number(candidate.currentVotes) || 0) : (Number(candidate.votes) || 0);
                        demFinalVoteTotal += Number(candidate.votes) || 0;
                        const newCand = Object.assign({}, candidate);
                        newCand.party = "D";
                        if (electionType === "president") {
                            newCand.delegates = getPresidentialPrimaryCandidateDelegates(candidate, "D", districtId);
                        }
                        newDemCandArray.push(newCand);
                    });
                    const demFakeDistrict = {
                        totalVotes: demFinalVoteTotal,
                        totalCurrVotes: demCurrentVoteTotal,
                        cands: newDemCandArray,
                        pW: false
                    };
                    const showDemDelegates = electionType === "president"
                        && (!live || (demFinalVoteTotal > 0 && (demCurrentVoteTotal / demFinalVoteTotal) >= 0.999));
                    if (live && demCurrentVoteTotal === 0) {
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
                            showNotCountingMessage();
                            return;
                        }
                    createNewEntries(demFakeDistrict, live, false, true, countyView, {
                        append: renderedPrimarySection,
                        sectionLabel: showSectionLabels ? "DEMOCRATIC PRIMARY" : "",
                        stackSections: showSectionLabels,
                        sectionParty: "D",
                        markWinner: isProjectedPrimaryGroup(currentDistrict?.dem)
                            || isPrimaryGroupFullyCounted(currentDistrict?.dem, live),
                        turnoutVotes: totalPrimaryTurnoutVotes,
                        showDelegates: showDemDelegates
                    });
                    renderedPrimarySection = true;
                }
                if (showRepPrimary) {
                    let repCurrentVoteTotal = 0;
                    let repFinalVoteTotal = 0;
                    let newRepCandArray = [];
                    currentDistrict.rep.cands.forEach(candidate => {
                        repCurrentVoteTotal += live ? (Number(candidate.currentVotes) || 0) : (Number(candidate.votes) || 0);
                        repFinalVoteTotal += Number(candidate.votes) || 0;
                        const newCand = Object.assign({}, candidate);
                        newCand.party = "R";
                        if (electionType === "president") {
                            newCand.delegates = getPresidentialPrimaryCandidateDelegates(candidate, "R", districtId);
                        }
                        newRepCandArray.push(newCand);
                    });
                    const repFakeDistrict = {
                        totalVotes: repFinalVoteTotal,
                        totalCurrVotes: repCurrentVoteTotal,
                        cands: newRepCandArray,
                        pW: false
                    };
                    const showRepDelegates = electionType === "president"
                        && (!live || (repFinalVoteTotal > 0 && (repCurrentVoteTotal / repFinalVoteTotal) >= 0.999));
                    createNewEntries(repFakeDistrict, live, false, true, countyView, {
                        append: renderedPrimarySection,
                        sectionLabel: showSectionLabels ? "REPUBLICAN PRIMARY" : "",
                        stackSections: showSectionLabels,
                        sectionParty: "R",
                        markWinner: isProjectedPrimaryGroup(currentDistrict?.rep)
                            || isPrimaryGroupFullyCounted(currentDistrict?.rep, live),
                        turnoutVotes: totalPrimaryTurnoutVotes,
                        showDelegates: showRepDelegates
                    });
                }
            }
        } else {
            const displayDistrict = live ? getLiveDisplayDistrict(currentDistrict) : currentDistrict;
            if (electionType === "president" && !countyView && !(live && displayDistrict.totalCurrVotes === 0)) {
                tooltipComponents.electors.innerText = `${Executive.data.states[districtId].electoralNum} electoral votes`;
                tooltipComponents.electors.removeAttribute("style");
            } else {
                tooltipComponents.electors.innerText = "";
                tooltipComponents.electors.setAttribute("style", "display: none;");
            }
            if (live && displayDistrict.totalCurrVotes === 0) {
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
                showPollClosingMessage(districtId, currentDistrict, electionType);
            } else {
                createNewEntries(displayDistrict, live, true, false, countyView);
            }
        }
    }
    function createTooltip() {
        ensureElectionUpdateClockHook();
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
        tooltipComponents.electors = document.createElement("div");
        tooltipComponents.electors.setAttribute("id", "better-maps-tooltip-electors");
        tooltipComponents.electors.style.display = "none";
        document.body.appendChild(tooltipDiv);
    }
    function getVisiblePageLines() {
        return String(document.body?.innerText || "")
            .split(/\r?\n/)
            .map(line => line.replace(/\s+/g, " ").trim())
            .filter(Boolean);
    }
    function readPartyCountFromLine(line, label) {
        const beforeMatch = line.match(new RegExp(`(?:^|\\b)(\\d+)\\s+${label}\\b`, "i"));
        if (beforeMatch) return Number(beforeMatch[1]);
        const afterMatch = line.match(new RegExp(`\\b${label}\\s+(\\d+)\\b`, "i"));
        if (afterMatch) return Number(afterMatch[1]);
        return null;
    }
    function getPartyControlCountsFromCurrentHeader(titlePattern) {
        const lines = getVisiblePageLines();
        const titleIndex = lines.findIndex(line => titlePattern.test(line));
        if (titleIndex < 0) return null;
        let demSeats = null;
        let repSeats = null;
        const headerLines = lines.slice(titleIndex + 1, titleIndex + 12);
        for (const line of headerLines) {
            if (/^(Projections|Margins|Select a state to view election results\.?)$/i.test(line)) break;
            if (demSeats === null) demSeats = readPartyCountFromLine(line, "Democrats");
            if (repSeats === null) repSeats = readPartyCountFromLine(line, "Republicans");
            if (Number.isFinite(demSeats) && Number.isFinite(repSeats)) {
                return { D: demSeats, R: repSeats };
            }
        }
        return null;
    }
    function getPartyControlCountsFromPage(expectedTotal = null) {
        const pageTexts = [];
        const bodyInnerText = String(document.body?.innerText || "");
        pageTexts.push(...getVisiblePageLines());
        pageTexts.push(bodyInnerText);
        try {
            document.querySelectorAll("div, span, p, h1, h2, h3").forEach(element => {
                if (window.getComputedStyle) {
                    const style = window.getComputedStyle(element);
                    if (style.display === "none" || style.visibility === "hidden" || element.getClientRects().length === 0) return;
                }
                const text = String(element.textContent || "").trim();
                if (text) pageTexts.push(text);
            });
        } catch { }
        const readPartyCounts = (label) => {
            const counts = new Set();
            const exactBefore = new RegExp(`^\\s*(\\d+)\\s+${label}\\s*$`, "i");
            const exactAfter = new RegExp(`^\\s*${label}\\s+(\\d+)\\s*$`, "i");
            const anyBefore = new RegExp(`(?:^|\\b)(\\d+)\\s+${label}\\b`, "gi");
            const anyAfter = new RegExp(`\\b${label}\\s+(\\d+)\\b`, "gi");
            for (const text of pageTexts) {
                const beforeMatch = text.match(exactBefore);
                if (beforeMatch) counts.add(Number(beforeMatch[1]));
                const afterMatch = text.match(exactAfter);
                if (afterMatch) counts.add(Number(afterMatch[1]));
                let match;
                anyBefore.lastIndex = 0;
                while ((match = anyBefore.exec(text)) !== null) {
                    counts.add(Number(match[1]));
                }
                anyAfter.lastIndex = 0;
                while ((match = anyAfter.exec(text)) !== null) {
                    counts.add(Number(match[1]));
                }
            }
            return [...counts].filter(Number.isFinite);
        };
        const demSeatOptions = readPartyCounts("Democrats");
        const repSeatOptions = readPartyCounts("Republicans");
        if (demSeatOptions.length === 0 || repSeatOptions.length === 0) return null;
        let bestCounts = null;
        let bestScore = Infinity;
        demSeatOptions.forEach(demSeats => {
            repSeatOptions.forEach(repSeats => {
                const total = demSeats + repSeats;
                const expectedPenalty = Number.isFinite(expectedTotal)
                    ? Math.abs(total - expectedTotal)
                    : 0;
                const score = (expectedPenalty * 1000) - total;
                if (score < bestScore) {
                    bestScore = score;
                    bestCounts = { D: demSeats, R: repSeats };
                }
            });
        });
        return bestCounts;
    }
    function getSenateControlCountsFromPage() {
        return getPartyControlCountsFromCurrentHeader(/\bSenate Elections\b/i);
    }
    function getHouseControlCountsFromPage() {
        return getPartyControlCountsFromCurrentHeader(/\bU\.S\. House Elections\b/i);
    }
    function isSenateMidtermControlContext() {
        try {
            const bodyInnerText = String(document.body?.innerText || "");
            const pageText = bodyInnerText || String(document.body?.textContent || "");
            const hasSenateElectionPage = /\bSenate Elections\b/i.test(pageText);
            if (hasSenateElectionPage && !/\bPresident\b/i.test(bodyInnerText)) return true;
            const visibleButtonTexts = Array.from(document.querySelectorAll("button, input"))
                .filter(element => {
                    if (!window.getComputedStyle) return true;
                    const style = window.getComputedStyle(element);
                    return style.display !== "none"
                        && style.visibility !== "hidden"
                        && element.getClientRects().length > 0;
                })
                .map(element => String(element.textContent || element.value || "").trim());
            const hasSenatePage = hasSenateElectionPage
                || visibleButtonTexts.some(text => text === "U.S. Senate");
            const hasPresidentTab = visibleButtonTexts.some(text => text === "President");
            return hasSenatePage && !hasPresidentTab;
        } catch { }
        return false;
    }
    function normalizePartyCode(party) {
        const text = String(party || "").toLowerCase();
        if (text === "d" || text.includes("dem")) return "D";
        if (text === "r" || text.includes("rep")) return "R";
        return null;
    }
    function getElectionYear() {
        try {
            const data = Executive?.data || {};
            const candidates = [
                (typeof currentYear !== "undefined") ? currentYear : null,
                (typeof electionYear !== "undefined") ? electionYear : null,
                data.electionYear,
                data.cycleYear,
                data.year,
                data.currentYear,
                data.gameYear,
                globalThis?.electionYear,
                globalThis?.cycleYear,
                globalThis?.currentYear,
                globalThis?.gameYear
            ];
            for (const candidate of candidates) {
                const year = Number(candidate);
                if (Number.isFinite(year) && year > 1700) return year;
            }
        } catch { }
        return null;
    }
    function isPresidentialElectionYear() {
        try {
            const pageText = String(document.body?.innerText || document.body?.textContent || "");
            const hasSenateElectionPage = /\bSenate Elections\b/i.test(pageText);
            const visibleButtonTexts = Array.from(document.querySelectorAll("button, input"))
                .filter(element => {
                    if (!window.getComputedStyle) return true;
                    const style = window.getComputedStyle(element);
                    return style.display !== "none"
                        && style.visibility !== "hidden"
                        && element.getClientRects().length > 0;
                })
                .map(element => String(element.textContent || element.value || "").trim());
            const hasPresidentTab = visibleButtonTexts.some(text => text === "President");
            const hasSenateTab = visibleButtonTexts.some(text => text === "U.S. Senate");
            const hasLegacyPresidentTab = !hasPresidentTab && Array.from(document.querySelectorAll("button, input")).some(element => {
                const text = String(element.textContent || element.value || "").trim();
                if (text !== "President") return false;
                if (!window.getComputedStyle) return true;
                return false;
            });
            if ((hasSenateElectionPage || hasSenateTab) && !hasPresidentTab && !hasLegacyPresidentTab) return false;
            if (hasPresidentTab || hasLegacyPresidentTab) return true;
        } catch { }
        const year = getElectionYear();
        if (Number.isFinite(year)) return year % 4 === 0;
        return hasPresidentialGeneralElectionThisCycle();
    }
    function getCandidatePartyCode(candidate) {
        if (!candidate) return null;
        return normalizePartyCode(candidate.party)
            || normalizePartyCode(candidate.caucus)
            || normalizePartyCode(candidate.caucusParty)
            || normalizePartyCode(candidate.extendedAttribs?.party);
    }
    function isElectionNightFinished() {
        try {
            const pageText = String(document.body?.innerText || document.body?.textContent || "");
            const clockMatch = pageText.match(/\(\s*(\d+):(\d{2})\s*\)/);
            if (!clockMatch) return false;
            return Number(clockMatch[1]) === 0 && Number(clockMatch[2]) === 0;
        } catch { }
        return false;
    }
    function getHouseControlCountsFromElectionData() {
        try {
            if (!Array.isArray(electNightUSH?.elections)) return null;
            const counts = { D: 0, R: 0 };
            const electionNightFinished = isElectionNightFinished();
            electNightUSH.elections.forEach(district => {
                if (!district || !Array.isArray(district.cands)) return;
                const totalCurrVotes = Number(district.totalCurrVotes) || 0;
                const totalVotes = Number(district.totalVotes) || 0;
                const hasFinalCandidateVotes = district.cands.some(candidate => Number(candidate?.votes) > 0);
                const readyForHouseCount = district.pW === true
                    || (totalVotes > 0 && totalCurrVotes >= totalVotes)
                    || (electionNightFinished && hasFinalCandidateVotes);
                if (!readyForHouseCount) return;
                const useFinalVotes = district.pW === true || (electionNightFinished && hasFinalCandidateVotes);
                const sortedCands = district.cands.slice().sort((cand1, cand2) =>
                    (Number(cand2[useFinalVotes ? "votes" : "currentVotes"] ?? cand2.votes) || 0)
                    - (Number(cand1[useFinalVotes ? "votes" : "currentVotes"] ?? cand1.votes) || 0)
                );
                const winnerParty = getCandidatePartyCode(sortedCands[0]);
                if (winnerParty === "D") counts.D++;
                if (winnerParty === "R") counts.R++;
            });
            return counts;
        } catch { }
        return null;
    }
    function getHouseControlCountsFromPoliticians() {
        try {
            if (!isElectionNightFinished()) return null;
            const house = Executive?.data?.politicians?.usHouse;
            if (!house) return null;
            const members = Array.isArray(house) ? house : Object.values(house).flat();
            const counts = { D: 0, R: 0 };
            members.forEach(member => {
                const party = normalizePartyCode(
                    member?.caucusParty
                    || member?.extendedAttribs?.party
                    || member?.party
                );
                if (party === "D") counts.D++;
                if (party === "R") counts.R++;
            });
            return (counts.D > 0 || counts.R > 0) ? counts : null;
        } catch { }
        return null;
    }
    function getPresidentialCandidatePartyOrder() {
        try {
            const firstStateRace = electNightP?.elections?.find(stateRace =>
                Array.isArray(stateRace?.cands) && stateRace.cands.length
            );
            if (!firstStateRace) return [];
            return firstStateRace.cands.map(candidate => getCandidatePartyCode(candidate));
        } catch { }
        return [];
    }
    function refreshPresidentialElectionNightData() {
        try {
            if (typeof eNightPresUpdate !== "function") return;
            const now = Date.now();
            if (now - lastPresidentialBackgroundRefreshTime < 250) return;
            lastPresidentialBackgroundRefreshTime = now;
            const dummyElem = document.createElement("div");
            const originalGetElement = document.getElementById;
            const previousActiveMap = typeof activeMap !== "undefined" ? activeMap : undefined;
            document.getElementById = () => dummyElem;
            try {
                if (typeof activeMap !== "undefined") activeMap = "US";
                if (typeof eNightPresProjectW === "function") {
                    try { eNightPresProjectW(); } catch { }
                }
                eNightPresUpdate();
            } finally {
                document.getElementById = originalGetElement;
                if (previousActiveMap !== undefined) activeMap = previousActiveMap;
                dummyElem.remove();
            }
        } catch { }
    }
    function addElectoralTotal(totals, party, votes) {
        if (!(party === "D" || party === "R")) return;
        const numericVotes = Number(votes);
        if (!Number.isFinite(numericVotes) || numericVotes <= 0) return;
        totals[party] += numericVotes;
    }
    function addElectoralTotalsFromObject(totals, source) {
        if (!source || typeof source !== "object") return;
        const objectParty = getCandidatePartyCode(source);
        const objectVotes = source.electoralVotes ?? source.electoralVote ?? source.electors ?? source.ev ?? source.votes;
        if (objectParty && objectVotes !== undefined) addElectoralTotal(totals, objectParty, objectVotes);
        const partyOrder = getPresidentialCandidatePartyOrder();
        const entries = Object.entries(source);
        entries.forEach(([key, value]) => {
            if (typeof value !== "number") return;
            const party = normalizePartyCode(key);
            const keyText = key.toLowerCase();
            const numericIndex = Number(key);
            if (Number.isInteger(numericIndex) && partyOrder[numericIndex]) {
                addElectoralTotal(totals, partyOrder[numericIndex], value);
                return;
            }
            if (party || keyText === "d" || keyText === "r") addElectoralTotal(totals, party || keyText.toUpperCase(), value);
        });
    }
    function getPresidentialElectoralTotalsFromDirectData() {
        const totals = { D: 0, R: 0 };
        try {
            refreshPresidentialElectionNightData();
            const directSources = [
                electNightP?.electoralVotes,
                electNightP?.electoralVote,
                electNightP?.electoralVoteTotals,
                electNightP?.electoralTotals,
                electNightP?.ev,
                electNightP?.electors
            ].filter(source => source !== undefined && source !== null);
            directSources.forEach(source => {
                if (source instanceof Map) {
                    addElectoralTotalsFromObject(totals, Object.fromEntries(source));
                    return;
                }
                if (Array.isArray(source)) {
                    const partyOrder = getPresidentialCandidatePartyOrder();
                    if (source.every(value => typeof value === "number")) {
                        source.forEach((votes, index) => addElectoralTotal(totals, partyOrder[index], votes));
                    } else {
                        source.forEach(entry => addElectoralTotalsFromObject(totals, entry));
                    }
                    return;
                }
                addElectoralTotalsFromObject(totals, source);
            });
            addElectoralTotal(totals, "D", electNightP?.demElectoralVotes ?? electNightP?.demElectors ?? electNightP?.demEV ?? electNightP?.dEV);
            addElectoralTotal(totals, "R", electNightP?.repElectoralVotes ?? electNightP?.repElectors ?? electNightP?.repEV ?? electNightP?.rEV);
            return (totals.D > 0 || totals.R > 0) ? totals : null;
        } catch { }
        return null;
    }
    function getElectoralCollegeWinnerParty(totals) {
        if (!totals) return null;
        const demElectors = Number(totals.D) || 0;
        const repElectors = Number(totals.R) || 0;
        if (demElectors >= 270 && demElectors > repElectors) return "D";
        if (repElectors >= 270 && repElectors > demElectors) return "R";
        return null;
    }
    function isPresidentialElectoralDeadlock(totals) {
        if (!totals) return false;
        const demElectors = Number(totals.D) || 0;
        const repElectors = Number(totals.R) || 0;
        if (getElectoralCollegeWinnerParty(totals)) return false;
        if (demElectors === 269 && repElectors === 269) return true;
        return demElectors + repElectors >= 538 && demElectors < 270 && repElectors < 270;
    }
    function getStateElectoralVotes(stateId) {
        const state = Executive?.data?.states?.[String(stateId || "").toLowerCase()];
        return Number(state?.electoralNum ?? state?.electoralVotes ?? state?.electors ?? state?.ev) || 0;
    }
    function hasPresidentialGeneralElectionThisCycle() {
        try {
            return Array.isArray(electNightP?.elections)
                && electNightP.elections.some(stateRace =>
                    Array.isArray(stateRace?.cands)
                    && stateRace.cands.some(candidate => getCandidatePartyCode(candidate))
                );
        } catch { }
        return false;
    }
    function getPartyFromCharacterLike(value) {
        if (!value) return null;
        try {
            if (value.extendedAttribs?.party) return normalizePartyCode(value.extendedAttribs.party);
            if (value.caucusParty) return normalizePartyCode(value.caucusParty);
            if (value.party) return normalizePartyCode(value.party);
            if (Array.isArray(value)) {
                const directParty = normalizePartyCode(value[0]);
                if (directParty) return directParty;
                const wrapped = Executive?.data?.characters?.wrapCharacter(value, "candidate");
                return normalizePartyCode(wrapped?.extendedAttribs?.party || wrapped?.caucusParty || wrapped?.party);
            }
        } catch { }
        return null;
    }
    function getCurrentPresidentParty() {
        const sources = [
            (typeof usPresident !== "undefined") ? usPresident : null,
            globalThis?.usPresident,
            Executive?.data?.usPresident,
            Executive?.data?.president,
            Executive?.data?.officeHolders?.president,
            Executive?.data?.executive?.president,
            Executive?.data?.federal?.president,
            Executive?.data?.politicians?.president,
            Executive?.data?.politicians?.usPresident,
            Executive?.data?.politicians?.executive?.president,
            (typeof vicePresident !== "undefined") ? vicePresident : null,
            globalThis?.vicePresident,
            Executive?.data?.vicePresident,
            Executive?.data?.politicians?.vicePresident,
            (typeof presidentElect !== "undefined") ? presidentElect : null,
            (typeof vicePresidentElect !== "undefined") ? vicePresidentElect : null,
            globalThis?.presidentElect,
            globalThis?.vicePresidentElect,
            Executive?.data?.presidentElect,
            Executive?.data?.vicePresidentElect
        ];
        for (const source of sources) {
            const party = getPartyFromCharacterLike(source);
            if (party) return party;
        }
        const storedParty = normalizePartyCode(
            (typeof nationStats !== "undefined" ? nationStats?.presWinParty : null)
            || (typeof stateStats !== "undefined" ? stateStats?.presWinParty : null)
            || globalThis?.nationStats?.presWinParty
            || globalThis?.stateStats?.presWinParty
        );
        if (storedParty) return storedParty;
        return null;
    }
    function getPresidentialElectionWinnerPartyAt270() {
        try {
            refreshPresidentialElectionNightData();
            if (!Array.isArray(electNightP?.elections)) return null;
            const directTotals = getPresidentialElectoralTotalsFromDirectData();
            const directWinner = getElectoralCollegeWinnerParty(directTotals);
            if (directWinner) return directWinner;
            const electoralVotesByParty = { D: 0, R: 0 };
            const electionNightFinished = isElectionNightFinished();
            electNightP.elections.forEach(stateRace => {
                if (!stateRace || !Array.isArray(stateRace.cands)) return;
                const totalCurrVotes = Number(stateRace.totalCurrVotes) || 0;
                const totalVotes = Number(stateRace.totalVotes) || 0;
                const hasFinalCandidateVotes = stateRace.cands.some(candidate => Number(candidate?.votes) > 0);
                const readyForElectoralCount = stateRace.pW === true
                    || (totalVotes > 0 && totalCurrVotes >= totalVotes)
                    || (electionNightFinished && hasFinalCandidateVotes);
                if (!readyForElectoralCount) return;
                const useFinalVotes = stateRace.pW === true || (electionNightFinished && hasFinalCandidateVotes);
                const sortedCands = stateRace.cands.slice().sort((a, b) =>
                    (Number(b[useFinalVotes ? "votes" : "currentVotes"] ?? b.votes) || 0)
                    - (Number(a[useFinalVotes ? "votes" : "currentVotes"] ?? a.votes) || 0)
                );
                const winner = sortedCands[0];
                const party = getCandidatePartyCode(winner);
                const electoralVotes = getStateElectoralVotes(stateRace.state);
                if ((party === "D" || party === "R") && electoralVotes > 0) {
                    electoralVotesByParty[party] += electoralVotes;
                }
            });
            return getElectoralCollegeWinnerParty(electoralVotesByParty);
        } catch { }
        return null;
    }
    function getPresidentialCalledElectoralTotals() {
        try {
            refreshPresidentialElectionNightData();
            if (!Array.isArray(electNightP?.elections)) return null;
            const electoralVotesByParty = { D: 0, R: 0 };
            const electionNightFinished = isElectionNightFinished();
            electNightP.elections.forEach(stateRace => {
                if (!stateRace || !Array.isArray(stateRace.cands)) return;
                const totalCurrVotes = Number(stateRace.totalCurrVotes) || 0;
                const totalVotes = Number(stateRace.totalVotes) || 0;
                const hasFinalCandidateVotes = stateRace.cands.some(candidate => Number(candidate?.votes) > 0);
                const readyForElectoralCount = stateRace.pW === true
                    || (totalVotes > 0 && totalCurrVotes >= totalVotes)
                    || (electionNightFinished && hasFinalCandidateVotes);
                if (!readyForElectoralCount) return;
                const useFinalVotes = stateRace.pW === true || (electionNightFinished && hasFinalCandidateVotes);
                const sortedCands = stateRace.cands.slice().sort((a, b) =>
                    (Number(b[useFinalVotes ? "votes" : "currentVotes"] ?? b.votes) || 0)
                    - (Number(a[useFinalVotes ? "votes" : "currentVotes"] ?? a.votes) || 0)
                );
                const winner = sortedCands[0];
                const party = getCandidatePartyCode(winner);
                const electoralVotes = getStateElectoralVotes(stateRace.state);
                if ((party === "D" || party === "R") && electoralVotes > 0) {
                    electoralVotesByParty[party] += electoralVotes;
                }
            });
            return (electoralVotesByParty.D > 0 || electoralVotesByParty.R > 0) ? electoralVotesByParty : null;
        } catch { }
        return null;
    }
    function getHouseControlTieBreakerParty() {
        const houseCounts = getHouseControlCountsFromElectionData() || getHouseControlCountsFromPoliticians();
        return getHouseControlParty(houseCounts);
    }
    function getPresidentialSenateTieBreakerParty() {
        const presidentialWinnerParty = getPresidentialElectionWinnerPartyAt270();
        if (presidentialWinnerParty) return presidentialWinnerParty;
        const directTotals = getPresidentialElectoralTotalsFromDirectData();
        const calledTotals = getPresidentialCalledElectoralTotals();
        if (!isPresidentialElectoralDeadlock(directTotals) && !isPresidentialElectoralDeadlock(calledTotals)) return null;
        return getHouseControlTieBreakerParty();
    }
    function getSenateControlParty(counts) {
        if (!counts) return null;
        if (counts.R >= 51 && counts.R > counts.D) return "R";
        if (counts.D >= 51 && counts.D > counts.R) return "D";
        const usePresidentialTieBreaker = !isSenateMidtermControlContext() && isPresidentialElectionYear();
        const tieBreakerParty = usePresidentialTieBreaker
            ? getPresidentialSenateTieBreakerParty()
            : getCurrentPresidentParty();
        if (tieBreakerParty === "D" && counts.D >= 50) return "D";
        if (tieBreakerParty === "R" && counts.R >= 50) return "R";
        return null;
    }
    function getHouseControlParty(counts) {
        if (!counts) return null;
        if (counts.R >= 218 && counts.R > counts.D) return "R";
        if (counts.D >= 218 && counts.D > counts.R) return "D";
        return null;
    }
    function updateSenateControlBanner(options = {}) {
        let banner = document.getElementById("bm-senate-banner");
        const removeBanner = () => {
            if (!banner) return;
            banner.classList.remove("show", "senate-control-r", "senate-control-d", "senate-control-t");
            banner.innerHTML = "";
        };
        if (options.live !== true || options.onCountyMap === true) {
            removeBanner();
            return;
        }
        const svgMap = options.svgMap || document.getElementById("usSenate-map-live") || document.querySelector('.better-maps-container[data-type="usSenate"]');
        if (!svgMap || !svgMap.parentElement) {
            removeBanner();
            return;
        }
        const oldWrapper = svgMap.parentElement.classList?.contains("bm-map-svg-wrapper")
            ? svgMap.parentElement
            : null;
        if (oldWrapper?.parentElement) {
            const wrapperParent = oldWrapper.parentElement;
            wrapperParent.insertBefore(svgMap, oldWrapper);
            oldWrapper.remove();
        }
        const bannerHost = svgMap.parentElement;
        document.querySelectorAll(".bm-senate-banner-host").forEach(host => {
            if (host !== bannerHost) host.classList.remove("bm-senate-banner-host");
        });
        bannerHost.classList.add("bm-senate-banner-host");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "bm-senate-banner";
        }
        if (banner.parentElement !== bannerHost) {
            bannerHost.appendChild(banner);
        }
        const counts = getSenateControlCountsFromPage();
        const party = getSenateControlParty(counts);
        if (!party) {
            removeBanner();
            return;
        }
        const partyClass = party === "R" ? "senate-control-r" : (party === "D" ? "senate-control-d" : "senate-control-t");
        const partyText = party === "R" ? "REPUBLICAN" : (party === "D" ? "DEMOCRATIC" : "TIED");
        banner.className = `show ${partyClass}`;
        banner.innerHTML = `
            <span class="bm-senate-control-check" aria-hidden="true">
                <svg viewBox="0 0 14 14" stroke-width="2.5">
                    <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                </svg>
            </span>
            <span>SENATE</span>
            <span class="bm-senate-control-divider"></span>
            <span>${partyText} CONTROL</span>
        `;
    }
    function updateHouseControlBanner(options = {}) {
        let banner = document.getElementById("bm-house-banner");
        const removeBanner = () => {
            if (!banner) return;
            banner.classList.remove("show", "house-control-r", "house-control-d", "house-control-t");
            banner.innerHTML = "";
        };
        if (options.live !== true || options.onCountyMap === true || document.getElementById("bm-house-district-grid")) {
            removeBanner();
            return;
        }
        const svgMap = options.svgMap || document.getElementById("usHouse-map-live") || document.querySelector('.better-maps-container[data-type="usHouse"]');
        if (!svgMap || !svgMap.parentElement) {
            removeBanner();
            return;
        }
        const oldWrapper = svgMap.parentElement.classList?.contains("bm-map-svg-wrapper")
            ? svgMap.parentElement
            : null;
        if (oldWrapper?.parentElement) {
            const wrapperParent = oldWrapper.parentElement;
            wrapperParent.insertBefore(svgMap, oldWrapper);
            oldWrapper.remove();
        }
        const bannerHost = svgMap.parentElement;
        document.querySelectorAll(".bm-house-banner-host").forEach(host => {
            if (host !== bannerHost) host.classList.remove("bm-house-banner-host");
        });
        bannerHost.classList.add("bm-house-banner-host");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "bm-house-banner";
        }
        if (banner.parentElement !== bannerHost) {
            bannerHost.appendChild(banner);
        }
        const pageCounts = getHouseControlCountsFromPage();
        const counts = pageCounts || getHouseControlCountsFromElectionData() || getHouseControlCountsFromPoliticians();
        const party = getHouseControlParty(counts);
        if (!party) {
            removeBanner();
            return;
        }
        const partyClass = party === "R" ? "house-control-r" : (party === "D" ? "house-control-d" : "house-control-t");
        const partyText = party === "R" ? "REPUBLICAN" : (party === "D" ? "DEMOCRATIC" : "TIED");
        banner.className = `show ${partyClass}`;
        banner.innerHTML = `
            <span class="bm-senate-control-check" aria-hidden="true">
                <svg viewBox="0 0 14 14" stroke-width="2.5">
                    <path fill="none" d="M12,3.5l-6.81,7L2,7.8"></path>
                </svg>
            </span>
            <span>HOUSE</span>
            <span class="bm-senate-control-divider"></span>
            <span>${partyText} CONTROL</span>
        `;
    }
    function refreshVisibleControlBanners() {
        try {
            const senateMap = document.getElementById("usSenate-map-live");
            if (senateMap) {
                const source = String(senateMap.getAttribute("data-source") || "");
                updateSenateControlBanner({
                    live: true,
                    onCountyMap: /[\\\/]counties[\\\/]/i.test(source),
                    svgMap: senateMap
                });
            }
            const houseMap = document.getElementById("usHouse-map-live");
            if (houseMap) {
                const source = String(houseMap.getAttribute("data-source") || "");
                updateHouseControlBanner({
                    live: true,
                    onCountyMap: /[\\\/]counties[\\\/]/i.test(source),
                    svgMap: houseMap
                });
            }
        } catch { }
    }
    module.exports = {
        tooltipDiv,
        tooltipComponents,
        updateTooltip,
        updateHouseStateTooltip,
        updateHouseDistrictTooltip,
        getHouseDistrictFlipData,
        shouldRevealHouseDistrictResults,
        getLiveHouseDistrictSnapshot,
        hasVisibleHouseStateResults,
        refreshLiveStateResultsForTooltip,
        createTooltip,
        updateSenateControlBanner,
        updateHouseControlBanner
    };
};
