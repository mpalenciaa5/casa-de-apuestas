'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, AlertCircle } from 'lucide-react';

export default function AuthModal() {
  const { authModal, setAuthModal, login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dpi, setDpi] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);

  // Reset local states when modal toggles
  useEffect(() => {
    setError(null);
    setShowGoogleChooser(false);
    setUsername('');
    setEmail('');
    setPassword('');
    setDpi('');
    setBankAccount('');
    setBirthDate('');
  }, [authModal]);

  if (!authModal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (authModal === 'login') {
        await login(email, password);
      } else {
        await register(username, email, password, dpi, bankAccount, birthDate);
      }
      // Reset forms
      setUsername('');
      setEmail('');
      setPassword('');
      setDpi('');
      setBankAccount('');
      setBirthDate('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMockSelect = async (mockEmail, mockName) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mockEmail, name: mockName, isDemo: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la autenticación con Google.');
      
      // Successfully authenticated, reload the page to refresh balance context
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setAuthModal(null);
      setError(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>
            {showGoogleChooser 
              ? 'Acceso con Google' 
              : (authModal === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
          </h2>
          <button className="modal-close" onClick={() => setAuthModal(null)}>
            <X size={18} />
          </button>
        </div>
        
        {!showGoogleChooser ? (
          <div className="modal-body">
            {error && (
              <div className="alert-banner warning">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {authModal === 'register' && (
                <div className="form-group">
                  <label className="form-label">Nombre de Usuario</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. crackApuestas"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authModal === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">DPI (13 dígitos)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. 2999 12345 0101"
                      value={dpi}
                      onChange={(e) => setDpi(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Cuenta de Banco</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. 1029384756"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha de Nacimiento</label>
                    <input
                      type="date"
                      className="form-input"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '16px' }} 
                disabled={loading}
              >
                {loading ? 'Procesando...' : authModal === 'login' ? 'Ingresar' : 'Completar Registro'}
              </button>
            </form>

            <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>O CONTINÚA CON</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
            </div>

            <button 
              type="button" 
              className="btn" 
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '10px', 
                backgroundColor: '#fff', 
                color: '#000', 
                fontWeight: '700',
                border: 'none',
                height: '42px',
                fontSize: '14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
              onClick={() => setShowGoogleChooser(true)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.56 2.69-3.86 2.69-6.6z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.85.87-3.05.87-2.34 0-4.33-1.58-5.03-3.7H1.02v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H1.02a9 9 0 0 0 0 8.08l2.95-2.33z" fill="#FBBC05" />
                <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.4A9 9 0 0 0 1.02 4.96l2.95 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Acceso rápido con Google
            </button>

            <div className="form-footer" style={{ marginTop: '20px' }}>
              {authModal === 'login' ? (
                <>
                  ¿No tienes una cuenta aún?{' '}
                  <span className="form-link" onClick={() => setAuthModal('register')}>
                    Regístrate aquí
                  </span>
                </>
              ) : (
                <>
                  ¿Ya posees una cuenta?{' '}
                  <span className="form-link" onClick={() => setAuthModal('login')}>
                    Inicia sesión aquí
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {error && (
              <div className="alert-banner warning">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', textAlign: 'center', lineHeight: '1.4' }}>
              Selecciona una cuenta de Google para iniciar sesión y sincronizar tu billetera atómica.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {/* Account 1 - Jurado Admin */}
              <div 
                onClick={() => handleGoogleMockSelect('jurado.sistemas@universidad.edu', 'Jurado Evaluador')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  backgroundColor: 'rgba(0, 229, 255, 0.03)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  textAlign: 'left'
                }}
                className="google-account-item"
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#000', flexShrink: 0 }}>
                  JE
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '700', color: '#fff', fontSize: '13px' }}>Jurado Evaluador (Administrador)</div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>jurado.sistemas@universidad.edu</div>
                </div>
              </div>

              {/* Account 2 - Student User */}
              <div 
                onClick={() => handleGoogleMockSelect('miguelalejandropalenciaalonzo_db_user@gmail.com', 'Miguel Palencia')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  textAlign: 'left'
                }}
                className="google-account-item"
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#000', flexShrink: 0 }}>
                  MP
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>Miguel Palencia (Estudiante)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>miguelalejandropalenciaalonzo_db_user@gmail.com</div>
                </div>
              </div>

              {/* Account 3 - Guest Client */}
              <div 
                onClick={() => handleGoogleMockSelect('invitado.apex.bet@gmail.com', 'Usuario Invitado')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  textAlign: 'left'
                }}
                className="google-account-item"
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#000', flexShrink: 0 }}>
                  UI
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>Usuario Invitado (Cliente)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>invitado.apex.bet@gmail.com</div>
                </div>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%' }}
              onClick={() => setShowGoogleChooser(false)}
            >
              Volver a inicio de sesión estándar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
