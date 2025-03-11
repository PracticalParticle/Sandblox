const fs = require('fs');
const path = require('path');

const bloxDir = path.join(__dirname, '../src/blox');
const publicBloxDir = path.join(__dirname, '../public/blox');

/**
 * Recursively copy contract files from src/blox to public/blox
 * while maintaining the directory structure
 */
function copyContractsRecursively(sourceDir, targetDir) {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Read all items in the source directory
  const items = fs.readdirSync(sourceDir);

  items.forEach(item => {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      // Recursively copy subdirectories
      copyContractsRecursively(sourcePath, targetPath);
    } else if (
      item.endsWith('.sol') || 
      item.endsWith('.abi.json') ||
      item.endsWith('.bin') ||
      item.endsWith('.blox.json') ||
      item.endsWith('.md')
    ) {
      // Copy relevant contract files
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${sourcePath} -> ${targetPath}`);
    }
  });
}

// Start the copying process
try {
  copyContractsRecursively(bloxDir, publicBloxDir);
  console.log('Contract files copied successfully!');
} catch (error) {
  console.error('Error copying contract files:', error);
  process.exit(1);
} 