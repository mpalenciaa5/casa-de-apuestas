'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [betslipOpen, setBetslipOpen] = useState(false);
  const [selections, setSelections] = useState([]); // array of { matchId, sport, homeTeam, awayTeam, selectedOutcome, odds }
  const [betAmount, setBetAmount] = useState('50'); // default amount

  // Fetch the current authenticated session from the SQLite backend
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching auth session:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión.');
    
    setUser(data.user);
    setAuthModal(null);
    await fetchUser(); // Reload fresh details
    return data;
  };

  const register = async (username, email, password, dpi, bankAccount, birthDate) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, dpi, bankAccount, birthDate })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear la cuenta.');
    
    setUser(data.user);
    setAuthModal(null);
    await fetchUser(); // Reload fresh details
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
      setSelections([]);
      setBetslipOpen(false);
    }
  };

  const toggleSelection = (match, outcome) => {
    const odds = match.odds[outcome];
    if (odds === undefined || odds === null) return;

    // Check if the outcome is already selected
    const isSelected = selections.some(
      (s) => s.matchId === match._id && s.selectedOutcome === outcome
    );

    if (isSelected) {
      // De-select
      setSelections([]);
    } else {
      // Select the new outcome (supporting one outcome at a time for single betslip placement)
      setSelections([
        {
          matchId: match._id,
          sport: match.sport,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          selectedOutcome: outcome,
          odds: parseFloat(odds)
        }
      ]);
      setBetslipOpen(true); // Open bet slip automatically on selection
    }
  };

  const removeSelection = () => {
    setSelections([]);
  };

  const updateBalance = (newBalance) => {
    setUser((prev) => (prev ? { ...prev, balance: parseFloat(newBalance.toFixed(2)) } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authModal,
        setAuthModal,
        betslipOpen,
        setBetslipOpen,
        selections,
        toggleSelection,
        removeSelection,
        betAmount,
        setBetAmount,
        login,
        register,
        logout,
        updateBalance,
        refreshUser: fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
