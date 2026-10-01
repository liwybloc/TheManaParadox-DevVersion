import { addUS, getMagnitude, gt, gte, log10Into, lte, mulUS, powUS, subUS, writeDecimal, writeNumber } from "../core/break_eternity.js";
import "../abyss/handles.js";
import { abyssRunCouragePowerHandle, resonanceTowerEffectHandle } from "../abyss/abyss.js";
import { hasAscendedCondensedEffect, hasCondensedEffect } from "./condensed.js";
import { isAllMultipliersDisabledCrystalActive, isProducerOnlyCrystalActive } from "./crystals.js";
import { hasMemoryMilestone } from "./memories.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const COURAGE_DURATION: f64 = 15;
const COURAGE_COOLDOWN: f64 = 15;

export function isCourageVisible(): bool {
    if (isCourageUnlocked()) return true;
    writeDecimal(scratch.currencyGain, 1, 1, courageUnlockExponent());
    if (!gte(player.mana, scratch.currencyGain)) return false;
    player.courageUnlocked = true;
    return true;
}

export function courageUnlockExponent(): f64 {
    return hasCondensedEffect(14) ? 270 : 290;
}

export function isCourageUnlocked(): bool {
    return player.courageUnlocked || hasAscendedCondensedEffect(14);
}

export function setCourageUnlocked(unlocked: bool): void {
    player.courageUnlocked = unlocked;
}

export function activateCourage(): bool {
    if (isProducerOnlyCrystalActive() || isAllMultipliersDisabledCrystalActive()
        || !isCourageUnlocked() || isCourageActive() || gt(player.courageCooldown, 0)) return false;
    writeNumber(
        player.courageTimer,
        hasAscendedCondensedEffect(12) ? COURAGE_DURATION * 1.5
            : hasCondensedEffect(12) ? COURAGE_DURATION * 1.25
            : COURAGE_DURATION,
    );
    writeNumber(player.courageCooldown, 0);
    refreshCourageMultiplier();
    return true;
}

export function refreshCourageMultiplier(): void {
    writeNumber(player.courageMultiplier, 10);
    if (hasMemoryMilestone(3)) mulUS(player.courageMultiplier, 2);
    if (hasCondensedEffect(18) || hasAscendedCondensedEffect(18)) {
        writeNumber(scratch.productionModifier, 0);
        addUS(addUS(scratch.productionModifier, player.condensedMana), 1);
        log10Into(scratch.productionModifier, scratch.productionModifier);
        addUS(scratch.productionModifier, 1);
        if (hasAscendedCondensedEffect(18)) mulUS(scratch.productionModifier, 5);
        mulUS(player.courageMultiplier, scratch.productionModifier);
    }
    mulUS(player.courageMultiplier, resonanceTowerEffectHandle(7, 2));
    powUS(player.courageMultiplier, abyssRunCouragePowerHandle());
}

export function isCourageActive(): bool {
    return gt(player.courageTimer, 0);
}

export function updateCourage(deltaSeconds: i32): bool {
    const elapsed = gt(deltaSeconds, 0) ? getMagnitude(deltaSeconds) : 0;
    const active = isCourageActive();
    if (elapsed === 0) return active;

    if (!active) {
        reduceTimer(player.courageCooldown, deltaSeconds, elapsed);
        return false;
    }

    const activeRemaining = getMagnitude(player.courageTimer);
    if (activeRemaining > elapsed) {
        subUS(player.courageTimer, deltaSeconds);
        return true;
    }

    writeNumber(player.courageTimer, 0);
    const cooldownRemaining = COURAGE_COOLDOWN - (elapsed - activeRemaining);
    writeNumber(player.courageCooldown, Math.max(0, cooldownRemaining));
    return active;
}

function reduceTimer(timer: i32, deltaSeconds: i32, elapsed: f64): void {
    if (!gt(timer, 0)) return;
    if (lte(timer, deltaSeconds)) writeNumber(timer, 0);
    else subUS(timer, deltaSeconds);
}

/** [/WASM] */
