// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {

    // --- 必要な要素を取得 ---
    const postListElement = document.querySelector('.post-list'); 
    const openModalButton = document.getElementById('open-modal-btn');
    const modalOverlay = document.getElementById('post-modal');
    const closeModalButton = document.getElementById('modal-close-btn');
    const modalTextarea = modalOverlay.querySelector('.modal-textarea');
    const modalSubmitButton = modalOverlay.querySelector('.modal-submit-button');
    const charCountDisplay = document.getElementById('char-count-display');
    const maxLength = 200;

    // ヘルプモーダル用の要素
    const openHelpButton = document.getElementById('open-help-btn');
    const helpModalOverlay = document.getElementById('help-modal');
    const closeHelpModalButton = document.getElementById('help-modal-close-btn');
    const okHelpModalButton = document.getElementById('help-modal-ok-btn');

    // リロードボタンの処理
    const reloadButton = document.getElementById('reload-btn');
    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            window.location.reload();
        });
    }

    // --- 削除機能用 LocalStorage ---
    const MY_POSTS_KEY = 'misstter_my_posts';
    function getMyPosts() { return JSON.parse(localStorage.getItem(MY_POSTS_KEY)) || {}; }
    function saveMyPosts(posts) { localStorage.setItem(MY_POSTS_KEY, JSON.stringify(posts)); }
    function addMyPost(id, token) { const posts = getMyPosts(); posts[id] = token; saveMyPosts(posts); }
    function removeMyPost(id) { const posts = getMyPosts(); delete posts[id]; saveMyPosts(posts); }
    function getMyToken(id) { return getMyPosts()[id] || null; }

    // どんまい機能用 LocalStorage ヘルパー
    const MY_DONMAI_KEY = 'misstter_my_donmais';
    function getMyDonmais() {
        const donmais = localStorage.getItem(MY_DONMAI_KEY);
        return donmais ? new Set(JSON.parse(donmais)) : new Set();
    }
    function saveMyDonmais(donmaiSet) {
        localStorage.setItem(MY_DONMAI_KEY, JSON.stringify(Array.from(donmaiSet)));
    }
    function addMyDonmai(id) {
        const donmais = getMyDonmais();
        donmais.add(id);
        saveMyDonmais(donmais);
    }
    function removeMyDonmai(id) {
        const donmais = getMyDonmais();
        donmais.delete(id);
        saveMyDonmais(donmais);
    }
    function isMyDonmai(id) {
        return getMyDonmais().has(id);
    }

    // --- 共通関数: 投稿がない時のメッセージを表示 ---
    function showEmptyMessage() {
        postListElement.innerHTML = '<p style="text-align: center; color: #888;">まだ誰もやらかしていません。一番乗りになろう！</p>';
    }

    // --- 投稿取得と表示 ---
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
     */
    function renderPosts(posts) {
        postListElement.innerHTML = '';

        // 1. ここで「最初から0件」の場合のチェック
        if (posts.length === 0) {
            showEmptyMessage(); // 共通関数を呼ぶ
            return;
        }

        const myPosts = getMyPosts(); // 削除ボタン用
        const myDonmais = getMyDonmais(); // どんまいボタン用

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
                    
                    <div class="post__meta">
                        <div class="post__reaction">
                            <span class="reaction__icon ${isMyDonmai ? 'reacted' : ''}" data-action="donmai" role="button" tabindex="0">
                                <img src="./front/img/handinhand.png" alt="どんまい">
                            </span>
                            <span class="reaction__count">${post.donmai || 0}</span>
                        </div>
                        <div class="post__timestamp">
                            ${timeAgo(post.timestamp)}
                        </div>
                    </div>
                    </div>
            `;
            postListElement.append(postElement); 
        });
    }

    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML.replace(/\n/g, '<br>');
    }

    /**
     * ISO 8601 形式の日時文字列から経過時間を計算する関数
     */
    function timeAgo(isoString) {
        if (!isoString) return '';
        
        const now = new Date();
        const past = new Date(isoString);
        const diffMs = now - past;
        
        // 差分（ミリ秒）
        const diffSeconds = Math.round(diffMs / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffMinutes < 1) {
            return `${diffSeconds}秒前`; // 1分以内
        } else if (diffMinutes < 60) {
            return `${diffMinutes}分前`; // 1時間以内
        } else if (diffHours < 24) {
            return `${diffHours}時間前`; // 1日以内
        } else {
            return `${diffDays}日前`; // それ以上
        }
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

    // --- モーダル開閉イベント ---

    // 投稿モーダル
    if (openModalButton) {
        openModalButton.addEventListener('click', (event) => {
            event.preventDefault();
            
            // モーダルを開くときにボタンを「押せる状態」にリセットする
            modalSubmitButton.disabled = false; 

            // もしエラー落ちなどでスピナーのままだったら、紙飛行機に戻しておく
            modalSubmitButton.innerHTML = '<img src="./front/img/send.png" alt="送信">';
            
            openModalButton.classList.add('is-active'); // アクティブ状態を付与
            modalOverlay.classList.add('is-visible');
            modalTextarea.value = '';
            updateCharCount();
            modalTextarea.focus();
        });
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            modalOverlay.classList.remove('is-visible');
            openModalButton.classList.remove('is-active'); // アクティブ状態を解除
        });
    }

    // ヘルプモーダルの開閉イベント
    if (openHelpButton) {
        openHelpButton.addEventListener('click', () => {
            helpModalOverlay.classList.add('is-visible');
            openHelpButton.classList.add('is-active'); // アクティブ状態を付与
        });
    }
    
    if (okHelpModalButton) {
        okHelpModalButton.addEventListener('click', () => {
            helpModalOverlay.classList.remove('is-visible');
            openHelpButton.classList.remove('is-active'); // アクティブ状態を解除
        });
    }

    // --- モーダル外クリックで閉じる処理 (PCのみ) ---
    // タッチデバイス(スマホ・タブレット)では誤操作防止のため閉じないようにする
    function setupModalOutsideClick(overlay, closeAction) {
        let isMouseDownOnOverlay = false;

        // マウスボタンを押した位置を記録
        overlay.addEventListener('mousedown', (event) => {
            isMouseDownOnOverlay = (event.target === overlay);
        });

        overlay.addEventListener('click', (event) => {
            // マウスを押した場所(mousedown)と離した場所(click)が
            // 両方ともオーバーレイの場合だけ閉じる
            if (isMouseDownOnOverlay && event.target === overlay) {
                // PC (マウス操作ができるデバイス) かどうかを判定
                // (hover: hover) はマウスカーソルがある環境で true になる
                const isMouseDevice = window.matchMedia('(hover: hover)').matches;
                if (isMouseDevice) {
                    closeAction();
                }
            }
            // フラグをリセット
            isMouseDownOnOverlay = false;
        });
    }

    // 投稿モーダルの外側クリック設定
    if (modalOverlay) {
        setupModalOutsideClick(modalOverlay, () => {
            //送信処理中（ボタンが無効化されている）場合は閉じない
            if (modalSubmitButton && modalSubmitButton.disabled) return;

            modalOverlay.classList.remove('is-visible');
            if (openModalButton) openModalButton.classList.remove('is-active');
        });
    }

    // ヘルプモーダルの外側クリック設定
    if (helpModalOverlay) {
        setupModalOutsideClick(helpModalOverlay, () => {
            helpModalOverlay.classList.remove('is-visible');
            if (openHelpButton) openHelpButton.classList.remove('is-active');
        });
    }

    // modalTextarea の input イベント
    if (modalTextarea) {
        modalTextarea.addEventListener('input', updateCharCount);
    }


    // --- モーダルの送信ボタンの処理 ---
    if (modalSubmitButton) {
        // 元のボタンの中身（紙飛行機アイコン）を保存しておく変数
        const originalButtonContent = modalSubmitButton.innerHTML;

        modalSubmitButton.addEventListener('click', async () => {
            
            // もし既にボタンが無効化されていたら処理を中断
            if (modalSubmitButton.disabled) return;

            const postText = modalTextarea.value;

            if (!postText || postText.trim() === '') {
                alert('何か入力してね！');
                return;
            }
            if (postText.length > maxLength) {
                alert(`${maxLength} 文字以内で書いてね！ (現在 ${postText.length} 文字)`);
                return;
            }
            
            // ボタンを無効化（処理開始）
            modalSubmitButton.disabled = true;

            // ボタンの中身を「ぐるぐる」に書き換える
            modalSubmitButton.innerHTML = '<div class="button-spinner"></div>';

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
                openModalButton.classList.remove('is-active'); // アクティブ状態を解除
                fetchAndRenderPosts(); 
                

            } catch (error) {
                console.error('投稿に失敗しました:', error);
                alert(`投稿できなかったよ。\n${error.message}`);
                
                // エラー時のみ、ボタンを復活させる（再入力できるように）
                modalSubmitButton.disabled = false;

                // ボタンを戻す
                modalSubmitButton.innerHTML = originalButtonContent;
            }
        });
    }

    // --- クリック処理（どんまい・削除） ---
    postListElement.addEventListener('click', async (event) => {

        // 画像をクリックしても親のボタン要素を取得できるように .closest() を使う
        const iconElement = event.target.closest('.reaction__icon[data-action="donmai"]');
        
        // どんまいボタン処理
        if (iconElement) {
            
            // 連打防止
            if (iconElement.dataset.processing) return;

            iconElement.dataset.processing = "true";
            
            setTimeout(() => {
                delete iconElement.dataset.processing;
            }, 300);

            const postElement = iconElement.closest('.post');
            const postId = postElement.dataset.postId;
            const countElement = postElement.querySelector('.reaction__count');
            
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
                
                if (isReacted) {
                    iconElement.classList.remove('reacted');
                    removeMyDonmai(postId); 
                } else {
                    iconElement.classList.add('reacted');
                    addMyDonmai(postId); 
                }

            } catch (error) {
                console.error('どんまい処理に失敗しました:', error);
                alert(`どんまいできなかったよ。\n ${error.message}`);
            }
        }

        // 削除ボタン処理
        else if (event.target.matches('.post__delete-button[data-action="delete"]')) {
            const deleteButton = event.target;
            const postElement = deleteButton.closest('.post');
            const postId = postElement.dataset.postId;
            const token = getMyToken(postId); 

            if (!token) {
                alert('この投稿の削除権限トークンが見つかりません。');
                return;
            }

            // ダイアログ表示中だけ色を変える処理
            deleteButton.classList.add('is-active');

            // 色が変わるのを確実にするため、少しだけタイミングを遅らせてダイアログを出す
            setTimeout(async () => {
                const isConfirmed = confirm('本当に消しちゃう？\n（この操作は取り消せません）');
                
                // ダイアログ操作が終わったらすぐに色を戻す
                deleteButton.classList.remove('is-active');

                if (!isConfirmed) {
                    return; // キャンセル時は何もしない
                }

                // --- 以前と同じ削除処理 ---
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

                    // 2. ここで「消した結果0件になった」場合のチェック
                    if (postListElement.children.length === 0) {
                        showEmptyMessage(); // 共通関数を呼ぶ
                    }

                } catch (error) {
                    console.error('投稿の削除に失敗しました:', error);
                    alert(`投稿消せなかったよ。\n${error.message}`);
                }
            }, 10); // 10ミリ秒だけ待つ
        }
    });

    // --- 初期表示 ---
    fetchAndRenderPosts();

});