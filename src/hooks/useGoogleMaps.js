import { useJsApiLoader } from '@react-google-maps/api';

// Google Maps APIの共通設定
const GOOGLE_MAPS_CONFIG = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  libraries: ['marker'], // mapsとplacesライブラリを削除して無料枠内に収める
  version: 'weekly' // 最新バージョンを使用
};

// 共通のGoogle Maps API Loader
export const useGoogleMaps = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    ...GOOGLE_MAPS_CONFIG,
    // エラーハンドリングを改善
    onLoad: () => {
      console.log('Google Maps API loaded successfully');
    },
    onError: (error) => {
      console.error('Google Maps API load error:', error);
      // 請求エラーの場合は警告を表示
      if (error.message && error.message.includes('BillingNotEnabled')) {
        console.warn('Google Maps APIの請求が有効になっていません。地図の一部機能が制限される可能性があります。');
      }
    }
  });
  
  return {
    isLoaded,
    loadError,
    config: GOOGLE_MAPS_CONFIG
  };
}; 