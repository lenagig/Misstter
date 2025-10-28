const express = require('express');
const app = express();
const path = require('path'); // <<<--- この行を追加

app.use(express.json());

// Vercelデプロイ時はここは使われず、vercel.jsonの設定が優先されます

// '/front' へのリクエストが来たら、一つ上の階層の 'front' フォルダの中身を返す
app.use('/front', express.static(path.join(__dirname, '..', 'front')));

// ルート へのリクエストが来たら、一つ上の階層の 'index.html' を返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


let posts = [];

// GET /posts (変更なし)
app.get('/posts', (req, res) => {
  res.json([...posts].reverse());
});

// POST /posts (maxLength を 200 に変更)
app.post('/posts', (req, res) => {
  const newPostText = req.body.text;
  const maxLength = 200; // <<<--- 280 から 200 に変更

  if (!newPostText || typeof newPostText !== 'string' || newPostText.trim() === '') {
    return res.status(400).json({ error: '投稿内容が空です' });
  }
  if (newPostText.length > maxLength) {
     return res.status(400).json({ error: `投稿は ${maxLength} 文字以内でお願いします` });
  }

  const newPost = {
    id: Date.now().toString(),
    text: newPostText.trim(),
    donmai: 0,
    timestamp: new Date().toISOString()
  };
  posts.unshift(newPost);
  console.log('新しい投稿:', newPost);
  res.status(201).json(newPost);
});

// POST /posts/:id/donmai (変更なし)
app.post('/posts/:id/donmai', (req, res) => {
  const postId = req.params.id;
  const postIndex = posts.findIndex(p => p.id === postId);
  if (postIndex === -1) {
    return res.status(404).json({ error: '投稿が見つかりません' });
  }
  posts[postIndex].donmai++;
  console.log(`投稿ID ${postId} のどんまいカウント (増): ${posts[postIndex].donmai}`);
  res.json({ donmai: posts[postIndex].donmai });
});

// --- ▼▼▼ カウントを減らすAPIエンドポイントを追加 ▼▼▼ ---
// DELETE /posts/:id/donmai : 特定の投稿のどんまいカウントを減らす
app.delete('/posts/:id/donmai', (req, res) => {
  const postId = req.params.id;
  const postIndex = posts.findIndex(p => p.id === postId);

  if (postIndex === -1) {
    return res.status(404).json({ error: '投稿が見つかりません' });
  }

  // カウントが0より大きい場合のみ減らす
  if (posts[postIndex].donmai > 0) {
    posts[postIndex].donmai--;
  }

  console.log(`投稿ID ${postId} のどんまいカウント (減): ${posts[postIndex].donmai}`);
  res.json({ donmai: posts[postIndex].donmai }); // 更新後のカウントを返す
});
// --- ▲▲▲ ---

// (削除) app.use(express.static(path.join(__dirname, '..')));

// Vercelはまずここを読み込む
module.exports = app;

// 'node api/server.js' で直接実行された時だけサーバーを起動
// (Vercelデプロイ時はここは実行されない)
if (require.main === module) {
  const port = 3000;
  app.listen(port, () => {
    console.log(`サーバーがポート ${port} で起動しました！ http://localhost:${port}`);
  });
}