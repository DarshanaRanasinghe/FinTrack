import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  Card,
  Button,
  FAB,
  TextInput,
  Snackbar,
  ActivityIndicator,
} from "react-native-paper";
import { useDatabase } from "../../contexts/DatabaseContext";
import { safeFormatDate, isValidDateString } from "../../utils/dateUtils";

interface Transaction {
  id: number;
  amount: number;
  desc: string;
  description?: string;
  type: string;
  category: string;
  transaction_date: string;
  date?: string;
}

export default function TransactionsScreen() {
  const {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    syncData
  } = useDatabase();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  
  const [formData, setFormData] = useState({
    amount: "",
    desc: "",
    type: "expense",
    category: "",
    date: new Date().toISOString().split('T')[0],
  });

  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading transactions:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
  };

  const handleAddTransaction = () => {
    setSelectedTransaction(null);
    setFormData({
      amount: "",
      desc: "",
      type: "expense",
      category: "",
      date: new Date().toISOString().split('T')[0],
    });
    setModalVisible(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    if (!transaction?.id) {
      console.error("Invalid transaction object:", transaction);
      return;
    }

    setSelectedTransaction(transaction);
    setFormData({
      amount: transaction.amount?.toString() || "",
      desc: transaction.desc || transaction.description || "",
      type: transaction.type || "expense",
      category: transaction.category || "",
      date: transaction.transaction_date || transaction.date || new Date().toISOString().split('T')[0],
    });
    setModalVisible(true);
  };

  const handleSaveTransaction = async () => {
    if (!formData.amount || !formData.desc || !formData.category || !formData.date) {
      setSnackbarMessage("Please fill in all fields");
      setSnackbarVisible(true);
      return;
    }

    if (!isValidDateString(formData.date)) {
      setSnackbarMessage("Please enter a valid date in YYYY-MM-DD format");
      setSnackbarVisible(true);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setSnackbarMessage("Please enter a valid amount");
      setSnackbarVisible(true);
      return;
    }

    try {
      const transactionData = {
        ...formData,
        amount: amount,
      };

      if (selectedTransaction?.id) {
        await updateTransaction(selectedTransaction.id, transactionData);
        setSnackbarMessage("Transaction updated successfully!");
      } else {
        await addTransaction(transactionData);
        setSnackbarMessage("Transaction added successfully!");
      }
      
      setModalVisible(false);
      setSnackbarVisible(true);
      await loadTransactions();
      await syncData();
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to save transaction");
      setSnackbarVisible(true);
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    if (!transaction?.id) {
      console.error("Invalid transaction for deletion:", transaction);
      return;
    }

    Alert.alert(
      "Delete Transaction",
      `Are you sure you want to delete "${transaction.desc || transaction.description}"?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(transaction.id);
              setSnackbarMessage("Transaction deleted successfully!");
              setSnackbarVisible(true);
              await loadTransactions();
              await syncData();
            } catch (error: any) {
              setSnackbarMessage(error.message || "Failed to delete transaction");
              setSnackbarVisible(true);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Safe grouping function
  const getGroupedTransactions = () => {
    if (!Array.isArray(transactions)) {
      return {};
    }

    return transactions.reduce((groups: any, transaction) => {
      if (!transaction || typeof transaction !== 'object') {
        return groups;
      }

      const date = transaction.transaction_date || transaction.date;
      if (date && isValidDateString(date)) {
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(transaction);
      } else {
        if (!groups['Invalid Date']) {
          groups['Invalid Date'] = [];
        }
        groups['Invalid Date'].push(transaction);
      }
      return groups;
    }, {});
  };

  const groupedTransactions = getGroupedTransactions();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
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
        {Object.keys(groupedTransactions).length > 0 ? (
          Object.entries(groupedTransactions)
            .sort(([a], [b]) => {
              if (a === 'Invalid Date') return 1;
              if (b === 'Invalid Date') return -1;
              return new Date(b).getTime() - new Date(a).getTime();
            })
            .map(([date, dayTransactions]: [string, any]) => (
              <Card key={date} style={styles.dayCard}>
                <View style={styles.cardContent}>
                  <Text style={styles.dateTitle}>
                    {date === 'Invalid Date'
                      ? 'Invalid Date'
                      : safeFormatDate(date, "EEEE, MMMM d, yyyy")
                    }
                  </Text>
                  {(dayTransactions as Transaction[]).map((transaction) => {
                    if (!transaction || !transaction.id) {
                      return null;
                    }

                    return (
                      <View key={transaction.id} style={styles.transactionItem}>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.transactionDescription}>
                            {transaction.desc || transaction.description || "No description"}
                          </Text>
                          <Text style={styles.transactionCategory}>
                            {transaction.category || "Uncategorized"}
                          </Text>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text
                            style={[
                              styles.transactionAmount,
                              transaction.type === "income"
                                ? styles.incomeText
                                : styles.expenseText,
                            ]}
                          >
                            {transaction.type === "income" ? "+" : "-"}$
                            {(transaction.amount || 0).toFixed(2)}
                          </Text>
                          <View style={styles.actionButtons}>
                            <Button
                              mode="text"
                              compact
                              onPress={() => handleEditTransaction(transaction)}
                              style={styles.actionButton}
                              icon="pencil"
                            >
                              {""}
                            </Button>
                            <Button
                              mode="text"
                              compact
                              onPress={() => handleDeleteTransaction(transaction)}
                              style={styles.actionButton}
                              icon="delete"
                              textColor="#EF4444"
                            >
                              {""}
                            </Button>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>
            ))
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first transaction to get started
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddTransaction}
        color="white"
      />

      {/* Add/Edit Transaction Modal */}
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {selectedTransaction ? "Edit Transaction" : "Add Transaction"}
              </Text>
              
              <View style={styles.typeButtons}>
                <Button
                  mode={formData.type === "expense" ? "contained" : "outlined"}
                  onPress={() => setFormData({ ...formData, type: "expense" })}
                  style={styles.typeButton}
                >
                  Expense
                </Button>
                <Button
                  mode={formData.type === "income" ? "contained" : "outlined"}
                  onPress={() => setFormData({ ...formData, type: "income" })}
                  style={styles.typeButton}
                >
                  Income
                </Button>
              </View>

              <TextInput
                label="Amount"
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                mode="outlined"
                style={styles.input}
                keyboardType="numeric"
                placeholder="0.00"
              />
              <TextInput
                label="Description"
                value={formData.desc}
                onChangeText={(text) => setFormData({ ...formData, desc: text })}
                mode="outlined"
                style={styles.input}
                placeholder="Enter description"
              />
              <TextInput
                label="Category"
                value={formData.category}
                onChangeText={(text) => setFormData({ ...formData, category: text })}
                mode="outlined"
                style={styles.input}
                placeholder="e.g., Food, Salary"
              />
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
                mode="outlined"
                style={styles.input}
                placeholder="2024-01-01"
                error={!isValidDateString(formData.date)}
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
                  onPress={handleSaveTransaction}
                  style={styles.modalButton}
                  disabled={!isValidDateString(formData.date)}
                >
                  {selectedTransaction ? "Update" : "Save"}
                </Button>
              </View>
            </View>
          </Card>
        </View>
      )}

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
  dayCard: {
    margin: 8,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardContent: {
    padding: 16,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 12,
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
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 4,
    fontWeight: "500",
  },
  transactionCategory: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  incomeText: {
    color: "#10B981",
  },
  expenseText: {
    color: "#EF4444",
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    marginHorizontal: 2,
    minWidth: 40,
  },
  emptyCard: {
    margin: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
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
    borderRadius: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 8,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 20,
    color: "#1F2937",
    fontSize: 20,
    fontWeight: "700",
  },
  typeButtons: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  typeButton: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
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