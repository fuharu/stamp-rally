import React, { useState } from 'react';

export default function RankingPage({ ranking, user }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleUserClick = (userId) => {
    const user = ranking.find(u => u.userId === userId);
    setSelectedUser(user);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedUser(null);
    setShowDetails(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ textAlign: 'center', color: '#4caf50', marginBottom: 12 }}>
          🏆 ランキング
        </h2>
        {user && (
          <div style={{ 
            background: '#e8f5e9',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden' }}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    {user.displayName[0]}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{user.displayName}</div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>現在のポイント: {user.points || 0}</div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>取得したスタンプ: {user.stamps?.length || 0} 個</div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        {ranking.map((otherUser, index) => {
          const isCurrentUser = user?.uid === otherUser.userId;
          return (
            <div
              key={otherUser.userId}
              onClick={() => handleUserClick(otherUser.userId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                borderBottom: index < ranking.length - 1 ? '1px solid #e0e0e0' : 'none',
                background: isCurrentUser ? '#e8f5e9' : (index < 3 ? '#f5f5f5' : 'transparent'),
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 'bold', width: 40, color: isCurrentUser ? '#4caf50' : (index < 3 ? '#4caf50' : '#666') }}>
                {index + 1}
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', margin: '0 12px' }}>
                {otherUser.photoURL ? (
                  <img
                    src={otherUser.photoURL}
                    alt={otherUser.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    {otherUser.displayName[0]}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: isCurrentUser ? '#4caf50' : 'inherit' }}>{otherUser.displayName}</div>
                <div style={{ fontSize: 14, color: '#666' }}>{otherUser.points} ポイント</div>
              </div>
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
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginBottom: 20 }}>
              {selectedUser.displayName} の詳細情報
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', margin: '0 20px' }}>
                {selectedUser.photoURL ? (
                  <img
                    src={selectedUser.photoURL}
                    alt={selectedUser.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24 }}>
                    {selectedUser.displayName[0]}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: 8 }}>
                  {selectedUser.displayName}
                </div>
                <div style={{ color: '#666', marginBottom: 16 }}>
                  {selectedUser.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4caf50' }}>🏆</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedUser.points} ポイント</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#f44336' }}>📍</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedUser.stamps?.length || 0} 個のスタンプ</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 20 }}>
              <h4 style={{ color: '#4caf50', marginBottom: 12 }}>取得したスタンプ</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {selectedUser.stamps?.map((stampId, index) => (
                  <div key={index} style={{
                    background: '#e8f5e9',
                    padding: 12,
                    borderRadius: 8,
                    flex: '0 1 45%'
                  }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>スタンプ {stampId}</div>
                    <div style={{ color: '#666', fontSize: '0.9em' }}>取得日時: {new Date(selectedUser.stamps[stampId].timestamp).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}