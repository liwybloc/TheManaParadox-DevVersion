import { addInto, addUS, ceilInto, copyInto, divInto, divUS, gt, gte, multiplyInto, mulUS, powInto, powUS, subUS, toNumber, writeDecimal, writeNumber } from "../core/break_eternity.js";
import { checkCastSpeedAchievements, hasTierOneAchievement, unlockTierOneAchievement } from "./achievements.js";
import { hasAscendedCondensedEffect, hasCondensedEffect } from "./condensed.js";
import { getCrystalStartMana, isAllMultipliersDisabledCrystalActive, isManaAbsorberOnlyCrystalActive, isProducerOnlyCrystalActive, isSpecificCrystalActive, refreshCrystalRewardEffects } from "./crystals.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { refreshTierOneDerivedState, resetMeridianPurification, resetTierOneAmounts } from "./tier_one.js";
import { equipmentCrystalMatrixMultiplier } from "../guild/equipment.js";
import "../abyss/handles.js";
import { abyssMeditationPowerHandle, abyssProgressionPowerHandle, resonanceTowerBonusHandle } from "../abyss/abyss.js";

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const CONDENSED_CAST_SPEED_POWER_BONUS: f64 = 0.25;
let meditationCasts: i32 = 0;

export function castSpeed(): bool {
    if (!canCastSpeed()) return false;
    player.castSpeedUsedThisCondense = true;
    const meditationActive = gt(player.castSpeedTimer, 0);
    subUS(player.mana, player.castSpeedCost);
    copyInto(scratch.productionModifier, meditationPowerHandle());
    if (!meditationActive) {
        multiplyInto(player.castSpeedMagnitude, player.sealedMeridiansSpeedEffect, scratch.productionModifier);
    } else {
        mulUS(player.castSpeedMagnitude, scratch.productionModifier);
    }
    meditationCasts++;
    writeNumber(scratch.tierOneSeconds, hasTierOneAchievement(9) ? 20 : 15);
    addUS(player.castSpeedTimer, scratch.tierOneSeconds);
    if (hasAscendedCondensedEffect(11) && !gt(player.castSpeedCost, 0)) {
        if (meditationActive) writeNumber(player.castSpeedCost, 1000);
    } else if (hasCondensedEffect(11) && !gt(player.castSpeedCost, 0)) {
        writeNumber(player.castSpeedCost, 1000);
    } else {
        writeNumber(scratch.productionModifier, hasAscendedCondensedEffect(8) ? 1.8 : hasCondensedEffect(8) ? 1.9 : 2);
        powUS(player.castSpeedCost, scratch.productionModifier);
    }
    checkCastSpeedAchievements();
    return true;
}

export function canCastSpeed(): bool {
    return !isProducerOnlyCrystalActive()
        && !isAllMultipliersDisabledCrystalActive()
        && gte(player.mana, player.castSpeedCost);
}

export function castSpeedMax(): void {
    while (castSpeed()) {}
}

export function sealMeridians(): bool {
    if (!canSealMeridians()) return false;
    player.meridianSealedThisReset = true;
    const speedIsActive = gt(player.castSpeedTimer, 0);
    addUS(player.sealedMeridiansOwned, 1);
    refreshSealedMeridiansDerivedState();
    refreshMatrixDerivedState();
    refreshSealedMeridiansDerivedState();
    if (gte(player.sealedMeridians, 5)) unlockTierOneAchievement(6);
    if (speedIsActive) mulUS(player.castSpeedMagnitude, 2);
    resetTierOne();
    return true;
}

export function sealedMeridianResetNoGain(): bool {
    player.meridianSealedThisReset = true;
    resetTierOne();
    return true;
}

export function canSealMeridians(): bool {
    if (isProducerOnlyCrystalActive()) return false;
    return gte(
        isManaAbsorberOnlyCrystalActive() ? player.count_manaConduit : player.count_manufactureStaff,
        player.sealMeridiansCost,
    );
}

export function areSealedMeridiansVisible(): bool {
    if (isManaAbsorberOnlyCrystalActive()) return gt(player.bought_manaConduit, 0);
    return gt(player.sealedMeridiansOwned, 0) || gt(player.bought_manufactureStaff, 0);
}

export function refreshSealedMeridiansDerivedState(): void {
    addInto(player.sealedMeridians, player.sealedMeridiansOwned, 1);
    writeNumber(scratch.productionModifier, hasTierOneAchievement(20) ? 2.85 : 3);
    powInto(player.sealMeridiansCost, scratch.productionModifier, player.sealedMeridiansOwned);
    ceilInto(player.sealMeridiansCost, player.sealMeridiansCost);
    powInto(player.sealedMeridiansSpeedEffect, sealedMeridianMagnitudeHandle(), player.sealedMeridiansOwned);
    refreshCrystalRewardEffects();
}

export function sealedMeridianMagnitudeHandle(): i32 {
    if (hasAscendedCondensedEffect(15)) {
        crystalMatrixEffectHandle();
        mulUS(scratch.productionModifier, 2);
        addUS(scratch.productionModifier, 2);
        mulUS(scratch.productionModifier, resonanceTowerBonusHandle(2));
        powUS(scratch.productionModifier, abyssProgressionPowerHandle());
        return scratch.productionModifier;
    }
    if (hasCondensedEffect(15)) copyInto(scratch.productionModifier, player.matrixSpeedPower);
    else writeNumber(scratch.productionModifier, 2);
    mulUS(scratch.productionModifier, resonanceTowerBonusHandle(2));
    powUS(scratch.productionModifier, abyssProgressionPowerHandle());
    return scratch.productionModifier;
}

export function increaseMatrix(): bool {
    if (!canIncreaseMatrix()) return false;
    if (!player.meridianSealedThisReset) unlockTierOneAchievement(20);
    addUS(player.matrixOwned, 1);
    refreshMatrixDerivedState();
    resetTierOne();
    resetSealedMeridians();
    player.meridianSealedThisReset = false;
    return true;
}

export function canIncreaseMatrix(): bool {
    return !isSpecificCrystalActive(1)
        && !isProducerOnlyCrystalActive()
        && gte(
            isManaAbsorberOnlyCrystalActive() ? player.count_manaConduit : player.count_manufactureStaff,
            player.matrixCost,
        );
}

export function isMatrixVisible(): bool {
    return areSealedMeridiansVisible() || gt(player.matrixOwned, 0);
}

export function refreshMatrixDerivedState(): void {
    powInto(player.matrixCost, 10, player.matrixOwned);
    mulUS(player.matrixCost, 10);
    multiplyInto(player.matrixSpeedPower, player.matrixOwned, matrixMagnitudeHandle());
    addUS(player.matrixSpeedPower, 2);
    if (hasCondensedEffect(1)) {
        writeNumber(scratch.productionModifier, CONDENSED_CAST_SPEED_POWER_BONUS);
        addUS(player.matrixSpeedPower, scratch.productionModifier);
    }
    if (hasCondensedEffect(17) || hasAscendedCondensedEffect(17)) {
        addInto(scratch.productionModifier, player.sealedMeridians, 0);
        writeNumber(scratch.tierOneSeconds, 10);
        divUS(scratch.productionModifier, scratch.tierOneSeconds);
        if (hasAscendedCondensedEffect(17)) mulUS(scratch.productionModifier, 3);
        addUS(player.matrixSpeedPower, scratch.productionModifier);
    }
    if (hasAscendedCondensedEffect(1)) mulUS(player.matrixSpeedPower, 2);
    refreshCrystalRewardEffects();
}

export function matrixMagnitudeHandle(): i32 {
    writeNumber(scratch.productionModifier, 0);
    addUS(scratch.productionModifier, player.matrixPower);
    if (hasTierOneAchievement(12)) {
        writeNumber(scratch.tierOneSeconds, 0.1);
        addUS(scratch.productionModifier, scratch.tierOneSeconds);
    }
    writeNumber(scratch.tierOneSeconds, equipmentCrystalMatrixMultiplier());
    mulUS(scratch.productionModifier, scratch.tierOneSeconds);
    mulUS(scratch.productionModifier, resonanceTowerBonusHandle(1));
    powUS(scratch.productionModifier, abyssProgressionPowerHandle());
    return scratch.productionModifier;
}

export function crystalMatrixEffectHandle(): i32 {
    matrixMagnitudeHandle();
    mulUS(scratch.productionModifier, player.matrixOwned);
    return scratch.productionModifier;
}

export function matrixOtherEffectHandle(): i32 {
    writeNumber(scratch.productionModifier, 0);
    if (hasCondensedEffect(1)) {
        writeNumber(scratch.tierOneSeconds, CONDENSED_CAST_SPEED_POWER_BONUS);
        addUS(scratch.productionModifier, scratch.tierOneSeconds);
    }
    if (hasCondensedEffect(17) || hasAscendedCondensedEffect(17)) {
        addInto(scratch.tierOneSeconds, player.sealedMeridians, 0);
        divUS(scratch.tierOneSeconds, 10);
        if (hasAscendedCondensedEffect(17)) mulUS(scratch.tierOneSeconds, 3);
        addUS(scratch.productionModifier, scratch.tierOneSeconds);
    }
    return scratch.productionModifier;
}

export function meditationPowerHandle(): i32 {
    copyInto(scratch.tierOneSeconds, player.matrixSpeedPower);
    mulUS(scratch.tierOneSeconds, resonanceTowerBonusHandle(3));
    powUS(scratch.tierOneSeconds, abyssMeditationPowerHandle());
    return scratch.tierOneSeconds;
}

export function refreshMeditationMagnitude(): void {
    if (!gt(player.castSpeedTimer, 0)) return;
    if (meditationCasts <= 0) {
        const duration: f64 = hasTierOneAchievement(9) ? 20 : 15;
        const inferredCasts = <i32>Math.ceil(toNumber(player.castSpeedTimer) / duration);
        meditationCasts = inferredCasts < 1 ? 1 : inferredCasts;
    }
    copyInto(scratch.productionModifier, meditationPowerHandle());
    writeNumber(scratch.tierOneExponent, meditationCasts);
    powInto(scratch.productionModifier, scratch.productionModifier, scratch.tierOneExponent);
    multiplyInto(player.castSpeedMagnitude, player.sealedMeridiansSpeedEffect, scratch.productionModifier);
}

export function getMeditationCasts(): i32 { return meditationCasts; }
export function setMeditationCasts(value: i32): void { meditationCasts = value < 0 ? 0 : value; }

export function resetSealedMeridians(): void {
    writeNumber(player.sealedMeridiansOwned, hasAscendedCondensedEffect(10) ? 2 : hasCondensedEffect(10) ? 1 : 0);
    refreshSealedMeridiansDerivedState();
    refreshMatrixDerivedState();
    refreshSealedMeridiansDerivedState();
}

function resetTierOne(): void {
    resetStartingMana();
    resetTierOneAmounts();
    resetMeridianPurification();
    resetCastSpeed();
}

export function resetCastSpeed(): void {
    meditationCasts = 0;
    writeNumber(player.castSpeedTimer, 0);
    writeNumber(player.castSpeedMagnitude, 1);
    writeNumber(player.castSpeedCost, hasCondensedEffect(11) || hasAscendedCondensedEffect(11) ? 0 : 1000);
}

export function applyCondensedResetStartingValues(): void {
    resetStartingMana();
    writeNumber(player.matrixOwned, hasAscendedCondensedEffect(10) || hasTierOneAchievement(21) ? 1 : 0);
    applyCondensedSealedMeridiansMinimum();
    if (isSpecificCrystalActive(1)) writeNumber(player.matrixOwned, 0);
    refreshMatrixDerivedState();
    refreshSealedMeridiansDerivedState();
    refreshTierOneDerivedState();
}

function resetStartingMana(): void {
    const crystalStartMana = getCrystalStartMana();
    if (crystalStartMana !== 0) {
        copyInto(player.mana, crystalStartMana);
        return;
    }
    if (hasAscendedCondensedEffect(7)) writeDecimal(player.mana, 1, 1, 100);
    else if (hasCondensedEffect(7)) writeDecimal(player.mana, 1, 1, 50);
    else writeNumber(player.mana, hasTierOneAchievement(8) ? 500 : 10);
}

export function applyCondensedSealedMeridiansMinimum(): void {
    if (hasAscendedCondensedEffect(10)) {
        if (!gte(player.sealedMeridiansOwned, 2)) writeNumber(player.sealedMeridiansOwned, 2);
        if (!gte(player.matrixOwned, 1)) writeNumber(player.matrixOwned, 1);
        refreshSealedMeridiansDerivedState();
        refreshMatrixDerivedState();
        refreshSealedMeridiansDerivedState();
    } else if (hasCondensedEffect(10) && !gt(player.sealedMeridiansOwned, 0)) {
        writeNumber(player.sealedMeridiansOwned, 1);
        refreshSealedMeridiansDerivedState();
        refreshMatrixDerivedState();
        refreshSealedMeridiansDerivedState();
    }
}

export function hasSealedMeridianThisReset(): bool {
    return player.meridianSealedThisReset;
}

export function setSealedMeridianThisReset(value: bool): void {
    player.meridianSealedThisReset = value;
}

export function hasCastSpeedUsedThisCondense(): bool {
    return player.castSpeedUsedThisCondense;
}

export function setCastSpeedUsedThisCondense(value: bool): void {
    player.castSpeedUsedThisCondense = value;
}

/** [/WASM] */

refreshSealedMeridiansDerivedState();
refreshMatrixDerivedState();
refreshSealedMeridiansDerivedState();
