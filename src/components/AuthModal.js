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

  const handleGoogleCredentialResponse = async (response) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, isDemo: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al autenticar con Google real.');
      
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Initialize real Google Sign-In button when the modal is open
  useEffect(() => {
    if (!authModal) return;

    const initGoogleSignIn = () => {
      if (typeof window !== 'undefined' && window.google) {
        try {
          window.google.accounts.id.initialize({
            client_id: '717687016540-213lco9cfpupdoftvsp0adctnqvkbumb.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse
          });
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-btn-container'),
            { theme: 'outline', size: 'large', width: 340, text: 'signin_with' }
          );
        } catch (err) {
          console.error('Error rendering Google button:', err);
        }
      }
    };

    // Try immediately and also add a small timeout to let the gsi client script load
    initGoogleSignIn();
    const timer = setTimeout(initGoogleSignIn, 500);
    return () => clearTimeout(timer);
  }, [authModal]);

  // Reset local states when modal toggles
  useEffect(() => {
    setError(null);
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
            {authModal === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <button className="modal-close" onClick={() => setAuthModal(null)}>
            <X size={18} />
          </button>
        </div>
        
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

          {/* Official Google Identity Services button container */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div id="google-signin-btn-container" style={{ minHeight: '40px', display: 'flex', justifyContent: 'center' }}></div>
          </div>

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
      </div>
    </div>
  );
}
