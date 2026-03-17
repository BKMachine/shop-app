<template>
  <v-card>
    <v-card-title class="header my-4">
      <div>Parts</div>
      <div>
        <v-btn color="secondary" link prepend-icon="mdi-plus" :to="{ name: 'createPart' }">
          Create New Part
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <v-text-field
        v-model="search"
        class="my-2"
        clearable
        hide-details
        label="Search"
        prepend-inner-icon="mdi-magnify"
        single-line
        variant="outlined"
      />
      <v-data-table
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="filteredItems"
        :loading="partStore.loading"
        :search="search"
        @click:row="openPart"
      >
        <template #['item.img']="{ item }">
          <v-hover>
            <template #default="{ isHovering, props }">
              <v-img
                v-bind="props"
                :id="item._id"
                class="part-img"
                :src="item.img"
                @mouseenter="showExpandedImage(item.img, $event)"
                @mouseleave="hideExpandedImage"
              />
            </template>
          </v-hover>
        </template>
        <template #['item.location']="{ item }"> {{ location(item) }} </template>
        <template #['item.stock']="{ item }">
          <div class="d-flex align-center">
            <v-dialog max-width="500">
              <template #activator="{ props: activatorProps }">
                <v-btn v-bind="activatorProps">
                  <span class="stock mr-2"> {{ item.stock }} </span>
                  <v-icon color="secondary" icon="mdi-contrast" size="large" />
                </v-btn>
              </template>

              <template #default="{ isActive }">
                <v-card>
                  <PartsAdjustStockDialog :part="item" @close-dialog="isActive.value = false" />
                </v-card>
              </template>
            </v-dialog>
          </div>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>

  <teleport to="body">
    <div
      v-if="expandedImage.visible"
      class="expanded-img-container"
      :style="{ top: expandedImage.top + 'px', left: expandedImage.left + 'px' }"
    >
      <v-img class="expanded-img" :src="expandedImage.src" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
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

function openPart(event: unknown, { item }: { item: Part }) {
  router.push({ name: 'viewPart', params: { id: item._id } });
}

function location(part: Part) {
  let text = part.location || '';
  if (part.position) text += ' - ' + part.position;
  return text;
}

const expandedImage = ref({
  visible: false,
  src: '',
  top: 0,
  left: 0,
});

function showExpandedImage(src: string | undefined, event: MouseEvent) {
  if (!src) return;
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  expandedImage.value = {
    visible: true,
    src,
    top: rect.top,
    left: rect.right,
  };
}

function hideExpandedImage() {
  expandedImage.value.visible = false;
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
  min-width: 4ch; /* reserve space for 4 digits */
  text-align: center;
  display: inline-block;
}
.part-img {
  max-height: 50px;
}
.expanded-img-container {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.expanded-img {
  width: 500px;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
</style>
