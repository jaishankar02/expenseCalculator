import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setToken(savedToken);
      // Validate token
      validateToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async (token) => {
    try {
      const response = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (err) {
      localStorage.removeItem('authToken');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, phone, upiId, email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/signup`, {
        name,
        phone,
        upiId,
        email,
        password
      });
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('authToken', response.data.token);
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Signup failed');
    }
  };

  const login = async (phone, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        phone,
        password
      });
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('authToken', response.data.token);
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  const addFriend = async (friendId) => {
    try {
      const response = await axios.post(`${API_BASE}/users/add-friend`, 
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to add friend');
    }
  };

  const value = {
    user,
    token,
    loading,
    signup,
    login,
    logout,
    addFriend,
    isAuthenticated: !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
