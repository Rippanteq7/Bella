// core.js - Bella's Brain (v3)
// Bella's core AI logic supporting hybrid architecture of local models and cloud APIs

import { pipeline, env, AutoTokenizer, AutoModelForSpeechSeq2Seq } from './vendor/transformers.js';
import CloudAPIService from './cloudAPI.js';

// Local model configuration
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
        this.useCloudAPI = false; // Default to local model
        this.currentMode = 'casual'; // Chat mode: casual, assistant, creative
    }

    async init() {
        console.log('Initializing Bella\'s core AI...');
        
        // Load LLM model first (chat functionality)
        try {
            console.log('Loading LLM model...');
            // Using LaMini-Flan-T5-77M for English conversations
            this.llm = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
            console.log('LLM model loaded successfully.');
        } catch (error) {
            console.error('Failed to load LLM model:', error);
            // LLM loading failed, but don't block initialization
        }
        
        // Try to load ASR model (speech recognition functionality)
        try {
            console.log('Loading ASR model...');
            const modelPath = 'Xenova/whisper-asr';
            const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
            const model = await AutoModelForSpeechSeq2Seq.from_pretrained(modelPath);
            this.asr = await pipeline('automatic-speech-recognition', model, { tokenizer });
            console.log('ASR model loaded successfully.');
        } catch (error) {
            console.warn('ASR model failed to load, voice recognition will be disabled:', error);
            // ASR loading failed, but doesn't affect chat functionality
            this.asr = null;
        }

        // Load TTS model
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
            // If cloud API is enabled and configured, use cloud service first
            if (this.useCloudAPI && this.cloudAPI.isConfigured()) {
                return await this.thinkWithCloudAPI(prompt);
            }
            
            // Otherwise use local model
            return await this.thinkWithLocalModel(prompt);
            
        } catch (error) {
            console.error('Error occurred during thinking process:', error);
            
            // If cloud API fails, try to fallback to local model
            if (this.useCloudAPI) {
                console.log('Cloud API failed, falling back to local model...');
                try {
                    return await this.thinkWithLocalModel(prompt);
                } catch (localError) {
                    console.error('Local model also failed:', localError);
                }
            }
            
            return this.getErrorResponse();
        }
    }

    // Use cloud API for thinking
    async thinkWithCloudAPI(prompt) {
        const enhancedPrompt = this.enhancePromptForMode(prompt);
        return await this.cloudAPI.chat(enhancedPrompt);
    }

    // Use local model for thinking
    async thinkWithLocalModel(prompt) {
        if (!this.llm) {
            return "I'm still learning how to think, please wait a moment...";
        }
        
        // Prompt for natural English conversation
        const englishPrompt = `You are Bella, a friendly AI assistant. Please respond naturally and conversationally in English. User says: "${prompt}"\nBella:`;
        console.log('Local model prompt:', englishPrompt);
        
        const result = await this.llm(englishPrompt, {
            max_new_tokens: 80,
            temperature: 0.8,
            top_k: 40,
            top_p: 0.9,
            do_sample: true,
            repetition_penalty: 1.2,
        });
        
        console.log('Local model raw response:', result);
        
        // Clean up generated text
        let response = result[0].generated_text;
        if (response.includes(englishPrompt)) {
            response = response.replace(englishPrompt, '').trim();
        }
        
        // Replace with natural English responses if output is too short or strange
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
        
        console.log('Final response:', response);
        return response;
    }

    // Enhance prompts based on current mode
    enhancePromptForMode(prompt, isLocal = false) {
        if (isLocal) {
            // Natural English prompts for local model
            const englishPrompts = {
                casual: `You are Bella, a friendly AI. Have a natural conversation in English. User: "${prompt}"\nBella:`,
                assistant: `You are Bella, a helpful AI assistant. Respond naturally in English. User: "${prompt}"\nBella:`,
                creative: `You are Bella, a creative AI companion. Chat naturally in English. User: "${prompt}"\nBella:`
            };
            return englishPrompts[this.currentMode] || englishPrompts.casual;
        } else {
            // Natural English prompts for cloud API
            return `You are Bella, a friendly AI assistant. Please respond naturally and conversationally in English.\n\nUser: ${prompt}\nBella:`;
        }
    }

    // Get error response
    getErrorResponse() {
        const errorResponses = [
            "Sorry, I'm a bit confused right now, let me reorganize my thoughts...",
            "Hmm... let me think about this more, please wait a moment.",
            "My thoughts are a bit complex, I need time to organize them.",
            "Let me reorganize and get back to you, just a moment."
        ];
        
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    // Set chat mode
    setChatMode(mode) {
        if (['casual', 'assistant', 'creative'].includes(mode)) {
            this.currentMode = mode;
            return true;
        }
        return false;
    }

    // Switch AI service provider
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

    // Set API key
    setAPIKey(provider, apiKey) {
        return this.cloudAPI.setAPIKey(provider, apiKey);
    }

    // Clear conversation history
    clearHistory() {
        this.cloudAPI.clearHistory();
    }

    // Get current configuration info
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
            throw new Error('Speech recognition model not initialized');
        }
        const result = await this.asr(audioData);
        return result.text;
    }

    async speak(text) {
        console.log('TTS speak called, text:', text);
        
        // Use SpeechT5 model first if available (English support)
        if (this.tts) {
            try {
                console.log('Using SpeechT5 TTS model');
                
                // Load speaker embeddings
                const speaker_embeddings_url = './models/Xenova/speecht5_tts/speaker_embeddings.bin';
                const response = await fetch(speaker_embeddings_url);
                if (!response.ok) {
                    throw new Error(`Failed to load speaker embeddings: ${response.status}`);
                }
                const speaker_embeddings = await response.arrayBuffer();
                console.log('Speaker embeddings loaded, size:', speaker_embeddings.byteLength);
                
                const result = await this.tts(text, {
                    speaker_embeddings: speaker_embeddings,
                });
                
                console.log('SpeechT5 TTS result:', result);
                
                if (result && result.audio) {
                    console.log('SpeechT5 audio data generated successfully');
                    return result.audio;
                } else {
                    throw new Error('No audio data in SpeechT5 result');
                }
            } catch (speechT5Error) {
                console.error('SpeechT5 TTS error, falling back to Web Speech API:', speechT5Error);
            }
        }
        
        // Fallback: Use Web Speech API
        if ('speechSynthesis' in window) {
            return new Promise((resolve, reject) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US'; // English setting
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                
                utterance.onstart = () => {
                    console.log('Web Speech API TTS playback started');
                    resolve(true);
                };
                
                utterance.onend = () => {
                    console.log('Web Speech API TTS playback completed');
                };
                
                utterance.onerror = (error) => {
                    console.error('Web Speech API TTS error:', error);
                    reject(error);
                };
                
                speechSynthesis.speak(utterance);
            });
        } else {
            throw new Error('TTS is not available');
        }
    }

    // Get cloud API service instance (for external access)
    getCloudAPIService() {
        return this.cloudAPI;
    }
}

// ES6 module export
export { BellaAI };