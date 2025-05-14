import React from 'react';

export function Profile({ user, showProfile, setShowProfile, shareProgress }) {
  return (
    <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }}>
      <button
        onClick={() => setShowProfile(!showProfile)}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {/* プロフィールアイコン表示部分 */}
        {user.photoURL ? (
          <img src={user.photoURL} alt="プロフィール" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', borderRadius: '50%' }}>
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </button>
      
      {showProfile && (
        <div style={{
          position: 'absolute',
          top: '50px',
          right: '24px',
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          width: '280px',
          maxWidth: 'calc(100vw - 48px)',
          zIndex: 1000
        }}>
          {/* プロフィール内容 */}
        </div>
      )}
    </div>
  );
}