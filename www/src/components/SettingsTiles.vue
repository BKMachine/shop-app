<template>
  <v-btn
    v-for="(item, index) in items"
    :key="item._id"
    class="tile elevation-2"
    @click="$emit('edit', index)"
  >
    <v-img v-if="item.logo" :src="item.logo" class="logo"></v-img>
    <span v-else>{{ item.name }}</span>
    <v-tooltip activator="parent" open-delay="500" location="top" offset="-20">
      {{ item.name }}
    </v-tooltip>
  </v-btn>

  <v-btn class="tile elevation-2" color="blue-lighten-2" @click="$emit('create')">
    <v-icon size="36">mdi-plus</v-icon>
  </v-btn>
</template>

<script setup lang="ts">
defineProps<{
  items: any[];
}>();
</script>

<style scoped>
.tile {
  width: 120px;
  height: 120px;
  border: 1px solid #999999;
  margin: 8px;
  border-radius: 20px;
  position: relative;
}
.logo {
  width: 100px;
  height: 100px;
}
</style>
