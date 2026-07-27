const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildGameDeepLink } = require('../modules/fcm-notifications').__test;

const appSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'app', 'index.js'),
    'utf8'
);
const footballModalSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'components', 'modals', 'FootballMatchModal.js'),
    'utf8'
);
const hockeyModalSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'components', 'modals', 'ShlGameModal.js'),
    'utf8'
);

test('Allsvenskan deep links pass the requested notification tab into the football modal', () => {
    assert.match(
        appSource,
        /normalizedSport === 'allsvenskan'[\s\S]*setFootballActiveTab\(normalizedTab\)[\s\S]*football\.handleGamePress/
    );
    assert.match(
        appSource,
        /<FootballMatchModal[\s\S]*?match=\{football\.selectedGame\}[\s\S]*?activeTab=\{footballActiveTab\}[\s\S]*?onTabChange=\{setFootballActiveTab\}/
    );
    assert.match(
        footballModalSource,
        /activeTab: controlledActiveTab[\s\S]*onTabChange[\s\S]*const activeTab = controlledActiveTab \?\? internalActiveTab/
    );
});

test('highlight notification deep link includes encoded videoId', () => {
    assert.equal(
        buildGameDeepLink('allsvenskan', 'game/42', 'highlights', { videoId: 'clip & 7' }),
        'gamepulse://game/allsvenskan/game%2F42?tab=highlights&videoId=clip+%26+7'
    );

    assert.match(appSource, /videoId: safeDecode\(String\(normalizeRouteParam\(data\.videoId\)/);
    assert.match(appSource, /videoId: videoIdParam/);
    assert.match(appSource, /targetVideoId=\{[a-zA-Z]+TargetVideoId\}/);
});

test('hockey and football modals auto-play a requested clip after videos load', () => {
    assert.match(hockeyModalSource, /targetVideoId[\s\S]*videos\.find\(video => String\(video\.id\) === String\(targetVideoId\)\)[\s\S]*playVideo\(targetVideo\)/);
    assert.match(footballModalSource, /targetVideoId[\s\S]*videos\.find\(video => String\(video\.id\) === String\(targetVideoId\)\)[\s\S]*playVideo\(targetVideo\)/);
});
