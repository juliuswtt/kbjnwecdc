import React, { useState, useEffect } from 'react';
import { ViewState, User, ConnectedWallet } from './types';
import Lobby from './views/Lobby';
import TexasHoldemGame from './views/TexasHoldemGame';
import ConnectFourGame from './views/ConnectFourGame';
import MarketRoyaleGame from './views/MarketRoyaleGame';
import LudoGame from './views/LudoGame';
import MauMauGame from './views/MauMauGame';
import EurasEstateGame from './views/EurasEstateGame';
import MiamiTycoonGame from './views/MiamiTycoonGame';
import UnemploymentSimulator from './views/UnemploymentSimulator';
import IslandExplorerGame from './views/IslandExplorerGame';
import NarcoFoxGame from './views/NarcoFoxGame';
import VegasDegenerateGame from './views/VegasDegenerateGame';
import Leaderboard from './views/Leaderboard';
import AmbassadorView from './views/PartnershipAmbassador';
import AffiliateView from './views/PartnershipAffiliate';
import CreatorView from './views/PartnershipCreator';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import VaultView from './views/VaultView';
import MyPackView from './views/MyPackView';
import ProfileSettings from './views/ProfileSettings';
import BankModal from './components/BankModal';
import { connectHardwareWallet } from './services/solana';
import { loginWithEurasKeys, registerUserInCloud, findUserByWallet, normalizeKey, listenToUser } from './services/database';
import { Wallet, Trophy, Flame, MessageSquare, Send, ShieldAlert, ArrowUp, Key, Lock, Loader2, AlertCircle, CloudCheck, FlaskConical } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOBBY);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isKeyLoginOpen, setIsKeyLoginOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginKeys, setLoginKeys] = useState({ profile: '', security: '' });

  const generateKey = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  };

  // Initial load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('euras_active_user');
    if (saved) {
      try {
        const parsedUser = JSON.parse(saved);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('euras_active_user');
      }
    }
  }, []);

  // REAL-TIME CLOUD SYNC: Always listen to the user doc once logged in
  useEffect(() => {
    if (user?.id) {
      const unsubscribe = listenToUser(user.id, (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem('euras_active_user', JSON.stringify(updatedUser));
      });
      return () => unsubscribe();
    }
  }, [user?.id]);

  const handleConnectWallet = async (provider: 'Phantom' | 'Solflare') => {
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      const walletAddress = await connectHardwareWallet();
      if (walletAddress) {
        const existingUser = await findUserByWallet(walletAddress);
        if (existingUser) {
            setUser(existingUser);
            setIsWalletModalOpen(false);
        } else {
            const newUser: User = {
                id: walletAddress,
                username: `Wolf ${Math.floor(Math.random() * 9000) + 1000}`,
                profileKey: generateKey(16),
                securityKey: generateKey(10),
                wallets: [{ address: walletAddress, provider, addedAt: Date.now() }],
                activeWallet: walletAddress,
                balance: 0.0,
                avatar: `https://api.dicebear.com/7.x/big-smile/svg?seed=${walletAddress}`,
                ownedItemIds: [],
                equipped: { pfp: null, effect: null, emotes: [] }
            };
            const synced = await registerUserInCloud(newUser);
            setUser(synced);
            setIsWalletModalOpen(false);
        }
      }
    } catch (error: any) {
      alert(`WALLET ERROR: ${error.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKeyLogin = async () => {
    if (!loginKeys.profile || !loginKeys.security) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
        const cloudUser = await loginWithEurasKeys(loginKeys.profile, loginKeys.security);
        if (cloudUser) {
            setUser(cloudUser);
            setIsKeyLoginOpen(false);
            setLoginKeys({ profile: '', security: '' });
        } else {
            setLoginError("KEYS INVALID OR ACCOUNT NOT FOUND.");
        }
    } catch (err: any) {
        console.error(err);
        setLoginError(err.message || "CONNECTION ERROR.");
    } finally {
        setIsLoggingIn(false);
    }
  };

  const updateBalance = (amount: number) => {
    if (user) {
      const updated = { ...user, balance: Math.round((user.balance + amount) * 1000) / 1000 };
      // Local set for immediate UI responsiveness, but listenToUser will provide the "truth"
      setUser(updated);
      registerUserInCloud(updated).catch(e => console.warn("Sync failed:", e));
    }
  };

  const renderView = () => {
    const isGame = [
        ViewState.GAME_POKER, ViewState.GAME_CONNECT4, ViewState.GAME_MARKET, 
        ViewState.GAME_LUDO, ViewState.GAME_MAUMAU, ViewState.GAME_ESTATE,
        ViewState.GAME_TYCOON, ViewState.GAME_NARCO, ViewState.GAME_VEGAS,
        ViewState.GAME_EPSTEIN
    ].includes(currentView);

    if (isGame && !user) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center px-6 animate-in fade-in">
                <div className="w-24 h-24 bg-fox-orange/10 rounded-[2.5rem] border-4 border-fox-orange flex items-center justify-center mb-8 shadow-pop-orange">
                    <ShieldAlert size={48} className="text-fox-orange" />
                </div>
                <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter mb-4 leading-none">Access Denied</h2>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-10 max-w-xs leading-relaxed">
                    Connect your wallet or use your Euras Keys to join the high-stakes arena.
                </p>
                <div className="flex flex-col gap-4">
                   <button onClick={() => setIsWalletModalOpen(true)} className="bg-white text-black font-black px-12 py-5 rounded-2xl shadow-2xl uppercase italic tracking-tighter text-xl btn-tactile">Connect Wallet</button>
                   <button onClick={() => setIsKeyLoginOpen(true)} className="text-gray-500 font-black uppercase text-[10px] tracking-widest hover:text-white flex items-center justify-center gap-2 transition-colors"><Key size={14}/> or Login with Keys</button>
                </div>
            </div>
        );
    }

    switch (currentView) {
      case ViewState.LOBBY: return <Lobby searchQuery={searchQuery} onChangeView={setCurrentView} />;
      case ViewState.GAME_POKER: return <TexasHoldemGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_CONNECT4: return <ConnectFourGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_MARKET: return <MarketRoyaleGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_LUDO: return <LudoGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_MAUMAU: return <MauMauGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_ESTATE: return <EurasEstateGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_TYCOON: return <MiamiTycoonGame user={user} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_NARCO: return <NarcoFoxGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_VEGAS: return <VegasDegenerateGame user={user} updateBalance={updateBalance} onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_EPSTEIN: return <IslandExplorerGame onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.GAME_UNEMPLOYMENT: return <UnemploymentSimulator onBack={() => setCurrentView(ViewState.LOBBY)} />;
      case ViewState.LEADERBOARD: return <Leaderboard />;
      case ViewState.PARTNER_AMBASSADOR: return <AmbassadorView />;
      case ViewState.PARTNER_AFFILIATE: return <AffiliateView user={user} />;
      case ViewState.PARTNER_CREATOR: return <CreatorView />;
      case ViewState.VAULT: return <VaultView user={user} onPurchase={() => true} />;
      case ViewState.MY_PACK: return <MyPackView user={user} onEquip={() => {}} />;
      case ViewState.PROFILE_SETTINGS: return <ProfileSettings user={user} onRemoveWallet={() => {}} onConnectNew={() => setIsWalletModalOpen(true)} />;
      default: return <Lobby searchQuery={searchQuery} onChangeView={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-deep-black text-white overflow-hidden selection:bg-neon-blue selection:text-black font-sans">
      <div className="hidden md:flex w-64 flex-col border-r border-gray-800 bg-card-bg z-20">
        <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <Header user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onConnect={() => setIsWalletModalOpen(true)} onOpenBank={() => setIsBankModalOpen(true)} liveFeed={[]} onChangeView={setCurrentView} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
          {renderView()}
        </main>
        <button className="fixed bottom-6 right-6 w-14 h-14 bg-fox-orange rounded-full flex items-center justify-center shadow-pop-orange z-30 animate-float"><MessageSquare size={24} /></button>
      </div>

      {isWalletModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card-bg border-4 border-gray-800 rounded-[3rem] p-8 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsWalletModalOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white">✕</button>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter">Enter the <span className="text-fox-orange">Den</span></h2>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Connect your Solana Wallet</p>
            </div>
            <div className="space-y-3">
              <button disabled={isLoggingIn} onClick={() => handleConnectWallet('Phantom')} className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 border-2 border-gray-700 p-5 rounded-2xl transition-all btn-tactile disabled:opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#AB9FF2] flex items-center justify-center font-black">P</div>
                  <span className="font-black uppercase tracking-tight">Phantom</span>
                </div>
                {isLoggingIn ? <Loader2 size={16} className="animate-spin" /> : <div className="text-[10px] font-black text-gray-500 uppercase">Solana</div>}
              </button>
              
              <button disabled={isLoggingIn} onClick={() => handleConnectWallet('Solflare')} className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 border-2 border-gray-700 p-5 rounded-2xl transition-all btn-tactile disabled:opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FC7226] flex items-center justify-center font-black">S</div>
                  <span className="font-black uppercase tracking-tight">Solflare</span>
                </div>
                {isLoggingIn ? <Loader2 size={16} className="animate-spin" /> : <div className="text-[10px] font-black text-gray-500 uppercase">Solana</div>}
              </button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-800 text-center">
                <button onClick={() => { setIsWalletModalOpen(false); setIsKeyLoginOpen(true); }} className="text-gray-500 font-black uppercase text-[10px] tracking-widest hover:text-fox-orange transition-colors">Already have a Den? Login with Keys</button>
            </div>
          </div>
        </div>
      )}

      {isKeyLoginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in">
           <div className="bg-card-bg border-4 border-fox-orange rounded-[3rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden">
              <button onClick={() => setIsKeyLoginOpen(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white">✕</button>
              <div className="text-center mb-10">
                 <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">Login with Keys</h2>
                 <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Restore your Den via Cloud Sync</p>
              </div>
              <div className="space-y-6 mb-10">
                 <div className={`bg-slate-950 p-4 rounded-2xl border-2 transition-colors ${loginError ? 'border-neon-red/50' : 'border-gray-800 focus-within:border-fox-orange'}`}>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2 tracking-widest">Profile Key</label>
                    <input type="text" value={loginKeys.profile} disabled={isLoggingIn} onChange={e => setLoginKeys({...loginKeys, profile: e.target.value.toUpperCase()})} className="w-full bg-transparent border-none text-white font-mono text-xl focus:outline-none placeholder:opacity-10" placeholder="XXXX-XXXX-XXXX-XXXX" />
                 </div>
                 <div className={`bg-slate-950 p-4 rounded-2xl border-2 transition-colors ${loginError ? 'border-neon-red/50' : 'border-gray-800 focus-within:border-fox-orange'}`}>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-2 tracking-widest">Security Key</label>
                    <input type="password" value={loginKeys.security} disabled={isLoggingIn} onChange={e => setLoginKeys({...loginKeys, security: e.target.value.toUpperCase()})} className="w-full bg-transparent border-none text-white font-mono text-xl focus:outline-none placeholder:opacity-10" placeholder="XXXXXXXXXX" />
                 </div>
                 {loginError && (
                     <div className="flex items-center gap-2 text-neon-red text-[10px] font-black uppercase italic animate-in slide-in-from-top-2">
                        <AlertCircle size={14} /> <span className="break-words">{loginError}</span>
                     </div>
                 )}
              </div>
              <button onClick={handleKeyLogin} disabled={isLoggingIn} className="w-full bg-fox-orange text-white py-5 rounded-2xl font-black text-xl italic uppercase shadow-pop-orange btn-tactile flex items-center justify-center gap-3 disabled:opacity-50">
                {isLoggingIn ? <><Loader2 className="animate-spin" /> SYNCING...</> : 'LOGIN'}
              </button>
           </div>
        </div>
      )}

      {isBankModalOpen && user && <BankModal user={user} onClose={() => setIsBankModalOpen(false)} onUpdateBalance={updateBalance} />}
    </div>
  );
};

export default App;