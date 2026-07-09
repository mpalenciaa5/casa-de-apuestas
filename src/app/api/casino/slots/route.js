import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

const SYMBOLS = ['🍋', '🍒', '🍀', '💎', '7️⃣'];

// Multipliers:
// 3 of same: 7️⃣ = 50x, 💎 = 25x, 🍀 = 12x, 🍒 = 6x, 🍋 = 4x
// 2 of same: any = 1.5x
function calculateSlotsResult(reels, bet) {
  const [r1, r2, r3] = reels;

  if (r1 === r2 && r2 === r3) {
    let multiplier = 4; // default Lemon 3x
    if (r1 === '7️⃣') multiplier = 50;
    else if (r1 === '💎') multiplier = 25;
    else if (r1 === '🍀') multiplier = 12;
    else if (r1 === '🍒') multiplier = 6;
    
    return { multiplier, payout: parseFloat((bet * multiplier).toFixed(2)), isWin: true };
  }

  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const multiplier = 1.5;
    return { multiplier, payout: parseFloat((bet * multiplier).toFixed(2)), isWin: true };
  }

  return { multiplier: 0, payout: 0, isWin: false };
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

    const { bet } = await request.json();
    const betAmount = parseFloat(bet);

    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: 'La apuesta debe ser un número positivo mayor a cero.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Verify balance
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (user.balance < betAmount && !isAdmin) {
      return NextResponse.json({ error: 'Saldo insuficiente para realizar este giro.' }, { status: 400 });
    }

    // Spin reels
    const reels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    ];

    const { multiplier, payout, isWin } = calculateSlotsResult(reels, betAmount);
    
    // Net result of transaction: balance = current - bet + payout
    const newBalance = parseFloat((user.balance - betAmount + payout).toFixed(2));

    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Update SQLite balance
      await db.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, decoded.userId]
      );

      // 2. Insert transaction receipt
      const netTransAmount = isWin ? parseFloat((payout - betAmount).toFixed(2)) : -betAmount;
      await db.run(
        'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
        [decoded.userId, isWin ? 'casino_slots_win' : 'casino_slots_loss', netTransAmount]
      );

      await db.run('COMMIT');

      // 3. Log to Cloud NoSQL (MongoDB Atlas)
      await logUserActivity(decoded.userId, 'casino_slots', {
        bet: betAmount,
        reels: reels,
        payout: payout,
        multiplier: multiplier,
        result: isWin ? 'win' : 'lose',
        newBalance: newBalance
      });

      return NextResponse.json({
        success: true,
        reels,
        winAmount: payout,
        newBalance,
        isWinner: isWin
      });

    } catch (txErr) {
      await db.run('ROLLBACK');
      console.error('SQLite Slots Transaction failed, rolled back:', txErr);
      throw txErr;
    }

  } catch (error) {
    console.error('Error in POST /api/casino/slots:', error);
    return NextResponse.json({ error: 'Error al procesar la jugada en el servidor.' }, { status: 500 });
  }
}
