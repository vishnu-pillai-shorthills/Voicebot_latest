import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os
from dotenv import load_dotenv

from .state_machine import VoiceBotState
from .services.deepgram_service import DeepgramService
from .services.llm_service import LLMService
from .services.tts_service import TTSService
from datetime import datetime


load_dotenv()

app = FastAPI()

# Mount static files for the frontend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "..", "frontend") # Adjust path if needed
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


from .types import Event, EventType
import uuid

# --- In-memory session management (for simplicity) ---
class SessionManager:
    def __init__(self, client_websocket: WebSocket):
        self.current_state: VoiceBotState = VoiceBotState.IDLE
        self.deepgram_service: DeepgramService | None = None
        self.llm_service: LLMService = LLMService()
        self.tts_service: TTSService = TTSService()
        self.client_websocket = client_websocket
    
    async def respond(self, data: dict, response_id: str):
        print(data, "data")
        print(self.client_websocket, "client_websocket")
        if self.client_websocket:
            async for item in self._call_llm(message=data["transcript"], response_id=response_id):
                print(item, "item")
                await self.client_websocket.send_json({
                    "type": "llm_response",
                    "text": item,
                    "response_id": response_id
                })
                if item:
                    if self.current_state != VoiceBotState.RESPONDING:
                        await self.client_websocket.send_json({
                            "type": "halt",
                            "text": None,
                            "response_id": response_id
                        })
                    audio_bytes = await self.tts_service.synthesize_speech(item)
                    if audio_bytes:
                        await self.client_websocket.send_json({
                            "type": "audio_response",
                            "audio_format": "mp3",
                            "data": base64.b64encode(audio_bytes).decode('utf-8'),
                            "response_id": response_id
                        })
            self.current_state = VoiceBotState.IDLE
    
    async def respond_user_message_interpretation(self, data: dict, response_id: str):
        if data.get("is_final"):
            json = {
                "type": "transcript",
                "is_final": data["is_final"],
                "text": data["transcript"],
                "timestamp": datetime.now().strftime("%d-%m-%Y %H:%M:%S"),
                "response_id": response_id
            }
            print(json, "json")
            await self.client_websocket.send_json(json)
            
            
    async def handle_event(self, event: Event):        
        if event.type == EventType.INTERRUPTION_STARTED:
            self.current_state = VoiceBotState.LISTENING
        elif self.current_state == VoiceBotState.LISTENING and event.type == EventType.INTERRUPTION_ENDED:
            response_id = str(uuid.uuid4())
            self.current_state = VoiceBotState.RESPONDING
            await self.respond_user_message_interpretation(event.data, response_id)
            await self.respond(event.data, response_id)
        elif self.current_state == VoiceBotState.RESPONDING and event.type == EventType.RESPONSE_COMPLETED:
            self.current_state = VoiceBotState.IDLE

    async def set_state(self, new_state: VoiceBotState, data: str | None = None):
        self.current_state = new_state

    def get_current_bot_state(self): # Add this method
        return self.current_state

    async def _call_llm(self, message, response_id):
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": message}
        ]
        curr_str = str()
        generator = self.llm_service.get_response_stream(messages)
        async for item in generator:
            if self.current_state != VoiceBotState.RESPONDING:
                print("HALTING")
                await generator.aclose()
                await self.client_websocket.send_json({
                    "type": "halt",
                    "text": None,
                    "response_id": response_id
                })
                return
            else:
                curr_str += item
                if any(char in curr_str for char in [".", "!", "?"]):
                    resp = curr_str
                    curr_str = str()
                    yield resp


    # async def handle_llm_and_tts(self, text_to_process: str):
    #     print(f"Processing for LLM: {text_to_process}")
    #     for item in self.llm_service.get_response_stream()
        
    #     if self.client_websocket:
    #         await self.client_websocket.send_json({
    #             "type": "llm_response",
    #             "text": llm_response
    #         })

    #     if llm_response:
    #         audio_bytes = await self.tts_service.synthesize_speech(llm_response)
    #         if audio_bytes and self.client_websocket:
    #             # Send audio as base64 encoded string
    #             audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    #             await self.client_websocket.send_json({
    #                 "type": "audio_response",
    #                 "audio_format": "mp3", # Let client know
    #                 "data": audio_base64
    #             })
        
    #     # Event: Response completed
    #     await self.set_state(VoiceBotState.IDLE, "response_completed")


 # Single global session for this example

# @app.on_event("startup")
# async def startup_event():
#     # You can initialize models or connections here if needed globally
#     # For instance, pre-loading LLM model if Ollama supports it or warming up Polly.
#     print("Voice Bot API starting up...")
#     # Check if Ollama is running (simple check)
#     try:
#         await session.llm_service.client.list() # any simple command
#         print("Ollama connection successful.")
#     except Exception as e:
#         print(f"Could not connect to Ollama on startup: {e}. Please ensure Ollama is running.")
#         # You might want to prevent startup or have a degraded mode
    
#     # Check AWS Polly credentials (simple check)
#     try:
#         session.tts_service.polly_client.describe_voices(LanguageCode="en-US")
#         print("AWS Polly connection successful.")
#     except Exception as e:
#         print(f"Could not connect to AWS Polly on startup: {e}. Check credentials and region.")

# @app.on_event("startup")
# async def startup_event():
#     print("Voice Bot API starting up...")
 
#     # Check Azure OpenAI connection
#     try:
#         llm = LLMService()
#         # Simple test call to verify Azure OpenAI connectivity
#         test_messages = [{"role": "user", "content": "Hello"}]
#         async for _ in llm.get_response_stream(test_messages):
#             print("Azure OpenAI connection successful.")
#             break  # Only check for the first streamed response
#     except Exception as e:
#         print(f"Could not connect to Azure OpenAI on startup: {e}. Please check your credentials and endpoint.")
#         # Optionally, halt startup or run in degraded mode
 
#     # Check AWS Polly credentials (simple check)
#     try:
#         tts = TTSService()
#         tts.polly_client.describe_voices(LanguageCode="en-US")
#         print("AWS Polly connection successful.")
#     except Exception as e:
#         print(f"Could not connect to AWS Polly on startup: {e}. Check credentials and region.")
 
@app.on_event("startup")
async def startup_event():
    print("Voice Bot API starting up...")
 
    # Check Azure OpenAI connection
    try:
        llm = LLMService()
        # Simple test call to verify Azure OpenAI connectivity
        test_messages = [{"role": "user", "content": "Hello"}]
        async for _ in llm.get_response_stream(test_messages):
            print("Azure OpenAI connection successful.")
            break  # Only check for the first streamed response
    except Exception as e:
        print(f"Could not connect to Azure OpenAI on startup: {e}. Please check your credentials and endpoint.")
        # Optionally, halt startup or run in degraded mode
 
    # Check AWS Polly credentials (simple check)
    try:
        tts = TTSService()
        tts.polly_client.describe_voices(LanguageCode="en-US")
        print("AWS Polly connection successful.")
    except Exception as e:
        print(f"Could not connect to AWS Polly on startup: {e}. Check credentials and region.")
 

@app.get("/", response_class=HTMLResponse)
async def get_root():
    # Serve the frontend HTML
    html_file_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(html_file_path):
        with open(html_file_path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Frontend not found</h1>")


async def websocket_message_sender(websocket: WebSocket, message: dict):
    """Helper to send messages to client websocket."""
    await websocket.send_json(message)

@app.websocket("/ws/voice")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session = SessionManager(client_websocket=websocket)
    
    # Initialize Deepgram service for this connection
    session.deepgram_service = DeepgramService(
        session_manager=session
    )
    session.deepgram_service.set_state_setter(session.set_state)

    try:
        # Initial state update to client
        await session.set_state(VoiceBotState.IDLE)
        
        # Attempt to connect to Deepgram
        if not await session.deepgram_service.connect():
            await websocket.send_json({"type": "error", "message": "Could not connect to STT service."})
            # Keep WebSocket open but STT won't work
        else:
            await websocket.send_json({"type": "info", "message": "Connected to STT. Ready to listen."})


        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                audio_chunk = data["bytes"]
                # print(f"Received audio chunk of size: {len(audio_chunk)}")
                if session.deepgram_service and session.deepgram_service.dg_connection:
                    # Event: Deepgram powered -> transcript not null + is_final = False (interruption_started)
                    # This is implicitly handled by Deepgram SDK callbacks now which will set state
                    if session.current_state == VoiceBotState.IDLE:
                        await session.set_state(VoiceBotState.LISTENING) # Explicitly move to listening on first audio

                    await session.deepgram_service.send_audio(audio_chunk)
                else:
                    await websocket.send_json({"type": "warning", "message": "STT service not connected. Audio not processed."})

            elif "text" in data: # For control messages if any, or if client sends text
                message = data["text"]
                print(f"Received text message: {message}")
                # Potentially handle text commands from client, e.g., "stop", "reset"
                if message == "REQUEST_IDLE_STATE": # Example control message
                    await session.set_state(VoiceBotState.IDLE)
                    await websocket.send_json({"type": "info", "message": "Bot set to IDLE by request."})


    except WebSocketDisconnect:
        print("Client disconnected")
        if session.deepgram_service:
            await session.deepgram_service.close_connection()
        session.client_websocket = None
        # Reset state or session if needed
        session.current_state = VoiceBotState.IDLE 
    except Exception as e:
        print(f"WebSocket Error: {e}")
        if session.client_websocket: # Check if still connected
            try:
                await session.client_websocket.send_json({
                    "type": "error",
                    "message": f"An internal server error occurred: {str(e)}"
                })
            except Exception as send_e:
                 print(f"Error sending error to client: {send_e}")
    finally:
        if session.deepgram_service:
            await session.deepgram_service.close_connection()
        session.client_websocket = None # Clear websocket on disconnect/error
        print("WebSocket connection closed.")

# To run: uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000