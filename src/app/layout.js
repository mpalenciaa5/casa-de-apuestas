import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Script from 'next/script';

export const metadata = {
  title: 'ApexBet - Casa de Apuestas Premium',
  description: 'La casa de apuestas deportivas y casino online más premium, segura y avanzada.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <Navbar />
          
          <main className="main-container">
            {children}
          </main>
          
          <footer className="footer">
            <div className="footer-logo">
              APEX<span>BET</span>
            </div>
            <div className="footer-text">
              © {new Date().getFullYear()} ApexBet. Todos los derechos reservados.
            </div>
            <div className="footer-text" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Plataforma oficial certificada. Autorizada por la Comisión Nacional de Juegos de Azar. Juego Responsable (18+).
            </div>
          </footer>
        </AuthProvider>
        <Script 
          src="https://accounts.google.com/gsi/client" 
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
