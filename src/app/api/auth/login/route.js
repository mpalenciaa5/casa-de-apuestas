import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'El correo y la contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const db = await getSQLDB();

    // Query SQLite SQL database for user
    const user = await db.get(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Correo o contraseña incorrectos' },
        { status: 400 }
      );
    }

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Correo o contraseña incorrectos' },
        { status: 400 }
      );
    }

    // Log the user login event in the cloud MongoDB (NoSQL)
    await logUserActivity(user.id, 'login', { email: user.email });

    // Generate JWT token including role
    const token = signToken({ 
      userId: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role || 'user' 
    });

    // Set secure HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        balance: user.balance, 
        role: user.role || 'user' 
      }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Error in login route:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor al iniciar sesión' },
      { status: 500 }
    );
  }
}
