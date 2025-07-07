import React, { useState, useEffect } from 'react';

export default function ActivityPage({ totalDistance, steps, elapsed }) {
  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem('userHeight');
    return saved ? parseFloat(saved) : '';
  });
  const [weight, setWeight] = useState(() => {
    const saved = localStorage.getItem('userWeight');
    return saved ? parseFloat(saved) : '';
  });
  const [age, setAge] = useState(() => {
    const saved = localStorage.getItem('userAge');
    return saved ? parseInt(saved) : '';
  });
  const [gender, setGender] = useState(() => {
    const saved = localStorage.getItem('userGender');
    return saved || 'male';
  });

  // 身長、体重、年齢、性別が変更されたときにローカルストレージに保存
  useEffect(() => {
    if (height) localStorage.setItem('userHeight', height.toString());
  }, [height]);

  useEffect(() => {
    if (weight) localStorage.setItem('userWeight', weight.toString());
  }, [weight]);

  useEffect(() => {
    if (age) localStorage.setItem('userAge', age.toString());
  }, [age]);

  useEffect(() => {
    localStorage.setItem('userGender', gender);
  }, [gender]);

  // 基礎代謝率（BMR）を計算（Mifflin-St Jeor式）
  const calculateBMR = () => {
    if (!height || !weight || !age) return 0;
    
    if (gender === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  };

  // 歩行による消費カロリーを計算
  const calculateCaloriesBurned = () => {
    if (!weight || !steps) return 0;
    
    // 歩行のMETs値（中程度の歩行速度）
    const mets = 3.5;
    // 歩行時間を推定（1歩あたり0.7秒と仮定）
    const walkingTimeHours = (steps * 0.7) / 3600;
    
    // 消費カロリー = METs × 体重(kg) × 時間(h)
    return mets * weight * walkingTimeHours;
  };

  // 歩幅を計算（身長の45%と仮定）
  const calculateStepLength = () => {
    if (!height) return 0.7; // デフォルト値
    return height * 0.45 / 100; // メートル単位
  };

  // 推定歩数（距離から計算）
  const estimatedSteps = totalDistance / calculateStepLength();

  const bmr = calculateBMR();
  const caloriesBurned = calculateCaloriesBurned();

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#fbc02d', marginBottom: 24, letterSpacing: 2, fontWeight: 700, fontSize: 28 }}>
        <span style={{ verticalAlign: 'middle', marginRight: 8 }}>🚶‍♂️</span>運動記録
      </h2>

      {/* 身体情報入力フォーム */}
      <div style={{ background: '#f3e5f5', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(156,39,176,0.08)' }}>
        <h3 style={{ color: '#7b1fa2', marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
          📏 身体情報
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 14 }}>
              身長 (cm)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(parseFloat(e.target.value) || '')}
              placeholder="170"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 14 }}>
              体重 (kg)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || '')}
              placeholder="60"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 14 }}>
              年齢
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value) || '')}
              placeholder="25"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: '#666', fontSize: 14 }}>
              性別
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </div>
        </div>
      </div>

      {/* 運動記録 */}
      <div style={{ background: '#fffde7', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(255,193,7,0.08)' }}>
        <h3 style={{ color: '#fbc02d', marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
          📊 運動記録
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>総距離</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f57c00' }}>
              {(totalDistance / 1000).toFixed(2)} km
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>歩数</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f57c00' }}>
              {steps || Math.round(estimatedSteps)} 歩
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>運動時間</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f57c00' }}>
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff3e0', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>消費カロリー</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f57c00' }}>
              {caloriesBurned > 0 ? caloriesBurned.toFixed(1) : (steps * 0.04).toFixed(1)} kcal
            </div>
          </div>
        </div>
      </div>

      {/* 身体情報に基づく詳細情報 */}
      {height && weight && age && (
        <div style={{ background: '#e8f5e9', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(76,175,80,0.08)' }}>
          <h3 style={{ color: '#388e3c', marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
            💪 身体情報に基づく計算結果
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f1f8e9', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>基礎代謝率</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>
                {bmr.toFixed(0)} kcal/日
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f1f8e9', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>推定歩幅</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>
                {calculateStepLength().toFixed(2)} m
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f1f8e9', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>BMI</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>
                {((weight / Math.pow(height / 100, 2))).toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f1f8e9', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>歩行効率</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#388e3c' }}>
                {((caloriesBurned / (steps || estimatedSteps)) * 1000).toFixed(1)} cal/1000歩
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div style={{ marginTop: 20, padding: '12px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
        <div style={{ fontSize: '12px', color: '#856404' }}>
          <strong>注意:</strong> 消費カロリーは推定値です。実際の消費カロリーは歩行速度、地形、個人差により変動します。
        </div>
      </div>
    </div>
  );
}
