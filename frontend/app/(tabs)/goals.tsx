import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Text,
  Card,
  Title,
  Button,
  FAB,
  Modal,
  Portal,
  TextInput,
  Snackbar,
  ActivityIndicator,
  Menu,
} from "react-native-paper";
import { useDatabase } from "../../contexts/DatabaseContext";
import { format, parseISO } from "date-fns";
export default function GoalsScreen() {
  const {
    getGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    syncData,
    getGoalProgress
  } = useDatabase();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState<number | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [formData, setFormData] = useState({
    target_amount: "",
    target_month: new Date().getMonth() + 1,
    target_year: new Date().getFullYear(),
  });
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const loadGoals = async () => {
    try {
      const goalsData = await getGoals();
      const goalsWithProgress = await Promise.all(
        goalsData.map(async (goal: any) => {
          const progress = await getGoalProgress(goal.target_month, goal.target_year);
          return { ...goal, progress };
        })
      );
      setGoals(goalsWithProgress);
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
  };
  const handleAddGoal = () => {
    setEditingGoal(null);
    setFormData({
      target_amount: "",
      target_month: new Date().getMonth() + 1,
      target_year: new Date().getFullYear(),
    });
    setModalVisible(true);
  };
  const handleEditGoal = (goal: any) => {
    setEditingGoal(goal);
    setFormData({
      target_amount: goal.target_amount.toString(),
      target_month: goal.target_month,
      target_year: goal.target_year,
    });
    setModalVisible(true);
    setMenuVisible(null);
  };
  const handleSaveGoal = async () => {
    if (!formData.target_amount || !formData.target_month || !formData.target_year) {
      setSnackbarMessage("Please fill in all fields");
      setSnackbarVisible(true);
      return;
    }
    try {
      const goalData = {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
      };
      if (editingGoal) {
        await updateGoal(editingGoal.id, goalData);
        setSnackbarMessage("Goal updated successfully!");
      } else {
        await addGoal(goalData);
        setSnackbarMessage("Goal set successfully!");
      }
      setModalVisible(false);
      setSnackbarVisible(true);
      await loadGoals();
      await syncData(); // Sync with backend
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to save goal");
      setSnackbarVisible(true);
    }
  };
  const handleDeleteGoal = async (id: number) => {
    try {
      await deleteGoal(id);
      setSnackbarMessage("Goal deleted successfully!");
      setSnackbarVisible(true);
      await loadGoals();
      await syncData(); // Sync with backend
      setMenuVisible(null);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to delete goal");
      setSnackbarVisible(true);
    }
  };
  useEffect(() => {
    loadGoals();
  }, []);
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {goals.length > 0 ? (
          goals
            .sort((a, b) => {
              if (a.target_year !== b.target_year) {
                return b.target_year - a.target_year;
              }
              return b.target_month - a.target_month;
            })
            .map((goal) => (
              <Card key={goal.id} style={styles.goalCard}>
                <Card.Content>
                  <View style={styles.goalHeader}>
                    <Title style={styles.goalTitle}>
                      {months[goal.target_month - 1]} {goal.target_year}
                    </Title>
                    <Menu
                      visible={menuVisible === goal.id}
                      onDismiss={() => setMenuVisible(null)}
                      anchor={
                        <Button
                          icon="dots-vertical"
                          onPress={() => setMenuVisible(goal.id)}
                          mode="text"
                          compact
                        >
                          {""}
                        </Button>
                      }
                    >
                      <Menu.Item
                        onPress={() => handleEditGoal(goal)}
                        title="Edit"
                        leadingIcon="pencil"
                      />
                      <Menu.Item
                        onPress={() => handleDeleteGoal(goal.id)}
                        title="Delete"
                        leadingIcon="delete"
                      />
                    </Menu>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                        <View
                        style={[
                            styles.progressBarFill,
                            {
                            width: `${Math.min(
                                ((goal.progress || 0) / (goal.target_amount || 1)) * 100,
                                100
                            )}%`,
                            },
                        ]}
                        />
                    </View>
                    <Text style={styles.progressText}>
                        ${(goal.progress || 0).toFixed(2)} / ${(goal.target_amount || 0).toFixed(2)}
                    </Text>
                    </View>
                  <View style={styles.goalStatus}>
                    <Text
                      style={[
                        styles.statusText,
                        goal.progress >= goal.target_amount
                          ? styles.achievedText
                          : styles.pendingText,
                      ]}
                    >
                      {goal.progress >= goal.target_amount
                        ? "🎉 Goal Achieved!"
                        : `$${(goal.target_amount - goal.progress).toFixed(2)} to go`}
                    </Text>
                    <Text style={styles.progressPercentage}>
                      {Math.min(
                        Math.round((goal.progress / goal.target_amount) * 100),
                        100
                      )}
                      %
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text style={styles.emptyText}>No goals set yet</Text>
              <Text style={styles.emptySubtext}>
                Set your first savings goal to track your progress
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddGoal}
        color="white"
      />
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <Card style={styles.modalCard}>
              <Card.Content>
                <Title style={styles.modalTitle}>
                  {editingGoal ? "Edit Goal" : "Set New Goal"}
                </Title>
                <TextInput
                  label="Target Amount"
                  value={formData.target_amount}
                  onChangeText={(text) => setFormData({ ...formData, target_amount: text })}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                />
                <TextInput
                  label="Month (1-12)"
                  value={formData.target_month.toString()}
                  onChangeText={(text) => setFormData({ ...formData, target_month: parseInt(text) || 1 })}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                />
                <TextInput
                  label="Year"
                  value={formData.target_year.toString()}
                  onChangeText={(text) => setFormData({ ...formData, target_year: parseInt(text) || new Date().getFullYear() })}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                />
                <View style={styles.modalButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setModalVisible(false)}
                    style={styles.modalButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveGoal}
                    style={styles.modalButton}
                  >
                    Save
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </ScrollView>
        </Modal>
      </Portal>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  goalCard: {
    margin: 16,
    elevation: 4,
    borderRadius: 12,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 12,
    backgroundColor: "#10B981",
    borderRadius: 6,
  },
  progressText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  goalStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  achievedText: {
    color: "#10B981",
  },
  pendingText: {
    color: "#F59E0B",
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6366F1",
  },
  emptyCard: {
    margin: 16,
    elevation: 2,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#6B7280",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#6366F1",
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    elevation: 4,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 20,
    color: "#1F2937",
  },
  input: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});