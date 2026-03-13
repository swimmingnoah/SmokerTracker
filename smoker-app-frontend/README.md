# Smoker Tracker App

Simple React app to track your smoking sessions with InfluxDB data.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Edit your settings:**
   Open `src/config.js` and add your InfluxDB token:
   ```javascript
   influxToken: 'YOUR_TOKEN_HERE',
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```
   
   App will open at http://localhost:3001

## File Structure

```
smoker-app/
├── src/
│   ├── config.js          ← Edit your InfluxDB settings here
│   ├── App.jsx            ← Main app component
│   ├── SessionList.jsx    ← Shows all sessions
│   ├── SessionDetail.jsx  ← Shows session details + graph
│   ├── App.css            ← Styles
│   └── main.jsx           ← Entry point
├── package.json           ← Dependencies
├── vite.config.js         ← Vite settings
└── index.html             ← HTML template
```

## Customization

### Change colors:
Edit `probeColors` in `SessionDetail.jsx`:
```javascript
const probeColors = {
  probe_1: '#ef4444',  // red
  probe_2: '#3b82f6',  // blue
  firepot: '#f59e0b',  // orange
  rtd: '#10b981',      // green
};
```

### Change probe names:
Edit `probeNames` in `SessionDetail.jsx`:
```javascript
const probeNames = {
  probe_1: 'Meat Probe',
  probe_2: 'Ambient',
  // etc
};
```

### Change data update interval:
Edit `aggregateWindow` in the temperature query (SessionDetail.jsx):
```javascript
|> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
//                        ^^^ change this (1m, 5m, 10m, etc)
```

## Build for Production

```bash
npm run build
```

Files will be in the `dist/` folder - upload these to your web server.
