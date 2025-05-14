import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getRanking, updateUserData, updateRanking } from './firebase';
import StampRallyPage from './pages/StampRallyPage';
import ActivityPage from './pages/ActivityPage';
import LoginPage from './pages/LoginPage';
import RankingPage from './pages/RankingPage';
import { STAMP_POINTS } from './App'; // STAMP_POINTSをインポート

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

  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const handleMarkerClick = (id) => {
    setSelected(id);
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
          const data = await getRanking();
          setRanking(data);
        }
      } catch (error) {
        console.error('ランキングの取得に失敗:', error);
        setRanking([]);
      }
    };
    fetchRanking();
  }, [user]);

  const handleGetStamp = async (id) => {
    if (!gotStamps.includes(id)) {
      const stampPoint = STAMP_POINTS.find(point => point.id === id);
      if (stampPoint && currentPos) {
        const distance = getDistance(currentPos, stampPoint.position);
        if (distance > 30) {
          alert('スタンプ地点から30m以内に近づいてください');
          return;
        }
      }
      
      const updated = [...gotStamps, id];
      setGotStamps(updated);
      localStorage.setItem('gotStamps', JSON.stringify(updated));

      const points = updated.length * 10;
      await updateUserData(user.uid, {
        stamps: updated,
        points,
        totalDistance,
        steps
      });
      await updateRanking(user.uid, points, user);
    }
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
                touristSpots={STAMP_POINTS}
                gotStamps={gotStamps}
                handleMarkerClick={handleMarkerClick}
                selected={selected}
                handleGetStamp={handleGetStamp}
                geoError={geoError}
              />
            } />
            <Route path="/ranking" element={<RankingPage ranking={ranking} user={user} />} />
            <Route path="/activity" element={<ActivityPage totalDistance={totalDistance} steps={steps} elapsed={elapsed} />} />
          </Routes>
        </>
      ) : (
        <LoginPage />
      )}
    </div>
  );
}

export default AppRouter;
export function AppRoutes({ isLoaded, center, currentPos, STAMP_POINTS, gotStamps, handleMarkerClick, selected, handleGetStamp, geoError, ranking, user }) {
  return (
    <Routes>
      <Route path="/stamp" element={
        <StampRallyPage
          isLoaded={isLoaded}
          center={center}
          currentPos={currentPos}
          STAMP_POINTS={STAMP_POINTS}
          gotStamps={gotStamps}
          handleMarkerClick={handleMarkerClick}
          selected={selected}
          handleGetStamp={handleGetStamp}
          geoError={geoError}
          getDistance={getDistance}  // 追加
        />
      } />
      <Route path="/ranking" element={
        <RankingPage ranking={ranking} user={user} />
      } />
      <Route path="/activity" element={
        <ActivityPage totalDistance={totalDistance} steps={steps} elapsed={elapsed} />
      } />
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

