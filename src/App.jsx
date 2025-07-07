import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, increment } from "firebase/firestore";
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { useLocation } from 'react-router-dom';
import _ from 'lodash';
import StampRallyPage from './pages/StampRallyPage';
import { updateUserData, updateRanking } from './firebase';
import { calculateLocationBasedPoints } from './pages/StampRallyPage';

const containerStyle = {
  width: '100%',
  height: '60vh',
  marginBottom: '1rem',
};

const center = { lat: 35.6895, lng: 139.6917 }; // 東京中心

export default function App({ user }) {
  const { isLoaded, loadError } = useGoogleMaps();
  const location = useLocation();

  const db = getFirestore();

  const [customStamps, setCustomStamps] = useState([]);
  const [officialStamps, setOfficialStamps] = useState([]);
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
  const [track, setTrack] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTourismType, setSelectedTourismType] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [filteredStampPoints, setFilteredStampPoints] = useState([]);
  const [route, setRoute] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [mapCenter, setMapCenter] = useState(center);
  const [centerInitialized, setCenterInitialized] = useState(false);

  // Google Maps API読み込みエラーのハンドリング
  useEffect(() => {
    if (loadError) {
      console.error('Google Maps API読み込みエラー:', loadError);
    }
  }, [loadError]);

  // Google Maps API認証エラーのハンドリング
  useEffect(() => {
    window.gm_authFailure = function() {
      console.error('Google Maps API認証エラー');
    };
  }, []);

  // 公式スタンプを取得
  const fetchOfficialStamps = async () => {
    try {
      const col = collection(db, 'official_stamps');
      const snapshot = await getDocs(col);
      const stamps = snapshot.docs.map(doc => ({
        id: `official_${doc.id}`,
        ...doc.data(),
        isCustom: false
      }));
      console.log('取得した公式スタンプ:', stamps);
      setOfficialStamps(stamps);
    } catch (error) {
      console.error('公式スタンプの取得に失敗:', error);
    }
  };

  // カスタムスタンプを取得
  const fetchCustomStamps = async () => {
    try {
      const col = collection(db, 'custom_stamps');
      const snapshot = await getDocs(col);
      const stamps = snapshot.docs.map(doc => ({
        id: `custom_${doc.id}`,
        ...doc.data(),
        isCustom: true
      }));
      console.log('取得したカスタムスタンプ:', stamps);
      setCustomStamps(stamps);
    } catch (error) {
      console.error('カスタムスタンプの取得に失敗:', error);
    }
  };

  // 初期化時にスタンプを取得
  useEffect(() => {
    fetchOfficialStamps();
    fetchCustomStamps();
  }, []);

  // 定期的にスタンプを更新
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOfficialStamps();
      fetchCustomStamps();
    }, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, []);

  // 地図の範囲が変更されたときにスタンプポイントを更新
  const handleBoundsChanged = useCallback(_.debounce((map) => {
    if (map && map.getBounds) {
      const bounds = map.getBounds();
      //fetchStampPointsInBounds(bounds);
    }
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

  // 位置履歴・運動量の記録
  useEffect(() => {
    if (!currentPos || !isTracking) return;
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
  }, [currentPos, isTracking]);

  // 経過時間
  useEffect(() => {
    if (!startTime || !isTracking) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, isTracking]);

  const handleMarkerClick = (id) => {
    setSelected(id);
  };

  // 近距離判定関数（例: 50m以内）
  function isNearStamp(currentPos, point) {
    if (!currentPos || !point) return false;
    const dist = getDistance(currentPos.lat, currentPos.lng, point.position.lat, point.position.lng);
    return dist < 50;
  }

  // すべてのスタンプポイントを結合（公式スタンプ + カスタムスタンプ）
  const allStampPointsRaw = [
    ...officialStamps.map(s => ({ ...s, id: String(s.id), isCustom: false })),
    ...customStamps.map(s => ({ ...s, id: String(s.id), isCustom: true }))
  ];
  // id + isCustomで一意化
  const allStampPoints = Array.from(
    new Map(allStampPointsRaw.map(p => [`${p.isCustom}-${p.id}`, p])).values()
  );
  
  console.log('すべてのスタンプポイント:', allStampPoints);
  console.log('公式スタンプ数:', officialStamps.length);
  console.log('カスタムスタンプ数:', customStamps.length);

  // 検索機能
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredStampPoints(allStampPoints);
    } else {
      const filtered = allStampPoints.filter(point =>
        point.name.toLowerCase().includes(query.toLowerCase()) ||
        point.description.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredStampPoints(filtered);
    }
  };

  // 運動記録の開始
  const startTracking = () => {
    setIsTracking(true);
    setStartTime(Date.now());
    setTotalDistance(0);
    setSteps(0);
    setElapsed(0);
    setTrack([]);
  };

  // 運動記録の終了
  const stopTracking = () => {
    setIsTracking(false);
    setStartTime(null);
  };

  // 検索結果に基づいてマーカーを更新
  useEffect(() => {
    const pointsToShow = searchQuery.trim() === '' ? allStampPoints : filteredStampPoints;
    if (mapInstance && pointsToShow.length > 0) {
      // ここにマーカーを更新するロジックを追加
    }
  }, [searchQuery, filteredStampPoints, allStampPoints, mapInstance]);

  // ルート検索
  useEffect(() => {
    if (!window.google || !currentPos || !selected) {
      setRoute(null);
      setRouteDistance(null);
      return;
    }
    const goal = (searchQuery.trim() === '' ? allStampPoints : filteredStampPoints).find(p => p.id === selected);
    if (!goal) {
      setRoute(null);
      setRouteDistance(null);
      return;
    }
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: currentPos,
      destination: goal.position,
      travelMode: window.google.maps.TravelMode.WALKING
    }, (result, status) => {
      if (status === 'OK') {
        setRoute(result);
        const legs = result.routes[0]?.legs;
        if (legs && legs.length > 0) {
          setRouteDistance(legs[0].distance.text);
        } else {
          setRouteDistance(null);
        }
      } else {
        setRoute(null);
        setRouteDistance(null);
      }
    });
  }, [currentPos, selected, searchQuery, allStampPoints, filteredStampPoints]);

  // サーバーから取得した場合に両方に保存する関数
  const updateGotStampsFromServer = (serverStamps) => {
    setGotStamps(serverStamps);
    localStorage.setItem('gotStamps', JSON.stringify(serverStamps));
  };

  // getLocationKey関数をApp.jsxに追加
  const getLocationKey = (position) => {
    if (!position) return '';
    // 100mグリッドで位置を丸める
    const lat = Math.round(position.lat * 1000) / 1000;
    const lng = Math.round(position.lng * 1000) / 1000;
    return `${lat},${lng}`;
  };

  // calculateTimeBasedPoints関数をApp.jsxに追加
  const calculateTimeBasedPoints = (stampsInLocation) => {
    if (!Array.isArray(stampsInLocation) || stampsInLocation.length === 0) return 0;
    // スタンプ取得日でソート
    const sorted = [...stampsInLocation].sort((a, b) => {
      const da = a.acquiredAt ? new Date(a.acquiredAt) : new Date(0);
      const db = b.acquiredAt ? new Date(b.acquiredAt) : new Date(0);
      return da - db;
    });
    let totalPoints = 0;
    let lastPointDate = null;
    sorted.forEach(stamp => {
      const stampDate = stamp.acquiredAt ? new Date(stamp.acquiredAt) : new Date(0);
      if (!lastPointDate || (stampDate - lastPointDate) / (1000 * 60 * 60 * 24) >= 3) {
        totalPoints += 5;
        lastPointDate = stampDate;
      }
    });
    return totalPoints;
  };

  // スタンプ取得時も両方更新
  const handleGetStamp = async (id) => {
    if (!gotStamps.includes(id)) {
      const newStamps = [...gotStamps, id];
      setGotStamps(newStamps);
      localStorage.setItem('gotStamps', JSON.stringify(newStamps));
      // ポイント計算
      const newPoints = calculateLocationBasedPoints(newStamps, allStampPoints, getLocationKey, calculateTimeBasedPoints);
      // サーバーにも反映（ログイン時のみ）
      if (user) {
        await updateUserData(user.uid, {
          stamps: newStamps,
          points: newPoints,
          displayName: user.displayName || user.email || 'ゲスト'
        });
      }
    }
    setSelected(null);
  };

  // centerは初回のみ現在地でセットする
  useEffect(() => {
    if (currentPos && !centerInitialized) {
      setMapCenter(currentPos);
      setCenterInitialized(true);
    }
  }, [currentPos, centerInitialized]);

  // ピン型SVGマーカー生成関数
  const markerSvg = (imageUrl) => `
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="shadow" x="0" y="0" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
      </filter>
      <g filter="url(#shadow)">
        <path d="M30 78C30 78 58 50 58 30C58 13.4315 45.5685 1 29 1C12.4315 1 0 13.4315 0 30C0 50 30 78 30 78Z" fill="white" stroke="#bbb" stroke-width="2"/>
        <clipPath id="circleClip">
          <circle cx="30" cy="30" r="24"/>
        </clipPath>
        <image href="${imageUrl}" x="6" y="6" width="48" height="48" clip-path="url(#circleClip)" />
      </g>
    </svg>
  `;

  // URLパラメータからselectedを読み取って、該当するスタンプを選択状態にする処理を追加
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const selectedParam = queryParams.get('selected');
    console.log('URLパラメータ selected:', selectedParam);
    console.log('現在の公式スタンプ:', officialStamps);
    console.log('現在のカスタムスタンプ:', customStamps);
    
    if (selectedParam && (officialStamps.length > 0 || customStamps.length > 0)) {
      // プレフィックスがない場合は、公式スタンプとカスタムスタンプの両方を検索
      let foundStamp = null;
      
      // 公式スタンプで検索
      foundStamp = officialStamps.find(stamp => stamp.id === selectedParam || stamp.id === `official_${selectedParam}`);
      
      // 見つからない場合はカスタムスタンプで検索
      if (!foundStamp) {
        foundStamp = customStamps.find(stamp => stamp.id === selectedParam || stamp.id === `custom_${selectedParam}`);
      }
      
      if (foundStamp) {
        console.log('スタンプが見つかりました:', foundStamp);
        setSelected(foundStamp.id);
      } else {
        console.log('スタンプが見つかりません:', selectedParam);
        console.log('利用可能な公式スタンプID:', officialStamps.map(s => s.id));
        console.log('利用可能なカスタムスタンプID:', customStamps.map(s => s.id));
        console.log('検索したパターン:', [selectedParam, `official_${selectedParam}`, `custom_${selectedParam}`]);
      }
    }
  }, [location.search, officialStamps.length, customStamps.length]);

  return (
    <StampRallyPage
      isLoaded={isLoaded}
      center={center}
      touristSpots={allStampPoints}
      gotStamps={gotStamps}
      handleMarkerClick={handleMarkerClick}
      selected={selected}
      handleGetStamp={handleGetStamp}
      handleRemoveStamp={(id) => {
        const newStamps = gotStamps.filter(stampId => stampId !== id);
        setGotStamps(newStamps);
        localStorage.setItem('gotStamps', JSON.stringify(newStamps));
      }}
      goalId={null}
      handleClearGoal={() => {}}
      handleSetGoal={() => {}}
      user={user}
    />
  );
}

