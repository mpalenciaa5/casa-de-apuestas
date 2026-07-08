'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Wallet, LogOut, User, LogIn, Trophy } from 'lucide-react';

export default function Navbar() {
  const { user, logout, setAuthModal } = useAuth();
  const pathname = usePathname();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="logo">
          <Trophy size={26} style={{ color: 'var(--accent-green)' }} />
          APEX<span>BET</span>
        </Link>

        <nav className="nav-links">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            Apuestas
          </Link>
          <Link href="/casino" className={`nav-link ${pathname === '/casino' ? 'active' : ''}`}>
            Casino
          </Link>
          {user && (
            <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard / Wallet
            </Link>
          )}
          <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>
            Consola Admin
          </Link>
        </nav>

        <div className="auth-buttons">
          {user ? (
            <div className="user-widget">
              <span className="user-widget-balance">
                <Wallet size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                Q{user.balance.toFixed(2)}
              </span>
              <span className="user-widget-name">
                <User size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                {user.username}
              </span>
              <button 
                onClick={logout} 
                className="btn btn-secondary btn-icon" 
                style={{ padding: '6px 8px' }}
                title="Cerrar Sesión"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setAuthModal('login')} className="btn btn-secondary">
                <LogIn size={15} /> Ingresar
              </button>
              <button onClick={() => setAuthModal('register')} className="btn btn-primary">
                Registrarse
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
