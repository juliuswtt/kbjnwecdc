
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { recipient, amount, secret } = req.body;

  // Security Verification via Env Var
  const AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET;
  if (!AUTH_SECRET || secret !== AUTH_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized Access' });
  }

  if (!recipient || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid payout parameters' });
  }

  try {
    const heliusKey = process.env.HELIUS_API_KEY;
    const rpcUrl = heliusKey 
        ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
        : "https://api.mainnet-beta.solana.com";
    
    const connection = new web3.Connection(rpcUrl, 'confirmed');

    const privateKeyString = process.env.MASTER_KEY;
    if (!privateKeyString) {
      throw new Error("CONFIG_ERROR");
    }

    const secretKey = bs58.decode(privateKeyString);
    const masterAccount = web3.Keypair.fromSecretKey(secretKey);

    const toPubkey = new web3.PublicKey(recipient);
    const lamports = Math.floor(amount * web3.LAMPORTS_PER_SOL);

    const balance = await connection.getBalance(masterAccount.publicKey);
    if (balance < lamports) {
        return res.status(400).json({ success: false, message: 'Vault empty.' });
    }

    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: masterAccount.publicKey,
        toPubkey: toPubkey,
        lamports: lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = masterAccount.publicKey;

    const signature = await web3.sendAndConfirmTransaction(
      connection, 
      transaction, 
      [masterAccount],
      { commitment: 'confirmed' }
    );

    return res.status(200).json({ 
      success: true, 
      signature,
      message: `Authorized.`
    });

  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      message: "Failure" 
    });
  }
}
