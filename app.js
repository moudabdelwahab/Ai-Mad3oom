// Supabase Configuration
const SUPABASE_URL = 'https://cwolpcfqyyrwlbsgezdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t0fNw2UMqWHDy41vVXYwOw_WndpkG_S';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const engine = new CognitiveGrowthEngine(dbClient);

// DOM Elements
const messagesList = document.getElementById('messages-list');
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const userInput = document.getElementById('user-input');
const chatForm = document.getElementById('chat-form');
const typingIndicator = document.getElementById('typing-indicator');
const aiAgeEl = document.getElementById('ai-age');
const aiIndependenceEl = document.getElementById('ai-independence');
const aiModeEl = document.getElementById('ai-mode');

let messageHistory = [];

// 1. Initialize Theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
}

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        sunIcon?.classList.add('hidden');
        moonIcon?.classList.remove('hidden');
    } else {
        sunIcon?.classList.remove('hidden');
        moonIcon?.classList.add('hidden');
    }
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

// 2. Decision Toolbar Component
function createDecisionToolbar(messageText) {
    const toolbar = document.createElement('div');
    toolbar.className = 'decision-toolbar';
    
    const tools = [
        { label: '🔍 تحليل قراري', action: 'analyze' },
        { label: '⚖️ اعترض عليا', action: 'object' },
        { label: '🏁 اعتماد كخطة', action: 'goal' },
        { label: '🧠 اربط بالسجل', action: 'link' },
        { label: '📊 قيّم نمطي', action: 'pattern' }
    ];

    tools.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.innerText = tool.label;
        btn.onclick = async () => {
            btn.disabled = true;
            await handleToolAction(tool.action, messageText);
            btn.disabled = false;
        };
        toolbar.appendChild(btn);
    });

    return toolbar;
}

async function handleToolAction(action, text) {
    typingIndicator.classList.remove('hidden');
    let result = "";

    switch(action) {
        case 'analyze': result = await engine.analyzeDecision(text); break;
        case 'object': result = await engine.objectToDecision(text); break;
        case 'goal': result = await engine.convertToGoal(text); break;
        case 'link': result = await engine.linkToHistory(text); break;
        case 'pattern': result = engine.getPatternSnapshot(); break;
    }

    setTimeout(async () => {
        displayMessage({ role: 'assistant', content: `<div class="decision-result"><strong>[نظام التشغيل القراري]:</strong><br>${result}</div>` });
        await dbClient.from('messages').insert([{ role: 'assistant', content: result }]);
        typingIndicator.classList.add('hidden');
    }, 600);
}

// 3. Core Functions
function displayMessage(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.innerHTML = msg.content;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.appendChild(div);

    if (msg.role === 'user') {
        wrapper.appendChild(createDecisionToolbar(msg.content));
        messageHistory.push(msg);
        if (messageHistory.length > 20) messageHistory.shift();
        engine.analyzeUserBehavior(messageHistory).catch(console.error);
    } else {
        typingIndicator.classList.add('hidden');
    }

    messagesList.appendChild(wrapper);
    messagesList.scrollTop = messagesList.scrollHeight;
}

async function generateResponse(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const { data: matches } = await dbClient.from('brain_memory').select('*').order('weight', { ascending: false });
    
    let response = "لم أتعلم هذا النمط بعد. استخدم شريط الأدوات بالأسفل لتحليل هذا الموقف استراتيجياً.";
    let isMatch = false;

    if (matches) {
        const match = matches.find(m => m.trigger_keywords.some(k => text.includes(k)));
        if (match) {
            response = match.response;
            isMatch = true;
        }
    }

    await engine.evolveAI(isMatch);
    return response;
}

async function handleUserMessage(text) {
    displayMessage({ role: 'user', content: text });
    await dbClient.from('messages').insert([{ role: 'user', content: text }]);

    typingIndicator.classList.remove('hidden');
    
    setTimeout(async () => {
        const response = await generateResponse(text);
        displayMessage({ role: 'assistant', content: response });
        await dbClient.from('messages').insert([{ role: 'assistant', content: response }]);
    }, 800);
}

function updateCognitiveUI(state) {
    if (!state) return;
    if (aiAgeEl) aiAgeEl.textContent = state.age_level || 1;
    if (aiIndependenceEl) aiIndependenceEl.textContent = Math.round((state.independence_score || 0) * 100) + "%";
    if (aiModeEl) aiModeEl.textContent = (state.independence_score > 0.6) ? "Strategic" : "Support";
}

// 4. Start & Events
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        userInput.value = "";
        handleUserMessage(text);
    });
}

async function start() {
    try {
        initTheme();
        await engine.initialize();
        if (engine.aiState) updateCognitiveUI(engine.aiState);
        
        const { data } = await dbClient.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
        if (data) data.forEach(displayMessage);
    } catch (err) {
        console.error("Init error:", err);
    }
}

window.addEventListener("DOMContentLoaded", start);
