
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { joinQueue, syncGameState, updateMove } from '../services/database';
import { ChevronLeft, Dices, Trophy, Loader2, Target, CheckCircle2, Coins } from 'lucide-react';

interface GameProps {
  user: User | null;
  updateBalance: (amount: number) => void;
  onBack: () => void;
}

const LudoGame: React.FC<GameProps> = ({ user, updateBalance, onBack }) => {
  const [stage, setStage] = useState<'WAGER' | 'MATCHMAKING' | 'PLAYING' | 'GAMEOVER'>('WAGER');
  const [wager, setWager] = useState('1.0');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [matchFound, setMatchFound] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const handleStartMatch = () => {
    if (!user) return;
    const w = parseFloat(wager);
    if (w > user.balance) return alert("Insufficient SOL");
    updateBalance(-w);
    setStage('MATCHMAKING');
    setMatchFound(false);

    unsubRef.current = joinQueue('ludo', w, user, (id, opp) => {
        setOpponent(opp);
        setMatchFound(true);
        setTimeout(() => { setRoomId(id); setStage('PLAYING'); }, 1500);
    }, (err) => console.warn(err));
  };

  useEffect(() => {
    if (roomId) {
      const unsub = syncGameState(roomId, (data) => {
        setGameData(data);
        if (data.winner) setStage('GAMEOVER');
      });
      return () => unsub();
    }
  }, [roomId]);

  if (stage === 'WAGER') {
    return (
      <div className="max-w-md mx-auto bg-card-bg border-4 border-gray-800 rounded-[3rem] p-10 text-center mt-10 shadow-card-depth animate-in zoom-in">
        <Dices size={64} className="text-fox-orange mx-auto mb-6" />
        <h2 className="text-4xl font-black italic text-white uppercase mb-2">LUDO ROYALE</h2>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border-2 border-gray-800 mb-8 text-left">
           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Entry Stake (SOL)</label>
           <input type="number" value={wager} onChange={e => setWager(e.target.value)} className="w-full bg-transparent border-none text-white text-4xl font-black focus:outline-none font-mono" />
        </div>
        <button onClick={handleStartMatch} className="w-full bg-fox-orange text-white py-6 rounded-[2rem] font-black text-2xl shadow-pop-orange btn-tactile uppercase italic">FIND TABLE</button>
      </div>
    );
  }

  if (stage === 'MATCHMAKING') {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in">
            <div className="relative mb-10">
                {matchFound ? <CheckCircle2 size={120} className="text-neon-green" /> : <Loader2 size={120} className="text-neon-blue animate-spin" />}
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">{matchFound ? 'TABLE READY' : 'WAITING FOR PLAYERS...'}</h3>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">STAKE: {wager} SOL</p>
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full items-center justify-center gap-12">
        <div className="text-center">
            <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Board Brawl</h1>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em]">Game Sync Active: VS {opponent?.username}</p>
        </div>
        
        <div className="w-full aspect-square max-w-[500px] bg-slate-900 rounded-[3rem] border-8 border-gray-800 flex items-center justify-center shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <div className="text-center z-10 px-12">
                <Dices size={80} className="text-fox-orange mx-auto mb-6 animate-bounce" />
                <h3 className="text-2xl font-black text-white uppercase tracking-widest italic mb-8 leading-tight">Match is synchronization in progress...</h3>
                <div className="bg-slate-950 p-6 rounded-3xl border border-white/5 flex items-center gap-6">
                    <img src={user?.avatar} className="w-12 h-12 rounded-xl border-2 border-fox-orange" />
                    <div className="h-0.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-fox-orange animate-progress" style={{width: '60%'}}></div>
                    </div>
                    <img src={opponent?.avatar} className="w-12 h-12 rounded-xl border-2 border-gray-700 opacity-50" />
                </div>
             </div>
        </div>

        <button onClick={onBack} className="text-gray-600 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors">Fold & Return to Lobby</button>
    </div>
  );
};

export default LudoGame;
