import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SQLite from 'expo-sqlite';
import axios from 'axios';
import { useAuth } from './AuthContext';
import NetInfo from '@react-native-community/netinfo';
import { isValidDateString } from '@/utils/dateUtils';

const API_BASE_URL = 'http://192.168.1.5:3000/api';

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
  
  // Dashboard
  getDashboardData: () => Promise<any>;
  
  // Sync
  syncData: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  
  // Status
  isOnline: boolean;
  pendingSync: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

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
    NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
  };

  const initDatabase = async () => {
    try {
      const database = SQLite.openDatabaseSync('fintrack.db');
      
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
          server_id INTEGER
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
      console.error('Error initializing database:', error);
    }
  };

  // Transaction methods
  const getTransactions = async (): Promise<any[]> => {
    if (!db) return [];
    
    try {
      const result = await db.getAllAsync(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, date_created DESC',
        [user?.id || 0]
      );
      return result as any[];
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  };

  const addTransaction = async (transaction: any): Promise<number> => {
  if (!db) throw new Error('Database not initialized');
  if (!user) throw new Error('User not authenticated');
  
  try {
    // Validate and format date
    let transactionDate = transaction.date;
    if (!isValidDateString(transactionDate)) {
      // Use current date if invalid
      transactionDate = new Date().toISOString().split('T')[0];
    }
    
    const result = await db.runAsync(
      'INSERT INTO transactions (amount, description, type, category, transaction_date, user_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [transaction.amount, transaction.desc, transaction.type, transaction.category, transactionDate, user.id, 'pending']
    );
    
    // Add to sync queue
    await db.runAsync(
      'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
      ['transactions', result.lastInsertRowId, 'create', JSON.stringify({
        ...transaction,
        date: transactionDate
      })]
    );
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

  const updateTransaction = async (id: number, transaction: any): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    if (!user) throw new Error('User not authenticated');
    
    try {
      await db.runAsync(
        'UPDATE transactions SET amount = ?, description = ?, type = ?, category = ?, transaction_date = ?, sync_status = ? WHERE id = ? AND user_id = ?',
        [transaction.amount, transaction.desc, transaction.type, transaction.category, transaction.date, 'pending', id, user.id]
      );
      
      // Add to sync queue
      await db.runAsync(
        'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
        ['transactions', id, 'update', JSON.stringify(transaction)]
      );
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: number): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Check if transaction exists and belongs to user
      const existing = await db.getFirstAsync(
        'SELECT server_id FROM transactions WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      
      if (!existing) {
        throw new Error('Transaction not found');
      }
      
      await db.runAsync(
        'DELETE FROM transactions WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      
      // Add to sync queue if it was synced before
      if (existing.server_id) {
        await db.runAsync(
          'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
          ['transactions', id, 'delete', JSON.stringify({ server_id: existing.server_id })]
        );
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  // Goal methods
  const getGoals = async (): Promise<any[]> => {
    if (!db || !user) return [];
    
    try {
      const result = await db.getAllAsync(
        'SELECT * FROM goals WHERE user_id = ? ORDER BY target_year DESC, target_month DESC',
        [user.id]
      );
      return result as any[];
    } catch (error) {
      console.error('Error getting goals:', error);
      return [];
    }
  };

  const addGoal = async (goal: any): Promise<number> => {
    if (!db) throw new Error('Database not initialized');
    if (!user) throw new Error('User not authenticated');
    
    try {
      const result = await db.runAsync(
        'INSERT INTO goals (target_amount, target_month, target_year, user_id, sync_status) VALUES (?, ?, ?, ?, ?)',
        [goal.target_amount, goal.target_month, goal.target_year, user.id, 'pending']
      );
      
      // Add to sync queue
      await db.runAsync(
        'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
        ['goals', result.lastInsertRowId, 'create', JSON.stringify(goal)]
      );
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error adding goal:', error);
      throw error;
    }
  };

  const updateGoal = async (id: number, goal: any): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    if (!user) throw new Error('User not authenticated');
    
    try {
      await db.runAsync(
        'UPDATE goals SET target_amount = ?, target_month = ?, target_year = ?, sync_status = ? WHERE id = ? AND user_id = ?',
        [goal.target_amount, goal.target_month, goal.target_year, 'pending', id, user.id]
      );
      
      // Add to sync queue
      await db.runAsync(
        'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
        ['goals', id, 'update', JSON.stringify(goal)]
      );
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  };

  const deleteGoal = async (id: number): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Check if goal exists and belongs to user
      const existing = await db.getFirstAsync(
        'SELECT server_id FROM goals WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      
      if (!existing) {
        throw new Error('Goal not found');
      }
      
      await db.runAsync(
        'DELETE FROM goals WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      
      // Add to sync queue if it was synced before
      if (existing.server_id) {
        await db.runAsync(
          'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
          ['goals', id, 'delete', JSON.stringify({ server_id: existing.server_id })]
        );
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  };

  const getGoalProgress = async (month: number, year: number): Promise<number> => {
    if (!db || !user) return 0;
    
    try {
      // Calculate net income for the month (income - expenses)
      const transactions = await db.getAllAsync(
        `SELECT * FROM transactions 
         WHERE user_id = ? 
         AND strftime('%m', transaction_date) = ? 
         AND strftime('%Y', transaction_date) = ?`,
        [user.id, month.toString().padStart(2, '0'), year.toString()]
      ) as any[];
      
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      return Math.max(0, income - expenses);
    } catch (error) {
      console.error('Error calculating goal progress:', error);
      return 0;
    }
  };

  // Report methods
  const getReports = async (month: number, year: number): Promise<any> => {
    if (!db || !user) return {};
    
    try {
      const transactions = await db.getAllAsync(
        `SELECT * FROM transactions 
         WHERE user_id = ? 
         AND strftime('%m', transaction_date) = ? 
         AND strftime('%Y', transaction_date) = ?`,
        [user.id, month.toString().padStart(2, '0'), year.toString()]
      ) as any[];
      
      const goal = await db.getFirstAsync(
        'SELECT * FROM goals WHERE user_id = ? AND target_month = ? AND target_year = ?',
        [user.id, month, year]
      ) as any;
      
      // Calculate analytics
      const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const net = income - expenses;
      
      const incomeByCategory: any = {};
      const expensesByCategory: any = {};
      
      transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          incomeByCategory[transaction.category] = (incomeByCategory[transaction.category] || 0) + transaction.amount;
        } else {
          expensesByCategory[transaction.category] = (expensesByCategory[transaction.category] || 0) + transaction.amount;
        }
      });
      
      const goalStatus = goal ? {
        target: goal.target_amount,
        progress: net,
        achieved: net >= goal.target_amount,
        remaining: Math.max(0, goal.target_amount - net)
      } : null;
      
      return {
        summary: {
          income,
          expenses,
          net,
          goalStatus,
          transactionCount: transactions.length
        },
        analytics: {
          categoryBreakdown: {
            income: incomeByCategory,
            expenses: expensesByCategory
          }
        }
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return {};
    }
  };

  const getYearlyReports = async (year: number): Promise<any> => {
    if (!db || !user) return {};
    
    try {
      const transactions = await db.getAllAsync(
        'SELECT * FROM transactions WHERE user_id = ? AND strftime("%Y", transaction_date) = ?',
        [user.id, year.toString()]
      ) as any[];
      
      const goals = await db.getAllAsync(
        'SELECT * FROM goals WHERE user_id = ? AND target_year = ?',
        [user.id, year]
      ) as any[];
      
      const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const net = income - expenses;
      
      const monthlyBreakdown: any = {};
      
      for (let month = 1; month <= 12; month++) {
        const monthTransactions = transactions.filter((t: any) => {
          const date = new Date(t.transaction_date);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
        
        const monthIncome = monthTransactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
        const monthExpenses = monthTransactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
        const monthNet = monthIncome - monthExpenses;
        
        monthlyBreakdown[month] = {
          month,
          monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
          income: monthIncome,
          expenses: monthExpenses,
          net: monthNet,
          transactionCount: monthTransactions.length
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
          goalsAchievementRate: goals.length > 0 ? (achievedGoals / goals.length) * 100 : 0,
          transactionCount: transactions.length
        },
        monthlyBreakdown
      };
    } catch (error) {
      console.error('Error generating yearly report:', error);
      return {};
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
      recentTransactions: []
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
      return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
    });
    
    const monthlyIncome = monthlyTransactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    
    const monthlyExpenses = monthlyTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    
    const currentBalance = monthlyIncome - monthlyExpenses;
    
    const currentGoal = await db.getFirstAsync(
      'SELECT * FROM goals WHERE user_id = ? AND target_month = ? AND target_year = ?',
      [user.id, currentMonth, currentYear]
    ) as any;
    
    const goalProgress = currentGoal ? await getGoalProgress(currentMonth, currentYear) : 0;
    
    return {
      currentBalance: currentBalance || 0,
      monthlyIncome: monthlyIncome || 0,
      monthlyExpenses: monthlyExpenses || 0,
      currentGoal: currentGoal ? {
        ...currentGoal,
        progress: goalProgress || 0
      } : null,
      recentTransactions: recentTransactions || []
    };
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return {
      currentBalance: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      currentGoal: null,
      recentTransactions: []
    };
  }
};

  // Sync methods
  const syncData = async (): Promise<void> => {
    if (!db || !isOnline || !token || !user) {
      throw new Error('Cannot sync: check network connection and authentication');
    }
    
    try {
      setPendingSync(true);
      
      // Get pending sync operations
      const syncQueue = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY created_at') as any[];
      
      for (const operation of syncQueue) {
        try {
          const data = JSON.parse(operation.data);
          
          switch (operation.table_name) {
            case 'transactions':
              await syncTransaction(operation, data);
              break;
            case 'goals':
              await syncGoal(operation, data);
              break;
          }
          
          // Remove from sync queue after successful sync
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [operation.id]);
        } catch (error) {
          console.error(`Error syncing operation ${operation.id}:`, error);
        }
      }
      
      // Pull latest data from server
      await pullLatestData();
      
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    } finally {
      setPendingSync(false);
    }
  };

  const syncTransaction = async (operation: any, data: any) => {
    if (!token) return;
    
    try {
      switch (operation.operation) {
        case 'create':
          const createResponse = await axios.post(`${API_BASE_URL}/transactions`, data, {
            headers: { Authorization: `Bearer ${token}` }
          });
          await db.runAsync(
            'UPDATE transactions SET server_id = ?, sync_status = ? WHERE id = ?',
            [createResponse.data.data.id, 'synced', operation.record_id]
          );
          break;
        case 'update':
          await axios.put(`${API_BASE_URL}/transactions/${operation.record_id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
          });
          await db.runAsync(
            'UPDATE transactions SET sync_status = ? WHERE id = ?',
            ['synced', operation.record_id]
          );
          break;
        case 'delete':
          await axios.delete(`${API_BASE_URL}/transactions/${data.server_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          break;
      }
    } catch (error) {
      console.error('Error syncing transaction:', error);
      throw error;
    }
  };

  const syncGoal = async (operation: any, data: any) => {
    if (!token) return;
    
    try {
      switch (operation.operation) {
        case 'create':
          const createResponse = await axios.post(`${API_BASE_URL}/goals`, data, {
            headers: { Authorization: `Bearer ${token}` }
          });
          await db.runAsync(
            'UPDATE goals SET server_id = ?, sync_status = ? WHERE id = ?',
            [createResponse.data.data.id, 'synced', operation.record_id]
          );
          break;
        case 'update':
          await axios.put(`${API_BASE_URL}/goals/${operation.record_id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
          });
          await db.runAsync(
            'UPDATE goals SET sync_status = ? WHERE id = ?',
            ['synced', operation.record_id]
          );
          break;
        case 'delete':
          await axios.delete(`${API_BASE_URL}/goals/${data.server_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          break;
      }
    } catch (error) {
      console.error('Error syncing goal:', error);
      throw error;
    }
  };

  const pullLatestData = async () => {
    if (!token || !user || !db) return;
    
    try {
      // Pull transactions
      const transactionsResponse = await axios.get(`${API_BASE_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const serverTransactions = transactionsResponse.data.data;
      
      // Pull goals
      const goalsResponse = await axios.get(`${API_BASE_URL}/goals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const serverGoals = goalsResponse.data.data;
      
      // Update local database with server data
      // Clear existing data that's synced
      await db.runAsync('DELETE FROM transactions WHERE sync_status = "synced"');
      await db.runAsync('DELETE FROM goals WHERE sync_status = "synced"');
      
      // Insert server data
      for (const transaction of serverTransactions) {
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
            'synced'
          ]
        );
      }
      
      for (const goal of serverGoals) {
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
            'synced'
          ]
        );
      }
    } catch (error) {
      console.error('Error pulling latest data:', error);
    }
  };

  const clearLocalData = async (): Promise<void> => {
    if (!db) throw new Error('Database not initialized');
    
    try {
      await db.execAsync(`
        DELETE FROM transactions;
        DELETE FROM goals;
        DELETE FROM sync_queue;
      `);
    } catch (error) {
      console.error('Error clearing local data:', error);
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
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}