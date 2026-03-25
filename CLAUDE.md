# Smoker Tracker — Project Reference

## Overview

Full-stack BBQ smoker session tracker. Integrates with ESPHome temperature probes via Home Assistant and InfluxDB. Allows creating sessions, tracking temperatures across 4 probes in real time, pausing/resuming cook timers, and reviewing historical session data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router v6, Recharts, Tailwind CSS |
| Backend | Python Flask 3, Gunicorn, flask-cors |
| Database | InfluxDB v2 (time-series, external — already running on Unraid) |
| Container | Docker, nginx (frontend), gunicorn (backend) |
| CI/CD | GitHub Actions → GitHub Container Registry (ghcr.io) |

## Architecture

```
Browser → http://YOUR_SERVER_IP:3001
  └─ smoker-frontend (nginx container)
       ├─ / ─────────────────────── serves Vite static files
       └─ /api/* ─────────────────→ smoker-backend:5000 (internal Docker DNS)
                                        └─ InfluxDB at YOUR_SERVER_IP:8086 (external)
```

- **smoker-frontend**: nginx serving built React app + proxying /api/* to backend
- **smoker-backend**: Flask/gunicorn, internal only (no host port exposed)
- Both containers share the `smoker-net` Docker bridge network
- InfluxDB and Home Assistant run separately on the Unraid host

## Repository

GitHub: `swimmingnoah/SmokerTracker`
Images published to GitHub Container Registry:
- `ghcr.io/swimmingnoah/smoker-frontend`
- `ghcr.io/swimmingnoah/smoker-backend`

## Project Structure

```
Smoker React app/
├── CLAUDE.md                              # This file
├── docker-compose.yml                     # Production compose (uses ghcr.io images)
├── .env                                   # Secrets — NOT committed to git
├── .gitignore
├── deploy.sh                              # SSH pull+restart on Unraid
├── .github/
│   └── workflows/
│       └── docker-publish.yml            # CI/CD: build & push images on push/release
├── smoker-app-frontend/
│   ├── Dockerfile                         # Multi-stage: node build → nginx serve
│   ├── nginx.conf                         # SPA routing + /api proxy config
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── config.js                      # apiUrl: "/api" (relative, no hardcoded IP)
│       ├── App.jsx                        # React Router routes
│       ├── SessionList.jsx                # / — list all sessions
│       ├── SessionDetail.jsx              # /sessions/:id — detail + temp graph
│       └── CreateSession.jsx             # /sessions/new — create form
└── smoker-backend/
    ├── app.py                             # Flask API
    ├── requirements.txt
    ├── Dockerfile                         # python:3.11-slim + gunicorn
    └── docker-compose.yml                 # (retired — superseded by root compose)
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | SessionList | List all smoke sessions |
| `/sessions/new` | CreateSession | Create a new session |
| `/sessions/:id` | SessionDetail | Session detail, temp graph, pause/resume |

## API Endpoints (Flask)

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/sessions` | List all sessions (excluding hidden) |
| POST | `/sessions` | Create a new session |
| DELETE | `/sessions/:id` | Hide a session (soft delete) |
| GET | `/sessions/:id/temperatures` | Temperature data (requires `?start=&end=` ISO8601) |
| GET | `/sessions/:id/pauses` | Pause/resume event history |
| POST | `/sessions/:id/pause` | Record a pause event |
| POST | `/sessions/:id/resume` | Record a resume event |
| PUT | `/sessions/:id/notes` | Update session notes |
| GET | `/meat-types` | List available meat types |
| GET | `/hidden-sessions` | List hidden session IDs |
| DELETE | `/hidden-sessions` | Unhide all sessions |

## InfluxDB Data Model

**Bucket:** `smoker` | **Org:** `homeassistant`

### Session metadata (measurement: `text`)
Tags: `domain=input_text`, `entity_id`, `current_session_id`
Field: `state` (string)

Entity IDs used:
- `current_session_id` — the session UUID
- `smoke_session_name` — session name
- `meat_type` — meat type string
- `smoke_session_notes` — freeform notes

### Temperature readings (measurement: `°F`)
Tags: `domain=sensor`, `entity_id`
Field: `value` (float)

Sensor entity IDs:
- `esp32smoker_probe_1_temperature` — Probe 1 (meat)
- `esp32smoker_probe_2_temperature` — Probe 2 (meat)
- `esp32smoker_firepot_temperature` — Firepot
- `esp32smoker_rtd_temperature` — RTD ambient

### Pause/resume events (measurement: `session_pauses`)
Tags: `session_id`, `event_type` (`pause` or `resume`)
Field: `value = 1`

### Hidden sessions (measurement: `hidden_sessions`)
Tag: `app=smoker_tracker`
Field: `session_ids` — comma-separated list of hidden session UUIDs

## Environment Variables

All consumed by the Flask backend container. Set in root `.env` (never committed).

| Variable | Default | Description |
|----------|---------|-------------|
| `INFLUX_URL` | `http://YOUR_SERVER_IP:8086` | InfluxDB URL |
| `INFLUX_TOKEN` | *(required)* | InfluxDB auth token |
| `INFLUX_ORG` | `homeassistant` | InfluxDB organization |
| `INFLUX_BUCKET` | `smoker` | InfluxDB bucket |
| `HA_URL` | `http://YOUR_SERVER_IP:8123` | Home Assistant URL (future use) |
| `HA_TOKEN` | *(empty)* | HA long-lived token (future use) |

## CI/CD Workflow

On every push to `main` or published GitHub release:

1. GitHub Actions builds both Docker images
2. Tags them with `latest` (and semver tags on releases, e.g. `v1.2.0`)
3. Pushes to `ghcr.io/swimmingnoah/smoker-frontend` and `ghcr.io/swimmingnoah/smoker-backend`

To update the live stack on Unraid after a push:
```bash
./deploy.sh
```

To pin the Unraid stack to a specific release, edit `docker-compose.yml` on Unraid:
```yaml
image: ghcr.io/swimmingnoah/smoker-frontend:v1.2.0
```

## One-Time Unraid Setup

Run these commands once to set up the stack on Unraid:

```bash
# 1. Create appdata directory on Unraid
ssh root@YOUR_SERVER_IP 'mkdir -p /mnt/user/appdata/smoker-app'

# 2. Transfer compose file and secrets
rsync -av docker-compose.yml root@YOUR_SERVER_IP:/mnt/user/appdata/smoker-app/
rsync -av .env root@YOUR_SERVER_IP:/mnt/user/appdata/smoker-app/

# 3. If repo is private, authenticate ghcr.io on Unraid
#    (create a GitHub PAT with read:packages scope at github.com/settings/tokens)
ssh root@YOUR_SERVER_IP 'echo YOUR_GITHUB_PAT | docker login ghcr.io -u swimmingnoah --password-stdin'

# 4. Start the stack
ssh root@YOUR_SERVER_IP 'cd /mnt/user/appdata/smoker-app && docker compose up -d'
```

## Local Development

**Frontend:**
```bash
cd smoker-app-frontend
npm install
npm run dev          # http://localhost:3001
```
Note: In dev mode, `config.js` uses `/api` which will fail without a local backend.
For local dev, temporarily change `apiUrl` back to `http://YOUR_SERVER_IP:5001/api`.
(config.js is gitignored so this change won't be committed.)

**Backend:**
```bash
cd smoker-backend
pip install -r requirements.txt
cp .env.example .env   # fill in INFLUX_TOKEN
python app.py           # http://localhost:5000
```

## Pause/Resume Timer Feature

Sessions can be paused (e.g., when wrapping brisket) and resumed. The cook duration display subtracts paused time from the total elapsed time.

- Pause/resume events are stored in InfluxDB as `session_pauses` measurement points
- `SessionDetail.jsx` fetches pause history, determines current state from the last event type
- Net cook duration = (total elapsed) − (sum of all pause→resume intervals)
- If currently paused, the ongoing pause interval is also subtracted in real time
- Pause history is shown chronologically with per-pause "off smoker" durations

## Verification Checklist

After deploying:
- [ ] `http://YOUR_SERVER_IP:3001/` loads the session list
- [ ] `http://YOUR_SERVER_IP:3001/api/health` returns `{"status": "ok"}`
- [ ] Navigate to a session, copy the URL, open in a new tab — loads correctly (React Router + nginx try_files)
- [ ] Pause/resume works on an active session
- [ ] `http://YOUR_SERVER_IP:5000/` and `:5001/` are both connection refused (backend not exposed)
- [ ] GitHub Actions tab shows a successful workflow run after pushing
