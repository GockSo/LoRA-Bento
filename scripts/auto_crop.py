
import argparse
import sys
import os
import json
import random

def main():
    parser = argparse.ArgumentParser(description='Auto Crop Simulation')
    parser.add_argument('--project-dir', required=True, help='Path to project directory')
    parser.add_argument('--refs', nargs='*', help='Reference image paths')
    parser.add_argument('--mode', default='auto', help='Crop mode: face/object/auto')
    
    args = parser.parse_args()
    
    project_dir = args.project_dir
    raw_dir = os.path.join(project_dir, 'raw')
    
    if not os.path.exists(raw_dir):
        print(json.dumps({"error": "Raw directory not found"}))
        sys.exit(1)
        
    proposals = []
    
    # Simulate processing
    # In a real scenario, we'd load reference images and the target images
    # and use a model (like template matching, or SAM, or Face detection)
    
    try:
        images = [f for f in os.listdir(raw_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        
        for img in images:
            # Simulate a "match" or "proposal"
            # Random confidence
            confidence = random.uniform(0.6, 0.99)
            
            if confidence > 0.4: # Some threshold to find "something"
                # Propose a center-ish crop
                # Randomize slightly to show variation
                
                w = random.uniform(0.5, 0.8)
                h = random.uniform(0.5, 0.8)
                x = (1.0 - w) / 2.0 + random.uniform(-0.05, 0.05)
                y = (1.0 - h) / 2.0 + random.uniform(-0.05, 0.05)
                
                # Clamp
                x = max(0, min(1-w, x))
                y = max(0, min(1-h, y))
                
                proposals.append({
                    "file": img,
                    "bbox": { "x": x, "y": y, "w": w, "h": h },
                    "confidence": round(confidence, 2),
                    "label": args.mode
                })
                
        # Output results
        print(json.dumps({
            "status": "success",
            "proposals": proposals
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
