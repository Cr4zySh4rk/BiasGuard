import streamlit as st
from clip_pipeline import analyze_image
from audience_pipeline import analyze_audience
from bias_analyzer import compare_bias

st.title("📸 BiasGuard — Image Bias vs Audience Checker")

uploaded_image = st.file_uploader("Upload an Ad Image", type=["png", "jpg", "jpeg"])
uploaded_csv = st.file_uploader("Upload Audience CSV", type=["csv"])

if uploaded_image and uploaded_csv:
    with st.spinner("Analyzing..."):
        image_result = analyze_image(uploaded_image)
        st.subheader("Image Analysis:")
        st.json(image_result)

        audience_result = analyze_audience(uploaded_csv)
        st.subheader("Audience CSV:")
        st.json(audience_result)

        bias_flag, reasons = compare_bias(image_result, audience_result)

        if bias_flag:
            st.error(f"⚠️ Bias Detected: {' | '.join(reasons)}")
        else:
            st.success("✅ No significant bias detected.")
