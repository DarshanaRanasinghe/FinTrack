import { Stack } from "expo-router";
import { PaperProvider, configureFonts, MD3LightTheme } from "react-native-paper";
import { AuthProvider } from "../contexts/AuthContext";
import { DatabaseProvider } from "../contexts/DatabaseContext";
import { useColorScheme } from "react-native";

// Configure a complete theme with all required properties
const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Primary colors
    primary: '#6366F1',
    onPrimary: '#FFFFFF',
    primaryContainer: '#E0E7FF',
    onPrimaryContainer: '#1E1B4B',
    
    // Secondary colors
    secondary: '#06B6D4',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CFF4FE',
    onSecondaryContainer: '#00363D',
    
    // Surface colors
    surface: '#FFFFFF',
    onSurface: '#1E293B',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#475569',
    
    // Background colors
    background: '#F8FAFC',
    onBackground: '#1E293B',
    
    // Error colors
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#7F1D1D',
    
    // Success colors
    success: '#10B981',
    onSuccess: '#FFFFFF',
    
    // Warning colors
    warning: '#F59E0B',
    onWarning: '#FFFFFF',
    
    // Outline
    outline: '#E2E8F0',
    outlineVariant: '#CBD5E1',
    
    // Inverse colors
    inverseSurface: '#334155',
    inverseOnSurface: '#F1F5F9',
    inversePrimary: '#C7D2FE',
    
    // Shadow
    shadow: '#000000',
    scrim: '#000000',
    
    // Surface tint
    surfaceTint: '#6366F1',
    
    // Elevation colors (fix for the level3 error)
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FFFFFF',
      level3: '#FFFFFF',
      level4: '#FFFFFF',
      level5: '#FFFFFF',
    },
    
    // Backdrop
    backdrop: 'rgba(15, 23, 42, 0.4)',
  },
  // Font configuration
  fonts: configureFonts({
    config: {
      fontFamily: 'System',
    },
  }),
  // Roundness
  roundness: 12,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={customTheme}>
      <AuthProvider>
        <DatabaseProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: {
                backgroundColor: customTheme.colors.primary,
              },
              headerTintColor: customTheme.colors.onPrimary,
              headerTitleStyle: {
                fontWeight: '700',
                fontSize: 18,
              },
              headerShadowVisible: false,
              contentStyle: {
                backgroundColor: customTheme.colors.background,
              },
            }}
          />
        </DatabaseProvider>
      </AuthProvider>
    </PaperProvider>
  );
}