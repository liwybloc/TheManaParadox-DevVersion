<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { namedWasm } from "@generated/_wasm$globals.js";
import { shiftClock } from "@game/systems/time.js";
import { saveGame } from "@game/systems/save.js";
import TimeUpgrades from "./TimeUpgrades.vue";
import { createGlitchPositions, renderGlitchText } from "../textoptions.js";

const props = defineProps({ revealed: Boolean, animateEntrance: Boolean });
const emit = defineEmits(["label", "complete", "entrance-complete"]);
const title = ref(props.revealed ? "Time" : "????");
const clockVisible = ref(props.revealed);
const animateClock = ref(!props.revealed || props.animateEntrance);
const animateUpgrades = ref(false);
watch(() => props.animateEntrance, (value) => { if (value) animateClock.value = true; });
function clockEntranceEnded(event) {
    if (event.target !== event.currentTarget || !animateClock.value) return;
    animateClock.value = false;
    emit("entrance-complete");
}
const now = ref(new Date());
const offset = ref(namedWasm.getClockOffsetSeconds());
const broken = ref(namedWasm.isClockBroken());
const recoveryStage = ref(namedWasm.getClockRecoveryStage());
watch(recoveryStage, (stage, previous) => {
    if (stage === 3 && previous === 2) animateUpgrades.value = true;
});
const repairPieces = ref(namedWasm.getClockRepairPieces());
const joining = ref({});
const piecePositions = ref({});
const instruction = computed(() => recoveryStage.value === 3 ? "" : !broken.value ? "Drag the hands..."
    : recoveryStage.value === 2 ? "Drag the pieces." : "It's broken.");
const crackProgress = computed(() => recoveryStage.value === 3 ? 0 : Math.max(0, Math.min(1, (offset.value - 43_200) / 43_200)));
const brokenAt = ref(namedWasm.getClockBrokenAt());
const drainFrozenAt = ref(0);
const worldPaused = ref(namedWasm.getWorldPausedMilliseconds());
const clock = ref(null);
const clockId = useId();
const fractureDelay = ref(0);
const fracturePieces = [
    "0,0 84,0 108,65 98,83 128,116 119,138 84,148 68,171 0,194",
    "84,0 280,0 280,78 194,116 185,145 153,160 119,138 128,116 98,83 108,65",
    "0,194 68,171 84,148 119,138 153,160 144,185 173,216 192,280 0,280",
    "153,160 185,145 194,116 280,78 280,280 192,280 173,216 144,185",
];
const crackPath = "M 84 0 L 108 65 L 98 83 L 128 116 L 119 138 L 153 160 L 144 185 L 173 216 L 192 280 M 119 138 L 84 148 L 68 171 L 0 194 M 153 160 L 185 145 L 194 116 L 280 78";
watch(broken, (value) => {
    fractureDelay.value = value ? -Math.max(0, (Date.now() - namedWasm.getClockBrokenAt()) / 1000) : 0;
}, { immediate: true });
let drag = null;
const falls = [{ x: -23, y: 14, turn: -12 }, { x: 25, y: 7, turn: 10 }, { x: -15, y: 34, turn: -8 }, { x: 21, y: 39, turn: 15 }];
function pieceStyle(index) {
    const position = piecePositions.value[index];
    if (!position) return {};
    const fall = falls[index];
    const transform = `translate(${fall.x + position.x}px, ${fall.y + position.y}px) rotate(${fall.turn}deg)`;
    return joining.value[index]
        ? { '--rejoin-from': transform }
        : { animation: 'none', transform };
}
function startPieceDrag(event, index) {
    if (recoveryStage.value !== 2 || drag || event.button !== 0 || joining.value[index] || (repairPieces.value & (1 << index))) return;
    event.preventDefault();
    const matrix = clock.value?.getScreenCTM();
    if (!matrix) return;
    clock.value.setPointerCapture(event.pointerId);
    drag = { kind: 'piece', index, pointer: event.pointerId, x: event.clientX, y: event.clientY, scale: matrix.a, moved: false };
}
function pieceAnimationEnded(event, index) {
    if (event.target !== event.currentTarget || !event.animationName.startsWith('clock-rejoin') || !joining.value[index]) return;
    namedWasm.repairClockPiece(index, Date.now());
    worldPaused.value = namedWasm.getWorldPausedMilliseconds();
    repairPieces.value = namedWasm.getClockRepairPieces();
    recoveryStage.value = namedWasm.getClockRecoveryStage();
    broken.value = namedWasm.isClockBroken();
    delete joining.value[index];
    delete piecePositions.value[index];
    void saveGame();
}

function pointerAngle(event) {
    const matrix = clock.value?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (Math.hypot(point.x - 140, point.y - 140) < 12) return null;
    return Math.atan2(point.x - 140, 140 - point.y) * 180 / Math.PI;
}
function startDrag(event, period) {
    if (broken.value || recoveryStage.value === 3 || drag || event.button !== 0) return;
    const angle = pointerAngle(event);
    if (angle === null) return;
    event.preventDefault();
    clock.value.setPointerCapture(event.pointerId);
    drag = { pointer: event.pointerId, angle, position: 0, furthest: 0, period };
}
function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (drag.kind === 'piece') {
        const x = (event.clientX - drag.x) / drag.scale;
        const y = (event.clientY - drag.y) / drag.scale;
        if (Math.hypot(x, y) > 5) drag.moved = true;
        if (drag.moved) piecePositions.value[drag.index] = { x, y };
        return;
    }
    if (broken.value) return;
    const angle = pointerAngle(event);
    if (angle === null) return;
    const delta = ((angle - drag.angle + 540) % 360) - 180;
    drag.angle = angle;
    drag.position += delta;
    if (drag.position <= drag.furthest) return;
    const seconds = (drag.position - drag.furthest) / 360 * drag.period;
    if (!shiftClock(seconds)) return;
    drag.furthest = drag.position;
    offset.value = namedWasm.getClockOffsetSeconds();
    broken.value = namedWasm.isClockBroken();
    recoveryStage.value = namedWasm.getClockRecoveryStage();
    repairPieces.value = namedWasm.getClockRepairPieces();
    brokenAt.value = namedWasm.getClockBrokenAt();
    now.value = new Date();
    if (broken.value) endDrag(event);
}
function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const pointer = drag.pointer;
    if (drag.kind === 'piece' && drag.moved) joining.value[drag.index] = true;
    drag = null;
    if (clock.value?.hasPointerCapture(pointer)) clock.value.releasePointerCapture(pointer);
    void saveGame();
}
const numerals = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const clockDate = computed(() => {
    const date = new Date(broken.value && brokenAt.value > 0 ? brokenAt.value : drainFrozenAt.value > 0 ? drainFrozenAt.value : now.value.getTime());
    date.setTime(date.getTime() - worldPaused.value);
    const month = date.getMonth();
    date.setFullYear(date.getFullYear() + 3496);
    if (date.getMonth() !== month) date.setDate(0);
    date.setTime(date.getTime() + (((16 * 60 + 23) * 60 + 53) + offset.value) * 1000);
    return date;
});
const calendarText = computed(() => {
    const date = clockDate.value;
    const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        - Date.UTC(date.getFullYear(), 0, 1)) / 86400000) + 1;
    return `${day}-${date.getFullYear()}`;
});
const secondsAngle = computed(() => clockDate.value.getSeconds() * 6);
const minutesAngle = computed(() => clockDate.value.getMinutes() * 6 + clockDate.value.getSeconds() / 10);
const hoursAngle = computed(() => (clockDate.value.getHours() % 12) * 30 + clockDate.value.getMinutes() / 2);
const timeText = computed(() => [clockDate.value.getHours(), clockDate.value.getMinutes(), clockDate.value.getSeconds()]
    .map((value) => String(value).padStart(2, "0")).join(":"));
let revealInterval;
let tickTimeout;

function tick() {
    now.value = new Date();
    offset.value = namedWasm.getClockOffsetSeconds();
    broken.value = namedWasm.isClockBroken();
    recoveryStage.value = namedWasm.getClockRecoveryStage();
    repairPieces.value = namedWasm.getClockRepairPieces();
    brokenAt.value = namedWasm.getClockBrokenAt();
    worldPaused.value = namedWasm.getWorldPausedMilliseconds();
    drainFrozenAt.value = namedWasm.getTimeDrainMode() === 1 ? namedWasm.getTimeDrainStartedAt() : 0;
    tickTimeout = setTimeout(tick, 1000 - Date.now() % 1000);
}

onMounted(() => {
    tick();
    if (props.revealed) return;
    const start = performance.now();
    revealInterval = setInterval(() => {
        const elapsed = performance.now() - start;
        const count = Math.min(4, Math.floor(elapsed / 1400));
        title.value = "Time".slice(0, count) + renderGlitchText(4 - count, createGlitchPositions(4 - count, 2));
        emit("label", title.value);
        if (count === 4) {
            clearInterval(revealInterval);
            clockVisible.value = true;
            emit("complete");
        }
    }, 100);
});
onBeforeUnmount(() => {
    clearInterval(revealInterval);
    clearTimeout(tickTimeout);
    if (drag) void saveGame();
});
</script>

<template>
    <section class="time-reveal">
        <h1>{{ title }}</h1>
        <p v-if="clockVisible && instruction" class="clock-instruction">{{ instruction }}</p>
        <div v-if="clockVisible" class="time-content" :class="{ 'time-entering': animateClock }" @animationend="clockEntranceEnded">
            <svg ref="clock" class="time-clock" :class="{ broken, repaired: recoveryStage === 3 }"
                @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" viewBox="0 0 280 280" role="group" :aria-label="`Clock: ${timeText}, day ${calendarText}`">
                <defs>
                    <clipPath v-for="(points, index) in fracturePieces" :id="`${clockId}-piece-${index}`" :key="index" clipPathUnits="userSpaceOnUse">
                        <polygon :points="points" />
                    </clipPath>
                    <clipPath :id="`${clockId}-rim`"><circle cx="140" cy="140" r="126" /></clipPath>
                    <g :id="`${clockId}-face`">
                <circle class="clock-outline" cx="140" cy="140" r="126" />
                <circle class="clock-inner" cx="140" cy="140" r="119" />
                <g v-for="mark in 60" :key="mark" :transform="`rotate(${(mark - 1) * 6} 140 140)`">
                    <line :class="(mark - 1) % 5 === 0 ? 'clock-major' : 'clock-minor'"
                        x1="140" y1="21" x2="140" :y2="(mark - 1) % 5 === 0 ? 32 : 25" />
                </g>
                <text v-for="(numeral, index) in numerals" :key="numeral" class="clock-numeral"
                    :x="140 + Math.sin(index * Math.PI / 6) * 97"
                    :y="140 - Math.cos(index * Math.PI / 6) * 97">{{ numeral }}</text>
                <path class="clock-hour" d="M 140 149 L 136 130 L 140 81 L 144 130 Z"
                    :transform="`rotate(${hoursAngle} 140 140)`" />
                <path class="clock-minute" d="M 140 154 L 137 128 L 140 55 L 143 128 Z"
                    :transform="`rotate(${minutesAngle} 140 140)`" />
                <line class="clock-second" x1="140" y1="161" x2="140" y2="39"
                    :transform="`rotate(${secondsAngle} 140 140)`" />
                <circle class="clock-pin" cx="140" cy="140" r="4" />
                    </g>
                </defs>
                <use v-if="!broken" :href="`#${clockId}-face`" />
                <g v-else class="clock-fragments" :style="{ '--break-delay': `${fractureDelay}s` }">
                    <g v-for="(_, index) in fracturePieces" :key="index" class="clock-fragment"
                        :class="[`fragment-${index}`, { attached: (repairPieces & (1 << index)) !== 0, repairable: recoveryStage === 2, joining: joining[index] }]"
                        :style="pieceStyle(index)" @pointerdown="startPieceDrag($event, index)" @animationend="pieceAnimationEnded($event, index)">
                        <g :clip-path="`url(#${clockId}-piece-${index})`">
                            <use :href="`#${clockId}-face`" />
                            <polygon v-if="recoveryStage === 2 && !(repairPieces & (1 << index))" class="fragment-hit"
                                :points="fracturePieces[index]" :clip-path="`url(#${clockId}-rim)`" />
                            <path class="clock-fracture-edge" :d="crackPath" :clip-path="`url(#${clockId}-rim)`" />
                        </g>
                    </g>
                </g>
                <path class="clock-hand-hit" d="M 140 149 L 140 81" :transform="`rotate(${hoursAngle} 140 140)`" @pointerdown="startDrag($event, 43200)" />
                <path class="clock-hand-hit" d="M 140 154 L 140 55" :transform="`rotate(${minutesAngle} 140 140)`" @pointerdown="startDrag($event, 3600)" />
                <path class="clock-hand-hit" d="M 140 161 L 140 39" :transform="`rotate(${secondsAngle} 140 140)`" @pointerdown="startDrag($event, 60)" />
                <path v-if="crackProgress > 0 && !broken" class="clock-crack" pathLength="1"
                    :clip-path="`url(#${clockId}-rim)`" :d="crackPath"
                    :style="{ strokeDasharray: 1, strokeDashoffset: 1 - crackProgress, opacity: 0.35 + crackProgress * 0.65 }" />
            </svg>
            <div class="clock-inscription">
                <time class="clock-reading">{{ timeText }}</time>
                <span class="clock-date" aria-label="Day of year and year">{{ calendarText }}</span>
            </div>
        </div>
        <TimeUpgrades v-if="clockVisible && recoveryStage === 3" :animate-entrance="animateUpgrades" />
    </section>
</template>

<style scoped>
.time-reveal { text-align: center; padding: 48px 0; font-family: monospace; color: #d0c8df; }
.time-reveal h1 { margin: 0 0 10px; font-size: 24px; font-weight: normal; letter-spacing: 0.2em; }
.clock-instruction { margin: 0 0 30px; font-size: 12px; color: #8f7c9f; }
.clock-hand-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: grab; }
.time-clock:active .clock-hand-hit { cursor: grabbing; }
.broken .clock-hand-hit, .repaired .clock-hand-hit { pointer-events: none; cursor: default; }
.clock-crack { stroke: #b3a0b6; stroke-width: 1.5; pointer-events: none; transition: stroke-dashoffset 0.15s linear, opacity 0.15s linear; }
.time-clock.broken { margin-bottom: 38px; }
.clock-fragments { pointer-events: none; }
.clock-fragment.repairable { pointer-events: auto; cursor: grab; }
.clock-fragment.joining { animation: clock-rejoin 1.2s ease-in-out both; }
.clock-fragment.attached { animation: none !important; transform: none !important; opacity: 1; pointer-events: none; }
.fragment-hit { fill: transparent; stroke: none; pointer-events: all; }
@keyframes clock-rejoin { from { transform: var(--rejoin-from); opacity: .6; } to { transform: translate(0, 0) rotate(0); opacity: 1; } }
.clock-fragment { transform-origin: 140px 140px; animation: clock-break 1.8s cubic-bezier(.3, .05, .7, 1) both; animation-delay: var(--break-delay, 0s); }
.fragment-0 { --fall-x: -23px; --fall-y: 14px; --turn: -12deg; }
.fragment-1 { --fall-x: 25px; --fall-y: 7px; --turn: 10deg; }
.fragment-2 { --fall-x: -15px; --fall-y: 34px; --turn: -8deg; }
.fragment-3 { --fall-x: 21px; --fall-y: 39px; --turn: 15deg; }
.clock-fracture-edge { stroke: #b3a0b6; stroke-width: 1; fill: none; }
@keyframes clock-break {
    0% { transform: translate(0, 0) rotate(0); opacity: 1; }
    12% { transform: translate(1px, -1px) rotate(-1deg); }
    22% { transform: translate(-1px, 1px) rotate(1deg); }
    100% { transform: translate(var(--fall-x), var(--fall-y)) rotate(var(--turn)); opacity: .6; }
}
.time-content { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.time-entering { animation: time-emerges 3s ease-out both; }
.time-clock { display: block; width: min(280px, 75vw); overflow: visible; touch-action: none; user-select: none; fill: none; stroke: #9482aa; stroke-width: 1; }
.clock-inner, .clock-minor { stroke: #50415e; }
.clock-major { stroke: #b3a1c5; }
.clock-numeral { fill: #ae9bbf; stroke: none; text-anchor: middle; dominant-baseline: central; font-family: Georgia, serif; font-size: 13px; }
.clock-hour, .clock-minute { stroke: #c9b6dc; fill: #100c16; }
.clock-second { stroke: #896690; }
.clock-pin { fill: #100c16; stroke: #c9b6dc; }
.clock-inscription { display: flex; flex-direction: column; gap: 10px; }
.clock-date { color: #756382; font-size: 12px; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }
.clock-reading { color: #8f7c9f; font-size: 13px; letter-spacing: 0.25em; font-variant-numeric: tabular-nums; }
@keyframes time-emerges { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .time-entering, .clock-fragment { animation-duration: 0.01s; } }
</style>
