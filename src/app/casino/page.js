'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';
import { Coins, Play, Dices, RotateCcw, AlertCircle, HelpCircle, Trophy } from 'lucide-react';

const SYMBOLS = ['🍋', '🍒', '🍀', '💎', '7️⃣'];
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export default function Casino() {
  const { user, loading, setAuthModal, updateBalance } = useAuth();
  const [activeTab, setActiveTab] = useState('slots'); // 'slots' | 'roulette' | 'blackjack'

  // --- Slots States ---
  const [slotsBet, setSlotsBet] = useState('50');
  const [reels, setReels] = useState(['💎', '7️⃣', '💎']);
  const [reel1Spin, setReel1Spin] = useState(false);
  const [reel2Spin, setReel2Spin] = useState(false);
  const [reel3Spin, setReel3Spin] = useState(false);
  const [slotsResult, setSlotsResult] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // --- Roulette States ---
  const [rouletteBetType, setRouletteBetType] = useState('red'); // 'red'|'black'|'even'|'odd'|'zero'|'number'
  const [rouletteNumber, setRouletteNumber] = useState('14');
  const [rouletteBet, setRouletteBet] = useState('50');
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState(null);
  const [rouletteError, setRouletteError] = useState(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);

  // --- Blackjack States ---
  const [blackjackBet, setBlackjackBet] = useState('50');
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [currentDeck, setCurrentDeck] = useState([]);
  const [blackjackStage, setBlackjackStage] = useState('betting'); // 'betting' | 'playing' | 'dealer' | 'ended'
  const [blackjackResult, setBlackjackResult] = useState(''); // 'win' | 'blackjack' | 'lose' | 'push'
  const [blackjackMessage, setBlackjackMessage] = useState('');
  const [blackjackLoading, setBlackjackLoading] = useState(false);
  const [blackjackError, setBlackjackError] = useState(null);

  // --- Plinko States & Refs ---
  const [plinkoBet, setPlinkoBet] = useState('1.00');
  const [plinkoRisk, setPlinkoRisk] = useState('green'); // 'green' | 'yellow' | 'red'
  const [plinkoResult, setPlinkoResult] = useState(null);
  const [plinkoError, setPlinkoError] = useState(null);
  const [plinkoLoading, setPlinkoLoading] = useState(false);

  const plinkoBallsRef = React.useRef([]);
  const plinkoCanvasRef = React.useRef(null);
  const plinkoAnimationRef = React.useRef(null);
  // --- Handlers for Plinko (Hook declared at top to avoid conditional hook errors) ---
  useEffect(() => {
    if (activeTab !== 'plinko') {
      if (plinkoAnimationRef.current) {
        cancelAnimationFrame(plinkoAnimationRef.current);
      }
      return;
    }

    const canvas = plinkoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const numRows = 14;
    const dx = 28;
    const dy = 26;
    const startY = 40;
    const startX = 300;

    const greenMult = [18, 3.2, 1.6, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 1.6, 3.2, 18];
    const yellowMult = [55, 12, 5.6, 3.2, 1.6, 1, 0.7, 0.2, 0.7, 1, 1.6, 3.2, 5.6, 12, 55];
    const redMult = [252, 40, 14, 5.3, 2.1, 0.5, 0.2, 0, 0.2, 0.5, 2.1, 5.3, 14, 40, 252];

    const getBinColor = (val, risk) => {
      if (risk === 'green') {
        if (val >= 3.2) return '#00c853';
        if (val >= 1.2) return '#2e7d32';
        return '#81c784';
      }
      if (risk === 'yellow') {
        if (val >= 12) return '#f57c00';
        if (val >= 1.6) return '#ffb300';
        return '#ffe082';
      }
      if (val >= 40) return '#b91c1c';
      if (val >= 2.1) return '#ef4444';
      return '#fca5a5';
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background board
      ctx.fillStyle = '#070a0e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw peg triangle
      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < numRows; r++) {
        const numPegs = r + 3;
        for (let i = 0; i < numPegs; i++) {
          const px = startX + (i - (r + 2) / 2) * dx;
          const py = startY + r * dy;
          
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw bottom multiplier bins (Three stacked rows: Green, Yellow, Red)
      const binWidth = 24;
      const binHeight = 20;
      const binSpacing = dx;

      // Row 1: Green
      for (let b = 0; b < 15; b++) {
        const bx = startX + (b - 7) * binSpacing - binWidth / 2;
        const by = 408;
        const val = greenMult[b];
        ctx.fillStyle = getBinColor(val, 'green');
        ctx.beginPath();
        ctx.roundRect(bx, by, binWidth, binHeight, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toString(), bx + binWidth / 2, by + binHeight / 2 + 1);
      }

      // Row 2: Yellow
      for (let b = 0; b < 15; b++) {
        const bx = startX + (b - 7) * binSpacing - binWidth / 2;
        const by = 432;
        const val = yellowMult[b];
        ctx.fillStyle = getBinColor(val, 'yellow');
        ctx.beginPath();
        ctx.roundRect(bx, by, binWidth, binHeight, 4);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toString(), bx + binWidth / 2, by + binHeight / 2 + 1);
      }

      // Row 3: Red
      for (let b = 0; b < 15; b++) {
        const bx = startX + (b - 7) * binSpacing - binWidth / 2;
        const by = 456;
        const val = redMult[b];
        ctx.fillStyle = getBinColor(val, 'red');
        ctx.beginPath();
        ctx.roundRect(bx, by, binWidth, binHeight, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toString(), bx + binWidth / 2, by + binHeight / 2 + 1);
      }

      // Update and draw active balls
      const activeBalls = plinkoBallsRef.current;
      plinkoBallsRef.current = activeBalls.filter(ball => {
        ball.frame += 1;
        const totalFrames = 15;
        
        const segment = Math.floor(ball.frame / totalFrames);
        const segmentFrame = ball.frame % totalFrames;
        
        if (segment >= 15) {
          return false;
        }

        const t = segmentFrame / totalFrames;
        const pStart = ball.keypoints[segment];
        const pEnd = ball.keypoints[segment + 1];

        ball.x = pStart.x + (pEnd.x - pStart.x) * t;
        ball.y = pStart.y + (pEnd.y - pStart.y) * t;

        if (segment < 14) {
          const bounceY = Math.sin(t * Math.PI) * 8;
          ball.y -= bounceY;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
        
        let ballColor = '#ef4444';
        if (ball.risk === 'green') ballColor = '#00c853';
        else if (ball.risk === 'yellow') ballColor = '#ffb300';
        
        ctx.fillStyle = ballColor;
        ctx.shadowColor = ballColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        return true;
      });

      plinkoAnimationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (plinkoAnimationRef.current) {
        cancelAnimationFrame(plinkoAnimationRef.current);
      }
    };
  }, [activeTab, plinkoRisk]);
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <div style={{ border: '3px solid rgba(255,255,255,0.06)', borderTop: '3px solid var(--accent-green)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Cargando Lobby de Casino...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '460px', textAlign: 'center', padding: '40px' }}>
          <Dices size={46} style={{ color: 'var(--accent-green)', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px' }}>Casino Cerrado</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
            Debes iniciar sesión con tu cuenta para ingresar a las salas de casino, realizar tus jugadas y multiplicar tus fondos.
          </p>
          <button className="btn btn-primary" onClick={() => setAuthModal('login')}>
            Iniciar Sesión
          </button>
          <AuthModal />
        </div>
      </div>
    );
  }

  // --- Handlers for Slots ---
  const spinSlots = async () => {
    if (slotsLoading || isSpinning()) return;

    setSlotsError(null);
    setSlotsResult(null);
    setSlotsLoading(true);

    const numericBet = parseFloat(slotsBet);
    if (isNaN(numericBet) || numericBet <= 0) {
      setSlotsError('Apuesta inválida.');
      setSlotsLoading(false);
      return;
    }

    if (user.balance < numericBet) {
      setSlotsError('Saldo insuficiente.');
      setSlotsLoading(false);
      return;
    }

    // Start reel animations immediately
    setReel1Spin(true);
    setReel2Spin(true);
    setReel3Spin(true);

    try {
      const res = await fetch('/api/casino/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: numericBet })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al girar.');

      // Staggered stop of reels for realism
      setTimeout(() => {
        setReel1Spin(false);
        setReels(prev => [data.reels[0], prev[1], prev[2]]);
      }, 1000);

      setTimeout(() => {
        setReel2Spin(false);
        setReels(prev => [data.reels[0], data.reels[1], prev[2]]);
      }, 1600);

      setTimeout(() => {
        setReel3Spin(false);
        setReels(data.reels);
        setSlotsResult(data);
        updateBalance(data.newBalance);
        setSlotsLoading(false);
      }, 2200);

    } catch (err) {
      // Stop reels on error
      setReel1Spin(false);
      setReel2Spin(false);
      setReel3Spin(false);
      setSlotsError(err.message);
      setSlotsLoading(false);
    }
  };

  function isSpinning() {
    return reel1Spin || reel2Spin || reel3Spin;
  }

  // --- Handlers for Roulette ---
  const spinRoulette = async () => {
    if (rouletteLoading || isWheelSpinning) return;

    setRouletteError(null);
    setRouletteResult(null);
    setRouletteLoading(true);

    const numericBet = parseFloat(rouletteBet);
    if (isNaN(numericBet) || numericBet <= 0) {
      setRouletteError('Apuesta inválida.');
      setSlotsLoading(false);
      return;
    }

    if (user.balance < numericBet) {
      setRouletteError('Saldo insuficiente.');
      setRouletteLoading(false);
      return;
    }

    setIsWheelSpinning(true);

    try {
      const res = await fetch('/api/casino/roulette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betType: rouletteBetType,
          targetNumber: rouletteBetType === 'number' ? parseInt(rouletteNumber) : null,
          betAmount: numericBet
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error en la tirada.');

      // Calculate degrees targeting the top marker needle (0 degrees index)
      const winningIndex = WHEEL_NUMBERS.indexOf(data.winningNumber);
      const degreeOffset = (360 / 37) * winningIndex;
      // Spin at least 5 complete rotations (1800 degrees) plus the landing offset
      const finalRotation = 1800 + (360 - degreeOffset);
      
      // Reset wheel position first if rotation was high, then apply new rotation degree
      setWheelRotation(prev => {
        const base = prev % 360;
        return base - (3600 + finalRotation);
      });

      // Stop after 7s (matching the CSS transitions length)
      setTimeout(() => {
        setIsWheelSpinning(false);
        setRouletteResult(data);
        updateBalance(data.newBalance);
        setRouletteLoading(false);
      }, 7000);

    } catch (err) {
      setIsWheelSpinning(false);
      setRouletteError(err.message);
      setRouletteLoading(false);
    }
  };

  // --- Handlers for Blackjack ---
  const generateDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [
      { name: '2', value: 2 },
      { name: '3', value: 3 },
      { name: '4', value: 4 },
      { name: '5', value: 5 },
      { name: '6', value: 6 },
      { name: '7', value: 7 },
      { name: '8', value: 8 },
      { name: '9', value: 9 },
      { name: '10', value: 10 },
      { name: 'J', value: 10 },
      { name: 'Q', value: 10 },
      { name: 'K', value: 10 },
      { name: 'A', value: 11 }
    ];
    let newDeck = [];
    for (let s of suits) {
      for (let v of values) {
        newDeck.push({ ...v, suit: s });
      }
    }
    // Shuffle
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  };

  const calculateScore = (hand) => {
    let score = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter(card => card.name === 'A').length;
    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  };

  const dealBlackjack = () => {
    const numericBet = parseFloat(blackjackBet);
    setBlackjackError(null);
    setBlackjackMessage('');
    setBlackjackResult('');

    if (isNaN(numericBet) || numericBet <= 0) {
      setBlackjackError('Apuesta inválida.');
      return;
    }

    if (user.balance < numericBet) {
      setBlackjackError('Saldo insuficiente.');
      return;
    }

    const deckOfCards = generateDeck();
    const playerFirstHand = [deckOfCards[0], deckOfCards[2]];
    const dealerFirstHand = [deckOfCards[1], deckOfCards[3]];
    const remainingDeck = deckOfCards.slice(4);

    setPlayerHand(playerFirstHand);
    setDealerHand(dealerFirstHand);
    setCurrentDeck(remainingDeck);

    const playerScore = calculateScore(playerFirstHand);
    const dealerScore = calculateScore(dealerFirstHand);

    if (playerScore === 21) {
      if (dealerScore === 21) {
        endBlackjackGame(playerFirstHand, dealerFirstHand, 'push', numericBet);
      } else {
        endBlackjackGame(playerFirstHand, dealerFirstHand, 'blackjack', numericBet);
      }
    } else {
      setBlackjackStage('playing');
    }
  };

  const hitBlackjack = () => {
    if (blackjackStage !== 'playing') return;

    const nextCard = currentDeck[0];
    const newPlayerHand = [...playerHand, nextCard];
    const newDeck = currentDeck.slice(1);

    setPlayerHand(newPlayerHand);
    setCurrentDeck(newDeck);

    const playerScore = calculateScore(newPlayerHand);
    if (playerScore > 21) {
      endBlackjackGame(newPlayerHand, dealerHand, 'lose', parseFloat(blackjackBet));
    } else if (playerScore === 21) {
      standBlackjack(newPlayerHand, newDeck);
    }
  };

  const standBlackjack = (playerHandParam = playerHand, deckParam = currentDeck) => {
    if (blackjackStage !== 'playing') return;

    setBlackjackStage('dealer');
    
    let currentDealerHand = [...dealerHand];
    let workingDeck = [...deckParam];
    let dealerScore = calculateScore(currentDealerHand);

    while (dealerScore < 17 && workingDeck.length > 0) {
      currentDealerHand.push(workingDeck[0]);
      workingDeck = workingDeck.slice(1);
      dealerScore = calculateScore(currentDealerHand);
    }

    setDealerHand(currentDealerHand);
    
    const playerScore = calculateScore(playerHandParam);
    let finalOutcome = 'lose';

    if (dealerScore > 21) {
      finalOutcome = 'win';
    } else if (playerScore > dealerScore) {
      finalOutcome = 'win';
    } else if (playerScore === dealerScore) {
      finalOutcome = 'push';
    } else {
      finalOutcome = 'lose';
    }

    endBlackjackGame(playerHandParam, currentDealerHand, finalOutcome, parseFloat(blackjackBet));
  };

  const endBlackjackGame = async (finalPlayerHand, finalDealerHand, outcome, betVal) => {
    setBlackjackLoading(true);
    setBlackjackStage('ended');
    setBlackjackResult(outcome);

    try {
      const res = await fetch('/api/casino/blackjack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: betVal, outcome })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al procesar el resultado.');

      updateBalance(data.newBalance);
      
      if (outcome === 'blackjack') {
        setBlackjackMessage(`¡Blackjack Natural! Ganaste Q${(betVal * 1.5).toFixed(2)} netos.`);
      } else if (outcome === 'win') {
        setBlackjackMessage(`¡Ganaste! Recibes Q${betVal.toFixed(2)} netos.`);
      } else if (outcome === 'push') {
        setBlackjackMessage(`Empate (Push). Te devolvemos tu apuesta.`);
      } else {
        setBlackjackMessage(`Perdiste Q${betVal.toFixed(2)}.`);
      }
    } catch (err) {
      setBlackjackError(err.message);
    } finally {
      setBlackjackLoading(false);
    }
  };

  // --- Handlers for Plinko ---
  const dropPlinkoBall = async (selectedRisk) => {
    const numericBet = parseFloat(plinkoBet);
    setPlinkoError(null);
    setPlinkoResult(null);
    setPlinkoLoading(true);
    setPlinkoRisk(selectedRisk);

    if (isNaN(numericBet) || numericBet <= 0) {
      setPlinkoError('Apuesta inválida.');
      setPlinkoLoading(false);
      return;
    }

    if (user.balance < numericBet) {
      setPlinkoError('Saldo insuficiente.');
      setPlinkoLoading(false);
      return;
    }

    try {
      // 1. Subtract the bet amount immediately from the local state
      updateBalance(parseFloat((user.balance - numericBet).toFixed(2)));

      const res = await fetch('/api/casino/plinko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: numericBet, risk: selectedRisk })
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Rollback balance locally if API fails
        updateBalance(parseFloat((user.balance).toFixed(2)));
        throw new Error(data.error || 'Error al lanzar.');
      }

      const dx = 28;
      const dy = 26;
      const startY = 40;
      const startX = 300;

      const keypoints = [];
      keypoints.push({ x: startX, y: 15 });

      let k = 0;
      for (let r = 0; r < 14; r++) {
        const px = startX + (k - r / 2) * dx;
        const py = startY + r * dy;
        keypoints.push({ x: px, y: py });
        k += data.path[r];
      }

      const binSpacing = dx;
      let binY = 408;
      if (selectedRisk === 'yellow') binY = 432;
      else if (selectedRisk === 'red') binY = 456;

      const targetBinX = startX + (data.landingIndex - 7) * binSpacing;
      keypoints.push({ x: targetBinX, y: binY });

      const newBall = {
        frame: 0,
        keypoints,
        risk: selectedRisk,
        x: startX,
        y: 15
      };

      plinkoBallsRef.current.push(newBall);

      setTimeout(() => {
        setPlinkoResult(data);
        // 2. Add the winning amount (or final balance) once ball hits the bin
        updateBalance(data.newBalance);
      }, 3750);

    } catch (err) {
      setPlinkoError(err.message);
    } finally {
      setPlinkoLoading(false);
    }
  };

  const getReelSymbolList = (activeSymbol, isAnimating) => {
    if (isAnimating) {
      // Return a repeated chain of symbols to simulate motion blur rotation
      return [...SYMBOLS, ...SYMBOLS, ...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
    }
    // Return single active symbol centered
    return [activeSymbol];
  };

  return (
    <div>
      <div className="dashboard-header casino-header">
        <div>
          <h1 style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Dices size={26} style={{ color: 'var(--accent-green)' }} />
            Casino Apex
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Prueba tu suerte en nuestras salas premium con mesas en vivo y tragamonedas con giros gratis y multiplicadores.
          </p>
        </div>
      </div>

      {/* Casino Navigation Tabs */}
      <div className="casino-tabs">
        <button 
          className={`casino-tab ${activeTab === 'slots' ? 'active' : ''}`}
          onClick={() => { if (!isSpinning() && !isWheelSpinning) { setActiveTab('slots'); setSlotsResult(null); } }}
        >
          🎰 Tragamonedas Neón
        </button>
        <button 
          className={`casino-tab ${activeTab === 'roulette' ? 'active' : ''}`}
          onClick={() => { if (!isSpinning() && !isWheelSpinning) { setActiveTab('roulette'); setRouletteResult(null); } }}
        >
          🎡 Ruleta Apex
        </button>
        <button 
          className={`casino-tab ${activeTab === 'blackjack' ? 'active' : ''}`}
          onClick={() => { if (!isSpinning() && !isWheelSpinning) { setActiveTab('blackjack'); setBlackjackResult(''); setBlackjackMessage(''); } }}
        >
          🃏 Blackjack Apex
        </button>
        <button 
          className={`casino-tab ${activeTab === 'plinko' ? 'active' : ''}`}
          onClick={() => { if (!isSpinning() && !isWheelSpinning) { setActiveTab('plinko'); setPlinkoResult(null); setPlinkoError(null); } }}
        >
          🟢 Plinko Apex
        </button>
      </div>

      {/* Slots Section */}
      {activeTab === 'slots' && (
        <div className="casino-game-card">
          <div className="slots-machine-frame">
            <div className="slots-banner">
              ⭐ APEX NEON SLOTS ⭐
            </div>

            <div className="slots-reels-window">
              <div className="slots-center-line" />
              
              {/* Reel 1 */}
              <div className="slots-reel-container">
                <div className={`slots-reel-strip ${reel1Spin ? 'slots-spin-fast' : ''}`}>
                  {getReelSymbolList(reels[0], reel1Spin).map((sym, idx) => (
                    <div key={idx} className="slots-symbol">{sym}</div>
                  ))}
                </div>
              </div>

              {/* Reel 2 */}
              <div className="slots-reel-container">
                <div className={`slots-reel-strip ${reel2Spin ? 'slots-spin-fast' : ''}`}>
                  {getReelSymbolList(reels[1], reel2Spin).map((sym, idx) => (
                    <div key={idx} className="slots-symbol">{sym}</div>
                  ))}
                </div>
              </div>

              {/* Reel 3 */}
              <div className="slots-reel-container">
                <div className={`slots-reel-strip ${reel3Spin ? 'slots-spin-fast' : ''}`}>
                  {getReelSymbolList(reels[2], reel3Spin).map((sym, idx) => (
                    <div key={idx} className="slots-symbol">{sym}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Slots Result Message */}
            {slotsResult && (
              <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: slotsResult.isWinner ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)', border: slotsResult.isWinner ? '1px solid var(--accent-green)' : '1px solid var(--border-color)' }}>
                {slotsResult.isWinner ? (
                  <h4 style={{ color: 'var(--accent-green)', fontWeight: '800' }}>
                    🎉 ¡GANASTE! +Q{slotsResult.winAmount.toFixed(2)}
                  </h4>
                ) : (
                  <h4 style={{ color: 'var(--text-secondary)' }}>Inténtalo de nuevo</h4>
                )}
              </div>
            )}

            {slotsError && (
              <div className="alert-banner warning" style={{ marginTop: '16px', marginHorizontal: 0 }}>
                <AlertCircle size={15} />
                <span>{slotsError}</span>
              </div>
            )}

            {/* Slots Panel Controls */}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div className="form-group" style={{ margin: 0, width: '120px', textAlign: 'left' }}>
                <label className="form-label">Apuesta (Q)</label>
                <input
                  type="number"
                  className="form-input"
                  min="5"
                  step="5"
                  value={slotsBet}
                  onChange={(e) => setSlotsBet(e.target.value)}
                  disabled={slotsLoading}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: '12px 32px', height: '43px', fontSize: '15px' }}
                onClick={spinSlots}
                disabled={slotsLoading}
              >
                <Play size={16} /> Girar
              </button>
            </div>
          </div>

          <div className="payout-info-box" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <strong>Tabla de Premios:</strong> 3 Símbolos iguales de 7️⃣ paga 50x • 💎 paga 25x • 🍀 paga 12x • 🍒 paga 6x • 🍋 paga 4x. <br/>
            Cualquier combinación de 2 símbolos iguales otorga reintegro premium de <strong>1.5x la apuesta</strong>.
          </div>
        </div>
      )}

      {/* Roulette Section */}
      {activeTab === 'roulette' && (
        <div className="roulette-container">
          
          {/* Left panel: Wheel representation */}
          <div className="roulette-wheel-panel">
            {/* Top Indicator Needle */}
            <div 
              style={{
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '20px solid #d4af37',
                marginBottom: '10px',
                zIndex: 15,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}
            />

            <div className="roulette-wheel-outer">
              <div 
                className="roulette-wheel-inner"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                {/* Turret Center */}
                <div className="roulette-center-cap">
                  <div className="roulette-center-star" />
                </div>

                {/* Draw 37 slots */}
                {WHEEL_NUMBERS.map((num, idx) => {
                  const angle = (360 / 37) * idx;
                  const isRed = RED_NUMBERS.includes(num);
                  const isZero = num === 0;
                  const colorClass = isZero ? 'zero' : isRed ? 'red' : 'black';
                  return (
                    <div
                      key={num}
                      className={`roulette-number-slot ${colorClass}`}
                      style={{ transform: `rotate(${angle}deg)` }}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
              
              {/* Ball overlay when spinning */}
              {isWheelSpinning && (
                <div className="roulette-ball roulette-ball-spin" />
              )}
            </div>

            {/* Results Alert */}
            {rouletteResult && !isWheelSpinning && (
              <div style={{ marginTop: '24px', textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                  Número Ganador:
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0', width: '56px', height: '56px', borderRadius: '50%', fontSize: '24px', fontWeight: '800', border: '3px solid #d4af37', backgroundColor: rouletteResult.winningColor === 'red' ? '#ef4444' : rouletteResult.winningColor === 'black' ? '#1f2937' : '#10b981', color: '#fff' }}>
                  {rouletteResult.winningNumber}
                </div>
                
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: rouletteResult.isWinner ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)', border: rouletteResult.isWinner ? '1px solid var(--accent-green)' : '1px solid var(--border-color)' }}>
                  {rouletteResult.isWinner ? (
                    <h4 style={{ color: 'var(--accent-green)', fontWeight: '800' }}>
                      🎉 ¡Victoria! Cobraste +Q{rouletteResult.winAmount.toFixed(2)}
                    </h4>
                  ) : (
                    <h4 style={{ color: 'var(--text-secondary)' }}>Suerte en la próxima tirada</h4>
                  )}
                </div>
              </div>
            )}

            {rouletteError && (
              <div className="alert-banner warning" style={{ marginTop: '16px', width: '100%' }}>
                <AlertCircle size={15} />
                <span>{rouletteError}</span>
              </div>
            )}
          </div>

          {/* Right panel: Table Board & Inputs */}
          <div className="roulette-board-panel">
            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trophy size={16} style={{ color: 'var(--accent-green)' }} />
              Tablero de Apuestas
            </h3>
            
            <div className="roulette-board-grid">
              <button 
                className={`roulette-cell red ${rouletteBetType === 'red' ? 'active' : ''}`}
                onClick={() => setRouletteBetType('red')}
                disabled={rouletteLoading || isWheelSpinning}
              >
                Rojo (2x)
              </button>
              <button 
                className={`roulette-cell black ${rouletteBetType === 'black' ? 'active' : ''}`}
                onClick={() => setRouletteBetType('black')}
                disabled={rouletteLoading || isWheelSpinning}
              >
                Negro (2x)
              </button>
              <button 
                className={`roulette-cell ${rouletteBetType === 'even' ? 'active' : ''}`}
                onClick={() => setRouletteBetType('even')}
                disabled={rouletteLoading || isWheelSpinning}
                style={{ color: '#fff' }}
              >
                Par (2x)
              </button>
              <button 
                className={`roulette-cell ${rouletteBetType === 'odd' ? 'active' : ''}`}
                onClick={() => setRouletteBetType('odd')}
                disabled={rouletteLoading || isWheelSpinning}
                style={{ color: '#fff' }}
              >
                Impar (2x)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px', marginBottom: '16px' }}>
              <button 
                className={`roulette-cell zero ${rouletteBetType === 'zero' ? 'active' : ''}`}
                style={{ padding: '14px' }}
                onClick={() => setRouletteBetType('zero')}
                disabled={rouletteLoading || isWheelSpinning}
              >
                Verde 0 (35x)
              </button>
              
              <button 
                className={`roulette-cell ${rouletteBetType === 'number' ? 'active' : ''}`}
                onClick={() => setRouletteBetType('number')}
                disabled={rouletteLoading || isWheelSpinning}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff' }}
              >
                Número (35x)
                <select 
                  className="form-input" 
                  style={{ width: '60px', padding: '4px', fontSize: '12px', background: '#07080a', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={rouletteNumber}
                  onChange={(e) => {
                    setRouletteBetType('number');
                    setRouletteNumber(e.target.value);
                  }}
                  disabled={rouletteLoading || isWheelSpinning}
                >
                  {Array.from({ length: 37 }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </button>
            </div>

            {/* Inputs controls */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div className="form-group" style={{ margin: 0, width: '120px' }}>
                <label className="form-label">Monto apuesta (Q)</label>
                <input
                  type="number"
                  className="form-input"
                  min="5"
                  step="5"
                  value={rouletteBet}
                  onChange={(e) => setRouletteBet(e.target.value)}
                  disabled={rouletteLoading || isWheelSpinning}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: '12px 28px', height: '43px', fontSize: '14px', flexGrow: 1 }}
                onClick={spinRoulette}
                disabled={rouletteLoading || isWheelSpinning}
              >
                <Dices size={16} /> Girar Ruleta
              </button>
            </div>

            <div className="payout-info-box" style={{ marginTop: '20px' }}>
              ℹ️ **Regla de Apuesta Seleccionada:** <br/>
              Apostando ${rouletteBet} al {
                rouletteBetType === 'red' ? 'Color Rojo (Pago 2x)' :
                rouletteBetType === 'black' ? 'Color Negro (Pago 2x)' :
                rouletteBetType === 'even' ? 'Números Pares (Pago 2x)' :
                rouletteBetType === 'odd' ? 'Números Impares (Pago 2x)' :
                rouletteBetType === 'zero' ? 'Cero Verde (Pago 35x)' :
                `Número Exacto ${rouletteNumber} (Pago 35x)`
              }. Retorno potencial de ganancia: **${
                rouletteBetType === 'red' || rouletteBetType === 'black' || rouletteBetType === 'even' || rouletteBetType === 'odd' ? `$${(parseFloat(rouletteBet) * 2).toFixed(2)}` : `$${(parseFloat(rouletteBet) * 35).toFixed(2)}`
              }**.
            </div>
          </div>

        </div>
      )}

      {/* Blackjack Section */}
      {activeTab === 'blackjack' && (
        <div className="casino-game-card">
          <div className="blackjack-table">
            <div className="slots-banner" style={{ borderStyle: 'solid', borderColor: 'var(--accent-cyan)' }}>
              ♣️ APEX NEON BLACKJACK ♦️
            </div>

            {/* Dealer's Hand */}
            <div className="blackjack-zone">
              <div className="blackjack-zone-title">
                Mano de la Casa (Crupier)
              </div>
              <div className="blackjack-cards-list">
                {dealerHand.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Esperando apuesta...</p>
                ) : (
                  dealerHand.map((card, idx) => {
                    const isHidden = idx === 0 && blackjackStage === 'playing';
                    if (isHidden) {
                      return (
                        <div key={idx} className="blackjack-card-item back">
                          <HelpCircle size={28} />
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className={`blackjack-card-item ${card.suit === '♥' || card.suit === '♦' ? 'red' : ''}`}>
                        <div>{card.name}</div>
                        <div style={{ fontSize: '24px', alignSelf: 'center' }}>{card.suit}</div>
                        <div style={{ transform: 'rotate(180deg)' }}>{card.name}</div>
                      </div>
                    );
                  })
                )}
              </div>
              {dealerHand.length > 0 && (
                <div className="blackjack-score-badge">
                  Puntaje: {blackjackStage === 'playing' ? '?' : calculateScore(dealerHand)}
                </div>
              )}
            </div>

            {/* Separator / Verdict display */}
            <div style={{ textAlign: 'center', margin: '10px 0', minHeight: '36px' }}>
              {blackjackMessage && (
                <div style={{
                  color: blackjackResult === 'win' || blackjackResult === 'blackjack' ? 'var(--accent-green)' : blackjackResult === 'push' ? 'var(--accent-cyan)' : 'var(--status-lost)',
                  fontWeight: '800',
                  fontSize: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {blackjackMessage}
                </div>
              )}
              {blackjackError && (
                <div style={{ color: 'var(--status-lost)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <AlertCircle size={13} /> {blackjackError}
                </div>
              )}
            </div>

            {/* Player's Hand */}
            <div className="blackjack-zone">
              <div className="blackjack-zone-title">
                Tu Mano
              </div>
              <div className="blackjack-cards-list">
                {playerHand.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Coloca tu apuesta para iniciar</p>
                ) : (
                  playerHand.map((card, idx) => (
                    <div key={idx} className={`blackjack-card-item ${card.suit === '♥' || card.suit === '♦' ? 'red' : ''}`}>
                      <div>{card.name}</div>
                      <div style={{ fontSize: '24px', alignSelf: 'center' }}>{card.suit}</div>
                      <div style={{ transform: 'rotate(180deg)' }}>{card.name}</div>
                    </div>
                  ))
                )}
              </div>
              {playerHand.length > 0 && (
                <div className="blackjack-score-badge">
                  Puntaje: {calculateScore(playerHand)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              {blackjackStage === 'betting' || blackjackStage === 'ended' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '6px' }}>Apuesta: Q</span>
                    <input
                      type="number"
                      value={blackjackBet}
                      onChange={(e) => setBlackjackBet(e.target.value)}
                      disabled={blackjackLoading}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        width: '70px',
                        padding: '10px 0',
                        fontSize: '14px',
                        fontWeight: '700',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={dealBlackjack} disabled={blackjackLoading}>
                    {blackjackLoading ? '...' : 'Repartir'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-outline-neon" onClick={hitBlackjack} disabled={blackjackStage !== 'playing'}>
                    Pedir Carta
                  </button>
                  <button className="btn btn-primary" onClick={() => standBlackjack()} disabled={blackjackStage !== 'playing'}>
                    Plantarse
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Rules info */}
          <div className="payout-info-box" style={{ width: '100%', maxWidth: '700px', marginTop: '16px' }}>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontWeight: '700' }}>Reglas de la Mesa (Blackjack Apex)</h4>
            <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>El Crupier está obligado a pedir carta con 16 o menos, y se planta obligatoriamente con 17 o más.</li>
              <li>El pago del Blackjack Natural es de <strong>3 a 2 (pago de 2.5x tu apuesta)</strong>.</li>
              <li>El pago de una victoria convencional es de <strong>1 a 1 (pago de 2.0x tu apuesta)</strong>.</li>
              <li>En caso de empate (Push), tu apuesta es reembolsada íntegramente a tu balance.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Plinko Section */}
      {activeTab === 'plinko' && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', justifyContent: 'center', width: '100%', maxWidth: '900px', margin: '0 auto', flexWrap: 'wrap' }}>
          
          {/* Controls Left Column */}
          <div className="card" style={{ flex: '1 1 250px', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', background: '#090e13', border: '1px solid var(--border-color)' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Apuesta (Q)</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0 8px' }}>
                <input
                  type="number"
                  step="0.50"
                  min="0.10"
                  value={plinkoBet}
                  onChange={(e) => setPlinkoBet(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    flexGrow: 1,
                    padding: '12px 4px',
                    fontSize: '15px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPlinkoBet(prev => Math.max(0.10, parseFloat(prev) - 1.00).toFixed(2))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', fontSize: '16px', fontWeight: 'bold' }}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setPlinkoBet(prev => (parseFloat(prev) + 1.00).toFixed(2))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', fontSize: '16px', fontWeight: 'bold' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick selectors */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline-neon"
                style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                onClick={() => setPlinkoBet(prev => Math.max(0.10, parseFloat(prev) / 2).toFixed(2))}
              >
                ½
              </button>
              <button
                className="btn btn-outline-neon"
                style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                onClick={() => setPlinkoBet(prev => (parseFloat(prev) * 2).toFixed(2))}
              >
                2x
              </button>
              <button
                className="btn btn-outline-neon"
                style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                onClick={() => setPlinkoBet(user.balance.toFixed(2))}
              >
                Max
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #00c853, #1b5e20)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0,200,83,0.3)',
                  padding: '14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  letterSpacing: '1px',
                  cursor: 'pointer'
                }}
                onClick={() => dropPlinkoBall('green')}
                disabled={plinkoLoading}
              >
                VERDE
              </button>
              <button
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #ffb300, #f57c00)',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(255,179,0,0.3)',
                  padding: '14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  letterSpacing: '1px',
                  cursor: 'pointer'
                }}
                onClick={() => dropPlinkoBall('yellow')}
                disabled={plinkoLoading}
              >
                AMARILLO
              </button>
              <button
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
                  padding: '14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  letterSpacing: '1px',
                  cursor: 'pointer'
                }}
                onClick={() => dropPlinkoBall('red')}
                disabled={plinkoLoading}
              >
                ROJO
              </button>
            </div>

            {/* Errors */}
            {plinkoError && (
              <div style={{ color: 'var(--status-lost)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                <AlertCircle size={12} /> {plinkoError}
              </div>
            )}

            {/* Result Announcement */}
            {plinkoResult && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: plinkoResult.multiplier >= 1 ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.02)',
                border: plinkoResult.multiplier >= 1 ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Multiplicador: {plinkoResult.multiplier}x</div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  color: plinkoResult.multiplier >= 1 ? 'var(--accent-green)' : 'var(--text-muted)',
                  marginTop: '4px'
                }}>
                  {plinkoResult.multiplier >= 1 ? `¡Ganaste Q${plinkoResult.winAmount.toFixed(2)}!` : 'Inténtalo de nuevo'}
                </div>
              </div>
            )}
          </div>

          {/* Canvas Right Column */}
          <div className="card" style={{ flex: '1 1 500px', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', background: '#090e13', border: '1px solid var(--border-color)' }}>
            <canvas
              ref={plinkoCanvasRef}
              width={600}
              height={500}
              style={{
                width: '100%',
                maxWidth: '600px',
                aspectRatio: '6/5',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>

        </div>
      )}

      <AuthModal />
    </div>
  );
}
