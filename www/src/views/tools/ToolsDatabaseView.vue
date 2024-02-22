<template>
  <div class="header">
    <v-btn link to="/tools/database/create" color="primary" prepend-icon="mdi-plus">
      Create New Tool
    </v-btn>
  </div>
  <v-card flat>
    <template v-slot:text>
      <v-text-field
        v-model="search"
        label="Search"
        prepend-inner-icon="mdi-magnify"
        single-line
        variant="outlined"
        hide-details
      ></v-text-field>
    </template>

    <v-data-table :headers="headers" :items="desserts" :search="search"></v-data-table>
  </v-card>
</template>

<script setup lang="ts"></script>

<style scoped>
.header {
  padding: 15px 15px 0 0;
  display: flex;
  justify-content: flex-end;
}
</style>
