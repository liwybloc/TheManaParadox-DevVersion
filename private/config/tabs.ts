export const TABS = [
    {
        id: "mana",
        label: "Mana",
        icon: "✦",
        subtabs: [{ id: "basic-spells", label: "Basic Spells" }],
    },
    {
        id: "condensed",
        label: "Condensed",
        icon: "◆",
        requiresCondensed: true,
        subtabs: [
            { id: "condensed-upgrades", label: "Condensed Upgrades" },
            { id: "memories", label: "Memories", requiresMemory: true },
            { id: "remembrance", label: "Remembrance", requiresRemTree: true },
        ],
    },
    {
        id: "abyss",
        label: "Abyss",
        icon: "꩜",
        requiresAbyss: true,
        subtabs: [
            { id: "depths", label: "The Depths" },
            { id: "abyss-resonance", label: "Resonance" },
        ]
    },
    { id: "time", label: "????", icon: "⏱︎", requiresTime: true, subtabs: [
        { id: "time-clock", label: "The Clock" },
        { id: "time-mountain", label: "The Mountain", requiresMountain: true },
    ] },
    {
        id: "manacircle",
        label: "Mana Circles",
        icon: "⭕",
        requiresCondensed: true,
        subtabs: [
            { id: "current-mana-circle", label: "Current Mana Circle" },
        ],
    },
    {
        id: "crystals",
        label: "Crystals",
        icon: "◇",
        requiresCrystals: true,
        subtabs: [{ id: "crystals-main", label: "Crystals" }],
    },
    {
        id: "guild",
        label: "Guild",
        icon: "⚔",
        requiresGuild: true,
        subtabs: [
            { id: "guild-main", label: "Board" },
            { id: "guild-inventory", label: "Inventory" },
            { id: "guild-shop", label: "Shop" },
            { id: "guild-library", label: "Library", requiresLibrary: true },
            { id: "guild-ascension-hall", label: "Ascension Hall", requiresAscensionHall: true },
        ],
    },
    { id: "quest", label: "Quest", icon: "🐺", requiresQuest: true },
    { id: "autocasters", label: "Autocasters", icon: "⌁", requiresAutocasters: true },
    {
        id: "achievements",
        label: "Achievements",
        icon: "★︎",
        subtabs: [
            { id: "basic-achievements", label: "Progression" },
            { id: "challenge-achievements", label: "Challenges" },
        ]
    },
    { id: "statistics", label: "Statistics", icon: "▤" },
    {
        id: "options",
        label: "Options",
        icon: "⚙︎",
        subtabs: [
            { id: "general", label: "General" },
            { id: "visuals", label: "Visuals" },
        ],
    },
];
