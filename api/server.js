const express = require('express');
const app = express();
const path = require('path');
const crypto = require('crypto'); // <<<--- 削除機能のために追加

// --- ▼▼▼ 修正 ▼▼▼ ---
// ローカル開発時のみ dotenv を読み込む (Vercelでは不要)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
}

// KVのインポートは dotenv の *後* にする
const { kv } = require('@vercel/kv'); 
// --- ▲▲▲ ---

    
app.use(express.json());
    
// --- ローカル開発用の静的ファイル配信設定 (変更なし) ---
app.use('/front', express.static(path.join(__dirname, '..', 'front')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- API ---

// (GET /posts API は変更なし)
app.get('/posts', async (req, res) => {
  try {
    const postIds = await kv.lrange('posts:ids', 0, 50);
    if (postIds.length === 0) {
      return res.json([]);
    }
    const pipeline = kv.pipeline();
    postIds.forEach(id => {
      pipeline.hgetall(`post:${id}`);
    });
    const posts = await pipeline.exec();
    res.json(posts.filter(Boolean));
  } catch (error) {
    console.error('投稿の取得に失敗しました:', error);
    console.error(error); 
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});


// --- ▼▼▼ POST /posts を修正 (トークン生成) ▼▼▼ ---
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
  const deleteToken = crypto.randomBytes(16).toString('hex'); // <<<--- 削除用トークンを生成

  const newPost = {
    id: newPostId,
    text: newPostText.trim(),
    donmai: 0,
    timestamp: new Date().toISOString(),
    deleteToken: deleteToken // <<<--- トークンをデータに追加
  };

  try {
    await kv.hset(`post:${newPostId}`, newPost);
    await kv.lpush('posts:ids', newPostId);

    console.log('新しい投稿 (KV):', newPost);
    
    // クライアントにはトークンを含まない投稿情報と、削除用トークンを別々に返す
    const responsePost = { ...newPost };
    delete responsePost.deleteToken; 
    res.status(201).json({ post: responsePost, deleteToken: deleteToken });

  } catch (error) {
    console.error('投稿に失敗しました:', error);
    console.error(error); // エラー詳細
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// (POST /posts/:id/donmai は変更なし)
app.post('/posts/:id/donmai', async (req, res) => {
  // ... (省略) ...
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
    console.error(error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// (DELETE /posts/:id/donmai は変更なし)
app.delete('/posts/:id/donmai', async (req, res) => {
  // ... (省略) ...
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
    console.error(error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});


// --- ▼▼▼ DELETE /posts/:id を追加 (投稿削除) ▼▼▼ ---
app.delete('/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const { token } = req.body; // リクエストボディからトークンを受け取る

    if (!token) {
        return res.status(401).json({ error: '削除トークンがありません' });
    }

    try {
        const post = await kv.hgetall(`post:${postId}`);
        if (!post) {
            return res.status(404).json({ error: '投稿が見つかりません' });
        }
        if (post.deleteToken !== token) {
            return res.status(403).json({ error: '削除権限がありません' });
        }
        await kv.del(`post:${postId}`); 
        await kv.lrem('posts:ids', 1, postId); 

        console.log(`投稿ID ${postId} を削除しました`);
        res.status(200).json({ message: '投稿を削除しました' });
    } catch (error) {
        console.error('投稿の削除に失敗しました:', error);
        console.error(error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});


// Vercelはまずここを読み込む
module.exports = app;

// --- ▼▼▼ 修正 ▼▼▼ ---
// 'node api/server.js' で直接実行された時だけサーバーを起動
if (require.main === module) {
  // (dotenvの読み込みは上で行ったので、ここでは不要)
  const port = 3000;
  app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました！ http://localhost:${port}`);
  });
}