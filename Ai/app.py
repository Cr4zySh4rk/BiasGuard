from ultralytics import YOLO
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import requests
import json

# ----------------------------
# ✅ 1. Load YOLOv8 for object detection
model_yolo = YOLO('yolov8n.pt')  # nano version for speed

# ✅ 2. Load BLIP for local image captioning
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
blip = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

# ----------------------------
# ✅ 3. Detect & caption objects
def detect_and_caption(image_path):
    image = Image.open(image_path).convert('RGB')
    results = model_yolo.predict(image_path)
    boxes = results[0].boxes.xyxy.cpu().numpy()

    captions = []
    for i, box in enumerate(boxes):
        x1, y1, x2, y2 = map(int, box)
        crop = image.crop((x1, y1, x2, y2))

        inputs = processor(images=crop, return_tensors="pt")
        out = blip.generate(**inputs, max_new_tokens=50)
        caption = processor.decode(out[0], skip_special_tokens=True)

        captions.append({
            "object_id": i+1,
            "box": [x1, y1, x2, y2],
            "caption": caption
        })
    return captions

# ----------------------------
# ✅ 4. Use Ollama locally to reason over captions
def analyze_with_ollama(captions):
    prompt = f"""
    Here are the object-level captions extracted from the image:
    {json.dumps(captions, indent=2)}
    1) Describe the overall scene.
    2) Are there signs of bias in gender, age, race, religion, or other factors?
    3) Suggest ways to make the image more inclusive if needed.
    """

    payload = {
        "model": "llama3.2:3b",
        "prompt": prompt
    }

    response = requests.post(
        "http://localhost:11434/api/generate",
        headers={"Content-Type": "application/json"},
        json=payload
    )

    return response.text

# ----------------------------
# ✅ 5. Main pipeline
if __name__ == "__main__":
    image_path = "image 2.jpg"  # Replace with your image
    all_captions = detect_and_caption(image_path)
    print("📸 Object Captions:\n", json.dumps(all_captions, indent=2))

    summary = analyze_with_ollama(all_captions)
    print("\n🧩 Ollama Bias Analysis:\n", summary)
