import { addUS, copyInto, createDecimal, createZero, divUS, getMagnitude, getSign, gt, gte, log10Into, lte, mulUS, powUS, subUS, writeDecimal, writeNumber } from "../core/break_eternity.js";
import { checkCoinAchievements, consumeCircularHabitsReward, hasTierOneAchievement, unlockTierOneAchievement } from "../game/achievements.js";
import { crystalRewardHandle, hasCompletedCrystal, isAllMultipliersDisabledCrystalActive, isCrystalActive, isPotionDisabledCrystalActive, isProducerOnlyCrystalActive } from "../game/crystals.js";
import { focusGameSpeedMultiplier, isFocusing } from "../game/memories.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { INVENTORY_ITEMS } from "./items.js";
import { GUILD_QUESTS } from "./quests.js";
import { GUILD_SHOP_UPGRADES } from "./shop.js";
import { equipmentBattleDamageMultiplier, equipmentDamageTakenMultiplier, equipmentGameSpeedMultiplier, equipmentMaximumShieldMultiplier, equippedItem, hasMireguardSetBonus, setEquippedItem } from "./equipment.js";
import { refreshMatrixDerivedState } from "../game/progression.js";
import "../abyss/handles.js";
import { abyssGameSpeedDivisorHandle, abyssPotionPowerMultiplierHandle, resonanceTowerEffectHandle } from "../abyss/abyss.js";

type Num10 = [number, number, number, number, number, number, number, number, number, number];
type Num3 = [number, number, number];
export const GUILD_RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];
export const GUILD_RANK_EXPERIENCE_REQUIREMENTS = [25, 200, 750, 2_500, 10_000, 100_000, 250_000, 1_000_000] as const;
export const POTION_SPEED_TIMER_HANDLES: Num10 = Array.from({ length: 10 }, () => createZero()) as Num10;
export const POTION_SPEED_II_TIMER_HANDLES: Num10 = Array.from({ length: 10 }, () => createZero()) as Num10;
export const POTION_SPEED_III_TIMER_HANDLES: Num10 = Array.from({ length: 10 }, () => createZero()) as Num10;
export const ADVANCED_COMBAT_SPELL_COST_HANDLES: Num3 = [
    createDecimal(1, 1, 160),
    createDecimal(1, 1, 220),
    createDecimal(1, 1, 300),
];
declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const NO_ACTIVE_QUEST: i32 = -1;
const INVENTORY_SIZE: i32 = 100;
const INVENTORY_WIDTH: i32 = 10;
const INVENTORY_EMPTY: u8 = 0;
const INVENTORY_WOLF_FUR: u8 = 1;
const INVENTORY_POTION_OF_SPEED: u8 = 2;
const INVENTORY_POTION_OF_SPEED_II: u8 = 19;
const INVENTORY_POTION_OF_SPEED_III: u8 = 20;
const INVENTORY_ARMOR_START: i32 = 26;
const INVENTORY_ARMOR_ITEM_COUNT: i32 = 40;
const INVENTORY_ARMOR_ITEMS_PER_SET: i32 = 4;
const EQUIPMENT_SLOT_COUNT: i32 = 4;
const INVENTORY_PACKAGE: u8 = 254;
const INVENTORY_CONTINUATION: u8 = 255;
const PACKAGE_SIZE: i32 = 10;
const MAX_QUEST_REWARDS: i32 = 4;
const QUEST_DEFINITION_COUNT: i32 = 37;
const QUEST_SLOT_COUNT: i32 = 6;
const GUILD_RANK_COUNT: i32 = 9;
const SHOP_ITEM_COUNT: i32 = 3;
const SHOP_UPGRADE_COUNT: i32 = 12;
const COMBAT_SPELL_COUNT: i32 = 6;
const inventorySlots = new StaticArray<u8>(INVENTORY_SIZE);
const inventoryMetadata = new StaticArray<u8>(INVENTORY_SIZE);
const inventoryItemWidths = new StaticArray<u8>(256);
const inventoryItemHeights = new StaticArray<u8>(256);
const inventoryItemSellMinimums = new StaticArray<u8>(256);
const inventoryItemSellMaximums = new StaticArray<u8>(256);
const questSlotLocked = new StaticArray<u8>(QUEST_SLOT_COUNT);
const questDefinitionIds = new StaticArray<i32>(QUEST_SLOT_COUNT);
const guildRankExperienceRequirements = new StaticArray<f64>(GUILD_RANK_COUNT);
const guildExperienceByQuestRank = new StaticArray<f64>(GUILD_RANK_COUNT);
const shopItemIds = new StaticArray<i32>(SHOP_ITEM_COUNT);
const shopItemCosts = new StaticArray<i32>(SHOP_ITEM_COUNT);
const shopItemRefreshTimers = new StaticArray<f64>(SHOP_ITEM_COUNT);
const shopUpgrades = new StaticArray<u8>(SHOP_UPGRADE_COUNT);
const shopUpgradeCosts = new StaticArray<i32>(SHOP_UPGRADE_COUNT);
const advancedCombatSpellCosts = new StaticArray<i32>(3);
const potionSpeedTimers = new StaticArray<i32>(10);
const potionSpeedIITimers = new StaticArray<i32>(10);
const potionSpeedIIITimers = new StaticArray<i32>(10);

const QUEST_REFRESH_TIME = 180;

let inventoryRevision: i32 = 0;
let questRefreshRemaining: f64 = QUEST_REFRESH_TIME;
let guildExperience: f64 = 0;
let guildRankExperienceRequirementCount: i32 = 0;
let combatRandomState: u32 = 0x6d2b79f5;
let questResultPending = false;
let lastWolfFurReward: i32 = 0;
let lastPotionReward: i32 = 0;
let lastWolfFurDropped: i32 = 0;
let lastPotionDropped: i32 = 0;
let lastCompletedQuestDefinition: i32 = 0;
const lastRewardItems = new StaticArray<i32>(MAX_QUEST_REWARDS);
const lastRewardAmounts = new StaticArray<i32>(MAX_QUEST_REWARDS);
const lastRewardDropped = new StaticArray<i32>(MAX_QUEST_REWARDS);
const questRewardItems = new StaticArray<i32>(QUEST_DEFINITION_COUNT * MAX_QUEST_REWARDS);
const questRewardMinimums = new StaticArray<i32>(QUEST_DEFINITION_COUNT * MAX_QUEST_REWARDS);
const questRewardMaximums = new StaticArray<i32>(QUEST_DEFINITION_COUNT * MAX_QUEST_REWARDS);

export function isGuildUnlocked(): bool {
    if (player.guildUnlocked) {
        unlockTierOneAchievement(25);
        return true;
    }
    writeDecimal(scratch.productionModifier, 1, 1, 210);
    if (!gte(player.mana, scratch.productionModifier)) return false;
    player.guildUnlocked = true;
    unlockTierOneAchievement(25);
    return true;
}

export function setGuildUnlocked(value: bool): void {
    player.guildUnlocked = value;
}

export function isGuildMember(): bool {
    return player.guildMember;
}

export function setGuildMember(value: bool): void {
    player.guildMember = value;
}

export function applyToGuild(): bool {
    if (!isGuildUnlocked() || player.guildMember) return false;
    player.guildMember = true;
    writeNumber(player.guildRank, 0);
    return true;
}

export function initializeQuestBoard(): void {
    for (let slot: i32 = 0; slot < QUEST_SLOT_COUNT; slot++) questDefinitionIds[slot] = slot;
}

export function questDefinitionId(slot: i32): i32 {
    return slot >= 0 && slot < QUEST_SLOT_COUNT ? questDefinitionIds[slot] : 0;
}

export function setQuestDefinitionId(slot: i32, id: i32): void {
    if (slot < 0 || slot >= QUEST_SLOT_COUNT) return;
    questDefinitionIds[slot] = <i32>Math.max(0, Math.min(QUEST_DEFINITION_COUNT - 1, id));
}

export function getGuildExperience(): f64 {
    if (!cantRankUp()) return guildExperience;
    return Math.min(guildExperience, guildExperienceRequirement() * 0.99);
}

export function setGuildExperience(experience: f64): void {
    guildExperience = Math.max(0, experience);
}

export function getGuildExperienceForQuestRank(rank: i32): f64 {
    return rank >= 0 && rank < GUILD_RANK_COUNT ? guildExperienceByQuestRank[rank] : 0;
}

export function setGuildExperienceForQuestRank(rank: i32, experience: f64): void {
    if (rank < 0 || rank >= GUILD_RANK_COUNT) return;
    guildExperienceByQuestRank[rank] = Math.max(0, experience);
}

export function configureGuildRankExperienceRequirement(rank: i32, requirement: f64): void {
    if (rank < 0 || rank >= GUILD_RANK_COUNT) return;
    guildRankExperienceRequirements[rank] = requirement;
    if (guildRankExperienceRequirementCount <= rank) guildRankExperienceRequirementCount = rank + 1;
}

export function guildExperienceRequirement(): f64 {
    const rank = <i32>getMagnitude(player.guildRank);
    return rank >= 0 && rank < guildRankExperienceRequirementCount
        ? guildRankExperienceRequirements[rank]
        : Infinity;
}

export function cantRankUp(): bool {
    const rank = <i32>getMagnitude(player.guildRank);
    return rank === 4 || (rank === 0 && !gt(player.mana_circle_tier, 0));
}

export function isQuestActive(): bool {
    return getSign(player.activeQuest) >= 0;
}

export function isQuestSlotLocked(index: i32): bool {
    return index >= 0 && index < QUEST_SLOT_COUNT && questSlotLocked[index] !== 0;
}

export function setQuestSlotLocked(index: i32, locked: bool): void {
    if (index < 0 || index >= QUEST_SLOT_COUNT) return;
    questSlotLocked[index] = locked ? 1 : 0;
}

export function getQuestRefreshRemaining(): f64 {
    return questRefreshRemaining;
}

export function setQuestRefreshRemaining(seconds: f64): void {
    questRefreshRemaining = Math.max(0, Math.min(QUEST_REFRESH_TIME, seconds));
}

export function updateQuestBoard(deltaSeconds: f64): void {
    if (consumeCircularHabitsReward()) placeInventoryItems(INVENTORY_POTION_OF_SPEED_II, 3);
    if (!player.guildMember || deltaSeconds <= 0) return;
    updateShopItemRefreshes(deltaSeconds);
    if (isQuestActive()) return;
    if (!questDefinitionsMatchCurrentRank()) {
        for (let index: i32 = 0; index < QUEST_SLOT_COUNT; index++) questSlotLocked[index] = 0;
        refreshQuestDefinitions();
        questRefreshRemaining = QUEST_REFRESH_TIME;
        return;
    }
    questRefreshRemaining -= deltaSeconds;
    if (questRefreshRemaining > 0) return;
    for (let index: i32 = 0; index < QUEST_SLOT_COUNT; index++) questSlotLocked[index] = 0;
    refreshQuestDefinitions();
    refreshShopItems();
    questRefreshRemaining = QUEST_REFRESH_TIME;
}

export function activeQuestIndex(): i32 {
    return <i32>(getSign(player.activeQuest) * getMagnitude(player.activeQuest));
}

export function hasGuildShopUpgrade(index: i32): bool {
    return index >= 0 && index < SHOP_UPGRADE_COUNT && shopUpgrades[index] !== 0;
}

export function setGuildShopUpgrade(index: i32, purchased: bool): void {
    if (index < 0 || index >= SHOP_UPGRADE_COUNT) return;
    shopUpgrades[index] = purchased ? 1 : 0;
}

export function configureGuildShopUpgradeCost(index: i32, cost: i32): void {
    if (index < 0 || index >= SHOP_UPGRADE_COUNT || cost < 0) return;
    shopUpgradeCosts[index] = cost;
}

export function visibleQuestSlotCount(): i32 {
    return 3 + (hasGuildShopUpgrade(2) ? 1 : 0) + (hasGuildShopUpgrade(4) ? 1 : 0) + (hasGuildShopUpgrade(6) ? 1 : 0);
}

export function isEquipmentUnlocked(): bool {
    return hasGuildShopUpgrade(5);
}

export function shopItemId(slot: i32): i32 { return slot >= 0 && slot < SHOP_ITEM_COUNT ? shopItemIds[slot] : 0; }
export function shopItemCost(slot: i32): i32 { return slot >= 0 && slot < SHOP_ITEM_COUNT ? shopItemCosts[slot] : 0; }
export function shopItemRefreshTimer(slot: i32): f64 { return slot >= 0 && slot < SHOP_ITEM_COUNT ? shopItemRefreshTimers[slot] : 0; }
export function setShopItemId(slot: i32, item: i32): void { if (slot >= 0 && slot < SHOP_ITEM_COUNT) shopItemIds[slot] = item; }
export function setShopItemCost(slot: i32, cost: i32): void { if (slot >= 0 && slot < SHOP_ITEM_COUNT) shopItemCosts[slot] = cost; }
export function setShopItemRefreshTimer(slot: i32, seconds: f64): void {
    if (slot >= 0 && slot < SHOP_ITEM_COUNT) shopItemRefreshTimers[slot] = Math.max(0, Math.min(30, seconds));
}

export function ensureShopItems(): void {
    for (let slot: i32 = 0; slot < SHOP_ITEM_COUNT; slot++) {
        if (!isInventoryItem(<u8>shopItemIds[slot]) || shopItemCosts[slot] <= 0) rollShopItem(slot);
    }
}

export function repairGuildCurrency(): void {
    if (!gte(player.coins, 0)) writeNumber(player.coins, 0);
}

export function canBuyShopItem(slot: i32): bool {
    if (slot < 0 || slot >= SHOP_ITEM_COUNT || shopItemIds[slot] <= 0 || shopItemRefreshTimers[slot] > 0) return false;
    writeNumber(scratch.productionModifier, shopItemCosts[slot]);
    const item = <u8>shopItemIds[slot];
    const hasSpace = (canPackageItem(item) && looseInventoryItemCount(item) >= PACKAGE_SIZE - 1)
        || findInventorySpace(item) >= 0;
    return gte(player.coins, scratch.productionModifier) && hasSpace;
}

export function buyShopItem(slot: i32): bool {
    if (!canBuyShopItem(slot)) return false;
    writeNumber(scratch.productionModifier, shopItemCosts[slot]);
    subUS(player.coins, scratch.productionModifier);
    placeInventoryItems(<u8>shopItemIds[slot], 1);
    shopItemRefreshTimers[slot] = 30;
    return true;
}

export function canBuyGuildShopUpgrade(index: i32): bool {
    if (index < 0 || index >= SHOP_UPGRADE_COUNT || hasGuildShopUpgrade(index)) return false;
    if (<i32>getMagnitude(player.guildRank) < guildShopUpgradeRank(index)) return false;
    writeNumber(scratch.productionModifier, guildShopUpgradeCost(index));
    return gte(player.coins, scratch.productionModifier);
}

function guildShopUpgradeRank(index: i32): i32 {
    if (index < 3) return 0;
    if (index < 6) return 1;
    if (index < 9) return 2;
    return 3;
}

export function buyGuildShopUpgrade(index: i32): bool {
    if (!canBuyGuildShopUpgrade(index)) return false;
    writeNumber(scratch.productionModifier, guildShopUpgradeCost(index));
    subUS(player.coins, scratch.productionModifier);
    setGuildShopUpgrade(index, true);
    if (index === 2) unlockTierOneAchievement(51);
    refreshPotionEffectState();
    inventoryRevision++;
    return true;
}

function guildShopUpgradeCost(index: i32): i32 {
    return index >= 0 && index < SHOP_UPGRADE_COUNT ? shopUpgradeCosts[index] : 0;
}

function refreshShopItems(): void {
    for (let slot: i32 = 0; slot < SHOP_ITEM_COUNT; slot++) {
        rollShopItem(slot);
        shopItemRefreshTimers[slot] = 0;
    }
}

function updateShopItemRefreshes(deltaSeconds: f64): void {
    for (let slot: i32 = 0; slot < SHOP_ITEM_COUNT; slot++) {
        if (shopItemRefreshTimers[slot] <= 0) continue;
        shopItemRefreshTimers[slot] -= deltaSeconds;
        if (shopItemRefreshTimers[slot] > 0) continue;
        shopItemRefreshTimers[slot] = 0;
        rollShopItem(slot);
    }
}

function rollShopItem(slot: i32): void {
    const item = 1 + nextCombatRandom(25);
    const maximumSell = inventoryItemSellMaximum(item);
    shopItemIds[slot] = item;
    shopItemCosts[slot] = maximumSell + nextCombatRandom(maximumSell + 1);
}

export function combatShieldHandle(): i32 {
    return player.combatShield;
}

export function wolfineHealthPercent(): f64 {
    copyInto(scratch.currencyGain, player.enemyHealth);
    divUS(scratch.currencyGain, enemyMaximumHealth(activeQuestIndex()));
    if (!gt(scratch.currencyGain, 0)) return 0;
    if (gt(scratch.currencyGain, 1)) return 1;
    return getMagnitude(scratch.currencyGain);
}

export function enemyMaximumHealth(questSlot: i32): i32 {
    writeNumber(scratch.enemyMaximumHealth, enemyHealthForRank(questRank(questSlot)));
    return scratch.enemyMaximumHealth;
}

function enemyHealthForRank(rank: i32): f64 {
    if (rank <= 0) return 150;
    if (rank === 1) return 250;
    if (rank === 2) return 500;
    if (rank === 3) return 2500;
    if (rank === 4) return 15000;
    return 100000;
}

export function combatShieldPercent(): f64 {
    if (!gt(player.combatShieldMaximum, 0)) return 0;
    writeNumber(scratch.currencyGain, 0);
    addUS(scratch.currencyGain, player.combatShield);
    divUS(scratch.currencyGain, player.combatShieldMaximum);
    if (!gt(scratch.currencyGain, 0)) return 0;
    if (gt(scratch.currencyGain, 1)) return 1;
    return getMagnitude(scratch.currencyGain);
}

export function canCastCombatSpell(index: i32): bool {
    if (!isQuestActive() || index < 0 || index >= COMBAT_SPELL_COUNT) return false;
    if (index >= 3 && !hasGuildShopUpgrade(index + 6)) return false;
    return gte(player.quests_currentAvailableMana, combatSpellCost(index));
}

export function initializeAdvancedCombatSpellCosts(lightning: i32, meteor: i32, arcaneNova: i32): void {
    advancedCombatSpellCosts[0] = lightning;
    advancedCombatSpellCosts[1] = meteor;
    advancedCombatSpellCosts[2] = arcaneNova;
}

export function hasQuestResult(): bool {
    return questResultPending;
}

export function lastQuestWolfFurReward(): i32 {
    return lastWolfFurReward;
}

export function lastQuestPotionReward(): i32 {
    return lastPotionReward;
}

export function lastCompletedQuestDefinitionId(): i32 {
    return lastCompletedQuestDefinition;
}

export function lastQuestRewardCount(): i32 { return MAX_QUEST_REWARDS; }
export function lastQuestRewardItem(index: i32): i32 { return index >= 0 && index < MAX_QUEST_REWARDS ? lastRewardItems[index] : 0; }
export function lastQuestRewardAmount(index: i32): i32 { return index >= 0 && index < MAX_QUEST_REWARDS ? lastRewardAmounts[index] : 0; }
export function lastQuestRewardDropped(index: i32): i32 { return index >= 0 && index < MAX_QUEST_REWARDS ? lastRewardDropped[index] : 0; }

export function dismissQuestResult(): void {
    questResultPending = false;
}

export function lastQuestWolfFurDropped(): i32 {
    return lastWolfFurDropped;
}

export function lastQuestPotionDropped(): i32 {
    return lastPotionDropped;
}

export function inventoryItemAt(position: i32): i32 {
    if (position < 0 || position >= INVENTORY_SIZE) return 0;
    const item = inventorySlots[position];
    return item === INVENTORY_CONTINUATION ? 0 : item;
}

export function inventoryItemMetadata(position: i32): i32 {
    return position >= 0 && position < INVENTORY_SIZE ? inventoryMetadata[position] : 0;
}

export function rawInventorySlot(position: i32): i32 {
    return position >= 0 && position < INVENTORY_SIZE ? inventorySlots[position] : 0;
}

export function rawInventoryMetadata(position: i32): i32 {
    return position >= 0 && position < INVENTORY_SIZE ? inventoryMetadata[position] : 0;
}

export function setRawInventorySlot(position: i32, item: i32): void {
    if (position < 0 || position >= INVENTORY_SIZE || item < 0 || item > 255) return;
    inventorySlots[position] = <u8>item;
    inventoryRevision++;
}

export function setRawInventoryMetadata(position: i32, metadata: i32): void {
    if (position < 0 || position >= INVENTORY_SIZE || metadata < 0 || metadata > 255) return;
    inventoryMetadata[position] = <u8>metadata;
    inventoryRevision++;
}

export function configureInventoryItem(item: i32, width: i32, height: i32): void {
    if (item <= 0 || item >= 255 || width <= 0 || height <= 0) return;
    inventoryItemWidths[item] = <u8>width;
    inventoryItemHeights[item] = <u8>height;
}

export function configureInventoryItemSellPrice(item: i32, minimum: i32, maximum: i32): void {
    if (item <= 0 || item >= 255 || minimum < 0 || maximum < minimum || maximum >= 255) return;
    inventoryItemSellMinimums[item] = <u8>minimum;
    inventoryItemSellMaximums[item] = <u8>maximum;
}

export function configureQuestReward(quest: i32, reward: i32, item: i32, minimum: i32, maximum: i32): void {
    if (quest < 0 || quest >= QUEST_DEFINITION_COUNT || reward < 0 || reward >= MAX_QUEST_REWARDS) return;
    if (item <= 0 || item >= 255 || minimum < 0 || maximum < minimum) return;
    const index = quest * MAX_QUEST_REWARDS + reward;
    questRewardItems[index] = item;
    questRewardMinimums[index] = minimum;
    questRewardMaximums[index] = maximum;
}

export function getInventoryRevision(): i32 {
    return inventoryRevision;
}

export function equipInventoryItem(position: i32, slot: i32): bool {
    if (!hasGuildShopUpgrade(5) || slot < 0 || slot >= EQUIPMENT_SLOT_COUNT) return false;
    const item = inventoryItemAt(position);
    if (item < INVENTORY_ARMOR_START
        || item >= INVENTORY_ARMOR_START + INVENTORY_ARMOR_ITEM_COUNT
        || (item - INVENTORY_ARMOR_START) % INVENTORY_ARMOR_ITEMS_PER_SET !== slot) return false;
    clearInventoryItem(position, <u8>item);
    const replacedItem = equippedItem(slot);
    setEquippedItem(slot, item);
    if (replacedItem !== INVENTORY_EMPTY) placeInventoryItem(position, <u8>replacedItem);
    refreshMatrixDerivedState();
    inventoryRevision++;
    return true;
}

export function unequipInventoryItem(slot: i32, position: i32): bool {
    if (slot < 0 || slot >= EQUIPMENT_SLOT_COUNT) return false;
    const item = equippedItem(slot);
    if (item === INVENTORY_EMPTY || !inventoryPositionFits(<u8>item, position, -1)) return false;
    setEquippedItem(slot, INVENTORY_EMPTY);
    placeInventoryItem(position, <u8>item);
    refreshMatrixDerivedState();
    inventoryRevision++;
    return true;
}

export function packedInventorySlots(index: i32): i32 {
    if (index < 0 || index >= 25) return 0;
    const offset = index * 4;
    return <i32>inventorySlots[offset]
        | (<i32>inventorySlots[offset + 1] << 8)
        | (<i32>inventorySlots[offset + 2] << 16)
        | (<i32>inventorySlots[offset + 3] << 24);
}

export function setPackedInventorySlots(index: i32, packed: i32): void {
    if (index < 0 || index >= 25) return;
    const offset = index * 4;
    inventorySlots[offset] = <u8>packed;
    inventorySlots[offset + 1] = <u8>(packed >> 8);
    inventorySlots[offset + 2] = <u8>(packed >> 16);
    inventorySlots[offset + 3] = <u8>(packed >> 24);
    inventoryRevision++;
}

export function moveInventoryItem(source: i32, position: i32): bool {
    if (source < 0 || source >= INVENTORY_SIZE) return false;
    const item = inventorySlots[source];
    if (!isInventoryItem(item) || !inventoryPositionFits(item, position, source)) return false;
    const metadata = inventoryMetadata[source];
    clearInventoryItem(source, item);
    placeInventoryItem(position, item, metadata);
    inventoryRevision++;
    return true;
}

export function drinkSpeedPotion(position: i32): bool {
    return drinkPotion(position, INVENTORY_POTION_OF_SPEED);
}

export function drinkPotion(position: i32, itemId: i32): bool {
    if (isProducerOnlyCrystalActive() || position < 0 || position >= INVENTORY_SIZE || inventorySlots[position] !== itemId) return false;
    const containedItem = itemId === INVENTORY_PACKAGE ? <i32>inventoryMetadata[position] : itemId;
    const amount: i32 = itemId === INVENTORY_PACKAGE ? PACKAGE_SIZE : 1;
    if (!isPotion(containedItem) || availablePotionEffectSlots(containedItem) < amount) return false;
    for (let index: i32 = 0; index < amount; index++) applyPotionEffect(containedItem);
    clearInventoryItem(position, <u8>itemId);
    if (containedItem === INVENTORY_POTION_OF_SPEED) subUS(player.inventoryPotionOfSpeed, amount);
    inventoryRevision++;
    player.potionUsedThisCondense = true;
    unlockTierOneAchievement(27);
    return true;
}

export function sellInventoryItem(position: i32, itemId: i32): i32 {
    if (position < 0 || position >= INVENTORY_SIZE || inventorySlots[position] !== itemId) return 0;
    const containedItem = itemId === INVENTORY_PACKAGE ? <i32>inventoryMetadata[position] : itemId;
    const amount: i32 = itemId === INVENTORY_PACKAGE ? PACKAGE_SIZE : 1;
    const minimum = inventoryItemSellMinimum(containedItem);
    const maximum = inventoryItemSellMaximum(containedItem);
    if (minimum <= 0 || maximum < minimum) return 0;
    let coins: i32 = 0;
    for (let index: i32 = 0; index < amount; index++) coins += minimum + nextCombatRandom(maximum - minimum + 1);
    clearInventoryItem(position, <u8>itemId);
    if (containedItem === INVENTORY_POTION_OF_SPEED) subUS(player.inventoryPotionOfSpeed, amount);
    if (containedItem === INVENTORY_WOLF_FUR) subUS(player.inventoryWolfFur, amount);
    addUS(player.coins, coins);
    checkCoinAchievements();
    inventoryRevision++;
    return coins;
}

export function sellAllInventoryItems(includePotions: bool): i32 {
    const soldFullInventory = includePotions && isInventoryFull();
    const coins = sellInventoryItems(true, includePotions, includePotions);
    if (soldFullInventory) unlockTierOneAchievement(34);
    return coins;
}

export function sellSpareEquipment(): i32 {
    return sellInventoryItems(false, false, true);
}

function sellInventoryItems(includeMaterials: bool, includePotions: bool, includeArmor: bool): i32 {
    let coins: i32 = 0;
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        const item = inventorySlots[position];
        if (!isInventoryItem(item)) continue;
        const containedItem = item === INVENTORY_PACKAGE ? inventoryMetadata[position] : item;
        if (isPotion(containedItem) ? !includePotions : isArmor(containedItem) ? !includeArmor : !includeMaterials) continue;
        coins += sellInventoryItem(position, item);
    }
    return coins;
}

export function drinkAllPotions(): i32 {
    let consumed: i32 = 0;
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        const item = inventorySlots[position];
        if (!isPotion(item) && !(item === INVENTORY_PACKAGE && isPotion(inventoryMetadata[position]))) continue;
        if (drinkPotion(position, item)) consumed += item === INVENTORY_PACKAGE ? PACKAGE_SIZE : 1;
    }
    if (consumed >= 20) unlockTierOneAchievement(31);
    return consumed;
}

function isInventoryFull(): bool {
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        if (inventorySlots[position] === INVENTORY_EMPTY) return false;
    }
    return true;
}

function isPotion(item: i32): bool {
    return item === INVENTORY_POTION_OF_SPEED || item === INVENTORY_POTION_OF_SPEED_II || item === INVENTORY_POTION_OF_SPEED_III;
}

function availablePotionEffectSlots(itemId: i32): i32 {
    let available: i32 = 0;
    for (let index: i32 = 0; index < 10; index++) if (!gt(potionTimer(itemId, index), 0)) available++;
    return available;
}

export function applyPotionEffect(itemId: i32): bool {
    if (isPotionDisabledCrystalActive()) return false;
    const duration = potionDuration(itemId);
    const effect = potionEffectHandle(itemId);
    return duration > 0 && gt(effect, 0) && applyTimedPotionEffect(itemId, duration, effect);
}

export function potionDuration(itemId: i32): i32 {
    const baseDuration: i32 = itemId === INVENTORY_POTION_OF_SPEED ? 120
        : itemId === INVENTORY_POTION_OF_SPEED_II ? 60
        : itemId === INVENTORY_POTION_OF_SPEED_III ? 30 : 0;
    let duration = hasGuildShopUpgrade(0) ? baseDuration * 2 : baseDuration;
    if (hasTierOneAchievement(31)) duration += 30;
    return duration;
}

export function potionEffectHandle(itemId: i32): i32 {
    const baseEffect: f64 = itemId === INVENTORY_POTION_OF_SPEED ? 4
        : itemId === INVENTORY_POTION_OF_SPEED_II ? 14
        : itemId === INVENTORY_POTION_OF_SPEED_III ? 63 : 0;
    return potionSpeedEffect(baseEffect);
}

export function clearPotionEffect(itemId: i32, effectIndex: i32): bool {
    switch (itemId) {
        case INVENTORY_POTION_OF_SPEED:
            return clearTimedPotionEffect(itemId, effectIndex, potionSpeedEffect(4));
        case INVENTORY_POTION_OF_SPEED_II:
            return clearTimedPotionEffect(itemId, effectIndex, potionSpeedEffect(14));
        case INVENTORY_POTION_OF_SPEED_III:
            return clearTimedPotionEffect(itemId, effectIndex, potionSpeedEffect(63));
        default:
            return false;
    }
}

export function clearAllPotionEffects(): void {
    for (let index: i32 = 0; index < 10; index++) {
        writeNumber(potionSpeedTimers[index], 0);
        writeNumber(potionSpeedIITimers[index], 0);
        writeNumber(potionSpeedIIITimers[index], 0);
    }
    writeNumber(scratch.gameSpeed, 1);
}

export function refreshPotionEffectState(): void {
    writeNumber(scratch.gameSpeed, 1);
    if (isPotionDisabledCrystalActive()) {
        clearAllPotionEffects();
        return;
    }
    for (let index: i32 = 0; index < 10; index++) {
        if (gt(potionSpeedTimers[index], 0)) addPotionSpeed(potionSpeedEffect(4));
        if (gt(potionSpeedIITimers[index], 0)) addPotionSpeed(potionSpeedEffect(14));
        if (gt(potionSpeedIIITimers[index], 0)) addPotionSpeed(potionSpeedEffect(63));
    }
}

function potionSpeedEffect(baseEffect: f64): i32 {
    writeNumber(scratch.productionModifier, baseEffect);
    if (hasTierOneAchievement(30)) {
        writeNumber(scratch.tierOneSeconds, 1.25);
        mulUS(scratch.productionModifier, scratch.tierOneSeconds);
    }
    if (hasGuildShopUpgrade(3)) {
        writeNumber(scratch.tierOneSeconds, 1.5);
        mulUS(scratch.productionModifier, scratch.tierOneSeconds);
    }
    if (isCrystalActive() && hasCompletedCrystal(6)) mulUS(scratch.productionModifier, crystalRewardHandle(6, 0));
    mulUS(scratch.productionModifier, resonanceTowerEffectHandle(0, 2));
    mulUS(scratch.productionModifier, abyssPotionPowerMultiplierHandle());
    return scratch.productionModifier;
}

export function updatePotionEffects(seconds: i32): void {
    updateTimedPotionEffects(INVENTORY_POTION_OF_SPEED, seconds);
    updateTimedPotionEffects(INVENTORY_POTION_OF_SPEED_II, seconds);
    updateTimedPotionEffects(INVENTORY_POTION_OF_SPEED_III, seconds);
}

function applyTimedPotionEffect(itemId: i32, duration: i32, speed: i32): bool {
    for (let index: i32 = 0; index < 10; index++) {
        const timer = potionTimer(itemId, index);
        if (gt(timer, 0)) continue;
        writeNumber(timer, duration);
        addPotionSpeed(speed);
        return true;
    }
    return false;
}

function clearTimedPotionEffect(itemId: i32, effectIndex: i32, speed: i32): bool {
    if (effectIndex < 0 || effectIndex >= 10) return false;
    const timer = potionTimer(itemId, effectIndex);
    if (!gt(timer, 0)) return false;
    writeNumber(timer, 0);
    subUS(scratch.gameSpeed, speed);
    return true;
}

function addPotionSpeed(speed: i32): void {
    addUS(scratch.gameSpeed, speed);
}

function updateTimedPotionEffects(itemId: i32, seconds: i32): void {
    for (let index: i32 = 0; index < 10; index++) {
        const timer = potionTimer(itemId, index);
        if (!gt(timer, 0)) continue;
        if (lte(timer, seconds)) clearPotionEffect(itemId, index);
        else subUS(timer, seconds);
    }
}

function potionTimer(itemId: i32, index: i32): i32 {
    if (itemId === INVENTORY_POTION_OF_SPEED) return potionSpeedTimers[index];
    if (itemId === INVENTORY_POTION_OF_SPEED_II) return potionSpeedIITimers[index];
    return potionSpeedIIITimers[index];
}

export function getGameSpeed(): i32 {
    if (isProducerOnlyCrystalActive() || isAllMultipliersDisabledCrystalActive()) {
        writeNumber(scratch.effectiveGameSpeed, 1);
        return scratch.effectiveGameSpeed;
    }
    copyInto(scratch.effectiveGameSpeed, scratch.gameSpeed);
    writeNumber(scratch.productionModifier, equipmentGameSpeedMultiplier());
    mulUS(scratch.effectiveGameSpeed, scratch.productionModifier);
    if (gt(player.courageTimer, 0)) mulUS(scratch.effectiveGameSpeed, player.courageMultiplier);
    if (isFocusing()) mulUS(scratch.effectiveGameSpeed, focusGameSpeedMultiplier());
    divUS(scratch.effectiveGameSpeed, abyssGameSpeedDivisorHandle());
    return scratch.effectiveGameSpeed;
}

export function isGameSpeedIncreased(): bool {
    return gt(getGameSpeed(), 1);
}

export function hasActivePotionEffects(): bool {
    return gt(scratch.gameSpeed, 1);
}

export function initializePotionSpeedTimers(
    timer0: i32, timer1: i32, timer2: i32, timer3: i32, timer4: i32,
    timer5: i32, timer6: i32, timer7: i32, timer8: i32, timer9: i32,
): void {
    potionSpeedTimers[0] = timer0; potionSpeedTimers[1] = timer1; potionSpeedTimers[2] = timer2;
    potionSpeedTimers[3] = timer3; potionSpeedTimers[4] = timer4; potionSpeedTimers[5] = timer5;
    potionSpeedTimers[6] = timer6; potionSpeedTimers[7] = timer7; potionSpeedTimers[8] = timer8;
    potionSpeedTimers[9] = timer9;
}

export function initializePotionSpeedIITimers(
    timer0: i32, timer1: i32, timer2: i32, timer3: i32, timer4: i32,
    timer5: i32, timer6: i32, timer7: i32, timer8: i32, timer9: i32,
): void {
    potionSpeedIITimers[0] = timer0; potionSpeedIITimers[1] = timer1; potionSpeedIITimers[2] = timer2;
    potionSpeedIITimers[3] = timer3; potionSpeedIITimers[4] = timer4; potionSpeedIITimers[5] = timer5;
    potionSpeedIITimers[6] = timer6; potionSpeedIITimers[7] = timer7; potionSpeedIITimers[8] = timer8;
    potionSpeedIITimers[9] = timer9;
}

export function initializePotionSpeedIIITimers(
    timer0: i32, timer1: i32, timer2: i32, timer3: i32, timer4: i32,
    timer5: i32, timer6: i32, timer7: i32, timer8: i32, timer9: i32,
): void {
    potionSpeedIIITimers[0] = timer0; potionSpeedIIITimers[1] = timer1; potionSpeedIIITimers[2] = timer2;
    potionSpeedIIITimers[3] = timer3; potionSpeedIIITimers[4] = timer4; potionSpeedIIITimers[5] = timer5;
    potionSpeedIIITimers[6] = timer6; potionSpeedIIITimers[7] = timer7; potionSpeedIIITimers[8] = timer8;
    potionSpeedIIITimers[9] = timer9;
}

export function ensureInventoryPlacements(): void {
    let wolfFur: i32 = 0;
    let potions: i32 = 0;
    let needsRepair = false;
    const storedItems = new StaticArray<u8>(INVENTORY_SIZE);
    const storedMetadata = new StaticArray<u8>(INVENTORY_SIZE);
    let storedItemCount: i32 = 0;
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        const item = inventorySlots[position];
        if (isInventoryItem(item)) {
            const metadata = item === INVENTORY_PACKAGE ? inventoryMetadata[position] : 0;
            if (item !== INVENTORY_PACKAGE) inventoryMetadata[position] = 0;
            if (item === INVENTORY_PACKAGE && !canPackageItem(metadata)) {
                inventorySlots[position] = INVENTORY_EMPTY;
                inventoryMetadata[position] = 0;
                needsRepair = true;
                continue;
            }
            storedItems[storedItemCount++] = item;
            storedMetadata[storedItemCount - 1] = metadata;
            if (!storedInventoryShapeIsValid(position, item)) needsRepair = true;
            const containedItem = item === INVENTORY_PACKAGE ? metadata : item;
            const amount: i32 = item === INVENTORY_PACKAGE ? PACKAGE_SIZE : 1;
            if (containedItem === INVENTORY_WOLF_FUR) wolfFur += amount;
            else if (containedItem === INVENTORY_POTION_OF_SPEED) potions += amount;
        }
        else if (!isInventoryItem(item) && item !== INVENTORY_CONTINUATION) {
            inventorySlots[position] = INVENTORY_EMPTY;
            inventoryMetadata[position] = 0;
        }
    }
    if (needsRepair) {
        for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
            inventorySlots[position] = INVENTORY_EMPTY;
            inventoryMetadata[position] = 0;
        }
        for (let index: i32 = 0; index < storedItemCount; index++) {
            const position = findInventorySpace(storedItems[index]);
            if (position >= 0) placeInventoryItem(position, storedItems[index], storedMetadata[index]);
        }
    }
    if (wolfFur === 0 && potions === 0) {
        const legacyWolfFur = <i32>Math.min(100, getMagnitude(player.inventoryWolfFur));
        const legacyPotions = <i32>Math.min(100, getMagnitude(player.inventoryPotionOfSpeed));
        wolfFur = placeInventoryItems(INVENTORY_WOLF_FUR, legacyWolfFur);
        potions = placeInventoryItems(INVENTORY_POTION_OF_SPEED, legacyPotions);
    }
    compressAllLooseItems();
    writeNumber(player.inventoryWolfFur, wolfFur);
    writeNumber(player.inventoryPotionOfSpeed, potions);
    inventoryRevision++;
}

function storedInventoryShapeIsValid(position: i32, item: u8): bool {
    const width = inventoryItemWidth(item);
    const height = inventoryItemHeight(item);
    if (position % INVENTORY_WIDTH + width > INVENTORY_WIDTH) return false;
    if (position / INVENTORY_WIDTH + height > INVENTORY_SIZE / INVENTORY_WIDTH) return false;
    for (let row: i32 = 0; row < height; row++) {
        for (let column: i32 = 0; column < width; column++) {
            if (row === 0 && column === 0) continue;
            if (inventorySlots[position + row * INVENTORY_WIDTH + column] !== INVENTORY_CONTINUATION) return false;
        }
    }
    return true;
}

export function questRank(index: i32): i32 {
    const id = questDefinitionId(index);
    if (id >= 32) return 5;
    if (id >= 27) return 4;
    if (id >= 22) return 3;
    if (id >= 17) return 2;
    if (id >= 12) return 1;
    return 0;
}

export function acceptGuildQuest(index: i32): bool {
    if (!player.guildMember || isQuestActive() || index < 0 || index >= visibleQuestSlotCount() || isQuestSlotLocked(index)) return false;
    questResultPending = false;
    writeNumber(player.activeQuest, index);
    copyInto(player.quests_currentAvailableMana, player.highestManaReached);
    copyInto(player.enemyHealth, enemyMaximumHealth(index));
    writeNumber(player.combatFreezeTurns, 0);
    player.combatUsedNonFreeze = false;
    log10Into(player.combatShieldMaximum, player.quests_currentAvailableMana);
    writeNumber(scratch.productionModifier, equipmentMaximumShieldMultiplier());
    mulUS(player.combatShieldMaximum, scratch.productionModifier);
    copyInto(player.combatShield, player.combatShieldMaximum);
    resetCombatSpellCosts();
    return true;
}

export function castCombatSpell(index: i32): bool {
    if (!canCastCombatSpell(index)) return false;
    const cost = combatSpellCost(index);
    divUS(player.quests_currentAvailableMana, cost);
    if (index !== 2) player.combatUsedNonFreeze = true;
    writeNumber(scratch.productionModifier, 1.1);
    powUS(cost, scratch.productionModifier);
    const scalingExponent = combatSpellScalingExponent(index);
    writeDecimal(scratch.productionModifier, 1, 1, scalingExponent);
    mulUS(cost, scratch.productionModifier);
    writeNumber(scratch.currencyGain, combatSpellDamage(index));
    writeNumber(scratch.productionModifier, equipmentBattleDamageMultiplier());
    mulUS(scratch.currencyGain, scratch.productionModifier);
    subUS(player.enemyHealth, scratch.currencyGain);
    if (index === 2) writeNumber(player.combatFreezeTurns, 2);
    if (lte(player.enemyHealth, 0)) {
        finishQuest(true);
        return true;
    }
    wolfineTurn();
    return true;
}

export function abandonGuildQuest(): void {
    if (isQuestActive()) finishQuest(false);
}

export function isManaConduitProductionDisabled(): bool {
    return isQuestActive();
}

export function setActiveQuest(index: i32): void {
    writeNumber(player.activeQuest, index);
}

function wolfineTurn(): void {
    if (gt(player.combatFreezeTurns, 0)) {
        subUS(player.combatFreezeTurns, 1);
        return;
    }
    const rankMultiplier = 1 << questRank(activeQuestIndex());
    const damage = (20 + nextCombatRandom(31)) * rankMultiplier;
    writeNumber(scratch.productionModifier, <f64>damage * equipmentDamageTakenMultiplier());
    subUS(player.combatShield, scratch.productionModifier);
    if (lte(player.combatShield, 0)) finishQuest(false);
}

function nextCombatRandom(range: i32): i32 {
    combatRandomState = combatRandomState * 1664525 + 1013904223;
    if(combatRandomState > 1e100) {
        combatRandomState = 0x8fadef;
    }
    return <i32>(combatRandomState % <u32>range);
}

function finishQuest(victory: bool): void {
    if (victory) {
        const completedSlot = activeQuestIndex();
        const completedQuest = questDefinitionId(completedSlot);
        if (questRank(completedSlot) >= 2 && !player.combatUsedNonFreeze) unlockTierOneAchievement(32);
        const unlockedDRankAchievement = questRank(completedSlot) >= 2 && unlockTierOneAchievement(39);
        if (questRank(completedSlot) >= 3) unlockTierOneAchievement(49);
        if (questRank(completedSlot) >= 4) unlockTierOneAchievement(54);
        lastCompletedQuestDefinition = completedQuest;
        if (completedSlot >= 0 && completedSlot < QUEST_SLOT_COUNT) questSlotLocked[completedSlot] = 1;
        awardQuestRewards(completedQuest);
        awardQuestEquipment(questRank(completedSlot));
        if (unlockedDRankAchievement) placeInventoryItems(INVENTORY_POTION_OF_SPEED_III, 5);
        lastWolfFurReward = rewardAmountForItem(INVENTORY_WOLF_FUR);
        lastPotionReward = rewardAmountForItem(INVENTORY_POTION_OF_SPEED);
        lastWolfFurDropped = rewardDroppedForItem(INVENTORY_WOLF_FUR);
        lastPotionDropped = rewardDroppedForItem(INVENTORY_POTION_OF_SPEED);
        questResultPending = true;
        addUS(player.statistics_questsCompleted, 1);
        const currentRank = <i32>getMagnitude(player.guildRank);
        addGuildExperience(questRank(completedSlot), currentRank);
        const requirement = guildExperienceRequirement();
        if (cantRankUp()) {
            guildExperience = Math.min(guildExperience, requirement * 0.99);
        } else if (guildExperience >= requirement) {
            writeNumber(player.guildRank, currentRank + 1);
            resetGuildExperienceByQuestRank();
            unlockTierOneAchievement(29);
            refreshQuestDefinitions();
        }
        unlockTierOneAchievement(26);
        if (gte(player.statistics_questsCompleted, 10)) unlockTierOneAchievement(28);
    }
    writeNumber(player.activeQuest, NO_ACTIVE_QUEST);
    writeNumber(player.quests_currentAvailableMana, 0);
    writeNumber(player.enemyHealth, 0);
    if (victory && hasMireguardSetBonus()) {
        copyInto(player.combatShield, player.combatShieldMaximum);
        writeNumber(scratch.productionModifier, 0.2);
        mulUS(player.combatShield, scratch.productionModifier);
    } else {
        writeNumber(player.combatShield, 0);
    }
    writeNumber(player.combatFreezeTurns, 0);
    player.combatUsedNonFreeze = false;
    resetCombatSpellCosts();
}

export function initializeLegacyQuestAvailableMana(): void {
    if (isQuestActive()) copyInto(player.quests_currentAvailableMana, player.highestManaReached);
}

function addGuildExperience(completedQuestRank: i32, currentRank: i32): void {
    const earnedExperience = Math.pow(2, completedQuestRank + 1);
    if (completedQuestRank >= currentRank) {
        guildExperience += earnedExperience;
        return;
    }
    const requirement = guildExperienceRequirement();
    const maximumContribution = requirement * (completedQuestRank === currentRank - 1 ? 0.5 : 0.25);
    const availableContribution = Math.max(0, maximumContribution - guildExperienceByQuestRank[completedQuestRank]);
    const awardedExperience = Math.min(earnedExperience, availableContribution);
    guildExperienceByQuestRank[completedQuestRank] += awardedExperience;
    guildExperience += awardedExperience;
}

function resetGuildExperienceByQuestRank(): void {
    for (let rank: i32 = 0; rank < GUILD_RANK_COUNT; rank++) guildExperienceByQuestRank[rank] = 0;
}

function refreshQuestDefinitions(): void {
    const rank = <i32>getMagnitude(player.guildRank);
    const minimumId = minimumQuestDefinitionId(rank);
    const maximumId = maximumQuestDefinitionId(rank);
    for (let slot: i32 = 0; slot < QUEST_SLOT_COUNT; slot++) {
        let id: i32;
        do id = minimumId + nextCombatRandom(maximumId - minimumId + 1);
        while (questDefinitionAlreadyUsed(slot, id));
        questDefinitionIds[slot] = id;
    }
}

function questDefinitionsMatchCurrentRank(): bool {
    const rank = <i32>getMagnitude(player.guildRank);
    const minimumId = minimumQuestDefinitionId(rank);
    const maximumId = maximumQuestDefinitionId(rank);
    for (let slot: i32 = 0; slot < QUEST_SLOT_COUNT; slot++) {
        const id = questDefinitionIds[slot];
        if (id < minimumId || id > maximumId) return false;
    }
    return true;
}

function minimumQuestDefinitionId(rank: i32): i32 {
    if (rank >= 6) return 27;
    if (rank >= 5) return 22;
    if (rank >= 4) return 17;
    if (rank >= 3) return 12;
    return 0;
}

function maximumQuestDefinitionId(rank: i32): i32 {
    if (rank >= 5) return 36;
    if (rank >= 4) return 31;
    if (rank >= 3) return 26;
    if (rank >= 2) return 21;
    if (rank >= 1) return 16;
    return 11;
}

function questDefinitionAlreadyUsed(slot: i32, id: i32): bool {
    for (let previous: i32 = 0; previous < slot; previous++) if (questDefinitionIds[previous] === id) return true;
    return false;
}

function awardQuestRewards(quest: i32): void {
    for (let reward: i32 = 0; reward < MAX_QUEST_REWARDS; reward++) {
        const item = questRewardItem(quest, reward);
        const minimum = questRewardMinimum(quest, reward);
        const maximum = questRewardMaximum(quest, reward);
        if (item === 0 || maximum <= 0) {
            lastRewardItems[reward] = 0;
            lastRewardAmounts[reward] = 0;
            lastRewardDropped[reward] = 0;
            continue;
        }
        const amount = minimum + nextCombatRandom(maximum - minimum + 1);
        lastRewardItems[reward] = item;
        lastRewardAmounts[reward] = amount;
        lastRewardDropped[reward] = amount - placeInventoryItems(<u8>item, amount);
    }
}

function awardQuestEquipment(completedQuestRank: i32): void {
    if (completedQuestRank < 1 || !hasGuildShopUpgrade(5)) return;
    const reward = MAX_QUEST_REWARDS - 1;
    const item = randomEquipmentForQuestRank(completedQuestRank);
    lastRewardItems[reward] = item;
    lastRewardAmounts[reward] = 1;
    lastRewardDropped[reward] = 1 - placeInventoryItems(<u8>item, 1);
}

function randomEquipmentForQuestRank(completedQuestRank: i32): i32 {
    if (completedQuestRank >= 8) {
        return INVENTORY_ARMOR_START + 8 * INVENTORY_ARMOR_ITEMS_PER_SET
            + nextCombatRandom(2 * INVENTORY_ARMOR_ITEMS_PER_SET);
    }
    if (completedQuestRank === 7) {
        return INVENTORY_ARMOR_START + 6 * INVENTORY_ARMOR_ITEMS_PER_SET
            + nextCombatRandom(2 * INVENTORY_ARMOR_ITEMS_PER_SET);
    }
    return INVENTORY_ARMOR_START + (completedQuestRank - 1) * INVENTORY_ARMOR_ITEMS_PER_SET
        + nextCombatRandom(INVENTORY_ARMOR_ITEMS_PER_SET);
}

function questRewardItem(quest: i32, reward: i32): i32 {
    if (quest < 0 || quest >= QUEST_DEFINITION_COUNT || reward < 0 || reward >= MAX_QUEST_REWARDS) return 0;
    return questRewardItems[quest * MAX_QUEST_REWARDS + reward];
}

function questRewardMinimum(quest: i32, reward: i32): i32 {
    if (quest < 0 || quest >= QUEST_DEFINITION_COUNT || reward < 0 || reward >= MAX_QUEST_REWARDS) return 0;
    return questRewardMinimums[quest * MAX_QUEST_REWARDS + reward];
}

function questRewardMaximum(quest: i32, reward: i32): i32 {
    if (quest < 0 || quest >= QUEST_DEFINITION_COUNT || reward < 0 || reward >= MAX_QUEST_REWARDS) return 0;
    return questRewardMaximums[quest * MAX_QUEST_REWARDS + reward];
}

function rewardAmountForItem(item: u8): i32 {
    let amount: i32 = 0;
    for (let reward: i32 = 0; reward < MAX_QUEST_REWARDS; reward++) if (lastRewardItems[reward] === item) amount += lastRewardAmounts[reward];
    return amount;
}

function rewardDroppedForItem(item: u8): i32 {
    let amount: i32 = 0;
    for (let reward: i32 = 0; reward < MAX_QUEST_REWARDS; reward++) if (lastRewardItems[reward] === item) amount += lastRewardDropped[reward];
    return amount;
}

function placeInventoryItems(item: u8, amount: i32): i32 {
    let placed: i32 = 0;
    for (; placed < amount; placed++) {
        if (canPackageItem(item) && looseInventoryItemCount(item) >= PACKAGE_SIZE - 1) {
            compressLooseItemsIntoPackage(item);
            continue;
        }
        const position = findInventorySpace(item);
        if (position < 0) break;
        placeInventoryItem(position, item);
    }
    if (placed > 0 && item <= INVENTORY_POTION_OF_SPEED) addUS(inventoryAmountHandle(item), placed);
    if (placed > 0) inventoryRevision++;
    return placed;
}

function findInventorySpace(item: u8): i32 {
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        if (inventoryPositionFits(item, position, -1)) return position;
    }
    return -1;
}

function inventoryPositionFits(item: u8, position: i32, ignoredPosition: i32): bool {
    if (!isInventoryItem(item) || position < 0 || position >= INVENTORY_SIZE) return false;
    const width = inventoryItemWidth(item);
    const height = inventoryItemHeight(item);
    if (position % INVENTORY_WIDTH + width > INVENTORY_WIDTH) return false;
    if (position / INVENTORY_WIDTH + height > INVENTORY_SIZE / INVENTORY_WIDTH) return false;
    for (let row: i32 = 0; row < height; row++) {
        for (let column: i32 = 0; column < width; column++) {
            const checked = position + row * INVENTORY_WIDTH + column;
            if (ignoredPosition >= 0 && inventoryCellBelongsToItem(checked, ignoredPosition, item)) continue;
            if (inventorySlots[checked] !== INVENTORY_EMPTY) return false;
        }
    }
    return true;
}

function placeInventoryItem(position: i32, item: u8, metadata: u8 = 0): void {
    const width = inventoryItemWidth(item);
    const height = inventoryItemHeight(item);
    for (let row: i32 = 0; row < height; row++) {
        for (let column: i32 = 0; column < width; column++) {
            const checked = position + row * INVENTORY_WIDTH + column;
            inventorySlots[checked] = row === 0 && column === 0 ? item : INVENTORY_CONTINUATION;
            inventoryMetadata[checked] = row === 0 && column === 0 ? metadata : 0;
        }
    }
}

function clearInventoryItem(position: i32, item: u8): void {
    const width = inventoryItemWidth(item);
    const height = inventoryItemHeight(item);
    for (let row: i32 = 0; row < height; row++) {
        for (let column: i32 = 0; column < width; column++) {
            inventorySlots[position + row * INVENTORY_WIDTH + column] = INVENTORY_EMPTY;
            inventoryMetadata[position + row * INVENTORY_WIDTH + column] = 0;
        }
    }
}

function isInventoryItem(item: u8): bool {
    return item !== INVENTORY_EMPTY
        && inventoryItemWidths[item] > 0
        && inventoryItemHeights[item] > 0;
}

function isArmor(item: u8): bool {
    const itemId = <i32>item;
    return itemId >= INVENTORY_ARMOR_START && itemId < INVENTORY_ARMOR_START + INVENTORY_ARMOR_ITEM_COUNT;
}

function canPackageItem(item: u8): bool {
    return item !== INVENTORY_PACKAGE && isInventoryItem(item) && !isArmor(item);
}

function looseInventoryItemCount(item: u8): i32 {
    let count: i32 = 0;
    for (let position: i32 = 0; position < INVENTORY_SIZE; position++) {
        if (inventorySlots[position] === item) count++;
    }
    return count;
}

function compressLooseItemsIntoPackage(item: u8): bool {
    if (!canPackageItem(item) || looseInventoryItemCount(item) < PACKAGE_SIZE - 1) return false;
    let packagePosition: i32 = -1;
    let removed: i32 = 0;
    for (let position: i32 = 0; position < INVENTORY_SIZE && removed < PACKAGE_SIZE - 1; position++) {
        if (inventorySlots[position] !== item) continue;
        if (packagePosition < 0) packagePosition = position;
        clearInventoryItem(position, item);
        removed++;
    }
    if (packagePosition < 0) return false;
    placeInventoryItem(packagePosition, INVENTORY_PACKAGE, item);
    return true;
}

function compressAllLooseItems(): void {
    for (let item: i32 = 1; item < <i32>INVENTORY_PACKAGE; item++) {
        if (!canPackageItem(<u8>item)) continue;
        while (looseInventoryItemCount(<u8>item) >= PACKAGE_SIZE) {
            let removed: i32 = 0;
            let packagePosition: i32 = -1;
            for (let position: i32 = 0; position < INVENTORY_SIZE && removed < PACKAGE_SIZE; position++) {
                if (inventorySlots[position] !== item) continue;
                if (packagePosition < 0) packagePosition = position;
                clearInventoryItem(position, <u8>item);
                removed++;
            }
            if (packagePosition < 0) break;
            placeInventoryItem(packagePosition, INVENTORY_PACKAGE, <u8>item);
        }
    }
}

export function inventoryItemSellMinimum(item: i32): i32 {
    if (item < 0 || item >= 256) return 0;
    return effectiveInventorySellPrice(<i32>inventoryItemSellMinimums[item]);
}

export function inventoryItemSellMaximum(item: i32): i32 {
    if (item < 0 || item >= 256) return 0;
    return effectiveInventorySellPrice(<i32>inventoryItemSellMaximums[item]);
}

function effectiveInventorySellPrice(price: i32): i32 {
    return hasTierOneAchievement(34) ? <i32>Math.ceil(<f64>price * 1.5) : price;
}

function inventoryItemWidth(item: u8): i32 {
    const width = inventoryItemWidths[item];
    return width > 0 ? width : 1;
}

function inventoryItemHeight(item: u8): i32 {
    const height = inventoryItemHeights[item];
    return height > 0 ? height : 1;
}

function inventoryCellBelongsToItem(cell: i32, position: i32, item: u8): bool {
    const relative = cell - position;
    if (relative < 0) return false;
    const row = relative / INVENTORY_WIDTH;
    const column = relative % INVENTORY_WIDTH;
    return row < inventoryItemHeight(item) && column < inventoryItemWidth(item);
}

function inventoryAmountHandle(item: u8): i32 {
    return item === INVENTORY_WOLF_FUR ? player.inventoryWolfFur : player.inventoryPotionOfSpeed;
}

function combatSpellCost(index: i32): i32 {
    switch (index) {
        case 0: return player.fireballCost;
        case 1: return player.whirlwindCost;
        case 2: return player.freezeCost;
        case 3: return advancedCombatSpellCosts[0];
        case 4: return advancedCombatSpellCosts[1];
        case 5: return advancedCombatSpellCosts[2];
        default: return 0;
    }
}

function combatSpellDamage(index: i32): i32 {
    switch (index) {
        case 0: return 35;
        case 1: return 60;
        case 2: return 10;
        case 3: return 120;
        case 4: return 250;
        case 5: return 500;
        default: return 0;
    }
}

function combatSpellScalingExponent(index: i32): f64 {
    if (index === 0) return 10;
    if (index === 1) return 20;
    if (index === 2) return hasTierOneAchievement(32) ? 10 : 30;
    if (index === 3) return 30;
    if (index === 4) return 40;
    return 50;
}

export function resetCombatSpellCosts(): void {
    writeDecimal(player.fireballCost, 1, 1, 40);
    writeDecimal(player.whirlwindCost, 1, 1, 80);
    writeDecimal(player.freezeCost, 1, 1, 120);
    writeDecimal(advancedCombatSpellCosts[0], 1, 1, 160);
    writeDecimal(advancedCombatSpellCosts[1], 1, 1, 220);
    writeDecimal(advancedCombatSpellCosts[2], 1, 1, 300);
}

/** [/WASM] */

GUILD_RANK_EXPERIENCE_REQUIREMENTS.forEach((requirement, rank) => {
    configureGuildRankExperienceRequirement(rank, requirement);
});
initializeQuestBoard();
initializePotionSpeedTimers(...POTION_SPEED_TIMER_HANDLES);
initializePotionSpeedIITimers(...POTION_SPEED_II_TIMER_HANDLES);
initializePotionSpeedIIITimers(...POTION_SPEED_III_TIMER_HANDLES);
initializeAdvancedCombatSpellCosts(...ADVANCED_COMBAT_SPELL_COST_HANDLES);
for (const item of INVENTORY_ITEMS) {
    configureInventoryItem(item.id, item.width, item.height);
    configureInventoryItemSellPrice(item.id, item.sellPrice[0], item.sellPrice[1]);
}
for (const upgrade of GUILD_SHOP_UPGRADES) {
    configureGuildShopUpgradeCost(upgrade.id, upgrade.cost);
}
refreshShopItems();
for (const quest of GUILD_QUESTS) {
    quest.rewards.forEach((reward, rewardIndex) => {
        const [minimumText, maximumText = minimumText] = reward.amount.split("-");
        configureQuestReward(quest.id, rewardIndex, reward.item, Number(minimumText), Number(maximumText));
    });
}
