<script setup>
import { CRYSTAL_GOALS } from "@game/game/crystals.js";
import { formatCrystalGoal } from "@game/ui/formatting.js";
import GameHeader from "../components/GameHeader.vue";
import TabNavigation from "../components/TabNavigation.vue";
import ManaTab from "../tabs/ManaTab.vue";
import StatisticsTab from "../tabs/StatisticsTab.vue";
import CondensedTab from "../tabs/CondensedTab.vue";
import AbyssTab from "../tabs/AbyssTab.vue";
import ManaCircleTab from "../tabs/ManaCircleTab.vue";
import CrystalsTab from "../tabs/CrystalsTab.vue";
import GuildTab from "../tabs/GuildTab.vue";
import QuestTab from "../tabs/QuestTab.vue";
import AutocastersTab from "../tabs/AutocastersTab.vue";
import AchievementsTab from "../tabs/AchievementsTab.vue";
import OptionsTab from "../tabs/OptionsTab.vue";

defineProps({
    frame: { type: Object, required: true },
    actions: { type: Object, required: true },
});
</script>

<template>
    <GameHeader :mana="frame.mana" :sonic-value="frame.sonicValue" :show-sonic-value="frame.abyssRunActive" />
    <button
        v-if="frame.activeCrystal >= 0 || frame.canCondense || frame.manaCircle > 0"
        class="condense-button"
        type="button"
        :disabled="frame.activeCrystal >= 0 ? !frame.crystalCanShatter : !frame.canCondense"
        @click="actions.handlePrimaryResetAction"
    >
        <strong>{{ frame.activeCrystal >= 0
            ? (frame.crystalGoalReached ? "Shatter the Crystal" : formatCrystalGoal(CRYSTAL_GOALS[frame.activeCrystal]))
            : (frame.memories.focusing ? "Remember" : "Condense") }}</strong>
        <small v-if="frame.activeCrystal < 0 && frame.manaCircle > 0 && frame.canCondense">
            <br>{{ frame.memories.focusing
                ? `for an ${frame.memories.nextChance}% chance`
                : `for ${frame.condenseManaGained} condensed mana` }}
        </small>
    </button>
    <button
        v-if="frame.activeCrystal >= 0"
        class="escape-crystal-button"
        type="button"
        @click="actions.escapeCrystal"
    >
        Escape Crystal {{ frame.activeCrystal + 1 }}
    </button>
    <button
        v-else-if="frame.abyssRunActive"
        class="escape-crystal-button"
        type="button"
        @click="actions.escapeAbyssRun"
    >
        Escape this Abyss run
    </button>
    <button
        v-else-if="frame.memories.focusing"
        class="escape-crystal-button"
        type="button"
        @click="actions.focus"
    >
        Exit Focus
    </button>
    <div v-if="frame.condensedUnlocked" class="condensed-mana-display">
        <span>You have</span>
        <strong>{{ frame.condensedMana }}</strong>
        <span>condensed mana</span>
    </div>
    <TabNavigation
        :tabs="frame.visibleTabs"
        :active-tab="frame.activeTab"
        :active-subtab="frame.activeSubtab"
        :pinged-tabs="frame.pingedTabs"
        :pinged-subtabs="frame.pingedSubtabs"
        @select-tab="actions.selectTab"
        @select-subtab="actions.selectSubtab"
    />
    <main class="content-frame">
        <ManaTab
            v-if="frame.activeTab === 'mana'"
            :upgrades="frame.tierOneUpgrades"
            :cast-speed="frame.castSpeedSpell"
            :cast-mode="frame.castMax ? 'Cast Max' : 'Cast One'"
            :sealed-meridians="frame.sealedMeridians"
            :matrix="frame.matrix"
            :courage="frame.courage"
            :meridian-purification="frame.meridianPurification"
            :potion-effects="frame.potionEffects"
            :game-speed="frame.gameSpeed"
            :game-speed-increased="frame.gameSpeedIncreased"
            :mana-per-second="frame.manaPerSecond"
            :oom-per-second="frame.oomPerSecond"
            :show-oo-m-per-second="frame.showOoMPerSecond"
            :exp-cost-increases-at="frame.expCostIncreasesAt"
            :hide-cost-warning="frame.activeCrystal === 9 || frame.activeCrystal === 14"
            :producers-only="frame.activeCrystal === 2 || frame.activeCrystal === 14"
            :crystal-puzzle-reset="frame.activeCrystal >= 11"
            @buy="actions.buyTierOne"
            @empower="actions.empowerTierOne"
            @buy-all="actions.buyAllTierOne"
            @toggle-cast-mode="actions.toggleCastMode"
            @cast-speed="actions.castSpeed"
            @seal-meridians="actions.sealMeridians"
            @increase-matrix="actions.increaseMatrix"
            @activate-courage="actions.activateCourage"
            @purify-meridians="actions.purifyMeridians"
            @sealed-meridian-reset-no-gain="actions.sealedMeridianResetNoGain"
        />
        <StatisticsTab
            v-else-if="frame.activeTab === 'statistics'"
            :statistics="frame.statistics"
        />
        <CondensedTab
            v-else-if="frame.activeTab === 'condensed'"
            :active-subtab="frame.activeSubtab"
            :condensed-mana="frame.condensedMana"
            :upgrades="frame.condensedUpgrades"
            :placeholders="frame.condensedUpgradePlaceholders"
            :memories="frame.memories"
            :remembrance="frame.remembrance"
            :is-ascended="frame.manaCircle > 0"
            @buy="actions.buyCondensedUpgrade"
            @focus="actions.focus"
            @buy-memorial="actions.buyMemorial"
            @buy-remembrance="actions.buyRemembranceUpgrade"
            @respec="actions.toggleRemembranceRespec"
            @export-remembrance="actions.exportRemembrance"
            @import-remembrance="actions.importRemembrance"
        />
            <AbyssTab
                v-else-if="frame.activeTab === 'abyss'"
                :active-subtab="frame.activeSubtab"
                :abyss-run-active="frame.abyssRunActive"
                :sonic-value="frame.sonicValue"
                @enter-abyss="actions.enterAbyss"
            />
        <ManaCircleTab
            v-else-if="frame.activeTab === 'manacircle'"
            :active-subtab="frame.activeSubtab"
            :mana-circle="frame.manaCircle"
            @info="actions.openManaCircleInfo"
        />
        <CrystalsTab
            v-else-if="frame.activeTab === 'crystals'"
            :active-subtab="frame.activeSubtab"
            :state-revision="frame.crystalStateRevision"
            @enter="actions.enterCrystal"
        />
        <GuildTab
            v-else-if="frame.activeTab === 'guild'"
            :active-subtab="frame.activeSubtab"
            :guild="frame.guild"
            :quests="frame.guildQuests"
            :quest-result="frame.questResult"
            :mana-circle="frame.manaCircle"
            :equipment-unlocked="frame.equipmentUnlocked"
            :cant-rank-up="frame.cantRankUp"
            @apply="actions.applyToGuild"
            @accept="actions.acceptGuildQuest"
            @dismiss-result="actions.dismissQuestResult"
            @move-item="actions.moveInventoryItem"
            @equip-item="actions.equipInventoryItem"
            @unequip-item="actions.unequipInventoryItem"
            @use-item="actions.useInventoryItem"
            @sell-item="actions.sellInventoryItem"
            @sell-all-materials="actions.sellAllMaterials"
            @sell-equipment="actions.sellSpareEquipment"
            @sell-all-items="actions.sellAllItems"
            @drink-all-potions="actions.drinkAllPotions"
            @buy-shop-item="actions.buyShopItem"
            @buy-shop-upgrade="actions.buyGuildShopUpgrade"
            @ascend="actions.expandManaCircle"
        />
        <QuestTab
            v-else-if="frame.activeTab === 'quest'"
            :combat="frame.combat"
            @cast="actions.castCombatSpell"
            @abandon="actions.abandonGuildQuest"
        />
        <AutocastersTab
            v-else-if="frame.activeTab === 'autocasters'"
            :autocasters="frame.autocasters"
            :coins="frame.guild.coins"
            :mana-circle="frame.manaCircle"
            @hire="actions.hireAutocaster"
            @assign="actions.assignAutocaster"
            @move="actions.moveAutocaster"
            @sell="actions.sellAutocaster"
            @casts-max="actions.setAutocasterCastsMax"
            @purify-minimum="actions.setAutocasterPurifyMinimum"
            @condense-gain="actions.setAutocasterCondenseGain"
            @maximum-owned="actions.setAutocasterMaximum"
            @toggle="actions.toggleAutocasters"
        />
        <AchievementsTab
            v-else-if="frame.activeTab === 'achievements'"
            :active-subtab="frame.activeSubtab"
            :achievements="frame.achievements"
            :mana-circle="frame.manaCircle + 1"
        />
        <OptionsTab
            v-else-if="frame.activeTab === 'options'"
            :active-subtab="frame.activeSubtab"
            :update-rate="frame.updateRate"
            :render-update-rate="frame.renderUpdateRate"
            :offline-progress="frame.offlineProgress"
            :stars-visible="frame.starsVisible"
            :stars-animated="frame.starsAnimated"
            :news-ticker-enabled="frame.newsTickerEnabled"
            :message-ticker-particles="frame.messageTickerParticles"
            @edit-keybinds="actions.editKeybinds"
            @stars-visible="actions.setStarsVisible"
            @stars-animated="actions.setStarsAnimated"
            @news-ticker-enabled="actions.setNewsTickerEnabled"
            @message-ticker-particles="actions.setMessageTickerParticles"
            @export-save="actions.exportGameSave"
            @import-save="actions.importGameSave"
            @reset-game="actions.resetGame"
            @update-rate="actions.updateTickRate"
            @render-update-rate="actions.setRenderUpdateRate"
            @offline-progress="actions.setOfflineProgress"
        />
    </main>
</template>
