const STORAGE_KEY = "nepse-agent-state-v1";
const TRADING_DAYS_PER_YEAR = 252;

const DEFAULT_CONFIG = {
    profileId: "trader-001",
    schedulerMinutes: 60,
    confidenceThreshold: 0.6,
    maxRiskPerTrade: 5000,
    maxTradesPerDay: 3,
    cooldownDays: 2,
    positionSize: 100,
    blacklist: "",
    adviceOnly: true,
    manualApproval: true,
    dataFeedUrl: "",
    syncApiUrl: "",
    webhookUrl: "",
    telegramUrl: "",
    emailUrl: "",
    whatsappUrl: "",
    buyRules: {
        minMomentum5d: 0.015,
        minVolumeBoost: 1.1,
        stopLossPct: 0.03,
        targetPct: 0.07,
        minRiskReward: 1.8
    },
    charges: {
        brokerFeePct: 0.0036,
        sebiFeePct: 0.00015,
        dpCharge: 25,
        capitalGainTaxPct: 0.05
    }
};

const state = {
    config: { ...DEFAULT_CONFIG },
    stocks: [],
    recommendations: [],
    pendingApprovals: [],
    alerts: [],
    signalHistory: [],
    performance: {
        totalSignals: 0,
        closedSignals: 0,
        wins: 0,
        losses: 0,
        netProfit: 0
    },
    schedulerHandle: null,
    dailySummaryDate: "",
    weeklySummaryDate: "",
    lastRunAt: "",
    lastDecisionBySymbol: {}
};

const el = {
    configForm: document.getElementById("configForm"),
    runNowBtn: document.getElementById("runNowBtn"),
    recommendationSummary: document.getElementById("recommendationSummary"),
    candidateRows: document.getElementById("candidateRows"),
    historyRows: document.getElementById("historyRows"),
    metrics: document.getElementById("metrics"),
    alertLog: document.getElementById("alertLog"),
    pendingApproval: document.getElementById("pendingApproval"),
    pendingList: document.getElementById("pendingList"),
    approveBtn: document.getElementById("approveBtn"),
    enableNotificationBtn: document.getElementById("enableNotificationBtn")
};

function generateMockStocks() {
    return [
        buildMockStock("NABIL", 1020, 260000),
        buildMockStock("SCB", 568, 195000),
        buildMockStock("NICA", 780, 210000),
        buildMockStock("NTC", 852, 175000),
        buildMockStock("NLIC", 649, 168000),
        buildMockStock("GBIME", 735, 188000),
        buildMockStock("UPPER", 412, 240000),
        buildMockStock("HIDCL", 198, 280000)
    ];
}

function buildMockStock(symbol, basePrice, baseVolume) {
    const closes = [];
    const volumes = [];
    let value = basePrice;
    for (let i = 0; i < 60; i += 1) {
        const drift = 1 + (Math.random() - 0.47) * 0.02;
        value = Math.max(50, value * drift);
        closes.push(round(value));
        volumes.push(Math.round(baseVolume * (0.8 + Math.random() * 0.5)));
    }
    return { symbol, closes, volumes };
}

function round(value, precision = 2) {
    return Number(value.toFixed(precision));
}

function getInputValue(id, parser = (v) => v) {
    const input = document.getElementById(id);
    return parser(input.value);
}

function saveState() {
    const serializable = {
        config: state.config,
        recommendations: state.recommendations,
        pendingApprovals: state.pendingApprovals,
        alerts: state.alerts.slice(0, 100),
        signalHistory: state.signalHistory.slice(0, 500),
        performance: state.performance,
        dailySummaryDate: state.dailySummaryDate,
        weeklySummaryDate: state.weeklySummaryDate,
        lastRunAt: state.lastRunAt,
        lastDecisionBySymbol: state.lastDecisionBySymbol,
        stocks: state.stocks
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        state.stocks = generateMockStocks();
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        state.config = { ...DEFAULT_CONFIG, ...parsed.config };
        state.recommendations = parsed.recommendations || [];
        state.pendingApprovals = parsed.pendingApprovals || [];
        state.alerts = parsed.alerts || [];
        state.signalHistory = parsed.signalHistory || [];
        state.performance = parsed.performance || state.performance;
        state.dailySummaryDate = parsed.dailySummaryDate || "";
        state.weeklySummaryDate = parsed.weeklySummaryDate || "";
        state.lastRunAt = parsed.lastRunAt || "";
        state.lastDecisionBySymbol = parsed.lastDecisionBySymbol || {};
        state.stocks = parsed.stocks?.length ? parsed.stocks : generateMockStocks();
    } catch (_err) {
        state.stocks = generateMockStocks();
    }
}

function fillConfigInputs() {
    document.getElementById("profileId").value = state.config.profileId;
    document.getElementById("schedulerMinutes").value = state.config.schedulerMinutes;
    document.getElementById("confidenceThreshold").value = state.config.confidenceThreshold;
    document.getElementById("maxRiskPerTrade").value = state.config.maxRiskPerTrade;
    document.getElementById("maxTradesPerDay").value = state.config.maxTradesPerDay;
    document.getElementById("cooldownDays").value = state.config.cooldownDays;
    document.getElementById("positionSize").value = state.config.positionSize;
    document.getElementById("blacklist").value = state.config.blacklist;
    document.getElementById("adviceOnly").checked = Boolean(state.config.adviceOnly);
    document.getElementById("manualApproval").checked = Boolean(state.config.manualApproval);
    document.getElementById("dataFeedUrl").value = state.config.dataFeedUrl || "";
    document.getElementById("syncApiUrl").value = state.config.syncApiUrl || "";
    document.getElementById("webhookUrl").value = state.config.webhookUrl || "";
    document.getElementById("telegramUrl").value = state.config.telegramUrl || "";
    document.getElementById("emailUrl").value = state.config.emailUrl || "";
    document.getElementById("whatsappUrl").value = state.config.whatsappUrl || "";
}

function readConfigFromForm() {
    state.config = {
        ...state.config,
        profileId: getInputValue("profileId").trim() || "trader-001",
        schedulerMinutes: Math.max(1, getInputValue("schedulerMinutes", Number)),
        confidenceThreshold: Math.min(1, Math.max(0.1, getInputValue("confidenceThreshold", Number))),
        maxRiskPerTrade: Math.max(100, getInputValue("maxRiskPerTrade", Number)),
        maxTradesPerDay: Math.max(1, getInputValue("maxTradesPerDay", Number)),
        cooldownDays: Math.max(0, getInputValue("cooldownDays", Number)),
        positionSize: Math.max(10, getInputValue("positionSize", Number)),
        blacklist: getInputValue("blacklist").trim(),
        adviceOnly: document.getElementById("adviceOnly").checked,
        manualApproval: document.getElementById("manualApproval").checked,
        dataFeedUrl: getInputValue("dataFeedUrl").trim(),
        syncApiUrl: getInputValue("syncApiUrl").trim(),
        webhookUrl: getInputValue("webhookUrl").trim(),
        telegramUrl: getInputValue("telegramUrl").trim(),
        emailUrl: getInputValue("emailUrl").trim(),
        whatsappUrl: getInputValue("whatsappUrl").trim()
    };
}

function sma(series, period) {
    if (series.length < period) {
        return null;
    }
    const window = series.slice(series.length - period);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return sum / period;
}

function pctChange(current, prev) {
    if (!prev) {
        return 0;
    }
    return (current - prev) / prev;
}

function computeCharges(entry, exit, qty) {
    const buyAmount = entry * qty;
    const sellAmount = exit * qty;
    const grossProfit = sellAmount - buyAmount;
    const broker = (buyAmount + sellAmount) * state.config.charges.brokerFeePct;
    const sebi = (buyAmount + sellAmount) * state.config.charges.sebiFeePct;
    const gainTax = Math.max(grossProfit, 0) * state.config.charges.capitalGainTaxPct;
    const totalCharges = broker + sebi + state.config.charges.dpCharge + gainTax;
    return {
        grossProfit,
        totalCharges,
        netProfit: grossProfit - totalCharges
    };
}

function evaluateStock(stock) {
    const closes = stock.closes;
    const volumes = stock.volumes;
    const latest = closes[closes.length - 1];
    const prev5 = closes[closes.length - 6];
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const momentum5d = pctChange(latest, prev5);
    const volumeNow = volumes[volumes.length - 1];
    const volumeAvg20 = sma(volumes, 20) || 1;
    const volumeBoost = volumeNow / volumeAvg20;
    const trendPass = Boolean(sma20 && sma50 && latest > sma20 && sma20 > sma50);
    const momentumPass = momentum5d >= state.config.buyRules.minMomentum5d;
    const volumePass = volumeBoost >= state.config.buyRules.minVolumeBoost;

    const entry = latest;
    const stopLoss = round(entry * (1 - state.config.buyRules.stopLossPct));
    const target = round(entry * (1 + state.config.buyRules.targetPct));
    const riskPerShare = Math.max(entry - stopLoss, 0.01);
    const rewardPerShare = Math.max(target - entry, 0.01);
    const riskReward = rewardPerShare / riskPerShare;
    const rrPass = riskReward >= state.config.buyRules.minRiskReward;
    const charges = computeCharges(entry, target, state.config.positionSize);
    const confidence = Math.max(
        0,
        Math.min(
            1,
            0.4 * (trendPass ? 1 : 0) +
                0.25 * Math.min(momentum5d / state.config.buyRules.minMomentum5d, 2) / 2 +
                0.2 * Math.min(volumeBoost / state.config.buyRules.minVolumeBoost, 2) / 2 +
                0.15 * Math.min(riskReward / state.config.buyRules.minRiskReward, 2) / 2
        )
    );
    return {
        symbol: stock.symbol,
        entry: round(entry),
        target,
        stopLoss,
        momentum5d: round(momentum5d * 100, 2),
        volumeBoost: round(volumeBoost, 2),
        riskReward: round(riskReward, 2),
        confidence: round(confidence, 2),
        expectedNetProfit: round(charges.netProfit),
        trendPass,
        momentumPass,
        volumePass,
        rrPass
    };
}

function scoreAndRank(stocks) {
    return stocks
        .map(evaluateStock)
        .map((item) => {
            const score =
                (item.trendPass ? 35 : 0) +
                (item.momentumPass ? 25 : 0) +
                (item.volumePass ? 20 : 0) +
                (item.rrPass ? 20 : 0);
            return { ...item, score };
        })
        .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}

function inCooldown(symbol, now) {
    const lastDecision = state.lastDecisionBySymbol[symbol];
    if (!lastDecision) {
        return false;
    }
    const days = (now - new Date(lastDecision).getTime()) / (1000 * 60 * 60 * 24);
    return days < state.config.cooldownDays;
}

function tradesTodayCount(now) {
    const today = new Date(now).toISOString().slice(0, 10);
    return state.signalHistory.filter((signal) => signal.date.startsWith(today)).length;
}

function applySafetyControls(candidates) {
    const blacklist = state.config.blacklist
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    const now = Date.now();
    const allowedSlots = Math.max(state.config.maxTradesPerDay - tradesTodayCount(now), 0);
    let picked = 0;
    return candidates.map((item) => {
        const isBlacklisted = blacklist.includes(item.symbol);
        const cooldown = inCooldown(item.symbol, now);
        const riskValue = (item.entry - item.stopLoss) * state.config.positionSize;
        const riskBlocked = riskValue > state.config.maxRiskPerTrade;
        const meetsCoreRules =
            item.trendPass &&
            item.momentumPass &&
            item.volumePass &&
            item.rrPass &&
            item.confidence >= state.config.confidenceThreshold;

        let status = "HOLD";
        let reason = "Rules not fully met";
        if (isBlacklisted) {
            status = "BLOCKED";
            reason = "Blacklisted";
        } else if (cooldown) {
            status = "BLOCKED";
            reason = "Cooldown active";
        } else if (riskBlocked) {
            status = "BLOCKED";
            reason = "Risk limit exceeded";
        } else if (!meetsCoreRules) {
            status = "HOLD";
            reason = "Rules below threshold";
        } else if (picked >= allowedSlots) {
            status = "BLOCKED";
            reason = "Max trades/day reached";
        } else {
            status = "BUY";
            reason = state.config.adviceOnly ? "Advice signal" : "Execution-ready signal";
            picked += 1;
        }
        return {
            ...item,
            status,
            reason
        };
    });
}

function makeSignalRecord(candidate) {
    return {
        id: `${candidate.symbol}-${Date.now()}`,
        date: new Date().toISOString(),
        symbol: candidate.symbol,
        entry: candidate.entry,
        target: candidate.target,
        stopLoss: candidate.stopLoss,
        expectedNetProfit: candidate.expectedNetProfit,
        confidence: candidate.confidence,
        status: "OPEN",
        exit: null,
        netProfit: null,
        outcome: "PENDING"
    };
}

function updateExistingSignals() {
    state.signalHistory.forEach((signal) => {
        if (signal.status !== "OPEN") {
            return;
        }
        const stock = state.stocks.find((item) => item.symbol === signal.symbol);
        if (!stock) {
            return;
        }
        const latestPrice = stock.closes[stock.closes.length - 1];
        if (latestPrice >= signal.target) {
            const charges = computeCharges(signal.entry, signal.target, state.config.positionSize);
            signal.status = "CLOSED";
            signal.outcome = "TARGET_HIT";
            signal.exit = signal.target;
            signal.netProfit = round(charges.netProfit);
            createAlert(`✅ ${signal.symbol} target hit at ${signal.target}. Net ${signal.netProfit} NPR.`);
        } else if (latestPrice <= signal.stopLoss) {
            const charges = computeCharges(signal.entry, signal.stopLoss, state.config.positionSize);
            signal.status = "CLOSED";
            signal.outcome = "STOP_LOSS_HIT";
            signal.exit = signal.stopLoss;
            signal.netProfit = round(charges.netProfit);
            createAlert(`🛑 ${signal.symbol} stop-loss hit at ${signal.stopLoss}. Net ${signal.netProfit} NPR.`);
        }
    });
}

function refreshPerformanceMetrics() {
    const closed = state.signalHistory.filter((signal) => signal.status === "CLOSED");
    const wins = closed.filter((signal) => signal.netProfit > 0);
    const losses = closed.filter((signal) => signal.netProfit <= 0);
    const totalNet = closed.reduce((acc, signal) => acc + (signal.netProfit || 0), 0);
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    const avgNet = closed.length ? totalNet / closed.length : 0;
    const score = winRate * 0.65 + (Math.max(avgNet, -1000) + 1000) * 0.0002 * 35;
    const tunedThreshold = Math.min(0.85, Math.max(0.55, 0.5 + (70 - score) / 200));
    state.performance = {
        totalSignals: state.signalHistory.length,
        closedSignals: closed.length,
        wins: wins.length,
        losses: losses.length,
        netProfit: round(totalNet)
    };
    state.config.confidenceThreshold = round(tunedThreshold, 2);
}

function createAlert(message) {
    const timestamp = new Date().toISOString();
    const composed = `${timestamp} — ${message}`;
    state.alerts.unshift(composed);
    state.alerts = state.alerts.slice(0, 100);
    pushAlertToChannels(composed);
    showBrowserAlert(message);
}

async function pushAlertToChannels(message) {
    const channels = [
        state.config.webhookUrl,
        state.config.telegramUrl,
        state.config.emailUrl,
        state.config.whatsappUrl
    ].filter(Boolean);
    if (!channels.length) {
        return;
    }
    const payload = {
        profileId: state.config.profileId,
        message,
        app: "nepse-agent-assistant"
    };
    await Promise.allSettled(
        channels.map((url) =>
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
        )
    );
}

function showBrowserAlert(message) {
    if (Notification.permission === "granted") {
        new Notification("NEPSE Agent Alert", { body: message });
    }
}

function maybeGenerateDailyAndWeeklySummary() {
    const now = new Date();
    const currentDay = now.toISOString().slice(0, 10);
    if (state.dailySummaryDate !== currentDay && now.getHours() >= 16) {
        state.dailySummaryDate = currentDay;
        const todaySignals = state.signalHistory.filter((item) => item.date.startsWith(currentDay));
        createAlert(`📊 Daily summary: ${todaySignals.length} signals, total closed net ${state.performance.netProfit} NPR.`);
    }

    const weekKey = `${now.getUTCFullYear()}-W${Math.ceil((now.getUTCDate() + 6 - now.getUTCDay()) / 7)}`;
    if (state.weeklySummaryDate !== weekKey && now.getUTCDay() === 5 && now.getHours() >= 16) {
        state.weeklySummaryDate = weekKey;
        createAlert(
            `🗓️ Weekly summary: ${state.performance.closedSignals} closed signals, ` +
                `${state.performance.wins} wins, ${state.performance.losses} losses, net ${state.performance.netProfit} NPR.`
        );
    }
}

function updateMockStream() {
    state.stocks = state.stocks.map((stock) => {
        const latest = stock.closes[stock.closes.length - 1];
        const move = 1 + (Math.random() - 0.49) * 0.022;
        const nextClose = Math.max(20, latest * move);
        const nextVolume = Math.max(10000, stock.volumes[stock.volumes.length - 1] * (0.8 + Math.random() * 0.5));
        return {
            ...stock,
            closes: [...stock.closes.slice(-59), round(nextClose)],
            volumes: [...stock.volumes.slice(-59), Math.round(nextVolume)]
        };
    });
}

async function fetchStockData() {
    if (!state.config.dataFeedUrl) {
        updateMockStream();
        return state.stocks;
    }
    try {
        const response = await fetch(state.config.dataFeedUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Data feed failed: ${response.status}`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
            throw new Error("Data feed format should be an array.");
        }
        state.stocks = payload;
        return payload;
    } catch (error) {
        createAlert(`⚠️ Data feed unavailable (${error.message}). Using local stream.`);
        updateMockStream();
        return state.stocks;
    }
}

async function syncStateToCloud() {
    if (!state.config.syncApiUrl) {
        return;
    }
    const payload = {
        profileId: state.config.profileId,
        state: {
            recommendations: state.recommendations,
            signalHistory: state.signalHistory.slice(-100),
            performance: state.performance,
            alerts: state.alerts.slice(0, 30),
            lastRunAt: state.lastRunAt
        }
    };
    try {
        await fetch(state.config.syncApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (_error) {
        createAlert("⚠️ Sync endpoint failed. State remains on this device.");
    }
}

function recordRecommendations(candidates) {
    const buySignals = candidates.filter((item) => item.status === "BUY");
    if (!buySignals.length) {
        return;
    }
    if (state.config.manualApproval) {
        state.pendingApprovals = buySignals;
        renderPendingApprovals();
        createAlert(`🕒 ${buySignals.length} BUY signal(s) pending manual approval.`);
        return;
    }
    dispatchSignals(buySignals);
}

function dispatchSignals(signals) {
    signals.forEach((candidate) => {
        const record = makeSignalRecord(candidate);
        state.signalHistory.unshift(record);
        state.lastDecisionBySymbol[candidate.symbol] = record.date;
        const message =
            `🚀 BUY ${candidate.symbol} | Entry ${candidate.entry} | Target ${candidate.target} | ` +
            `Stop ${candidate.stopLoss} | Conf ${candidate.confidence} | Expected net ${candidate.expectedNetProfit} NPR`;
        createAlert(message);
    });
    state.pendingApprovals = [];
    renderPendingApprovals();
}

function renderPendingApprovals() {
    if (!state.pendingApprovals.length) {
        el.pendingApproval.classList.add("hidden");
        el.pendingList.innerHTML = "";
        return;
    }
    el.pendingApproval.classList.remove("hidden");
    el.pendingList.innerHTML = state.pendingApprovals
        .map(
            (item) =>
                `<li>${item.symbol}: Entry ${item.entry}, Target ${item.target}, ` +
                `Stop ${item.stopLoss}, Conf ${item.confidence}</li>`
        )
        .join("");
}

function render() {
    const best = state.recommendations[0];
    el.recommendationSummary.textContent = best
        ? `${best.symbol} ${best.status} | Entry ${best.entry} | Target ${best.target} | Stop ${best.stopLoss} | ` +
          `Confidence ${best.confidence} | Net ${best.expectedNetProfit} NPR`
        : "No recommendation available.";

    el.candidateRows.innerHTML = state.recommendations
        .map((item) => {
            const statusClass = item.status === "BUY" ? "buy" : item.status === "BLOCKED" ? "blocked" : "hold";
            return `<tr>
                <td>${item.symbol}</td>
                <td>${item.entry}</td>
                <td>${item.target}</td>
                <td>${item.stopLoss}</td>
                <td>${item.riskReward}</td>
                <td>${item.confidence}</td>
                <td>${item.expectedNetProfit}</td>
                <td class="${statusClass}" title="${item.reason}">${item.status}</td>
            </tr>`;
        })
        .join("");

    el.historyRows.innerHTML = state.signalHistory
        .slice(0, 80)
        .map((signal) => {
            const cls = signal.outcome === "TARGET_HIT" ? "buy" : signal.outcome === "STOP_LOSS_HIT" ? "sell" : "pending";
            return `<tr>
                <td>${signal.date.replace("T", " ").slice(0, 16)}</td>
                <td>${signal.symbol}</td>
                <td>${signal.entry}</td>
                <td>${signal.exit ?? "-"}</td>
                <td>${signal.netProfit ?? signal.expectedNetProfit}</td>
                <td class="${cls}">${signal.outcome}</td>
            </tr>`;
        })
        .join("");

    const perf = state.performance;
    const winRate = perf.closedSignals ? round((perf.wins / perf.closedSignals) * 100, 2) : 0;
    el.metrics.innerHTML =
        `<strong>Signals:</strong> ${perf.totalSignals} | ` +
        `<strong>Closed:</strong> ${perf.closedSignals} | ` +
        `<strong>Wins:</strong> ${perf.wins} | <strong>Losses:</strong> ${perf.losses} | ` +
        `<strong>Win rate:</strong> ${winRate}% | <strong>Net:</strong> ${perf.netProfit} NPR`;

    el.alertLog.innerHTML = state.alerts
        .slice(0, 40)
        .map((alert) => `<li>${alert}</li>`)
        .join("");
}

async function runAnalysis(source = "scheduler") {
    const stocks = await fetchStockData();
    const ranked = scoreAndRank(stocks);
    const secured = applySafetyControls(ranked);
    state.recommendations = secured.slice(0, 8);
    recordRecommendations(state.recommendations);
    updateExistingSignals();
    refreshPerformanceMetrics();
    maybeGenerateDailyAndWeeklySummary();
    state.lastRunAt = new Date().toISOString();
    createAlert(`📈 ${source} run complete. ${state.recommendations.filter((s) => s.status === "BUY").length} BUY signal(s).`);
    await syncStateToCloud();
    saveState();
    render();
}

function startScheduler() {
    if (state.schedulerHandle) {
        clearInterval(state.schedulerHandle);
    }
    state.schedulerHandle = setInterval(() => {
        runAnalysis("scheduled");
    }, state.config.schedulerMinutes * 60 * 1000);
}

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        createAlert("⚠️ Browser notifications are not supported in this browser.");
        render();
        return;
    }
    const permission = await Notification.requestPermission();
    createAlert(`🔔 Browser notification permission: ${permission}.`);
    saveState();
    render();
}

function attachEvents() {
    el.configForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        readConfigFromForm();
        saveState();
        startScheduler();
        createAlert("⚙️ Configuration updated.");
        render();
        await runAnalysis("manual-config-save");
    });

    el.runNowBtn.addEventListener("click", () => runAnalysis("manual-run"));
    el.enableNotificationBtn.addEventListener("click", () => requestNotificationPermission());
    el.approveBtn.addEventListener("click", () => {
        dispatchSignals(state.pendingApprovals);
        saveState();
        render();
    });
}

function bootstrap() {
    loadState();
    fillConfigInputs();
    attachEvents();
    renderPendingApprovals();
    render();
    startScheduler();
    runAnalysis("bootstrap");
}

bootstrap();
