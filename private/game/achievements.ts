import { addUS, divInto, gt, gte, log10Into, mulUS, powUS, reachesLayerBoundary, writeDecimal, writeNumber } from "../core/break_eternity.js";
import type { Player } from "../core/player.js";
import type { Scratch } from "../core/scratch.js";
import { crystalRewardHandle, hasCompletedCrystal } from "./crystals.js";

export const ACHIEVEMENTS = [
    { id: "achievement_difficulty", number: 13, title: "I think this is called difficulty", description: "Reach the limit of your mana circle without any Crystal Matrices.", reward: "Increase Crystal Matrix effect by +0.1×", category: "challenge" },
    { id: "achievement_lightning", number: 16, title: "Lightning", description: "Condense in under 1 minute.", reward: "Each tier 1 producer gains a production bonus based on its tier, from +1% to +5%.", category: "challenge" },
    { id: "achievement_matrixmanipulation", number: 21, title: "Matrix Manipulation", description: "Conjure a Crystal Matrix without sealing another Meridian.", reward: "Reduce Sealed Meridian cost scaling by 5%", category: "challenge" },
    { id: "achievement_noendgame", number: 18, title: "I don't believe in the Endgame", description: "Condense without purifying Meridians.", reward: "Purification of Meridians is ×5 stronger", category: "challenge" },
    { id: "achievement_unnecessary", number: 22, title: "Unnecessary", description: "Condense without meditating.", reward: "Start each Condense with 1 Crystal Matrix", category: "challenge" },

    { id: "achievement_hatethetaste", number: 31, title: "I hate the taste!", description: "Condense without any potion effects.", reward: "Potions are ×1.25 stronger", category: "challenge"},
    { id: "achievement_lovethetaste", number: 32, title: "Actually, I love the taste!", description: "Drink 20 potions at once. (Note: you can only drink 10 of the same potion level at once)", reward: "Increase potion durations by 30 seconds", category: "challenge" },
    { id: "achievement_freezeonly", number: 33, title: "Where's my supa suit!", description: "Defeat a D-rank or stronger enemy using only Freeze.", reward: "Freeze scales by 1e20 less per cast", category: "challenge" },
    { id: "achievement_noboosting", number: 34, title: "Booster? I hardly know 'er!", description: "Condense without boosting any producer.", reward: "Increase per-boost multiplier by +0.01×", category: "challenge" },
    { id: "achievement_sellfullinventory", number: 35, title: "Will this be enough?", description: "Sell an entire inventory of items.", reward: "+50% Sell price", category: "challenge" },

    { id: "achievement_buymanaconduit", number: 1, title: "Something feels.. familiar", description: "Purchase a Mana Absorber.", reward: "+1% mana production" },
    { id: "achievement_buyconduitconjugation", number: 2, title: "Meta Production", description: "Purchase a Pylon.", reward: "+2% mana production" },
    { id: "achievement_buyconjugationcreation", number: 3, title: "The promised achievement", description: "Purchase a Conduit.", reward: "+3% mana production" },
    { id: "achievement_buycreationmanufactory", number: 4, title: "Electrical Engineering", description: "Purchase a Circuit.", reward: "+4% mana production" },
    { id: "achievement_buymanufacturestaff", number: 5, title: "There should've been 9", description: "Purchase a Meridian.", reward: "+5% mana production" },

    { id: "achievement_playtwohours", number: 6, title: "Thanks!", description: "Play for 1 hour.", reward: "Mana is increased based on time played", dynamicReward: "time-played" },
    { id: "achievement_sealmeridians", number: 7, title: "Grandmeridian", description: "Reach 5 Sealed Meridians." },
    { id: "achievement_havesixstaff", number: 8, title: "Double the Sith", description: "Have at least 12 Meridians.", reward: "Unlock Purification of Meridians" },
    { id: "achievement_produce1e50mana", number: 9, title: "100 quindecillion mana is a lot", description: "Produce 1.00e50 mana.", reward: "Reset with 500 mana" },
    { id: "achievement_castspeedminute", number: 10, title: "This lasts like.. forever!", description: "Have over 1 minute of Meditation time.", reward: "Meditation time is increased by 5 seconds per use" },

    { id: "achievement_centennial", number: 11, title: "Centennial", description: "Reach 1.00e100 Mana.", reward: "Increase per-boost multiplier by +0.1×" },
    { id: "achievement_circularhabits", number: 12, title: "Circular Habits", description: "Reach the limit of your mana circle.", reward: "Get 3 Potion of Speed II" },
    { id: "achievement_realnews", number: 14, title: "REAL NEWS!", description: "View 50 different ticker messages." },
    { id: "achievement_clicker", number: 15, title: "Clicker!", description: "Click over 1,000 times.", reward: "Carpel tunnel" },
    { id: "achievement_pleasedosleep", number: 17, title: "Please do sleep", description: "Be offline for more than an hour." },

    { id: "achievement_supercondensed", number: 19, title: "Super-Condensed", description: "Condense 50 times.", reward: "Gain ×2 more condensed mana" },
    { id: "achievement_empowertwice", number: 20, title: "Wait, you can get 2 of these?!", description: "Empower any producer twice." },
    { id: "achievement_timeforthefunpart", number: 23, title: "Time for the fun part", description: "Reach 10 condensed mana." },
    { id: "achievement_allcondensedupgrades", number: 24, title: "Is this the end of the game?", description: "Purchase every condensed upgrade?" },
    { id: "achievement_unlockguild", number: 26, title: "I should've related these two!", description: "Unlock the Guild." },

    { id: "achievement_firstquest", number: 27, title: "That was a battle! Literally", description: "Complete your first quest." },
    { id: "achievement_drinkpotion", number: 28, title: "It's bitter!", description: "Drink a potion." },
    { id: "achievement_tenquests", number: 29, title: "Will I rank up?", description: "Complete 10 quests." },
    { id: "achievement_hireautocaster", number: 36, title: "Today's topic.", description: "Hire your first auto-caster", reward: "10 coins"},

    { id: "achievement_imrich", number: 37, title: "I'm rich!", description: "Get 100 or more coins", reward: "The rich get richer (10 coins)" },
    { id: "achievement_fourthquestslot", number: 52, title: "It's just growing there... menacingly!", description: "Unlock a 4th quest slot." },
    { id: "achievement_buytier3caster", number: 38, title: "Faster!!", description: "Hire a tier 3 or higher auto-caster", reward: "Autocasters work ×2 faster" },
    { id: "achievement_completeachallenge", number: 39, title: "Rough place", description: "Acquire any challenge achievement", reward: "A sense of accomplishment" },
    { id: "achievement_empowerthrice", number: 42, title: "This was expected!", description: "Empower any producer thrice.", reward: "Empowerment is 10% stronger." },
    { id: "achievement_enterascensionhall", number: 41, title: "To face the gods", description: "Enter the ascension hall...", reward: "Gain ×2 more condensed mana" },

    { id: "achievement_newhorizons", circle: 2, number: 25, title: "LilysMana: New Horizons", description: "Expand your mana circle." },
    { id: "achievement_rankupe", circle: 2, number: 30, title: "Yes you will!", description: "Rank up to E tier." },
    { id: "achievement_beatdtier", circle: 2, number: 40, title: "Boi that was so Tuff", description: "Defeat a D-tier or higher enemy", reward: "5 Potion of Speed III" },
    { id: "achievement_get1e500mana", circle: 2, number: 43, title: "Half way there!", description: "Reach 1.00e500 Mana" },
    { id: "achievement_unlockcrystals", circle: 2, number: 44, title: "Icicles", description: "Unlock Crystals" },

    { id: "achievement_dontevenlad", circle: 2, number: 45, title: "Don't even joke, lad", description: "Reach 1.00e6767 Mana" },
    { id: "achievement_shattercrystal", circle: 2, number: 46, title: "Shattered Hearts", description: "Shatter a Crystal" },
    { id: "achievement_get25memories", circle: 2, number: 47, title: "I miss that kind of Memories", description: "Gain 25 memories" },
    { id: "achievement_defeatctier", circle: 2, number: 50, title: "C your way out of this", description: "Defeat a C tier enemy" },
    { id: "achievement_beatcrystal7", circle: 2, number: 51, title: "Keyboard Warrior", description: "Shatter Crystal 8 (Tip: Hold M, X, Y, and press P every few seconds!)" },

    { id: "achievement_remembrance", circle: 2, number: 53, title: "Remembrance", description: "Unlock the Remembrance Upgrade Tree (Memory Milestone 500)"},
    { id: "achievement_buyapath", circle: 2, number: 54, title: "Oh no not min-maxing!", description: "Purchase Remembrance upgrade 3, 4, or 5 (they aren't unique paths, thankfully!)" },
    { id: "achievement_shatter15crystal", circle: 2, number: 48, title: "Into the Abyss", description: "Shatter the first 15 Crystals" },
    { id: "achievement_loopabyss", circle: 2, number: 49, title: "Déjà vu", description: "Loop the abyss" },
    { id: "achievement_defeatbtier", circle: 2, number: 55, title: "B yourself!", description: "Defeat a B tier enemy"},
    { id: "achievement_firstresonance", circle: 2, number: 56, title: "A Distant Echo", description: "Unlock the first Resonance Tower." },
    { id: "achievement_allresonance", circle: 2, number: 57, title: "Ninefold resonance", description: "Unlock the ninth Resonance Tower." },
    { id: "achievement_fullsonic", circle: 2, number: 58, title: "Perfect Pitch", description: "Reach 1.000000 Sonic Value." },
    { id: "achievement_depth5000", circle: 2, number: 59, title: "Stick it where the sun don't shine", description: "Complete an Abyss run at 5,000 m or deeper." },
    { id: "achievement_depth10000", circle: 2, number: 60, title: "Crushing Infinity", description: "Complete an Abyss run at 10,000 m or deeper." },
];

export const PROGRESSION_ACHIEVEMENT_ORDER = [
     1,  2,  3,  4,  5,
    14, 15,  9, 10, 20,
    11,  7,  8, 26, 27,
    28, 29, 37, 12, 17,
    39,  6, 19, 36, 52,
    38, 42, 23, 24, 41,

    25, 30, 40, 43, 44,
    45, 46, 47, 51, 53, 
    54, 50, 55, 48, 56,
    59, 57, 49, 60, 58,
];

declare const player: Player;
declare const scratch: Scratch;

/** [WASM] */

const TIER_ONE_ACHIEVEMENT_COUNT: i32 = 5;
const ACHIEVEMENT_COUNT: i32 = 60;
const unlockedAchievements = new StaticArray<u8>(ACHIEVEMENT_COUNT);
let tierOneRewardsChanged = false;
let circularHabitsRewardPending = false;

export function hasTierOneAchievement(index: i32): bool {
    return index >= 0 && index < ACHIEVEMENT_COUNT && unlockedAchievements[index] !== 0;
}

export function setTierOneAchievement(index: i32, unlocked: bool): void {
    if (index < 0 || index >= ACHIEVEMENT_COUNT) return;
    const previous = hasTierOneAchievement(index);
    unlockedAchievements[index] = unlocked ? 1 : 0;
    if (previous !== unlocked) achievementRevision++;
    refreshAchievementRewards();
}

let achievementRevision: i32 = 0;

export function getAchievementRevision(): i32 {
    return achievementRevision;
}

export function unlockTierOneAchievement(index: i32): bool {
    let changed = false;
    if (!hasTierOneAchievement(index)) {
        setTierOneAchievement(index, true);
        if (index === 35 || index === 36) addUS(player.coins, 10);
        if (index === 11) circularHabitsRewardPending = true;
        if (index === 10 || index === 12 || index === 15 || index === 20 || index === 33) tierOneRewardsChanged = true;
        changed = true;
        if (isChallengeAchievement(index)) unlockTierOneAchievement(38);
        checkCoinAchievements();
    }
    if (index === 4 && gte(player.count_manufactureStaff, 12) && !hasTierOneAchievement(7)) {
        setTierOneAchievement(7, true);
        changed = true;
    }
    return changed;
}

export function checkCoinAchievements(): void {
    writeNumber(scratch.currencyGain, 100);
    if (gte(player.coins, scratch.currencyGain)) unlockTierOneAchievement(36);
}

function isChallengeAchievement(index: i32): bool {
    return index === 12 || index === 15 || index === 17 || index === 20 || index === 21
        || (index >= 30 && index <= 34);
}

export function consumeCircularHabitsReward(): bool {
    const pending = circularHabitsRewardPending;
    circularHabitsRewardPending = false;
    return pending;
}

export function checkTimeAchievements(): void {
    writeNumber(scratch.currencyGain, 3600);
    if (gte(player.statistics_totalTimePlayed, scratch.currencyGain)) unlockTierOneAchievement(5);
    refreshAchievementRewards();
}

export function checkManaAchievements(): void {
    writeDecimal(scratch.currencyGain, 1, 1, 50);
    if (gte(player.statistics_totalManaProduced, scratch.currencyGain)) unlockTierOneAchievement(8);
    if (reachesLayerBoundary(player.mana, 0)) unlockTierOneAchievement(11);
    if (reachesLayerBoundary(player.mana, 0) && !gt(player.matrixOwned, 0)) unlockTierOneAchievement(12);
    writeDecimal(scratch.currencyGain, 1, 1, 100);
    if (gte(player.mana, scratch.currencyGain)) unlockTierOneAchievement(10);
    writeDecimal(scratch.currencyGain, 1, 1, 500);
    if (gte(player.mana, scratch.currencyGain)) unlockTierOneAchievement(42);
    writeDecimal(scratch.currencyGain, 1, 1, 6767);
    if (gte(player.mana, scratch.currencyGain)) unlockTierOneAchievement(44);
}

export function checkOfflineAchievement(seconds: f64): void {
    if (seconds > 3600) unlockTierOneAchievement(16);
}

export function checkCastSpeedAchievements(): void {
    writeNumber(scratch.currencyGain, 60);
    if (gt(player.castSpeedTimer, scratch.currencyGain)) unlockTierOneAchievement(9);
}

export function hasPotionUsedThisCondense(): bool { return player.potionUsedThisCondense; }
export function setPotionUsedThisCondense(value: bool): void { player.potionUsedThisCondense = value; }
export function hasBoostedProducerThisCondense(): bool { return player.boostedProducerThisCondense; }
export function setBoostedProducerThisCondense(value: bool): void { player.boostedProducerThisCondense = value; }
export function hasCombatUsedNonFreeze(): bool { return player.combatUsedNonFreeze; }
export function setCombatUsedNonFreeze(value: bool): void { player.combatUsedNonFreeze = value; }

export function consumeTierOneRewardsChanged(): bool {
    const changed = tierOneRewardsChanged;
    tierOneRewardsChanged = false;
    return changed;
}

export function refreshAchievementRewards(): void {
    writeNumber(player.multiplier_currencyGlobal, 1);
    for (let index: i32 = 0; index < TIER_ONE_ACHIEVEMENT_COUNT; index++) {
        if (!hasTierOneAchievement(index)) continue;
        writeNumber(scratch.currencyGain, <f64>(index + 1) / 100);
        addUS(player.multiplier_currencyGlobal, scratch.currencyGain);
    }
    writeNumber(player.multiplier_timePlayedAchievement, 1);
    if (hasTierOneAchievement(5)) {
        divInto(scratch.currencyGain, player.statistics_totalTimePlayed, player.constant_timeAchievementDivisor);
        log10Into(scratch.currencyGain, scratch.currencyGain);
        mulUS(scratch.currencyGain, 2);
        if (gt(scratch.currencyGain, 1)) {
            writeNumber(player.multiplier_timePlayedAchievement, 0);
            addUS(player.multiplier_timePlayedAchievement, scratch.currencyGain);
        }
    }
    if (hasCompletedCrystal(7)) powUS(player.multiplier_timePlayedAchievement, crystalRewardHandle(7, 0));
    mulUS(player.multiplier_currencyGlobal, player.multiplier_timePlayedAchievement);
    writeNumber(player.multiplier_tierOnePerPurchase, 2);
    if (hasTierOneAchievement(10)) {
        writeNumber(scratch.currencyGain, 0.1);
        addUS(player.multiplier_tierOnePerPurchase, scratch.currencyGain);
    }
    if (hasTierOneAchievement(33)) {
        writeNumber(scratch.currencyGain, 0.01);
        addUS(player.multiplier_tierOnePerPurchase, scratch.currencyGain);
    }
}

export function recordClick(): void {
    addUS(player.statistics_totalClicks, 1);
    writeNumber(scratch.currencyGain, 1000);
    if (gt(player.statistics_totalClicks, scratch.currencyGain)) unlockTierOneAchievement(14);
}

/** [/WASM] */

refreshAchievementRewards();
