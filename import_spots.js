const admin = require("firebase-admin");
const serviceAccount = require("C:\\Users\\fujih\\Downloads\\stamp-rally-67b6f-firebase-adminsdk-fbsvc-24b39e6b11.json"); // サービスアカウントキーのパス

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ここに登録したいスポットデータを記述
const spots = [
  { id: "1", name: "東京駅", lat: 35.681236, lng: 139.767125 },
  { id: "2", name: "浅草寺", lat: 35.714765, lng: 139.796655 },
  { id: "3", name: "上野公園", lat: 35.715298, lng: 139.774054 }
  // 必要なだけ追加
];

async function importSpots() {
  const batch = db.batch();
  spots.forEach(spot => {
    const ref = db.collection("tourist_spots").doc(spot.id);
    batch.set(ref, spot);
  });
  await batch.commit();
  console.log("インポート完了");
}

importSpots();