// Import BellaAI core modules
import { BellaAI } from './core.js';
import { ChatInterface } from './chatInterface.js';

document.addEventListener('DOMContentLoaded', async function() {
    // --- Get all necessary DOM elements first ---
    const transcriptDiv = document.getElementById('transcript');
    const loadingScreen = document.getElementById('loading-screen');
    const video1 = document.getElementById('video1');
    const video2 = document.getElementById('video2');
    const micButton = document.getElementById('mic-button');


    // --- AI Core Initialization ---
    let bellaAI;
    let chatInterface;
    
    // Initialize chat interface first (doesn't depend on AI)
    try {
        chatInterface = new ChatInterface();
        console.log('Chat interface initialized successfully');
        console.log('ChatInterface instance created:', chatInterface);
        console.log('Chat container element:', chatInterface.chatContainer);
        console.log('Is chat container in DOM:', document.body.contains(chatInterface.chatContainer));
        
        // 自动显示聊天界面（调试用）
        setTimeout(() => {
            console.log('Attempting to auto-show chat interface...');
            chatInterface.show();
            console.log('聊天界面已自动显示');
            console.log('聊天界面可见性:', chatInterface.getVisibility());
            console.log('聊天容器类名:', chatInterface.chatContainer.className);
        }, 2000);
    } catch (error) {
        console.error('聊天界面初始化失败:', error);
    }
    
    // 然后尝试初始化AI核心
    micButton.disabled = true;
    transcriptDiv.textContent = '正在唤醒贝拉的核心...';
    try {
        bellaAI = await BellaAI.getInstance();
        console.log('Bella AI 初始化成功');
        
        // 设置聊天界面的AI回调函数
        if (chatInterface) {
            chatInterface.onMessageSend = async (message) => {
                try {
                    chatInterface.showTypingIndicator();
                    const response = await bellaAI.think(message);
                    chatInterface.hideTypingIndicator();
                    chatInterface.addMessage('assistant', response);
                    
                    // Enable TTS for chat interface as well
                    console.log('Chat TTS call started - response:', response);
                    try {
                        console.log('Calling bellaAI.speak function from chat...');
                        const audioData = await bellaAI.speak(response);
                        console.log('Chat TTS audio data generated successfully:', audioData);
                        
                        if (audioData === true) {
                            console.log('Chat Web Speech API TTS used');
                        } else if (audioData instanceof Float32Array && audioData.length > 0) {
                            console.log('Chat Float32Array detected, WAV conversion needed');
                        } else {
                            console.warn('Chat unknown audio data format:', audioData);
                        }
                    } catch (ttsError) {
                        console.error('Chat TTS error:', ttsError);
                    }
                    
                } catch (error) {
                    console.error('AI processing error:', error);
                    chatInterface.hideTypingIndicator();
                    chatInterface.addMessage('assistant', 'Sorry, I\'m a bit confused right now, please try again later...');
                }
            };
        }
        
        micButton.disabled = false;
        transcriptDiv.textContent = 'Bella is ready, please click the microphone to start conversation.';
    } catch (error) {
        console.error('Failed to initialize Bella AI:', error);
        transcriptDiv.textContent = 'AI model loading failed, but chat interface is still available.';
        
        // Provide basic chat functionality even if AI fails
        if (chatInterface) {
            chatInterface.onMessageSend = async (message) => {
                chatInterface.showTypingIndicator();
                setTimeout(() => {
                    chatInterface.hideTypingIndicator();
                    const fallbackResponses = [
                        'My AI core is still loading, please try again later...',
                        'Sorry, I can\'t think properly right now, but I\'m trying to learn!',
                        'My brain is still starting up, please give me some time...',
                        'System is updating, temporarily unable to provide intelligent responses.'
                    ];
                    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
                    chatInterface.addMessage('assistant', randomResponse);
                }, 1000);
            };
        }
        
        // Disable voice functionality, but keep interface available
        micButton.disabled = true;
    }

    // --- Loading screen handling ---
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        // Hide it after the animation to prevent it from blocking interactions
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            // Show chat control panel
            const chatControlPanel = document.querySelector('.chat-control-panel');
            if (chatControlPanel) {
                chatControlPanel.classList.add('visible');
            }
        }, 500); // This time should match the transition time in CSS
    }, 1500); // Start fading out after 1.5 seconds

    let activeVideo = video1;
    let inactiveVideo = video2;

    // 视频列表
    const videoList = [
        '视频资源/3D 建模图片制作.mp4',
        '视频资源/jimeng-2025-07-16-1043-笑着优雅的左右摇晃，过一会儿手扶着下巴，保持微笑.mp4',
        '视频资源/jimeng-2025-07-16-4437-比耶，然后微笑着优雅的左右摇晃.mp4',
        '视频资源/生成加油视频.mp4',
        '视频资源/生成跳舞视频.mp4',
        '视频资源/负面/jimeng-2025-07-16-9418-双手叉腰，嘴巴一直在嘟囔，表情微微生气.mp4'
    ];

    // --- 视频交叉淡入淡出播放功能 ---
    function switchVideo() {
        // 1. 选择下一个视频
        const currentVideoSrc = activeVideo.querySelector('source').getAttribute('src');
        let nextVideoSrc = currentVideoSrc;
        while (nextVideoSrc === currentVideoSrc) {
            const randomIndex = Math.floor(Math.random() * videoList.length);
            nextVideoSrc = videoList[randomIndex];
        }

        // 2. 设置不活动的 video 元素的 source
        inactiveVideo.querySelector('source').setAttribute('src', nextVideoSrc);
        inactiveVideo.load();

        // 3. 当不活动的视频可以播放时，执行切换
        inactiveVideo.addEventListener('canplaythrough', function onCanPlayThrough() {
            // 确保事件只触发一次
            inactiveVideo.removeEventListener('canplaythrough', onCanPlayThrough);

            // 4. 播放新视频
            inactiveVideo.play().catch(error => {
                console.error("Video play failed:", error);
            });

            // 5. 切换 active class 来触发 CSS 过渡
            activeVideo.classList.remove('active');
            inactiveVideo.classList.add('active');

            // 6. 更新角色
            [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];

            // 为新的 activeVideo 绑定 ended 事件
            activeVideo.addEventListener('ended', switchVideo, { once: true });
        }, { once: true }); // 使用 { once: true } 确保事件只被处理一次
    }

    // 初始启动
    activeVideo.addEventListener('ended', switchVideo, { once: true });
    
    // 聊天控制按钮事件
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatTestBtn = document.getElementById('chat-test-btn');
    
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', () => {
            if (chatInterface) {
                console.log('聊天按钮被点击');
                console.log('点击前聊天界面状态:', chatInterface.getVisibility());
                console.log('点击前聊天容器类名:', chatInterface.chatContainer.className);
                
                chatInterface.toggle();
                
                console.log('点击后聊天界面状态:', chatInterface.getVisibility());
                console.log('点击后聊天容器类名:', chatInterface.chatContainer.className);
                console.log('聊天界面切换，当前状态:', chatInterface.getVisibility());
                
                // 更新按钮状态
                const isVisible = chatInterface.getVisibility();
                chatToggleBtn.innerHTML = isVisible ? 
                    '<i class="fas fa-times"></i><span>关闭</span>' : 
                    '<i class="fas fa-comments"></i><span>聊天</span>';
                console.log('按钮文本更新为:', chatToggleBtn.innerHTML);
            }
        });
    }
    
    if (chatTestBtn) {
        chatTestBtn.addEventListener('click', () => {
            if (chatInterface) {
                const testMessages = [
                    '你好！我是贝拉，很高兴见到你！',
                    '聊天界面工作正常，所有功能都已就绪。',
                    '这是一条测试消息，用来验证界面功能。'
                ];
                const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
                chatInterface.addMessage('assistant', randomMessage);
                
                // 如果聊天界面未显示，则自动显示
                if (!chatInterface.getVisibility()) {
                    chatInterface.show();
                    chatToggleBtn.innerHTML = '<i class="fas fa-times"></i><span>关闭</span>';
                }
                
                console.log('测试消息已添加:', randomMessage);
            }
        });
    }


    // --- 语音识别核心 ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    // 检查浏览器是否支持语音识别
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // 持续识别
        recognition.lang = 'en-US'; // 설정 언어를 영어
        recognition.interimResults = true; // 获取临时结果

        recognition.onresult = async (event) => {
            const transcriptContainer = document.getElementById('transcript');
            let final_transcript = '';
            let interim_transcript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }

            // Update interim results
            transcriptContainer.textContent = `당신: ${final_transcript || interim_transcript}`;

            // Once we have a final result, process it with the AI
            if (final_transcript && bellaAI) {
                const userText = final_transcript.trim();
                transcriptContainer.textContent = `당신: ${userText}`;

                // 如果聊天界面已打开，也在聊天窗口中显示
                if (chatInterface && chatInterface.getVisibility()) {
                    chatInterface.addMessage('user', userText);
                }

                try {
                    // Let Bella think
                    const thinkingText = document.createElement('p');
                    thinkingText.textContent = '벨라가 생각하고 있어요...';
                    thinkingText.style.color = '#888';
                    thinkingText.style.fontStyle = 'italic';
                    transcriptContainer.appendChild(thinkingText);
                    
                    const response = await bellaAI.think(userText);
                    
                    transcriptContainer.removeChild(thinkingText);
                    const bellaText = document.createElement('p');
                    bellaText.textContent = `벨라: ${response}`;
                    bellaText.style.color = '#ff6b9d';
                    bellaText.style.fontWeight = 'bold';
                    bellaText.style.marginTop = '10px';
                    transcriptContainer.appendChild(bellaText);

                    // 如果聊天界面已打开，也在聊天窗口中显示
                    if (chatInterface && chatInterface.getVisibility()) {
                        chatInterface.addMessage('assistant', response);
                    }

                    // Enable TTS functionality
                    console.log('TTS call started - response:', response);
                    try {
                        console.log('Calling bellaAI.speak function...');
                        const audioData = await bellaAI.speak(response);
                        console.log('TTS audio data generated successfully:', audioData);
                        
                        if (audioData) {
                            console.log('Audio data type:', typeof audioData, 'length:', audioData.length || 'N/A');
                            
                            // Convert to WAV if Float32Array is returned from SpeechT5
                            if (audioData instanceof Float32Array && audioData.length > 0) {
                                console.log('Float32Array detected, converting to WAV...');
                                const wavBuffer = convertFloat32ArrayToWav(audioData, 16000);
                                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                                const audioUrl = URL.createObjectURL(blob);
                                const audio = new Audio(audioUrl);
                                
                                audio.onloadeddata = () => {
                                    console.log('WAV audio loaded successfully');
                                };
                                
                                audio.onerror = (error) => {
                                    console.error('WAV audio playback error:', error);
                                };
                                
                                audio.onended = () => {
                                    URL.revokeObjectURL(audioUrl);
                                };
                                
                                await audio.play();
                                console.log('WAV TTS playback successful');
                            } else if (audioData === true) {
                                // When Web Speech API returns true (already played)
                                console.log('Web Speech API TTS used');
                            } else {
                                console.warn('Unknown audio data format:', audioData);
                            }
                        } else {
                            console.warn('TTS audio data is empty');
                        }
                    } catch (ttsError) {
                        console.error('TTS error:', ttsError);
                        // Continue conversation even if TTS fails
                    }

                    // Function to convert Float32Array to WAV format
                    function convertFloat32ArrayToWav(audioData, sampleRate) {
                        const length = audioData.length;
                        const buffer = new ArrayBuffer(44 + length * 2);
                        const view = new DataView(buffer);
                        
                        // Write WAV header
                        const writeString = (offset, string) => {
                            for (let i = 0; i < string.length; i++) {
                                view.setUint8(offset + i, string.charCodeAt(i));
                            }
                        };
                        
                        writeString(0, 'RIFF');
                        view.setUint32(4, 36 + length * 2, true);
                        writeString(8, 'WAVE');
                        writeString(12, 'fmt ');
                        view.setUint32(16, 16, true);
                        view.setUint16(20, 1, true);
                        view.setUint16(22, 1, true);
                        view.setUint32(24, sampleRate, true);
                        view.setUint32(28, sampleRate * 2, true);
                        view.setUint16(32, 2, true);
                        view.setUint16(34, 16, true);
                        writeString(36, 'data');
                        view.setUint32(40, length * 2, true);
                        
                        // Convert audio data (Float32 -> Int16)
                        let offset = 44;
                        for (let i = 0; i < length; i++) {
                            const sample = Math.max(-1, Math.min(1, audioData[i]));
                            view.setInt16(offset, sample * 0x7FFF, true);
                            offset += 2;
                        }
                        
                        return buffer;
                    }

                } catch (error) {
                    console.error('Bella AI processing error:', error);
                    const errorText = document.createElement('p');
                    const errorMsg = '벨라가 처리하는 중에 문제가 발생했지만, 계속 학습하고 있어요...';
                    errorText.textContent = errorMsg;
                    errorText.style.color = '#ff9999';
                    transcriptContainer.appendChild(errorText);
                    
                    if (chatInterface && chatInterface.getVisibility()) {
                        chatInterface.addMessage('assistant', errorMsg);
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
        };

    } else {
        console.log('브라우저가 음성 인식 기능을 지원하지 않습니다.');
        // 可以在界面上给用户提示
    }

    // --- 麦克风按钮交互 ---
    let isListening = false;

    micButton.addEventListener('click', function() {
        if (!SpeechRecognition) return; // 如果不支持，则不执行任何操作

        isListening = !isListening;
        micButton.classList.toggle('is-listening', isListening);
        const transcriptContainer = document.querySelector('.transcript-container');
        const transcriptText = document.getElementById('transcript');

        if (isListening) {
            transcriptText.textContent = '聆听中...'; // 立刻显示提示
            transcriptContainer.classList.add('visible');
            recognition.start();
        } else {
            recognition.stop();
            transcriptContainer.classList.remove('visible');
            transcriptText.textContent = ''; // 清空文本
        }
    });




});