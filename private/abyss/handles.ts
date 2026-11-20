import { createDecimal, createZero } from "../core/break_eternity.js";

export class AbyssHandles {
    sonicValue: i32 = 0;
    sonicDrain: i32 = 0;
    sonicDivisor: i32 = 0;
    productionPower: i32 = 0;
    potionResonance: i32 = 0;
    matrixResonance: i32 = 0;
    meridianResonance: i32 = 0;
    meditationResonance: i32 = 0;
    boostResonance: i32 = 0;
    memoryResonance: i32 = 0;
    condenseResonance: i32 = 0;
    purificationResonance: i32 = 0;
    courageResonance: i32 = 0;
    resonanceBonus: i32 = 0;
    calculationA: i32 = 0;
    calculationB: i32 = 0;
    calculationC: i32 = 0;
    logarithmicValue: i32 = 0;
    perBoostBonus: i32 = 0;
}

const Z = createZero;
const D = createDecimal;

export const ABYSS_HANDLES: AbyssHandles = {
    sonicValue: Z(),
    sonicDrain: Z(),
    sonicDivisor: Z(),
    productionPower: D(1, 0, 1),
    potionResonance: Z(),
    matrixResonance: Z(),
    meridianResonance: Z(),
    meditationResonance: Z(),
    boostResonance: Z(),
    memoryResonance: Z(),
    condenseResonance: Z(),
    purificationResonance: Z(),
    courageResonance: Z(),
    resonanceBonus: D(1, 0, 1),
    calculationA: Z(),
    calculationB: Z(),
    calculationC: Z(),
    logarithmicValue: Z(),
    perBoostBonus: Z(),
};

/** [WASM] */

export const abyss: AbyssHandles = {
    sonicValue: 0,
    sonicDrain: 0,
    sonicDivisor: 0,
    productionPower: 0,
    potionResonance: 0,
    matrixResonance: 0,
    meridianResonance: 0,
    meditationResonance: 0,
    boostResonance: 0,
    memoryResonance: 0,
    condenseResonance: 0,
    purificationResonance: 0,
    courageResonance: 0,
    resonanceBonus: 0,
    calculationA: 0,
    calculationB: 0,
    calculationC: 0,
    logarithmicValue: 0,
    perBoostBonus: 0,
};

export function initializeAbyss(
    sonicValue: i32, sonicDrain: i32, sonicDivisor: i32, productionPower: i32,
    potionResonance: i32, matrixResonance: i32, meridianResonance: i32,
    meditationResonance: i32, boostResonance: i32, memoryResonance: i32,
    condenseResonance: i32, purificationResonance: i32, courageResonance: i32,
    resonanceBonus: i32, calculationA: i32, calculationB: i32, calculationC: i32,
    logarithmicValue: i32, perBoostBonus: i32,
): void {
    abyss.sonicValue = sonicValue;
    abyss.sonicDrain = sonicDrain;
    abyss.sonicDivisor = sonicDivisor;
    abyss.productionPower = productionPower;
    abyss.potionResonance = potionResonance;
    abyss.matrixResonance = matrixResonance;
    abyss.meridianResonance = meridianResonance;
    abyss.meditationResonance = meditationResonance;
    abyss.boostResonance = boostResonance;
    abyss.memoryResonance = memoryResonance;
    abyss.condenseResonance = condenseResonance;
    abyss.purificationResonance = purificationResonance;
    abyss.courageResonance = courageResonance;
    abyss.resonanceBonus = resonanceBonus;
    abyss.calculationA = calculationA;
    abyss.calculationB = calculationB;
    abyss.calculationC = calculationC;
    abyss.logarithmicValue = logarithmicValue;
    abyss.perBoostBonus = perBoostBonus;
}

/** [/WASM] */

const abyssValues = Object.values(ABYSS_HANDLES);
initializeAbyss(
    abyssValues[0],
    abyssValues[1],
    abyssValues[2],
    abyssValues[3],
    abyssValues[4],
    abyssValues[5],
    abyssValues[6],
    abyssValues[7],
    abyssValues[8],
    abyssValues[9],
    abyssValues[10],
    abyssValues[11],
    abyssValues[12],
    abyssValues[13],
    abyssValues[14],
    abyssValues[15],
    abyssValues[16],
    abyssValues[17],
    abyssValues[18],
);
