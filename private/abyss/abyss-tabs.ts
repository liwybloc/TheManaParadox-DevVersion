export const ABYSS_TABS = [
    { id: "depths", label: "The Depths", icon: "꩜" },
] as const;

/** [WASM] */

let inAbyss = false;

export function isInAbyss(): bool {
    return inAbyss;
}
export function setInAbyss(value: bool): void {
    inAbyss = value;
}

/** [/WASM] */
