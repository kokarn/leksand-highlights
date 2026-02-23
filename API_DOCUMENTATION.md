# GamePulse API Documentation

This document describes the available API endpoints for the GamePulse server, supporting SHL (Swedish Hockey League), Allsvenskan football, Svenska Cupen football, and Biathlon sports data.

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
  { "id": "svenska-cupen", "name": "Svenska Cupen", "icon": "trophy" },
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
  "availableSeasons": ["2024-25"],
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

Returns comprehensive game details for a specific Allsvenskan match, including metadata, events, team statistics, and lineups.

**Parameters:**
- `id` (path): The match identifier.

**Response:**
```json
{
  "info": {
    "uuid": "401842658",
    "startDateTime": "2026-04-05T18:00Z",
    "state": "post-game",
    "homeTeamInfo": {
      "code": "AIK",
      "uuid": "994",
      "names": { "short": "AIK", "long": "AIK" },
      "score": 2,
      "icon": "https://a.espncdn.com/i/teamlogos/soccer/500/994.png"
    },
    "awayTeamInfo": {
      "code": "HBK",
      "uuid": "3017",
      "names": { "short": "Halmstads BK", "long": "Halmstads BK" },
      "score": 1,
      "icon": "https://a.espncdn.com/i/teamlogos/soccer/500/3017.png"
    },
    "venueInfo": { "name": "Friends Arena" },
    "statusText": "FT",
    "sport": "allsvenskan",
    "source": "espn"
  },
  "venue": {
    "fullName": "Friends Arena",
    "address": { "city": "Solna", "country": "Sweden" },
    "capacity": 50000
  },
  "teamStats": {
    "homeTeam": {
      "name": "AIK",
      "code": "AIK",
      "statistics": {
        "possessionPct": "58",
        "shotsonGoal": "6",
        "totalShots": "14",
        "saves": "3",
        "fouls": "12",
        "yellowCards": "2",
        "redCards": "0",
        "offsides": "3",
        "corners": "7"
      }
    },
    "awayTeam": {
      "name": "Halmstads BK",
      "code": "HBK",
      "statistics": {
        "possessionPct": "42",
        "shotsonGoal": "4",
        "totalShots": "9",
        "saves": "4",
        "fouls": "14",
        "yellowCards": "3",
        "redCards": "0",
        "offsides": "1",
        "corners": "4"
      }
    }
  },
  "events": {
    "goals": [
      {
        "id": "12345",
        "type": "goal",
        "clock": "23'",
        "period": 1,
        "periodDisplay": "1st half",
        "text": "Goal! AIK 1, Halmstads BK 0. John Guidetti scores.",
        "teamCode": "AIK",
        "teamName": "AIK",
        "isHome": true,
        "scorer": {
          "id": "789",
          "name": "John Guidetti",
          "firstName": "John",
          "lastName": "Guidetti",
          "jersey": "11",
          "position": "F"
        },
        "assist": {
          "id": "456",
          "name": "Sebastian Larsson",
          "jersey": "7"
        },
        "goalType": "Goal",
        "score": { "home": 1, "away": 0 }
      }
    ],
    "cards": [
      {
        "id": "23456",
        "type": "card",
        "cardType": "yellow",
        "clock": "34'",
        "period": 1,
        "periodDisplay": "1st half",
        "text": "Yellow Card - Player Name",
        "teamCode": "HBK",
        "teamName": "Halmstads BK",
        "isHome": false,
        "player": {
          "id": "321",
          "name": "Player Name",
          "jersey": "5"
        },
        "reason": "Yellow Card"
      }
    ],
    "substitutions": [
      {
        "id": "34567",
        "type": "substitution",
        "clock": "65'",
        "period": 2,
        "periodDisplay": "2nd half",
        "teamCode": "AIK",
        "isHome": true,
        "playerIn": { "id": "111", "name": "Sub Player", "jersey": "22" },
        "playerOut": { "id": "222", "name": "Starter Player", "jersey": "10" }
      }
    ],
    "all": [ /* All events sorted by time */ ]
  },
  "rosters": [
    {
      "teamId": "994",
      "teamName": "AIK",
      "teamCode": "AIK",
      "homeAway": "home",
      "players": [
        {
          "id": "789",
          "name": "John Guidetti",
          "firstName": "John",
          "lastName": "Guidetti",
          "jersey": "11",
          "position": "F",
          "starter": true
        }
      ]
    }
  ],
  "commentary": [
    {
      "id": "45678",
      "clock": "90'+3",
      "period": 2,
      "text": "Full Time - AIK 2, Halmstads BK 1",
      "type": "Full Time",
      "scoringPlay": false,
      "homeScore": 2,
      "awayScore": 1
    }
  ],
  "format": "soccer"
}
```

**Note:** Fields like `events`, `rosters`, and `commentary` may be `null` for pre-game matches or when data is unavailable from the source.

---

### `GET /api/football/standings`

Returns the current Allsvenskan league standings.

**Query Parameters:**
- `team` (optional): Filter by team code or name (e.g., `AIK`)
- `top` (optional): Limit to top N teams
- `season` (optional): Season year (e.g., `2026`)

**Response:**
```json
{
  "season": "2026",
  "availableSeasons": ["2026", "2025", "2024"],
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

### `GET /api/svenska-cupen/games`

Returns a list of Svenska Cupen matches for the selected or current season.

**Query Parameters:**
- `season` (optional): Season label (e.g., `2025/2026`)
- `team` (optional): Filter by team code, id, or name
- `state` (optional): Filter by match state (`pre-game`, `live`, `post-game`)
- `upcoming` (optional): Set to `true` to only show upcoming matches
- `limit` (optional): Max number of matches to return

**Response:**
```json
[
  {
    "uuid": "5071549",
    "startDateTime": "2026-02-23T18:00:00.000Z",
    "state": "live",
    "homeTeamInfo": {
      "code": "GAIS",
      "uuid": "8297",
      "names": { "short": "GAIS", "long": "GAIS" },
      "score": 1,
      "icon": "https://images.fotmob.com/image_resources/logo/teamlogo/8297.png"
    },
    "awayTeamInfo": {
      "code": "Landskrona BoIS",
      "uuid": "8511",
      "names": { "short": "Landskrona BoIS", "long": "Landskrona BoIS" },
      "score": 0,
      "icon": "https://images.fotmob.com/image_resources/logo/teamlogo/8511.png"
    },
    "venueInfo": { "name": null },
    "statusText": "22'",
    "round": 1,
    "sport": "svenska-cupen",
    "source": "fotmob"
  }
]
```

---

### `GET /api/svenska-cupen/game/:id/details`

Returns match details for a specific Svenska Cupen game, including incidents (goals/cards/substitutions) when available.

**Parameters:**
- `id` (path): The match identifier.

**Response (shape):**
```json
{
  "info": {
    "uuid": "5071549",
    "startDateTime": "2026-02-23T18:00:00.000Z",
    "state": "live",
    "homeTeamInfo": { "code": "GAIS", "score": 1 },
    "awayTeamInfo": { "code": "Landskrona BoIS", "score": 0 },
    "venueInfo": { "name": null },
    "statusText": "22'",
    "sport": "svenska-cupen",
    "source": "fotmob"
  },
  "teamStats": null,
  "events": {
    "goals": [],
    "cards": [],
    "substitutions": [],
    "all": []
  },
  "rosters": [],
  "commentary": null
}
```

---

### `GET /api/svenska-cupen/standings`

Returns Svenska Cupen group standings for the selected season.

**Query Parameters:**
- `season` (optional): Season label (e.g., `2025/2026`)
- `group` (optional): Filter by group id or group name

**Response:**
```json
{
  "season": "2025/2026",
  "league": "Svenska Cupen",
  "lastUpdated": "2026-02-23T18:25:00.000Z",
  "groups": [
    {
      "id": "913503",
      "name": "Cup Grp. 1",
      "standings": [
        {
          "position": 1,
          "teamCode": "Mjällby",
          "teamName": "Mjällby",
          "teamUuid": "8127",
          "gamesPlayed": 1,
          "wins": 1,
          "draws": 0,
          "losses": 0,
          "points": 3
        }
      ]
    }
  ],
  "source": "fotmob",
  "availableSeasons": ["2025/2026", "2024/2025"]
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

Additional fields are included when data is sourced from IBU (race IDs, status metadata, and format details), such as:
- `ibuRaceId`
- `scheduleStatus`, `resultStatus`, `statusText`
- `hasLiveData`
- `startMode`, `shootings`, `spareRounds`, `legs`, `shootingPositions`
- `source`

---

### `GET /api/biathlon/race/:id`

Returns detailed data for a specific biathlon race, including IBU competition metadata, results, and start lists when available.

**Parameters:**
- `id` (path): The race identifier (IBU RaceId or internal UUID)

**Response:**
```json
{
  "info": {
    "uuid": "BT2526SWRLCP01SWRL",
    "eventId": "BT2526SWRLCP01",
    "eventName": "World Cup 1 - Oestersund",
    "eventType": "world-cup",
    "discipline": "Relay",
    "gender": "women",
    "genderDisplay": "Women",
    "startDateTime": "2025-11-29T12:15:00Z",
    "location": "Swedish National Biathlon Arena",
    "country": "SWE",
    "countryName": "Sweden",
    "state": "completed",
    "source": "ibu"
  },
  "competition": {
    "RaceId": "BT2526SWRLCP01SWRL",
    "StatusText": "Final",
    "ScheduleStatus": "FINISHED",
    "ResultStatus": "OFFICIAL",
    "StartTime": "2025-11-29T12:15:00Z"
  },
  "event": {
    "EventId": "BT2526SWRLCP01",
    "ShortDescription": "Oestersund",
    "Nat": "SWE",
    "NatLong": "Sweden"
  },
  "results": [ /* IBU result rows */ ],
  "startList": null,
  "resultMeta": { "isResult": true, "isStartList": false },
  "source": "ibu",
  "lastUpdated": "2026-01-18 12:30:04"
}
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

### `GET /api/notifications/status`

Returns the push notification and goal watcher status.

**Response:**
```json
{
  "timestamp": "2026-01-17 11:17:27",
  "pushNotifications": {
    "configured": true,
    "notificationsSent": 12,
    "errors": 0,
    "lastSent": "2026-01-17 11:15:04"
  },
  "goalWatcher": {
    "running": true,
    "lastCheck": "2026-01-17 11:17:12",
    "gamesChecked": 1,
    "totalGoalsDetected": 2,
    "totalNotificationsSent": 2,
    "trackedGames": 1
  }
}
```

---

### `POST /api/notifications/test`

Sends a test push notification.

**Request Body (optional fields):**
```json
{
  "message": "Custom test message",
  "token": "fcm-device-token"
}
```

- If a token is provided, it will send directly to that device.
- If no token is provided, it sends to the `goal_notifications` topic.

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "timestamp": "2026-01-17 11:17:31",
  "result": {
    "success": true,
    "messageId": "projects/xxx/messages/xxx"
  }
}
```

---

### `POST /api/notifications/goal-test`

Sends a simulated goal notification without waiting for a live game.

**Request Body:**
```json
{
  "sport": "shl",
  "scoringTeamCode": "LIF",
  "opposingTeamCode": "FHC",
  "scoringIsHome": true,
  "scorerName": "Test Scorer",
  "homeScore": 1,
  "awayScore": 0,
  "period": "P1",
  "time": "12:34",
  "sendOpposing": true,
  "token": "fcm-device-token"
}
```

- If a token is provided, it sends directly to that device.
- If no token is provided, it uses FCM topic targeting based on team subscriptions.
- `sendOpposing` controls whether an opposing-team notification is also sent.

**Response:**
```json
{
  "success": true,
  "message": "Goal notification sent",
  "timestamp": "2026-01-17 11:17:31",
  "result": {
    "success": true,
    "recipients": 1,
    "id": "notification-id"
  },
  "goal": {
    "sport": "shl",
    "scoringTeamCode": "LIF",
    "opposingTeamCode": "FHC",
    "homeTeamCode": "LIF",
    "awayTeamCode": "FHC",
    "homeScore": 1,
    "awayScore": 0,
    "scorerName": "Test Scorer",
    "time": "12:34",
    "period": "P1"
  }
}
```

---

### `POST /api/goal-watcher/check`

Manually triggers a goal watcher check and sends notifications for any newly detected goals.

**Response:**
```json
{
  "message": "Goal check completed",
  "timestamp": "2026-01-17 11:17:31",
  "gamesChecked": 1,
  "newGoals": [],
  "notificationsSent": 0
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

### Svenska Cupen (Football Cup)
Svenska Cupen data is sourced from FotMob:
- `https://www.fotmob.com/api/leagues?id=171` - Fixtures, live status, and group tables
- `https://www.fotmob.com/matches/...` - Match page payload (`__NEXT_DATA__`) for incidents and lineups

### Biathlon
Biathlon race schedule and results are maintained using the official IBU APIs for the 2025-26 season, including:
- World Cup events (9 stops)
- Winter Olympics 2026
- `https://www.biathlonresults.com/modules/sportapi/api/Events?SeasonId={season}` - Event calendar
- `https://www.biathlonresults.com/modules/sportapi/api/Competitions?EventId={id}` - Race schedule
- `https://www.biathlonresults.com/modules/sportapi/api/Results?RaceId={id}` - Race results/start lists
- `https://www.biathlonresults.com/modules/sportapi/api/StartList?RaceId={id}` - Start lists fallback

## Background Services

### Scheduler
The server runs a background scheduler that:
- **Biathlon Refresh**: Updates the biathlon race schedule every hour
- Validates schedule data for consistency

### Notifier
Monitors for new video content and sends notifications via ntfy.sh:
- Normal mode: Checks every 5 minutes
- Live mode: Checks every 30 seconds during live games
