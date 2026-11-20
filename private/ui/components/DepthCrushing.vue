<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { setKeybindsBlocked } from "@game/systems/keybinds.js";
import { createGlitchPositions, renderGlitchText } from "../textoptions.js";

const emit = defineEmits(["return", "complete"]);
const stage = ref("darkening");
const forcedYes = ref(false);
const glitching = ref(false);
const redacted = ref(["????", "????"]);
const dialog = ref(null);
let interval;
let glitchTimeout;

function animationEnded(event) {
    if (event.target !== event.currentTarget) return;
    if (stage.value === "darkening") stage.value = "redacted";
    else if (stage.value === "out") {
        emit("return");
        stage.value = "back";
    } else if (stage.value === "back") emit("complete");
}
function chooseNo() {
    if (forcedYes.value) { stage.value = "out"; return; }
    forcedYes.value = true;
    glitching.value = true;
    glitchTimeout = setTimeout(() => { glitching.value = false; }, 650);
}
function blockKeys(event) {
    if (event.key === "Tab" || event.key === "Enter" || event.key === " ") return;
    event.stopImmediatePropagation();
    event.preventDefault();
}
onMounted(() => {
    setKeybindsBlocked(true);
    window.addEventListener("keydown", blockKeys, true);
    dialog.value?.focus();
    interval = setInterval(() => {
        redacted.value = [renderGlitchText(4, createGlitchPositions(4, 2)), renderGlitchText(4, createGlitchPositions(4, 2))];
    }, 110);
});
onBeforeUnmount(() => { setKeybindsBlocked(false); window.removeEventListener("keydown", blockKeys, true); clearInterval(interval); clearTimeout(glitchTimeout); });
</script>

<template>
    <div ref="dialog" class="depth-crushing" :class="[stage, { glitching }]" tabindex="-1"
        role="dialog" aria-modal="true" aria-label="The depth is too crushing" @animationend="animationEnded">
        <div v-if="stage === 'redacted' || stage === 'question'" class="depth-message">
            <p>{{ stage === 'redacted' ? 'The depth.. is too crushing...' : '...' }}</p>
            <div class="depth-choices">
                <template v-if="stage === 'redacted'">
                    <button v-for="(label, index) in redacted" :key="index" type="button"
                        :aria-label="`Redacted choice ${index + 1}`" @click="stage = 'question'">{{ label }}</button>
                </template>
                <template v-else>
                    <button type="button" @click="stage = 'out'">Yes</button>
                    <button type="button" @click="chooseNo">{{ forcedYes ? 'Yes' : 'No' }}</button>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.depth-crushing { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: #000; color: #ddd; outline: none; }
.darkening { animation: crushing-darkness 16s linear forwards; }
.depth-message { width: min(320px, 85vw); text-align: center; font-family: monospace; }
.depth-message p { margin: 0 0 22px; font-size: 15px; }
.depth-choices { display: flex; justify-content: center; gap: 18px; }
.depth-choices button { min-width: 48px; padding: 4px 8px; border: 0; border-radius: 0; background: #161616; color: #ccc; font: 12px monospace; cursor: pointer; }
.depth-choices button:hover, .depth-choices button:focus-visible { background: #333; outline: 1px solid #666; }
.out { animation: crushing-pause 1.5s forwards; }
.back { animation: crushing-return 2s forwards; pointer-events: all; }
.glitching { animation: crushing-glitch 0.13s steps(2) 5; }
@keyframes crushing-darkness {
    0% { opacity: 0; } 10% { opacity: .25; } 17% { opacity: .15; }
    27% { opacity: .4; } 34% { opacity: .3; } 44% { opacity: .55; }
    51% { opacity: .45; } 61% { opacity: .7; } 68% { opacity: .6; }
    78% { opacity: .85; } 85% { opacity: .75; } 100% { opacity: 1; }
}
@keyframes crushing-pause { from { opacity: 1; } to { opacity: 1; } }
@keyframes crushing-return { from { opacity: 1; } to { opacity: 0; } }
@keyframes crushing-glitch {
    0%, 100% { transform: translate(0); filter: none; }
    33% { transform: translate(-5px, 2px); filter: contrast(3); text-shadow: 4px 0 #b42c48; }
    66% { transform: translate(5px, -2px); text-shadow: -4px 0 #419aab; }
}
</style>
