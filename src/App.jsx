import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, useJsApiLoader, MarkerClusterer } from '@react-google-maps/api';
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import _ from 'lodash';
import { stampPointsCollection } from './firebase';


const containerStyle = {
  width: '100%',
  height: '60vh',
  marginBottom: '1rem',
};

const center = { lat: 35.6895, lng: 139.6917 }; // 東京中心

export default function App() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [stampPoints, setStampPoints] = useState([]);
  const [gotStamps, setGotStamps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [track, setTrack] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTourismType, setSelectedTourismType] = useState(null);

  // 地図の範囲内のスタンプポイントのみをロードするようにするためには、Google Maps APIの`bounds`を利用して、現在表示されている地図の範囲を取得し、その範囲内にあるスタンプポイントのみをロードするように変更することができます。以下にその方法を示します。
  {/*
  // まず、地図の`onBoundsChanged`イベントを利用して、地図の範囲が変更されたときにスタンプポイントを更新するようにします。
  const fetchStampPointsInBounds = async (bounds) => {
    const db = getFirestore();
    const col = collection(db, 'tourist_spots');
    
    // boundsの南西と北東の座標を取得
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    // Firestoreクエリでlatとlngを範囲指定
    const q = query(col, 
      where('position.lat', '>=', sw.lat()),
      where('position.lat', '<=', ne.lat()),
      where('position.lng', '>=', sw.lng()),
      where('position.lng', '<=', ne.lng())
    );
    
    const snapshot = await getDocs(q);
    const points = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setStampPoints(points);
  };
  */}
  // 地図の範囲が変更されたときにスタンプポイントを更新
  const handleBoundsChanged = useCallback(_.debounce((map) => {
    const bounds = map.getBounds();
    //fetchStampPointsInBounds(bounds);
  }, 300), []);

  // 距離計算関数
  function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 現在地取得
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation APIがサポートされていません');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        let msg = '位置情報の取得に失敗しました';
        if (err.code === 1) msg += '（許可されていません）';
        if (err.code === 2) msg += '（位置情報が利用できません）';
        if (err.code === 3) msg += '（タイムアウト）';
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 自動スタンプ取得: 現在地とスタンプポイントの距離を監視
  useEffect(() => {
    if (!currentPos || !isLoaded) return; // 初期ロード時にスタンプを取得しない
    stampPoints.forEach((point) => {
      if (!gotStamps.includes(point.id)) {
        const dist = getDistance(currentPos.lat, currentPos.lng, point.lat, point.lng);
        if (dist < 50) { // 50m以内で自動取得
          setGotStamps((prev) => [...prev, point.id]);
        }
      }
    });
  }, [currentPos, gotStamps, stampPoints, isLoaded]);

  // 位置履歴・運動量の記録
  useEffect(() => {
    if (!currentPos) return;
    setTrack((prev) => {
      if (prev.length === 0) {
        setStartTime(Date.now());
        return [currentPos];
      }
      const last = prev[prev.length - 1];
      const dist = getDistance(last.lat, last.lng, currentPos.lat, currentPos.lng);
      if (dist > 5) { // 5m以上動いたら記録
        setTotalDistance((d) => d + dist);
        setSteps((s) => s + Math.round(dist / 0.7)); // 歩幅0.7m換算
        return [...prev, currentPos];
      }
      return prev;
    });
  }, [currentPos]);

  // 経過時間
  useEffect(() => {
    if (!startTime) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const handleMarkerClick = (id) => {
    setSelected(id);
  };

  // 近距離判定関数（例: 50m以内）
  function isNearStamp(currentPos, point) {
    if (!currentPos || !point) return false;
    const dist = getDistance(currentPos.lat, currentPos.lng, point.position.lat, point.position.lng);
    return dist < 50;
  }
  // スタンプ取得
  useEffect(() => {
    if (isLoaded && currentPos && stampPoints.length > 0) {
      const map = new google.maps.Map(document.getElementById('map'), {
        center: currentPos,
        zoom: 12,
      });

    // マーカーをGoogle Maps APIで直接描画
    stampPoints.forEach(point => {
      const marker = new google.maps.Marker({
        position: point.position,
        map: map,
        title: point.name,
      });

      // マーカークリックイベント
      marker.addListener('click', () => {
        setSelected(point.id);
      });
    });
  }
}, [isLoaded, currentPos, stampPoints]); // 依存関係にstampPointsを追加

const handleGetStamp = async (id) => {
    if (!gotStamps.includes(id)) {
      setGotStamps([...gotStamps, id]);
      // Firestoreでスタンプ回数をインクリメント (もしあれば)
      // const ref = doc(db, "spot_stats", String(id));
      // await setDoc(ref, { gotCount: increment(1) }, { merge: true });
    }
    setSelected(null);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: 24, letterSpacing: 2, fontWeight: 700, fontSize: 28 }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>📍</span>スタンプラリー地図アプリ
      </h2>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentPos || center}
          zoom={12}
          onBoundsChanged={handleBoundsChanged}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            styles: [
              { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ]
          }}
        >
          <MarkerClusterer>
            {(clusterer) =>
              stampPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={point.position}
                  label={gotStamps.includes(point.id) ? '✅' : '📍'}
                  onClick={() => handleMarkerClick(point.id)}
                  clusterer={clusterer}
                  icon={gotStamps.includes(point.id)
                    ? {
                        url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                      }
                    : {
                        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      }
                  }
                />
              ))
            }
          </MarkerClusterer>
        </GoogleMap>
      ) : (
        <div>Loading Map...</div>
      )}
      {geoError && <div style={{ color: '#d32f2f', margin: '8px 0', textAlign: 'center' }}>{geoError}</div>}

      {/* マーカー詳細・スタンプGETボタン */}
      {selected && (
        <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 12, padding: 16, margin: '1rem 0', boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)' }}>
          <strong style={{ color: '#1976d2', fontSize: 18 }}>{stampPoints.find((p) => p.id === selected).name}</strong>
          <div style={{ margin: '8px 0' }}>{stampPoints.find((p) => p.id === selected).description}</div>
          <button
            style={{ marginTop: 8, padding: '8px 20px', background: gotStamps.includes(selected) ? '#bdbdbd' : '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 16, cursor: gotStamps.includes(selected) ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            onClick={() => handleGetStamp(selected)}
            disabled={gotStamps.includes(selected)}
          >
            {gotStamps.includes(selected) ? '取得済み' : 'スタンプGET'}
          </button>
        </div>
      )}

      {/* 進捗バー */}
      <div style={{ margin: '24px 0 8px 0' }}>
        <div style={{ height: 16, background: '#e0e0e0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${(gotStamps.length / stampPoints.length) * 100}%`, height: '100%', background: '#1976d2', transition: 'width 0.4s', borderRadius: 8 }}></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#1976d2', marginTop: 4 }}>
          {gotStamps.length} / {stampPoints.length} スタンプ取得
        </div>
      </div>

      {/* 運動記録パネル */}
      <div style={{ background: '#fffde7', borderRadius: 12, padding: 16, marginTop: 20, boxShadow: '0 1px 4px rgba(255,193,7,0.08)' }}>
        <strong style={{ color: '#fbc02d' }}>運動記録</strong>
        <div style={{ display: 'flex', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
          <div>距離: <span style={{ fontWeight: 600 }}>{(totalDistance / 1000).toFixed(2)}</span> km</div>
          <div>歩数: <span style={{ fontWeight: 600 }}>{steps}</span> 歩</div>
          <div>時間: <span style={{ fontWeight: 600 }}>{Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}</span></div>
          <div>消費カロリー: <span style={{ fontWeight: 600 }}>{(steps * 0.04).toFixed(1)}</span> kcal</div>
        </div>
      </div>

      {/* 取得済みスタンプリスト */}
      <div style={{ background: '#f0f4f8', borderRadius: 12, padding: 16, marginTop: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <strong style={{ color: '#1976d2' }}>取得済みスタンプ：</strong>
        <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
          {gotStamps.length === 0 && <li style={{ color: '#757575' }}>まだありません</li>}
          {gotStamps.map((id) => {
            const point = stampPoints.find((p) => p.id === id);
            return <li key={id} style={{ margin: '6px 0', fontWeight: 500, color: '#388e3c' }}>{point.name}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}

const db = getFirestore();

const handleGetStamp = async (id) => {
  if (!gotStamps.includes(id)) {
    setGotStamps([...gotStamps, id]);
    // Firestoreでスタンプ回数をインクリメント
    const ref = doc(db, "spot_stats", String(id));
    await setDoc(ref, { gotCount: increment(1) }, { merge: true });
  }
  setSelected(null);
};