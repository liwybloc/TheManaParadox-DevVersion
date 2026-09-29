<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { namedWasm } from "@generated/_wasm$globals.js";
import { saveGame } from "@game/systems/save.js";
import { formatDecimal } from "@game/ui/formatting.js";

defineProps({
    activeSubtab: { type: String, required: true },
    abyssRunActive: { type: Boolean, required: true },
    sonicValue: { type: String, required: true },
});

defineEmits(['enter-abyss']);

const towerDefinitions = [
    { effect: "Potion Strength", power: 2 },
    { effect: "Crystal Matrix Power" },
    { effect: "Sealed Meridian Power" },
    { effect: "Meditation Power" },
    { effect: "Memory Milestone 25 Power", power: 0.1 },
    { effect: "Condensed Mana Gain", power: 0.01 },
    { effect: "Purification Power", power: 2 },
    { effect: "Courage Power", power: 2 },
    { effect: "Per-Boost Multiplier", additive: true },
];
const towers = ref([]);
let resonanceTimer;

function updateTowers() {
    towers.value = towerDefinitions.map((tower, index) => ({
        ...tower,
        investment: formatDecimal(namedWasm.resonanceInvestmentLogarithmicHandle(index), 6),
        bonus: tower.additive
            ? formatDecimal(namedWasm.resonancePerBoostBonusHandle(), 3)
            : formatDecimal(tower.power
                ? namedWasm.resonanceTowerEffectHandle(index, tower.power)
                : namedWasm.resonanceTowerBonusHandle(index), 2),
        unlocked: namedWasm.isResonanceTowerUnlocked(index),
        unlockDepth: 1_250 + index * 750,
        index,
    }));
}

function refreshResonanceEffects() {
    namedWasm.refreshPotionEffectState();
    namedWasm.refreshMatrixDerivedState();
    namedWasm.refreshSealedMeridiansDerivedState();
    namedWasm.refreshMeditationMagnitude();
    namedWasm.refreshTierOneDerivedState();
    namedWasm.refreshCondenseGain();
    namedWasm.refreshCourageMultiplier();
}

function adjustResonance(index, withdraw, amount = 0.000001) {
    if (!namedWasm.adjustTowerResonance(index, amount, withdraw)) return false;
    refreshResonanceEffects();
    updateTowers();
    return true;
}

function adjustResonanceBulk(index, withdraw) {
    if (!namedWasm.adjustTowerResonancePercent(index, withdraw)) return false;
    refreshResonanceEffects();
    updateTowers();
    return true;
}

function startResonating(index, withdraw, bulk = false) {
    stopResonating();
    const adjust = bulk
        ? () => adjustResonanceBulk(index, withdraw)
        : () => adjustResonance(index, withdraw);
    adjust();
    resonanceTimer = window.setInterval(adjust, 10);
}

function stopResonating() {
    if (resonanceTimer === undefined) return;
    window.clearInterval(resonanceTimer);
    resonanceTimer = undefined;
    void saveGame();
}

watch(() => namedWasm.isInAbyss(), updateTowers, { immediate: true });
onBeforeUnmount(stopResonating);
</script>

<template>
    <section class="abyss-tab">
        <div v-if="abyssRunActive" class="section-title">
            <h1>The Abyss</h1>
            <p>There's nothing to find here...</p>
        </div>
        <template v-else>
            <div class="section-title">
                <section v-if="activeSubtab === 'depths'">
                    <h1>The Abyss</h1>
                    <p>Click the vortex to delve into the abyss...</p>

                </section>
                <section v-else-if="activeSubtab === 'abyss-resonance'">
                    <h1>Abyssal Resonance</h1>
                    <p>Supply Sonic Value to awaken the towers.</p>
                    <p class="resonance-balance">Sonic Value: <strong>{{ sonicValue }}</strong></p>
                </section>
            </div>
            <template v-if="activeSubtab === 'depths'">
                <video id="abyss-vortex" :src="'./assets/videos/abyss-vortex.webm'" loop muted playsinline preload="metadata" aria-hidden="true" hidden></video>
                <button id="enter-abyss" type="button" aria-label="Enter the Abyss" @click="$emit('enter-abyss')"></button>
            </template>
            <div v-else-if="activeSubtab === 'abyss-resonance'" class="resonance-towers">
                <article v-for="tower in towers" :key="tower.effect" class="resonance-tower" :class="{ locked: !tower.unlocked }">
                    <div class="tower-visual" aria-hidden="true">
                        <div class="tower-spire"></div>
                        <div class="tower-crown"><i></i><i></i><i></i></div>
                        <div class="tower-body"><i></i><i></i><i></i></div>
                        <div class="tower-base"></div>
                    </div>
                    <p v-if="tower.unlocked" class="tower-effect">
                        <span>{{ tower.effect }}</span>
                        <strong>{{ tower.additive ? "+" : "×" }}{{ tower.bonus }}</strong>
                    </p>
                    <p v-else class="tower-effect"><span>Reach {{ tower.unlockDepth.toLocaleString() }} m</span></p>
                    <small v-if="tower.unlocked">{{ tower.investment }} supplied</small>
                    <div v-if="tower.unlocked" class="tower-actions">
                        <button
                            class="bulk-resonance"
                            type="button"
                            aria-label="Remove ten percent of resonance"
                            @pointerdown.prevent="startResonating(tower.index, true, true)"
                            @pointerup="stopResonating"
                            @pointerleave="stopResonating"
                            @pointercancel="stopResonating"
                        >−−</button>
                        <button
                            type="button"
                            aria-label="Remove resonance"
                            @pointerdown.prevent="startResonating(tower.index, true)"
                            @pointerup="stopResonating"
                            @pointerleave="stopResonating"
                            @pointercancel="stopResonating"
                        >−</button>
                        <button
                            type="button"
                            aria-label="Add resonance"
                            @pointerdown.prevent="startResonating(tower.index, false)"
                            @pointerup="stopResonating"
                            @pointerleave="stopResonating"
                            @pointercancel="stopResonating"
                        >+</button>
                        <button
                            class="bulk-resonance"
                            type="button"
                            aria-label="Add ten percent of resonance"
                            @pointerdown.prevent="startResonating(tower.index, false, true)"
                            @pointerup="stopResonating"
                            @pointerleave="stopResonating"
                            @pointercancel="stopResonating"
                        >++</button>
                    </div>
                </article>
            </div>
        </template>
    </section>
</template>

<style scoped>
.resonance-towers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    width: min(1050px, calc(100% - 2rem));
    margin: 1.5rem auto 3rem;
}
.resonance-balance { color: #8fe9ff; }

.resonance-tower {
    padding: 1.35rem;
    border: 1px solid rgb(104 185 211 / 35%);
    border-radius: 0.75rem;
    text-align: center;
    background: linear-gradient(180deg, rgb(18 55 72 / 80%), rgb(4 20 31 / 88%));
}
.resonance-tower.locked { filter: grayscale(0.8); opacity: 0.55; }
.resonance-tower:last-child { grid-column: 1 / -1; justify-self: center; width: min(220px, 100%); }

.resonance-tower p { margin: 0.4rem 0; }
.resonance-tower small { color: #84aeba; }
.tower-effect span,
.tower-effect strong { display: block; }
.tower-effect strong { margin-top: 0.25rem; font-size: 1.15rem; }
.tower-visual {
    position: relative;
    width: 82px;
    height: 126px;
    margin: 0 auto 0.7rem;
    filter: drop-shadow(0 0 12px rgb(57 185 220 / 45%));
}
.tower-spire {
    width: 0;
    height: 0;
    margin: auto;
    border-right: 20px solid transparent;
    border-bottom: 30px solid #286b80;
    border-left: 20px solid transparent;
}
.tower-crown {
    display: flex;
    align-items: end;
    justify-content: space-between;
    width: 64px;
    height: 20px;
    margin: auto;
    border-bottom: 8px solid #286b80;
}
.tower-crown i { width: 13px; height: 17px; background: #286b80; }
.tower-body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 13px;
    align-items: center;
    width: 52px;
    height: 65px;
    margin: auto;
    padding-top: 9px;
    background: linear-gradient(90deg, #174656, #31788c 50%, #174656);
    clip-path: polygon(8% 0, 92% 0, 100% 100%, 0 100%);
}
.tower-body i {
    width: 8px;
    height: 12px;
    border-radius: 5px 5px 1px 1px;
    background: #8fe9ff;
    box-shadow: 0 0 8px #61dffb;
}
.tower-base { width: 72px; height: 11px; margin: auto; border-radius: 3px 3px 0 0; background: #123946; }
.tower-actions { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem; }
.tower-actions button {
    min-width: 3rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid rgb(102 205 230 / 45%);
    border-radius: 0.35rem;
    color: #d8f8ff;
    background: rgb(15 66 84 / 80%);
    cursor: pointer;
}
.tower-actions .bulk-resonance {
    min-width: 2.1rem;
    padding-inline: 0.35rem;
    font-size: 0.75rem;
}
</style>
