import { config } from '@repo/eslint-config/base';
import pluginVue from 'eslint-plugin-vue';
import prettierConfig from '@vue/eslint-config-prettier';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

/** @type {import("eslint").Linter.Config} */
export default defineConfigWithVueTs(
  ...config,
  ...pluginVue.configs['flat/recommended'],
  prettierConfig,
  vueTsConfigs.recommended,
);
