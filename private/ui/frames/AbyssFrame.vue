<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ABYSS_TABS } from "@game/abyss/abyss-tabs.js";
import { namedWasm } from "@generated/_wasm$globals.js";
import { formatDecimal } from "@game/ui/formatting.js";
import TabNavigation from "../components/TabNavigation.vue";

const props = defineProps({
    entryTransition: { type: String, default: "fade" },
});
const emit = defineEmits(["leave-abyss", "begin-run"]);

const activeTab = ref(ABYSS_TABS[0].id);
const entering = ref(props.entryTransition === "zoom");
const vortex = ref(null);
const sonicValue = ref("0.000000");
const depth = ref(0);
const highestCompletedDepth = ref(1_000);
const minimumDepth = ref(1_000);
const cameraParticles = Array.from({ length: 22 }, (_, index) => ({
    id: index,
    x: (index * 47) % 97,
    size: 2 + index % 5,
    delay: -(index % 9) * 0.7,
    duration: 5 + index % 7,
}));
const depthDarkness = computed(() => Math.max(0, Math.min(1, (depth.value - 1_000) / 5_000)));
const productionPower = computed(() => namedWasm.abyssProductionBasePowerHandle(depth.value));
function formatEffect(value, index) {
    const stacks = namedWasm.abyssEffectStacks(index, depth.value);
    return `${formatDecimal(value, 3)}${stacks > 1 ? ` (x${stacks})` : ""}`;
}
const effects = computed(() => {
    const currentEffects = depth.value < 1_250
        ? []
        : [`Mana production is raised ^${formatEffect(productionPower.value, 0)}`];
    if (depth.value >= 1_750) currentEffects.push(`Game speed is divided by ${formatEffect(namedWasm.abyssGameSpeedBaseDivisorHandle(depth.value), 1)}`);
    if (depth.value >= 2_500) currentEffects.push(`Meditation Power is raised ^${formatEffect(namedWasm.abyssMeditationBasePowerHandle(depth.value), 2)}`);
    if (depth.value >= 3_250) currentEffects.push(`Potion Strength is divided by ${formatEffect(namedWasm.abyssPotionPowerBaseDivisorHandle(depth.value), 3)}`);
    if (depth.value >= 4_000) currentEffects.push(`Matrix and Meridian Power are raised ^${formatEffect(namedWasm.abyssProgressionBasePowerHandle(depth.value), 4)}`);
    if (depth.value >= 4_750) currentEffects.push(`Producer costs are raised ^${formatEffect(namedWasm.abyssProducerCostBasePowerHandle(depth.value), 5)}`);
    if (depth.value >= 5_500) currentEffects.push(`Purification Power is raised ^${formatEffect(namedWasm.abyssPurificationBasePowerHandle(depth.value), 6)}`);
    if (depth.value >= 6_250) currentEffects.push(`Courage Power is raised ^${formatEffect(namedWasm.abyssCourageBasePowerHandle(depth.value), 7)}`);
    if (depth.value >= 7_000) currentEffects.push(`Condensed Mana gain is raised ^${formatEffect(namedWasm.abyssCondenseBasePowerHandle(depth.value), 8)}`);
    return currentEffects;
});
const depthRegion = computed(() => {
    return "As you stare deep into the abyss, it appears to stare back..";
});
let entryTimer;
let traversalFrame;
let previousTraversalTime = 0;

function setMovement(direction) {
    namedWasm.setAbyssMovement(direction);
}

function stopMovement(direction) {
    namedWasm.stopAbyssMovement(direction);
}

function updateAbyssDisplay() {
    sonicValue.value = formatDecimal(namedWasm.sonicValueLogarithmicHandle(), 6);
    depth.value = namedWasm.getAbyssDepth();
    highestCompletedDepth.value = namedWasm.getHighestAbyssDepthCompleted();
    minimumDepth.value = namedWasm.abyssMinimumDepth();
}

function usePrimaryAction() {
    if (depth.value <= minimumDepth.value) emit("leave-abyss");
    else emit("begin-run");
}

function updateTraversal(timestamp) {
    const deltaSeconds = previousTraversalTime === 0 ? 0 : Math.min(0.05, (timestamp - previousTraversalTime) / 1000);
    previousTraversalTime = timestamp;
    if (!entering.value) {
        namedWasm.tickAbyssTraversal(deltaSeconds);
        updateAbyssDisplay();
    }
    traversalFrame = requestAnimationFrame(updateTraversal);
}

function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") setMovement(1);
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") setMovement(-1);
}

function handleKeyUp(event) {
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") stopMovement(1);
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") stopMovement(-1);
}

onMounted(() => {
    if (entering.value) {
        void vortex.value?.play().catch(() => {});
        entryTimer = window.setTimeout(() => {
            entering.value = false;
        }, 1450);
    }
    updateAbyssDisplay();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    traversalFrame = requestAnimationFrame(updateTraversal);
});

onBeforeUnmount(() => {
    window.clearTimeout(entryTimer);
    cancelAnimationFrame(traversalFrame);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
});
</script>

<template>
    <section class="abyss-frame" :class="{ entering }">
        <div v-if="entering" class="abyss-entry">
            <video
                ref="vortex"
                class="abyss-entry-vortex"
                :src="'./assets/videos/abyss-vortex.webm'"
                autoplay
                loop
                muted
                playsinline
                preload="auto"
                aria-hidden="true"
            ></video>
            <div class="abyss-entry-shade"></div>
        </div>

        <template v-else>
            <header class="abyss-header">
                <div class="abyss-title">
                    <strong>The Abyss</strong>
                </div>
                <div class="sonic-value-display">
                    <span>Sonic Value</span>
                    <strong>{{ sonicValue }}</strong>
                </div>
                <button class="leave-abyss" type="button" @click="$emit('leave-abyss')">
                    Return to the surface
                </button>
            </header>

            <TabNavigation
                :tabs="ABYSS_TABS"
                :active-tab="activeTab"
                @select-tab="activeTab = $event"
            />

            <main class="abyss-content">
                <section v-if="activeTab === 'depths'">
                    <div class="dive-console" :style="{ '--depth-darkness': depthDarkness }">
                        <div class="camera-feed">
                            <div class="camera-water"></div>
                            <span
                                v-for="particle in cameraParticles"
                                :key="particle.id"
                                class="camera-particle"
                                :style="{
                                    left: `${particle.x}%`,
                                    width: `${particle.size}px`,
                                    height: `${particle.size}px`,
                                    animationDelay: `${particle.delay}s`,
                                    animationDuration: `${particle.duration}s`,
                                }"
                            ></span>
                            <div v-if="depth >= 420" class="distant-lifeform"></div>
                            <div v-if="depth >= 1_050" class="abyss-structure"></div>
                            <div class="camera-scanlines"></div>
                            <div class="camera-vignette"></div>
                            <div class="camera-overlay">
                                <span>CAM 01 · FORWARD</span>
                                <strong>{{ depthRegion }}</strong>
                                <span>DEPTH {{ Math.round(depth).toLocaleString() }} m</span>
                            </div>
                        </div>

                        <aside class="dive-instruments">
                            <div class="instrument-readout">
                                <span>Depth</span>
                                <strong>{{ Math.round(depth).toLocaleString() }} m</strong>
                            </div>
                            <div class="instrument-readout">
                                <span>Highest Completed</span>
                                <strong>{{ Math.round(highestCompletedDepth).toLocaleString() }} m</strong>
                            </div>
                            <div class="abyss-effects">
                                <span>Effects</span>
                                <p v-if="effects.length === 0">None</p>
                                <p v-for="effect in effects" :key="effect">{{ effect }}</p>
                            </div>
                            <div class="traversal-controls">
                                <button
                                    type="button"
                                    :disabled="depth <= minimumDepth"
                                    @pointerdown="setMovement(-1)"
                                    @pointerup="stopMovement(-1)"
                                    @pointerleave="stopMovement(-1)"
                                    @pointercancel="stopMovement(-1)"
                                >Hold to rise</button>
                                <button
                                    type="button"
                                    @pointerdown="setMovement(1)"
                                    @pointerup="stopMovement(1)"
                                    @pointerleave="stopMovement(1)"
                                    @pointercancel="stopMovement(1)"
                                >Hold to descend</button>
                            </div>
                            <button class="begin-abyss-run" type="button" @click="usePrimaryAction">
                                {{ depth <= minimumDepth ? "Exit the Abyss" : "Begin Run" }}
                            </button>
                        </aside>
                    </div>
                </section>
                <section v-else>
                    <h2>Discoveries</h2>
                    <p>Anything recovered from the Abyss will appear here.</p>
                </section>
            </main>
        </template>
    </section>
</template>

<style scoped>
.abyss-frame {
    position: fixed;
    z-index: 30;
    inset: 0;
    overflow: hidden auto;
    min-height: 100vh;
    color: #c7d5df;
    background:
        radial-gradient(circle at 50% -20%, rgb(19 55 75 / 72%), transparent 42%),
        linear-gradient(155deg, #071018, #020508 62%, #000 100%);
    animation: reveal-abyss 500ms ease-out;
}


.abyss-frame.entering {
    overflow: hidden;
    background: #000;
}

.abyss-entry {
    position: absolute;
    inset: 0;
    display: grid;
    overflow: hidden;
    place-items: center;
    background: #02070d;
}

.abyss-entry-vortex {
    width: min(72vw, 72vh);
    height: min(72vw, 72vh);
    object-fit: cover;
    border-radius: 50%;
    filter: contrast(1.15) saturate(0.85) brightness(0.82);
    animation: dive-into-abyss 1450ms cubic-bezier(0.72, 0, 0.9, 0.46) forwards;
    will-change: transform, filter;
}

.abyss-entry-shade {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, transparent 0 18%, rgb(0 2 5 / 18%) 45%, #000 100%);
    animation: abyss-blackout 1450ms ease-in forwards;
    pointer-events: none;
}

.abyss-header {
    display: flex;
    max-width: 1100px;
    margin: 0 auto;
    padding: 42px 28px 24px;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 1px solid #173446;
}

.abyss-title {
    color: #91adbb;
    font-size: 18px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.sonic-value-display {
    display: grid;
    min-width: 260px;
    justify-items: center;
    line-height: 1;
}

.sonic-value-display span,
.sonic-value-display small {
    color: #587e92;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
}

.sonic-value-display strong {
    margin: 7px 0 5px;
    color: #d8f4ff;
    font: 700 clamp(28px, 5vw, 48px)/1 monospace;
    text-shadow: 0 0 22px rgb(64 170 210 / 42%);
}

.leave-abyss {
    border: 1px solid #244c61;
    color: #9eb9c8;
    background: #08141c;
    height: 30px;
}

.leave-abyss:hover {
    border-color: #4d8faa;
    color: #e1f6ff;
    background: #102a38;
    box-shadow: 0 0 18px rgb(38 125 160 / 18%);
}

.abyss-frame :deep(.primary-tabs) {
    border-color: #173446;
    background: rgb(2 8 12 / 88%);
}

.abyss-frame :deep(.tab-button) {
    border-color: #244c61;
    color: #9eb9c8;
    background: #08141c;
}

.abyss-frame :deep(.tab-button:hover),
.abyss-frame :deep(.tab-button.is-active) {
    border-color: #4d8faa;
    color: #e1f6ff;
    background: #102a38;
    box-shadow: 0 0 18px rgb(38 125 160 / 18%);
}

.abyss-content {
    max-width: 1044px;
    min-height: 360px;
    margin: 18px auto 48px;
    padding: 32px;
    border: 1px solid #122c3a;
    color: #7999a9;
    background: rgb(3 10 15 / 78%);
    box-shadow: inset 0 0 60px rgb(0 0 0 / 55%), 0 20px 80px rgb(0 0 0 / 42%);
}

.abyss-content h2 {
    margin-top: 0;
    color: #bddbe8;
    letter-spacing: 0.08em;
}

.dive-console {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(230px, 0.7fr);
    gap: 18px;
}

.dive-console.crushing {
    animation: hull-shake 90ms linear infinite;
}

.camera-feed {
    position: relative;
    overflow: hidden;
    min-height: 430px;
    border: 7px solid #10191d;
    outline: 1px solid #29434d;
    background: #031016;
    box-shadow: inset 0 0 70px #000, 0 12px 35px rgb(0 0 0 / 55%);
}

.camera-water {
    position: absolute;
    inset: -10%;
    background:
        radial-gradient(circle at 52% 38%, rgb(177 238 238 / 42%), transparent 30%),
        linear-gradient(180deg, #4a9aa3, #246775 48%, #082c3a);
    filter: brightness(calc(1.2 - var(--depth-darkness) * 0.88)) saturate(calc(1 - var(--depth-darkness) * 0.4));
    animation: camera-drift 9s ease-in-out infinite alternate;
}

.camera-water::after {
    content: "";
    position: absolute;
    inset: 0;
    background: #00070c;
    opacity: calc(var(--depth-darkness) * 0.78);
}

.camera-particle {
    position: absolute;
    bottom: -12px;
    border-radius: 50%;
    background: #8bc1c6;
    box-shadow: 0 0 6px #79bec8;
    opacity: 0;
    animation: particle-rise linear infinite;
}

.distant-lifeform {
    position: absolute;
    top: 46%;
    left: 18%;
    width: 95px;
    height: 24px;
    border-radius: 55% 40% 50% 45%;
    background: #000b0f;
    filter: blur(2px);
    opacity: 0.7;
    animation: lifeform-pass 13s ease-in-out infinite;
}

.distant-lifeform::after {
    content: "";
    position: absolute;
    top: 8px;
    right: -45px;
    width: 58px;
    height: 8px;
    border-radius: 50%;
    background: #000b0f;
    transform: rotate(-12deg);
}

.abyss-structure {
    position: absolute;
    right: 8%;
    bottom: -18%;
    width: 19%;
    height: 78%;
    background: linear-gradient(90deg, #010608, #07171c 48%, #010608);
    clip-path: polygon(35% 0, 63% 0, 72% 62%, 100% 100%, 0 100%, 28% 62%);
    filter: drop-shadow(0 0 18px #0e414b);
    opacity: 0.75;
}

.camera-scanlines,
.camera-vignette,
.camera-cracks {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.camera-scanlines {
    background: repeating-linear-gradient(180deg, transparent 0 3px, rgb(0 0 0 / 18%) 4px);
    animation: scanline-jitter 180ms steps(2) infinite;
}

.camera-vignette {
    background: radial-gradient(circle, transparent 40%, rgb(0 0 0 / 78%) 100%);
}

.camera-cracks {
    background:
        linear-gradient(127deg, transparent 48%, rgb(163 218 226 / 70%) 49% 49.5%, transparent 50%) 58% 0 / 44% 65% no-repeat,
        linear-gradient(62deg, transparent 49%, rgb(163 218 226 / 55%) 50% 50.5%, transparent 51%) 85% 42% / 48% 58% no-repeat;
}

.camera-overlay {
    position: absolute;
    inset: 15px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    color: #7ba0a9;
    font: 11px/1 monospace;
    letter-spacing: 0.08em;
    text-shadow: 0 1px 3px #000;
}

.camera-overlay strong {
    position: absolute;
    bottom: 0;
    left: 0;
    color: #99bac2;
}

.crush-warning {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    color: #ff7369;
    font: 700 clamp(15px, 2.5vw, 24px)/1.2 monospace;
    text-align: center;
    text-shadow: 0 0 16px #e22b20;
    transform: translate(-50%, -50%);
    animation: warning-flash 300ms steps(2) infinite;
}

.dive-instruments {
    padding: 20px;
    border: 1px solid #25373e;
    background: linear-gradient(145deg, #10191d, #050a0d);
    box-shadow: inset 0 0 30px #000;
}

.instrument-readout {
    display: flex;
    margin-bottom: 14px;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    color: #69858e;
}

.instrument-readout strong {
    color: #b8d5db;
    font: 700 19px/1 monospace;
}

.instrument-readout.warning strong {
    color: #ff9c75;
}

.pressure-track {
    height: 13px;
    overflow: hidden;
    border: 1px solid #273d44;
    background: #010304;
}

.pressure-track span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #315d67 0 60%, #ba772f 82%, #dc352b 100%);
    transition: width 100ms linear;
}

.depth-limit {
    margin: 7px 0 25px;
    color: #b45f55;
    font: 11px/1 monospace;
    text-align: right;
    text-transform: uppercase;
}

.control-help {
    min-height: 86px;
    color: #65818a;
    font-size: 13px;
    line-height: 1.5;
}

.abyss-effects {
    min-height: 120px;
    margin: 22px 0;
    padding: 14px;
    border: 1px solid #263e47;
    background: #03090c;
}

.abyss-effects span {
    color: #668994;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.abyss-effects p {
    color: #b8d5db;
}

.traversal-controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
}

.traversal-controls button {
    min-height: 48px;
    border: 1px solid #244c61;
    color: #a9c3cf;
    background: #08141c;
}

@keyframes particle-rise {
    0% { opacity: 0; transform: translate(0, 0); }
    15% { opacity: 0.65; }
    100% { opacity: 0; transform: translate(35px, -460px); }
}

@keyframes camera-drift {
    from { transform: scale(1.04) translate(-1%, -1%); }
    to { transform: scale(1.1) translate(2%, 1%); }
}

@keyframes lifeform-pass {
    0%, 15% { opacity: 0; transform: translateX(-180px); }
    35%, 70% { opacity: 0.62; }
    100% { opacity: 0; transform: translateX(520px); }
}

@keyframes scanline-jitter {
    from { transform: translateY(0); }
    to { transform: translateY(2px); }
}

@keyframes warning-flash {
    50% { opacity: 0.35; }
}

@keyframes hull-shake {
    0%, 100% { transform: translate(0); }
    25% { transform: translate(-3px, 2px); }
    50% { transform: translate(2px, -2px); }
    75% { transform: translate(3px, 1px); }
}

.traversal-controls button:hover:not(:disabled) {
    border-color: #58a2bc;
    color: #edfbff;
    background: #123342;
}

.begin-abyss-run {
    width: 100%;
    min-height: 52px;
    margin-top: 16px;
    border: 1px solid #45829a;
    color: #d9f5ff;
    background: #123342;
    font-weight: 700;
}

@keyframes dive-into-abyss {
    0% {
        opacity: 0.92;
        transform: scale(1);
    }
    62% {
        opacity: 1;
        transform: scale(2.8) rotate(-8deg);
    }
    100% {
        opacity: 0;
        filter: contrast(1.5) saturate(0.5) brightness(0.08) blur(2px);
        transform: scale(20) rotate(-22deg);
    }
}

@keyframes abyss-blackout {
    0%, 58% { opacity: 0; }
    100% { opacity: 1; }
}

@keyframes reveal-abyss {
    from { opacity: 0; }
    to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .abyss-entry-vortex,
    .abyss-entry-shade,
    .abyss-frame {
        animation-duration: 1ms;
    }
}

@media (max-width: 640px) {
    .abyss-header {
        flex-direction: column;
        align-items: stretch;
    }

    .dive-console {
        grid-template-columns: 1fr;
    }

    .camera-feed {
        min-height: 300px;
    }
}
</style>
