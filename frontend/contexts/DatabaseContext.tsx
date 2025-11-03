import React, { createContext, useContext, useState, useEffect } from "react";
import * as SQLite from "expo-sqlite";
import axios from "axios";
import { useAuth } from "./AuthContext";
import NetInfo from "@react-native-community/netinfo";
import { isValidDateString } from "@/utils/dateUtils";

const API_BASE_URL = "http://192.168.8.102:3000/api";

interface DatabaseContextType {
  // Transactions
  getTransactions: () => Promise<any[]>;
  addTransaction: (transaction: any) => Promise<number>;
  updateTransaction: (id: number, transaction: any) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  // Goals
  getGoals: () => Promise<any[]>;
  addGoal: (goal: any) => Promise<number>;
  updateGoal: (id: number, goal: any) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  getGoalProgress: (month: number, year: number) => Promise<number>;
  // Reports
  getReports: (month: number, year: number) => Promise<any>;
  getYearlyReports: (year: number) => Promise<any>;
  getCategoryBreakdownReport: (month: number, year: number) => Promise<any>;
  getGoalProgressReport: (year: number) => Promise<any>;
  getFinancialHealthReport: (year: number) => Promise<any>;
  // Dashboard
  getDashboardData: () => Promise<any>;
  // Sync
  syncData: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  // Status
  isOnline: boolean;
  pendingSync: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined
);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    initDatabase();
    setupNetworkListener();
  }, []);

  const setupNetworkListener = () => {
    NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
  };

  const initDatabase = async () => {
    try {
      const database = SQLite.openDatabaseSync("fintrack.db");
      // Create tables
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
       
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          description TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          transaction_date TEXT NOT NULL,
          date_created TEXT DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          sync_status TEXT DEFAULT 'pending',
          server_id INTEGER,
          UNIQUE(server_id, user_id)
        );
       
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          target_amount REAL NOT NULL,
          target_month INTEGER NOT NULL,
          target_year INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          sync_status TEXT DEFAULT 'pending',
          server_id INTEGER,
          UNIQUE(server_id, user_id),
          UNIQUE(user_id, target_month, target_year)
        );
       
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          record_id INTEGER,
          operation TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      setDb(database);
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  };

  // Transaction methods
  const getTransactions = async (): Promise<any[]> => {
    if (!db) return [];
    try {
      const result = await db.getAllAsync(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, date_created DESC",
        [user?.id || 0]
      );
      return result as any[];
    } catch (error) {
      console.error("Error getting transactions:", error);
      return [];
    }
  };

  const addTransaction = async (transaction: any): Promise<number> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      // Validate and format date
      let transactionDate = transaction.date;
      if (!isValidDateString(transactionDate)) {
        // Use current date if invalid
        transactionDate = new Date().toISOString().split("T")[0];
      }

      const result = await db.runAsync(
        "INSERT INTO transactions (amount, description, type, category, transaction_date, user_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          transaction.amount,
          transaction.desc,
          transaction.type,
          transaction.category,
          transactionDate,
          user.id,
          "pending",
        ]
      );
      // Add to sync queue
      await db.runAsync(
        "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
        [
          "transactions",
          result.lastInsertRowId,
          "create",
          JSON.stringify({
            ...transaction,
            date: transactionDate,
          }),
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const updateTransaction = async (
    id: number,
    transaction: any
  ): Promise<void> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      await db.runAsync(
        "UPDATE transactions SET amount = ?, description = ?, type = ?, category = ?, transaction_date = ?, sync_status = ? WHERE id = ? AND user_id = ?",
        [
          transaction.amount,
          transaction.desc,
          transaction.type,
          transaction.category,
          transaction.date,
          "pending",
          id,
          user.id,
        ]
      );
      // Add to sync queue
      await db.runAsync(
        "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
        ["transactions", id, "update", JSON.stringify(transaction)]
      );
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  };

  const deleteTransaction = async (id: number): Promise<void> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      // Check if transaction exists and belongs to user
      const existing = await db.getFirstAsync(
        "SELECT server_id FROM transactions WHERE id = ? AND user_id = ?",
        [id, user.id]
      );
      if (!existing) {
        throw new Error("Transaction not found");
      }
      await db.runAsync(
        "DELETE FROM transactions WHERE id = ? AND user_id = ?",
        [id, user.id]
      );
      // Add to sync queue if it was synced before
      if (existing.server_id) {
        await db.runAsync(
          "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
          [
            "transactions",
            id,
            "delete",
            JSON.stringify({ server_id: existing.server_id }),
          ]
        );
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  };

  // Goal methods
  const getGoals = async (): Promise<any[]> => {
    if (!db || !user) return [];
    try {
      const result = await db.getAllAsync(
        "SELECT * FROM goals WHERE user_id = ? ORDER BY target_year DESC, target_month DESC",
        [user.id]
      );
      return result as any[];
    } catch (error) {
      console.error("Error getting goals:", error);
      return [];
    }
  };

  const addGoal = async (goal: any): Promise<number> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      const result = await db.runAsync(
        "INSERT INTO goals (target_amount, target_month, target_year, user_id, sync_status) VALUES (?, ?, ?, ?, ?)",
        [
          goal.target_amount,
          goal.target_month,
          goal.target_year,
          user.id,
          "pending",
        ]
      );
      // Add to sync queue
      await db.runAsync(
        "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
        ["goals", result.lastInsertRowId, "create", JSON.stringify(goal)]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error("Error adding goal:", error);
      throw error;
    }
  };

  const updateGoal = async (id: number, goal: any): Promise<void> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      await db.runAsync(
        "UPDATE goals SET target_amount = ?, target_month = ?, target_year = ?, sync_status = ? WHERE id = ? AND user_id = ?",
        [
          goal.target_amount,
          goal.target_month,
          goal.target_year,
          "pending",
          id,
          user.id,
        ]
      );
      // Add to sync queue
      await db.runAsync(
        "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
        ["goals", id, "update", JSON.stringify(goal)]
      );
    } catch (error) {
      console.error("Error updating goal:", error);
      throw error;
    }
  };

  const deleteGoal = async (id: number): Promise<void> => {
    if (!db) throw new Error("Database not initialized");
    if (!user) throw new Error("User not authenticated");
    try {
      // Check if goal exists and belongs to user
      const existing = await db.getFirstAsync(
        "SELECT server_id FROM goals WHERE id = ? AND user_id = ?",
        [id, user.id]
      );
      if (!existing) {
        throw new Error("Goal not found");
      }
      await db.runAsync("DELETE FROM goals WHERE id = ? AND user_id = ?", [
        id,
        user.id,
      ]);
      // Add to sync queue if it was synced before
      if (existing.server_id) {
        await db.runAsync(
          "INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)",
          [
            "goals",
            id,
            "delete",
            JSON.stringify({ server_id: existing.server_id }),
          ]
        );
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
      throw error;
    }
  };

  const getGoalProgress = async (
    month: number,
    year: number
  ): Promise<number> => {
    if (!db || !user) return 0;
    try {
      // Calculate net income for the month (income - expenses)
      const transactions = (await db.getAllAsync(
        `SELECT * FROM transactions
         WHERE user_id = ?
         AND strftime('%m', transaction_date) = ?
         AND strftime('%Y', transaction_date) = ?`,
        [user.id, month.toString().padStart(2, "0"), year.toString()]
      )) as any[];
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      return Math.max(0, income - expenses);
    } catch (error) {
      console.error("Error calculating goal progress:", error);
      return 0;
    }
  };

  // Report methods
  const getReports = async (month: number, year: number): Promise<any> => {
    if (!db || !user) return {};
    try {
      const transactions = (await db.getAllAsync(
        `SELECT * FROM transactions
         WHERE user_id = ?
         AND strftime('%m', transaction_date) = ?
         AND strftime('%Y', transaction_date) = ?`,
        [user.id, month.toString().padStart(2, "0"), year.toString()]
      )) as any[];
      const goal = (await db.getFirstAsync(
        "SELECT * FROM goals WHERE user_id = ? AND target_month = ? AND target_year = ?",
        [user.id, month, year]
      )) as any;
      // Calculate analytics
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      const net = income - expenses;
      const incomeByCategory: any = {};
      const expensesByCategory: any = {};
      transactions.forEach((transaction) => {
        if (transaction.type === "income") {
          incomeByCategory[transaction.category] =
            (incomeByCategory[transaction.category] || 0) + transaction.amount;
        } else {
          expensesByCategory[transaction.category] =
            (expensesByCategory[transaction.category] || 0) +
            transaction.amount;
        }
      });
      const goalStatus = goal
        ? {
            target: goal.target_amount,
            progress: net,
            achieved: net >= goal.target_amount,
            remaining: Math.max(0, goal.target_amount - net),
          }
        : null;
      return {
        summary: {
          income,
          expenses,
          net,
          goalStatus,
          transactionCount: transactions.length,
        },
        analytics: {
          categoryBreakdown: {
            income: incomeByCategory,
            expenses: expensesByCategory,
          },
        },
      };
    } catch (error) {
      console.error("Error generating report:", error);
      return {};
    }
  };

  const getYearlyReports = async (year: number): Promise<any> => {
    if (!db || !user) return {};
    try {
      const transactions = (await db.getAllAsync(
        'SELECT * FROM transactions WHERE user_id = ? AND strftime("%Y", transaction_date) = ?',
        [user.id, year.toString()]
      )) as any[];
      const goals = (await db.getAllAsync(
        "SELECT * FROM goals WHERE user_id = ? AND target_year = ?",
        [user.id, year]
      )) as any[];
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      const net = income - expenses;
      const monthlyBreakdown: any = {};
      for (let month = 1; month <= 12; month++) {
        const monthTransactions = transactions.filter((t: any) => {
          const date = new Date(t.transaction_date);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
        const monthIncome = monthTransactions
          .filter((t: any) => t.type === "income")
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const monthExpenses = monthTransactions
          .filter((t: any) => t.type === "expense")
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const monthNet = monthIncome - monthExpenses;
        monthlyBreakdown[month] = {
          month,
          monthName: new Date(year, month - 1, 1).toLocaleString("default", {
            month: "long",
          }),
          income: monthIncome,
          expenses: monthExpenses,
          net: monthNet,
          transactionCount: monthTransactions.length,
        };
      }
      const achievedGoals = goals.filter((goal: any) => {
        const progress = monthlyBreakdown[goal.target_month]?.net || 0;
        return progress >= goal.target_amount;
      }).length;
      return {
        summary: {
          income,
          expenses,
          net,
          savingsRate: income > 0 ? (net / income) * 100 : 0,
          totalGoals: goals.length,
          achievedGoals,
          goalsAchievementRate:
            goals.length > 0 ? (achievedGoals / goals.length) * 100 : 0,
          transactionCount: transactions.length,
        },
        monthlyBreakdown,
      };
    } catch (error) {
      console.error("Error generating yearly report:", error);
      return {};
    }
  };

  // New Report Methods
  const getCategoryBreakdownReport = async (
    month: number,
    year: number
  ): Promise<any> => {
    if (!token) throw new Error("Not authenticated");

    try {
      const response = await fetch(
        `${API_BASE_URL}/report/category-breakdown?month=${month}&year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch category breakdown report");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching category breakdown report:", error);
      throw error;
    }
  };

  const getGoalProgressReport = async (year: number): Promise<any> => {
    if (!token) throw new Error("Not authenticated");

    try {
      const response = await fetch(
        `${API_BASE_URL}/report/goal-progress?year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch goal progress report");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching goal progress report:", error);
      throw error;
    }
  };

  const getFinancialHealthReport = async (year: number): Promise<any> => {
    if (!token) throw new Error("Not authenticated");

    try {
      const response = await fetch(
        `${API_BASE_URL}/report/financial-health?year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch financial health report");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching financial health report:", error);
      throw error;
    }
  };

  // Dashboard data
  const getDashboardData = async (): Promise<any> => {
    if (!db || !user) {
      return {
        currentBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        currentGoal: null,
        recentTransactions: [],
      };
    }
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const transactions = await getTransactions();
      const recentTransactions = transactions.slice(0, 10);
      const monthlyTransactions = transactions.filter((t: any) => {
        if (!t.transaction_date && !t.date) return false;
        const date = new Date(t.transaction_date || t.date);
        return (
          date.getMonth() + 1 === currentMonth &&
          date.getFullYear() === currentYear
        );
      });
      const monthlyIncome = monthlyTransactions
        .filter((t: any) => t.type === "income")
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const monthlyExpenses = monthlyTransactions
        .filter((t: any) => t.type === "expense")
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const currentBalance = monthlyIncome - monthlyExpenses;
      const currentGoal = (await db.getFirstAsync(
        "SELECT * FROM goals WHERE user_id = ? AND target_month = ? AND target_year = ?",
        [user.id, currentMonth, currentYear]
      )) as any;
      const goalProgress = currentGoal
        ? await getGoalProgress(currentMonth, currentYear)
        : 0;
      return {
        currentBalance: currentBalance || 0,
        monthlyIncome: monthlyIncome || 0,
        monthlyExpenses: monthlyExpenses || 0,
        currentGoal: currentGoal
          ? {
              ...currentGoal,
              progress: goalProgress || 0,
            }
          : null,
        recentTransactions: recentTransactions || [],
      };
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      return {
        currentBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        currentGoal: null,
        recentTransactions: [],
      };
    }
  };

  // Sync methods
  const syncData = async (): Promise<void> => {
    if (!db || !isOnline || !token || !user) {
      throw new Error(
        "Cannot sync: check network connection and authentication"
      );
    }
    try {
      setPendingSync(true);
      // Get pending sync operations
      const syncQueue = (await db.getAllAsync(
        "SELECT * FROM sync_queue ORDER BY created_at"
      )) as any[];

      console.log(`Found ${syncQueue.length} pending sync operations`);

      for (const operation of syncQueue) {
        try {
          const data = JSON.parse(operation.data);
          console.log(
            `Processing sync operation: ${operation.table_name}.${operation.operation} for record ${operation.record_id}`
          );

          switch (operation.table_name) {
            case "transactions":
              await syncTransaction(operation, data);
              break;
            case "goals":
              await syncGoal(operation, data);
              break;
            default:
              console.warn(
                `Unknown table in sync queue: ${operation.table_name}`
              );
          }
          // Remove from sync queue after successful sync
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [
            operation.id,
          ]);
          console.log(`Successfully synced operation ${operation.id}`);
        } catch (error) {
          console.error(`Error syncing operation ${operation.id}:`, error);
          // Don't throw here, continue with other operations
          // We'll retry failed operations in the next sync
        }
      }
      // Pull latest data from server
      await pullLatestData();
    } catch (error) {
      console.error("Error during sync:", error);
      throw error;
    } finally {
      setPendingSync(false);
    }
  };

  const syncTransaction = async (operation: any, data: any) => {
  if (!token) return;
  try {
    switch (operation.operation) {
      case "create":
        const createResponse = await axios.post(
          `${API_BASE_URL}/transactions`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Fix: Handle the array response structure [response, statusCode]
        let responseData = createResponse.data;
        
        // Debug log to see the full response
        console.log('Full create transaction response:', createResponse);
        console.log('Response data:', responseData);
        
        // If response is an array, take the first element (the actual response)
        if (Array.isArray(responseData)) {
          responseData = responseData[0];
        }
        
        // Now extract the server ID from the response
        let serverId;
        if (responseData.data && responseData.data.id) {
          serverId = responseData.data.id;
        } else if (responseData.id) {
          serverId = responseData.id;
        } else {
          console.error('Unexpected response structure:', responseData);
          throw new Error('Invalid response structure from server');
        }
        
        console.log('Extracted server ID:', serverId);
        
        await db.runAsync(
          "UPDATE transactions SET server_id = ?, sync_status = ? WHERE id = ?",
          [serverId, "synced", operation.record_id]
        );
        break;
        
      case "update":
        // For update operations, use the server_id if available, otherwise use local ID
        const existingTx = await db.getFirstAsync(
          "SELECT server_id FROM transactions WHERE id = ? AND user_id = ?",
          [operation.record_id, user?.id]
        );
        
        const updateId = existingTx?.server_id || operation.record_id;
        
        const updateResponse = await axios.put(
          `${API_BASE_URL}/transactions/${updateId}`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Handle array response for update as well
        let updateResponseData = updateResponse.data;
        if (Array.isArray(updateResponseData)) {
          updateResponseData = updateResponseData[0];
        }
        
        await db.runAsync(
          "UPDATE transactions SET sync_status = ? WHERE id = ?",
          ["synced", operation.record_id]
        );
        break;
        
      case "delete":
        await axios.delete(`${API_BASE_URL}/transactions/${data.server_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        break;
    }
  } catch (error: any) {
    console.error("Error syncing transaction:", error);
    console.error("Operation data:", operation);
    console.error("Request data:", data);
    
    // If it's a create operation and we get a conflict (already exists), try to update instead
    if (operation.operation === "create" && error.response?.status === 409) {
      console.log('Transaction already exists on server, updating...');
      await syncTransaction({...operation, operation: "update"}, data);
      return;
    }
    
    throw error;
  }
};

const syncGoal = async (operation: any, data: any) => {
  if (!token) return;
  try {
    switch (operation.operation) {
      case "create":
        const createResponse = await axios.post(
          `${API_BASE_URL}/goals`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Fix: Handle the array response structure [response, statusCode]
        let responseData = createResponse.data;
        
        // If response is an array, take the first element (the actual response)
        if (Array.isArray(responseData)) {
          responseData = responseData[0];
        }
        
        // Now extract the server ID from the response
        let serverId;
        if (responseData.data && responseData.data.id) {
          serverId = responseData.data.id;
        } else if (responseData.id) {
          serverId = responseData.id;
        } else {
          console.error('Unexpected response structure:', responseData);
          throw new Error('Invalid response structure from server');
        }
        
        await db.runAsync(
          "UPDATE goals SET server_id = ?, sync_status = ? WHERE id = ?",
          [serverId, "synced", operation.record_id]
        );
        break;
        
      case "update":
        // For update operations, use the server_id if available, otherwise use local ID
        const existingGoal = await db.getFirstAsync(
          "SELECT server_id FROM goals WHERE id = ? AND user_id = ?",
          [operation.record_id, user?.id]
        );
        
        const updateId = existingGoal?.server_id || operation.record_id;
        
        const updateResponse = await axios.put(
          `${API_BASE_URL}/goals/${updateId}`,
          data,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Handle array response for update as well
        let updateResponseData = updateResponse.data;
        if (Array.isArray(updateResponseData)) {
          updateResponseData = updateResponseData[0];
        }
        
        await db.runAsync("UPDATE goals SET sync_status = ? WHERE id = ?", [
          "synced",
          operation.record_id,
        ]);
        break;
        
      case "delete":
        await axios.delete(`${API_BASE_URL}/goals/${data.server_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        break;
    }
  } catch (error: any) {
    console.error("Error syncing goal:", error);
    console.error("Operation data:", operation);
    console.error("Request data:", data);
    
    // If it's a create operation and we get a conflict (already exists), try to update instead
    if (operation.operation === "create" && error.response?.status === 409) {
      console.log('Goal already exists on server, updating...');
      await syncGoal({...operation, operation: "update"}, data);
      return;
    }
    
    throw error;
  }
};

  const pullLatestData = async () => {
    if (!token || !user || !db) return;
    try {
      // Pull transactions
      const transactionsResponse = await axios.get(
        `${API_BASE_URL}/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const serverTransactions = transactionsResponse.data.data;

      // Pull goals
      const goalsResponse = await axios.get(`${API_BASE_URL}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const serverGoals = goalsResponse.data.data;

      // Update local database with server data using UPSERT approach
      for (const transaction of serverTransactions) {
        // Check if transaction already exists by server_id
        const existingTransaction = await db.getFirstAsync(
          "SELECT id FROM transactions WHERE server_id = ? AND user_id = ?",
          [transaction.id, user.id]
        );

        if (existingTransaction) {
          // Update existing transaction
          await db.runAsync(
            `UPDATE transactions 
             SET amount = ?, description = ?, type = ?, category = ?, transaction_date = ?, sync_status = 'synced'
             WHERE server_id = ? AND user_id = ?`,
            [
              transaction.amount,
              transaction.desc,
              transaction.type,
              transaction.category,
              transaction.date,
              transaction.id,
              user.id,
            ]
          );
        } else {
          // Insert new transaction
          await db.runAsync(
            `INSERT INTO transactions 
             (amount, description, type, category, transaction_date, user_id, server_id, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transaction.amount,
              transaction.desc,
              transaction.type,
              transaction.category,
              transaction.date,
              user.id,
              transaction.id,
              "synced",
            ]
          );
        }
      }

      // Update goals with UPSERT approach
      for (const goal of serverGoals) {
        // Check if goal already exists by server_id
        const existingGoal = await db.getFirstAsync(
          "SELECT id FROM goals WHERE server_id = ? AND user_id = ?",
          [goal.id, user.id]
        );

        if (existingGoal) {
          // Update existing goal
          await db.runAsync(
            `UPDATE goals 
             SET target_amount = ?, target_month = ?, target_year = ?, sync_status = 'synced'
             WHERE server_id = ? AND user_id = ?`,
            [
              goal.target_amount,
              goal.target_month,
              goal.target_year,
              goal.id,
              user.id,
            ]
          );
        } else {
          // Check if there's a local goal for the same month/year
          const existingLocalGoal = await db.getFirstAsync(
            "SELECT id FROM goals WHERE user_id = ? AND target_month = ? AND target_year = ? AND server_id IS NULL",
            [user.id, goal.target_month, goal.target_year]
          );

          if (existingLocalGoal) {
            // Update the local goal with server_id
            await db.runAsync(
              `UPDATE goals 
               SET target_amount = ?, server_id = ?, sync_status = 'synced'
               WHERE id = ? AND user_id = ?`,
              [goal.target_amount, goal.id, existingLocalGoal.id, user.id]
            );
          } else {
            // Insert new goal
            await db.runAsync(
              `INSERT INTO goals 
               (target_amount, target_month, target_year, user_id, server_id, sync_status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                goal.target_amount,
                goal.target_month,
                goal.target_year,
                user.id,
                goal.id,
                "synced",
              ]
            );
          }
        }
      }

      // Clean up: Remove any local synced transactions that don't exist on server
      const serverTransactionIds = serverTransactions.map((t: any) => t.id);
      if (serverTransactionIds.length > 0) {
        await db.runAsync(
          `DELETE FROM transactions 
           WHERE sync_status = 'synced' 
           AND user_id = ?
           AND server_id NOT IN (${serverTransactionIds
             .map(() => "?")
             .join(",")})`,
          [user.id, ...serverTransactionIds]
        );
      }

      // Clean up: Remove any local synced goals that don't exist on server
      const serverGoalIds = serverGoals.map((g: any) => g.id);
      if (serverGoalIds.length > 0) {
        await db.runAsync(
          `DELETE FROM goals 
           WHERE sync_status = 'synced' 
           AND user_id = ?
           AND server_id NOT IN (${serverGoalIds.map(() => "?").join(",")})`,
          [user.id, ...serverGoalIds]
        );
      }
    } catch (error) {
      console.error("Error pulling latest data:", error);
    }
  };

  const clearLocalData = async (): Promise<void> => {
    if (!db) throw new Error("Database not initialized");
    try {
      await db.execAsync(`
        DELETE FROM transactions;
        DELETE FROM goals;
        DELETE FROM sync_queue;
      `);
    } catch (error) {
      console.error("Error clearing local data:", error);
      throw error;
    }
  };

  const value: DatabaseContextType = {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    getGoalProgress,
    getReports,
    getYearlyReports,
    getCategoryBreakdownReport,
    getGoalProgressReport,
    getFinancialHealthReport,
    getDashboardData,
    syncData,
    clearLocalData,
    isOnline,
    pendingSync,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}
