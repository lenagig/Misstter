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

    // --- 削除機能用 LocalStorage --- (変更なし)
    const MY_POSTS_KEY = 'misstter_my_posts';
    function getMyPosts() { return JSON.parse(localStorage.getItem(MY_POSTS_KEY)) || {}; }
    function saveMyPosts(posts) { localStorage.setItem(MY_POSTS_KEY, JSON.stringify(posts)); }
    function addMyPost(id, token) { const posts = getMyPosts(); posts[id] = token; saveMyPosts(posts); }
    function removeMyPost(id) { const posts = getMyPosts(); delete posts[id]; saveMyPosts(posts); }
    function getMyToken(id) { return getMyPosts()[id] || null; }

    // どんまい機能用 LocalStorage ヘルパーを追加
    const MY_DONMAI_KEY = 'misstter_my_donmais';

    /** LocalStorage からどんまい済みの投稿IDリストを取得 */
    function getMyDonmais() {
        // Set を使うと重複管理が楽
        const donmais = localStorage.getItem(MY_DONMAI_KEY);
        return donmais ? new Set(JSON.parse(donmais)) : new Set();
    }
    /** LocalStorage にどんまい済みリストを保存 */
    function saveMyDonmais(donmaiSet) {
        localStorage.setItem(MY_DONMAI_KEY, JSON.stringify(Array.from(donmaiSet)));
    }
    /** どんまいリストにIDを追加 */
    function addMyDonmai(id) {
        const donmais = getMyDonmais();
        donmais.add(id);
        saveMyDonmais(donmais);
    }
    /** どんまいリストからIDを削除 */
    function removeMyDonmai(id) {
        const donmais = getMyDonmais();
        donmais.delete(id);
        saveMyDonmais(donmais);
    }
    /** 指定したIDがどんまい済みかチェック */
    function isMyDonmai(id) {
        return getMyDonmais().has(id);
    }


    // --- 関数定義 ---

    // (fetchAndRenderPosts 関数は変更なし)
    async function fetchAndRenderPosts() {
        try {
            const response = await fetch('/posts'); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const posts = await response.json(); 
            renderPosts(posts); 
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

        const myPosts = getMyPosts(); // 削除ボタン用
        const myDonmais = getMyDonmais(); // <<<--- どんまいボタン用 (リロード対策)

        posts.forEach(post => {
            if (!post) return; 
            const postElement = document.createElement('article');
            postElement.classList.add('post');
            postElement.dataset.postId = post.id; 
            const isMyPost = !!myPosts[post.id]; 
            
            // LocalStorage の情報を使ってどんまい済みか判断
            const isMyDonmai = myDonmais.has(String(post.id)); 

            postElement.innerHTML = `
                <div class="post__emoji">
                    <img src="./front/img/sadicon.png" alt="悲しいアイコン">
                </div>
                <div class="post__content">
                    ${isMyPost ? `<button class="post__delete-button" data-action="delete">削除</button>` : ''}
                    <p class="post__text">${escapeHTML(post.text || '')}</p> 
                    <div class="post__reaction">
                        <span class="reaction__icon ${isMyDonmai ? 'reacted' : ''}" data-action="donmai" role="button" tabindex="0">🤝</span>
                        <span class="reaction__count">${post.donmai || 0}</span>
                    </div>
                </div>
            `;
            // --- ▲▲▲ reaction__icon に isMyDonmai ? 'reacted' : '' を追加 ---
            postListElement.append(postElement); 
        });
    }

    // (escapeHTML, updateCharCount, モーダル開閉イベント は変更なし)
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML.replace(/\n/g, '<br>');
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


    // (モーダルの送信ボタンの処理 は変更なし)
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
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ text: postText }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                const result = await response.json(); 
                if (result.post && result.post.id && result.deleteToken) {
                    addMyPost(result.post.id, result.deleteToken); 
                }
                modalOverlay.classList.remove('is-visible'); 
                fetchAndRenderPosts(); 

            } catch (error) {
                console.error('投稿に失敗しました:', error);
                alert(`投稿に失敗しました。\n${error.message}`);
            }
        });
    }

    // どんまいボタンのLocalStorage操作)
    postListElement.addEventListener('click', async (event) => {
        
        // どんまいボタン処理
        if (event.target.matches('.reaction__icon[data-action="donmai"]')) {
            const iconElement = event.target;
            const postElement = iconElement.closest('.post');
            const postId = postElement.dataset.postId;
            const countElement = postElement.querySelector('.reaction__count');
            
            // isReacted は LocalStorage から判断する (見た目ではなく)
            const isReacted = isMyDonmai(postId);
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
                
                // LocalStorage と 見た目の操作
                if (isReacted) {
                    // どんまい解除
                    iconElement.classList.remove('reacted');
                    removeMyDonmai(postId); // LocalStorage から削除
                } else {
                    // どんまい追加
                    iconElement.classList.add('reacted');
                    addMyDonmai(postId); // LocalStorage に追加
                }

            } catch (error) {
                console.error('どんまい処理に失敗しました:', error);
                alert(`どんまいできませんでした。\n理由: ${error.message}`);
            }
        }

        // (削除ボタン処理 は変更なし)
        else if (event.target.matches('.post__delete-button[data-action="delete"]')) {
            const deleteButton = event.target;
            const postElement = deleteButton.closest('.post');
            const postId = postElement.dataset.postId;
            const token = getMyToken(postId); 

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
                    body: JSON.stringify({ token: token }), 
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                postElement.remove(); 
                removeMyPost(postId); 
            } catch (error) {
                console.error('投稿の削除に失敗しました:', error);
                alert(`投稿の削除に失敗しました。\n${error.message}`);
            }
        }
    });

    // --- 初期表示 ---
    fetchAndRenderPosts();

});