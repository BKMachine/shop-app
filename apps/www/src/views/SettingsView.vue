<template>
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-qrcode-scan" />
          Barcode Scanner
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsScannerBarcode /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.customer" />
          Customers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <CustomerSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-domain" />
          Departments
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsDepartments /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.report" />
          Email Reports
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsReport /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-toolbox-outline" />
          Extras
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsExtras /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-label-outline" />
          Label Layout
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsLabelLayout /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-printer-outline" />
          Printers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsPrinters /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel v-if="isLan">
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.schedule" />
          Schedule
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SettingsSchedule /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.supplier" />
          Suppliers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <SupplierSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.shipper" />
          Shippers
        </v-expansion-panel-title>
        <v-expansion-panel-text> <ShipperSettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-tag-multiple-outline" />
          Tool Categories
        </v-expansion-panel-title>
        <v-expansion-panel-text> <ToolCategorySettings /> </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" :icon="uiIcons.vendor" />
          Vendors
        </v-expansion-panel-title>

        <v-expansion-panel-text> <VendorSettings /> </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script setup lang="ts">
import CustomerSettings from '@/components/settings/SettingsCustomer.vue';
import SettingsDepartments from '@/components/settings/SettingsDepartments.vue';
import SettingsExtras from '@/components/settings/SettingsExtras.vue';
import SettingsLabelLayout from '@/components/settings/SettingsLabelLayout.vue';
import SettingsPrinters from '@/components/settings/SettingsPrinters.vue';
import SettingsReport from '@/components/settings/SettingsReport.vue';
import SettingsScannerBarcode from '@/components/settings/SettingsScannerBarcode.vue';
import SettingsSchedule from '@/components/settings/SettingsSchedule.vue';
import ShipperSettings from '@/components/settings/SettingsShipper.vue';
import SupplierSettings from '@/components/settings/SettingsSupplier.vue';
import ToolCategorySettings from '@/components/settings/SettingsToolCategories.vue';
import VendorSettings from '@/components/settings/SettingsVendor.vue';
import { uiIcons } from '@/lib/uiIcons';
import { isLan } from '@/state/device';
</script>
