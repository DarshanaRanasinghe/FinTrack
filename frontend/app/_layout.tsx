import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "../contexts/AuthContext";
import { DatabaseProvider } from "../contexts/DatabaseContext";
import { useColorScheme } from "react-native";

const lightTheme = {
  colors: {
    primary: '#6366F1',
    primaryLight: '#C7D2FE',
    secondary: '#06B6D4',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    accent: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={lightTheme}>
      <AuthProvider>
        <DatabaseProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: {
                backgroundColor: lightTheme.colors.primary,
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: '700',
                fontSize: 18,
              },
              headerShadowVisible: false,
              contentStyle: {
                backgroundColor: lightTheme.colors.background,
              },
            }}
          />
        </DatabaseProvider>
      </AuthProvider>
    </PaperProvider>
  );
}