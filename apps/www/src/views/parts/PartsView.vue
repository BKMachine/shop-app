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
      <v-row no-gutters>
        <v-col cols="7">
          <v-text-field
            v-model="search"
            class="my-2 mr-2"
            clearable
            hide-details
            label="Search"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
          />
        </v-col>
        <v-col cols="3">
          <CustomerSelect
            v-model="selectedCustomerId"
            class="my-2 ml-2"
            clearable
            hide-details
            label="Customer"
            variant="outlined"
          />
        </v-col>
        <v-col class="d-flex align-center justify-space-around" cols="2">
          <v-checkbox
            v-model="showSubComponents"
            class="parts-sub-toggle"
            color="primary"
            density="compact"
            hide-details
            label="Show Subcomponents"
          />
        </v-col>
      </v-row>
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
              :class="[
                'rate-swatch',
                item.hasNoProductPrice ? 'rate-swatch--empty' : `rate-swatch--${item.marginTone}`,
              ]"
              @click.stop="openPartCost(item)"
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
              > </v-img>
              <MissingImage v-else class="part-img part-img-fallback" />
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
import CustomerSelect from '@/components/CustomerSelect.vue';
import MissingImage from '@/components/MissingImage.vue';
import PartsAdjustStockDialog from '@/components/parts/PartsAdjustStockDialog.vue';
import { getToneForRate } from '@/plugins/rates_theme';
import {
  calculateAssemblyCycleMinutes,
  calculateAssemblyMaterialCost,
  calculateRatePerHour,
} from '@/plugins/utils';
import router from '@/router';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';

const partStore = usePartStore();
const materialsStore = useMaterialsStore();

const page = ref(1);
const itemsPerPage = ref(10);
const search = ref('');
const selectedCustomerId = ref<string | null>(null);
const showSubComponents = ref(false);
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

const subComponentPartIds = computed(() => {
  return new Set(
    partStore.parts.flatMap((part) =>
      (part.subComponentIds || []).map((subComponent) => String(subComponent.partId)),
    ),
  );
});

const filteredItems = computed(() => {
  return partStore.parts.filter((part) => {
    if (!showSubComponents.value && subComponentPartIds.value.has(part._id)) {
      return false;
    }

    const customerId = typeof part.customer === 'string' ? part.customer : part.customer?._id;
    if (!selectedCustomerId.value) {
      return true;
    }

    return customerId === selectedCustomerId.value;
  });
});

onMounted(() => {
  if (!materialsStore.materials.length && !materialsStore.loading) {
    materialsStore.fetch();
  }
});

const partById = computed(() => {
  return new Map(partStore.parts.map((part) => [part._id, part]));
});

function resolvePart(partId: string) {
  return partById.value.get(partId);
}

function resolveMaterial(material: Part['material']) {
  if (!material) return null;
  if (typeof material !== 'string') return material;
  return materialsStore.materials.find((candidate) => candidate._id === material) || null;
}

const tableItems = computed(() =>
  filteredItems.value.map((part) => {
    const partMaterialCost = calculateAssemblyMaterialCost(part, resolvePart, resolveMaterial);
    const totalCycleMinutes = calculateAssemblyCycleMinutes(part, resolvePart);
    const hasNoProductPrice = part.price == null || part.price === 0;
    const marginRate = hasNoProductPrice
      ? 0
      : calculateRatePerHour(part.price, partMaterialCost, totalCycleMinutes);

    return {
      ...part,
      hasNoProductPrice,
      marginRate,
      marginTone: getToneForRate(marginRate),
    };
  }),
);

function openPart(event: unknown, { item }: { item: Part }) {
  router.push({ name: 'viewPart', params: { id: item._id } });
}

function openPartCost(item: Part) {
  router.push({ name: 'viewPart', params: { id: item._id }, query: { tab: 'cost' } });
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
  cursor: pointer;
}

.rate-swatch--empty {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.18);
}

.parts-sub-toggle {
  margin-top: 0;
}

.part-img-fallback {
  width: 38px;
  min-height: 38px;
  margin: 2px auto;
  padding: 4px 6px;
  font-size: 10px;
  border-radius: 4px;
}
</style>
