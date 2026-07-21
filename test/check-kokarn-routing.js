#!/usr/bin/env node
/**
 * Regression guard: fail if the client app renders a remote image without
 * routing it through the Kokarn API (resolveMediaUrl / getTeamLogoUrl).
 *
 * The app must not hand a raw third-party CDN URL (ESPN / FotMob / TheSportsDB /
 * StayLive / FotbollPlay) straight to <Image source={{ uri }}>. Every such URL
 * has to go through resolveMediaUrl() so the bytes are proxied by /api/img.
 *
 * How it works: scan every JS/TS file under shl-highlights-app/components for
 *   source={{ uri: <expr> }}
 * and flag any <expr> that references a known team-icon / thumbnail field
 * (team.icon, teamIcon, renderedMedia, thumbnail, .logo) WITHOUT also mentioning
 * resolveMediaUrl or getTeamLogoUrl on the same line/expression.
 *
 * Exit non-zero on any violation so it can gate CI.
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'shl-highlights-app', 'components');

// Fields that carry raw upstream image URLs from the API payload.
// Case-insensitive so `homeTeam.icon` / `awayTeam.logo` (capital T) are caught too.
const RAW_IMAGE_HINT = /(\.icon\b|teamIcon\b|renderedMedia\b|\.thumbnail\b|\.logo\b|logos?\[)/i;
// A raw third-party URL literal handed straight to <Image> without proxying.
const RAW_URL_LITERAL = /https?:\/\//i;
// The sanctioned proxying helpers.
const SAFE_HELPER = /(resolveMediaUrl|getTeamLogoUrl)/;
// Image source uri expression, captured up to the closing brace.
// Tolerates one level of `${...}` interpolation inside the expression.
const IMAGE_URI = /source=\{\{\s*uri:\s*((?:[^{}]|\$\{[^}]*\})+?)\s*\}\}/g;

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

const violations = [];

for (const file of walk(APP_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = IMAGE_URI.exec(src)) !== null) {
        const expr = m[1];
        const hasRawField = RAW_IMAGE_HINT.test(expr);
        const hasRawUrl = RAW_URL_LITERAL.test(expr);
        if ((hasRawField || hasRawUrl) && !SAFE_HELPER.test(expr)) {
            const line = src.slice(0, m.index).split('\n').length;
            violations.push(`${path.relative(process.cwd(), file)}:${line}  ${m[0].trim()}`);
        }
    }
}

if (violations.length > 0) {
    console.error('❌ Kokarn API routing guard failed. These <Image> sources use a raw');
    console.error('   upstream URL instead of resolveMediaUrl()/getTeamLogoUrl():\n');
    for (const v of violations) {
        console.error(`   ${v}`);
    }
    console.error('\n   Wrap the URL: source={{ uri: resolveMediaUrl(<url>) }}');
    process.exit(1);
}

console.log('✅ Kokarn API routing guard passed: all client image sources are proxied.');
