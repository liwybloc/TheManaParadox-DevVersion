<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { MEMORY_MILESTONES, MEMORY_MILESTONE_REWARDS } from "@game/game/memories.js";

const props = defineProps({
    activeSubtab: { type: String, required: true },
    condensedMana: { type: String, required: true },
    upgrades: { type: Array, required: true },
    placeholders: { type: Object, required: true },
    isAscended: { type: Boolean, required: true },
    memories: { type: Object, required: true },
    remembrance: { type: Object, required: true },
});
defineEmits(["buy", "focus", "buy-memorial", "buy-remembrance", "respec", "export-remembrance", "import-remembrance"]);

const remembranceZoom = ref(1);
const remembranceTreeScroll = ref(null);

function centerRemembranceTree() {
    nextTick(() => {
        const element = remembranceTreeScroll.value;
        if (element) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    });
}

watch(() => props.activeSubtab, (subtab) => {
    if (subtab === "remembrance") centerRemembranceTree();
}, { immediate: true });

function changeRemembranceZoom(amount) {
    remembranceZoom.value = Math.min(2.5, Math.max(0.75, Math.round((remembranceZoom.value + amount) * 4) / 4));
    centerRemembranceTree();
}

const visibleMemoryMilestones = computed(() => {
    const firstLocked = MEMORY_MILESTONES.findIndex((milestone) => milestone > props.memories.remembered);
    if (firstLocked < 0) return MEMORY_MILESTONES.map((milestone) => ({
        milestone,
        reward: MEMORY_MILESTONE_REWARDS[milestone],
        unlocked: true,
        fade: 0,
    }));
    return MEMORY_MILESTONES.slice(0, firstLocked + 3).map((milestone, index) => ({
        milestone,
        reward: MEMORY_MILESTONE_REWARDS[milestone],
        unlocked: index < firstLocked,
        fade: Math.max(0, index - firstLocked),
    }));
});

function resolvePlaceholders(text) {
    return text.replace(/\{([A-Za-z0-9_]+)\}/g, (token, key) => props.placeholders[key] ?? token);
}

function resolveMemoryReward(reward) {
    return reward?.replace(/\{(memoryManaMult|memoryProdMult|memoryMemMult|memoryCostStartAdd)\}/g, (token, key) => ({
        memoryManaMult: props.memories.manaMultiplier,
        memoryProdMult: props.memories.productionMultiplier,
        memoryMemMult: props.memories.gainMultiplier,
        memoryCostStartAdd: props.memories.costStartAdd,
    })[key] ?? token);
}

function nodeCoordinate(upgrades, nodeNumber, axis) {
    const node = upgrades[nodeNumber - 1];
    if (!node) return 0;
    return (node[axis] - 1) * (axis === 'column' ? 152 : 108) + (axis === 'column' ? 66 : 44);
}

function connectionNode(connection, side) {
    return connection?.[side] ?? 0;
}

function connectionKey(connection) {
    return `${connectionNode(connection, 0)}-${connectionNode(connection, 1)}`;
}
</script>

<template>
    <section class="tab-panel">
        <div v-if="activeSubtab === 'condensed-upgrades'">
            <div class="section-title">
                <h1>Condensed</h1>
                <p>You have {{ condensedMana }} condensed mana.</p>
                <p v-if="isAscended">Ascended Upgrades replace the upgrade.</p>
            </div>
            <div class="condensed-upgrade-grid">
                <button
                    v-for="upgrade in upgrades"
                    :key="upgrade.index"
                    v-show="upgrade.visible"
                    type="button"
                    :class="{
                        purchased: upgrade.circleTwoAvailable ? upgrade.circleTwoPurchased : upgrade.purchased,
                        'circle-two-available': upgrade.circleTwoAvailable && !upgrade.circleTwoPurchased,
                        'circle-two-purchased': upgrade.circleTwoPurchased,
                    }"
                    :style="{ gridColumn: upgrade.slot % 5 + 1, gridRow: Math.floor(upgrade.slot / 5) + 1 }"
                    :disabled="!upgrade.affordable"
                    @click="$emit('buy', upgrade.index)"
                >
                    <span
                        v-if="upgrade.circleTwoAvailable && !upgrade.circleTwoPurchased"
                        class="condensed-upgrade-original"
                    >
                        <strong>{{ resolvePlaceholders(upgrade.title) }}</strong>
                        <small>Ascended upgrade available</small>
                    </span>
                    <span
                        v-if="upgrade.circleTwoAvailable && !upgrade.circleTwoPurchased"
                        class="condensed-upgrade-ascended-preview"
                    >
                        <strong>{{ resolvePlaceholders(upgrade.circleTwo.title) }}</strong>
                        <small>Cost: {{ upgrade.cost }} condensed mana</small>
                    </span>
                    <template v-else-if="upgrade.circleTwoPurchased">
                        <strong>{{ resolvePlaceholders(upgrade.circleTwo.title) }}</strong>
                        <small>Purchased</small>
                    </template>
                    <template v-else>
                        <strong>{{ resolvePlaceholders(upgrade.title) }}</strong>
                        <small>{{ upgrade.purchased ? "Purchased" : `Cost: ${upgrade.cost} condensed mana` }}</small>
                    </template>
                </button>
            </div>
        </div>
        <div v-else-if="activeSubtab === 'memories'">
            <div class="section-title">
                <h1>Memories</h1>
                <p>You have remembered {{ memories.remembered }} memor{{ memories.remembered != 1 ? 'ies' : 'y' }}.</p>
                <p v-if="memories.limited" class="memory-limit-message">A mysterious force is limiting your ability to remember...</p>
            </div>
            <button class="focus-button" type="button" @click="$emit('focus')">
                <strong>{{ memories.focusing ? "Exit Focus" : "Focus" }}</strong>
                <span>Performs a condense reset.</span>
                <span>{{ memories.focusing ? "Exits Focus." : "Game speed starts at ×0.1 and decreases exponentially based on Mana." }}</span>
                <span>Next condense has a {{ memories.nextChance }}% chance for a memory</span>
            </button>
            <div class="memory-milestones">
                <div
                    v-for="entry in visibleMemoryMilestones"
                    :key="entry.milestone"
                    class="memory-milestone"
                    :class="{ unlocked: entry.unlocked }"
                    :style="{ '--memory-fade': entry.fade }"
                >
                    <strong class="memory-requirement">{{ entry.milestone.toLocaleString() }}</strong>
                    <span v-if="entry.unlocked && entry.reward" class="memory-reward">{{ resolveMemoryReward(entry.reward) }}</span>
                    <span v-else class="memory-unknown" aria-label="Unknown memory milestone">?</span>
                </div>
            </div>
        </div>
        <div v-else-if="activeSubtab === 'remembrance'">
            <div class="section-title">
                <h1>Remembrance</h1>
                <p>You have {{ remembrance.memorials }} Memorials.</p>
                <div class="remembrance-import-export">
                    <button type="button" @click="$emit('export-remembrance')">Export tree</button>
                    <button type="button" @click="$emit('import-remembrance')">Import tree</button>
                    <button type="button" class="remembrance-respec" :class="{ enabled: remembrance.respec }" @click="$emit('respec')">
                        Respec on next Condense
                    </button>
                </div>
            </div>
            <div class="remembrance-zoom-controls" aria-label="Remembrance tree zoom">
                <button type="button" @click="changeRemembranceZoom(-0.25)" :disabled="remembranceZoom <= 0.75">−</button>
                <span>{{ Math.round(remembranceZoom * 100) }}%</span>
                <button type="button" @click="changeRemembranceZoom(0.25)" :disabled="remembranceZoom >= 2.5">+</button>
            </div>
            <div ref="remembranceTreeScroll" class="remembrance-tree-scroll">
                <div class="remembrance-tree" :style="{ zoom: remembranceZoom }">
                    <svg class="remembrance-connections" viewBox="0 0 1044 1492" aria-hidden="true">
                    <line
                        v-for="connection in remembrance.connections"
                        :key="connectionKey(connection)"
                        :x1="nodeCoordinate(remembrance.upgrades, connectionNode(connection, 0), 'column')"
                        :y1="nodeCoordinate(remembrance.upgrades, connectionNode(connection, 0), 'row')"
                        :x2="nodeCoordinate(remembrance.upgrades, connectionNode(connection, 1), 'column')"
                        :y2="nodeCoordinate(remembrance.upgrades, connectionNode(connection, 1), 'row')"
                    />
                    </svg>
                    <button
                    v-for="upgrade in remembrance.upgrades"
                    :key="upgrade.index"
                    type="button"
                    class="remembrance-node"
                    :class="{
                        purchased: upgrade.purchased,
                        purchasable: !upgrade.purchased && upgrade.available,
                        unpurchasable: !upgrade.purchased && !upgrade.available,
                    }"
                    :style="{ gridColumn: upgrade.column, gridRow: upgrade.row }"
                    :disabled="upgrade.purchased || !upgrade.available"
                    @click="$emit('buy-remembrance', upgrade.index)"
                >
                    <strong class="remembrance-number">{{ upgrade.index + 1 }}</strong>
                    <small :class="{ 'remembrance-glitch': upgrade.index >= 13 }">{{ upgrade.description }}</small>
                    <em>Cost: {{ upgrade.costFormatted }} Memorial{{ upgrade.cost === 1 ? '' : 's' }}</em>
                    </button>
                </div>
            </div>
            <div class="remembrance-controls">
                <button type="button" class="memorial-buy" @click="$emit('buy-memorial')">
                    <strong>Buy Memorial</strong>
                    <span>Cost: {{ remembrance.cost }} Condensed Mana</span>
                </button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.focus-button {
    display: flex;
    width: min(100%, 440px);
    min-height: 112px;
    margin: 0 auto 28px;
    padding: 20px 24px;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    border: 1px solid #9571ce;
    border-radius: 0;
    color: #f1eaff;
    background: linear-gradient(180deg, #55367e, #302044);
    cursor: pointer;
}

.focus-button strong {
    font-size: 1.2rem;
}

.focus-button span {
    font-size: 0.75em;
}

.focus-button:disabled {
    opacity: 0.55;
    cursor: default;
}

.memory-limit-message {
    color: #b9a8d8;
    font-style: italic;
}

.memory-milestones {
    display: flex;
    width: min(100%, 720px);
    margin: 0 auto;
    flex-direction: column;
    gap: 9px;
}

.memory-milestone {
    position: relative;
    display: grid;
    min-height: 72px;
    grid-template-columns: 110px 1fr 110px;
    align-items: center;
    border: 1px solid #696571;
    border-radius: 0;
    color: #aaa6b0;
    background: linear-gradient(90deg, #24222a, #302d35, #24222a);
    opacity: calc(0.62 - var(--memory-fade) * 0.18);
}

.memory-milestone.unlocked {
    border-color: #928b9d;
    opacity: 1;
}

.memory-requirement {
    padding-left: 18px;
    color: #d3ceda;
    font-size: 1.05rem;
    text-align: left;
}

.memory-unknown {
    grid-column: 2;
    color: #bab5c1;
    font-size: 2rem;
    font-weight: 700;
    text-align: center;
}

.memory-reward {
    grid-column: 2;
    color: #ddd8e4;
    font-weight: 600;
    text-align: center;
}

.remembrance-tree {
    position: relative;
    display: grid;
    grid-template-columns: repeat(7, 132px);
    grid-auto-rows: 88px;
    gap: 20px;
    justify-content: start;
    margin: 28px auto;
}

.remembrance-tree-scroll {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
}

@media (min-width: 100vh) {
    .remembrance-tree-scroll {
        width: min(1100px, calc(100vw - 48px));
        margin-left: 0;
        margin-right: 0;
        transform: none;
    }
}

.remembrance-zoom-controls {
    display: none;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin: 8px auto -12px;
    max-width: 1044px;
}

@media (max-width: 700px) {
    .remembrance-zoom-controls {
        display: flex;
    }
}

.remembrance-zoom-controls button {
    width: 32px;
    height: 28px;
    padding: 0;
    border: 1px solid #b8a35d;
    background: #aaa;
    color: #332b1d;
    font-size: 1.1rem;
    font-weight: 700;
}

.remembrance-zoom-controls button:disabled {
    opacity: 0.45;
}

.remembrance-zoom-controls span {
    min-width: 48px;
    color: #d3ceda;
    text-align: center;
    font-size: 0.8rem;
}

.remembrance-connections {
    position: absolute;
    left: 0;
    z-index: 0;
    width: 1044px;
    height: 1492px;
    overflow: visible;
    pointer-events: none;
    display: block;
}

.remembrance-connections line {
    stroke: #8f7b45;
    stroke-width: 3;
}

.remembrance-node {
    position: relative;
    position: relative;
    z-index: 1;
    width: 132px;
    height: 88px;
    border: 1px solid #b8a35d;
    background: #aaa;
    color: #332b1d;
    font-weight: 700;
}

.remembrance-node.purchased { background: #e7c85d; }
.remembrance-node.purchasable:hover { background: #b8d7ad; }
.remembrance-node.unpurchasable:hover { background: #d2a3a3; }

.remembrance-node {
    display: flex;
    padding: 8px;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    overflow: hidden;
    text-align: center;
}

.remembrance-node strong { font-size: 1.05rem; }
.remembrance-node span,
.remembrance-node small,
.remembrance-node em { max-width: 100%; font-size: 0.62rem; line-height: 1.1; }
.remembrance-node small { color: #4a402a; }
.remembrance-node small.remembrance-glitch { font-family: monospace; }
.remembrance-node em { font-style: normal; font-weight: 700; }
.remembrance-number {
    position: absolute;
    top: 1px;
    left: 1px;
    font-size: 0.3rem;
}

.remembrance-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin: 18px auto;
}

.remembrance-controls button,
.remembrance-import-export button {
    padding: 9px 16px;
    border: 1px solid #8f7b45;
    border-radius: 4px;
    color: #f7eac2;
    background: linear-gradient(180deg, #665632, #40361f);
    cursor: pointer;
    font: inherit;
}

.remembrance-controls button:hover,
.remembrance-import-export button:hover {
    border-color: #d8bd66;
    background: linear-gradient(180deg, #806c3d, #524522);
}

.remembrance-import-export {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
}

.memorial-buy {
    display: flex;
    min-width: 240px;
    flex-direction: column;
    gap: 4px;
}

.remembrance-respec.enabled {
    border-color: #e66b9a;
    background: #b83d72;
    color: #fff;
}

.remembrance-respec.enabled:hover {
    background: #cf4b83;
}
</style>
