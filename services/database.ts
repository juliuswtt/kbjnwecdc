import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, collection, query, where, getDocs, setDoc, doc, 
  getDoc, Firestore, limit, onSnapshot, deleteDoc, updateDoc,
  Timestamp, initializeFirestore, runTransaction, orderBy, serverTimestamp
} from 'firebase/firestore';
import { User } from '../types';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "", 
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || ""
};

let dbInstance: Firestore | null = null;

const getDb = (): Firestore => {
  if (dbInstance) return dbInstance;
  
  if (!firebaseConfig.apiKey) {
    throw new Error("FIREBASE_NOT_CONFIGURED: Missing VITE_FIREBASE_API_KEY");
  }

  try {
    const apps = getApps();
    const app: FirebaseApp = apps.length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false
    });
    return dbInstance;
  } catch (err: any) {
    console.error("Firebase Init Error:", err);
    throw new Error(`DB_CONNECTION_FAILED: ${err.message}`);
  }
};

export const normalizeKey = (key: string) => {
    if (!key) return "";
    return key.toString().toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
};

export const registerUserInCloud = async (user: User): Promise<User> => {
    const db = getDb();
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, user, { merge: true });
    return user;
};

export const findUserByWallet = async (address: string): Promise<User | null> => {
    const db = getDb();
    const snap = await getDoc(doc(db, 'users', address));
    return snap.exists() ? (snap.data() as User) : null;
};

/**
 * Live Listener for User Data (Balance, Inventory, etc.)
 */
export const listenToUser = (userId: string, onUpdate: (user: User) => void) => {
    const db = getDb();
    return onSnapshot(doc(db, 'users', userId), (snap) => {
        if (snap.exists()) {
            onUpdate(snap.data() as User);
        }
    });
};

/**
 * CLEAN & REAL PVP MATCHMAKING
 * Uses atomic transactions to prevent race conditions.
 * Enforces strict timestamp checks to avoid matching with offline players.
 */
export const joinQueue = (
    gameId: string, 
    wager: number, 
    user: User, 
    onMatch: (roomId: string, opponent: any) => void,
    onError: (err: string) => void
) => {
    const db = getDb();
    let isUnsubscribed = false;
    let unsubRoomListener: (() => void) | null = null;
    const myQueueRef = doc(db, 'queues', user.id);

    const startMatchmaking = async () => {
        try {
            // 1. Remove any old stale entry of mine first
            await deleteDoc(myQueueRef).catch(() => {});

            const numericWager = Number(wager);
            const cutoff = new Date(Date.now() - 90000); // 90 seconds ago

            // Fetch potential candidates first (queries are not allowed inside Firestore transactions)
            const q = query(
                collection(db, 'queues'),
                where("gameId", "==", gameId),
                where("wager", "==", numericWager),
                where("joinedAt", ">", Timestamp.fromDate(cutoff)),
                orderBy("joinedAt", "asc"),
                limit(10)
            );
            
            const snap = await getDocs(q);
            const opponentDoc = snap.docs.find(d => d.id !== user.id);

            await runTransaction(db, async (transaction) => {
                if (opponentDoc) {
                    const oppRef = doc(db, 'queues', opponentDoc.id);
                    const oppSnap = await transaction.get(oppRef);

                    // Verify opponent is still in the queue (not grabbed by someone else)
                    if (oppSnap.exists()) {
                        const opponent = oppSnap.data();
                        const opponentId = opponent.userId;
                        
                        // Deterministic Room ID
                        const ids = [user.id, opponentId].sort();
                        const roomId = `room_${gameId}_${ids[0]}_${ids[1]}`;

                        // Atomically remove opponent from queue
                        transaction.delete(oppRef);

                        // Create the active game session
                        const gameRef = doc(db, 'active_games', roomId);
                        transaction.set(gameRef, {
                            gameId,
                            wager: numericWager,
                            players: ids,
                            playerData: {
                                [user.id]: { username: user.username, avatar: user.avatar },
                                [opponentId]: { username: opponent.username, avatar: opponent.avatar }
                            },
                            state: 'ACTIVE',
                            turn: ids[0], 
                            board: null,
                            winner: null,
                            lastMoveAt: serverTimestamp(),
                            createdAt: serverTimestamp()
                        }, { merge: true });
                    } else {
                        // Opponent was snatched! Put ourselves in the queue instead.
                        transaction.set(myQueueRef, {
                            userId: user.id,
                            username: user.username,
                            avatar: user.avatar,
                            gameId,
                            wager: numericWager,
                            joinedAt: serverTimestamp()
                        });
                    }
                } else {
                    // No valid opponent found: Put myself in the queue
                    transaction.set(myQueueRef, {
                        userId: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        gameId,
                        wager: numericWager,
                        joinedAt: serverTimestamp()
                    });
                }
            });

            // 3. Listen for the Game Creation
            const qGames = query(
                collection(db, 'active_games'), 
                where("players", "array-contains", user.id),
                where("state", "==", "ACTIVE"),
                limit(1)
            );

            unsubRoomListener = onSnapshot(qGames, (snapshot) => {
                if (isUnsubscribed) return;
                
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || (change.type === "modified" && change.doc.data().state === 'ACTIVE')) {
                        const data = change.doc.data();
                        if (data.gameId === gameId) {
                            const oppId = data.players.find((id: string) => id !== user.id);
                            if (oppId && data.playerData[oppId]) {
                                // Match Confirmed!
                                deleteDoc(myQueueRef).catch(() => {});
                                if (unsubRoomListener) {
                                    unsubRoomListener();
                                    unsubRoomListener = null;
                                }
                                onMatch(change.doc.id, data.playerData[oppId]);
                            }
                        }
                    }
                });
            });

        } catch (err: any) {
            console.error("Matchmaking failed:", err);
            onError("Connection failed. Please try again.");
            deleteDoc(myQueueRef).catch(() => {});
        }
    };

    startMatchmaking();

    return () => {
        isUnsubscribed = true;
        if (unsubRoomListener) unsubRoomListener();
        deleteDoc(myQueueRef).catch(() => {});
    };
};

export const syncGameState = (roomId: string, onUpdate: (data: any) => void) => {
    return onSnapshot(doc(getDb(), 'active_games', roomId), (doc) => {
        if (doc.exists()) onUpdate(doc.data());
    });
};

export const updateMove = async (roomId: string, nextState: any) => {
    await updateDoc(doc(getDb(), 'active_games', roomId), nextState);
};

export const loginWithEurasKeys = async (profileKey: string, securityKey: string): Promise<User | null> => {
    const db = getDb();
    const q = query(collection(db, 'users'), 
        where("profileKey", "==", normalizeKey(profileKey)), 
        where("securityKey", "==", normalizeKey(securityKey)),
        limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as User);
};