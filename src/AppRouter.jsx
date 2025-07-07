import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getFirestore, doc, setDoc, increment, collection, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateUserData } from './firebase';
import App from './App';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import StampRallyPage from './pages/StampRallyPage';
import ActivityPage from './pages/ActivityPage';
import LoginPage from './pages/LoginPage';
import RankingPage from './pages/RankingPage';
import AIStampPage from './pages/AIStampPage';
import AIStampGalleryPage from './pages/AIStampGalleryPage';
import AIStampGalleryDetailPage from './pages/AIStampGalleryDetailPage';
import { Profile } from './components/Profile';
import { LocationProvider } from './contexts/LocationContext';

const center = { lat: 35.6895, lng: 139.6917 };

// ページコンテナのスタイル
const pageContainerStyle = {
  padding: '24px',
  maxWidth: '1200px',
  margin: '0 auto',
  minHeight: 'calc(100vh - 64px)'
};

function AppRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [totalDistance, setTotalDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gotStamps, setGotStamps] = useState(() => {
    try {
      const saved = localStorage.getItem('gotStamps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [page, setPage] = useState('stamp');
  const [ranking, setRanking] = useState([]);
  const [goalId, setGoalId] = useState(null);
  const [currentUserProgress, setCurrentUserProgress] = useState(null);

  const navigate = useNavigate();
  const db = getFirestore();

  const { isLoaded } = useGoogleMaps();

  const handleMarkerClick = (id) => {
    setSelected(String(id));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        console.log('fetchRanking called, user:', user); // デバッグ用
        
        // Firebaseから直接ランキングデータを取得
        const usersCol = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCol);
        
        const usersData = usersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            userId: doc.id,
            displayName: data.displayName || data.displayname || data.email?.split('@')[0] || 'ゲスト',
            displayname: data.displayname || '',
            email: data.email || '',
            photoURL: data.photoURL,
            points: typeof data.points === 'number' ? data.points : Number(data.points) || 0,
            stamps: data.stamps || [],
            totalDistance: data.totalDistance || 0,
            steps: data.steps || 0,
            updatedAt: data.updatedAt || data.createdAt || new Date()
          };
        });
        
        // ポイントでソート（降順）
        const sortedRanking = usersData.sort((a, b) => b.points - a.points);
        
        console.log('Firebase ranking data:', sortedRanking); // デバッグ用
        setRanking(sortedRanking);
        
        // ユーザーがログインしている場合のみ現在のユーザーデータを設定
        if (user) {
          const currentUserData = sortedRanking.find(rankUser => rankUser.userId === user.uid);
          if (currentUserData) {
            setCurrentUserProgress(currentUserData);
            setGotStamps(currentUserData.stamps || []);
          } else {
            // ユーザーがランキングに存在しない場合は新規作成
            const newUserData = {
              userId: user.uid,
              displayName: user.displayName || user.email?.split('@')[0] || 'ゲスト',
              email: user.email,
              photoURL: user.photoURL,
              points: 0,
              stamps: [],
              totalDistance: 0,
              steps: 0,
              updatedAt: new Date()
            };
            setCurrentUserProgress(newUserData);
            setGotStamps([]);
            
            // 新規ユーザーをFirestoreに作成
            await setDoc(doc(db, 'users', user.uid), {
              ...newUserData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error('Firebaseランキングの取得に失敗:', error);
        setRanking([]);
        setCurrentUserProgress(null);
      }
    };
    fetchRanking();
  }, [user, db]);

  // 現在地取得
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation APIがサポートされていません');
      return;
    }

    console.log('位置情報の取得を開始します');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos && pos.coords) {
          console.log('位置情報を取得:', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
          
          setCurrentPos({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setGeoError(null); // エラーをクリア
        } else {
          console.error('位置情報の形式が不正です:', pos);
          setGeoError('位置情報の形式が不正です');
        }
      },
      (err) => {
        console.error('位置情報の取得エラー:', err);
        let msg = '位置情報の取得に失敗しました';
        if (err.code === 1) msg += '（許可されていません）';
        if (err.code === 2) msg += '（位置情報が利用できません）';
        if (err.code === 3) msg += '（タイムアウト）';
        setGeoError(msg);
        setCurrentPos(null); // エラー時は現在地をクリア
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      console.log('位置情報の監視を停止');
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleGetStamp = async (id) => {
    console.log('handleGetStamp called with id:', id);
    console.log('Current gotStamps:', gotStamps);
    
    if (!gotStamps.includes(id)) {
      try {
        // 新しい配列を作成
        const updated = [...gotStamps, id];
        console.log('Updated gotStamps:', updated);
        
        // 状態を更新
        setGotStamps(updated);
        
        // ローカルストレージに保存
        localStorage.setItem('gotStamps', JSON.stringify(updated));
        console.log('Saved to localStorage:', updated);

        // スタンプ取得日時を記録
        const acquiredAt = new Date().toISOString();
        localStorage.setItem(`stamp_${id}_acquiredAt`, acquiredAt);

        // ユーザーデータの更新
        if (user) {
          // ポイント計算を時間ベースで制限
          const points = calculateLocationBasedPoints(updated);
          await updateUserData(user.uid, {
            stamps: updated,
            points,
            totalDistance,
            steps
          });
          console.log('User data updated successfully');

          setCurrentUserProgress(prev => ({
            ...prev,
            stamps: updated,
            points: points,
          }));
          
          // ランキングデータを再取得
          setTimeout(() => {
            const fetchRanking = async () => {
              try {
                const usersCol = collection(db, 'users');
                const usersSnapshot = await getDocs(usersCol);
                
                const usersData = usersSnapshot.docs.map(doc => {
                  const data = doc.data();
                  return {
                    userId: doc.id,
                    displayName: data.displayName || data.displayname || data.email?.split('@')[0] || 'ゲスト',
                    displayname: data.displayname || '',
                    email: data.email || '',
                    photoURL: data.photoURL,
                    points: typeof data.points === 'number' ? data.points : Number(data.points) || 0,
                    stamps: data.stamps || [],
                    totalDistance: data.totalDistance || 0,
                    steps: data.steps || 0,
                    updatedAt: data.updatedAt || data.createdAt || new Date()
                  };
                });
                
                const sortedRanking = usersData.sort((a, b) => b.points - a.points);
                setRanking(sortedRanking);
              } catch (error) {
                console.error('ランキング再取得エラー:', error);
              }
            };
            fetchRanking();
          }, 1000);
        }
      } catch (error) {
        console.error('スタンプ取得処理でエラーが発生:', error);
      }
    } else {
      console.log('Stamp already exists:', id);
    }
    
    // 選択状態をリセット
    setSelected(null);
  };

  // 位置ベースのポイント計算関数
  const calculateLocationBasedPoints = (stampIds) => {
    // 全スタンプデータを取得（公式・カスタム両方）
    const allStamps = [...officialStamps, ...customStamps];
    
    // 取得済みスタンプの位置情報を収集
    const acquiredStamps = allStamps.filter(stamp => 
      stampIds.includes(stamp.id)
    );
    
    // 位置ごとにグループ化（100m以内を同じ場所とみなす）
    const locationGroups = new Map();
    
    acquiredStamps.forEach(stamp => {
      if (!stamp.position) return;
      
      const locationKey = getLocationKey(stamp.position);
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      locationGroups.get(locationKey).push(stamp);
    });
    
    // 各位置グループから3日おきにポイントを計算
    let totalPoints = 0;
    locationGroups.forEach((stampsInLocation, locationKey) => {
      // 3日おきのポイント計算
      const pointsForLocation = calculateTimeBasedPoints(stampsInLocation);
      totalPoints += pointsForLocation;
      console.log(`位置 ${locationKey}: ${stampsInLocation.length}個のスタンプ、ポイント: ${pointsForLocation}`);
    });
    
    return totalPoints;
  };

  // 時間ベースのポイント計算関数（3日おき）
  const calculateTimeBasedPoints = (stampsInLocation) => {
    if (stampsInLocation.length === 0) return 0;
    
    // スタンプを取得日時でソート（新しい順）
    const sortedStamps = stampsInLocation.sort((a, b) => {
      const dateA = getStampAcquiredDate(a.id);
      const dateB = getStampAcquiredDate(b.id);
      return dateB - dateA;
    });
    
    let totalPoints = 0;
    let lastPointDate = null;
    
    sortedStamps.forEach((stamp, index) => {
      const stampDate = getStampAcquiredDate(stamp.id);
      
      if (index === 0) {
        // 最初のスタンプは必ずポイント獲得
        totalPoints += 5;
        lastPointDate = stampDate;
        console.log(`最初のスタンプ: ${stamp.name || stamp.regionName} - ポイント獲得`);
      } else {
        // 2つ目以降は3日経過しているかチェック
        const daysDiff = (lastPointDate - stampDate) / (1000 * 60 * 60 * 24);
        
        if (daysDiff >= 3) {
          totalPoints += 5;
          lastPointDate = stampDate;
          console.log(`${stamp.name || stamp.regionName}: 3日経過 - ポイント獲得`);
        } else {
          console.log(`${stamp.name || stamp.regionName}: 3日未経過 - ポイントなし (${daysDiff.toFixed(1)}日)`);
        }
      }
    });
    
    return totalPoints;
  };

  // スタンプの取得日時を取得する関数
  const getStampAcquiredDate = (stampId) => {
    const acquiredAt = localStorage.getItem(`stamp_${stampId}_acquiredAt`);
    return acquiredAt ? new Date(acquiredAt) : new Date();
  };

  // 位置をキー化する関数（100m以内を同じ場所とみなす）
  const getLocationKey = (position) => {
    if (!position || !position.lat || !position.lng) return 'unknown';
    
    // 座標を100m単位で丸める（約0.001度 = 約100m）
    const lat = Math.round(position.lat * 1000) / 1000;
    const lng = Math.round(position.lng * 1000) / 1000;
    
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
  };

  const handleRemoveStamp = async (id) => {
    console.log('handleRemoveStamp called with id:', id);
    console.log('Current gotStamps:', gotStamps);
    
    if (gotStamps.includes(id)) {
      try {
        // スタンプを削除した新しい配列を作成
        const updated = gotStamps.filter(stampId => stampId !== id);
        console.log('Updated gotStamps:', updated);
        
        // 状態を更新
        setGotStamps(updated);
        
        // ローカルストレージに保存
        localStorage.setItem('gotStamps', JSON.stringify(updated));
        console.log('Saved to localStorage:', updated);

        // ユーザーデータの更新
        if (user) {
          const points = updated.length * 5;
          await updateUserData(user.uid, {
            stamps: updated,
            points,
            totalDistance,
            steps
          });
          console.log('User data updated successfully');

          setCurrentUserProgress(prev => ({
            ...prev,
            stamps: updated,
            points: points,
          }));
        }
      } catch (error) {
        console.error('スタンプ解除処理でエラーが発生:', error);
      }
    } else {
      console.log('Stamp does not exist:', id);
    }
    
    // 選択状態をリセット
    setSelected(null);
  };

  const shareProgress = async (message = '') => {
    try {
      const shareData = {
        title: 'スタンプラリーの進捗状況',
        text: `${message}\n現在のポイント: ${gotStamps.length * 5}\n取得したスタンプ数: ${gotStamps.length}個`,
        url: window.location.href
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        const textToCopy = `${shareData.text}\n\n${shareData.url}`;
        await navigator.clipboard.writeText(textToCopy);
        alert('進捗状況がコピーされました！');
      }
    } catch (error) {
      console.error('共有に失敗しました:', error);
      alert('共有に失敗しました。手動でコピーしてください。');
    }
  };

  const handleSetGoal = (id) => {
    setGoalId(id);
    setSelected(id);
  };

  const handleClearGoal = () => {
    setGoalId(null);
  };

  const handlePointsUpdate = (newPoints) => {
    setCurrentUserProgress(prev => ({
      ...prev,
      points: newPoints
    }));
  };

  // スタンプ取得時の更新処理
  const handleStampUpdate = (updatedStamps) => {
    setGotStamps(updatedStamps);
  };

  // ユーザーデータ更新関数を改善
  const updateUserData = async (userId, userData) => {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        ...userData,
        updatedAt: serverTimestamp()
      };
      
      // ユーザー情報も含めて更新
      if (user) {
        updateData.displayName = user.displayName || '';
        updateData.photoURL = user.photoURL || '';
        updateData.email = user.email || '';
      }
      
      await updateDoc(userRef, updateData);
      console.log('ユーザーデータ更新完了:', updateData);
      
      // ランキングデータも更新
      await updateRanking(userId, userData.points || 0, user);
      
    } catch (error) {
      console.error('ユーザーデータ更新エラー:', error);
    }
  };

  if (loading) return null; 

  return (
    <LocationProvider>
      <div style={{ minHeight: '100vh', background: '#f7f9fb', display: 'flex', flexDirection: 'column' }}>
        {/* ユーザアイコン（右上固定） */}
        <Profile user={user} showProfile={showProfile} setShowProfile={setShowProfile} />
        {/* ヘッダー */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 64, background: '#1976d2', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={() => { setPage('stamp'); navigate('/stamp'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: page === 'stamp' ? '2px solid #1976d2' : '2px solid #1976d2',
                background: page === 'stamp' ? '#1976d2' : '#fff',
                color: page === 'stamp' ? '#fff' : '#1976d2',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: page === 'stamp' ? '0 2px 8px rgba(25,118,210,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
              スタンプラリー
            </button>
            <button onClick={() => { setPage('activity'); navigate('/activity'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: page === 'activity' ? '2px solid #fbc02d' : 'none',
                background: page === 'activity' ? '#fbc02d' : '#fffde7',
                color: page === 'activity' ? '#fff' : '#fbc02d',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: page === 'activity' ? '0 2px 8px rgba(251,192,45,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
              運動記録
            </button>
            <button onClick={() => { setPage('ranking'); navigate('/ranking'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: page === 'ranking' ? '2px solid #4caf50' : 'none',
                background: page === 'ranking' ? '#4caf50' : '#e8f5e9',
                color: page === 'ranking' ? '#fff' : '#4caf50',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: page === 'ranking' ? '0 2px 8px rgba(76,175,80,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
              ランキング
            </button>
            <button onClick={() => { setPage('ai-stamp-gallery'); navigate('/ai-stamp-gallery'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: page === 'ai-stamp-gallery' ? '2px solid #9c27b0' : 'none',
                background: page === 'ai-stamp-gallery' ? '#9c27b0' : '#f3e5f5',
                color: page === 'ai-stamp-gallery' ? '#fff' : '#9c27b0',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: page === 'ai-stamp-gallery' ? '0 2px 8px rgba(156,39,176,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
              スタンプギャラリー
            </button>
            {user && user.email === 'haruto7fujimoto@gmail.com' && (
              <button
                onClick={() => { setPage('ai-stamp'); navigate('/ai-stamp'); }}
                style={{
                  background: page === 'ai-stamp' ? '#ff6b00' : '#ffe0b2',
                  color: page === 'ai-stamp' ? '#fff' : '#ff6b00',
                  border: page === 'ai-stamp' ? '2px solid #ff6b00' : 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  marginLeft: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: page === 'ai-stamp' ? '0 2px 8px rgba(255,107,0,0.15)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <span>🎨</span>スタンプ生成
              </button>
            )}
          </div>
        </nav>
        <div style={pageContainerStyle}>
          <Routes>
            <Route path="/" element={<Navigate to="/stamp" replace />} />
            <Route path="/stamp" element={
              <App user={user} />
            } />
            <Route path="/stamp-rally" element={
              <App user={user} />
            } />
            <Route path="/activity" element={<ActivityPage totalDistance={totalDistance} steps={steps} elapsed={elapsed} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/ranking" element={
              <RankingPage 
                ranking={ranking} 
                user={user} 
                currentUserProgress={currentUserProgress}
                onStampUpdate={handleStampUpdate}
              />
            } />
            <Route path="/ai-stamp" element={
              <AIStampPage 
                user={user} 
                currentUserProgress={currentUserProgress} 
                onPointsUpdate={handlePointsUpdate} 
              />
            } />
            <Route path="/ai-stamp-gallery" element={<AIStampGalleryPage user={user} gotStamps={gotStamps} onStampUpdate={handleStampUpdate} />} />
            <Route path="/ai-stamp-gallery/:id" element={<AIStampGalleryDetailPage user={user} gotStamps={gotStamps} onStampUpdate={handleStampUpdate} />} />
          </Routes>
        </div>

        {selected && (() => {
          const spot = STAMP_POINTS.find(p => String(p.id) === String(selected));
          if (!spot) return null;
          return (
            <div
              style={{
                position: 'fixed',
                right: 60,
                bottom: 60,
                width: 320,
                zIndex: 1000,
                background: 'white',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '90vw',
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto',
                boxSizing: 'border-box',
                ...(window.innerWidth < 700
                  ? {
                      left: '50%',
                      right: 'auto',
                      top: 'auto',
                      bottom: 20,
                      transform: 'translateX(-50%)',
                    }
                  : {}),
              }}
            >
              <h3>{spot.name}</h3>
              <p>{spot.description}</p>
              <button
                onClick={() => handleGetStamp(selected)}
                style={{
                  padding: '8px 16px',
                  background: gotStamps.includes(selected) ? '#bdbdbd' : '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: gotStamps.includes(selected) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
                disabled={gotStamps.includes(selected)}
              >
                {gotStamps.includes(selected) ? '取得済み' : 'スタンプGET'}
              </button>
            </div>
          );
        })()}
      </div>
    </LocationProvider>
  );
}

export default AppRouter;

// 2点間の距離を計算する関数（メートル単位）
function getDistance(pos1, pos2) {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = pos1.lat * Math.PI/180;
  const φ2 = pos2.lat * Math.PI/180;
  const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
  const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

