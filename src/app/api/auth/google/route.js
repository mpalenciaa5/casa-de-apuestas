import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { signToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    let email, name, googleId;

    if (body.isDemo) {
      // Fallback/Demo chooser account selection
      email = body.email.toLowerCase().trim();
      name = body.name;
      googleId = 'google_demo_' + email.replace(/[^a-zA-Z0-9]/g, '');
    } else if (body.credential) {
      // Real Google Identity Services JWT token
      try {
        const payload = JSON.parse(
          Buffer.from(body.credential.split('.')[1], 'base64').toString('utf-8')
        );
        email = payload.email.toLowerCase().trim();
        name = payload.name;
        googleId = 'google_real_' + payload.sub;
      } catch (err) {
        console.error('Failed to parse Google JWT credential:', err);
        return NextResponse.json({ error: 'Token de Google no válido o corrupto.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Parámetros de autenticación incorrectos.' }, { status: 400 });
    }

    if (!email || !name) {
      return NextResponse.json({ error: 'Nombre y correo electrónico requeridos.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Check if the user already exists in the SQLite DB
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      // Determine user role (jurados, evaluadores, admin, and miguelalejandropalenciaalonzo@gmail.com automatically get administrative privileges)
      let role = 'user';
      const cleanEmail = email.toLowerCase();
      if (
        cleanEmail.includes('jurado') || 
        cleanEmail.includes('evaluador') || 
        cleanEmail.includes('admin') ||
        cleanEmail === 'miguelalejandropalenciaalonzo@gmail.com'
      ) {
        role = 'admin';
      }

      // Generate a clean alphanumeric username
      let baseUsername = name.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15);
      if (!baseUsername) baseUsername = 'user_' + Math.floor(Math.random() * 10000);
      let username = baseUsername;
      
      // Handle potential collisions
      let collision = await db.get('SELECT id FROM users WHERE username = ?', [username]);
      let counter = 1;
      while (collision) {
        username = `${baseUsername}${counter}`;
        collision = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        counter++;
      }

      // Insert new user to SQLite
      // We block normal logins for this user by setting a unique mock password hash
      const mockPasswordHash = `google_oauth_blocked_${Date.now()}_${Math.random()}`;
      
      // Default mock DPI and bank account for Google SSO users (Guatemalan format)
      const mockDpi = '1000' + Math.floor(100000000 + Math.random() * 900000000); // 13 digits
      const mockBankAccount = 'GT-BANK-' + Math.floor(100000000 + Math.random() * 900000000);
      const mockBirthDate = '2000-01-01'; // Default legal age date of birth

      const insertResult = await db.run(
        'INSERT INTO users (username, email, password_hash, role, balance, dpi, bank_account, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, email, mockPasswordHash, role, 100.0, mockDpi, mockBankAccount, mockBirthDate]
      );

      const userId = insertResult.lastID;

      user = {
        id: userId,
        username,
        email,
        balance: 100.0,
        role
      };

      // Log registration to NoSQL (MongoDB Atlas)
      await logUserActivity(userId, 'register', { username, email, provider: 'google', role, dpi: mockDpi, bankAccount: mockBankAccount });

    } else {
      // Force 'admin' role for this email if they already exist in database as 'user'
      const cleanEmail = email.toLowerCase();
      if (cleanEmail === 'miguelalejandropalenciaalonzo@gmail.com') {
        user.role = 'admin';
        await db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', user.id]);
      } else if (user.role === undefined) {
        user.role = 'user';
      }
    }

    // Log the user login event in the cloud MongoDB
    await logUserActivity(user.id, 'login', { email: user.email, provider: 'google' });

    // Generate session JWT token including role
    const token = signToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });

    // Set secure HTTP-only cookie with sameSite property to protect against CSRF
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Error in POST /api/auth/google:', error);
    return NextResponse.json(
      { error: `Error de servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
