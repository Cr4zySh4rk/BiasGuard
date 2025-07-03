# detect.py

from ultralytics import YOLO
import cv2

# Load YOLO model once
model = YOLO("yolov8n.pt")  # Make sure this file is in your project folder

def detect_objects(img_path):
    results = model(img_path)
    boxes = results[0].boxes.xyxy.cpu().numpy().tolist()
    return boxes

def save_results(img_path, boxes, output_path):
    img = cv2.imread(img_path)
    for box in boxes:
        x1, y1, x2, y2 = map(int, box)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.imwrite(output_path, img)
