# caption.py

import requests
import base64

def generate_caption(image_path):
    """
    Example: using local Ollama LLaMA3.2 or phi4 to caption image
    But Ollama does NOT do direct image input — so we use a simple workaround:
    - convert image to base64
    - prompt the local LLM with a description prompt
    """

    # Convert image to base64 string (optional, or describe filename)
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    encoded = base64.b64encode(img_bytes).decode('utf-8')

    prompt = f"""You are an image captioning assistant.
    Here is an image in base64:
    {encoded[:100]}... (truncated)

    Based on this, write a detailed caption describing everything you can see."""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": "llama3.2:3b", "prompt": prompt},
        stream=False
    )

    if response.ok:
        result = response.text
        return result
    else:
        return "❌ Captioning failed: check Ollama is running."
