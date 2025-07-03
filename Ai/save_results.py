# save_results.py

import json

def save_results(captions, analysis, output_file="results.json"):
    result = {
        "captions": captions,
        "analysis": analysis
    }
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)
    print(f"✅ Results saved to {output_file}")
