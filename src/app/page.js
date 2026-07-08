'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Betslip from '@/components/Betslip';
import AuthModal from '@/components/AuthModal';
import { Calendar, Info, RefreshCw, Trophy, Play, CircleDot, Grid, Activity, Target, Award } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { toggleSelection, selections, setBetslipOpen, user, refreshUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSport, setSelectedSport] = useState('Todos');

  // Promos Banner Carousel States
  const banners = [
    { id: 1, text: "🎰 CASINO APEX: ¡Ya están disponibles las Tragamonedas Neón y la Ruleta Europea con multiplicadores hasta 35x!", color: "var(--accent-green)", link: "/casino" },
    { id: 2, text: "⚡ APUESTAS EN VIVO: Las cuotas se actualizan en tiempo real. ¡Apuesta mientras el partido está en juego!", color: "var(--accent-cyan)", link: "/" },
    { id: 3, text: "🎁 BONO DE BIENVENIDA: Registra tu cuenta y recibe Q100 de regalo en tu billetera para apostar.", color: "#d4af37", link: "/" }
  ];
  const [activeBanner, setActiveBanner] = useState(0);

  const silentFetchMatches = async () => {
    try {
      // Use /api/live-sync to update real scores without resetting match state
      const res = await fetch('/api/live-sync');
      const data = await res.json();
      if (res.ok && data.matches) {
        setMatches(data.matches);
      }
      // Also refresh user balance so winnings appear automatically
      if (user) {
        refreshUser();
      }
    } catch (err) {
      console.error('Live-sync failed:', err);
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al conectar con la base de datos NoSQL.');
      }
      setMatches(data.matches);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  // Poll live scores every 30 seconds via /api/live-sync
  // Also trigger once immediately after initial load
  useEffect(() => {
    const pollTimer = setInterval(() => {
      silentFetchMatches();
    }, 30000);
    // Run once right after initial mount (after 2s delay for initial load)
    const initTimer = setTimeout(() => silentFetchMatches(), 2000);
    return () => {
      clearInterval(pollTimer);
      clearTimeout(initTimer);
    };
  }, []);

  // Banner rotation interval
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner(prev => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Simulate live odds fluctuations for realistic feel (fallback for upcoming matches)
  useEffect(() => {
    if (matches.length === 0) return;

    const interval = setInterval(() => {
      const randIdx = Math.floor(Math.random() * matches.length);
      const targetMatch = matches[randIdx];

      if (!targetMatch || targetMatch.status !== 'upcoming') return;

      const outcomes = ['home', 'away'];
      if (targetMatch.odds.draw !== null) outcomes.push('draw');
      
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const currentOdds = targetMatch.odds[outcome];
      
      const change = Math.random() > 0.45 ? 0.05 : -0.05;
      const newOdds = parseFloat(Math.max(1.05, currentOdds + change).toFixed(2));

      setMatches(prev => prev.map((m, idx) => {
        if (idx === randIdx) {
          return {
            ...m,
            odds: { ...m.odds, [outcome]: newOdds },
            oddsChange: { outcome, direction: change > 0 ? 'up' : 'down' }
          };
        }
        return m;
      }));

      setTimeout(() => {
        setMatches(prev => prev.map((m, idx) => {
          if (idx === randIdx) {
            return { ...m, oddsChange: null };
          }
          return m;
        }));
      }, 2500);

    }, 5500);

    return () => clearInterval(interval);
  }, [matches]);

  const getSelectionOutcome = (matchId) => {
    const found = selections.find(s => s.matchId === matchId);
    return found ? found.outcome : null;
  };

  const handleSelectionClick = (match, outcome) => {
    if (user?.role === 'admin') {
      alert('Tu cuenta está registrada con rol de Administrador. Los administradores no tienen permitido colocar apuestas deportivas.');
      return;
    }
    toggleSelection(match, outcome);
  };

  const formatTime = (timeStr) => {
    const d = new Date(timeStr);
    return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const filteredMatches = selectedSport === 'Todos'
    ? matches
    : matches.filter(m => m.sport === selectedSport);

  return (
    <div>
      <div className="promos-banner" style={{ borderLeftColor: banners[activeBanner].color, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#1a1e2a', marginBottom: '20px' }}>
        <p style={{ color: banners[activeBanner].color, margin: 0, fontSize: '14px' }}>{banners[activeBanner].text}</p>
        <Link href={banners[activeBanner].link} className="btn btn-outline-neon" style={{ fontSize: '11px', padding: '6px 12px' }}>
          Explorar
        </Link>
      </div>

      <div className="sportsbook-layout" style={{ display: 'flex', gap: '24px' }}>
        <aside className="sidebar" style={{ width: '240px' }}>
          <h3 className="sidebar-title">Deportes</h3>
          <ul className="sidebar-menu" style={{ listStyle: 'none', padding: 0 }}>
            {['Todos', 'Fútbol', 'Baloncesto', 'Béisbol'].map(sport => {
              const getSportStyle = () => {
                switch(sport) {
                  case 'Fútbol':
                    return {
                      icon: <Activity size={15} />,
                      color: 'var(--accent-green)',
                      glow: 'rgba(57, 255, 20, 0.15)',
                      gradient: 'linear-gradient(90deg, rgba(57, 255, 20, 0.15) 0%, rgba(57, 255, 20, 0.02) 100%)'
                    };
                  case 'Baloncesto':
                    return {
                      icon: <Target size={15} />,
                      color: '#ff8800',
                      glow: 'rgba(255, 136, 0, 0.15)',
                      gradient: 'linear-gradient(90deg, rgba(255, 136, 0, 0.15) 0%, rgba(255, 136, 0, 0.02) 100%)'
                    };
                  case 'Béisbol':
                    return {
                      icon: <Award size={15} />,
                      color: '#ff3366',
                      glow: 'rgba(255, 51, 102, 0.15)',
                      gradient: 'linear-gradient(90deg, rgba(255, 51, 102, 0.15) 0%, rgba(255, 51, 102, 0.02) 100%)'
                    };
                  default:
                    return {
                      icon: <Grid size={15} />,
                      color: 'var(--accent-cyan)',
                      glow: 'rgba(0, 229, 255, 0.15)',
                      gradient: 'linear-gradient(90deg, rgba(0, 229, 255, 0.15) 0%, rgba(0, 229, 255, 0.02) 100%)'
                    };
                }
              };

              const styleObj = getSportStyle();
              const isActive = selectedSport === sport;
              const count = sport === 'Todos' 
                ? matches.length 
                : matches.filter(m => m.sport === sport).length;

              return (
                <li key={sport} style={{ marginBottom: '10px' }}>
                  <button
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedSport(sport)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '13px 16px',
                      background: isActive 
                        ? styleObj.gradient 
                        : 'rgba(26, 30, 42, 0.65)',
                      border: isActive ? `1px solid ${styleObj.color}` : '1px solid rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isActive ? `0 0 20px ${styleObj.glow}` : 'none',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(26, 30, 42, 0.9)';
                        e.currentTarget.style.borderColor = styleObj.color;
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.transform = 'translateX(6px)';
                        e.currentTarget.style.boxShadow = `0 4px 15px rgba(0,0,0,0.3), 0 0 10px ${styleObj.glow}`;
                        const iconSpan = e.currentTarget.querySelector('.sport-icon');
                        if (iconSpan) iconSpan.style.color = styleObj.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(26, 30, 42, 0.65)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                        const iconSpan = e.currentTarget.querySelector('.sport-icon');
                        if (iconSpan) iconSpan.style.color = 'var(--text-muted)';
                      }
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '3.5px',
                        backgroundColor: styleObj.color,
                        boxShadow: `0 0 10px ${styleObj.color}`
                      }} />
                    )}
                    <span 
                      className="sport-icon"
                      style={{ 
                        color: isActive ? styleObj.color : 'var(--text-muted)', 
                        display: 'flex', 
                        alignItems: 'center',
                        transition: 'color 0.2s',
                        filter: isActive ? `drop-shadow(0 0 4px ${styleObj.color})` : 'none'
                      }}
                    >
                      {styleObj.icon}
                    </span>
                    <span style={{ letterSpacing: '0.2px' }}>{sport}</span>
                    
                    <span 
                      style={{ 
                        marginLeft: 'auto', 
                        fontSize: '10.5px', 
                        background: isActive ? styleObj.color : 'rgba(255, 255, 255, 0.04)', 
                        color: isActive ? '#000' : 'var(--text-muted)', 
                        padding: '2px 8px', 
                        borderRadius: '20px', 
                        fontWeight: '900',
                        transition: 'all 0.2s',
                        border: isActive ? 'none' : '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="matches-container" style={{ flex: 1 }}>
          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} style={{ color: 'var(--accent-green)' }} />
                Cartelera de Eventos
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                Coloca tus pronósticos deportivos oficiales en tiempo real. Cuotas actualizadas al instante.
              </p>
            </div>
            <button className="btn btn-icon-only" onClick={fetchMatches} style={{ alignSelf: 'center', padding: '10px' }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <div style={{ border: '3px solid rgba(255,255,255,0.06)', borderTop: '3px solid var(--accent-green)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            </div>
          ) : error ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <Info size={36} style={{ color: 'var(--status-lost)', marginBottom: '12px' }} />
              <h3 style={{ marginBottom: '8px' }}>Error de Red o Conexión</h3>
              <p>Ocurrió un error al cargar los eventos deportivos.</p>
              <button className="btn btn-secondary" onClick={fetchMatches} style={{ margin: '0 auto', display: 'block' }}>Reintentar Conexión</button>
            </div>
          ) : (
            <div className="matches-list">
              {filteredMatches.map(match => {
                const activeOutcome = getSelectionOutcome(match._id);
                return (
                  <div key={match._id} className="card match-card">
                    <div className="match-info">
                      <div className="match-league">
                        <CircleDot size={10} style={{ color: match.status === 'live' ? (match.halftime ? '#f5a623' : 'var(--status-lost)') : 'var(--accent-cyan)' }} />
                        {match.league}
                        {match.status === 'live' && !match.halftime && (
                          <span className="badge badge-live" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '6px' }}>
                            EN VIVO
                          </span>
                        )}
                        {match.status === 'live' && match.halftime && (
                          <span style={{ fontSize: '9px', padding: '2px 7px', marginLeft: '6px', background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.5)', borderRadius: '4px', color: '#f5a623', fontWeight: '800', letterSpacing: '0.5px' }}>
                            MEDIO TIEMPO
                          </span>
                        )}
                        {match.status === 'finished' && (
                          <span className="badge badge-lost" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '6px', color: 'var(--text-muted)', borderColor: 'var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            FINALIZADO
                          </span>
                        )}
                      </div>
                      <div className="match-teams">
                        <span className="team-name">{match.homeTeam}</span>
                        {match.status === 'finished' || match.status === 'live' ? (
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: '800', color: 'var(--accent-green)', padding: '0 10px' }}>
                            {match.score?.home ?? 0} - {match.score?.away ?? 0}
                          </span>
                        ) : (
                          <span className="match-vs">vs</span>
                        )}
                        <span className="team-name">{match.awayTeam}</span>
                      </div>
                      <div className="match-time">
                        <Calendar size={13} />
                        {match.status === 'finished' ? (
                          'Partido finalizado y liquidado'
                        ) : match.status === 'live' && match.halftime ? (
                          <span style={{ color: '#f5a623', fontWeight: 'bold' }}>
                            ⏱ Medio Tiempo (45+) — Descansando
                          </span>
                        ) : match.status === 'live' ? (
                          (() => {
                            const isBasketball = match.sport?.toLowerCase() === 'baloncesto' || match.sport?.toLowerCase() === 'básquetbol';
                            return (
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                                {isBasketball ? '🏀' : '⚽'} Minuto {match.minute !== undefined ? match.minute : 0}' - En vivo
                              </span>
                            );
                          })()
                        ) : (
                          formatTime(match.commenceTime)
                        )}
                      </div>
                    </div>

                    {(match.status === 'upcoming' || match.status === 'live') && (
                      <div className={`odds-buttons${match.status === 'live' ? ' match-live' : ''}`}>
                        {/* Home button */}
                        <button
                          className={`odds-btn ${activeOutcome === 'home' ? 'active' : ''}`}
                          onClick={() => handleSelectionClick(match, 'home')}
                          style={{ '--btn-index': 0 }}
                          title={`Apostar por ${match.homeTeam}`}
                        >
                          <span className="odds-label">{match.homeTeam.split(' ')[0].slice(0,6)}</span>
                          <span className="odds-value">
                            {match.odds.home.toFixed(2)}
                            {match.oddsChange && match.oddsChange.outcome === 'home' && (
                              <span style={{ fontSize: '10px', marginLeft: '3px', color: match.oddsChange.direction === 'up' ? '#f59e0b' : '#ff4d4d' }}>
                                {match.oddsChange.direction === 'up' ? '▲' : '▼'}
                              </span>
                            )}
                          </span>
                        </button>

                        {/* Draw button */}
                        {match.odds.draw !== null && (
                          <button
                            className={`odds-btn ${activeOutcome === 'draw' ? 'active' : ''}`}
                            onClick={() => handleSelectionClick(match, 'draw')}
                            style={{ '--btn-index': 1 }}
                            title="Apostar por Empate"
                          >
                            <span className="odds-label">Empate</span>
                            <span className="odds-value">
                              {match.odds.draw.toFixed(2)}
                              {match.oddsChange && match.oddsChange.outcome === 'draw' && (
                                <span style={{ fontSize: '10px', marginLeft: '3px', color: match.oddsChange.direction === 'up' ? '#f59e0b' : '#ff4d4d' }}>
                                  {match.oddsChange.direction === 'up' ? '▲' : '▼'}
                                </span>
                              )}
                            </span>
                          </button>
                        )}

                        {/* Away button */}
                        <button
                          className={`odds-btn ${activeOutcome === 'away' ? 'active' : ''}`}
                          onClick={() => handleSelectionClick(match, 'away')}
                          style={{ '--btn-index': match.odds.draw !== null ? 2 : 1 }}
                          title={`Apostar por ${match.awayTeam}`}
                        >
                          <span className="odds-label">{match.awayTeam.split(' ')[0].slice(0,6)}</span>
                          <span className="odds-value">
                            {match.odds.away.toFixed(2)}
                            {match.oddsChange && match.oddsChange.outcome === 'away' && (
                              <span style={{ fontSize: '10px', marginLeft: '3px', color: match.oddsChange.direction === 'up' ? '#f59e0b' : '#ff4d4d' }}>
                                {match.oddsChange.direction === 'up' ? '▲' : '▼'}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating toggle for screens where drawer hide is expected */}
      {selections.length > 0 && user?.role !== 'admin' && (
        <button className="betslip-trigger" onClick={() => setBetslipOpen(true)}>
          Boleta de Apuesta
          <span className="betslip-count">{selections.length}</span>
        </button>
      )}

      {user?.role !== 'admin' && <Betslip />}
      <AuthModal />
    </div>
  );
}
