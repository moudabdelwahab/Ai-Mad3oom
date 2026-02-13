/**
 * Cognitive Growth Engine - Ai-Mad3oom
 * المسئول عن تحويل النظام إلى نظام معرفي شخصي متطور
 */

class CognitiveGrowthEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.aiState = null;
        this.userModel = null;
        this.modes = { SUPPORT: 'support', STRATEGIC: 'strategic' };
        this.currentMode = 'support';
        
        // Linguistic Signals for Behavioral Analysis
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
            this.currentMode = this.modes.SUPPORT;
        }
    }

    // أولاً وثانياً: Linguistic Behavior Analyzer & Personality Vector Update
    async analyzeUserBehavior(lastMessages) {
        if (!lastMessages || lastMessages.length === 0) return;
        
        const lastMsg = lastMessages[lastMessages.length - 1].content.toLowerCase();
        let updates = {};

        // تحليل الحسم والتردد
        if (this.signals.hesitation.some(s => lastMsg.includes(s))) {
            updates.decisiveness_score = Math.max(0, this.userModel.decisiveness_score - 0.05);
        } else if (this.signals.decisiveness.some(s => lastMsg.includes(s))) {
            updates.decisiveness_score = Math.min(1, this.userModel.decisiveness_score + 0.05);
        }

        // تحليل الميل للمخاطرة
        if (this.signals.risk.some(s => lastMsg.includes(s))) {
            updates.risk_profile = Math.min(1, this.userModel.risk_profile + 0.05);
        }

        // تحليل التفكير طويل المدى
        if (this.signals.longTerm.some(s => lastMsg.includes(s))) {
            updates.long_term_focus = Math.min(1, this.userModel.long_term_focus + 0.05);
        }

        // تحليل التناقض وتغيير الاتجاه (سادساً: Decision Pattern Engine كبداية)
        if (lastMessages.length >= 3) {
            const prevMsg = lastMessages[lastMessages.length - 2].content.toLowerCase();
            if (this.signals.contradiction.some(s => lastMsg.includes(s))) {
                updates.consistency_score = Math.max(0, this.userModel.consistency_score - 0.05);
                await this.logEvent('PATTERN_DETECTED', lastMsg, 'User showing contradiction or direction change', 0.4);
            }
        }

        if (Object.keys(updates).length > 0) {
            await this.updateUserModel(updates);
        }
    }

    // رابعاً: Memory Engine المحسّن
    async updateMemoryWeight(memoryId, isSuccess) {
        try {
            const { data: memory } = await this.supabase.from('brain_memory').select('*').eq('id', memoryId).single();
            if (!memory) return;

            const factor = 0.1;
            const successCount = memory.success_count + (isSuccess ? 1 : 0);
            const failCount = memory.fail_count + (isSuccess ? 0 : 1);
            
            // newWeight = baseWeight + (success_count × factor) − (fail_count × factor)
            const baseWeight = 1.0; 
            const newWeight = Math.max(0.1, baseWeight + (successCount * factor) - (failCount * factor));

            await this.supabase.from('brain_memory').update({
                success_count: successCount,
                fail_count: failCount,
                weight: newWeight,
                last_used: new Date()
            }).eq('id', memoryId);
        } catch (e) {
            console.error("Error updating memory weight:", e);
        }
    }

    // خامساً: Associative Linking (سيتم استدعاؤه من app.js)
    formatAssociativeResponse(rankedMatches) {
        if (rankedMatches.length <= 1) return rankedMatches[0]?.response || "";
        
        const mainResponse = rankedMatches[0].response;
        const associations = rankedMatches.slice(1, 3).map(m => m.trigger_keywords[0]).join(' و ');
        
        return `${mainResponse}\n\n<div class="associative-link">💡 تذكير معرفي: هذا يرتبط أيضاً بما تعلمته عن (${associations}).</div>`;
    }

    // سابعاً: Intervention Logic متطور
    shouldIntervene(userMessage) {
        const { independence_score, confidence_score } = this.aiState;
        const { decisiveness_score, consistency_score } = this.userModel;

        const threshold = 0.6;
        
        // يتدخل النظام إذا كان مستقلاً وواثقاً + المستخدم يظهر تردداً أو تناقضاً
        if (independence_score > threshold && confidence_score > 0.6) {
            if (decisiveness_score < 0.4 || consistency_score < 0.4) {
                return true;
            }
        }
        return false;
    }

    getIntervention(userMessage) {
        if (this.userModel.decisiveness_score < 0.4) {
            return "لاحظت أنك تتردد في هذا القرار. هل فكرت في تقليل المخاطرة والتركيز على الأهداف طويلة المدى؟";
        }
        if (this.userModel.consistency_score < 0.4) {
            return "يبدو أن هناك تضارباً مع قراراتك السابقة. هل تريد مراجعة الرؤية الاستراتيجية؟";
        }
        return "بصفتي شريكك المعرفي، أقترح إعادة تقييم هذا المسار بناءً على نمط سلوكك الأخير.";
    }

    // ثامناً: تطوير evolveAI
    async evolveAI(interactionSuccess) {
        let { age_level, intelligence_score, confidence_score, independence_score, learning_speed } = this.aiState;

        // النجاح يزيد intelligence & confidence
        intelligence_score += learning_speed * (interactionSuccess ? 1.5 : 0.5);
        confidence_score += interactionSuccess ? 0.02 : -0.05; // الفشل يقلل confidence أكثر
        
        if (intelligence_score > age_level * 5) {
            age_level++;
            independence_score = Math.min(1, independence_score + 0.05);
            await this.logEvent('EVOLUTION', null, `System evolved to cognitive level ${age_level}`, 0.9);
        }

        await this.updateAIState({
            age_level,
            intelligence_score: Math.min(20, intelligence_score),
            confidence_score: Math.max(0, Math.min(1, confidence_score)),
            independence_score: Math.max(0, Math.min(1, independence_score))
        });
    }

    // مساعدات
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
        await this.supabase.from('event_log').insert([{
            event_type: type,
            related_message: msg,
            inferred_pattern: pattern,
            impact_score: impact
        }]);
    }

    // Decay Logic (Server-side or Batch)
    async applyDecay() {
        // يمكن استدعاؤه دورياً لتقليل الأوزان غير المستخدمة
        const { data: memories } = await this.supabase.from('brain_memory').select('id, weight, last_used');
        const now = new Date();
        for (let m of memories) {
            const daysSinceUsed = (now - new Date(m.last_used)) / (1000 * 60 * 60 * 24);
            if (daysSinceUsed > 7 && m.weight > 0.5) {
                await this.supabase.from('brain_memory').update({ weight: m.weight - 0.05 }).eq('id', m.id);
            }
        }
    }
}

window.CognitiveGrowthEngine = CognitiveGrowthEngine;
