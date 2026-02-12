// Supabase Configuration - ضع مفاتيحك هنا
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize Cognitive Engine
const engine = new CognitiveGrowthEngine(supabase);

// DOM Elements
const messagesList = document.getElementById('messages-list');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const btnWritingStyle = document.getElementById('btn-writing-style');
const btnDecision = document.getElementById('btn-decision');
const typingIndicator = document.getElementById('typing-indicator');

// Cognitive UI Elements
const aiAgeEl = document.getElementById('ai-age');
const aiIndependenceEl = document.getElementById('ai-independence');
const aiModeEl = document.getElementById('ai-mode');

let lastAssistantResponse = "";
let lastUserMessage = "";
let messageHistory = [];

// 1. Initialize Realtime Subscriptions
function initRealtime() {
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            displayMessage(payload.new);
        })
        .subscribe();

    supabase
        .channel('public:ai_state')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_state' }, payload => {
            updateCognitiveUI(payload.new);
        })
        .subscribe();
}

// 2. Text Processing Functions
function tokenizeText(text) {
    if (!text) return [];
    return text.toLowerCase()
        .replace(/[.,!?;:]/g, "")
        .split(/\s+/)
        .filter(word => word.length > 2);
}

async function matchMemory(tokens) {
    const { data, error } = await supabase.from('brain_memory').select('*');
    if (error) return [];
    return data.filter(item => item.trigger_keywords.some(keyword => tokens.includes(keyword.toLowerCase())));
}

function rankResults(matches) {
    return matches.sort((a, b) => b.weight - a.weight);
}

async function generateResponse(text) {
    const tokens = tokenizeText(text);
    const matches = await matchMemory(tokens);
    const ranked = rankResults(matches);

    let response = "";
    let isMatch = false;

    if (ranked.length > 0) {
        response = ranked[0].response;
        isMatch = true;
    } else {
        const { data: decisions } = await supabase.from('brain_memory').select('response').eq('type', 'decision').limit(1);
        if (decisions && decisions.length > 0) {
            response = "بناءً على قرارات سابقة: " + decisions[0].response;
        } else {
            response = "لم أتعلم هذا بعد. يمكنك تعليمي.";
        }
    }

    // Cognitive Layer: Check for Independence/Intervention
    if (engine.shouldIntervene(text, response)) {
        const interventionPrefix = engine.currentMode === 'strategic' 
            ? "بصفتي مساعدك الاستراتيجي، أرى خياراً أفضل: " 
            : "هل فكرت في هذا البديل؟ ";
        response = `<span class="intervention-msg">${interventionPrefix}</span>` + response;
    }

    // Evolve AI based on interaction success (match found = success)
    await engine.evolveAI(isMatch);
    
    return response;
}

// 3. Database Operations
async function saveMessage(role, content) {
    await supabase.from('messages').insert([{ role, content }]);
}

async function saveToMemory(type, trigger_keywords, response, weight) {
    await supabase.from('brain_memory').insert([{ type, trigger_keywords, response, weight }]);
    alert('تم الحفظ في الذاكرة بنجاح!');
}

function updateCognitiveUI(state) {
    if (!state) return;
    aiAgeEl.textContent = state.age_level;
    aiIndependenceEl.textContent = Math.round(state.independence_score * 100) + "%";
    aiModeEl.textContent = state.independence_score > 0.6 ? "Strategic" : "Support";
}

// 4. UI Functions
function displayMessage(msg) {
    if (msg.role === 'assistant') typingIndicator.classList.add('hidden');

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.innerHTML = msg.content; // Using innerHTML to support intervention-msg span
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
    
    if (msg.role === 'assistant') {
        lastAssistantResponse = msg.content;
    } else {
        lastUserMessage = msg.content;
        messageHistory.push(msg);
        if (messageHistory.length > 50) messageHistory.shift();
        // Analyze behavior every 5 messages
        if (messageHistory.length % 5 === 0) engine.analyzeUserBehavior(messageHistory);
    }
}

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = "";
    await saveMessage('user', text);

    typingIndicator.classList.remove('hidden');
    messagesList.scrollTop = messagesList.scrollHeight;

    setTimeout(async () => {
        const response = await generateResponse(text);
        await saveMessage('assistant', response);
    }, 800);
}

// 5. Event Listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

btnWritingStyle.addEventListener('click', async () => {
    if (!lastAssistantResponse || !lastUserMessage) return;
    const keywords = tokenizeText(lastUserMessage);
    await saveToMemory('writing_style', keywords, lastAssistantResponse, 2);
});

btnDecision.addEventListener('click', async () => {
    if (!lastUserMessage) return;
    const keywords = tokenizeText(lastUserMessage);
    await saveToMemory('decision', keywords, lastUserMessage, 3);
});

// Start
async function start() {
    await engine.initialize();
    initRealtime();
    updateCognitiveUI(engine.aiState);
    
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) data.forEach(displayMessage);
}
start();
