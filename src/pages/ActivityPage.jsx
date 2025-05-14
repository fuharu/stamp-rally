import React from 'react';

export default function ActivityPage({ totalDistance, steps, elapsed }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#fbc02d', marginBottom: 24, letterSpacing: 2, fontWeight: 700, fontSize: 28 }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>🚶‍♂️</span>運動記録
      </h2>
      <div style={{ background: '#fffde7', borderRadius: 12, padding: 16, marginTop: 20, boxShadow: '0 1px 4px rgba(255,193,7,0.08)' }}>
        <strong style={{ color: '#fbc02d' }}>運動記録</strong>
        <div style={{ display: 'flex', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
          <div>距離: <span style={{ fontWeight: 600 }}>{(totalDistance / 1000).toFixed(2)}</span> km</div>
          <div>歩数: <span style={{ fontWeight: 600 }}>{steps}</span> 歩</div>
          <div>時間: <span style={{ fontWeight: 600 }}>{Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}</span></div>
          <div>消費カロリー: <span style={{ fontWeight: 600 }}>{(steps * 0.04).toFixed(1)}</span> kcal</div>
        </div>
      </div>
    </div>
  );
}
