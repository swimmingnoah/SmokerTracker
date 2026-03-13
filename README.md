# 🔥 Smoker Tracker

A full-stack application for tracking and analyzing BBQ smoker sessions with real-time temperature monitoring, session management, and historical data visualization.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Smoker Tracker is a comprehensive solution for BBQ enthusiasts to monitor and analyze their smoking sessions. It integrates with ESPHome-based temperature probes, stores data in InfluxDB, and provides beautiful visualizations through a modern web interface.

### What Can You Do?

- 📊 **Track Sessions** - Create and manage smoke sessions with names, meat types, and notes
- 🌡️ **Monitor Temperatures** - Real-time temperature tracking from multiple probes
- 📈 **Visualize Data** - Interactive temperature graphs with statistics
- 🎯 **Setpoint History** - Track temperature setpoint changes throughout your cook
- ✏️ **Edit Sessions** - Update session details, notes, and metadata on the fly
- 🗂️ **Session History** - Browse all past sessions with search and filtering

## ✨ Features

### Session Management
- Create new smoke sessions with custom names and meat types
- Edit session details (name, meat type, notes) in real-time
- End sessions manually or auto-detect completion
- Soft delete sessions (hides from view, keeps data)
- Custom meat type dropdown with ability to add new types

### Temperature Monitoring
- **Real-time tracking** from 4 temperature probes:
  - Probe 1 & 2 (meat probes)
  - Firepot temperature
  - RTD (ambient) temperature
- **Auto-refresh** every 30 seconds
- **Temperature statistics** (avg, max, min per probe)
- **Interactive graphs** with time-series visualization

### Setpoint Tracking
- Track temperature setpoint changes throughout the cook
- Show duration at each setpoint
- Capture warmup setpoint (1 hour lookback)
- Visual timeline of setpoint adjustments

### Data Persistence
- **SQLite** for session metadata (reliable, portable)
- **InfluxDB** for time-series temperature data
- **Automatic backups** via volume mounting

## 🏗️ Architecture

```
┌─────────────────┐
│  ESPHome Smoker │
│   (4 Probes)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Home Assistant  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    InfluxDB     │◄─────────────┐
│  (Time Series)  │              │
└─────────────────┘              │
                                 │
┌─────────────────┐              │
│     Backend     │──────────────┤
│  Flask/Spring   │              │
│     SQLite      │              │
└────────┬────────┘              │
         │                       │
         ▼                       │
┌─────────────────┐              │
│    Frontend     │──────────────┘
│  React/Angular  │
└─────────────────┘
```

### Data Flow

1. **ESPHome** → Sends temperature data to Home Assistant
2. **Home Assistant** → Logs temperatures to InfluxDB
3. **User** → Creates session in frontend
4. **Frontend** → Sends request to backend API
5. **Backend** → Stores session metadata in SQLite
6. **Backend** → Queries InfluxDB for temperature data
7. **Frontend** → Displays graphs and statistics

## 🛠️ Tech Stack

### Backend
- **Flask** - Lightweight Python web framework
- **SQLite** - Session metadata database
- **InfluxDB Client** - Temperature data queries
- **Gunicorn** - Production WSGI server
- **Flask-CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool and dev server
- **Recharts** - Interactive temperature graphs
- **Tailwind CSS** - Utility-first styling
- **Fetch API** - Backend communication

### Infrastructure
- **InfluxDB v2** - Time-series temperature database
- **Home Assistant** - IoT hub and automation
- **ESPHome** - Microcontroller firmware for temperature probes
- **Docker** - Containerization for easy deployment
- **Unraid** - Server platform (optional)

## 📦 Prerequisites

### Required
- **ESPHome smoker** with temperature probes configured
- **Home Assistant** with ESPHome integration
- **InfluxDB v2** instance running
- **Node.js 18+** (for React frontend)
- **Python 3.11+** (for Flask backend)
- **Docker** (recommended for deployment)

### Home Assistant Helpers
Create these in Home Assistant (Settings → Devices & Services → Helpers):

```yaml
# Input Text helpers
input_text:
  smoke_session_name:
    name: Smoke Session Name
  
  meat_type:
    name: Meat Type
  
  smoke_session_notes:
    name: Smoke Session Notes
  
  current_session_id:
    name: Current Session ID

# Input DateTime helpers
input_datetime:
  smoke_start_time:
    name: Smoke Start Time
    has_date: true
    has_time: true
  
  smoke_end_time:
    name: Smoke End Time
    has_date: true
    has_time: true

# Input Buttons
input_button:
  start_smoke_session:
    name: Start Smoke Session
  
  end_smoke_session:
    name: End Smoke Session
```

### InfluxDB Configuration

In Home Assistant `configuration.yaml`:

```yaml
influxdb:
  api_version: 2
  host: YOUR_SERVER_IP
  port: 8086
  token: YOUR_INFLUX_TOKEN
  organization: homeassistant
  bucket: smoker
  ssl: false
  verify_ssl: false
  include:
    entities:
      - sensor.esp32smoker_firepot_temperature
      - sensor.esp32smoker_probe_1_temperature
      - sensor.esp32smoker_probe_2_temperature
      - sensor.esp32smoker_rtd_temperature
      - number.esp32smoker_smoker_set_temperature
```

## 🚀 Quick Start

### 1. Clone/Download the Project

Download the project files:
- `smoker-backend-v2.zip` (Flask backend)
- `smoker-app-v2.zip` (React frontend)

### 2. Setup Backend

```bash
cd smoker-backend
cp .env.example .env
nano .env  # Add your INFLUX_TOKEN

# Option A: Docker (Recommended)
docker-compose up -d

# Option B: Local Development
pip install -r requirements.txt
python app.py
```

Backend runs on: `http://localhost:5001`

### 3. Setup Frontend

```bash
cd smoker-app
npm install

# Edit src/config.js - set API URL
nano src/config.js

# Start development server
npm run dev
```

Frontend runs on: `http://localhost:3001`

### 4. Start Tracking!

1. Open `http://localhost:3001`
2. Click "Start New Session"
3. Enter session details (name, meat type, notes)
4. Monitor temperatures in real-time!
5. Temperature data auto-refreshes every 30 seconds

## 📁 Project Structure

```
smoker-tracker/
├── backend/                      # Flask Python backend
│   ├── app.py                    # Main Flask application
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Docker image definition
│   ├── docker-compose.yml        # Docker deployment config
│   └── data/                     # SQLite database storage
│       └── sessions.db
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── App.jsx               # Main app component
│   │   ├── config.js             # API configuration
│   │   ├── SessionList.jsx       # Session list view
│   │   ├── SessionDetail.jsx     # Session detail view
│   │   └── CreateSession.jsx     # Create session form
│   ├── package.json              # NPM dependencies
│   ├── vite.config.js            # Vite configuration
│   └── tailwind.config.js        # Tailwind CSS config
│
├── home-assistant/
│   ├── configuration.yaml        # HA config snippets
│   └── automations.yaml          # Session automations
│
└── README.md
```

## 🐳 Deployment

### Docker Compose (Recommended)

Complete stack with Flask backend + React frontend:

```yaml
version: '3.8'

services:
  # Flask Backend
  smoker-backend:
    build: ./backend
    ports:
      - "5001:5000"
    environment:
      - INFLUX_TOKEN=${INFLUX_TOKEN}
      - INFLUX_URL=http://YOUR_SERVER_IP:8086
      - INFLUX_ORG=homeassistant
      - INFLUX_BUCKET=smoker
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  # React Frontend (nginx)
  smoker-frontend:
    image: nginx:alpine
    ports:
      - "3001:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

### Unraid Deployment

#### Backend Container:
1. Go to Docker → Add Container
2. **Repository:** `python:3.11-slim`
3. **Port:** `5001:5000`
4. **Path:** `/app` → `/mnt/user/appdata/smoker-tracker`
5. **Path:** `/app/data` → `/mnt/user/appdata/smoker-tracker/data`
6. **Environment Variables:**
   - `INFLUX_TOKEN` = your_token
   - `INFLUX_URL` = http://YOUR_SERVER_IP:8086
   - `INFLUX_ORG` = homeassistant
   - `INFLUX_BUCKET` = smoker
7. **Post Arguments:**
```bash
bash -c "cd /app && pip install -r requirements.txt && gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 app:app"
```

#### Frontend (nginx):
1. Build React app: `npm run build`
2. Upload `dist/` folder to `/mnt/user/appdata/smoker-frontend`
3. Add nginx container pointing to that folder

### Production Deployment

1. **Build frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Build backend Docker image:**
   ```bash
   cd backend
   docker build -t smoker-backend:latest .
   ```

3. **Use nginx as reverse proxy:**
   ```nginx
   server {
       listen 80;
       server_name smoker.yourdomain.com;
       
       location / {
           root /var/www/smoker-frontend;
           try_files $uri /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:5001;
       }
   }
   ```

4. **Enable HTTPS with Let's Encrypt**
5. **Set up automated backups for SQLite database**

## 📚 API Documentation

### Base URL
```
http://localhost:5001/api
```

### Endpoints

#### Health Check
```http
GET /api/health
```
Response:
```json
{
  "status": "ok",
  "message": "Smoker Tracker API is running"
}
```

#### Get All Sessions
```http
GET /api/sessions
```
Response:
```json
{
  "sessions": [
    {
      "id": "smoke_20260210_143000",
      "name": "Saturday Brisket",
      "meatType": "Brisket",
      "notes": "12lb packer",
      "startTime": "2026-02-10T14:30:00Z",
      "endTime": "2026-02-10T22:00:00Z"
    }
  ]
}
```

#### Create Session
```http
POST /api/sessions
Content-Type: application/json

{
  "name": "Sunday Ribs",
  "meatType": "Pork Ribs",
  "notes": "3-2-1 method"
}
```

#### Update Session
```http
PUT /api/sessions/{sessionId}
Content-Type: application/json

{
  "name": "Updated Name",
  "notes": "Additional notes"
}
```

#### End Session
```http
POST /api/sessions/{sessionId}/end
```

#### Delete Session
```http
DELETE /api/sessions/{sessionId}
```

#### Get Temperatures
```http
GET /api/sessions/{sessionId}/temperatures?start={ISO8601}&end={ISO8601}
```

#### Get Setpoints
```http
GET /api/sessions/{sessionId}/setpoints
```

#### Get Meat Types
```http
GET /api/meat-types
```

## 🎨 Screenshots

### Session List
View all your smoke sessions with quick stats and notes.

### Session Detail
Interactive temperature graphs, editable fields, and setpoint history.

### Create Session
Simple form to start a new smoking session.

### Temperature Statistics
Average, max, and min temperatures for each probe.

## 💻 Development

### Running Locally

**Flask Backend:**
```bash
cd backend
pip install -r requirements.txt
export INFLUX_TOKEN=your_token
python app.py
```

**React Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Code Style

**Python (Flask):**
- Follow PEP 8 style guide
- Use `black` for code formatting
- Type hints encouraged for clarity
- Docstrings for functions and classes

**JavaScript/React:**
- ESLint with recommended rules
- Prettier for code formatting
- Functional components with hooks
- PropTypes or TypeScript for type checking

### Testing

**Backend:**
```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests
pytest
```

**Frontend:**
```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

### Adding Features

1. Create a new branch
2. Backend: Add endpoint in `app.py`
3. Frontend: Create/update components in `src/`
4. Test thoroughly
5. Update API documentation
6. Submit pull request

## 🐛 Troubleshooting

### Backend Issues

**Port 5001 already in use:**
```bash
# Change port in docker-compose.yml
ports:
  - "5002:5000"

# Or in app.py for local development
app.run(host='0.0.0.0', port=5002)
```

**Database locked:**
```bash
# Only one backend instance can access SQLite at a time
docker-compose down
rm data/sessions.db-journal  # Remove lock file if exists
docker-compose up -d
```

**InfluxDB connection failed:**
```bash
# Verify InfluxDB is running
curl http://YOUR_SERVER_IP:8086/health

# Check token is correct in .env file
cat .env

# Verify bucket exists in InfluxDB UI
```

**Module not found errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend Issues

**CORS errors:**
- Backend must have CORS enabled (both Flask and Spring Boot do)
- Check API URL in config matches backend

**Temperature graph not showing:**
- Check browser console for errors
- Verify session has temperature data in InfluxDB
- Ensure session times are correct

**Session name shows "Unnamed Session":**
- Home Assistant automation may not be setting session ID correctly
- Check automation is generating proper `smoke_YYYYMMDD_HHMMSS` format

### Home Assistant Issues

**Temperatures not logging to InfluxDB:**
```bash
# Check InfluxDB integration in HA
# Verify entities are included in configuration.yaml
# Restart Home Assistant
```

**Session helpers not working:**
- Ensure all input helpers are created
- Check automations are enabled
- Verify entity IDs match configuration

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **Home Assistant** - Amazing IoT platform
- **InfluxDB** - Powerful time-series database
- **ESPHome** - Easy ESP32/8266 programming
- **React/Angular** - Modern web frameworks
- **Spring Boot/Flask** - Excellent backend frameworks

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review the Home Assistant forums

---

**Happy Smoking! 🔥🥩**
