import { getSQLDB } from '@/lib/db-sql';
import { getNoSQLDB } from '@/lib/db-nosql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

// POST: Settle a match and resolve all placed bets
export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Debes iniciar sesión.' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
    }

    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado. Se requieren permisos de administrador.' }, { status: 403 });
    }

    const { matchId, scoreHome, scoreAway } = await request.json();

    if (!matchId || scoreHome === undefined || scoreAway === undefined) {
      return NextResponse.json({ error: 'Faltan campos requeridos (ID, scoreHome, scoreAway).' }, { status: 400 });
    }

    const homeScore = parseInt(scoreHome);
    const awayScore = parseInt(scoreAway);

    if (isNaN(homeScore) || isNaN(awayScore)) {
      return NextResponse.json({ error: 'Los puntajes deben ser números enteros.' }, { status: 400 });
    }

    const dbNoSQL = await getNoSQLDB();
    const matchesCollection = dbNoSQL.collection('matches');

    // 1. Find the match in MongoDB Cloud
    let matchObjectId;
    try {
      matchObjectId = new ObjectId(matchId);
    } catch (err) {
      return NextResponse.json({ error: 'ID de partido no válido.' }, { status: 400 });
    }

    const match = await matchesCollection.findOne({ _id: matchObjectId });
    if (!match) {
      return NextResponse.json({ error: 'Partido no encontrado en el catálogo NoSQL.' }, { status: 404 });
    }

    if (match.status === 'finished') {
      return NextResponse.json({ error: 'Este partido ya fue liquidado anteriormente.' }, { status: 400 });
    }

    // 2. Determine actual outcome: 'home', 'away', or 'draw'
    let actualOutcome = 'draw';
    if (homeScore > awayScore) {
      actualOutcome = 'home';
    } else if (awayScore > homeScore) {
      actualOutcome = 'away';
    }

    // Update match status and results in MongoDB (NoSQL)
    await matchesCollection.updateOne(
      { _id: matchObjectId },
      {
        $set: {
          status: 'finished',
          score: { home: homeScore, away: awayScore },
          actualOutcome: actualOutcome
        }
      }
    );

    // 3. Query all pending bets for this match from SQLite (SQL)
    const dbSQL = await getSQLDB();
    const pendingBets = await dbSQL.all(
      'SELECT * FROM bets WHERE match_id = ? AND status = ?',
      [matchId, 'pending']
    );

    const settledBets = [];

    // 4. Resolve each bet inside a SQL Transaction
    for (const bet of pendingBets) {
      const isWinner = bet.selected_outcome === actualOutcome;
      const status = isWinner ? 'won' : 'lost';

      await dbSQL.run('BEGIN TRANSACTION');
      try {
        if (isWinner) {
          // Crediting the winning payout to the user's SQLite balance
          await dbSQL.run(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [bet.potential_payout, bet.user_id]
          );

          // Record transaction receipt
          await dbSQL.run(
            'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
            [bet.user_id, 'bet_won', bet.potential_payout]
          );
        }

        // Update the bet status
        await dbSQL.run(
          'UPDATE bets SET status = ? WHERE id = ?',
          [status, bet.id]
        );

        await dbSQL.run('COMMIT');

        // Log the individual resolution to MongoDB logs
        await logUserActivity(bet.user_id, isWinner ? 'bet_won' : 'bet_lost', {
          betId: bet.id,
          matchId: matchId,
          outcome: actualOutcome,
          payout: isWinner ? bet.potential_payout : 0
        });

        settledBets.push({
          betId: bet.id,
          userId: bet.user_id,
          status: status,
          payout: isWinner ? bet.potential_payout : 0
        });

      } catch (txErr) {
        await dbSQL.run('ROLLBACK');
        console.error(`Failed to settle bet ${bet.id}, transaction rolled back:`, txErr);
      }
    }

    // Log the overall match settlement by the admin
    await logUserActivity(decoded.userId, 'settle_match', {
      matchId: matchId,
      teams: `${match.homeTeam} vs ${match.awayTeam}`,
      result: `${homeScore}-${awayScore}`,
      betsSettleCount: settledBets.length
    });

    return NextResponse.json({
      success: true,
      message: `El partido fue liquidado con éxito. Se procesaron ${settledBets.length} apuestas.`,
      score: { home: homeScore, away: awayScore },
      settledBets: settledBets
    });

  } catch (error) {
    console.error('Error in POST /api/admin/settle:', error);
    return NextResponse.json({ error: 'Error interno del servidor al liquidar el partido.' }, { status: 500 });
  }
}
