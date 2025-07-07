import React, { useState } from 'react';

// ユーザーアイコンコンポーネント
const UserAvatar = ({ user, size = 40, showBorder = false }) => {
  const avatarSize = size;
  const fontSize = Math.max(12, size * 0.4);
  
  return (
    <div 
      style={{ 
        width: avatarSize, 
        height: avatarSize, 
        borderRadius: '50%', 
        overflow: 'hidden',
        border: showBorder ? '2px solid #4caf50' : 'none',
        boxShadow: showBorder ? '0 2px 8px rgba(76, 175, 80, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
        background: '#f5f5f5'
      }}
    >
      {user?.photoURL ? (
        <img
          src={user.photoURL}
          alt={user.displayName || 'ユーザー'}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }}
          referrerPolicy="no-referrer"
          onError={(e) => {
            // 画像読み込みエラー時のフォールバック
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          background: user?.photoURL ? 'transparent' : '#4caf50',
          display: user?.photoURL ? 'none' : 'flex',
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white',
          fontSize: fontSize,
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}
      >
        {user?.displayName?.[0] || user?.email?.[0] || '?'}
      </div>
    </div>
  );
};

export default function RankingPage({ ranking = [], user, currentUserProgress, onStampUpdate }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // デバッグ情報を追加
  console.log('RankingPage - ranking prop:', ranking);
  console.log('RankingPage - user prop:', user);
  console.log('RankingPage - currentUserProgress prop:', currentUserProgress);

  // 現在のユーザー情報を取得（ranking配列からuserId一致を優先）
  const normalize = str => (str || '').toLowerCase();
  const currentUserData = ranking.find(u => normalize(u.userId) === normalize(user?.uid)) ||
    ranking.find(u => normalize(u.userId) === normalize(user?.userId)) ||
    user || currentUserProgress;

  const getDisplayName = (u) => u.displayName || u.displayname || u.email?.split('@')[0] || 'ゲスト';
  const getEmail = (u) => u.email || 'メールアドレス未設定';

  const handleUserClick = (userId) => {
    const user = ranking.find(u => u.userId === userId);
    setSelectedUser(user);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedUser(null);
    setShowDetails(false);
  };

  // ランキングアイコンを取得
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  // rankingが空の場合はメッセージを表示
  if (!ranking || ranking.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
        <h2 style={{ textAlign: 'center', color: '#4caf50', marginBottom: 12 }}>
          🏆 ランキング
        </h2>
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 20, 
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          まだランキングデータがありません
          <div style={{ marginTop: 10, fontSize: '0.8em', color: '#666' }}>
            デバッグ情報:
            <br />
            ranking: {JSON.stringify(ranking)}
            <br />
            ranking.length: {ranking?.length || 0}
            <br />
            ranking type: {typeof ranking}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ textAlign: 'center', color: '#4caf50', marginBottom: 12 }}>
          🏆 ランキング
        </h2>
        
        {/* デバッグ情報表示（非表示化）
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '8px', 
          padding: '12px', 
          marginBottom: '16px',
          fontSize: '12px',
          color: '#856404'
        }}>
          <strong>デバッグ情報:</strong><br />
          User UID: {currentUser?.uid || 'なし'}<br />
          User DisplayName: {currentUser?.displayName || 'なし'}<br />
          User PhotoURL: {currentUser?.photoURL ? 'あり' : 'なし'}<br />
          Ranking Count: {ranking.length}<br />
          Current User in Ranking: {ranking.find(u => u.userId === currentUser?.uid) ? 'あり' : 'なし'}
        </div>
        */}

        {currentUserData && (
          <div style={{ 
            background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '2px solid #4caf50',
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <UserAvatar user={currentUserData} size={50} showBorder={true} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#2e7d32' }}>
                  {getDisplayName(currentUserData)}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em', marginTop: '4px' }}>
                  現在のポイント: <span style={{ fontWeight: 'bold', color: '#4caf50' }}>{currentUserData.points || 0}</span>
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>
                  取得したスタンプ: <span style={{ fontWeight: 'bold', color: '#4caf50' }}>{currentUserData.stamps?.length || 0}</span> 個
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        {ranking.map((otherUser, index) => {
          const isCurrentUser = currentUserData?.uid === otherUser.userId;
          const rank = index + 1;
          
          return (
            <div
              key={otherUser.userId}
              onClick={() => handleUserClick(otherUser.userId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px',
                borderBottom: index < ranking.length - 1 ? '1px solid #e0e0e0' : 'none',
                background: isCurrentUser 
                  ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' 
                  : (rank <= 3 ? '#f9f9f9' : 'transparent'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: rank <= 3 ? '8px' : '0',
                marginBottom: rank <= 3 ? '8px' : '0',
                border: isCurrentUser ? '2px solid #4caf50' : 'none',
                boxShadow: isCurrentUser ? '0 4px 12px rgba(76, 175, 80, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isCurrentUser) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrentUser) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            >
              <div style={{ 
                fontSize: rank <= 3 ? 32 : 24, 
                fontWeight: 'bold', 
                width: 50, 
                textAlign: 'center',
                color: isCurrentUser ? '#4caf50' : (rank <= 3 ? '#ff9800' : '#666') 
              }}>
                {getRankIcon(rank)}
              </div>
              
              <div style={{ margin: '0 16px' }}>
                <UserAvatar user={otherUser} size={45} showBorder={rank <= 3} />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.1em',
                  color: isCurrentUser ? '#4caf50' : (rank <= 3 ? '#ff9800' : 'inherit'),
                  marginBottom: '4px'
                }}>
                  {getDisplayName(otherUser)}
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  <span style={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {otherUser.points || 0}
                  </span> ポイント
                  {otherUser.stamps && (
                    <span style={{ marginLeft: '12px', color: '#999' }}>
                      📍 {otherUser.stamps.length} スタンプ
                    </span>
                  )}
                </div>
              </div>
              
              {isCurrentUser && (
                <div style={{ 
                  background: '#4caf50', 
                  color: 'white', 
                  padding: '4px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  あなた
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showDetails && selectedUser && (
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
        }} onClick={closeDetails}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 450,
            width: '90%',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeDetails}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ✕
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <UserAvatar user={selectedUser} size={100} showBorder={true} />
              <h3 style={{ marginTop: 16, color: '#4caf50', fontSize: '1.5em' }}>
                {getDisplayName(selectedUser)}
              </h3>
              <div style={{ color: '#666', marginTop: 8 }}>
                {getEmail(selectedUser)}
              </div>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 16, 
              marginBottom: 24 
            }}>
              <div style={{ 
                background: '#e8f5e9', 
                padding: 16, 
                borderRadius: 12, 
                textAlign: 'center' 
              }}>
                <div style={{ fontSize: '2em', marginBottom: 8 }}>🏆</div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#4caf50' }}>
                  {selectedUser.points || 0}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>ポイント</div>
              </div>
              
              <div style={{ 
                background: '#fff3e0', 
                padding: 16, 
                borderRadius: 12, 
                textAlign: 'center' 
              }}>
                <div style={{ fontSize: '2em', marginBottom: 8 }}>📍</div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#ff9800' }}>
                  {selectedUser.stamps?.length || 0}
                </div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>スタンプ</div>
              </div>
            </div>
            
            {selectedUser.stamps && selectedUser.stamps.length > 0 && (
              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 20 }}>
                <h4 style={{ color: '#4caf50', marginBottom: 16, textAlign: 'center' }}>
                  取得したスタンプ ({selectedUser.stamps.length}個)
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: 12,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {selectedUser.stamps.map((stamp, index) => (
                    <div key={`${selectedUser.userId}-stamp-${index}`} style={{
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: 4 }}>
                        スタンプ {index + 1}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.8em' }}>
                        取得: {new Date(stamp.timestamp || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}