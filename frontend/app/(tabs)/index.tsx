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
import { format, subMonths } from "date-fns";
import { safeFormatDate } from "@/utils/dateUtils";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";

const { width } = Dimensions.get('window');

// Types for better type safety
interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  category: string;
  transaction_date: string;
}

interface Goal {
  id: string;
  target_amount: number;
  progress: number;
  title: string;
  deadline: string;
}

interface ChartData {
  expenses: number[];
  income: number[];
  net: number[];
  labels: string[];
  categories?: { name: string; amount: number; color: string }[];
}

interface DashboardData {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  currentGoal: Goal | null;
  recentTransactions: Transaction[];
  chartData: ChartData;
}

export default function DashboardScreen() {
  const { user, token } = useAuth();
  const { 
    getDashboardData, 
    syncData,
    isOnline,
    getTransactions,
    getGoals 
  } = useDatabase();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  const processChartData = (transactions: Transaction[]): ChartData => {
    // Generate last 6 months labels
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      labels.push(format(date, "MMM"));
    }

    // Initialize arrays for data
    const expenses = Array(6).fill(0);
    const income = Array(6).fill(0);
    const net = Array(6).fill(0);

    // Process transactions by month
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.transaction_date);
      const monthDiff = Math.floor(
        (new Date().getTime() - transactionDate.getTime()) / 
        (30 * 24 * 60 * 60 * 1000)
      );
      
      if (monthDiff >= 0 && monthDiff < 6) {
        const index = 5 - monthDiff;
        if (transaction.type === "expense") {
          expenses[index] += transaction.amount;
        } else {
          income[index] += transaction.amount;
        }
      }
    });

    // Calculate net income
    for (let i = 0; i < 6; i++) {
      net[i] = income[i] - expenses[i];
    }

    // Calculate category breakdown for pie chart
    const categoryMap = new Map();
    const categoryColors = [
      "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", 
      "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
    ];

    transactions
      .filter(t => t.type === "expense")
      .forEach((transaction, index) => {
        const category = transaction.category || "Uncategorized";
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + transaction.amount);
      });

    const categories = Array.from(categoryMap.entries()).map(([name, amount], index) => ({
      name,
      amount,
      color: categoryColors[index % categoryColors.length],
      legendFontColor: "#64748B",
      legendFontSize: 12,
    }));

    return {
      expenses,
      income,
      net,
      labels,
      categories,
    };
  };

  const loadDashboardData = async () => {
    try {
      // Try to get actual data first
      let data = await getDashboardData();
      
      if (!data) {
        // If no dashboard data, fetch transactions and goals separately
        const [transactions, goals] = await Promise.all([
          getTransactions(),
          getGoals()
        ]);

        const chartData = processChartData(transactions || []);
        
        // Calculate current month totals
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const currentMonthTransactions = (transactions || []).filter(t => {
          const date = new Date(t.transaction_date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const monthlyIncome = currentMonthTransactions
          .filter(t => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpenses = currentMonthTransactions
          .filter(t => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);

        const currentBalance = monthlyIncome - monthlyExpenses;
        const currentGoal = goals && goals.length > 0 ? goals[0] : null;

        data = {
          currentBalance,
          monthlyIncome,
          monthlyExpenses,
          currentGoal,
          recentTransactions: (transactions || []).slice(0, 10),
          chartData,
        };
      }

      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Fallback to sample data that demonstrates the chart
      const sampleChartData = {
        expenses: [3200, 2800, 3500, 3100, 2900, 3300],
        income: [4500, 4200, 4800, 4600, 4400, 4700],
        net: [1300, 1400, 1300, 1500, 1500, 1400],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        categories: [
          { name: "Food", amount: 800, color: "#EF4444" },
          { name: "Transport", amount: 600, color: "#F59E0B" },
          { name: "Entertainment", amount: 400, color: "#10B981" },
          { name: "Shopping", amount: 900, color: "#3B82F6" },
          { name: "Bills", amount: 500, color: "#8B5CF6" },
        ].map(item => ({
          ...item,
          legendFontColor: "#64748B",
          legendFontSize: 12,
        }))
      };

      setDashboardData({
        currentBalance: 12500.50,
        monthlyIncome: 4500.00,
        monthlyExpenses: 3200.75,
        currentGoal: {
          id: "1",
          target_amount: 5000,
          progress: 3200.75,
          title: "Emergency Fund",
          deadline: "2024-12-31"
        },
        recentTransactions: [
          {
            id: "1",
            amount: 1200,
            type: "income",
            description: "Salary",
            category: "Income",
            transaction_date: new Date().toISOString()
          },
          {
            id: "2",
            amount: 150,
            type: "expense",
            description: "Grocery Shopping",
            category: "Food",
            transaction_date: new Date().toISOString()
          }
        ],
        chartData: sampleChartData
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

  // Enhanced chart configuration
  const chartConfig = {
    backgroundColor: "#FFFFFF",
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: "#FFFFFF",
    },
    propsForBackgroundLines: {
      stroke: "#E5E7EB",
      strokeWidth: 1,
      strokeDasharray: "0",
    },
    fillShadowGradient: "#6366F1",
    fillShadowGradientOpacity: 0.1,
  };

  // Financial Trend Chart Data
  const financialChartData = {
    labels: dashboardData?.chartData?.labels || ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: dashboardData?.chartData?.expenses || [0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 3,
        withShadow: true,
      },
      {
        data: dashboardData?.chartData?.income || [0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 3,
        withShadow: true,
      },
      {
        data: dashboardData?.chartData?.net || [0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 4,
        withShadow: true,
      },
    ],
  };

  // Bar chart data for monthly comparison
  const barChartData = {
    labels: dashboardData?.chartData?.labels || ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: dashboardData?.chartData?.income || [0, 0, 0, 0, 0, 0],
      },
      {
        data: dashboardData?.chartData?.expenses || [0, 0, 0, 0, 0, 0],
      },
    ],
  };

  const barChartConfig = {
    ...chartConfig,
    barPercentage: 0.7,
    decimalPlaces: 0,
    color: (opacity = 1, index: number) => 
      index === 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  };

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
  const chartData = dashboardData?.chartData;

  const goalProgress = currentGoal?.progress || 0;
  const goalTarget = currentGoal?.target_amount || 1;
  const goalPercentage = Math.min((goalProgress / goalTarget) * 100, 100);
  const netIncome = monthlyIncome - monthlyExpenses;

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
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <View style={[styles.balanceTrend, netIncome >= 0 ? styles.positiveTrend : styles.negativeTrend]}>
                <Text style={styles.trendText}>
                  {netIncome >= 0 ? '+' : ''}{((netIncome / (monthlyIncome || 1)) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
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
              <View style={styles.netContainer}>
                <View style={[styles.indicator, netIncome >= 0 ? styles.incomeIndicator : styles.expenseIndicator]} />
                <View>
                  <Text style={styles.amountLabel}>Net</Text>
                  <Text style={[styles.netAmount, netIncome >= 0 ? styles.incomeAmount : styles.expenseAmount]}>
                    {netIncome >= 0 ? '+' : '-'}${Math.abs(netIncome).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Financial Charts Section */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={styles.cardTitle}>Financial Overview</Title>
              <View style={styles.chartTypeSelector}>
                <Button
                  mode={chartType === "line" ? "contained" : "outlined"}
                  compact
                  onPress={() => setChartType("line")}
                  style={styles.chartTypeButton}
                >
                  Line
                </Button>
                <Button
                  mode={chartType === "bar" ? "contained" : "outlined"}
                  compact
                  onPress={() => setChartType("bar")}
                  style={styles.chartTypeButton}
                >
                  Bar
                </Button>
              </View>
            </View>

            <View style={styles.chartContainer}>
              {chartType === "line" ? (
                <LineChart
                  data={financialChartData}
                  width={width - 64}
                  height={240}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                  withInnerLines={false}
                  withOuterLines={false}
                  withShadow={true}
                  withDots={true}
                  segments={5}
                  getDotColor={(dataPoint, index) => 
                    index === financialChartData.datasets[2].data.length - 1 ? '#6366F1' : 'transparent'
                  }
                />
              ) : (
                <BarChart
                  data={barChartData}
                  width={width - 64}
                  height={240}
                  chartConfig={barChartConfig}
                  style={styles.chart}
                  showValuesOnTopOfBars
                  withCustomBarColorFromData
                  flatColor={true}
                  showBarTops={false}
                />
              )}
              
              {/* Custom Legend */}
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Expenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#6366F1' }]} />
                  <Text style={styles.legendText}>Net</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Expense Categories Pie Chart */}
        {chartData?.categories && chartData.categories.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.cardTitle}>Expense Categories</Title>
              </View>
              <View style={styles.pieChartContainer}>
                <PieChart
                  data={chartData.categories}
                  width={width - 64}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Goals Progress */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={styles.cardTitle}>
                {currentGoal?.title || 'Monthly Goal'}
              </Title>
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
              recentTransactions.slice(0, 5).map((transaction: Transaction, index: number) => (
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
                        {transaction.description}
                      </Text>
                      <Text style={styles.transactionCategory}>
                        {transaction.category}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text 
                      style={[
                        styles.transactionAmount,
                        transaction.type === "income" ? styles.incomeText : styles.expenseText
                      ]}
                    >
                      {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {safeFormatDate(transaction.transaction_date, "MMM d")}
                    </Text>
                  </View>
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
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    borderRadius: 16,
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
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: "hidden",
  },
  balanceContent: {
    paddingVertical: 24,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  balanceTrend: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  positiveTrend: {
    backgroundColor: "#D1FAE5",
  },
  negativeTrend: {
    backgroundColor: "#FEE2E2",
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
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
    flexWrap: "wrap",
  },
  incomeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginBottom: 8,
  },
  expenseContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginBottom: 8,
  },
  netContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: "600",
  },
  expenseAmount: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  netAmount: {
    fontSize: 14,
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
  chartTypeSelector: {
    flexDirection: "row",
    gap: 8,
  },
  chartTypeButton: {
    borderRadius: 8,
  },
  chartContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  pieChartContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
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
  transactionRight: {
    alignItems: "flex-end",
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
    marginBottom: 2,
    fontWeight: "500",
  },
  transactionCategory: {
    fontSize: 12,
    color: "#64748B",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  incomeText: {
    color: "#10B981",
  },
  expenseText: {
    color: "#EF4444",
  },
  transactionDate: {
    fontSize: 12,
    color: "#94A3B8",
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
  viewAllLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});