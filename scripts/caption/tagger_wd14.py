#!/usr/bin/env python3
"""
WD14 Tagger - Multi-variant support (Legacy, ConvNeXt, SwinV2)
Generates booru-style tags for anime/illustration images
"""

import argparse
import json
import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np
from PIL import Image

# Default junk tags to remove
DEFAULT_BLACKLIST = [
    'masterpiece', 'best quality', 'highres', 'absurdres',
    'simple background', 'white background', 'official art'
]

# Model configurations
MODELS = {
    'legacy': {
        'repo': 'SmilingWolf/wd-v1-4-vit-tagger-v2',
        'type': 'onnx'
    },
    'convnext': {
        'repo': 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
        'type': 'onnx'
    },
    'swinv2': {
        'repo': 'SmilingWolf/wd-v1-4-swinv2-tagger-v2',
        'type': 'onnx'
    }
}


def load_model(model_variant: str):
    """Load the specified WD14 model variant"""
    try:
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download
    except ImportError as e:
        print(f"Error: Missing required package: {e}", file=sys.stderr)
        print("Please install: pip install onnxruntime huggingface-hub", file=sys.stderr)
        sys.exit(1)
    
    config = MODELS.get(model_variant)
    if not config:
        print(f"Error: Unknown model variant: {model_variant}", file=sys.stderr)
        sys.exit(1)
    
    repo_id = config['repo']
    
    # Download model files
    model_path = hf_hub_download(repo_id, "model.onnx")
    tags_path = hf_hub_download(repo_id, "selected_tags.csv")
    
    # Load tags
    import csv
    with open(tags_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        tags = [row['name'] for row in reader]
    
    # Load ONNX model
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name
    
    return session, input_name, tags


def preprocess_image(image_path: str, target_size: int = 448) -> np.ndarray:
    """Preprocess image for WD14 model"""
    img = Image.open(image_path).convert('RGB')
    
    # Resize and pad to square
    img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Pad to square
    canvas = Image.new('RGB', (target_size, target_size), (255, 255, 255))
    offset = ((target_size - img.width) // 2, (target_size - img.height) // 2)
    canvas.paste(img, offset)
    
    # Convert to numpy array and normalize
    img_array = np.array(canvas).astype(np.float32) / 255.0
    
    # Add batch dimension and transpose to NCHW format
    img_array = np.expand_dims(img_array, 0)
    
    return img_array


def normalize_tag(tag: str) -> str:
    """Normalize tag: trim, lowercase, replace spaces with underscores"""
    tag = tag.strip().lower()
    tag = tag.replace(' ', '_')
    return tag


def predict_tags(
    session,
    input_name: str,
    all_tags: List[str],
    image_path: str,
    threshold: float,
    max_tags: int,
    blacklist: set,
    whitelist: set = None,
    normalize: bool = True,
    order: str = 'confidence'
) -> List[Tuple[str, float]]:
    """Run inference and return filtered tags"""
    
    # Preprocess image
    img_array = preprocess_image(image_path)
    
    # Run inference
    outputs = session.run(None, {input_name: img_array})
    probs = outputs[0][0]
    
    # Pair tags with probabilities
    tag_probs = list(zip(all_tags, probs.tolist()))
    
    # Filter by threshold
    tag_probs = [(tag, prob) for tag, prob in tag_probs if prob >= threshold]
    
    # Apply blacklist/whitelist
    if whitelist:
        tag_probs = [(tag, prob) for tag, prob in tag_probs if tag in whitelist]
    
    filtered = []
    for tag, prob in tag_probs:
        tag_check = normalize_tag(tag) if normalize else tag
        if tag_check not in blacklist:
            filtered.append((tag, prob))
    
    # Sort based on order method
    if order == 'confidence':
        filtered.sort(key=lambda x: x[1], reverse=True)
    elif order == 'alphabetical':
        filtered.sort(key=lambda x: x[0])
    # 'model' order keeps original order
    
    # Limit to max_tags
    filtered = filtered[:max_tags]
    
    # Normalize if requested
    if normalize:
        filtered = [(normalize_tag(tag), prob) for tag, prob in filtered]
    
    return filtered


def main():
    parser = argparse.ArgumentParser(description='WD14 Tagger for anime/illustration images')
    parser.add_argument('--input_dir', type=str, required=True, help='Directory containing images')
    parser.add_argument('--model', type=str, default='convnext', 
                       choices=['legacy', 'convnext', 'swinv2'],
                       help='Model variant to use')
    parser.add_argument('--threshold', type=float, default=0.25, 
                       help='Tag confidence threshold (0.0-1.0)')
    parser.add_argument('--max_tags', type=int, default=40, 
                       help='Maximum number of tags to output')
    parser.add_argument('--blacklist', type=str, default='', 
                       help='Comma-separated tags to exclude')
    parser.add_argument('--whitelist', type=str, default='', 
                       help='Comma-separated tags to include (optional)')
    parser.add_argument('--normalize', action='store_true', 
                       help='Normalize tags (lowercase, underscore spaces)')
    parser.add_argument('--order', type=str, default='confidence',
                       choices=['confidence', 'alphabetical', 'model'],
                       help='Tag ordering method')
    parser.add_argument('--trigger', type=str, default='',
                       help='Trigger word to prepend')
    parser.add_argument('--keep_tokens', type=int, default=1,
                       help='Number of tokens to keep at start (for trigger)')
    parser.add_argument('--shuffle', action='store_true',
                       help='Shuffle tags (after keeping first N tokens)')
    
    args = parser.parse_args()
    
    # Configure stdout for unbuffered output
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    
    # Parse blacklist/whitelist
    blacklist = set(DEFAULT_BLACKLIST)
    if args.blacklist:
        blacklist.update([t.strip().lower() for t in args.blacklist.split(',')])
    
    whitelist = None
    if args.whitelist:
        whitelist = set([t.strip().lower() for t in args.whitelist.split(',')])
    
    # Load model
    print(f"Loading WD14 {args.model} model...", flush=True)
    session, input_name, all_tags = load_model(args.model)
    print(f"Model loaded successfully", flush=True)
    
    # Find images
    input_dir = Path(args.input_dir)
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
        image_files.extend(input_dir.glob(ext))
        image_files.extend(input_dir.glob(ext.upper()))
    
    total = len(image_files)
    print(f"Found {total} images to tag", flush=True)
    
    if total == 0:
        print("No images found!", file=sys.stderr)
        sys.exit(1)
    
    # Process images
    for idx, img_path in enumerate(image_files, 1):
        try:
            # Emit progress
            progress_data = {
                "progress": idx,
                "total": total,
                "current_file": img_path.name,
                "status": "processing"
            }
            print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)
            
            # Debug: Log absolute path being tagged
            print(f"[DEBUG] Tagging: {img_path.absolute()}", flush=True)
            
            # Predict tags
            tag_probs = predict_tags(
                session, input_name, all_tags, str(img_path),
                args.threshold, args.max_tags, blacklist, whitelist,
                args.normalize, args.order
            )
            
            # Extract tag names
            tags = [tag for tag, prob in tag_probs]
            
            # Handle trigger word and shuffle
            if args.shuffle and len(tags) > args.keep_tokens:
                import random
                # Keep first N tokens (trigger word), shuffle the rest
                keep = tags[:args.keep_tokens]
                shuffle_part = tags[args.keep_tokens:]
                random.shuffle(shuffle_part)
                tags = keep + shuffle_part
            
            # Prepend trigger word
            if args.trigger:
                tags.insert(0, args.trigger)
            
            # Write to .txt file
            output_path = img_path.with_suffix('.txt')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(', '.join(tags))
            
        except Exception as e:
            print(f"Error processing {img_path.name}: {e}", file=sys.stderr)
            continue
    
    print(f"Tagging complete: {total} images processed", flush=True)


if __name__ == "__main__":
    main()
