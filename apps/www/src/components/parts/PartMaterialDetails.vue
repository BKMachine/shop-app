<template>
  <v-row>
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
                  {{ formatNumber(partsPerBarDetails.fullBarLength) }}" ÷
                  {{ formatNumber(partsPerBarDetails.materialLength) }}"
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
                  {{ formatNumber(partsPerBarDetails.fullBarLength) }}" − ({{ partsPerBarDetails.totalParts }}
                  × {{ formatNumber(partsPerBarDetails.materialLength) }}") =
                  {{ formatNumber(wasteDetails.wasteLength) }}"
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
                  {{ formatNumber(partsPerBarDetails.fullBarLength) }}" ÷
                  {{ formatNumber(partsPerBarDetails.barLength) }}"
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
                  {{ formatNumber(partsPerBarDetails.barLength) }}" −
                  {{ formatNumber(partsPerBarDetails.remnantLength) }}" =
                  {{ formatNumber(partsPerBarDetails.usablePerSubBar) }}" usable
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
                  {{ formatNumber(partsPerBarDetails.remainderLength) }}" −
                  {{ formatNumber(partsPerBarDetails.remnantLength) }}" =
                  {{ formatNumber(partsPerBarDetails.usableRemainder) }}" usable
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
                  {{ formatNumber(partsPerBarDetails.fullBarLength) }}" − ({{ partsPerBarDetails.totalParts }}
                  × {{ formatNumber(partsPerBarDetails.materialLength) }}") =
                  {{ formatNumber(wasteDetails.wasteLength) }}"
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
          <v-table class="rounded bg-transparent" density="compact">
            <tbody>
              <tr>
                <td class="text-medium-emphasis text-body-2 row-1">Material Cost:</td>
                <td class="text-body-2">
                  <div class="d-flex align-center ga-2">
                    <v-chip color="purple-darken-2" variant="tonal"
                      >${{ formatCost(materialCost) }}</v-chip
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
import { formatCost, formatNumber, onlyAllowNumeric } from '@/plugins/utils';
import { useMaterialsStore } from '@/stores/materials_store';

interface Props {
  part: Part;
}

const props = defineProps<Props>();
const emit = defineEmits<(e: 'update:partMaterialCost', value: number) => void>();
const materialsStore = useMaterialsStore();

const selectedMaterialLength = computed(() => {
  if (!props.part.material) return 0;
  if (typeof props.part.material !== 'string') return props.part.material.length || 0;
  const material = materialsStore.materials.find((x) => x._id === props.part.material);
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
      totalParts: Math.floor(fullBarLength / materialLength),
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
    totalParts: subBars * partsPerSubBar + remainderParts,
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
    materialCost.value > 0
      ? Math.round((wasteLength / d.fullBarLength) * materialCost.value * 100) / 100
      : 0;
  return { wasteLength, wasteCost };
});

function assignMaterial() {
  if (!props.part.material) return;
  const material = materialsStore.materials.find((x) => x._id === props.part.material);
  if (!material) return;
  props.part.material = material;
}

const materialCost = computed(() => {
  if (!props.part.material) return 0;
  if (typeof props.part.material === 'string') return 0;
  const feet = (props.part.material.length || 0) / 12;
  return feet * (props.part.material.costPerFoot || 0);
});

const partMaterialCost = computed(() => {
  if (!partsPerBar.value) return 0;
  return materialCost.value / partsPerBar.value;
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
</script>

<style scoped>
.yield-chip {
  min-width: 120px;
  justify-content: center;
}

.row-1 {
  width: 140px;
}

.swiss-defaults-btn {
  position: relative;
  left: 16px;
}
</style>
