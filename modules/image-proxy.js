/**
 * Kokarn API image proxy.
 *
 * The client app must not fetch third-party CDNs directly (ESPN, FotMob,
 * TheSportsDB, StayLive/FotbollPlay thumbnails, etc.). Instead the app rewrites
 * every remote image URL to `/api/img?url=<encoded>` and this module fetches the
 * bytes server-side and streams them back. That keeps all outbound requests
 * behind the Kokarn API.
 *
 * Security: the target URL is validated against a strict host allowlist (SSRF
 * protection) and only http/https + image content is proxied.
 */

const { URL } = require('url');

// Hosts (and their subdomains) we are willing to proxy team logos / video
// thumbnails from. Anything else is rejected with 400.
const ALLOWED_HOST_SUFFIXES = [
    // ESPN team logos (Allsvenskan / Europa & Conference qual)
    'espncdn.com',
    'espn.com',
    // FotMob team logos (Svenska Cupen)
    'fotmob.com',
    // TheSportsDB fallback badges
    'thesportsdb.com',
    // StayLive video thumbnails (SHL)
    'staylive.tv',
    // FotbollPlay video thumbnails (football)
    'fotbollplay.se',
    // SHL landing/logo CDN (used by some feeds)
    's8y.se',
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB hard cap
const FETCH_TIMEOUT_MS = 8000;
// Cache proxied images at the edge/browser for a day — logos rarely change.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';

/**
 * Returns true if the hostname is (or is a subdomain of) an allowlisted host.
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedHost(hostname) {
    if (!hostname) {
        return false;
    }
    const host = hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => {
        return host === suffix || host.endsWith(`.${suffix}`);
    });
}

/**
 * Validate + parse a candidate image URL. Returns the parsed URL or null.
 * @param {string} raw
 * @returns {URL|null}
 */
function parseAllowedUrl(raw) {
    if (typeof raw !== 'string' || !raw) {
        return null;
    }
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }
    if (!isAllowedHost(parsed.hostname)) {
        return null;
    }
    return parsed;
}

/**
 * Express handler: GET /api/img?url=<encoded remote image url>
 */
async function handleImageProxy(req, res) {
    const target = parseAllowedUrl(req.query.url);
    if (!target) {
        return res.status(400).json({ error: 'Invalid or disallowed image url' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const upstream = await fetch(target.toString(), {
            signal: controller.signal,
            headers: {
                // Some CDNs 403 without a UA / referer.
                'User-Agent': 'GamePulse/1.0 (+https://sports-api.kokarn.com)',
                Accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8',
            },
            redirect: 'follow',
        });

        if (!upstream.ok) {
            return res.status(upstream.status === 404 ? 404 : 502).json({
                error: `Upstream image responded ${upstream.status}`,
            });
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            return res.status(415).json({ error: 'Upstream is not an image' });
        }

        const contentLength = Number(upstream.headers.get('content-length') || 0);
        if (contentLength && contentLength > MAX_IMAGE_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());
        if (buffer.length > MAX_IMAGE_BYTES) {
            return res.status(413).json({ error: 'Image too large' });
        }

        res.set('Content-Type', contentType);
        res.set('Cache-Control', CACHE_CONTROL);
        res.set('Content-Length', String(buffer.length));
        return res.send(buffer);
    } catch (error) {
        const aborted = error?.name === 'AbortError';
        console.error(`[image-proxy] failed for ${target.toString()}:`, error?.message || error);
        return res.status(aborted ? 504 : 502).json({ error: 'Failed to fetch image' });
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    handleImageProxy,
    isAllowedHost,
    parseAllowedUrl,
    ALLOWED_HOST_SUFFIXES,
    MAX_IMAGE_BYTES,
};
