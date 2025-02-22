<template>
  <v-card>
    <v-card-title class="header my-4">
      <div>Parts</div>
      <div>
        <v-btn link :to="{ name: 'createPart' }" color="secondary" prepend-icon="mdi-plus">
          Create New Part
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-text-field
        v-model="search"
        class="my-2"
        label="Search"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        single-line
        hide-details
        clearable
      />
      <v-data-table
        v-model:page="page"
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="filteredItems"
        :search="search"
        :loading="partStore.loading"
        @click:row="openPart"
      >
        <template v-slot:[`item.img`]="{ item }">
          <v-img :id="item._id" :src="item.img" class="part-img"></v-img>
        </template>
        <template v-slot:[`item.location`]="{ item }">
          {{ location(item) }}
        </template>
        <template v-slot:[`item.stock`]="{ item }">
          <div class="d-flex align-center">
            <v-dialog max-width="500">
              <template v-slot:activator="{ props: activatorProps }">
                <v-btn v-bind="activatorProps">
                  <span class="stock mr-2">
                    {{ item.stock }}
                  </span>
                  <v-icon icon="mdi-contrast" size="large" color="secondary" />
                </v-btn>
              </template>

              <template v-slot:default="{ isActive }">
                <v-card>
                  <PartsAdjustStockDialog :part="item" @closeDialog="isActive.value = false" />
                </v-card>
              </template>
            </v-dialog>
          </div>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import PartsAdjustStockDialog from '@/components/PartsAdjustStockDialog.vue';
import router from '@/router';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();

const page = ref(1);
const itemsPerPage = ref(10);
const search = ref('');

const headers = [
  {
    key: 'img',
    width: 150,
    sortable: false,
  },
  {
    title: 'Part #',
    key: 'part',
  },
  {
    title: 'Description',
    key: 'description',
  },

  {
    key: 'customer.name',
    title: 'Customer',
  },
  {
    title: 'Location',
    key: 'location',
  },
  {
    title: 'Stock',
    key: 'stock',
  },
];

const filteredItems = computed(() => {
  return [...partStore.parts];
});

function openPart(event: unknown, { item }: { item: PartDoc }) {
  router.push({ name: 'viewPart', params: { id: item._id } });
}

function location(part: PartDoc) {
  let text = part.location || '';
  if (part.position) text += ' - ' + part.position;
  return text;
}
</script>

<style scoped>
.header {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
.stock {
  font-weight: bolder;
  font-size: 1.1em;
}
.part-img {
  max-height: 50px;
}
</style>
