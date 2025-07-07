import React, { useState } from 'react';
import { generateStampImage, cacheStampImage, getCachedStampImage } from '../services/stableDiffusion';

export default function CustomStampGenerator({ onStampGenerated }) {
  const [regionName, setRegionName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);
  const [generationHistory, setGenerationHistory] = useState([]);

  // 生成履歴をローカルストレージから読み込み
  React.useEffect(() => {
    const saved = localStorage.getItem('stampGenerationHistory');
    if (saved) {
      try {
        setGenerationHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load generation history:', e);
      }
    }
  }, []);

  // 履歴を保存
  const saveHistory = (newHistory) => {
    setGenerationHistory(newHistory);
    localStorage.setItem('stampGenerationHistory', JSON.stringify(newHistory));
  };

  // スタンプ画像を生成
  const handleGenerateStamp = async () => {
    if (!regionName.trim()) {
      setError('地域名を入力してください');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // まずキャッシュをチェック
      const cachedImage = getCachedStampImage(regionName);
      if (cachedImage) {
        setGeneratedImage(cachedImage);
        setIsGenerating(false);
        return;
      }

      // 新しい画像を生成
      const imageData = await generateStampImage(regionName);
      
      // 画像をキャッシュ
      cacheStampImage(regionName, imageData);
      
      setGeneratedImage(imageData);
      
      // 履歴に追加
      const newStamp = {
        id: Date.now(),
        regionName: regionName,
        imageData: imageData,
        timestamp: new Date().toISOString(),
        isCustom: true
      };
      
      const newHistory = [newStamp, ...generationHistory.slice(0, 9)]; // 最新10件を保持
      saveHistory(newHistory);

      // 親コンポーネントに通知
      if (onStampGenerated) {
        onStampGenerated(newStamp);
      }

    } catch (err) {
      setError('画像の生成に失敗しました: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成されたスタンプを使用
  const useGeneratedStamp = (stamp) => {
    if (onStampGenerated) {
      onStampGenerated(stamp);
    }
  };

  // 履歴から削除
  const removeFromHistory = (stampId) => {
    const newHistory = generationHistory.filter(stamp => stamp.id !== stampId);
    saveHistory(newHistory);
  };

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 16, 
      padding: 24, 
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      marginBottom: 20
    }}>
      <h3 style={{ 
        color: '#1976d2', 
        marginBottom: 20, 
        fontSize: 20, 
        fontWeight: 600,
        textAlign: 'center'
      }}>
        🎨 AIスタンプ生成
      </h3>

      {/* 地域名入力フォーム */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ 
          display: 'block', 
          marginBottom: 8, 
          color: '#333', 
          fontWeight: 500 
        }}>
          地域名を入力してください
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder="例: 東京、京都、大阪、札幌..."
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '16px',
              transition: 'border-color 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#1976d2'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
          <button
            onClick={handleGenerateStamp}
            disabled={isGenerating || !regionName.trim()}
            style={{
              padding: '12px 24px',
              background: isGenerating ? '#ccc' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            {isGenerating ? '生成中...' : '生成'}
          </button>
        </div>
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

      {/* 生成中のローディング */}
      {isGenerating && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666' 
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #1976d2', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>AIがスタンプ画像を生成しています...</p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            通常30秒程度かかります
          </p>
        </div>
      )}

      {/* 生成された画像 */}
      {generatedImage && !isGenerating && (
        <div style={{ marginBottom: 20 }}>
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
            background: '#f5f5f5', 
            borderRadius: '12px', 
            padding: '20px' 
          }}>
            <img
              src={generatedImage}
              alt={`${regionName}のスタンプ`}
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            />
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => useGeneratedStamp({
                  id: Date.now(),
                  regionName: regionName,
                  imageData: generatedImage,
                  timestamp: new Date().toISOString(),
                  isCustom: true
                })}
                style={{
                  padding: '10px 20px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginRight: 8
                }}
              >
                このスタンプを使用
              </button>
              <button
                onClick={() => setGeneratedImage(null)}
                style={{
                  padding: '10px 20px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成履歴 */}
      {generationHistory.length > 0 && (
        <div>
          <h4 style={{ 
            color: '#333', 
            marginBottom: 12, 
            fontSize: 16, 
            fontWeight: 600 
          }}>
            生成履歴
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            {generationHistory.map((stamp) => (
              <div key={stamp.id} style={{ 
                background: '#f9f9f9', 
                borderRadius: '8px', 
                padding: '12px',
                position: 'relative'
              }}>
                <img
                  src={stamp.imageData}
                  alt={`${stamp.regionName}のスタンプ`}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 500, 
                  color: '#333',
                  marginBottom: '4px'
                }}>
                  {stamp.regionName}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  {new Date(stamp.timestamp).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => useGeneratedStamp(stamp)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    使用
                  </button>
                  <button
                    onClick={() => removeFromHistory(stamp.id)}
                    style={{
                      padding: '6px 8px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div style={{ 
        marginTop: 20, 
        padding: '12px', 
        background: '#fff3cd', 
        borderRadius: '8px', 
        border: '1px solid #ffeaa7' 
      }}>
        <div style={{ fontSize: '12px', color: '#856404' }}>
          <strong>注意:</strong> 
          <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li>画像生成には時間がかかる場合があります</li>
            <li>生成された画像は24時間キャッシュされます</li>
            <li>APIキーの設定が必要です（.envファイルにVITE_STABILITY_API_KEYまたはVITE_REPLICATE_API_KEYを追加）</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
