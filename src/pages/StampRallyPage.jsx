import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // dbはfirebase.jsでexportしているものを想定

export default function StampRallyPage({
  isLoaded,
  center,
  currentPos,
  gotStamps,
  handleMarkerClick,
  selected,
  handleGetStamp,
  geoError,
  getDistance  // 追加
}) {
  const containerStyle = {
    width: '100%',
    height: '60vh',
    marginBottom: '1rem',
  };
  const [route, setRoute] = useState(null);
  const [nearest, setNearest] = useState(null);
  const [touristSpots, setTouristSpots] = useState([]);

  useEffect(() => {
    const fetchTouristSpots = async () => {
      const col = collection(db, 'tourist_spots');
      const snapshot = await getDocs(col);
      const spots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTouristSpots(spots);
    };
    fetchTouristSpots();
  }, []);

  // デバッグ用: ピン描画状態をコンソール出力
  console.log('touristSpots', touristSpots);
  console.log('gotStamps', gotStamps);
  console.log('selected', selected);

  // デバッグ: ピン描画タイミングの計測
  React.useEffect(() => {
    if (isLoaded) {
      console.log('[DEBUG] isLoaded true:', new Date().toLocaleTimeString());
    }
  }, [isLoaded]);

  React.useEffect(() => {
    if (isLoaded && touristSpots && gotStamps !== undefined) {
      console.log('[DEBUG] Marker描画開始:', new Date().toLocaleTimeString());
    }
  }, [isLoaded, touristSpots, gotStamps]);

  // ルート検索（Google Directions API）
  React.useEffect(() => {
    if (!isLoaded || !currentPos || !window.google || !touristSpots.length) return;
    if (selected) {
      const goalPoint = touristSpots.find(p => p.id === selected);
      if (!goalPoint) return;
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: currentPos,
        destination: { lat: goalPoint.lat, lng: goalPoint.lng },
        travelMode: window.google.maps.TravelMode.WALKING
      }, (result, status) => {
        if (status === 'OK') setRoute(result);
        else setRoute(null);
      });
      return;
    }
    const targets = touristSpots.filter(p => !gotStamps.includes(p.id));
    if (targets.length === 0) {
      setRoute(null);
      setNearest(null);
      return;
    }
    let minDist = Infinity, nearestPoint = null;
    for (const p of targets) {
      const d = Math.sqrt((currentPos.lat - p.lat) ** 2 + (currentPos.lng - p.lng) ** 2);
      if (d < minDist) { minDist = d; nearestPoint = p; }
    }
    setNearest(nearestPoint);
    const waypoints = targets.filter(p => p !== nearestPoint).map(p => ({ location: { lat: p.lat, lng: p.lng }, stopover: true }));
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: currentPos,
      destination: { lat: nearestPoint.lat, lng: nearestPoint.lng },
      waypoints,
      optimizeWaypoints: true,
      travelMode: window.google.maps.TravelMode.WALKING
    }, (result, status) => {
      if (status === 'OK') setRoute(result);
      else setRoute(null);
    });
  }, [isLoaded, currentPos, gotStamps, touristSpots, selected]);

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
          {currentPos && (
            <Marker
              key="current-pos"
              position={currentPos}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: { width: 40, height: 40 },
                labelOrigin: { x: 20, y: -10 }
              }}
              label={{
                text: 'START',
                color: '#d32f2f',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
              zIndex={1001}
            />
          )}
          {/* スタンプポイントマーカー */}
          {touristSpots.map((spot, idx) => (
            <Marker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              icon={{
                url: gotStamps.includes(spot.id)
                  ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: { width: 56, height: 56 },
                labelOrigin: { x: 28, y: -14 }
              }}
              label={{
                text: `#${idx + 1}`,
                color: gotStamps.includes(spot.id) ? '#388e3c' : '#d32f2f',
                fontWeight: 'bold',
                fontSize: '20px',
              }}
              onClick={() => handleMarkerClick(String(spot.id), true)}
              zIndex={2000}
            />
          ))}
          {/* ルート描画 */}
          {route && (
            <DirectionsRenderer directions={route} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#1976d2', strokeWeight: 5 } }} />
          )}
        </GoogleMap>
      ) : (
        <div>Loading Map...</div>
      )}
      {geoError && <div style={{ color: '#d32f2f', margin: '8px 0', textAlign: 'center' }}>{geoError}</div>}

      {/* 進捗バーなども touristSpots.length を使う */}
      <div style={{ margin: '24px 0 8px 0' }}>
        <div style={{ height: 16, background: '#e0e0e0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${(gotStamps.length / touristSpots.length) * 100}%`, height: '100%', background: '#1976d2', transition: 'width 0.4s', borderRadius: 8 }}></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#1976d2', marginTop: 4 }}>
          {gotStamps.length} / {touristSpots.length} スタンプ取得
        </div>
      </div>
      {/* マーカー詳細・スタンプGETボタン＋GOAL選択解除ボタン */}
      {selected && (
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
          {currentPos && (() => {
            const spot = touristSpots.find(p => String(p.id) === String(selected));
            return spot && getDistance(currentPos, { lat: spot.lat, lng: spot.lng }) <= 30;
          })() && (
            <button 
              onClick={() => handleGetStamp(selected)}
              style={{
                padding: '8px 16px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              スタンプを取得
            </button>
          )}
        </div>
      )}

      {/* 進捗バー */}
      <div style={{ margin: '24px 0 8px 0' }}>
        <div style={{ height: 16, background: '#e0e0e0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${(gotStamps.length / touristSpots.length) * 100}%`, height: '100%', background: '#1976d2', transition: 'width 0.4s', borderRadius: 8 }}></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#1976d2', marginTop: 4 }}>
          {gotStamps.length} / {touristSpots.length} スタンプ取得
        </div>
      </div>

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