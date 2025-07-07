import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, Marker, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Firebaseの設定ファイルをインポート
import CustomStampGenerator from '../components/CustomStampGenerator';
import { useSearchParams } from 'react-router-dom';
import { useLocationContext } from '../contexts/LocationContext';

export const calculateLocationBasedPoints = (stampIds, allStamps, getLocationKey, calculateTimeBasedPoints) => {
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
    const pointsForLocation = calculateTimeBasedPoints(stampsInLocation);
    totalPoints += pointsForLocation;
    console.log(`位置 ${locationKey}: ${stampsInLocation.length}個のスタンプ、ポイント: ${pointsForLocation}`);
  });
  return totalPoints;
};

export default function StampRallyPage({
  isLoaded,
  center,
  touristSpots,
  gotStamps,
  handleMarkerClick,
  selected,
  handleGetStamp,
  handleRemoveStamp,
  goalId,
  handleClearGoal,
  handleSetGoal,
  user
}) {
  const { currentPos, geoError } = useLocationContext();
  const [searchParams] = useSearchParams();
  const containerStyle = {
    width: '100%',
    height: '60vh',
    marginBottom: '1rem',
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [stepCount, setStepCount] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [lastPosition, setLastPosition] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [exerciseId, setExerciseId] = useState(null);
  const [showCustomStampGenerator, setShowCustomStampGenerator] = useState(false);
  const [customStamps, setCustomStamps] = useState([]);
  const [officialStamps, setOfficialStamps] = useState([]);
  const [stampMode, setStampMode] = useState('official'); // 'official' or 'custom'
  const [selectedStampId, setSelectedStampId] = useState(null); // スタンプ選択用
  const [route, setRoute] = useState(null); // 道のり表示用
  const [routeDistance, setRouteDistance] = useState(null); // 道のりの距離
  const [routeDuration, setRouteDuration] = useState(null); // 道のりの所要時間
  const [routeLoading, setRouteLoading] = useState(false);
  const mapRef = useRef(null);

  // URLパラメータから選択されたスタンプを読み取る
  useEffect(() => {
    const selectedFromUrl = searchParams.get('selected');
    if (selectedFromUrl) {
      setSelectedStampId(selectedFromUrl);
    }
  }, [searchParams]);

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

  // 画像を埋め込んだピン型SVGマーカー生成関数
  const createPinMarker = (imageUrl, isAcquired = false, isNearby = false, isSelected = false) => {
    const size = isSelected ? 60 : 50;
    const strokeColor = isAcquired ? '#4caf50' : isNearby ? '#ff9800' : '#f44336';
    const fillColor = isAcquired ? '#4caf50' : isNearby ? '#ff9800' : '#f44336';
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size * 1.3}" viewBox="0 0 ${size} ${size * 1.3}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="0" y="0" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
            </filter>
            <clipPath id="imageClip">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}"/>
            </clipPath>
          </defs>
          <g filter="url(#shadow)">
            <!-- ピンの外枠 -->
            <path d="M${size/2} ${size * 1.3 - 8} L${size/2} ${size * 1.3} L${size/2 - 3} ${size * 1.3 - 8} L${size/2 + 3} ${size * 1.3 - 8} Z" fill="${strokeColor}"/>
            <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="white" stroke="${strokeColor}" stroke-width="3"/>
            <!-- 画像 -->
            <image href="${imageUrl}" x="4" y="4" width="${size - 8}" height="${size - 8}" clip-path="url(#imageClip)" preserveAspectRatio="xMidYMid slice"/>
            <!-- ステータスバッジ -->
            ${isAcquired ? `<circle cx="${size - 12}" cy="12" r="8" fill="#4caf50" stroke="white" stroke-width="2"/>
              <text x="${size - 12}" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">✓</text>` : ''}
            ${isNearby && !isAcquired ? `<circle cx="${size - 12}" cy="12" r="8" fill="#ff9800" stroke="white" stroke-width="2"/>
              <text x="${size - 12}" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">!</text>` : ''}
          </g>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size * 1.3),
      anchor: new window.google.maps.Point(size/2, size * 1.3)
    };
  };

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

  // 現在のスタンプモードに応じたスタンプリストを取得
  const currentStamps = React.useMemo(() => {
    if (stampMode === 'official') {
      // 公式スタンプのみ
      return officialStamps.map(spot => ({
        ...spot,
        normalizedPos: normalizeCoordinate(spot)
      })).filter(spot => spot.normalizedPos !== null);
    } else {
      // ユーザー作成スタンプのみ
      return customStamps.map(spot => ({
        ...spot,
        normalizedPos: normalizeCoordinate(spot)
      })).filter(spot => spot.normalizedPos !== null);
    }
  }, [stampMode, officialStamps, customStamps, normalizeCoordinate]);

  // スタンプを数値化
  const normalizedSpots = React.useMemo(() => {
    if (!Array.isArray(currentStamps)) return [];
    
    // まず重複を除去してから正規化
    const uniqueMap = new Map();
    currentStamps.forEach(spot => {
      const id = String(spot.id);
      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, spot);
      }
    });
    
    return Array.from(uniqueMap.values())
      .map(spot => ({
        ...spot,
        normalizedPos: normalizeCoordinate(spot)
      }))
      .filter(spot => spot.normalizedPos !== null);
  }, [currentStamps]);

  // 検索クエリに基づいてスポットをフィルタリング
  const filteredSpots = React.useMemo(() => {
    let spots = normalizedSpots;
    
    // 検索クエリでフィルタリング
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      spots = spots.filter(spot => 
        (spot.name || spot.regionName || '').toLowerCase().includes(query) ||
        (spot.description || '').toLowerCase().includes(query)
      );
    }
    
    // selectedStampIdがセットされている場合は、そのIDのみ表示
    if (selectedStampId) {
      spots = spots.filter(spot => String(spot.id) === String(selectedStampId));
    }
    
    // より確実な重複除去（Mapを使用）
    const uniqueMap = new Map();
    spots.forEach(spot => {
      const id = String(spot.id);
      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, spot);
      }
    });
    
    return Array.from(uniqueMap.values());
  }, [selectedStampId, normalizedSpots, searchQuery]);

  // デバッグ用: ピン描画状態をコンソール出力
  console.log('touristSpots', touristSpots);
  console.log('gotStamps', gotStamps);
  console.log('selected', selected);
  console.log('normalizedSpots', normalizedSpots);
  console.log('filteredSpots', filteredSpots);
  
  // 重複チェック
  const touristSpotsIds = touristSpots?.map(s => String(s.id)) || [];
  const uniqueIds = [...new Set(touristSpotsIds)];
  if (touristSpotsIds.length !== uniqueIds.length) {
    console.warn('重複が検出されました:', {
      total: touristSpotsIds.length,
      unique: uniqueIds.length,
      duplicates: touristSpotsIds.filter((id, index) => touristSpotsIds.indexOf(id) !== index)
    });
  }

  // デバッグ: ピン描画タイミングの計測
  React.useEffect(() => {
    if (isLoaded) {
      console.log('[DEBUG] isLoaded true:', new Date().toLocaleTimeString());
      // デバッグ用データをコンソールに出力
      console.log('[DEBUG] 茨城大学スタンプ:', officialStamps.concat(customStamps));
    }
  }, [isLoaded]);

  React.useEffect(() => {
    if (isLoaded && touristSpots && gotStamps !== undefined) {
      console.log('[DEBUG] Marker描画開始:', new Date().toLocaleTimeString());
    }
  }, [isLoaded, touristSpots, gotStamps]);

  // 運動記録をFirestoreに保存
  const saveExerciseRecord = async (steps, distance) => {
    try {
      const exerciseData = {
        steps,
        distance,
        timestamp: serverTimestamp(),
        type: 'stamp_rally',
        location: currentPos ? {
          lat: currentPos.lat,
          lng: currentPos.lng
        } : null
      };

      const docRef = await addDoc(collection(db, 'exercise_records'), exerciseData);
      setExerciseId(docRef.id);
      console.log('運動記録を保存しました:', docRef.id);
    } catch (error) {
      console.error('運動記録の保存に失敗しました:', error);
    }
  };

  // 歩数計測の開始/停止
  const toggleStepCounter = async () => {
    if (isCounting) {
      // 停止時に記録を保存
      await saveExerciseRecord(stepCount, totalDistance);
    } else {
      // 開始時にリセット
      setStepCount(0);
      setTotalDistance(0);
      setExerciseId(null);
    }
    setIsCounting(!isCounting);
  };

  // 位置情報の変更を監視
  useEffect(() => {
    if (!isCounting || !currentPos) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        if (lastPosition) {
          const distance = getDistance(lastPosition, newPosition);
          if (distance > 0.5) { // 0.5メートル以上移動した場合に歩数としてカウント
            setStepCount(prev => prev + 1);
            setTotalDistance(prev => prev + distance);
          }
        }
        setLastPosition(newPosition);
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isCounting, currentPos, lastPosition]);

  // カスタムスタンプをローカルストレージから読み込み
  useEffect(() => {
    const saved = localStorage.getItem('customStamps');
    if (saved) {
      try {
        setCustomStamps(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom stamps:', e);
      }
    }
  }, []);

  // カスタムスタンプを保存
  const saveCustomStamps = (newStamps) => {
    setCustomStamps(newStamps);
    localStorage.setItem('customStamps', JSON.stringify(newStamps));
  };

  // カスタムスタンプが生成された時の処理
  const handleCustomStampGenerated = (stamp) => {
    const newStamps = [stamp, ...customStamps];
    saveCustomStamps(newStamps);
    
    // カスタムスタンプを通常のスタンプとして追加
    if (handleGetStamp) {
      handleGetStamp(`custom_${stamp.id}`);
    }
  };

  // カスタムスタンプを削除
  const removeCustomStamp = (stampId) => {
    const newStamps = customStamps.filter(stamp => stamp.id !== stampId);
    saveCustomStamps(newStamps);
  };

  // スタンプ選択機能
  const handleStampSelection = (stampId) => {
    setSelectedStampId(stampId);
    
    // 選択されたスタンプの位置に地図を移動
    const selectedStamp = currentStamps.find(s => String(s.id) === String(stampId));
    if (selectedStamp && selectedStamp.normalizedPos) {
      // 地図の中心を選択されたスタンプに移動
      if (window.google && window.google.maps) {
        const map = window.google.maps.Map;
        if (map) {
          map.setCenter(selectedStamp.normalizedPos);
          map.setZoom(16);
        }
      }
    }
    
    // 道のりを計算
    calculateRouteToStamp(stampId);
  };

  // 選択されたスタンプへの道のりを計算
  const calculateRouteToStamp = (stampId) => {
    if (!isLoaded || !currentPos || !window.google) {
      console.log('Google Maps APIが読み込まれていないか、現在地が取得できません');
      return;
    }

    // normalizedSpotsからも探す
    const selectedStamp = normalizedSpots.find(s => String(s.id) === String(stampId));
    if (!selectedStamp || !selectedStamp.normalizedPos) {
      console.log('選択されたスタンプの位置情報が取得できません', { stampId, selectedStamp });
      return;
    }

    console.log('ルート計算開始:', {
      origin: currentPos,
      destination: selectedStamp.normalizedPos
    });

    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route({
      origin: currentPos,
      destination: selectedStamp.normalizedPos,
      travelMode: window.google.maps.TravelMode.WALKING,
      unitSystem: window.google.maps.UnitSystem.METRIC
    }, (result, status) => {
      console.log('DirectionsService result:', result, 'status:', status);
      if (status === 'OK') {
        setRoute(result);
        // 距離と所要時間を取得
        const route = result.routes[0];
        if (route && route.legs[0]) {
          const leg = route.legs[0];
          setRouteDistance(leg.distance.text);
          setRouteDuration(leg.duration.text);
          console.log(`道のり計算完了: ${leg.distance.text}, 所要時間: ${leg.duration.text}`);
        }
      } else {
        console.error('道のり計算に失敗:', status, result);
        setRoute(null);
        setRouteDistance(null);
        setRouteDuration(null);
      }
    });
  };

  // スタンプ選択をクリア
  const clearStampSelection = () => {
    setSelectedStampId(null);
    setRoute(null);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  // 距離判定（50m以内かどうか）
  const isWithinRange = (stamp) => {
    if (!currentPos || !stamp.normalizedPos) return false;
    const distance = getDistance(currentPos, stamp.normalizedPos);
    return distance <= 50; // 50m以内
  };

  // デバッグ用スタンプ取得（距離に関係なく）
  const handleDebugGetStamp = (stampId) => {
    if (handleGetStamp) {
      handleGetStamp(stampId);
    }
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

  // 現在地が変更された際に道のりを再計算
  useEffect(() => {
    if (selectedStampId && currentPos) {
      calculateRouteToStamp(selectedStampId);
    }
  }, [currentPos, selectedStampId]);

  // ダミースタンプ画像をBase64で生成する関数
  function getDummyStampImage(text, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 50, 50);
    const pngDataUrl = canvas.toDataURL('image/png');
    // SVGテンプレートにPNGを埋め込む
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <image href="${pngDataUrl}" x="0" y="0" width="100" height="100"/>
      </svg>
    `;
    // SVGをBase64エンコードしてDataURL化
    const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${svgBase64}`;
  }

  // しずく型ピンSVGを生成する関数
  function getPinMarkerImage(imageUrl, isAcquired = false) {
    // 取得済みは緑、未取得は青
    const strokeColor = isAcquired ? '#4caf50' : '#1976d2';
    const fillColor = isAcquired ? '#e8f5e9' : '#e3f2fd';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="90" height="124" viewBox="0 0 90 124">
        <ellipse cx="45" cy="117" rx="20" ry="7" fill="#bbb" opacity="0.4"/>
        <path d="M45 11 C79 11, 88 56, 45 120 C2 56, 11 11, 45 11 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="3"/>
        <defs>
          <clipPath id="circleClip">
            <circle cx="45" cy="49" r="36"/>
          </clipPath>
        </defs>
        <image 
          href="${imageUrl}" 
          x="9" y="13" width="72" height="72" 
          clip-path="url(#circleClip)" 
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>
    `;
    const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${svgBase64}`;
  }

  // 画像URL→Base64変換関数
  async function imageUrlToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // マーカー画像のBase64キャッシュ用state
  const [markerBase64Map, setMarkerBase64Map] = React.useState({});

  React.useEffect(() => {
    // filteredSpotsの画像URLでBase64未変換のものを変換
    filteredSpots.forEach(async (spot) => {
      let imageUrl = null;
      if (spot.isCustom) {
        imageUrl = spot.imageData || getDummyStampImage('スタンプ', '#9c27b0');
      } else {
        imageUrl = spot.imageUrl || getDummyStampImage('公式', '#1976d2');
      }
      if (imageUrl && !markerBase64Map[spot.id]) {
        if (/^https?:\/\//.test(imageUrl)) {
          // URLの場合はBase64変換
          try {
            const base64 = await imageUrlToBase64(imageUrl);
            setMarkerBase64Map(prev => ({ ...prev, [spot.id]: base64 }));
          } catch (e) {
            setMarkerBase64Map(prev => ({ ...prev, [spot.id]: getDummyStampImage('画像NG', '#f44336') }));
          }
        } else {
          // 既にBase64やDataURLの場合
          setMarkerBase64Map(prev => ({ ...prev, [spot.id]: imageUrl }));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSpots]);

  // 取得済み・未取得スタンプを分割
  const acquiredStamps = currentStamps.filter(s => gotStamps.includes(String(s.id)));
  const notAcquiredStamps = currentStamps.filter(s => !gotStamps.includes(String(s.id)));

  // 検索ボックス
  const renderSearchBox = () => (
    <div style={{ marginBottom: 16 }}>
      <input
        type="text"
        placeholder="スタンプを検索..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '12px 16px',
          border: '2px solid #e0e0e0',
          borderRadius: 8,
          fontSize: 16,
          outline: 'none',
          transition: 'border-color 0.2s',
          background: '#fff',
          margin: 0
        }}
      />
    </div>
  );

  // 経路検索のuseEffect部分を修正
  useEffect(() => {
    if (!window.google || !currentPos || !selectedStampId) {
      setRoute(null);
      setRouteDistance(null);
      setRouteLoading(false);
      return;
    }
    setRouteLoading(true);
    const spot = currentStamps.find(p => String(p.id) === String(selectedStampId));
    if (!spot || !spot.position) {
      setRoute(null);
      setRouteDistance(null);
      setRouteLoading(false);
      return;
    }
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: currentPos,
      destination: spot.position,
      travelMode: window.google.maps.TravelMode.WALKING
    }, (result, status) => {
      setRouteLoading(false);
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
  }, [currentPos, selectedStampId, currentStamps]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2', marginBottom: 24, letterSpacing: 2, fontWeight: 700, fontSize: 28 }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>📍</span>スタンプラリー地図アプリ
      </h2>

      {/* スタンプ切り替えタブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
        <button
          onClick={() => setStampMode('official')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: stampMode === 'official' ? '2px solid #1976d2' : '1px solid #e0e0e0',
            background: stampMode === 'official' ? '#1976d2' : '#fff',
            color: stampMode === 'official' ? '#fff' : '#1976d2',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          公式スタンプ
        </button>
        <button
          onClick={() => setStampMode('custom')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: stampMode === 'custom' ? '2px solid #9c27b0' : '1px solid #e0e0e0',
            background: stampMode === 'custom' ? '#9c27b0' : '#fff',
            color: stampMode === 'custom' ? '#fff' : '#9c27b0',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ユーザー作成スタンプ
        </button>
      </div>

      {/* 検索ボックスを地図の上に移動 */}
      {renderSearchBox()}

      {/* Google Maps */}
      <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto', minHeight: 400 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{
              width: '100%',
              height: '60vh',
              minWidth: 600,
              minHeight: 400,
              maxWidth: 1000
            }}
            center={center}
            zoom={13}
            onLoad={map => {
              mapRef.current = map;
              console.log('Google Maps loaded');
            }}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              gestureHandling: 'cooperative',
              clickableIcons: false
            }}
          >
            {/* スタンプマーカー */}
            {filteredSpots.map((spot) => {
              const isAcquired = gotStamps.includes(String(spot.id));
              const isNearby = isWithinRange(spot);
              const isSelected = selectedStampId === String(spot.id);
              
              // スタンプの画像URLを取得
              let imageUrl = null;
              if (spot.isCustom) {
                imageUrl = spot.imageData || getDummyStampImage('スタンプ', '#9c27b0');
              } else {
                imageUrl = spot.imageUrl || getDummyStampImage('公式', '#1976d2');
              }
              const markerIconUrl = markerBase64Map[spot.id]
                ? getPinMarkerImage(markerBase64Map[spot.id], isAcquired)
                : getPinMarkerImage(getDummyStampImage('Loading', '#bbb'), isAcquired);
              
              return (
                <Marker
                  key={spot.id}
                  position={spot.normalizedPos}
                  onClick={() => {
                    console.log('マーカー画像URL:', markerIconUrl, spot);
                    handleStampSelection(spot.id);
                  }}
                  icon={{
                    url: markerIconUrl,
                    scaledSize: isSelected ? new window.google.maps.Size(68, 94) : new window.google.maps.Size(56, 77),
                    anchor: new window.google.maps.Point(34, 94)
                  }}
                />
              );
            })}

            {/* 現在地マーカー */}
            {currentPos && (
              <Marker
                position={currentPos}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  scaledSize: new window.google.maps.Size(30, 30)
                }}
              />
            )}

            {/* 道のり表示 */}
            {console.log('DirectionsRendererに渡すroute:', route)}
            {route && (
              <DirectionsRenderer
                directions={route}
                options={{
                  suppressMarkers: true, // マーカーは手動で表示するため抑制
                  polylineOptions: {
                    strokeColor: '#1976d2',
                    strokeWeight: 4,
                    strokeOpacity: 0.8
                  }
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={{ 
            height: '60vh', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#f5f5f5', 
            borderRadius: 8,
            padding: '20px'
          }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{ fontSize: '1.2em', marginBottom: '1rem', color: '#333' }}>
                🗺️ 地図を読み込み中...
              </div>
              <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
                Google Maps APIの読み込みに時間がかかっているか、一時的に利用できません。
              </div>
              <div style={{ 
                background: '#e3f2fd', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid #bbdefb',
                fontSize: '0.85em',
                color: '#1976d2'
              }}>
                💡 ヒント: 地図が表示されなくても、下のスタンプ一覧からスタンプを選択できます。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 地図の下に「現在地に戻る」ボタン */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 0 0' }}>
        <button
          onClick={() => {
            if (mapRef.current && currentPos) {
              mapRef.current.panTo(currentPos);
            }
          }}
          disabled={!currentPos}
          style={{
            padding: '8px 24px',
            borderRadius: '8px',
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 16,
            cursor: currentPos ? 'pointer' : 'not-allowed',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        >
          現在地に戻る
        </button>
      </div>

      {/* さらにその下に歩数計測ボタンと歩数・距離表示 */}
      <div style={{ margin: '8px 0 24px 0', textAlign: 'center' }}>
        <button
          onClick={toggleStepCounter}
          style={{
            padding: '10px 32px',
            borderRadius: 8,
            background: isCounting ? '#f44336' : '#4caf50',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: 18,
            cursor: 'pointer',
            marginBottom: 8
          }}
        >
          {isCounting ? '歩数計測を停止' : '歩数計測を開始'}
        </button>
        <div>
          <span>歩数: {stepCount} 歩</span> ／ <span>距離: {Math.round(totalDistance)} m</span>
        </div>
      </div>

      {/* スタンプ選択セクション */}
      {selectedStampId && (
        <div style={{ 
          background: '#e3f2fd', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16,
          border: '2px solid #1976d2'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ color: '#1976d2', margin: 0, fontSize: 18 }}>選択中のスタンプ</h3>
            <button
              onClick={clearStampSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: 16
              }}
            >
              ✕
            </button>
          </div>
          {(() => {
            const selectedStamp = currentStamps.find(s => String(s.id) === String(selectedStampId));
            if (!selectedStamp) return <div>スタンプが見つかりません</div>;
            
            let distance = null;
            if (routeDistance) {
              distance = routeDistance;
            } else if (currentPos && selectedStamp.normalizedPos) {
              const d = getDistance(currentPos, selectedStamp.normalizedPos);
              distance = isFinite(d) ? `${Math.round(d)}m` : null;
            }
            const isNearby = distance && typeof distance === 'string' && distance.endsWith('m') && parseInt(distance) <= 50;
            
            return (
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                  {selectedStamp.name || selectedStamp.regionName}
                </div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  {selectedStamp.description || '説明はありません'}
                </div>
                {/* 距離表示 */}
                {distance ? (
                  <div style={{ color: isNearby ? '#4caf50' : '#f44336', fontWeight: 600, marginBottom: 8 }}>
                    距離: {distance}
                  </div>
                ) : (
                  <div style={{ color: '#f44336', fontWeight: 600, marginBottom: 8 }}>
                    距離情報が取得できません
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleGetStamp(selectedStampId)}
                    disabled={!isNearby}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: isNearby ? '#4caf50' : '#e0e0e0',
                      color: isNearby ? 'white' : '#666',
                      cursor: isNearby ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 14
                    }}
                  >
                    スタンプ取得
                  </button>
                  <button
                    onClick={() => handleDebugGetStamp(selectedStampId)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#f44336',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14
                    }}
                  >
                    デバッグ: 取得
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 現在地エラー表示 */}
      {geoError && (
        <div style={{ 
          background: '#ffebee', 
          color: '#c62828', 
          padding: 12, 
          borderRadius: 8, 
          marginBottom: 16,
          border: '1px solid #ffcdd2'
        }}>
          <strong>位置情報エラー:</strong> {geoError}
        </div>
      )}

      {/* スタンプ詳細表示 */}
      {selectedStampId && (() => {
        const spot = currentStamps.find(p => String(p.id) === String(selectedStampId));
        if (!spot) return null;
        
        const normalizedSpot = spot.normalizedPos;
        let distance = null;
        if (routeDistance) {
          distance = routeDistance; // ルート距離（例: "2.3 km"）
        } else if (currentPos && normalizedSpot) {
          const d = getDistance(currentPos, normalizedSpot);
          distance = isFinite(d) ? `${Math.round(d)}m` : null;
        }
        const isNearby = distance && typeof distance === 'string' && distance.endsWith('m') && parseInt(distance) <= 50;
        
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
            <h3 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>{spot.name || spot.regionName}</h3>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>{spot.description || '説明はありません'}</p>
            {/* 距離表示 */}
            {distance ? (
              <div style={{ color: isNearby ? '#4caf50' : '#f44336', fontWeight: 600, marginBottom: 8 }}>
                距離: {distance}
              </div>
            ) : (
              <div style={{ color: '#f44336', fontWeight: 600, marginBottom: 8 }}>
                距離情報が取得できません
              </div>
            )}
            {/* 道のり情報表示 */}
            {routeDistance && routeDuration && (
              <div style={{ 
                background: '#e3f2fd', 
                padding: '8px 12px', 
                borderRadius: '6px', 
                marginBottom: '12px',
                border: '1px solid #bbdefb'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1976d2', marginBottom: '4px' }}>
                  🗺️ 道のり情報
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  距離: {routeDistance} | 所要時間: {routeDuration}（徒歩）
                </div>
              </div>
            )}
            {currentPos ? (
              <p style={{ margin: '0 0 16px 0', color: isNearby ? '#4CAF50' : '#d32f2f' }}>
                {isNearby ? 'スタンプを取得できます！' : (distance ? `スタンプ地点まで${distance}` : 'スタンプ地点までの距離不明')}
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
                onClick={() => handleGetStamp(selectedStampId)}
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
                onClick={() => handleDebugGetStamp(selectedStampId)}
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
                デバッグ: 取得
              </button>
            </div>
            <button 
              onClick={clearStampSelection}
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
          <div>獲得ポイント: <span style={{ fontWeight: 700, color: '#43a047', fontSize: 20 }}>{calculateLocationBasedPoints(gotStamps, [...officialStamps, ...customStamps], getLocationKey, calculateTimeBasedPoints)}</span> pt</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            ※同じ場所のスタンプは3日おきにポイントを獲得
          </div>
          {stampMode === 'official' && gotStamps.filter(id => officialStamps.some(s => String(s.id) === String(id))).length === officialStamps.length && officialStamps.length > 0 && (
            <div style={{ marginTop: 8, color: '#d84315', fontWeight: 600, fontSize: 18 }}>
              🎉 全スタンプ達成！<br/>
              <span style={{ color: '#ffb300' }}>特典: 地域限定クーポンを獲得！</span>
            </div>
          )}
        </div>
      </div>

      {/* 取得済み・未取得スタンプを分割 */}
      <div style={{ margin: '24px 0' }}>
        <h3 style={{ color: '#4caf50', marginBottom: 8 }}>取得済みスタンプ（{acquiredStamps.length}）</h3>
        <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {acquiredStamps.length === 0 && <span style={{ color: '#888' }}>まだ取得済みスタンプはありません</span>}
          {acquiredStamps.map(stamp => (
            <div key={stamp.id} style={{ border: '2px solid #4caf50', borderRadius: 12, padding: 8, minWidth: 120, textAlign: 'center', background: '#f1f8e9' }}>
              <img src={stamp.imageData || stamp.imageUrl || getDummyStampImage('スタンプ', '#9c27b0')} alt={stamp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginBottom: 4 }} />
              <div style={{ fontWeight: 600 }}>{stamp.name || stamp.regionName}</div>
            </div>
          ))}
        </div>
        <h3 style={{ color: '#1976d2', marginBottom: 8 }}>未取得スタンプ（{notAcquiredStamps.length}）</h3>
        <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {notAcquiredStamps.length === 0 && <span style={{ color: '#888' }}>未取得スタンプはありません</span>}
          {notAcquiredStamps.map(stamp => (
            <div key={stamp.id} style={{ border: '2px solid #1976d2', borderRadius: 12, padding: 8, minWidth: 120, textAlign: 'center', background: '#e3f2fd' }}>
              <img src={stamp.imageData || stamp.imageUrl || getDummyStampImage('スタンプ', '#1976d2')} alt={stamp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginBottom: 4 }} />
              <div style={{ fontWeight: 600 }}>{stamp.name || stamp.regionName}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 経路検索中のインジケーター */}
      {routeLoading && (
        <div style={{ color: '#1976d2', textAlign: 'center', margin: 8 }}>
          経路検索中...
        </div>
      )}
    </div>
  );
}