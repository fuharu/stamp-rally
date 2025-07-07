import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Firebaseの設定
const firebaseConfig = {
  // Firebaseコンソールから取得した設定入力した
  apiKey: "AIzaSyDqvtowJu3By1kOj9gdyjWlXdNE8FIXsqU",
  authDomain: "stamp-rally-67b6f.firebaseapp.com",
  projectId: "stamp-rally-67b6f",
  storageBucket: "stamp-rally-67b6f.appspot.com",
  messagingSenderId: "1097131690422",
  appId: "1:1097131690422:web:bc82c9e51633b8d8491917",
  measurementId: "G-43JKL7M7KE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Firestoreの初期化
export const db = getFirestore(app);
export const storage = getStorage(app);

// Add this line to define googleProvider
const googleProvider = new GoogleAuthProvider();

// AIスタンプ画像をStorageにアップロードし、履歴をFirestoreに保存
export const saveAIStampToFirebase = async ({ regionName, imageData, userId }) => {
  try {
    // 画像をStorageにアップロード
    const fileName = `ai_stamps/${userId}/${regionName}_${Date.now()}.png`;
    const imageRef = ref(storage, fileName);
    // imageDataはdataURL形式（data:image/png;base64,...）
    await uploadString(imageRef, imageData, 'data_url');
    const downloadURL = await getDownloadURL(imageRef);

    // Firestoreに履歴を保存
    const docRef = await addDoc(collection(db, 'ai_stamp_history'), {
      userId,
      regionName,
      imageUrl: downloadURL,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, regionName, imageUrl: downloadURL, userId };
  } catch (error) {
    console.error('AIスタンプのFirebase保存に失敗:', error);
    throw error;
  }
};

// FirestoreからAIスタンプ履歴を取得
export const getAIStampHistory = async (userId) => {
  try {
    const q = query(collection(db, 'ai_stamp_history'), orderBy('timestamp', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.userId === userId);
  } catch (error) {
    console.error('AIスタンプ履歴の取得に失敗:', error);
    return [];
  }
};

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

// ユーザーデータ更新（Firestore直接版）
export const updateUserData = async (userId, data) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      stamps: data.stamps || [],
      points: data.points || 0,
      totalDistance: data.totalDistance || 0,
      steps: data.steps || 0
    }, { merge: true });
  } catch (error) {
    console.error('ユーザーデータの更新に失敗:', error);
  }
};

export { auth, googleProvider };
