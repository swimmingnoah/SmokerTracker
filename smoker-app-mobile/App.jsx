import "./global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoginScreen from "./src/screens/LoginScreen";
import SessionListScreen from "./src/screens/SessionListScreen";
import CreateSessionScreen from "./src/screens/CreateSessionScreen";
import SessionDetailScreen from "./src/screens/SessionDetailScreen";
import MeatTypesScreen from "./src/screens/MeatTypesScreen";

import { CONFIG } from "./src/config";
import { apiFetch } from "./src/api";
import { getStoredKey } from "./src/auth";

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: "#ea580c" },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const statusRes = await fetch(`${CONFIG.apiUrl}/auth/status`);
      const statusData = await statusRes.json();

      if (!statusData.authRequired) {
        setAuthChecked(true);
        return;
      }

      const storedKey = await getStoredKey();
      if (storedKey) {
        const verifyRes = await apiFetch(`/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: storedKey }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          setAuthChecked(true);
          return;
        }
      }

      setNeedsLogin(true);
      setAuthChecked(true);
    } catch {
      setAuthChecked(true);
    }
  };

  if (!authChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  if (needsLogin) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#ea580c" />
        <LoginScreen onLogin={() => setNeedsLogin(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#ea580c" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={headerOptions}>
          <Stack.Screen
            name="SessionList"
            component={SessionListScreen}
            options={{ title: "Smoker Tracker" }}
          />
          <Stack.Screen
            name="CreateSession"
            component={CreateSessionScreen}
            options={{ title: "New Session" }}
          />
          <Stack.Screen
            name="SessionDetail"
            component={SessionDetailScreen}
            options={({ route }) => ({
              title: route.params?.session?.name || "Session",
            })}
          />
          <Stack.Screen
            name="MeatTypes"
            component={MeatTypesScreen}
            options={{ title: "Meat Types" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
