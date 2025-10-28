import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "../contexts/AuthContext";
import { DatabaseProvider } from "../contexts/DatabaseContext";

export default function RootLayout() {
  return (
    <PaperProvider>
      <AuthProvider>
        <DatabaseProvider>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: "#6366F1",
              },
              headerTintColor: "#fff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            }}
          />
        </DatabaseProvider>
      </AuthProvider>
    </PaperProvider>
  );
}