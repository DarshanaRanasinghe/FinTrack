import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
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

const { width } = Dimensions.get('window');

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
        <Text style={styles.loadingText}>Loading your finances...</Text>
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
  const goalTarget = currentGoal?.target_amount || 1;
  const goalPercentage = Math.min((goalProgress / goalTarget) * 100, 100);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Welcome back, {user?.name || 'User'}! 👋
            </Text>
            <Text style={styles.dateText}>
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        </View>

        {/* Offline Banner */}
        {!isOnline && (
          <Card style={styles.offlineCard}>
            <Card.Content style={styles.offlineContent}>
              <View style={styles.offlineIndicator} />
              <Text style={styles.offlineText}>You're offline</Text>
              <Button 
                mode="contained" 
                compact 
                onPress={handleSync}
                style={styles.syncButton}
                labelStyle={styles.syncButtonLabel}
              >
                Sync Now
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Balance Card */}
        <Card style={styles.card}>
          <Card.Content style={styles.balanceContent}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceText}>
              ${currentBalance.toFixed(2)}
            </Text>
            <View style={styles.incomeExpenseContainer}>
              <View style={styles.incomeContainer}>
                <View style={[styles.indicator, styles.incomeIndicator]} />
                <View>
                  <Text style={styles.amountLabel}>Income</Text>
                  <Text style={styles.incomeAmount}>
                    +${monthlyIncome.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.expenseContainer}>
                <View style={[styles.indicator, styles.expenseIndicator]} />
                <View>
                  <Text style={styles.amountLabel}>Expenses</Text>
                  <Text style={styles.expenseAmount}>
                    -${monthlyExpenses.toFixed(2)}
                  </Text>
                </View>
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
                textColor="#6366F1"
                labelStyle={styles.viewAllLabel}
              >
                View All
              </Button>
            </View>
            {currentGoal ? (
              <View>
                <View style={styles.goalProgressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.goalProgressText}>
                      ${goalProgress.toFixed(2)} / ${goalTarget.toFixed(2)}
                    </Text>
                    <Text style={styles.goalPercentage}>
                      {Math.round(goalPercentage)}%
                    </Text>
                  </View>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[
                        styles.progressBarFill,
                        { 
                          width: `${goalPercentage}%`,
                          backgroundColor: goalPercentage >= 100 ? '#10B981' : '#6366F1'
                        }
                      ]} 
                    />
                  </View>
                </View>
                <Text style={[
                  styles.goalStatus,
                  goalProgress >= goalTarget ? styles.goalAchieved : styles.goalPending
                ]}>
                  {goalProgress >= goalTarget 
                    ? "🎉 Goal achieved!" 
                    : `$${(goalTarget - goalProgress).toFixed(2)} to go`}
                </Text>
              </View>
            ) : (
              <View style={styles.noGoalContainer}>
                <Text style={styles.noGoalText}>No goal set for this month</Text>
                <Button 
                  mode="outlined" 
                  onPress={() => router.push("/(tabs)/goals")}
                  style={styles.setGoalButton}
                >
                  Set Goal
                </Button>
              </View>
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
                contentStyle={styles.actionButtonContent}
                labelStyle={styles.actionButtonLabel}
              >
                Add Transaction
              </Button>
              <Button
                mode="outlined"
                icon="flag"
                onPress={() => router.push("/(tabs)/goals")}
                style={styles.actionButton}
                contentStyle={styles.actionButtonContent}
                labelStyle={styles.outlinedButtonLabel}
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
                textColor="#6366F1"
                labelStyle={styles.viewAllLabel}
              >
                View All
              </Button>
            </View>
            {recentTransactions.length > 0 ? (
              recentTransactions.slice(0, 5).map((transaction: any, index: number) => (
                <View 
                  key={transaction.id} 
                  style={[
                    styles.transactionItem,
                    index === recentTransactions.slice(0, 5).length - 1 && styles.lastTransactionItem
                  ]}
                >
                  <View style={styles.transactionLeft}>
                    <View style={[
                      styles.transactionIcon,
                      transaction.type === "income" ? styles.incomeIcon : styles.expenseIcon
                    ]}>
                      <Text style={styles.transactionIconText}>
                        {transaction.type === "income" ? "↓" : "↑"}
                      </Text>
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription}>
                        {transaction.description || transaction.desc}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {safeFormatDate(transaction.transaction_date || transaction.date, "MMM d")}
                      </Text>
                    </View>
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
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No recent transactions</Text>
                <Text style={styles.noDataSubtext}>
                  Add your first transaction to get started
                </Text>
              </View>
            )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingBottom: 16,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: "#64748B",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  offlineCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 12,
  },
  offlineContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  offlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginRight: 8,
  },
  offlineText: {
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
  },
  syncButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
  },
  syncButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    overflow: "hidden",
  },
  balanceContent: {
    paddingVertical: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "500",
  },
  balanceText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  incomeExpenseContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  incomeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  expenseContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  incomeIndicator: {
    backgroundColor: "#10B981",
  },
  expenseIndicator: {
    backgroundColor: "#EF4444",
  },
  amountLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },
  incomeAmount: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "600",
  },
  expenseAmount: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  viewAllLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  goalProgressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalProgressText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  goalPercentage: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "700",
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  goalStatus: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  goalAchieved: {
    color: "#10B981",
  },
  goalPending: {
    color: "#6366F1",
  },
  noGoalContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  noGoalText: {
    color: "#64748B",
    marginBottom: 12,
    textAlign: "center",
  },
  setGoalButton: {
    borderColor: "#6366F1",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  actionButtonContent: {
    height: 48,
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  outlinedButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  lastTransactionItem: {
    borderBottomWidth: 0,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  incomeIcon: {
    backgroundColor: "#D1FAE5",
  },
  expenseIcon: {
    backgroundColor: "#FEE2E2",
  },
  transactionIconText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    color: "#1E293B",
    marginBottom: 4,
    fontWeight: "500",
  },
  transactionDate: {
    fontSize: 12,
    color: "#64748B",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  incomeText: {
    color: "#10B981",
  },
  expenseText: {
    color: "#EF4444",
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  noDataText: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
  snackbar: {
    borderRadius: 12,
    margin: 16,
  },
});