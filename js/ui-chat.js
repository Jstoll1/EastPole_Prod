// ── Firebase Chat ──
const firebaseConfig = {
  apiKey: "AIzaSyDRylI1gb5BZivzUhC0imapmUcqVl2AWr8",
  authDomain: "eastpole-3a485.firebaseapp.com",
  databaseURL: "https://eastpole-3a485-default-rtdb.firebaseio.com",
  projectId: "eastpole-3a485",
  storageBucket: "eastpole-3a485.firebasestorage.app",
  messagingSenderId: "616168641368",
  appId: "1:616168641368:web:5fa3505ad3371415fb8b2d",
  measurementId: "G-YL3XLG1JG1"
};
const fbApp = firebase.initializeApp(firebaseConfig);
const chatDb = firebase.database();
const chatRef = chatDb.ref('chat/messages');
let chatLoaded = false;
let chatMsgCount = 0;
let chatDrawerOpen = false;
let chatUnread = 0;
let chatInitialLoad = true;
let chatDisplayName = localStorage.getItem('eastpole_chat_name') || '';

function toggleChatDrawer() {
  chatDrawerOpen = !chatDrawerOpen;
  document.getElementById('chat-drawer').classList.toggle('open', chatDrawerOpen);
  document.getElementById('chat-overlay').classList.toggle('open', chatDrawerOpen);
  document.getElementById('chat-fab').classList.toggle('hidden', chatDrawerOpen);
  if (chatDrawerOpen) {
    chatUnread = 0;
    updateChatBadge();
    const m = document.getElementById('chat-messages');
    m.scrollTop = m.scrollHeight;
    const inp = document.getElementById('chat-input');
    if (inp) setTimeout(() => inp.focus(), 300);
  }
}

function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (chatUnread > 0) {
    badge.textContent = chatUnread > 99 ? '99+' : chatUnread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

let chatNameLocked = false;

function lockChatName() {
  chatNameLocked = true;
  const nameInp = document.getElementById('chat-name-input');
  nameInp.disabled = true;
  // Add lock icon if not already there
  const row = document.getElementById('chat-name-row');
  if (!row.querySelector('.chat-lock-icon')) {
    const lock = document.createElement('span');
    lock.className = 'chat-lock-icon';
    lock.textContent = '🔒';
    row.appendChild(lock);
  }
}

function initChat() {
  const nameInp = document.getElementById('chat-name-input');

  // Pre-populate name: from localStorage first, then from team selection
  if (!chatDisplayName && currentUserEmail && currentUserTeams.length > 0) {
    const team = currentUserTeams[activeTeamIdx >= 0 ? activeTeamIdx : 0];
    if (team) chatDisplayName = team.name;
  }
  if (chatDisplayName) {
    nameInp.value = chatDisplayName;
  }

  if (!chatLoaded) {
    chatLoaded = true;
    const messagesEl = document.getElementById('chat-messages');
    const emptyEl = document.getElementById('chat-empty');

    chatRef.orderByChild('timestamp').limitToLast(200).on('child_added', snap => {
      const msg = snap.val();
      if (!msg || !msg.text) return;
      if (emptyEl.style.display !== 'none') emptyEl.style.display = 'none';
      chatMsgCount++;
      appendChatMessage(msg, messagesEl, snap.key);
      if (!chatInitialLoad && !chatDrawerOpen) {
        chatUnread++;
        updateChatBadge();
      }
    });

    chatRef.orderByChild('timestamp').limitToLast(200).once('value', () => {
      chatInitialLoad = false;
    });
  }

  // Input handlers
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send-btn');
  input.oninput = () => { btn.disabled = !input.value.trim(); };
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } };
}

const CHAT_EMOJIS = ['👍','😂','🔥','⛳','💀','❤️'];

function appendChatMessage(msg, container, msgKey) {
  const isMine = chatDisplayName && msg.name === chatDisplayName;
  const div = document.createElement('div');
  div.className = 'chat-msg ' + (isMine ? 'mine' : 'other');
  if (msgKey) div.dataset.msgKey = msgKey;

  const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
  const now = new Date();
  const isToday = ts.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = ts.toDateString() === yesterday.toDateString();
  let timeStr;
  if (isToday) {
    timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (isYesterday) {
    timeStr = 'Yesterday ' + ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else {
    timeStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const senderHtml = `<div class="chat-sender">${escHtml(msg.name || 'Anonymous')}</div>`;
  div.innerHTML = `${senderHtml}<div class="chat-text">${escHtml(msg.text)}</div><div class="chat-time">${timeStr}</div><div class="chat-reactions" data-key="${msgKey||''}"></div><button class="chat-react-add" onclick="showReactPicker(this)">+</button>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Listen for reactions on this message
  if (msgKey) {
    chatRef.child(msgKey).child('reactions').on('value', snap => {
      renderReactions(div, snap.val(), msgKey);
    });
  }
}

function renderReactions(msgEl, reactions, msgKey) {
  const container = msgEl.querySelector('.chat-reactions');
  if (!container) return;
  container.innerHTML = '';
  if (!reactions) return;
  // Aggregate: { emoji: [name1, name2] }
  const agg = {};
  Object.entries(reactions).forEach(([uid, emoji]) => {
    if (!agg[emoji]) agg[emoji] = [];
    agg[emoji].push(uid);
  });
  Object.entries(agg).forEach(([emoji, users]) => {
    const isMineReact = users.includes(chatDisplayName);
    const btn = document.createElement('button');
    btn.className = 'chat-react-btn' + (isMineReact ? ' mine-react' : '');
    btn.title = users.join(', ');
    btn.innerHTML = `${emoji}<span class="react-count">${users.length}</span>`;
    btn.onclick = () => toggleReaction(msgKey, emoji);
    container.appendChild(btn);
  });
}

function showReactPicker(addBtn) {
  // Close any existing picker
  const existing = document.querySelector('.chat-react-picker');
  if (existing) existing.remove();
  if (!chatDisplayName) return;

  const picker = document.createElement('div');
  picker.className = 'chat-react-picker';
  CHAT_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.onclick = (e) => {
      e.stopPropagation();
      const msgEl = addBtn.closest('.chat-msg');
      const msgKey = msgEl.dataset.msgKey;
      if (msgKey) toggleReaction(msgKey, emoji);
      picker.remove();
    };
    picker.appendChild(btn);
  });
  addBtn.parentElement.style.position = 'relative';
  addBtn.parentElement.appendChild(picker);

  // Close picker on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', closePicker); }
    });
  }, 0);
}

function toggleReaction(msgKey, emoji) {
  if (!chatDisplayName || !msgKey) return;
  const reactRef = chatRef.child(msgKey).child('reactions').child(chatDisplayName);
  reactRef.once('value', snap => {
    if (snap.val() === emoji) {
      reactRef.remove(); // un-react
    } else {
      reactRef.set(emoji); // add/change reaction
    }
  });
}

function sendChatMessage() {
  const nameInp = document.getElementById('chat-name-input');
  const name = nameInp.value.trim();
  if (!name) { nameInp.focus(); return; }

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Lock the name on first send
  if (!chatNameLocked) {
    chatDisplayName = name;
    localStorage.setItem('eastpole_chat_name', name);
    lockChatName();
  }

  chatRef.push({
    name: chatDisplayName,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  input.value = '';
  document.getElementById('chat-send-btn').disabled = true;
}
