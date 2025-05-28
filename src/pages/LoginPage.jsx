import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, updateUserData } from '../firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // 新規登録時にPostgreSQLへ初期データ登録
        await updateUserData(userCredential.user.uid, {
          stamps: [],
          points: 0,
          totalDistance: 0,
          steps: 0
        });
      }
      navigate('/');
    } catch (error) {
      setError('ログインに失敗しました：' + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Googleログイン時にもPostgreSQLへ初期データ登録
      await updateUserData(result.user.uid, {
        stamps: [],
        points: 0,
        totalDistance: 0,
        steps: 0
      });
      navigate('/');
    } catch (error) {
      console.error('Googleログインエラー:', error);
      alert('ログインに失敗しました：' + error.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 20 }}>
      <h2>{isLogin ? 'ログイン' : '新規登録'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 15 }}>
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: 10, background: '#1976d2', color: 'white', border: 'none' }}>
          {isLogin ? 'ログイン' : '登録'}
        </button>
      </form>
      <button
        onClick={() => setIsLogin(!isLogin)}
        style={{ width: '100%', marginTop: 10, padding: 10 }}
      >
        {isLogin ? '新規登録へ' : 'ログインへ'}
      </button>
      <button
        onClick={handleGoogleLogin}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '10px',
          fontSize: '16px',
          background: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
          alt="Google Logo"
          style={{ width: '20px', height: '20px' }}
        />
        Googleでログイン
      </button>
    </div>
  );
}
