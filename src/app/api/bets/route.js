import { getSQLDB } from '@/lib/db-sql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

// GET: Retrieve bet history for the authenticated user
export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
    }

    const db = await getSQLDB();
    
    // Fetch bets from SQL ordered by newest first
    const bets = await db.all(
      'SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC',
      [decoded.userId]
    );

    return NextResponse.json({ success: true, bets });
  } catch (error) {
    console.error('Error in GET /api/bets:', error);
    return NextResponse.json({ error: 'Error al obtener el historial de apuestas.' }, { status: 500 });
  }
}

// POST: Place a new bet
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

    // Admins are permitted to place bets for demonstration/testing
    const isAdmin = decoded.role === 'admin' || decoded.email === 'miguelalejandropalenciaalonzo@gmail.com';

    const { matchId, sport, homeTeam, awayTeam, selectedOutcome, odds, amount } = await request.json();

    // Validations
    if (!matchId || !sport || !homeTeam || !awayTeam || !selectedOutcome || !odds || !amount) {
      return NextResponse.json({ error: 'Faltan datos obligatorios para colocar la apuesta.' }, { status: 400 });
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return NextResponse.json({ error: 'El monto de la apuesta debe ser un número positivo mayor que cero.' }, { status: 400 });
    }

    const db = await getSQLDB();

    // Check current balance
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (user.balance < betAmount && !isAdmin) {
      return NextResponse.json({ error: 'Saldo insuficiente para realizar esta apuesta.' }, { status: 400 });
    }

    const potentialPayout = parseFloat((betAmount * parseFloat(odds)).toFixed(2));

    // Start SQL Transaction to guarantee data integrity (ACID)
    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Deduct balance from user
      await db.run(
        'UPDATE users SET balance = balance - ? WHERE id = ?',
        [betAmount, decoded.userId]
      );

      // 2. Insert the bet record
      const betResult = await db.run(
        `INSERT INTO bets (user_id, match_id, sport, home_team, away_team, selected_outcome, odds, amount, potential_payout) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [decoded.userId, matchId, sport, homeTeam, awayTeam, selectedOutcome, odds, betAmount, potentialPayout]
      );

      // 3. Insert transaction log
      await db.run(
        'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
        [decoded.userId, 'bet_placed', -betAmount]
      );

      await db.run('COMMIT');

      const betId = betResult.lastID;

      // Log the transaction in cloud MongoDB (NoSQL)
      await logUserActivity(decoded.userId, 'place_bet', {
        betId,
        matchId,
        sport,
        teams: `${homeTeam} vs ${awayTeam}`,
        selectedOutcome,
        odds,
        amount: betAmount,
        potentialPayout
      });

      return NextResponse.json({
        success: true,
        message: 'Apuesta registrada correctamente.',
        newBalance: parseFloat((user.balance - betAmount).toFixed(2)),
        bet: {
          id: betId,
          match_id: matchId,
          sport,
          home_team: homeTeam,
          away_team: awayTeam,
          selected_outcome: selectedOutcome,
          odds,
          amount: betAmount,
          potential_payout: potentialPayout,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      });

    } catch (txError) {
      await db.run('ROLLBACK');
      console.error('SQL Bet Transaction failed, rolled back:', txError);
      throw txError;
    }

  } catch (error) {
    console.error('Error in POST /api/bets:', error);
    return NextResponse.json({ error: 'Error al procesar la apuesta en el servidor.' }, { status: 500 });
  }
}
