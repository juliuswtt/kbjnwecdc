import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { joinQueue, syncGameState, updateMove } from '../services/database';
import { ChevronLeft, Loader2, Trophy, Grid3X3, Search, Target, CheckCircle2, AlertCircle } from 'lucide-react';

interface GameProps {
  user: User | null;
  updateBalance: (amount: number) => void;
  onBack: () => void;
}

const ROWS = 6;
const COLS = 7;

const ConnectFourGame: React.FC<GameProps> = ({ user, updateBalance, onBack }) => {
  const [stage, setStage] = useState<'WAGER' | 'MATCHMAKING' | 'PLAYING' | 'GAMEOVER'>('WAGER');
  const [wager, setWager] = useState('0.1');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<any>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponent, setOpponent] = useState<any>(null);
  const [matchFound, setMatchFound] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  
  const unsubRef = useRef<(() => void) | null>(null);
  const initializingRef = useRef(false);

  const initBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const handleStartMatch = async () => {
    if (!user) return;
    const w = parseFloat(wager);
    if (w > user.balance) return alert("Insufficient SOL in your Euras Account.");
    
    setStage('MATCHMAKING');
    setMatchFound(false);
    setQueueError(null);
    updateBalance(-w); 

    unsubRef.current = joinQueue('connect4', w, user, (id, oppData) => {
        setOpponent(oppData);
        setMatchFound(true);
        // Delay slightly to allow DB to propagate the active_game doc
        setTimeout(() => {
            setRoomId(id);
            setStage('PLAYING');
        }, 1000);
    }, (err) => {
        console.warn("Queue Error:", err);
        setQueueError(err);
        updateBalance(w); // Refund on error
    });
  };

  useEffect(() => {
    if (roomId && user) {
      const unsub = syncGameState(roomId, (data) => {
        setGameData(data);
        
        // Critical: Only Player 1 initializes the board if it's currently null
        if (data.board === null && data.players[0] === user.id && !initializingRef.current) {
            initializingRef.current = true;
            updateMove(roomId, { 
              board: initBoard(),
              turn: data.players[0] 
            }).finally(() => {
                initializingRef.current = false;
            });
        }

        setIsMyTurn(data.turn === user.id);

        if (data.winner) {
            setStage('GAMEOVER');
            if (data.winner === user.id) {
                const payout = (parseFloat(wager) * 2) * 0.95;
                updateBalance(payout);
            }
        }
      });
      return () => unsub();
    }
  }, [roomId, user?.id]);

  const checkWin = (b: any[][], player: string) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== player) continue;
        for (const [dr, dc] of directions) {
            let count = 1;
            for (let i = 1; i < 4; i++) {
                const nr = r + dr * i;
                const nc = c + dc * i;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && b[nr][nc] === player) count++;
                else break;
            }
            if (count === 4) return true;
        }
      }
    }
    return false;
  };

  const dropPiece = (colIndex: number) => {
    if (!isMyTurn || !gameData?.board || gameData.winner) return;
    const newBoard = JSON.parse(JSON.stringify(gameData.board));
    let placedRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (!newBoard[r][colIndex]) {
            newBoard[r][colIndex] = user!.id;
            placedRow = r;
            break;
        }
    }
    if (placedRow === -1) return;
    const hasWon = checkWin(newBoard, user!.id);
    const oppId = gameData.players.find((id: string) => id !== user!.id);
    updateMove(roomId!, {
        board: newBoard,
        turn: hasWon ? null : oppId,
        winner: hasWon ? user!.id : null
    });
  };

  if (stage === 'WAGER') {
    return (
      <div className="max-w-md mx-auto bg-card-bg border-4 border-gray-800 rounded-[3rem] p-8 text-center mt-10 shadow-card-depth animate-in zoom-in">
        <div className="w-20 h-20 bg-neon-blue/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-neon-blue/20">
            <Grid3X3 size={40} className="text-neon-blue" />
        </div>
        <h2 className="text-4xl font-black italic text-white uppercase mb-2 tracking-tighter leading-none">CYBER CONNECT</h2>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-10 italic">Global PvP High Stakes Arena</p>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] border-2 border-gray-800 mb-8 text-left">
           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Entry Wager (SOL)</label>
           <input type="number" value={wager} onChange={e => setWager(e.target.value)} className="w-full bg-transparent border-none text-white text-4xl font-black focus:outline-none font-mono" />
        </div>
        <button onClick={handleStartMatch} className="w-full bg-neon-blue text-white py-6 rounded-[2rem] font-black text-2xl shadow-pop-blue btn-tactile uppercase italic tracking-tighter flex items-center justify-center gap-3">
            <Search size={24} /> ENTER MATCHMAKING
        </button>
        <button onClick={onBack} className="mt-6 text-gray-600 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors text-center w-full">Return to Lobby</button>
      </div>
    );
  }

  const isFirstPlayer = gameData?.players?.[0] === user?.id;
  const myMascotLabel = isFirstPlayer ? "🦊 SLY FOX" : "🦉 WISE OWL";
  const oppMascotLabel = !isFirstPlayer ? "🦊 SLY FOX" : "🦉 WISE OWL";

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center h-full pb-20">
       <div className="w-full flex justify-between items-center mb-8 px-4">
         <button onClick={() => { if(unsubRef.current) unsubRef.current(); onBack(); }} className="text-gray-500 bg-white/5 p-3 rounded-2xl hover:text-white transition-colors"><ChevronLeft size={24}/></button>
         {(stage === 'PLAYING' || stage === 'GAMEOVER') && (
            <div className="flex gap-4">
                <div className={`flex flex-col items-center gap-1 px-6 py-3 rounded-2xl border-2 transition-all duration-500 ${isMyTurn ? 'bg-neon-blue/20 border-neon-blue shadow-neon-glow scale-105' : 'bg-slate-900 border-gray-800 opacity-40'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-fox-orange overflow-hidden border-2 border-white/20 shadow-lg"><img src={user?.avatar} className="w-full h-full object-cover" /></div>
                        <span className="text-xs font-black uppercase text-white truncate max-w-[80px] leading-none">YOU</span>
                    </div>
                    <span className="text-[8px] font-black text-fox-orange">{myMascotLabel}</span>
                </div>
                <div className={`flex flex-col items-center gap-1 px-6 py-3 rounded-2xl border-2 transition-all duration-500 ${!isMyTurn && gameData?.turn ? 'bg-neon-red/20 border-neon-red shadow-pop-red scale-105' : 'bg-slate-900 border-gray-800 opacity-40'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-700 overflow-hidden border-2 border-white/20 shadow-lg text-center leading-8 text-lg"><img src={opponent?.avatar} className="w-full h-full object-cover" /></div>
                        <span className="text-xs font-black uppercase text-white truncate max-w-[80px] leading-none">{opponent?.username || 'FINDING...'}</span>
                    </div>
                    <span className="text-[8px] font-black text-brand-purple">{oppMascotLabel}</span>
                </div>
            </div>
         )}
       </div>

       {stage === 'MATCHMAKING' ? (
           <div className="flex flex-col items-center justify-center h-[50vh] text-center max-w-sm animate-in fade-in zoom-in">
             <div className="relative mb-10 group">
                <div className="absolute inset-0 bg-neon-blue/20 blur-[60px] rounded-full animate-pulse group-hover:bg-neon-blue/40 transition-colors"></div>
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {queueError ? (
                        <AlertCircle size={100} className="text-neon-red" strokeWidth={1.5} />
                    ) : matchFound ? (
                        <CheckCircle2 size={120} className="text-neon-green animate-in zoom-in" strokeWidth={1.5} />
                    ) : (
                        <><Loader2 size={120} className="text-neon-blue animate-spin absolute" strokeWidth={1.5} /><Target size={48} className="text-white animate-pulse" /></>
                    )}
                </div>
             </div>
             <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                {queueError ? 'SYSTEM ERROR' : matchFound ? 'TARGET ACQUIRED!' : 'SCANNING PACK...'}
             </h3>
             <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-12 flex items-center justify-center gap-2 leading-none">
                {queueError ? queueError : matchFound ? `${opponent.username.toUpperCase()} FOUND` : `SEARCHING FOR ${wager} SOL DUEL`}
             </p>
             {queueError && (
                 <button onClick={() => setStage('WAGER')} className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase italic btn-tactile">RETRY MATCH</button>
             )}
           </div>
       ) : (
           <div className="relative w-full max-w-[500px] animate-in zoom-in duration-500">
              {!gameData?.board ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 font-black uppercase italic tracking-widest bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-gray-800 animate-pulse">
                     <Loader2 className="animate-spin mb-4" /> Syncing Table...
                  </div>
              ) : (
                  <div className="p-4 md:p-6 bg-slate-800 rounded-[3rem] border-[12px] border-slate-900 shadow-2xl overflow-hidden relative">
                     <div className="grid grid-cols-7 gap-3 bg-slate-900/50 p-3 rounded-[2rem] shadow-inner relative z-10">
                        {gameData?.board?.map((row: any[], rIndex: number) => row.map((cell, cIndex) => (
                           <div key={`${rIndex}-${cIndex}`} onClick={() => dropPiece(cIndex)} className={`w-full aspect-square rounded-full bg-[#0a0a0a] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] flex items-center justify-center cursor-pointer relative overflow-hidden group/cell ${!isMyTurn ? 'cursor-not-allowed' : ''}`}>
                               {cell && (
                                   <div className={`absolute inset-1.5 rounded-full border-4 shadow-2xl transition-all duration-700 animate-in slide-in-from-top-10 ${cell === user?.id ? 'bg-gradient-to-br from-blue-400 to-blue-700 border-blue-300/50' : 'bg-gradient-to-br from-red-400 to-red-700 border-red-300/50'}`}>
                                       <div className="absolute top-1 left-2 w-3 h-1.5 bg-white/30 rounded-full blur-[1px]"></div>
                                       <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/20 select-none">
                                          {cell === gameData.players[0] ? "🦊" : "🦉"}
                                       </div>
                                   </div>
                               )}
                               {!cell && isMyTurn && (
                                  <div className="absolute inset-1.5 rounded-full bg-white/5 opacity-0 group-hover/cell:opacity-100 transition-opacity"></div>
                               )}
                           </div>
                        )))}
                     </div>
                  </div>
              )}
              {stage === 'GAMEOVER' && (
                  <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md rounded-[2.5rem] p-10 text-center animate-in fade-in">
                      <Trophy size={100} className={`relative animate-bounce ${gameData.winner === user?.id ? 'text-neon-blue' : 'text-neon-red'}`} />
                      <h2 className="text-7xl font-black italic mb-2 text-white uppercase tracking-tighter">{gameData.winner === user?.id ? 'VICTORY' : 'REKT'}</h2>
                      <div className="text-neon-green text-4xl font-black uppercase mb-12 font-mono tracking-tighter animate-pulse">+ {(parseFloat(wager)*2*0.95).toFixed(2)} SOL</div>
                      <button onClick={onBack} className="bg-white text-black font-black px-16 py-6 rounded-2xl shadow-2xl btn-tactile uppercase italic text-2xl tracking-tighter">BACK TO LOBBY</button>
                  </div>
              )}
           </div>
       )}
    </div>
  );
};

export default ConnectFourGame;