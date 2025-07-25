// core.js - Bella's Brain (v3)
// 贝拉的核心AI逻辑，支持本地模型和云端API的混合架构

import { pipeline, env, AutoTokenizer, AutoModelForSpeechSeq2Seq } from './vendor/transformers.js';
import CloudAPIService from './cloudAPI.js';

// 本地模型配置
env.allowLocalModels = true;
env.useBrowserCache = false;
env.allowRemoteModels = false;
env.backends.onnx.logLevel = 'verbose';
env.localModelPath = './models/';


class BellaAI {
    static instance = null;

    static async getInstance() {
        if (this.instance === null) {
            this.instance = new BellaAI();
            await this.instance.init();
        }
        return this.instance;
    }

    constructor() {
        this.cloudAPI = new CloudAPIService();
        this.useCloudAPI = false; // 默认使用本地模型
        this.currentMode = 'casual'; // 聊天模式：casual, assistant, creative
    }

    async init() {
        console.log('Initializing Bella\'s core AI...');
        
        // 优先加载LLM模型（聊天功能）
        try {
            console.log('Loading LLM model...');
            // 한국어 LLM 모델로 변경
            this.llm = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
            console.log('LLM model loaded successfully.');
        } catch (error) {
            console.error('Failed to load LLM model:', error);
            // LLM加载失败，但不阻止初始化
        }
        
        // 尝试加载ASR模型（语音识别功能）
        try {
            console.log('Loading ASR model...');
            const modelPath = 'Xenova/whisper-asr';
            const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
            const model = await AutoModelForSpeechSeq2Seq.from_pretrained(modelPath);
            this.asr = await pipeline('automatic-speech-recognition', model, { tokenizer });
            console.log('ASR model loaded successfully.');
        } catch (error) {
            console.warn('ASR model failed to load, voice recognition will be disabled:', error);
            // ASR加载失败，但不影响聊天功能
            this.asr = null;
        }

        // TTS模型暂时禁用
        try {
            console.log('Loading TTS model...');
            this.tts = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: false });
            console.log('TTS model loaded successfully.');
        } catch (error) {
            console.warn('TTS model failed to load, voice synthesis will be disabled:', error);
            this.tts = null;
        }

        console.log('Bella\'s core AI initialized successfully.');
    }

    async think(prompt) {
        try {
            // 如果启用了云端API且配置正确，优先使用云端服务
            if (this.useCloudAPI && this.cloudAPI.isConfigured()) {
                return await this.thinkWithCloudAPI(prompt);
            }
            
            // 否则使用本地模型
            return await this.thinkWithLocalModel(prompt);
            
        } catch (error) {
            console.error('思考过程中出现错误:', error);
            
            // 如果云端API失败，尝试降级到本地模型
            if (this.useCloudAPI) {
                console.log('云端API失败，降级到本地模型...');
                try {
                    return await this.thinkWithLocalModel(prompt);
                } catch (localError) {
                    console.error('本地模型也失败了:', localError);
                }
            }
            
            return this.getErrorResponse();
        }
    }

    // 使用云端API进行思考
    async thinkWithCloudAPI(prompt) {
        const enhancedPrompt = this.enhancePromptForMode(prompt);
        return await this.cloudAPI.chat(enhancedPrompt);
    }

    // 使用本地模型进行思考
    async thinkWithLocalModel(prompt) {
        if (!this.llm) {
            return "아직 생각하는 방법을 배우는 중이에요, 잠시만 기다려주세요...";
        }
        
        // 자연스러운 영어 대화를 위한 프롬프트
        const englishPrompt = `You are Bella, a friendly AI assistant. Please respond naturally and conversationally in English. User says: "${prompt}"\nBella:`;
        console.log('로컬 모델 프롬프트:', englishPrompt);
        
        const result = await this.llm(englishPrompt, {
            max_new_tokens: 80,
            temperature: 0.8,
            top_k: 40,
            top_p: 0.9,
            do_sample: true,
            repetition_penalty: 1.2,
        });
        
        console.log('로컬 모델 원본 응답:', result);
        
        // 생성된 텍스트 정리
        let response = result[0].generated_text;
        if (response.includes(englishPrompt)) {
            response = response.replace(englishPrompt, '').trim();
        }
        
        // 응답이 너무 짧거나 이상한 경우 자연스러운 영어 기본 응답으로 대체
        if (!response || response.length < 3 || response === '.' || response.trim() === '') {
            const naturalResponses = [
                "Hi! I'm doing great, thanks for asking! How about you?",
                "Hello there! I'm Bella, nice to meet you! What's on your mind?",
                "Hey! I'm here and ready to chat. What would you like to talk about?",
                "Hi! I'm feeling wonderful today. How can I help you?",
                "Hello! Thanks for saying hi. I'm doing well - how are you doing?"
            ];
            response = naturalResponses[Math.floor(Math.random() * naturalResponses.length)];
        }
        
        console.log('최종 응답:', response);
        return response;
    }

    // 根据模式增强提示词
    enhancePromptForMode(prompt, isLocal = false) {
        if (isLocal) {
            // 로컬 모델용 자연스러운 영어 프롬프트
            const englishPrompts = {
                casual: `You are Bella, a friendly AI. Have a natural conversation in English. User: "${prompt}"\nBella:`,
                assistant: `You are Bella, a helpful AI assistant. Respond naturally in English. User: "${prompt}"\nBella:`,
                creative: `You are Bella, a creative AI companion. Chat naturally in English. User: "${prompt}"\nBella:`
            };
            return englishPrompts[this.currentMode] || englishPrompts.casual;
        } else {
            // 클라우드 API용 자연스러운 영어 프롬프트
            return `You are Bella, a friendly AI assistant. Please respond naturally and conversationally in English.\n\nUser: ${prompt}\nBella:`;
        }
    }

    // 获取错误回应
    getErrorResponse() {
        const errorResponses = [
            "죄송해요, 지금 조금 혼란스러워서 다시 정리해볼게요...",
            "음... 조금 더 생각해볼게요, 잠시만 기다려주세요.",
            "생각이 복잡해서 정리할 시간이 필요해요.",
            "다시 정리해서 말씀드릴게요, 잠시만요."
        ];
        
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    // 设置聊天模式
    setChatMode(mode) {
        if (['casual', 'assistant', 'creative'].includes(mode)) {
            this.currentMode = mode;
            return true;
        }
        return false;
    }

    // 切换AI服务提供商
    switchProvider(provider) {
        if (provider === 'local') {
            this.useCloudAPI = false;
            return true;
        } else {
            const success = this.cloudAPI.switchProvider(provider);
            if (success) {
                this.useCloudAPI = true;
            }
            return success;
        }
    }

    // 设置API密钥
    setAPIKey(provider, apiKey) {
        return this.cloudAPI.setAPIKey(provider, apiKey);
    }

    // 清除对话历史
    clearHistory() {
        this.cloudAPI.clearHistory();
    }

    // 获取当前配置信息
    getCurrentConfig() {
        return {
            useCloudAPI: this.useCloudAPI,
            provider: this.useCloudAPI ? this.cloudAPI.getCurrentProvider() : { name: 'local', model: 'LaMini-Flan-T5-77M' },
            mode: this.currentMode,
            isConfigured: this.useCloudAPI ? this.cloudAPI.isConfigured() : true
        };
    }

    async listen(audioData) {
        if (!this.asr) {
            throw new Error('语音识别模型未初始化');
        }
        const result = await this.asr(audioData);
        return result.text;
    }

    async speak(text) {
        console.log('TTS speak 호출됨, 텍스트:', text);
        
        // SpeechT5 모델이 있으면 우선 사용 (영어 지원)
        if (this.tts) {
            try {
                console.log('SpeechT5 TTS 모델 사용');
                
                // 스피커 임베딩 로드
                const speaker_embeddings_url = './models/Xenova/speecht5_tts/speaker_embeddings.bin';
                const response = await fetch(speaker_embeddings_url);
                if (!response.ok) {
                    throw new Error(`스피커 임베딩 로드 실패: ${response.status}`);
                }
                const speaker_embeddings = await response.arrayBuffer();
                console.log('스피커 임베딩 로드 완료, 크기:', speaker_embeddings.byteLength);
                
                const result = await this.tts(text, {
                    speaker_embeddings: speaker_embeddings,
                });
                
                console.log('SpeechT5 TTS 결과:', result);
                
                if (result && result.audio) {
                    console.log('SpeechT5 오디오 데이터 생성 완료');
                    return result.audio;
                } else {
                    throw new Error('SpeechT5 결과에 오디오 데이터가 없습니다');
                }
            } catch (speechT5Error) {
                console.error('SpeechT5 TTS 오류, Web Speech API로 fallback:', speechT5Error);
            }
        }
        
        // Fallback: Web Speech API 사용
        if ('speechSynthesis' in window) {
            return new Promise((resolve, reject) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US'; // 영어 설정
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                
                utterance.onstart = () => {
                    console.log('Web Speech API TTS 재생 시작');
                    resolve(true);
                };
                
                utterance.onend = () => {
                    console.log('Web Speech API TTS 재생 완료');
                };
                
                utterance.onerror = (error) => {
                    console.error('Web Speech API TTS 오류:', error);
                    reject(error);
                };
                
                speechSynthesis.speak(utterance);
            });
        } else {
            throw new Error('TTS를 사용할 수 없습니다');
        }
    }

    // 获取云端API服务实例（用于外部访问）
    getCloudAPIService() {
        return this.cloudAPI;
    }
}

// ES6模块导出
export { BellaAI };