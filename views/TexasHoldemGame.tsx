
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { joinQueue, syncGameState, updateMove } from '../services/database';
import { ChevronLeft, Spade, Heart, Club, Diamond, Loader2, Coins, Search, Trophy, CheckCircle2 } from 'lucide-react';

interface GameProps {
  user: User | null;
  updateBalance: (amount: number) => void;
  onBack: () => void;
}

type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { suit: Suit; rank: Rank; value: number; }

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

const createDeck = (): Card[] => {
  let deck: Card[] = [];
  SUITS.forEach(suit => RANKS.forEach((rank, index) => deck.push({ suit, rank, value: index + 2 })));
  return deck.sort(() => Math.random() - 0.5);
};

const CardView: React.FC<{ card: Card | null; hidden?: boolean }> = ({ card, hidden }) => {
  if (hidden || !card) return <div className="w-14 h-20 md:w-24 md:h-32 bg-fox-orange rounded-xl border-4 border-amber-300 flex items-center justify-center shadow-2xl"><div className="text-white font-black text-3xl">🐕</div></div>;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const Icon = card.suit === 'spades' ? Spade : card.suit === 'hearts' ? Heart : card.suit === 'clubs' ? Club : Diamond;
  return (
    <div className="w-14 h-20 md:w-24 md:h-32 p-3 bg-white rounded-xl flex flex-col items-center justify-between shadow-2xl border border-gray-100 animate-in zoom-in">
      <div className="text-sm md:text-xl font-black self-start" style={{ color: isRed ? '#F43F5E' : '#0F172A' }}>{card.rank}</div>
      <Icon className="w-8 h-8 md:w-14 md:h-14" fill={isRed ? '#F43F5E' : '#0F172A'} />
      <div className="text-sm md:text-xl font-black self-end rotate-180" style={{ color: isRed ? '#F43F5E' : '#0F172A' }}>{card.rank}</div>
    </div>
  );
};

const TexasHoldemGame: React.FC<GameProps> = ({ user, updateBalance, onBack }) => {
  const [stage, setStage] = useState<'WAGER' | 'MATCHMAKING' | 'PLAYING' | 'GAMEOVER'>('WAGER');
  const [wager, setWager] = useState('0.5');
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

    unsubRef.current = joinQueue('holdem', w, user, (id, opp) => {
        setOpponent(opp);
        setMatchFound(true);
        setTimeout(() => { setRoomId(id); setStage('PLAYING'); }, 1500);
    }, (err) => console.warn(err));
  };

  useEffect(() => {
    if (roomId) {
      const unsub = syncGameState(roomId, (data) => {
        setGameData(data);
        if (data.board === null && data.players[0] === user?.id) {
            const deck = createDeck();
            const p1H = [deck.pop(), deck.pop()];
            const p2H = [deck.pop(), deck.pop()];
            const community = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
            updateMove(roomId, { 
                board: { community, [data.players[0]]: p1H, [data.players[1]]: p2H },
                pot: wager,
                state: 'FLOP' 
            });
        }
        if (data.winner) setStage('GAMEOVER');
      });
      return () => unsub();
    }
  }, [roomId]);

  if (stage === 'WAGER') {
    return (
      <div className="max-w-md mx-auto bg-card-bg border-4 border-gray-800 rounded-[3rem] p-10 text-center mt-10 shadow-card-depth animate-in zoom-in">
        <Spade size={64} className="text-fox-orange mx-auto mb-6" />
        <h2 className="text-4xl font-black italic text-white uppercase mb-2 tracking-tighter">NEON HOLD'EM</h2>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-10 italic">1v1 High Stakes Poker Duel</p>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border-2 border-gray-800 mb-8 text-left">
           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Buy-In (SOL)</label>
           <input type="number" value={wager} onChange={e => setWager(e.target.value)} className="w-full bg-transparent border-none text-white text-4xl font-black focus:outline-none font-mono" />
        </div>
        <button onClick={handleStartMatch} className="w-full bg-fox-orange text-white py-6 rounded-[2rem] font-black text-2xl shadow-pop-orange btn-tactile uppercase italic flex items-center justify-center gap-3 tracking-tighter">
            <Search size={24} /> FIND TABLE
        </button>
      </div>
    );
  }

  if (stage === 'MATCHMAKING') {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in">
            <div className="relative mb-10">
                {matchFound ? <CheckCircle2 size={120} className="text-neon-green" /> : <Loader2 size={120} className="text-neon-blue animate-spin" />}
            </div>
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">{matchFound ? 'SITTING AT TABLE...' : 'SCOUTING ROOMS...'}</h3>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4">{matchFound ? `VS ${opponent.username}` : `STAKE: ${wager} SOL`}</p>
        </div>
      );
  }

  const myHand = gameData?.board?.[user!.id] || [];
  const oppHand = gameData?.board?.[gameData.players.find((id: string) => id !== user!.id)] || [];

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full gap-4 pb-12">
        <div className="flex justify-between items-center px-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1 font-black text-sm uppercase bg-white/5 p-2 px-4 rounded-xl border border-white/5"><ChevronLeft size={16}/> Back</button>
            <div className="bg-slate-900 border-2 border-emerald-500/30 px-8 py-3 rounded-full text-2xl font-black text-emerald-400 flex items-center gap-3">
                <Coins className="text-fox-orange" /> POT: {(parseFloat(wager)*2).toFixed(2)} SOL
            </div>
        </div>

        <div className="relative flex-1 bg-[#064e3b] border-[24px] border-[#3f2e22] rounded-[200px] shadow-2xl flex flex-col justify-between py-10 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 pointer-events-none"></div>
            
            <div className="flex flex-col items-center gap-2 z-10">
                <div className="w-20 h-20 rounded-xl bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl"><img src={opponent?.avatar} /></div>
                <div className="flex gap-2">
                    <CardView card={null} hidden={true} />
                    <CardView card={null} hidden={true} />
                </div>
            </div>

            <div className="flex flex-col items-center gap-6 z-10">
                <div className="flex gap-4">
                    {gameData?.board?.community?.map((c: any, i: number) => <CardView key={i} card={c} />)}
                    {Array.from({ length: 5 - (gameData?.board?.community?.length || 0) }).map((_, i) => <div key={i} className="w-24 h-32 border-2 border-white/10 rounded-xl bg-white/5 border-dashed" />)}
                </div>
            </div>

            <div className="flex flex-col items-center z-10">
                <div className="flex gap-4 mb-8">
                    {myHand.map((c: any, i: number) => <CardView key={i} card={c} />)}
                </div>
                <div className="bg-slate-900/90 p-8 rounded-[40px] border-4 border-slate-700 flex gap-6 backdrop-blur-md shadow-2xl">
                    <button className="px-16 py-4 rounded-2xl bg-neon-red text-white font-black uppercase shadow-pop-red btn-tactile">FOLD</button>
                    <button className="px-24 py-4 rounded-2xl bg-neon-blue text-white font-black uppercase shadow-pop-blue btn-tactile">CALL</button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default TexasHoldemGame;
