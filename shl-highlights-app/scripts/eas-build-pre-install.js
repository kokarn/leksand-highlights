#!/usr/bin/env node
/**
 * EAS Build pre-install hook
 * Creates google-services.json from base64-encoded environment variable
 * This runs inside the EAS build environment before npm install
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES_BASE64 = process.env.GOOGLE_SERVICES_JSON_BASE64;

if (GOOGLE_SERVICES_BASE64) {
  console.log('[eas-build-pre-install] Creating google-services.json from environment variable...');
  
  try {
    const content = Buffer.from(GOOGLE_SERVICES_BASE64, 'base64').toString('utf8');
    const outputPath = path.join(__dirname, '..', 'google-services.json');
    
    fs.writeFileSync(outputPath, content);
    
    const stats = fs.statSync(outputPath);
    console.log(`[eas-build-pre-install] Created google-services.json (${stats.size} bytes)`);
  } catch (error) {
    console.error('[eas-build-pre-install] Failed to create google-services.json:', error.message);
    process.exit(1);
  }
} else {
  console.log('[eas-build-pre-install] GOOGLE_SERVICES_JSON_BASE64 not set, skipping...');
  
  // Check if file already exists (local development)
  const filePath = path.join(__dirname, '..', 'google-services.json');
  if (fs.existsSync(filePath)) {
    console.log('[eas-build-pre-install] google-services.json already exists locally');
  } else {
    console.warn('[eas-build-pre-install] WARNING: google-services.json not found!');
  }
}
