import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
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
      await syncData();
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
      await syncData();
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
        <Text style={styles.loadingText}>Loading your goals...</Text>
      </View>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "#10B981";
    if (percentage >= 75) return "#F59E0B";
    if (percentage >= 50) return "#6366F1";
    return "#EF4444";
  };

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
            .map((goal) => {
              const percentage = Math.min(
                ((goal.progress || 0) / (goal.target_amount || 1)) * 100,
                100
              );
              const progressColor = getProgressColor(percentage);

              return (
                <Card key={goal.id} style={styles.goalCard}>
                  <Card.Content>
                    <View style={styles.goalHeader}>
                      <View style={styles.goalTitleContainer}>
                        <Title style={styles.goalTitle}>
                          {months[goal.target_month - 1]} {goal.target_year}
                        </Title>
                        <Text style={styles.goalSubtitle}>Monthly Savings Goal</Text>
                      </View>
                      <Menu
                        visible={menuVisible === goal.id}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <Button
                            icon="dots-vertical"
                            onPress={() => setMenuVisible(goal.id)}
                            mode="text"
                            compact
                            style={styles.menuButton}
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
                              width: `${percentage}%`,
                              backgroundColor: progressColor,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.progressTextContainer}>
                        <Text style={styles.progressText}>
                          ${(goal.progress || 0).toFixed(2)} / ${(goal.target_amount || 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.progressPercentage, { color: progressColor }]}>
                          {Math.round(percentage)}%
                        </Text>
                      </View>
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
                      <View style={[
                        styles.statusBadge,
                        goal.progress >= goal.target_amount
                          ? styles.achievedBadge
                          : styles.pendingBadge
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {goal.progress >= goal.target_amount ? "Completed" : "In Progress"}
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              );
            })
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>🎯</Text>
              </View>
              <Text style={styles.emptyText}>No goals set yet</Text>
              <Text style={styles.emptySubtext}>
                Set your first savings goal to track your progress
              </Text>
              <Button
                mode="contained"
                onPress={handleAddGoal}
                style={styles.emptyButton}
                icon="plus"
              >
                Set Your First Goal
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {goals.length > 0 && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAddGoal}
          color="white"
          animated={true}
        />
      )}

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
                  left={<TextInput.Icon icon="currency-usd" />}
                  placeholder="0.00"
                />

                <View style={styles.rowInputs}>
                  <TextInput
                    label="Month"
                    value={formData.target_month.toString()}
                    onChangeText={(text) => setFormData({ ...formData, target_month: parseInt(text) || 1 })}
                    mode="outlined"
                    style={[styles.input, styles.halfInput]}
                    keyboardType="numeric"
                    left={<TextInput.Icon icon="calendar-month" />}
                  />
                  <TextInput
                    label="Year"
                    value={formData.target_year.toString()}
                    onChangeText={(text) => setFormData({ ...formData, target_year: parseInt(text) || new Date().getFullYear() })}
                    mode="outlined"
                    style={[styles.input, styles.halfInput]}
                    keyboardType="numeric"
                    left={<TextInput.Icon icon="calendar" />}
                  />
                </View>

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
                    {editingGoal ? "Update Goal" : "Save Goal"}
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
        style={styles.snackbar}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
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
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
  },
  scrollView: {
    flex: 1,
  },
  goalCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  goalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  menuButton: {
    margin: -8,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 12,
    borderRadius: 6,
    transition: "width 0.5s ease-in-out",
  },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: "700",
  },
  goalStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  achievedText: {
    color: "#10B981",
  },
  pendingText: {
    color: "#F59E0B",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  achievedBadge: {
    backgroundColor: "#D1FAE5",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
  },
  emptyCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 20,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    borderRadius: 12,
  },
  fab: {
    position: "absolute",
    margin: 24,
    right: 0,
    bottom: 0,
    backgroundColor: "#6366F1",
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
    margin: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 24,
    color: "#1F2937",
    fontSize: 22,
    fontWeight: "700",
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
  },
  snackbar: {
    borderRadius: 12,
    margin: 16,
  },
});