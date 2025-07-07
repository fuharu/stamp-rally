import React, { createContext, useContext, useState, useEffect } from 'react';

const LocationContext = createContext();

export function LocationProvider({ children }) {
  const [currentPos, setCurrentPos] = useState(null);
  const [geoError, setGeoError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation APIがサポートされていません');
      setCurrentPos(null);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoError(null);
      },
      (err) => {
        setGeoError('位置情報の取得に失敗しました');
        setCurrentPos(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <LocationContext.Provider value={{ currentPos, geoError }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  return useContext(LocationContext);
} 