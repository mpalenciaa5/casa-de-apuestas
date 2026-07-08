import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, email, password, dpi, bankAccount, birthDate } = await request.json();

    if (!username || !email || !password || !dpi || !bankAccount || !birthDate) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios (incluyendo DPI, Cuenta Bancaria y Fecha de Nacimiento).' },
        { status: 400 }
      );
    }

    // Input validations to prevent data manipulation and XSS vectors
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de correo electrónico no válido.' },
        { status: 400 }
      );
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe ser alfanumérico (de 3 a 20 caracteres y puede incluir guiones bajos).' },
        { status: 400 }
      );
    }

    if (password.length < 5) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 5 caracteres.' },
        { status: 400 }
      );
    }

    // DPI validation (allows 10 to 20 digits to support various ID formats)
    const cleanDpi = dpi.replace(/[\s-]/g, '');
    const dpiRegex = /^[0-9]{10,20}$/;
    if (!dpiRegex.test(cleanDpi)) {
      return NextResponse.json(
        { error: 'El DPI debe constar de 10 a 20 dígitos numéricos.' },
        { status: 400 }
      );
    }

    // Age validation (must be >= 18, parsed directly to prevent timezone distortion)
    const parts = birthDate.split('-');
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Fecha de nacimiento no válida.' },
        { status: 400 }
      );
    }
    const birthYear = parseInt(parts[0], 10);
    const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    const birthDay = parseInt(parts[2], 10);

    const today = new Date();
    let age = today.getFullYear() - birthYear;
    const m = today.getMonth() - birthMonth;
    if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
      age--;
    }
    if (age < 18) {
      return NextResponse.json(
        { error: 'Debes ser mayor de edad (18 años o más) para registrarte.' },
        { status: 400 }
      );
    }

    // Bank account validation (allows 5 to 30 characters)
    const cleanBankAccount = bankAccount.trim();
    const bankRegex = /^[a-zA-Z0-9-]{5,30}$/;
    if (!bankRegex.test(cleanBankAccount)) {
      return NextResponse.json(
        { error: 'La cuenta bancaria debe tener entre 5 y 30 caracteres alfanuméricos.' },
        { status: 400 }
      );
    }

    const db = await getSQLDB();

    // Check if user already exists in SQL
    const existingUser = await db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email.toLowerCase().trim(), username.trim()]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'El nombre de usuario o correo ya está en uso.' },
        { status: 400 }
      );
    }

    // Check if DPI already exists in SQL
    const existingDpi = await db.get('SELECT id FROM users WHERE dpi = ?', [cleanDpi]);
    if (existingDpi) {
      return NextResponse.json(
        { error: 'Este número de DPI ya se encuentra registrado.' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Role assignment (users containing admin, jurado, or evaluador automatically get admin role)
    let role = 'user';
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail.includes('admin') || cleanEmail.includes('jurado') || cleanEmail.includes('evaluador')) {
      role = 'admin';
    }

    // Insert user into SQLite (starts with Q100 welcome gift balance)
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash, role, balance, dpi, bank_account, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username.trim(), email.toLowerCase().trim(), passwordHash, role, 100.0, cleanDpi, cleanBankAccount, birthDate]
    );

    const userId = result.lastID;

    // Log the user registration in the cloud MongoDB (NoSQL)
    await logUserActivity(userId, 'register', { 
      username: username.trim(), 
      email: email.toLowerCase().trim(), 
      role,
      dpi: cleanDpi,
      bankAccount: cleanBankAccount
    });

    // Generate session JWT including role
    const token = signToken({ userId, username: username.trim(), email: email.toLowerCase().trim(), role });

    // Prepare response with cookies
    const response = NextResponse.json({
      success: true,
      user: { id: userId, username: username.trim(), email: email.toLowerCase().trim(), balance: 100.0, role }
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
    console.error('Error in registration route:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor al registrar el usuario' },
      { status: 500 }
    );
  }
}
