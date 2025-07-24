<template>
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-account-multiple-outline" />
          Customers
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <CustomerSettings />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-email-open-outline" />
          Email Reports
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <SettingsReport />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-truck-delivery-outline" />
          Suppliers
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <SupplierSettings />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2" icon="mdi-package-variant-closed" />
          Vendors
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <VendorSettings />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script setup lang="ts">
import CustomerSettings from '@/components/settings/SettingsCustomer.vue';
import SupplierSettings from '@/components/settings/SettingsSupplier.vue';
import VendorSettings from '@/components/settings/SettingsVendor.vue';
import SettingsReport from '@/components/settings/SettingsReport.vue';
</script>

<style scoped></style>
