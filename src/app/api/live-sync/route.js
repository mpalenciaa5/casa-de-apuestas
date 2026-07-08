import { NextResponse } from 'next/server';
import { getNoSQLDB } from '@/lib/db-nosql';
import { settleBetsForMatch, unsettleBetsForMatch } from '@/lib/match-simulator';

// Auto-start upcoming matches whose kickoff time has passed
async function autoStartMatches(matchesCollection) {
  const now = new Date();
  const upcoming = await matchesCollection.find({ status: 'upcoming' }).toArray();

  for (const match of upcoming) {
    const kickoff = new Date(match.commenceTime);
    if (now >= kickoff) {
      console.log(`[Live-Sync] Auto-starting: ${match.homeTeam} vs ${match.awayTeam}`);
      await matchesCollection.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'live',
            minute: 1,
            halftime: false,
            score: { home: 0, away: 0 }
          }
        }
      );
    }
  }
}

// Fetch real-world live scores from ESPN public API (no key required)
async function fetchRealScores() {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.events || null;
  } catch (err) {
    console.error('[Live-Sync] ESPN API error:', err.message);
    return null;
  }
}

// Map ESPN team name to our DB team name
function normalizeTeamName(espnName) {
  const map = {
    'Argentina': 'Argentina',
    'Egypt': 'Egipto',
    'Switzerland': 'Suiza',
    'Colombia': 'Colombia',
    'Spain': 'España',
    'Portugal': 'Portugal',
    'Belgium': 'Bélgica',
    'USA': 'Estados Unidos',
    'United States': 'Estados Unidos',
    'Mexico': 'México',
    'Brazil': 'Brasil',
    'Norway': 'Noruega',
    'England': 'Inglaterra',
    'Canada': 'Canadá',
    'Morocco': 'Marruecos',
    'Paraguay': 'Paraguay',
    'France': 'Francia',
  };
  return map[espnName] || espnName;
}

// Determine ESPN match phase from status object
// Returns: 'pre' | 'live' | 'halftime' | 'finished'
function getMatchPhase(status) {
  const state = status?.type?.state || '';
  const name  = status?.type?.name  || '';
  const desc  = (status?.type?.description || '').toLowerCase();
  const isCompleted = status?.type?.completed === true;
  const period = status?.period || 1;

  // Halftime is a special state — NOT completed
  if (
    name === 'STATUS_HALFTIME' ||
    desc.includes('half time') ||
    desc.includes('halftime') ||
    desc.includes('half-time') ||
    state === 'halftime'
  ) {
    return 'halftime';
  }

  // Full-time only when completed AND not in halftime
  if (isCompleted) return 'finished';

  if (state === 'in') return 'live';
  if (state === 'pre') return 'pre';

  return 'unknown';
}

// Update a live match with real-world data from ESPN
async function syncLiveMatchWithESPN(matchesCollection, match, espnEvents) {
  if (!espnEvents) return false;

  for (const event of espnEvents) {
    const competition = event?.competitions?.[0];
    if (!competition) continue;

    const competitors = competition.competitors || [];
    if (competitors.length < 2) continue;

    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const homeNameDB = normalizeTeamName(home.team?.displayName || '');
    const awayNameDB = normalizeTeamName(away.team?.displayName || '');

    // Match our DB entry (flexible: at least one team matches)
    const matchesHome = homeNameDB === match.homeTeam;
    const matchesAway = awayNameDB === match.awayTeam;
    if (!matchesHome && !matchesAway) continue;

    const espnStatus = competition.status || {};
    const phase = getMatchPhase(espnStatus);

    const homeScore = parseInt(home.score || '0', 10);
    const awayScore = parseInt(away.score || '0', 10);

    // Calculate match minute
    // ESPN's displayClock shows GLOBAL match minute (e.g. "50'" = minute 50 of the game)
    // Do NOT add 45 for period 2 — ESPN already accounts for it
    // Only add time for extra time periods (period 3+)
    const clock = espnStatus.displayClock || '';
    const period = espnStatus.period || 1;
    let minute = 0;
    const clockMatch = clock.match(/(\d+)/);
    if (clockMatch) {
      minute = parseInt(clockMatch[1], 10);
      if (period >= 3) minute = 90 + (period - 2) * 15; // Extra time: 90+, 105+
    }
    if (phase === 'halftime') minute = 45;


    console.log(`[Live-Sync] ESPN → ${match.homeTeam} vs ${match.awayTeam} | Phase:${phase} | ${homeScore}-${awayScore} | Min:${minute} | Period:${period}`);

    // Recalculate live odds based on score and time
    const diff = homeScore - awayScore;
    const timeFactor = Math.min(minute / 90, 1);
    let pHome = 0.38 + diff * 0.18 * timeFactor;
    let pDraw  = 0.28 - Math.abs(diff) * 0.05 * timeFactor;
    let pAway  = 0.34 - diff * 0.13 * timeFactor;
    pHome = Math.max(0.03, Math.min(0.93, pHome));
    pDraw = Math.max(0.03, Math.min(0.93, pDraw));
    pAway = Math.max(0.03, Math.min(0.93, pAway));

    const isBasketball = match.sport?.toLowerCase() === 'baloncesto' || match.sport?.toLowerCase() === 'básquetbol';
    let finalOdds;
    if (isBasketball) {
      const pSumBB = pHome + pAway;
      finalOdds = {
        home: parseFloat((1 / (pHome / pSumBB)).toFixed(2)),
        draw: null,
        away: parseFloat((1 / (pAway / pSumBB)).toFixed(2))
      };
    } else {
      const pSum = pHome + pDraw + pAway;
      finalOdds = {
        home: parseFloat((1 / (pHome / pSum)).toFixed(2)),
        draw: parseFloat((1 / (pDraw / pSum)).toFixed(2)),
        away: parseFloat((1 / (pAway / pSum)).toFixed(2))
      };
    }

    if (phase === 'finished') {
      // ─── MATCH OVER: settle bets ────────────────────────────────────
      let actualOutcome = 'draw';
      if (homeScore > awayScore) actualOutcome = 'home';
      else if (awayScore > homeScore) actualOutcome = 'away';

      await matchesCollection.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'finished',
            minute: 90,
            halftime: false,
            score: { home: homeScore, away: awayScore },
            actualOutcome,
            odds: { home: 1.00, draw: isBasketball ? null : 1.00, away: 1.00 }
          }
        }
      );
      await settleBetsForMatch(match._id.toString(), homeScore, awayScore);

    } else if (phase === 'halftime') {
      // ─── HALF TIME: keep match live, show HT indicator ──────────────
      await matchesCollection.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'live',          // still live!
            halftime: true,          // flag for UI
            minute: 45,
            score: { home: homeScore, away: awayScore },
            odds: finalOdds
          }
        }
      );

    } else if (phase === 'live') {
      // ─── IN PLAY: update score & minute ─────────────────────────────
      await matchesCollection.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'live',
            halftime: false,
            minute,
            score: { home: homeScore, away: awayScore },
            odds: finalOdds
          }
        }
      );
    }
    // 'pre' or 'unknown': do nothing, let auto-start handle it
    return true;
  }
  return false;
}

// Fallback: tick live matches locally if ESPN data unavailable
async function tickLocalFallback(matchesCollection) {
  const liveMatches = await matchesCollection.find({ status: 'live' }).toArray();

  for (const match of liveMatches) {
    // Don't tick during halftime — wait until 2nd half begins
    if (match.halftime) continue;

    const currentMinute = (match.minute || 0) + 1;

    // Resume 2nd half after a simulated break (~3 poll cycles)
    if (currentMinute > 46 && currentMinute < 50 && match.minute === 45) {
      // Still in HT window, skip
      continue;
    }

    if (currentMinute >= 90) {
      const homeScore = match.score?.home || 0;
      const awayScore = match.score?.away || 0;
      let actualOutcome = 'draw';
      if (homeScore > awayScore) actualOutcome = 'home';
      else if (awayScore > homeScore) actualOutcome = 'away';

      await matchesCollection.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'finished',
            minute: 90,
            halftime: false,
            actualOutcome,
            odds: { home: 1.00, draw: 1.00, away: 1.00 }
          }
        }
      );
      await settleBetsForMatch(match._id.toString(), homeScore, awayScore);
    } else {
      await matchesCollection.updateOne(
        { _id: match._id },
        { $set: { minute: currentMinute } }
      );
    }
  }
}

export async function GET() {
  try {
    const db = await getNoSQLDB();
    const matchesCollection = db.collection('matches');

    // Step 1: Auto-start matches whose kickoff time has passed
    await autoStartMatches(matchesCollection);

    // Step 2: Fetch real-world scores from ESPN
    const espnEvents = await fetchRealScores();
    let synced = 0;

    if (espnEvents) {
      // ── ESPN IS ONLINE: use ONLY real data, never run local fallback ──

      // Step 3a: Sync all LIVE matches
      const liveMatches = await matchesCollection.find({ status: 'live' }).toArray();
      for (const match of liveMatches) {
        const updated = await syncLiveMatchWithESPN(matchesCollection, match, espnEvents);
        if (updated) synced++;
      }

      // Step 3b: RECOVERY — check today's 'finished' matches that ESPN says are still live
      const todayStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const recentlyFinished = await matchesCollection.find({
        status: 'finished',
        commenceTime: { $gte: todayStart }
      }).toArray();

      for (const match of recentlyFinished) {
        for (const event of espnEvents) {
          const competition = event?.competitions?.[0];
          if (!competition) continue;
          const competitors = competition.competitors || [];
          const home = competitors.find(c => c.homeAway === 'home');
          const away = competitors.find(c => c.homeAway === 'away');
          if (!home || !away) continue;

          const homeNameDB = normalizeTeamName(home.team?.displayName || '');
          const awayNameDB = normalizeTeamName(away.team?.displayName || '');
          if (homeNameDB !== match.homeTeam && awayNameDB !== match.awayTeam) continue;

          const phase = getMatchPhase(competition.status);
          if (phase === 'finished') break; // ESPN says finished too — all good

          // ESPN says still in play — recover the match!
          const homeScore = parseInt(home.score || '0', 10);
          const awayScore = parseInt(away.score || '0', 10);

          // Get real minute from ESPN clock
          const espnClock = competition.status?.displayClock || '';
          const clockMatch2 = espnClock.match(/(\d+)/);
          const realMinute = clockMatch2 ? parseInt(clockMatch2[1], 10) : 50;

          // Calculate proper odds (NOT 1.00)
          const diff = homeScore - awayScore;
          const timeFactor = Math.min(realMinute / 90, 1);
          let pHome = 0.38 + diff * 0.18 * timeFactor;
          let pDraw  = 0.28 - Math.abs(diff) * 0.05 * timeFactor;
          let pAway  = 0.34 - diff * 0.13 * timeFactor;
          pHome = Math.max(0.05, Math.min(0.90, pHome));
          pDraw = Math.max(0.05, Math.min(0.90, pDraw));
          pAway = Math.max(0.05, Math.min(0.90, pAway));
          const pSum = pHome + pDraw + pAway;

          console.log(`[Live-Sync] RECOVERY: ${match.homeTeam} vs ${match.awayTeam} → phase:${phase} min:${realMinute} score:${homeScore}-${awayScore}`);

          // ── Step A: Reverse wrongly-settled bets back to pending ──
          await unsettleBetsForMatch(match._id.toString());

          // ── Step B: Restore match to live with correct data ──
          await matchesCollection.updateOne(
            { _id: match._id },
            {
              $set: {
                status: 'live',
                halftime: phase === 'halftime',
                minute: phase === 'halftime' ? 45 : realMinute,
                score: { home: homeScore, away: awayScore },
                actualOutcome: null,
                odds: {
                  home: parseFloat((1 / (pHome / pSum)).toFixed(2)),
                  draw: parseFloat((1 / (pDraw / pSum)).toFixed(2)),
                  away: parseFloat((1 / (pAway / pSum)).toFixed(2))
                }
              }
            }
          );
          synced++;
          break;
        }
      }

    } else {
      // ── ESPN OFFLINE: use local fallback ticker ──
      console.log('[Live-Sync] ESPN unavailable — using local fallback');
      await tickLocalFallback(matchesCollection);
    }

    // Step 4: Return all matches
    const matches = await matchesCollection.find({}).toArray();

    return NextResponse.json({
      success: true,
      synced,
      espnConnected: !!espnEvents,
      matches
    });
  } catch (error) {
    console.error('[Live-Sync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
