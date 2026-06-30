# backend/analyzer.py
import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

class SceneTransition(BaseModel):
    timestamp_seconds: float
    visual_action: str = Field(description="e.g., 'Zoom in', 'Split screen with 3D model', 'Show floating text'")
    audio_pacing: str = Field(description="e.g., 'Fast delivery', 'Dramatic pause'")

class OutlierTemplate(BaseModel):
    hook_duration_seconds: float
    pacing_density: str = Field(description="e.g., 'High-frequency cuts every 2 seconds'")
    timeline_flow: list[SceneTransition]

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def extract_viral_structure(video_file_path):
    """
    Ingests a reference outlier video and forces Gemini to output
    the precise editing timeline, transitions, and pacing density as JSON.
    """
    video_upload = client.files.upload(file=video_file_path)
    
    prompt = """
    Analyze the visual hierarchy and pacing of this high-performing video. 
    Deconstruct the timestamps where text overlays appear, when zoom-ins happen, 
    and how long the initial hook lasts. Do not focus on the words spoken; 
    focus strictly on the editing patterns and structural pacing.
    """
    
    response = client.models.generate_content(
        model='gemini-1.5-pro',
        contents=[video_upload, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OutlierTemplate,
        ),
    )
    return json.loads(response.text)