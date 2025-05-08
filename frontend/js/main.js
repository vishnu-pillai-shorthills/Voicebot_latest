// document.addEventListener('DOMContentLoaded', () => {
//     const connectButton = document.getElementById('connectButton');
//     const startButton = document.getElementById('startButton');
//     const stopButton = document.getElementById('stopButton');
//     const wsStatusElem = document.getElementById('wsStatus');
//     const botStateElem = document.getElementById('botState');
//     const micPermissionElem = document.getElementById('micPermission');
//     const transcriptArea = document.getElementById('transcriptArea');
//     const llmResponseArea = document.getElementById('llmResponseArea');
//     const generalLogArea = document.getElementById('generalLogArea');
//     const audioPlayer = document.getElementById('audioPlayer');

//     let websocket;
//     let mediaRecorder;
//     let audioContext;
//     const TARGET_SAMPLE_RATE = 16000;

//     let audioPlaybackQueue = [];
//     let isPlayingTTS = false;
//     let currentPlayingAudio = null;
//     let halted_ids = new Set(); // <-- New: Set to store halted response_ids

//     function logMessage(area, message, type = 'info') {
//         const p = document.createElement('p');
//         p.textContent = message;
//         p.className = type;
//         area.appendChild(p);
//         area.scrollTop = area.scrollHeight;
//     }

//     function clearLogs() {
//         transcriptArea.innerHTML = '<p><em>Transcripts will appear here...</em></p>';
//         llmResponseArea.innerHTML = '<p><em>LLM responses will appear here...</em></p>';
//         generalLogArea.innerHTML = '<p><em>General logs and errors...</em></p>';
//     }

//     connectButton.addEventListener('click', () => {
//         if (websocket && websocket.readyState === WebSocket.OPEN) {
//             logMessage(generalLogArea, "Already connected.", "info");
//             return;
//         }
//         const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
//         const wsUrl = `${wsProtocol}//${window.location.host}/ws/voice`;

//         websocket = new WebSocket(wsUrl);
//         clearLogs();
//         logMessage(generalLogArea, `Attempting to connect to ${wsUrl}...`, "info");

//         websocket.onopen = () => {
//             wsStatusElem.textContent = 'Connected';
//             wsStatusElem.style.color = 'green';
//             logMessage(generalLogArea, "WebSocket Connected.", "info");
//             connectButton.disabled = true;
//             startButton.disabled = false;
//             halted_ids.clear(); // <-- New: Clear halted IDs on new connection
//             logMessage(generalLogArea, "Halted ID list cleared.", "info");
//         };

//         websocket.onmessage = (event) => {
//             const message = JSON.parse(event.data);
//             console.log("Received from server:", message);

//             if (message.type === 'state_update') {
//                 botStateElem.textContent = message.state;
//                 logMessage(generalLogArea, `Bot state: ${message.state}`, "info");
//             } else if (message.type === 'transcript') {
//                 let prefix = message.is_final ? "User: " : "INTERIM: ";
//                 prefix += '[' + (message.timestamp || new Date().toLocaleTimeString()) + ']';
//                 logMessage(transcriptArea, prefix + message.text, message.is_final ? 'transcript-final' : 'transcript-interim');
//             } else if (message.type === 'llm_response') {
//                 logMessage(llmResponseArea, `LLM: ${message.text}`, 'llm-response');
//             } else if (message.type === 'audio_response') {
//                 if (message.audio_format === 'mp3' && message.data && message.response_id) {
//                     const audioSrc = `data:audio/mp3;base64,${message.data}`;
//                     audioPlaybackQueue.push({ response_id: message.response_id, audioSrc: audioSrc });
//                     logMessage(generalLogArea, `Queued audio with response_id: ${message.response_id}`, "info");
//                     playNextInQueue();
//                 } else if (!message.response_id) {
//                     logMessage(generalLogArea, `SERVER WARNING: Received audio_response without response_id. Cannot process.`, "warning");
//                 } else if (!message.data) {
//                     logMessage(generalLogArea, `SERVER WARNING: Received audio_response for ${message.response_id} without audio data.`, "warning");
//                 }
//             } else if (message.type === 'halt') {
//                 const haltId = message.response_id;
//                 if (!haltId) {
//                     logMessage(generalLogArea, `SERVER WARNING: Received HALT command without response_id.`, 'warning');
//                     return;
//                 }
//                 logMessage(generalLogArea, `Received HALT command for response_id: ${haltId}. Adding to halted list.`, 'warning');
//                 halted_ids.add(haltId); // Add to the set of halted IDs

//                 // If the currently playing audio is the one being halted, stop it immediately
//                 // and attempt to play the next. playNextInQueue will handle skipping if necessary.
//                 if (currentPlayingAudio && currentPlayingAudio.response_id === haltId) {
//                     audioPlayer.pause();
//                     audioPlayer.src = ""; // Clear source
//                     logMessage(generalLogArea, `Halted current playback (ID: ${haltId}) due to HALT command. Attempting next.`, 'info');
                    
//                     isPlayingTTS = false;
//                     currentPlayingAudio = null; 
                    
//                     playNextInQueue(); // This will now check against halted_ids
//                 }
//                 // No need to explicitly filter audioPlaybackQueue here anymore,
//                 // playNextInQueue will skip over any halted items.
//             } else if (message.type === 'error') {
//                 logMessage(generalLogArea, `SERVER ERROR: ${message.message}`, 'error');
//             } else if (message.type === 'info' || message.type === 'warning' || message.type === 'stt_status') {
//                  logMessage(generalLogArea, `SERVER INFO/STATUS: ${message.status || message.message}`, 'info');
//             }
//         };

//         websocket.onerror = (error) => {
//             console.error("WebSocket Error:", error);
//             wsStatusElem.textContent = 'Error';
//             wsStatusElem.style.color = 'red';
//             logMessage(generalLogArea, "WebSocket Error. See console for details.", "error");
//             connectButton.disabled = false;
//             startButton.disabled = true;
//             stopButton.disabled = true;
//         };

//         websocket.onclose = (event) => {
//             wsStatusElem.textContent = 'Disconnected';
//             wsStatusElem.style.color = 'red';
//             logMessage(generalLogArea, `WebSocket Disconnected. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`, "info");
//             connectButton.disabled = false;
//             startButton.disabled = true;
//             stopButton.disabled = true;
//             if (mediaRecorder && mediaRecorder.state === "recording") {
//                 mediaRecorder.stop();
//             }
//             if (audioPlayer && !audioPlayer.paused) {
//                 audioPlayer.pause();
//                 audioPlayer.src = "";
//             }
//             audioPlaybackQueue = [];
//             isPlayingTTS = false;
//             currentPlayingAudio = null;
//             // halted_ids persists until next successful onopen
//         };
//     });

//     function playNextInQueue() {
//         if (isPlayingTTS) { // If already playing something, don't interfere
//             return;
//         }

//         let audioToPlay = null;
//         let foundPlayableAudio = false;

//         while (audioPlaybackQueue.length > 0) {
//             const potentialAudio = audioPlaybackQueue.shift(); // Take from front of queue

//             if (!potentialAudio || !potentialAudio.response_id) { // Basic sanity check
//                 logMessage(generalLogArea, "Dequeued invalid audio item (missing data or response_id). Skipping.", "warning");
//                 continue;
//             }

//             if (halted_ids.has(potentialAudio.response_id)) {
//                 logMessage(generalLogArea, `Skipping playback for HALTED response_id: ${potentialAudio.response_id}.`, 'info');
//                 // Continue loop to check next item in the queue
//             } else {
//                 audioToPlay = potentialAudio; // Found a non-halted item
//                 foundPlayableAudio = true;
//                 break; // Exit the loop, we found something to play
//             }
//         }

//         if (!foundPlayableAudio) { // Queue is empty or all remaining items were halted
//             if(audioPlaybackQueue.length === 0) { // Only log exhaustion if queue is truly empty now
//                 logMessage(generalLogArea, "Audio queue is empty or all remaining items are halted.", "info");
//             }
//             isPlayingTTS = false; 
//             currentPlayingAudio = null;
//             return;
//         }

//         // Proceed with playback for audioToPlay
//         isPlayingTTS = true;
//         currentPlayingAudio = audioToPlay;

//         if (!currentPlayingAudio.audioSrc) {
//             logMessage(generalLogArea, `Attempted to play audio (ID: ${currentPlayingAudio.response_id}) but missing audioSrc.`, "error");
//             isPlayingTTS = false;
//             currentPlayingAudio = null;
//             playNextInQueue(); // Try the next one, this one was bad
//             return;
//         }

//         audioPlayer.src = currentPlayingAudio.audioSrc;
//         audioPlayer.play()
//             .then(() => {
//                 logMessage(generalLogArea, `Playing TTS audio for response_id: ${currentPlayingAudio.response_id}.`, "info");
//             })
//             .catch(e => {
//                 logMessage(generalLogArea, `Error playing audio for response_id: ${currentPlayingAudio.response_id}: ${e.message}`, "error");
//                 isPlayingTTS = false;
//                 currentPlayingAudio = null;
//                 playNextInQueue(); // Try to play the next one if this failed
//             });
//     }

//     audioPlayer.addEventListener('ended', () => {
//         const endedAudioId = currentPlayingAudio ? currentPlayingAudio.response_id : "N/A (already handled or error)";
//         logMessage(generalLogArea, `Audio naturally ended. Response ID was: ${endedAudioId}.`, "info");
        
//         isPlayingTTS = false;
//         currentPlayingAudio = null; 
        
//         playNextInQueue(); // Attempt to play next in queue (will check halted_ids)
//     });

//     audioPlayer.addEventListener('error', (e) => {
//         const playingId = currentPlayingAudio ? currentPlayingAudio.response_id : "unknown";
//         logMessage(generalLogArea, `Audio player error for response_id ${playingId}: ${e.message || 'Unknown error'} - ${audioPlayer.error?.message}`, 'error');
//         isPlayingTTS = false;
//         currentPlayingAudio = null;
//         playNextInQueue();
//     });
    
//     // ... (startAudioProcessing, startButton, stopButton logic remains the same)
//     async function startAudioProcessing(stream) {
//         // Close existing AudioContext if it exists and is not already closed
//         if (audioContext && audioContext.state !== 'closed') {
//             try {
//                 await audioContext.close();
//                 logMessage(generalLogArea, "Previous AudioContext closed.", "info");
//             } catch (e) {
//                 console.error("Error closing previous audio context:", e);
//                 logMessage(generalLogArea, `Error closing previous AudioContext: ${e.message}`, "warning");
//             }
//         }
        
//         audioContext = new (window.AudioContext || window.webkitAudioContext)(); 
        
//         if (audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
//             logMessage(generalLogArea, `AudioContext running at ${audioContext.sampleRate}Hz. Input audio will be at this rate. Server expects ${TARGET_SAMPLE_RATE}Hz. Ensure server-side resampling or alignment.`, "warning");
//         }
        
//         const source = audioContext.createMediaStreamSource(stream);
        
//         const options = {
//             mimeType: 'audio/webm;codecs=pcm', 
//         };
//         let chosenMimeType = options.mimeType;

//         try {
//             if (!MediaRecorder.isTypeSupported(options.mimeType)) {
//                 throw new Error(`PCM in WebM not supported.`);
//             }
//             mediaRecorder = new MediaRecorder(stream, options);
//         } catch (e) {
//             logMessage(generalLogArea, `PCM in WebM not supported or failed: ${e.message}. Trying Opus.`, "warning");
//             try {
//                 const opusOptions = {
//                     mimeType: 'audio/webm;codecs=opus',
//                 };
//                 if (!MediaRecorder.isTypeSupported(opusOptions.mimeType)) {
//                     throw new Error(`Opus in WebM not supported.`);
//                 }
//                 mediaRecorder = new MediaRecorder(stream, opusOptions);
//                 chosenMimeType = opusOptions.mimeType;
//             } catch (e2) {
//                  logMessage(generalLogArea, `Opus in WebM also not supported: ${e2.message}. Audio capture may not work. Trying default.`, "error");
//                  try {
//                     mediaRecorder = new MediaRecorder(stream);
//                     chosenMimeType = mediaRecorder.mimeType || "default by browser";
//                  } catch (e3) {
//                     logMessage(generalLogArea, `Failed to create MediaRecorder with default settings: ${e3.message}. Cannot start recording.`, "error");
//                     startButton.disabled = false; 
//                     stopButton.disabled = true;
//                     if (audioContext && audioContext.state !== 'closed') {
//                         audioContext.close().catch(err => console.error("Error closing audio context:", err));
//                     }
//                     return; 
//                  }
//             }
//         }
//         logMessage(generalLogArea, `MediaRecorder initialized with: ${chosenMimeType}`, "info");


//         mediaRecorder.ondataavailable = (event) => {
//             if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
//                 websocket.send(event.data);
//             }
//         };

//         mediaRecorder.onstart = () => {
//             logMessage(generalLogArea, "Recording started.", "info");
//             startButton.disabled = true;
//             stopButton.disabled = false;
//             botStateElem.textContent = "Listening...";
//         };

//         mediaRecorder.onstop = () => {
//             logMessage(generalLogArea, "Recording stopped.", "info");
//             startButton.disabled = false;
//             stopButton.disabled = true;
//             botStateElem.textContent = "Idle/Processing"; 

//             if (audioContext && audioContext.state !== 'closed') {
//                 audioContext.close().then(() => {
//                     logMessage(generalLogArea, "AudioContext closed after recording stop.", "info");
//                 }).catch(e => console.error("Error closing audio context post-stop:", e));
//             }
//             stream.getTracks().forEach(track => track.stop());
//             logMessage(generalLogArea, "Microphone tracks stopped.", "info");
//             micPermissionElem.textContent = 'Granted (Not actively using)';

//         };
        
//         mediaRecorder.onerror = (event) => {
//             let errorName = event.error && event.error.name ? event.error.name : "Unknown Error";
//             let errorMessage = event.error && event.error.message ? event.error.message : "";
//             logMessage(generalLogArea, `MediaRecorder error: ${errorName} - ${errorMessage}`, "error");
//              if (mediaRecorder.state === "recording") {
//                 mediaRecorder.stop(); 
//             } else { 
//                 startButton.disabled = false;
//                 stopButton.disabled = true;
//                 botStateElem.textContent = "Error";
//             }
//         };

//         mediaRecorder.start(330); 
//     }


//     startButton.addEventListener('click', async () => {
//         if (!websocket || websocket.readyState !== WebSocket.OPEN) {
//             logMessage(generalLogArea, "WebSocket not connected. Please connect first.", "error");
//             return;
//         }
//         if (mediaRecorder && mediaRecorder.state === "recording") {
//             logMessage(generalLogArea, "Recording is already in progress.", "warning");
//             return;
//         }

//         startButton.disabled = true; 
//         stopButton.disabled = true;

//         try {
//             const stream = await navigator.mediaDevices.getUserMedia({
//                 audio: {
//                     channelCount: 1,
//                 },
//                 video: false
//             });
//             micPermissionElem.textContent = 'Granted';
//             micPermissionElem.style.color = 'green';
//             logMessage(generalLogArea, "Microphone access granted.", "info");
//             await startAudioProcessing(stream);

//         } catch (err) {
//             console.error("Error accessing microphone:", err);
//             micPermissionElem.textContent = `Denied/Error: ${err.name} - ${err.message}`;
//             micPermissionElem.style.color = 'red';
//             logMessage(generalLogArea, `Error accessing microphone: ${err.name} - ${err.message}`, "error");
//             startButton.disabled = false; 
//         }
//     });

//     stopButton.addEventListener('click', () => {
//         if (mediaRecorder && mediaRecorder.state === "recording") {
//             logMessage(generalLogArea, "Stop button clicked. Stopping recording...", "info");
//             mediaRecorder.stop(); 
//         } else {
//             logMessage(generalLogArea, "Not currently recording.", "warning");
//         }
//     });
// });



document.addEventListener('DOMContentLoaded', () => {
    const connectButton = document.getElementById('connectButton');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const wsStatusElem = document.getElementById('wsStatus');
    const botStateElem = document.getElementById('botState');
    const micPermissionElem = document.getElementById('micPermission');
    const transcriptArea = document.getElementById('transcriptArea');
    const llmResponseArea = document.getElementById('llmResponseArea');
    const generalLogArea = document.getElementById('generalLogArea');
    const audioPlayer = document.getElementById('audioPlayer');

    let websocket;
    let mediaRecorder;
    let audioContext;
    const TARGET_SAMPLE_RATE = 16000;

    let audioPlaybackQueue = [];
    let isPlayingTTS = false;
    let currentPlayingAudio = null;
    let halted_ids = new Set(); // Stores response_ids that are explicitly halted or superseded
    let processed_response_ids = new Set(); // Stores response_ids for which an audio_response has been received

    function logMessage(area, message, type = 'info') {
        const p = document.createElement('p');
        p.textContent = message;
        p.className = type;
        area.appendChild(p);
        area.scrollTop = area.scrollHeight;
    }

    function clearLogs() {
        transcriptArea.innerHTML = '<p><em>Transcripts will appear here...</em></p>';
        llmResponseArea.innerHTML = '<p><em>LLM responses will appear here...</em></p>';
        generalLogArea.innerHTML = '<p><em>General logs and errors...</em></p>';
    }

    connectButton.addEventListener('click', () => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            logMessage(generalLogArea, "Already connected.", "info");
            return;
        }
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/voice`;

        websocket = new WebSocket(wsUrl);
        clearLogs();
        logMessage(generalLogArea, `Attempting to connect to ${wsUrl}...`, "info");

        websocket.onopen = () => {
            wsStatusElem.textContent = 'Connected';
            wsStatusElem.style.color = 'green';
            logMessage(generalLogArea, "WebSocket Connected.", "info");
            connectButton.disabled = true;
            startButton.disabled = false;
            halted_ids.clear();
            logMessage(generalLogArea, "Halted ID list cleared.", "info");
            processed_response_ids.clear(); // Clear set of processed IDs on new connection
            logMessage(generalLogArea, "Processed response ID list cleared.", "info");
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("Received from server:", message);

            if (message.type === 'state_update') {
                botStateElem.textContent = message.state;
                logMessage(generalLogArea, `Bot state: ${message.state}`, "info");
            } else if (message.type === 'transcript') {
                let prefix = message.is_final ? "User: " : "INTERIM: ";
                prefix += '[' + (message.timestamp || new Date().toLocaleTimeString()) + '] ';
                logMessage(transcriptArea, prefix + message.text, message.is_final ? 'transcript-final' : 'transcript-interim');
            } else if (message.type === 'llm_response') {
                logMessage(llmResponseArea, `LLM: ${message.text}`, 'llm-response');
            } else if (message.type === 'audio_response') {
                if (message.audio_format === 'mp3' && message.data && message.response_id) {
                    const newAudioResponseId = message.response_id;
                    const audioSrc = `data:audio/mp3;base64,${message.data}`;

                    const isFirstTimeForThisId = !processed_response_ids.has(newAudioResponseId);

                    if (isFirstTimeForThisId) {
                        logMessage(generalLogArea, `Received new audio_response ID: ${newAudioResponseId} for the first time. Processing halt for others.`, "info");
                        processed_response_ids.add(newAudioResponseId); // Mark as processed

                        // 1. Halt currently playing audio if its response_id is different from the new one.
                        if (currentPlayingAudio && currentPlayingAudio.response_id !== newAudioResponseId) {
                            if (!halted_ids.has(currentPlayingAudio.response_id)) {
                                const haltingId = currentPlayingAudio.response_id;
                                logMessage(generalLogArea, `New (first time) audio_response ${newAudioResponseId} received. Halting current playback of ${haltingId}.`, 'warning');
                                halted_ids.add(haltingId);
                                audioPlayer.pause();
                                audioPlayer.src = "";
                                isPlayingTTS = false;
                                currentPlayingAudio = null;
                            }
                        }

                        // 2. Mark all items currently in the audioPlaybackQueue as halted if their response_id is different.
                        for (const queuedItem of audioPlaybackQueue) {
                            if (queuedItem.response_id !== newAudioResponseId) {
                                if (!halted_ids.has(queuedItem.response_id)) {
                                    logMessage(generalLogArea, `New (first time) audio_response ${newAudioResponseId} received. Marking queued audio ${queuedItem.response_id} as halted.`, 'info');
                                    halted_ids.add(queuedItem.response_id);
                                }
                            }
                        }
                    } else {
                        logMessage(generalLogArea, `Received audio_response for already processed ID: ${newAudioResponseId}. No special halting of others will occur based on this message.`, "info");
                    }

                    // 3. Common logic for all audio_responses (first time or not):
                    // Queue the new audio if it's not *already specifically halted* by a 'halt' message for its ID.
                    if (halted_ids.has(newAudioResponseId)) {
                        logMessage(generalLogArea, `Audio_response ${newAudioResponseId} was received, but its ID is (already) in the halted_ids list. It will not be queued or played.`, 'warning');
                    } else {
                        audioPlaybackQueue.push({ response_id: newAudioResponseId, audioSrc: audioSrc });
                        logMessage(generalLogArea, `Queued audio with response_id: ${newAudioResponseId}`, "info");
                    }

                    // 4. Attempt to play from the queue.
                    playNextInQueue();

                } else if (!message.response_id) {
                    logMessage(generalLogArea, `SERVER WARNING: Received audio_response without response_id. Cannot process.`, "warning");
                } else if (!message.data) {
                    logMessage(generalLogArea, `SERVER WARNING: Received audio_response for ${message.response_id} without audio data.`, "warning");
                }
            } else if (message.type === 'halt') {
                const haltId = message.response_id;
                if (!haltId) {
                    logMessage(generalLogArea, `SERVER WARNING: Received HALT command without response_id.`, 'warning');
                    return;
                }
                logMessage(generalLogArea, `Received HALT command for response_id: ${haltId}. Adding to halted list.`, 'warning');
                halted_ids.add(haltId);

                if (currentPlayingAudio && currentPlayingAudio.response_id === haltId) {
                    audioPlayer.pause();
                    audioPlayer.src = "";
                    logMessage(generalLogArea, `Halted current playback (ID: ${haltId}) due to HALT command. Attempting next.`, 'info');
                    isPlayingTTS = false;
                    currentPlayingAudio = null;
                    playNextInQueue();
                }
            } else if (message.type === 'error') {
                logMessage(generalLogArea, `SERVER ERROR: ${message.message}`, 'error');
            } else if (message.type === 'info' || message.type === 'warning' || message.type === 'stt_status') {
                 logMessage(generalLogArea, `SERVER INFO/STATUS: ${message.status || message.message}`, 'info');
            }
        };

        websocket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            wsStatusElem.textContent = 'Error';
            wsStatusElem.style.color = 'red';
            logMessage(generalLogArea, "WebSocket Error. See console for details.", "error");
            connectButton.disabled = false;
            startButton.disabled = true;
            stopButton.disabled = true;
        };

        websocket.onclose = (event) => {
            wsStatusElem.textContent = 'Disconnected';
            wsStatusElem.style.color = 'red';
            logMessage(generalLogArea, `WebSocket Disconnected. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`, "info");
            connectButton.disabled = false;
            startButton.disabled = true;
            stopButton.disabled = true;
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
            if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
                audioPlayer.src = "";
            }
            audioPlaybackQueue = [];
            isPlayingTTS = false;
            currentPlayingAudio = null;
        };
    });

    function playNextInQueue() {
        if (isPlayingTTS) {
            return;
        }
        let audioToPlay = null;
        let foundPlayableAudio = false;
        while (audioPlaybackQueue.length > 0) {
            const potentialAudio = audioPlaybackQueue.shift();
            if (!potentialAudio || !potentialAudio.response_id) {
                logMessage(generalLogArea, "Dequeued invalid audio item (missing data or response_id). Skipping.", "warning");
                continue;
            }
            if (halted_ids.has(potentialAudio.response_id)) {
                logMessage(generalLogArea, `Skipping playback for HALTED response_id: ${potentialAudio.response_id}.`, 'info');
            } else {
                audioToPlay = potentialAudio;
                foundPlayableAudio = true;
                break;
            }
        }

        if (!foundPlayableAudio) {
            if(audioPlaybackQueue.length === 0) {
                 logMessage(generalLogArea, "Audio queue is empty or all remaining items are halted.", "info");
            }
            isPlayingTTS = false;
            currentPlayingAudio = null;
            return;
        }

        isPlayingTTS = true;
        currentPlayingAudio = audioToPlay;

        if (!currentPlayingAudio.audioSrc) {
            logMessage(generalLogArea, `Attempted to play audio (ID: ${currentPlayingAudio.response_id}) but missing audioSrc.`, "error");
            isPlayingTTS = false;
            currentPlayingAudio = null;
            playNextInQueue();
            return;
        }

        audioPlayer.src = currentPlayingAudio.audioSrc;
        audioPlayer.play()
            .then(() => {
                logMessage(generalLogArea, `Playing TTS audio for response_id: ${currentPlayingAudio.response_id}.`, "info");
            })
            .catch(e => {
                logMessage(generalLogArea, `Error playing audio for response_id: ${currentPlayingAudio.response_id}: ${e.message}`, "error");
                isPlayingTTS = false;
                currentPlayingAudio = null;
                playNextInQueue();
            });
    }

    audioPlayer.addEventListener('ended', () => {
        const endedAudioId = currentPlayingAudio ? currentPlayingAudio.response_id : "N/A (already handled or error)";
        logMessage(generalLogArea, `Audio naturally ended. Response ID was: ${endedAudioId}.`, "info");
        isPlayingTTS = false;
        currentPlayingAudio = null;
        playNextInQueue();
    });

    audioPlayer.addEventListener('error', (e) => {
        const playingId = currentPlayingAudio ? currentPlayingAudio.response_id : "unknown";
        const audioPlayerErrorMessage = audioPlayer.error ? audioPlayer.error.message : 'No specific error message from player';
        logMessage(generalLogArea, `Audio player error for response_id ${playingId}: ${e.message || 'General event error'} - Player: ${audioPlayerErrorMessage}`, 'error');
        isPlayingTTS = false;
        currentPlayingAudio = null;
        playNextInQueue();
    });
    
    async function startAudioProcessing(stream) {
        if (audioContext && audioContext.state !== 'closed') {
            try {
                await audioContext.close();
                logMessage(generalLogArea, "Previous AudioContext closed.", "info");
            } catch (e) {
                console.error("Error closing previous audio context:", e);
                logMessage(generalLogArea, `Error closing previous AudioContext: ${e.message}`, "warning");
            }
        }
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
            logMessage(generalLogArea, `AudioContext running at ${audioContext.sampleRate}Hz. Input audio will be at this rate. Server expects ${TARGET_SAMPLE_RATE}Hz.`, "warning");
        }
        
        const pcmOptions = { mimeType: 'audio/webm;codecs=pcm' };
        const opusOptions = { mimeType: 'audio/webm;codecs=opus' };
        let chosenMimeType = "default by browser";

        try {
            if (MediaRecorder.isTypeSupported(pcmOptions.mimeType)) {
                mediaRecorder = new MediaRecorder(stream, pcmOptions);
                chosenMimeType = pcmOptions.mimeType;
            } else if (MediaRecorder.isTypeSupported(opusOptions.mimeType)) {
                mediaRecorder = new MediaRecorder(stream, opusOptions);
                chosenMimeType = opusOptions.mimeType;
                logMessage(generalLogArea, `PCM in WebM not supported. Using Opus in WebM.`, "warning");
            } else {
                 mediaRecorder = new MediaRecorder(stream);
                 chosenMimeType = mediaRecorder.mimeType || "default by browser";
                 logMessage(generalLogArea, `PCM and Opus in WebM not supported. Using browser default: ${chosenMimeType}.`, "warning");
            }
        } catch (e) {
            logMessage(generalLogArea, `Failed to create MediaRecorder with preferred types: ${e.message}. Trying default.`, "error");
            try {
                mediaRecorder = new MediaRecorder(stream);
                chosenMimeType = mediaRecorder.mimeType || "default by browser";
            } catch (e2) {
                logMessage(generalLogArea, `Failed to create MediaRecorder with default settings: ${e2.message}. Cannot start recording.`, "error");
                startButton.disabled = false; 
                stopButton.disabled = true;
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close().catch(err => console.error("Error closing audio context:", err));
                }
                stream.getTracks().forEach(track => track.stop());
                return;
            }
        }
        logMessage(generalLogArea, `MediaRecorder initialized with: ${chosenMimeType}`, "info");

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(event.data);
            }
        };

        mediaRecorder.onstart = () => {
            logMessage(generalLogArea, "Recording started.", "info");
            startButton.disabled = true;
            stopButton.disabled = false;
            botStateElem.textContent = "Listening...";
        };

        mediaRecorder.onstop = () => {
            logMessage(generalLogArea, "Recording stopped.", "info");
            startButton.disabled = false;
            stopButton.disabled = true;
            botStateElem.textContent = "Idle/Processing"; 
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().then(() => {
                    logMessage(generalLogArea, "AudioContext closed after recording stop.", "info");
                }).catch(e => console.error("Error closing audio context post-stop:", e));
            }
            stream.getTracks().forEach(track => track.stop());
            logMessage(generalLogArea, "Microphone tracks stopped.", "info");
            micPermissionElem.textContent = 'Granted (Not actively using)';
        };
        
        mediaRecorder.onerror = (event) => {
            let errorName = event.error && event.error.name ? event.error.name : "UnknownError";
            let errorMessage = event.error && event.error.message ? event.error.message : "No specific message";
            logMessage(generalLogArea, `MediaRecorder error: ${errorName} - ${errorMessage}`, "error");
             if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            } else { 
                startButton.disabled = false;
                stopButton.disabled = true;
                botStateElem.textContent = "Error";
            }
        };
        mediaRecorder.start(330);
    }

    startButton.addEventListener('click', async () => {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            logMessage(generalLogArea, "WebSocket not connected. Please connect first.", "error");
            return;
        }
        if (mediaRecorder && mediaRecorder.state === "recording") {
            logMessage(generalLogArea, "Recording is already in progress.", "warning");
            return;
        }
        startButton.disabled = true;
        stopButton.disabled = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, /* echoCancellation: true */ },
                video: false
            });
            micPermissionElem.textContent = 'Granted';
            micPermissionElem.style.color = 'green';
            logMessage(generalLogArea, "Microphone access granted.", "info");
            await startAudioProcessing(stream);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            micPermissionElem.textContent = `Denied/Error: ${err.name}`;
            micPermissionElem.style.color = 'red';
            logMessage(generalLogArea, `Error accessing microphone: ${err.name} - ${err.message}`, "error");
            startButton.disabled = false;
        }
    });

    stopButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            logMessage(generalLogArea, "Stop button clicked. Stopping recording...", "info");
            mediaRecorder.stop();
        } else {
            logMessage(generalLogArea, "Not currently recording.", "warning");
        }
    });
});