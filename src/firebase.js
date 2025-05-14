import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  // Firebaseコンソールから取得した設定入力した
  apiKey: "AIzaSyDqvtowJu3By1kOj9gdyjWlXdNE8FIXsqU",
  authDomain: "stamp-rally-67b6f.firebaseapp.com",
  projectId: "stamp-rally-67b6f",
  storageBucket: "stamp-rally-67b6f.firebasestorage.app",
  messagingSenderId: "1097131690422",
  appId: "1:1097131690422:web:bc82c9e51633b8d8491917",
  measurementId: "G-43JKL7M7KE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Add this line to define googleProvider
const googleProvider = new GoogleAuthProvider();

// Initialize collections
const rankingCollection = collection(db, 'ranking');
const usersCollection = collection(db, 'users');

// Modify getRanking function to include error handling
export const getRanking = async () => {
  try {
    const q = query(rankingCollection, orderBy('points', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('ランキングの取得に失敗:', error);
    return [];
  }
};

// Add this function to update the ranking for a user
export const updateRanking = async (userId, points, user) => {
  try {
    const rankingDoc = doc(rankingCollection, userId);
    await setDoc(rankingDoc, {
      userId,
      points,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      email: user.email || '',
      stamps: user.stamps || [],
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('ランキングの更新に失敗:', error);
  }
};

// ユーザーデータを更新する関数を追加
export const updateUserData = async (userId, data) => {
  try {
    const userDoc = doc(usersCollection, userId);
    await setDoc(userDoc, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('ユーザーデータの更新に失敗:', error);
  }
};
export { auth, db, googleProvider };