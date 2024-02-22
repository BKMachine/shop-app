<template>
  <div class="container">
    <v-btn class="big-button" link to="/tools/database">
      <img class="icon" src="@/assets/img/search.png" alt="" />
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
.icon {
  width: 100%;
}
</style>
