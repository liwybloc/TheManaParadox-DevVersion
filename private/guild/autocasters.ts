import { addUS, createDecimal, gte, lt, subUS, toNumber, writeNumber } from "../core/break_eternity.js";
import { canCondense, refreshCondenseGain } from "../game/condensed.js";
import { activateCourage } from "../game/courage.js";
import { castSpeed, increaseMatrix, sealMeridians } from "../game/progression.js";
import { buyMaxTierOne, buyTierOne, canPurifyMeridiansAtRelativeMultiplierHandle, empowerTierOne, purifyMeridians, refreshCrystalProducerCosts } from "../game/tier_one.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { checkCoinAchievements, hasTierOneAchievement, unlockTierOneAchievement } from "../game/achievements.js";

declare const player: Player;
declare const scratch: Scratch;

export const AUTOCASTER_HANDLES = {
    purifyMinimum: createDecimal(1, 0, 1.01),
    condenseGain: createDecimal(1, 0, 1),
    sealedMeridiansMaximum: createDecimal(1, 0, Infinity),
    crystalMatricesMaximum: createDecimal(1, 0, Infinity),
};

/** [WASM] */

const MAX_AUTOCASTERS: i32 = 64;
const ROSTER_CAPACITY: i32 = 9;
const AUTOCASTER_TASK_COUNT: i32 = 11;
const WAGE_PERIOD_SECONDS: f64 = 600;
const UNASSIGNED: i32 = -1;

const tiers = new StaticArray<i32>(MAX_AUTOCASTERS);
const nameIndices = new StaticArray<i32>(MAX_AUTOCASTERS);
const assignments = new StaticArray<i32>(MAX_AUTOCASTERS);
const assignedCasterCounts = new StaticArray<i32>(AUTOCASTER_TASK_COUNT);
const rosterPositions = new StaticArray<i32>(MAX_AUTOCASTERS);
const actionCooldowns = new StaticArray<f64>(MAX_AUTOCASTERS);
const wageTimers = new StaticArray<f64>(MAX_AUTOCASTERS);
const workedThisPeriod = new StaticArray<u8>(MAX_AUTOCASTERS);
let autoCondenseRequested: bool = false;
let autocastersEnabled: bool = true;
const producerCastOne = new StaticArray<u8>(5);
let purifyMinimumHandle: i32 = 0;
let autoCondenseGainHandle: i32 = 0;
let sealedMeridiansMaximumHandle: i32 = 0;
let crystalMatricesMaximumHandle: i32 = 0;

export function initializeAutocasterSettingHandles(
    purifyMinimum: i32,
    condenseGain: i32,
    sealedMeridiansMaximum: i32,
    crystalMatricesMaximum: i32,
): void {
    purifyMinimumHandle = purifyMinimum;
    autoCondenseGainHandle = condenseGain;
    sealedMeridiansMaximumHandle = sealedMeridiansMaximum;
    crystalMatricesMaximumHandle = crystalMatricesMaximum;
}

export function isAutocasterHired(index: i32): bool {
    return isValidCaster(index) && tiers[index] !== 0;
}

export function autocasterTier(index: i32): i32 {
    return isAutocasterHired(index) ? tiers[index] : 0;
}

export function autocasterNameIndex(index: i32): i32 {
    return isAutocasterHired(index) ? nameIndices[index] : UNASSIGNED;
}

export function autocasterAssignment(index: i32): i32 {
    return isAutocasterHired(index) ? assignments[index] : UNASSIGNED;
}

export function autocasterRosterPosition(index: i32): i32 {
    return isAutocasterHired(index) ? rosterPositions[index] : UNASSIGNED;
}

export function autocasterActionCooldown(index: i32): f64 {
    return isValidCaster(index) ? actionCooldowns[index] : 0;
}

export function autocasterWageTimer(index: i32): f64 {
    return isValidCaster(index) ? wageTimers[index] : 0;
}

export function autocasterWorkedThisPeriod(index: i32): bool {
    return isValidCaster(index) && workedThisPeriod[index] !== 0;
}

export function producerAutocasterCastsMax(index: i32): bool {
    return index >= 0 && index < 5 && producerCastOne[index] === 0;
}

export function setProducerAutocasterCastsMax(index: i32, value: bool): void {
    if (index >= 0 && index < 5) producerCastOne[index] = value ? 0 : 1;
}

export function autocasterPurifyMinimumRelativeMultiplier(): f64 {
    return toNumber(purifyMinimumHandle);
}

export function setAutocasterPurifyMinimumRelativeMultiplier(value: f64): void {
    writeNumber(purifyMinimumHandle, Math.max(1.01, value));
}

export function autocasterCondenseGain(): f64 {
    return toNumber(autoCondenseGainHandle);
}

export function setAutocasterCondenseGain(value: f64): void {
    writeNumber(autoCondenseGainHandle, Math.max(1, value));
}

function canAutoCondense(): bool {
    if (!canCondense()) return false;
    if (toNumber(player.mana_circle_tier) <= 0) return true;
    refreshCondenseGain();
    return gte(scratch.condenseGain, autoCondenseGainHandle);
}

export function autocasterHireCost(tier: i32): i32 {
    switch (tier) {
        case 1: return 2;
        case 2: return 5;
        case 3: return 10;
        default: return 0;
    }
}

export function autocasterWageForTier(tier: i32): i32 {
    switch (tier) {
        case 1: return 1;
        case 2: return 2;
        case 3: return 4;
        default: return 0;
    }
}

export function canHireAutocaster(tier: i32): bool {
    return tier >= 1 && tier <= 3
        && firstAvailableCaster() >= 0
        && firstAvailableRosterPosition() >= 0
        && gte(player.coins, autocasterHireCost(tier));
}

export function hireAutocaster(tier: i32, nameIndex: i32): i32 {
    if (!canHireAutocaster(tier) || nameIndex < 0) return UNASSIGNED;
    const index = firstAvailableCaster();
    const position = firstAvailableRosterPosition();
    if (index < 0 || position < 0) return UNASSIGNED;
    subUS(player.coins, autocasterHireCost(tier));
    tiers[index] = tier;
    nameIndices[index] = nameIndex;
    assignments[index] = UNASSIGNED;
    refreshAssignedCasterCounts();
    rosterPositions[index] = position;
    actionCooldowns[index] = 0;
    wageTimers[index] = 0;
    workedThisPeriod[index] = 0;
    unlockTierOneAchievement(35);
    if (tier >= 3) unlockTierOneAchievement(37);
    return index;
}

export function assignAutocaster(caster: i32, task: i32): bool {
    if (!isAutocasterHired(caster)) return false;
    if (task === UNASSIGNED) {
        const position = firstAvailableRosterPosition();
        if (position < 0) return false;
        assignments[caster] = UNASSIGNED;
        refreshAssignedCasterCounts();
        rosterPositions[caster] = position;
        actionCooldowns[caster] = 0;
        return true;
    }
    if (!isValidTask(task) || tiers[caster] < minimumTierForTask(task)) return false;
    assignments[caster] = task;
    refreshAssignedCasterCounts();
    rosterPositions[caster] = UNASSIGNED;
    actionCooldowns[caster] = 0;
    return true;
}

export function moveAutocaster(caster: i32, position: i32): bool {
    if (!isAutocasterHired(caster) || assignments[caster] !== UNASSIGNED || position < 0 || position >= ROSTER_CAPACITY) return false;
    const occupant = casterAtRosterPosition(position);
    if (occupant >= 0 && occupant !== caster) return false;
    rosterPositions[caster] = position;
    return true;
}

export function sellAutocaster(caster: i32): bool {
    if (!isAutocasterHired(caster)) return false;
    const tier = tiers[caster];
    addUS(player.coins, tier === 1 ? 1 : tier === 2 ? 2 : 5);
    checkCoinAchievements();
    dismissAutocaster(caster);
    return true;
}

export function casterAssignedToTask(task: i32): i32 {
    if (!isValidTask(task)) return UNASSIGNED;
    for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
        if (isAutocasterHired(caster) && assignments[caster] === task) return caster;
    }
    return UNASSIGNED;
}

export function updateAutocasters(deltaSeconds: f64, chargeWages: bool): void {
    if (!autocastersEnabled || deltaSeconds <= 0) return;
    if (chargeWages) {
        for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
            if (!isAutocasterHired(caster)) continue;
            updateWage(caster, deltaSeconds);
        }
    }
    for (let task: i32 = 0; task < AUTOCASTER_TASK_COUNT; task++) {
        const caster = casterAssignedToTask(task);
        if (caster >= 0) updateAction(caster, task, deltaSeconds, chargeWages);
    }
}

export function isAutocastersEnabled(): bool {
    return autocastersEnabled;
}

export function setAutocastersEnabled(enabled: bool): void {
    autocastersEnabled = enabled;
}

export function consumeAutoCondenseRequest(): bool {
    if (!autoCondenseRequested) return false;
    autoCondenseRequested = false;
    return true;
}

export function setAutocasterTier(index: i32, value: i32): void {
    if (!isValidCaster(index)) return;
    tiers[index] = value >= 1 && value <= 3 ? value : 0;
    if (tiers[index] === 0) clearCaster(index);
    else refreshAssignedCasterCounts();
}
export function setAutocasterNameIndex(index: i32, value: i32): void { if (isValidCaster(index)) nameIndices[index] = value; }
export function setAutocasterAssignment(index: i32, value: i32): void {
    if (!isValidCaster(index)) return;
    assignments[index] = value;
    refreshAssignedCasterCounts();
}
export function setAutocasterRosterPosition(index: i32, value: i32): void { if (isValidCaster(index)) rosterPositions[index] = value; }
export function setAutocasterActionCooldown(index: i32, value: f64): void { if (isValidCaster(index)) actionCooldowns[index] = Math.max(0, value); }
export function setAutocasterWageTimer(index: i32, value: f64): void { if (isValidCaster(index)) wageTimers[index] = Math.max(0, value); }
export function setAutocasterWorkedThisPeriod(index: i32, value: bool): void { if (isValidCaster(index)) workedThisPeriod[index] = value ? 1 : 0; }

function updateWage(caster: i32, deltaSeconds: f64): void {
    if (wageTimers[caster] <= 0) return;
    wageTimers[caster] -= deltaSeconds;
    if (wageTimers[caster] > 0) return;
    wageTimers[caster] = 0;
    if (workedThisPeriod[caster] === 0) return;
    workedThisPeriod[caster] = 0;
    const wage = autocasterWageForTier(tiers[caster]);
    if (!gte(player.coins, wage)) {
        dismissAutocaster(caster);
        return;
    }
    subUS(player.coins, wage);
}

function updateAction(caster: i32, task: i32, deltaSeconds: f64, chargeWages: bool): void {
    actionCooldowns[caster] = Math.max(0, actionCooldowns[caster] - deltaSeconds);
    if (actionCooldowns[caster] > 0) return;
    let acted = false;
    if (task < 5) {
        refreshCrystalProducerCosts();
        if (tiers[caster] >= 2 && empowerTierOne(task)) acted = true;
        if (producerAutocasterCastsMax(task) ? buyMaxTierOne(task) : buyTierOne(task)) acted = true;
    } else {
        switch (task) {
            case 5:
                if (!autoCondenseRequested && canAutoCondense()) {
                    autoCondenseRequested = true;
                    acted = true;
                }
                break;
            case 6:
                if (canPurifyMeridiansAtRelativeMultiplierHandle(purifyMinimumHandle)) acted = purifyMeridians();
                break;
            case 7:
                if (lt(player.sealedMeridiansOwned, sealedMeridiansMaximumHandle)) acted = sealMeridians();
                break;
            case 8:
                if (lt(player.matrixOwned, crystalMatricesMaximumHandle)) acted = increaseMatrix();
                break;
            case 9: acted = activateCourage(); break;
            case 10: acted = castSpeed(); break;
        }
    }
    if (!acted) return;
    const tierSpeed: f64 = hasTierThreeCasterAssigned(task) ? 2 : 1;
    const achievementSpeed: f64 = hasTierOneAchievement(37) ? 2 : 1;
    actionCooldowns[caster] = baseCooldownForTask(task)
        / tierSpeed
        / achievementSpeed
        / (2 ** (assignedCasterCount(task) - 1));
    if (chargeWages) recordTaskWork(task);
}

function assignedCasterCount(task: i32): i32 {
    return task >= 0 && task < AUTOCASTER_TASK_COUNT ? assignedCasterCounts[task] : 1;
}

function refreshAssignedCasterCounts(): void {
    for (let task: i32 = 0; task < AUTOCASTER_TASK_COUNT; task++) assignedCasterCounts[task] = 1;
    for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
        if (!isAutocasterHired(caster)) continue;
        const task = assignments[caster];
        if (task >= 0 && task < AUTOCASTER_TASK_COUNT) assignedCasterCounts[task]++;
    }
}

function hasTierThreeCasterAssigned(task: i32): bool {
    for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
        if (isAutocasterHired(caster) && assignments[caster] === task && tiers[caster] >= 3) return true;
    }
    return false;
}

function recordTaskWork(task: i32): void {
    for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
        if (!isAutocasterHired(caster) || assignments[caster] !== task) continue;
        workedThisPeriod[caster] = 1;
        if (wageTimers[caster] <= 0) wageTimers[caster] = WAGE_PERIOD_SECONDS;
    }
}

function dismissAutocaster(caster: i32): void {
    clearCaster(caster);
}

function clearCaster(caster: i32): void {
    tiers[caster] = 0;
    nameIndices[caster] = UNASSIGNED;
    assignments[caster] = UNASSIGNED;
    rosterPositions[caster] = UNASSIGNED;
    actionCooldowns[caster] = 0;
    wageTimers[caster] = 0;
    workedThisPeriod[caster] = 0;
    refreshAssignedCasterCounts();
}

function firstAvailableCaster(): i32 {
    for (let index: i32 = 0; index < MAX_AUTOCASTERS; index++) if (!isAutocasterHired(index)) return index;
    return UNASSIGNED;
}

function casterAtRosterPosition(position: i32): i32 {
    for (let caster: i32 = 0; caster < MAX_AUTOCASTERS; caster++) {
        if (isAutocasterHired(caster) && assignments[caster] === UNASSIGNED && rosterPositions[caster] === position) return caster;
    }
    return UNASSIGNED;
}

function firstAvailableRosterPosition(): i32 {
    for (let position: i32 = 0; position < ROSTER_CAPACITY; position++) if (casterAtRosterPosition(position) < 0) return position;
    return UNASSIGNED;
}

function minimumTierForTask(task: i32): i32 { return task === 5 || task === 6 || task === 9 || task === 10 ? 2 : 1; }

function baseCooldownForTask(task: i32): f64 {
    if (task < 5) return 1;
    switch (task) {
        case 5: return 30;
        case 6: return 3;
        case 7: return 3;
        case 8: return 3;
        case 9: return 5;
        case 10: return 1;
        default: ;
    }
    return 1;
}

function isValidCaster(index: i32): bool { return index >= 0 && index < MAX_AUTOCASTERS; }
function isValidTask(index: i32): bool { return index >= 0 && index < AUTOCASTER_TASK_COUNT; }

/** [/WASM] */

initializeAutocasterSettingHandles(
    AUTOCASTER_HANDLES.purifyMinimum,
    AUTOCASTER_HANDLES.condenseGain,
    AUTOCASTER_HANDLES.sealedMeridiansMaximum,
    AUTOCASTER_HANDLES.crystalMatricesMaximum,
);
refreshAssignedCasterCounts();
