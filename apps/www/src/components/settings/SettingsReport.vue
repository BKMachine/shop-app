<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn color="primary" @click="addEmail">Add Email</v-btn>
      </v-col>
    </v-row>
    <v-row v-for="(email, idx) in emails" :key="email.email" class="mb-4">
      <v-col cols="4">
        <v-text-field
          v-model="email.email"
          label="Email"
          :disabled="!email.editing"
          @blur="email.editing = false"
        ></v-text-field>
      </v-col>
      <v-col cols="6">
        <v-checkbox
          v-for="category in categories"
          :key="category.name"
          :label="category.name"
          :value="category.name"
          v-model="email.enabledCategories"
        ></v-checkbox>
      </v-col>
      <v-col cols="2" class="d-flex align-center">
        <v-btn icon @click="editEmail(idx)">
          <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <v-btn icon color="error" @click="deleteEmail(idx)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const categories = [{ name: 'Weekly Tool Order' }, { name: 'Weekly Tool Totals' }];

const emails = ref([
  {
    email: 'dave@bkmachine.net',
    enabledCategories: [],
    editing: false,
  },
]);

function addEmail() {
  emails.value.push({
    email: '',
    enabledCategories: [],
    editing: true,
  });
}

function editEmail(idx: number) {
  emails.value[idx].editing = true;
}

function deleteEmail(idx: number) {
  emails.value.splice(idx, 1);
}
</script>

<style scoped>
.mb-4 {
  margin-bottom: 1rem;
}
</style>
