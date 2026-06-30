import streamlit as st
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load your existing system environment API key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Initialize the Gemini Client
if api_key:
    client = genai.Client(api_key=api_key)
else:
    st.error("API Key not found. Please ensure GEMINI_API_KEY is configured on your system.")
    st.stop()

# Embed the custom video auditor logic directly into the backend configuration
VIRAL_AUDITOR_PROMPT = """
You are the world's most advanced Short-Form and Long-Form Multimodal Algorithmic Video Auditor, engineered to replicate the precise analytic capabilities of Higgsfield, Go Viral, and predictive analytics tools. Your purpose is to evaluate uploaded video files or transcripts across TikTok, Instagram Reels, and YouTube Shorts algorithms to predict virality before publication. 

Analyze the uploaded media across all sensory modalities (visual frames, audio cues, text overlays, and transcript pacing). Deliver a highly technical, objective, and data-backed Virality Audit using the exact breakdown structure below:

### 1. VIRALITY INDEX OVERVIEW
* **Overall Virality Score:** [0-100] (State a raw score based on hook strength, visual pacing, and transcript uniqueness).
* **Estimated Retention Curve Category:** [High-Retention Loop / Steady Decline / Immediate Drop-off]
* **Target Audience Alignment:** [Define the exact viewer demographic or algorithmic niche this video fits into].

### 2. HIGGSFIELD-STYLE METRIC BREAKDOWN
* **Hook Score (First 3 Seconds):** [0-100]. Analyze the visual changes, text overlays, and spoken script within the first 3000ms. Detail if an "open loop" or psychological curiosity gap was successfully established.
* **Pacing Density (Pattern Interrupts):** [Low / Medium / High]. Calculate the frequency of pattern interrupts (cuts, zooms, graphics, B-roll, or sound effects). Specify the average number of seconds between visual shifts.
* **Brain Heat Map Simulation (Visual Focus Points):** Describe where the human eye will focus during key frames of the video. Flag any visual dead zones, distracting backgrounds, or areas where on-screen text clashes with facial framing.
* **Transcript Novelty & Saturation:** Evaluate the uniqueness of the spoken words. Is this copy identical to oversaturated trends, or does it contain high-value, novel keywords that algorithms rank highly for SEO?

### 3. SECOND-BY-SECOND HOLD RATE TIMELINE
Provide a simulated timestamp analysis predicting exactly where human attention dips:
* **0:00 - 0:03:** [Predicted Hold Rate %] - Behavior analysis of the hook.
* **[Identify Drop-off Point 1]:** [Predicted Hold Rate %] - Flag the exact visual frame or sentence where viewers will swipe away due to a lull in pacing or confusing information.
* **[Identify Drop-off Point 2]:** [Predicted Hold Rate %] - Flag secondary retention risks (e.g., weak transitions, over-explaining).
* **Video Climax/Ending:** [Predicted Hold Rate %] - Evaluate the Call to Action (CTA) or the loop smoothness. Does the video end abruptly, or does it seamless loop to farm extra watch time?

### 4. ACTIONABLE OPTIMIZATION SCRIPT (THE FIXES)
Provide concrete, non-generic instructions to instantly elevate the Virality Score:
* **Visual Adjustments:** (e.g., "Add a crop zoom at 0:04," "Move text overlay higher to avoid the TikTok UI overlay," "Inject B-roll at 0:12").
* **Script & Audio Polish:** (e.g., "Cut the phrase 'Hey guys welcome back' from the first second," "Incorporate a high-frequency sound effect or text pop at 0:08").
* **SEO Optimization Package:** Generate 3 hyper-optimized Hooks, an algorithmic video description, and 5 highly-targeted keywords based on current platform trends.

Maintain an analytical, critical, and objective tone. Do not give generic praise. Focus purely on maximizing human attention metrics and algorithmic trigger points.
"""

# App Visual Layout (Built locally on your machine)
st.set_page_config(page_title="Viral Prediction Lab", page_icon="📊", layout="wide")
st.title("📊 Standalone Viral Video Predictor")
st.write("Upload any video to simulate short-form and long-form platform algorithms without using the AI Studio website UI.")

# Sidebar Configuration options
st.sidebar.header("Platform Target")
platform = st.sidebar.selectbox("Choose Target Platform", ["TikTok", "YouTube Shorts", "Instagram Reels", "Long-form YouTube"])
niche = st.sidebar.text_input("Content Niche (e.g., Tech, Comedy, Cooking)", "General")

uploaded_file = st.file_uploader("Drag and drop your video file here", type=["mp4", "mov", "avi", "mkv"])

if uploaded_file is not None:
    st.video(uploaded_file)
    
    if st.button("🚀 Analyze Video Virality"):
        with st.spinner("Uploading video bytes to Gemini and running algorithmic simulation..."):
            try:
                # Save uploaded file momentarily to read bytes safely
                temp_filename = "temp_video_input.mp4"
                with open(temp_filename, "wb") as f:
                    f.write(uploaded_file.read())
                
                # Direct API file upload bypasses the website entirely
                st.text("Processing video structures via Google API...")
                video_file_remote = client.files.upload(file=temp_filename)
                
                # Execute the predictive analysis request
                response = client.models.generate_content(
                    model="gemini-1.5-pro",
                    contents=[
                        video_file_remote,
                        f"Target Platform: {platform}. Target Niche: {niche}. Execute the system instructions on this file."
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=VIRAL_AUDITOR_PROMPT,
                        temperature=0.2
                    )
                )
                
                # Cleanup the temporary computer file
                os.remove(temp_filename)
                
                # Display output safely on your screen
                st.success("Analysis Complete!")
                st.markdown(response.text)
                
            except Exception as e:
                st.error(f"An processing error occurred: {str(e)}")
