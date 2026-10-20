/**
 * Builds the GitHub "new issue" URL the Settings screen opens for a bug report.
 *
 * The app never talks to the GitHub API: the report is a pre-filled issue form
 * the user reviews and submits from their own account, so there is no token to
 * ship and no public endpoint to abuse. Free of React / React Native imports so
 * it can be unit-tested directly with `node --test`.
 */

export const BUG_REPORT_REPO = 'kokarn/leksand-highlights';

/**
 * @param {object} info
 * @param {string} info.appVersion
 * @param {string} info.platform - Platform.OS
 * @param {string|number} [info.osVersion]
 * @param {string} [info.model]
 * @returns {string}
 */
export const buildBugReportUrl = ({ appVersion, platform, osVersion, model } = {}) => {
    const lines = [
        `- App version: ${appVersion || 'unknown'}`,
        `- Platform: ${platform || 'unknown'}${osVersion ? ` ${osVersion}` : ''}`
    ];
    if (model) {
        lines.push(`- Device: ${model}`);
    }

    const body = [
        '**What happened?**',
        '',
        '',
        '**What did you expect?**',
        '',
        '',
        '**Steps to reproduce**',
        '',
        '',
        '<!-- Screenshots are welcome: paste or drag them in here. -->',
        '',
        '---',
        ...lines
    ].join('\n');

    const params = new URLSearchParams({ title: '', body });
    return `https://github.com/${BUG_REPORT_REPO}/issues/new?${params.toString()}`;
};
