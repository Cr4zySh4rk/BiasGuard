from detect import detect_objects
from caption import generate_captions
from analyze import analyze_bias
from save_results import save_results

IMAGE_PATH = "image 2.jpg"

boxes = detect_objects(IMAGE_PATH)
print("✅ Detected boxes:", boxes)

captions = generate_captions(IMAGE_PATH, boxes)
print("✅ Generated captions:", captions)

analysis = analyze_bias(captions)
print("✅ Ollama output:", analysis)

save_results(captions, analysis)
