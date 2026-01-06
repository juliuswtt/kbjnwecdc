
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { joinQueue, syncGameState, updateMove } from '../services/database';
import { ChevronLeft, TrendingUp, TrendingDown, Loader2, Target, CheckCircle2, Trophy, BarChart3 } from 'lucide-react';

interface GameProps {
  user: User | null;
  updateBalance: (amount: number) => void;
  onBack: () => void;
}

const MarketRoyaleGame: React.FC<GameProps> = ({ user, updateBalance, onBack }) => {
  const [stage, setStage] = useState<'WAGER' | 'MATCHMAKING' | 'PLAYING' | 'GAMEOVER'>('WAGER');
  const [wager, setWager] = useState('0.5');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [matchFound, setMatchFound] = useState(false);
  const [userVote, setUserVote] = useState<'UP' | 'DOWN' | null>(null);
  const [timer, setTimer] = useState(10);
  
  const unsubRef = useRef<(() => void) | null>(null);

  const handleStartMatch = () => {
    if (!user) return;
    const w = parseFloat(wager);
    if (w > user.balance) return alert("Insufficient SOL");
    updateBalance(-w);
    setStage('MATCHMAKING');
    setMatchFound(false);

    unsubRef.current = joinQueue('market_royale', w, user, (id, opp) => {
        setOpponent(opp);
        setMatchFound(true);
        setTimeout(() => {
            setRoomId(id);
            setStage('PLAYING');
        }, 1500);
    }, (err) => console.warn(err));
  };

  useEffect(() => {
    if (roomId) {
      const unsub = syncGameState(roomId, (data) => {
        setGameData(data);
        if (data.winner) setStage('GAMEOVER');
        if (data.state === 'RESOLVING' && !data.winner && data.players[0] === user?.id) {
            // Master logic to decide outcome
            setTimeout(() => {
                const isPump = Math.random() > 0.5;
                const outcome = isPump ? 'UP' : 'DOWN';
                const p1Vote = data.votes?.[data.players[0]];
                const p2Vote = data.votes?.[data.players[1]];
                
                let winner = null;
                if (p1Vote === outcome && p2Vote !== outcome) winner = data.players[0];
                else if (p2Vote === outcome && p1Vote !== outcome) winner = data.players[1];
                
                updateMove(roomId, { 
                    winner: winner || 'DRAW',
                    outcome: outcome,
                    state: 'FINISHED'
                });
            }, 2000);
        }
      });
      return () => unsub();
    }
  }, [roomId]);

  const submitVote = (vote: 'UP' | 'DOWN') => {
    if (!roomId || userVote) return;
    setUserVote(vote);
    updateMove(roomId, { [`votes.${user!.id}`]: vote });
  };

  if (stage === 'WAGER') {
    return (
      <div className="max-w-md mx-auto bg-card-bg border-4 border-gray-800 rounded-[3rem] p-10 text-center mt-10 shadow-card-depth animate-in zoom-in">
        <BarChart3 size={64} className="text-neon-green mx-auto mb-6" />
        <h2 className="text-4xl font-black italic text-white uppercase mb-2">MARKET ROYALE</h2>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-10">Real-Time PvP Prediction Duel</p>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border-2 border-gray-800 mb-8 text-left">
           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Wager (SOL)</label>
           <input type="number" value={wager} onChange={e => setWager(e.target.value)} className="w-full bg-transparent border-none text-white text-4xl font-black focus:outline-none font-mono" />
        </div>
        <button onClick={handleStartMatch} className="w-full bg-neon-green text-black py-6 rounded-[2rem] font-black text-2xl shadow-pop-green btn-tactile uppercase italic">FIND DUEL</button>
      </div>
    );
  }

  if (stage === 'MATCHMAKING') {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="relative mb-10">
                {matchFound ? <CheckCircle2 size={120} className="text-neon-green" /> : <Loader2 size={120} className="text-neon-blue animate-spin" />}
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">{matchFound ? 'TARGET FOUND' : 'SCANNING MARKETS...'}</h3>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">STAKE: {wager} SOL</p>
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full gap-8 pb-12">
        <div className="flex justify-between items-center px-4">
            <button onClick={onBack} className="text-gray-500 bg-white/5 p-3 rounded-2xl"><ChevronLeft size={24}/></button>
            <div className="flex gap-4">
                <div className="bg-slate-900 border-2 border-gray-800 px-6 py-2 rounded-xl flex items-center gap-3">
                    <img src={user?.avatar} className="w-6 h-6 rounded-md" />
                    <span className="text-xs font-black text-white">YOU</span>
                </div>
                <div className="bg-slate-900 border-2 border-gray-800 px-6 py-2 rounded-xl flex items-center gap-3">
                    <img src={opponent?.avatar} className="w-6 h-6 rounded-md" />
                    <span className="text-xs font-black text-white">{opponent?.username}</span>
                </div>
            </div>
        </div>

        <div className="bg-slate-950 rounded-[4rem] p-12 border-4 border-gray-800 shadow-2xl flex flex-col items-center gap-12 relative overflow-hidden">
            <div className="text-center">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-widest mb-2">Predict the Next Candle</h2>
                <p className="text-gray-600 text-xs font-bold uppercase">Both players must choose within 10 seconds</p>
            </div>

            <div className="grid grid-cols-2 gap-8 w-full">
                <button 
                    onClick={() => submitVote('UP')}
                    disabled={!!userVote}
                    className={`py-16 rounded-[3rem] border-4 flex flex-col items-center gap-4 transition-all ${userVote === 'UP' ? 'bg-neon-green border-white shadow-neon-glow scale-95' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-500'}`}
                >
                    <TrendingUp size={64} />
                    <span className="text-3xl font-black italic">PUMP</span>
                </button>
                <button 
                    onClick={() => submitVote('DOWN')}
                    disabled={!!userVote}
                    className={`py-16 rounded-[3rem] border-4 flex flex-col items-center gap-4 transition-all ${userVote === 'DOWN' ? 'bg-neon-red border-white shadow-pop-red scale-95' : 'bg-rose-950/20 border-rose-900/30 text-rose-500'}`}
                >
                    <TrendingDown size={64} />
                    <span className="text-3xl font-black italic">DUMP</span>
                </button>
            </div>

            {stage === 'GAMEOVER' && (
                <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-10 text-center animate-in fade-in">
                    <Trophy size={100} className={gameData.winner === user?.id ? 'text-neon-green animate-bounce' : 'text-neon-red'} />
                    <h2 className="text-7xl font-black italic text-white uppercase mt-4">{gameData.winner === user?.id ? 'VICTORY' : 'REKT'}</h2>
                    <div className="text-4xl font-mono font-black text-white mt-4 tracking-tighter">OUTCOME: {gameData.outcome}</div>
                    <div className="text-neon-green text-3xl font-black mt-8">+ {(parseFloat(wager)*2*0.95).toFixed(2)} SOL</div>
                    <button onClick={onBack} className="mt-12 bg-white text-black px-12 py-5 rounded-2xl font-black uppercase italic btn-tactile">BACK TO LOBBY</button>
                </div>
            )}
        </div>
    </div>
  );
};

export default MarketRoyaleGame;
