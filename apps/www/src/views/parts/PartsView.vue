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
        :headers="headers"
        :items="tableItems"
        :loading="partStore.loading"
        :search="search"
        :sort-by="[{ key: 'part', order: 'asc' }]"
        @click:row="openPart"
      >
        <template #['item.marginRate']="{ item }">
          <div class="rate-swatch-cell">
            <span
              :class="['rate-swatch', `rate-swatch--${item.marginTone}`, `text-${item.marginTone}`]"
            />
          </div>
        </template>
        <template #['item.img']="{ item }">
          <v-hover>
            <template #default="{ isHovering, props }">
              <v-img
                v-if="hasPartImage(item)"
                v-bind="props"
                :id="item._id"
                class="part-img"
                :src="item.img"
                @error="markImageMissing(item._id)"
                @mouseenter="showExpandedImage(item, $event)"
                @mouseleave="hideExpandedImage"
              >
                <template #error>
                  <div class="part-img-fallback">
                    <v-icon icon="mdi-image-off-outline" />
                    <span>Missing image</span>
                  </div>
                </template>
              </v-img>
              <div v-else class="part-img part-img-fallback">
                <v-icon icon="mdi-image-off-outline" />
                <span>Missing image</span>
              </div>
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
import { computed, onMounted, ref } from 'vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
import {
  calculatePartMaterialCost,
  calculateRatePerHour,
  calculateTotalCycleMinutes,
  getToneForRate,
} from '@/plugins/utils';
import router from '@/router';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const materialsStore = useMaterialsStore();

const page = ref(1);
const itemsPerPage = ref(10);
const search = ref('');
const missingImageIds = ref<Record<string, boolean>>({});

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
    title: '$/hr',
    key: 'marginRate',
    width: 80,
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

onMounted(() => {
  if (!materialsStore.materials.length && !materialsStore.loading) {
    materialsStore.fetch();
  }
});

const tableItems = computed(() =>
  filteredItems.value.map((part) => {
    const material =
      typeof part.material === 'string'
        ? materialsStore.materials.find((x) => x._id === part.material)
        : part.material;
    const partMaterialCost = calculatePartMaterialCost(part, material);
    const totalCycleMinutes = calculateTotalCycleMinutes(part.cycleTimes);
    const marginRate = calculateRatePerHour(part.price, partMaterialCost, totalCycleMinutes);

    return {
      ...part,
      marginRate,
      marginTone: getToneForRate(marginRate),
    };
  }),
);

function openPart(event: unknown, { item }: { item: Part }) {
  router.push({ name: 'viewPart', params: { id: item._id } });
}

function location(part: Part) {
  let text = part.location || '';
  if (part.position) text += ' - ' + part.position;
  return text;
}

function hasPartImage(part: Part) {
  return Boolean(part.img?.trim()) && !missingImageIds.value[part._id];
}

function markImageMissing(partId: string) {
  missingImageIds.value = {
    ...missingImageIds.value,
    [partId]: true,
  };
  if (expandedImage.value.visible && expandedImage.value.partId === partId) {
    hideExpandedImage();
  }
}

const expandedImage = ref({
  visible: false,
  partId: '',
  src: '',
  top: 0,
  left: 0,
});

function showExpandedImage(part: Part, event: MouseEvent) {
  if (!hasPartImage(part) || !part.img) return;
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  expandedImage.value = {
    visible: true,
    partId: part._id,
    src: part.img,
    top: rect.top,
    left: rect.right,
  };
}

function hideExpandedImage() {
  expandedImage.value = {
    visible: false,
    partId: '',
    src: '',
    top: 0,
    left: 0,
  };
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

.part-img-fallback {
  width: 75%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  padding: 10px 14px;
  margin: 4px auto;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}

.expanded-img-container {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.expanded-img {
  width: 360px;
  max-height: 360px;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.rate-swatch-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.rate-swatch {
  width: 30px;
  height: 18px;
  border-radius: 6px;
  display: inline-block;
}

.rate-swatch--rateLow {
  background: rgb(var(--v-theme-rateLow));
}

.rate-swatch--rateWarn {
  background: rgb(var(--v-theme-rateWarn));
}

.rate-swatch--rateOk {
  background: rgb(var(--v-theme-rateOk));
}

.rate-swatch--rateGood {
  background: rgb(var(--v-theme-rateGood));
}

.rate-swatch--rateTurbo {
  background: rgb(var(--v-theme-rateTurbo));
}
</style>
