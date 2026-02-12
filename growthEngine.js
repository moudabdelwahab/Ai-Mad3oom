/**
 * Cognitive Growth Engine
 * المسئول عن تطور النظام ونمذجة سلوك المستخدم
 */

class CognitiveGrowthEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.aiState = null;
        this.userModel = null;
        this.modes = { SUPPORT: 'support', STRATEGIC: 'strategic' };
        this.currentMode = 'support';
    }

    async initialize() {
        await this.syncState();
    }

    async syncState() {
        const { data: aiData } = await this.supabase.from('ai_state').select('*').limit(1).single();
        const { data: userData } = await this.supabase.from('user_model').select('*').limit(1).single();
        this.aiState = aiData;
        this.userModel = userData;
        
        // تحديد الوضع بناءً على الاستقلالية
        this.currentMode = this.aiState.independence_score > 0.6 ? this.modes.STRATEGIC : this.modes.SUPPORT;
    }

    // خوارزمية تحليل سلوك المستخدم
    async analyzeUserBehavior(lastMessages) {
        if (lastMessages.length < 5) return;

        let decisiveness = this.userModel.decisiveness_score;
        let consistency = this.userModel.consistency_score;
        
        // تحليل التردد (تغيير الكلمات المفتاحية في رسائل متتالية)
        let changes = 0;
        for (let i = 1; i < lastMessages.length; i++) {
            if (lastMessages[i].role === 'user' && lastMessages[i-1].role === 'user') {
                changes++;
            }
        }
        
        decisiveness = Math.max(0, Math.min(1, decisiveness + (changes > 2 ? -0.05 : 0.02)));
        
        await this.updateUserModel({ decisiveness_score: decisiveness });
    }

    // خوارزمية تطور الذكاء (Age & Intelligence Growth)
    async evolveAI(interactionSuccess) {
        let { age_level, intelligence_score, confidence_score, independence_score, learning_speed } = this.aiState;

        // نمو الذكاء بناءً على النجاح وسرعة التعلم
        intelligence_score += learning_speed * (interactionSuccess ? 1.2 : 0.5);
        confidence_score += interactionSuccess ? 0.01 : -0.02;
        
        // تطور العمر المعرفي كلما زاد الذكاء
        if (intelligence_score > age_level * 2) {
            age_level++;
            independence_score += 0.1;
            await this.logEvent('EVOLUTION', null, `AI evolved to age level ${age_level}`, 0.8);
        }

        await this.updateAIState({
            age_level,
            intelligence_score: Math.min(10, intelligence_score),
            confidence_score: Math.max(0, Math.min(1, confidence_score)),
            independence_score: Math.max(0, Math.min(1, independence_score))
        });
    }

    // منطق الاستقلال والاعتراض
    shouldIntervene(userMessage, response) {
        if (this.aiState.independence_score > 0.5 && this.aiState.confidence_score > 0.6) {
            // إذا كان المستخدم متردداً والنظام واثق، قد يقترح بديلاً
            if (this.userModel.decisiveness_score < 0.4) {
                return true;
            }
        }
        return false;
    }

    async updateUserModel(updates) {
        const { data } = await this.supabase.from('user_model').update({ ...updates, last_updated: new Date() }).eq('id', this.userModel.id).select().single();
        this.userModel = data;
    }

    async updateAIState(updates) {
        const { data } = await this.supabase.from('ai_state').update({ ...updates, last_evolution: new Date() }).eq('id', this.aiState.id).select().single();
        this.aiState = data;
    }

    async logEvent(type, msg, pattern, impact) {
        await this.supabase.from('event_log').insert([{
            event_type: type,
            related_message: msg,
            inferred_pattern: pattern,
            impact_score: impact
        }]);
    }

    // Memory Reinforcement & Decay (خوارزمية بسيطة)
    async processMemoryCycle() {
        const { data: memories } = await this.supabase.from('brain_memory').select('*');
        for (let memory of memories) {
            // تقليل الوزن تدريجياً (Decay) إلا إذا كان الوزن عالياً جداً
            if (memory.weight > 1) {
                let newWeight = memory.weight - 0.01;
                await this.supabase.from('brain_memory').update({ weight: newWeight }).eq('id', memory.id);
            }
        }
    }
}

// تصدير المحرك للاستخدام في app.js
window.CognitiveGrowthEngine = CognitiveGrowthEngine;
