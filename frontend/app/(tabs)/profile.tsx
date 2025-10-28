import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  Card,
  Title,
  Button,
  Divider,
  Snackbar,
} from "react-native-paper";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabase } from "../../contexts/DatabaseContext";
import { format, parseISO } from "date-fns";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { clearLocalData, syncData, isOnline } = useDatabase();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const handleSync = async () => {
    try {
      await syncData();
      setSnackbarMessage("Data synced successfully!");
      setSnackbarVisible(true);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Sync failed");
      setSnackbarVisible(true);
    }
  };

  const handleClearData = async () => {
    try {
      await clearLocalData();
      setSnackbarMessage("Local data cleared successfully!");
      setSnackbarVisible(true);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to clear data");
      setSnackbarVisible(true);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={styles.container}>
      {/* User Info Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Profile Information</Title>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{user?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth:</Text>
            <Text style={styles.infoValue}>
              {user?.date_of_birth ? format(parseISO(user.date_of_birth), "MMMM d, yyyy") : "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member since:</Text>
            <Text style={styles.infoValue}>
              {user?.created_at ? format(parseISO(user.created_at), "MMMM yyyy") : "N/A"}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Connection Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Connection Status</Title>
          <View style={styles.connectionStatus}>
            <View
              style={[
                styles.statusIndicator,
                isOnline ? styles.online : styles.offline,
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
          <Text style={styles.statusDescription}>
            {isOnline
              ? "Your data will sync automatically with the server"
              : "You're working offline. Data will sync when you're back online"}
          </Text>
        </Card.Content>
      </Card>

      {/* Data Management */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Data Management</Title>
          <Button
            mode="contained"
            onPress={handleSync}
            style={styles.actionButton}
            icon="sync"
            disabled={!isOnline}
          >
            Sync Data Now
          </Button>
          <Button
            mode="outlined"
            onPress={handleClearData}
            style={styles.actionButton}
            icon="delete"
            textColor="#EF4444"
          >
            Clear Local Data
          </Button>
        </Card.Content>
      </Card>

      {/* App Information */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>App Information</Title>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version:</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Developer:</Text>
            <Text style={styles.infoValue}>FinTrack Team</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Logout */}
      <Card style={styles.card}>
        <Card.Content>
          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            icon="logout"
            buttonColor="#EF4444"
          >
            Logout
          </Button>
        </Card.Content>
      </Card>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  card: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  online: {
    backgroundColor: "#10B981",
  },
  offline: {
    backgroundColor: "#EF4444",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  statusDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    marginTop: 8,
  },
});