import { isGameTimeStopped } from "../game/time.js";
import { buyMaxTierOne, castAll, castSpeed, condense, increaseMatrix, purifyMeridians, sealMeridians } from "./actions.js";

export const KEYBIND_DEFINITIONS = [
    { id: "buy-tier-1", label: "Cast Max: Mana Absorber", defaultKey: "1" },
    { id: "buy-tier-2", label: "Cast Max: Pylon", defaultKey: "2" },
    { id: "buy-tier-3", label: "Cast Max: Conduit", defaultKey: "3" },
    { id: "buy-tier-4", label: "Cast Max: Circuit", defaultKey: "4" },
    { id: "buy-tier-5", label: "Cast Max: Meridian", defaultKey: "5" },
    { id: "condense", label: "Condense", defaultKey: "c" },
    { id: "cast-all", label: "Cast Max All", defaultKey: "m" },
    { id: "cast-speed", label: "Meditate", defaultKey: "s" },
    { id: "matrix", label: "Buy Crystal Matrix", defaultKey: "x" },
    { id: "seal-meridians", label: "Seal Meridians", defaultKey: "y" },
    { id: "purify-meridians", label: "Purify Meridians", defaultKey: "p" },
];

const STORAGE_KEY = "TheManaParadoxKeybinds";
const listeners = new Set<() => void>();
const bindings = loadBindings();

export function getKeybinds(): Record<string, string> {
    return { ...bindings };
}

export function setKeybind(id: string, key: string): void {
    const definition = KEYBIND_DEFINITIONS.find((entry) => entry.id === id);
    if (!definition) return;
    const normalizedKey = normalizeKey(key);
    const previousKey = bindings[id];
    const conflict = KEYBIND_DEFINITIONS.find((entry) => bindings[entry.id] === normalizedKey && entry.id !== id);
    bindings[id] = normalizedKey;
    if (conflict) bindings[conflict.id] = previousKey;
    persistBindings();
}

export function resetKeybinds(): void {
    for (const definition of KEYBIND_DEFINITIONS) bindings[definition.id] = definition.defaultKey;
    persistBindings();
}

export function subscribeToKeybinds(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function displayKey(key: string): string {
    if (key === " ") return "Space";
    if (key.startsWith("arrow")) return `Arrow ${key.slice(5)}`;
    return key.length === 1 ? key.toUpperCase() : key;
}

const keyDown: {[key: string]: boolean} = {};
const keyPressed: {[key: string]: boolean} = {};

let keybindsBlocked = false;
export function setKeybindsBlocked(blocked: boolean): void {
    keybindsBlocked = blocked;
    for (const key of Object.keys(keyDown)) delete keyDown[key];
    for (const key of Object.keys(keyPressed)) delete keyPressed[key];
}

export function tickKeybinds() {
    if (keybindsBlocked || isGameTimeStopped()) {
        for (const key of Object.keys(keyDown)) delete keyDown[key];
        for (const key of Object.keys(keyPressed)) delete keyPressed[key];
        return;
    }
    const keys = new Set([...Object.keys(keyDown), ...Object.keys(keyPressed)]);
    for (const key of keys) {
        if (!keyDown[key] && !keyPressed[key]) continue;
        const id = actionForKey(key);
        if (id) runAction(id);
        keyPressed[key] = false;
    }
}

function isInvalid(event: KeyboardEvent) {
    return event.ctrlKey || event.altKey || event.metaKey || isEditing(event.target);
}

window.addEventListener("keydown", (event) => {
    if (keybindsBlocked || isInvalid(event)) return;
    if (!keyDown[event.key]) keyPressed[event.key] = true;
    keyDown[event.key] = true;
});
window.addEventListener("keyup", (event) => {
    keyDown[event.key] = false;
});

function actionForKey(key: string): string | undefined {
    return KEYBIND_DEFINITIONS.find((entry) => bindings[entry.id] === normalizeKey(key))?.id;
}

function runAction(id: string): void {
    switch (id) {
        case "buy-tier-1": buyMaxTierOne(0); break;
        case "buy-tier-2": buyMaxTierOne(1); break;
        case "buy-tier-3": buyMaxTierOne(2); break;
        case "buy-tier-4": buyMaxTierOne(3); break;
        case "buy-tier-5": buyMaxTierOne(4); break;
        case "condense": condense(); break;
        case "cast-all": castAll(); break;
        case "cast-speed": castSpeed(); break;
        case "matrix": increaseMatrix(); break;
        case "seal-meridians": sealMeridians(); break;
        case "purify-meridians": purifyMeridians(); break;
    }
}

function normalizeKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function loadBindings(): Record<string, string> {
    const defaults = Object.fromEntries(KEYBIND_DEFINITIONS.map((entry) => [entry.id, entry.defaultKey]));
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        if (typeof saved.mastery === "string" && typeof saved["seal-meridians"] !== "string") {
            saved["seal-meridians"] = saved.mastery;
        }
        for (const definition of KEYBIND_DEFINITIONS) {
            if (typeof saved[definition.id] === "string") defaults[definition.id] = normalizeKey(saved[definition.id]);
        }
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
    return defaults;
}

function persistBindings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    for (const listener of listeners) listener();
}

function isEditing(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || target.matches("input, textarea, select");
}
