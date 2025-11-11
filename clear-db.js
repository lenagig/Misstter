const path = require('path');

// 1. .env.localファイルから環境変数を読み込む
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// 2. Vercel KV ではなく、pg をインポート
const { Pool } = require('pg');

// 3. 接続プールの作成
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});


async function clearAllPosts() {
  console.log('PostgreSQL (Neon) データベースに接続し、投稿を削除します...');

  try {
    // 4. KV の処理の代わりに、TRUNCATE TABLE を実行
    await pool.query('TRUNCATE TABLE posts');

    console.log('✅ すべての投稿を削除しました！');

  } catch (error) {
    console.error('❌ データベースのクリアに失敗しました:', error);
  } finally {
    // 5. 接続を閉じる
    await pool.end();
    console.log('データベース接続を閉じました。');
  }
}

// 6. 関数を実行
clearAllPosts();