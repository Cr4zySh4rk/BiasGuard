import argparse
import easyocr
import numpy as np
from PIL import Image
import io
import re
from transformers import pipeline
import json

# Initialize models globally
reader = easyocr.Reader(['en'], gpu=False)
image_captioner = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")

def extract_text_from_image(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        results = reader.readtext(image_np, detail=0) 
        return " ".join(results)
    except Exception as e:
        return f"Error extracting text from image: {e}"

def analyze_image_for_visual_context(image_bytes, extracted_text=""):
    visual_bias_categories = {
        "gender": [],
        "age": [],
        "stereotypical_role": [],
        "benevolent_sexism": [],
        "racial_socioeconomic": [],
        "ableism": []
    }
    visual_bias_score = 0
    generated_caption = ""
    all_visual_flags = []

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        caption_results = image_captioner(image) 
        
        if caption_results and caption_results[0] and 'generated_text' in caption_results[0]:
            generated_caption = caption_results[0]['generated_text']
            
            # Analyze the caption text for bias
            caption_bias_analysis = analyze_text_for_bias(generated_caption)
            
            for category, flags in caption_bias_analysis['bias_categories'].items():
                visual_bias_categories[category].extend(flags)
                all_visual_flags.extend(flags)
            visual_bias_score += caption_bias_analysis['bias_score']

            # Advanced visual bias detection
            caption_lower = generated_caption.lower()
            text_lower = extracted_text.lower()

            # Heuristic for racial/socioeconomic bias
            if ('man' in caption_lower and 'suit' in caption_lower) and \
               ('man' in caption_lower or 'person' in caption_lower or 'people' in caption_lower) and \
               ('struggling' in text_lower or 'money' in text_lower or 'financial freedom' in text_lower):
                flag = "Potential racial/socio-economic stereotype"
                visual_bias_categories["racial_socioeconomic"].append(flag)
                all_visual_flags.append(flag)
                visual_bias_score += 5 
                
            # Heuristic for benevolent sexism
            if ('woman' in caption_lower or 'female' in caption_lower) and \
               ('car' in caption_lower or 'vehicle' in caption_lower) and \
               ('safety' in text_lower or 'safe' in text_lower or 'protection' in text_lower):
                flag = "Potential benevolent sexism/vulnerability stereotype"
                visual_bias_categories["benevolent_sexism"].append(flag)
                all_visual_flags.append(flag)
                visual_bias_score += 4 

            # Heuristic for ableism
            active_sport_keywords = ['skateboard', 'skateboarding', 'sport', 'active', 'run', 'jump', 'play']
            if ('person' in caption_lower or 'man' in caption_lower or 'people' in caption_lower) and \
               any(keyword in text_lower for keyword in active_sport_keywords) and \
               ('sitting' in caption_lower or 'seated' in caption_lower or 'wheelchair' in caption_lower):
                flag = "Potential ableism/exclusion in active sport context"
                visual_bias_categories["ableism"].append(flag)
                all_visual_flags.append(flag)
                visual_bias_score += 4 

    except Exception as e:
        all_visual_flags.append(f"Error during visual analysis: {e}")

    return {
        "generated_caption": generated_caption,
        "bias_categories": visual_bias_categories,
        "is_visually_biased": len(all_visual_flags) > 0,
        "visual_bias_score": visual_bias_score
    }

def analyze_text_for_bias(text):
    bias_categories = {
        "gender": [],
        "age": [],
        "stereotypical_role": [],
        "benevolent_sexism": [],
        "racial_socioeconomic": [],
        "ableism": []
    }
    bias_score = 0
    text_lower = text.lower()

    # Gender Bias
    gender_keywords_male = ['businessman', 'he', 'his', 'him', 'gentleman']
    gender_keywords_female = ['businesswoman', 'she', 'her', 'lady']
    
    if any(keyword in text_lower for keyword in gender_keywords_male) and \
       not any(keyword in text_lower for keyword in gender_keywords_female) and \
       not any(k in text_lower for k in ['person', 'individual', 'they', 'their', 'everyone']):
        bias_categories["gender"].append("Male-centric language detected")
        bias_score += 1
    elif any(keyword in text_lower for keyword in gender_keywords_female) and \
         not any(keyword in text_lower for keyword in gender_keywords_male) and \
         not any(k in text_lower for k in ['person', 'individual', 'they', 'their', 'everyone']):
        bias_categories["gender"].append("Female-centric language detected")
        bias_score += 1

    # Age Bias
    age_keywords_old = ['retiree', 'elderly', 'senior citizen', 'golden years', 'pensioner']
    age_keywords_young = ['youth', 'millennial', 'gen z', 'youngster']

    if any(keyword in text_lower for keyword in age_keywords_old):
        bias_categories["age"].append("Targeting only older demographic")
        bias_score += 1
    if any(keyword in text_lower for keyword in age_keywords_young):
        bias_categories["age"].append("Targeting only younger demographic")
        bias_score += 1

    # Stereotypical Role Bias
    female_stereotypical_products_roles = ['scrub', 'clean', 'kitchen', 'home', 'dishes', 'laundry', 'cooking', 'beauty']
    male_stereotypical_products_roles = ['tools', 'cars', 'garage', 'finance', 'business', 'power', 'strength', 'sports']

    if any(prod_role in text_lower for prod_role in female_stereotypical_products_roles):
        bias_categories["stereotypical_role"].append("Linking women to domestic/beauty roles")
        bias_score += 2
    if any(prod_role in text_lower for prod_role in male_stereotypical_products_roles):
        bias_categories["stereotypical_role"].append("Linking men to power/tech/sports roles")
        bias_score += 2
    
    # Benevolent Sexism
    if ('especially for women' in text_lower or 'for women' in text_lower) and \
       ('safety' in text_lower or 'safe' in text_lower or 'protection' in text_lower):
        bias_categories["benevolent_sexism"].append("Implies women need special safety/protection")
        bias_score += 4 

    # Racial/Socioeconomic/Ableism
    problematic_terms = ['primitive', 'backward', 'exotic', 'ghetto', 'struggling', 'poverty', 'disabled', 'handicap']
    if any(term in text_lower for term in problematic_terms):
        if 'struggling' in text_lower or 'poverty' in text_lower:
            bias_categories["racial_socioeconomic"].append("Problematic socio-economic language")
        if 'disabled' in text_lower or 'handicap' in text_lower:
            bias_categories["ableism"].append("Problematic disability language")
        else:
            bias_categories["racial_socioeconomic"].append("Problematic language detected")
        bias_score += 3

    return {
        "is_biased": any(len(flags) > 0 for flags in bias_categories.values()),
        "bias_categories": bias_categories,
        "bias_score": bias_score
    }

def check_for_pii(text):
    pii_found = []
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    if emails:
        pii_found.extend([f"Email: {e}" for e in emails])

    phone_numbers = re.findall(r'\b(?:\d{3}[-.\s]??\d{3}[-.\s]??\d{4}|\(\d{3}\)\s*\d{3}[-.\s]??\d{4})\b', text)
    if phone_numbers:
        pii_found.extend([f"Phone: {p}" for p in phone_numbers])

    cc_numbers = re.findall(r'\b(?:\d{4}[- ]){3}\d{4}\b', text)
    if cc_numbers:
        pii_found.extend([f"Credit Card (potential): {c}" for c in cc_numbers])

    return {
        "has_pii": len(pii_found) > 0,
        "detected_items": pii_found
    }

def check_for_harmful_content(text):
    harmful_terms = [
        'kill', 'hate', 'destroy', 'bomb', 'attack', 'violence', 'exploit',
        'manipulate', 'deceive', 'fraud', 'illegal', 'scam', 'cheat'
    ]
    detected_harm = [term for term in harmful_terms if term in text.lower()]
    return {
        "has_harmful_content": len(detected_harm) > 0,
        "detected_items": detected_harm
    }

def analyze_text(input_text):
    print("\n=== TEXT ANALYSIS ===")
    print(f"Input Text: {input_text}")
    
    # Perform analyses
    bias_results = analyze_text_for_bias(input_text)
    pii_results = check_for_pii(input_text)
    harmful_results = check_for_harmful_content(input_text)
    
    # Print results
    print("\n=== BIAS ANALYSIS ===")
    print(f"Bias Score: {bias_results['bias_score']}/10")
    if bias_results['is_biased']:
        print("Potential Bias Detected:")
        for category, flags in bias_results['bias_categories'].items():
            if flags:
                print(f"- {category.replace('_', ' ').title()}:")
                for flag in flags:
                    print(f"  * {flag}")
    else:
        print("No significant bias detected")
    
    print("\n=== SECURITY ANALYSIS ===")
    if pii_results['has_pii']:
        print("PII Detected:")
        for item in pii_results['detected_items']:
            print(f"- {item}")
    else:
        print("No PII detected")
    
    if harmful_results['has_harmful_content']:
        print("Harmful Content Detected:")
        for item in harmful_results['detected_items']:
            print(f"- {item}")
    else:
        print("No harmful content detected")
    
    print("\n=== SUMMARY ===")
    print(f"Overall Risk Assessment:")
    print(f"- Bias Score: {bias_results['bias_score']}/10")
    print(f"- PII Detected: {'Yes' if pii_results['has_pii'] else 'No'}")
    print(f"- Harmful Content: {'Yes' if harmful_results['has_harmful_content'] else 'No'}")

def analyze_image(image_path):
    print("\n=== IMAGE ANALYSIS ===")
    print(f"Analyzing image: {image_path}")
    
    with open(image_path, 'rb') as f:
        image_bytes = f.read()
    
    # Perform analyses
    extracted_text = extract_text_from_image(image_bytes)
    print(f"\nExtracted Text: {extracted_text}")
    
    text_bias_results = analyze_text_for_bias(extracted_text)
    visual_results = analyze_image_for_visual_context(image_bytes, extracted_text)
    pii_results = check_for_pii(extracted_text)
    harmful_results = check_for_harmful_content(extracted_text)
    
    # Calculate overall scores
    overall_bias_score = min(text_bias_results['bias_score'] + visual_results['visual_bias_score'], 10)
    
    # Print results
    print("\n=== TEXTUAL BIAS ANALYSIS ===")
    print(f"Text Bias Score: {text_bias_results['bias_score']}/10")
    if text_bias_results['is_biased']:
        print("Potential Textual Bias Detected:")
        for category, flags in text_bias_results['bias_categories'].items():
            if flags:
                print(f"- {category.replace('_', ' ').title()}:")
                for flag in flags:
                    print(f"  * {flag}")
    
    print("\n=== VISUAL CONTEXT ANALYSIS ===")
    print(f"Generated Caption: {visual_results['generated_caption']}")
    print(f"Visual Bias Score: {visual_results['visual_bias_score']}/10")
    if visual_results['is_visually_biased']:
        print("Potential Visual Bias Detected:")
        for category, flags in visual_results['bias_categories'].items():
            if flags:
                print(f"- {category.replace('_', ' ').title()}:")
                for flag in flags:
                    print(f"  * {flag}")
    
    print("\n=== SECURITY ANALYSIS ===")
    if pii_results['has_pii']:
        print("PII Detected:")
        for item in pii_results['detected_items']:
            print(f"- {item}")
    else:
        print("No PII detected")
    
    if harmful_results['has_harmful_content']:
        print("Harmful Content Detected:")
        for item in harmful_results['detected_items']:
            print(f"- {item}")
    else:
        print("No harmful content detected")
    
    print("\n=== SUMMARY ===")
    print(f"Overall Bias Score: {overall_bias_score}/10")
    print(f"Security Issues:")
    print(f"- PII Detected: {'Yes' if pii_results['has_pii'] else 'No'}")
    print(f"- Harmful Content: {'Yes' if harmful_results['has_harmful_content'] else 'No'}")

def main():
    parser = argparse.ArgumentParser(description="FairGuard: Ethical AI Guardrail for Marketing Content")
    parser.add_argument('type', type=int, choices=[1, 2], 
                       help="1 for text analysis, 2 for image analysis")
    parser.add_argument('input', help="The text string or image file path depending on type")
    
    args = parser.parse_args()
    
    if args.type == 1:
        analyze_text(args.input)
    elif args.type == 2:
        analyze_image(args.input)

if __name__ == "__main__":
    main()