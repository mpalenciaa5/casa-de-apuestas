'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';
import { Shield, PlusCircle, Trophy, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

export default function AdminConsole() {
  const { user, loading, setAuthModal, refreshUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState(null);

  // New match form states
  const [sport, setSport] = useState('Fútbol');
  const [league, setLeague] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [commenceTime, setCommenceTime] = useState('');
  const [oddsHome, setOddsHome] = useState('');
  const [oddsDraw, setOddsDraw] = useState('');
  const [oddsAway, setOddsAway] = useState('');
  const [stadium, setStadium] = useState('');
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Settle form states
  const [scoreHome, setScoreHome] = useState({});
  const [scoreAway, setScoreAway] = useState({});
  const [settleLoading, setSettleLoading] = useState({});
  const [settleSuccess, setSettleSuccess] = useState({});
  const [liveLoading, setLiveLoading] = useState({});
  const [deleteLoading, setDeleteLoading] = useState({});

  const silentFetchMatches = async () => {
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (res.ok) {
        setMatches(data.matches);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      silentFetchMatches();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchMatches = async () => {
    setLoadingMatches(true);
    setError(null);
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar con la base de datos.');
      }
      setMatches(data.matches);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <div style={{ border: '3px solid rgba(255,255,255,0.06)', borderTop: '3px solid var(--accent-green)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Validando privilegios de administrador...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '460px', textAlign: 'center', padding: '40px' }}>
          <Shield size={46} style={{ color: 'var(--status-lost)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px' }}>Área de Control Exclusiva</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
            Inicia sesión o crea una cuenta para poder simular operaciones administrativas. Esta consola te permite añadir partidos a la base NoSQL y cerrarlos para gatillar transacciones financieras en la base SQL.
          </p>
          <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
            Iniciar Sesión
          </button>
          <AuthModal />
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '460px', textAlign: 'center', padding: '40px' }}>
          <Shield size={46} style={{ color: 'var(--status-lost)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px' }}>Acceso Restringido</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
            Tu cuenta actual ("{user.username}") no cuenta con privilegios de administrador. Inicia sesión con una cuenta autorizada (como el acceso rápido con Google de "Jurado Evaluador") para operar este panel.
          </p>
          <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
            Cambiar de Cuenta
          </button>
          <AuthModal />
        </div>
      </div>
    );
  }

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormLoading(true);

    if (!league || !homeTeam || !awayTeam || !commenceTime || !oddsHome || !oddsAway) {
      setFormError('Por favor, rellena todos los campos obligatorios.');
      setFormLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          league,
          homeTeam,
          awayTeam,
          commenceTime: new Date(commenceTime).toISOString(),
          odds: {
            home: parseFloat(oddsHome),
            draw: oddsDraw ? parseFloat(oddsDraw) : null,
            away: parseFloat(oddsAway)
          },
          details: stadium ? { stadium } : {}
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el partido.');
      }

      setFormSuccess(`El partido "${homeTeam} vs ${awayTeam}" se ha registrado con éxito.`);
      setLeague('');
      setHomeTeam('');
      setAwayTeam('');
      setCommenceTime('');
      setOddsHome('');
      setOddsDraw('');
      setOddsAway('');
      setStadium('');
      
      await fetchMatches(); // reload matches catalog
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSettleMatch = async (matchId) => {
    const homeVal = scoreHome[matchId];
    const awayVal = scoreAway[matchId];

    if (homeVal === undefined || awayVal === undefined || homeVal === '' || awayVal === '') {
      alert('Ingresa los marcadores finales de ambos equipos.');
      return;
    }

    setSettleLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch('/api/admin/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          scoreHome: parseInt(homeVal),
          scoreAway: parseInt(awayVal)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al liquidar el partido.');
      }

      setSettleSuccess(prev => ({ ...prev, [matchId]: data.message }));
      await refreshUser(); // updates client user state balance
      await fetchMatches(); // refreshes finished statuses in the catalog
    } catch (err) {
      alert(err.message);
      console.error(err);
    } finally {
      setSettleLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };



  const handleDeleteMatch = async (matchId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este partido? Se reembolsarán las apuestas pendientes asociadas en la billetera virtual.')) {
      return;
    }
    
    setDeleteLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el partido.');

      alert(data.message);
      await fetchMatches(); // reload matches catalog
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  const handleStartLive = async (matchId) => {
    setLiveLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch('/api/admin/start-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar simulación.');

      alert(data.message);
      await fetchMatches(); // reload matches catalog
    } catch (err) {
      alert(err.message);
    } finally {
      setLiveLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={26} style={{ color: 'var(--accent-green)' }} />
            Consola del Administrador
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Inserta nuevos encuentros deportivos y finaliza los activos para liquidar los pagos en la base de datos SQL.
          </p>
        </div>
        <button 
          onClick={fetchMatches} 
          className="btn btn-secondary btn-icon" 
          style={{ padding: '10px' }} 
          title="Recargar partidos"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="sports-grid">
        
        {/* Creator panel */}
        <section className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '17px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <PlusCircle size={18} style={{ color: 'var(--accent-green)' }} />
            Agregar Evento (NoSQL Cloud)
          </h3>

          {formError && <div className="alert-banner warning" style={{ padding: '8px 12px', fontSize: '12px' }}><AlertCircle size={14} /> {formError}</div>}
          {formSuccess && <div className="alert-banner" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--accent-green)', borderColor: 'rgba(245, 158, 11, 0.2)', backgroundColor: 'rgba(245, 158, 11, 0.04)' }}><CheckCircle size={14} /> {formSuccess}</div>}

          <form onSubmit={handleCreateMatch}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Deporte</label>
                <select className="form-input" value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="Fútbol">Fútbol</option>
                  <option value="Baloncesto">Baloncesto</option>
                  <option value="Tenis">Tenis</option>
                  <option value="E-Sports">E-Sports</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Liga / Torneo</label>
                <input type="text" className="form-input" placeholder="Ej. Champions League" value={league} onChange={(e) => setLeague(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Local</label>
                <input type="text" className="form-input" placeholder="Ej. Real Madrid" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Visitante</label>
                <input type="text" className="form-input" placeholder="Ej. Manchester City" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Fecha y Hora de Inicio</label>
                <input type="datetime-local" className="form-input" value={commenceTime} onChange={(e) => setCommenceTime(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Estadio / Arena</label>
                <input type="text" className="form-input" placeholder="Ej. Wembley" value={stadium} onChange={(e) => setStadium(e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '14px 0 16px 0', paddingTop: '14px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Configuración de Cuotas Decimales</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label className="form-label">Gana Local (1)</label>
                  <input type="number" step="0.01" min="1.01" className="form-input" placeholder="1.85" value={oddsHome} onChange={(e) => setOddsHome(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Empate (X)</label>
                  <input type="number" step="0.01" min="1.01" className="form-input" placeholder="Ej. 3.40 (Vacío si no hay)" value={oddsDraw} onChange={(e) => setOddsDraw(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Gana Vis. (2)</label>
                  <input type="number" step="0.01" min="1.01" className="form-input" placeholder="2.45" value={oddsAway} onChange={(e) => setOddsAway(e.target.value)} required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '13px' }} disabled={formLoading}>
              {formLoading ? 'Guardando partido...' : 'Añadir Partido a Catálogo'}
            </button>
          </form>
        </section>

        {/* Closing panel */}
        <section className="card">
          <h3 style={{ fontSize: '17px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Trophy size={18} style={{ color: 'var(--accent-cyan)' }} />
            Finalizar & Resolver Apuestas
          </h3>

          {loadingMatches ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', fontSize: '14px' }}>Cargando catálogo de partidos...</p>
          ) : error ? (
            <p style={{ color: 'var(--status-lost)', textAlign: 'center', padding: '40px', fontSize: '14px' }}>Error: {error}</p>
          ) : matches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No hay eventos disponibles en el catálogo.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
              {matches.map(match => (
                <div key={match._id} className="admin-settle-card" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="admin-settle-teams">
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{match.homeTeam} vs {match.awayTeam}</span>
                    <span className="badge badge-upcoming" style={{ fontSize: '10px' }}>{match.sport}</span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                    <span>Torneo: {match.league}</span>
                    <span>Fecha: {new Date(match.commenceTime).toLocaleDateString()}</span>
                  </div>

                  {match.status === 'finished' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Marcador final:</span>
                        <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-display)', fontSize: '16px' }}>
                          {match.score.home} - {match.score.away} ({match.actualOutcome === 'home' ? 'Ganó Local' : match.actualOutcome === 'away' ? 'Ganó Visitante' : 'Empate'})
                        </strong>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '11px', padding: '6px', marginTop: '8px', color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.2)', background: 'rgba(255,77,77,0.02)' }}
                        onClick={() => handleDeleteMatch(match._id)}
                        disabled={deleteLoading[match._id]}
                      >
                        {deleteLoading[match._id] ? 'Eliminando...' : '🗑 Eliminar Partido del Catálogo'}
                      </button>
                    </div>
                  ) : match.status === 'live' ? (
                    <div>
                      <div style={{ backgroundColor: 'rgba(0,188,212,0.06)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', animation: 'pulse 1.5s infinite' }} />
                            {match.sport?.toLowerCase() === 'baloncesto' ? '🏀 SIMULACIÓN BALONCESTO' : '⚽ SIMULACIÓN EN VIVO'}
                          </span>
                          <span style={{ fontSize: '13px', color: '#fff' }}>Minuto {match.minute}'</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '14px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Marcador Actual:</span>
                          <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-display)', fontSize: '15px' }}>{match.score.home} - {match.score.away}</strong>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '11px', padding: '6px', marginTop: '8px', color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.2)', background: 'rgba(255,77,77,0.02)' }}
                        onClick={() => handleDeleteMatch(match._id)}
                        disabled={deleteLoading[match._id]}
                      >
                        {deleteLoading[match._id] ? 'Eliminando...' : '🗑 Forzar Eliminación y Reembolsar'}
                      </button>
                    </div>
                  ) : settleSuccess[match._id] ? (
                    <div>
                      <div className="alert-banner" style={{ margin: '8px 0 0 0', padding: '8px 12px', fontSize: '12px', color: 'var(--accent-green)', borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245, 158, 11, 0.04)' }}>
                        <CheckCircle size={14} />
                        <span>{settleSuccess[match._id]}</span>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '11px', padding: '6px', marginTop: '8px', color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.2)', background: 'rgba(255,77,77,0.02)' }}
                        onClick={() => handleDeleteMatch(match._id)}
                        disabled={deleteLoading[match._id]}
                      >
                        {deleteLoading[match._id] ? 'Eliminando...' : '🗑 Eliminar Partido'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="admin-settle-inputs">
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)', marginBottom: '4px' }}>Goles Local</span>
                          <input
                            type="number"
                            min="0"
                            className="admin-score-input"
                            placeholder="0"
                            value={scoreHome[match._id] ?? ''}
                            onChange={(e) => setScoreHome(prev => ({ ...prev, [match._id]: e.target.value }))}
                            disabled={settleLoading[match._id]}
                          />
                        </div>
                        <span className="admin-score-separator" style={{ marginTop: '16px' }}>-</span>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)', marginBottom: '4px' }}>Goles Vis.</span>
                          <input
                            type="number"
                            min="0"
                            className="admin-score-input"
                            placeholder="0"
                            value={scoreAway[match._id] ?? ''}
                            onChange={(e) => setScoreAway(prev => ({ ...prev, [match._id]: e.target.value }))}
                            disabled={settleLoading[match._id]}
                          />
                        </div>
                      </div>
                      <button
                        className="btn btn-outline-neon"
                        style={{ width: '100%', fontSize: '12px', padding: '10px', marginTop: '6px' }}
                        onClick={() => handleSettleMatch(match._id)}
                        disabled={settleLoading[match._id]}
                      >
                        {settleLoading[match._id] ? 'Procesando pagos SQL...' : 'Cerrar y Liquidar Apuestas'}
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '12px', padding: '10px', marginTop: '6px', background: 'linear-gradient(135deg, var(--accent-cyan), #008ba3)', color: '#fff', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleStartLive(match._id)}
                        disabled={liveLoading[match._id] || settleLoading[match._id]}
                      >
                        {liveLoading[match._id] ? 'Iniciando en vivo...' : 'Simular Partido EN VIVO'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', fontSize: '11px', padding: '6px', marginTop: '6px', color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.2)', background: 'rgba(255,77,77,0.02)' }}
                        onClick={() => handleDeleteMatch(match._id)}
                        disabled={deleteLoading[match._id]}
                      >
                        {deleteLoading[match._id] ? 'Eliminando...' : '🗑 Eliminar Partido programado'}
                      </button>
                    </div>
                  )}
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
