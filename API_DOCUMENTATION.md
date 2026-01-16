# SHL Highlights API Documentation

This document describes the available API endpoints for the SHL Highlights server.

## Base URL

```
http://localhost:3080
```

---

## Endpoints

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

This API acts as a proxy to the official SHL website APIs:
- `https://www.shl.se/api/sports-v2/game-schedule`
- `https://www.shl.se/api/sports-v2/game-info/{uuid}`
- `https://www.shl.se/api/media/videos-for-game?gameUuid={uuid}`
- `https://www.shl.se/api/gameday/play-by-play/{uuid}`
- `https://www.shl.se/api/gameday/post-game-data/team-stats/{uuid}`
