// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {

    // --- 必要な要素を取得 ---
    const postListElement = document.querySelector('.post-list'); // 投稿リストを表示する場所
    const openModalButton = document.getElementById('open-modal-btn');
    const modalOverlay = document.getElementById('post-modal');
    const closeModalButton = document.getElementById('modal-close-btn');
    const modalTextarea = modalOverlay.querySelector('.modal-textarea'); // モーダルのテキストエリア
    const modalSubmitButton = modalOverlay.querySelector('.modal-submit-button'); // モーダルの送信ボタン
    // --- ▼▼▼ 文字数カウンター表示用要素を取得 ▼▼▼ ---
    const charCountDisplay = document.getElementById('char-count-display');
    const maxLength = 200; // 文字数制限
    // --- ▲▲▲ ---

    // --- 関数定義 ---

    /**
     * サーバーから投稿を取得して表示する関数
     */
    async function fetchAndRenderPosts() {
        try {
            const response = await fetch('/posts'); // GET /posts を呼び出し
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const posts = await response.json(); // JSONデータを取得
            renderPosts(posts); // 取得したデータで表示を更新
        } catch (error) {
            console.error('投稿の取得に失敗しました:', error);
            postListElement.innerHTML = '<p style="color: red; text-align: center;">投稿の読み込みに失敗しました。</p>';
        }
    }

    /**
     * 投稿データの配列を受け取ってHTMLを描画する関数
     * @param {Array} posts - 投稿オブジェクトの配列
     */
    function renderPosts(posts) {
        // まず現在のリストを空にする
        postListElement.innerHTML = '';

        if (posts.length === 0) {
            postListElement.innerHTML = '<p style="text-align: center; color: #888;">まだ誰もやらかしていません。一番乗りになろう！</p>';
            return;
        }

        // 投稿データごとにHTML要素を生成して追加
        posts.forEach(post => {
            const postElement = document.createElement('article');
            postElement.classList.add('post');
            // --- ▼▼▼ data-post-id を追加 ▼▼▼ ---
            postElement.dataset.postId = post.id; // 投稿要素にIDを持たせる
            // --- ▲▲▲ ---
            // テンプレートリテラルを使ってHTML構造を組み立てる
            postElement.innerHTML = `
                <div class="post__emoji">
                    <img src="./front/img/sadicon.png" alt="悲しいアイコン">
                </div>
                <div class="post__content">
                    <p class="post__text">${escapeHTML(post.text)}</p>
                    <div class="post__reaction">
                        <span class="reaction__icon" data-action="donmai" role="button" tabindex="0">🤝</span>
                        <span class="reaction__count">${post.donmai}</span>
                    </div>
                </div>
            `;
            postListElement.append(postElement);
        });
    }

     /**
     * HTMLエスケープを行うヘルパー関数 (XSS対策)
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープ後の文字列
     */
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML.replace(/\n/g, '<br>'); // 改行を<br>に変換
    }

    // --- ▼▼▼ 文字数カウンター更新関数を追加 ▼▼▼ ---
    /**
     * 文字数カウンターを更新する関数
     */
    function updateCharCount() {
        // charCountDisplayが存在するか確認してから処理
        if (charCountDisplay) {
            const currentLength = modalTextarea.value.length;
            charCountDisplay.textContent = `${currentLength} / ${maxLength}`;
            // 文字数オーバーで色を変える (任意)
            if (currentLength > maxLength) {
                charCountDisplay.style.color = 'red';
            } else {
                charCountDisplay.style.color = '#888'; // 通常の色に戻す (:rootの変数を使ってもOK)
            }
        }
    }
    // --- ▲▲▲ ---

    // --- イベントリスナーを設定 ---

    // モーダル表示ボタン
    if (openModalButton) {
        openModalButton.addEventListener('click', (event) => {
            event.preventDefault();
            modalOverlay.classList.add('is-visible');
            modalTextarea.value = ''; // モーダルを開くときにテキストエリアを空にする
            updateCharCount(); // <<< カウンターを初期化 (0 / 200 を表示)
            modalTextarea.focus(); // テキストエリアにフォーカスを当てる
        });
    }

    // モーダル閉じるボタン
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            modalOverlay.classList.remove('is-visible');
        });
    }

    // --- テキストエリアの入力イベントを追加 ---
    if (modalTextarea) {
        modalTextarea.addEventListener('input', updateCharCount); // 入力するたびにカウンターを更新
    }
    // --- ---

    // ▼▼▼ モーダルの送信ボタンの処理を追加 ▼▼▼
    if (modalSubmitButton) {
        modalSubmitButton.addEventListener('click', async () => {
            const postText = modalTextarea.value;

            if (!postText || postText.trim() === '') {
                alert('何か入力してください！'); // 簡単なバリデーション
                return;
            }
            // --- 文字数チェック (変更なし) ---
            if (postText.length > maxLength) {
                alert(`投稿は ${maxLength} 文字以内でお願いします！ (現在 ${postText.length} 文字)`);
                return; // 送信を中止
            }
            // --- ---


            try {
                // POST /posts を呼び出し
                const response = await fetch('/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // JSON形式で送ることを伝える
                    },
                    body: JSON.stringify({ text: postText }), // 送信するデータをJSON文字列に変換
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                // 成功した場合
                modalOverlay.classList.remove('is-visible'); // モーダルを閉じる
                fetchAndRenderPosts(); // 投稿リストを再読み込みして最新の状態にする

            } catch (error) {
                console.error('投稿に失敗しました:', error);
                alert(`投稿に失敗しました。\n${error.message}`);
            }
        });
    }

    // --- ▼▼▼ どんまいボタンクリック処理を修正 ▼▼▼ ---
    postListElement.addEventListener('click', async (event) => {
        if (event.target.matches('.reaction__icon[data-action="donmai"]')) {
            const iconElement = event.target;
            const postElement = iconElement.closest('.post');
            const postId = postElement.dataset.postId;
            const countElement = postElement.querySelector('.reaction__count');

            const isReacted = iconElement.classList.contains('reacted');
            const method = isReacted ? 'DELETE' : 'POST'; // HTTPメソッドを決定

            try {
                // バックエンドAPIを呼び出し
                const response = await fetch(`/posts/${postId}/donmai`, {
                    method: method,
                });

                // --- ▼▼▼ エラー処理部分を修正 ▼▼▼ ---
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try {
                        // まずテキストとして一度だけ読み込む
                        const errorText = await response.text();
                        try {
                            // テキストをJSONとして解析してみる
                            const errorData = JSON.parse(errorText);
                            errorMsg = errorData.error || errorMsg; // JSONのエラーメッセージがあれば使う
                        } catch (parseError) {
                            // JSON解析失敗 -> テキストをそのまま使う
                            errorMsg = errorText || errorMsg;
                        }
                    } catch (readError) {
                        // テキスト読み込み自体に失敗した場合
                         console.error("Failed to read error response body:", readError);
                    }
                    throw new Error(errorMsg); // 組み立てたエラーメッセージでエラーを投げる
                }
                // --- ▲▲▲ エラー処理部分を修正 ▲▲▲ ---

                const result = await response.json(); // 成功時のJSONを取得

                // 画面を更新
                countElement.textContent = result.donmai;

                // ボタンの見た目を切り替え
                if (isReacted) {
                    iconElement.classList.remove('reacted');
                } else {
                    iconElement.classList.add('reacted');
                }

            } catch (error) {
                console.error('どんまい処理に失敗しました:', error);
                alert(`どんまいできませんでした。\n理由: ${error.message}`);
            }
        }
    });

    // --- 初期表示 ---
    // ページ読み込み時に投稿を取得して表示
    fetchAndRenderPosts();

});