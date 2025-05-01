import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import importPlugin from 'eslint-plugin-import';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
      import: importPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      'no-console': process.env.NODE_ENV !== 'development' ? 'error' : 'warn',
      'import/order': ['error', { alphabetize: { order: 'asc' } }],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ['dist/**'],
  },
  {
    settings: {
      'import/extensions': ['.js', '.ts'],
    },
  },
];
