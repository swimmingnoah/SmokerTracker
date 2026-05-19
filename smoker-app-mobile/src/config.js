import { Platform } from "react-native";

// On web, Metro proxies /api/* to the backend (see metro.config.js) so the
// browser sees same-origin requests and avoids CORS. On native, the phone
// needs the absolute backend URL on your LAN. Replace 10.0.0.3 with your
// laptop/server's LAN IP; phone + laptop must be on the same WiFi.
export const CONFIG = {
  apiUrl: Platform.OS === "web" ? "/api" : "http://10.0.0.3:3001/api",
};
