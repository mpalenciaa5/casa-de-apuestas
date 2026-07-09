import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

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

    // Admins are permitted to play for demonstration/testing
    const isAdmin = decoded.role === 'admin' || decoded.email === 'miguelalejandropalenciaalonzo@gmail.com';

    const { betType, targetNumber, betAmount } = await request.json();
    const amount = parseFloat(betAmount);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Monto de la apuesta no válido.' }, { status: 400 });
    }

    if (!['red', 'black', 'even', 'odd', 'zero', 'number'].includes(betType)) {
      return NextResponse.json({ error: 'Tipo de apuesta de ruleta no válido.' }, { status: 400 });
    }

    const targetNum = parseInt(targetNumber);
    if (betType === 'number' && (isNaN(targetNum) || targetNum < 0 || targetNum > 36)) {
      return NextResponse.json({ error: 'El número seleccionado debe estar entre 0 y 36.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Verify balance
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (user.balance < amount && !isAdmin) {
      return NextResponse.json({ error: 'Saldo insuficiente para colocar esta apuesta.' }, { status: 400 });
    }

    // Spin the Roulette (0 to 36)
    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = getNumberColor(winningNumber);
    
    const isEven = winningNumber > 0 && winningNumber % 2 === 0;
    const isOdd = winningNumber > 0 && winningNumber % 2 !== 0;

    let isWin = false;
    let multiplier = 0;

    // Evaluate Win Rules
    if (betType === 'red' && winningColor === 'red') {
      isWin = true;
      multiplier = 2;
    } else if (betType === 'black' && winningColor === 'black') {
      isWin = true;
      multiplier = 2;
    } else if (betType === 'even' && isEven) {
      isWin = true;
      multiplier = 2;
    } else if (betType === 'odd' && isOdd) {
      isWin = true;
      multiplier = 2;
    } else if (betType === 'zero' && winningNumber === 0) {
      isWin = true;
      multiplier = 35;
    } else if (betType === 'number' && winningNumber === targetNum) {
      isWin = true;
      multiplier = 35;
    }

    const payout = isWin ? parseFloat((amount * multiplier).toFixed(2)) : 0;
    const newBalance = parseFloat((user.balance - amount + payout).toFixed(2));

    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Update SQLite balance
      await db.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, decoded.userId]
      );

      // 2. Insert transaction receipt
      const netTransAmount = isWin ? parseFloat((payout - amount).toFixed(2)) : -amount;
      await db.run(
        'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
        [decoded.userId, isWin ? 'casino_roulette_win' : 'casino_roulette_loss', netTransAmount]
      );

      await db.run('COMMIT');

      // 3. Log to Cloud NoSQL (MongoDB Atlas)
      await logUserActivity(decoded.userId, 'casino_roulette', {
        betType: betType,
        targetNumber: betType === 'number' ? targetNum : null,
        betAmount: amount,
        winningNumber: winningNumber,
        winningColor: winningColor,
        payout: payout,
        result: isWin ? 'win' : 'lose',
        newBalance: newBalance
      });

      return NextResponse.json({
        success: true,
        winningNumber,
        winningColor,
        winAmount: payout,
        newBalance,
        isWinner: isWin
      });

    } catch (txErr) {
      await db.run('ROLLBACK');
      console.error('SQLite Roulette Transaction failed, rolled back:', txErr);
      throw txErr;
    }

  } catch (error) {
    console.error('Error in POST /api/casino/roulette:', error);
    return NextResponse.json({ error: 'Error al procesar la ruleta en el servidor.' }, { status: 500 });
  }
}
