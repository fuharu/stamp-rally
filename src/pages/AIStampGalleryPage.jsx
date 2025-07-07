import React, { useEffect, useState, useCallback } from 'react';
import { getFirestore, collection, query, orderBy, getDocs, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { updateUserData } from '../firebase';

const PAGE_SIZE = 12;
const CATEGORIES = ['すべて', '動物', '食べ物', '風景', '建物', '自然', 'アート', 'その他'];
const SORT_OPTIONS = ['新着順', '人気順', 'ランダム', '名前順'];

export default function AIStampGalleryPage({ user, gotStamps = [], onStampUpdate }) {
  const [tab, setTab] = useState('official'); // 'official' or 'custom'
  const [subTab, setSubTab] = useState('all'); // 'all', 'unacquired', 'acquired', 'mine'
  const [sort, setSort] = useState('新着順');
  const [category, setCategory] = useState('すべて');
  const [creator, setCreator] = useState('すべて');
  const [tagFilter, setTagFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allStamps, setAllStamps] = useState([]); // 全スタンプを保持する状態
  const [loading, setLoading] = useState(false);
  const [likedStamps, setLikedStamps] = useState([]); // いいね済みIDリスト
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // 初期化完了フラグ
  const navigate = useNavigate();
  const db = getFirestore();

  // いいね済みスタンプを取得
  useEffect(() => {
    if (!user) return;
    const fetchLiked = async () => {
      const likesCol = collection(db, 'users', user.uid, 'liked_stamps');
      const snap = await getDocs(likesCol);
      setLikedStamps(snap.docs.map(doc => doc.id));
    };
    fetchLiked();
  }, [user, db]);

  // fetchStamps関数は削除（allStampsで全データを取得済み）

  // 全スタンプを取得（初期化用）
  const fetchAllStamps = useCallback(async () => {
    if (isInitialized) return;
    
    console.log('全スタンプ取得開始');
    setLoading(true);
    
    try {
      console.log('Firestore接続確認:', !!db);
      
      // 公式スタンプとカスタムスタンプを並行取得
      console.log('公式スタンプ取得開始');
      const officialSnap = await getDocs(query(collection(db, 'official_stamps'), orderBy('createdAt', 'desc')));
      console.log('公式スタンプ取得完了:', officialSnap.docs.length);
      
      console.log('カスタムスタンプ取得開始');
      const customSnap = await getDocs(query(collection(db, 'custom_stamps'), orderBy('createdAt', 'desc')));
      console.log('カスタムスタンプ取得完了:', customSnap.docs.length);
      
      const officialStamps = officialSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isOfficial: true
      }));
      
      const customStamps = customSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isOfficial: false
      }));
      
      const allStampsData = [...officialStamps, ...customStamps];
      console.log('全スタンプ取得完了:', { 
        official: officialStamps.length, 
        custom: customStamps.length, 
        total: allStampsData.length 
      });
      
      setAllStamps(allStampsData);
      setIsInitialized(true);
      console.log('初期化完了フラグを設定');
    } catch (error) {
      console.error('全スタンプ取得エラー:', error);
      console.error('エラー詳細:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      // エラーが発生しても初期化を完了させる
      setIsInitialized(true);
    } finally {
      setLoading(false);
      console.log('ローディング状態をfalseに設定');
    }
  }, [db, isInitialized]);

  // 初期化時に全スタンプを取得
  useEffect(() => {
    console.log('初期化useEffect実行:', { isInitialized, loading });
    if (!isInitialized && !loading) {
      fetchAllStamps();
    }
  }, [fetchAllStamps, isInitialized, loading]);

  // タブ切り替え時の処理（無限スクロールは使用しない）
  useEffect(() => {
    if (!isInitialized) return; // 初期化完了まで待機
    
    console.log('タブ切り替え:', { tab, category });
    setSubTab('all'); // サブタブをリセット
  }, [tab, category, isInitialized]);

  // いいね処理（公式スタンプとユーザー作成スタンプ両方対応）
  const handleLike = async (stampId) => {
    if (!user || likedStamps.includes(stampId)) return;
    
    const collectionName = tab === 'official' ? 'official_stamps' : 'custom_stamps';
    
    // 1. スタンプのlikesをインクリメント
    const stampRef = doc(db, collectionName, stampId);
    await updateDoc(stampRef, { likes: increment(1) });
    
    // 2. ユーザーのliked_stampsサブコレクションに記録
    const userLikeRef = doc(db, 'users', user.uid, 'liked_stamps', stampId);
    await setDoc(userLikeRef, { likedAt: new Date() });
    
    // 3. UI即時反映
    setAllStamps(prev => prev.map(s => s.id === stampId ? { ...s, likes: (s.likes || 0) + 1 } : s));
    setLikedStamps(liked => [...liked, stampId]);
  };

  // スタンプ取得処理（スタンプラリーページに飛ぶ）
  const handleGetStamp = (stampId) => {
    console.log('スタンプ取得ボタンが押されました。ID:', stampId);
    const stamp = allStamps.find(s => s.id === stampId);
    console.log('スタンプの詳細:', stamp);
    
    // スタンプの種類に応じてプレフィックスを付ける
    const prefixedId = stamp?.isOfficial ? `official_${stampId}` : `custom_${stampId}`;
    console.log('プレフィックス付きID:', prefixedId);
    
    // スタンプラリーページに飛んで、そのスタンプを選択状態にする
    navigate(`/stamp-rally?selected=${prefixedId}`);
  };

  // デバッグ用スタンプ取得（距離に関係なく）
  const handleDebugGetStamp = async (stampId) => {
    const stamp = allStamps.find(s => s.id === stampId);
    const prefixedId = stamp?.isOfficial ? `official_${stampId}` : `custom_${stampId}`;
    
    if (!user || gotStamps.includes(prefixedId)) return;
    
    try {
      // 新しい配列を作成
      const updated = [...gotStamps, prefixedId];
      
      // ローカルストレージに保存
      localStorage.setItem('gotStamps', JSON.stringify(updated));
      
      // スタンプ取得日時を記録
      const acquiredAt = new Date().toISOString();
      localStorage.setItem(`stamp_${prefixedId}_acquiredAt`, acquiredAt);
      
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
      
      // スタンプカードにアニメーション効果を追加
      const stampElement = document.querySelector(`[data-stamp-id="${stampId}"]`);
      if (stampElement) {
        stampElement.style.transform = 'scale(1.05)';
        stampElement.style.boxShadow = '0 4px 20px rgba(76, 175, 80, 0.3)';
        setTimeout(() => {
          stampElement.style.transform = 'scale(1)';
          stampElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        }, 300);
      }
      
    } catch (error) {
      console.error('スタンプ取得処理でエラーが発生:', error);
      alert('スタンプの取得に失敗しました');
    }
  };

  // 位置ベースのポイント計算関数
  const calculateLocationBasedPoints = (stampIds) => {
    // 全スタンプデータを使用（公式・カスタム両方）
    const allStampsData = allStamps;
    
    // 取得済みスタンプの位置情報を収集
    const acquiredStamps = allStampsData.filter(stamp => 
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

  // フィルタ・ソート・カテゴリ・クリエイター別のロジック
  let filtered = [];
  
  // 初期化が完了していない場合は空配列を返す
  if (!isInitialized) {
    console.log('初期化未完了のため、フィルタリングをスキップ');
  } else {
    // 現在のタブに応じてフィルタリング対象を決定
    filtered = tab === 'official' 
      ? allStamps.filter(s => s.isOfficial)
      : allStamps.filter(s => !s.isOfficial);
  }
  
  console.log('フィルタリング開始:', { 
    totalStamps: allStamps.length,
    currentTabStamps: filtered.length,
    subTab, 
    category, 
    creator, 
    tagFilter, 
    searchQuery,
    user: user?.uid,
    isInitialized,
    loading
  });
  
  // スタンプの詳細情報をログ出力
  if (filtered.length > 0) {
    console.log('現在のタブスタンプ詳細情報:', filtered.map(s => ({
      id: s.id,
      name: s.name || s.regionName,
      createdBy: s.createdBy,
      createdByName: s.createdByName,
      isOfficial: s.isOfficial,
      tags: s.tags || [],
      hasImageData: !!s.imageData,
      hasImageUrl: !!s.imageUrl
    })));
  }
  
  // 検索クエリでフィルタリング
  if (searchQuery) {
    filtered = filtered.filter(s => 
      (s.name || s.regionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.createdByName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    console.log('検索クエリフィルタ後:', filtered.length);
  }
  
  // サブタブフィルタリング
  if (subTab === 'unacquired') {
    filtered = filtered.filter(s => !gotStamps.includes(s.isOfficial ? `official_${s.id}` : `custom_${s.id}`));
    console.log('未取得フィルタ後:', filtered.length);
  }
  if (subTab === 'acquired') {
    filtered = filtered.filter(s => gotStamps.includes(s.isOfficial ? `official_${s.id}` : `custom_${s.id}`));
    console.log('取得済みフィルタ後:', filtered.length);
  }
  if (subTab === 'mine' && user) {
    filtered = filtered.filter(s => s.createdBy === user.uid);
    console.log('自分のスタンプフィルタ後:', filtered.length);
  }
  
  // カテゴリフィルタリング
  if (category !== 'すべて') {
    const beforeCount = filtered.length;
    filtered = filtered.filter(s => (s.tags || []).includes(category));
    console.log('カテゴリフィルタ後:', filtered.length, `(${beforeCount} → ${filtered.length})`);
    if (beforeCount !== filtered.length) {
      console.log('除外されたスタンプ:', allStamps.filter(s => !filtered.includes(s)).map(s => ({ id: s.id, name: s.name || s.regionName, tags: s.tags || [] })));
    }
  }
  
  // クリエイターフィルタリング
  if (creator !== 'すべて') {
    const beforeCount = filtered.length;
    filtered = filtered.filter(s => s.createdByName === creator);
    console.log('クリエイターフィルタ後:', filtered.length, `(${beforeCount} → ${filtered.length})`);
    if (beforeCount !== filtered.length) {
      console.log('除外されたスタンプ:', allStamps.filter(s => !filtered.includes(s)).map(s => ({ id: s.id, name: s.name || s.regionName, createdByName: s.createdByName })));
    }
  }
  
  // タグフィルタリング
  if (tagFilter) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(s => (s.tags || []).some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase())));
    console.log('タグフィルタ後:', filtered.length, `(${beforeCount} → ${filtered.length})`);
    if (beforeCount !== filtered.length) {
      console.log('除外されたスタンプ:', allStamps.filter(s => !filtered.includes(s)).map(s => ({ id: s.id, name: s.name || s.regionName, tags: s.tags || [] })));
    }
  }
  
  // ソート
  if (sort === '人気順') filtered = [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  if (sort === 'ランダム') filtered = [...filtered].sort(() => Math.random() - 0.5);
  if (sort === '名前順') filtered = [...filtered].sort((a, b) => (a.name || a.regionName || '').localeCompare(b.name || b.regionName || ''));

  console.log('最終フィルタリング結果:', {
    totalStamps: allStamps.length,
    currentTabStamps: tab === 'official' ? allStamps.filter(s => s.isOfficial).length : allStamps.filter(s => !s.isOfficial).length,
    filteredCount: filtered.length,
    filteredStamps: filtered.map(s => ({ id: s.id, name: s.name || s.regionName, isOfficial: s.isOfficial }))
  });

  const creators = Array.from(new Set(allStamps.map(s => s.createdByName || '匿名')));
  const allTags = Array.from(new Set(allStamps.flatMap(s => s.tags || []))).sort();

  // スタンプ詳細ページへのナビゲーション
  const handleStampClick = (stamp) => {
    const collectionName = stamp.isOfficial ? 'official_stamps' : 'custom_stamps';
    navigate(`/ai-stamp-gallery/${stamp.id}?type=${collectionName}`);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2 style={{ textAlign: 'center', color: '#9c27b0', marginBottom: 24, fontWeight: 700, fontSize: 28, letterSpacing: 2 }}>
        スタンプギャラリー
      </h2>
      
      {/* 検索バー */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="スタンプ名、作成者、タグで検索..."
          style={{ 
            width: '100%', 
            padding: '12px 16px', 
            borderRadius: 8, 
            fontSize: 16, 
            border: '2px solid #e0e0e0', 
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#1976d2'}
          onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
        />
      </div>
      
      {/* タブ切り替え */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        <button onClick={() => setTab('official')} style={{ padding: '8px 24px', borderRadius: 8, border: tab === 'official' ? '2px solid #1976d2' : '1px solid #e0e0e0', background: tab === 'official' ? '#1976d2' : '#fff', color: tab === 'official' ? '#fff' : '#1976d2', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>公式スタンプ</button>
        <button onClick={() => setTab('custom')} style={{ padding: '8px 24px', borderRadius: 8, border: tab === 'custom' ? '2px solid #9c27b0' : '1px solid #e0e0e0', background: tab === 'custom' ? '#9c27b0' : '#fff', color: tab === 'custom' ? '#fff' : '#9c27b0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>ユーザー作成スタンプ</button>
      </div>
      
      {/* サブタブ */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        <button onClick={() => setSubTab('all')} style={{ padding: '6px 18px', borderRadius: 6, border: subTab === 'all' ? '2px solid #1976d2' : '1px solid #e0e0e0', background: subTab === 'all' ? '#e3f2fd' : '#fff', color: '#1976d2', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>すべて</button>
        <button onClick={() => setSubTab('unacquired')} style={{ padding: '6px 18px', borderRadius: 6, border: subTab === 'unacquired' ? '2px solid #1976d2' : '1px solid #e0e0e0', background: subTab === 'unacquired' ? '#e3f2fd' : '#fff', color: '#1976d2', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>未取得</button>
        <button onClick={() => setSubTab('acquired')} style={{ padding: '6px 18px', borderRadius: 6, border: subTab === 'acquired' ? '2px solid #1976d2' : '1px solid #e0e0e0', background: subTab === 'acquired' ? '#e3f2fd' : '#fff', color: '#1976d2', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>取得済み</button>
        {tab === 'custom' && (
          <button onClick={() => setSubTab('mine')} style={{ padding: '6px 18px', borderRadius: 6, border: subTab === 'mine' ? '2px solid #1976d2' : '1px solid #e0e0e0', background: subTab === 'mine' ? '#e3f2fd' : '#fff', color: '#1976d2', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>自分のスタンプ</button>
        )}
      </div>
      
      {/* 基本フィルター */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, fontSize: 15, border: '1px solid #ddd' }}>
          {SORT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, fontSize: 15, border: '1px solid #ddd' }}>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            fontSize: 15, 
            border: '1px solid #ddd',
            background: showAdvancedFilters ? '#e3f2fd' : '#fff',
            color: '#1976d2',
            cursor: 'pointer'
          }}
        >
          {showAdvancedFilters ? '詳細フィルターを隠す' : '詳細フィルターを表示'}
        </button>
      </div>
      
      {/* 詳細フィルター */}
      {showAdvancedFilters && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={creator} onChange={e => setCreator(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, fontSize: 15, border: '1px solid #ddd' }}>
              <option value="すべて">すべてのクリエイター</option>
              {creators.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              placeholder="タグで検索..."
              style={{ padding: '8px 12px', borderRadius: 6, fontSize: 15, border: '1px solid #ddd', minWidth: 120 }}
            />
            <button 
              onClick={() => {
                setSearchQuery('');
                setCategory('すべて');
                setCreator('すべて');
                setTagFilter('');
                setSort('新着順');
              }}
              style={{ 
                padding: '8px 16px', 
                borderRadius: 6, 
                fontSize: 15, 
                border: '1px solid #ddd',
                background: '#fff',
                color: '#666',
                cursor: 'pointer'
              }}
            >
              フィルターをリセット
            </button>
          </div>
        </div>
      )}

      {/* 検索結果表示 */}
      {searchQuery && (
        <div style={{ textAlign: 'center', marginBottom: 16, color: '#666' }}>
          「{searchQuery}」の検索結果: {filtered.length}件
        </div>
      )}

      {/* 人気タグ */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 8 }}>人気タグ</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {allTags.slice(0, 8).map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                style={{
                  padding: '4px 12px',
                  background: tagFilter === tag ? '#1976d2' : '#e3f2fd',
                  color: tagFilter === tag ? '#fff' : '#1976d2',
                  border: 'none',
                  borderRadius: 16,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (tagFilter !== tag) {
                    e.target.style.background = '#bbdefb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tagFilter !== tag) {
                    e.target.style.background = '#e3f2fd';
                  }
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 初期化中のローディング表示 */}
      {!isInitialized && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#666',
          background: '#f9f9f9',
          borderRadius: 12,
          margin: '20px 0'
        }}>
          <div style={{ fontSize: 18, marginBottom: 8, color: '#999' }}>
            スタンプを読み込み中...
          </div>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>
            しばらくお待ちください
          </div>
          <div style={{ fontSize: 12, color: '#ccc' }}>
            初期化状態: {isInitialized ? '完了' : '進行中'} | ローディング: {loading ? 'ON' : 'OFF'}
          </div>
        </div>
      )}

      {/* スタンプグリッド */}
      {isInitialized && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {filtered.map(stamp => (
          <div 
            key={stamp.id} 
            data-stamp-id={stamp.id}
            style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative' }}
            onClick={() => handleStampClick(stamp)}
          >
            {/* タイプ・ステータスバッジ */}
            <div style={{ position: 'absolute', top: 8, left: 8, background: stamp.isOfficial ? '#1976d2' : '#9c27b0', color: '#fff', borderRadius: 6, fontSize: 12, padding: '2px 8px', fontWeight: 700 }}>{stamp.isOfficial ? '公式' : 'ユーザー'}</div>
            {gotStamps.includes(stamp.isOfficial ? `official_${stamp.id}` : `custom_${stamp.id}`) && <div style={{ position: 'absolute', top: 8, right: 8, background: '#4caf50', color: '#fff', borderRadius: 6, fontSize: 12, padding: '2px 8px', fontWeight: 700 }}>取得済</div>}
            {user && stamp.createdBy === user.uid && <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#ff9800', color: '#fff', borderRadius: 6, fontSize: 12, padding: '2px 8px', fontWeight: 700 }}>自分</div>}
            {stamp.isOfficial ? (
              <img 
                src={stamp.imageUrl} 
                alt={stamp.name || stamp.regionName} 
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} 
                onError={(e) => {
                  console.error('公式スタンプ画像読み込みエラー:', {
                    id: stamp.id,
                    name: stamp.name || stamp.regionName,
                    imageUrl: stamp.imageUrl
                  });
                  e.target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('公式スタンプ画像読み込み成功:', {
                    id: stamp.id,
                    name: stamp.name || stamp.regionName
                  });
                }}
              />
            ) : (
              <div style={{ 
                width: '100%', 
                height: 120, 
                background: stamp.imageData ? 'transparent' : '#f0f0f0',
                borderRadius: 8, 
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: 12
              }}>
                {stamp.imageData ? (
                  <img 
                    src={stamp.imageData} 
                    alt={stamp.name || stamp.regionName} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} 
                    onError={(e) => {
                      console.error('ユーザー作成スタンプ画像読み込みエラー:', {
                        id: stamp.id,
                        name: stamp.name || stamp.regionName,
                        imageDataLength: stamp.imageData?.length
                      });
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '画像読み込みエラー';
                    }}
                    onLoad={() => {
                      console.log('ユーザー作成スタンプ画像読み込み成功:', {
                        id: stamp.id,
                        name: stamp.name || stamp.regionName
                      });
                    }}
                  />
                ) : (
                  '画像なし'
                )}
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 16, color: '#333', marginBottom: 4 }}>{stamp.name || stamp.regionName}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>作成者: {stamp.isOfficial ? '運営' : (stamp.createdByName || '匿名')}</div>
            <div style={{ fontSize: 13, color: '#fbc02d', fontWeight: 600 }}>+5pt</div>
            
            {/* スタンプ取得ボタン */}
            <div style={{ marginTop: 8 }}>
              {gotStamps.includes(stamp.isOfficial ? `official_${stamp.id}` : `custom_${stamp.id}`) ? (
                <div style={{ 
                  background: '#4caf50', 
                  color: 'white', 
                  padding: '6px 12px', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  fontWeight: 600 
                }}>
                  取得済み
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGetStamp(stamp.id);
                    }}
                    style={{
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      flex: 1
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#1565c0'}
                    onMouseLeave={(e) => e.target.style.background = '#1976d2'}
                  >
                    スタンプ取得
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDebugGetStamp(stamp.id);
                    }}
                    style={{
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#d32f2f'}
                    onMouseLeave={(e) => e.target.style.background = '#f44336'}
                  >
                    デバッグ
                  </button>
                </div>
              )}
            </div>
            
            {/* いいねボタン */}
            <div style={{ marginTop: 8 }}>
              <button 
                style={{ background: 'none', border: 'none', color: likedStamps.includes(stamp.id) ? '#ff9800' : '#e65100', fontSize: 18, cursor: likedStamps.includes(stamp.id) ? 'not-allowed' : 'pointer' }}
                disabled={!user || likedStamps.includes(stamp.id)}
                onClick={e => { e.stopPropagation(); handleLike(stamp.id); }}
              >👍 {stamp.likes || 0}</button>
            </div>
            {/* タグ表示 */}
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(stamp.tags || []).map(tag => (
                <span 
                  key={tag} 
                  style={{ 
                    background: '#e0e0e0', 
                    color: '#666', 
                    borderRadius: 4, 
                    fontSize: 11, 
                    padding: '2px 6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagFilter(tagFilter === tag ? '' : tag);
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#d0d0d0';
                    e.target.style.color = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#e0e0e0';
                    e.target.style.color = '#666';
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
        </div>
      )}
      
      {/* スタンプが見つからない場合のメッセージ */}
      {isInitialized && filtered.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#666',
          background: '#f9f9f9',
          borderRadius: 12,
          margin: '20px 0'
        }}>
          <div style={{ fontSize: 18, marginBottom: 8, color: '#999' }}>
            {searchQuery ? `「${searchQuery}」に一致するスタンプが見つかりませんでした` : 'スタンプが見つかりませんでした'}
          </div>
          <div style={{ fontSize: 14, color: '#999' }}>
            検索条件を変更するか、フィルターをリセットしてみてください
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setCategory('すべて');
              setCreator('すべて');
              setTagFilter('');
              setSort('新着順');
              setSubTab('all');
            }}
            style={{ 
              marginTop: 16,
              padding: '8px 16px', 
              borderRadius: 6, 
              fontSize: 14, 
              border: '1px solid #ddd',
              background: '#fff',
              color: '#1976d2',
              cursor: 'pointer'
            }}
          >
            すべてのフィルターをリセット
          </button>
        </div>
      )}
      
      {/* 無限スクロール関連の要素は削除（allStampsで全データを取得済み） */}
    </div>
  );
} 