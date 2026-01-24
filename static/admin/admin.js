// GamePulse Admin Console JavaScript

// ============ DOM Elements ============
const elements = {
    sidebar: document.getElementById('sidebar'),
    pageTitle: document.getElementById('page-title'),
    toastContainer: document.getElementById('toast-container'),
    statusGrid: document.getElementById('status-grid'),
    cacheStatusGrid: document.getElementById('cache-status-grid'),
    sportsGrid: document.getElementById('sports-grid'),
    pushStatusGrid: document.getElementById('push-status-grid'),
    gamesList: document.getElementById('games-list'),
    activityList: document.getElementById('activity-list'),
    notificationsChart: document.getElementById('notifications-chart'),
    cacheChart: document.getElementById('cache-chart'),
    mobileMenuButton: document.getElementById('mobile-menu-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay')
};

// ============ State ============
let teams = [];
let footballTeams = [];
let sports = [];
let venueTouched = false;
let activityLog = [];
let charts = {};

// ============ Utilities ============
function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const SWEDISH_TIMESTAMP_OPTIONS = {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
};

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) {
        return '-';
    }
    const total = Math.floor(Number(seconds));
    if (Number.isNaN(total)) {
        return '-';
    }
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatDurationLong(seconds) {
    if (seconds === null || seconds === undefined) {
        return '-';
    }
    const total = Math.floor(Number(seconds));
    if (Number.isNaN(total)) {
        return '-';
    }
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const parts = [];
    if (days > 0) {
        parts.push(`${days} days`);
    }
    if (hours > 0) {
        parts.push(`${hours} hours`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} minutes`);
    }
    if (secs > 0 && days === 0 && hours === 0) {
        parts.push(`${secs} seconds`);
    }
    return parts.join(', ') || '0 seconds';
}

function formatAgeSeconds(seconds) {
    if (seconds === null || seconds === undefined) {
        return '-';
    }
    const total = Math.floor(Number(seconds));
    if (Number.isNaN(total)) {
        return '-';
    }
    if (total < 60) {
        return `${total}s ago`;
    }
    return formatDuration(total) + ' ago';
}

function formatTimestamp(value) {
    if (!value) {
        return '-';
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return value;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString('sv-SE', SWEDISH_TIMESTAMP_OPTIONS);
}

function toLocalDateTimeValue(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

// ============ Toast Notifications ============
function showToast(type, title, message) {
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ'}</span>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ============ Navigation ============
function navigateToSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const section = document.getElementById(`section-${sectionId}`);
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);

    if (section) {
        section.classList.remove('hidden');
    }
    if (navItem) {
        navItem.classList.add('active');
    }

    const titles = {
        dashboard: 'Dashboard',
        activity: 'Activity Log',
        status: 'System Status',
        cache: 'Cache Management',
        sports: 'Sports Providers',
        push: 'Push Notifications',
        subscribers: 'FCM Subscribers',
        topics: 'FCM Topics',
        'goal-test': 'Goal Testing',
        'create-game': 'Create Game',
        games: 'Manual Games'
    };
    elements.pageTitle.textContent = titles[sectionId] || 'Dashboard';
}

function toggleSection(section) {
    section.classList.toggle('collapsed');
}

function setSidebarOpen(isOpen) {
    if (!elements.sidebar) {
        return;
    }
    if (isOpen) {
        elements.sidebar.classList.add('open');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.add('visible');
        }
        return;
    }
    elements.sidebar.classList.remove('open');
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.remove('visible');
    }
}

function toggleSidebar() {
    if (!elements.sidebar) {
        return;
    }
    setSidebarOpen(!elements.sidebar.classList.contains('open'));
}

function closeSidebarOnMobile() {
    if (window.matchMedia('(max-width: 1024px)').matches) {
        setSidebarOpen(false);
    }
}

// ============ API Requests ============
async function apiRequest(path, options = {}) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Request failed');
    }
    return payload;
}

// ============ Activity Log ============
function addActivity(type, title, timestamp) {
    activityLog.unshift({ type, title, timestamp: timestamp || new Date().toISOString() });
    if (activityLog.length > 50) {
        activityLog.pop();
    }
    renderActivityLog();
}

function renderActivityLog() {
    const icons = {
        goal: '⚽', cache: '💾', error: '❌', info: 'ℹ️',
        notification: '🔔', refresh: '🔄', game: '🎮'
    };

    if (activityLog.length === 0) {
        elements.activityList.innerHTML = '<p class="text-muted">No recent activity</p>';
        return;
    }

    elements.activityList.innerHTML = activityLog.slice(0, 20).map(item => `
        <div class="activity-item">
            <div class="activity-icon ${item.type}">${icons[item.type] || 'ℹ️'}</div>
            <div class="activity-content">
                <div class="activity-title">${escapeHtml(item.title)}</div>
                <div class="activity-time">${formatTimestamp(item.timestamp)}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('activity-count').textContent = `${activityLog.length} events`;
}

// ============ Charts ============
function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(75, 85, 99, 0.2)' }, ticks: { color: '#9ca3af' } },
            y: { grid: { color: 'rgba(75, 85, 99, 0.2)' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
        }
    };

    const labels = Array.from({ length: 24 }, (_, i) => `${23 - i}h`).reverse();

    charts.notifications = new Chart(elements.notificationsChart, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Sent', data: Array(24).fill(0), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 },
                { label: 'Goals', data: Array(24).fill(0), borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.3 }
            ]
        },
        options: chartOptions
    });

    charts.cache = new Chart(elements.cacheChart, {
        type: 'doughnut',
        data: {
            labels: ['Hits', 'Misses'],
            datasets: [{
                data: [85, 15],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
}

// ============ Status Cards ============
function buildStatusCard(title, rows, badge = null) {
    const badgeHtml = badge
        ? `<span class="status-card-badge ${badge.type}">${escapeHtml(badge.text)}</span>`
        : '';
    const dl = rows.map(row => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`).join('');
    return `
        <div class="status-card">
            <div class="status-card-header">
                <h3 class="status-card-title">${escapeHtml(title)}</h3>
                ${badgeHtml}
            </div>
            <dl>${dl}</dl>
        </div>
    `;
}

// ============ Load Status ============
async function loadStatus(options = {}) {
    try {
        const status = await apiRequest('/api/status');

        // Update metrics
        document.getElementById('metric-uptime').textContent = formatDuration(status.server?.uptime);
        document.getElementById('metric-uptime-sub').textContent = formatDurationLong(status.server?.uptime);
        document.getElementById('metric-goals').textContent = status.goalWatcher?.totalGoalsDetected ?? 0;
        document.getElementById('metric-notifications').textContent = status.goalWatcher?.totalNotificationsSent ?? 0;
        document.getElementById('metric-live-games').textContent = status.goalWatcher?.trackedGames ?? 0;

        const cacheItems = [
            { name: 'Hockey Games', active: status.cache?.games?.cached },
            { name: 'Football Games', active: status.cache?.allsvenskan?.games?.cached },
            { name: 'Biathlon Races', active: status.cache?.biathlon?.cached },
            { name: 'Hockey Standings', active: status.cache?.standings?.cached },
            { name: 'Football Standings', active: status.cache?.allsvenskan?.standings?.cached }
        ];
        const activeCaches = cacheItems.filter(c => c.active).length;
        document.getElementById('metric-cache').textContent = `${activeCaches}/${cacheItems.length}`;

        const cacheStatusList = document.getElementById('cache-status-list');
        cacheStatusList.innerHTML = cacheItems.map(cache => `
            <div class="cache-status-item">
                <span class="cache-status-dot ${cache.active ? 'active' : 'inactive'}"></span>
                <span>${cache.name}</span>
            </div>
        `).join('');

        // Server status indicator
        const dot = document.getElementById('server-status-dot');
        const text = document.getElementById('server-status-text');
        dot.className = 'status-dot';
        text.textContent = 'Online';

        // Build status cards
        const serverRows = [
            { label: 'Uptime', value: formatDuration(status.server?.uptime) },
            { label: 'Timestamp', value: formatTimestamp(status.server?.timestamp) }
        ];
        const notifierRows = [
            { label: 'Running', value: status.notifier?.running ? 'Yes' : 'No' },
            { label: 'Last check', value: formatTimestamp(status.notifier?.lastCheck) },
            { label: 'Games checked', value: status.notifier?.gamesChecked ?? '-' },
            { label: 'Notifications', value: status.notifier?.totalNotificationsSent ?? '-' }
        ];
        const schedulerRows = [
            { label: 'Running', value: status.scheduler?.running ? 'Yes' : 'No' },
            { label: 'Biathlon checks', value: status.scheduler?.biathlon?.checkCount ?? '-' },
            { label: 'Recent errors', value: status.scheduler?.recentErrors?.length ?? 0 }
        ];
        const goalWatcherRows = [
            { label: 'Running', value: status.goalWatcher?.running ? 'Yes' : 'No' },
            { label: 'Last check', value: formatTimestamp(status.goalWatcher?.lastCheck) },
            { label: 'Tracked games', value: status.goalWatcher?.trackedGames ?? 0 }
        ];

        elements.statusGrid.innerHTML = [
            buildStatusCard('Server', serverRows, { type: 'online', text: 'Running' }),
            buildStatusCard('Notifier', notifierRows, { type: status.notifier?.running ? 'online' : 'offline', text: status.notifier?.running ? 'Active' : 'Stopped' }),
            buildStatusCard('Scheduler', schedulerRows, { type: status.scheduler?.running ? 'online' : 'offline', text: status.scheduler?.running ? 'Active' : 'Stopped' }),
            buildStatusCard('Goal Watcher', goalWatcherRows, { type: status.goalWatcher?.running ? 'online' : 'offline', text: status.goalWatcher?.running ? 'Active' : 'Stopped' })
        ].join('');

        // Cache status - Games
        const hockeyGamesRows = [
            { label: 'Cached', value: status.cache?.games?.cached ? 'Yes' : 'No' },
            { label: 'Age', value: formatAgeSeconds(status.cache?.games?.ageSeconds) },
            { label: 'Live mode', value: status.cache?.games?.hasLiveGame ? 'Yes (15s)' : 'No (60s)' }
        ];
        const footballGamesRows = [
            { label: 'Cached', value: status.cache?.allsvenskan?.games?.cached ? 'Yes' : 'No' },
            { label: 'Age', value: formatAgeSeconds(status.cache?.allsvenskan?.games?.ageSeconds) },
            { label: 'Live mode', value: status.cache?.allsvenskan?.games?.hasLiveGame ? 'Yes (15s)' : 'No (60s)' }
        ];
        const biathlonRacesRows = [
            { label: 'Cached', value: status.cache?.biathlon?.cached ? 'Yes' : 'No' },
            { label: 'Age', value: formatAgeSeconds(status.cache?.biathlon?.ageSeconds) },
            { label: 'TTL', value: status.cache?.biathlon?.cacheDuration ?? '30m' }
        ];
        const standingsRows = [
            { label: 'Hockey', value: status.cache?.standings?.cached ? 'Yes' : 'No' },
            { label: 'Football', value: status.cache?.allsvenskan?.standings?.cached ? 'Yes' : 'No' },
            { label: 'TTL', value: '5 minutes' }
        ];
        const mediaCacheRows = [
            { label: 'Game details', value: status.cache?.details?.entriesCount ?? 0 },
            { label: 'Videos', value: status.cache?.videos?.entriesCount ?? 0 },
            { label: 'Football details', value: status.cache?.allsvenskan?.details?.entriesCount ?? 0 }
        ];

        elements.cacheStatusGrid.innerHTML = [
            buildStatusCard('Hockey Games', hockeyGamesRows, { type: status.cache?.games?.cached ? 'online' : 'offline', text: status.cache?.games?.cached ? 'Cached' : 'Empty' }),
            buildStatusCard('Football Games', footballGamesRows, { type: status.cache?.allsvenskan?.games?.cached ? 'online' : 'offline', text: status.cache?.allsvenskan?.games?.cached ? 'Cached' : 'Empty' }),
            buildStatusCard('Biathlon Races', biathlonRacesRows, { type: status.cache?.biathlon?.cached ? 'online' : 'offline', text: status.cache?.biathlon?.cached ? 'Cached' : 'Empty' }),
            buildStatusCard('Standings', standingsRows),
            buildStatusCard('Media & Details', mediaCacheRows)
        ].join('');

        refreshIcons();

        if (options.showMessage) {
            showToast('success', 'Status Updated', 'All system status refreshed');
            addActivity('refresh', 'Status refreshed');
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// ============ Load Push Status ============
async function loadPushStatus(options = {}) {
    try {
        const status = await apiRequest('/api/notifications/status');
        const pushRows = [
            { label: 'Configured', value: status.pushNotifications?.configured ? 'Yes' : 'No' },
            { label: 'Notifications sent', value: status.pushNotifications?.notificationsSent ?? 0 },
            { label: 'Errors', value: status.pushNotifications?.errors ?? 0 },
            { label: 'Last sent', value: formatTimestamp(status.pushNotifications?.lastSent) }
        ];
        const goalWatcherRows = [
            { label: 'Running', value: status.goalWatcher?.running ? 'Yes' : 'No' },
            { label: 'Last check', value: formatTimestamp(status.goalWatcher?.lastCheck) },
            { label: 'Goals detected', value: status.goalWatcher?.totalGoalsDetected ?? 0 },
            { label: 'Notifications', value: status.goalWatcher?.totalNotificationsSent ?? 0 }
        ];

        elements.pushStatusGrid.innerHTML = [
            buildStatusCard('Firebase Cloud Messaging', pushRows, { type: status.pushNotifications?.configured ? 'online' : 'offline', text: status.pushNotifications?.configured ? 'Configured' : 'Not configured' }),
            buildStatusCard('Goal Watcher', goalWatcherRows, { type: status.goalWatcher?.running ? 'online' : 'offline', text: status.goalWatcher?.running ? 'Active' : 'Stopped' })
        ].join('');

        refreshIcons();

        if (options.showMessage) {
            showToast('success', 'Status Updated', 'Push notification status refreshed');
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// ============ Load FCM Subscribers ============
async function loadSubscribers(options = {}) {
    try {
        const data = await apiRequest('/api/fcm/subscribers');

        document.getElementById('subscribers-count').textContent = `${data.totalSubscribers} subscribers`;

        // Stats cards
        const statsGrid = document.getElementById('subscribers-stats-grid');
        const statsRows = [
            { label: 'Total subscribers', value: data.totalSubscribers },
            { label: 'Total topic subscriptions', value: data.totalTopicSubscriptions },
            { label: 'Average topics/user', value: data.totalSubscribers > 0 ? (data.totalTopicSubscriptions / data.totalSubscribers).toFixed(1) : '0' },
            { label: 'Last updated', value: formatTimestamp(data.lastUpdated) }
        ];
        statsGrid.innerHTML = buildStatusCard('Subscriber Statistics', statsRows, { type: 'online', text: 'Live' });

        // Subscribers table
        const tbody = document.getElementById('subscribers-table-body');
        if (!data.subscribers || data.subscribers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No subscribers registered yet</td></tr>';
        } else {
            tbody.innerHTML = data.subscribers.map(sub => {
                const platformClass = (sub.platform || 'unknown').toLowerCase();
                const topicBadges = (sub.topics || []).slice(0, 5).map(topic => {
                    const isTeam = topic.startsWith('team_');
                    const badgeClass = isTeam ? 'team' : 'notification';
                    return `<span class="topic-badge ${badgeClass}">${escapeHtml(topic)}</span>`;
                }).join('');
                const moreTopics = sub.topics.length > 5 ? `<span class="topic-badge">+${sub.topics.length - 5} more</span>` : '';

                return `
                    <tr>
                        <td class="token-cell">${escapeHtml(sub.tokenPreview)}</td>
                        <td><span class="platform-badge ${platformClass}">${escapeHtml(sub.platform)}</span></td>
                        <td><div class="topics-badge-list">${topicBadges}${moreTopics}</div></td>
                        <td>${formatTimestamp(sub.registeredAt)}</td>
                        <td>${formatTimestamp(sub.lastSeen)}</td>
                    </tr>
                `;
            }).join('');
        }

        refreshIcons();

        if (options.showMessage) {
            showToast('success', 'Subscribers Updated', `Loaded ${data.totalSubscribers} subscribers`);
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// ============ Load FCM Topics ============
async function loadTopics(options = {}) {
    try {
        const data = await apiRequest('/api/fcm/topics');

        document.getElementById('topics-count').textContent = `${data.topics?.length || 0} topics`;

        const topicsGrid = document.getElementById('topics-grid');

        if (!data.topics || data.topics.length === 0) {
            topicsGrid.innerHTML = '<p class="text-muted">No topics with subscribers yet</p>';
        } else {
            topicsGrid.innerHTML = data.topics.map(topic => {
                const isTeam = topic.topic.startsWith('team_');
                const cardClass = isTeam ? 'team' : 'notification';
                return `
                    <div class="topic-card ${cardClass}">
                        <div class="topic-card-header">
                            <span class="topic-card-name">${escapeHtml(topic.topic)}</span>
                        </div>
                        <div class="topic-card-count">${topic.subscriberCount}</div>
                        <div class="topic-card-label">subscribers</div>
                    </div>
                `;
            }).join('');
        }

        refreshIcons();

        if (options.showMessage) {
            showToast('success', 'Topics Updated', `Loaded ${data.topics?.length || 0} topics`);
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// ============ Load Sports ============
async function loadSports(options = {}) {
    try {
        const data = await apiRequest('/api/sports');
        sports = Array.isArray(data) ? data : [];

        elements.sportsGrid.innerHTML = sports.map(sport => {
            const rows = [
                { label: 'ID', value: sport?.id || '-' },
                { label: 'Icon', value: sport?.icon || '-' }
            ];
            return buildStatusCard(sport?.name || 'Unknown', rows, { type: 'online', text: sport?.id?.toUpperCase() || 'SPORT' });
        }).join('');

        refreshIcons();

        if (options.showMessage) {
            showToast('success', 'Sports Updated', `Loaded ${sports.length} sport(s)`);
        }
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

// ============ Load Teams ============
async function loadTeams() {
    const data = await apiRequest('/api/teams');
    teams = (data || []).sort((a, b) => a.code.localeCompare(b.code));
    populateTeamSelect(document.getElementById('home-team'));
    populateTeamSelect(document.getElementById('away-team'));
    document.getElementById('away-team').selectedIndex = 1;
    updateVenueFromHomeTeam();
    updateGoalTestTeamDropdowns();
}

async function loadFootballTeams() {
    try {
        const games = await apiRequest('/api/football/games?limit=100');
        const teamMap = new Map();
        (games || []).forEach(game => {
            [game.homeTeamInfo, game.awayTeamInfo].forEach(info => {
                if (info) {
                    const code = info.code || info.uuid;
                    if (code && !teamMap.has(code)) {
                        teamMap.set(code, { code, name: info.names?.long || info.names?.short || code });
                    }
                }
            });
        });
        footballTeams = Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        footballTeams = [];
    }
}

function populateTeamSelect(select) {
    select.innerHTML = teams.map(team =>
        `<option value="${escapeHtml(team.code)}">${escapeHtml(team.names.long || team.names.short || team.code)}</option>`
    ).join('');
}

function updateVenueFromHomeTeam() {
    if (venueTouched) {
        return;
    }
    const venueInput = document.getElementById('venue');
    const homeTeamSelect = document.getElementById('home-team');
    const selected = teams.find(team => team.code === homeTeamSelect.value);
    venueInput.value = selected?.arena || '';
}

function updateGoalTestTeamDropdowns() {
    const sport = document.getElementById('goal-test-sport').value;
    const teamList = sport === 'allsvenskan' ? footballTeams : teams;
    const scoringSelect = document.getElementById('goal-test-scoring-team');
    const opposingSelect = document.getElementById('goal-test-opposing-team');

    const buildOptions = (list) => {
        if (sport === 'allsvenskan') {
            return list.map(team => `<option value="${escapeHtml(team.code)}">${escapeHtml(team.name)}</option>`).join('');
        } else {
            return list.map(team => `<option value="${escapeHtml(team.code)}">${escapeHtml(team.names?.long || team.names?.short || team.code)}</option>`).join('');
        }
    };

    scoringSelect.innerHTML = buildOptions(teamList);
    opposingSelect.innerHTML = buildOptions(teamList);
    if (teamList.length > 1) {
        opposingSelect.selectedIndex = 1;
    }

    document.getElementById('goal-test-period').placeholder = sport === 'allsvenskan' ? '1st half' : 'P1';
    document.getElementById('goal-test-time').placeholder = sport === 'allsvenskan' ? '54:21' : '12:34';
}

// ============ Load Games ============
async function loadGames() {
    try {
        const data = await apiRequest('/api/admin/games');
        renderGames(data.games || []);
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

function renderGames(records) {
    document.getElementById('games-badge').textContent = `${records.length} games`;

    if (!records.length) {
        elements.gamesList.innerHTML = '<p class="text-muted">No manual games yet. Create one to get started.</p>';
        return;
    }

    elements.gamesList.innerHTML = records.map(record => {
        const game = record.game;
        const stateOptions = ['live', 'pre-game', 'post-game'].map(state => {
            const label = state === 'pre-game' ? 'Pre-game' : state === 'post-game' ? 'Post-game' : 'Live';
            return `<option value="${state}" ${record.state === state ? 'selected' : ''}>${label}</option>`;
        }).join('');

        return `
            <div class="game-card" data-id="${record.id}">
                <div class="game-header">
                    <div>
                        <div class="game-title">${escapeHtml(game.homeTeamInfo.names.short)} vs ${escapeHtml(game.awayTeamInfo.names.short)}</div>
                        <div class="game-meta">${escapeHtml(record.id)}</div>
                    </div>
                    <div class="form-group">
                        <select data-field="state" class="form-control">${stateOptions}</select>
                    </div>
                </div>
                <div class="game-grid">
                    <div class="form-group">
                        <label>Start time</label>
                        <input type="datetime-local" class="form-control" data-field="startDateTime" value="${toLocalDateTimeValue(record.startDateTime)}" />
                    </div>
                    <div class="form-group">
                        <label>Venue</label>
                        <input type="text" class="form-control" data-field="venue" value="${escapeHtml(record.venue)}" />
                    </div>
                    <div class="form-group">
                        <label>Home score</label>
                        <input type="number" min="0" class="form-control" data-field="homeScore" value="${record.homeScore}" />
                    </div>
                    <div class="form-group">
                        <label>Away score</label>
                        <input type="number" min="0" class="form-control" data-field="awayScore" value="${record.awayScore}" />
                    </div>
                </div>
                <div class="form-check mt-1">
                    <input type="checkbox" id="notify-${record.id}" data-field="sendNotification" />
                    <label for="notify-${record.id}">Send goal notification on score change</label>
                </div>
                <div class="game-actions mt-1">
                    <button class="btn btn-primary btn-sm" data-action="save"><i data-lucide="save" class="icon-btn"></i> Save</button>
                    <button class="btn btn-secondary btn-sm" data-action="save-notify"><i data-lucide="bell" class="icon-btn"></i> Save & Notify</button>
                    <button class="btn btn-danger btn-sm" data-action="delete"><i data-lucide="trash-2" class="icon-btn"></i> Delete</button>
                </div>
                <p class="text-muted text-sm mt-1">Updated ${escapeHtml(formatTimestamp(record.updatedAt))}</p>
            </div>
        `;
    }).join('');

    refreshIcons();

    // Attach event listeners
    elements.gamesList.querySelectorAll('.game-card').forEach(card => {
        const id = card.dataset.id;

        // Helper function to save game with optional notification
        const saveGame = async (sendNotification = false) => {
            const payload = {
                state: card.querySelector('[data-field="state"]').value,
                startDateTime: card.querySelector('[data-field="startDateTime"]').value,
                venue: card.querySelector('[data-field="venue"]').value,
                homeScore: card.querySelector('[data-field="homeScore"]').value,
                awayScore: card.querySelector('[data-field="awayScore"]').value,
                sendNotification
            };
            try {
                const result = await apiRequest(`/api/admin/games/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                await loadGames();

                if (sendNotification && result.notificationSent) {
                    showToast('success', 'Game Updated', 'Changes saved and goal notification sent');
                    addActivity('notification', `Goal notification sent for game ${id}`);
                } else if (sendNotification) {
                    showToast('warning', 'Game Updated', 'Changes saved but notification not sent (no score change detected)');
                } else {
                    showToast('success', 'Game Updated', 'Changes saved successfully');
                }
                addActivity('game', 'Game updated');
            } catch (error) {
                showToast('error', 'Error', error.message);
            }
        };

        // Save without notification
        card.querySelector('[data-action="save"]').addEventListener('click', () => {
            const sendNotify = card.querySelector('[data-field="sendNotification"]').checked;
            saveGame(sendNotify);
        });

        // Save with notification (button that always sends notification)
        card.querySelector('[data-action="save-notify"]').addEventListener('click', () => {
            saveGame(true);
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            if (!confirm('Delete this manual game?')) {
                return;
            }
            try {
                await apiRequest(`/api/admin/games/${id}`, { method: 'DELETE' });
                await loadGames();
                showToast('success', 'Game Deleted', 'Manual game removed');
                addActivity('game', 'Game deleted');
            } catch (error) {
                showToast('error', 'Error', error.message);
            }
        });
    });
}

// ============ Target Input Helpers ============
const TARGET_PLACEHOLDERS = {
    topic: 'No token needed (uses topic)',
    topics: 'No token needed (uses topics)',
    token: 'FCM device token'
};

function updateTargetInput(select, input) {
    const type = select.value;
    input.placeholder = TARGET_PLACEHOLDERS[type] || 'FCM device token';
    const shouldDisable = type === 'topic' || type === 'topics';
    input.disabled = shouldDisable;
    if (shouldDisable) {
        input.value = '';
    }
}

function buildTargetPayload(type, id) {
    if (type === 'topic' || type === 'topics') {
        return {};
    }
    const trimmed = id.trim();
    if (!trimmed) {
        return {};
    }
    if (type === 'token') {
        return { token: trimmed };
    }
    return {};
}

function parseNumericInput(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
}

// ============ Event Handlers ============
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateToSection(item.dataset.section);
            closeSidebarOnMobile();
        });
    });

    if (elements.mobileMenuButton) {
        elements.mobileMenuButton.addEventListener('click', toggleSidebar);
    }

    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', () => setSidebarOpen(false));
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            setSidebarOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setSidebarOpen(false);
        }
    });

    // Refresh all
    document.getElementById('refresh-all').addEventListener('click', async () => {
        await Promise.all([loadStatus({ showMessage: true }), loadPushStatus(), loadSports(), loadGames()]);
    });

    // Quick actions
    document.getElementById('quick-clear-cache').addEventListener('click', clearCache);
    document.getElementById('quick-run-notifier').addEventListener('click', runNotifierCheck);
    document.getElementById('quick-goal-check').addEventListener('click', runGoalCheck);
    document.getElementById('quick-biathlon-refresh').addEventListener('click', refreshBiathlon);

    // Status section
    document.getElementById('refresh-status').addEventListener('click', () => loadStatus({ showMessage: true }));

    // Cache section
    document.getElementById('clear-cache').addEventListener('click', clearCache);
    document.getElementById('refresh-cache-status').addEventListener('click', () => loadStatus({ showMessage: true }));

    // Sports section
    document.getElementById('refresh-sports').addEventListener('click', () => loadSports({ showMessage: true }));

    // Push section
    document.getElementById('refresh-push-status').addEventListener('click', () => loadPushStatus({ showMessage: true }));
    document.getElementById('run-goal-watcher').addEventListener('click', runGoalCheck);
    document.getElementById('send-test-push').addEventListener('click', sendTestPush);

    // Goal test
    document.getElementById('goal-test-sport').addEventListener('change', updateGoalTestTeamDropdowns);
    document.getElementById('send-goal-test').addEventListener('click', sendGoalTest);

    // Target type selects
    const testPushTargetType = document.getElementById('test-push-target-type');
    const testPushTargetId = document.getElementById('test-push-target-id');
    const goalTestTargetType = document.getElementById('goal-test-target-type');
    const goalTestTargetId = document.getElementById('goal-test-target-id');

    updateTargetInput(testPushTargetType, testPushTargetId);
    updateTargetInput(goalTestTargetType, goalTestTargetId);

    testPushTargetType.addEventListener('change', () => updateTargetInput(testPushTargetType, testPushTargetId));
    goalTestTargetType.addEventListener('change', () => {
        updateTargetInput(goalTestTargetType, goalTestTargetId);
        document.getElementById('goal-test-send-opposing').checked = goalTestTargetType.value === 'topics';
    });

    // FCM Subscribers section
    document.getElementById('refresh-subscribers').addEventListener('click', () => loadSubscribers({ showMessage: true }));

    // FCM Topics section
    document.getElementById('refresh-topics').addEventListener('click', () => loadTopics({ showMessage: true }));

    // Create game form
    document.getElementById('venue').addEventListener('input', () => { venueTouched = true; });
    document.getElementById('home-team').addEventListener('change', updateVenueFromHomeTeam);
    document.getElementById('create-game-form').addEventListener('submit', createGame);
}

async function clearCache() {
    try {
        await apiRequest('/api/cache/clear', { method: 'POST' });
        showToast('success', 'Caches Cleared', 'All caches have been cleared');
        addActivity('cache', 'All caches cleared');
        await loadStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

async function runNotifierCheck() {
    try {
        const result = await apiRequest('/api/notifier/check', { method: 'POST' });
        showToast('success', 'Notifier Check', `Checked ${result.gamesChecked || 0} games`);
        addActivity('refresh', `Notifier checked ${result.gamesChecked || 0} games`);
        await loadStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

async function runGoalCheck() {
    try {
        const result = await apiRequest('/api/goal-watcher/check', { method: 'POST' });
        const msg = result.newGoals?.length ? `Found ${result.newGoals.length} new goals` : 'No new goals';
        showToast('success', 'Goal Check', msg);
        addActivity('goal', msg);
        await loadPushStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

async function refreshBiathlon() {
    try {
        const result = await apiRequest('/api/biathlon/refresh', { method: 'POST' });
        showToast('success', 'Biathlon Refreshed', `Loaded ${result.racesCount || 0} races`);
        addActivity('refresh', `Biathlon schedule refreshed (${result.racesCount || 0} races)`);
        await loadStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    }
}

async function sendTestPush() {
    const btn = document.getElementById('send-test-push');
    btn.disabled = true;
    try {
        const message = document.getElementById('test-push-message').value.trim() || undefined;
        const targetType = document.getElementById('test-push-target-type').value;
        const targetId = document.getElementById('test-push-target-id').value.trim();

        const payload = {};
        if (message) {
            payload.message = message;
        }
        if (targetType === 'token' && targetId) {
            payload.token = targetId;
        }

        const result = await apiRequest('/api/notifications/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast(result.success ? 'success' : 'error', 'Test Notification', result.success ? 'Notification sent!' : 'Failed to send');
        addActivity('notification', 'Test notification sent');
        await loadPushStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        btn.disabled = false;
    }
}

async function sendGoalTest() {
    const btn = document.getElementById('send-goal-test');
    btn.disabled = true;
    try {
        const scoringTeamCode = document.getElementById('goal-test-scoring-team').value;
        const opposingTeamCode = document.getElementById('goal-test-opposing-team').value;

        if (!scoringTeamCode || !opposingTeamCode) {
            throw new Error('Please select both teams.');
        }
        if (scoringTeamCode === opposingTeamCode) {
            throw new Error('Teams must be different.');
        }

        const targetType = document.getElementById('goal-test-target-type').value;
        const targetId = document.getElementById('goal-test-target-id').value.trim();

        const body = {
            sport: document.getElementById('goal-test-sport').value,
            scoringTeamCode,
            opposingTeamCode,
            scoringIsHome: document.getElementById('goal-test-scoring-home').checked,
            homeScore: parseNumericInput(document.getElementById('goal-test-home-score').value),
            awayScore: parseNumericInput(document.getElementById('goal-test-away-score').value),
            period: document.getElementById('goal-test-period').value.trim() || undefined,
            time: document.getElementById('goal-test-time').value.trim() || undefined,
            scorerName: document.getElementById('goal-test-scorer-name').value.trim() || undefined,
            sendOpposing: document.getElementById('goal-test-send-opposing').checked
        };

        if (targetType === 'token' && targetId) {
            body.token = targetId;
        }

        const result = await apiRequest('/api/notifications/goal-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        showToast(result.success ? 'success' : 'error', 'Goal Test', result.success ? 'Goal notification sent!' : 'Failed to send');
        addActivity('goal', `Goal test: ${scoringTeamCode} scored`);
        await loadPushStatus();
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        btn.disabled = false;
    }
}

async function createGame(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const payload = {
        homeTeamCode: document.getElementById('home-team').value,
        awayTeamCode: document.getElementById('away-team').value,
        state: document.getElementById('game-state').value,
        startDateTime: document.getElementById('start-time').value,
        venue: document.getElementById('venue').value,
        homeScore: document.getElementById('home-score').value,
        awayScore: document.getElementById('away-score').value
    };

    if (payload.homeTeamCode === payload.awayTeamCode) {
        showToast('error', 'Error', 'Home and away teams must differ');
        btn.disabled = false;
        return;
    }

    try {
        await apiRequest('/api/admin/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast('success', 'Game Created', 'Manual game created successfully');
        addActivity('game', `Game created: ${payload.homeTeamCode} vs ${payload.awayTeamCode}`);

        // Reset form
        document.getElementById('home-score').value = 0;
        document.getElementById('away-score').value = 0;
        document.getElementById('game-state').value = 'live';
        document.getElementById('start-time').value = toLocalDateTimeValue(new Date());
        venueTouched = false;
        updateVenueFromHomeTeam();

        await loadGames();
    } catch (error) {
        showToast('error', 'Error', error.message);
    } finally {
        btn.disabled = false;
    }
}

// ============ Initialize ============
function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function init() {
    document.getElementById('start-time').value = toLocalDateTimeValue(new Date());

    // Initialize Lucide icons
    refreshIcons();

    setupEventListeners();
    initCharts();

    await Promise.all([
        loadTeams(),
        loadFootballTeams()
    ]);

    updateGoalTestTeamDropdowns();

    await Promise.all([
        loadStatus(),
        loadPushStatus(),
        loadSports(),
        loadGames(),
        loadSubscribers(),
        loadTopics()
    ]);

    addActivity('info', 'Admin console loaded');
    renderActivityLog();

    // Refresh icons after dynamic content is loaded
    refreshIcons();

    // Auto-refresh
    setInterval(() => loadStatus(), 15000);
    setInterval(() => loadPushStatus(), 15000);
    setInterval(() => loadSubscribers(), 30000);
    setInterval(() => loadTopics(), 30000);
}

// Start the application
init();
