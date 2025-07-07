import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export function Profile({ user, showProfile, setShowProfile, shareProgress }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowProfile(false);
      navigate('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handleLogin = () => {
    setShowProfile(false);
    navigate('/login');
  };

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
        {user ? (
          user.photoURL ? (
            <img src={user.photoURL} alt="プロフィール" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', borderRadius: '50%' }}>
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#9e9e9e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', borderRadius: '50%' }}>
            👤
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
          {user ? (
            <>
              <div style={{ marginBottom: 12, borderBottom: '1px solid #e0e0e0', paddingBottom: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: 4 }}>
                  {user.displayName || 'ユーザー'}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 8 }}>
                  ログインしてください
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  スタンプラリーを楽しむにはログインが必要です
                </div>
              </div>
              <button
                onClick={handleLogin}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ログイン
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}