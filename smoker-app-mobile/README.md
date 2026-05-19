# Smoker Tracker — Mobile (React Native / Expo)

Secondary RN port of the main web frontend, for local mobile testing only. Not deployed. The web frontend at [smoker-app-frontend/](../smoker-app-frontend/) is still the primary UI.

## Running locally

1. `cd smoker-app-mobile`
2. `npm install`
3. Edit [src/config.js](src/config.js) — replace the `<LAN IP>` placeholder with your laptop's LAN IP (e.g. `192.168.1.42`). Phone and laptop must be on the same WiFi; `localhost` does not work from a device.
4. `npx expo start`
5. Open the Expo Go app on your phone, scan the QR code from the terminal.

If you don't have Expo Go: https://expo.dev/go

## What's connected to what

Hits the same backend API as the web frontend. No backend changes required.

```
Phone (Expo Go)
  └─ src/config.js → http://<LAN IP>:3001/api
        └─ nginx (smoker-frontend container) → /api/* → smoker-backend:5000
```

## Tech

- Expo SDK 51 managed workflow
- React Navigation (native stack)
- NativeWind (Tailwind classes on RN)
- victory-native (temperature chart + pause shading)
- expo-image-picker (camera + library for session photos)
- @react-native-async-storage/async-storage (auth key)
