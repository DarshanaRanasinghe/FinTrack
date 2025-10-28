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
  ActivityIndicator,
  Snackbar,
} from "react-native-paper";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabase } from "../../contexts/DatabaseContext";
import { format } from "date-fns";
import { safeFormatDate } from "@/utils/dateUtils";

export default function DashboardScreen() {
  const { user, token } = useAuth();
  const { 
    getDashboardData, 
    syncData,
    isOnline 
  } = useDatabase();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const loadDashboardData = async () => {
    try {
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setDashboardData({
        currentBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        currentGoal: null,
        recentTransactions: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const handleSync = async () => {
    try {
      await syncData();
      setSnackbarMessage("Data synced successfully!");
      setSnackbarVisible(true);
      await loadDashboardData();
    } catch (error: any) {
      setSnackbarMessage(error.message || "Sync failed");
      setSnackbarVisible(true);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Safe data access with defaults
  const currentBalance = dashboardData?.currentBalance || 0;
  const monthlyIncome = dashboardData?.monthlyIncome || 0;
  const monthlyExpenses = dashboardData?.monthlyExpenses || 0;
  const currentGoal = dashboardData?.currentGoal || null;
  const recentTransactions = dashboardData?.recentTransactions || [];

  const goalProgress = currentGoal?.progress || 0;
  const goalTarget = currentGoal?.target_amount || 1; // Avoid division by zero
  const goalPercentage = Math.min((goalProgress / goalTarget) * 100, 100);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome back, {user?.name || 'User'}!
        </Text>
        <Text style={styles.dateText}>
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </Text>
      </View>

      {!isOnline && (
        <Card style={styles.offlineCard}>
          <Card.Content style={styles.offlineContent}>
            <Text style={styles.offlineText}>You're offline</Text>
            <Button 
              mode="contained" 
              compact 
              onPress={handleSync}
              style={styles.syncButton}
            >
              Sync Now
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Balance Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Current Balance</Title>
          <Text style={styles.balanceText}>
            ${currentBalance.toFixed(2)}
          </Text>
          <View style={styles.incomeExpenseContainer}>
            <View style={styles.incomeContainer}>
              <Text style={styles.incomeLabel}>Income</Text>
              <Text style={styles.incomeAmount}>
                +${monthlyIncome.toFixed(2)}
              </Text>
            </View>
            <View style={styles.expenseContainer}>
              <Text style={styles.expenseLabel}>Expenses</Text>
              <Text style={styles.expenseAmount}>
                -${monthlyExpenses.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Goals Progress */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Monthly Goal</Title>
            <Button 
              mode="text" 
              compact
              onPress={() => router.push("/goals")}
            >
              View All
            </Button>
          </View>
          {currentGoal ? (
            <View>
              <View style={styles.goalProgressContainer}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { 
                        width: `${goalPercentage}%` 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.goalProgressText}>
                  ${goalProgress.toFixed(2)} / ${goalTarget.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.goalStatus}>
                {goalProgress >= goalTarget 
                  ? "🎉 Goal achieved!" 
                  : `$${(goalTarget - goalProgress).toFixed(2)} to go`}
              </Text>
            </View>
          ) : (
            <Text style={styles.noGoalText}>No goal set for this month</Text>
          )}
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Quick Actions</Title>
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => router.push("/(tabs)/transactions")}
              style={styles.actionButton}
            >
              Add Transaction
            </Button>
            <Button
              mode="outlined"
              icon="flag"
              onPress={() => router.push("/(tabs)/goals")}
              style={styles.actionButton}
            >
              Set Goal
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Transactions */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Title style={styles.cardTitle}>Recent Transactions</Title>
            <Button 
              mode="text" 
              compact
              onPress={() => router.push("/transactions")}
            >
              View All
            </Button>
          </View>
          {recentTransactions.length > 0 ? (
            recentTransactions.slice(0, 5).map((transaction: any) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description || transaction.desc}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {safeFormatDate(transaction.transaction_date || transaction.date, "MMM d")}
                </Text>
                </View>
                <Text 
                  style={[
                    styles.transactionAmount,
                    transaction.type === "income" ? styles.incomeText : styles.expenseText
                  ]}
                >
                  {transaction.type === "income" ? "+" : "-"}${(transaction.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No recent transactions</Text>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 20,
    backgroundColor: "#6366F1",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: "#E0E7FF",
  },
  offlineCard: {
    margin: 16,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  offlineContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offlineText: {
    color: "#92400E",
    fontWeight: "600",
  },
  syncButton: {
    backgroundColor: "#F59E0B",
  },
  card: {
    margin: 16,
    elevation: 4,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  balanceText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  incomeExpenseContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  incomeContainer: {
    alignItems: "center",
  },
  incomeLabel: {
    color: "#6B7280",
    fontSize: 14,
  },
  incomeAmount: {
    color: "#10B981",
    fontSize: 18,
    fontWeight: "bold",
  },
  expenseContainer: {
    alignItems: "center",
  },
  expenseLabel: {
    color: "#6B7280",
    fontSize: 14,
  },
  expenseAmount: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "bold",
  },
  goalProgressContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    backgroundColor: "#10B981",
    borderRadius: 4,
  },
  goalProgressText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
  },
  goalStatus: {
    textAlign: "center",
    color: "#6366F1",
    fontWeight: "600",
  },
  noGoalText: {
    textAlign: "center",
    color: "#6B7280",
    fontStyle: "italic",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  incomeText: {
    color: "#10B981",
  },
  expenseText: {
    color: "#EF4444",
  },
  noDataText: {
    textAlign: "center",
    color: "#6B7280",
    fontStyle: "italic",
    marginVertical: 20,
  },
});