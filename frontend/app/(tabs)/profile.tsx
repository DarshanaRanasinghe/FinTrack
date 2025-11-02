import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  Card,
  Title,
  Button,
  Divider,
  Snackbar,
  ActivityIndicator,
  Modal,
  Portal,
} from "react-native-paper";
import { useAuth } from "../../contexts/AuthContext";
import { useDatabase } from "../../contexts/DatabaseContext";
import { format, parseISO } from "date-fns";

export default function ProfileScreen() {
  const { user, logout, token } = useAuth();
  const { clearLocalData, syncData, isOnline } = useDatabase();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);

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

  const generateReport = async (reportType: string) => {
    if (!isOnline) {
      setSnackbarMessage("You need to be online to generate reports");
      setSnackbarVisible(true);
      return;
    }

    setGeneratingReport(true);
    try {
      let url = '';
      const currentDate = new Date();
      
      switch (reportType) {
        case 'monthly-expenditure':
          url = `http://192.168.1.3:3000/api/report/monthly-expenditure?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`;
          break;
        case 'goal-adherence':
          url = `http://192.168.1.3:3000/api/report/goal-adherence?year=${currentDate.getFullYear()}`;
          break;
        case 'savings-progress':
          url = `http://192.168.1.3:3000/api/report/savings-progress`;
          break;
        case 'category-distribution':
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          url = `http://192.168.1.3:3000/api/report/category-distribution?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`;
          break;
        case 'financial-health':
          url = `http://192.168.1.3:3000/api/report/financial-health`;
          break;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const result = await response.json();
      setCurrentReport(result.data);
      setReportModalVisible(true);
      
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to generate report");
      setSnackbarVisible(true);
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadPDF = async (reportType: string) => {
    if (!isOnline) {
      setSnackbarMessage("You need to be online to download PDF");
      setSnackbarVisible(true);
      return;
    }

    try {
      let url = '';
      const currentDate = new Date();
      
      switch (reportType) {
        case 'monthly-expenditure':
          url = `http://192.168.1.3:3000/api/report/monthly-expenditure/pdf?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`;
          break;
        case 'financial-health':
          url = `http://192.168.1.3:3000/api/report/financial-health/pdf`;
          break;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      // In a real app, you would handle the PDF download here
      setSnackbarMessage("PDF download initiated!");
      setSnackbarVisible(true);
      
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to download PDF");
      setSnackbarVisible(true);
    }
  };

  const renderReportContent = () => {
    if (!currentReport) return null;

    if (currentReport.health_metrics) {
      return (
        <View>
          <Title style={styles.reportTitle}>Financial Health Report</Title>
          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard}>
              <Card.Content>
                <Text style={styles.metricValue}>{currentReport.health_metrics.health_score}/100</Text>
                <Text style={styles.metricLabel}>Health Score</Text>
              </Card.Content>
            </Card>
            <Card style={styles.metricCard}>
              <Card.Content>
                <Text style={styles.metricValue}>{currentReport.health_metrics.savings_rate}%</Text>
                <Text style={styles.metricLabel}>Savings Rate</Text>
              </Card.Content>
            </Card>
          </View>
          <Text style={styles.healthStatus}>
            Status: {currentReport.health_metrics.health_status}
          </Text>
          {currentReport.recommendations && (
            <View style={styles.recommendations}>
              <Text style={styles.recommendationsTitle}>Recommendations:</Text>
              {currentReport.recommendations.map((rec: string, index: number) => (
                <Text key={index} style={styles.recommendation}>• {rec}</Text>
              ))}
            </View>
          )}
        </View>
      );
    }

    if (currentReport.categories) {
      return (
        <View>
          <Title style={styles.reportTitle}>Monthly Expenditure Report</Title>
          <Text style={styles.periodText}>
            {currentReport.period.monthName} {currentReport.period.year}
          </Text>
          {currentReport.categories.map((category: any, index: number) => (
            <View key={index} style={styles.categoryItem}>
              <Text style={styles.categoryName}>{category.category}</Text>
              <Text style={styles.categoryAmount}>${category.total_amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      );
    }

    return <Text>Report data loaded successfully</Text>;
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

      {/* Report Generation */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Financial Reports</Title>
          <Text style={styles.sectionDescription}>
            Generate detailed financial reports to track your progress and make informed decisions.
          </Text>
          
          <Button
            mode="outlined"
            onPress={() => generateReport('monthly-expenditure')}
            style={styles.reportButton}
            icon="chart-bar"
            loading={generatingReport}
            disabled={generatingReport}
          >
            Monthly Expenditure
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => generateReport('goal-adherence')}
            style={styles.reportButton}
            icon="flag-checkered"
            loading={generatingReport}
            disabled={generatingReport}
          >
            Goal Adherence
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => generateReport('savings-progress')}
            style={styles.reportButton}
            icon="trending-up"
            loading={generatingReport}
            disabled={generatingReport}
          >
            Savings Progress
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => generateReport('category-distribution')}
            style={styles.reportButton}
            icon="tag-multiple"
            loading={generatingReport}
            disabled={generatingReport}
          >
            Category Distribution
          </Button>
          
          <Button
            mode="contained"
            onPress={() => generateReport('financial-health')}
            style={styles.reportButton}
            icon="heart-pulse"
            loading={generatingReport}
            disabled={generatingReport}
          >
            Financial Health
          </Button>

          <View style={styles.pdfButtons}>
            <Button
              mode="text"
              onPress={() => downloadPDF('monthly-expenditure')}
              icon="file-pdf-box"
              disabled={!isOnline}
            >
              Download Monthly PDF
            </Button>
            <Button
              mode="text"
              onPress={() => downloadPDF('financial-health')}
              icon="file-pdf-box"
              disabled={!isOnline}
            >
              Download Health PDF
            </Button>
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

      {/* Report Modal */}
      <Portal>
        <Modal
          visible={reportModalVisible}
          onDismiss={() => setReportModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView style={styles.modalContent}>
            {renderReportContent()}
            <Button
              mode="contained"
              onPress={() => setReportModalVisible(false)}
              style={styles.closeButton}
            >
              Close
            </Button>
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
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  reportButton: {
    marginBottom: 8,
  },
  pdfButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 12,
    maxHeight: "80%",
  },
  modalContent: {
    padding: 20,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    margin: 4,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6366F1",
    textAlign: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
    textAlign: "center",
    marginBottom: 16,
  },
  recommendations: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 20,
  },
  periodText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryName: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  categoryAmount: {
    fontSize: 16,
    color: "#EF4444",
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 16,
  },
});