const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'app', 'index.js'),
    'utf8'
);
const modalSource = fs.readFileSync(
    path.join(__dirname, '..', 'shl-highlights-app', 'components', 'modals', 'FootballMatchModal.js'),
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
        modalSource,
        /activeTab: controlledActiveTab[\s\S]*onTabChange[\s\S]*const activeTab = controlledActiveTab \?\? internalActiveTab/
    );
});
