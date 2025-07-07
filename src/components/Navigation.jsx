import React from 'react';
import { useNavigate } from 'react-router-dom';

export function Navigation({ user, page, navigate, showProfile, setShowProfile }) {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '24px 16px',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0'
    }}>
      {/* 左側のナビゲーションボタン */}
      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={() => { setPage('stamp'); navigate('/stamp'); }}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: page === 'stamp' ? '#1976d2' : '#e3f2fd',
            color: page === 'stamp' ? '#fff' : '#1976d2',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer'
          }}>
          スタンプラリー
        </button>
        <button onClick={() => { setPage('ai-stamp-gallery'); navigate('/ai-stamp-gallery'); }}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: page === 'ai-stamp-gallery' ? '#9c27b0' : '#f3e5f5',
            color: page === 'ai-stamp-gallery' ? '#fff' : '#9c27b0',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer'
          }}>
          スタンプギャラリー
        </button>
      </div>

      {/* 右側のAIスタンプ生成ボタン */}
      <div>
        <button onClick={() => { setPage('ai-stamp'); navigate('/ai-stamp'); }}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: page === 'ai-stamp' ? '#ff6b35' : '#fff3e0',
            color: page === 'ai-stamp' ? '#fff' : '#ff6b35',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
          <span>🎨</span>
          AIスタンプ生成
        </button>
      </div>
    </nav>
  );
}