# caption.py
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

# Load BLIP model
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
blip = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

def caption_objects(image_path, boxes):
    image = Image.open(image_path).convert('RGB')
    captions = []

    for i, box in enumerate(boxes):
        x1, y1, x2, y2 = map(int, box)
        crop = image.crop((x1, y1, x2, y2))

        inputs = processor(images=crop, return_tensors="pt")
        out = blip.generate(**inputs, max_new_tokens=50)
        caption = processor.decode(out[0], skip_special_tokens=True)

        captions.append({
            "object_id": i + 1,
            "box": [x1, y1, x2, y2],
            "caption": caption
        })

    return captions
