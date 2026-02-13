// Supabase Configuration
const SUPABASE_URL = 'https://cwolpcfqyyrwlbsgezdq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t0fNw2UMqWHDy41vVXYwOw_WndpkG_S';
const GEMINI_KEY = 'AIzaSyAt_r2uKxYft-JvfSHmxe-aR6iFWsJSXhk';

// Initialize Supabase Client
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

// Common Knowledge Base
const commonKnowledge = [
    { keywords: ['ازيك', 'كيفك', 'شلونك', 'أخبارك'], response: 'الحمد لله، أنا بخير وبأفضل حال. أنت كيف حالك؟' },
    { keywords: ['السلام', 'سلام', 'مرحبا', 'أهلا', 'هلا'], response: 'وعليكم السلام ورحمة الله وبركاته! أهلاً بك، كيف يمكنني مساعدتك اليوم؟' },
    { keywords: ['شكرا', 'مشكور', 'تسلم'], response: 'العفو! أنا هنا دائماً لخدمتك.' },
    { keywords: ['اسمك', 'مين', 'أنت'], response: 'أنا "مدعوم"، مساعدك الذكي الافتراضي. أتعلم منك وأتطور معك باستمرار.' }
];

// 1. Cognitive Context Builder
async function buildCognitiveContext(text, relevantMemories) {
    const userModel = engine.userModel || { decisiveness_score: 0.5, consistency_score: 0.5 };
    const aiState = engine.aiState || { age_level: 1, independence_score: 0 };
    
    let context = `
    أنت "مدعوم"، مساعد ذكي بنظام إدراكي هجين.
    
    [سياق المستخدم الحالي]:
    - مستوى الحسم: ${userModel.decisiveness_score}
    - مستوى الاتساق: ${userModel.consistency_score}
    
    [حالتك الإدراكية]:
    - العمر المعرفي: ${aiState.age_level}
    - مستوى الاستقلالية: ${aiState.independence_score}
    - الوضع الحالي: ${engine.currentMode}
    
    [الذكريات المرتبطة المسترجعة]:
    ${relevantMemories.map(m => `- ${m.trigger_keywords.join(', ')}: ${m.response}`).join('\n')}
    
    [المهمة]:
    رد على رسالة المستخدم بناءً على هذا السياق والذكريات. إذا كانت هناك ذكريات مرتبطة، استخدمها لتعزيز الرد. إذا لم توجد، استخدم قدراتك التحليلية لتقديم أفضل مساعدة ممكنة بلهجة عربية ودودة وذكية.
    
    رسالة المستخدم: "${text}"
    `;
    return context;
}

// 2. Smart Routing & Gemini Integration
async function callGeminiAI(prompt, isAnalysis = false) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]) throw new Error("Gemini API Error");
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // 3. Response Learning System (Async)
        if (!isAnalysis) {
            analyzeAndLearnFromResponse(aiResponse).catch(console.error);
        }
        
        return aiResponse;
    } catch (err) {
        console.error("Gemini Call Failed:", err);
        throw err;
    }
}

// 3. Response Learning System
async function analyzeAndLearnFromResponse(aiResponse) {
    const analysisPrompt = `
    حلل الرد التالي واستخرج منه أي (حقائق، قرارات، استراتيجيات، أو أنماط سلوكية) جديدة يمكن تخزينها في الذاكرة.
    الرد: "${aiResponse}"
    
    المطلوب: رد بتنسيق JSON فقط كالتالي:
    {"knowledge": [{"type": "fact/decision/strategy", "keywords": ["كلمة1", "كلمة2"], "content": "المعلومة المستخرجة"}]}
    إذا لم تجد شيئاً مفيداً، رد بـ {"knowledge": []}
    `;
    
    try {
        const rawAnalysis = await callGeminiAI(analysisPrompt, true);
        const cleanJson = rawAnalysis.replace(/```json|```/g, "").trim();
        const data = JSON.parse(cleanJson);
        
        for (const item of data.knowledge) {
            const isDuplicate = await checkMemorySimilarity(item.keywords);
            if (!isDuplicate) {
                await saveToMemory(item.type, item.keywords, item.content, 2);
            }
        }
    } catch (e) {}
}

async function checkMemorySimilarity(keywords) {
    try {
        const { data } = await dbClient.from('brain_memory').select('trigger_keywords');
        if (!data) return false;
        return data.some(m => m.trigger_keywords.some(k => keywords.includes(k)));
    } catch (e) { return false; }
}

// 4. Main Response Logic
async function generateResponse(text) {
    const tokens = tokenizeText(text);
    const lowerText = text.toLowerCase();
    
    const matches = await matchMemory(tokens, text);
    const ranked = rankResults(matches);

    if (ranked.length > 0 && ranked[0].weight > 4) {
        return ranked[0].response;
    }

    try {
        const context = await buildCognitiveContext(text, ranked);
        const response = await callGeminiAI(context);
        return response;
    } catch (err) {
        if (ranked.length > 0) return ranked[0].response;
        const commonMatch = commonKnowledge.find(item => item.keywords.some(k => lowerText.includes(k)));
        if (commonMatch) return commonMatch.response;
        return "أواجه صعوبة في الاتصال بعقلي التحليلي حالياً، ولكن سأحاول تذكر ما تعلمته سابقاً.";
    }
}

function tokenizeText(text) {
    if (!text) return [];
    return text.toLowerCase().replace(/[.,!?;:]/g, "").split(/\s+/).filter(word => word.length > 2);
}

async function matchMemory(tokens, fullText) {
    try {
        const { data } = await dbClient.from('brain_memory').select('*');
        if (!data) return [];
        return data.filter(item => {
            const lowerKeywords = item.trigger_keywords.map(k => k.toLowerCase());
            const keywordMatch = lowerKeywords.some(keyword => tokens.includes(keyword));
            const fullTextMatch = lowerKeywords.some(keyword => fullText.toLowerCase().includes(keyword));
            return keywordMatch || fullTextMatch;
        });
    } catch (e) { return []; }
}

function rankResults(matches) {
    return matches.sort((a, b) => b.weight - a.weight);
}

async function saveMessage(role, content) {
    try { await dbClient.from('messages').insert([{ role, content }]); } catch (err) {}
}

async function saveToMemory(type, trigger_keywords, response, weight) {
    try { await dbClient.from('brain_memory').insert([{ type, trigger_keywords, response, weight }]); } catch (e) {}
}

function updateCognitiveUI(state) {
    if (!state) return;
    if (aiAgeEl) aiAgeEl.textContent = state.age_level || 1;
    if (aiIndependenceEl) aiIndependenceEl.textContent = Math.round((state.independence_score || 0) * 100) + "%";
    if (aiModeEl) aiModeEl.textContent = (state.independence_score > 0.6) ? "Strategic" : "Support";
}

function displayMessage(msg) {
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
    }
}

async function handleUserMessage(text) {
    displayMessage({ role: 'user', content: text });
    await saveMessage('user', text);

    typingIndicator.classList.remove('hidden');
    messagesList.scrollTop = messagesList.scrollHeight;

    const learningPattern = /^(?:لما|لو|إذا|عندما)\s+(?:أقولك|قلتلك|أقول|قلت)\s+(.+?)\s+(?:رد|قول|جاوب|أجب)\s+(?:بـ|ب|بأن)\s+(.+)$/i;
    const match = text.match(learningPattern);

    if (match) {
        const trigger = match[1].trim();
        const response = match[2].trim();
        setTimeout(async () => {
            await saveToMemory('learned_rule', tokenizeText(trigger), response, 10);
            const confirmation = `فهمت! من الآن فصاعداً، لما تقول "${trigger}" هرد بـ "${response}".`;
            displayMessage({ role: 'assistant', content: confirmation });
            await saveMessage('assistant', confirmation);
            showNotification("تم تعلم قاعدة جديدة!", "success");
        }, 800);
        return;
    }

    setTimeout(async () => {
        const response = await generateResponse(text);
        displayMessage({ role: 'assistant', content: response });
        await saveMessage('assistant', response);
    }, 800);
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

async function start() {
    try {
        if (engine && engine.initialize) {
            await engine.initialize();
            if (engine.aiState) updateCognitiveUI(engine.aiState);
        }
        const { data } = await dbClient.from('messages').select('*').order('created_at', { ascending: true });
        if (data && data.length > 0) {
            data.forEach(displayMessage);
        } else {
            displayMessage({ role: 'assistant', content: "أهلاً، أنا مدعوم 👋 جاهز أتعلم معك وأتطور." });
        }
    } catch (err) {
        displayMessage({ role: 'assistant', content: "أهلاً، أنا مدعوم 👋 جاهز أتعلم معك وأتطور." });
    }
}

if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        userInput.value = "";
        handleUserMessage(text);
    });
}

window.addEventListener("DOMContentLoaded", start);
