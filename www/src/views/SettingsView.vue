<template>
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2">mdi-account-multiple-outline</v-icon>
          Customers
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <CustomerSettings />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2">mdi-truck-delivery-outline</v-icon>
          Suppliers
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <SupplierSettings />
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon class="mr-2">mdi-package-variant-closed</v-icon>
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
</script>

<style scoped></style>
