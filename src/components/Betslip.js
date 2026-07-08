'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Trash2, Award, Coins, AlertCircle, CheckCircle } from 'lucide-react';

export default function Betslip() {
  const {
    user,
    setAuthModal,
    betslipOpen,
    setBetslipOpen,
    selections,
    removeSelection,
    betAmount,
    setBetAmount,
    updateBalance
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!betslipOpen) return null;

  const hasSelection = selections.length > 0;
  const selection = hasSelection ? selections[0] : null;
  const odds = selection ? selection.odds : 0;
  const numericAmount = parseFloat(betAmount) || 0;
  const potentialPayout = parseFloat((numericAmount * odds).toFixed(2));

  const handlePlaceBet = async () => {
    if (!user) {
      setAuthModal('login');
      return;
    }

    if (!hasSelection) return;

    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selection.matchId,
          sport: selection.sport,
          homeTeam: selection.homeTeam,
          awayTeam: selection.awayTeam,
          selectedOutcome: selection.selectedOutcome,
          odds: selection.odds,
          amount: numericAmount
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la apuesta.');
      }

      setSuccess(true);
      updateBalance(data.newBalance); // Sync visual balance in header navbar

      // Automatically reset and close the drawer after success animation
      setTimeout(() => {
        removeSelection();
        setSuccess(false);
        setBetslipOpen(false);
      }, 2500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeName = (outcome, home, away) => {
    if (outcome === 'home') return home;
    if (outcome === 'away') return away;
    return 'Empate';
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          zIndex: 190,
          backdropFilter: 'blur(2px)'
        }}
        onClick={() => setBetslipOpen(false)}
      />
      
      <div className={`betslip-drawer ${betslipOpen ? 'open' : ''}`}>
        <div className="betslip-header">
          <h3 className="betslip-title">
            <Coins size={18} style={{ color: 'var(--accent-green)', verticalAlign: 'middle', marginRight: '4px' }} />
            Boleta de Apuesta
          </h3>
          <button className="betslip-close" onClick={() => setBetslipOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="betslip-content">
          {success ? (
            <div style={{ textAlign: 'center', margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <CheckCircle size={52} style={{ color: 'var(--accent-green)' }} />
              <h4 style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>¡Apuesta Aceptada!</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '85%', lineHeight: '1.4' }}>
                Tu apuesta ha sido procesada de manera exitosa y registrada de forma segura en el sistema.
              </p>
            </div>
          ) : hasSelection ? (
            <div className="slip-selection">
              <button className="slip-remove" onClick={removeSelection} title="Eliminar selección">
                <Trash2 size={13} />
              </button>
              <div className="slip-sport">{selection.sport}</div>
              <div className="slip-match">{selection.homeTeam} vs {selection.awayTeam}</div>
              <div className="slip-outcome-row">
                <div className="slip-outcome-label">
                  Predicción: <strong>{getOutcomeName(selection.selectedOutcome, selection.homeTeam, selection.awayTeam)}</strong>
                </div>
                <div className="slip-odds">@{selection.odds.toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <div className="betslip-empty">
              <Award size={36} style={{ color: 'var(--text-muted)' }} />
              <p>Tu boleta está vacía</p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Selecciona la cuota de un equipo en la cartelera de deportes para añadir una apuesta.
              </span>
            </div>
          )}

          {error && !success && (
            <div className="alert-banner warning" style={{ marginTop: '12px' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {hasSelection && !success && (
          <div className="betslip-footer">
            <div className="bet-input-container">
              <span className="bet-input-label">Monto del importe (Q)</span>
              <div className="bet-input-wrapper">
                <span className="bet-input-symbol">Q</span>
                <input
                  type="number"
                  className="bet-input"
                  min="1"
                  step="any"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
              <div className="slip-summary-row">
                <span>Cuota total</span>
                <span style={{ fontWeight: '700', color: '#fff' }}>@{odds.toFixed(2)}</span>
              </div>
              <div className="slip-summary-row total">
                <span>Retorno Potencial</span>
                <span className="payout-value">Q{potentialPayout.toFixed(2)}</span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', marginTop: '6px' }}
              onClick={handlePlaceBet}
              disabled={loading || numericAmount <= 0}
            >
              {loading ? 'Procesando...' : user ? 'Colocar Apuesta' : 'Iniciar Sesión para Apostar'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
