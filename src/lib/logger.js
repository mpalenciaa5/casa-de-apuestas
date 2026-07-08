import { getNoSQLDB } from './db-nosql.js';

/**
 * Logs a user activity event in the cloud MongoDB (NoSQL)
 * @param {string|number} userId - The ID of the user (or 'anonymous')
 * @param {string} action - The action type (e.g. 'login', 'place_bet')
 * @param {object} metadata - Extra details (e.g. { amount: 100, matchId: '...' })
 */
export async function logUserActivity(userId, action, metadata = {}) {
  try {
    const db = await getNoSQLDB();
    const logsCollection = db.collection('activity_logs');
    
    const logEntry = {
      userId: userId || 'anonymous',
      action,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    await logsCollection.insertOne(logEntry);
    console.log(`[NoSQL Cloud Log] Registered activity: "${action}" for user: ${userId}`);
  } catch (error) {
    console.error('Failed to write activity log to MongoDB Atlas:', error);
  }
}
