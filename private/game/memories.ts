import { addUS, copyInto, divUS, gt, log10Into, mulUS, powInto, subUS, toNumber, writeNumber } from "../core/break_eternity.js";
import { crystalEffectHandle, crystalRewardHandle, hasCompletedCrystal, isCrystalActive, isSpecificCrystalActive } from "./crystals.js";
import { unlockTierOneAchievement } from "./achievements.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import "../abyss/handles.js";
import { resonanceTowerEffectHandle } from "../abyss/abyss.js";

export const MEMORY_MILESTONES = [
    1, 3, 5, 10, 25, 50, 75, 100, 250, 500, 1_000, 2_500, 50_000, 250_000, 1_000_000, 10_000_000,
] as const;

export const MEMORY_MILESTONE_REWARDS: Readonly<Record<number, string>> = {
    1: "Gain ×2 more condensed mana",
    3: "Courage is ×2 stronger",
    5: "Mana is multiplied based on current mana (Currently: ×{memoryManaMult})",
    10: "The game speed decrease in focus is slightly weaker",
    25: "Production is multiplied based on memories (Currently: ×{memoryProdMult})",
    50: "You gain more memories based on memories (Currently: ×{memoryMemMult})",
    75: "Unlock the Guild's library",
    100: "You gain ×10 more mana inside of crystals",
    250: "Increase start of exponential cost scaling of producers based on memories (Currently: +{memoryCostStartAdd})",
    500: "Unlock Remembrance Upgrade Tree",
    1_000: "The Abyss effects scale 5% slower",
    2_500: "Abyssal Resonance towers scale 25% faster",
};

declare const scratch: Scratch;
declare const player: Player;

/** [WASM] */

let totalMemories: i32 = 0;
let focusing: bool = false;

export function getTotalMemories(): i32 {
    return totalMemories;
}

export function setTotalMemories(value: i32): void {
    totalMemories = value < 0 ? 0 : !hasCompletedCrystal(14) && value > 999 ? 999 : value;
    if (totalMemories >= 500) unlockTierOneAchievement(52);
}

export function hasMemoryMilestone(requirement: i32): bool {
    return totalMemories >= requirement;
}

export function isMemoryLimitReached(): bool {
    return totalMemories >= 999 && !hasCompletedCrystal(14);
}

export function isFocusing(): bool {
    return focusing;
}

export function setFocusing(value: bool): void {
    focusing = value;
}

export function baseMemoryChance(): f64 {
    return 1 / (totalMemories + 1);
}

export function memoryChance(condensedManaGained: i32): f64 {
    const baseChance = baseMemoryChance();
    if (!gt(condensedManaGained, 0)) return baseChance;
    copyInto(scratch.currencyGain, condensedManaGained);
    addUS(scratch.currencyGain, 1);
    log10Into(scratch.currencyGain, scratch.currencyGain);
    const condensedManaBonus = Math.max(1, 1 + toNumber(scratch.currencyGain));
    return Math.min(1, baseChance * condensedManaBonus);
}

export function focusGameSpeedMultiplier(): i32 {
    log10Into(scratch.manaExponent, player.mana);
    if (gt(scratch.manaExponent, 1)) {
        subUS(scratch.manaExponent, 1);
        divUS(scratch.manaExponent, 40);
    } else {
        writeNumber(scratch.manaExponent, 0);
    }
    writeNumber(scratch.tierOneProduction, -0.5);
    subUS(scratch.tierOneProduction, scratch.manaExponent);
    powInto(scratch.manaExponent, hasMemoryMilestone(10) ? 95 : 100, scratch.tierOneProduction);
    return scratch.manaExponent;
}

export function memoryManaMultiplierHandle(): i32 {
    if (!hasMemoryMilestone(5) || !gt(player.mana, 10)) {
        writeNumber(scratch.manaExponent, 1);
        return scratch.manaExponent;
    }
    log10Into(scratch.manaExponent, player.mana);
    return scratch.manaExponent;
}

export function memoryProductionMultiplierHandle(): i32 {
    if (!hasMemoryMilestone(25)) {
        writeNumber(scratch.memoryProductionMultiplier, 1);
        return scratch.memoryProductionMultiplier;
    }
    writeNumber(scratch.memoryProductionExponent, totalMemories + 1);
    writeNumber(scratch.memoryCrystalMultiplier, 2);
    mulUS(scratch.memoryCrystalMultiplier, resonanceTowerEffectHandle(4, 0.1));
    powInto(scratch.memoryProductionMultiplier, scratch.memoryCrystalMultiplier, scratch.memoryProductionExponent);
    if (isSpecificCrystalActive(9)) applyCrystal10MemoryReward(crystalEffectHandle(9, 0));
    if (hasCompletedCrystal(9)) applyCrystal10MemoryReward(crystalRewardHandle(9, 0));
    return scratch.memoryProductionMultiplier;
}

function applyCrystal10MemoryReward(base: i32): void {
    writeNumber(scratch.memoryProductionExponent, totalMemories + 1);
    powInto(scratch.memoryCrystalMultiplier, base, scratch.memoryProductionExponent);
    mulUS(scratch.memoryProductionMultiplier, scratch.memoryCrystalMultiplier);
}

export function memoryGainMultiplier(): i32 {
    return hasMemoryMilestone(50) ? 1 + totalMemories / 50 : 1;
}

export function memoryCostStartAdd(): i32 {
    return hasMemoryMilestone(250) ? totalMemories * 25 : 0;
}

export function toggleFocus(): bool {
    if (focusing) {
        focusing = false;
        return true;
    }
    if (!hasCompletedCrystal(2) || isCrystalActive()) return false;
    focusing = true;
    return true;
}

export function resolveFocusedCondense(roll: f64, chance: f64): i32 {
    if (!focusing) return 0;
    let memoriesGained = 0;
    while (chance >= 1) {
        memoriesGained++;
        chance--;
    }
    if (roll < chance) memoriesGained++;
    if (memoriesGained === 0) return 0;
    memoriesGained *= memoryGainMultiplier();
    const previousMemories = totalMemories;
    totalMemories = !hasCompletedCrystal(14) && totalMemories + memoriesGained > 999
        ? 999
        : totalMemories + memoriesGained;
    memoriesGained = totalMemories - previousMemories;
    if (memoriesGained === 0) return 0;
    if (totalMemories >= 500) unlockTierOneAchievement(52);
    return memoriesGained;
}

/** [/WASM] */
