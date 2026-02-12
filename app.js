// Supabase Configuration - ضع مفاتيحك هنا
const SUPABASE_URL = 'https://cwolpcfqyyrwlbsgezdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t0fNw2UMqWHDy41vVXYwOw_WndpkG_S';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const supabase = supabaseClient;

// Initialize Cognitive Engine
const engine = new CognitiveGrowthEngine(supabase);

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
    try {
        const { error } = await supabase.from('messages').insert([{ role, content }]);
        if (error) throw error;
    } catch (err) {
        console.error("Error saving message to Supabase:", err);
        // لا نوقف العملية هنا لضمان استمرار تجربة المستخدم محلياً
    }
}

async function saveToMemory(type, trigger_keywords, response, weight) {
    await supabase.from('brain_memory').insert([{ type, trigger_keywords, response, weight }]);
}

function updateCognitiveUI(state) {
    if (!state) return;
    aiAgeEl.textContent = state.age_level;
    aiIndependenceEl.textContent = Math.round(state.independence_score * 100) + "%";
    aiModeEl.textContent = state.independence_score > 0.6 ? "Strategic" : "Support";
}

// 4. UI Functions
function displayMessage(msg) {
    // منع تكرار الرسائل إذا كانت قادمة من Realtime وهي موجودة بالفعل
    const existingMessages = Array.from(messagesList.querySelectorAll('.message'));
    const isDuplicate = existingMessages.some(el => el.innerHTML === msg.content && el.classList.contains(msg.role));
    if (isDuplicate) return;

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
        if (engine && engine.aiState && messageHistory.length % 5 === 0) {
            engine.analyzeUserBehavior(messageHistory).catch(console.error);
        }
    }
}

async function handleUserMessage(text) {
    // عرض رسالة المستخدم فوراً في الواجهة
    displayMessage({ role: 'user', content: text });
    
    await saveMessage('user', text);

    typingIndicator.classList.remove('hidden');
    messagesList.scrollTop = messagesList.scrollHeight;

    setTimeout(async () => {
        const response = await generateResponse(text);
        // عرض رد المساعد في الواجهة
        displayMessage({ role: 'assistant', content: response });
        await saveMessage('assistant', response);
    }, 800);
}

// 5. Event Listeners
// استخدام مستمع واحد للفورم لضمان منع التحديث التلقائي
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        
        userInput.value = "";
        handleUserMessage(text);
    });
}

// التأكد من ربط الأزرار بشكل صحيح
if (btnWritingStyle) {
    btnWritingStyle.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!lastAssistantResponse || !lastUserMessage) {
            showNotification("لا توجد رسائل كافية لاعتماد الأسلوب.", "error");
            return;
        }
        const keywords = tokenizeText(lastUserMessage);
        await saveToMemory('writing_style', keywords, lastAssistantResponse, 2);
        showNotification("تم حفظ أسلوب الكتابة في الذاكرة المعرفية.", "success");
    });
}

if (btnDecision) {
    btnDecision.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!lastUserMessage) {
            showNotification("لا توجد رسالة مستخدم لاتخاذ قرار.", "error");
            return;
        }
        const keywords = tokenizeText(lastUserMessage);
        await saveToMemory('decision', keywords, lastUserMessage, 3);
        showNotification("تم اعتماد هذا القرار كمرجع نهائي.", "success");
    });
}

function showNotification(message, type = "info") {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Start
async function start() {
    try {
        await engine.initialize();
        initRealtime();
        if (engine.aiState) updateCognitiveUI(engine.aiState);
        
        const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
        
        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(displayMessage);
        } else {
            showWelcomeMessage();
        }
    } catch (err) {
        console.error("Initialization error:", err);
        // في حالة الفشل، نعرض رسالة ترحيب على الأقل لضمان عدم بقاء الصفحة فارغة
        showWelcomeMessage();
    }
}

function showWelcomeMessage() {
    displayMessage({
        role: 'assistant',
        content: "أهلاً، أنا مدعوم 👋 جاهز أتعلم معك وأتطور."
    });
}

// استخدام DOMContentLoaded لضمان تحميل العناصر قبل الربط
window.addEventListener("DOMContentLoaded", start);
