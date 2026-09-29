import { createApp } from "vue";
import App from "@ui/App.vue";
import { namedWasm } from "../generated/_wasm$globals.js";
import "./systems/background.js";
import "./abyss/handles.js";
import "./core/player.js";
import "./core/scratch.js";
import "./game/achievements.js";
import "./game/currencies.js";
import "./game/courage.js";
import "./game/condensed.js";
import "./guild/guild.js";
import "./guild/equipment.js";
import "./game/tier_one.js";
import "./game/progression.js";
import "./systems/debug.js";
import "./systems/save.js";
import "./systems/tick.js";
import "./systems/keybinds.js";

(globalThis as any).cheatSomeCookies = namedWasm.cheatSomeCookies;

createApp(App).mount("#root");
