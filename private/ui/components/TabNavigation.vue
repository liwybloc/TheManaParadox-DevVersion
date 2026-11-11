<script setup>
import { computed } from "vue";

const props = defineProps({
    tabs: { type: Array, required: true },
    activeTab: { type: String, required: true },
    activeSubtab: { type: String, default: undefined },
    pingedTabs: { type: Array, default: () => [] },
    pingedSubtabs: { type: Array, default: () => [] },
});
const emit = defineEmits(["select-tab", "select-subtab"]);
const subtabs = computed(() => props.tabs.find((tab) => tab.id === props.activeTab)?.subtabs ?? []);

function navigate(event, items, active, select) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = items.findIndex((item) => item.id === active);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = items[(current + direction + items.length) % items.length];
    if (next) select(next.id);
}
</script>

<template>
    <nav class="primary-tabs" role="tablist" aria-label="Game sections" @keydown="navigate($event, tabs, activeTab, (id) => emit('select-tab', id))">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="tab-button"
            :class="{ 'is-active': tab.id === activeTab, 'time-guidance': tab.guided }"
            role="tab"
            :aria-selected="tab.id === activeTab"
            @click="emit('select-tab', tab.id)"
        ><span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>{{ tab.label }}<span v-if="pingedTabs.includes(tab.id)" class="navigation-ping" aria-label="New">!</span></button>
    </nav>
    <nav v-if="subtabs.length" class="secondary-tabs" role="tablist" aria-label="Section pages" @keydown="navigate($event, subtabs, activeSubtab, (id) => emit('select-subtab', id))">
        <button
            v-for="subtab in subtabs"
            :key="subtab.id"
            type="button"
            class="subtab-button"
            :class="{ 'is-active': subtab.id === activeSubtab, 'time-guidance': subtab.guided }"
            role="tab"
            :aria-selected="subtab.id === activeSubtab"
            @click="emit('select-subtab', subtab.id)"
        >{{ subtab.label }}<span v-if="pingedSubtabs.includes(subtab.id)" class="navigation-ping" aria-label="New">!</span></button>
    </nav>
</template>
