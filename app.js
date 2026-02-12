// Supabase Configuration - ضع مفاتيحك هنا
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const messagesList = document.getElementById('messages-list');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const btnWritingStyle = document.getElementById('btn-writing-style');
const btnDecision = document.getElementById('btn-decision');
const typingIndicator = document.getElementById('typing-indicator');
const memoryCountEl = document.getElementById('memory-count');

let lastAssistantResponse = "";
let lastUserMessage = "";

// 1. Initialize Realtime Subscriptions
function initRealtime() {
    // Subscribe to messages
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            displayMessage(payload.new);
        })
        .subscribe();

    // Subscribe to brain_memory updates
    supabase
        .channel('public:brain_memory')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'brain_memory' }, payload => {
            updateMemoryCount();
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
    const { data, error } = await supabase
        .from('brain_memory')
        .select('*');
    
    if (error) return [];

    // Filter by trigger_keywords overlap
    return data.filter(item => {
        return item.trigger_keywords.some(keyword => tokens.includes(keyword.toLowerCase()));
    });
}

function rankResults(matches) {
    return matches.sort((a, b) => b.weight - a.weight);
}

async function generateResponse(text) {
    const tokens = tokenizeText(text);
    const matches = await matchMemory(tokens);
    const ranked = rankResults(matches);

    if (ranked.length > 0) {
        return ranked[0].response;
    }

    // Search in previous decisions if no direct match
    const { data: decisions } = await supabase
        .from('brain_memory')
        .select('response')
        .eq('type', 'decision')
        .limit(1);

    if (decisions && decisions.length > 0) {
        return "بناءً على قرارات سابقة: " + decisions[0].response;
    }

    return "لم أتعلم هذا بعد. يمكنك تعليمي.";
}

// 3. Database Operations
async function saveMessage(role, content) {
    await supabase.from('messages').insert([{ role, content }]);
}

async function saveToMemory(type, trigger_keywords, response, weight) {
    await supabase.from('brain_memory').insert([{
        type,
        trigger_keywords,
        response,
        weight
    }]);
    // Alert replaced with a more subtle UI feedback if needed, but keeping alert as per original logic
    alert('تم الحفظ في الذاكرة بنجاح!');
}

async function updateMemoryCount() {
    const { count, error } = await supabase
        .from('brain_memory')
        .select('*', { count: 'exact', head: true });
    
    if (!error) {
        memoryCountEl.textContent = count;
    }
}

// 4. UI Functions
function displayMessage(msg) {
    // Hide typing indicator when a new message arrives
    if (msg.role === 'assistant') {
        typingIndicator.classList.add('hidden');
    }

    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    div.textContent = msg.content;
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
    
    if (msg.role === 'assistant') {
        lastAssistantResponse = msg.content;
    } else {
        lastUserMessage = msg.content;
    }
}

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = "";
    await saveMessage('user', text);

    // Show typing indicator
    typingIndicator.classList.remove('hidden');
    messagesList.scrollTop = messagesList.scrollHeight;

    // Simulate a slight delay for better UX
    setTimeout(async () => {
        const response = await generateResponse(text);
        await saveMessage('assistant', response);
    }, 800);
}

// 5. Event Listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});

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
initRealtime();
// Load initial data
async function loadInitial() {
    // Load messages
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) data.forEach(displayMessage);
    
    // Load memory count
    updateMemoryCount();
}
loadInitial();
