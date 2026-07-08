import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

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

    // Admins are prohibited from betting
    if (decoded.role === 'admin') {
      return NextResponse.json({ error: 'Los administradores no tienen permitido realizar apuestas.' }, { status: 403 });
    }

    const { bet, outcome } = await request.json();
    const betAmount = parseFloat(bet);

    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: 'La apuesta debe ser un número positivo mayor a cero.' }, { status: 400 });
    }

    const validOutcomes = ['win', 'blackjack', 'lose', 'push'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Resultado de juego no válido.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Verify user balance
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (user.balance < betAmount) {
      return NextResponse.json({ error: 'Saldo insuficiente para realizar esta apuesta.' }, { status: 400 });
    }

    // Calculate payouts
    let payout = 0;
    if (outcome === 'win') {
      payout = parseFloat((betAmount * 2).toFixed(2));
    } else if (outcome === 'blackjack') {
      payout = parseFloat((betAmount * 2.5).toFixed(2));
    } else if (outcome === 'push') {
      payout = betAmount;
    }

    const newBalance = parseFloat((user.balance - betAmount + payout).toFixed(2));
    const netResult = parseFloat((payout - betAmount).toFixed(2));

    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Update SQLite balance
      await db.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, decoded.userId]
      );

      // 2. Insert transaction receipt
      let txType = 'casino_blackjack_loss';
      if (outcome === 'win' || outcome === 'blackjack') {
        txType = 'casino_blackjack_win';
      } else if (outcome === 'push') {
        txType = 'casino_blackjack_push';
      }

      await db.run(
        'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
        [decoded.userId, txType, netResult]
      );

      await db.run('COMMIT');

      // 3. Log to Cloud NoSQL (MongoDB Atlas)
      await logUserActivity(decoded.userId, 'casino_blackjack', {
        bet: betAmount,
        outcome: outcome,
        payout: payout,
        netResult: netResult,
        newBalance: newBalance
      });

      return NextResponse.json({
        success: true,
        winAmount: payout,
        netResult: netResult,
        newBalance: newBalance
      });

    } catch (txErr) {
      await db.run('ROLLBACK');
      console.error('SQLite Blackjack Transaction failed, rolled back:', txErr);
      throw txErr;
    }

  } catch (error) {
    console.error('Error in POST /api/casino/blackjack:', error);
    return NextResponse.json({ error: 'Error al procesar la jugada en el servidor.' }, { status: 500 });
  }
}
