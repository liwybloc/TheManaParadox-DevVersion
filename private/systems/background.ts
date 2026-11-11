import { isWorldTimeStopped } from "../game/time.js";
let visualTime = performance.now();
const sky = document.getElementById("sky") as HTMLCanvasElement;
const skyContext = sky.getContext("2d")!;
let context = skyContext;
const STAR_COUNT = 200;
const MAXIMUM_DRIFT_PIXELS_PER_SECOND = 300;
const STAR_FRAME_INTERVAL = 1000 / 30;
const MAXIMUM_DEVICE_PIXEL_RATIO = 2;
const STARS_VISIBLE_STORAGE_KEY = "starsVisible";
const STARS_ANIMATED_STORAGE_KEY = "starsAnimated";

type Star = {
    x: number;
    y: number;
    size: number;
    directionX: number;
    directionY: number;
    twinkleDuration: number;
    twinkleOffset: number;
    minimumOpacity: number;
};

const stars: Star[] = [];
let manaProgress = 0;
let previousFrame = performance.now();
let previousRenderedFrame = 0;
let animationEnabled = true;
let visible = true;
let abyssActive = false;
let abyssVortexActive = false;
let width = window.innerWidth;
let height = window.innerHeight;
const abyssBubbles = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: random(3, 18),
    speed: random(0.025, 0.09),
    drift: random(-0.035, 0.035),
    opacity: random(0.25, 0.8),
}));

function random(minimum: number, maximum: number): number {
    return Math.random() * (maximum - minimum) + minimum;
}

for (let index = 0; index < STAR_COUNT; index++) {
    const angle = random(0, Math.PI * 2);
    stars.push({
        x: random(0, width),
        y: random(0, height),
        size: random(1, 3),
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        twinkleDuration: random(1.8, 5.5),
        twinkleOffset: random(-5.5, 0),
        minimumOpacity: random(0.15, 0.55),
    });
}

function resizeSky(): void {
    const previousWidth = width;
    const previousHeight = height;
    width = window.innerWidth;
    height = window.innerHeight;
    const devicePixelRatio = Math.min(MAXIMUM_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1);
    sky.width = Math.max(1, Math.round(width * devicePixelRatio));
    sky.height = Math.max(1, Math.round(height * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    if (previousWidth > 0 && previousHeight > 0) {
        for (const star of stars) {
            star.x = star.x / previousWidth * width;
            star.y = star.y / previousHeight * height;
        }
    }
    drawStars(visualTime);
}

function drawStars(timestamp: number): void {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fff";
    for (const star of stars) {
        const cycle = (timestamp / 1000 + star.twinkleOffset) / star.twinkleDuration;
        const wave = (Math.sin(cycle * Math.PI) + 1) / 2;
        context.globalAlpha = animationEnabled
            ? star.minimumOpacity + (1 - star.minimumOpacity) * wave
            : 1;
        context.beginPath();
        context.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
        context.fill();
    }
    context.globalAlpha = 1;
}

function drawAbyss(timestamp: number): void {
    context.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = Math.min(height * 0.58, 520);
    const portalSize = Math.min(width, height) * 0.68;
    const radius = portalSize * 0.48;
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#2a668d");
    background.addColorStop(0.28, "#123c5d");
    background.addColorStop(0.62, "#071d35");
    background.addColorStop(1, "#020817");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(centerX * 0.9, centerY * 0.86, 0, centerX, centerY, radius * 1.35);
    glow.addColorStop(0, "rgba(35, 104, 145, 0.42)");
    glow.addColorStop(0.55, "rgba(12, 51, 83, 0.2)");
    glow.addColorStop(1, "rgba(0, 5, 14, 0.4)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    for (const bubble of abyssBubbles) {
        bubble.y -= bubble.speed / 60;
        bubble.x += Math.sin(timestamp / 1200 + bubble.y * 10) * bubble.drift / 60;
        if (bubble.y < -0.08) {
            bubble.y = 1.04;
            bubble.x = Math.random();
            bubble.size = random(3, 18);
        }
        const x = bubble.x * width;
        const y = bubble.y * height;
        context.beginPath();
        context.arc(x, y, bubble.size / 2, 0, Math.PI * 2);
        context.strokeStyle = `rgba(71, 129, 174, ${bubble.opacity})`;
        context.lineWidth = 1;
        context.fillStyle = "rgba(22, 69, 105, 0.18)";
        context.shadowBlur = 10;
        context.shadowColor = "rgba(34, 105, 153, 0.55)";
        context.fill();
        context.stroke();
    }
    context.shadowBlur = 0;
}

let previousVisualTime = performance.now();
let visualsStopped = false;
function animateStars(timestamp: number): void {
    requestAnimationFrame(animateStars);
    const stopped = isWorldTimeStopped();
    const visualDelta = Math.max(0, timestamp - previousVisualTime);
    previousVisualTime = timestamp;
    if (stopped !== visualsStopped) {
        visualsStopped = stopped;
        updateAbyssVortexPlayback();
    }
    if (stopped) { previousFrame = timestamp; return; }
    visualTime += visualDelta;
    if (!visible || document.hidden || timestamp - previousRenderedFrame < STAR_FRAME_INTERVAL) return;
    const elapsedSeconds = Math.min(0.1, Math.max(0, timestamp - previousFrame) / 1000);
    previousFrame = timestamp;
    previousRenderedFrame = timestamp;
    if (abyssActive) {
        drawAbyss(visualTime);
        return;
    }
    if (animationEnabled && manaProgress > 0) {
        const distance = MAXIMUM_DRIFT_PIXELS_PER_SECOND * manaProgress * elapsedSeconds;
        for (const star of stars) {
            star.x = (star.x + star.directionX * distance + width) % width;
            star.y = (star.y + star.directionY * distance + height) % height;
        }
    }
    drawStars(visualTime);
}

export function starsVisible(): boolean {
    return localStorage.getItem(STARS_VISIBLE_STORAGE_KEY) !== "false";
}

export function starsAnimated(): boolean {
    return localStorage.getItem(STARS_ANIMATED_STORAGE_KEY) !== "false";
}

export function setStarsVisible(nextVisible: boolean): void {
    visible = nextVisible;
    document.body.classList.toggle("effects-disabled", !nextVisible);
    localStorage.setItem(STARS_VISIBLE_STORAGE_KEY, String(nextVisible));
    if (nextVisible) drawStars(visualTime);
}

export function setStarsAnimated(animated: boolean): void {
    animationEnabled = animated;
    localStorage.setItem(STARS_ANIMATED_STORAGE_KEY, String(animated));
    drawStars(visualTime);
}

export function setStarManaProgress(progress: number): void {
    manaProgress = Math.max(0, Math.min(1, progress));
}

export function setAbyssActive(active: boolean): void {
    abyssActive = active;
    updateAbyssVortexPlayback();
    if (active) drawAbyss(visualTime);
    else {
        context = skyContext;
        drawStars(visualTime);
    }
}

export function setAbyssVortexActive(active: boolean): void {
    abyssVortexActive = active;
    updateAbyssVortexPlayback();
}

function updateAbyssVortexPlayback(): void {
    const active = abyssActive && abyssVortexActive;
    const abyssVortex = document.getElementById("abyss-vortex") as HTMLVideoElement | null;
    if (!abyssVortex) {
        if (active) requestAnimationFrame(updateAbyssVortexPlayback);
        return;
    }
    abyssVortex.hidden = !active;
    if (active && !isWorldTimeStopped()) void abyssVortex.play().catch(() => {});
    else abyssVortex.pause();
}

window.addEventListener("resize", resizeSky);
resizeSky();
setStarsVisible(starsVisible());
setStarsAnimated(starsAnimated());
requestAnimationFrame(animateStars);
