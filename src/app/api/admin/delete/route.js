import { getSQLDB } from '@/lib/db-sql';
import { getNoSQLDB } from '@/lib/db-nosql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

// POST: Delete a match and clean up its associated bets in SQLite
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
      return NextResponse.json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' }, { status: 403 });
    }

    const { matchId } = await request.json();
    if (!matchId) {
      return NextResponse.json({ error: 'Falta el ID del partido a eliminar.' }, { status: 400 });
    }

    const dbNoSQL = await getNoSQLDB();
    const matchesCollection = dbNoSQL.collection('matches');

    let matchObjectId;
    try {
      matchObjectId = new ObjectId(matchId);
    } catch (err) {
      return NextResponse.json({ error: 'ID de partido no válido.' }, { status: 400 });
    }

    // 1. Find the match to log details
    const match = await matchesCollection.findOne({ _id: matchObjectId });
    if (!match) {
      return NextResponse.json({ error: 'Partido no encontrado.' }, { status: 404 });
    }

    // 2. Remove associated bets from SQL (SQLite) to maintain integrity
    const dbSQL = await getSQLDB();
    
    // We clean up any transactions / refund any pending bet amounts to the user if the match gets deleted
    const associatedBets = await dbSQL.all('SELECT * FROM bets WHERE match_id = ?', [matchId]);
    for (const bet of associatedBets) {
      if (bet.status === 'pending') {
        // Refund the pending bet stake
        await dbSQL.run('BEGIN TRANSACTION');
        try {
          await dbSQL.run(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [bet.amount, bet.user_id]
          );
          await dbSQL.run(
            'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
            [bet.user_id, 'bet_refund_deleted_match', bet.amount]
          );
          await dbSQL.run('COMMIT');
        } catch (txErr) {
          await dbSQL.run('ROLLBACK');
          console.error(`Failed to refund bet ${bet.id} for deleted match:`, txErr);
        }
      }
    }

    // Delete the bets from the bets table
    await dbSQL.run('DELETE FROM bets WHERE match_id = ?', [matchId]);

    // 3. Delete the match from MongoDB NoSQL
    await matchesCollection.deleteOne({ _id: matchObjectId });

    // 4. Log admin activity
    await logUserActivity(decoded.userId, 'delete_match', {
      matchId: matchId,
      teams: `${match.homeTeam} vs ${match.awayTeam}`,
      sport: match.sport,
      refundedBetsCount: associatedBets.filter(b => b.status === 'pending').length
    });

    return NextResponse.json({
      success: true,
      message: `El partido "${match.homeTeam} vs ${match.awayTeam}" y sus apuestas asociadas se eliminaron con éxito.`
    });

  } catch (error) {
    console.error('Error in POST /api/admin/delete:', error);
    return NextResponse.json({ error: 'Error interno del servidor al eliminar el partido.' }, { status: 500 });
  }
}
