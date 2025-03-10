module.exports = {
  root: true,
  ignorePatterns: [
    'particle-core/**/*', // Ignore the particle-core submodule
    '**/*.sol',          // Ignore all Solidity files
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}; 