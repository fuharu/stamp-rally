import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateStampImage, cacheStampImage, getCachedStampImage, clearStampImageCache } from '../services/stableDiffusion';
import { optimizeImageForFirestore, checkImageSize } from '../services/imageCompression';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { updateUserData } from '../firebase';

const containerStyle = {
  width: '100%',
  height: '300px',
  marginBottom: '1rem',
  borderRadius: '12px',
};

const center = { lat: 35.6895, lng: 139.6917 }; // 東京中心

const GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json';

// AIスタンプ生成コスト
const STAMP_GENERATION_COST = 50;

export default function AIStampGenerator({ user, currentUserProgress, onPointsUpdate }) {
  const { isLoaded } = useGoogleMaps();

  const [stampName, setStampName] = useState('');
  const [stampDescription, setStampDescription] = useState('');
  const [stampTags, setStampTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [regionName, setRegionName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useCustomDescription, setUseCustomDescription] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [isJumping, setIsJumping] = useState(false);
  const [showCostConfirmation, setShowCostConfirmation] = useState(false);

  // 現在地を取得
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPos({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setSelectedPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.error('位置情報の取得に失敗しました:', err);
        }
      );
    }
  }, []);

  // タグ候補（一般的なタグ）
  const commonTags = [
    '観光', '歴史', '自然', '文化', '食べ物', 'ショッピング', 'レジャー', 'アート',
    '博物館', '公園', '寺社', '城', 'タワー', '駅', '空港', '港', '温泉', '山', '海',
    '川', '湖', '森', '花', '動物', '夜景', '朝日', '夕日', '雪', '桜', '紅葉',
    '東京', '大阪', '京都', '名古屋', '福岡', '札幌', '仙台', '広島', '沖縄'
  ];

  // タグ候補をフィルタリング
  useEffect(() => {
    if (newTag.trim()) {
      const filtered = commonTags.filter(tag => 
        tag.toLowerCase().includes(newTag.toLowerCase()) && 
        !stampTags.includes(tag)
      );
      setSuggestedTags(filtered.slice(0, 5));
    } else {
      setSuggestedTags([]);
    }
  }, [newTag, stampTags]);

  // タグを追加
  const handleAddTag = (tagToAdd) => {
    const tag = tagToAdd.trim();
    if (!tag || stampTags.includes(tag)) return;
    setStampTags(prev => [...prev, tag]);
    setNewTag('');
    setSuggestedTags([]);
  };

  // タグを削除
  const handleRemoveTag = (tagToRemove) => {
    setStampTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // Enterキーでタグを追加
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag(newTag);
    }
  };

  // 地図クリック時の処理
  const handleMapClick = (event) => {
    setSelectedPosition({
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    });
  };

  // ポイントが不足しているかチェック
  const hasEnoughPoints = () => {
    const currentPoints = currentUserProgress?.points || 0;
    return currentPoints >= STAMP_GENERATION_COST;
  };

  // スタンプ画像を生成
  const handleGenerateStamp = async () => {
    if (!regionName.trim()) {
      setError('地域名を入力してください');
      return;
    }

    // ポイントチェック
    if (!hasEnoughPoints()) {
      setError(`ポイントが不足しています。AIスタンプ生成には${STAMP_GENERATION_COST}ポイント必要です。現在のポイント: ${currentUserProgress?.points || 0}`);
      return;
    }

    // コスト確認ダイアログを表示
    setShowCostConfirmation(true);
  };

  // コスト確認後の実際の生成処理
  const confirmAndGenerate = async () => {
    setShowCostConfirmation(false);
    
    // APIキーの確認
    const stabilityApiKey = import.meta.env.VITE_STABILITY_API_KEY;
    const replicateApiKey = import.meta.env.VITE_REPLICATE_API_KEY;
    
    console.log('APIキー設定状況:', {
      hasStabilityKey: !!stabilityApiKey && stabilityApiKey !== 'your_stability_api_key_here',
      hasReplicateKey: !!replicateApiKey && replicateApiKey !== 'your_replicate_api_key_here'
    });

    if (!stabilityApiKey || stabilityApiKey === 'your_stability_api_key_here') {
      if (!replicateApiKey || replicateApiKey === 'your_replicate_api_key_here') {
        setError('APIキーが設定されていません。.envファイルでStability AIまたはReplicateのAPIキーを設定してください。');
        return;
      }
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      // まずキャッシュをチェック
      const cachedImage = getCachedStampImage(regionName);
      if (cachedImage) {
        console.log('キャッシュから画像を取得しました（ポイント消費なし）');
        setGeneratedImage(cachedImage);
        setSuccess('キャッシュからスタンプ画像を取得しました！（ポイント消費なし）');
        setTimeout(() => setSuccess(null), 3000);
        setIsGenerating(false);
        return;
      }

      // 新しい画像を生成（ポイント消費）
      console.log('新しい画像を生成します（50ポイント消費）');
      const imageData = await generateStampImage(regionName, useCustomDescription ? customDescription : null);
      
      // 画像生成成功時にポイントを消費
      if (user && currentUserProgress) {
        const newPoints = Math.max(0, (currentUserProgress.points || 0) - STAMP_GENERATION_COST);
        await updateUserData(user.uid, {
          points: newPoints,
          stamps: currentUserProgress.stamps || [],
          totalDistance: currentUserProgress.totalDistance || 0,
          steps: currentUserProgress.steps || 0
        });
        
        // 親コンポーネントにポイント更新を通知
        if (onPointsUpdate) {
          onPointsUpdate(newPoints);
        }
        
        console.log(`ポイントを消費しました: ${STAMP_GENERATION_COST}ポイント`);
      }
      
      // 画像をキャッシュ（エラーが発生しても続行）
      try {
        cacheStampImage(regionName, imageData);
      } catch (cacheError) {
        console.warn('キャッシュに失敗しましたが、画像生成は続行します:', cacheError);
      }
      
      // 画像データが不正な場合はエラー表示
      console.log('生成された画像データ:', {
        type: typeof imageData,
        length: imageData?.length,
        startsWithDataImage: imageData?.startsWith('data:image'),
        preview: imageData?.substring(0, 100) + '...'
      });
      
      if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
        console.error('画像データが不正:', imageData);
        setError('画像生成に失敗しました。もう一度お試しください。');
        setGeneratedImage(null);
        setIsGenerating(false);
        return;
      }
      
      // 画像の読み込みテスト
      const img = new Image();
      img.onload = () => {
        console.log('画像の読み込み成功:', {
          width: img.width,
          height: img.height
        });
        setGeneratedImage(imageData);
        
        // 画像生成成功メッセージを表示
        setSuccess(`スタンプ画像が生成されました！(${STAMP_GENERATION_COST}ポイント消費)`);
        setTimeout(() => setSuccess(null), 3000);
      };
      img.onerror = () => {
        console.error('画像の読み込みに失敗');
        setError('生成された画像の読み込みに失敗しました。');
        setGeneratedImage(null);
      };
      img.src = imageData;

    } catch (err) {
      console.error('AIスタンプ生成エラー:', err);
      
      // エラーメッセージを詳細化
      let errorMessage = '画像の生成に失敗しました';
      
      if (err.message.includes('APIキーが設定されていません')) {
        errorMessage = 'Stability AI APIキーが設定されていません。.envファイルを確認してください。';
      } else if (err.message.includes('400')) {
        errorMessage = 'APIリクエストが不正です。プロンプトやパラメータを確認してください。';
      } else if (err.message.includes('401')) {
        errorMessage = 'APIキーが無効です。正しいAPIキーを設定してください。';
      } else if (err.message.includes('429')) {
        errorMessage = 'APIの利用制限に達しました。しばらく待ってから再試行してください。';
      } else if (err.message.includes('500')) {
        errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
      } else {
        errorMessage = `画像の生成に失敗しました: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // キャッシュをクリア
  const handleClearCache = () => {
    try {
      clearStampImageCache();
      setSuccess('キャッシュをクリアしました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('キャッシュのクリアに失敗しました');
    }
  };

  // スタンプを保存
  const handleSaveStamp = async () => {
    if (!stampName.trim()) {
      setError('スタンプ名を入力してください');
      return;
    }
    if (!stampDescription.trim()) {
      setError('スタンプの説明を入力してください');
      return;
    }
    if (!selectedPosition) {
      setError('地図上で位置を選択してください');
      return;
    }
    if (!generatedImage) {
      setError('スタンプ画像を生成してください');
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      // 画像サイズをチェック
      const originalSize = checkImageSize(generatedImage);
      console.log(`元の画像サイズ: ${originalSize} bytes`);

      // 画像を最適化
      const optimizedImage = await optimizeImageForFirestore(generatedImage);
      const optimizedSize = checkImageSize(optimizedImage);
      console.log(`最適化後の画像サイズ: ${optimizedSize} bytes`);

      const db = getFirestore();
      const stampData = {
        name: stampName,
        description: stampDescription,
        tags: stampTags,
        position: selectedPosition,
        imageData: optimizedImage,
        regionName: regionName,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'user',
        createdByName: user?.displayName || '匿名',
        isCustom: true,
        originalSize: originalSize,
        optimizedSize: optimizedSize
      };

      await addDoc(collection(db, 'custom_stamps'), stampData);
      
      setSuccess(`スタンプが正常に保存されました！画像サイズ: ${(optimizedSize / 1024).toFixed(1)}KB`);
      setStampName('');
      setStampDescription('');
      setStampTags([]);
      setRegionName('');
      setCustomDescription('');
      setUseCustomDescription(false);
      setGeneratedImage(null);
      setSelectedPosition(currentPos);
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      console.error('スタンプ保存エラー:', err);
      if (err.message.includes('longer than 1048487 bytes')) {
        setError('画像が大きすぎます。より小さな画像を生成してください。');
      } else {
        setError('スタンプの保存に失敗しました: ' + err.message);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  // 地域名から地図を移動する関数
  const handleJumpToRegion = async () => {
    if (!regionName.trim()) return;
    setIsJumping(true);
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const url = `${GEOCODE_API}?address=${encodeURIComponent(regionName)}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        setSelectedPosition({ lat: loc.lat, lng: loc.lng });
      } else {
        setError('該当する地域が見つかりませんでした');
      }
    } catch (e) {
      setError('位置検索に失敗しました');
    } finally {
      setIsJumping(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '0 auto', 
      padding: 24, 
      background: '#fff', 
      borderRadius: 16, 
      boxShadow: '0 2px 16px rgba(0,0,0,0.08)' 
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        color: '#ff6b35', 
        marginBottom: 32, 
        letterSpacing: 2, 
        fontWeight: 700, 
        fontSize: 28 
      }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>🎨</span>AIスタンプ生成
      </h2>

      {/* ポイント情報表示 */}
      <div style={{ 
        background: '#e3f2fd', 
        borderRadius: 12, 
        padding: 16, 
        marginBottom: 24, 
        border: '1px solid #90caf9' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: '#1976d2' }}>現在のポイント:</strong>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1976d2', 
              marginLeft: 8 
            }}>
              {currentUserProgress?.points || 0} pt
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {(() => {
              const stabilityApiKey = import.meta.env.VITE_STABILITY_API_KEY;
              const replicateApiKey = import.meta.env.VITE_REPLICATE_API_KEY;
              const hasStabilityKey = !!stabilityApiKey && stabilityApiKey !== 'your_stability_api_key_here';
              const hasReplicateKey = !!replicateApiKey && replicateApiKey !== 'your_replicate_api_key_here';
              
              if (hasStabilityKey) return 'Stability AI API: ✅';
              if (hasReplicateKey) return 'Replicate API: ✅';
              return 'APIキー: ❌';
            })()}
          </div>
        </div>
        <div style={{ 
          background: hasEnoughPoints() ? '#e8f5e9' : '#ffebee', 
          color: hasEnoughPoints() ? '#2e7d32' : '#c62828',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '600',
          marginTop: 8
        }}>
          {hasEnoughPoints() ? '✓ 生成可能' : `✗ ${STAMP_GENERATION_COST}ポイント必要`}
        </div>
        <div style={{ 
          fontSize: '14px', 
          color: '#666', 
          marginTop: 8 
        }}>
          AIスタンプ生成には <strong>{STAMP_GENERATION_COST}ポイント</strong> が必要です
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* 左側: フォーム */}
        <div>
          <h3 style={{ color: '#333', marginBottom: 20, fontSize: 20, fontWeight: 600 }}>
            スタンプ情報
          </h3>

          {/* スタンプ名 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#333', 
              fontWeight: 500 
            }}>
              スタンプ名 *
            </label>
            <input
              type="text"
              value={stampName}
              onChange={(e) => setStampName(e.target.value)}
              placeholder="例: 東京タワー、浅草寺..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff6b35'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {/* スタンプ説明 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#333', 
              fontWeight: 500 
            }}>
              スタンプの説明 *
            </label>
            <textarea
              value={stampDescription}
              onChange={(e) => setStampDescription(e.target.value)}
              placeholder="このスタンプについて説明してください..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                transition: 'border-color 0.3s',
                resize: 'vertical'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff6b35'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {/* タグ入力 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#333', 
              fontWeight: 500 
            }}>
              タグ
            </label>
            
            {/* タグ表示 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {stampTags.map(tag => (
                <span 
                  key={tag} 
                  style={{ 
                    background: '#e3f2fd', 
                    color: '#1976d2', 
                    borderRadius: 16, 
                    fontSize: 14, 
                    padding: '6px 12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f44336',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 0,
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* タグ入力フォーム */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  placeholder="タグを入力..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff6b35'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
                <button
                  onClick={() => handleAddTag(newTag)}
                  disabled={!newTag.trim()}
                  style={{
                    padding: '8px 16px',
                    background: newTag.trim() ? '#1976d2' : '#e0e0e0',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: newTag.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  追加
                </button>
              </div>

              {/* タグ候補 */}
              {suggestedTags.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: 'auto'
                }}>
                  {suggestedTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: '#333',
                        borderBottom: '1px solid #f0f0f0'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.target.style.background = 'none'}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 地域名入力 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              color: '#333', 
              fontWeight: 500 
            }}>
              地域名 *
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="例: 東京、京都、大阪..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff6b35'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button
                onClick={handleJumpToRegion}
                disabled={isJumping || !regionName.trim()}
                style={{
                  padding: '12px 16px',
                  background: isJumping ? '#ccc' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isJumping ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s',
                  whiteSpace: 'nowrap'
                }}
              >
                {isJumping ? '移動中...' : 'ジャンプ'}
              </button>
            </div>
          </div>

          {/* カスタム説明文入力 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 8,
              gap: 8
            }}>
              <label style={{ 
                color: '#333', 
                fontWeight: 500,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={useCustomDescription}
                  onChange={(e) => setUseCustomDescription(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                カスタム説明文を使用
              </label>
            </div>
            
            {useCustomDescription && (
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 8, 
                  color: '#333', 
                  fontWeight: 500 
                }}>
                  スタンプ生成用の説明文
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="例: 桜の季節の美しい景色、伝統的な寺社仏閣、現代的なビル群、地元の名物料理など、この地域の特徴を詳しく説明してください..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'border-color 0.3s',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff6b35'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: 4 
                }}>
                  ※ この説明文はAIがスタンプを生成する際のプロンプトに使用されます
                </div>
              </div>
            )}
          </div>

          {/* 生成ボタン */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerateStamp}
                disabled={isGenerating || !regionName.trim() || !hasEnoughPoints()}
                style={{
                  padding: '12px 16px',
                  background: isGenerating || !hasEnoughPoints() ? '#ccc' : '#ff6b35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isGenerating || !hasEnoughPoints() ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s',
                  whiteSpace: 'nowrap'
                }}
              >
                {isGenerating ? '生成中...' : '生成'}
              </button>
            </div>
          </div>

          {/* キャッシュクリアボタン */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={handleClearCache}
              style={{
                padding: '8px 16px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
            >
              キャッシュクリア
            </button>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div style={{ 
              background: '#ffebee', 
              color: '#c62828', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: 20 
            }}>
              {error}
            </div>
          )}

          {/* 成功メッセージ */}
          {success && (
            <div style={{ 
              background: '#e8f5e8', 
              color: '#2e7d32', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: 20 
            }}>
              {success}
            </div>
          )}

          {/* 保存ボタン */}
          <button
            onClick={handleSaveStamp}
            disabled={!stampName || !stampDescription || !selectedPosition || !generatedImage || isOptimizing}
            style={{
              width: '100%',
              padding: '16px',
              background: (!stampName || !stampDescription || !selectedPosition || !generatedImage || isOptimizing) ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: (!stampName || !stampDescription || !selectedPosition || !generatedImage || isOptimizing) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            {isOptimizing ? '画像最適化中...' : 'スタンプを保存'}
          </button>
        </div>

        {/* 右側: 地図と生成された画像 */}
        <div>
          <h3 style={{ color: '#333', marginBottom: 20, fontSize: 20, fontWeight: 600 }}>
            位置選択
          </h3>

          {/* 地図 */}
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={selectedPosition || currentPos || center}
              zoom={15}
              onClick={handleMapClick}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
              }}
            >
              {selectedPosition && (
                <Marker
                  position={selectedPosition}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div style={{ 
              height: 300, 
              background: '#f5f5f5', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '12px'
            }}>
              Loading Map...
            </div>
          )}

          {/* 生成中のローディング */}
          {isGenerating && (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              color: '#666',
              background: '#f9f9f9',
              borderRadius: '8px',
              marginTop: '16px'
            }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                border: '3px solid #f3f3f3', 
                borderTop: '3px solid #ff6b35', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }}></div>
              <p>AIがスタンプ画像を生成しています...</p>
            </div>
          )}

          {/* 生成された画像 */}
          {generatedImage && !isGenerating && !isOptimizing && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ 
                color: '#333', 
                marginBottom: 12, 
                fontSize: 16, 
                fontWeight: 600 
              }}>
                生成されたスタンプ
              </h4>
              <div style={{ 
                textAlign: 'center',
                background: '#f9f9f9',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <img 
                  src={generatedImage} 
                  alt="Generated Stamp" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '200px', 
                    borderRadius: '8px',
                    border: '2px solid #e0e0e0'
                  }} 
                />
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  color: '#666' 
                }}>
                  サイズ: {(checkImageSize(generatedImage) / 1024).toFixed(1)}KB
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* コスト確認ダイアログ */}
      {showCostConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#ff6b35', marginBottom: '16px' }}>
              🎨 AIスタンプ生成
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '16px' }}>
              AIスタンプを生成するには <strong>{STAMP_GENERATION_COST}ポイント</strong> が必要です。
            </p>
            <div style={{ 
              background: '#e3f2fd', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '20px' 
            }}>
              <div>現在のポイント: <strong>{currentUserProgress?.points || 0}</strong></div>
              <div>消費後: <strong>{Math.max(0, (currentUserProgress?.points || 0) - STAMP_GENERATION_COST)}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCostConfirmation(false)}
                style={{
                  padding: '10px 20px',
                  background: '#e0e0e0',
                  color: '#666',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmAndGenerate}
                style={{
                  padding: '10px 20px',
                  background: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                生成する
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
