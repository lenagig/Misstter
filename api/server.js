const express = require('express');
const app = express();
const path = require('path');

const { kv } = require('@vercel/kv'); 
    
app.use(express.json());
    
// --- ローカル開発用の静的ファイル配信設定 (変更なし) ---
app.use('/front', express.static(path.join(__dirname, '..', 'front')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- API ---

/**
 * データの設計：(変更なし)
 * 1. 投稿IDのリスト (List型)
 * キー: "posts:ids"
 * 値: ["id3", "id2", "id1"]
 *
 * 2. 各投稿の詳細 (Hash型)
 * キー: "post:[id]" (例: "post:12345")
 * 値: { id: "12345", text: "...", donmai: 0, timestamp: "..." }
 */


// --- ▼▼▼ ここを修正 ▼▼▼ ---
// GET /posts (mget から pipeline/hgetall に変更)
app.get('/posts', async (req, res) => {
  try {
    // 1. 最新の投稿IDを50件取得
    const postIds = await kv.lrange('posts:ids', 0, 50);

    if (postIds.length === 0) {
      return res.json([]);
    }

    // 2. パイプラインを作成
    const pipeline = kv.pipeline();

    // 3. IDリストを使って、取得したいHashのキーをパイプラインに追加
    postIds.forEach(id => {
      pipeline.hgetall(`post:${id}`); // mget の代わりに hgetall を使う
    });

    // 4. パイプラインを実行 (複数のHashデータをまとめて取得)
    const posts = await pipeline.exec();

    // 5. フィルタリング (万が一nullが混じっていた場合)
    res.json(posts.filter(Boolean));

  } catch (error) {
    console.error('投稿の取得に失敗しました:', error);
    // エラー詳細をターミナルに出力
    console.error(error); 
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});
// --- ▲▲▲ 修正ここまで ▲▲▲ ---


// POST /posts (変更なし)
app.post('/posts', async (req, res) => {
  const newPostText = req.body.text;
  const maxLength = 200;

  if (!newPostText || typeof newPostText !== 'string' || newPostText.trim() === '') {
    return res.status(400).json({ error: '投稿内容が空です' });
  }
  if (newPostText.length > maxLength) {
     return res.status(400).json({ error: `投稿は ${maxLength} 文字以内でお願いします` });
  }

  const newPostId = Date.now().toString();
  const newPost = {
    id: newPostId,
    text: newPostText.trim(),
    donmai: 0,
    timestamp: new Date().toISOString()
  };

  try {
    await kv.hset(`post:${newPostId}`, newPost);
    await kv.lpush('posts:ids', newPostId);

    console.log('新しい投稿 (KV):', newPost);
    res.status(201).json(newPost);

  } catch (error) {
    console.error('投稿に失敗しました:', error);
    console.error(error); // エラー詳細
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// POST /posts/:id/donmai (変更なし)
app.post('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id;

  try {
    const exists = await kv.exists(`post:${postId}`);
    if (!exists) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }
    const newDonmaiCount = await kv.hincrby(`post:${postId}`, 'donmai', 1);

    console.log(`投稿ID ${postId} のどんまいカウント (増): ${newDonmaiCount}`);
    res.json({ donmai: newDonmaiCount });

  } catch (error) {
    console.error('どんまい処理に失敗しました:', error);
    console.error(error); // エラー詳細
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// DELETE /posts/:id/donmai (変更なし)
app.delete('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id;

  try {
    const donmaiCount = await kv.hget(`post:${postId}`, 'donmai');

    if (donmaiCount === null) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }
    let newDonmaiCount = Number(donmaiCount); 
    if (newDonmaiCount > 0) {
      newDonmaiCount = await kv.hincrby(`post:${postId}`, 'donmai', -1);
    }

    console.log(`投稿ID ${postId} のどんまいカウント (減): ${newDonmaiCount}`);
    res.json({ donmai: newDonmaiCount });

  } catch (error) {
    console.error('どんまい解除処理に失敗しました:', error);
    console.error(error); // エラー詳細
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});


// Vercelはまずここを読み込む
module.exports = app;

// 'node api/server.js' で直接実行された時だけサーバーを起動
if (require.main === module) {
  // .env.localファイルから環境変数を読み込む
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

  const port = 3000;
  app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました！ http://localhost:${port}`);
  });
}