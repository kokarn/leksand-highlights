#!/usr/bin/env node
/**
 * Convert SVG logos to PNG format for Android compatibility
 * Run: node scripts/convert-logos.js
 *
 * Requires: npm install @resvg/resvg-js
 */

const fs = require('fs');
const path = require('path');

async function convertLogos() {
    let Resvg;
    try {
        Resvg = require('@resvg/resvg-js').Resvg;
    } catch (e) {
        console.error('Please install @resvg/resvg-js first:');
        console.error('  npm install @resvg/resvg-js');
        process.exit(1);
    }

    const logosDir = path.join(__dirname, '..', 'static', 'logos');
    const files = fs.readdirSync(logosDir).filter(f => f.endsWith('.svg'));

    console.log(`Converting ${files.length} SVG files to PNG...`);

    for (const file of files) {
        const svgPath = path.join(logosDir, file);
        const pngPath = path.join(logosDir, file.replace('.svg', '.png'));

        try {
            const svg = fs.readFileSync(svgPath, 'utf8');
            const resvg = new Resvg(svg, {
                fitTo: { mode: 'width', value: 200 },
                background: 'transparent'
            });
            const pngData = resvg.render();
            const pngBuffer = pngData.asPng();
            fs.writeFileSync(pngPath, pngBuffer);
            console.log(`  ✓ ${file} -> ${file.replace('.svg', '.png')}`);
        } catch (err) {
            console.error(`  ✗ ${file}: ${err.message}`);
        }
    }

    console.log('Done!');
}

convertLogos();
