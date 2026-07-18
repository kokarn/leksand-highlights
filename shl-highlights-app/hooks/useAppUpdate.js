import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
// SDK 54 split expo-file-system: the legacy API still exposes
// createDownloadResumable (needed for download progress) + cacheDirectory.
import * as FileSystem from 'expo-file-system/legacy';

/**
 * GitHub repo that publishes the APK releases.
 * The CI workflow (eas-build.yml) uploads GamePulse-<version>.apk as a
 * GitHub Release asset tagged v<version>.
 */
const GITHUB_OWNER = 'kokarn';
const GITHUB_REPO = 'leksand-highlights';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const CURRENT_VERSION = Constants.expoConfig?.version || '0.0.0';

/**
 * Update lifecycle status:
 *  - 'idle'        : nothing happening
 *  - 'checking'    : hitting the GitHub API
 *  - 'up-to-date'  : installed version >= latest release
 *  - 'available'   : a newer release exists (see updateInfo)
 *  - 'downloading' : APK download in progress (see progress 0..1)
 *  - 'ready'       : APK downloaded, installer about to be / has been launched
 *  - 'error'       : something failed (see error)
 */

/**
 * Parse a semver-ish version string ("v2.10.0" / "2.10.0") into comparable parts.
 */
const parseVersion = (raw) => {
    if (!raw) return [0, 0, 0];
    const cleaned = String(raw).trim().replace(/^v/i, '');
    const parts = cleaned.split('-')[0].split('.').map(n => parseInt(n, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

/**
 * Returns true if `latest` is a strictly newer version than `current`.
 */
const isNewer = (latest, current) => {
    const a = parseVersion(latest);
    const b = parseVersion(current);
    for (let i = 0; i < 3; i++) {
        if (a[i] > b[i]) return true;
        if (a[i] < b[i]) return false;
    }
    return false;
};

/**
 * Pick the .apk asset from a GitHub release payload.
 */
const findApkAsset = (release) => {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    return assets.find(a => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk')) || null;
};

/**
 * Hook: in-app APK self-update from GitHub Releases (Android only).
 *
 * Usage:
 *   const update = useAppUpdate();
 *   update.checkForUpdate();          // manual check
 *   update.status === 'available'     // -> show "Update to vX" button
 *   update.downloadAndInstall();      // download + hand to Android installer
 */
export function useAppUpdate() {
    const [status, setStatus] = useState('idle');
    const [updateInfo, setUpdateInfo] = useState(null); // { version, notes, apkUrl, apkSize, htmlUrl }
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    const isMounted = useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    const safeSet = useCallback((fn) => {
        if (isMounted.current) fn();
    }, []);

    /**
     * Check GitHub for the latest release. Returns the parsed updateInfo (or null).
     */
    const checkForUpdate = useCallback(async ({ silent = false } = {}) => {
        // In-app APK install is Android-only.
        if (Platform.OS !== 'android') {
            safeSet(() => setStatus('up-to-date'));
            return null;
        }

        if (!silent) safeSet(() => { setStatus('checking'); setError(null); });

        try {
            const res = await fetch(LATEST_RELEASE_URL, {
                headers: { Accept: 'application/vnd.github+json' }
            });
            if (!res.ok) {
                throw new Error(`GitHub API responded ${res.status}`);
            }
            const release = await res.json();
            const latestVersion = release?.tag_name || release?.name;
            const apkAsset = findApkAsset(release);

            if (!latestVersion || !apkAsset) {
                // No usable release/APK -> treat as up-to-date, don't alarm the user.
                safeSet(() => { setStatus('up-to-date'); setUpdateInfo(null); });
                return null;
            }

            if (isNewer(latestVersion, CURRENT_VERSION)) {
                const info = {
                    version: String(latestVersion).replace(/^v/i, ''),
                    notes: release?.body || '',
                    apkUrl: apkAsset.browser_download_url,
                    apkSize: apkAsset.size || 0,
                    htmlUrl: release?.html_url || ''
                };
                safeSet(() => { setUpdateInfo(info); setStatus('available'); });
                return info;
            }

            safeSet(() => { setStatus('up-to-date'); setUpdateInfo(null); });
            return null;
        } catch (e) {
            safeSet(() => { setStatus('error'); setError(e?.message || 'Update check failed'); });
            return null;
        }
    }, [safeSet]);

    /**
     * Download the APK (with progress) then launch Android's package installer.
     */
    const downloadAndInstall = useCallback(async () => {
        if (Platform.OS !== 'android') return;
        if (!updateInfo?.apkUrl) {
            safeSet(() => { setStatus('error'); setError('No update available to download'); });
            return;
        }

        safeSet(() => { setStatus('downloading'); setProgress(0); setError(null); });

        // Cache-bust the filename per version so we never install a stale cached APK.
        const dest = `${FileSystem.cacheDirectory}GamePulse-${updateInfo.version}.apk`;

        try {
            // Remove any partial/previous download at this path.
            try {
                const existing = await FileSystem.getInfoAsync(dest);
                if (existing.exists) {
                    await FileSystem.deleteAsync(dest, { idempotent: true });
                }
            } catch { /* non-fatal */ }

            const resumable = FileSystem.createDownloadResumable(
                updateInfo.apkUrl,
                dest,
                {},
                (p) => {
                    const total = p.totalBytesExpectedToWrite || updateInfo.apkSize || 0;
                    if (total > 0) {
                        const ratio = p.totalBytesWritten / total;
                        safeSet(() => setProgress(Math.max(0, Math.min(1, ratio))));
                    }
                }
            );

            const result = await resumable.downloadAsync();
            if (!result?.uri) {
                throw new Error('Download produced no file');
            }

            safeSet(() => { setStatus('ready'); setProgress(1); });

            // Convert file:// path to a content:// URI the installer can read,
            // then launch the system package installer via an ACTION_INSTALL_PACKAGE intent.
            const contentUri = await FileSystem.getContentUriAsync(result.uri);

            await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
                data: contentUri,
                flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                type: 'application/vnd.android.package-archive'
            });
            // After this the OS installer takes over; if the user cancels we stay 'ready'.
        } catch (e) {
            safeSet(() => { setStatus('error'); setError(e?.message || 'Download/install failed'); });
        }
    }, [updateInfo, safeSet]);

    /** Reset transient error/download state back to a sensible status. */
    const reset = useCallback(() => {
        safeSet(() => {
            setError(null);
            setProgress(0);
            setStatus(updateInfo ? 'available' : 'idle');
        });
    }, [updateInfo, safeSet]);

    return {
        currentVersion: CURRENT_VERSION,
        status,
        updateInfo,
        progress,
        error,
        isUpdateAvailable: status === 'available',
        checkForUpdate,
        downloadAndInstall,
        reset
    };
}
