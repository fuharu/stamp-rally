// 画像圧縮機能
export const compressImage = (imageDataUrl, maxWidth = 512, maxHeight = 512, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // アスペクト比を保持してリサイズ
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);

      // 圧縮された画像データを取得
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };

    img.src = imageDataUrl;
  });
};

// 画像サイズをチェック
export const checkImageSize = (imageDataUrl) => {
  // imageDataUrlがundefined、null、または空文字列、またはdata:imageで始まらない場合は0を返す
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image')) {
    return 0;
  }
  // Base64データのサイズを計算（バイト単位）
  const base64Data = imageDataUrl.split(',')[1];
  if (!base64Data) {
    return 0;
  }
  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
  return sizeInBytes;
};

// 画像がFirestoreの制限内かチェック
export const isImageSizeValid = (imageDataUrl, maxSizeBytes = 1000000) => {
  const size = checkImageSize(imageDataUrl);
  return size <= maxSizeBytes;
};

// 画像を最適化（必要に応じて圧縮）
export const optimizeImageForFirestore = async (imageDataUrl, maxSizeBytes = 1000000) => {
  let optimizedImage = imageDataUrl;
  let quality = 0.8;
  let maxDimension = 512;

  // サイズが制限内になるまで圧縮
  while (!isImageSizeValid(optimizedImage, maxSizeBytes) && quality > 0.1) {
    try {
      optimizedImage = await compressImage(imageDataUrl, maxDimension, maxDimension, quality);
      quality -= 0.1;
      
      // 品質を下げてもまだ大きい場合は、サイズも小さくする
      if (quality <= 0.3 && maxDimension > 256) {
        maxDimension -= 64;
        quality = 0.8; // 品質をリセット
      }
    } catch (error) {
      console.error('画像圧縮に失敗:', error);
      break;
    }
  }

  const finalSize = checkImageSize(optimizedImage);
  console.log(`画像最適化完了: ${finalSize} bytes (元: ${checkImageSize(imageDataUrl)} bytes)`);

  return optimizedImage;
}; 