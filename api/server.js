const express = require('express');
const app = express();
const path = require('path');
const crypto = require('crypto');

// ローカル開発時のみ dotenv を読み込む
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
}

// --- ↓↓↓ ここからが変更点 ↓↓↓ ---

// const { kv } = require('@vercel/kv'); // ← 削除
const { Pool } = require('pg'); // pg をインポート

// Neon (PostgreSQL) への接続プールを作成
// .env.local や Vercel の環境変数から POSTGRES_URL を読み込む
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false, // 外部DBへの接続はSSLを有効にする
  },
});

// --- ↑↑↑ ここまでが変更点 ↑↑↑ ---

app.use(express.json());

// --- ローカル開発用の静的ファイル配信設定 (変更なし) ---
app.use('/front', express.static(path.join(__dirname, '..', 'front')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- API ---

// (GET /posts API: PostgreSQL から取得するように変更)
app.get('/posts', async (req, res) => {
  try {
    // SQL クエリを実行
    const result = await pool.query(
      'SELECT id, text, donmai, timestamp FROM posts ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(result.rows); // result.rows が投稿の配列
  } catch (error) {
    console.error('投稿の取得に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// (POST /posts API: PostgreSQL に挿入するように変更)
app.post('/posts', async (req, res) => {
  const newPostText = req.body.text;
  const maxLength = 200;

  if (!newPostText || typeof newPostText !== 'string' || newPostText.trim() === '') {
    return res.status(400).json({ error: '投稿内容が空です' });
  }
  // (DB側の制限(255)も超えていないかチェック)
  if (newPostText.length > 255) {
     return res.status(400).json({ error: `投稿は 255 文字以内でお願いします` });
  }

  const newPostId = Date.now().toString();
  const deleteToken = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();
  const trimmedText = newPostText.trim();

  try {
    // SQL の INSERT 文を実行
    const result = await pool.query(
      'INSERT INTO posts (id, text, donmai, timestamp, deleteToken) VALUES ($1, $2, $3, $4, $5) RETURNING id, text, donmai, timestamp',
      [newPostId, trimmedText, 0, timestamp, deleteToken]
    );

    const newPost = result.rows[0];
    console.log('新しい投稿 (PostgreSQL):', newPost);
    
    // deleteToken を除いた投稿データと、削除用トークンを返す
    res.status(201).json({ post: newPost, deleteToken: deleteToken });

  } catch (error) {
    console.error('投稿に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// (POST /posts/:id/donmai API: PostgreSQL の UPDATE に変更)
app.post('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id; 
  try {
    // SQL の UPDATE 文を実行
    const result = await pool.query(
      'UPDATE posts SET donmai = donmai + 1 WHERE id = $1 RETURNING donmai',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }

    const newDonmaiCount = result.rows[0].donmai;
    console.log(`投稿ID ${postId} のどんまいカウント (増): ${newDonmaiCount}`);
    res.json({ donmai: newDonmaiCount });
  } catch (error) {
    console.error('どんまい処理に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// (DELETE /posts/:id/donmai API: PostgreSQL の UPDATE に変更)
app.delete('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id;
  try {
    // マイナスにならないように GREATEST(0, ...) を使う
    const result = await pool.query(
      'UPDATE posts SET donmai = GREATEST(0, donmai - 1) WHERE id = $1 RETURNING donmai',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }

    const newDonmaiCount = result.rows[0].donmai;
    console.log(`投稿ID ${postId} のどんまいカウント (減): ${newDonmaiCount}`);
    res.json({ donmai: newDonmaiCount });
  } catch (error) {
    console.error('どんまい解除処理に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});


// (DELETE /posts/:id API: PostgreSQL の DELETE に変更)
app.delete('/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const { token } = req.body; 

    if (!token) {
        return res.status(401).json({ error: '削除トークンがありません' });
    }

    try {
        // ID と deleteToken が両方一致した場合のみ削除
        const result = await pool.query(
          'DELETE FROM posts WHERE id = $1 AND deleteToken = $2 RETURNING id',
          [postId, token]
        );

        if (result.rows.length === 0) {
            // トークンが間違っているか、投稿がない
            return res.status(403).json({ error: '削除権限がないか、投稿が見つかりません' });
        }

        console.log(`投稿ID ${postId} を削除しました`);
        res.status(200).json({ message: '投稿を削除しました' });
    } catch (error) {
        console.error('投稿の削除に失敗しました:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});


// Vercelはまずここを読み込む
module.exports = app;

// 'node api/server.js' で直接実行された時だけサーバーを起動 (変更なし)
if (require.main === module) {
  const port = 3000;
  app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました！ http://localhost:${port}`);
  });
}