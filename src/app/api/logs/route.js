import { getNoSQLDB } from '@/lib/db-nosql';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

// GET: Retrieve activity logs from MongoDB for the logged-in user
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

    const db = await getNoSQLDB();
    const logsCollection = db.collection('activity_logs');

    const userId = decoded.userId;

    // Retrieve logs for this user (supporting both numeric IDs and string forms)
    const logs = await logsCollection
      .find({
        $or: [
          { userId: parseInt(userId) },
          { userId: String(userId) }
        ]
      })
      .sort({ timestamp: -1 }) // Newest first
      .limit(50)               // Limit to avoid large payloads
      .toArray();

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Error in GET /api/logs:', error);
    return NextResponse.json({ error: 'Error al consultar logs en MongoDB Atlas.' }, { status: 500 });
  }
}
