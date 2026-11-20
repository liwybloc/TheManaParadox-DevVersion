import { REMEMBRANCE_ROWS } from "@game/game/remembrance.js";

export const topics = [
    {
        id: "welcome",
        title: "How to Play",
        summary: "An overview of The Mana Paradox and this guide.",
        paragraphs: [
            "The Mana Paradox is an incremental game about producing mana, improving your infrastructure, and breaking through increasing numerical layers of progression.",
            "Use this guide whenever you need a reminder or help about a mechanic or want to see the formula behind it.",
        ],
    },
    {
        id: "mana",
        title: "Mana and Casting",
        summary: "Produce mana and spend it on more producers.",
        paragraphs: [
            "Mana Absorbers produce mana. Pylons produce Mana Absorbers, Conduits produce Pylons, Circuits produce Conduits, and Meridians produce Circuits.",
            "Casting buys one producer. Cast Max buys as many as possible, and Cast All works from Meridians down so every part of the chain gets a chance to grow.",
            "Each producer you buy multiplies that producer by the per-boost multiplier. It begins at ×2, so the basic purchase multiplier is 2^bought. Achievements, Condensed upgrades, and Crystals can change the base.",
            "The first costs are 10, 100, 10,000, 1e8, and 1e16 mana. Before 10,000 purchases, the cost of tier t is 10^(2^t + (t + 1) × bought), where Mana Absorbers are tier 0. Cost growth accelerates after 10,000 purchases.",
            "Once you own the producer above one, its button says Boost instead of Cast. Buying it still adds a producer, but it also counts as boosting for the related challenge achievement.",
        ],
    },
    {
        id: "empowerment",
        title: "Empowerment",
        summary: "Trade producers for a stronger multiplier.",
        paragraphs: [
            "Empowering removes all of that producer and adds one Empowerment. Meridians cannot be empowered.",
            "Each Empowerment normally multiplies that producer by ×10. The relevant Condensed upgrade raises this to ×50, then ×250 in Circle Two. Crystal 2 and an achievement can improve it further.",
            "The requirement is 10^(base × growth^empowerments). The base is 50 for Mana Absorbers, 35 for Pylons, 20 for Conduits, and 10 for Circuits. Growth begins at 2, then falls to 1.9 or 1.8 with the matching upgrades.",
        ],
    },
    {
        id: "meditation",
        title: "Meditation",
        summary: "Temporarily accelerate your production.",
        paragraphs: [
            "Meditation spends mana to multiply every producer for 15 seconds. The duration becomes 20 seconds after the related achievement. Meditating again adds the same amount of time and multiplies the current power again.",
            "The first Meditation combines your Sealed Meridian effect with your Matrix power. Further Meditations multiply the current power by the Matrix power.",
            "Meditation starts at 1,000 mana. After each use, its cost is raised to the power of 2. Condensed upgrades lower that exponent to 1.9 and then 1.8. Other upgrades make the first one or two uses free.",
        ],
    },
    {
        id: "meridians",
        title: "Meridians and Matrices",
        summary: "Reset producers for stronger magical structures.",
        paragraphs: [
            "Sealing a Meridian resets mana and the producer chain. The requirement is ceil(3^owned), or ceil(2.85^owned) after the related achievement. The total shown includes one free Meridian, while its normal Meditation effect is 2^owned, or 2^(total shown - 1).",
            "Conjuring a Crystal Matrix resets mana, producers, and Sealed Meridians. The next Matrix requires 10^(matrices owned + 1) Meridians. Crystal 4 uses the same requirements with Mana Absorbers instead.",
            "Matrix power begins at 2 + matrices × matrix magnitude. Matrix magnitude starts at 0.5 per Matrix, can gain +0.1 from an achievement, and can be multiplied by a Runestone armor set. Condensed upgrades add more power.",
        ],
    },
    {
        id: "purification",
        title: "Purification of Meridians",
        summary: "Turn a large Mana Absorber count into a lasting production multiplier.",
        paragraphs: [
            "Purification unlocks from the \"Double the Sith\" achievement. It removes Mana Absorbers, Pylons, Conduits, and Circuits, then replaces your previous Purification multiplier if the new one is stronger.",
            "Before bonuses, the effect is ×16 × 2.75^((log10(absorbers) - 45) / 10). The first requirement is 1e45 Mana Absorbers. Each new requirement asks for enough Absorbers to beat your current effect by a small margin.",
            "The effect softcaps above ×350,000. Past that point, the exponent grows at the square root of its normal rate. The \"I don't believe in the Endgame\" achievement makes Purification ×5 stronger.",
        ],
    },
    {
        id: "courage",
        title: "Courage",
        summary: "A burst of game speed.",
        paragraphs: [
            "Courage unlocks at 1e290 mana, or 1e270 with its Condensed upgrade. It normally gives ×10 game speed for 15 seconds, followed by a 15 second cooldown.",
            "Upgrades extend the active time to 18.75 or 22.5 seconds. A Memory milestone doubles the power. The Condensed Mana bonus is 1 + log10(condensed mana + 1), and its Circle Two version is five times that bonus.",
        ],
    },
    {
        id: "condensing",
        title: "Condensing",
        summary: "Reset your run to gain Condensed Mana.",
        paragraphs: [
            "Condensing becomes available at about 1.79e308 mana. It resets the current run and awards Condensed Mana that can be spent on permanent upgrades.",
            "In the first Mana Circle, every Condense gives 1 Condensed Mana. In Circle Two, the base gain is log10(mana) / 44 - 6. The Super-Condensed achievement, the Ascension Hall achievement, and the first Memory milestone each double the result.",
            "Your highest mana reached is recorded separately, so Guild quests can still use your best result after a reset. You cannot Condense during a quest or Crystal run.",
        ],
    },
    {
        id: "mana-circle",
        title: "Mana Circles and Ascension",
        summary: "Break past your mana circle.",
        paragraphs: [
            "The Mana Circle shows the numerical layer you are currently pushing through. Reaching its limit is part of progression, not the end of the game.",
            "Buying every first-circle Condensed upgrade reveals the Ascension Hall upgrade. Entering the Hall lets you expand into Circle Two.",
            "In Circle Two, each Condensed upgrade has a stronger version. Your old upgrade must be owned before its Circle Two version can be bought. Buying every stronger upgrade reveals the final Crystals unlock.",
        ],
    },
    {
        id: "crystals",
        title: "Crystals",
        summary: "Complete challenge runs with special restrictions.",
        paragraphs: [
            "Crystals alter the rules of a Condense and set a mana goal. Entering one begins a fresh run. Reach the goal and shatter it to earn its permanent reward.",
            "The first five goals are 1e1600, 1e4500, 1e450, 1e40, and 1e200. Each Crystal unlocks after the one before it is completed.",
            "You can escape an unfinished Crystal, but doing so abandons that attempt. Condensing is disabled while a Crystal is active.",
        ],
    },
    {
        id: "memories",
        title: "Memories and Focus",
        summary: "Slow the game for a chance at permanent milestones.",
        paragraphs: [
            "Completing Crystal 3 unlocks Memories. Turn on Focus before Condensing for a chance to remember something. Focus cannot be started during a Crystal.",
            "Your chance is 1 / (memories + 1) + log10(condensed mana gained + 1) / 50, capped at 100%. A successful focused Condense adds one Memory. When the chance before pity is above 5%, failures build a saved pity bar. Its logarithmic progress slows with each failure, reaching a 99% chance at 100 failures; success resets it.",
            "Focus slows the game more as mana rises. Its speed multiplier is 100^(-0.5 - max(0, (log10(mana) - 1) / 25)). At 10 Memories, the base becomes 95 and the slowdown is slightly weaker.",
            "Milestones begin at 1, 3, 5, 10, and 25 Memories. They improve Condensed Mana, Courage, mana production, Focus, and later Guild progression.",
        ],
    },
    {
        id: "remembrance",
        title: "Remembrance Tree",
        summary: "A branching upgrade tree unlocked at 500 Memories.",
        paragraphs: [
            "Buy Memorials with Condensed Mana, then spend them on connected Remembrance upgrades. Nodes in later rows cost more Memorials, while nodes in the same row share a cost.",
            "The tree can be exported and imported as a comma-separated list of upgrade numbers. Respec schedules a refund of all purchased nodes on your next Condense.",
        ],
        tree: REMEMBRANCE_ROWS.join("\n"),
    },
    {
        id: "guild",
        title: "The Guild",
        summary: "Take quests, earn coins, and unlock useful systems.",
        paragraphs: [
            "Joining the Guild opens quests, ranks, an inventory, a rotating shop, and eventually equipment and auto-casters. Completing quests grants experience and item rewards.",
            "A quest two ranks below you can only fill 25% of the next rank requirement, and one rank below can only fill 50%. Some rank-ups also wait until your normal progression is strong enough.",
            "Guild coins come from selling items and achievement rewards. Shop items take 30 seconds to refresh after purchase, while permanent shop upgrades unlock extra quest slots and systems.",
        ],
    },
    {
        id: "quests",
        title: "Guild Quests",
        summary: "Fight monsters with mana-powered combat spells.",
        paragraphs: [
            "Starting a quest snapshots your highest mana reached into a separate quest mana pool. Mana production pauses during combat, and spells spend the snapshot instead of your normal mana.",
            "Spells divide your mana rather than subtract from it, so 1e240 / 1e40 = 1e200.",
            "Your maximum Mana Shield is log10(highest mana), multiplied by equipment bonuses. Enemy health by rank is 150, 250, 500, 2,500, 15,000, and 100,000.",
            "Enemy attacks deal a random 20 to 50 damage, multiplied by 2^rank and reduced by armor. Freeze deals damage and skips the next two enemy turns.",
            "After every cast, the new spell cost is old cost^1.1 × 10^s. The scaling exponent s is 10, 20, 30, 30, 40, and 50 from Fireball through Arcane Nova. Freeze's exponent falls from 30 to 10 after its challenge achievement.",
            "Equipment can drop from E-rank enemies and above. Higher ranks provide stronger possible armor sets.",
        ],
    },
    {
        id: "equipment",
        title: "Inventory and Equipment",
        summary: "Arrange loot, equip armor, and complete sets.",
        paragraphs: [
            "Inventory items have different shapes and must fit into open spaces. Drag armor into its matching Helmet, Chestplate, Leggings, or Boots slot to apply its effect.",
            "Armor piece bonuses add together within their category. Full sets add another bonus, and some set bonuses multiply the final result. For example, full Arcane armor multiplies mana production by ×1.5 after its four +10% piece bonuses.",
            "Selling an item gives a random number of coins within the range shown on it. Shift+click a potion to drink it or a piece of armor to equip it. Ctrl+click an inventory item to sell it immediately.",
            "When you collect 10 loose copies of the same potion or material, they compress into a one-slot package. A package can be sold or used as all 10 items at once. Equipment is never packaged, and packages cannot contain other packages.",
        ],
    },
    {
        id: "potions",
        title: "Potions and Game Speed",
        summary: "Stack temporary game-speed effects.",
        paragraphs: [
            "Potions of Speed I, II, and III add ×4, ×14, and ×63 game speed for 120, 60, and 30 seconds. Up to 10 effects from each potion level can be active at once.",
            "The Guild shop can double potion duration and multiply potion power by ×1.5. Achievements can add 30 seconds and multiply potion power by ×1.25.",
            "Active potion effects add together with the base ×1 game speed. Equipment then multiplies that total, Courage multiplies it again, and Focus applies its slowdown last.",
        ],
    },
    {
        id: "autocasters",
        title: "Auto-casters",
        summary: "Hire casters to automate repetitive actions.",
        paragraphs: [
            "Hire an auto-caster with Guild coins, then drag it onto a task. Hiring costs 2, 5, or 10 coins for tiers 1 through 3. Their wages are 1, 2, or 4 coins per 10 minutes.",
            "You can own up to 64 auto-casters. The unassigned roster holds nine, so assign casters to tasks to make room for more. More than one caster can work on the same task.",
            "A caster only starts its wage timer after performing work. If it cannot be paid after a worked period, it leaves. Selling one returns 1, 2, or 5 coins.",
            "Higher tiers can perform more advanced tasks. Tier 3 auto-casters perform assigned actions with half the normal cooldown, and the Faster!! achievement doubles all auto-caster speed again.",
            "An action's cooldown is its base cooldown divided by the Tier 3 bonus, the Faster!! bonus, and the number of casters assigned to that task. The base cooldowns are 1 second for producers and Meditation, 3 seconds for Purification, Sealing, and Matrices, 5 seconds for Courage, and 30 seconds for Condensing.",
            "Condense can wait for a chosen amount of Condensed Mana gained after reaching Circle Two. Purification can wait for a chosen relative multiplier of at least 1.01. These settings accept large decimal values.",
            "Seal Meridian and Conjure Crystal Matrix tasks can be given a maximum owned amount. Their default is Infinity, which leaves them uncapped.",
        ],
    },
    {
        id: "achievements",
        title: "Achievements",
        summary: "Earn permanent rewards and take on special conditions.",
        paragraphs: [
            "Most achievements unlock naturally as you reach milestones. Their rewards are permanent and can affect production, reset starting values, Meditation, matrices, Guild systems, and more.",
            "Challenge achievements ask you to Condense or reach a goal while avoiding a mechanic. Conditions such as no Meditation, no Purification, no boosting, or no potions are tracked for the whole Condense.",
            "Achievements can belong to a later Mana Circle. Those entries remain unavailable until that circle is reached.",
        ],
    },
    {
        id: "saving",
        title: "Saving and Offline Progress",
        summary: "Control saves, simulation, and update speed.",
        paragraphs: [
            "The game saves automatically every 30 seconds and when the page is left. Saves can also be exported or imported from the Options tab.",
            "Offline Progress is enabled by default. Disabling it prevents the game from simulating time that passed while the game was closed or suspended.",
            "Update Rate changes how often the simulation updates, from 10 ms to 200 ms. Render Update Rate separately controls live display refreshes from 10 ms to 250 ms. These can change smoothness and performance, but not the intended amount produced over time.",
        ],
    },
];
