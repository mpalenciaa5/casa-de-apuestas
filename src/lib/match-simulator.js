import { getSQLDB } from './db-sql';
import { getNoSQLDB } from './db-nosql';
import { logUserActivity } from './logger';
import { ObjectId } from 'mongodb';

// Shared function to automatically settle bets in SQL and log activity
export async function settleBetsForMatch(matchId, homeScore, awayScore) {
  try {
    const dbSQL = await getSQLDB();

    let actualOutcome = 'draw';
    if (homeScore > awayScore) {
      actualOutcome = 'home';
    } else if (awayScore > homeScore) {
      actualOutcome = 'away';
    }

    // Query pending bets for this match from SQLite
    const pendingBets = await dbSQL.all(
      'SELECT * FROM bets WHERE match_id = ? AND status = ?',
      [matchId, 'pending']
    );

    console.log(`[Auto-Settle] Settling match ${matchId} (${homeScore}-${awayScore}). Found ${pendingBets.length} pending bets.`);

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

        // Log the activity to MongoDB
        await logUserActivity(bet.user_id, isWinner ? 'bet_won' : 'bet_lost', {
          betId: bet.id,
          matchId: matchId,
          outcome: actualOutcome,
          payout: isWinner ? bet.potential_payout : 0
        });

      } catch (txErr) {
        await dbSQL.run('ROLLBACK');
        console.error(`[Auto-Settle] Error resolving bet #${bet.id}:`, txErr);
      }
    }
  } catch (err) {
    console.error(`[Auto-Settle] Failed to settle bets for match ${matchId}:`, err);
  }
}

// ─── REVERSE incorrectly settled bets back to pending ───────────────────────
// Called when a match was wrongly marked as finished (e.g. at halftime) and
// needs to be recovered back to live status.
export async function unsettleBetsForMatch(matchId) {
  try {
    const dbSQL = await getSQLDB();

    // Find all bets that were settled (won or lost) for this match
    const settledBets = await dbSQL.all(
      "SELECT * FROM bets WHERE match_id = ? AND status IN ('won', 'lost')",
      [matchId]
    );

    if (settledBets.length === 0) {
      console.log(`[Unsettle] No settled bets found for match ${matchId}. Nothing to reverse.`);
      return;
    }

    console.log(`[Unsettle] Reversing ${settledBets.length} wrongly-settled bets for match ${matchId}`);

    for (const bet of settledBets) {
      await dbSQL.run('BEGIN TRANSACTION');
      try {
        // If the bet was marked as WON, the user received a payout — claw it back
        if (bet.status === 'won') {
          await dbSQL.run(
            'UPDATE users SET balance = balance - ? WHERE id = ?',
            [bet.potential_payout, bet.user_id]
          );
          await dbSQL.run(
            'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
            [bet.user_id, 'bet_reversal_deduct', -bet.potential_payout]
          );
        }

        // Reset bet to pending so it can be re-settled when match truly ends
        await dbSQL.run(
          "UPDATE bets SET status = 'pending' WHERE id = ?",
          [bet.id]
        );

        await dbSQL.run('COMMIT');

        await logUserActivity(bet.user_id, 'bet_unsettled', {
          betId: bet.id,
          matchId: matchId,
          reason: 'match_recovery_halftime_bug',
          previousStatus: bet.status
        });

      } catch (txErr) {
        await dbSQL.run('ROLLBACK');
        console.error(`[Unsettle] Error reversing bet #${bet.id}:`, txErr);
      }
    }

    console.log(`[Unsettle] Successfully reversed ${settledBets.length} bets for match ${matchId} back to pending.`);
  } catch (err) {
    console.error(`[Unsettle] Failed to unsettle bets for match ${matchId}:`, err);
  }
}


// Automatically start upcoming matches that have reached their scheduled start time
async function checkAndAutoStartUpcomingMatches() {
  try {
    const dbNoSQL = await getNoSQLDB();
    const matchesCollection = dbNoSQL.collection('matches');

    const now = new Date();
    const upcomingMatches = await matchesCollection.find({ status: 'upcoming' }).toArray();
    
    for (const match of upcomingMatches) {
      const startTime = new Date(match.commenceTime);
      if (now >= startTime) {
        console.log(`[Auto-Start] Kickoff reached for "${match.homeTeam} vs ${match.awayTeam}" (${match.commenceTime}). Auto-transitioning to LIVE.`);
        await matchesCollection.updateOne(
          { _id: match._id },
          {
            $set: {
              status: 'live',
              minute: 0,
              score: { home: 0, away: 0 }
            }
          }
        );
      }
    }
  } catch (err) {
    console.error('[Auto-Start Check] Failed:', err);
  }
}

// Fallback: Local simulation progression if the real-world feed is offline
async function tickLiveMatchesFallback(providedMatches = null) {
  try {
    const dbNoSQL = await getNoSQLDB();
    const matchesCollection = dbNoSQL.collection('matches');

    const liveMatches = providedMatches || await matchesCollection.find({ status: 'live' }).toArray();
    for (const match of liveMatches) {
      let currentMinute = match.minute !== undefined && match.minute !== null ? match.minute : 0;
      let scoreHome = match.score && match.score.home !== undefined ? match.score.home : 0;
      let scoreAway = match.score && match.score.away !== undefined ? match.score.away : 0;

      // Progress time by 5 minutes per tick
      currentMinute += 5;

      // Goal/Basket scoring chance
      if (currentMinute < 90) {
        const isBasketball = match.sport?.toLowerCase() === 'baloncesto' || match.sport?.toLowerCase() === 'básquetbol';
        if (isBasketball) {
          // Basketball: Higher score progression (2 or 3 points per basket)
          // Ticks progress by 5 minutes, so we simulate multiple baskets per tick (e.g. 3-8 scoring plays per side)
          const plays = Math.floor(Math.random() * 6) + 3; // 3 to 8 scores per tick
          for (let p = 0; p < plays; p++) {
            const points = Math.random() < 0.35 ? 3 : 2; // 3-pointer or 2-pointer
            if (Math.random() < 0.5) {
              scoreHome += points;
            } else {
              scoreAway += points;
            }
          }
        } else {
          // Soccer/Other sports: Standard 15% chance of 1 goal per tick
          if (Math.random() < 0.15) {
            if (Math.random() < 0.5) {
              scoreHome += 1;
            } else {
              scoreAway += 1;
            }
          }
        }
      }

      // Recalculate dynamic odds based on score difference
      const timeFactor = currentMinute / 90;
      const diff = scoreHome - scoreAway;
      
      let pHome = 0.38;
      let pDraw = 0.28;
      let pAway = 0.34;
      
      if (diff > 0) {
        pHome += diff * 0.20;
        pAway -= diff * 0.15;
        pDraw -= diff * 0.05;
      } else if (diff < 0) {
        pAway += Math.abs(diff) * 0.20;
        pHome -= Math.abs(diff) * 0.15;
        pDraw -= Math.abs(diff) * 0.05;
      }
      
      if (timeFactor > 0.6) {
        const progress = (timeFactor - 0.6) / 0.4;
        if (diff > 0) {
          pHome = pHome + (1 - pHome) * progress;
          pAway = pAway * (1 - progress);
          pDraw = pDraw * (1 - progress);
        } else if (diff < 0) {
          pAway = pAway + (1 - pAway) * progress;
          pHome = pHome * (1 - progress);
          pDraw = pDraw * (1 - progress);
        } else {
          pDraw = pDraw + (0.9 - pDraw) * progress;
          pHome = pHome * (1 - progress) + 0.05;
          pAway = pAway * (1 - progress) + 0.05;
        }
      }
      
      pHome = Math.max(0.02, Math.min(0.96, pHome));
      pDraw = Math.max(0.02, Math.min(0.96, pDraw));
      pAway = Math.max(0.02, Math.min(0.96, pAway));
      
      const isBasketball = match.sport?.toLowerCase() === 'baloncesto' || match.sport?.toLowerCase() === 'básquetbol';
      
      let finalOdds;
      if (isBasketball) {
        // Basketball has no draw outcome
        const sumBB = pHome + pAway;
        finalOdds = {
          home: parseFloat((1 / (pHome / sumBB)).toFixed(2)),
          draw: null,
          away: parseFloat((1 / (pAway / sumBB)).toFixed(2))
        };
      } else {
        const sum = pHome + pDraw + pAway;
        finalOdds = {
          home: parseFloat((1 / (pHome / sum)).toFixed(2)),
          draw: parseFloat((1 / (pDraw / sum)).toFixed(2)),
          away: parseFloat((1 / (pAway / sum)).toFixed(2))
        };
      }

      if (currentMinute >= 90) {
        currentMinute = 90;
        let actualOutcome = 'draw';
        if (scoreHome > scoreAway) actualOutcome = 'home';
        else if (scoreAway > scoreHome) actualOutcome = 'away';

        await matchesCollection.updateOne(
          { _id: match._id },
          {
            $set: {
              status: 'finished',
              minute: 90,
              score: { home: scoreHome, away: scoreAway },
              actualOutcome: actualOutcome,
              odds: { home: 1.00, draw: isBasketball ? null : 1.00, away: 1.00 }
            }
          }
        );

        await settleBetsForMatch(match._id.toString(), scoreHome, scoreAway);
      } else {
        await matchesCollection.updateOne(
          { _id: match._id },
          {
            $set: {
              minute: currentMinute,
              score: { home: scoreHome, away: scoreAway },
              odds: finalOdds
            }
          }
        );
      }
    }
  } catch (err) {
    console.error('[Simulator] Fallback tick execution failed:', err);
  }
}

// Sync scores from the real-world OpenLigaDB API
async function syncScoresFromRealWorld() {
  const dbNoSQL = await getNoSQLDB();
  const matchesCollection = dbNoSQL.collection('matches');

  try {
    const response = await fetch('https://api.openligadb.de/getmatchdata/bl1');
    if (!response.ok) throw new Error('API connection error');
    const olMatches = await response.json();
    if (!olMatches || olMatches.length === 0) return;

    // Get all matches in our database that are live (status = 'live')
    // We separate local Soccer matches (which we sync with OpenLigaDB) from others (like Basketball)
    const allLiveMatches = await matchesCollection.find({ status: 'live' }).toArray();
    if (allLiveMatches.length === 0) return;

    const soccerLiveMatches = allLiveMatches.filter(m => m.sport?.toLowerCase() === 'fútbol' || m.sport?.toLowerCase() === 'futbol');
    const otherLiveMatches = allLiveMatches.filter(m => m.sport?.toLowerCase() !== 'fútbol' && m.sport?.toLowerCase() !== 'futbol');

    // Simulate other sports (Basketball/Baseball) locally using our specialized sport simulator fallback
    if (otherLiveMatches.length > 0) {
      await tickLiveMatchesFallback(otherLiveMatches);
    }

    if (soccerLiveMatches.length === 0) return;

    console.log(`[Real-World Sync] Checking for real live updates. Mapped soccer matches: ${soccerLiveMatches.length}`);

    for (let index = 0; index < soccerLiveMatches.length; index++) {
      const ourMatch = soccerLiveMatches[index];
      const olMatch = olMatches[index % olMatches.length];
      if (!olMatch) continue;

      // Extract real-world goals and scores
      let scoreHome = 0;
      let scoreAway = 0;
      if (olMatch.matchResults && olMatch.matchResults.length > 0) {
        const endRes = olMatch.matchResults.find(r => r.resultTypeID === 2) || olMatch.matchResults[olMatch.matchResults.length - 1];
        if (endRes) {
          scoreHome = endRes.pointsTeam1;
          scoreAway = endRes.pointsTeam2;
        }
      }

      const realIsFinished = olMatch.matchIsFinished;

      // Calculate dynamic odds based on real-world score difference
      const diff = scoreHome - scoreAway;
      let pHome = 0.38;
      let pDraw = 0.28;
      let pAway = 0.34;

      if (diff > 0) {
        pHome += diff * 0.20;
        pAway -= diff * 0.15;
        pDraw -= diff * 0.05;
      } else if (diff < 0) {
        pAway += Math.abs(diff) * 0.20;
        pHome -= Math.abs(diff) * 0.15;
        pDraw -= Math.abs(diff) * 0.05;
      }

      pHome = Math.max(0.02, Math.min(0.96, pHome));
      pDraw = Math.max(0.02, Math.min(0.96, pDraw));
      pAway = Math.max(0.02, Math.min(0.96, pAway));

      const sum = pHome + pDraw + pAway;
      const oddsHome = parseFloat((1 / (pHome / sum)).toFixed(2));
      const oddsDraw = parseFloat((1 / (pDraw / sum)).toFixed(2));
      const oddsAway = parseFloat((1 / (pAway / sum)).toFixed(2));

      // Estimate the current match minute
      let matchMinute = 0;
      if (olMatch.goals && olMatch.goals.length > 0) {
        matchMinute = olMatch.goals[olMatch.goals.length - 1].matchMinute || 45;
      } else {
        matchMinute = ourMatch.minute !== undefined ? ourMatch.minute + 1 : 10;
        if (matchMinute > 90) matchMinute = 90;
      }

      // CASE 1: Real API says match is finished
      // CASE 2: Local minute reached 90
      // Either way → force finish and settle bets
      if (realIsFinished || matchMinute >= 90) {
        let actualOutcome = 'draw';
        if (scoreHome > scoreAway) actualOutcome = 'home';
        else if (scoreAway > scoreHome) actualOutcome = 'away';

        const reason = realIsFinished ? 'finished in real life' : 'reached 90 minutes locally';
        console.log(`[Real-World Sync] Match "${ourMatch.homeTeam} vs ${ourMatch.awayTeam}" ${reason} (${scoreHome}-${scoreAway}). Auto-settling.`);

        await matchesCollection.updateOne(
          { _id: ourMatch._id },
          {
            $set: {
              status: 'finished',
              minute: 90,
              score: { home: scoreHome, away: scoreAway },
              actualOutcome: actualOutcome,
              odds: { home: 1.00, draw: 1.00, away: 1.00 }
            }
          }
        );

        await settleBetsForMatch(ourMatch._id.toString(), scoreHome, scoreAway);
      } else {
        // CASE 3: Match still in progress — update minute, score, odds
        await matchesCollection.updateOne(
          { _id: ourMatch._id },
          {
            $set: {
              minute: matchMinute,
              score: { home: scoreHome, away: scoreAway },
              odds: {
                home: oddsHome,
                draw: oddsDraw,
                away: oddsAway
              }
            }
          }
        );
        console.log(`[Real-World Sync] Match "${ourMatch.homeTeam} vs ${ourMatch.awayTeam}" synced: Minute ${matchMinute}', Score ${scoreHome}-${scoreAway}`);
      }
    }
  } catch (err) {
    console.error('[Real-World Sync] Error fetching OpenLigaDB, falling back to local simulation:', err);
    const allLiveMatches = await matchesCollection.find({ status: 'live' }).toArray();
    await tickLiveMatchesFallback(allLiveMatches);
  }
}

// Initialize global simulation interval (ticking every 5 seconds)
export function startMatchSimulator() {
  if (global.matchSimulatorRunning) {
    return;
  }
  global.matchSimulatorRunning = true;
  console.log('[Simulator] Live Sports Real-world sync thread initialized.');
  
  setInterval(async () => {
    // Run the check to auto-start upcoming matches first
    await checkAndAutoStartUpcomingMatches();
    
    // Perform score updates and settling
    await syncScoresFromRealWorld();
  }, 5000); // 5 seconds
}
