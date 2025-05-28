import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import { collection, getDocs } from 'firebase/firestore';

export default function StampRallyPage({
  isLoaded,
  center,
  currentPos,
  touristSpots,
  gotStamps,
  handleMarkerClick,
  selected,
  handleGetStamp,
  handleRemoveStamp,
  geoError,
  goalId,
  handleClearGoal,
  handleSetGoal
}) {
  const containerStyle = {
    width: '100%',
    height: '60vh',
    marginBottom: '1rem',
  };
  const [route, setRoute] = useState(null);
  const [nearest, setNearest] = useState(null);

  // デバッグ用: スタンプデータ
  const debugSpots = [
    {
      id: 1,
      name: '茨城大学水戸キャンパス',
      description: '茨城大学のメインキャンパスです。正門前でスタンプを取得できます。',
      position: {
        lat: 36.3725,
        lng: 140.4747
      }
    },
    {
      id: 3,
      name: '新宿駅',
      description: '新宿駅のスタンプです。',
      position: {
        lat: 35.6895,
        lng: 139.7003
      }
    },
    {
      id: 4,
      name: '浅草寺',
      description: '浅草寺のスタンプです。',
      position: {
        lat: 35.7147,
        lng: 139.7968
      }
    }
  ];

  // 2点間の距離を計算する関数（メートル単位）
  const getDistance = (pos1, pos2) => {
    if (!pos1 || !pos2 || !pos1.lat || !pos1.lng || !pos2.lat || !pos2.lng) return Infinity;
    
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
  };

  // 座標が有効かどうかをチェックする関数
  const isValidCoordinate = (lat, lng) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return !isNaN(latNum) && !isNaN(lngNum) &&
           latNum >= -90 && latNum <= 90 &&
           lngNum >= -180 && lngNum <= 180;
  };

  // 座標を正規化する関数
  const normalizeCoordinate = (coord) => {
    if (!coord) return null;
    // positionオブジェクトから座標を取得
    const lat = Number(coord.position?.lat ?? coord.lat);
    const lng = Number(coord.position?.lng ?? coord.lng);
    if (!isValidCoordinate(lat, lng)) return null;
    return { lat, lng };
  };

  // touristSpotsを数値化
  const normalizedSpots = React.useMemo(() => {
    // デバッグ用データを使用
    const spots = debugSpots;
    if (!Array.isArray(spots)) return [];
    
    return spots
      .map(spot => ({
        ...spot,
        normalizedPos: normalizeCoordinate(spot)
      }))
      .filter(spot => spot.normalizedPos !== null);
  }, []);

  // goalIdがセットされていれば、そのIDのみ表示
  const filteredSpots = React.useMemo(() => {
    if (!goalId) return normalizedSpots;
    return normalizedSpots.filter(spot => String(spot.id) === String(goalId));
  }, [goalId, normalizedSpots]);

  // デバッグ用: ピン描画状態をコンソール出力
  console.log('touristSpots', touristSpots);
  console.log('gotStamps', gotStamps);
  console.log('selected', selected);
  console.log('normalizedSpots', normalizedSpots);

  // デバッグ: ピン描画タイミングの計測
  React.useEffect(() => {
    if (isLoaded) {
      console.log('[DEBUG] isLoaded true:', new Date().toLocaleTimeString());
      // デバッグ用データをコンソールに出力
      console.log('[DEBUG] 茨城大学スタンプ:', debugSpots);
    }
  }, [isLoaded]);

  React.useEffect(() => {
    if (isLoaded && touristSpots && gotStamps !== undefined) {
      console.log('[DEBUG] Marker描画開始:', new Date().toLocaleTimeString());
    }
  }, [isLoaded, touristSpots, gotStamps]);

  // ルート検索（Google Directions API）
  React.useEffect(() => {
    if (!isLoaded || !currentPos || !window.google || !debugSpots?.length) return;
    
    const normalizedCurrentPos = normalizeCoordinate(currentPos);
    if (!normalizedCurrentPos) {
      console.error('Invalid current position coordinates');
      return;
    }

    if (selected) {
      const goalPoint = debugSpots.find(p => String(p.id) === String(selected));
      if (!goalPoint) return;
      
      const normalizedGoal = normalizeCoordinate(goalPoint);
      if (!normalizedGoal) {
        console.error('Invalid goal point coordinates');
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: normalizedCurrentPos,
        destination: normalizedGoal,
        travelMode: window.google.maps.TravelMode.WALKING
      }, (result, status) => {
        if (status === 'OK') setRoute(result);
        else {
          console.error('Directions request failed:', status);
          setRoute(null);
        }
      });
      return;
    }

    const targets = debugSpots
      .filter(p => !gotStamps.includes(String(p.id)))
      .map(p => ({
        ...p,
        normalizedPos: normalizeCoordinate(p)
      }))
      .filter(p => p.normalizedPos !== null);

    if (targets.length === 0) {
      setRoute(null);
      setNearest(null);
      return;
    }

    let minDist = Infinity, nearestPoint = null;
    for (const p of targets) {
      const d = Math.sqrt(
        (normalizedCurrentPos.lat - p.normalizedPos.lat) ** 2 +
        (normalizedCurrentPos.lng - p.normalizedPos.lng) ** 2
      );
      if (d < minDist) { minDist = d; nearestPoint = p; }
    }

    if (!nearestPoint) {
      setRoute(null);
      setNearest(null);
      return;
    }

    setNearest(nearestPoint);
    const waypoints = targets
      .filter(p => p !== nearestPoint)
      .map(p => ({
        location: p.normalizedPos,
        stopover: true
      }));

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: normalizedCurrentPos,
      destination: nearestPoint.normalizedPos,
      waypoints,
      optimizeWaypoints: true,
      travelMode: window.google.maps.TravelMode.WALKING
    }, (result, status) => {
      if (status === 'OK') setRoute(result);
      else {
        console.error('Directions request failed:', status);
        setRoute(null);
      }
    });
  }, [isLoaded, currentPos, gotStamps, selected]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: 24, letterSpacing: 2, fontWeight: 700, fontSize: 28 }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>📍</span>スタンプラリー地図アプリ
      </h2>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentPos || center}
          zoom={13}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            gestureHandling: 'greedy'
          }}
        >
          {/* 現在地マーカー */}
          {currentPos && currentPos.lat && currentPos.lng && (
            <Marker
              key="current-pos"
              position={normalizeCoordinate(currentPos)}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: { width: 40, height: 40 },
                labelOrigin: { x: 20, y: -10 }
              }}
              label={{
                text: '現在地',
                color: '#1976d2',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
              zIndex={1001}
            />
          )}
          {/* スタンプポイントマーカー */}
          {normalizedSpots.map((spot, idx) => {
            const isStampGot = gotStamps.includes(String(spot.id));
            console.log(`Spot ${spot.id} stamp status:`, isStampGot);
            
            return (
              <Marker
                key={spot.id}
                position={spot.normalizedPos}
                icon={{
                  url: isStampGot
                    ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                    : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  scaledSize: { width: 56, height: 56 },
                  labelOrigin: { x: 28, y: -14 }
                }}
                label={{
                  text: `#${idx + 1}`,
                  color: isStampGot ? '#388e3c' : '#d32f2f',
                  fontWeight: 'bold',
                  fontSize: '20px',
                }}
                onClick={() => {
                  console.log('Marker clicked:', spot.id);
                  handleMarkerClick(String(spot.id));
                }}
                zIndex={2000}
              />
            );
          })}
          {/* ルート描画 */}
          {route && (
            <DirectionsRenderer directions={route} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#1976d2', strokeWeight: 5 } }} />
          )}
        </GoogleMap>
      ) : (
        <div>Loading Map...</div>
      )}
      {geoError && <div style={{ color: '#d32f2f', margin: '8px 0', textAlign: 'center' }}>{geoError}</div>}

      {/* 現在地が取得できない場合のメッセージ */}
      {!currentPos && !geoError && (
        <div style={{ 
          background: '#fff3e0', 
          padding: '12px', 
          borderRadius: '8px', 
          margin: '8px 0',
          textAlign: 'center',
          color: '#e65100'
        }}>
          <p style={{ margin: 0 }}>
            📱 現在地を取得できません。<br/>
            スマートフォンでアクセスするか、<br/>
            位置情報の使用を許可してください。
          </p>
        </div>
      )}

      {/* 進捗バーなども touristSpots.length を使う */}
      <div style={{ margin: '24px 0 8px 0' }}>
        <div style={{ height: 16, background: '#e0e0e0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${(gotStamps.length / touristSpots.length) * 100}%`, height: '100%', background: '#1976d2', transition: 'width 0.4s', borderRadius: 8 }}></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#1976d2', marginTop: 4 }}>
          {gotStamps.length} / {touristSpots.length} スタンプ取得
        </div>
      </div>

      {/* スタンプ詳細表示 */}
      {selected && (() => {
        const spot = debugSpots.find(p => String(p.id) === String(selected));
        if (!spot) return null;
        
        const normalizedSpot = normalizeCoordinate(spot);
        if (!normalizedSpot) return null;
        
        const distance = currentPos ? getDistance(currentPos, normalizedSpot) : null;
        const isNearby = distance !== null && distance <= 30;
        
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
            <h3 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>{spot.name}</h3>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>{spot.description}</p>
            {currentPos ? (
              <p style={{ margin: '0 0 16px 0', color: isNearby ? '#4CAF50' : '#d32f2f' }}>
                {isNearby ? 'スタンプを取得できます！' : `スタンプ地点まで${Math.round(distance)}m`}
              </p>
            ) : (
              <p style={{ margin: '0 0 16px 0', color: '#ff9800' }}>
                📱 現在地を取得できません。<br/>
                スタンプを取得するには、<br/>
                位置情報の使用を許可してください。
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => handleGetStamp(selected)}
                disabled={!isNearby}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: isNearby ? '#4CAF50' : '#e0e0e0',
                  color: isNearby ? 'white' : '#666',
                  cursor: isNearby ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                スタンプを取得
              </button>
              <button
                onClick={() => handleGetStamp(selected)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#f44336',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                デバッグ: スタンプ取得
              </button>
              <button
                onClick={() => handleRemoveStamp(selected)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#ff9800',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: 1
                }}
              >
                デバッグ: スタンプ解除
              </button>
            </div>
            {/* ゴール設定・解除ボタン */}
            {goalId === String(spot.id) ? (
              <button
                onClick={handleClearGoal}
                style={{
                  padding: '8px 16px',
                  background: '#e0e0e0',
                  color: '#1976d2',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                ゴール解除
              </button>
            ) : (
              <button
                onClick={() => handleSetGoal(String(spot.id))}
                style={{
                  padding: '8px 16px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                ゴールに設定
              </button>
            )}
            <button 
              onClick={() => handleMarkerClick(null)}
              style={{
                padding: '8px 16px',
                background: '#e0e0e0',
                color: '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '8px',
                fontSize: '14px'
              }}
            >
              閉じる
            </button>
          </div>
        );
      })()}

      {/* ポイント・特典表示 */}
      <div style={{ background: '#e8f5e9', borderRadius: 12, padding: 16, margin: '16px 0', boxShadow: '0 1px 4px rgba(56,142,60,0.08)' }}>
        <strong style={{ color: '#388e3c' }}>ポイント・特典</strong>
        <div style={{ marginTop: 8 }}>
          <div>獲得ポイント: <span style={{ fontWeight: 700, color: '#43a047', fontSize: 20 }}>{gotStamps.length * 10}</span> pt</div>
          {gotStamps.length === touristSpots.length && (
            <div style={{ marginTop: 8, color: '#d84315', fontWeight: 600, fontSize: 18 }}>
              🎉 全スタンプ達成！<br/>
              <span style={{ color: '#ffb300' }}>特典: 地域限定クーポンを獲得！</span>
            </div>
          )}
        </div>
      </div>

      {/* 取得済みスタンプリスト */}
      <div style={{ background: '#f0f4f8', borderRadius: 12, padding: 16, marginTop: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <strong style={{ color: '#1976d2' }}>取得済みスタンプ：</strong>
        <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
          {gotStamps.length === 0 && <li style={{ color: '#757575' }}>まだありません</li>}
          {gotStamps.map((id) => {
            const point = touristSpots.find((p) => p.id === id);
            return <li key={id} style={{ margin: '6px 0', fontWeight: 500, color: '#388e3c' }}>{point ? point.name : id}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}


// スタンプラリー地図アプリの実装についてのコメント
{/*
{
  // 観光地（tourist_spots）コレクションを参照してスタンプを地図上に配置したい場合、Reactアプリ側でFirestoreからtourist_spotsコレクションを取得し、そのデータをマーカーとしてGoogleマップ上に描画する必要があります。
  
  // この実装イメージです。  
  // Firestoreから観光地データを取得し、`STAMP_POINTS`の代わりにそのデータを使ってマーカーを配置します。
  
  // 例：`src/pages/StampRallyPage.jsx` でFirestoreから観光地データを取得し、マーカーとして表示する場合
  {touristSpots.map((spot) => (
    <Marker
      key={spot.id}
      position={{ lat: spot.lat, lng: spot.lng }}
      label={props.gotStamps.includes(spot.id) ? '✅' : '📍'}
      onClick={() => props.handleMarkerClick(spot.id)}
      icon={props.gotStamps.includes(spot.id)
        ? { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }
        : { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }
      }
    />
  ))}
}
*/}