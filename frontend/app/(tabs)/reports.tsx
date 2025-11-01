import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import {
  Text,
  Card,
  Title,
  Button,
  SegmentedButtons,
  ActivityIndicator,
  Snackbar,
  Menu,
  Divider,
} from "react-native-paper";
import { useDatabase } from "../../contexts/DatabaseContext";
import { useAuth } from "../../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

const { width: screenWidth } = Dimensions.get("window");

export default function ReportsScreen() {
  const { getReports, getYearlyReports, syncData, isOnline } = useDatabase();
  const { token } = useAuth();
  const [reportType, setReportType] = useState<"monthly" | "yearly" | "category" | "goals" | "health">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const reportTypes = [
    { value: "monthly", label: "Monthly", icon: "calendar" },
    { value: "yearly", label: "Yearly", icon: "chart-bar" },
    { value: "category", label: "Categories", icon: "tag" },
    { value: "goals", label: "Goals", icon: "flag" },
    { value: "health", label: "Health", icon: "heart" },
  ];

  const loadReport = async () => {
    try {
      let data;
      switch (reportType) {
        case "monthly":
          data = await getReports(selectedMonth, selectedYear);
          break;
        case "yearly":
          data = await getYearlyReports(selectedYear);
          break;
        case "category":
          data = await getCategoryBreakdownReport(selectedMonth, selectedYear);
          break;
        case "goals":
          data = await getGoalProgressReport(selectedYear);
          break;
        case "health":
          data = await getFinancialHealthReport(selectedYear);
          break;
      }
      setReportData(data);
    } catch (error) {
      console.error("Error loading report:", error);
      setSnackbarMessage("Failed to load report data");
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getCategoryBreakdownReport = async (month: number, year: number) => {
    try {
      const response = await fetch(`http://192.168.1.3:3000/api/report/category-breakdown?month=${month}&year=${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      throw new Error("Failed to fetch category breakdown report");
    }
  };

  const getGoalProgressReport = async (year: number) => {
    try {
      const response = await fetch(`http://192.168.1.3:3000/api/report/goal-progress?year=${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      throw new Error("Failed to fetch goal progress report");
    }
  };

  const getFinancialHealthReport = async (year: number) => {
    try {
      const response = await fetch(`http://192.168.1.3:3000/api/report/financial-health?year=${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      throw new Error("Failed to fetch financial health report");
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

  const generatePdf = async () => {
    if (!isOnline) {
      setSnackbarMessage("You need to be online to generate PDF reports");
      setSnackbarVisible(true);
      return;
    }

    setGeneratingPdf(true);
    try {
      let pdfUrl;
      switch (reportType) {
        case "monthly":
          pdfUrl = `http://192.168.1.3:3000/api/report/monthly/pdf?month=${selectedMonth}&year=${selectedYear}`;
          break;
        case "yearly":
          pdfUrl = `http://192.168.1.3:3000/api/report/yearly/pdf?year=${selectedYear}`;
          break;
        case "category":
          pdfUrl = `http://192.168.1.3:3000/api/report/category-breakdown/pdf?month=${selectedMonth}&year=${selectedYear}`;
          break;
        case "goals":
          pdfUrl = `http://192.168.1.3:3000/api/report/goal-progress/pdf?year=${selectedYear}`;
          break;
        case "health":
          pdfUrl = `http://192.168.1.3:3000/api/report/financial-health/pdf?year=${selectedYear}`;
          break;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        pdfUrl,
        FileSystem.documentDirectory + `${reportType}_report_${selectedYear}${reportType === 'monthly' ? `_${selectedMonth}` : ''}.pdf`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      if (uri) {
        setSnackbarMessage("PDF generated successfully!");
        setSnackbarVisible(true);
        
        // Share the PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Download ${reportType} Report`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      setSnackbarMessage("Failed to generate PDF");
      setSnackbarVisible(true);
    } finally {
      setGeneratingPdf(false);
      setMenuVisible(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedMonth, selectedYear]);

  const renderMonthlyReport = () => {
    if (!reportData?.data) return null;

    return (
      <View>
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.income?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.expenses?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.netCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.net?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {reportData.data.summary?.goalStatus && (
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
                          (reportData.data.summary.goalStatus.progress / reportData.data.summary.goalStatus.target) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.goalText}>
                  ${reportData.data.summary.goalStatus.progress.toFixed(2)} / $
                  {reportData.data.summary.goalStatus.target.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.goalStatus,
                    reportData.data.summary.goalStatus.achieved
                      ? styles.achieved
                      : styles.pending,
                  ]}
                >
                  {reportData.data.summary.goalStatus.achieved
                    ? "🎉 Goal Achieved!"
                    : `$${reportData.data.summary.goalStatus.remaining.toFixed(2)} to go`}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Income by Category</Title>
            {Object.entries(reportData.data.analytics?.categoryBreakdown?.income || {}).map(
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
            {Object.entries(reportData.data.analytics?.categoryBreakdown?.expenses || {}).map(
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
    if (!reportData?.data) return null;

    return (
      <View>
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.income?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.expenses?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.netCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net Savings</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.net?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Goals Achievement</Title>
            <View style={styles.goalsAchievement}>
              <Text style={styles.achievementText}>
                {reportData.data.summary?.achievedGoals || 0} / {reportData.data.summary?.totalGoals || 0} goals achieved
              </Text>
              <Text style={styles.achievementRate}>
                {reportData.data.summary?.goalsAchievementRate?.toFixed(1) || 0}% success rate
              </Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Monthly Breakdown</Title>
            {Object.entries(reportData.data.monthlyBreakdown || {}).map(
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

  const renderCategoryReport = () => {
    if (!reportData?.data) return null;

    return (
      <View>
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, styles.incomeCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.totalIncome?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.expenseCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.totalExpenses?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.netCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net Income</Text>
              <Text style={styles.summaryAmount}>
                ${reportData.data.summary?.netIncome?.toFixed(2) || "0.00"}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Income Categories</Title>
            {reportData.data.incomeCategories?.map((category: any) => (
              <View key={category.category} style={styles.categoryDetailItem}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.category}</Text>
                  <Text style={styles.incomeAmount}>${category.amount.toFixed(2)}</Text>
                </View>
                <View style={styles.percentageBar}>
                  <View 
                    style={[
                      styles.percentageFill,
                      { width: `${Math.min(category.percentage, 100)}%`, backgroundColor: '#10B981' }
                    ]} 
                  />
                </View>
                <Text style={styles.percentageText}>{category.percentage.toFixed(1)}% of income</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Expense Categories</Title>
            {reportData.data.expenseCategories?.map((category: any) => (
              <View key={category.category} style={styles.categoryDetailItem}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.category}</Text>
                  <Text style={styles.expenseAmount}>${category.amount.toFixed(2)}</Text>
                </View>
                <View style={styles.percentageBar}>
                  <View 
                    style={[
                      styles.percentageFill,
                      { width: `${Math.min(category.percentage, 100)}%`, backgroundColor: '#EF4444' }
                    ]} 
                  />
                </View>
                <Text style={styles.percentageText}>{category.percentage.toFixed(1)}% of expenses</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderGoalReport = () => {
    if (!reportData?.data) return null;

    return (
      <View>
        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Total Goals</Text>
              <Text style={styles.summaryAmount}>
                {reportData.data.summary?.totalGoals || 0}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.achievedCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Achieved</Text>
              <Text style={styles.summaryAmount}>
                {reportData.data.summary?.achievedGoals || 0}
              </Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Success Rate</Text>
              <Text style={styles.summaryAmount}>
                {reportData.data.summary?.achievementRate?.toFixed(1) || 0}%
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Goal Details</Title>
            {reportData.data.goals?.map((goal: any) => (
              <View key={goal.id} style={styles.goalDetailItem}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalTitle}>
                    {months[goal.target_month - 1]} {goal.target_year}
                  </Text>
                  <Text style={[
                    styles.goalStatus,
                    goal.achieved ? styles.achieved : styles.pending
                  ]}>
                    {goal.achieved ? "✅ Achieved" : "🔄 In Progress"}
                  </Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(goal.progressPercentage, 100)}%`,
                          backgroundColor: goal.achieved ? '#10B981' : '#6366F1'
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    ${goal.progress.toFixed(2)} / ${goal.target_amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.progressPercentage}>
                  {goal.progressPercentage.toFixed(1)}% Complete
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderHealthReport = () => {
    if (!reportData?.data) return null;

    const getHealthColor = (score: number) => {
      if (score >= 80) return '#10B981';
      if (score >= 60) return '#3B82F6';
      if (score >= 40) return '#F59E0B';
      return '#EF4444';
    };

    return (
      <View>
        <Card style={styles.card}>
          <Card.Content style={styles.healthHeader}>
            <View style={styles.healthScoreContainer}>
              <Text style={styles.healthScoreLabel}>Financial Health Score</Text>
              <Text style={[styles.healthScore, { color: getHealthColor(reportData.data.healthScore) }]}>
                {reportData.data.healthScore.toFixed(1)}
              </Text>
              <Text style={[styles.healthStatus, { color: getHealthColor(reportData.data.healthScore) }]}>
                {reportData.data.healthStatus}
              </Text>
            </View>
            <Text style={styles.healthDescription}>
              {reportData.data.healthDescription}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Key Metrics</Title>
            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Savings Rate</Text>
                <Text style={styles.metricValue}>
                  {reportData.data.metrics?.savingsRate?.toFixed(1)}%
                </Text>
                <Text style={styles.metricAssessment}>
                  {reportData.data.metrics?.savingsRate >= 20 ? '✅ Good' : '⚠️ Needs Improvement'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Expense Ratio</Text>
                <Text style={styles.metricValue}>
                  {reportData.data.metrics?.expenseRatio?.toFixed(1)}%
                </Text>
                <Text style={styles.metricAssessment}>
                  {reportData.data.metrics?.expenseRatio <= 80 ? '✅ Good' : '⚠️ Needs Improvement'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Monthly Consistency</Text>
                <Text style={styles.metricValue}>
                  {reportData.data.metrics?.consistencyScore?.toFixed(1)}%
                </Text>
                <Text style={styles.metricAssessment}>
                  {reportData.data.metrics?.consistencyScore >= 50 ? '✅ Good' : '⚠️ Needs Improvement'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Goal Achievement</Text>
                <Text style={styles.metricValue}>
                  {reportData.data.metrics?.goalAchievementRate?.toFixed(1)}%
                </Text>
                <Text style={styles.metricAssessment}>
                  {reportData.data.metrics?.goalAchievementRate >= 60 ? '✅ Good' : '⚠️ Needs Improvement'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Recommendations</Title>
            {reportData.data.recommendations?.map((recommendation: string, index: number) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationBullet}>•</Text>
                <Text style={styles.recommendationText}>{recommendation}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Financial Summary</Title>
            <View style={styles.financialSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Income</Text>
                <Text style={styles.summaryValue}>
                  ${reportData.data.summary?.income?.toFixed(2) || "0.00"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Expenses</Text>
                <Text style={styles.summaryValue}>
                  ${reportData.data.summary?.expenses?.toFixed(2) || "0.00"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net Savings</Text>
                <Text style={styles.summaryValue}>
                  ${reportData.data.summary?.net?.toFixed(2) || "0.00"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Goals Achieved</Text>
                <Text style={styles.summaryValue}>
                  {reportData.data.summary?.achievedGoals || 0}/{reportData.data.summary?.totalGoals || 0}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case "monthly":
        return renderMonthlyReport();
      case "yearly":
        return renderYearlyReport();
      case "category":
        return renderCategoryReport();
      case "goals":
        return renderGoalReport();
      case "health":
        return renderHealthReport();
      default:
        return null;
    }
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
            onValueChange={(value) => setReportType(value as any)}
            buttons={reportTypes}
            style={styles.segmentedButtons}
          />

          {(reportType === "monthly" || reportType === "category") ? (
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

          <View style={styles.actionButtons}>
            <Button 
              mode="outlined" 
              onPress={handleSync} 
              style={styles.syncButton}
              icon="sync"
            >
              Sync
            </Button>
            
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button 
                  mode="contained" 
                  onPress={() => setMenuVisible(true)}
                  style={styles.pdfButton}
                  icon="file-pdf-box"
                  loading={generatingPdf}
                  disabled={generatingPdf}
                >
                  PDF
                </Button>
              }
            >
              <Menu.Item 
                onPress={generatePdf}
                title="Generate PDF"
                leadingIcon="download"
              />
              <Divider />
              <Menu.Item 
                onPress={() => setMenuVisible(false)}
                title="Cancel"
                leadingIcon="close"
              />
            </Menu>
          </View>
        </View>

        {renderReportContent()}

        {reportData?.data?.generatedAt && (
          <Card style={styles.footerCard}>
            <Card.Content>
              <Text style={styles.generatedText}>
                Report generated on {format(parseISO(reportData.data.generatedAt), "PPpp")}
              </Text>
            </Card.Content>
          </Card>
        )}
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
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  syncButton: {
    flex: 1,
  },
  pdfButton: {
    flex: 1,
    backgroundColor: "#EF4444",
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
  achievedCard: {
    backgroundColor: "#D1FAE5",
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
  categoryDetailItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
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
  percentageBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 4,
    overflow: "hidden",
  },
  percentageFill: {
    height: 8,
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    color: "#6B7280",
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
  goalDetailItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  progressPercentage: {
    textAlign: "center",
    color: "#6366F1",
    fontWeight: "600",
  },
  healthHeader: {
    alignItems: "center",
  },
  healthScoreContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  healthScoreLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  healthScore: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 4,
  },
  healthStatus: {
    fontSize: 18,
    fontWeight: "600",
  },
  healthDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  metricsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricItem: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    textAlign: "center",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  metricAssessment: {
    fontSize: 12,
    fontWeight: "500",
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    color: "#6366F1",
    marginRight: 8,
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  financialSummary: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  footerCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: "#F8FAFC",
  },
  generatedText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    fontStyle: "italic",
  },
});