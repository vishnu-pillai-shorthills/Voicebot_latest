import os
import ollama
from dotenv import load_dotenv
import asyncio

load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL")

print(f"DEBUG: OLLAMA_HOST = {OLLAMA_HOST}")
print(f"DEBUG: OLLAMA_MODEL = {OLLAMA_MODEL}")

class LLMService:
    def __init__(self):
        if not OLLAMA_HOST:
            print("Warning: OLLAMA_HOST environment variable not set. Using default 'http://localhost:11434'.")
            self.ollama_host = "http://localhost:11434"
        else:
            self.ollama_host = OLLAMA_HOST

        if not OLLAMA_MODEL:
            print("Warning: OLLAMA_MODEL environment variable not set. Using default 'llama3.1:8b'.") # Or your preferred default
            self.ollama_model_name = "llama3.1:8b" # Or your preferred default
        else:
            self.ollama_model_name = OLLAMA_MODEL

        self.client = ollama.AsyncClient(host=self.ollama_host)
        print(f"Ollama client initialized for host: {self.ollama_host}, model: {self.ollama_model_name}")

    async def get_response_stream(self, messages: list[dict[str, str]]):
        print(messages, "messages - LLM Client")
        try:
            async for part in await self.client.chat(
                model=self.ollama_model_name,
                messages=messages,
                stream=True
            ):
                if 'message' in part and 'content' in part['message']:
                    yield part['message']['content']
        except:
            raise Exception("Error getting streaming response from Ollama")

async def main():
    llm_service = LLMService()
    messages = [
        {"role": "user", "content": "Hello, how are you?"}
    ]
    async for item in llm_service.get_response_stream(messages):
        print(item)

if __name__ == "__main__":
    asyncio.run(main())



# from langchain_openai import AzureChatOpenAI
# import os
# import json

# class LLMService:
#     def __init__(self):
#         # Initialize LLM client
#         self.llm = AzureChatOpenAI(
#             deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
#             api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
#             api_key=os.getenv("AZURE_OPENAI_API_KEY"),
#             azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
#             streaming=True,  # Set to True for streaming responses
#         )

#     async def get_response_stream(self, messages):
#         """
#         Get the response stream for the given messages without the file_path and streaming_callback.
#         The streaming response will be directly handled within this method.
#         """
#         try:
#             # Assuming 'messages' is a list of dicts, with each dict representing a message.
#             conversation_history = []
#             for message in messages:
#                 conversation_history.append({"role": "user", "content": message["text"]})

#             # Streaming response directly from Azure OpenAI
#             async for token in self.llm.agenerate(messages=conversation_history):
#                 # Process each streamed token
#                 print(f"Streamed Token: {token['text']}")

#                 # Here you can process the token as needed, such as sending it back to the client
#                 # For example, you can yield tokens or send them through WebSocket, etc.
#                 yield token["text"]
                
#         except Exception as e:
#             print(f"Error in streaming response: {e}")
#             raise
