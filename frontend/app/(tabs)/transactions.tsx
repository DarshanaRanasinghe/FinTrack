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
  SegmentedButtons,
  Menu,
  Snackbar,
  ActivityIndicator,
} from "react-native-paper";
import { useDatabase } from "../../contexts/DatabaseContext";
import { safeFormatDate, safeParseDate, isValidDateString } from "../../utils/dateUtils";
export default function TransactionsScreen() {
  const {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    syncData
  } = useDatabase();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState<number | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    desc: "",
    type: "expense",
    category: "",
    date: new Date().toISOString().split('T')[0], // Default to today in YYYY-MM-DD format
  });
  const categories = {
    income: ["Salary", "Freelance", "Investment", "Gift", "Other"],
    expense: ["Food", "Transport", "Entertainment", "Bills", "Shopping", "Healthcare", "Other"],
  };
  const loadTransactions = async () => {
    try {
      const data = await getTransactions();
      setTransactions(data);
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
    setEditingTransaction(null);
    setFormData({
      amount: "",
      desc: "",
      type: "expense",
      category: "",
      date: new Date().toISOString().split('T')[0],
    });
    setModalVisible(true);
  };
  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount?.toString() || "",
      desc: transaction.desc || transaction.description || "",
      type: transaction.type || "expense",
      category: transaction.category || "",
      date: transaction.transaction_date || transaction.date || new Date().toISOString().split('T')[0],
    });
    setModalVisible(true);
    setMenuVisible(null);
  };
  const handleSaveTransaction = async () => {
    if (!formData.amount || !formData.desc || !formData.category || !formData.date) {
      setSnackbarMessage("Please fill in all fields");
      setSnackbarVisible(true);
      return;
    }
    // Validate date format
    if (!isValidDateString(formData.date)) {
      setSnackbarMessage("Please enter a valid date in YYYY-MM-DD format");
      setSnackbarVisible(true);
      return;
    }
    // Validate amount
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
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData);
        setSnackbarMessage("Transaction updated successfully!");
      } else {
        await addTransaction(transactionData);
        setSnackbarMessage("Transaction added successfully!");
      }
      setModalVisible(false);
      setSnackbarVisible(true);
      await loadTransactions();
      await syncData(); // Sync with backend
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to save transaction");
      setSnackbarVisible(true);
    }
  };
  const handleDeleteTransaction = async (id: number) => {
    try {
      await deleteTransaction(id);
      setSnackbarMessage("Transaction deleted successfully!");
      setSnackbarVisible(true);
      await loadTransactions();
      await syncData(); // Sync with backend
      setMenuVisible(null);
    } catch (error: any) {
      setSnackbarMessage(error.message || "Failed to delete transaction");
      setSnackbarVisible(true);
    }
  };
  useEffect(() => {
    loadTransactions();
  }, []);
  // Group transactions by date safely
  const groupedTransactions = transactions.reduce((groups: any, transaction) => {
    const date = transaction.transaction_date || transaction.date;
    if (date && isValidDateString(date)) {
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    } else {
      // Handle transactions with invalid dates
      if (!groups['Invalid Date']) {
        groups['Invalid Date'] = [];
      }
      groups['Invalid Date'].push(transaction);
    }
    return groups;
  }, {});
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
        {Object.keys(groupedTransactions).length > 0 ? (
          Object.entries(groupedTransactions)
            .sort(([a], [b]) => {
              if (a === 'Invalid Date') return 1;
              if (b === 'Invalid Date') return -1;
              return new Date(b).getTime() - new Date(a).getTime();
            })
            .map(([date, dayTransactions]: [string, any]) => (
              <Card key={date} style={styles.dayCard}>
                <Card.Content>
                  <Title style={styles.dateTitle}>
                    {date === 'Invalid Date'
                      ? 'Invalid Date'
                      : safeFormatDate(date, "EEEE, MMMM d, yyyy")
                    }
                  </Title>
                  {(dayTransactions as any[]).map((transaction) => (
                    <View key={transaction.id} style={styles.transactionItem}>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionDescription}>
                          {transaction.desc || transaction.description}
                        </Text>
                        <Text style={styles.transactionCategory}>
                          {transaction.category}
                        </Text>
                      </View>
                      <View style={styles.transactionAmountContainer}>
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
                        <Menu
                          visible={menuVisible === transaction.id}
                          onDismiss={() => setMenuVisible(null)}
                          anchor={
                            <Button
                              icon="dots-vertical"
                              onPress={() => setMenuVisible(transaction.id)}
                              mode="text"
                              compact
                            >
                              {""}
                            </Button>
                          }
                        >
                          <Menu.Item
                            onPress={() => handleEditTransaction(transaction)}
                            title="Edit"
                            leadingIcon="pencil"
                          />
                          <Menu.Item
                            onPress={() => handleDeleteTransaction(transaction.id)}
                            title="Delete"
                            leadingIcon="delete"
                          />
                        </Menu>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first transaction to get started
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddTransaction}
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
                  {editingTransaction ? "Edit Transaction" : "Add Transaction"}
                </Title>
                <SegmentedButtons
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  buttons={[
                    { value: "income", label: "Income", icon: "arrow-down" },
                    { value: "expense", label: "Expense", icon: "arrow-up" },
                  ]}
                  style={styles.segmentedButtons}
                />
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
  dayCard: {
    margin: 8,
    marginHorizontal: 16,
    elevation: 2,
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
    paddingVertical: 8,
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
  transactionCategory: {
    fontSize: 12,
    color: "#6B7280",
  },
  transactionAmountContainer: {
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
  segmentedButtons: {
    marginBottom: 16,
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