const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '../assets/images');
const IOS_ICON_DIR = path.join(__dirname, '../ios/shlhighlightsapp/Images.xcassets/AppIcon.appiconset');

// Colors
const BACKGROUND_COLOR = '#E6F4FE';
const CHEVRON_COLOR = '#3B9AE8';

async function generateIcons() {
    console.log('🎨 Generating clean app icons...\n');

    // Read the clean foreground image (chevron with transparency)
    const foregroundPath = path.join(ASSETS_DIR, 'android-icon-foreground.png');

    if (!fs.existsSync(foregroundPath)) {
        console.error('❌ android-icon-foreground.png not found!');
        process.exit(1);
    }

    const foreground = await sharp(foregroundPath).toBuffer();
    const foregroundMeta = await sharp(foreground).metadata();

    console.log(`📐 Foreground size: ${foregroundMeta.width}x${foregroundMeta.height}`);

    // 1. Generate clean icon.png (1024x1024) - iOS main icon
    console.log('\n📱 Generating icon.png (1024x1024)...');
    const iconSize = 1024;

    // Resize foreground to fit the icon properly (with some padding)
    const foregroundResized = await sharp(foreground)
        .resize(Math.round(iconSize * 0.75), Math.round(iconSize * 0.75), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();

    await sharp({
        create: {
            width: iconSize,
            height: iconSize,
            channels: 4,
            background: BACKGROUND_COLOR
        }
    })
        .composite([{
            input: foregroundResized,
            gravity: 'center'
        }])
        .png()
        .toFile(path.join(ASSETS_DIR, 'icon.png'));

    console.log('   ✅ icon.png created');

    // 2. Generate clean android-icon-background.png (512x512) - solid color
    console.log('\n🤖 Generating android-icon-background.png (512x512)...');
    await sharp({
        create: {
            width: 512,
            height: 512,
            channels: 4,
            background: BACKGROUND_COLOR
        }
    })
        .png()
        .toFile(path.join(ASSETS_DIR, 'android-icon-background.png'));

    console.log('   ✅ android-icon-background.png created');

    // 3. Generate splash-icon.png (200x200 as per app.json config)
    console.log('\n💫 Generating splash-icon.png (200x200)...');
    const splashSize = 200;

    const splashForeground = await sharp(foreground)
        .resize(splashSize, splashSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();

    await sharp({
        create: {
            width: splashSize,
            height: splashSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .composite([{
            input: splashForeground,
            gravity: 'center'
        }])
        .png()
        .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));

    console.log('   ✅ splash-icon.png created');

    // 4. Copy icon.png to iOS AppIcon location
    console.log('\n🍎 Copying to iOS AppIcon...');
    if (fs.existsSync(IOS_ICON_DIR)) {
        await sharp(path.join(ASSETS_DIR, 'icon.png'))
            .toFile(path.join(IOS_ICON_DIR, 'App-Icon-1024x1024@1x.png'));
        console.log('   ✅ iOS App-Icon-1024x1024@1x.png updated');
    } else {
        console.log('   ⚠️  iOS directory not found, will be created during prebuild');
    }

    // 5. Generate favicon.png (48x48) for web
    console.log('\n🌐 Generating favicon.png (48x48)...');
    const faviconSize = 48;

    const faviconForeground = await sharp(foreground)
        .resize(Math.round(faviconSize * 0.8), Math.round(faviconSize * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();

    await sharp({
        create: {
            width: faviconSize,
            height: faviconSize,
            channels: 4,
            background: BACKGROUND_COLOR
        }
    })
        .composite([{
            input: faviconForeground,
            gravity: 'center'
        }])
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
