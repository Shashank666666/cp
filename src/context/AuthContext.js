import React, { createContext, useState, useContext, useEffect } from 'react';
import { SecureStore } from 'expo-secure-store';
import io from 'socket.io-client';
import { API_URL } from '../config/constants';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (token) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [token]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('userToken');
      const storedUserId = await SecureStore.getItemAsync('userId');
      const storedUsername = await SecureStore.getItemAsync('username');
      
      if (storedToken && storedUserId) {
        setToken(storedToken);
        setUser({
          id: storedUserId,
          username: storedUsername
        });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    }
  };

  const connectSocket = () => {
    if (socket) return;
    
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('userId', data.user.id);
        await SecureStore.setItemAsync('username', data.user.username);
        
        setToken(data.token);
        setUser(data.user);
        
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('userId', data.user.id);
        await SecureStore.setItemAsync('username', data.user.username);
        
        setToken(data.token);
        setUser(data.user);
        
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('username');
      
      setToken(null);
      setUser(null);
      disconnectSocket();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    token,
    socket,
    login,
    register,
    logout,
    isAuthenticated: !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
