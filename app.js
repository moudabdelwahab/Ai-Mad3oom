// Supabase Configuration
const SUPABASE_URL = 'https://cwolpcfqyyrwlbsgezdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t0fNw2UMqWHDy41vVXYwOw_WndpkG_S';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const engine = new CognitiveGrowthEngine(dbClient);

// DOM Elements
const messagesList = document.getElementById('messages-list');
const userInput = document.getElementById('user-input');
const chatForm = document.getElementById('chat-form');
const btnWritingStyle = document.getElementById('btn-writing-style');
const btnDecision = document.getElementById('btn-decision');
const typingIndicator = document.getElementById('typing-indicator');

// Cognitive UI Elements
const aiAgeEl = document.getElementById('ai-age');
const aiIndependenceEl = document.getElementById('ai-independence');
const aiModeEl = document.getElementById('ai-mode');

let messageHistory = [];

// 1. Initialize Realtime
function initRealtime() {
    dbClient.channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        displayMessage(payload.new);
    }).subscribe();

    dbClient.channel('public:ai_state').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_state' }, payload => {
        updateCognitiveUI(payload.new);
    }).subscribe();
}

// 2. Text Processing
function tokenizeText(text) {
    if (!text) return [];
    return text.toLowerCase().replace(/[.,!?;:]/g, "").split(/\s+/).filter(word => word.length > 2);
}

async function matchMemory(tokens, fullText) {
    try {
        const { data, error } = await dbClient.from('brain_memory').select('*').order('weight', { ascending: false });
        if (error) return [];
        
        return data.filter(item => {
            const lowerKeywords = item.trigger_keywords.map(k => k.toLowerCase());
            const keywordMatch = lowerKeywords.some(keyword => tokens.includes(keyword));
            const fullTextMatch = lowerKeywords.some(keyword => fullText.toLowerCase().includes(keyword));
            return keywordMatch || fullTextMatch;
        });
    } catch (e) { return []; }
}

// 3. Response Generation (ثالثاً: ربط Personality بالردود)
async function generateResponse(text) {
    const tokens = tokenizeText(text);
    const matches = await matchMemory(tokens, text);
    
    let response = "";
    let isMatch = false;
    let matchedMemoryId = null;

    if (matches.length > 0) {
        isMatch = true;
        matchedMemoryId = matches[0].id;
        
        // خامساً: Associative Linking
        response = engine.formatAssociativeResponse(matches);
    } else {
        response = "لم أتعلم هذا النمط بعد. كيف تريدني أن أتعامل مع هذا الموقف استراتيجياً؟";
    }

    // سابعاً: Intervention Logic
    if (engine.shouldIntervene(text)) {
        const intervention = engine.getIntervention(text);
        response = `<div class="intervention-box">⚠️ <strong>تدخل استراتيجي:</strong> ${intervention}</div>\n${response}`;
    }

    // ثالثاً: تأثير Personality على أسلوب الرد
    response = applyPersonalityStyle(response);

    // Evolve AI & Update Memory
    if (isMatch && matchedMemoryId) {
        await engine.updateMemoryWeight(matchedMemoryId, true);
    }
    await engine.evolveAI(isMatch);
    
    return response;
}

function applyPersonalityStyle(text) {
    if (!engine.userModel) return text;
    
    const { intelligence_score } = engine.aiState;
    const { long_term_focus, risk_profile } = engine.userModel;

    let styledText = text;

    // intelligence_score يؤثر على عمق الرد
    if (intelligence_score > 5) {
        styledText += "\n\n<small>تحليل معمق: تم ربط هذه الاستجابة بأنماط سلوكك المسجلة لضمان الكفاءة المعرفية.</small>";
    }

    // long_term_focus يؤثر على ربط القرار بالرؤية البعيدة
    if (long_term_focus > 0.7) {
        styledText = "بناءً على رؤيتك طويلة المدى: " + styledText;
    }

    // risk_profile يؤثر على اقتراح المخاطرة
    if (risk_profile > 0.7 && !text.includes('مخاطرة')) {
        styledText += "\n\nملاحظة: هذا الخيار يدعم ميلك الحالي للمغامرة المحسوبة.";
    }

    return styledText;
}

// 4. UI & Core Functions
function displayMessage(msg) {
    const existingMessages = Array.from(messagesList.querySelectorAll('.message'));
    if (existingMessages.some(el => el.innerHTML === msg.content && el.classList.contains(msg.role))) return;

    if (msg.role === 'assistant') typingIndicator.classList.add('hidden');

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.innerHTML = msg.content;
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
    
    if (msg.role === 'user') {
        messageHistory.push(msg);
        if (messageHistory.length > 20) messageHistory.shift();
        engine.analyzeUserBehavior(messageHistory).catch(console.error);
    }
}

async function handleUserMessage(text) {
    displayMessage({ role: 'user', content: text });
    await dbClient.from('messages').insert([{ role: 'user', content: text }]);

    typingIndicator.classList.remove('hidden');
    
    // Learning Pattern
    const learningPattern = /^(?:لما|لو|إذا|عندما)\s+(?:أقولك|قلتلك|أقول|قلت)\s+(.+?)\s+(?:رد|قول|جاوب|أجب)\s+(?:بـ|ب|بأن)\s+(.+)$/i;
    const match = text.match(learningPattern);

    if (match) {
        const trigger = match[1].trim();
        const response = match[2].trim();
        const keywords = tokenizeText(trigger);
        
        setTimeout(async () => {
            await dbClient.from('brain_memory').insert([{ type: 'learned_rule', trigger_keywords: keywords, response, weight: 1.0 }]);
            const confirmation = `تم استيعاب القاعدة المعرفية: عند رصد "${trigger}" سيتم تفعيل الاستجابة الاستراتيجية المحددة.`;
            displayMessage({ role: 'assistant', content: confirmation });
            await dbClient.from('messages').insert([{ role: 'assistant', content: confirmation }]);
        }, 800);
        return;
    }

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

// Event Listeners
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
        await engine.initialize();
        if (engine.aiState) updateCognitiveUI(engine.aiState);
        initRealtime();
        
        const { data } = await dbClient.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
        if (data) data.forEach(displayMessage);
    } catch (err) {
        console.error("Initialization error:", err);
    }
}

window.addEventListener("DOMContentLoaded", start);
