// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {

    // --- 必要な要素を取得 --- (変更なし)
    const postListElement = document.querySelector('.post-list'); 
    const openModalButton = document.getElementById('open-modal-btn');
    const modalOverlay = document.getElementById('post-modal');
    const closeModalButton = document.getElementById('modal-close-btn');
    const modalTextarea = modalOverlay.querySelector('.modal-textarea');
    const modalSubmitButton = modalOverlay.querySelector('.modal-submit-button');
    const charCountDisplay = document.getElementById('char-count-display');
    const maxLength = 200;

    // --- ▼▼▼ LocalStorage 操作ヘルパーを追加 ▼▼▼ ---
    const MY_POSTS_KEY = 'misstter_my_posts';

    /** LocalStorage から自分の投稿 {id: token} を取得 */
    function getMyPosts() {
        return JSON.parse(localStorage.getItem(MY_POSTS_KEY)) || {};
    }
    /** LocalStorage に自分の投稿 {id: token} を保存 */
    function saveMyPosts(posts) {
        localStorage.setItem(MY_POSTS_KEY, JSON.stringify(posts));
    }
    /** 自分の投稿リストに {id: token} を追加 */
    function addMyPost(id, token) {
        const posts = getMyPosts();
        posts[id] = token;
        saveMyPosts(posts);
    }
    /** 自分の投稿リストから id を削除 */
    function removeMyPost(id) {
        const posts = getMyPosts();
        delete posts[id];
        saveMyPosts(posts);
    }
    /** 指定したIDのトークンを取得 */
    function getMyToken(id) {
        return getMyPosts()[id] || null;
    }
    // --- ▲▲▲ ---


    // --- 関数定義 ---

    // (fetchAndRenderPosts 関数は変更なし)
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
        postListElement.innerHTML = '';

        if (posts.length === 0) {
            postListElement.innerHTML = '<p style="text-align: center; color: #888;">まだ誰もやらかしていません。一番乗りになろう！</p>';
            return;
        }

        // --- ▼▼▼ 削除ボタン表示のために修正 ▼▼▼ ---
        const myPosts = getMyPosts(); // 自分の投稿リストを取得

        posts.forEach(post => {
            if (!post) return; // postがnullの場合スキップ
            const postElement = document.createElement('article');
            postElement.classList.add('post');
            postElement.dataset.postId = post.id; 
            const isMyPost = !!myPosts[post.id]; // この投稿が自分のものかチェック

            // 削除ボタン(&times;)をisMyPostの場合だけ追加
            postElement.innerHTML = `
                <div class="post__emoji">
                    <img src="./front/img/sadicon.png" alt="悲しいアイコン">
                </div>
                <div class="post__content">
                    ${isMyPost ? '<button class="post__delete-button" data-action="delete">削除</button>' : ''}
                    <p class="post__text">${escapeHTML(post.text || '')}</p> 
                    <div class="post__reaction">
                        <span class="reaction__icon" data-action="donmai" role="button" tabindex="0">🤝</span>
                        <span class="reaction__count">${post.donmai || 0}</span>
                    </div>
                </div>
            `;
            postListElement.append(postElement); 
        });
        // --- ▲▲▲ ---
    }

    // (escapeHTML, updateCharCount, モーダル開閉イベント は変更なし)
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML.replace(/\n/g, '<br>'); // 改行を<br>に変換
    }
    function updateCharCount() {
        if (charCountDisplay) {
            const currentLength = modalTextarea.value.length;
            charCountDisplay.textContent = `${currentLength} / ${maxLength}`;
            if (currentLength > maxLength) {
                charCountDisplay.style.color = 'red';
            } else {
                charCountDisplay.style.color = '#888';
            }
        }
    }
    if (openModalButton) {
        openModalButton.addEventListener('click', (event) => {
            event.preventDefault();
            modalOverlay.classList.add('is-visible');
            modalTextarea.value = '';
            updateCharCount();
            modalTextarea.focus();
        });
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            modalOverlay.classList.remove('is-visible');
        });
    }
    if (modalTextarea) {
        modalTextarea.addEventListener('input', updateCharCount);
    }


    // ▼▼▼ モーダルの送信ボタンの処理を修正 (トークン保存) ▼▼▼
    if (modalSubmitButton) {
        modalSubmitButton.addEventListener('click', async () => {
            const postText = modalTextarea.value;

            if (!postText || postText.trim() === '') {
                alert('何か入力してください！');
                return;
            }
            if (postText.length > maxLength) {
                alert(`投稿は ${maxLength} 文字以内でお願いします！ (現在 ${postText.length} 文字)`);
                return;
            }
            
            try {
                const response = await fetch('/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: postText }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                // --- ▼▼▼ レスポンスからトークンを受け取り保存 ▼▼▼ ---
                const result = await response.json(); 
                if (result.post && result.post.id && result.deleteToken) {
                    addMyPost(result.post.id, result.deleteToken); // LocalStorageに保存
                }
                // --- ▲▲▲ ---

                modalOverlay.classList.remove('is-visible'); 
                fetchAndRenderPosts(); // 投稿リストを再読み込み

            } catch (error) {
                console.error('投稿に失敗しました:', error);
                alert(`投稿に失敗しました。\n${error.message}`);
            }
        });
    }

    // --- ▼▼▼ クリック処理を修正 (削除ボタン対応) ▼▼▼ ---
    postListElement.addEventListener('click', async (event) => {
        
        // どんまいボタン処理 (変更なし)
        if (event.target.matches('.reaction__icon[data-action="donmai"]')) {
            // ... (省略) ...
            const iconElement = event.target;
            const postElement = iconElement.closest('.post');
            const postId = postElement.dataset.postId;
            const countElement = postElement.querySelector('.reaction__count');
            const isReacted = iconElement.classList.contains('reacted');
            const method = isReacted ? 'DELETE' : 'POST';

            try {
                const response = await fetch(`/posts/${postId}/donmai`, { method: method });
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try {
                        const errorText = await response.text();
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMsg = errorData.error || errorMsg;
                        } catch (parseError) {
                            errorMsg = errorText || errorMsg;
                        }
                    } catch (readError) {
                         console.error("Failed to read error response body:", readError);
                    }
                    throw new Error(errorMsg); 
                }
                const result = await response.json();
                countElement.textContent = result.donmai;
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

        // --- ▼▼▼ 削除ボタン処理を追加 ▼▼▼ ---
        else if (event.target.matches('.post__delete-button[data-action="delete"]')) {
            const deleteButton = event.target;
            const postElement = deleteButton.closest('.post');
            const postId = postElement.dataset.postId;
            const token = getMyToken(postId); // LocalStorageからトークン取得

            if (!token) {
                alert('この投稿の削除権限トークンが見つかりません。');
                return;
            }
            if (!confirm('本当にこの投稿を削除しますか？\n（この操作は取り消せません）')) {
                return;
            }

            try {
                const response = await fetch(`/posts/${postId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: token }), // トークンをbodyで送る
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                postElement.remove(); // 画面から投稿を削除
                removeMyPost(postId); // LocalStorageからも削除
            } catch (error) {
                console.error('投稿の削除に失敗しました:', error);
                alert(`投稿の削除に失敗しました。\n${error.message}`);
            }
        }
        // --- ▲▲▲ ---
    });

    // --- 初期表示 ---
    fetchAndRenderPosts();

});