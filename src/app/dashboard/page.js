'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';
import { Wallet, Coins, RefreshCw, ArrowUpRight, ArrowDownLeft, AlertCircle, Check, History } from 'lucide-react';

export default function Dashboard() {
  const { user, loading, setAuthModal, updateBalance } = useAuth();
  const [bets, setBets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);

  // Transaction form states
  const [txType, setTxType] = useState('deposit'); // 'deposit' | 'withdrawal'
  const [amount, setAmount] = useState('');
  const [txError, setTxError] = useState(null);
  const [txSuccess, setTxSuccess] = useState(null);
  const [txLoading, setTxLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoadingData(true);
    setError(null);
    try {
      // Fetch bets from SQL (SQLite local)
      const betsRes = await fetch('/api/bets');
      const betsData = await betsRes.json();
      
      // Fetch logs from NoSQL (MongoDB Atlas Cloud)
      const logsRes = await fetch('/api/logs');
      const logsData = await logsRes.json();

      if (betsRes.ok && betsData.success) {
        setBets(betsData.bets);
      }
      if (logsRes.ok && logsData.success) {
        setLogs(logsData.logs);
      }
    } catch (err) {
      setError('Error al consultar los registros de base de datos.');
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <div style={{ border: '3px solid rgba(255,255,255,0.06)', borderTop: '3px solid var(--accent-green)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Validando credenciales académicas...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '460px', textAlign: 'center', padding: '40px' }}>
          <AlertCircle size={46} style={{ color: 'var(--status-pending)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px' }}>Autenticación Requerida</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
            Inicia sesión o crea una cuenta nueva para habilitar tu billetera de simulación y poder ver las transacciones estructuradas en SQL junto a los logs flexibles almacenados en MongoDB Cloud.
          </p>
          <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
            Iniciar Sesión
          </button>
          <AuthModal />
        </div>
      </div>
    );
  }

  const handleTransaction = async (e) => {
    e.preventDefault();
    setTxError(null);
    setTxSuccess(null);
    setTxLoading(true);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setTxError('Por favor ingresa un monto válido.');
      setTxLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: txType, amount: numericAmount })
      });
      
      const data = await res.json();
      console.log('[Wallet Debug] Response Data:', data);
      if (!res.ok) {
        console.error('[Wallet Debug] HTTP error:', res.status, data);
        throw new Error(data.error || 'Error al procesar la transferencia.');
      }

      setTxSuccess(`El ${txType === 'deposit' ? 'depósito' : 'retiro'} se registró con éxito en tu cuenta.`);
      setAmount('');
      updateBalance(data.newBalance); // updates layout navbar balance
      await fetchDashboardData();    // reload tables and NoSQL logs
    } catch (err) {
      console.error('[Wallet Debug] Exception caught:', err);
      setTxError(err.message);
    } finally {
      setTxLoading(false);
    }
  };

  const getOutcomeName = (outcome, home, away) => {
    if (outcome === 'home') return home;
    if (outcome === 'away') return away;
    return 'Empate';
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') return <span className="badge badge-pending">Pendiente</span>;
    if (status === 'won') return <span className="badge badge-won">Ganada</span>;
    return <span className="badge badge-lost">Perdida</span>;
  };

  const formatLogDetails = (log) => {
    const { action, metadata } = log;
    if (!metadata) return action;
    if (action === 'place_bet') {
      return `Apuesta de Q${metadata.amount} colocada en el evento [${metadata.teams}] con cuota @${metadata.odds}. Ganancia potencial: Q${metadata.potentialPayout}.`;
    }
    if (action === 'deposit' || action === 'withdrawal') {
      return `Transferencia de Q${metadata.amount} (${action === 'deposit' ? 'Depósito' : 'Retiro'}) realizada en tu billetera. Nuevo saldo: Q${metadata.newBalance.toFixed(2)}.`;
    }
    if (action === 'bet_won' || action === 'bet_lost') {
      return `Apuesta de ID #${metadata.betId} liquidada como ${action === 'bet_won' ? 'GANADORA' : 'PERDEDORA'}. Retorno: Q${metadata.payout}.`;
    }
    return `${action}: ${JSON.stringify(metadata)}`;
  };

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '28px' }}>Mi Billetera & Auditoría</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Inspecciona cómo interactúan las dos bases de datos en tiempo real al depositar, retirar o apostar.
          </p>
        </div>
        <button 
          onClick={fetchDashboardData} 
          className="btn btn-secondary btn-icon" 
          style={{ padding: '10px' }} 
          title="Actualizar datos"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Financial Section */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div className="wallet-box">
          <div>
            <div className="wallet-balance-title">Saldo Disponible (Virtual)</div>
            <div className="wallet-balance-amount">Q{user.balance.toFixed(2)}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              * Almacenado en la tabla relacional <strong>users</strong> de tu SQLite local.
            </span>
          </div>
          <Coins size={44} style={{ color: 'var(--accent-green)', opacity: 0.8 }} />
        </div>

        {/* Deposit/Withdrawal simulation form */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={16} style={{ color: 'var(--accent-cyan)' }} />
            Simular Transacción
          </h3>
          
          <form onSubmit={handleTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className={`btn ${txType === 'deposit' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                onClick={() => setTxType('deposit')}
              >
                <ArrowUpRight size={13} /> Depósito
              </button>
              <button 
                type="button" 
                className={`btn ${txType === 'withdrawal' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                onClick={() => setTxType('withdrawal')}
              >
                <ArrowDownLeft size={13} /> Retiro
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                className="form-input"
                placeholder="Cantidad Q"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={txLoading}
              />
              <button type="submit" className="btn btn-outline-neon" disabled={txLoading} style={{ padding: '8px 16px', fontSize: '13px' }}>
                {txLoading ? '...' : 'Enviar'}
              </button>
            </div>

            {txError && <div style={{ fontSize: '11px', color: 'var(--status-lost)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} /> {txError}</div>}
            {txSuccess && <div style={{ fontSize: '11px', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={11} /> {txSuccess}</div>}
          </form>
        </div>
      </section>

      {/* Expanded Bets History */}
      <div style={{ width: '100%' }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '17px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <History size={18} style={{ color: 'var(--accent-green)' }} />
            Historial de Apuestas
          </h3>

          {loadingData ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', fontSize: '14px' }}>Cargando apuestas...</p>
          ) : bets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
              Aún no has colocado apuestas. Selecciona cuotas en la cartelera principal para empezar.
            </p>
          ) : (
            <div className="history-list" style={{ maxHeight: '650px' }}>
              {bets.map(bet => (
                <div key={bet.id} className="history-item" style={{ padding: '20px 24px' }}>
                  <div className="history-item-details">
                    <div className="history-item-title" style={{ fontSize: '16px' }}>
                      {bet.home_team} vs {bet.away_team}
                    </div>
                    <div className="history-item-subtitle" style={{ marginTop: '4px', fontSize: '13px' }}>
                      Predicción: <strong style={{ color: '#fff' }}>{getOutcomeName(bet.selected_outcome, bet.home_team, bet.away_team)}</strong> • Cuota: <strong style={{ color: 'var(--accent-cyan)' }}>@{bet.odds.toFixed(2)}</strong>
                    </div>
                    <div className="history-item-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Código de Operación: <code style={{ color: 'var(--accent-green)' }}>#{bet.id}</code> • {new Date(bet.created_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                  
                  <div className="history-item-financial" style={{ display: 'flex', alignItems: 'center', gap: '24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Importe: <strong>Q{bet.amount.toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Retorno Potencial: <strong>Q{bet.potential_payout.toFixed(2)}</strong>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '100px' }}>
                      {getStatusBadge(bet.status)}
                      {bet.status === 'won' && (
                        <span className="history-item-amount positive" style={{ fontSize: '16px', fontWeight: '800' }}>
                          +Q{bet.potential_payout.toFixed(2)}
                        </span>
                      )}
                      {bet.status === 'lost' && (
                        <span className="history-item-amount negative" style={{ fontSize: '16px', fontWeight: '800' }}>
                          -Q{bet.amount.toFixed(2)}
                        </span>
                      )}
                      {bet.status === 'pending' && (
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AuthModal />
    </div>
  );
}
