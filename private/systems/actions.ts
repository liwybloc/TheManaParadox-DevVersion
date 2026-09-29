import { namedWasm } from "../../generated/_wasm$globals.js";
import { SCRATCH_HANDLES } from "../core/scratch.js";
import { CRYSTALS } from "../game/crystals.js";
import { MEMORY_MILESTONES } from "../game/memories.js";
import { resetForCondense, saveGame } from "./save.js";

type CondenseListener = () => void;
type MemoryGainListener = (total: number, milestoneReached: boolean, memGained: number) => void;

const condenseListeners = new Set<CondenseListener>();
const memoryGainListeners = new Set<MemoryGainListener>();

export function condense(): boolean {
    if (!namedWasm.calculateCondenseGain()) return false;
    const focused = namedWasm.isFocusing();
    const memoryChance = focused ? namedWasm.memoryChance(SCRATCH_HANDLES.condenseGain) : 0;
    const previousMemories = namedWasm.getTotalMemories();
    resetForCondense();
    namedWasm.completeCondense();
    if (namedWasm.completeAbyssRun()) namedWasm.setInAbyss(true);
    // not cursed at all trust me... (im lazy)
    let memGained: number = 0;
    if (focused && (memGained = namedWasm.resolveFocusedCondense(Math.random(), memoryChance))) {
        const totalMemories = namedWasm.getTotalMemories();
        const milestoneReached = MEMORY_MILESTONES.some((milestone) =>
            milestone > previousMemories && milestone <= totalMemories
        );
        for (const listener of memoryGainListeners) listener(totalMemories, milestoneReached, memGained);
        if (totalMemories >= 25) namedWasm.unlockTierOneAchievement(46);
    }
    void saveGame();
    for (const listener of condenseListeners) listener();
    return true;
}

export function beginAbyssRun(): boolean {
    if (namedWasm.isFocusing()) return false;
    if (!namedWasm.beginAbyssRun()) return false;
    namedWasm.setInAbyss(false);
    resetForCondense();
    void saveGame();
    return true;
}

export function escapeAbyssRun(): boolean {
    if (!namedWasm.escapeAbyssRun()) return false;
    namedWasm.setInAbyss(true);
    resetForCondense();
    void saveGame();
    return true;
}

export function focus(): boolean {
    if (!namedWasm.isFocusing() && (namedWasm.isInAbyss() || namedWasm.isAbyssRunActive())) return false;
    if (!namedWasm.toggleFocus()) return false;
    resetForCondense();
    void saveGame();
    for (const listener of condenseListeners) listener();
    return true;
}

export function enterCrystal(index: number): boolean {
    if (namedWasm.isInAbyss() || namedWasm.isAbyssRunActive()) return false;
    if (!namedWasm.enterCrystal(index)) return false;
    namedWasm.setFocusing(false);
    resetForCondense();
    void saveGame();
    return true;
}

export function escapeCrystal(): boolean {
    if (!namedWasm.escapeCrystal()) return false;
    resetForCondense();
    void saveGame();
    return true;
}

export function shatterCrystal(): boolean {
    const shatteredCrystal = namedWasm.getActiveCrystal();
    if (!namedWasm.shatterActiveCrystal()) return false;
    namedWasm.unlockTierOneAchievement(45);
    if (shatteredCrystal === 7) namedWasm.unlockTierOneAchievement(50);
    if (CRYSTALS.every((_, index) => namedWasm.hasCompletedCrystal(index))) {
        namedWasm.unlockTierOneAchievement(47);
    }
    resetForCondense();
    void saveGame();
    return true;
}

export function subscribeToCondense(listener: CondenseListener): () => void {
    condenseListeners.add(listener);
    return () => condenseListeners.delete(listener);
}

export function subscribeToMemoryGain(listener: MemoryGainListener): () => void {
    memoryGainListeners.add(listener);
    return () => memoryGainListeners.delete(listener);
}

export function buyMaxTierOne(index: number): void {
    namedWasm.buyMaxTierOne(index);
}

export function buyMaxAllTierOne(): void {
    namedWasm.buyMaxAllTierOne();
}

export function castAll(): void {
    namedWasm.buyMaxAllTierOne();
    namedWasm.castSpeedMax();
}

export function sealMeridians(): void {
    namedWasm.sealMeridians();
}

export function sealedMeridianResetNoGain(): boolean {
    if (!namedWasm.sealedMeridianResetNoGain()) return false;
    void saveGame();
    for (const listener of condenseListeners) listener();
    return true;
}

export function increaseMatrix(): void {
    namedWasm.increaseMatrix();
}

export function castSpeed(): void {
    namedWasm.castSpeed();
}

export function purifyMeridians(): void {
    namedWasm.purifyMeridians();
}
