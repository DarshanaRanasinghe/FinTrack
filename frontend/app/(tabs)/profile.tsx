import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Linking } from "react-native";
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_BASE_URL = "http://192.168.8.101:3000/api"; // Update with your actual IP

export default function ProfileScreen() {
  const { user, logout, token } = useAuth();
  const { clearLocalData, syncData, isOnline } = useDatabase();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [sharingPdf, setSharingPdf] = useState<string | null>(null);
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

    if (!token) {
      setSnackbarMessage("Authentication required. Please login again.");
      setSnackbarVisible(true);
      return;
    }

    setGeneratingReport(reportType);
    try {
      let url = '';
      const currentDate = new Date();
      
      switch (reportType) {
        case 'monthly-expenditure':
          url = `${API_BASE_URL}/report/monthly-expenditure?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`;
          break;
        case 'goal-adherence':
          url = `${API_BASE_URL}/report/goal-adherence?year=${currentDate.getFullYear()}`;
          break;
        case 'savings-progress':
          url = `${API_BASE_URL}/report/savings-progress`;
          break;
        case 'category-distribution':
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          url = `${API_BASE_URL}/report/category-distribution?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`;
          break;
        case 'financial-health':
          url = `${API_BASE_URL}/report/financial-health`;
          break;
        default:
          throw new Error('Invalid report type');
      }

      console.log('Fetching report from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Response data:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to generate report');
      }
      
      setCurrentReport(result.data);
      setReportModalVisible(true);
      setSnackbarMessage(`${getReportDisplayName(reportType)} report generated successfully!`);
      setSnackbarVisible(true);
      
    } catch (error: any) {
      console.error('Report generation error:', error);
      setSnackbarMessage(error.message || "Failed to generate report");
      setSnackbarVisible(true);
    } finally {
      setGeneratingReport(null);
    }
  };

  const generatePdfHtml = (reportData: any, reportType: string) => {
    const reportName = getReportDisplayName(reportType);
    const currentDate = new Date().toLocaleDateString();
    
    if (reportData.health_metrics) {
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366F1; padding-bottom: 10px; }
              .title { font-size: 24px; font-weight: bold; color: #1F2937; margin-bottom: 5px; }
              .subtitle { font-size: 14px; color: #6B7280; }
              .metrics-grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .metric-card { flex: 1; margin: 0 10px; padding: 15px; border: 1px solid #E5E7EB; border-radius: 8px; text-align: center; }
              .metric-value { font-size: 24px; font-weight: bold; color: #6366F1; }
              .metric-label { font-size: 12px; color: #6B7280; margin-top: 5px; }
              .health-status { text-align: center; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; }
              .excellent { background-color: #D1FAE5; color: #065F46; }
              .good { background-color: #DBEAFE; color: #1E40AF; }
              .fair { background-color: #FEF3C7; color: #92400E; }
              .poor { background-color: #FEE2E2; color: #991B1B; }
              .additional-metrics { background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .metric-item { margin-bottom: 8px; display: flex; justify-content: space-between; }
              .metric-item .label { font-weight: 600; }
              .positive { color: #10B981; }
              .negative { color: #EF4444; }
              .recommendations { background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin-top: 20px; }
              .recommendations-title { font-weight: bold; margin-bottom: 10px; }
              .recommendation { margin-bottom: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">${reportName} Report</div>
              <div class="subtitle">Generated on ${currentDate}</div>
            </div>
            
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-value">${reportData.health_metrics.health_score?.toFixed(1) || 0}/100</div>
                <div class="metric-label">Health Score</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.health_metrics.savings_rate?.toFixed(1) || 0}%</div>
                <div class="metric-label">Savings Rate</div>
              </div>
            </div>
            
            <div class="health-status ${reportData.health_metrics.health_status?.toLowerCase() || 'poor'}">
              Status: ${reportData.health_metrics.health_status || 'POOR'}
            </div>
            
            <div class="additional-metrics">
              <div class="metric-item">
                <span class="label">Total Income:</span>
                <span>$${(reportData.health_metrics.total_income || 0).toFixed(2)}</span>
              </div>
              <div class="metric-item">
                <span class="label">Total Expenses:</span>
                <span>$${(reportData.health_metrics.total_expenses || 0).toFixed(2)}</span>
              </div>
              <div class="metric-item">
                <span class="label">Net Income:</span>
                <span class="${(reportData.health_metrics.net_income || 0) >= 0 ? 'positive' : 'negative'}">
                  $${(reportData.health_metrics.net_income || 0).toFixed(2)}
                </span>
              </div>
              <div class="metric-item">
                <span class="label">Goal Achievement:</span>
                <span>${(reportData.health_metrics.goal_achievement_rate || 0).toFixed(1)}%</span>
              </div>
            </div>

            ${reportData.recommendations ? `
              <div class="recommendations">
                <div class="recommendations-title">Recommendations:</div>
                ${reportData.recommendations.map((rec: string) => `<div class="recommendation">• ${rec}</div>`).join('')}
              </div>
            ` : ''}
          </body>
        </html>
      `;
    }

    if (reportData.categories) {
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366F1; padding-bottom: 10px; }
              .title { font-size: 24px; font-weight: bold; color: #1F2937; margin-bottom: 5px; }
              .subtitle { font-size: 14px; color: #6B7280; }
              .summary { background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
              .category-item { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #E5E7EB; }
              .category-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
              .category-name { font-weight: bold; }
              .category-amount { color: #EF4444; font-weight: bold; }
              .category-details { display: flex; justify-content: space-between; font-size: 12px; color: #6B7280; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">${reportName} Report</div>
              <div class="subtitle">Generated on ${currentDate}</div>
            </div>
            
            <div class="summary">
              <strong>Period:</strong> ${reportData.period?.monthName} ${reportData.period?.year}<br>
              <strong>Total Expenses:</strong> $${(reportData.summary?.total_expenses || 0).toFixed(2)}
            </div>
            
            ${reportData.categories.map((category: any) => `
              <div class="category-item">
                <div class="category-header">
                  <span class="category-name">${category.category}</span>
                  <span class="category-amount">$${(category.total_amount || 0).toFixed(2)}</span>
                </div>
                <div class="category-details">
                  <span>${category.transaction_count || 0} transactions</span>
                  <span>${(category.percentage || 0).toFixed(1)}% of total</span>
                </div>
              </div>
            `).join('')}
          </body>
        </html>
      `;
    }

    // Add similar HTML templates for other report types...

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${reportName} Report</h1>
          <p>Generated on ${currentDate}</p>
          <p>Report data is available in the app view.</p>
        </body>
      </html>
    `;
  };

  const sharePdf = async (reportType: string) => {
    if (!isOnline) {
      setSnackbarMessage("You need to be online to share PDF reports");
      setSnackbarVisible(true);
      return;
    }

    if (!token) {
      setSnackbarMessage("Authentication required. Please login again.");
      setSnackbarVisible(true);
      return;
    }

    setSharingPdf(reportType);
    try {
      // First, get the report data
      let url = '';
      const currentDate = new Date();
      
      switch (reportType) {
        case 'monthly-expenditure':
          url = `${API_BASE_URL}/report/monthly-expenditure?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`;
          break;
        case 'goal-adherence':
          url = `${API_BASE_URL}/report/goal-adherence?year=${currentDate.getFullYear()}`;
          break;
        case 'savings-progress':
          url = `${API_BASE_URL}/report/savings-progress`;
          break;
        case 'category-distribution':
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          url = `${API_BASE_URL}/report/category-distribution?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`;
          break;
        case 'financial-health':
          url = `${API_BASE_URL}/report/financial-health`;
          break;
        default:
          throw new Error('Invalid report type');
      }

      console.log('Fetching report data for PDF from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to generate report');
      }

      // Generate PDF from HTML using expo-print
      const html = generatePdfHtml(result.data, reportType);
      
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false
      });

      console.log('PDF generated at:', uri);
      
      // Share the PDF using expo-sharing
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${getReportDisplayName(reportType)} Report`,
          UTI: 'com.adobe.pdf'
        });
        setSnackbarMessage(`${getReportDisplayName(reportType)} PDF shared successfully!`);
      } else {
        setSnackbarMessage("Sharing not available on this device");
      }
      setSnackbarVisible(true);
      
    } catch (error: any) {
      console.error('PDF sharing error:', error);
      setSnackbarMessage(error.message || "Failed to share PDF");
      setSnackbarVisible(true);
    } finally {
      setSharingPdf(null);
    }
  };

  const getReportDisplayName = (reportType: string) => {
    const names: { [key: string]: string } = {
      'monthly-expenditure': 'Monthly Expenditure',
      'goal-adherence': 'Goal Adherence',
      'savings-progress': 'Savings Progress',
      'category-distribution': 'Category Distribution',
      'financial-health': 'Financial Health'
    };
    return names[reportType] || reportType;
  };

  const getReportIcon = (reportType: string) => {
    const icons: { [key: string]: string } = {
      'monthly-expenditure': 'chart-bar',
      'goal-adherence': 'flag-checkered',
      'savings-progress': 'trending-up',
      'category-distribution': 'tag-multiple',
      'financial-health': 'heart-pulse'
    };
    return icons[reportType] || 'file-document';
  };

  const renderReportContent = () => {
    if (!currentReport) {
      return (
        <View style={styles.noReportContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.noReportText}>Loading report...</Text>
        </View>
      );
    }

    if (currentReport.health_metrics) {
      return (
        <View>
          <Title style={styles.reportTitle}>Financial Health Report</Title>
          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard}>
              <Card.Content>
                <Text style={styles.metricValue}>{currentReport.health_metrics.health_score?.toFixed(1) || 0}/100</Text>
                <Text style={styles.metricLabel}>Health Score</Text>
              </Card.Content>
            </Card>
            <Card style={styles.metricCard}>
              <Card.Content>
                <Text style={styles.metricValue}>{currentReport.health_metrics.savings_rate?.toFixed(1) || 0}%</Text>
                <Text style={styles.metricLabel}>Savings Rate</Text>
              </Card.Content>
            </Card>
          </View>
          <Text style={[
            styles.healthStatus,
            currentReport.health_metrics.health_status === 'EXCELLENT' ? styles.excellentStatus :
            currentReport.health_metrics.health_status === 'GOOD' ? styles.goodStatus :
            currentReport.health_metrics.health_status === 'FAIR' ? styles.fairStatus :
            styles.poorStatus
          ]}>
            Status: {currentReport.health_metrics.health_status || 'POOR'}
          </Text>
          
          <View style={styles.additionalMetrics}>
            <Text style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Income: </Text>
              <Text style={styles.metricValue}>${(currentReport.health_metrics.total_income || 0).toFixed(2)}</Text>
            </Text>
            <Text style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Expenses: </Text>
              <Text style={styles.metricValue}>${(currentReport.health_metrics.total_expenses || 0).toFixed(2)}</Text>
            </Text>
            <Text style={styles.metricItem}>
              <Text style={styles.metricLabel}>Net Income: </Text>
              <Text style={[
                styles.metricValue,
                (currentReport.health_metrics.net_income || 0) >= 0 ? styles.positive : styles.negative
              ]}>
                ${(currentReport.health_metrics.net_income || 0).toFixed(2)}
              </Text>
            </Text>
            <Text style={styles.metricItem}>
              <Text style={styles.metricLabel}>Goal Achievement: </Text>
              <Text style={styles.metricValue}>{(currentReport.health_metrics.goal_achievement_rate || 0).toFixed(1)}%</Text>
            </Text>
          </View>

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
            {currentReport.period?.monthName} {currentReport.period?.year}
          </Text>
          <Text style={styles.summaryText}>
            Total Expenses: ${(currentReport.summary?.total_expenses || 0).toFixed(2)}
          </Text>
          {currentReport.categories.map((category: any, index: number) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category.category}</Text>
                <Text style={styles.categoryAmount}>${(category.total_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.categoryDetails}>
                <Text style={styles.categoryDetail}>{category.transaction_count || 0} transactions</Text>
                <Text style={styles.categoryDetail}>{(category.percentage || 0).toFixed(1)}% of total</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (currentReport.goals) {
      return (
        <View>
          <Title style={styles.reportTitle}>Goal Adherence Report</Title>
          <Text style={styles.periodText}>Year: {currentReport.period?.year}</Text>
          <Text style={styles.summaryText}>
            Achievement Rate: {(currentReport.summary?.achievement_rate || 0).toFixed(1)}%
          </Text>
          {currentReport.goals.map((goal: any, index: number) => (
            <View key={index} style={styles.goalItem}>
              <Text style={styles.goalMonth}>
                {new Date(2000, (goal.target_month || 1) - 1, 1).toLocaleString('default', { month: 'long' })} {goal.target_year}
              </Text>
              <View style={styles.goalProgress}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { 
                        width: `${Math.min(goal.achievement_rate || 0, 100)}%`,
                        backgroundColor: goal.status === 'ACHIEVED' ? '#10B981' : 
                                        goal.status === 'NEAR_TARGET' ? '#F59E0B' : '#EF4444'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.goalAmounts}>
                  ${(goal.actual_savings || 0).toFixed(2)} / ${(goal.target_amount || 0).toFixed(2)}
                </Text>
              </View>
              <Text style={[
                styles.goalStatus,
                goal.status === 'ACHIEVED' ? styles.achievedStatus :
                goal.status === 'NEAR_TARGET' ? styles.nearStatus :
                styles.belowStatus
              ]}>
                {goal.status ? goal.status.replace('_', ' ') : 'BELOW TARGET'}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    if (currentReport.current_goals) {
      return (
        <View>
          <Title style={styles.reportTitle}>Savings Progress Report</Title>
          <Text style={styles.periodText}>
            {currentReport.period?.monthName} {currentReport.period?.year}
          </Text>
          {currentReport.current_goals.map((goal: any, index: number) => (
            <View key={index} style={styles.goalItem}>
              <Text style={styles.goalMonth}>
                {new Date(2000, (goal.target_month || 1) - 1, 1).toLocaleString('default', { month: 'long' })} {goal.target_year}
              </Text>
              <View style={styles.goalProgress}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { 
                        width: `${Math.min(goal.progress_percentage || 0, 100)}%`,
                        backgroundColor: goal.status === 'ACHIEVED' ? '#10B981' : '#6366F1'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.goalAmounts}>
                  ${(goal.current_savings || 0).toFixed(2)} / ${(goal.target_amount || 0).toFixed(2)}
                </Text>
              </View>
              <Text style={[
                styles.goalStatus,
                goal.status === 'ACHIEVED' ? styles.achievedStatus : styles.inProgressStatus
              ]}>
                {goal.status || 'IN PROGRESS'}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.noReportContainer}>
        <Text style={styles.noReportText}>No report data available</Text>
      </View>
    );
  };

  const ReportButtonPair = ({ reportType }: { reportType: string }) => (
    <View style={styles.reportButtonPair}>
      <Button
        mode="outlined"
        onPress={() => generateReport(reportType)}
        style={styles.viewReportButton}
        icon={getReportIcon(reportType)}
        loading={generatingReport === reportType}
        disabled={!!generatingReport}
      >
        View
      </Button>
      <Button
        mode="contained"
        onPress={() => sharePdf(reportType)}
        style={styles.sharePdfButton}
        icon="share"
        loading={sharingPdf === reportType}
        disabled={!!sharingPdf}
        buttonColor="#06B6D4"
      >
        Share PDF
      </Button>
    </View>
  );

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

      {/* Financial Reports */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Financial Reports</Title>
          <Text style={styles.sectionDescription}>
            Generate and share detailed financial reports. View them in the app or share as PDF files.
          </Text>
          
          {/* Monthly Expenditure Report */}
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>📊 Monthly Expenditure</Text>
            <Text style={styles.reportSectionDescription}>
              Detailed breakdown of your monthly spending by category
            </Text>
            <ReportButtonPair reportType="monthly-expenditure" />
          </View>

          <Divider style={styles.reportDivider} />

          {/* Goal Adherence Report */}
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>🎯 Goal Adherence</Text>
            <Text style={styles.reportSectionDescription}>
              Track your progress towards financial goals
            </Text>
            <ReportButtonPair reportType="goal-adherence" />
          </View>

          <Divider style={styles.reportDivider} />

          {/* Savings Progress Report */}
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>💰 Savings Progress</Text>
            <Text style={styles.reportSectionDescription}>
              Monitor your savings growth and target achievement
            </Text>
            <ReportButtonPair reportType="savings-progress" />
          </View>

          <Divider style={styles.reportDivider} />

          {/* Category Distribution Report */}
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>📈 Category Distribution</Text>
            <Text style={styles.reportSectionDescription}>
              Analyze spending patterns across different categories
            </Text>
            <ReportButtonPair reportType="category-distribution" />
          </View>

          <Divider style={styles.reportDivider} />

          {/* Financial Health Report */}
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>❤️ Financial Health</Text>
            <Text style={styles.reportSectionDescription}>
              Comprehensive assessment of your financial well-being
            </Text>
            <ReportButtonPair reportType="financial-health" />
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
            onPress={() => {
              Alert.alert(
                "Clear Local Data",
                "This will delete all your local transactions and goals. This action cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", onPress: handleClearData, style: "destructive" }
                ]
              );
            }}
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
            onPress={() => {
              Alert.alert(
                "Logout",
                "Are you sure you want to logout?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Logout", onPress: handleLogout, style: "destructive" }
                ]
              );
            }}
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
              Close Report
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
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
    marginBottom: 20,
    lineHeight: 20,
  },
  reportSection: {
    marginBottom: 20,
  },
  reportSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  reportSectionDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 16,
  },
  reportButtonPair: {
    flexDirection: "row",
    gap: 12,
  },
  viewReportButton: {
    flex: 1,
  },
  sharePdfButton: {
    flex: 1,
  },
  reportDivider: {
    marginVertical: 16,
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
  noReportContainer: {
    alignItems: "center",
    padding: 20,
  },
  noReportText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6B7280",
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
  additionalMetrics: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  metricItem: {
    fontSize: 14,
    marginBottom: 8,
  },
  positive: {
    color: "#10B981",
    fontWeight: "600",
  },
  negative: {
    color: "#EF4444",
    fontWeight: "600",
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    padding: 8,
    borderRadius: 8,
  },
  excellentStatus: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  goodStatus: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
  },
  fairStatus: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  poorStatus: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
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
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 16,
  },
  categoryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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
  categoryDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryDetail: {
    fontSize: 12,
    color: "#6B7280",
  },
  goalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  goalMonth: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  goalProgress: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  goalAmounts: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  goalStatus: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    padding: 4,
    borderRadius: 4,
  },
  achievedStatus: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  nearStatus: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  belowStatus: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  inProgressStatus: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
  },
  closeButton: {
    marginTop: 16,
  },
});