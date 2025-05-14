const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require("C:\\Users\\fujih\\Downloads\\stamp-rally-67b6f-firebase-adminsdk-fbsvc-24b39e6b11.json"); // サービスアカウントキー

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Overpass APIで観光地を取得
async function fetchTouristSpotsFromOverpass(bbox) {
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"~"attraction|museum|viewpoint|zoo|theme_park"](${bbox});
      way["tourism"~"attraction|museum|viewpoint|zoo|theme_park"](${bbox});
      relation["tourism"~"attraction|museum|viewpoint|zoo|theme_park"](${bbox});
    );
    out center;
  `;
  const url = 'https://overpass-api.de/api/interpreter';
  const res = await axios.post(url, query, { headers: { 'Content-Type': 'text/plain' } });
  return res.data.elements;
}

// Firestoreに登録
async function importSpots() {
  // 例: 東京23区のバウンディングボックス
  const bbox = '35.528,-139.910,35.898,139.940';
  const spots = await fetchTouristSpotsFromOverpass(bbox);

  for (const spot of spots) {
    const name = spot.tags && spot.tags.name;
    if (!name) continue;

    // Firestoreから獲得数・クリック数を取得（例: awaitで取得する場合）
    let stampData = null;
    try {
      const docSnap = await db.collection('spot_stats').doc(String(spot.id)).get();
      stampData = docSnap.exists ? docSnap.data() : { gotCount: 0, clickCount: 0 };
    } catch (e) {
      stampData = { gotCount: 0, clickCount: 0 };
    }

    const doc = {
      name,
      lat: spot.lat || (spot.center && spot.center.lat),
      lng: spot.lon || (spot.center && spot.center.lon),
      osm_id: spot.id,
      tags: spot.tags,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('tourist_spots').doc(String(spot.id)).set(doc, { merge: true });
    console.log(`登録: ${name}`);
  }
  console.log('インポート完了');
}

importSpots().catch(console.error);