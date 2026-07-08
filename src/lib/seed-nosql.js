import { getNoSQLDB } from './db-nosql.js';
import { getSQLDB } from './db-sql.js';
import { logUserActivity } from './logger.js';

export async function seedMatches() {
  try {
    const db = await getNoSQLDB();
    const matchesCollection = db.collection('matches');

    const updates = [
      {
        homeTeam: 'Canadá',
        awayTeam: 'Marruecos',
        commenceTime: '2026-07-04T16:00:00Z',
        status: 'finished',
        score: { home: 0, away: 3 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'Paraguay',
        awayTeam: 'Francia',
        commenceTime: '2026-07-04T20:00:00Z',
        status: 'finished',
        score: { home: 0, away: 1 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'Brasil',
        awayTeam: 'Noruega',
        commenceTime: '2026-07-05T16:00:00Z',
        status: 'finished',
        score: { home: 1, away: 2 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'México',
        awayTeam: 'Inglaterra',
        commenceTime: '2026-07-05T20:00:00Z',
        status: 'finished',
        score: { home: 2, away: 3 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'Portugal',
        awayTeam: 'España',
        commenceTime: '2026-07-06T16:00:00Z',
        status: 'finished',
        score: { home: 0, away: 1 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'Estados Unidos',
        awayTeam: 'Bélgica',
        commenceTime: '2026-07-06T20:00:00Z',
        status: 'finished',
        score: { home: 1, away: 4 },
        actualOutcome: 'away'
      },
      {
        homeTeam: 'Argentina',
        awayTeam: 'Egipto',
        commenceTime: '2026-07-07T16:00:00Z', // 10:00 AM Guatemala
        // NO status here — we NEVER overwrite live/finished matches
        score: null,
        actualOutcome: null
      },
      {
        homeTeam: 'Suiza',
        awayTeam: 'Colombia',
        commenceTime: '2026-07-07T20:00:00Z', // 2:00 PM Guatemala
        // NO status here
        score: null,
        actualOutcome: null
      }
    ];

    const dbSQL = await getSQLDB();

    for (const item of updates) {
      const match = await matchesCollection.findOne({ homeTeam: item.homeTeam, awayTeam: item.awayTeam });
      if (match) {
        // CRITICAL: Never overwrite a match that is already live or finished
        if (match.status === 'live' || match.status === 'finished') {
          // Only correct finished matches with wrong scores (do bet corrections)
          if (match.status === 'finished' && item.status === 'finished' && item.actualOutcome) {
            const matchIdStr = match._id.toString();
            const correctOutcome = item.actualOutcome;
            const bets = await dbSQL.all('SELECT * FROM bets WHERE match_id = ?', [matchIdStr]);

            for (const bet of bets) {
              const shouldBeWinner = bet.selected_outcome === correctOutcome;
              const newStatus = shouldBeWinner ? 'won' : 'lost';
              if (bet.status !== newStatus) {
                await dbSQL.run('BEGIN TRANSACTION');
                try {
                  if (bet.status === 'won') {
                    await dbSQL.run('UPDATE users SET balance = balance - ? WHERE id = ?', [bet.potential_payout, bet.user_id]);
                    await dbSQL.run('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [bet.user_id, 'bet_correction_deduct', -bet.potential_payout]);
                  }
                  if (newStatus === 'won') {
                    await dbSQL.run('UPDATE users SET balance = balance + ? WHERE id = ?', [bet.potential_payout, bet.user_id]);
                    await dbSQL.run('INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)', [bet.user_id, 'bet_correction_add', bet.potential_payout]);
                  }
                  await dbSQL.run('UPDATE bets SET status = ? WHERE id = ?', [newStatus, bet.id]);
                  await dbSQL.run('COMMIT');
                } catch (txErr) {
                  await dbSQL.run('ROLLBACK');
                }
              }
            }
            // Update score/outcome in Mongo for already-finished matches
            await matchesCollection.updateOne(
              { _id: match._id },
              { $set: { commenceTime: item.commenceTime, score: item.score, actualOutcome: item.actualOutcome } }
            );
          }
          // Skip — don't touch live or finished matches
          continue;
        }

        // For upcoming matches: only update commenceTime, never reset status
        const updateFields = { commenceTime: item.commenceTime };
        if (item.status === 'finished') {
          updateFields.status = item.status;
          updateFields.score = item.score;
          updateFields.actualOutcome = item.actualOutcome;
        }

        await matchesCollection.updateOne(
          { _id: match._id },
          { $set: updateFields }
        );
      } else {
        // Insert new match if it doesn't exist
        const defaultOdds = {
          'Argentina': { home: 1.35, draw: 4.50, away: 8.50 },
          'Suiza': { home: 2.90, draw: 3.10, away: 2.45 },
          'Portugal': { home: 2.85, draw: 3.10, away: 2.45 },
          'Estados Unidos': { home: 2.30, draw: 3.25, away: 3.00 },
        };

        await matchesCollection.insertOne({
          sport: 'Fútbol',
          league: 'Copa Mundial FIFA 2026 (Octavos)',
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          commenceTime: item.commenceTime,
          status: item.status || 'upcoming',
          odds: defaultOdds[item.homeTeam] || { home: 2.00, draw: 3.00, away: 2.00 },
          score: item.score,
          actualOutcome: item.actualOutcome,
          details: { stadium: 'FIFA World Cup 2026' }
        });
      }
    }
  } catch (error) {
    console.error('Error in seedMatches:', error);
  }
}
