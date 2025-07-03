# detect.py
from ultralytics import YOLO

# Load YOLOv8 model (nano version for speed)
model_yolo = YOLO('yolov8n.pt')

def detect_objects(image_path):
    results = model_yolo.predict(image_path)
    boxes = results[0].boxes.xyxy.cpu().numpy()
    return boxes
