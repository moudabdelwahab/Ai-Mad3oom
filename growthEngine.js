/**
 * Cognitive Growth Engine - Ai-Mad3oom (Decision OS Version)
 * المسئول عن تحويل النظام إلى نظام تشغيل قراري متطور
 */

class CognitiveGrowthEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.aiState = null;
        this.userModel = null;
        this.modes = { SUPPORT: 'support', STRATEGIC: 'strategic' };
        this.currentMode = 'support';
        
        this.signals = {
            hesitation: ['محتار', 'مش عارف', 'يمكن', 'ممكن', 'متردد', 'شو رأيك', 'ما بعرف'],
            decisiveness: ['قررت', 'خلاص', 'أكيد', 'طبعاً', 'تم', 'انتهى', 'واضح'],
            risk: ['مخاطرة', 'تجربة', 'جديد', 'مغامرة', 'تحدي', 'فرصة'],
            longTerm: ['مستقبل', 'خطة', 'هدف', 'رؤية', 'بعدين', 'تطوير', 'استدامة'],
            contradiction: ['لكن', 'بس', 'مع ذلك', 'رغم', 'من ناحية تانية']
        };
    }

    async initialize() {
        await this.syncState();
    }

    async syncState() {
        try {
            const { data: aiData, error: aiError } = await this.supabase.from('ai_state').select('*').limit(1).single();
            const { data: userData, error: userError } = await this.supabase.from('user_model').select('*').limit(1).single();
            
            if (aiError || userError) throw new Error("Database tables missing or connection failed");

            this.aiState = aiData;
            this.userModel = userData;
            this.currentMode = (this.aiState && this.aiState.independence_score > 0.6) ? this.modes.STRATEGIC : this.modes.SUPPORT;
        } catch (err) {
            console.warn("Cognitive Engine: Using default state.", err);
            this.aiState = { age_level: 1, independence_score: 0.1, intelligence_score: 0.1, confidence_score: 0.5, learning_speed: 0.1 };
            this.userModel = { 
                thinking_style: 'analytical', risk_profile: 0.5, execution_bias: 0.5, 
                control_drive: 0.5, long_term_focus: 0.5, decisiveness_score: 0.5, consistency_score: 0.5 
            };
        }
    }

    // --- Decision OS Functions ---

    // 1️⃣ تحليل قراري
    async analyzeDecision(text) {
        const { risk_profile, long_term_focus } = this.userModel;
        let analysis = "";
        
        const riskLevel = text.match(/(مخاطرة|خطر|تجربة|مغامرة)/i) ? "مرتفع" : "منخفض";
        const impact = long_term_focus > 0.6 ? "استراتيجي بعيد المدى" : "تكتيكي قصير المدى";

        analysis = `تحليل المخاطر: مستوى المخاطرة في هذا القرار يبدو ${riskLevel} بناءً على نمطك (${(risk_profile * 100).toFixed(0)}%).\n`;
        analysis += `الرؤية: هذا القرار يُصنف كـ ${impact}.\n`;
        analysis += `بدائل: فكر في "التدرج في التنفيذ" أو "اختبار الفكرة على نطاق ضيق" لتقليل الانحراف عن أهدافك المستدامة.`;

        await this.logEvent('DECISION_ANALYSIS', text, 'User requested decision analysis', 0.5);
        return analysis;
    }

    // 2️⃣ اعترض عليا (Devil’s Advocate)
    async objectToDecision(text) {
        const objection = `بصفتي المعارض المنطقي (Devil's Advocate): هل فكرت أن هذا القرار قد يستهلك مواردك دون عائد حقيقي؟ التحيز للتنفيذ (Execution Bias) لديك قد يدفعك للاستعجال. ماذا لو فشل الافتراض الأساسي الذي بنيت عليه هذا القرار؟`;
        await this.logEvent('STRATEGIC_OBJECTION', text, 'System triggered Devil’s Advocate Mode', 0.8);
        return objection;
    }

    // 3️⃣ اعتماد كخطة تنفيذ
    async convertToGoal(text) {
        try {
            const { error } = await this.supabase.from('user_goals').insert([{
                goal_text: text,
                priority: 'medium',
                progress: 0
            }]);
            if (error) throw error;
            await this.logEvent('GOAL_CREATED', text, 'Message converted to goal', 0.7);
            return "تم تحويل الرسالة إلى هدف استراتيجي في سجل الأهداف بنجاح. الأولوية: متوسطة، التقدم: 0%.";
        } catch (e) {
            return "حدث خطأ أثناء حفظ الهدف.";
        }
    }

    // 4️⃣ اربط بالسجل
    async linkToHistory(text) {
        try {
            const { data: logs } = await this.supabase.from('event_log').select('*').ilike('related_message', `%${text.substring(0, 10)}%`).limit(3);
            if (logs && logs.length > 0) {
                return `وجدت أنماطاً مشابهة في السجل. لقد ناقشت أموراً قريبة من هذا في تاريخ ${new Date(logs[0].created_at).toLocaleDateString()}. يبدو أن هذا القرار متكرر أو مرتبط بنمط سابق.`;
            }
            return "لم أجد قرارات مشابهة تماماً في السجل القريب، مما يعني أن هذا قد يكون مساراً جديداً لك.";
        } catch (e) {
            return "تعذر الوصول للسجل حالياً.";
        }
    }

    // 5️⃣ قيّم نمطي
    getPatternSnapshot() {
        const { decisiveness_score, risk_profile, long_term_focus } = this.userModel;
        return `لقطة من نمطك المعرفي:\n- الحسم: ${(decisiveness_score * 100).toFixed(0)}%\n- الميل للمخاطرة: ${(risk_profile * 100).toFixed(0)}%\n- التركيز الاستراتيجي: ${(long_term_focus * 100).toFixed(0)}%`;
    }

    // --- Core Logic Updates ---

    async analyzeUserBehavior(lastMessages) {
        if (!lastMessages || lastMessages.length === 0) return;
        const lastMsg = lastMessages[lastMessages.length - 1].content.toLowerCase();
        let updates = {};

        if (this.signals.hesitation.some(s => lastMsg.includes(s))) updates.decisiveness_score = Math.max(0, this.userModel.decisiveness_score - 0.05);
        else if (this.signals.decisiveness.some(s => lastMsg.includes(s))) updates.decisiveness_score = Math.min(1, this.userModel.decisiveness_score + 0.05);
        if (this.signals.risk.some(s => lastMsg.includes(s))) updates.risk_profile = Math.min(1, this.userModel.risk_profile + 0.05);
        if (this.signals.longTerm.some(s => lastMsg.includes(s))) updates.long_term_focus = Math.min(1, this.userModel.long_term_focus + 0.05);

        if (Object.keys(updates).length > 0) await this.updateUserModel(updates);
    }

    async evolveAI(interactionSuccess) {
        let { age_level, intelligence_score, confidence_score, independence_score, learning_speed } = this.aiState;
        intelligence_score += learning_speed * (interactionSuccess ? 1.5 : 0.5);
        confidence_score += interactionSuccess ? 0.02 : -0.05;
        if (intelligence_score > age_level * 5) {
            age_level++;
            independence_score = Math.min(1, independence_score + 0.05);
        }
        await this.updateAIState({ age_level, intelligence_score: Math.min(20, intelligence_score), confidence_score: Math.max(0, Math.min(1, confidence_score)), independence_score: Math.max(0, Math.min(1, independence_score)) });
    }

    async updateUserModel(updates) {
        if (!this.userModel) return;
        const { data } = await this.supabase.from('user_model').update({ ...updates, last_updated: new Date() }).eq('id', this.userModel.id).select().single();
        if (data) this.userModel = data;
    }

    async updateAIState(updates) {
        if (!this.aiState) return;
        const { data } = await this.supabase.from('ai_state').update({ ...updates, last_evolution: new Date() }).eq('id', this.aiState.id).select().single();
        if (data) this.aiState = data;
    }

    async logEvent(type, msg, pattern, impact) {
        await this.supabase.from('event_log').insert([{ event_type: type, related_message: msg, inferred_pattern: pattern, impact_score: impact }]);
    }
}

window.CognitiveGrowthEngine = CognitiveGrowthEngine;
