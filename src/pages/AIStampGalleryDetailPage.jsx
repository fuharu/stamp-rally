import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateUserData } from '../firebase';

export default function AIStampGalleryDetailPage({ user, gotStamps = [], onStampUpdate }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stamp, setStamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const db = getFirestore();

  // URLパラメータからコレクションタイプを取得
  const collectionType = searchParams.get('type') || 'custom_stamps';
  const isOfficial = collectionType === 'official_stamps';

  // タグ候補（一般的なタグ）
  const commonTags = [
    '観光', '歴史', '自然', '文化', '食べ物', 'ショッピング', 'レジャー', 'アート',
    '博物館', '公園', '寺社', '城', 'タワー', '駅', '空港', '港', '温泉', '山', '海',
    '川', '湖', '森', '花', '動物', '夜景', '朝日', '夕日', '雪', '桜', '紅葉',
    '東京', '大阪', '京都', '名古屋', '福岡', '札幌', '仙台', '広島', '沖縄'
  ];

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const ref = doc(db, collectionType, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setStamp({ id: snap.id, ...snap.data(), isOfficial });
      }
      setLoading(false);
    };
    fetch();
  }, [db, id, collectionType, isOfficial]);

  // タグ候補をフィルタリング
  useEffect(() => {
    if (newTag.trim()) {
      const filtered = commonTags.filter(tag => 
        tag.toLowerCase().includes(newTag.toLowerCase()) && 
        !(stamp?.tags || []).includes(tag)
      );
      setSuggestedTags(filtered.slice(0, 5));
    } else {
      setSuggestedTags([]);
    }
  }, [newTag, stamp?.tags]);

  // タグを追加
  const handleAddTag = async (tagToAdd) => {
    if (!user || !stamp || isOfficial || stamp.createdBy !== user.uid) return;
    
    const tag = tagToAdd.trim();
    if (!tag || (stamp.tags || []).includes(tag)) return;

    setIsUpdating(true);
    try {
      const updatedTags = [...(stamp.tags || []), tag];
      const stampRef = doc(db, collectionType, id);
      await updateDoc(stampRef, { tags: updatedTags });
      setStamp(prev => ({ ...prev, tags: updatedTags }));
      setNewTag('');
      setSuggestedTags([]);
    } catch (error) {
      console.error('タグの追加に失敗しました:', error);
      alert('タグの追加に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  // タグを削除
  const handleRemoveTag = async (tagToRemove) => {
    if (!user || !stamp || isOfficial || stamp.createdBy !== user.uid) return;

    setIsUpdating(true);
    try {
      const updatedTags = (stamp.tags || []).filter(tag => tag !== tagToRemove);
      const stampRef = doc(db, collectionType, id);
      await updateDoc(stampRef, { tags: updatedTags });
      setStamp(prev => ({ ...prev, tags: updatedTags }));
    } catch (error) {
      console.error('タグの削除に失敗しました:', error);
      alert('タグの削除に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  // Enterキーでタグを追加
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag(newTag);
    }
  };

  // スタンプ取得処理（スタンプラリーページに飛ぶ）
  const handleGetStamp = () => {
    // スタンプラリーページに飛んで、そのスタンプを選択状態にする
    navigate(`/stamp-rally?selected=${id}`);
  };

  // デバッグ用スタンプ取得（距離に関係なく）
  const handleDebugGetStamp = async () => {
    if (!user || gotStamps.includes(id)) return;
    
    try {
      // 新しい配列を作成
      const updated = [...gotStamps, id];
      
      // ローカルストレージに保存
      localStorage.setItem('gotStamps', JSON.stringify(updated));
      
      // スタンプ取得日時を記録
      const acquiredAt = new Date().toISOString();
      localStorage.setItem(`stamp_${id}_acquiredAt`, acquiredAt);
      
      // 位置ベースのポイント計算
      const points = calculateLocationBasedPoints(updated);
      
      // ユーザーデータの更新
      await updateUserData(user.uid, {
        stamps: updated,
        points,
        totalDistance: 0,
        steps: 0
      });
      
      // 成功メッセージ
      alert(`スタンプを取得しました！+${points - (gotStamps.length * 5)}pt (3日おき計算)`);
      
      // 親コンポーネントに更新を通知（propsで渡された場合）
      if (typeof onStampUpdate === 'function') {
        onStampUpdate(updated);
      }
      
    } catch (error) {
      console.error('スタンプ取得処理でエラーが発生:', error);
      alert('スタンプの取得に失敗しました');
    }
  };

  // 位置ベースのポイント計算関数
  const calculateLocationBasedPoints = (stampIds) => {
    // 現在のスタンプデータを使用
    const allStamps = [stamp];
    
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
      // 3日おきのポイント計算
      const pointsForLocation = calculateTimeBasedPoints(stampsInLocation);
      totalPoints += pointsForLocation;
      console.log(`位置 ${locationKey}: ${stampsInLocation.length}個のスタンプ、ポイント: ${pointsForLocation}`);
    });
    
    return totalPoints;
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

  if (loading) return <div style={{ textAlign: 'center', margin: 40 }}>読み込み中...</div>;
  if (!stamp) return <div style={{ textAlign: 'center', margin: 40 }}>スタンプが見つかりません</div>;

  const isOwner = user && !isOfficial && stamp.createdBy === user.uid;
  const creatorName = isOfficial ? '運営' : (stamp.createdByName || '匿名');
  const isAcquired = gotStamps.includes(id);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }}>
      {/* 戻るボタン */}
      <button 
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: 16,
          cursor: 'pointer',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        ← 戻る
      </button>

      <img 
        src={isOfficial ? stamp.imageUrl : stamp.imageData} 
        alt={stamp.name || stamp.regionName} 
        style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, marginBottom: 24 }} 
      />
      <h2 style={{ color: '#9c27b0', fontWeight: 700, fontSize: 28, marginBottom: 12 }}>{stamp.name || stamp.regionName}</h2>
      <div style={{ color: '#666', fontSize: 15, marginBottom: 8 }}>作成者: {creatorName}</div>
      <div style={{ color: '#333', fontSize: 16, marginBottom: 16 }}>{stamp.description || '説明はありません'}</div>

      {/* タグ表示・編集セクション */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ color: '#333', fontSize: 18, fontWeight: 600, margin: 0 }}>タグ</h3>
          {isOwner && (
            <button
              onClick={() => setEditingTags(!editingTags)}
              style={{
                background: editingTags ? '#f44336' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 14,
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {editingTags ? '編集終了' : 'タグ編集'}
            </button>
          )}
          {isOfficial && (
            <span style={{ 
              color: '#1976d2', 
              fontSize: 14, 
              fontWeight: 500,
              background: '#e3f2fd',
              padding: '4px 8px',
              borderRadius: 4
            }}>
              公式スタンプ
            </span>
          )}
        </div>

        {/* タグ表示 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: editingTags ? 16 : 0 }}>
          {(stamp.tags || []).map(tag => (
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
              {editingTags && isOwner && (
                <button
                  onClick={() => handleRemoveTag(tag)}
                  disabled={isUpdating}
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
              )}
            </span>
          ))}
          {(stamp.tags || []).length === 0 && (
            <span style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
              タグが設定されていません
            </span>
          )}
        </div>

        {/* タグ追加フォーム（ユーザー作成スタンプのみ） */}
        {editingTags && isOwner && !isOfficial && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="新しいタグを入力..."
                disabled={isUpdating}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1976d2'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim() || isUpdating}
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

            {/* 更新中表示 */}
            {isUpdating && (
              <div style={{ 
                textAlign: 'center', 
                color: '#666', 
                fontSize: 14, 
                marginTop: 8,
                fontStyle: 'italic'
              }}>
                更新中...
              </div>
            )}
          </div>
        )}
      </div>

      {/* いいね数表示 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#666', fontSize: 14, marginBottom: 4 }}>いいね</div>
        <div style={{ color: '#f57c00', fontSize: 18, fontWeight: 600 }}>👍 {stamp.likes || 0}</div>
      </div>

      {/* スタンプ取得ボタン */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button 
          style={{ 
            flex: 1,
            padding: '16px', 
            background: isAcquired ? '#4caf50' : '#4caf50', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            fontSize: 18, 
            fontWeight: 700, 
            cursor: isAcquired ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isAcquired) {
              e.target.style.background = '#45a049';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAcquired) {
              e.target.style.background = '#4caf50';
            }
          }}
          onClick={isAcquired ? undefined : handleGetStamp}
          disabled={isAcquired}
        >
          {isAcquired ? '取得済み' : 'スタンプラリーで取得'}
        </button>
        <button 
          style={{ 
            padding: '16px 24px', 
            background: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: 8, 
            fontSize: 16, 
            fontWeight: 700, 
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#d32f2f'}
          onMouseLeave={(e) => e.target.style.background = '#f44336'}
          onClick={handleDebugGetStamp}
        >
          デバッグ取得
        </button>
      </div>
    </div>
  );
} 