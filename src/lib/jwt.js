import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'apex-bet-super-secret-key-98765-dynamic-token';

/**
 * Signs a JWT token for the session
 * @param {object} payload - The token payload (e.g. { userId, username })
 * @returns {string} The signed JWT token
 */
export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

/**
 * Verifies a JWT token and returns payload or null
 * @param {string} token - The JWT token to verify
 * @returns {object|null} The verified payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
}
