import { addInto, addUS, ceilInto, copyInto, createDecimal, createZero, divInto, divUS, eq, gt, gte, log10Into, lt, lte, mulUS, powInto, powUS, subUS, writeDecimal, writeNumber } from "../core/break_eternity.js";
import "../abyss/handles.js";
import { abyssRunCondensePowerHandle, resonanceTowerEffectHandle } from "../abyss/abyss.js";
import { hasTierOneAchievement, unlockTierOneAchievement } from "./achievements.js";
import { isQuestActive } from "../guild/guild.js";
import { isCrystalActive } from "./crystals.js";
import { hasMemoryMilestone } from "./memories.js";
import { applyRemembranceRespec, remembrance_condensedManaModifiers } from "./remembrance.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";

type CondensedUpgradeDefinition = {
    slot: number;
    title: string;
    cost: [number, number, number];
    circleTwo: {
        title: string;
        cost: [number, number, number];
    };
}

export const REMEMBRANCE_UPGRADE_COUNT = 36;

export const CONDENSED_HANDLES = {
    ascensionHallUnlocked: createZero(),
};

const CONDENSED_UPGRADE_DEFINITIONS: CondensedUpgradeDefinition[] = [
    { slot: 0,  title: "Increase Mana Absorber per-boost multiplier by +0.1×", cost: [1, 0, 1], circleTwo: { title: "Increase per-boost multiplier of all producers by +0.25×", cost: [1, 0, 50] } },
    { slot: 4,  title: "Increase Meditation power by +0.25×", cost: [1, 0, 1], circleTwo: { title: "Increase Meditation power by ×2", cost: [1, 0, 50] } },

    { slot: 5,  title: "Mana Absorbers produce ×2 more", cost: [1, 0, 1], circleTwo: { title: "Mana Absorbers produce ^1.1 more", cost: [1, 0, 100] } },
    { slot: 6,  title: "Pylons produce ×2 more", cost: [1, 0, 2], circleTwo: { title: "Pylons produce ^1.1 more", cost: [1, 0, 200] } },
    { slot: 7,  title: "Meridians produce ×5 more", cost: [1, 0, 3], circleTwo: { title: "Meridians produce ^1.25 more", cost: [1, 0, 1000] } },
    { slot: 8,  title: "Circuits produce ×2 more", cost: [1, 0, 2], circleTwo: { title: "Circuits produce ^1.1 more", cost: [1, 0, 200] } },
    { slot: 9,  title: "Conduits produce ×2 more", cost: [1, 0, 1], circleTwo: { title: "Conduits produce ^1.1 more", cost: [1, 0, 100] } },

    { slot: 10, title: "Start each reset with 1e50 mana", cost: [1, 0, 15], circleTwo: { title: "Start each reset with 1e100 mana", cost: [1, 0, 50] } },
    { slot: 11, title: "Decrease Meditation cost growth to ^1.9", cost: [1, 0, 40], circleTwo: { title: "Decrease Meditation cost growth to ^1.8", cost: [1, 0, 125] } },

    { slot: 13, title: "Decrease Empowerment cost growth to ^1.9", cost: [1, 0, 40], circleTwo: { title: "Decrease Empowerment cost growth to ^1.8", cost: [1, 0, 125] } },
    { slot: 14, title: "Start each reset with 2 Sealed Meridians", cost: [1, 0, 15], circleTwo: { title: "Start each reset with 3 Sealed Meridians and 1 Crystal Matrix", cost: [1, 0, 50] } },

    { slot: 15, title: "First Meditation is free", cost: [1, 0, 10], circleTwo: { title: "First and second Meditations are free", cost: [1, 0, 20] } },
    { slot: 16, title: "Courage duration is increased by 25%", cost: [1, 0, 10], circleTwo: { title: "Courage duration is increased by 50%", cost: [1, 0, 20] } },
    { slot: 17, title: "Mana is increased based on condensed mana\n(Currently: {condensedManaBuff})", cost: [1, 0, 10], circleTwo: { title: "Production is increased based on condensed mana\n(Currently: {condensedManaBuff})", cost: [1, 0, 20] } },
    { slot: 18, title: "Courage is unlocked 1e20 earlier", cost: [1, 0, 10], circleTwo: { title: "Courage is always unlocked", cost: [1, 0, 20] } },
    { slot: 19, title: "Sealed Meridian magnitude is increased based on Crystal Matrix effect", cost: [1, 0, 10], circleTwo: { title: "Sealed Meridian magnitude is increased by twice the Crystal Matrix effect", cost: [1, 0, 20] } },

    { slot: 21, title: "Empowerments are ×5 stronger", cost: [1, 0, 100], circleTwo: { title: "Empowerments are ×25 stronger", cost: [1, 0, 2500] } },
    { slot: 22, title: "Meditation power is slightly increased based on Sealed Meridians\n(Currently: {sealedMeridiansCastPowerBuff})", cost: [1, 0, 200], circleTwo: { title: "Meditation power is increased based on Sealed Meridians\n(Currently: {sealedMeridiansCastPowerBuff2})", cost: [1, 0, 4000] } },
    { slot: 23, title: "Condensed Mana boosts Courage power\n(Currently: {condensedCourageBuff})", cost: [1, 0, 100], circleTwo: { title: "Condensed Mana boosts courage power greatly\n(Currently: {condensedCourageBuff2})", cost: [1, 0, 2500] } },
    
    {
        slot: 12,
        title: "Unlock the Guild's Ascension Hall",
        cost: [1, 0, 1],
        circleTwo: { title: "Unlock Crystals tab", cost: [1, 0, 1] },
    },
];

export const CONDENSED_UPGRADES = CONDENSED_UPGRADE_DEFINITIONS.map((upgrade) => {
    return {
        ...upgrade,
        costHandle: createDecimal(...upgrade.cost),
        circleTwo: { ...upgrade.circleTwo, costHandle: createDecimal(...upgrade.circleTwo.cost) },
    };
});
export const CONDENSED_UPGRADE_COUNT = CONDENSED_UPGRADES.length;
export const CONDENSED_UPGRADE_PLACEHOLDERS = {
    condensedManaBuff: { handle: createDecimal(1, 0, 1), prefix: "×" },
    sealedMeridiansCastPowerBuff: { handle: createDecimal(1, 0, 1), prefix: "+" },
    sealedMeridiansCastPowerBuff2: { handle: createDecimal(1, 0, 1), prefix: "+" },
    condensedCourageBuff: { handle: createDecimal(1, 0, 1), prefix: "×" },
    condensedCourageBuff2: { handle: createDecimal(1, 0, 1), prefix: "×" },
};

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const CONDENSED_UPGRADE_COUNT_WASM: i32 = 20;
const condensedUpgrades = new StaticArray<u8>(CONDENSED_UPGRADE_COUNT_WASM);
const circleTwoCondensedUpgrades = new StaticArray<u8>(CONDENSED_UPGRADE_COUNT_WASM);
const condensedUpgradeCosts = new StaticArray<i32>(CONDENSED_UPGRADE_COUNT_WASM);
const circleTwoCondensedUpgradeCosts = new StaticArray<i32>(CONDENSED_UPGRADE_COUNT_WASM);
let ascensionHallUnlocked: i32 = 0;
let condensedManaBuff: i32 = 0;
let sealedMeridiansCastPowerBuff: i32 = 0;
let sealedMeridiansCastPowerBuff2: i32 = 0;
let condensedCourageBuff: i32 = 0;
let condensedCourageBuff2: i32 = 0;

export function initializeCondensedHandles(
    ascensionHall: i32,
    manaBuff: i32,
    castPowerBuff: i32,
    castPowerBuff2: i32,
    courageBuff: i32,
    courageBuff2: i32,
): void {
    ascensionHallUnlocked = ascensionHall;
    condensedManaBuff = manaBuff;
    sealedMeridiansCastPowerBuff = castPowerBuff;
    sealedMeridiansCastPowerBuff2 = castPowerBuff2;
    condensedCourageBuff = courageBuff;
    condensedCourageBuff2 = courageBuff2;
}

export function initializeCondensedUpgradeCost(index: i32, costHandle: i32): void {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return;
    condensedUpgradeCosts[index] = costHandle;
}

export function initializeCircleTwoCondensedUpgradeCost(index: i32, costHandle: i32): void {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return;
    circleTwoCondensedUpgradeCosts[index] = costHandle;
}

export function canCondense(): bool {
    if (isQuestActive() || isCrystalActive()) return false;
    writeDecimal(scratch.productionModifier, 1, 1, 308.25471555991675);
    return gte(player.mana, scratch.productionModifier);
}

export function refreshCondenseGain(): void {
    if (eq(player.mana_circle_tier, 0)) {
        writeNumber(scratch.condenseGain, 1);
    } else {
        log10Into(scratch.condenseGain, player.mana);
        divUS(scratch.condenseGain, 44);
        subUS(scratch.condenseGain, 6);
    }
    if (hasTierOneAchievement(18)) mulUS(scratch.condenseGain, 2);
    if (hasTierOneAchievement(40)) mulUS(scratch.condenseGain, 2);
    if (hasMemoryMilestone(1)) mulUS(scratch.condenseGain, 2);
    remembrance_condensedManaModifiers(scratch.condenseGain);
    mulUS(scratch.condenseGain, resonanceTowerEffectHandle(5, 0.01));
    powUS(scratch.condenseGain, abyssRunCondensePowerHandle());
}

export function calculateCondenseGain(): bool {
    if (!canCondense()) return false;
    if (!player.castSpeedUsedThisCondense) unlockTierOneAchievement(21);
    if (!player.potionUsedThisCondense) unlockTierOneAchievement(30);
    if (!player.boostedProducerThisCondense) unlockTierOneAchievement(33);
    if (!gt(player.statistics_fastestCondense, 0)
        || gt(player.statistics_fastestCondense, player.statistics_timeThisCondense)) {
        copyInto(player.statistics_fastestCondense, player.statistics_timeThisCondense);
    }
    if (lt(player.statistics_timeThisCondense, 60)) unlockTierOneAchievement(15);
    writeNumber(scratch.productionModifier, 1);
    if (lte(player.purifiedMeridiansMultiplier, scratch.productionModifier)) unlockTierOneAchievement(17);
    refreshCondenseGain();
    addUS(player.statistics_condensedManaProduced, scratch.condenseGain);
    return true;
}

export function completeCondense(): void {
    applyRemembranceRespec();
    addUS(player.condensedMana, scratch.condenseGain);
    addUS(player.statistics_condenses, 1);
    if (gte(player.condensedMana, 10)) unlockTierOneAchievement(22);
    if (gte(player.statistics_condenses, 50)) unlockTierOneAchievement(18);
    player.hasCondensed = true;
}

export function hasCondensed(): bool {
    return player.hasCondensed;
}

export function setHasCondensed(value: bool): void {
    player.hasCondensed = value;
}

export function hasCondensedUpgrade(index: i32): bool {
    if (index === CONDENSED_UPGRADE_COUNT_WASM - 1) return gt(ascensionHallUnlocked, 0);
    return index >= 0 && index < CONDENSED_UPGRADE_COUNT_WASM && condensedUpgrades[index] !== 0;
}

export function setCondensedUpgrade(index: i32, purchased: bool): void {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return;
    if (index === CONDENSED_UPGRADE_COUNT_WASM - 1) {
        writeNumber(ascensionHallUnlocked, purchased ? 1 : 0);
        return;
    }
    condensedUpgrades[index] = purchased ? 1 : 0;
}

export function hasCircleTwoCondensedUpgrade(index: i32): bool {
    return index >= 0 && index < CONDENSED_UPGRADE_COUNT_WASM && circleTwoCondensedUpgrades[index] !== 0;
}

export function hasCondensedEffect(index: i32): bool {
    return hasCondensedUpgrade(index) && !hasCircleTwoCondensedUpgrade(index);
}

export function hasAscendedCondensedEffect(index: i32): bool {
    return hasCircleTwoCondensedUpgrade(index);
}

export function setCircleTwoCondensedUpgrade(index: i32, purchased: bool): void {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return;
    circleTwoCondensedUpgrades[index] = purchased ? 1 : 0;
    if (purchased && index === CONDENSED_UPGRADE_COUNT_WASM - 1) unlockTierOneAchievement(43);
}

export function isAscensionHallUnlocked(): bool {
    return hasCondensedUpgrade(CONDENSED_UPGRADE_COUNT_WASM - 1);
}

export function enterAscensionHall(): void {
    if (isAscensionHallUnlocked()) unlockTierOneAchievement(40);
}

export function expandManaCircle(): bool {
    if (!isAscensionHallUnlocked() || gt(player.mana_circle_tier, 0)) return false;
    addUS(player.mana_circle_tier, 1);
    unlockTierOneAchievement(24);
    return true;
}

export function canSeeAscensionHallUpgrade(): bool {
    for (let index: i32 = 0; index < CONDENSED_UPGRADE_COUNT_WASM - 1; index++) {
        if (!hasCondensedUpgrade(index)) return false;
    }
    return true;
}

export function canSeeCircleTwoFinalUpgrade(): bool {
    for (let index: i32 = 0; index < CONDENSED_UPGRADE_COUNT_WASM - 1; index++) {
        if (!hasCircleTwoCondensedUpgrade(index)) return false;
    }
    return true;
}

export function condensedUpgradeCostHandle(index: i32): i32 {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return 0;
    return condensedUpgradeCosts[index];
}

export function circleTwoCondensedUpgradeCostHandle(index: i32): i32 {
    if (index < 0 || index >= CONDENSED_UPGRADE_COUNT_WASM) return 0;
    return circleTwoCondensedUpgradeCosts[index];
}

export function canBuyCondensedUpgrade(index: i32): bool {
    if (gt(player.mana_circle_tier, 0)) {
        return (index !== CONDENSED_UPGRADE_COUNT_WASM - 1 || canSeeCircleTwoFinalUpgrade())
            && hasCondensedUpgrade(index)
            && !hasCircleTwoCondensedUpgrade(index)
            && gte(player.condensedMana, circleTwoCondensedUpgradeCostHandle(index));
    }
    return (index !== CONDENSED_UPGRADE_COUNT_WASM - 1 || canSeeAscensionHallUpgrade())
        && !hasCondensedUpgrade(index)
        && gte(player.condensedMana, condensedUpgradeCostHandle(index));
}

export function buyCondensedUpgrade(index: i32): bool {
    if (!canBuyCondensedUpgrade(index)) return false;
    if (gt(player.mana_circle_tier, 0)) {
        subUS(player.condensedMana, circleTwoCondensedUpgradeCostHandle(index));
        setCircleTwoCondensedUpgrade(index, true);
        return true;
    }
    subUS(player.condensedMana, condensedUpgradeCostHandle(index));
    setCondensedUpgrade(index, true);
    checkAllCondensedUpgradesAchievement();
    return true;
}

function checkAllCondensedUpgradesAchievement(): void {
    for (let index: i32 = 0; index < CONDENSED_UPGRADE_COUNT_WASM - 1; index++) {
        if (!hasCondensedUpgrade(index)) return;
    }
    unlockTierOneAchievement(23);
}

export function refreshCondensedUpgradeState(): void {
    addInto(condensedManaBuff, player.condensedMana, 1);
    divInto(sealedMeridiansCastPowerBuff, player.sealedMeridians, 10);
    copyInto(sealedMeridiansCastPowerBuff2, sealedMeridiansCastPowerBuff);
    mulUS(sealedMeridiansCastPowerBuff2, 3);
    addInto(condensedCourageBuff, player.condensedMana, 1);
    log10Into(condensedCourageBuff, condensedCourageBuff);
    addUS(condensedCourageBuff, 1);
    copyInto(condensedCourageBuff2, condensedCourageBuff);
    mulUS(condensedCourageBuff2, 5);
}

/** [/WASM] */

for (let index = 0; index < CONDENSED_UPGRADES.length; index++) {
    initializeCondensedUpgradeCost(index, CONDENSED_UPGRADES[index].costHandle);
    initializeCircleTwoCondensedUpgradeCost(index, CONDENSED_UPGRADES[index].circleTwo.costHandle);
}
initializeCondensedHandles(
    CONDENSED_HANDLES.ascensionHallUnlocked,
    CONDENSED_UPGRADE_PLACEHOLDERS.condensedManaBuff.handle,
    CONDENSED_UPGRADE_PLACEHOLDERS.sealedMeridiansCastPowerBuff.handle,
    CONDENSED_UPGRADE_PLACEHOLDERS.sealedMeridiansCastPowerBuff2.handle,
    CONDENSED_UPGRADE_PLACEHOLDERS.condensedCourageBuff.handle,
    CONDENSED_UPGRADE_PLACEHOLDERS.condensedCourageBuff2.handle,
);
refreshCondensedUpgradeState();
