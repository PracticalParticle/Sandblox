module.exports = {
  root: true,
  ignorePatterns: [
    'particle-core',     // Ignore the entire particle-core directory
    'particle-core/**/*', // Ignore all files in particle-core recursively
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