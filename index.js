/*
  GoldenY — 2‑file version (index.html + index.js)
  Features:
  - Seed your own Questions & Answers in code (knowledgeBase)
  - Very simple learning from chats (memorizes facts like name, favorites)
  - Stores everything in localStorage (per device)
  - Tiny keyword matcher to answer from your seeded Q&A before a fallback

  HOW TO ADD Q&A:
  1) Scroll to the knowledgeBase below.
  2) Add an object like this:
     addQA({ keywords: ["math", "homework"], answer: "Try breaking the problem into steps..." });
  3) Each "keywords" word is matched case‑insensitively. The highest score wins.
  4) You can also call addQAExact({ question: "What is GoldenY?", answer: "GoldenY is..." }) for exact text match.
*/

// ======= DOM =======
const chatLog = document.getElementById('chatLog');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');

// ======= Local Storage Helpers =======
const LS = {
  messagesKey: 'goldeny_messages_v1',
  factsKey: 'goldeny_facts_v1',
  loadMessages() {
    try { return JSON.parse(localStorage.getItem(this.messagesKey)) || []; } catch { return []; }
  },
  saveMessages(msgs) {
    localStorage.setItem(this.messagesKey, JSON.stringify(msgs));
  },
  loadFacts() {
    try { return JSON.parse(localStorage.getItem(this.factsKey)) || []; } catch { return []; }
  },
  saveFacts(facts) {
    localStorage.setItem(this.factsKey, JSON.stringify(facts));
  },
  clear() {
    localStorage.removeItem(this.messagesKey);
    localStorage.removeItem(this.factsKey);
  }
};

let MESSAGES = LS.loadMessages();
let FACTS = LS.loadFacts(); // array of {k, v, ts}

// ======= Knowledge Base (seed your Q&A here) =======
const knowledgeBase = [];

function addQA({ keywords = [], answer = '' }) {
  knowledgeBase.push({ type: 'keywords', keywords: keywords.map(k => k.toLowerCase()), answer });
}
function addQAExact({ question = '', answer = '' }) {
  knowledgeBase.push({ type: 'exact', question: question.trim().toLowerCase(), answer });
}

// --- EXAMPLE SEEDED Q&A ---
addQAExact({
  question: 'what is goldeny?',
  answer: 'GoldenY is your friendly study assistant built by Faris. It can remember simple facts you tell it on this device.'
});
addQA({
  keywords: ['price', 'plan', 'subscribe'],
  answer: 'Plans are flexible. For now, GoldenY is free in this demo. Paid plans can add cloud memory later.'
});
addQA({
  keywords: ['name', 'who', 'are', 'you'],
  answer: "I'm GoldenY — happy to help with schoolwork, coding, and quick facts!"
});
addQA({
  keywords: ['math', 'homework'],
  answer: 'For math homework, try writing what is known, what is asked, and solve step by step. I can walk you through an example if you paste it.'
});
addQA({
  keywords: ['lebanon', 'country'],
  answer: 'Lebanon is a West Asian country on the eastern shore of the Mediterranean Sea. Beirut is the capital.'
});

// ======= Chat Rendering =======
function renderMessages() {
  chatLog.innerHTML = '';
  for (const m of MESSAGES) {
    const row = document.createElement('div');
    row.className = 'row ' + (m.role === 'user' ? 'user' : 'bot');
    row.innerHTML = `<div class="bubble"><strong>${m.role === 'user' ? 'You' : 'GoldenY'}</strong><br>${escapeHTML(m.content)}</div>`;
    chatLog.appendChild(row);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function pushMessage(role, content) {
  MESSAGES.push({ role, content, ts: Date.now() });
  LS.saveMessages(MESSAGES);
  renderMessages();
}

// ======= Mini NLP: memory extractors =======
function learnFrom(text) {
  // Patterns: "my name is X", "remember that ...", "I like ...", "my favorite ... is ..."
  const addFact = (k, v) => {
    FACTS.push({ k, v, ts: Date.now() });
    LS.saveFacts(FACTS);
  };

  let m;
  if ((m = text.match(/\bmy name is\s+([a-zA-Z0-9_\- ]{2,40})/i))) {
    addFact('name', m[1].trim());
  }
  if ((m = text.match(/\bremember that\s+(.{3,120})/i))) {
    addFact('note', m[1].trim());
  }
  if ((m = text.match(/\bi like\s+([^.!?]{2,60})/i))) {
    addFact('likes', m[1].trim());
  }
  if ((m = text.match(/\bmy favorite ([a-z ]{2,20}) is\s+([^.!?]{2,60})/i))) {
    addFact(`favorite_${m[1].trim()}`, m[2].trim());
  }
}

function shortFactsSummary(limit = 3) {
  const latest = FACTS.slice(-limit);
  if (!latest.length) return '';
  return '\n\n[Notes I remember here: ' + latest.map(f => `${f.k} = ${f.v}`).join(' • ') + ']';
}

// ======= Answer Selection =======
function bestSeededAnswer(userText) {
  const t = userText.trim().toLowerCase();

  // Exact first
  for (const item of knowledgeBase) {
    if (item.type === 'exact' && t === item.question) return { answer: item.answer, score: 1000 };
  }

  // Keyword score
  let best = { answer: null, score: -1 };
  for (const item of knowledgeBase) {
    if (item.type !== 'keywords') continue;
    const score = item.keywords.reduce((acc, kw) => acc + (t.includes(kw) ? 1 : 0), 0);
    if (score > best.score) best = { answer: item.answer, score };
  }
  return best;
}

function fallbackAnswer(userText) {
  // Very simple fallback using facts
  const nameFact = FACTS.find(f => f.k === 'name');
  let intro = nameFact ? `Hi ${nameFact.v}! ` : '';
  return (
    intro +
    "I don't have a perfect answer for that yet, but I saved our notes on this device. " +
    'Try rephrasing or add a Q&A rule in code with addQA(...) so I can answer directly.' +
    shortFactsSummary()
  );
}

async function handleUserMessage() {
  const text = (userInput.value || '').trim();
  if (!text) return;

  pushMessage('user', text);
  learnFrom(text);

  // 1) Try seeded Q&A
  const { answer, score } = bestSeededAnswer(text);
  let reply;
  if (answer && score > 0) {
    reply = answer;
  } else {
    reply = fallbackAnswer(text);
  }

  // Use facts politely in replies
  const nameFact = FACTS.find(f => f.k === 'name');
  if (nameFact && !reply.toLowerCase().includes(nameFact.v.toLowerCase())) {
    reply = reply.replace(/^/, `Okay ${nameFact.v}, `);
  }

  pushMessage('assistant', reply);
  userInput.value = '';
}

// ======= Events =======
sendBtn?.addEventListener('click', handleUserMessage);
userInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleUserMessage();
  }
});

resetBtn?.addEventListener('click', () => {
  if (confirm('Clear chat and local facts on this device?')) {
    MESSAGES = [];
    FACTS = [];
    LS.clear();
    renderMessages();
  }
});

// ======= Utils =======
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// ======= Boot =======
renderMessages();

// Optional: greet on first run
if (!MESSAGES.length) {
  pushMessage('assistant', "Hey! I'm GoldenY. Tell me your name (e.g., ‘my name is Faris’) and ask me anything. You can also say ‘remember that ...’ to save a note.");
}
