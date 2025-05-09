# import os
# import ollama
# from dotenv import load_dotenv
# import asyncio

# load_dotenv()

# OLLAMA_HOST = os.getenv("OLLAMA_HOST")
# OLLAMA_MODEL = os.getenv("OLLAMA_MODEL")

# print(f"DEBUG: OLLAMA_HOST = {OLLAMA_HOST}")
# print(f"DEBUG: OLLAMA_MODEL = {OLLAMA_MODEL}")

# class LLMService:
#     def __init__(self):
#         if not OLLAMA_HOST:
#             print("Warning: OLLAMA_HOST environment variable not set. Using default 'http://localhost:11434'.")
#             self.ollama_host = "http://localhost:11434"
#         else:
#             self.ollama_host = OLLAMA_HOST

#         if not OLLAMA_MODEL:
#             print("Warning: OLLAMA_MODEL environment variable not set. Using default 'llama3.1:8b'.") # Or your preferred default
#             self.ollama_model_name = "llama3.1:8b" # Or your preferred default
#         else:
#             self.ollama_model_name = OLLAMA_MODEL

#         self.client = ollama.AsyncClient(host=self.ollama_host)
#         print(f"Ollama client initialized for host: {self.ollama_host}, model: {self.ollama_model_name}")

#     async def get_response_stream(self, messages: list[dict[str, str]]):
#         print(messages, "messages - LLM Client")
#         try:
#             async for part in await self.client.chat(
#                 model=self.ollama_model_name,
#                 messages=messages,
#                 stream=True
#             ):
#                 if 'message' in part and 'content' in part['message']:
#                     yield part['message']['content']
#         except:
#             raise Exception("Error getting streaming response from Ollama")

# async def main():
#     llm_service = LLMService()
#     messages = [
#         {"role": "user", "content": "Hello, how are you?"}
#     ]
#     async for item in llm_service.get_response_stream(messages):
#         print(item)

# if __name__ == "__main__":
#     asyncio.run(main())





# import os
# import asyncio
# import aiohttp
# from dotenv import load_dotenv
# import json
 
# load_dotenv()
 
# AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
# AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
# AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")  
# AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")

# print(AZURE_OPENAI_API_KEY)
# print(AZURE_OPENAI_ENDPOINT)
# print(AZURE_OPENAI_DEPLOYMENT)
# print(AZURE_OPENAI_API_VERSION) 
 
# class LLMService:
#     def __init__(self):
#         if not AZURE_OPENAI_API_KEY or not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_DEPLOYMENT:
#             raise ValueError("Missing Azure OpenAI configuration in environment variables.")
 
#         self.api_key = AZURE_OPENAI_API_KEY
#         self.endpoint = AZURE_OPENAI_ENDPOINT.rstrip("/")
#         self.deployment = AZURE_OPENAI_DEPLOYMENT
#         self.api_url = f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
 
#     async def get_response_stream(self, messages: list[dict[str, str]]):
#         headers = {
#             "api-key": self.api_key,
#             "Content-Type": "application/json"
#         }
 
#         payload = {
#             "messages": messages,
#             "temperature": 0.7,
#             "stream": True
#         }
 
#         async with aiohttp.ClientSession() as session:
#             async with session.post(self.api_url, headers=headers, json=payload) as resp:
#                 if resp.status != 200:
#                     error_text = await resp.text()
#                     raise Exception(f"Azure OpenAI API call failed: {resp.status}, {error_text}")
 
#                 async for line in resp.content:
#                     if line:
#                         decoded = line.decode("utf-8").strip()
#                         if decoded.startswith("data: "):
#                             content = decoded[6:].strip()
#                             if content == "[DONE]":
#                                 break
#                             try:
#                                 data = json.loads(content)
#                                 delta = data["choices"][0]["delta"]
#                                 if "content" in delta:
#                                     yield delta["content"]
#                             except Exception as e:
#                                 print(f"Streaming parse error: {e}")
 
# async def main():
#     llm_service = LLMService()
#     messages = [
#         {"role": "user", "content": "Hello, how are you?"}
#     ]
#     async for item in llm_service.get_response_stream(messages):
#         print(item, end="", flush=True)
 
# if __name__ == "__main__":
#     asyncio.run(main())

import os
import asyncio
import aiohttp
from dotenv import load_dotenv
import json
 
load_dotenv()
 
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")  
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
 
class LLMService:
    def __init__(self):
        if not AZURE_OPENAI_API_KEY or not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_DEPLOYMENT:
            raise ValueError("Missing Azure OpenAI configuration in environment variables.")
 
        self.api_key = AZURE_OPENAI_API_KEY
        self.endpoint = AZURE_OPENAI_ENDPOINT.rstrip("/")
        self.deployment = AZURE_OPENAI_DEPLOYMENT
        self.api_url = f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
 
    async def get_response_stream(self, messages: list[dict[str, str]]):
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
 
        payload = {
            "messages": messages,
            "temperature": 0.7,
            "stream": True
        }
 
        async with aiohttp.ClientSession() as session:
            async with session.post(self.api_url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"Azure OpenAI API call failed: {resp.status}, {error_text}")
 
                async for line in resp.content:
                    if line:
                        decoded = line.decode("utf-8").strip()
                        if decoded.startswith("data: "):
                            content = decoded[6:].strip()
                            if content == "[DONE]":
                                break
                            try:
                                data = json.loads(content)
                                delta = data["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                            except Exception as e:
                                print(f"Streaming parse error: {e}")
 
async def main():
    llm_service = LLMService()
    messages = [
        {"role": "user", "content": "Hello, how are you?"}
    ]
    async for item in llm_service.get_response_stream(messages):
        print(item, end="", flush=True)
 
if __name__ == "__main__":
    asyncio.run(main())
 