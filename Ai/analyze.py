# analyze.py
import requests
import json

def analyze_bias(captions, model_name="llama3.2:3b"):
    prompt = f"""
    Here are the object-level captions extracted from the image:
    {json.dumps(captions, indent=2)}

    1) Describe the overall scene.
    2) Are there signs of bias in gender, age, race, religion, or other factors?
    3) Suggest ways to make the image more inclusive if needed.
    """

    payload = {
        "model": model_name,
        "prompt": prompt
    }

    response = requests.post(
        "http://localhost:11434/api/generate",
        headers={"Content-Type": "application/json"},
        json=payload
    )

    return response.text
