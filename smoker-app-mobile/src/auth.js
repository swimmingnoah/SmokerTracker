import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "smoker_api_key";

export const getStoredKey = async () => {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setStoredKey = (value) => AsyncStorage.setItem(KEY, value);

export const clearStoredKey = () => AsyncStorage.removeItem(KEY);
