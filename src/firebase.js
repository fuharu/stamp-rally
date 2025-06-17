import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebaseの設定
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

// Firestore のコレクションへの参照をエクスポート
export const stampPointsCollection = collection(db, 'stampPoints');

// ランキング取得（REST API版）
export const getRanking = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/ranking');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('ランキングの取得に失敗:', error);
    return [];
  }
};

// ランキング更新（REST API版）
export const updateRanking = async (userId, points, user) => {
  try {
    await fetch('http://localhost:3001/api/ranking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        points,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        email: user.email || '',
        stamps: user.stamps || []
      })
    });
  } catch (error) {
    console.error('ランキングの更新に失敗:', error);
  }
};

// ユーザーデータ更新（REST API版）
export const updateUserData = async (userId, data) => {
  try {
    await fetch('http://localhost:3001/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        stamps: data.stamps || [],
        points: data.points || 0,
        totalDistance: data.totalDistance || 0,
        steps: data.steps || 0
      })
    });
  } catch (error) {
    console.error('ユーザーデータの更新に失敗:', error);
  }
};

export { auth, db, googleProvider };
