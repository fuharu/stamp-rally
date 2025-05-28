const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'stamp_user',         // PostgreSQLユーザー名
  host: 'localhost',        // DBホスト
  database: 'stamp_rally_db',  // DB名
  password: 'haruto7fujimoto',// パスワード
  port: 5432,               // ポート
});

// 観光地一覧取得API
app.get('/api/tourist_spots', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, lat, lng, description FROM tourist_spots');
    const touristSpots = result.rows;
    const normalizedSpots = touristSpots.map(spot => ({
      ...spot,
      lat: Number(spot.lat),
      lng: Number(spot.lng),
    })).filter(spot => !isNaN(spot.lat) && !isNaN(spot.lng));
    res.json(normalizedSpots);
  } catch (err) {
    console.error('観光地一覧取得エラー:', err);
    res.status(500).json({ error: '観光地一覧取得に失敗しました' });
  }
});

// ランキング取得API
app.get('/api/ranking', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ranking ORDER BY points DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    console.error('ランキング取得エラー:', err);
    res.status(500).json({ error: 'ランキング取得に失敗しました' });
  }
});

// ランキング更新API
app.post('/api/ranking', async (req, res) => {
  try {
    const { userId, points, displayName, photoURL, email, stamps } = req.body;
    await pool.query(
      `INSERT INTO ranking (userid, points, displayname, photourl, email, stamps, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (userid) DO UPDATE SET
         points = EXCLUDED.points,
         displayname = EXCLUDED.displayname,
         photourl = EXCLUDED.photourl,
         email = EXCLUDED.email,
         stamps = EXCLUDED.stamps,
         updatedat = NOW()`,
      [userId, points, displayName, photoURL, email, JSON.stringify(stamps)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('ランキング更新エラー:', err);
    res.status(500).json({ error: 'ランキング更新に失敗しました' });
  }
});

// ユーザーデータ更新API
app.post('/api/users', async (req, res) => {
  try {
    const { userId, stamps, points, totalDistance, steps } = req.body;
    await pool.query(
      `INSERT INTO users (userid, stamps, points, totaldistance, steps, updatedat)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (userid) DO UPDATE SET
         stamps = EXCLUDED.stamps,
         points = EXCLUDED.points,
         totaldistance = EXCLUDED.totaldistance,
         steps = EXCLUDED.steps,
         updatedat = NOW()`,
      [userId, JSON.stringify(stamps), points, totalDistance, steps]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('ユーザーデータ更新エラー:', err);
    res.status(500).json({ error: 'ユーザーデータ更新に失敗しました' });
  }
});

// サーバー起動
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`APIサーバーがポート${PORT}で起動しました`);
});