import * as solanaWeb3 from '@solana/web3.js';
import { MASTER_WALLET_ADDRESS } from '../constants';

const HELIUS_API_KEY = (import.meta as any).env?.VITE_HELIUS_API_KEY || "";
const HELIUS_RPC_URL = HELIUS_API_KEY 
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : "https://api.mainnet-beta.solana.com";

const getSafeConnection = async () => {
  return new solanaWeb3.Connection(HELIUS_RPC_URL, { 
    commitment: "confirmed"
  });
};

const getProvider = () => {
  if (typeof window === 'undefined') return null;
  const anyWin = window as any;
  if (anyWin.phantom?.solana) return anyWin.phantom.solana;
  if (anyWin.solflare?.isSolflare) return anyWin.solflare;
  if (anyWin.solana) return anyWin.solana;
  return null;
};

export const connectHardwareWallet = async () => {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const resp = await provider.connect();
    return resp.publicKey.toString();
  } catch (err: any) {
    return null;
  }
};

export const requestDeposit = async (amount: number, userAddress: string) => {
  if (!MASTER_WALLET_ADDRESS || MASTER_WALLET_ADDRESS.length < 32) {
      throw new Error("MASTER_WALLET_ADDRESS is missing or invalid.");
  }

  const provider = getProvider();
  if (!provider) return { success: false, error: "Wallet provider not detected." };

  try {
    const connection = await getSafeConnection();
    const fromPubkey = new solanaWeb3.PublicKey(userAddress);
    const toPubkey = new solanaWeb3.PublicKey(MASTER_WALLET_ADDRESS);
    const lamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);

    // Check actual wallet balance before attempting transfer
    const walletBalance = await connection.getBalance(fromPubkey);
    if (walletBalance < lamports) {
        return { success: false, error: "Insufficient SOL in your wallet for this transaction." };
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const { signature } = await provider.signAndSendTransaction(transaction);
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

    return { success: true, signature };
  } catch (err: any) {
    console.error("Deposit Failure:", err);
    let msg = "Transaction Failed.";
    if (err.message?.includes('User rejected')) msg = "Transaction rejected by user.";
    if (err.message?.includes('insufficient funds')) msg = "Insufficient SOL in your wallet.";
    return { success: false, error: msg };
  }
};

export const triggerMasterPayout = async (targetAddress: string, amount: number): Promise<{ success: boolean; txid?: string; error?: string }> => {
  if (!MASTER_WALLET_ADDRESS || MASTER_WALLET_ADDRESS.length < 32) {
    throw new Error("MASTER_WALLET_ADDRESS is not configured.");
  }

  try {
    const response = await fetch('/api/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: targetAddress,
        amount: amount,
        secret: (import.meta as any).env?.VITE_INTERNAL_AUTH_SECRET || "" 
      })
    });

    const data = await response.json();
    if (data.success) {
      return { success: true, txid: data.signature };
    } else {
      return { success: false, error: data.message };
    }
  } catch (err: any) {
    return { success: false, error: "Euras Bank server connection failed." };
  }
};