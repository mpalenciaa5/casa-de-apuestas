import { getSQLDB } from '@/lib/db-sql';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false, message: 'No autenticado.' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ authenticated: false, message: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const db = await getSQLDB();
    
    // Fetch latest user details (especially wallet balance) from SQLite (SQL)
    const user = await db.get(
      'SELECT id, username, email, balance, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json({ authenticated: false, message: 'Usuario no encontrado.' }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user
    });
  } catch (error) {
    console.error('Error in /api/auth/me route:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor' },
      { status: 500 }
    );
  }
}
