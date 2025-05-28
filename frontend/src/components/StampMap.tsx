import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

// デフォルトアイコンの設定
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TouristSpot {
  id: number;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  stamp_image_url: string;
}

const StampMap: React.FC = () => {
  const [spots, setSpots] = useState<TouristSpot[]>([]);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<TouristSpot | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);

  useEffect(() => {
    // 観光スポットデータの取得
    const fetchSpots = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/tourist-spots/');
        setSpots(response.data);
      } catch (error) {
        console.error('観光スポットの取得に失敗しました:', error);
      }
    };

    fetchSpots();

    // 現在位置の取得
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPosition([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('位置情報の取得に失敗しました:', error);
        }
      );
    }
  }, []);

  // 距離計算関数
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // 地球の半径（メートル）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // メートル単位で返す
  };

  // スタンプ取得処理
  const handleGetStamp = async () => {
    if (!selectedSpot) return;

    try {
      const response = await axios.post('http://localhost:8000/api/stamps/', {
        tourist_spot_id: selectedSpot.id,
        user_id: 1, // 仮のユーザーID
      });
      alert('スタンプを取得しました！');
    } catch (error) {
      console.error('スタンプの取得に失敗しました:', error);
      alert('スタンプの取得に失敗しました。');
    }
  };

  // マーカークリック時の処理
  const handleMarkerClick = (spot: TouristSpot) => {
    setSelectedSpot(spot);
    if (currentPosition) {
      const distance = calculateDistance(
        currentPosition[0],
        currentPosition[1],
        spot.latitude,
        spot.longitude
      );
      setIsWithinRange(distance <= 30); // 30メートル以内かどうか
    }
  };

  return (
    <div className="relative w-full h-screen">
      <MapContainer
        center={[35.6812, 139.7671]} // 東京駅の座標
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.latitude, spot.longitude]}
            eventHandlers={{
              click: () => handleMarkerClick(spot),
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold">{spot.name}</h3>
                <p>{spot.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {currentPosition && (
          <Marker position={currentPosition}>
            <Popup>現在位置</Popup>
          </Marker>
        )}
      </MapContainer>
      {selectedSpot && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleGetStamp}
            disabled={!isWithinRange}
            className={`px-4 py-2 rounded-full text-white font-bold shadow-lg transition-all duration-300 ${
              isWithinRange
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isWithinRange ? 'スタンプを取得' : '近づいてください'}
          </button>
          <button
            onClick={handleGetStamp}
            className="ml-2 px-4 py-2 rounded-full text-white font-bold shadow-lg bg-red-500 hover:bg-red-600 transition-all duration-300"
          >
            デバッグ: スタンプ取得
          </button>
        </div>
      )}
    </div>
  );
};

export default StampMap; 