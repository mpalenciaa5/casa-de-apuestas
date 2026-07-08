import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

// POST: Process a deposit or withdrawal in SQLite and log in MongoDB
export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
    }

    const { type, amount } = await request.json(); // type: 'deposit' | 'withdrawal'

    if (!type || !amount) {
      return NextResponse.json({ error: 'Faltan campos requeridos (tipo y monto).' }, { status: 400 });
    }

    const txAmount = parseFloat(amount);
    if (isNaN(txAmount) || txAmount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un número positivo mayor que cero.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Query current user balance
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    let newBalance = user.balance;

    // Preventively clean up any lingering transaction on this SQLite connection
    try {
      await db.run('ROLLBACK');
    } catch (e) {}

    await db.run('BEGIN TRANSACTION');
    try {
      if (type === 'deposit') {
        newBalance = parseFloat((user.balance + txAmount).toFixed(2));
        await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [txAmount, decoded.userId]);
        await db.run('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [decoded.userId, 'deposit', txAmount]);
      } else if (type === 'withdrawal') {
        if (user.balance < txAmount) {
          await db.run('ROLLBACK');
          return NextResponse.json({ error: 'Saldo insuficiente para retirar.' }, { status: 400 });
        }
        newBalance = parseFloat((user.balance - txAmount).toFixed(2));
        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [txAmount, decoded.userId]);
        await db.run('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [decoded.userId, 'withdrawal', -txAmount]);
      } else {
        await db.run('ROLLBACK');
        return NextResponse.json({ error: 'Tipo de transacción no válida.' }, { status: 400 });
      }

      await db.run('COMMIT');

      // Log the financial transaction in MongoDB logs (non-blocking, catch network errors)
      try {
        await logUserActivity(decoded.userId, type, { amount: txAmount, newBalance });
      } catch (logErr) {
        console.warn('[Wallet Log Warning] No se pudo registrar la actividad en MongoDB Atlas:', logErr.message);
      }

      return NextResponse.json({
        success: true,
        message: `${type === 'deposit' ? 'Depósito' : 'Retiro'} completado con éxito.`,
        newBalance: newBalance
      });

    } catch (txError) {
      try {
        await db.run('ROLLBACK');
      } catch (rbErr) {}
      console.error('SQL Wallet Transaction failed, rolled back:', txError);
      throw txError;
    }

  } catch (error) {
    console.error('Error in POST /api/wallet:', error);
    return NextResponse.json({ error: 'Error al procesar la transacción en el servidor.' }, { status: 500 });
  }
}
