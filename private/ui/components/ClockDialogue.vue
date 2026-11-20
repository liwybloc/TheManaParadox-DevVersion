<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { setKeybindsBlocked } from "@game/systems/keybinds.js";
import { createGlitchPositions, renderGlitchText } from "../textoptions.js";

const emit = defineEmits(["return", "complete"]);
const phase = ref("entering");
const step = ref(0);
const messagePhase = ref("in");
let pendingChoice = 0;
const denied = ref(false);
const redacted = ref(["????", "????"]);
const container = ref(null);
const text = computed(() => [
    'You: "Who are you?"', 'You: "What happened?"', '...',
    denied.value ? 'Yes you did.' : 'You broke it...', 'They will find you.',
][step.value]);
const choices = computed(() => step.value < 3 ? redacted.value
    : step.value === 3 ? ["Yes", denied.value ? "Yes" : "No"] : ["No", "No"]);
let interval;
function choose(index) {
    if (phase.value !== "speaking" || messagePhase.value !== "idle") return;
    pendingChoice = index;
    messagePhase.value = "out";
}
function messageAnimationEnded(event) {
    if (event.target !== event.currentTarget) return;
    if (messagePhase.value === "in") {
        messagePhase.value = "idle";
        return;
    }
    if (messagePhase.value !== "out") return;
    if (step.value < 3) step.value++;
    else if (step.value === 3) {
        if (pendingChoice === 1 && !denied.value) denied.value = true;
        else step.value = 4;
    } else {
        emit("return");
        phase.value = "returning";
        return;
    }
    messagePhase.value = "in";
}
function animationEnded(event) {
    if (event.target !== event.currentTarget) return;
    if (phase.value === "entering") phase.value = "speaking";
    else if (phase.value === "returning") emit("complete");
}
onMounted(() => {
    setKeybindsBlocked(true);
    container.value?.focus();
    interval = setInterval(() => {
        redacted.value = [renderGlitchText(5, createGlitchPositions(5, 3)), renderGlitchText(5, createGlitchPositions(5, 3))];
    }, 100);
});
onBeforeUnmount(() => { clearInterval(interval); setKeybindsBlocked(false); });
</script>

<template>
    <div ref="container" class="clock-dialogue" :class="phase" role="dialog" aria-modal="true"
        aria-label="A voice in stopped time" tabindex="-1" @animationend="animationEnded">
        <div v-if="phase === 'speaking'" class="clock-words" :class="`message-${messagePhase}`" @animationend="messageAnimationEnded">
            <p>{{ text }}</p>
            <div class="clock-choices"><button v-for="(label, index) in choices" :key="index" type="button"
                :disabled="phase !== 'speaking' || messagePhase !== 'idle'" @click="choose(index)">{{ label }}</button></div>
        </div>
    </div>
</template>

<style scoped>
.clock-dialogue { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: #000; color: #d0c8df; font-family: monospace; outline: none; }
.clock-words { width: min(320px, 85vw); text-align: center; }
.clock-words p { margin: 0 0 24px; font-size: 15px; }
.clock-choices { display: flex; justify-content: center; gap: 18px; }
.clock-choices button { min-width: 48px; padding: 4px 8px; border: 0; border-radius: 0; background: #16141a; color: #ccc; font: 12px monospace; cursor: pointer; }
.clock-choices button:hover, .clock-choices button:focus-visible { background: #302737; outline: 1px solid #796889; }
.entering { animation: voice-darkens 2.5s ease both; }
.message-in { animation: voice-darkens 900ms ease both; }
.message-out { animation: voice-fades 700ms ease both; }
.returning { animation: voice-fades 2.5s ease both; }
@keyframes voice-darkens { from { opacity: 0; } to { opacity: 1; } }
@keyframes voice-fades { from { opacity: 1; } to { opacity: 0; } }
</style>
