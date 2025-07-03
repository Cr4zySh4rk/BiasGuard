# main.py
from detect import detect_objects
from caption import caption_objects
from analyze import analyze_bias
import json

if __name__ == "__main__":
    image_path = "image 2.jpg"

    # Step 1: Detect
    boxes = detect_objects(image_path)
    print(f"📦 Detected {len(boxes)} objects")

    # Step 2: Caption
    captions = caption_objects(image_path, boxes)
    print("📸 Captions:\n", json.dumps(captions, indent=2))

    # Step 3: Analyze with Ollama
    summary = analyze_bias(captions)
    print("\n🧩 Ollama Bias Summary:\n", summary)
    
print("✅ Detected boxes:", boxes)
print("✅ Generated captions:", captions)
print("✅ Ollama output:", summary)

