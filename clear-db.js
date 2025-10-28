const path = require('path');

// 1. .env.localファイルから環境変数を読み込む
// (api/server.js と同じ設定)
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// 2. Vercel KVをインポート
const { kv } = require('@vercel/kv');

async function clearAllPosts() {
  console.log('Vercel KV データベースに接続し、投稿を削除します...');

  try {
    // 1. "posts:ids" リストから、すべての投稿IDを取得
    const postIds = await kv.lrange('posts:ids', 0, -1); // 0から-1で全件取得

    if (postIds.length === 0) {
      console.log('削除する投稿はありませんでした。');
      return;
    }

    console.log(`[${postIds.length}件] の投稿IDが見つかりました。`);

    // 2. 削除するキーのリストを作成
    // まずは "posts:ids" (IDのリスト本体)
    const keysToDelete = ['posts:ids'];

    // 次に、"post:xxxx" (各投稿の詳細データ)
    postIds.forEach(id => {
      keysToDelete.push(`post:${id}`);
    });

    // 3. `del` コマンドで、見つかったキーをすべて一括削除
    console.log('すべての投稿データを削除中...');
    await kv.del(...keysToDelete);

    console.log('✅ すべての投稿を削除しました！');

  } catch (error) {
    console.error('❌ データベースのクリアに失敗しました:', error);
  }
}

// 4. 関数を実行
clearAllPosts();