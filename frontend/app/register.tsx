import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Snackbar,
} from "react-native-paper";
import { Link, router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    date_of_birth: "",
  });
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const { register } = useAuth();

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.date_of_birth) {
      setSnackbarMessage("Please fill in all fields");
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      setSnackbarMessage("Registration successful! Please login.");
      setSnackbarVisible(true);
      setTimeout(() => {
        router.replace("/");
      }, 2000);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Registration failed");
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>💰</Text>
            </View>
          </View>
          <Title style={styles.title}>Create Account</Title>
          <Text style={styles.subtitle}>
            Join FinTrack to manage your finances
          </Text>
        </View>

        {/* Registration Form */}
        <Card style={styles.card} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Full Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              outlineColor="#E2E8F0"
              activeOutlineColor="#6366F1"
              left={<TextInput.Icon icon="account" color="#94A3B8" />}
            />

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              outlineColor="#E2E8F0"
              activeOutlineColor="#6366F1"
              left={<TextInput.Icon icon="email" color="#94A3B8" />}
            />

            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              mode="outlined"
              style={styles.input}
              secureTextEntry
              outlineColor="#E2E8F0"
              activeOutlineColor="#6366F1"
              left={<TextInput.Icon icon="lock" color="#94A3B8" />}
            />

            <TextInput
              label="Date of Birth (YYYY-MM-DD)"
              value={formData.date_of_birth}
              onChangeText={(text) => setFormData({ ...formData, date_of_birth: text })}
              mode="outlined"
              style={styles.input}
              placeholder="2000-01-01"
              outlineColor="#E2E8F0"
              activeOutlineColor="#6366F1"
              left={<TextInput.Icon icon="calendar" color="#94A3B8" />}
            />

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
              labelStyle={styles.buttonLabel}
              contentStyle={styles.buttonContent}
            >
              Create Account
            </Button>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Link href="/" asChild>
                <Button 
                  mode="text" 
                  compact
                  labelStyle={styles.loginLink}
                >
                  Sign In
                </Button>
              </Link>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#06B6D4",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  logoText: {
    fontSize: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  cardContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  input: {
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  button: {
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#06B6D4",
    elevation: 2,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonContent: {
    height: 48,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginText: {
    color: "#64748B",
    fontSize: 14,
  },
  loginLink: {
    color: "#06B6D4",
    fontWeight: "600",
    fontSize: 14,
  },
  snackbar: {
    borderRadius: 12,
    margin: 16,
  },
});