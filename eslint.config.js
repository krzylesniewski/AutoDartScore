import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/dist.new/',
      '**/dist.prev/',
      '**/coverage/',
      'spikes/',
      '**/.describe-me/',
      '**/describe-me-dist/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Callbacki w propsach i atrapach mają składnię metody (onClose(): void) i są destrukturyzowane albo sprawdzane w expect.
      // Nie korzystają z this, więc reguła dawałaby tu same fałszywe alarmy.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  { ...tseslint.configs.disableTypeChecked, files: ['**/*.js', '**/*.mjs', '**/*.cjs'] },
  { ...reactHooks.configs.flat.recommended, files: ['packages/web/**/*.ts', 'packages/web/**/*.tsx'] },
);
