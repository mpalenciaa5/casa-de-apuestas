import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

const MULTIPLIERS = {
  green: [18, 3.2, 1.6, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 1.6, 3.2, 18],
  yellow: [55, 12, 5.6, 3.2, 1.6, 1, 0.7, 0.2, 0.7, 1, 1.6, 3.2, 5.6, 12, 55],
  red: [252, 40, 14, 5.3, 2.1, 0.5, 0.2, 0, 0.2, 0.5, 2.1, 5.3, 14, 40, 252]
};

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

    const { bet, risk } = await request.json();
    const betAmount = parseFloat(bet);

    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: 'La apuesta debe ser un número positivo mayor a cero.' }, { status: 400 });
    }

    if (!risk || !MULTIPLIERS[risk]) {
      return NextResponse.json({ error: 'Riesgo no válido.' }, { status: 400 });
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

    // Simulate Plinko Bounces (14 rows of pegs = 14 steps)
    const numRows = 14;
    const path = [];
    let landingIndex = 0;

    for (let r = 0; r < numRows; r++) {
      const step = Math.random() < 0.5 ? 0 : 1; // 0 for Left, 1 for Right
      path.push(step);
      landingIndex += step;
    }

    const multiplier = MULTIPLIERS[risk][landingIndex];
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const netResult = parseFloat((payout - betAmount).toFixed(2));
    const isWin = multiplier > 1;

    const newBalance = parseFloat((user.balance - betAmount + payout).toFixed(2));

    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Update SQLite balance
      await db.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, decoded.userId]
      );

      // 2. Insert transaction receipt
      const txType = isWin ? 'casino_plinko_win' : 'casino_plinko_loss';
      await db.run(
        'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
        [decoded.userId, txType, netResult]
      );

      await db.run('COMMIT');

      // 3. Log to Cloud NoSQL (MongoDB Atlas)
      await logUserActivity(decoded.userId, 'casino_plinko', {
        bet: betAmount,
        risk: risk,
        landingIndex: landingIndex,
        multiplier: multiplier,
        payout: payout,
        netResult: netResult,
        newBalance: newBalance
      });

      return NextResponse.json({
        success: true,
        landingIndex,
        path,
        multiplier,
        winAmount: payout,
        netResult: netResult,
        newBalance: newBalance
      });

    } catch (txErr) {
      await db.run('ROLLBACK');
      console.error('SQLite Plinko Transaction failed, rolled back:', txErr);
      throw txErr;
    }

  } catch (error) {
    console.error('Error in POST /api/casino/plinko:', error);
    return NextResponse.json({ error: 'Error al procesar la jugada en el servidor.' }, { status: 500 });
  }
}
