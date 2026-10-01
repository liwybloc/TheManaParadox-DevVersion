export type ProgressionGoalProgress =
    | {
        readonly type: "mana";
        readonly startExponent: f64;
        readonly endExponent: f64;
        readonly maximumBeforeCompletion: f64;
        readonly doubleLog?: boolean;
    }
    | {
        readonly type: "condensed-upgrades" | "ascended-condensed-upgrades" | "shattered-crystals";
        readonly target: number;
    };

export interface ProgressionGoal {
    readonly id: string;
    readonly label: string;
    readonly completion: string;
    readonly progress: ProgressionGoalProgress;
}

export const PROGRESSION_GOALS: readonly ProgressionGoal[] = [
    { id: "sealed-meridians", label: "Sealing Meridians", completion: "sealed-meridians", progress: { type: "mana", startExponent: 0, endExponent: 16, maximumBeforeCompletion: 1 } },
    { id: "meridian-purification", label: "Purification of Meridians", completion: "meridian-purification", progress: { type: "mana", startExponent: 16, endExponent: 71, maximumBeforeCompletion: 1 } },
    { id: "guild", label: "the Guild", completion: "guild-member", progress: { type: "mana", startExponent: 71, endExponent: 210, maximumBeforeCompletion: 1 } },
    { id: "courage", label: "unleashing Courage", completion: "courage", progress: { type: "mana", startExponent: 210, endExponent: 290, maximumBeforeCompletion: 1 } },
    { id: "condense", label: "Condense", completion: "condensed", progress: { type: "mana", startExponent: 0, endExponent: 308.25471555991675, maximumBeforeCompletion: 1 } },
    { id: "ascension-hall", label: "the Ascension Hall", completion: "ascension-hall", progress: { type: "condensed-upgrades", target: 20 } },
    { id: "crystals", label: "Crystals", completion: "crystals", progress: { type: "ascended-condensed-upgrades", target: 20 } },
    { id: "abyss", label: "the Abyss", completion: "abyss", progress: { type: "shattered-crystals", target: 15 } },
    { id: "transmutation", label: "Transmutation", completion: "never", progress: { type: "mana", startExponent: 0, endExponent: 9e15, maximumBeforeCompletion: 1, doubleLog: true } },
];
