const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '../assets/images');

/**
 * Generate the GamePulse logo SVG
 * This matches the LogoMark.js component design exactly:
 * - Blue gradient background with rounded corners
 * - Three white bars of different heights (pulse visualization)
 * - Dark accent dot in the top right
 *
 * Based on LogoMark.js (44x44 base):
 * - borderRadius: 12 (27.27%)
 * - barWidth: 4 (9.09%)
 * - barGap: 4 (9.09%)
 * - shortHeight: 8 (18.18%)
 * - midHeight: 14 (31.82%)
 * - tallHeight: 20 (45.45%)
 * - barsContainerHeight: 22 (50%)
 * - dotSize: 8 (18.18%)
 * - dotOffset: 10 (22.73%)
 */
function generateLogoSVG(size, cornerRadius) {
    // Exact proportions from LogoMark.js (based on 44x44)
    const barWidth = Math.round(size * (4 / 44));
    const barGap = Math.round(size * (4 / 44));
    const barRadius = Math.round(barWidth / 2);

    // Bar heights (exact from LogoMark.js)
    const shortHeight = Math.round(size * (8 / 44));
    const midHeight = Math.round(size * (14 / 44));
    const tallHeight = Math.round(size * (20 / 44));

    // Bars container is 22px high in 44px icon, centered vertically
    const barsContainerHeight = Math.round(size * (22 / 44));

    // Center position - bars container is centered, bars align to bottom of container
    const centerY = size / 2;
    const barsBottom = centerY + (barsContainerHeight / 2);

    // Calculate bar positions (3 bars centered horizontally)
    const totalBarsWidth = barWidth * 3 + barGap * 2;
    const startX = (size - totalBarsWidth) / 2;

    // Accent dot - slightly smaller for better visual balance at large sizes
    // Original LogoMark.js: 8/44 = 18%, reduced to ~10% for cleaner look
    const dotSize = Math.round(size * 0.10);
    const dotMargin = Math.round(size * 0.12); // margin from corner

    return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0A84FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5AC8FA;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background with gradient -->
  <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="url(#bgGradient)"/>

  <!-- Pulse bars (order: short, tall, mid - left to right) -->
  <!-- Short bar (left) -->
  <rect
    x="${startX}"
    y="${barsBottom - shortHeight}"
    width="${barWidth}"
    height="${shortHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="rgba(255,255,255,0.9)"
  />

  <!-- Tall bar (middle) -->
  <rect
    x="${startX + barWidth + barGap}"
    y="${barsBottom - tallHeight}"
    width="${barWidth}"
    height="${tallHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="rgba(255,255,255,0.9)"
  />

  <!-- Mid bar (right) -->
  <rect
    x="${startX + (barWidth + barGap) * 2}"
    y="${barsBottom - midHeight}"
    width="${barWidth}"
    height="${midHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="rgba(255,255,255,0.9)"
  />

  <!-- Accent dot (top right corner) -->
  <circle
    cx="${size - dotMargin}"
    cy="${dotMargin}"
    r="${dotSize / 2}"
    fill="#0b0d10"
  />
</svg>`;
}

/**
 * Generate the foreground-only SVG (for Android adaptive icons)
 * Uses same proportions as LogoMark.js
 */
function generateForegroundSVG(size) {
    // Exact proportions from LogoMark.js (based on 44x44)
    const barWidth = Math.round(size * (4 / 44));
    const barGap = Math.round(size * (4 / 44));
    const barRadius = Math.round(barWidth / 2);

    // Bar heights
    const shortHeight = Math.round(size * (8 / 44));
    const midHeight = Math.round(size * (14 / 44));
    const tallHeight = Math.round(size * (20 / 44));

    // Bars container positioning
    const barsContainerHeight = Math.round(size * (22 / 44));
    const centerY = size / 2;
    const barsBottom = centerY + (barsContainerHeight / 2);

    // Calculate bar positions
    const totalBarsWidth = barWidth * 3 + barGap * 2;
    const startX = (size - totalBarsWidth) / 2;

    // Accent dot - smaller for visual balance
    const dotSize = Math.round(size * 0.10);
    const dotMargin = Math.round(size * 0.12);

    return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e8e8e8;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Pulse bars with slight gradient -->
  <!-- Short bar (left) -->
  <rect
    x="${startX}"
    y="${barsBottom - shortHeight}"
    width="${barWidth}"
    height="${shortHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="url(#barGradient)"
  />

  <!-- Tall bar (middle) -->
  <rect
    x="${startX + barWidth + barGap}"
    y="${barsBottom - tallHeight}"
    width="${barWidth}"
    height="${tallHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="url(#barGradient)"
  />

  <!-- Mid bar (right) -->
  <rect
    x="${startX + (barWidth + barGap) * 2}"
    y="${barsBottom - midHeight}"
    width="${barWidth}"
    height="${midHeight}"
    rx="${barRadius}"
    ry="${barRadius}"
    fill="url(#barGradient)"
  />

  <!-- Accent dot (top right corner) -->
  <circle
    cx="${size - dotMargin}"
    cy="${dotMargin}"
    r="${dotSize / 2}"
    fill="#0b0d10"
  />
</svg>`;
}

/**
 * Generate monochrome SVG (for Android themed icons)
 * Uses same proportions as LogoMark.js
 */
function generateMonochromeSVG(size) {
    // Exact proportions from LogoMark.js (based on 44x44)
    const barWidth = Math.round(size * (4 / 44));
    const barGap = Math.round(size * (4 / 44));
    const barRadius = Math.round(barWidth / 2);

    const shortHeight = Math.round(size * (8 / 44));
    const midHeight = Math.round(size * (14 / 44));
    const tallHeight = Math.round(size * (20 / 44));

    const barsContainerHeight = Math.round(size * (22 / 44));
    const centerY = size / 2;
    const barsBottom = centerY + (barsContainerHeight / 2);

    const totalBarsWidth = barWidth * 3 + barGap * 2;
    const startX = (size - totalBarsWidth) / 2;

    const dotSize = Math.round(size * 0.10);
    const dotMargin = Math.round(size * 0.12);

    return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Short bar -->
  <rect x="${startX}" y="${barsBottom - shortHeight}" width="${barWidth}" height="${shortHeight}" rx="${barRadius}" ry="${barRadius}" fill="#808080"/>
  <!-- Tall bar -->
  <rect x="${startX + barWidth + barGap}" y="${barsBottom - tallHeight}" width="${barWidth}" height="${tallHeight}" rx="${barRadius}" ry="${barRadius}" fill="#808080"/>
  <!-- Mid bar -->
  <rect x="${startX + (barWidth + barGap) * 2}" y="${barsBottom - midHeight}" width="${barWidth}" height="${midHeight}" rx="${barRadius}" ry="${barRadius}" fill="#808080"/>
  <!-- Accent dot (top right corner) -->
  <circle cx="${size - dotMargin}" cy="${dotMargin}" r="${dotSize / 2}" fill="#808080"/>
</svg>`;
}

async function generateIcons() {
    console.log('🎨 Generating GamePulse app icons...\n');

    // 1. Generate icon.png (1024x1024) - iOS main icon
    console.log('📱 Generating icon.png (1024x1024)...');
    const iconSVG = generateLogoSVG(1024, 180);
    await sharp(Buffer.from(iconSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('   ✅ icon.png created');

    // 2. Generate android-icon-foreground.png (512x512)
    console.log('\n🤖 Generating android-icon-foreground.png (512x512)...');
    const foregroundSVG = generateForegroundSVG(512);
    await sharp(Buffer.from(foregroundSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'android-icon-foreground.png'));
    console.log('   ✅ android-icon-foreground.png created');

    // 3. Generate android-icon-background.png (512x512) - gradient background
    console.log('\n🤖 Generating android-icon-background.png (512x512)...');
    const backgroundSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0A84FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5AC8FA;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" fill="url(#bgGradient)"/>
</svg>`;
    await sharp(Buffer.from(backgroundSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'android-icon-background.png'));
    console.log('   ✅ android-icon-background.png created');

    // 4. Generate android-icon-monochrome.png (512x512)
    console.log('\n🤖 Generating android-icon-monochrome.png (512x512)...');
    const monochromeSVG = generateMonochromeSVG(512);
    await sharp(Buffer.from(monochromeSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'android-icon-monochrome.png'));
    console.log('   ✅ android-icon-monochrome.png created');

    // 5. Generate splash-icon.png (200x200)
    console.log('\n💫 Generating splash-icon.png (200x200)...');
    const splashSVG = generateForegroundSVG(200);
    await sharp(Buffer.from(splashSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
    console.log('   ✅ splash-icon.png created');

    // 6. Generate favicon.png (48x48) for web
    console.log('\n🌐 Generating favicon.png (48x48)...');
    const faviconSVG = generateLogoSVG(48, 8);
    await sharp(Buffer.from(faviconSVG))
        .png()
        .toFile(path.join(ASSETS_DIR, 'favicon.png'));
    console.log('   ✅ favicon.png created');

    console.log('\n✨ All icons generated successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npx expo prebuild --clean');
    console.log('   2. Build and install the app to verify icons');
}

generateIcons().catch(err => {
    console.error('❌ Error generating icons:', err);
    process.exit(1);
});
