const admin = require('firebase-admin');
import { Pool } from 'pg';
const serviceAccount = require("C:\\Users\\fujih\\Downloads\\stamp-rally-67b6f-firebase-adminsdk-fbsvc-24b39e6b11.json"); // サービスアカウントキー

// Firebase初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

// PostgreSQL接続
const pool = new Pool({
  user: 'stamp_user',
  host: 'localhost',
  database: 'stamp_rally_db',
  password: 'haruto7fujimoto',
  port: 5432,
});

async function migrateUsers() {
  const usersSnapshot = await firestore.collection('users').get();
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    await pool.query(
      `INSERT INTO users (userid, stamps, points, totaldistance, steps, updatedat)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (userid) DO UPDATE SET
         stamps = EXCLUDED.stamps,
         points = EXCLUDED.points,
         totaldistance = EXCLUDED.totaldistance,
         steps = EXCLUDED.steps,
         updatedat = NOW()`,
      [
        doc.id,
        JSON.stringify(data.stamps || []),
        data.points || 0,
        data.totalDistance || 0,
        data.steps || 0
      ]
    );
    console.log(`ユーザー ${doc.id} を移行しました`);
  }
  console.log('ユーザーデータの移行が完了しました');
}

async function migrateRanking() {
  const rankingSnapshot = await firestore.collection('ranking').get();
  for (const doc of rankingSnapshot.docs) {
    const data = doc.data();
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
      [
        doc.id,
        data.points || 0,
        data.displayName || '',
        data.photoURL || '',
        data.email || '',
        JSON.stringify(data.stamps || [])
      ]
    );
    console.log(`ランキング ${doc.id} を移行しました`);
  }
  console.log('ランキングデータの移行が完了しました');
}

async function migrateTouristSpots() {
  const spotsSnapshot = await firestore.collection('tourist_spots').get();
  for (const doc of spotsSnapshot.docs) {
    const data = doc.data();
    await pool.query(
      `INSERT INTO tourist_spots (id, name, lat, lng, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         description = EXCLUDED.description`,
      [
        doc.id,
        data.name || '',
        data.lat || 0,
        data.lng || 0,
        data.description || ''
      ]
    );
    console.log(`観光地 ${doc.id} を移行しました`);
  }
  console.log('観光地データの移行が完了しました');
}

async function main() {
  await migrateUsers();
  await migrateRanking();
  await migrateTouristSpots();
  await pool.end();
}

main().catch(console.error);