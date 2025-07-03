# app.py

import streamlit as st
from detect import detect_objects, save_results

st.set_page_config(page_title="Bias Image Analyzer", layout="centered")

st.title("📸 Bias Image Analyzer")

uploaded_file = st.file_uploader("Upload an image to analyze:", type=['jpg', 'png', 'jpeg'])

if uploaded_file is not None:
    # Save uploaded file
    with open("input.jpg", "wb") as f:
        f.write(uploaded_file.read())

    st.image("input.jpg", caption="Uploaded Image", use_column_width=True)

    # Run detection
    boxes = detect_objects("input.jpg")
    st.write(f"✅ Detected Boxes: {boxes}")

    if boxes:
        save_results("input.jpg", boxes, "output.jpg")
        st.image("output.jpg", caption="Detected Objects", use_column_width=True)
    else:
        st.warning("No objects detected!")
