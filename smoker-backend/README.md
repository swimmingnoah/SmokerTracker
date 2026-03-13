# Smoker Tracker Flask Backend

Backend API for the Smoker Tracker React app.

## Features

- ✅ Fetch all smoke sessions from InfluxDB
- ✅ Get temperature data for sessions
- ✅ Delete sessions (actually deletes from InfluxDB!)
- ✅ Track deleted sessions in Home Assistant
- ✅ CORS enabled for React app
- ✅ Secure - tokens not exposed to browser

## API Endpoints

### `GET /api/health`
Health check

### `GET /api/sessions`
Get all smoke sessions

### `GET /api/sessions/<session_id>/temperatures?start=<time>&end=<time>`
Get temperature data for a session

### `DELETE /api/sessions/<session_id>`
Delete a session (body: `{"start": "...", "end": "..."}`)

### `GET /api/deleted-sessions`
Get list of deleted session IDs

## Setup

### Option 1: Docker Compose (Easiest)

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your tokens:**
   ```env
   INFLUX_TOKEN=your_actual_influxdb_token
   HA_TOKEN=your_actual_home_assistant_token
   ```

3. **Run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Check it's running:**
   ```bash
   curl http://localhost:5000/api/health
   ```

### Option 2: Docker Build

```bash
# Build the image
docker build -t smoker-backend .

# Run the container
docker run -d \
  --name smoker-backend \
  -p 5000:5000 \
  -e INFLUX_URL=http://YOUR_SERVER_IP:8086 \
  -e INFLUX_TOKEN=your_token \
  -e INFLUX_ORG=homeassistant \
  -e INFLUX_BUCKET=smoker \
  -e HA_URL=http://YOUR_SERVER_IP:8123 \
  -e HA_TOKEN=your_ha_token \
  smoker-backend
```

### Option 3: Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export INFLUX_TOKEN=your_token
export HA_TOKEN=your_ha_token

# Run the app
python app.py
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INFLUX_URL` | InfluxDB URL | `http://YOUR_SERVER_IP:8086` |
| `INFLUX_TOKEN` | InfluxDB API token | *(required)* |
| `INFLUX_ORG` | InfluxDB organization | `homeassistant` |
| `INFLUX_BUCKET` | InfluxDB bucket | `smoker` |
| `HA_URL` | Home Assistant URL | `http://YOUR_SERVER_IP:8123` |
| `HA_TOKEN` | Home Assistant long-lived token | *(optional)* |

## Testing

```bash
# Health check
curl http://localhost:5000/api/health

# Get sessions
curl http://localhost:5000/api/sessions

# Get temperatures for a session
curl "http://localhost:5000/api/sessions/smoke_20260207_103722/temperatures?start=2026-02-07T10:37:22Z&end=2026-02-07T12:37:22Z"

# Delete a session
curl -X DELETE http://localhost:5000/api/sessions/smoke_20260207_103722 \
  -H "Content-Type: application/json" \
  -d '{"start": "2026-02-07T10:37:22Z", "end": "2026-02-07T12:37:22Z"}'
```

## Logs

```bash
# View logs
docker-compose logs -f

# Or for standalone container
docker logs -f smoker-backend
```

## Troubleshooting

**Can't connect to InfluxDB:**
- Make sure `INFLUX_URL` is accessible from the container
- Check your `INFLUX_TOKEN` is correct
- Verify InfluxDB is running

**CORS errors:**
- The backend has CORS enabled for all origins
- If still issues, check browser console

**Sessions not loading:**
- Check InfluxDB has data: `docker-compose logs` for errors
- Test the endpoint directly: `curl http://localhost:5000/api/sessions`
