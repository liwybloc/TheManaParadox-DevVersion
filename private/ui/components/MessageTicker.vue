<script setup>
import {
    ref,
    onMounted,
    onUnmounted,
    onBeforeUnmount,
    watch
} from 'vue';
import { MESSAGE_TICKERS, recordMessageTicker } from '@game/game/message_tickers.js';

const props = defineProps({
    particles: { type: Boolean, required: true },
    paused: { type: Boolean, default: false }
});
const emit = defineEmits(['message-displayed']);

const config = {
    fontSize: 24,
    fontFamily: 'Georgia, serif',
    sampleGap: 2,
    particleSizeMin: 0.7,
    particleSizeMax: 1.5,

    assembleTime: 900,
    scatterTime: 900,

    msPerCharacter: 125,
    minimumReadTime: 3000
};
const PARTICLE_FRAME_INTERVAL = 1000 / 30;

function getMessageDuration() {
    return message.value.length * config.msPerCharacter + config.minimumReadTime;
}

function getHoldTime() {
    return Math.max(
        1000,
        getMessageDuration(message.value) -
        config.assembleTime -
        config.scatterTime
    );
}

function getRandomMessageIndex() {
    return Math.floor(Math.random() * MESSAGE_TICKERS.length);
}
let messageIndex = getRandomMessageIndex();
const message = ref(MESSAGE_TICKERS[messageIndex]);
let timer;
let messageDue = 0;
let messageRemaining = 0;
let pausedAt = 0;
let particlePauseDuration = 0;
watch(() => props.paused, (paused) => {
    if (paused) {
        pausedAt = performance.now();
        messageRemaining = Math.max(0, messageDue - pausedAt);
        clearTimeout(timer);
    } else {
        const duration = performance.now() - pausedAt;
        startTime += duration;
        particlePauseDuration += duration;
        messageDue = performance.now() + messageRemaining;
        timer = setTimeout(nextMessage, messageRemaining);
    }
});

function recordDisplayedMessage() {
    const statistics = recordMessageTicker(messageIndex);
    emit('message-displayed', statistics);
}

function nextMessage() {
    let nextIndex;
    do {
        nextIndex = getRandomMessageIndex();
    } while (nextIndex === messageIndex);
    messageIndex = nextIndex;
    message.value = MESSAGE_TICKERS[messageIndex];
    recordDisplayedMessage();
    beginNextMessage();
}

function beginNextMessage() {
    messageRemaining = getMessageDuration();
    messageDue = performance.now() + messageRemaining;
    if (props.paused) { pausedAt = performance.now(); return; }
    timer = setTimeout(nextMessage, messageRemaining);
}

onMounted(() => {
    recordDisplayedMessage();
    beginNextMessage();
});
onUnmounted(() => {
    clearTimeout(timer);
});

const canvas = ref(null);
let ctx;
let particles = [];
let animationFrame;
let startTime = 0;
let canvasInitialized = false;
let previousParticleFrame = 0;
let canvasWidth = 0;
let canvasHeight = 0;
let holdTime = 0;

function resizeCanvas() {
    const el = canvas.value;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.width = rect.width * dpr;
    el.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    buildParticles();
}

function buildParticles() {
    const el = canvas.value;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const bctx = buffer.getContext('2d');
    bctx.clearRect(0, 0, width, height);
    bctx.fillStyle = '#fff';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    const horizontalPadding = 30;
    const maxTextWidth = width - horizontalPadding * 2;
    let fontSize = config.fontSize;
    bctx.font = `${fontSize}px ${config.fontFamily}`;
    let measuredWidth = bctx.measureText(message.value).width;
    if (measuredWidth > maxTextWidth) {
        fontSize *= maxTextWidth / measuredWidth;
    }
    fontSize = Math.max(fontSize, 14);
    bctx.font = `${fontSize}px ${config.fontFamily}`;
    bctx.fillText(message.value, width / 2, height / 2);
    const data = bctx.getImageData(0, 0, width, height).data;
    particles = [];
    for (let y = 0; y < height; y += config.sampleGap) {
        for (let x = 0; x < width; x += config.sampleGap) {
            const index = (y * width + x) * 4;
            const alpha = data[index + 3];
            if (alpha > 80) {
                particles.push({
                    targetX: x,
                    targetY: y,
                    x: Math.random() * width,
                    y: Math.random() * height,
                    scatterX: x + (Math.random() - 0.5) * 160,
                    scatterY: y + (Math.random() - 0.5) * 100,
                    delay: Math.random() * 250,
                    size: config.particleSizeMin + Math.random() * (config.particleSizeMax - config.particleSizeMin),
                    brightness: Math.random()
                });
            }
        }
    }
    holdTime = getHoldTime();
    startTime = performance.now();
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function animate(time) {
    const el = canvas.value;
    if (!el || !ctx) {
        return;
    }
    animationFrame = requestAnimationFrame(animate);
    if (props.paused || document.hidden || time - previousParticleFrame < PARTICLE_FRAME_INTERVAL) return;
    previousParticleFrame = time;
    const width = canvasWidth;
    const height = canvasHeight;
    ctx.clearRect(0, 0, width, height);
    const elapsed = time - startTime;
    for (const particle of particles) {
        const localTime = elapsed - particle.delay;
        let x;
        let y;
        let alpha = 1;
        if (localTime < 0) {
            x = particle.x;
            y = particle.y;
            alpha = 0;
        } else if (localTime < config.assembleTime) {
            const progress = easeOutCubic(localTime / config.assembleTime);
            x = lerp(particle.x, particle.targetX, progress);
            y = lerp(particle.y, particle.targetY, progress);
            alpha = progress;
        } else if (localTime < config.assembleTime + holdTime) {
            x = particle.targetX;
            y = particle.targetY;
            x += Math.sin((time - particlePauseDuration) * 0.003 + particle.targetY * 0.15) * 0.25;
            y += Math.cos((time - particlePauseDuration) * 0.002 + particle.targetX * 0.15) * 0.25;
        } else {
            const scatterStart = config.assembleTime + holdTime;
            const progress = Math.min(
                (localTime - scatterStart) / config.scatterTime, 1);
            const easedProgress = easeInCubic(progress);
            x = lerp(particle.targetX, particle.scatterX, easedProgress);
            y = lerp(particle.targetY, particle.scatterY, easedProgress);
            alpha = 1 - progress;
        }
        ctx.globalAlpha = alpha;
        if (particle.brightness > 0.92) {
            ctx.shadowBlur = 7;
            ctx.shadowColor = 'rgba(190, 160, 255, 0.9)';
            ctx.fillStyle = 'rgba(205, 185, 255, 1)';
        } else if (particle.brightness > 0.65) {
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(155, 115, 255, 0.7)';
            ctx.fillStyle = 'rgba(170, 135, 255, 1)';
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(145, 105, 245, 0.95)';
        }
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}
function initializeCanvas() {
    if (canvasInitialized || !canvas.value) return;
    ctx = canvas.value.getContext('2d');
    canvasInitialized = true;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationFrame = requestAnimationFrame(animate);
}

function destroyCanvas() {
    if (!canvasInitialized) return;
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', resizeCanvas);
    canvasInitialized = false;
    ctx = undefined;
    particles = [];
}

onMounted(() => {
    if (props.particles) initializeCanvas();
});
onBeforeUnmount(() => {
    destroyCanvas();
});
watch(
    () => message.value,
    () => {
        if (props.particles && canvasInitialized) buildParticles();
    });
</script>

<template>
    <div class="message-ticker-head">
        <canvas v-if="props.particles" ref="canvas" class="mana-message-canvas" />
        <div
            v-else
            :key="message"
            class="mana-message-text"
            :style="{ '--message-duration': `${getMessageDuration()}ms`, animationPlayState: paused ? 'paused' : 'running' }"
        >{{ message }}</div>
    </div>
</template>
