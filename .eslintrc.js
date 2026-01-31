const typeScriptExtensions = ['.ts'];
module.exports = {
  ignorePatterns: ['**/*.d.ts'],
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended'],
    plugins: ['unused-imports','eslint-plugin-import'],
    parserOptions: {
      ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
      sourceType: 'module', // Allows for the use of imports
    },
    settings: {
      'import/extensions': typeScriptExtensions,
      'import/external-module-folders': ['node_modules', 'node_modules/@types'],
      'import/parsers': {
        '@typescript-eslint/parser': typeScriptExtensions,
      },
      'import/resolver': {
        node: {
          extensions: typeScriptExtensions,
        },
      },
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-var-requires": "off",
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      "@typescript-eslint/quotes": 'off'
    },
  };
