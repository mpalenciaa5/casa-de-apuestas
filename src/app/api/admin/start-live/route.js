import { getNoSQLDB } from '@/lib/db-nosql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';

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

    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json({ error: 'Falta el ID del partido.' }, { status: 400 });
    }

    const dbNoSQL = await getNoSQLDB();
    const matchesCollection = dbNoSQL.collection('matches');

    let matchObjectId;
    try {
      matchObjectId = new ObjectId(matchId);
    } catch (err) {
      return NextResponse.json({ error: 'ID de partido no válido.' }, { status: 400 });
    }

    const match = await matchesCollection.findOne({ _id: matchObjectId });
    if (!match) {
      return NextResponse.json({ error: 'Partido no encontrado.' }, { status: 404 });
    }

    if (match.status !== 'upcoming') {
      return NextResponse.json({ error: 'Solo se pueden simular partidos que estén programados (upcoming).' }, { status: 400 });
    }

    // Update match to live status
    await matchesCollection.updateOne(
      { _id: matchObjectId },
      {
        $set: {
          status: 'live',
          minute: 0,
          score: { home: 0, away: 0 }
        }
      }
    );

    // Log admin activity
    await logUserActivity(decoded.userId, 'start_live_match', {
      matchId: matchId,
      teams: `${match.homeTeam} vs ${match.awayTeam}`
    });

    return NextResponse.json({
      success: true,
      message: `¡Simulación en vivo iniciada para ${match.homeTeam} vs ${match.awayTeam}!`
    });

  } catch (error) {
    console.error('Error in POST /api/admin/start-live:', error);
    return NextResponse.json(
      { error: error.message || 'Error al iniciar simulación.' },
      { status: 500 }
    );
  }
}
