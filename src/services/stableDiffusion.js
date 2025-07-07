// Stable Diffusion API サービス
// 複数のAPIサービスに対応

// API設定
const API_CONFIGS = {
  // Stability AI (推奨)
  stability: {
    baseUrl: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_STABILITY_API_KEY}`,
      'Content-Type': 'application/json',
    }
  },
  // Replicate (代替)
  replicate: {
    baseUrl: 'https://api.replicate.com/v1/predictions',
    headers: {
      'Authorization': `Token ${import.meta.env.VITE_REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
    }
  }
};

// 地域ごとのランドマーク・特産物リスト
const landmarkMap = {
  '札幌': ['札幌市時計台', 'さっぽろテレビ塔', '大通公園', '雪まつり', 'ジンギスカン', '味噌ラーメン', '雪景色', '冬の祭り'],
  '東京': ['東京タワー', 'スカイツリー', '浅草寺', '雷門', 'もんじゃ焼き', '隅田川', '桜', '現代都市'],
  '京都': ['金閣寺', '清水寺', '舞妓', '八つ橋', '祇園祭', '嵐山', '紅葉', '古都の風情'],
  '大阪': ['通天閣', 'たこ焼き', '道頓堀', 'グリコサイン', '大阪城', 'お好み焼き', '食文化', '関西の魅力'],
  '名古屋': ['名古屋城', '味噌カツ', 'ひつまぶし', '大須観音', '手羽先', '中部の中心', '歴史的建造物'],
  '福岡': ['博多ラーメン', '屋台', '福岡タワー', '太宰府天満宮', '明太子', '九州の玄関', '食の街'],
  '仙台': ['仙台城', '牛タン', '七夕まつり', '青葉城', 'ずんだ餅', '東北の中心', '杜の都'],
  '広島': ['原爆ドーム', '厳島神社', 'お好み焼き', 'もみじ饅頭', '平和の象徴', '瀬戸内海'],
  '沖縄': ['首里城', '美ら海水族館', 'シーサー', 'ゴーヤ', '沖縄そば', 'エイサー', '南国の風情', '琉球文化'],
  '横浜': ['横浜中華街', 'みなとみらい', '赤レンガ倉庫', '横浜ランドマークタワー', '海の見える街'],
  '神戸': ['神戸港', '六甲山', '神戸牛', '異人館', 'ポートタワー', '港町の魅力'],
  '奈良': ['東大寺', '奈良公園', '鹿', '春日大社', '古都の歴史', '仏教文化'],
  '鎌倉': ['大仏', '鶴岡八幡宮', '江ノ島', '古都の風情', '海と山', '歴史的建造物'],
  // 必要に応じて追加
};

// 地域名からプロンプトを生成
const generatePrompt = (regionName) => {
  const landmarks = landmarkMap[regionName] || [];
  const landmarkText = landmarks.length > 0 ? `, featuring ${landmarks.join(', ')}` : '';
  
  // より詳細で効果的なプロンプトを生成
  const prompts = [
    `A beautiful Japanese stamp design for ${regionName}${landmarkText}. Circular stamp format with traditional Japanese art style, vibrant colors, iconic landmarks and local specialties. Clean, high-quality illustration with detailed artwork, perfect for a collectible stamp. The design should be centered, well-balanced, and capture the essence of ${regionName}'s culture and heritage. Masterpiece quality, professional stamp design.`,
    
    `Japanese stamp artwork for ${regionName}${landmarkText}. Ukiyo-e inspired design with local cultural elements, famous landmarks, regional cuisine, and seasonal motifs. Artistic stamp format with traditional Japanese patterns, clean composition, and professional illustration quality. The stamp should represent ${regionName}'s unique character and appeal. Elegant and sophisticated design.`,
    
    `Regional stamp design for ${regionName}${landmarkText}. Modern stamp artwork with local attractions, cultural symbols, traditional patterns, and clean geometric lines. Professional illustration style with balanced composition, vibrant colors, and clear visual hierarchy. The design should be instantly recognizable as representing ${regionName}. High-quality digital art.`,
    
    `Tourist stamp for ${regionName}${landmarkText}. Japanese travel stamp style with local highlights, cultural heritage elements, scenic beauty, and regional identity. Collectible stamp format with artistic rendering, traditional motifs, and contemporary appeal. The stamp should evoke the spirit and charm of ${regionName}. Beautiful and memorable design.`,
    
    `Traditional Japanese stamp for ${regionName}${landmarkText}. Circular design with local landmarks, cultural symbols, and regional specialties. Clean, minimalist style with vibrant colors and clear composition. The stamp should embody the essence of ${regionName} in a classic Japanese stamp format. Professional and collectible quality.`
  ];
  
  const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  console.log('生成されたプロンプト:', selectedPrompt);
  return selectedPrompt;
};

// ネガティブプロンプト
const negativePrompt = "text, watermark, signature, blurry, low quality, distorted, ugly, bad anatomy, extra limbs, poorly drawn";

// Stability AI APIを使用した画像生成
export const generateImageWithStability = async (regionName, customDescription = null) => {
  try {
    // APIキーの確認
    const apiKey = import.meta.env.VITE_STABILITY_API_KEY;
    if (!apiKey || apiKey === 'your_stability_api_key_here') {
      throw new Error('Stability AI APIキーが設定されていません');
    }

    // プロンプトを生成
    let detailedPrompt;
    
    if (customDescription && customDescription.trim()) {
      // カスタム説明文がある場合はそれを使用
      const landmarks = landmarkMap[regionName] || [];
      const landmarkText = landmarks.length > 0 ? `, featuring ${landmarks.join(', ')}` : '';
      detailedPrompt = `A beautiful Japanese stamp design for ${regionName}${landmarkText}. ${customDescription.trim()}. Circular stamp format with traditional Japanese art style, vibrant colors, and clean design. The design should be centered, well-balanced, and capture the essence of ${regionName}. Masterpiece quality, professional stamp design.`;
    } else {
      // デフォルトのプロンプトを使用
      const landmarks = landmarkMap[regionName] || [];
      const landmarkText = landmarks.length > 0 ? `, featuring ${landmarks.join(', ')}` : '';
      detailedPrompt = `A beautiful Japanese stamp design for ${regionName}${landmarkText}. Circular stamp format with traditional Japanese art style, vibrant colors, iconic landmarks and local specialties. Clean, high-quality illustration with detailed artwork, perfect for a collectible stamp. The design should be centered, well-balanced, and capture the essence of ${regionName}'s culture and heritage. Masterpiece quality, professional stamp design.`;
    }
    
    console.log('Stability AI用プロンプト:', detailedPrompt);
    
    console.log('Stability AI API リクエスト:', {
      url: API_CONFIGS.stability.baseUrl,
      prompt: detailedPrompt,
      hasApiKey: !!apiKey
    });

    const response = await fetch(API_CONFIGS.stability.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: detailedPrompt,
            weight: 1
          },
          {
            text: "text, watermark, signature, blurry, low quality, distorted, ugly, bad anatomy, extra limbs, poorly drawn, multiple images, collage",
            weight: -1
          }
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30
      })
    });

    console.log('Stability AI API レスポンス:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stability AI API エラーレスポンス:', errorText);
      throw new Error(`Stability API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Stability AI API 結果:', result);
    console.log('artifacts配列:', result.artifacts);
    console.log('resultのキー:', Object.keys(result));
    
    // レスポンスの詳細をログ出力
    if (result.artifacts) {
      result.artifacts.forEach((artifact, index) => {
        console.log(`Artifact ${index}:`, {
          finishReason: artifact.finishReason,
          seed: artifact.seed,
          hasBase64: !!artifact.base64,
          base64Length: artifact.base64?.length
        });
      });
    }
    
    if (result.artifacts && result.artifacts.length > 0) {
      const artifact = result.artifacts[0];
      console.log('最初のartifact:', artifact);
      
      // Base64エンコードされた画像データを取得
      if (artifact.base64) {
        const imageData = artifact.base64;
        console.log('Base64データの長さ:', imageData.length);
        return `data:image/png;base64,${imageData}`;
      } else {
        console.error('artifactにbase64データがありません:', artifact);
        throw new Error('Generated image has no base64 data');
      }
    } else {
      console.error('artifactsが空または存在しません:', result);
      throw new Error('No image generated');
    }
  } catch (error) {
    console.error('Stability AI API error:', error);
    throw error;
  }
};

// Replicate APIを使用した画像生成（代替）
export const generateImageWithReplicate = async (regionName, customDescription = null) => {
  try {
    let prompt;
    
    if (customDescription && customDescription.trim()) {
      // カスタム説明文がある場合はそれを使用
      const landmarks = landmarkMap[regionName] || [];
      const landmarkText = landmarks.length > 0 ? `, featuring ${landmarks.join(', ')}` : '';
      prompt = `A beautiful Japanese stamp design for ${regionName}${landmarkText}. ${customDescription.trim()}. Circular stamp format with traditional Japanese art style, vibrant colors, and clean design. The design should be centered, well-balanced, and capture the essence of ${regionName}. Masterpiece quality, professional stamp design.`;
    } else {
      // デフォルトのプロンプトを使用
      prompt = generatePrompt(regionName);
    }
    
    // 予測を作成
    const createResponse = await fetch(API_CONFIGS.replicate.baseUrl, {
      method: 'POST',
      headers: API_CONFIGS.replicate.headers,
      body: JSON.stringify({
        version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input: {
          prompt: prompt,
          negative_prompt: negativePrompt,
          width: 512,
          height: 512,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Replicate API error: ${createResponse.status}`);
    }

    const prediction = await createResponse.json();
    
    // 結果をポーリング
    const pollResult = async () => {
      const pollResponse = await fetch(`${API_CONFIGS.replicate.baseUrl}/${prediction.id}`, {
        headers: API_CONFIGS.replicate.headers
      });
      
      const result = await pollResponse.json();
      
      if (result.status === 'succeeded') {
        return result.output[0]; // 画像URLを返す
      } else if (result.status === 'failed') {
        throw new Error('Image generation failed');
      } else {
        // 1秒待ってから再試行
        await new Promise(resolve => setTimeout(resolve, 1000));
        return pollResult();
      }
    };

    return await pollResult();
  } catch (error) {
    console.error('Replicate API error:', error);
    throw error;
  }
};

// メインの画像生成関数（APIキーの有無で自動選択）
export const generateStampImage = async (regionName, customDescription = null) => {
  try {
    // Stability AI APIキーがある場合はそれを使用
    if (import.meta.env.VITE_STABILITY_API_KEY) {
      return await generateImageWithStability(regionName, customDescription);
    }
    // Replicate APIキーがある場合はそれを使用
    else if (import.meta.env.VITE_REPLICATE_API_KEY) {
      return await generateImageWithReplicate(regionName, customDescription);
    }
    // APIキーがない場合はプレースホルダー画像を返す
    else {
      console.warn('No API key configured. Using placeholder image.');
      // canvasでダミー画像を生成しBase64で返す
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(regionName, 256, 256);
      return canvas.toDataURL('image/png');
    }
  } catch (error) {
    console.error('Image generation failed:', error);
    // エラー時はプレースホルダー画像を返す
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(regionName, 256, 256);
    return canvas.toDataURL('image/png');
  }
};

// 生成された画像をキャッシュするためのローカルストレージ管理
export const cacheStampImage = (regionName, imageData) => {
  try {
    const cache = JSON.parse(localStorage.getItem('stampImageCache') || '{}');
    
    // キャッシュサイズをチェック（5MB制限）
    const cacheSize = new Blob([JSON.stringify(cache)]).size;
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    // 容量制限に達した場合、古いキャッシュを削除
    if (cacheSize > maxSize) {
      const entries = Object.entries(cache);
      // タイムスタンプでソートして古いものを削除
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // 半分を削除
      const toRemove = Math.floor(entries.length / 2);
      entries.slice(0, toRemove).forEach(([key]) => {
        delete cache[key];
      });
    }
    
    cache[regionName] = {
      imageData,
      timestamp: Date.now()
    };
    
    localStorage.setItem('stampImageCache', JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to cache image:', error);
    // キャッシュに失敗した場合は、キャッシュをクリアして再試行
    try {
      localStorage.removeItem('stampImageCache');
      const cache = { [regionName]: { imageData, timestamp: Date.now() } };
      localStorage.setItem('stampImageCache', JSON.stringify(cache));
    } catch (retryError) {
      console.error('Failed to retry caching:', retryError);
    }
  }
};

export const getCachedStampImage = (regionName) => {
  try {
    const cache = JSON.parse(localStorage.getItem('stampImageCache') || '{}');
    const cached = cache[regionName];
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24時間以内
      return cached.imageData;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get cached image:', error);
    return null;
  }
};

// キャッシュをクリアする関数
export const clearStampImageCache = () => {
  try {
    localStorage.removeItem('stampImageCache');
    console.log('Stamp image cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}; 