const SUPABASE_URL  = 'https://xmhtxfyaewwerbkoubqk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaHR4ZnlhZXd3ZXJia291YnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MDMwNzcsImV4cCI6MjA5Njk3OTA3N30.IQupFoqMWqHskT2Gv3WM3pz7J8HroWpbdbsA1LDDmXM';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const BACKEND_URL = 'https://usap-backend-production.up.railway.app';

/* ── State ── */
var currentUser = null;
var currentUsername = 'user';
var currentMysqlUserId = null; // the real MySQL user_id, not the Supabase UUID
var posts = [];                // populated from the backend, no longer fake/local
var activePostId = null;       // post open in comment modal
var privacySetting = 'Everyone';

/* ── Init ── */
(async function init() {
  var res = await supabaseClient.auth.getSession();
  var session = res.data.session;
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;
  currentUsername = currentUser.user_metadata && currentUser.user_metadata.username
    ? currentUser.user_metadata.username
    : (currentUser.email || 'user');
  var accountType = currentUser.user_metadata && currentUser.user_metadata.account_type
    ? currentUser.user_metadata.account_type
    : 'normal';
  var handle = '@' + currentUsername.toLowerCase().replace(/\s+/g, '');
  document.getElementById('sidebar-username').textContent = currentUsername;
  document.getElementById('sidebar-handle').textContent = handle;
  document.getElementById('logout-handle').textContent = handle;

  // Make sure this Supabase user has a matching row in MySQL, then load the feed
  await syncUser(accountType);
  await loadPosts();
})();

/* ── Sync Supabase user into MySQL, get back the real user_id ── */
async function syncUser(accountType) {
  try {
    var res = await fetch(BACKEND_URL + '/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabase_uid: currentUser.id,
        username: currentUsername,
        account_type: accountType
      })
    });
    var data = await res.json();
    currentMysqlUserId = data.user_id;
  } catch (err) {
    console.error('Failed to sync user with backend:', err);
  }
}

/* ── Load posts from the backend ── */
async function loadPosts() {
  try {
    var res = await fetch(BACKEND_URL + '/posts');
    var rows = await res.json();
    posts = rows.map(function(row) {
      return {
        id: row.post_id,
        userId: row.user_id,
        username: row.username,
        content: row.content,
        privacy: row.privacy,
        createdAt: row.created_at,
        relateCount: 0,        // filled in by loadRelateCount per card
        commentCount: 0,       // filled in by loadCommentCount per card
        relatedByMe: false
      };
    });
    renderFeed();
  } catch (err) {
    console.error('Failed to load posts:', err);
  }
}

/* ── Tabs ── */
document.getElementById('tab-foryou').addEventListener('click', function() {
  setTab('foryou');
});
document.getElementById('tab-following').addEventListener('click', function() {
  setTab('following');
});
function setTab(tab) {
  document.getElementById('tab-foryou').classList.toggle('active', tab === 'foryou');
  document.getElementById('tab-following').classList.toggle('active', tab === 'following');
  renderFeed();
}

/* ── Composer ── */
document.getElementById('open-composer').addEventListener('click', openComposer);
document.getElementById('usap-btn-collapsed').addEventListener('click', openComposer);

function openComposer() {
  document.getElementById('post-collapsed').classList.add('hidden');
  document.getElementById('composer').classList.remove('hidden');
  document.getElementById('composer-text').focus();
}

document.getElementById('composer-text').addEventListener('input', function() {
  var hasText = this.value.trim().length > 0;
  document.getElementById('submit-post').classList.toggle('active', hasText);
});
function closeComposer() {
  document.getElementById('composer').classList.add('hidden');
  document.getElementById('post-collapsed').classList.remove('hidden');
  document.getElementById('submit-post').classList.remove('active');
  document.getElementById('composer-text').value = '';
  privacySetting = 'Everyone';
  document.getElementById('privacy-label').textContent = 'Everyone can reply';
  document.querySelectorAll('.privacy-opt').forEach(function(o) {
    o.classList.toggle('active', o.dataset.v === 'Everyone');
  });
}

document.getElementById('submit-post').addEventListener('click', async function() {
  var text = document.getElementById('composer-text').value.trim();
  if (!text || !currentMysqlUserId) return;

  try {
    var res = await fetch(BACKEND_URL + '/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentMysqlUserId,
        content: text,
        privacy: privacySetting
      })
    });
    if (!res.ok) throw new Error('Failed to create post');
  } catch (err) {
    console.error(err);
    return;
  }

  closeComposer();
  document.getElementById('tab-foryou').classList.add('active');
  document.getElementById('tab-following').classList.remove('active');
  await loadPosts(); // reload so the new post (with its real post_id) shows up
});

/* Privacy */
document.getElementById('privacy-toggle').addEventListener('click', function(e) {
  e.stopPropagation();
  document.getElementById('privacy-menu').classList.toggle('hidden');
});
document.querySelectorAll('.privacy-opt').forEach(function(btn) {
  btn.addEventListener('click', function() {
    privacySetting = this.dataset.v;
    document.getElementById('privacy-label').textContent = privacySetting + ' can reply';
    document.querySelectorAll('.privacy-opt').forEach(function(o) {
      o.classList.toggle('active', o === btn);
    });
    document.getElementById('privacy-menu').classList.add('hidden');
  });
});

/* Profile / Logout */
document.getElementById('profile-row').addEventListener('click', function(e) {
  e.stopPropagation();
  document.getElementById('logout-popup').classList.toggle('hidden');
});
document.getElementById('logout-btn').addEventListener('click', async function() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

/* Close dropdowns on outside click */
document.addEventListener('click', function(e) {
  if (!e.target.closest('#composer') && !e.target.closest('#post-collapsed')) {
    var composer = document.getElementById('composer');
    if (!composer.classList.contains('hidden') && !document.getElementById('composer-text').value.trim()) {
      closeComposer();
    }
  }
  if (!e.target.closest('#privacy-toggle') && !e.target.closest('#privacy-menu')) {
    document.getElementById('privacy-menu').classList.add('hidden');
  }
  if (!e.target.closest('#profile-row') && !e.target.closest('#logout-popup')) {
    document.getElementById('logout-popup').classList.add('hidden');
  }
});

/* ── Render feed ── */
function renderFeed() {
  var area = document.getElementById('posts-area');
  var skeleton = document.getElementById('skeleton-wrap');
  area.querySelectorAll('.post-card').forEach(function(el) { el.remove(); });

  if (posts.length === 0) {
    skeleton.classList.remove('hidden');
    return;
  }
  skeleton.classList.add('hidden');

  posts.forEach(function(post) {
    var card = makePostCard(post);
    area.appendChild(card);
    loadRelateCount(post, card);
    loadCommentCount(post, card);
  });
}

/* Pull the live relate count for one post from the backend */
async function loadRelateCount(post, card) {
  try {
    var res = await fetch(BACKEND_URL + '/relates/' + post.id);
    var data = await res.json();
    post.relateCount = data.relate_count;
    var span = card.querySelector('.relate-count');
    if (span) span.textContent = post.relateCount || '';
  } catch (err) {
    console.error('Failed to load relate count:', err);
  }
}

/* Pull the live comment count for one post from the backend */
async function loadCommentCount(post, card) {
  try {
    var res = await fetch(BACKEND_URL + '/comments/' + post.id);
    var data = await res.json();
    post.commentCount = data.length;
    var span = card.querySelector('.comment-count-label');
    if (span) span.textContent = post.commentCount || '';
  } catch (err) {
    console.error('Failed to load comment count:', err);
  }
}

function makePostCard(post) {
  var card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.id = post.id;

  var timeLabel = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'just now';
  card.innerHTML =
    '<div class="post-header">' +
      '<div class="post-user-avatar"></div>' +
      '<div class="post-user-meta">' +
        '<span class="post-username">' + esc(post.username) + '</span>' +
        '<span class="post-time">' + esc(timeLabel) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="post-content">' + esc(post.content) + '</div>' +
    '<div class="post-actions">' +
      '<button class="action-btn relate-btn' + (post.relatedByMe ? ' active' : '') + '" data-id="' + post.id + '">' +
        '<svg viewBox="0 0 18 18" fill="none"><path d="M9 2L11.47 7H17l-4.5 3.5L14 17 9 13.5 4 17l1.5-6.5L1 7h5.53L9 2z" fill="' + (post.relatedByMe ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
        '<span class="relate-count">' + (post.relateCount || '') + '</span>' +
      '</button>' +
      '<button class="action-btn down-btn" data-id="' + post.id + '">' +
        '<svg viewBox="0 0 10 18" fill="none"><path d="M5 16V2M1 12l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<button class="action-btn comment-btn" data-id="' + post.id + '">' +
        '<svg viewBox="0 0 18 18" fill="none"><path d="M16 1H2a1 1 0 00-1 1v10a1 1 0 001 1h5l2 3 2-3h5a1 1 0 001-1V2a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
        '<span class="comment-count-label">' + (post.commentCount || '') + '</span>' +
      '</button>' +
    '</div>';

  // Relate (up arrow) — now writes to MySQL via the backend
  card.querySelector('.relate-btn').addEventListener('click', async function() {
    if (post.relatedByMe || !currentMysqlUserId) return; // simple toggle-once model
    try {
      var res = await fetch(BACKEND_URL + '/relates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, user_id: currentMysqlUserId })
      });
      if (!res.ok) throw new Error('Failed to relate');
      post.relatedByMe = true;
      post.relateCount = (post.relateCount || 0) + 1;
      var isOwn = post.userId === currentMysqlUserId;
      if (!isOwn) addNotification('relate', post.username, currentUsername, post.content);
      refreshCard(post);
    } catch (err) {
      console.error(err);
    }
  });

  // Comment icon
  card.querySelector('.comment-btn').addEventListener('click', function() {
    openCommentModal(post);
  });

  return card;
}

function refreshCard(post) {
  var old = document.querySelector('.post-card[data-id="' + post.id + '"]');
  if (!old) return;
  var fresh = makePostCard(post);
  old.replaceWith(fresh);
}

/* ── Comment modal ── */
async function openCommentModal(post) {
  activePostId = post.id;
  document.getElementById('comment-original').innerHTML =
    '<strong>' + esc(post.username) + '</strong>: ' + esc(post.content);
  await loadAndRenderComments(post);
  document.getElementById('comment-modal').classList.remove('hidden');
  document.getElementById('comment-input').focus();
}

/* Pull real comments for one post from the backend, then render them */
async function loadAndRenderComments(post) {
  try {
    var res = await fetch(BACKEND_URL + '/comments/' + post.id);
    var rows = await res.json();
    var comments = rows.map(function(row) {
      return { username: row.username, text: row.content };
    });
    renderComments(comments);
  } catch (err) {
    console.error('Failed to load comments:', err);
    renderComments([]);
  }
}

function renderComments(comments) {
  var list = document.getElementById('comment-list');
  var empty = document.getElementById('comment-empty');
  list.querySelectorAll('.comment-item').forEach(function(el) { el.remove(); });
  if (!comments || comments.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  comments.forEach(function(c) {
    var item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML =
      '<div class="comment-avatar"></div>' +
      '<div class="comment-bubble">' +
        '<div class="comment-username">' + esc(c.username) + '</div>' +
        '<div class="comment-text">' + esc(c.text) + '</div>' +
      '</div>';
    list.appendChild(item);
  });
}

document.getElementById('close-comment-modal').addEventListener('click', function() {
  document.getElementById('comment-modal').classList.add('hidden');
  activePostId = null;
});

document.getElementById('comment-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.add('hidden');
    activePostId = null;
  }
});

document.getElementById('comment-send').addEventListener('click', submitComment);
document.getElementById('comment-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') submitComment();
});

async function submitComment() {
  var text = document.getElementById('comment-input').value.trim();
  if (!text || activePostId === null || !currentMysqlUserId) return;
  var post = posts.find(function(p) { return p.id === activePostId; });
  if (!post) return;

  try {
    var res = await fetch(BACKEND_URL + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: post.id,
        user_id: currentMysqlUserId,
        content: text
      })
    });
    if (!res.ok) throw new Error('Failed to add comment');
  } catch (err) {
    console.error(err);
    return;
  }

  post.commentCount = (post.commentCount || 0) + 1;
  var isOwn = post.userId === currentMysqlUserId;
  if (!isOwn) addNotification('comment', post.username, currentUsername, text);

  document.getElementById('comment-input').value = '';
  await loadAndRenderComments(post);
  refreshCard(post);
}

/* ── Notifications ── */
function addNotification(type, postOwner, actorName, previewText) {
  var empty = document.getElementById('notif-empty');
  var list  = document.getElementById('notif-list');
  empty.classList.add('hidden');
  list.classList.remove('hidden');

  var item = document.createElement('div');
  item.className = 'notif-item';

  var iconSvg, mainHtml, previewHtml = '';

  if (type === 'relate') {
    iconSvg = '<svg viewBox="0 0 31 28" fill="none" width="31" height="28"><path d="M15.5 26S2 17 2 8.5a7.5 7.5 0 0113.5-4.5A7.5 7.5 0 0129 8.5C29 17 15.5 26 15.5 26z" stroke="white" stroke-width="2" fill="white"/></svg>';
    mainHtml = '<span class="notif-at">@' + esc(actorName) + '</span> Relates to your USAP';
    previewHtml = '<div class="notif-preview">' + esc(previewText.slice(0, 60)) + '</div>';
  } else if (type === 'comment') {
    iconSvg = '<svg viewBox="0 0 30 30" fill="none" width="30" height="30"><path d="M27 1H3a2 2 0 00-2 2v17a2 2 0 002 2h5l7 7 7-7h5a2 2 0 002-2V3a2 2 0 00-2-2z" stroke="white" stroke-width="2" fill="none"/></svg>';
    mainHtml = '<span class="notif-at">@' + esc(actorName) + '</span> commented on your USAP';
    previewHtml =
      '<div class="notif-preview">Replying to @' + esc(postOwner) + '</div>' +
      '<div class="notif-comment-text">' + esc(previewText.slice(0, 80)) + '</div>';
  }

  item.innerHTML =
    '<div class="notif-icon-wrap">' + iconSvg + '</div>' +
    '<div class="notif-user-avatar" style="margin-right:0;margin-left:16px;flex-shrink:0"></div>' +
    '<div style="padding-left:16px;flex:1">' +
      '<div class="notif-main">' + mainHtml + '</div>' +
      previewHtml +
    '</div>';

  list.insertBefore(item, list.firstChild);
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
