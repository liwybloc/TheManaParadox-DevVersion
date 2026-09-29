<script setup>
defineProps({
    mana: { type: String, required: true },
    sonicValue: { type: String, default: "0.000000" },
    showSonicValue: { type: Boolean, default: false },
});
</script>

<template>
    <header class="game-header">
        <div class="title-block"><strong>The Mana Paradox</strong></div>
        <div class="resource-display">
            <small v-if="showSonicValue">Sonic Value: {{ sonicValue }}</small>
            <span>You have</span>
            <strong>{{ mana }}</strong>
            <span>mana</span>
        </div>
    </header>
</template>
