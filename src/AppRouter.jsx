import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getRanking, updateUserData, updateRanking } from './firebase'; 
import { stampPointsCollection } from './firebase';
import { getFirestore, collection, getDocs, doc, setDoc} from "firebase/firestore";
import StampRallyPage from './pages/StampRallyPage';
import ActivityPage from './pages/ActivityPage';
import LoginPage from './pages/LoginPage';
import RankingPage from './pages/RankingPage';

const center = { lat: 35.6895, lng: 139.6917 };


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
  const [firestoreStampPoints, setFirestoreStampPoints] = useState([]); // Firestoreのスタンプポイントを保持するstate

  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

useEffect(() => {
    const fetchStampPoints = async () => {
      const snapshot = await getDocs(stampPointsCollection);
      const points = snapshot.docs.map(doc => {
        const data = doc.data();
          return ({
            id: doc.id,
            ...data,
            position: { lat: data?.lat, lng: data?.lng }
          });
        });
        setFirestoreStampPoints(points);
    };

    fetchStampPoints();
  }, []);

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
        if (user) {
          const response = await fetch('http://localhost:3001/api/ranking');
          const data = await response.json();
          const formattedRanking = data.map(user => ({
            userId: user.userid,
            displayName: user.displayname || user.email?.split('@')[0] || 'ゲスト',
            email: user.email,
            photoURL: user.photourl,
            points: user.points || 0,
            stamps: user.stamps || [],
            totalDistance: user.totaldistance || 0,
            steps: user.steps || 0,
            updatedAt: user.updatedat
          }));
          setRanking(formattedRanking);
          const currentUserData = formattedRanking.find(rankUser => rankUser.userId === user.uid);
          if (currentUserData) {
            setCurrentUserProgress(currentUserData);
            setGotStamps(currentUserData.stamps || []);
          }
        }
      } catch (error) {
        console.error('ランキングの取得に失敗:', error);
        setRanking([]);
        setCurrentUserProgress(null);
      }
    };
    fetchRanking();
  }, [user]);

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

        // ユーザーデータの更新
        if (user) {
          const points = updated.length * 10;
          await updateUserData(user.uid, {
            stamps: updated,
            points,
            totalDistance,
            steps
          });
          await updateRanking(user.uid, points, user);
          console.log('User data updated successfully');

          setCurrentUserProgress(prev => ({
            ...prev,
            stamps: updated,
            points: points,
          }));
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
          const points = updated.length * 10;
          await updateUserData(user.uid, {
            stamps: updated,
            points,
            totalDistance,
            steps
          });
          await updateRanking(user.uid, points, user);
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
        text: `${message}\n現在のポイント: ${gotStamps.length * 10}\n取得したスタンプ数: ${gotStamps.length}個`,
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

  if (loading) return null; 

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {user ? (
        <>
          <nav style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            padding: '24px 0',
            background: '#fff',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <button onClick={() => { setPage('stamp'); navigate('/stamp'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                background: page === 'stamp' ? '#1976d2' : '#e3f2fd',
                color: page === 'stamp' ? '#fff' : '#1976d2',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer'
              }}>
              スタンプラリー
            </button>
            <button onClick={() => { setPage('activity'); navigate('/activity'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                background: page === 'activity' ? '#fbc02d' : '#fffde7',
                color: page === 'activity' ? '#fff' : '#fbc02d',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer'
              }}>
              運動記録
            </button>
            <button onClick={() => { setPage('ranking'); navigate('/ranking'); }}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                background: page === 'ranking' ? '#4caf50' : '#e8f5e9',
                color: page === 'ranking' ? '#fff' : '#4caf50',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer'
              }}>
              ランキング
            </button>

            <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="プロフィール"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: '#1976d2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px',
                    borderRadius: '50%'
                  }}>
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </button>

              {showProfile && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: '24px',
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  width: '280px',
                  maxWidth: 'calc(100vw - 48px)',
                  zIndex: 1000
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', color: '#1976d2' }}>{user.email}</h3>
                    <p style={{ fontSize: '14px', color: '#666' }}>ポイント: {gotStamps.length * 10}</p>
                  </div>
                  <button
                    onClick={() => shareProgress()}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#03a9f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    進捗を共有
                  </button>
                  <button
                    onClick={() => {
                      auth.signOut();
                      setUser(null);
                      setShowProfile(false);
                    }}
                  >
                    ログアウト
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('gotStamps');
                      setGotStamps([]);
                      setShowProfile(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginTop: '8px'
                    }}
                  >
                    スタンプをリセット（デバッグ用）
                  </button>
                </div>
              )}
            </div>
          
          </nav>

          <Routes>
            <Route path="/" element={<Navigate to="/stamp" replace />} />
            <Route path="/stamp" element={
              <StampRallyPage
                isLoaded={isLoaded}
                center={center}
                currentPos={currentPos}
                touristSpots={firestoreStampPoints}
                gotStamps={gotStamps}
                handleMarkerClick={handleMarkerClick}
                selected={selected}
                handleGetStamp={handleGetStamp}
                handleRemoveStamp={handleRemoveStamp}
                geoError={geoError}
                goalId={goalId}
                handleSetGoal={handleSetGoal}
                handleClearGoal={handleClearGoal}
              />
            } />
            <Route path="/ranking" element={<RankingPage ranking={ranking} user={currentUserProgress} />} />
            <Route path="/activity" element={<ActivityPage totalDistance={totalDistance} steps={steps} elapsed={elapsed} />} />
          </Routes>

          {selected && (() => {
            const spot = firestoreStampPoints.find(p => String(p.id) === String(selected));
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
                {/* ...中身はそのまま... */}
              </div>
            );
          })()}
        </>
      ) : (
        <LoginPage />
      )}
    </div>
  );
}

export default AppRouter;
export function AppRoutes({ isLoaded, center, currentPos, firestoreStampPoints, gotStamps, handleMarkerClick, selected, handleGetStamp, geoError, ranking, user }) {
  return (
    <Routes>
      <Route path="/stamp" element={
        <StampRallyPage
          isLoaded={isLoaded}
          center={center}
          currentPos={currentPos}
          touristSpots={firestoreStampPoints}
          gotStamps={gotStamps}
          handleMarkerClick={handleMarkerClick}
          selected={selected}
          handleGetStamp={handleGetStamp}
          handleRemoveStamp={handleRemoveStamp}
          geoError={geoError}
          goalId={null}
          handleSetGoal={() => {}}
          handleClearGoal={() => {}}
        />
      } />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/ranking"
        element={<RankingPage ranking={ranking} user={user} />}
      />
    </Routes>
  );
}

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

