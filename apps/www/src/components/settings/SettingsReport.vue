<template>
  <v-container>
    <!-- Header Row -->
    <v-row class="mb-2" no-gutters>
      <v-col cols="4"></v-col>
      <v-col cols="6" class="">
        <div>
        <span class="mr-4 font-weight-bold">Tooling Report</span>
        </div>
        <div>
        <span class="ml-4" style="width: 40px;">To</span>
        <span class="ml-4" style="width: 40px;">Cc</span>
        </div>
      </v-col>
      <v-col cols="2"><v-btn color="primary" @click="addEmail">Add Email</v-btn></v-col>
    </v-row>
    <!-- Email Rows -->
    <v-row v-for="(email, index) in emails" :key="email._id" class="mb-0" no-gutters>
      <v-col cols="4">
        <v-text-field
          v-model="email.email"
          label="Email"
          @blur="update(email)"
        ></v-text-field>
      </v-col>
      <v-col cols="6" class="d-flex row align-center">
        <v-checkbox
          v-model="email.tooling.to"
          class="ml-2"
          hide-details
          style="width: 40px;"
        ></v-checkbox>
        <v-checkbox
          v-model="email.tooling.cc"
          class="ml-4"
          hide-details
          style="width: 40px;"
        ></v-checkbox>
      </v-col>
      <v-col cols="2" class="d-flex align-center">
        <v-btn icon color="error" @click="deleteEmail(index)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </v-col>
    </v-row>
    <v-row no-gutters>
      <v-col cols="12">
        
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '@/plugins/axios';

const emails = ref<Report[]>([]);

onMounted(() => {
  fetchEmails();
});

async function fetchEmails() {
  api.get<Report[]>('/reports').then(({data}) => {
    emails.value = data;
  })
}

async function update(email: Report) {
  await api.put('/reports', email);
}

</script>

<style scoped>
.mb-4 {
  margin-bottom: 1rem;
}
</style>
