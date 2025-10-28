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
  SegmentedButtons,
  ActivityIndicator,
  Snackbar,
} from "react-native-paper";
import { useDatabase } from "../../contexts/DatabaseContext";
import { format, parseISO } from "date-fns";

const { width: screenWidth } = Dimensions.get("window");

export default function ReportsScreen() {
  const { getReports, getYearlyReports, syncData } = useDatabase();
  const [reportType, setReportType] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const loadReport = async () => {
    try {
      let data;
      if (reportType === "monthly") {
        data = await getReports(selectedMonth, selectedYear);
      } else {
        data = await getYearlyReports(selectedYear);
      }
      setReportData(data);
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReport();
  };

  const handleSync = async () => {
    try {
      await syncData();
      setSnackbarMessage("Data synced successfully!");
      setSnackbarVisible(true);
      await loadReport();
    } catch (error: any) {
      setSnackbarMessage(error.message || "Sync failed");
      setSnackbarVisible(true);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedMonth, selectedYear]);

  const renderMonthlyReport = () => {
    if (!reportData) return null;

    return (
      <View>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.income?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.expenses?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.netCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.net?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Goal Progress */}
        {reportData.summary?.goalStatus && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.cardTitle}>Goal Progress</Title>
              <View style={styles.goalProgress}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(
                          (reportData.summary.goalStatus.progress / reportData.summary.goalStatus.target) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.goalText}>
                  ${reportData.summary.goalStatus.progress.toFixed(2)} / $
                  {reportData.summary.goalStatus.target.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.goalStatus,
                    reportData.summary.goalStatus.achieved
                      ? styles.achieved
                      : styles.pending,
                  ]}
                >
                  {reportData.summary.goalStatus.achieved
                    ? "🎉 Goal Achieved!"
                    : `$${reportData.summary.goalStatus.remaining.toFixed(2)} to go`}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Category Breakdown */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Income by Category</Title>
            {Object.entries(reportData.analytics?.categoryBreakdown?.income || {}).map(
              ([category, amount]: [string, any]) => (
                <View key={category} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.incomeAmount}>${amount.toFixed(2)}</Text>
                </View>
              )
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Expenses by Category</Title>
            {Object.entries(reportData.analytics?.categoryBreakdown?.expenses || {}).map(
              ([category, amount]: [string, any]) => (
                <View key={category} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.expenseAmount}>${amount.toFixed(2)}</Text>
                </View>
              )
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderYearlyReport = () => {
    if (!reportData) return null;

    return (
      <View>
        {/* Yearly Summary */}
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.income?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.expenses?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, styles.netCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net Savings</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.summary?.net?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Goals Achievement */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Goals Achievement</Title>
            <View style={styles.goalsAchievement}>
              <Text style={styles.achievementText}>
                {reportData.summary?.achievedGoals || 0} / {reportData.summary?.totalGoals || 0} goals achieved
              </Text>
              <Text style={styles.achievementRate}>
                {reportData.summary?.goalsAchievementRate?.toFixed(1) || 0}% success rate
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Monthly Breakdown */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Monthly Breakdown</Title>
            {Object.entries(reportData.monthlyBreakdown || {}).map(
              ([month, data]: [string, any]) => (
                <View key={month} style={styles.monthItem}>
                  <Text style={styles.monthName}>{data.monthName}</Text>
                  <View style={styles.monthAmounts}>
                    <Text style={styles.monthIncome}>+${data.income.toFixed(2)}</Text>
                    <Text style={styles.monthExpense}>-${data.expenses.toFixed(2)}</Text>
                    <Text
                      style={[
                        styles.monthNet,
                        data.net >= 0 ? styles.positive : styles.negative,
                      ]}
                    >
                      ${data.net.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

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
        <View style={styles.header}>
          <SegmentedButtons
            value={reportType}
            onValueChange={(value) => setReportType(value as "monthly" | "yearly")}
            buttons={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
            style={styles.segmentedButtons}
          />

          {reportType === "monthly" ? (
            <View style={styles.monthYearSelector}>
              <Button
                mode="outlined"
                onPress={() => setSelectedMonth((prev) => Math.max(1, prev - 1))}
                disabled={selectedMonth === 1}
                compact
              >
                Prev
              </Button>
              <Text style={styles.currentPeriod}>
                {months[selectedMonth - 1]} {selectedYear}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setSelectedMonth((prev) => Math.min(12, prev + 1))}
                disabled={selectedMonth === 12}
                compact
              >
                Next
              </Button>
            </View>
          ) : (
            <View style={styles.monthYearSelector}>
              <Button
                mode="outlined"
                onPress={() => setSelectedYear((prev) => prev - 1)}
                compact
              >
                Prev
              </Button>
              <Text style={styles.currentPeriod}>{selectedYear}</Text>
              <Button
                mode="outlined"
                onPress={() => setSelectedYear((prev) => prev + 1)}
                compact
              >
                Next
              </Button>
            </View>
          )}

          <Button mode="contained" onPress={handleSync} style={styles.syncButton}>
            Sync Data
          </Button>
        </View>

        {reportType === "monthly" ? renderMonthlyReport() : renderYearlyReport()}
      </ScrollView>

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
  header: {
    padding: 16,
    backgroundColor: "white",
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  monthYearSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  currentPeriod: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
  },
  syncButton: {
    backgroundColor: "#6366F1",
  },
  summaryContainer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    margin: 4,
    elevation: 2,
  },
  incomeCard: {
    backgroundColor: "#D1FAE5",
  },
  expenseCard: {
    backgroundColor: "#FEE2E2",
  },
  netCard: {
    backgroundColor: "#DBEAFE",
  },
  summaryContent: {
    alignItems: "center",
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  card: {
    margin: 16,
    marginTop: 0,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  goalProgress: {
    alignItems: "center",
  },
  progressBarBackground: {
    width: "100%",
    height: 16,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 16,
    backgroundColor: "#10B981",
    borderRadius: 8,
  },
  goalText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  goalStatus: {
    fontSize: 14,
    fontWeight: "600",
  },
  achieved: {
    color: "#10B981",
  },
  pending: {
    color: "#F59E0B",
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryName: {
    fontSize: 14,
    color: "#374151",
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  goalsAchievement: {
    alignItems: "center",
  },
  achievementText: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 4,
  },
  achievementRate: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "600",
  },
  monthItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  monthName: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  monthAmounts: {
    alignItems: "flex-end",
  },
  monthIncome: {
    fontSize: 12,
    color: "#10B981",
  },
  monthExpense: {
    fontSize: 12,
    color: "#EF4444",
  },
  monthNet: {
    fontSize: 14,
    fontWeight: "bold",
  },
  positive: {
    color: "#10B981",
  },
  negative: {
    color: "#EF4444",
  },
});