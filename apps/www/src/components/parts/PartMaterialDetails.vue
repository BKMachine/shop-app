<template>
  <v-row v-if="hasSubComponents">
    <v-col cols="12">
      <v-card variant="outlined">
        <v-card-title class="text-subtitle-1">Sub-Component Material Summary</v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-4">
            Material cost for this assembly is derived from its attached sub-components.
          </div>
          <v-table class="rounded bg-transparent" density="compact">
            <tbody>
              <tr v-for="component in subComponentMaterialRows" :key="component._id">
                <td class="text-body-2 assembly-row-1">
                  <div class="sub-component-line">
                    <span class="sub-component-name-block">
                      <span class="sub-component-name-row">
                        <span class="sub-component-name">{{ component.part }}</span>
                        <v-btn
                          color="primary"
                          density="comfortable"
                          icon="mdi-open-in-new"
                          size="x-small"
                          variant="text"
                          @click="openSubComponent(component.partId)"
                        />
                      </span>
                      <span class="sub-component-description text-medium-emphasis">
                        {{ component.description }}
                      </span>
                    </span>
                    <span class="sub-component-meta">
                      <span class="text-medium-emphasis">
                        {{ component.materialDescription }}
                      </span>
                      <span class="sub-component-separator">-</span>
                      <span class="text-medium-emphasis">
                        @ {{ formatDimension(component.materialLength) }}"
                      </span>
                    </span>
                  </div>
                </td>
                <td class="qty-cell">
                  <div class="qty-wrap my-2">
                    <v-text-field
                      v-model.number="component.entry.qty"
                      density="compact"
                      hide-details
                      min="1"
                      type="number"
                      variant="outlined"
                      @keydown="onlyAllowNumeric($event)"
                    />
                  </div>
                </td>
                <td class="text-right">
                  <div class="cost-cell">
                    <v-chip
                      :color="component.customerSuppliedMaterial ? 'info' : 'success'"
                      density="compact"
                      variant="tonal"
                    >
                      ${{ formatCost(component.materialSubtotal) }}
                    </v-chip>
                    <div class="text-caption text-medium-emphasis cost-subtotal">
                      ${{ formatCost(component.materialCost) }}
                      / part
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-divider />
        <v-card-text class="py-3">
          <div class="d-flex align-center justify-space-between flex-wrap ga-3">
            <div class="text-body-2 text-medium-emphasis">
              {{ subComponentMaterialRows.length }}
              sub-component{{ subComponentMaterialRows.length === 1 ? '' : 's' }}
            </div>
            <v-chip class="font-weight-bold yield-chip" color="success" variant="elevated">
              ${{ formatCost(partMaterialCost) }}
              / assembly
            </v-chip>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <v-row v-else>
    <v-col cols="6">
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-autocomplete
                v-model="part.material"
                hide-details
                item-title="description"
                item-value="_id"
                :items="sortedMaterials"
                label="Material"
                @update:model-value="assignMaterial"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <v-checkbox
                v-model="part.customerSuppliedMaterial"
                class="mb-4 customer-supplied-checkbox"
                density="compact"
                hide-details
                label="Material is customer supplied"
              />
              <v-radio-group v-model="part.materialCutType" hide-details inline label="Cut Type">
                <v-radio label="Blanks" value="blanks" />
                <v-radio label="Bars" value="bars" />
              </v-radio-group>
              <div>
                <v-btn
                  v-if="part.materialCutType === 'bars'"
                  class="mt-1 px-0 text-caption-2 swiss-defaults-btn"
                  color="primary"
                  density="compact"
                  size="x-small"
                  variant="text"
                  @click="setMaterialDefaults('lathe')"
                >
                  Lathe defaults
                </v-btn>
                <v-btn
                  v-if="part.materialCutType === 'bars'"
                  class="mt-1 px-0 ml-4 text-caption-2 swiss-defaults-btn"
                  color="primary"
                  density="compact"
                  size="x-small"
                  variant="text"
                  @click="setMaterialDefaults('2from1')"
                >
                  2 from 1
                </v-btn>
              </div>
              <div>
                <v-btn
                  v-if="part.materialCutType === 'bars'"
                  class="mt-1 px-0 text-caption-2 swiss-defaults-btn"
                  color="primary"
                  density="compact"
                  size="x-small"
                  variant="text"
                  @click="setMaterialDefaults('swiss')"
                >
                  Swiss defaults
                </v-btn>
              </div>
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="part.materialLength"
                hint="Material usage per part"
                label="Length per Part (in)"
                min="0"
                :rules="[partLengthRule]"
                type="number"
                @keydown="onlyAllowNumeric($event)"
              />
            </v-col>
          </v-row>
          <v-row>
            <template v-if="part.materialCutType === 'bars'">
              <v-col cols="6">
                <v-text-field
                  v-model.number="part.barLength"
                  label="Cut Bar Length (in)"
                  min="0"
                  :rules="[cutBarLengthRule]"
                  type="number"
                  @keydown="onlyAllowNumeric($event)"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="part.remnantLength"
                  label="Remnant Length (in)"
                  min="0"
                  :rules="[remnantLengthRule]"
                  type="number"
                  @keydown="onlyAllowNumeric($event)"
                />
              </v-col>
            </template>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="6">
      <v-card color="blue-grey" variant="tonal">
        <v-card-title class="text-subtitle-2 pa-3 pb-2"> Yield Summary </v-card-title>
        <v-card-text>
          <v-table
            v-if="part.materialCutType !== 'bars'"
            class="rounded bg-transparent"
            density="compact"
          >
            <tbody>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Full Bar</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.fullBarLength) }}" ÷
                  {{ formatDimension(partsPerBarDetails.materialLength) }}"
                </td>
                <td class="text-right">
                  <v-chip class="yield-chip" color="success" size="small" variant="elevated">
                    {{ partsPerBarDetails.totalParts }}
                    parts / bar
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Waste</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.fullBarLength) }}" − ({{ partsPerBarDetails.totalParts }}
                  × {{ formatDimension(partsPerBarDetails.materialLength) }}") =
                  {{ formatDimension(wasteDetails.wasteLength) }}"
                </td>
                <td class="text-right">
                  <v-chip color="warning" size="small" variant="tonal"
                    >${{ formatCost(wasteDetails.wasteCost) }}</v-chip
                  >
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-table v-else class="rounded bg-transparent" density="compact">
            <tbody>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Full Bar</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.fullBarLength) }}" ÷
                  {{ formatDimension(partsPerBarDetails.barLength) }}"
                </td>
                <td class="text-right">
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ partsPerBarDetails.subBars }}
                    cut bars
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Cut Bar</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.barLength) }}" −
                  {{ formatDimension(partsPerBarDetails.remnantLength) }}" =
                  {{ formatDimension(partsPerBarDetails.usablePerSubBar) }}" usable
                </td>
                <td class="text-right">
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ partsPerBarDetails.partsPerSubBar }}
                    parts / cut bar
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Remainder</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.remainderLength) }}" −
                  {{ formatDimension(partsPerBarDetails.remnantLength) }}" =
                  {{ formatDimension(partsPerBarDetails.usableRemainder) }}" usable
                </td>
                <td class="text-right">
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ partsPerBarDetails.remainderParts }}
                    parts / remainder
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis text-caption font-weight-bold">Total</td>
                <td class="text-body-2">
                  ({{ partsPerBarDetails.subBars }}
                  × {{ partsPerBarDetails.partsPerSubBar }}) +
                  {{ partsPerBarDetails.remainderParts }}
                </td>
                <td class="text-right">
                  <v-chip class="yield-chip" color="success" size="small" variant="elevated">
                    {{ partsPerBarDetails.totalParts }}
                    parts / bar
                  </v-chip>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis text-caption row-1">Waste</td>
                <td class="text-body-2">
                  {{ formatDimension(partsPerBarDetails.fullBarLength) }}" − ({{ partsPerBarDetails.totalParts }}
                  × {{ formatDimension(partsPerBarDetails.materialLength) }}") =
                  {{ formatDimension(wasteDetails.wasteLength) }}"
                </td>
                <td class="text-right">
                  <v-chip color="warning" size="small" variant="tonal">
                    ${{ formatCost(wasteDetails.wasteCost) }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-divider />
        <v-card-text class="py-2">
          <div
            v-if="part.customerSuppliedMaterial"
            class="text-medium-emphasis text-caption mb-2 d-flex align-center ga-2"
          >
            <v-chip color="info" size="small" variant="tonal">Customer Supplied</v-chip>
            Material cost excluded from part cost summary.
          </div>
          <v-table class="rounded bg-transparent" density="compact">
            <tbody>
              <tr>
                <td class="text-medium-emphasis text-body-2 row-1">Material Cost:</td>
                <td class="text-body-2">
                  <div class="d-flex align-center ga-2">
                    <v-chip color="purple-darken-2" variant="tonal"
                      >${{ formatCost(billableMaterialCost) }}</v-chip
                    >
                    <span class="text-medium-emphasis">÷</span>
                    <v-chip variant="outlined">{{ partsPerBar }} parts</v-chip>
                  </div>
                </td>
                <td class="text-right">
                  <v-chip class="font-weight-bold yield-chip" color="success" variant="elevated"
                    >${{ formatCost(partMaterialCost) }}
                    / part</v-chip
                  >
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import {
  calculateAssemblyMaterialCost,
  calculatePartMaterialCost,
  calculatePartsPerBar,
  formatCost,
  formatDimension,
  onlyAllowNumeric,
} from '@/plugins/utils';
import router from '@/router';
import { useMaterialsStore } from '@/stores/materials_store';
import { usePartStore } from '@/stores/parts_store';

interface Props {
  part: Part;
  subComponents?: Array<{
    key: string;
    entry: PartSubComponent;
    part: Part;
  }>;
}

const props = defineProps<Props>();
const emit = defineEmits<(e: 'update:partMaterialCost', value: number) => void>();
const materialsStore = useMaterialsStore();
const partStore = usePartStore();
const hasSubComponents = computed(() => (props.subComponents || []).length > 0);
const subComponentById = computed(() => {
  return new Map(partStore.parts.map((component) => [component._id, component]));
});

function resolveMaterial(material: Part['material']) {
  if (!material) return null;
  if (typeof material !== 'string') return material;
  return materialsStore.materials.find((candidate) => candidate._id === material) || null;
}

function resolvePart(partId: string) {
  return subComponentById.value.get(partId);
}

const subComponentMaterialRows = computed(() => {
  return (props.subComponents || []).map((subComponent) => {
    const material = resolveMaterial(subComponent.part.material);
    const materialCost = calculateAssemblyMaterialCost(
      subComponent.part,
      resolvePart,
      resolveMaterial,
    );

    return {
      _id: subComponent.key,
      partId: subComponent.part._id,
      entry: subComponent.entry,
      part: subComponent.part.part,
      description: subComponent.part.description,
      customerSuppliedMaterial: Boolean(subComponent.part.customerSuppliedMaterial),
      materialDescription: material?.description || 'No material set',
      materialLength: Number(subComponent.part.materialLength) || 0,
      materialCost,
      materialSubtotal: materialCost * Math.max(1, Number(subComponent.entry.qty) || 1),
    };
  });
});

const selectedMaterialLength = computed(() => {
  if (!props.part.material) return 0;
  if (typeof props.part.material !== 'string') return props.part.material.length || 0;
  const material = materialsStore.materials.find((x) => x._id === props.part.material?._id);
  return material?.length || 0;
});

const partsPerBarDetails = computed(() => {
  const cutType = props.part.materialCutType || 'blanks';
  const fullBarLength = Number(selectedMaterialLength.value) || 0;
  const materialLength = Number(props.part.materialLength) || 0;

  if (!fullBarLength || !materialLength) {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength: Number(props.part.barLength) || 0,
      remnantLength: Number(props.part.remnantLength) || 0,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: 0,
    };
  }

  if (cutType !== 'bars') {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength: 0,
      remnantLength: 0,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: calculatePartsPerBar(props.part, fullBarLength),
    };
  }

  const barLength = Number(props.part.barLength) || 0;
  const remnantLength = Number(props.part.remnantLength) || 0;
  if (!barLength || barLength <= remnantLength) {
    return {
      cutType,
      fullBarLength,
      materialLength,
      barLength,
      remnantLength,
      subBars: 0,
      usablePerSubBar: 0,
      partsPerSubBar: 0,
      remainderLength: 0,
      usableRemainder: 0,
      remainderParts: 0,
      totalParts: 0,
    };
  }

  const subBars = Math.floor(fullBarLength / barLength);
  const remainderLength = fullBarLength % barLength;
  const usablePerSubBar = barLength - remnantLength;
  const partsPerSubBar = Math.floor(usablePerSubBar / materialLength);
  const usableRemainder = Math.max(remainderLength - remnantLength, 0);
  const remainderParts = Math.floor(usableRemainder / materialLength);

  return {
    cutType,
    fullBarLength,
    materialLength,
    barLength,
    remnantLength,
    subBars,
    usablePerSubBar,
    partsPerSubBar,
    remainderLength,
    usableRemainder,
    remainderParts,
    totalParts: calculatePartsPerBar(props.part, fullBarLength),
  };
});

const partsPerBar = computed(() => {
  return partsPerBarDetails.value.totalParts;
});

const wasteDetails = computed(() => {
  const d = partsPerBarDetails.value;
  if (!d.fullBarLength) return { wasteLength: 0, wasteCost: 0 };
  const wasteLength = Math.round((d.fullBarLength - d.totalParts * d.materialLength) * 1000) / 1000;
  const wasteCost =
    billableMaterialCost.value > 0
      ? Math.round((wasteLength / d.fullBarLength) * billableMaterialCost.value * 100) / 100
      : 0;
  return { wasteLength, wasteCost };
});

function assignMaterial() {
  if (!props.part.material) return;
  const material = materialsStore.materials.find((x) => x._id === props.part.material?._id);
  if (!material) return;
  props.part.material = material;
}

const materialCost = computed(() => {
  if (!props.part.material) return 0;
  if (typeof props.part.material === 'string') return 0;
  const feet = (props.part.material.length || 0) / 12;
  return feet * (props.part.material.costPerFoot || 0);
});

const billableMaterialCost = computed(() => {
  return props.part.customerSuppliedMaterial ? 0 : materialCost.value;
});

const partMaterialCost = computed(() => {
  return calculateAssemblyMaterialCost(props.part, resolvePart, resolveMaterial);
});

watch(
  partMaterialCost,
  (value) => {
    emit('update:partMaterialCost', value);
  },
  { immediate: true },
);

const sortedMaterials = computed(() => {
  return materialsStore.materials.slice().sort((a, b) => {
    if (a.description < b.description) return -1;
    if (a.description > b.description) return 1;
    return 0;
  });
});

const partLengthRule = (val: string) => {
  const partLength = Number(val) || 0;
  const totalBarLength = Number(selectedMaterialLength.value) || 0;
  return partLength <= totalBarLength || 'Length per part cannot exceed total bar length';
};

const cutBarLengthRule = (val: string) => {
  if (props.part.materialCutType !== 'bars') return true;
  const cutBarLength = Number(val) || 0;
  const totalBarLength = Number(selectedMaterialLength.value) || 0;
  if (!cutBarLength || !totalBarLength) return true;
  return cutBarLength <= totalBarLength || 'Cut bar length cannot exceed total bar length';
};

const remnantLengthRule = (val: string) => {
  if (props.part.materialCutType !== 'bars') return true;
  const remnantLength = Number(val) || 0;
  const cutBarLength = Number(props.part.barLength) || 0;
  if (!cutBarLength) return true;
  return remnantLength <= cutBarLength || 'Remnant length cannot exceed cut bar length';
};

function setMaterialDefaults(type: 'lathe' | 'swiss' | '2from1') {
  if (type === 'lathe') {
    props.part.barLength = 36;
    props.part.remnantLength = 2;
  } else if (type === 'swiss') {
    props.part.barLength = props.part.material?.length || 0;
    props.part.remnantLength = 12;
  } else if (type === '2from1') {
    props.part.barLength = ((props.part.materialLength || 0) + 0.1) * 2 + 0.15;
    props.part.remnantLength = 0;
  }
}

function openSubComponent(partId: string) {
  router.push({ name: 'viewPart', params: { id: partId } });
}
</script>

<style scoped>
.yield-chip {
  min-width: 120px;
  justify-content: center;
}

.qty-cell {
  width: 112px;
  min-width: 112px;
}

.assembly-row-1 {
  width: 100%;
  padding-right: 1rem;
}

.sub-component-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  line-height: 1.35;
}

.sub-component-name {
  font-weight: 500;
}

.sub-component-name-row {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.sub-component-name-block {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.sub-component-description {
  font-size: 0.9rem;
}

.sub-component-meta {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-align: right;
}

.sub-component-separator {
  color: rgba(0, 0, 0, 0.38);
}

.qty-wrap {
  display: flex;
  flex-direction: column;
}

.cost-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
}

.cost-subtotal {
  white-space: nowrap;
}

.swiss-defaults-btn {
  position: relative;
  left: 16px;
}

.row-1 {
  width: 140px;
}

.customer-supplied-checkbox {
  margin-top: 12px;
}
</style>
