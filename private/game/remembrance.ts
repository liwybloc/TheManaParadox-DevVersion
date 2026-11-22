import { addUS, gte, mulUS, powInto, powUS, subUS, writeNumber } from "../core/break_eternity.js";
import { hasMemoryMilestone } from "./memories.js";
import { unlockTierOneAchievement } from "./achievements.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";

export const REMEMBRANCE_ROWS = [
    "XXXAXXX", "XXXAXXX", "XXAAAXX", "XAXAXAX", "XAXAXAX", "XXAXAXX", "XXXAXXX",
    "XAAAAAX", "AXXAXXA", "AXAAAXA", "AXXAXXA", "XAXAXAX", "XXAXAXX", "XXXAXXX",
] as const;

export const REMEMBRANCE_LAYOUT = REMEMBRANCE_ROWS.flatMap((row, rowIndex) => [...row].flatMap((cell, columnIndex) =>
    cell === "A" ? [[columnIndex + 1, rowIndex + 1] as const] : []));

export const REMEMBRANCE_CONNECTIONS = [
    [1, 2], [2, 3], [2, 4], [2, 5], [3, 6], [6, 9], [5, 8], [8, 11], [4, 7], [7, 10],
    [9, 12], [10, 12], [11, 13], [10, 13], [12, 14], [13, 14], [14, 15], [14, 16], [14, 17], [14, 18], [14, 19],
    [15, 20], [20, 23], [23, 28], [28, 31], [31, 34], [34, 36], [16, 21], [17, 21], [18, 21], [19, 22], [22, 27], [27, 30], [30, 33], [33, 35], [35, 36],
    [21, 24], [21, 25], [21, 26], [25, 29], [24, 29], [26, 29], [29, 32], [32, 34], [32, 35],
] as const;

export const REMEMBRANCE_UPGRADE_COUNT = REMEMBRANCE_LAYOUT.length;

/** [WASM] */
export function remembranceUpgradeCost(upgradeNumber: i32): i32 {
    switch (upgradeNumber) {
        case 1: case 2: return 1;

        case 3: case 4: case 5: return 3;

        case 6: case 7: case 8: return 9;

        case 9: case 10: case 11: return 15;

        case 12: case 13: return 100;
        
        case 14: return 150;

        case 15: case 16: case 17: case 18: case 19: return 200;

        case 20: case 21: case 22: case 23: case 27: case 28: case 30: return 500;

        case 24: case 25: case 26: return 1_000;

        case 29: case 31: case 32: case 33: return 2_500;

        case 34: case 35: return 5_000;

        default: return 25_000;
    }
}
/** [/WASM] */

export const REMEMBRANCE_DESCRIPTIONS = [
    "Condensed Mana gain is increased by 25%", // 1
    "Mana production is increased by 25%", // 2
    "Mana production is raised to ^1.04", // 3
    "Condensed Mana gain is raised to ^1.10", // 4
    "Producer cost scaling is reduced by 5%", // 5
    "Mana production is raised to ^1.04", // 6
    "Condensed Mana gain is raised to ^1.10", // 7
    "Producer cost scaling is reduced by 5%", // 8
    "Mana production is raised to ^1.04", // 9
    "Condensed Mana gain is raised to ^1.10", // 10
    "Producer cost scaling is reduced by 5%", // 11
    "Mana production is raised to ^1.04", // 12
    "Producer cost scaling is reduced by 5%", // 13
    "Placeholder", // 14
    "Placeholder", // 15
    "Placeholder", // 16
    "Placeholder", // 17
    "Placeholder", // 18
    "Placeholder", // 19
    "Placeholder", // 20
    "Placeholder", // 21
    "Placeholder", // 22
    "Placeholder", // 23
    "Placeholder", // 24
    "Placeholder", // 25
    "Placeholder", // 26
    "Placeholder", // 27
    "Placeholder", // 28
    "Placeholder", // 29
    "Placeholder", // 30
    "Placeholder", // 31
    "Placeholder", // 32
    "Placeholder", // 33
    "Placeholder", // 34
    "Placeholder", // 35
    "Placeholder", // 36
] as const;
export const REMEMBRANCE_UPGRADES = REMEMBRANCE_LAYOUT.map((position, index) => ({
    index,
    description: REMEMBRANCE_DESCRIPTIONS[index],
    cost: remembranceUpgradeCost(index + 1),
    costFormatted: "",
}));
export const REMEMBRANCE_GRID_COLUMNS = 7;
export const REMEMBRANCE_GRID_CELL_WIDTH = 132;
export const REMEMBRANCE_GRID_CELL_HEIGHT = 88;
export const REMEMBRANCE_GRID_GAP = 20;
export const REMEMBRANCE_GRID_WIDTH = REMEMBRANCE_GRID_COLUMNS * REMEMBRANCE_GRID_CELL_WIDTH
    + (REMEMBRANCE_GRID_COLUMNS - 1) * REMEMBRANCE_GRID_GAP;
export const REMEMBRANCE_GRID_HEIGHT = REMEMBRANCE_ROWS.length * (REMEMBRANCE_GRID_CELL_HEIGHT + REMEMBRANCE_GRID_GAP)
    - REMEMBRANCE_GRID_GAP;

export function remembrancePrerequisites(upgradeNumber: number): readonly number[] {
    switch (upgradeNumber) {
        case 1: return [];
        case 2: return [1];
        case 3: case 4: case 5: return [2];
        case 6: return [3];
        case 7: return [4];
        case 8: return [5];
        case 9: return [6];
        case 10: return [7];
        case 11: return [8];
        case 12: return [9, 10];
        case 13: return [10, 11];
        case 14: return [12, 13];
        case 15: case 16: case 17: case 18: case 19: return [14];
        case 20: return [15];
        case 21: return [16, 17, 18];
        case 22: return [19];
        case 23: return [20];
        case 24: case 25: case 26: return [21];
        case 27: return [22];
        case 28: return [23];
        case 29: return [26];
        case 30: return [27];
        case 31: return [28];
        case 32: return [29];
        case 33: return [30];
        case 34: return [31, 32];
        case 35: return [33, 32];
        case 36: return [34, 35];
        default: return [];
    }
}

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const REMEMBRANCE_UPGRADE_COUNT_WASM: i32 = 36;
const remembranceUpgrades = new StaticArray<u8>(REMEMBRANCE_UPGRADE_COUNT_WASM);
let memorials: i32 = 0;
let totalMemorialsPurchased: i32 = 0;
let respecRemembranceOnCondense = false;

export function getMemorials(): i32 { return memorials; }
export function setMemorials(value: i32): void { memorials = value < 0 ? 0 : value; }
export function getTotalMemorialsPurchased(): i32 { return totalMemorialsPurchased; }
export function setTotalMemorialsPurchased(value: i32): void { totalMemorialsPurchased = value < 0 ? 0 : value; }
export function isRespecRemembranceOnCondense(): bool { return respecRemembranceOnCondense; }
export function setRespecRemembranceOnCondense(value: bool): void { respecRemembranceOnCondense = value; }
export function hasRemembranceUpgrade(index: i32): bool {
    return remembranceUpgrades[index] !== 0;
}
export function setRemembranceUpgrade(index: i32, purchased: bool): void {
    if (index < 0 || index >= REMEMBRANCE_UPGRADE_COUNT_WASM) return;
    remembranceUpgrades[index] = purchased ? 1 : 0;
}

export function remembranceUpgradeCostHandle(): i32 {
    writeNumber(scratch.remembranceCostExponent, memorials);
    for (let index: i32 = 0; index < REMEMBRANCE_UPGRADE_COUNT_WASM; index++) {
        if (remembranceUpgrades[index] === 0) continue;
        addUS(scratch.remembranceCostExponent, remembranceUpgradeCost(index + 1));
    }
    powInto(scratch.remembranceCost, 10, scratch.remembranceCostExponent);
    return scratch.remembranceCost;
}
export function canBuyMemorial(): bool {
    return hasMemoryMilestone(500) && gte(player.condensedMana, remembranceUpgradeCostHandle());
}
export function buyMemorial(): bool {
    if (!canBuyMemorial()) return false;
    subUS(player.condensedMana, remembranceUpgradeCostHandle());
    memorials++;
    totalMemorialsPurchased++;
    return true;
}
export function canBuyRemembranceUpgrade(index: i32): bool {
    if (!hasMemoryMilestone(500) || index < 0 || index >= REMEMBRANCE_UPGRADE_COUNT_WASM || index === 13 || hasRemembranceUpgrade(index)) return false;
    const r = hasRemembranceUpgrade;
    switch (index) {
        case 0: return true;
        case 1: return r(0);
        case 2: case 3: case 4: return r(1);
        case 5: return r(2);
        case 6: return r(3);
        case 7: return r(4);
        case 8: return r(5);
        case 9: return r(6);
        case 10: return r(7);
        case 11: return r(8) && r(9);
        case 12: return r(10) && r(9);
        case 14: case 15: case 16: case 17: case 18: return r(13);
        case 20: return r(15) && r(16) && r(17);
        case 33: return r(30) && r(31);
        case 34: return r(32) && r(31);
        case 35: return r(33) && r(34);
        case 22: return r(19);
        case 23: case 24: case 25: return r(20);
        case 26: return r(21);
        case 27: return r(22);
        case 28: return r(25);
        case 29: return r(26);
        case 30: return r(27);
        case 31: return r(28);
        case 32: return r(29);
        default: return r(index - 1);
    }
}
export function buyRemembranceUpgrade(index: i32, cost: i32): bool {
    if (!canBuyRemembranceUpgrade(index) || cost < 0 || memorials < cost) return false;

    remembranceUpgrades[index] = 1;
    memorials -= cost;
    if (index === 2 || index === 3 || index === 4) unlockTierOneAchievement(53);
    return true;
}
export function resetRemembranceUpgrades(): void {
    for (let index: i32 = 0; index < REMEMBRANCE_UPGRADE_COUNT_WASM; index++) {
        if (remembranceUpgrades[index] !== 0) memorials += remembranceUpgradeCost(index + 1);
        remembranceUpgrades[index] = 0;
    }
}
export function applyRemembranceRespec(): void {
    if (!respecRemembranceOnCondense) return;
    resetRemembranceUpgrades();
    respecRemembranceOnCondense = false;
}

export function remembrance_manaGainModifiers(handle: i32): void {

    // center
    if (hasRemembranceUpgrade(1)) mulUS(handle, scratch.D1_25);

    // left
    if (hasRemembranceUpgrade(2))  powUS(handle, scratch.D1_04);
    if (hasRemembranceUpgrade(5))  powUS(handle, scratch.D1_04);
    if (hasRemembranceUpgrade(8))  powUS(handle, scratch.D1_04);
    if (hasRemembranceUpgrade(11)) powUS(handle, scratch.D1_04);

}

export function remembrance_condensedManaModifiers(handle: i32): void {
    
    // center
    if (hasRemembranceUpgrade(0)) mulUS(handle, scratch.D1_25);

    // center
    if (hasRemembranceUpgrade(3)) powUS(handle, scratch.D1_1);
    if (hasRemembranceUpgrade(6)) powUS(handle, scratch.D1_1);
    if (hasRemembranceUpgrade(9)) powUS(handle, scratch.D1_1);

}

export function remembrance_costScalingNerf(): f64 {
    let amount: f64 = 1.00;
    
    // right
    if (hasRemembranceUpgrade(4))  amount *= 0.99;
    if (hasRemembranceUpgrade(7))  amount *= 0.99;
    if (hasRemembranceUpgrade(10)) amount *= 0.99;
    if (hasRemembranceUpgrade(12)) amount *= 0.99;

    return amount;
}

/** [/WASM] */
