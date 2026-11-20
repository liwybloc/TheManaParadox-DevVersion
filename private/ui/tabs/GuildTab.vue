<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { ARMOR_SET_EFFECTS } from "@game/guild/equipment.js";
import AscensionHall from "../components/AscensionHall.vue";

const props = defineProps({
    activeSubtab: { type: String, required: true },
    guild: { type: Object, required: true },
    quests: { type: Array, required: true },
    questResult: { type: Object, required: true },
    manaCircle: { type: Number, required: true },
    equipmentUnlocked: { type: Boolean, required: true },
    cantRankUp: { type: Boolean, required: true },
});
const emit = defineEmits([
    "apply", "accept", "dismiss-result", "move-item", "equip-item", "unequip-item", "use-item", "sell-item",
    "sell-all-materials", "sell-equipment", "sell-all-items", "drink-all-potions",
    "buy-shop-item", "buy-shop-upgrade", "ascend",
]);
const selectedQuest = ref(null);
const selectedItem = ref(null);
const inventoryGrid = ref(null);
const dragging = ref(null);
const equipmentSlotNames = ["Helmet", "Chestplate", "Leggings", "Boots"];
const completeArmorSet = computed(() => {
    const items = props.guild.equipmentItems;
    if (items.length !== equipmentSlotNames.length || items.some((item) => !item)) return null;
    const armorSet = items[0].armorSet;
    return armorSet && items.every((item) => item.armorSet === armorSet) ? armorSet : null;
});
let pendingPress = null;
const rankProgress = computed(() => {
    const requirement = Number(props.guild.experienceRequirement);
    if (!Number.isFinite(requirement) || requirement <= 0) return 0;
    const maximum = props.cantRankUp ? 0.99 : 1;
    return Math.max(0, Math.min(maximum, props.guild.experience / requirement));
});

function coinLabel(value) {
    return Number(value) === 1 ? "coin" : "coins";
}

function armorEffect(item) {
    return ARMOR_SET_EFFECTS[item.armorSet]?.pieces[item.equipmentSlot] ?? "Unknown effect";
}

function armorSetBonus(armorSet) {
    return ARMOR_SET_EFFECTS[armorSet]?.setBonus ?? "Unknown set bonus";
}

function acceptQuest() {
    if (selectedQuest.value === null || props.guild.questActive) return;
    emit("accept", selectedQuest.value.index);
    selectedQuest.value = null;
}

function beginPress(event, item, equipmentSlot = null) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (equipmentSlot === null && event.ctrlKey) {
        emit("sell-item", item.position, item.type);
        if (selectedItem.value?.position === item.position) selectedItem.value = null;
        return;
    }
    if (equipmentSlot === null && event.shiftKey) {
        if (item.use?.enabled) emit("use-item", item.use.action, item.position, item.type);
        else if (item.equipmentSlot !== undefined) emit("equip-item", item.position, item.equipmentSlot);
        return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    pendingPress = {
        item,
        equipmentSlot,
        bounds,
        startX: event.clientX,
        startY: event.clientY,
        cursorX: event.clientX,
        cursorY: event.clientY,
    };
    window.addEventListener("pointermove", trackPress);
    window.addEventListener("pointerup", finishPress, { once: true });
}

function startDrag() {
    if (!pendingPress) return;
    const { item, equipmentSlot, bounds, cursorX, cursorY } = pendingPress;
    dragging.value = {
        sourcePosition: item.position,
        sourceEquipmentSlot: equipmentSlot,
        itemWidth: item.width,
        itemHeight: item.height,
        type: item.type,
        name: item.name,
        style: item.style,
        equipmentSlot: item.equipmentSlot,
        cursorX,
        cursorY,
        width: bounds.width,
        height: bounds.height,
    };
}

function trackPress(event) {
    if (!pendingPress) return;
    event.preventDefault();
    pendingPress.cursorX = event.clientX;
    pendingPress.cursorY = event.clientY;
    if (!dragging.value) {
        const distanceX = event.clientX - pendingPress.startX;
        const distanceY = event.clientY - pendingPress.startY;
        if (Math.hypot(distanceX, distanceY) > 25) startDrag();
    }
    if (!dragging.value) return;
    dragging.value.cursorX = event.clientX;
    dragging.value.cursorY = event.clientY;
}

function finishPress() {
    window.removeEventListener("pointermove", trackPress);
    if (!pendingPress) return;
    if (dragging.value) finishDrag();
    else if (pendingPress.equipmentSlot === null) selectedItem.value = pendingPress.item;
    pendingPress = null;
}

function finishDrag() {
    const drag = dragging.value;
    const equipmentTarget = document
        .elementFromPoint(drag?.cursorX ?? 0, drag?.cursorY ?? 0)
        ?.closest("[data-equipment-slot]");
    if (drag && equipmentTarget) {
        const targetSlot = Number(equipmentTarget.dataset.equipmentSlot);
        if (drag.sourceEquipmentSlot === null
            && drag.equipmentSlot !== undefined
            && drag.equipmentSlot === targetSlot) {
            emit("equip-item", drag.sourcePosition, targetSlot);
        }
        dragging.value = null;
        return;
    }
    const grid = inventoryGrid.value;
    if (!drag || !grid) {
        dragging.value = null;
        return;
    }
    const slots = grid.querySelectorAll(".inventory-slot");
    if (slots.length !== 100) {
        dragging.value = null;
        return;
    }
    const first = slots[0].getBoundingClientRect();
    const second = slots[1].getBoundingClientRect();
    const nextRow = slots[10].getBoundingClientRect();
    const columnStep = second.left - first.left;
    const rowStep = nextRow.top - first.top;
    const itemLeft = drag.cursorX - drag.width / 2;
    const itemTop = drag.cursorY - drag.height / 2;
    const rawColumn = Math.round((itemLeft - first.left) / columnStep);
    const rawRow = Math.round((itemTop - first.top) / rowStep);
    const lastColumn = 10 - drag.itemWidth;
    const lastRow = 10 - drag.itemHeight;
    if (rawColumn < 0 || rawColumn > lastColumn || rawRow < 0 || rawRow > lastRow) {
        dragging.value = null;
        return;
    }
    const targetPosition = rawRow * 10 + rawColumn;
    if (drag.sourceEquipmentSlot === null) emit("move-item", drag.sourcePosition, targetPosition);
    else emit("unequip-item", drag.sourceEquipmentSlot, targetPosition);
    dragging.value = null;
}

function itemStyle(position, width, height) {
    return {
        gridColumn: `${position % 10 + 1} / span ${width}`,
        gridRow: `${Math.floor(position / 10) + 1} / span ${height}`,
        visibility: dragging.value?.sourcePosition === position ? "hidden" : "visible",
    };
}

function sellSelectedItem() {
    if (!selectedItem.value) return;
    emit("sell-item", selectedItem.value.position, selectedItem.value.type);
    selectedItem.value = null;
}

function draggedItemStyle() {
    if (!dragging.value) return {};
    return {
        position: "fixed",
        left: `${dragging.value.cursorX}px`,
        top: `${dragging.value.cursorY}px`,
        width: `${dragging.value.width}px`,
        height: `${dragging.value.height}px`,
        transform: "translate(-50%, -50%)",
        zIndex: 200,
        pointerEvents: "none",
    };
}

onBeforeUnmount(() => {
    window.removeEventListener("pointermove", trackPress);
    window.removeEventListener("pointerup", finishPress);
});
</script>

<template>
    <section class="tab-panel guild-panel">
        <div v-if="!guild.member" class="guild-application">
            <h1>You've grown strong enough</h1>
            <p>Do you wish to apply to the Guild?</p>
            <button type="button" @click="$emit('apply')">Apply to the Guild</button>
        </div>
        <template v-else-if="activeSubtab === 'guild-main'">
            <div class="section-title">
                <h1>Quest Board</h1>
                <p>Guild Rank: <strong>{{ guild.rank }}</strong> · Refresh: {{ guild.refreshTimer }}</p>
                <p>Quests 2 rank below you can only give 25% of the required experience.</p>
                <p>Quests 1 rank below you can only give 50% of the required experience.</p>
                <p v-if="cantRankUp">The Guild won't let you rank up until you grow stronger..</p>
            </div>
            <div v-if="questResult.visible" class="quest-result" role="status">
                <div>
                    <strong>You defeated the {{ questResult.monster }}!</strong>
                    <template v-for="item in questResult.items" :key="item.name">
                        <span v-if="item.amount > item.dropped">You received {{ item.amount - item.dropped }} {{ item.name }}.</span>
                        <span v-if="item.dropped" class="dropped-item">You dropped {{ item.dropped }} {{ item.name }}.</span>
                    </template>
                </div>
                <button type="button" aria-label="Dismiss quest result" @click="$emit('dismiss-result')">×</button>
            </div>
            <div class="quest-board">
                <button
                    v-for="quest in quests"
                    v-show="quest.visible"
                    :key="quest.index"
                    type="button"
                    :class="{ 'quest-locked': quest.locked }"
                    :disabled="guild.questActive || quest.locked"
                    @click="selectedQuest = quest"
                >
                    <span class="quest-rank">{{ quest.rank }}</span>
                    <strong>{{ quest.title }}</strong>
                    <small>{{ quest.locked ? "Completed · waiting for refresh" : quest.monster }}</small>
                </button>
            </div>
            <div
                class="guild-rank-progress"
                :data-tooltip="`${guild.rank} → ${guild.nextRank}`"
                role="progressbar"
                aria-label="Guild rank progress"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="Math.round(rankProgress * 10000) / 100"
            >
                <span :style="{ width: `${rankProgress * 100}%` }"></span>
                <strong>{{ (rankProgress * 100).toFixed(2) }}%</strong>
            </div>
            <p v-if="guild.questActive" class="quest-active-note">Finish your active quest before accepting another.</p>
        </template>
        <template v-else-if="activeSubtab === 'guild-inventory'">
            <div class="section-title">
                <h1>Guild Inventory</h1>
                <p>You have {{ guild.coins }} {{ coinLabel(guild.coins) }}.</p>
                <p>Shift+click to use or equip an item. Ctrl+click to sell it.</p>
            </div>
            <div class="inventory-bulk-actions">
                <button type="button" @click="$emit('sell-all-materials')">Sell All Materials</button>
                <button type="button" @click="$emit('sell-equipment')">Sell Spare Equipment</button>
                <button type="button" @click="$emit('sell-all-items')">Sell All Items</button>
                <button type="button" @click="$emit('drink-all-potions')">Drink All Potions</button>
            </div>
            <div class="guild-inventory-layout">
                <div ref="inventoryGrid" class="guild-inventory-grid">
                    <span
                        v-for="slot in 100"
                        :key="slot"
                        class="inventory-slot"
                        :style="{ gridColumn: (slot - 1) % 10 + 1, gridRow: Math.floor((slot - 1) / 10) + 1 }"
                    ></span>
                    <button
                        v-for="item in guild.inventoryItems"
                        :key="`${item.type}-${item.position}`"
                        :class="['inventory-item', item.style, { selected: selectedItem?.position === item.position }]"
                        type="button"
                        :style="itemStyle(item.position, item.width, item.height)"
                        @pointerdown="beginPress($event, item)"
                    >
                        <strong>{{ item.name }}</strong>
                    </button>
                </div>
                <div class="inventory-side-panel">
                <aside class="inventory-details">
                    <template v-if="selectedItem">
                        <span :class="['inventory-details-icon', selectedItem.style]"></span>
                        <h2>{{ selectedItem.name }}</h2>
                        <small>{{ selectedItem.width }}×{{ selectedItem.height }} item</small>
                        <p class="inventory-item-description">{{ selectedItem.description }}</p>
                        <button
                            v-if="selectedItem.use"
                            class="inventory-use-button"
                            type="button"
                            :disabled="!selectedItem.use.enabled"
                            @click="$emit('use-item', selectedItem.use.action, selectedItem.position, selectedItem.type)"
                        >
                            {{ selectedItem.use.label }}
                        </button>
                        <button
                            class="inventory-use-button inventory-sell-button"
                            type="button"
                            @click="sellSelectedItem"
                        >
                            Sell for {{ selectedItem.sellPrice[0] }}–{{ selectedItem.sellPrice[1] }} coins
                        </button>
                    </template>
                </aside>
                <aside v-if="equipmentUnlocked" class="inventory-details inventory-equipment">
                    <h2>Equipment</h2>
                    <div class="equipment-slots">
                        <div
                            v-for="(slotName, slot) in equipmentSlotNames"
                            :key="slotName"
                            class="equipment-slot"
                            :class="[guild.equipmentItems[slot]?.style, {
                                occupied: guild.equipmentItems[slot],
                                dragging: dragging?.sourceEquipmentSlot === slot,
                            }]"
                            :data-equipment-slot="slot"
                            @pointerdown="guild.equipmentItems[slot] && beginPress($event, guild.equipmentItems[slot], slot)"
                        >
                            <strong>{{ guild.equipmentItems[slot]?.name ?? slotName }}</strong>
                        </div>
                    </div>
                    <div class="equipment-effects">
                        <strong>Effects</strong>
                        <span v-for="item in guild.equipmentItems.filter(Boolean)" :key="item.type">
                            {{ item.name }}: {{ armorEffect(item) }}
                        </span>
                        <span v-if="!guild.equipmentItems.some(Boolean)">No armor equipped.</span>
                        <strong>Set Bonus</strong>
                        <span>{{ completeArmorSet ? `${completeArmorSet}: ${armorSetBonus(completeArmorSet)}` : "Equip all four pieces from one set." }}</span>
                    </div>
                </aside>
                </div>
            </div>
        </template>
        <template v-else-if="activeSubtab === 'guild-ascension-hall'">
            <div v-if="manaCircle > 0" class="ascension-hall-unavailable">
                <strong>You are not ready for The Ascension Hall...</strong>
            </div>
            <AscensionHall v-else @ascend="$emit('ascend')" />
        </template>
        <template v-else-if="activeSubtab === 'guild-library'">
            <div class="section-title">
                <h1>Guild's Library</h1>
                <p>Coming soon to a Mana Paradox near you:tm:</p>
            </div>
        </template>
        <template v-else-if="activeSubtab === 'guild-shop'">
            <div class="section-title"><h1>Guild Shop</h1><p>You have {{ guild.coins }} {{ coinLabel(guild.coins) }}.</p></div>
            <div class="guild-shop-items">
                <button
                    v-for="item in guild.shopItems"
                    :key="item.slot"
                    type="button"
                    :class="{ refreshing: item.refreshRemaining > 0 }"
                    :disabled="!item.affordable"
                    @click="$emit('buy-shop-item', item.slot)"
                >
                    <strong>{{ item.refreshRemaining > 0 ? "Empty" : item.name }}</strong>
                    <small>{{ item.refreshRemaining > 0 ? `Refresh: ${Math.ceil(item.refreshRemaining)}s` : `Cost: ${item.cost} ${coinLabel(item.cost)}` }}</small>
                </button>
            </div>
            <div class="guild-shop-upgrades">
                <div v-for="rank in [0, 1, 2, 3]" :key="rank" class="guild-shop-upgrade-row">
                    <strong class="guild-shop-rank">{{ ["F:", "E:", "D:", "C:"][rank] }}</strong>
                    <button
                        v-for="upgrade in guild.shopUpgrades.filter((upgrade) => upgrade.rank === rank)"
                        :key="upgrade.id"
                        type="button"
                        :class="{ purchased: upgrade.purchased, locked: upgrade.locked, affordable: upgrade.affordable }"
                        :disabled="upgrade.locked || upgrade.purchased || !upgrade.affordable"
                        @click="$emit('buy-shop-upgrade', upgrade.id)"
                    >
                        <strong>{{ upgrade.locked ? "Locked" : upgrade.title }}</strong>
                        <small v-if="!upgrade.locked">{{ upgrade.purchased ? "Purchased" : `Cost: ${upgrade.cost} ${coinLabel(upgrade.cost)}` }}</small>
                    </button>
                </div>
            </div>
        </template>

        <div v-if="selectedQuest" class="quest-detail-overlay" @click.self="selectedQuest = null">
            <section class="quest-detail">
                <span class="quest-rank">{{ selectedQuest.rank }}</span>
                <h2>{{ selectedQuest.title }}</h2>
                <p>{{ selectedQuest.description }}</p>
                <div class="quest-reward"><strong>Rewards</strong><span v-for="reward in selectedQuest.rewards" :key="reward.item">{{ reward.amount }} {{ reward.name }}</span></div>
                <div><button type="button" :disabled="guild.questActive" @click="acceptQuest">Accept Quest</button><button type="button" @click="selectedQuest = null">Cancel</button></div>
            </section>
        </div>
    </section>
    <Teleport to="body">
        <button
            v-if="dragging"
            :class="['inventory-item', dragging.style]"
            type="button"
            :style="draggedItemStyle()"
        >
            <strong>{{ dragging.name }}</strong>
        </button>
    </Teleport>
</template>
