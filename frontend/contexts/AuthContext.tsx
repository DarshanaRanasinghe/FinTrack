import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { router } from "expo-router";

const API_BASE_URL = "http://192.168.8.101:3000/api";

interface User {
  id: number;
  name: string;
  email: string;
  date_of_birth: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("authToken");
      const storedUser = await SecureStore.getItemAsync("user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Set default authorization header
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error("Error loading stored auth:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { data } = response.data;

      await SecureStore.setItemAsync("authToken", data.token);
      await SecureStore.setItemAsync("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      // Set default authorization header
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error("Login failed");
    }
  };

  const register = async (userData: any) => {
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, userData);
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error("Registration failed");
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("user");

      setToken(null);
      setUser(null);

      delete axios.defaults.headers.common["Authorization"];

      router.replace("/register");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, register, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}