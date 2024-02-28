<template>
  <div class="container">
    <v-btn class="big-button" link to="/tools/database">
      <v-icon size="200">mdi-magnify</v-icon>
    </v-btn>
    <v-btn class="big-button" link to="/tools/database"> Database </v-btn>
    <v-btn class="big-button" link to="/tools/database"> Database </v-btn>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.big-button {
  width: 200px;
  height: 200px;
  border: 2px solid black;
  margin: 25px;
  border-radius: 20px;
}
</style>
