const express = require('express');
const app = express();
const path = require('path');
const crypto = require('crypto');
const Groq = require("groq-sdk"); // Geminiの代わりにGroqを読み込む

// ローカル開発時のみ dotenv を読み込む
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
}

const { Pool } = require('pg');

// Neon (PostgreSQL) への接続
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

// AI判定を有効にするフラグ
const ENABLE_AI_CHECK = true;

// Groq APIの準備
const groq = process.env.GROQ_API_KEY 
  ? new Groq({ apiKey: process.env.GROQ_API_KEY }) 
  : null;

/**
 * 古い投稿（7日以上前）を削除する関数
 */
async function cleanupOldPosts() {
  console.log('古い投稿のクリーンアップを開始します...');
  try {
    const result = await pool.query(
      "DELETE FROM posts WHERE timestamp < (NOW() - INTERVAL '7 days')"
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ ${result.rowCount} 件の古い投稿を削除しました。`);
    }
  } catch (error) {
    console.error('❌ 古い投稿の削除中にエラーが発生しました:', error);
  }
}

app.use(express.json());

// 静的ファイルの配信
app.use('/front', express.static(path.join(__dirname, '..', 'front')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- API ---

// 投稿一覧取得
app.get('/posts', async (req, res) => {
  await cleanupOldPosts();
  try {
    const result = await pool.query(
      'SELECT id, text, donmai, timestamp FROM posts ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('投稿の取得に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 新規投稿
app.post('/posts', async (req, res) => {
  
  await cleanupOldPosts();
  const newPostText = req.body.text;

  // --- Groq (Llama 3) による「やらかし判定」ここから ---
  if (groq && ENABLE_AI_CHECK) {
      try {
          const prompt = `
          以下の投稿が「失敗、ミス、不幸、自虐」のどれかに該当するなら "OK"、それ以外（成功体験、攻撃的、スパム、URL、意味不明等）なら "NG" とだけ答えて。

          投稿:
          ${newPostText}
          `;

          // Groqへのリクエスト
          const chatCompletion = await groq.chat.completions.create({
              messages: [
                  { role: "user", content: prompt }
              ],
              model: "llama-3.1-8b-instant", // モデル
          });

          const responseText = chatCompletion.choices[0]?.message?.content?.trim() || "";
          console.log(`Groq判定: ${responseText} (投稿内容: ${newPostText})`);

          if (responseText.toUpperCase().includes("NG")) {
              return res.status(400).json({ 
                  error: 'AI判定：やらかし以外の投稿とか、過激な言葉は控えてね。' 
              });
          }

      } catch (aiError) {
          console.error("Groq API Error:", aiError);
          // エラーが出ても投稿は許可する（ユーザーを止めないため）
      }
  }
  // --- AI判定 ここまで ---

  const newPostId = Date.now().toString();
  const deleteToken = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();
  const trimmedText = newPostText.trim();

  try {
    const result = await pool.query(
      'INSERT INTO posts (id, text, donmai, timestamp, deleteToken) VALUES ($1, $2, $3, $4, $5) RETURNING id, text, donmai, timestamp',
      [newPostId, trimmedText, 0, timestamp, deleteToken]
    );

    const newPost = result.rows[0];
    console.log('新しい投稿 (PostgreSQL):', newPost);
    res.status(201).json({ post: newPost, deleteToken: deleteToken });

  } catch (error) {
    console.error('投稿に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// どんまい追加
app.post('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id; 
  try {
    const result = await pool.query(
      'UPDATE posts SET donmai = donmai + 1 WHERE id = $1 RETURNING donmai',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }
    res.json({ donmai: result.rows[0].donmai });
  } catch (error) {
    console.error('どんまい処理に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// どんまい削除
app.delete('/posts/:id/donmai', async (req, res) => {
  const postId = req.params.id;
  try {
    const result = await pool.query(
      'UPDATE posts SET donmai = GREATEST(0, donmai - 1) WHERE id = $1 RETURNING donmai',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '投稿が見つかりません' });
    }
    res.json({ donmai: result.rows[0].donmai });
  } catch (error) {
    console.error('どんまい解除処理に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 投稿削除
app.delete('/posts/:id', async (req, res) => {
    const postId = req.params.id;
    const { token } = req.body; 

    if (!token) {
        return res.status(401).json({ error: '削除トークンがありません' });
    }

    try {
        const result = await pool.query(
          'DELETE FROM posts WHERE id = $1 AND deleteToken = $2 RETURNING id',
          [postId, token]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: '削除権限がないか、投稿が見つかりません' });
        }

        console.log(`投稿ID ${postId} を削除しました`);
        res.status(200).json({ message: '投稿を削除しました' });
    } catch (error) {
        console.error('投稿の削除に失敗しました:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = app;

if (require.main === module) {
  const port = 3000;
  app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました！ http://localhost:${port}`);
  });
}