import { logUserActivity } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const token = request.cookies.get('token')?.value;
    let userId = 'anonymous';

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.userId;
      }
    }

    // Log the logout action in MongoDB NoSQL
    await logUserActivity(userId, 'logout');

    const response = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente.' });
    response.cookies.set('token', '', { maxAge: 0, path: '/' }); // Securely expire cookie

    return response;
  } catch (error) {
    console.error('Error in logout route:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor al cerrar sesión' },
      { status: 500 }
    );
  }
}
