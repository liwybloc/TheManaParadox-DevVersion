<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { TIME_UPGRADES } from "@game/game/time.js";
import { formatDecimals } from "@game/ui/formatting.js";
import { namedWasm } from "@generated/_wasm$globals.js";
import { toggleTimeDrain } from "@game/systems/time.js";
import { saveGame } from "@game/systems/save.js";

defineProps({ animateEntrance: Boolean });

const sections = ref([]);
const mode = ref(0);
const mountain = ref({ visible: false, power: "0", affordable: false, purchased: false });
let timer;
function refresh() {
    mode.value = namedWasm.getTimeDrainMode();
    mountain.value = {
        visible: namedWasm.isMountainUpgradeVisible(),
        power: formatDecimals([namedWasm.timePowerHandle()], 2, "Unknown", false)[0],
        affordable: namedWasm.canBuyMountainUpgrade(),
        purchased: namedWasm.isMountainUnlocked(),
    };
    sections.value = [0, 1].map((column) => {
        const currency = column === 0 ? "real" : "game";
        const stored = column === 0 ? namedWasm.storedRealTimeHandle() : namedWasm.storedGameTimeHandle();
        const total = column === 0 ? namedWasm.totalRealTimeHandle() : namedWasm.totalGameTimeHandle();
        const [storedText, totalText] = formatDecimals([stored, total], 2, "Unknown", false);
        return {
            name: column === 0 ? "Real Time" : "Game Time",
            stored: `${storedText} s`,
            total: `${totalText} s`,
            upgrades: TIME_UPGRADES.map((upgrade, index) => ({ ...upgrade, index }))
                .filter((upgrade) => upgrade.currency === currency)
                .map((upgrade) => {
                    const index = upgrade.index;
                    const level = namedWasm.timeUpgradeLevel(index);
                    // Cost and effect handles are reusable scratch values; format each before requesting the next.
                    const cost = formatDecimals([namedWasm.timeUpgradeCostHandle(index)], 2, "Unknown", false)[0];
                    const effect = formatDecimals([namedWasm.timeUpgradeEffectHandle(index)], 2, "Unknown", false)[0];
                    return { ...upgrade, level, cost: `${cost} s`, effect: `${upgrade.operation === "power" ? "^" : upgrade.operation === "add" ? "+" : "×"}${effect}`,
                        affordable: namedWasm.canBuyTimeUpgrade(index) };
                }),
        };
    });
}
function buyMountain() {
    if (!namedWasm.buyMountainUpgrade()) return;
    refresh();
    void saveGame();
}
function toggleDrain(column) {
    const next = mode.value === column + 1 ? 0 : column + 1;
    toggleTimeDrain(next);
    refresh();
    void saveGame();
}
function buy(index) {
    if (!namedWasm.buyTimeUpgrade(index)) return;
    namedWasm.refreshCondenseGain();
    refresh();
    void saveGame();
}
onMounted(() => { refresh(); timer = setInterval(refresh, 100); });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
    <div class="time-upgrades" :class="{ 'upgrades-entering': animateEntrance, 'mountain-visible': mountain.visible }">
        <section v-for="(section, column) in sections" :key="section.name" class="time-upgrade-section">
            <h2>{{ section.name }}</h2>
            <p class="stored-time">{{ section.stored }}</p>
            <p class="total-time">Total: {{ section.total }}</p>
            <button type="button" class="time-drain" :class="{ draining: mode === column + 1 }"
                :aria-pressed="mode === column + 1" @click="toggleDrain(column)">
                {{ mode === column + 1 ? 'Stop Draining' : `Drain ${section.name}` }}
            </button>
            <article v-for="upgrade in section.upgrades" :key="upgrade.index" class="time-upgrade">
                <h3>{{ upgrade.name }}</h3>
                <button type="button" :disabled="!upgrade.affordable" @click="buy(upgrade.index)">
                    <span>{{ upgrade.description }}</span>
                    <small>Effect: {{ upgrade.effect }}</small>
                    <small>Level {{ upgrade.level }}</small>
                    <small>{{ upgrade.level >= upgrade.maxLevel ? 'Complete' : `Cost: ${upgrade.cost}` }}</small>
                </button>
            </article>
        </section>
        <aside v-if="mountain.visible" class="mountain-unlock">
            <h3>Time Power</h3>
            <strong class="mountain-power">{{ mountain.power }}</strong>
            <button type="button" :disabled="!mountain.affordable" @click="buyMountain">
                <strong>????</strong>
                <span>A note...</span>
                <small>Requires: 6,000,000 Time Power</small>
                <small v-if="mountain.purchased">Purchased</small>
            </button>
        </aside>
    </div>
</template>

<style scoped>
.time-upgrades { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px; width: min(820px, calc(100% - 32px)); margin: 48px auto 0; }
.time-upgrades.mountain-visible { width: min(1040px, calc(100% - 32px)); grid-template-columns: minmax(0, 1fr) 180px minmax(0, 1fr); gap: 24px; }
.mountain-visible .time-upgrade-section:first-child { grid-column: 1; grid-row: 1; }
.mountain-visible .time-upgrade-section:nth-child(2) { grid-column: 3; grid-row: 1; }
.mountain-unlock { grid-column: 2; grid-row: 1; align-self: start; padding-top: 38px; text-align: center; }
.mountain-unlock h3 { margin: 0 0 10px; color: #b9a1ce; font-size: 15px; font-weight: normal; }
.mountain-power { display: block; margin-bottom: 20px; font-size: 13px; font-weight: normal; color: #d0c0df; }
.mountain-unlock button { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; padding: 18px 10px; border: 1px solid #816394; border-radius: 0; background: #21152d; color: #d0c0df; font: inherit; font-size: 12px; cursor: pointer; }
.mountain-unlock button:disabled { opacity: .5; cursor: default; }
.mountain-unlock button:hover:not(:disabled) { border-color: #c09cdb; background: #30213d; }
.mountain-unlock small { font-size: 10px; line-height: 1.5; color: #a992ba; }
.upgrades-entering { animation: upgrades-emerge 3s ease both; }
.time-upgrade-section h2 { margin: 0 0 12px; color: #cbb8de; font-size: 19px; font-weight: normal; text-align: center; }
.stored-time { margin: 0 0 14px; color: #9d88af; font-size: 12px; font-variant-numeric: tabular-nums; }
.total-time { margin: -6px 0 14px; color: #796888; font-size: 11px; }
.time-drain { min-height: 34px; padding: 6px 16px; margin-bottom: 26px; border: 1px solid #665078; background: #1e1429; color: #cbb8de; font: inherit; font-size: 12px; cursor: pointer; }
.time-drain.draining { border-color: #77b8e5; color: #b8e1ff; }
.time-upgrade { margin: 0 0 22px; text-align: left; }
.time-upgrade h3 { margin: 0 0 6px; font-size: 12px; color: #b9a1ce; font-weight: normal; }
.time-upgrade > button { display: flex; width: 100%; min-height: 88px; padding: 14px; flex-direction: column; justify-content: center; gap: 6px; border: 1px solid #665078; border-radius: 0; background: #1a1223; color: #d0c0df; font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
.time-upgrade > button:disabled { opacity: .45; cursor: default; }
.time-upgrade > button:hover:not(:disabled) { border-color: #b18bce; background: #2b1b3b; }
.time-upgrade small { color: #9f8bb1; font-size: 11px; }
@keyframes upgrades-emerge { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 800px) {
    .time-upgrades.mountain-visible { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mountain-visible .time-upgrade-section:nth-child(2) { grid-column: 2; }
    .mountain-unlock { grid-column: 1 / -1; grid-row: 2; width: min(260px, 100%); justify-self: center; padding-top: 0; }
}
@media (max-width: 600px) { .time-upgrades { gap: 18px; width: 100%; } .time-upgrade > button { padding: 10px; } }
</style>
