
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { joinQueue, syncGameState, updateMove } from '../services/database';
import { ChevronLeft, Building, Trophy, Loader2, Target, CheckCircle2 } from 'lucide-react';

interface GameProps {
  user: User | null;
  updateBalance: (amount: number) => void;
  onBack: () => void;
}

const EurasEstateGame: React.FC<GameProps> = ({ user, updateBalance, onBack }) => {
  const [stage, setStage] = useState<'WAGER' | 'MATCHMAKING' | 'PLAYING' | 'GAMEOVER'>('WAGER');
  const [wager, setWager] = useState('5.0');
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

    unsubRef.current = joinQueue('euras_estate', w, user, (id, opp) => {
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
        <Building size={64} className="text-neon-green mx-auto mb-6" />
        <h2 className="text-4xl font-black italic text-white uppercase mb-2">EURAS ESTATE</h2>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border-2 border-gray-800 mb-8 text-left">
           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Entry Fee (SOL)</label>
           <input type="number" value={wager} onChange={e => setWager(e.target.value)} className="w-full bg-transparent border-none text-white text-4xl font-black focus:outline-none font-mono" />
        </div>
        <button onClick={handleStartMatch} className="w-full bg-neon-green text-black py-6 rounded-[2rem] font-black text-2xl shadow-pop-green btn-tactile uppercase italic">START TYCOON</button>
      </div>
    );
  }

  if (stage === 'MATCHMAKING') {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="relative mb-10">
                {matchFound ? <CheckCircle2 size={120} className="text-neon-green" /> : <Loader2 size={120} className="text-neon-blue animate-spin" />}
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">{matchFound ? 'ESTATE SECURED' : 'BUILDING ROOM...'}</h3>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">STAKE: {wager} SOL</p>
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-12 py-20">
        <Building size={100} className="text-neon-green/10 animate-pulse" />
        <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter">Loading Board...</h2>
        <div className="flex items-center gap-6">
            <div className="text-right">
                <div className="text-[10px] font-black text-gray-600 uppercase">You</div>
                <div className="text-sm font-black text-white">{user?.username}</div>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-neon-green bg-slate-900"></div>
            <span className="text-xl font-black italic text-gray-800">VS</span>
            <div className="w-12 h-12 rounded-full border-2 border-gray-800 bg-slate-900 opacity-50"></div>
            <div className="text-left">
                <div className="text-[10px] font-black text-gray-600 uppercase">Opponent</div>
                <div className="text-sm font-black text-white">{opponent?.username}</div>
            </div>
        </div>
        <button onClick={onBack} className="mt-20 text-gray-700 hover:text-white font-black uppercase text-[10px] tracking-widest">Abandon Empire</button>
    </div>
  );
};

export default EurasEstateGame;
