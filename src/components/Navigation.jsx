import React from 'react';
import { useNavigate } from 'react-router-dom';

export function Navigation({ user, page, navigate, showProfile, setShowProfile }) {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      padding: '24px 0',
      background: '#fff',
      borderBottom: '1px solid #e0e0e0'
    }}>
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
      // ... existing code ...
    </nav>
  );
}