import { getNoSQLDB } from '@/lib/db-nosql';
import { seedMatches } from '@/lib/seed-nosql';
import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { startMatchSimulator } from '@/lib/match-simulator';
import { NextResponse } from 'next/server';

// GET: Retrieve matches from MongoDB. Auto-seed/migrate if needed.
export async function GET() {
  try {
    // Start background simulation thread if not already running
    startMatchSimulator();

    const db = await getNoSQLDB();
    const matchesCollection = db.collection('matches');

    // Always execute seedMatches check (internally skips if already migrated to World Cup)
    await seedMatches();

    const matches = await matchesCollection.find({}).toArray();

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error('Error in GET /api/matches:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener los partidos.' },
      { status: 500 }
    );
  }
}

// POST: Add a new match (for admin panel)
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

    const { sport, league, homeTeam, awayTeam, commenceTime, odds, details } = await request.json();

    if (!sport || !homeTeam || !awayTeam || !commenceTime || !odds) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (deporte, equipos, fecha o cuotas).' },
        { status: 400 }
      );
    }

    const db = await getNoSQLDB();

    const newMatch = {
      sport,
      league: league || 'General',
      homeTeam,
      awayTeam,
      commenceTime,
      status: 'upcoming',
      odds: {
        home: parseFloat(odds.home),
        draw: odds.draw ? parseFloat(odds.draw) : null,
        away: parseFloat(odds.away),
      },
      score: null,
      details: details || {},
      created_at: new Date().toISOString()
    };

    const result = await db.collection('matches').insertOne(newMatch);

    // Log the match creation in MongoDB logs
    await logUserActivity(decoded.userId, 'create_match', {
      matchId: result.insertedId,
      homeTeam,
      awayTeam,
      sport
    });

    return NextResponse.json({
      success: true,
      match: { _id: result.insertedId, ...newMatch }
    });
  } catch (error) {
    console.error('Error in POST /api/matches:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al crear el partido.' },
      { status: 500 }
    );
  }
}
