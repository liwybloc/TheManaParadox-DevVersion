<script setup>
defineProps({
    statistics: { type: Object, required: true },
});
</script>

<template>
    <section class="tab-panel statistics-list">
        <header class="stat-header basic-header">
            <h2>Basic</h2>
            <p>Total time played: <strong>{{ statistics.timePlayed }}</strong></p>
            <p>Game time played: <strong>{{ statistics.gameTimePlayed }}</strong></p>
            <p>Total mana produced: <strong>{{ statistics.manaProduced }}</strong></p>
            <p>Message tickers seen: <strong>{{ statistics.messageTickersSeen }}</strong></p>
            <p>Unique message tickers seen: <strong>{{ statistics.uniqueMessageTickersSeen }}</strong></p>
        </header>
        <header v-if="statistics.hasCondensed" class="stat-header condense-header">
            <h2>Condense</h2>
            <p>Total condenses: <strong>{{ statistics.condenses }}</strong></p>
            <p>Total condensed mana: <strong>{{ statistics.condensedManaProduced }}</strong></p>
            <p>Fastest condense time: <strong>{{ statistics.fastestCondense }}</strong></p>
            <p>Time spent this condense: <strong>{{ statistics.timeThisCondense }}</strong></p>
            <p>Game time spent this condense: <strong>{{ statistics.gameTimeThisCondense }}</strong></p>
        </header>
        <header v-if="statistics.abyssUnlocked" class="stat-header">
            <h2>Abyss</h2>
            <p>Sonic Value: <strong>{{ statistics.sonicValue }}</strong></p>
            <p>Highest depth completed: <strong>{{ statistics.highestAbyssDepth }}</strong></p>
            <p>Time this Abyss run: <strong>{{ statistics.abyssRunTime }}</strong></p>
            <p>Abyss runs completed: <strong>{{ statistics.abyssRunsCompleted }}</strong></p>
        </header>
    </section>
</template>
