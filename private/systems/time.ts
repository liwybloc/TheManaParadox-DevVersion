import { namedWasm } from "../../generated/_wasm$globals.js";
import { simulateClockTime } from "./tick.js";

export function shiftClock(seconds: number): boolean {
    if (namedWasm.getTimeDiscovery() < 2 || namedWasm.isClockBroken() || namedWasm.getClockRecoveryStage() === 3) return false;
    const remaining = 86_400 - namedWasm.getClockOffsetSeconds();
    const advance = Math.min(seconds, remaining);
    if (!simulateClockTime(advance)) return false;
    namedWasm.setClockOffsetSeconds(namedWasm.getClockOffsetSeconds() + advance);
    if (namedWasm.isClockBroken() || namedWasm.getClockRecoveryStage() === 3) namedWasm.setClockBrokenAt(Date.now());
    return true;
}

export function toggleTimeDrain(mode: number): void {
    const now = Date.now();
    if (namedWasm.getTimeDrainMode() === 1) {
        const started = namedWasm.getTimeDrainStartedAt();
        if (started > 0) namedWasm.setWorldPausedMilliseconds(namedWasm.getWorldPausedMilliseconds() + Math.max(0, now - started));
    }
    namedWasm.setTimeDrainMode(mode);
    namedWasm.setTimeDrainStartedAt(namedWasm.getTimeDrainMode() === 1 ? now : 0);
}
