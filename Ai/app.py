import streamlit as st
import easyocr
import numpy as np
from PIL import Image
import io # To handle uploaded file bytes
import re # For regex in PII detection
import pandas as pd # For audience segmentation simulation
from transformers import pipeline # For image captioning

# --- Page Configuration ---
# THIS MUST BE THE VERY FIRST STREAMLIT COMMAND IN YOUR SCRIPT
st.set_page_config(
    page_title="FairGuard: Ethical AI Guardrail for Marketing Automation",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- EasyOCR Reader Initialization ---
@st.cache_resource
def get_easyocr_reader():
    """
    Initializes and returns an EasyOCR reader.
    Models are downloaded on the first run.
    """
    return easyocr.Reader(['en'], gpu=False) # Set gpu=True if you have a compatible GPU and drivers

# Initialize the OCR reader globally
reader = get_easyocr_reader()

# --- Image Captioning Pipeline Initialization ---
@st.cache_resource
def get_image_captioning_pipeline():
    """
    Initializes and returns a Hugging Face image-to-text pipeline (BLIP model).
    This model generates a descriptive caption for the image.
    """
    # Using Salesforce/blip-image-captioning-base for general image captioning.
    # We'll use default generation parameters as custom ones caused issues.
    return pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")

# Initialize the image captioning pipeline globally
image_captioner = get_image_captioning_pipeline()


# --- Utility Function for OCR ---
def extract_text_from_image(image_bytes):
    """
    Extracts text from an image using EasyOCR.
    Args:
        image_bytes: Bytes of the image file (e.g., from st.file_uploader).
    Returns:
        A string containing all extracted text, or an empty string.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        results = reader.readtext(image_np, detail=0) 
        return " ".join(results)
    except Exception as e:
        st.error(f"Error extracting text from image: {e}")
        return ""

# --- New: Function for Visual Context Analysis (using Image Captioning) ---
def analyze_image_for_visual_context(image_bytes, extracted_text=""):
    """
    Generates a descriptive caption for the image and analyzes it for potential biases.
    Also attempts to flag sensitive visual contexts based on caption content and OCR text.
    """
    visual_flags = []
    visual_bias_score = 0
    generated_caption = ""

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Generate caption using the BLIP model.
        # We can't use max_new_tokens or num_beams directly in the pipeline call.
        # For more detailed captions, one would typically use a more advanced VLM
        # or fine-tune this model, which is beyond hackathon scope.
        caption_results = image_captioner(image) 
        if caption_results and caption_results[0] and 'generated_text' in caption_results[0]:
            generated_caption = caption_results[0]['generated_text']
            st.write(f"**Generated Image Caption:** `{generated_caption}`")
            
            # Analyze the generated caption for bias using the text bias detector
            caption_bias_analysis = analyze_text_for_bias(generated_caption)
            visual_flags.extend(caption_bias_analysis['bias_flags'])
            visual_bias_score += caption_bias_analysis['bias_score']

            # --- Advanced (Rule-based) Visual Bias Detection based on Caption and OCR text ---
            caption_lower = generated_caption.lower()
            text_lower = extracted_text.lower() # Use OCR text for contextual flagging

            # Heuristic for detecting contrasting individuals in a "struggle/freedom" narrative (from previous example)
            # This rule is now more specific to the content of the caption.
            if ('man' in caption_lower and 'suit' in caption_lower) and \
               ('man' in caption_lower or 'person' in caption_lower) and \
               ('struggling' in text_lower or 'money' in text_lower or 'financial freedom' in text_lower):
                visual_flags.append("Sensitive Visual Context: Potential racial/socio-economic stereotype implied by contrasting individuals in a financial narrative. **Requires Human Review.**")
                visual_bias_score += 5 
                
            # Heuristic: Detecting "Benevolent Sexism/Vulnerability" in visuals (from previous example)
            # This rule is now more specific to the content of the caption.
            if ('woman' in caption_lower or 'female' in caption_lower) and \
               ('car' in caption_lower or 'vehicle' in caption_lower) and \
               ('safety' in text_lower or 'safe' in text_lower or 'protection' in text_lower or 'confidence starts with feeling safe' in text_lower) and \
               ('especially for women' in text_lower or 'for women' in text_lower): 
                visual_flags.append("Sensitive Visual Context: Potential benevolent sexism/vulnerability stereotype (e.g., implying women need special safety). **Requires Human Review.**")
                visual_bias_score += 4 

            # NEW HEURISTIC: Detecting potential ableism/exclusion in active contexts (more specific to caption)
            # This is a general heuristic since direct "wheelchair" detection is hard for the model.
            # It flags if a person is mentioned in the caption, and the OCR text is about an active sport,
            # implying a potential for exclusion if the visual context is not inclusive.
            active_sport_keywords = ['skateboard', 'skateboarding', 'sport', 'active', 'run', 'jump', 'play']
            # Check if caption implies a seated person or mentions a wheelchair (if the model does)
            if ('person' in caption_lower or 'man' in caption_lower or 'people' in caption_lower) and \
               any(keyword in text_lower for keyword in active_sport_keywords) and \
               ('sitting' in caption_lower or 'seated' in caption_lower or 'wheelchair' in caption_lower or 'bench' in caption_lower): # Added 'bench' as a common misinterpretation for wheelchair
                visual_flags.append("Sensitive Visual Context: Potential ableism/exclusion in active sport context (e.g., person in wheelchair with active sport ad). **Requires Human Review.**")
                visual_bias_score += 4 # High penalty

        else:
            st.warning("Could not generate a descriptive caption for the image.")

    except Exception as e:
        st.error(f"Error analyzing image visual context: {e}")
        visual_flags.append("Error during visual analysis.")

    return {
        "generated_caption": generated_caption,
        "visual_flags": visual_flags,
        "is_visually_biased": len(visual_flags) > 0,
        "visual_bias_score": visual_bias_score
    }


# --- Enhanced Bias Detection and Security Guardrails ---

def analyze_text_for_bias(text):
    """
    Analyzes text for potential gender, racial, age, or other biases.
    Uses simple keyword matching and stereotypical context detection.
    Returns flags and a bias score.
    """
    bias_flags = []
    suggestions = []
    bias_score = 0 # Initialize bias score

    text_lower = text.lower()

    # Gender Bias (direct language) - Score: +1 for each
    gender_keywords_male = ['businessman', 'he', 'his', 'him', 'gentleman']
    gender_keywords_female = ['businesswoman', 'she', 'her', 'lady']
    
    if any(keyword in text_lower for keyword in gender_keywords_male) and \
       not any(keyword in text_lower for keyword in gender_keywords_female) and \
       not any(k in text_lower for k in ['person', 'individual', 'they', 'their', 'everyone']):
        bias_flags.append("Potential gender bias (male-centric language).")
        suggestions.append("Consider using gender-neutral terms like 'business professional', 'they/their', 'individuals'.")
        bias_score += 1
    elif any(keyword in text_lower for keyword in gender_keywords_female) and \
         not any(keyword in text_lower for keyword in gender_keywords_male) and \
         not any(k in text_lower for k in ['person', 'individual', 'they', 'their', 'everyone']):
        bias_flags.append("Potential gender bias (female-centric language).")
        suggestions.append("Consider using gender-neutral terms like 'business professional', 'they/their', 'individuals'.")
        bias_score += 1

    # Age Bias (simple keywords) - Score: +1 for each
    age_keywords_old = ['retiree', 'elderly', 'senior citizen', 'golden years', 'pensioner']
    age_keywords_young = ['youth', 'millennial', 'gen z', 'youngster']

    if any(keyword in text_lower for keyword in age_keywords_old) and \
       not any(keyword in text_lower for keyword in ['all ages', 'everyone', 'diverse', 'inclusive']):
        bias_flags.append("Potential age bias (targeting only older demographic, potentially excluding others).")
        suggestions.append("Ensure target audience is clearly defined. Use inclusive language if the product is for all ages.")
        bias_score += 1
    if any(keyword in text_lower for keyword in age_keywords_young) and \
       not any(keyword in text_lower for k in ['all ages', 'everyone', 'diverse', 'inclusive']):
        bias_flags.append("Potential age bias (targeting only younger demographic, potentially excluding others).")
        suggestions.append("Ensure target audience is clearly defined. Use inclusive language if the product is for all ages.")
        bias_score += 1

    # Stereotypical Role Bias (Textual) - Score: +2 for each strong match
    gender_best_phrases = [
        'women know best', 'men know best', 'ladies first', 'gentlemen only',
        'woman\'s touch', 'man of the house', 'for her', 'for him'
    ]

    female_stereotypical_products_roles = ['scrub', 'clean', 'kitchen', 'home', 'dishes', 'laundry', 'cooking', 'beauty', 'makeup', 'fashion', 'jewelry', 'nurture', 'family', 'diet', 'weight loss']
    male_stereotypical_products_roles = ['tools', 'cars', 'garage', 'finance', 'business', 'power', 'strength', 'sports', 'tech', 'gadgets', 'gaming', 'investing']

    # Check for female stereotypical bias
    if any(phrase in text_lower for phrase in gender_best_phrases) and \
       any(prod_role in text_lower for prod_role in female_stereotypical_products_roles):
        bias_flags.append("Potential stereotypical gender role bias (e.g., linking women to domestic/beauty roles).")
        suggestions.append("Avoid reinforcing traditional gender stereotypes. Focus on product benefits for all users, regardless of gender. Use gender-neutral phrasing and imagery.")
        bias_score += 2

    # Check for male stereotypical bias
    if any(phrase in text_lower for phrase in gender_best_phrases) and \
       any(prod_role in text_lower for prod_role in male_stereotypical_products_roles):
        bias_flags.append("Potential stereotypical gender role bias (e.g., linking men to power/tech/sports roles).")
        suggestions.append("Avoid reinforcing traditional gender stereotypes. Focus on product benefits for all users, regardless of gender. Use gender-neutral phrasing and imagery.")
        bias_score += 2
    
    # Benevolent Sexism / Vulnerability Bias (Textual) - Score: +4 for strong match
    if ('especially for women' in text_lower or 'for women' in text_lower) and \
       ('safety' in text_lower or 'safe' in text_lower or 'protection' in text_lower or 'confidence starts with feeling safe' in text_lower):
        bias_flags.append("Potential benevolent sexism: Implies women need special safety/protection or derive confidence from it. **Requires Human Review.**")
        suggestions.append("Ensure safety messages are universal or focus on features, not gender-specific vulnerability. Confidence should stem from internal agency.")
        bias_score += 4 

    # Racial/Religious/Other Sensitive Bias (Conceptual for text-only keywords)
    problematic_terms = ['primitive', 'backward', 'exotic', 'foreigner', 'ghetto', 'terrorist', 'struggling', 'poverty', 'wealth', 'freedom', 'disabled', 'handicap', 'wheelchair'] 
    if any(term in text_lower for term in problematic_terms):
        bias_flags.append("Potential use of problematic or stereotypical language related to race/origin/religion/socio-economic status/disability. Requires urgent human review.")
        suggestions.append("Review language for any unintended racial, cultural, religious, socio-economic, or disability-related stereotypes/insensitivities.")
        bias_score += 3 # Higher score for sensitive categories

    return {
        "is_biased": len(bias_flags) > 0,
        "bias_flags": bias_flags,
        "suggestions": suggestions,
        "bias_score": bias_score
    }

def check_for_pii(text):
    """
    Checks text for common patterns of Personal Identifiable Information (PII).
    """
    pii_found = []

    # Email addresses
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    if emails:
        pii_found.extend([f"Email: {e}" for e in emails])

    # Phone numbers (simple patterns: XXX-XXX-XXXX, (XXX) XXX-XXXX, XXX XXX XXXX)
    phone_numbers = re.findall(r'\b(?:\d{3}[-.\s]??\d{3}[-.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-.\s]??\d{4})\b', text)
    if phone_numbers:
        pii_found.extend([f"Phone: {p}" for p in phone_numbers])

    # Basic credit card pattern (highly simplified and not robust for real security)
    # This is just for demo purposes in a hackathon, real CC detection is complex.
    cc_numbers = re.findall(r'\b(?:\d{4}[- ]){3}\d{4}\b', text)
    if cc_numbers:
        pii_found.extend([f"Credit Card (potential): {c}" for c in cc_numbers])

    return {
        "has_pii": len(pii_found) > 0,
        "detected_items": pii_found
    }

def check_for_harmful_content(text):
    """
    Checks text for overtly harmful, offensive, or manipulative content.
    """
    harmful_terms = [
        'kill', 'hate', 'destroy', 'bomb', 'attack', 'violence', 'exploit',
        'manipulate', 'deceive', 'fraud', 'illegal', 'scam', 'cheat', 'offensive',
        'slur', 'discriminat', 'sexist', 'racist' # Added more
    ]
    detected_harm = [term for term in harmful_terms if term in text.lower()]

    return {
        "has_harmful_content": len(detected_harm) > 0,
        "detected_items": detected_harm
    }

def simulate_audience_data(num_samples=1000):
    """
    Simulates an audience dataset with intentional biases.
    """
    data = {
        'customer_id': range(num_samples),
        'age_group': np.random.choice(['18-25', '26-40', '41-60', '60+'], num_samples, p=[0.25, 0.35, 0.25, 0.15]),
        'gender': np.random.choice(['Male', 'Female', 'Non-binary'], num_samples, p=[0.48, 0.48, 0.04]),
        'income_level': np.random.choice(['Low', 'Medium', 'High'], num_samples, p=[0.3, 0.5, 0.2]),
        'ad_targeted': False # Default
    }
    df = pd.DataFrame(data)

    # Introduce bias:
    # Bias 1: Less likely to target '60+' age group
    df.loc[df['age_group'] == '60+', 'ad_targeted'] = np.random.rand(len(df[df['age_group'] == '60+'])) < 0.3 # 30% target rate
    # Bias 2: Slightly less likely to target 'Non-binary' gender
    df.loc[df['gender'] == 'Non-binary', 'ad_targeted'] = np.random.rand(len(df[df['gender'] == 'Non-binary'])) < 0.6 # 60% target rate
    # General targeting for others
    df.loc[df['ad_targeted'] == False, 'ad_targeted'] = np.random.rand(len(df[df['ad_targeted'] == False])) < 0.75 # 75% target rate for others

    return df

def analyze_audience_bias(df, protected_attribute, target_column='ad_targeted'):
    """
    Analyzes audience data for bias using disparate impact ratio.
    Returns results including a bias score for the audience segmentation.
    """
    results = {}
    audience_bias_score = 0 # Initialize score for audience bias
    
    if protected_attribute not in df.columns:
        return {"error": f"Protected attribute '{protected_attribute}' not found in data."}

    groups = df[protected_attribute].unique()
    
    if len(groups) < 2:
        return {"info": f"Not enough groups in '{protected_attribute}' to analyze bias."}

    targeting_rates = df.groupby(protected_attribute)[target_column].mean()
    privileged_group = targeting_rates.idxmax()
    privileged_rate = targeting_rates.max()

    results['privileged_group'] = privileged_group
    results['targeting_rates'] = targeting_rates.to_dict()
    results['disparate_impact_ratios'] = {}
    results['biased_groups'] = []

    for group in groups:
        if group == privileged_group:
            continue
        
        unprivileged_rate = targeting_rates[group]
        if privileged_rate > 0: # Avoid division by zero
            dir_value = unprivileged_rate / privileged_rate
        else:
            dir_value = 0 

        results['disparate_impact_ratios'][group] = dir_value
        
        if dir_value < 0.8 or dir_value > 1.25:
            results['biased_groups'].append(f"{group} (DIR: {dir_value:.2f})")
            # Assign points for each biased group detected in audience segmentation
            audience_bias_score += 1 

    results['is_biased'] = len(results['biased_groups']) > 0
    results['audience_bias_score'] = audience_bias_score # Add score to results
    return results

# --- New: Overall Bias Score Calculation ---
def calculate_overall_bias_score(text_bias_score, visual_bias_score):
    """
    Calculates an overall bias score based on textual and visual analysis.
    This is a simple sum for demonstration.
    """
    overall_score = text_bias_score + visual_bias_score
    # Normalize to a 0-10 scale for easier interpretation (example scaling)
    # Max possible score depends on your rule weighting. Let's assume max 10-15 for simplicity.
    normalized_score = min(overall_score, 10) # Cap at 10 for display
    return normalized_score

# --- Header ---
st.title("🛡️ FairGuard: Ethical AI Guardrail for Marketing Automation")
st.markdown("""
_Ensuring Trust, Security, and Fairness in Your Automated Marketing Campaigns._
""")

st.markdown("---")

# --- Sidebar for Navigation ---
st.sidebar.header("FairGuard Modules")
page_selection = st.sidebar.radio(
    "Select a module to analyze:",
    ("Ad Copy Bias & Security", "Audience Segmentation Bias", "Image Ad Analysis")
)

st.sidebar.markdown("---")
st.sidebar.info(
    "FairGuard helps marketing teams identify and mitigate biases, "
    "and ensure security compliance in their AI-generated content and audience targeting."
)

# --- Main Content Area based on Selection ---

if page_selection == "Ad Copy Bias & Security":
    st.header("✍️ Ad Copy Bias & Security Analysis")
    st.markdown("""
    Paste your AI-generated marketing ad copies below to check for potential biases (e.g., gender stereotypes, ageism) 
    and security risks (e.g., accidental PII leakage, harmful content).
    """)

    ad_copy_input = st.text_area(
        "Enter Ad Copies (one per line, or multiple separated by newlines):",
        height=250,
        placeholder="e.g., 'Are you a successful businessman looking to grow your empire?'\n'Retirees, find peace in our serene retirement community.'\n'Get your exclusive offer today!'\n'Call 555-123-4567 for your offer!'",
        key="ad_copy_input"
    )

    if st.button("Analyze Ad Copies", key="analyze_ad_copy_btn"):
        if ad_copy_input:
            ad_copies = [copy.strip() for copy in ad_copy_input.split('\n') if copy.strip()]
            st.subheader("Analysis Results:")
            
            for i, copy in enumerate(ad_copies):
                st.markdown(f"---")
                st.markdown(f"**Ad Copy {i+1}:** `{copy}`")
                
                # Perform Bias Analysis
                st.markdown("##### Bias Analysis:")
                bias_results = analyze_text_for_bias(copy)
                if bias_results['is_biased']:
                    st.error(f"Potential Bias Detected: {', '.join(bias_results['bias_flags'])}")
                    st.write("Suggestions:", " ".join(bias_results['suggestions']))
                    st.metric("Textual Bias Score (0-10)", bias_results['bias_score'])
                else:
                    st.success("No significant bias detected in this ad copy.")
                    st.metric("Textual Bias Score (0-10)", bias_results['bias_score'])
                
                # Perform Security Checks
                st.markdown("##### Security Checks:")
                pii_results = check_for_pii(copy)
                if pii_results['has_pii']:
                    st.error(f"PII Detected! Found: {', '.join(pii_results['detected_items'])}. This information should be redacted.")
                else:
                    st.success("No Personal Identifiable Information (PII) found.")

                harmful_results = check_for_harmful_content(copy)
                if harmful_results['has_harmful_content']:
                    st.error(f"Harmful Content Detected! Found: {', '.join(harmful_results['detected_items'])}. Review for offensive or manipulative language.")
                else:
                    st.success("No harmful content detected.")
        else:
            st.warning("Please enter some ad copies to analyze.")

elif page_selection == "Audience Segmentation Bias":
    st.header("📊 Audience Segmentation Bias Analysis")
    st.markdown("""
    Simulate an audience segmentation dataset to evaluate for fairness based on protected attributes 
    like gender, age, or income. The 'ad_targeted' column represents whether an individual was targeted by an ad.
    """)

    st.info("Using a simulated dataset for demonstration purposes with intentional biases.")
    
    if st.button("Generate & Analyze Simulated Audience Data", key="load_audience_data_btn"):
        with st.spinner("Generating and analyzing data..."):
            simulated_df = simulate_audience_data(num_samples=1000)
            st.session_state['simulated_audience_df'] = simulated_df # Store in session state

        st.subheader("Simulated Audience Data (First 5 rows):")
        st.dataframe(simulated_df.head())

        st.subheader("Bias Analysis by Protected Attribute:")
        
        overall_audience_bias_score = 0
        protected_attributes = ['gender', 'age_group', 'income_level']
        for attr in protected_attributes:
            st.markdown(f"##### Analyzing Bias for: **{attr.replace('_', ' ').title()}**")
            bias_analysis = analyze_audience_bias(simulated_df, attr)
            
            if "error" in bias_analysis:
                st.error(bias_analysis["error"])
            elif "info" in bias_analysis:
                st.info(bias_analysis["info"])
            else:
                st.write(f"Privileged Group (highest targeting rate): `{bias_analysis['privileged_group']}`")
                st.write("Targeting Rates per Group:")
                st.json(bias_analysis['targeting_rates'])
                
                if bias_analysis['is_biased']:
                    st.error(f"Bias Detected! Groups with significant disparate impact: {', '.join(bias_analysis['biased_groups'])}")
                    st.write("Disparate Impact Ratios (closer to 1 is fairer):")
                    st.json(bias_analysis['disparate_impact_ratios'])
                    overall_audience_bias_score += bias_analysis['audience_bias_score']
                else:
                    st.success("No significant bias detected for this attribute based on Disparate Impact Ratio.")
                
                # Visualizing targeting rates
                st.markdown(f"Targeting Rate Distribution for {attr.replace('_', ' ').title()}:")
                df_plot = simulated_df.groupby(attr)['ad_targeted'].mean().reset_index()
                df_plot.columns = [attr, 'Targeting Rate']
                st.bar_chart(df_plot.set_index(attr))
                st.markdown("---")
        
        st.subheader("Overall Audience Segmentation Bias Score:")
        st.metric("Audience Bias Score (sum of flags per attribute)", overall_audience_bias_score)


    else:
        st.info("Click the button above to generate and analyze simulated audience data.")


elif page_selection == "Image Ad Analysis":
    st.header("🖼️ Image Ad Analysis (OCR & Bias)")
    st.markdown("""
    Upload an image of an advertisement (e.g., flyer, social media ad) to extract its text 
    and analyze it for biases and security concerns.
    """)

    uploaded_file = st.file_uploader(
        "Choose an image file...", type=["png", "jpg", "jpeg"], key="image_uploader"
    )

    if uploaded_file is not None:
        st.image(uploaded_file, caption='Uploaded Image', use_column_width=True)
        st.write("") # Add some space

        if st.button("Analyze Image Ad", key="analyze_image_btn"):
            with st.spinner("Extracting text and analyzing... This might take a moment (especially on first run for models)."):
                # --- OCR Text Extraction ---
                extracted_text = extract_text_from_image(uploaded_file.getvalue()) 
                
                st.subheader("Extracted Text:")
                if extracted_text:
                    st.info(extracted_text)
                else:
                    st.warning("No text could be extracted from the image or an error occurred. Please try a different image or ensure text is clear.")
                
                st.subheader("Bias & Security Analysis of Ad Content:")
                
                # --- Textual Bias Analysis (from OCR) ---
                st.markdown("##### Textual Bias Analysis (from OCR):")
                text_bias_results = analyze_text_for_bias(extracted_text)
                if text_bias_results['is_biased']:
                    st.error(f"Potential Textual Bias Detected: {', '.join(text_bias_results['bias_flags'])}")
                    st.write("Suggestions:", " ".join(text_bias_results['suggestions']))
                    st.metric("Textual Bias Score (0-10)", text_bias_results['bias_score'])
                else:
                    st.success("No significant textual bias detected.")
                    st.metric("Textual Bias Score (0-10)", text_bias_results['bias_score'])
                
                # --- Visual Context Analysis (from Image Captioning) ---
                st.markdown("##### Visual Context Analysis (from Image Captioning):")
                # Pass extracted_text to visual analysis for contextual flagging
                visual_analysis_results = analyze_image_for_visual_context(uploaded_file.getvalue(), extracted_text)
                
                if visual_analysis_results['is_visually_biased']:
                    st.error(f"Potential Visual Bias Detected: {', '.join(visual_analysis_results['visual_flags'])}")
                    st.write("Review image for stereotypical depictions based on the generated caption and overall context.")
                    st.metric("Visual Bias Score (0-10)", visual_analysis_results['visual_bias_score'])
                else:
                    st.success("No significant visual stereotypical context detected based on analysis of the caption.")
                    st.metric("Visual Bias Score (0-10)", visual_analysis_results['visual_bias_score'])
                
                # --- Overall Bias Score ---
                overall_bias_score = calculate_overall_bias_score(
                    text_bias_results['bias_score'], 
                    visual_analysis_results['visual_bias_score']
                )
                st.markdown("---")
                st.subheader("Overall Ad Bias Score:")
                st.metric("Combined Bias Score (0-10)", overall_bias_score, help="A higher score indicates more potential bias. This is a simplified score for demonstration.")
                st.markdown("---")

                # --- Security Checks for Extracted Text ---
                st.markdown("##### Security Checks (from Extracted Text):")
                pii_results = check_for_pii(extracted_text)
                if pii_results['has_pii']:
                    st.error(f"PII Detected! Found: {', '.join(pii_results['detected_items'])}. This information should be redacted.")
                    st.write("Suggestions: Remove or redact sensitive personal information before public display.")
                else:
                    st.success("No Personal Identifiable Information (PII) found.")

                harmful_results = check_for_harmful_content(extracted_text)
                if harmful_results['has_harmful_content']:
                    st.error(f"Harmful Content Detected! Found: {', '.join(harmful_results['detected_items'])}. Review for offensive or manipulative language.")
                    st.write("Suggestions: Remove or rephrase offensive/manipulative language to maintain a positive brand image and ethical standards.")
                else:
                    st.success("No harmful content detected.")

    else:
        st.info("Upload an image to start the analysis.")

