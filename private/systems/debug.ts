import { readLayer, readMagnitude, readSign, writeNumber, readString } from "../core/break_eternity.js";
import { CONDENSED_UPGRADE_COUNT, setCondensedUpgrade } from "../game/condensed.js";
import { clampManaToInfinityBoundary } from "../game/currencies.js";
import { HANDLES } from "../core/player.js";
import { refreshMatrixDerivedState, refreshSealedMeridiansDerivedState } from "../game/progression.js";
import { buyMaxAllTierOne, buyMaxTierOne, canBuyTierOne, isTierOneVisible, refreshTierOneDerivedState, tierOneBoughtHandle, tierOneCostHandle } from "../game/tier_one.js";
import { setTotalMemories } from "../game/memories.js";
import { setGuildShopUpgrade, setQuestRefreshRemaining } from "../guild/guild.js";
import { ABYSS_HANDLES } from "../abyss/handles.js";
import { setMemorials } from "../game/remembrance.js";

const PRODUCER_AMOUNT_HANDLES = [
    HANDLES.count_manaConduit,
    HANDLES.count_conduitConjugation,
    HANDLES.count_conjugationCreation,
    HANDLES.count_creationManufactory,
    HANDLES.count_manufactureStaff,
];

function decimalDebug(handle: number) {
    return {
        value: readString(handle),
        sign: readSign(handle),
        layer: readLayer(handle),
        magnitude: readMagnitude(handle),
    };
}

function producerDebug(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= PRODUCER_AMOUNT_HANDLES.length) {
        throw new Error("Producer index must be an integer from 0 to 4");
    }
    return {
        index,
        visible: isTierOneVisible(index),
        affordable: canBuyTierOne(index),
        mana: decimalDebug(HANDLES.mana),
        cost: decimalDebug(tierOneCostHandle(index)),
        amount: decimalDebug(PRODUCER_AMOUNT_HANDLES[index]),
        bought: decimalDebug(tierOneBoughtHandle(index)),
    };
}

(globalThis as any).inspectProducer = (index = 0) => {
    const state = producerDebug(index);
    console.log("Producer state", state);
    return state;
};

(globalThis as any).debugBuyMaxProducer = (index = 0) => {
    const before = producerDebug(index);
    const result = buyMaxTierOne(index);
    const after = producerDebug(index);
    const debug = { result, before, after };
    console.log("Producer Cast Max", debug);
    return debug;
};

(globalThis as any).debugBuyMaxAllProducers = () => {
    const before = PRODUCER_AMOUNT_HANDLES.map((_, index) => producerDebug(index));
    buyMaxAllTierOne();
    const after = PRODUCER_AMOUNT_HANDLES.map((_, index) => producerDebug(index));
    const debug = { before, after };
    console.log("Producer Cast Max All", debug);
    return debug;
};

(globalThis as any).readValue = (value: keyof typeof HANDLES) => {
    return readString(HANDLES[value] ?? HANDLES.mana);
};

(globalThis as any).assignValue = (value: keyof typeof HANDLES, number: number) => {
    writeNumber(HANDLES[value] ?? HANDLES.mana, number);
    refreshTierOneDerivedState();
    refreshSealedMeridiansDerivedState();
    refreshMatrixDerivedState();
    clampManaToInfinityBoundary();
};

(globalThis as any).assignAbyss = (value: keyof typeof ABYSS_HANDLES, number: number) => {
    writeNumber(ABYSS_HANDLES[value] ?? ABYSS_HANDLES.sonicValue, number);
}

(globalThis as any).assignOwned = (category: string, index: number, owned: boolean) => {
    if (category !== "condensed") throw new Error(`Unknown owned category: ${category}`);
    if (!Number.isInteger(index) || index < 0 || index >= CONDENSED_UPGRADE_COUNT) {
        throw new Error(`Condensed upgrade index must be an integer from 0 to ${CONDENSED_UPGRADE_COUNT - 1}`);
    }
    setCondensedUpgrade(index, owned);
    refreshSealedMeridiansDerivedState();
    refreshMatrixDerivedState();
    refreshSealedMeridiansDerivedState();
    refreshTierOneDerivedState();
};

(globalThis as any).assignMemories = (number: number) => {
    return setTotalMemories(number);
}

(globalThis as any).assignSonicValue = (number: number) => {
    writeNumber(ABYSS_HANDLES.sonicValue, Math.max(0, number));
};

(globalThis as any).refreshQuests = () => {
    setQuestRefreshRemaining(0);
}

(globalThis as any).assignShopOwned = (index: number, owned: boolean) => {
    if (!Number.isInteger(index) || index < 0 || index >= 12) {
        throw new Error("Guild shop upgrade index must be an integer from 0 to 11");
    }

    setGuildShopUpgrade(index, owned);

    refreshTierOneDerivedState();
    refreshSealedMeridiansDerivedState();
    refreshMatrixDerivedState();
};


(globalThis as any).assignMemorials = setMemorials;
