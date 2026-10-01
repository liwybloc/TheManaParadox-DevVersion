<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { HANDLES } from "@game/core/player.js";
import { SCRATCH_HANDLES } from "@game/core/scratch.js";
import { ACHIEVEMENTS } from "@game/game/achievements.js";
import { CRYSTALS, CRYSTAL_GOALS } from "@game/game/crystals.js";
import { getTotalMessageTickersSeen, getUniqueMessageTickersSeen } from "@game/game/message_tickers.js";
import { CONDENSED_UPGRADES, CONDENSED_UPGRADE_PLACEHOLDERS } from "@game/game/condensed.js";
import { REMEMBRANCE_CONNECTIONS, REMEMBRANCE_LAYOUT, REMEMBRANCE_UPGRADES, REMEMBRANCE_UPGRADE_COUNT, remembrancePrerequisites, remembranceUpgradeCost } from "@game/game/remembrance.js";
import { TABS } from "@game/config/tabs.js";
import { PROGRESSION_GOALS } from "@game/config/goals.js";
import { ADVANCED_COMBAT_SPELL_COST_HANDLES, GUILD_RANKS, POTION_SPEED_II_TIMER_HANDLES, POTION_SPEED_III_TIMER_HANDLES, POTION_SPEED_TIMER_HANDLES } from "@game/guild/guild.js";
import { GUILD_QUESTS_BY_ID } from "@game/guild/quests.js";
import { INVENTORY_ITEMS_BY_ID, Items, resolveItemDescription } from "@game/guild/items.js";
import { GUILD_SHOP_UPGRADES } from "@game/guild/shop.js";
import { AUTOCASTER_NAMES, AUTOCASTER_TASKS, AUTOCASTER_TIERS, MAX_AUTOCASTERS } from "@game/config/autocasters.js";
import { AUTOCASTER_HANDLES } from "@game/guild/autocasters.js";
import { beginAbyssRun as beginAbyssRunAction, castAll, condense, enterCrystal as enterCrystalAction, escapeAbyssRun as escapeAbyssRunAction, escapeCrystal as escapeCrystalAction, focus as focusAction, increaseMatrix as increaseMatrixAction, sealMeridians as sealMeridiansAction, sealedMeridianResetNoGain as sealedMeridianResetNoGainAction, shatterCrystal as shatterCrystalAction, subscribeToCondense, subscribeToMemoryGain } from "@game/systems/actions.js";
import { exportSave, importSave, resetGame as resetGameData, saveGame } from "@game/systems/save.js";
import { getUpdateRate, isOfflineProgressEnabled, setOfflineProgressEnabled, setUpdateRate, skipTimeSimulation, speedUpTimeSimulation, subscribeToTimeSimulation } from "@game/systems/tick.js";
import { setAbyssActive, setAbyssVortexActive, setStarManaProgress, setStarsAnimated as applyStarsAnimated, setStarsVisible as applyStarsVisible, starsAnimated as loadStarsAnimated, starsVisible as loadStarsVisible } from "@game/systems/background.js";
import { formatCompletionTime, formatCrystalGoal, formatDecimal, formatDecimalCompact, formatDecimals } from "@game/ui/formatting.js";
import { namedWasm } from "@generated/_wasm$globals.js";
import GoalProgressBar from "./components/GoalProgressBar.vue";
import BaseGameFrame from "./frames/BaseGameFrame.vue";
import InfoTab from "./tabs/InfoTab.vue";
import NotificationStack from "./components/NotificationStack.vue";
import TimeSimulation from "./components/TimeSimulation.vue";
import KeybindMenu from "./components/KeybindMenu.vue";
import MessageTicker from "./components/MessageTicker.vue";
import ManaCircleExpansion from "./components/ManaCircleExpansion.vue";
import { showNotification } from "./notifications.js";
import { createGlitchPositions, renderGlitchText } from "./textoptions.js";
import AbyssFrame from "./frames/AbyssFrame.vue";

function tabDefinition(tabId) {
    return TABS.find((tab) => tab.id === tabId);
}

function isValidTab(tabId) {
    return tabDefinition(tabId) !== undefined;
}

function isValidSubTab(tabId, subtabId) {
    return tabDefinition(tabId)?.subtabs?.some((subtab) => subtab.id === subtabId) ?? false;
}

const selectedTab = localStorage.getItem("selectedTab");
const selectedSubTab = localStorage.getItem("selectedSubTab");
const startTab = isValidTab(selectedTab) ? selectedTab : TABS[0].id;
const startingSubtabs = Object.fromEntries(TABS.map((tab) => [tab.id, tab.subtabs?.[0]?.id ?? ""]));
if (isValidSubTab(startTab, selectedSubTab)) startingSubtabs[startTab] = selectedSubTab;

const activeTab = ref(startTab);
const activeSubtabs = ref(startingSubtabs);
const mana = ref("0");
const sonicValue = ref("0.000000");
const abyssRunActive = ref(false);
const canCondense = ref(false);
const condenseManaGained = ref("0");
const condensedMana = ref("0");
const condensedUnlocked = ref(false);
const guildUnlocked = ref(false);
const ascensionHallUnlocked = ref(false);
const autocastersUnlocked = ref(false);
const questActive = ref(false);
const manaCircle = ref(0);
const manaCircleExpansionVisible = ref(false);
const crystalsUnlocked = ref(false);
const crystalStateRevision = ref(0);
const memoriesUnlocked = ref(false);
const remembranceUnlocked = ref(false);
const libraryUnlocked = ref(false);
const activeCrystal = ref(-1);
const crystalGoalReached = ref(false);
const crystalCanShatter = ref(false);
const equipmentUnlocked = ref(false);
const enteredAbyss = ref(namedWasm.isInAbyss());
const abyssEntryTransition = ref("fade");
const cantRankUp = ref(false);
const pingedTabs = ref([]);
const pingedSubtabs = ref([]);
const manaPerSecond = ref("0.00");
const expCostIncreasesAt = ref("10,000");
const oomPerSecond = ref("0.00");
const showOoMPerSecond = ref(false);
const abyssUnlocked = ref(false);
const condensedUpgrades = ref(CONDENSED_UPGRADES.map((upgrade, index) => ({
    ...upgrade,
    index,
    cost: "0",
    amount: "0",
    effect: "1",
    purchased: false,
    circleTwoPurchased: false,
    circleTwoAvailable: false,
    affordable: false,
})));
const condensedUpgradePlaceholders = ref(Object.fromEntries(
    Object.keys(CONDENSED_UPGRADE_PLACEHOLDERS).map((key) => [key, ""]),
));
const remembrance = ref({
    memorials: "0",
    cost: "1",
    respec: false,
    upgrades: Array.from({ length: REMEMBRANCE_UPGRADE_COUNT }, (_, index) => ({
        index,
        row: REMEMBRANCE_LAYOUT[index]?.[1] ?? 1,
        column: REMEMBRANCE_LAYOUT[index]?.[0] ?? 1,
        purchased: false,
        available: index === 0,
        description: index < 13 ? REMEMBRANCE_UPGRADES[index].description : "????????",
        cost: REMEMBRANCE_UPGRADES[index].cost,
        costFormatted: REMEMBRANCE_UPGRADES[index].costFormatted,
    })),
    connections: REMEMBRANCE_CONNECTIONS,
});
const nextGoal = ref("Condense");
const nextGoalProgress = ref(0);
const tierOneDefinitions = [
    { name: "Mana Absorber", handle: HANDLES.count_manaConduit },
    { name: "Pylon", handle: HANDLES.count_conduitConjugation },
    { name: "Conduit", handle: HANDLES.count_conjugationCreation },
    { name: "Circuit", handle: HANDLES.count_creationManufactory },
    { name: "Meridian", handle: HANDLES.count_manufactureStaff },
];
const tierOneUpgrades = ref(tierOneDefinitions.map((upgrade, index) => ({
    ...upgrade,
    id: `tier-one-${index}`,
    index,
    amount: "0",
    bought: "0",
    boughtGT10000: false,
    cost: "0 mana",
    multiplier: "×1",
    visible: index === 0,
    affordable: false,
    costHandle: namedWasm.tierOneCostHandle(index),
    empowermentCostHandle: namedWasm.tierOneEmpowermentCostHandle(index),
    empowermentHandle: namedWasm.tierOneEmpowermentHandle(index),
    empowered: "0",
    empowerCost: "0",
    empowerVisible: false,
    hasNextTier: false,
    affordabilityProgress: 0,
})));
const castSpeedSpell = ref({
    timer: "0:00",
    magnitude: "×1.00",
    power: "2",
    showPower: false,
    cost: "1,000.00 mana",
    affordable: false,
});
const castMax = ref(false);
const potionEffects = ref([]);
const gameSpeed = ref("1.00");
const gameSpeedIncreased = ref(false);
const starsVisible = ref(loadStarsVisible());
const starsAnimated = ref(loadStarsAnimated());
const newsTickerEnabled = ref(localStorage.getItem("newsTickerEnabled") !== "false");
const messageTickerParticles = ref(localStorage.getItem("messageTickerParticles") === "true");
const sealedMeridians = ref({
    level: "1",
    effect: "1",
    magnitude: "2",
    cost: "1 Meridian",
    affordable: false,
    visible: false,
});
const matrix = ref({
    level: "0",
    base: "2",
    other: "0",
    effect: "0",
    power: "0.5",
    cost: "10 Meridian",
    affordable: false,
    visible: false,
});
const courage = ref({
    visible: false,
    active: false,
    available: true,
    timer: "0:00",
    cooldown: "0:00",
    multiplier: "10.00",
});
const meridianPurification = ref({
    visible: false,
    affordable: false,
    effect: "×1.01",
    multiplier: "×1.00",
    requirement: "1.00e45",
});
const guild = ref({ member: false, rank: "F", rankIndex: 0, nextRank: "E", questActive: false, refreshTimer: "10:00", experience: 0, experienceRequirement: 25, coins: "0", wolfFur: "0", potions: "0", inventoryItems: [], equipmentItems: [], shopItems: [], shopUpgrades: [] });
const autocasters = ref({ casters: [], tasks: [], hireOptions: [] });
const questResult = ref({ visible: false, monster: "Wolfines", items: [] });
const guildQuests = ref(Array.from({ length: 6 }, (_, index) => ({ ...GUILD_QUESTS_BY_ID.get(index), index, rank: "F", locked: false, visible: index < 3 })));
const combat = ref({
    monster: "Wolfines",
    rank: "F",
    enemyHealth: "150",
    enemyMaximumHealth: "150",
    enemyPercent: 1,
    shield: "0",
    shieldPercent: 1,
    freezeTurns: "0",
    spells: [
        { index: 0, name: "Fireball", effect: "35 damage", costHandle: HANDLES.fireballCost, cost: "1e40", affordable: false },
        { index: 1, name: "Whirlwind", effect: "60 damage", costHandle: HANDLES.whirlwindCost, cost: "1e80", affordable: false },
        { index: 2, name: "Freeze", effect: "10 damage · freezes for 2 turns", costHandle: HANDLES.freezeCost, cost: "1e120", affordable: false },
        { index: 3, name: "Lightning", effect: "120 damage", costHandle: ADVANCED_COMBAT_SPELL_COST_HANDLES[0], cost: "1e160", affordable: false, unlocked: false, upgrade: 9 },
        { index: 4, name: "Meteor", effect: "250 damage", costHandle: ADVANCED_COMBAT_SPELL_COST_HANDLES[1], cost: "1e220", affordable: false, unlocked: false, upgrade: 10 },
        { index: 5, name: "Arcane Nova", effect: "500 damage", costHandle: ADVANCED_COMBAT_SPELL_COST_HANDLES[2], cost: "1e300", affordable: false, unlocked: false, upgrade: 11 },
    ],
});
const resetConfirmationVisible = ref(false);
const changeKeybindsVisible = ref(false);
const infoTabVisible = ref(false);
const infoTopicId = ref("welcome");
const showFpsCounter = window.location.hostname === "localhost";
const displayedFps = ref(0);
const updateRate = ref(getUpdateRate());
const RENDER_UPDATE_RATE_STORAGE_KEY = "renderUpdateRate";
const renderUpdateRate = ref(loadRenderUpdateRate());
const offlineProgress = ref(isOfflineProgressEnabled());
const timeSimulation = ref({ active: false, totalSeconds: 0, simulatedSeconds: 0, progress: 0, speed: 1 });
let unsubscribeFromTimeSimulation;
let unsubscribeFromCondense;

function openInfo(topicId = "welcome") {
    infoTopicId.value = topicId;
    infoTabVisible.value = true;
}
let unsubscribeFromMemoryGain;
const statistics = ref({
    timePlayed: "00:00:00",
    gameTimePlayed: "00:00:00",
    manaProduced: "0.00",
    messageTickersSeen: getTotalMessageTickersSeen(),
    uniqueMessageTickersSeen: getUniqueMessageTickersSeen(),
    condenses: "0",
    condensedManaProduced: "0.00",
    timeThisCondense: "00:00:00",
    gameTimeThisCondense: "00:00:00",
    fastestCondense: "00:00:00",
    hasCondensed: false,
    abyssUnlocked: false,
    sonicValue: "0.000000",
    highestAbyssDepth: "1,000 m",
    abyssRunTime: "00:00:00",
    abyssRunsCompleted: 0,
});

const memories = ref({
    remembered: 0,
    limited: false,
    nextChance: "100.00",
    focusing: false,
    manaMultiplier: "1.00",
    productionMultiplier: "1.00",
    gainMultiplier: "1",
    costStartAdd: "0",
});

function updateMessageTickerStatistics({ total, unique }) {
    statistics.value.messageTickersSeen = total;
    statistics.value.uniqueMessageTickersSeen = unique;
}

const achievements = ref(ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    wasmIndex: achievement.number - 1,
    unlocked: false,
})));
let animationFrame;
let displayErrorReported = false;
let achievementsInitialized = false;
let displayedAchievementRevision = -1;
let displayedInventoryRevision = -1;
const knownTabIds = new Set();
const knownSubtabIds = new Set();
let navigationUnlocksInitialized = false;

const activeSubtab = computed(() => activeSubtabs.value[activeTab.value]);
const visibleTabs = computed(() => TABS.filter((tab) => {
    if (tab.requiresCondensed && !condensedUnlocked.value) return false;
    if (tab.requiresGuild && !guildUnlocked.value) return false;
    if (tab.requiresQuest && !questActive.value) return false;
    if (tab.requiresAutocasters && !autocastersUnlocked.value) return false;
    if (tab.requiresCrystals && !crystalsUnlocked.value) return false;
    if (tab.requiresAbyss && !abyssUnlocked.value) return false;
    return true;
}).map((tab) => ({
    ...tab,
    subtabs: tab.subtabs?.filter((subtab) =>
        (!subtab.requiresAscensionHall || ascensionHallUnlocked.value)
        && (!subtab.requiresMemory || memoriesUnlocked.value)
        && (!subtab.requiresRemTree || remembranceUnlocked.value)
        && (!subtab.requiresLibrary || libraryUnlocked.value)
    ),
})));

watch(
    [activeTab, activeSubtab],
    ([tab, subtab]) => {
        const abyss = tab === "abyss" || namedWasm.isAbyssRunActive();
        document.body.classList.toggle("abyss-active", abyss);
        setAbyssActive(abyss);
        setAbyssVortexActive(abyss && subtab === "depths");
    },
    { immediate: true },
);

function displayedItemDefinition(itemId) {
    const definition = INVENTORY_ITEMS_BY_ID.get(itemId);
    if (!definition) return undefined;
    return {
        ...definition,
        sellPrice: [
            namedWasm.inventoryItemSellMinimum(itemId),
            namedWasm.inventoryItemSellMaximum(itemId),
        ],
        description: resolveItemDescription(definition.description, {
            duration: namedWasm.potionDuration(itemId),
            effect: formatDecimal(namedWasm.potionEffectHandle(itemId)),
        }),
    };
}

function displayedInventoryItemDefinition(itemId, metadata) {
    if (itemId !== Items.PACKAGE) return displayedItemDefinition(itemId);
    const packageDefinition = INVENTORY_ITEMS_BY_ID.get(Items.PACKAGE);
    const contained = displayedItemDefinition(metadata);
    if (!packageDefinition || !contained || metadata === Items.PACKAGE || contained.equipmentSlot !== undefined) return undefined;
    return {
        ...packageDefinition,
        name: `Package: ${contained.name}`,
        description: `Contains 10 of ${contained.name}.\n${contained.description}`,
        style: `${contained.style} inventory-package`,
        sellPrice: [contained.sellPrice[0] * 10, contained.sellPrice[1] * 10],
        use: contained.use ? { ...contained.use, label: `${contained.use.label} 10` } : undefined,
        containedItem: metadata,
    };
}

function selectTab(id) {
    if (!isValidTab(id)) return;
    activeTab.value = id;
    pingedTabs.value = pingedTabs.value.filter((tabId) => tabId !== id);
    localStorage.setItem("selectedTab", id);
    localStorage.setItem("selectedSubTab", activeSubtabs.value[id]);
}

function selectSubtab(id) {
    if (!isValidSubTab(activeTab.value, id)) return;
    activeSubtabs.value[activeTab.value] = id;
    pingedSubtabs.value = pingedSubtabs.value.filter((subtabId) => subtabId !== id);
    localStorage.setItem("selectedSubTab", id);
}

const SLOW_UI_INTERVAL = 250;
let lastFastUiUpdate = 0;
let lastSlowUiUpdate = 0;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
let lastRemembranceGlitchRender = 0;
let lastRemembranceGlitchPositionUpdate = 0;
let remembranceGlitchPositions = createGlitchPositions(15, 3);

function updateRemembranceGlitch(timestamp) {
    if (timestamp - lastRemembranceGlitchRender < 50) return;
    lastRemembranceGlitchRender = timestamp;
    if (timestamp - lastRemembranceGlitchPositionUpdate >= 300) {
        lastRemembranceGlitchPositionUpdate = timestamp;
        remembranceGlitchPositions = createGlitchPositions(15, 3);
    }
    for (const upgrade of remembrance.value.upgrades) {
        if (upgrade.index < 13) continue;
        upgrade.description = renderGlitchText(15, remembranceGlitchPositions);
    }
    }

function updateFastDisplay() {
    PerformanceStats.begin("fastDisplay");
    updateGlobalDisplay();

    switch (activeTab.value) {
        case "mana":
            updateManaDisplay();
            break;
        case "quest":
            updateQuestDisplay();
            break;
    }
    PerformanceStats.end("fastDisplay");
}

function updateSlowDisplay() {
    PerformanceStats.begin("slowDisplay");
    updateProgressionDisplay();
    updateAchievementNotifications();

    switch (activeTab.value) {
        case "condensed":
            updateCondensedDisplay();
            break;
        case "manacircle":
            manaCircle.value = namedWasm.getMagnitude(HANDLES.mana_circle_tier);
            break;
        case "guild":
            updateGuildDisplay(activeSubtab.value);
            break;
        case "autocasters":
            updateAutocastersDisplay();
            break;
        case "achievements":
            updateAchievementsDisplay();
            break;
        case "statistics":
            updateStatisticsDisplay();
            break;
    }
    PerformanceStats.end("slowDisplay");
}

function updateDisplay(timestamp) {
    try {
        const nextEnteredAbyss = namedWasm.isInAbyss();
        if (nextEnteredAbyss && !enteredAbyss.value) abyssEntryTransition.value = "fade";
        enteredAbyss.value = nextEnteredAbyss;
        if (showFpsCounter) {
            if (fpsWindowStart === 0) fpsWindowStart = timestamp;
            fpsFrameCount++;
            const fpsElapsed = timestamp - fpsWindowStart;
            if (fpsElapsed >= 500) {
                displayedFps.value = Math.round(fpsFrameCount * 1000 / fpsElapsed);
                fpsFrameCount = 0;
                fpsWindowStart = timestamp;
            }
        }
        updateRemembranceGlitch(timestamp);
        if (timestamp - lastFastUiUpdate >= renderUpdateRate.value) {
            lastFastUiUpdate = timestamp;
            updateFastDisplay();
        }

        if (timestamp - lastSlowUiUpdate >= SLOW_UI_INTERVAL) {
            lastSlowUiUpdate = timestamp;
            updateSlowDisplay();
        }

        displayErrorReported = false;
    } catch (error) {
        if (!displayErrorReported) console.error("Failed to update the active game display", error);
        displayErrorReported = true;
    } finally {
        animationFrame = requestAnimationFrame(updateDisplay);
    }
}

function updateGlobalDisplay() {
    mana.value = formatDecimal(namedWasm.isQuestActive() ? HANDLES.quests_currentAvailableMana : HANDLES.mana, 2, "Maximum");
    canCondense.value = namedWasm.canCondense();
    condensedUnlocked.value = namedWasm.hasCondensed();
    if (condensedUnlocked.value) condensedMana.value = formatDecimal(HANDLES.condensedMana, 0);
    manaCircle.value = namedWasm.getMagnitude(HANDLES.mana_circle_tier);
    crystalsUnlocked.value = namedWasm.hasAscendedCondensedEffect(19);
    memoriesUnlocked.value = namedWasm.hasCompletedCrystal(2);
    remembranceUnlocked.value = namedWasm.hasMemoryMilestone(500);
    libraryUnlocked.value = namedWasm.hasMemoryMilestone(75);
    abyssUnlocked.value = namedWasm.hasCompletedCrystal(14);
    abyssRunActive.value = namedWasm.isAbyssRunActive();
    sonicValue.value = formatDecimal(namedWasm.sonicValueLogarithmicHandle(), 6);
    memories.value.focusing = namedWasm.isFocusing();
    if (manaCircle.value > 0 && canCondense.value) {
        namedWasm.refreshCondenseGain();
        condenseManaGained.value = formatDecimal(SCRATCH_HANDLES.condenseGain, 2);
        if (namedWasm.isFocusing()) {
            memories.value.nextChance = (namedWasm.memoryChance(SCRATCH_HANDLES.condenseGain) * 100).toFixed(2);
        }
    }
    questActive.value = namedWasm.isQuestActive();
    if (namedWasm.consumeAutoCondenseRequest()) condense();
    if (!questActive.value && activeTab.value === "quest") selectTab("guild");
}

function updateProgressionDisplay() {
    ascensionHallUnlocked.value = namedWasm.isAscensionHallUnlocked();
    crystalsUnlocked.value = namedWasm.hasAscendedCondensedEffect(19);
    memoriesUnlocked.value = namedWasm.hasCompletedCrystal(2);
    libraryUnlocked.value = namedWasm.hasMemoryMilestone(75);
    activeCrystal.value = namedWasm.getActiveCrystal();
    crystalGoalReached.value = namedWasm.isActiveCrystalGoalReached();
    crystalCanShatter.value = namedWasm.canShatterActiveCrystal();
    autocastersUnlocked.value = namedWasm.hasGuildShopUpgrade(1);
    if (!ascensionHallUnlocked.value && activeSubtabs.value.guild === "guild-ascension-hall") {
        activeSubtabs.value.guild = "guild-main";
    }
    if (!memoriesUnlocked.value && activeSubtabs.value.condensed === "memories") {
        activeSubtabs.value.condensed = "condensed-upgrades";
    }
    if (!libraryUnlocked.value && activeSubtabs.value.guild === "guild-library") {
        activeSubtabs.value.guild = "guild-main";
    }
    if (activeTab.value === "guild" && activeSubtab.value === "guild-ascension-hall") {
        namedWasm.enterAscensionHall();
    }
    guildUnlocked.value = namedWasm.isGuildUnlocked();
    if (activeCrystal.value >= 0) {
        const goalHandle = CRYSTAL_GOALS[activeCrystal.value];
        nextGoal.value = crystalGoalReached.value ? "Shatter the Crystal" : formatCrystalGoal(goalHandle);
        nextGoalProgress.value = namedWasm.manaGoalProgress(0, namedWasm.getMagnitude(goalHandle), 1);
    } else {
        const goal = PROGRESSION_GOALS.find((candidate) => !isProgressionGoalComplete(candidate))
            ?? PROGRESSION_GOALS[PROGRESSION_GOALS.length - 1];
        nextGoal.value = goal.label;
        nextGoalProgress.value = progressionGoalProgress(goal);
    }
    setStarManaProgress(namedWasm.manaCondenseProgress());
    updateNavigationUnlockPings();
}

function pingTab(id) {
    if (!pingedTabs.value.includes(id)) pingedTabs.value = [...pingedTabs.value, id];
}

function pingSubtab(tabId, subtabId) {
    pingTab(tabId);
    if (!pingedSubtabs.value.includes(subtabId)) {
        pingedSubtabs.value = [...pingedSubtabs.value, subtabId];
    }
}

function updateNavigationUnlockPings() {
    const tabs = visibleTabs.value;
    if (!navigationUnlocksInitialized) {
        for (const tab of tabs) {
            knownTabIds.add(tab.id);
            for (const subtab of tab.subtabs ?? []) knownSubtabIds.add(subtab.id);
        }
        navigationUnlocksInitialized = true;
        return;
    }
    for (const tab of tabs) {
        const tabWasKnown = knownTabIds.has(tab.id);
        if (!tabWasKnown) {
            knownTabIds.add(tab.id);
            pingTab(tab.id);
        }
        for (const subtab of tab.subtabs ?? []) {
            if (knownSubtabIds.has(subtab.id)) continue;
            knownSubtabIds.add(subtab.id);
            if (tabWasKnown) pingSubtab(tab.id, subtab.id);
        }
    }
}

function updateAutocastersDisplay() {
    guild.value.coins = formatDecimal(HANDLES.coins, 0);
    const achievementSpeed = namedWasm.hasTierOneAchievement(37) ? 2 : 1;
    const primaryCasterByTask = AUTOCASTER_TASKS.map((task) => namedWasm.casterAssignedToTask(task.id));
    const casters = Array.from({ length: MAX_AUTOCASTERS }, (_, id) => {
        const tier = namedWasm.autocasterTier(id);
        if (tier === 0) return null;
        const wageRemaining = namedWasm.autocasterWageTimer(id);
        const assignment = namedWasm.autocasterAssignment(id);
        const actionRemaining = namedWasm.autocasterActionCooldown(id);
        const isSupporting = assignment >= 0 && primaryCasterByTask[assignment] !== id;
        const actionStatus = isSupporting
            ? "Supporting"
            : assignment >= 0
            ? actionRemaining > 0 ? `Running in ${formatShortTimer(actionRemaining)}` : "Ready"
            : "Unassigned";
        const wageStatus = wageRemaining > 0 ? `Wage due in ${formatShortTimer(wageRemaining)}` : "No wage due";
        return {
            id,
            tier,
            name: AUTOCASTER_NAMES[namedWasm.autocasterNameIndex(id)] ?? "Mysterious Caster",
            assignment,
            position: namedWasm.autocasterRosterPosition(id),
            wage: AUTOCASTER_TIERS[tier - 1].wage,
            sellPrice: AUTOCASTER_TIERS[tier - 1].sellPrice,
            status: `${actionStatus} · ${wageStatus}`,
        };
    });
    autocasters.value = {
        casters,
        tasks: AUTOCASTER_TASKS.map((task) => {
            const assignedCasters = casters.filter((caster) => caster?.assignment === task.id);
            const tierSpeed = assignedCasters.some((caster) => caster.tier >= 3) ? 2 : 1;
            return {
                ...task,
                casters: assignedCasters,
                effectiveCooldown: task.cooldown / tierSpeed / achievementSpeed
                    / (2 ** Math.max(0, assignedCasters.length - 1)),
                castsMax: task.id < 5 ? namedWasm.producerAutocasterCastsMax(task.id) : false,
                purifyMinimum: task.id === 6 ? namedWasm.readString(AUTOCASTER_HANDLES.purifyMinimum) : "1.01",
                condenseGain: task.id === 5 ? namedWasm.readString(AUTOCASTER_HANDLES.condenseGain) : "1",
                maximumOwned: task.id === 7
                    ? namedWasm.readString(AUTOCASTER_HANDLES.sealedMeridiansMaximum)
                    : task.id === 8 ? namedWasm.readString(AUTOCASTER_HANDLES.crystalMatricesMaximum) : "Infinity",
            };
        }),
        enabled: namedWasm.isAutocastersEnabled(),
        hireOptions: AUTOCASTER_TIERS.map((tier) => ({ ...tier, affordable: namedWasm.canHireAutocaster(tier.tier) })),
    };
}

function isProgressionGoalComplete(goal) {
    switch (goal.completion) {
        case "sealed-meridians":
            return namedWasm.gt(HANDLES.sealedMeridians, 1) || namedWasm.isGuildUnlocked();
        case "meridian-purification":
            return namedWasm.gt(HANDLES.purifiedMeridiansMultiplier, 1) || namedWasm.isGuildUnlocked();
        case "guild-member":
            return namedWasm.isGuildMember();
        case "courage":
            return namedWasm.isCourageUnlocked() || namedWasm.hasCondensed();
        case "condensed":
            return namedWasm.hasCondensed();
        case "ascension-hall":
            return namedWasm.isAscensionHallUnlocked();
        case "crystals":
            return namedWasm.hasAscendedCondensedEffect(CONDENSED_UPGRADES.length - 1);
        case "abyss":
            return CRYSTALS.every((_, index) => namedWasm.hasCompletedCrystal(index));
        default:
            return false;
    }
}

function progressionGoalProgress(goal) {
    const progress = goal.progress;
    switch (progress.type) {
        case "mana":
            return namedWasm.manaGoalProgress(
                progress.startExponent,
                progress.endExponent,
                progress.maximumBeforeCompletion,
                progress.doubleLog,
            );
        case "condensed-upgrades":
            return countCompleted(CONDENSED_UPGRADES, (_, index) => namedWasm.hasCondensedUpgrade(index)) / progress.target;
        case "ascended-condensed-upgrades":
            return countCompleted(CONDENSED_UPGRADES, (_, index) => namedWasm.hasCircleTwoCondensedUpgrade(index)) / progress.target;
        case "shattered-crystals":
            return countCompleted(CRYSTALS, (_, index) => namedWasm.hasCompletedCrystal(index)) / progress.target;
        default:
            return 0;
    }
}

function countCompleted(definitions, predicate) {
    let total = 0;
    definitions.forEach((definition, index) => {
        if (predicate(definition, index)) total++;
    });
    return total;
}

function updateManaDisplay() {
    namedWasm.refreshCrystalProducerCosts();
    const potionSpeedTimers = POTION_SPEED_TIMER_HANDLES
        .map((handle) => namedWasm.getMagnitude(handle))
        .filter((seconds) => seconds > 0);
    const potionSpeedIITimers = POTION_SPEED_II_TIMER_HANDLES
        .map((handle) => namedWasm.getMagnitude(handle))
        .filter((seconds) => seconds > 0);
    const potionSpeedIIITimers = POTION_SPEED_III_TIMER_HANDLES
        .map((handle) => namedWasm.getMagnitude(handle))
        .filter((seconds) => seconds > 0);
    gameSpeed.value = formatGameSpeed(namedWasm.getGameSpeed());
    gameSpeedIncreased.value = namedWasm.isGameSpeedIncreased();
    manaPerSecond.value = formatDecimal(SCRATCH_HANDLES.manaPerSecond);
    expCostIncreasesAt.value = formatDecimal(SCRATCH_HANDLES.expCostIncreasesAt, 0);
    oomPerSecond.value = formatOoMPerSecond(SCRATCH_HANDLES.oomPerSecond);
    showOoMPerSecond.value = namedWasm.getIncType() === 1;
    potionEffects.value = potionSpeedTimers.map((seconds, index) => ({
        id: `speed-${index}`,
        text: `Potion of Speed: +${formatDecimal(namedWasm.potionEffectHandle(Items.POTION_SPEED_I))}× Game Speed (${formatShortTimer(seconds)})`,
    })).concat(potionSpeedIITimers.map((seconds, index) => ({
        id: `speed-ii-${index}`,
        text: `Potion of Speed II: +${formatDecimal(namedWasm.potionEffectHandle(Items.POTION_SPEED_II))}× Game Speed (${formatShortTimer(seconds)})`,
    }))).concat(potionSpeedIIITimers.map((seconds, index) => ({
        id: `speed-iii-${index}`,
        text: `Potion of Speed III: +${formatDecimal(namedWasm.potionEffectHandle(Items.POTION_SPEED_III))}× Game Speed (${formatShortTimer(seconds)})`,
    })));
    for (const upgrade of tierOneUpgrades.value) {
        const bought = namedWasm.tierOneBoughtHandle(upgrade.index);
        const displayMultiplier = namedWasm.tierOneDisplayMultiplierHandle(upgrade.index);
        const [amount, boughtAmount, empowered, cost, multiplier, empowerCost] = formatDecimals([
            upgrade.handle, bought, upgrade.empowermentHandle,
            upgrade.costHandle, displayMultiplier, upgrade.empowermentCostHandle,
        ], [0, 0, 0, 2, 2, 2]);
        upgrade.amount = amount;
        upgrade.bought = boughtAmount;
        upgrade.boughtGT10000 = namedWasm.gt(bought, SCRATCH_HANDLES.D10000);
        upgrade.cost = `${cost} mana`;
        upgrade.multiplier = `×${multiplier}`;
        upgrade.visible = namedWasm.isTierOneVisible(upgrade.index);
        upgrade.affordable = namedWasm.canBuyTierOne(upgrade.index);
        upgrade.empowerCost = empowerCost;
        upgrade.empowered = empowered;
        upgrade.empowerVisible = namedWasm.canEmpowerTierOne(upgrade.index);
        upgrade.hasNextTier = upgrade.index < tierOneUpgrades.value.length - 1
            && namedWasm.gt(namedWasm.tierOneBoughtHandle(upgrade.index + 1), 0);
        upgrade.affordabilityProgress = namedWasm.tierOneAffordabilityProgress(upgrade.index);
    }
    castSpeedSpell.value.timer = formatDuration(HANDLES.castSpeedTimer);
    const [castSpeedMagnitude, castSpeedCost] = formatDecimals([HANDLES.castSpeedMagnitude, HANDLES.castSpeedCost]);
    castSpeedSpell.value.magnitude = `×${castSpeedMagnitude}`;
    const meditationPower = namedWasm.meditationPowerHandle();
    castSpeedSpell.value.power = formatDecimalCompact(meditationPower);
    castSpeedSpell.value.showPower = !namedWasm.eq(meditationPower, 2);
    castSpeedSpell.value.cost = `${castSpeedCost} mana`;
    castSpeedSpell.value.affordable = namedWasm.canCastSpeed();
    const [sealedMeridianLevel, sealedMeridianEffect, sealedMeridianCost] = formatDecimals([
        HANDLES.sealedMeridians,
        HANDLES.sealedMeridiansSpeedEffect,
        HANDLES.sealMeridiansCost,
    ], 0);
    sealedMeridians.value.level = sealedMeridianLevel;
    sealedMeridians.value.effect = sealedMeridianEffect;
    sealedMeridians.value.magnitude = formatDecimalCompact(namedWasm.sealedMeridianMagnitudeHandle());
    const progressionCostResource = activeCrystal.value === 3 ? "Mana Absorbers" : "Meridians";
    sealedMeridians.value.cost = `${sealedMeridianCost} ${progressionCostResource}`;
    sealedMeridians.value.affordable = namedWasm.canSealMeridians();
    sealedMeridians.value.visible = namedWasm.areSealedMeridiansVisible();
    const [matrixLevel, matrixCost] = formatDecimals([HANDLES.matrixOwned, HANDLES.matrixCost], 0);
    matrix.value.level = matrixLevel;
    matrix.value.other = formatDecimalCompact(namedWasm.matrixOtherEffectHandle());
    matrix.value.effect = formatDecimalCompact(namedWasm.crystalMatrixEffectHandle());
    matrix.value.power = formatDecimalCompact(namedWasm.matrixMagnitudeHandle());
    matrix.value.cost = `${matrixCost} ${progressionCostResource}`;
    matrix.value.affordable = namedWasm.canIncreaseMatrix();
    matrix.value.visible = namedWasm.isMatrixVisible();
    courage.value.visible = namedWasm.isCourageVisible();
    courage.value.active = namedWasm.isCourageActive();
    courage.value.available = !namedWasm.gt(HANDLES.courageCooldown, 0);
    courage.value.timer = formatDuration(HANDLES.courageTimer);
    courage.value.cooldown = formatDuration(HANDLES.courageCooldown);
    namedWasm.refreshCourageMultiplier();
    courage.value.multiplier = formatDecimal(HANDLES.courageMultiplier);
    meridianPurification.value.affordable = namedWasm.canPurifyMeridians();
    meridianPurification.value.visible = namedWasm.hasTierOneAchievement(7);
    const [purificationEffect, purificationIncrease, purificationMultiplier, purificationRequirement] = formatDecimals([
        namedWasm.effectiveMeridianPurificationEffectHandle(),
        SCRATCH_HANDLES.purificationRelativeIncrease,
        namedWasm.effectivePurifiedMeridiansMultiplierHandle(),
        HANDLES.meridianPurificationRequirement,
    ]);
    meridianPurification.value.effect = `×${purificationEffect}`;
    meridianPurification.value.relIncrease = `×${purificationIncrease}`;
    meridianPurification.value.multiplier = `×${purificationMultiplier}`;
    meridianPurification.value.requirement = purificationRequirement;
}

function updateGuildDisplay(subtab) {
    guild.value.member = namedWasm.isGuildMember();
    guild.value.questActive = questActive.value;
    if (subtab === "guild-main") updateGuildBoardDisplay();
    else if (subtab === "guild-inventory") updateGuildInventoryDisplay();
    else if (subtab === "guild-shop") updateGuildShopDisplay();
}

function updateGuildShopDisplay() {
    const guildRankIndex = namedWasm.getMagnitude(HANDLES.guildRank);
    guild.value.coins = formatDecimal(HANDLES.coins, 0);
    guild.value.shopItems = Array.from({ length: 3 }, (_, slot) => {
        const itemId = namedWasm.shopItemId(slot);
        return {
            slot,
            itemId,
            name: displayedItemDefinition(itemId)?.name ?? "Unknown Item",
            cost: namedWasm.shopItemCost(slot),
            affordable: namedWasm.canBuyShopItem(slot),
            refreshRemaining: namedWasm.shopItemRefreshTimer(slot),
        };
    });
    guild.value.shopUpgrades = GUILD_SHOP_UPGRADES.map((upgrade) => ({
        ...upgrade,
        locked: guildRankIndex < upgrade.rank,
        purchased: namedWasm.hasGuildShopUpgrade(upgrade.id),
        affordable: namedWasm.canBuyGuildShopUpgrade(upgrade.id),
    }));
}

function updateGuildInventoryDisplay() {
    guild.value.coins = formatDecimal(HANDLES.coins, 0);
    equipmentUnlocked.value = namedWasm.isEquipmentUnlocked();
    const inventoryRevision = namedWasm.getInventoryRevision();
    if (inventoryRevision !== displayedInventoryRevision) {
        const inventoryItems = [];
        for (let position = 0; position < 100; position++) {
            const type = namedWasm.inventoryItemAt(position);
            if (type === 0) continue;
            const metadata = namedWasm.inventoryItemMetadata(position);
            const definition = displayedInventoryItemDefinition(type, metadata);
            if (!definition) continue;
            inventoryItems.push({
                position,
                type,
                metadata,
                ...definition,
            });
        }
        guild.value.inventoryItems = inventoryItems;
        displayedInventoryRevision = inventoryRevision;
    }
    guild.value.equipmentItems = Array.from({ length: 4 }, (_, slot) => {
        const type = namedWasm.equippedItem(slot);
        return type === 0 ? null : { type, ...displayedItemDefinition(type) };
    });
}

function equipInventoryItem(position, slot) {
    namedWasm.equipInventoryItem(position, slot);
}

function unequipInventoryItem(slot, position) {
    namedWasm.unequipInventoryItem(slot, position);
}

function updateGuildBoardDisplay() {
    const guildRankIndex = namedWasm.getMagnitude(HANDLES.guildRank);
    guild.value.rank = GUILD_RANKS[guildRankIndex] ?? "F";
    guild.value.rankIndex = guildRankIndex;
    guild.value.nextRank = GUILD_RANKS[guildRankIndex + 1] ?? "---";
    guild.value.experience = namedWasm.getGuildExperience();
    const experienceRequirement = namedWasm.guildExperienceRequirement();
    guild.value.experienceRequirement = Number.isFinite(experienceRequirement) ? experienceRequirement : "∞";
    cantRankUp.value = namedWasm.cantRankUp();
    questResult.value.visible = namedWasm.hasQuestResult();
    if (questResult.value.visible) {
        questResult.value.monster = GUILD_QUESTS_BY_ID.get(namedWasm.lastCompletedQuestDefinitionId())?.monster ?? "monsters";
        questResult.value.items = Array.from({ length: namedWasm.lastQuestRewardCount() }, (_, index) => {
            const item = INVENTORY_ITEMS_BY_ID.get(namedWasm.lastQuestRewardItem(index));
            return {
                name: item?.name ?? "Unknown Item",
                amount: namedWasm.lastQuestRewardAmount(index),
                dropped: namedWasm.lastQuestRewardDropped(index),
            };
        }).filter((item) => item.amount > 0);
    }
    guild.value.refreshTimer = formatShortTimer(namedWasm.getQuestRefreshRemaining());
    for (const quest of guildQuests.value) {
        const definition = GUILD_QUESTS_BY_ID.get(namedWasm.questDefinitionId(quest.index));
        if (definition) Object.assign(quest, definition, {
            rewards: definition.rewards.map((reward) => ({
                ...reward,
                name: INVENTORY_ITEMS_BY_ID.get(reward.item)?.name ?? "Unknown Item",
            })),
        });
        quest.rank = GUILD_RANKS[namedWasm.questRank(quest.index)] ?? "F";
        quest.locked = namedWasm.isQuestSlotLocked(quest.index);
        quest.visible = quest.index < namedWasm.visibleQuestSlotCount();
    }
}

function updateQuestDisplay() {
    if (!questActive.value) return;
    const activeQuestId = namedWasm.questDefinitionId(namedWasm.activeQuestIndex());
    const activeQuest = GUILD_QUESTS_BY_ID.get(activeQuestId);
    const [enemyHealth, enemyMaximumHealth, shield, freezeTurns] = formatDecimals([
        HANDLES.enemyHealth,
        namedWasm.enemyMaximumHealth(namedWasm.activeQuestIndex()),
        namedWasm.combatShieldHandle(),
        HANDLES.combatFreezeTurns,
    ], 0);
    combat.value.monster = activeQuest?.monster ?? "Monsters";
    combat.value.rank = GUILD_RANKS[activeQuest?.rank ?? 0] ?? "F";
    combat.value.enemyHealth = enemyHealth;
    combat.value.enemyMaximumHealth = enemyMaximumHealth;
    combat.value.enemyPercent = namedWasm.wolfineHealthPercent();
    combat.value.shield = shield;
    combat.value.shieldPercent = namedWasm.combatShieldPercent();
    combat.value.freezeTurns = freezeTurns;
    for (const spell of combat.value.spells) {
        spell.unlocked = spell.upgrade === undefined || namedWasm.hasGuildShopUpgrade(spell.upgrade);
        spell.cost = formatDecimal(spell.costHandle);
        spell.affordable = namedWasm.canCastCombatSpell(spell.index);
    }
}

function updateCondensedDisplay() {
    namedWasm.refreshCondensedUpgradeState();
    namedWasm.refreshCondenseGain();
    memories.value.remembered = namedWasm.getTotalMemories();
    memories.value.limited = namedWasm.isMemoryLimitReached();
    memories.value.focusing = namedWasm.isFocusing();
    const [manaMultiplier, productionMultiplier] = formatDecimals([
        namedWasm.memoryManaMultiplierHandle(), namedWasm.memoryProductionMultiplierHandle(),
    ]);
    memories.value.manaMultiplier = manaMultiplier;
    memories.value.productionMultiplier = productionMultiplier;
    memories.value.gainMultiplier = String(namedWasm.memoryGainMultiplier());
    memories.value.costStartAdd = String(namedWasm.memoryCostStartAdd());
    const memoryChance = memories.value.focusing
        ? namedWasm.memoryChance(SCRATCH_HANDLES.condenseGain)
        : namedWasm.baseMemoryChance();
    memories.value.nextChance = (memoryChance * 100).toFixed(2);
    for (const upgrade of condensedUpgrades.value) {
        const finalUpgrade = upgrade.index === condensedUpgrades.value.length - 1;
        const circleTwoUnlocked = !finalUpgrade || namedWasm.canSeeCircleTwoFinalUpgrade();
        upgrade.circleTwoAvailable = manaCircle.value > 0
            && circleTwoUnlocked
            && namedWasm.hasCondensedUpgrade(upgrade.index);
        upgrade.circleTwoPurchased = namedWasm.hasCircleTwoCondensedUpgrade(upgrade.index);
        const costHandle = upgrade.circleTwoAvailable ? upgrade.circleTwo.costHandle : upgrade.costHandle;
        upgrade.cost = formatDecimal(costHandle, 0);
        upgrade.purchased = namedWasm.hasCondensedUpgrade(upgrade.index);
        upgrade.affordable = namedWasm.canBuyCondensedUpgrade(upgrade.index);
        upgrade.visible = !finalUpgrade || manaCircle.value > 0 || namedWasm.canSeeAscensionHallUpgrade();
    }
    remembrance.value.memorials = String(namedWasm.getMemorials());
    remembrance.value.cost = formatDecimal(namedWasm.remembranceUpgradeCostHandle(), 0);
    remembrance.value.respec = namedWasm.isRespecRemembranceOnCondense();
    for (const upgrade of remembrance.value.upgrades) {
        upgrade.purchased = namedWasm.hasRemembranceUpgrade(upgrade.index);
        const purchased = remembrance.value.upgrades.filter((entry) => entry.purchased).map((entry) => entry.index + 1);
        upgrade.available = upgrade.index !== 13
            && namedWasm.getMemorials() >= remembranceUpgradeCost(upgrade.index + 1)
            && remembrancePrerequisites(upgrade.index + 1).every((required) => purchased.includes(required));
        if (!upgrade.costFormatted) {
            namedWasm.writeNumber(SCRATCH_HANDLES.remembranceCostFormat, upgrade.cost);
            upgrade.costFormatted = formatDecimal(SCRATCH_HANDLES.remembranceCostFormat, 0);
        }
    }
    for (const [key, placeholder] of Object.entries(CONDENSED_UPGRADE_PLACEHOLDERS)) {
        condensedUpgradePlaceholders.value[key] = `${placeholder.prefix}${formatDecimal(placeholder.handle)}`;
    }
}

function updateStatisticsDisplay() {
    const [manaProduced, condensedManaProduced] = formatDecimals([
        HANDLES.statistics_totalManaProduced, HANDLES.statistics_condensedManaProduced,
    ], 2, ["Maximum", "Unknown"]);
    statistics.value.timePlayed = formatTotalTime(HANDLES.statistics_totalTimePlayed);
    statistics.value.gameTimePlayed = formatTotalTime(HANDLES.statistics_gameTimePlayed);
    statistics.value.manaProduced = manaProduced;
    statistics.value.condensedManaProduced = condensedManaProduced;
    statistics.value.condenses = formatDecimal(HANDLES.statistics_condenses, 0);
    statistics.value.timeThisCondense = formatTotalTime(HANDLES.statistics_timeThisCondense);
    statistics.value.gameTimeThisCondense = formatTotalTime(HANDLES.statistics_gameTimeThisCondense);
    statistics.value.fastestCondense = formatCompletionTime(
        namedWasm.getMagnitude(HANDLES.statistics_fastestCondense),
        3,
    );
    statistics.value.abyssUnlocked = abyssUnlocked.value;
    statistics.value.sonicValue = formatDecimal(namedWasm.sonicValueLogarithmicHandle(), 6);
    statistics.value.highestAbyssDepth = `${Math.round(namedWasm.getHighestAbyssDepthCompleted()).toLocaleString()} m`;
    statistics.value.abyssRunTime = formatCompletionTime(namedWasm.getAbyssRunTime(), 1);
    statistics.value.abyssRunsCompleted = namedWasm.getAbyssRunsCompleted();
    statistics.value.hasCondensed = namedWasm.hasCondensed();
}

function updateAchievementsDisplay() {
    const timePlayedAchievement = achievements.value.find((achievement) => achievement.id === "achievement_playtwohours");
    if (timePlayedAchievement) {
        timePlayedAchievement.reward = `Mana is increased based on time played (Currently: ×${formatDecimal(HANDLES.multiplier_timePlayedAchievement)})`;
    }
}

function updateAchievementNotifications(force = false) {
    const revision = namedWasm.getAchievementRevision();
    if (!force && revision === displayedAchievementRevision) return;
    for (const achievement of achievements.value) {
        const unlocked = namedWasm.hasTierOneAchievement(achievement.wasmIndex);
        const beyondManaCircle = (achievement.circle ?? 1) > manaCircle.value + 1;
        if (achievementsInitialized && unlocked && !achievement.unlocked && !beyondManaCircle) {
            const challenge = achievement.category === "challenge";
            showNotification(`Achievement: ${achievement.title}`, {
                color: "#c49cff",
                textColor: challenge ? "#c49cff" : "#fff",
                duration: challenge ? 8000 : 4000,
            });
        }
        achievement.unlocked = unlocked;
    }
    achievementsInitialized = true;
    displayedAchievementRevision = revision;
}

function formatOoMPerSecond(handle) {
    if (namedWasm.getLayer(handle) === 0 && namedWasm.getMagnitude(handle) < 0.01) return "0.00";
    return formatDecimal(handle);
}

function formatGameSpeed(handle) {
    if (!namedWasm.gt(handle, 0) || !namedWasm.lt(handle, 0.01)) return formatDecimal(handle);
    const speed = namedWasm.getSign(handle) * namedWasm.getMagnitude(handle);
    return speed.toExponential(2).replace("+", "");
}

function formatDuration(handle) {
    if (namedWasm.getLayer(handle) !== 0) return `${formatDecimal(handle)}s`;
    const seconds = namedWasm.getSign(handle) * namedWasm.getMagnitude(handle);
    const wholeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function formatTotalTime(handle) {
    if (namedWasm.getLayer(handle) !== 0) return `${formatDecimal(handle)} seconds`;
    const seconds = namedWasm.getSign(handle) * namedWasm.getMagnitude(handle);
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds % 86400 / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const remainingSeconds = totalSeconds % 60;
    const clock = [hours, minutes, remainingSeconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
    return days > 0 ? `${days}d ${clock}` : clock;
}

function setStarsVisible(visible) {
    starsVisible.value = visible;
    applyStarsVisible(visible);
}

function setStarsAnimated(animated) {
    starsAnimated.value = animated;
    applyStarsAnimated(animated);
}

function setNewsTickerEnabled(enabled) {
    newsTickerEnabled.value = enabled;
    localStorage.setItem("newsTickerEnabled", String(enabled));
}

function setMessageTickerParticles(enabled) {
    messageTickerParticles.value = enabled;
    localStorage.setItem("messageTickerParticles", String(enabled));
}

function updateTickRate(value) {
    updateRate.value = setUpdateRate(value);
}

function loadRenderUpdateRate() {
    const saved = Number(localStorage.getItem(RENDER_UPDATE_RATE_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 10 ? Math.max(10, Math.min(250, Math.round(saved))) : 50;
}

function setRenderUpdateRate(value) {
    renderUpdateRate.value = Math.max(10, Math.min(250, Math.round(value)));
    localStorage.setItem(RENDER_UPDATE_RATE_STORAGE_KEY, String(renderUpdateRate.value));
}

function setOfflineProgress(enabled) {
    offlineProgress.value = enabled;
    setOfflineProgressEnabled(enabled);
}

async function exportGameSave() {
    const saveData = await exportSave();
    try {
        await navigator.clipboard.writeText(saveData);
        window.alert("Save copied to clipboard.");
    } catch {
        window.prompt("Copy your save:", saveData);
    }
}

async function importGameSave() {
    const saveData = window.prompt("Paste your save:");
    if (saveData === null || saveData.trim() === "") return;
    try {
        achievementsInitialized = false;
        await importSave(saveData.trim());
        crystalStateRevision.value++;
        await saveGame();
        window.alert("Save imported successfully.");
    } catch (error) {
        console.error("Failed to import The Mana Paradox save", error);
        window.alert(error instanceof Error ? error.message : "Invalid save data.");
    }
}

function buyTierOne(index) {
    if (castMax.value) namedWasm.buyMaxTierOne(index);
    else namedWasm.buyTierOne(index);
}

function empowerTierOne(index) {
    namedWasm.empowerTierOne(index);
}

function buyAllTierOne() {
    castAll();
}

function toggleCastMode() {
    castMax.value = !castMax.value;
}

function castSpeed() {
    namedWasm.castSpeed();
}

function sealMeridians() {
    sealMeridiansAction();
}

function sealedMeridianResetNoGain() {
    sealedMeridianResetNoGainAction();
}

function increaseMatrix() {
    increaseMatrixAction();
}

function activateCourage() {
    namedWasm.activateCourage();
}

function handleCondensed() {
    castMax.value = false;
}

function enterCrystal(index) {
    if (!enterCrystalAction(index)) return;
    castMax.value = false;
    selectTab("mana");
}

function handlePrimaryResetAction() {
    if (activeCrystal.value < 0) {
        condense();
        return;
    }
    if (shatterCrystalAction()) crystalStateRevision.value++;
}

function escapeCrystal() {
    if (!escapeCrystalAction()) return;
    castMax.value = false;
    selectTab("mana");
}

function buyCondensedUpgrade(index) {
    if (!namedWasm.buyCondensedUpgrade(index)) return;
    namedWasm.applyCondensedSealedMeridiansMinimum();
    namedWasm.refreshSealedMeridiansDerivedState();
    namedWasm.refreshMatrixDerivedState();
    namedWasm.refreshSealedMeridiansDerivedState();
    namedWasm.refreshTierOneDerivedState();
    if (index === 11) namedWasm.resetCastSpeed();
}

function buyMemorial() {
    namedWasm.buyMemorial();
}

function buyRemembranceUpgrade(index) {
    const upgrade = remembrance.value.upgrades[index];
    if (upgrade) namedWasm.buyRemembranceUpgrade(index, upgrade.cost);
}

function toggleRemembranceRespec() {
    namedWasm.setRespecRemembranceOnCondense(!namedWasm.isRespecRemembranceOnCondense());
}

function exportRemembrance() {
    const value = remembrance.value.upgrades.filter((upgrade) => upgrade.purchased).map((upgrade) => upgrade.index + 1).join(",");
    navigator.clipboard?.writeText(value);
}

function importRemembrance() {
    const value = window.prompt("Paste a Remembrance tree export");
    if (value === null) return;
    for (const token of value.split(",")) {
        const index = Number.parseInt(token.trim(), 10) - 1;
        if (Number.isInteger(index) && index >= 0) buyRemembranceUpgrade(index);
    }
}

function focus() {
    if (!focusAction()) return;
    castMax.value = false;
}

function expandManaCircle() {
    if (!namedWasm.expandManaCircle()) return;
    manaCircle.value = namedWasm.getMagnitude(HANDLES.mana_circle_tier);
    selectTab("mana");
    pingTab("mana");
    pingTab("condensed");
    manaCircleExpansionVisible.value = true;
    void saveGame();
}

function purifyMeridians() {
    namedWasm.purifyMeridians();
}

function applyToGuild() {
    if (namedWasm.applyToGuild()) void saveGame();
}

function acceptGuildQuest(index) {
    if (!namedWasm.acceptGuildQuest(index)) return;
    selectTab("quest");
    void saveGame();
}

function castCombatSpell(index) {
    if (namedWasm.castCombatSpell(index)) void saveGame();
}

function abandonGuildQuest() {
    namedWasm.abandonGuildQuest();
    void saveGame();
}

function moveInventoryItem(item, position) {
    if (namedWasm.moveInventoryItem(item, position)) void saveGame();
}

function useInventoryItem(action, position, itemId) {
    if (action === "drink-speed-potion") namedWasm.drinkPotion(position, itemId);
}

function sellInventoryItem(position, itemId) {
    namedWasm.sellInventoryItem(position, itemId);
}

function sellAllMaterials() {
    namedWasm.sellAllInventoryItems(false);
}

function sellSpareEquipment() {
    namedWasm.sellSpareEquipment();
}

function sellAllItems() {
    namedWasm.sellAllInventoryItems(true);
}

function drinkAllPotions() {
    namedWasm.drinkAllPotions();
}

function buyShopItem(slot) {
    namedWasm.buyShopItem(slot);
}

function buyGuildShopUpgrade(index) {
    if (namedWasm.buyGuildShopUpgrade(index)) void saveGame();
}

function hireAutocaster(tier) {
    const nameIndex = Math.floor(Math.random() * AUTOCASTER_NAMES.length);
    if (namedWasm.hireAutocaster(tier, nameIndex) >= 0) void saveGame();
}

function assignAutocaster(caster, task) {
    if (namedWasm.assignAutocaster(caster, task)) void saveGame();
}

function moveAutocaster(caster, position) {
    if (namedWasm.moveAutocaster(caster, position)) void saveGame();
}

function setAutocasterCastsMax(task, value) {
    namedWasm.setProducerAutocasterCastsMax(task, value);
    void saveGame();
}

function writeAutocasterDecimal(handle, text, minimum) {
    if (String(text).trim().toLowerCase() === "infinity") {
        namedWasm.writeDecimal(handle, 1, 0, Infinity);
        void saveGame();
        return true;
    }
    const match = String(text).trim().match(/^(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?$/i);
    if (!match) return false;
    const mantissa = Number(match[1]);
    const exponent = Number(match[2] ?? 0);
    if (!Number.isFinite(mantissa) || mantissa < 0 || (mantissa === 0 && minimum > 0) || !Number.isFinite(exponent)) return false;
    const decimalExponent = Math.log10(mantissa) + exponent;
    if (decimalExponent > 308) namedWasm.writeDecimal(handle, 1, 1, decimalExponent);
    else namedWasm.writeNumber(handle, Math.max(minimum, mantissa * 10 ** exponent));
    void saveGame();
    return true;
}

function setAutocasterPurifyMinimum(value) {
    return writeAutocasterDecimal(AUTOCASTER_HANDLES.purifyMinimum, value, 1.01);
}

function setAutocasterCondenseGain(value) {
    return writeAutocasterDecimal(AUTOCASTER_HANDLES.condenseGain, value, 1);
}

function setAutocasterMaximum(task, value) {
    const handle = task === 7 ? AUTOCASTER_HANDLES.sealedMeridiansMaximum : AUTOCASTER_HANDLES.crystalMatricesMaximum;
    return writeAutocasterDecimal(handle, value, 0);
}

function toggleAutocasters() {
    namedWasm.setAutocastersEnabled(!namedWasm.isAutocastersEnabled());
    updateAutocastersDisplay();
}

function sellAutocaster(caster) {
    if (namedWasm.sellAutocaster(caster)) void saveGame();
}

function formatShortTimer(seconds) {
    const remaining = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}

function resetGame() {
    resetConfirmationVisible.value = true;
}

function editKeybinds() {
    changeKeybindsVisible.value = true;
}

function cancelResetGame() {
    resetConfirmationVisible.value = false;
}

function confirmResetGame() {
    resetGameData();
    crystalStateRevision.value++;
    achievementsInitialized = false;
    castMax.value = false;
    resetConfirmationVisible.value = false;
}

function recordClick() {
    namedWasm.recordClick();
}

function enterAbyss() {
    if (enteredAbyss.value || namedWasm.isAbyssRunActive() || namedWasm.isFocusing()) return;
    abyssEntryTransition.value = "zoom";
    namedWasm.setInAbyss(true);
    enteredAbyss.value = namedWasm.isInAbyss();
    void saveGame();
}

async function leaveAbyss() {
    namedWasm.setInAbyss(false);
    enteredAbyss.value = namedWasm.isInAbyss();
    void saveGame();
    await nextTick();
    const onAbyssTab = activeTab.value === "abyss";
    document.body.classList.toggle("abyss-active", onAbyssTab);
    setAbyssActive(onAbyssTab);
    setAbyssVortexActive(onAbyssTab && activeSubtab.value === "depths");
}

function beginAbyssRun() {
    if (!beginAbyssRunAction()) return;
    enteredAbyss.value = false;
    selectTab("mana");
    document.body.classList.add("abyss-active");
    setAbyssActive(true);
    setAbyssVortexActive(false);
}

function escapeAbyssRun() {
    if (!escapeAbyssRunAction()) return;
    abyssEntryTransition.value = "fade";
    enteredAbyss.value = true;
}

const baseGameFrame = computed(() => ({
    mana: mana.value,
    sonicValue: sonicValue.value,
    abyssRunActive: abyssRunActive.value,
    activeCrystal: activeCrystal.value,
    canCondense: canCondense.value,
    manaCircle: manaCircle.value,
    crystalCanShatter: crystalCanShatter.value,
    crystalGoalReached: crystalGoalReached.value,
    memories: memories.value,
    condenseManaGained: condenseManaGained.value,
    condensedUnlocked: condensedUnlocked.value,
    condensedMana: condensedMana.value,
    visibleTabs: visibleTabs.value,
    activeTab: activeTab.value,
    activeSubtab: activeSubtab.value,
    pingedTabs: pingedTabs.value,
    pingedSubtabs: pingedSubtabs.value,
    tierOneUpgrades: tierOneUpgrades.value,
    castSpeedSpell: castSpeedSpell.value,
    castMax: castMax.value,
    sealedMeridians: sealedMeridians.value,
    matrix: matrix.value,
    courage: courage.value,
    meridianPurification: meridianPurification.value,
    potionEffects: potionEffects.value,
    gameSpeed: gameSpeed.value,
    gameSpeedIncreased: gameSpeedIncreased.value,
    manaPerSecond: manaPerSecond.value,
    oomPerSecond: oomPerSecond.value,
    showOoMPerSecond: showOoMPerSecond.value,
    expCostIncreasesAt: expCostIncreasesAt.value,
    statistics: statistics.value,
    condensedUpgrades: condensedUpgrades.value,
    condensedUpgradePlaceholders: condensedUpgradePlaceholders.value,
    remembrance: remembrance.value,
    crystalStateRevision: crystalStateRevision.value,
    guild: guild.value,
    guildQuests: guildQuests.value,
    questResult: questResult.value,
    equipmentUnlocked: equipmentUnlocked.value,
    cantRankUp: cantRankUp.value,
    combat: combat.value,
    autocasters: autocasters.value,
    achievements: achievements.value,
    updateRate: updateRate.value,
    renderUpdateRate: renderUpdateRate.value,
    offlineProgress: offlineProgress.value,
    starsVisible: starsVisible.value,
    starsAnimated: starsAnimated.value,
    newsTickerEnabled: newsTickerEnabled.value,
    messageTickerParticles: messageTickerParticles.value,
}));

const baseGameFrameActions = {
    handlePrimaryResetAction,
    enterAbyss,
    escapeCrystal,
    escapeAbyssRun,
    selectTab,
    selectSubtab,
    buyTierOne,
    empowerTierOne,
    buyAllTierOne,
    toggleCastMode,
    castSpeed,
    sealMeridians,
    increaseMatrix,
    activateCourage,
    purifyMeridians,
    sealedMeridianResetNoGain,
    buyCondensedUpgrade,
    focus,
    buyMemorial,
    buyRemembranceUpgrade,
    toggleRemembranceRespec,
    exportRemembrance,
    importRemembrance,
    openManaCircleInfo: () => openInfo("mana-circle"),
    enterCrystal,
    applyToGuild,
    acceptGuildQuest,
    dismissQuestResult: namedWasm.dismissQuestResult,
    moveInventoryItem,
    equipInventoryItem,
    unequipInventoryItem,
    useInventoryItem,
    sellInventoryItem,
    sellAllMaterials,
    sellSpareEquipment,
    sellAllItems,
    drinkAllPotions,
    buyShopItem,
    buyGuildShopUpgrade,
    expandManaCircle,
    castCombatSpell,
    abandonGuildQuest,
    hireAutocaster,
    assignAutocaster,
    moveAutocaster,
    sellAutocaster,
    setAutocasterCastsMax,
    setAutocasterPurifyMinimum,
    setAutocasterCondenseGain,
    setAutocasterMaximum,
    toggleAutocasters,
    editKeybinds,
    setStarsVisible,
    setStarsAnimated,
    setNewsTickerEnabled,
    setMessageTickerParticles,
    exportGameSave,
    importGameSave,
    resetGame,
    updateTickRate,
    setRenderUpdateRate,
    setOfflineProgress,
};

onMounted(() => {
    document.addEventListener("click", recordClick);
    unsubscribeFromCondense = subscribeToCondense(handleCondensed);
    unsubscribeFromMemoryGain = subscribeToMemoryGain((total, milestoneReached, gained) => {
        showNotification(`You gained ${gained == 1 ? "a" : gained} memor${gained == 1 ? "y" : "ies"}! (${total.toLocaleString()})`);
        if (milestoneReached) showNotification("You reached a memory milestone!");
    });
    unsubscribeFromTimeSimulation = subscribeToTimeSimulation((state) => {
        timeSimulation.value = state;
    });
    animationFrame = requestAnimationFrame(updateDisplay);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", recordClick);
    unsubscribeFromCondense?.();
    unsubscribeFromMemoryGain?.();
    unsubscribeFromTimeSimulation?.();
    cancelAnimationFrame(animationFrame);
});
</script>

<template>
    <div class="game-shell">
        <output v-if="showFpsCounter" class="fps-counter" aria-label="Frames per second">{{ displayedFps }} FPS</output>
        <div
            v-if="activeCrystal >= 0"
            class="active-crystal-screen"
            :style="{ '--active-crystal-color': CRYSTALS[activeCrystal].color }"
            aria-hidden="true"
        >
            <span class="crystal-screen-facet facet-a" />
            <span class="crystal-screen-facet facet-b" />
            <span class="crystal-screen-facet facet-c" />
        </div>
        <a
            class="discord-link"
            href="https://discord.gg/KXmEYc6gxm"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join The Mana Paradox Discord"
            title="Join The Mana Paradox Discord"
        ><img :src="'./assets/images/discord.png'" alt=""></a>
        <button
            class="info-launcher"
            type="button"
            aria-label="Open how to play"
            title="How to Play"
            @click="openInfo()"
        >?</button>
        <NotificationStack />
        <ManaCircleExpansion
            v-if="manaCircleExpansionVisible"
            @complete="manaCircleExpansionVisible = false"
        />
        <TimeSimulation
            :simulation="timeSimulation"
            @speed-up="speedUpTimeSimulation"
            @skip="skipTimeSimulation"
        />

        <BaseGameFrame
            v-if="!enteredAbyss"
            key="base-game-frame"
            :frame="baseGameFrame"
            :actions="baseGameFrameActions"
        />
        <AbyssFrame
            v-else
            key="abyss-frame"
            :entry-transition="abyssEntryTransition"
            @leave-abyss="leaveAbyss"
            @begin-run="beginAbyssRun"
        />

        <div v-if="resetConfirmationVisible" class="confirmation-overlay" role="presentation" @click.self="cancelResetGame">
            <section class="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-game-title">
                <h2 id="reset-game-title">Are you sure?</h2>
                <p>This will permanently reset your game.</p>
                <div class="confirmation-actions">
                    <button type="button" class="confirm-reset" @click="confirmResetGame">Yes</button>
                    <button type="button" @click="cancelResetGame">No</button>
                </div>
            </section>
        </div>
        <KeybindMenu v-if="changeKeybindsVisible" @close="changeKeybindsVisible = false" />
        <InfoTab v-if="infoTabVisible" :initial-topic-id="infoTopicId" @close="infoTabVisible = false" />
        <MessageTicker
            v-if="newsTickerEnabled && !enteredAbyss"
            :key="messageTickerParticles ? 'particles' : 'text'"
            :particles="messageTickerParticles"
            @message-displayed="updateMessageTickerStatistics"
        />
        <footer>The Mana Paradox v0.0.15</footer>
        <GoalProgressBar :goal="nextGoal" :progress="nextGoalProgress" />
    </div>
</template>

<style>
.fps-counter {
    position: fixed;
    z-index: 2000;
    top: 5px;
    right: 6px;
    padding: 3px 6px;
    border: 1px solid #51425f;
    color: #d8c4ed;
    background: rgb(9 9 15 / 82%);
    font: 11px/1.2 monospace;
    pointer-events: none;
}
body {
    overflow-x: hidden;
}

.info-launcher {
    position: fixed;
    z-index: 40;
    top: 50%;
    left: 0;
    display: grid;
    width: 24px;
    height: 72px;
    padding: 0;
    place-items: center;
    border: 1px solid #4d4d5d;
    border-left: 0;
    border-radius: 0 5px 5px 0;
    color: #d8c6ee;
    background: #15151dee;
    cursor: pointer;
    font-size: 18px;
    font-weight: 700;
    transform: translateY(-50%);
}

.info-launcher:hover,
.info-launcher:focus-visible {
    border-color: #9a72cf;
    color: #fff;
    background: #292035;
}
</style>
