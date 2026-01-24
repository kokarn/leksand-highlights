#!/usr/bin/env node
/**
 * EAS Build pre-install hook
 * Creates google-services.json from environment variable or local file path
 * This runs inside the EAS build environment before npm install
 *
 * Environment variables:
 *   GOOGLE_SERVICES_JSON_BASE64 - Base64-encoded content of google-services.json (for CI)
 *   GOOGLE_SERVICES_JSON_PATH   - Absolute path to local google-services.json file (for local builds)
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES_BASE64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
const GOOGLE_SERVICES_PATH = process.env.GOOGLE_SERVICES_JSON_PATH;
const outputPath = path.join(__dirname, '..', 'google-services.json');

// Check if file already exists in the build directory
if (fs.existsSync(outputPath)) {
  const stats = fs.statSync(outputPath);
  console.log(`[eas-build-pre-install] google-services.json already exists (${stats.size} bytes)`);
  process.exit(0);
}

// Option 1: Create from base64-encoded content (CI builds)
if (GOOGLE_SERVICES_BASE64) {
  console.log('[eas-build-pre-install] Creating google-services.json from GOOGLE_SERVICES_JSON_BASE64...');

  try {
    const content = Buffer.from(GOOGLE_SERVICES_BASE64, 'base64').toString('utf8');
    fs.writeFileSync(outputPath, content);

    const stats = fs.statSync(outputPath);
    console.log(`[eas-build-pre-install] Created google-services.json (${stats.size} bytes)`);
    process.exit(0);
  } catch (error) {
    console.error('[eas-build-pre-install] Failed to create google-services.json:', error.message);
    process.exit(1);
  }
}

// Option 2: Copy from local file path (local builds)
if (GOOGLE_SERVICES_PATH) {
  console.log(`[eas-build-pre-install] Copying google-services.json from ${GOOGLE_SERVICES_PATH}...`);

  try {
    if (!fs.existsSync(GOOGLE_SERVICES_PATH)) {
      console.error(`[eas-build-pre-install] File not found: ${GOOGLE_SERVICES_PATH}`);
      process.exit(1);
    }

    fs.copyFileSync(GOOGLE_SERVICES_PATH, outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`[eas-build-pre-install] Copied google-services.json (${stats.size} bytes)`);
    process.exit(0);
  } catch (error) {
    console.error('[eas-build-pre-install] Failed to copy google-services.json:', error.message);
    process.exit(1);
  }
}

// No environment variable set - provide helpful error message
console.error('[eas-build-pre-install] ERROR: google-services.json not found!');
console.error('');
console.error('For local builds, set one of these environment variables:');
console.error('');
console.error('  Option 1 - Path to local file:');
console.error('    export GOOGLE_SERVICES_JSON_PATH="$(pwd)/shl-highlights-app/google-services.json"');
console.error('');
console.error('  Option 2 - Base64-encoded content:');
console.error('    export GOOGLE_SERVICES_JSON_BASE64=$(base64 -i shl-highlights-app/google-services.json)');
console.error('');
process.exit(1);
