# GamePulse API Documentation

This document describes the available API endpoints for the GamePulse server, supporting SHL (Swedish Hockey League), Allsvenskan football, and Biathlon sports data.

## Base URL

```
http://localhost:3080
```

---

## Endpoints

### `GET /api/sports`

Returns a list of available sports supported by the API.

**Response:**
```json
[
  { "id": "shl", "name": "SHL", "icon": "hockey-puck" },
  { "id": "allsvenskan", "name": "Allsvenskan", "icon": "soccer-ball" },
  { "id": "biathlon", "name": "Biathlon", "icon": "target" }
]
```

---

### `GET /api/games`

Returns a list of all games in the current SHL season, sorted by date (newest first).

**Response:**
```json
[
  {
    "uuid": "bdhvuc5tex",
    "startDateTime": "2025-09-13 15:15:00",
    "state": "post-game",
    "homeTeamInfo": {
      "code": "FHC",
      "names": { "short": "Frölunda", "long": "Frölunda HC" },
      "score": 2,
      "icon": "https://sportality.cdn.s8y.se/team-logos/fhc1_fhc.svg"
    },
    "awayTeamInfo": {
      "code": "LHC",
      "names": { "short": "Linköping", "long": "Linköping HC" },
      "score": 1,
      "icon": "https://sportality.cdn.s8y.se/team-logos/lhc1_lhc.svg"
    },
    "venueInfo": { "name": "Scandinavium" }
  }
]
```

---

### `GET /api/game/:uuid/videos`

Returns a list of video clips associated with a specific game.

**Parameters:**
- `uuid` (path): The unique identifier of the game.

**Response:**
```json
[
  {
    "id": "video-id-123",
    "title": "Highlights: Frölunda vs Linköping",
    "renderedMedia": {
      "videourl": "https://staylive.tv/...",
      "url": "https://..."
    },
    "tags": ["custom.highlights"],
    "thumbnail": "https://..."
  }
]
```

---

### `GET /api/video/:id`

Returns enriched video details with HLS streaming URLs for native playback.

**Parameters:**
- `id` (path): The StayLive video ID (extracted from `mediaString` field like "video|staylive|488394").

**Response:**
```json
{
  "id": 488394,
  "name": "Highlights: Frölunda vs Linköping",
  "description": "Game highlights",
  "duration": 180,
  "createdAt": "2025-09-13T18:30:00.000Z",
  "streams": {
    "hls": "https://staylive-vod.akamaized.net/.../playlist.m3u8?token=...",
    "embed": "https://embed.staylive.tv/video/488394"
  },
  "images": {
    "thumbnail": "https://...",
    "gif": "https://...",
    "storyboard": "https://..."
  },
  "channel": {
    "id": "channel-id",
    "name": "SHL",
    "path": "shl",
    "image": "https://..."
  },
  "categories": [],
  "tags": [],
  "isLocked": false,
  "isFree": true,
  "geoRestricted": false
}
```

---

### `GET /api/game/:uuid/details`

Returns comprehensive game details including metadata, play-by-play events, and team statistics.

**Parameters:**
- `uuid` (path): The unique identifier of the game.

**Response:**
```json
{
  "info": {
    "gameInfo": {
      "gameUuid": "bdhvuc5tex",
      "startDateTime": "2025-09-13T13:15:00.000Z",
      "arenaName": "Scandinavium",
      "state": "post_game"
    },
    "homeTeam": {
      "names": { "short": "Frölunda", "long": "Frölunda HC" },
      "uuid": "087a-087aTQv9u",
      "score": 2,
      "icon": "https://sportality.cdn.s8y.se/team-logos/fhc1_fhc.svg"
    },
    "awayTeam": {
      "names": { "short": "Linköping", "long": "Linköping HC" },
      "uuid": "41c4-41c4BiYZU",
      "score": 1,
      "icon": "https://sportality.cdn.s8y.se/team-logos/lhc1_lhc.svg"
    },
    "ssgtUuid": "iuzqg7dqk9"
  },
  "teamStats": {
    "homeTeam": { "name": "Frölunda HC" },
    "awayTeam": { "name": "Linköping HC" },
    "stats": [
      {
        "homeTeam": { "left": { "type": "G", "value": 2 }, "right": { "type": "SOG", "value": 31 } },
        "awayTeam": { "left": { "type": "G", "value": 1 }, "right": { "type": "SOG", "value": 29 } }
      }
    ]
  },
  "events": {
    "goals": [
      {
        "type": "goal",
        "period": 1,
        "time": "04:33",
        "eventTeam": { "teamCode": "FHC" },
        "player": { "firstName": "Jacob", "familyName": "Peterson", "jerseyToday": "40" },
        "assists": {
          "first": { "firstName": "Max", "familyName": "Friberg" },
          "second": { "firstName": "Jere", "familyName": "Innala" }
        },
        "goalStatus": "EQ"
      }
    ],
    "penalties": [
      {
        "type": "penalty",
        "period": 1,
        "time": "01:42",
        "eventTeam": { "teamCode": "LHC" },
        "player": { "firstName": "Erik", "familyName": "Norén" },
        "offence": "BOARD",
        "variant": { "description": "2 min" }
      }
    ],
    "periods": [
      { "period": 1, "started": true, "finished": true },
      { "period": 2, "started": true, "finished": true },
      { "period": 3, "started": true, "finished": true }
    ],
    "all": [ /* All raw events */ ]
  }
}
```

---

### `GET /api/standings`

Returns the current SHL league standings, calculated from completed games.

**Query Parameters:**
- `team` (optional): Filter by team code (e.g., `LIF`, `FHC`)
- `top` (optional): Limit to top N teams

**Response:**
```json
{
  "season": "2024-25",
  "series": "SHL",
  "lastUpdated": "2026-01-17T10:17:15.163Z",
  "gamesAnalyzed": 251,
  "standings": [
    {
      "position": 1,
      "teamCode": "FHC",
      "teamName": "Frölunda HC",
      "teamShortName": "Frölunda",
      "teamUuid": "087a-087aTQv9u",
      "teamIcon": "https://sportality.cdn.s8y.se/team-logos/fhc1_fhc.svg",
      "gamesPlayed": 35,
      "wins": 28,
      "losses": 6,
      "overtimeWins": 1,
      "overtimeLosses": 0,
      "points": 86,
      "goalsFor": 115,
      "goalsAgainst": 56,
      "goalDiff": 59
    }
  ]
}
```

---

### `GET /api/football/games`

Returns a list of Allsvenskan matches for the current season.

**Query Parameters:**
- `team` (optional): Filter by team code, id, or name (e.g., `AIK`)
- `state` (optional): Filter by match state (`pre-game`, `live`, `post-game`)
- `upcoming` (optional): Set to `true` to only show upcoming matches
- `limit` (optional): Max number of matches to return

**Response:**
```json
[
  {
    "uuid": "401842658",
    "startDateTime": "2026-04-05T18:00Z",
    "state": "pre-game",
    "homeTeamInfo": {
      "code": "AIK",
      "names": { "short": "AIK", "long": "AIK" },
      "score": null,
      "icon": "https://a.espncdn.com/i/teamlogos/soccer/500/994.png"
    },
    "awayTeamInfo": {
      "code": "HBK",
      "names": { "short": "Halmstads BK", "long": "Halmstads BK" },
      "score": null,
      "icon": "https://a.espncdn.com/i/teamlogos/soccer/500/3017.png"
    },
    "venueInfo": { "name": "Friends Arena" },
    "statusText": "18:00",
    "sport": "allsvenskan",
    "source": "espn"
  }
]
```

---

### `GET /api/football/game/:id/details`

Returns summary details for a specific Allsvenskan match.

**Parameters:**
- `id` (path): The match identifier.

**Response:**
```json
{
  "info": {
    "uuid": "401842658",
    "startDateTime": "2026-04-05T18:00Z",
    "state": "pre-game",
    "homeTeamInfo": { "code": "AIK", "names": { "short": "AIK", "long": "AIK" } },
    "awayTeamInfo": { "code": "HBK", "names": { "short": "Halmstads BK", "long": "Halmstads BK" } },
    "venueInfo": { "name": "Friends Arena" },
    "statusText": "18:00",
    "sport": "allsvenskan",
    "source": "espn"
  },
  "venue": { "fullName": "Friends Arena" },
  "boxscore": { "teams": [ /* team stats */ ] },
  "format": "soccer"
}
```

---

### `GET /api/football/standings`

Returns the current Allsvenskan league standings.

**Query Parameters:**
- `team` (optional): Filter by team code or name (e.g., `AIK`)
- `top` (optional): Limit to top N teams

**Response:**
```json
{
  "season": "2026",
  "league": "Allsvenskan",
  "lastUpdated": "2026-01-17T10:17:15.163Z",
  "standings": [
    {
      "position": 1,
      "teamCode": "AIK",
      "teamName": "AIK",
      "teamShortName": "AIK",
      "teamUuid": "994",
      "teamIcon": "https://a.espncdn.com/i/teamlogos/soccer/500/994.png",
      "gamesPlayed": 0,
      "wins": 0,
      "draws": 0,
      "losses": 0,
      "points": 0,
      "goalsFor": 0,
      "goalsAgainst": 0,
      "goalDiff": 0,
      "note": null
    }
  ],
  "source": "espn"
}
```

---

### `GET /api/biathlon/races`

Returns all biathlon races for the current season.

**Query Parameters:**
- `upcoming` (optional): Set to `true` to only show upcoming races
- `limit` (optional): Max number of races to return
- `country` (optional): Filter by host country code (e.g., `NOR`, `SWE`)
- `discipline` (optional): Filter by discipline (sprint, pursuit, etc.)
- `gender` (optional): Filter by gender (men, women, mixed)

**Response:**
```json
[
  {
    "uuid": "wc-2026-oberhof-sprint-women",
    "eventId": "wc-2026-oberhof",
    "eventName": "World Cup 4 - Oberhof",
    "eventType": "world-cup",
    "discipline": "Sprint",
    "gender": "women",
    "genderDisplay": "Women",
    "startDateTime": "2026-01-08T14:20:00",
    "date": "2026-01-08",
    "time": "14:20",
    "location": "Oberhof",
    "country": "GER",
    "countryName": "Germany",
    "state": "upcoming",
    "sport": "biathlon"
  }
]
```

---

### `POST /api/biathlon/refresh`

Manually triggers a refresh of the biathlon schedule and validates the data.

**Response:**
```json
{
  "message": "Biathlon schedule refreshed",
  "timestamp": "2026-01-17 11:17:31",
  "racesCount": 67,
  "validation": {
    "valid": true,
    "issues": [],
    "totalRaces": 67
  }
}
```

---

### `GET /api/scheduler/status`

Returns the status of background scheduler tasks.

**Response:**
```json
{
  "timestamp": "2026-01-17 11:17:27",
  "scheduler": {
    "running": true,
    "biathlon": {
      "lastCheck": "2026-01-17 11:17:11",
      "checkCount": 1,
      "checkInterval": "60 minutes",
      "cacheLastUpdate": "2026-01-17T10:17:11.280Z"
    },
    "recentErrors": []
  }
}
```

---

### `GET /api/status`

Returns server status including cache info, scheduler status, and notifier stats.

**Response:**
```json
{
  "server": {
    "uptime": 16.815835917,
    "timestamp": "2026-01-17 11:17:27"
  },
  "providers": {
    "shl": "SHL",
    "allsvenskan": "Allsvenskan",
    "biathlon": "Biathlon"
  },
  "availableSports": ["shl", "allsvenskan", "biathlon"],
  "notifier": { ... },
  "scheduler": { ... },
  "cache": {
    "games": { "cached": true, "ageSeconds": 45, ... },
    "standings": { "cached": true, "ageSeconds": 13, "cacheDuration": "5m" },
    "biathlon": { "cached": true, "ageSeconds": 17, "cacheDuration": "30m" }
  },
  "refreshRates": {
    "gamesNormal": "60 seconds",
    "gamesLive": "15 seconds",
    "standings": "5 minutes",
    "biathlon": "30 minutes",
    "biathlonScheduler": "1 hour"
  }
}
```

---

## Event Types

The `events.all` array contains various event types:

| Type         | Description                                      |
| ------------ | ------------------------------------------------ |
| `goal`       | A goal was scored                                |
| `penalty`    | A penalty was called                             |
| `shot`       | A shot on goal (includes `locationX`, `locationY`) |
| `timeout`    | A team timeout was called                        |
| `goalkeeper` | Goalkeeper entered or left the ice               |
| `period`     | Period start/end marker                          |

---

## Error Handling

All endpoints return a `500` status code with a JSON object on failure:

```json
{
  "error": "Error message describing the issue"
}
```

---

## Data Sources

### SHL (Hockey)
This API acts as a proxy to the official SHL website APIs:
- `https://www.shl.se/api/sports-v2/game-schedule` - Game schedule
- `https://www.shl.se/api/sports-v2/game-info/{uuid}` - Game info
- `https://www.shl.se/api/media/videos-for-game?gameUuid={uuid}` - Game videos
- `https://www.shl.se/api/gameday/play-by-play/{uuid}` - Play-by-play events
- `https://www.shl.se/api/gameday/post-game-data/team-stats/{uuid}` - Team stats

**Note:** Standings are calculated from completed game data since the SHL API doesn't provide a public standings endpoint.

### Allsvenskan (Football)
Allsvenskan data is sourced from ESPN public site APIs:
- `https://site.api.espn.com/apis/site/v2/sports/soccer/swe.1/scoreboard` - Fixtures and scores
- `https://site.api.espn.com/apis/site/v2/sports/soccer/swe.1/summary?event={id}` - Match summaries
- `https://site.web.api.espn.com/apis/v2/sports/soccer/swe.1/standings` - League standings

### Biathlon
Biathlon race schedule is maintained using the official IBU World Cup calendar for the 2025-26 season, including:
- World Cup events (9 stops)
- Winter Olympics 2026

## Background Services

### Scheduler
The server runs a background scheduler that:
- **Biathlon Refresh**: Updates the biathlon race schedule every hour
- Validates schedule data for consistency

### Notifier
Monitors for new video content and sends notifications via ntfy.sh:
- Normal mode: Checks every 5 minutes
- Live mode: Checks every 30 seconds during live games
