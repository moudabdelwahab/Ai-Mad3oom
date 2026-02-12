// Supabase Configuration
const SUPABASE_URL = 'https://cwolpcfqyyrwlbsgezdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t0fNw2UMqWHDy41vVXYwOw_WndpkG_S';

// استخدام اسم فريد لتجنب التعارض مع مكتبة Supabase العالمية (window.supabase)
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize Cognitive Engine
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

let lastAssistantResponse = "";
let lastUserMessage = "";
let messageHistory = [];

// قاعدة بيانات المصطلحات الشائعة (العامية والفصحى)
const commonKnowledge = [
    { keywords: ['ازيك', 'كيفك', 'شلونك', 'أخبارك'], response: 'الحمد لله، أنا بخير وبأفضل حال. أنت كيف حالك؟' },
    { keywords: ['السلام', 'سلام', 'مرحبا', 'أهلا', 'هلا'], response: 'وعليكم السلام ورحمة الله وبركاته! أهلاً بك، كيف يمكنني مساعدتك اليوم؟' },
    { keywords: ['شكرا', 'مشكور', 'تسلم'], response: 'العفو! أنا هنا دائماً لخدمتك.' },
    { keywords: ['اسمك', 'مين', 'أنت'], response: 'أنا "مدعوم"، مساعدك الذكي الافتراضي. أتعلم منك وأتطور معك باستمرار.' },
    { keywords: ['تعمل', 'وظيفتك', 'بتسوي'], response: 'أنا هنا لأساعدك في تنظيم أفكارك، اتخاذ القرارات، والتعلم من أسلوبك الخاص لتوفير أفضل تجربة ممكنة.' }
];

// 1. Initialize Realtime Subscriptions
function initRealtime() {
    dbClient
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            displayMessage(payload.new);
        })
        .subscribe();

    dbClient
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

async function matchMemory(tokens, fullText) {
    try {
        const { data, error } = await dbClient.from('brain_memory').select('*');
        if (error) return [];
        
        return data.filter(item => {
            // 1. مطابقة الكلمات المفتاحية (Tokens)
            const keywordMatch = item.trigger_keywords.some(keyword => 
                tokens.includes(keyword.toLowerCase())
            );
            
            // 2. مطابقة النص الكامل (للحمل الطويلة أو القواعد المتعلمة)
            const fullTextMatch = item.trigger_keywords.some(keyword => 
                fullText.toLowerCase().includes(keyword.toLowerCase())
            );
            
            return keywordMatch || fullTextMatch;
        });
    } catch (e) {
        return [];
    }
}

function rankResults(matches) {
    return matches.sort((a, b) => b.weight - a.weight);
}

async function generateResponse(text) {
    const tokens = tokenizeText(text);
    
    // 1. البحث في الذاكرة السحابية (Supabase)
    const matches = await matchMemory(tokens, text);
    const ranked = rankResults(matches);

    let response = "";
    let isMatch = false;

    if (ranked.length > 0) {
        response = ranked[0].response;
        isMatch = true;
    } 
    // 2. البحث في قاعدة البيانات المحلية للمصطلحات الشائعة
    else {
        const commonMatch = commonKnowledge.find(item => 
            item.keywords.some(keyword => text.toLowerCase().includes(keyword))
        );
        
        if (commonMatch) {
            response = commonMatch.response;
            isMatch = true;
        } else {
            try {
                const { data: decisions } = await dbClient.from('brain_memory').select('response').eq('type', 'decision').limit(1);
                if (decisions && decisions.length > 0) {
                    response = "بناءً على قرارات سابقة: " + decisions[0].response;
                } else {
                    response = "لم أتعلم هذا بعد. يمكنك تعليمي.";
                }
            } catch (e) {
                response = "لم أتعلم هذا بعد. يمكنك تعليمي.";
            }
        }
    }

    // Cognitive Layer: Check for Independence/Intervention
    if (engine && engine.shouldIntervene && engine.shouldIntervene(text, response)) {
        const interventionPrefix = engine.currentMode === 'strategic' 
            ? "بصفتي مساعدك الاستراتيجي، أرى خياراً أفضل: " 
            : "هل فكرت في هذا البديل؟ ";
        response = `<span class="intervention-msg">${interventionPrefix}</span>` + response;
    }

    // Evolve AI based on interaction success
    if (engine && engine.evolveAI) {
        await engine.evolveAI(isMatch).catch(console.error);
    }
    
    return response;
}

// 3. Database Operations
async function saveMessage(role, content) {
    try {
        const { error } = await dbClient.from('messages').insert([{ role, content }]);
        if (error) throw error;
    } catch (err) {
        console.error("Error saving message to Supabase:", err);
    }
}

async function saveToMemory(type, trigger_keywords, response, weight) {
    try {
        await dbClient.from('brain_memory').insert([{ type, trigger_keywords, response, weight }]);
    } catch (e) {
        console.error("Error saving to memory:", e);
    }
}

function updateCognitiveUI(state) {
    if (!state) return;
    if (aiAgeEl) aiAgeEl.textContent = state.age_level || 1;
    if (aiIndependenceEl) aiIndependenceEl.textContent = Math.round((state.independence_score || 0) * 100) + "%";
    if (aiModeEl) aiModeEl.textContent = (state.independence_score > 0.6) ? "Strategic" : "Support";
}

// 4. UI Functions
function displayMessage(msg) {
    // منع تكرار الرسائل
    const existingMessages = Array.from(messagesList.querySelectorAll('.message'));
    const isDuplicate = existingMessages.some(el => el.innerHTML === msg.content && el.classList.contains(msg.role));
    if (isDuplicate) return;

    if (msg.role === 'assistant') typingIndicator.classList.add('hidden');

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.innerHTML = msg.content;
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
    
    if (msg.role === 'assistant') {
        lastAssistantResponse = msg.content;
    } else {
        lastUserMessage = msg.content;
        messageHistory.push(msg);
        if (messageHistory.length > 50) messageHistory.shift();
        if (engine && engine.aiState && messageHistory.length % 5 === 0) {
            engine.analyzeUserBehavior(messageHistory).catch(console.error);
        }
    }
}

async function handleUserMessage(text) {
    displayMessage({ role: 'user', content: text });
    await saveMessage('user', text);

    typingIndicator.classList.remove('hidden');
    messagesList.scrollTop = messagesList.scrollHeight;

    // فحص ما إذا كانت الرسالة أمراً تعليمياً شرطياً
    const learningPattern = /^(?:لما|لو|إذا|عندما)\s+(?:أقولك|قلتلك|أقول|قلت)\s+(.+?)\s+(?:رد|قول|جاوب|أجب)\s+(?:بـ|ب|بأن)\s+(.+)$/i;
    const match = text.match(learningPattern);

    if (match) {
        const trigger = match[1].trim();
        const response = match[2].trim();
        const keywords = tokenizeText(trigger);
        
        setTimeout(async () => {
            await saveToMemory('learned_rule', keywords, response, 5);
            const confirmation = `فهمت! من الآن فصاعداً، لما تقول "${trigger}" هرد بـ "${response}".`;
            displayMessage({ role: 'assistant', content: confirmation });
            await saveMessage('assistant', confirmation);
            showNotification("تم تعلم قاعدة جديدة بنجاح!", "success");
        }, 800);
        return;
    }

    setTimeout(async () => {
        const response = await generateResponse(text);
        displayMessage({ role: 'assistant', content: response });
        await saveMessage('assistant', response);
    }, 800);
}

// 5. Event Listeners
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        userInput.value = "";
        handleUserMessage(text);
    });
}

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
        if (engine && engine.initialize) {
            await engine.initialize();
            if (engine.aiState) updateCognitiveUI(engine.aiState);
        }
        initRealtime();
        
        const { data, error } = await dbClient.from('messages').select('*').order('created_at', { ascending: true });
        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(displayMessage);
        } else {
            showWelcomeMessage();
        }
    } catch (err) {
        console.error("Initialization error:", err);
        showWelcomeMessage();
    }
}

function showWelcomeMessage() {
    displayMessage({
        role: 'assistant',
        content: "أهلاً، أنا مدعوم 👋 جاهز أتعلم معك وأتطور."
    });
}

window.addEventListener("DOMContentLoaded", start);
