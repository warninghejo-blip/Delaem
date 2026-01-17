#!/usr/bin/env node
/**
 * Build Script for Fennec Site
 *
 * Purpose: Copy source files from root to pages_upload/ folder for deployment
 * Source of Truth: Root folder (index.html, terminal.html, id.html, etc.)
 * Build Output: pages_upload/ (auto-generated)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'pages_upload');

// Files to copy from root
const htmlFiles = ['index.html', 'terminal.html', 'id.html', '404.html'];

// Folders to copy recursively
const foldersToCopy = ['assets', 'js', 'img', 'fonts', 'recursive_inscriptions', 'preview'];

// Files/folders to exclude
const excludePatterns = [
    'node_modules',
    '.git',
    '.env',
    '.env.local',
    '.dev.vars',
    'pages_upload',
    '.pages_upload',
    'backup',
    '.wrangler',
    '.vercel',
    '.vscode',
    '.idea',
    '*.bat',
    '*.rar',
    '*.log',
    '.DS_Store',
    'Thumbs.db'
];

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath) {
    const baseName = path.basename(filePath);
    return excludePatterns.some(pattern => {
        if (pattern.startsWith('*')) {
            return baseName.endsWith(pattern.slice(1));
        }
        return baseName === pattern || filePath.includes(pattern);
    });
}

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (shouldExclude(srcPath)) {
            continue;
        }

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Main build function
 */
function build() {
    console.log('🔨 Starting Fennec Site build...\n');

    // Step 1: Clean output directory
    console.log('🗑️  Cleaning pages_upload/...');
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('✅ Cleaned\n');

    // Step 2: Copy HTML files from root
    console.log('📄 Copying HTML files...');
    let copiedHtml = 0;
    for (const file of htmlFiles) {
        const src = path.join(rootDir, file);
        const dest = path.join(outputDir, file);

        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✓ ${file}`);
            copiedHtml++;
        } else {
            console.log(`   ⚠ ${file} not found`);
        }
    }
    console.log(`✅ Copied ${copiedHtml} HTML files\n`);

    // Step 3: Copy folders recursively
    console.log('📁 Copying folders...');
    for (const folder of foldersToCopy) {
        const src = path.join(rootDir, folder);
        const dest = path.join(outputDir, folder);

        if (fs.existsSync(src)) {
            copyDir(src, dest);
            console.log(`   ✓ ${folder}/`);
        } else {
            console.log(`   ⚠ ${folder}/ not found`);
        }
    }
    console.log('✅ Copied folders\n');

    // Step 4: Copy additional files (_headers, etc.)
    console.log('📋 Copying config files...');
    const configFiles = ['_headers', 'vercel.json', 'wrangler.toml'];
    let copiedConfig = 0;
    for (const file of configFiles) {
        const src = path.join(rootDir, file);
        const dest = path.join(outputDir, file);

        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✓ ${file}`);
            copiedConfig++;
        }
    }
    console.log(`✅ Copied ${copiedConfig} config files\n`);

    console.log('🎉 Build complete! Output: pages_upload/');
    console.log('💡 You can now deploy the pages_upload/ folder\n');
}

// Run build
try {
    build();
    process.exit(0);
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
