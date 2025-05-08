import os
import boto3
from dotenv import load_dotenv

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION_NAME = os.getenv("AWS_REGION_NAME")

class TTSService:
    def __init__(self):
        self.polly_client = boto3.client(
            'polly',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION_NAME
        )
        print("Amazon Polly client initialized.")

    async def synthesize_speech(self, text: str):
        if not text:
            return None
        try:
            print(f"Synthesizing speech for: {text}")
            response = self.polly_client.synthesize_speech(
                VoiceId='Joanna',  # Choose a voice
                OutputFormat='mp3',
                Text=text,
                Engine='standard' # or 'standard'
            )
            audio_stream = response.get('AudioStream')
            if audio_stream:
                return audio_stream.read() # Returns bytes
            return None
        except Exception as e:
            print(f"Error synthesizing speech with Polly: {e}")
            return None