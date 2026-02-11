#!/usr/bin/env python3
"""
Refactored WD14 Tagger 
- Supports standard SmilingWolf v2 models (ConvNeXt, SwinV2, ViT)
- Correct preprocessing (448x448, standard normalization)
- Correct CSV parsing (handling General/Character/Rating categories)
- Supports single file or batch directory processing
"""

import argparse
import json
import sys
import os
import csv
from pathlib import Path
from typing import List, Dict, Tuple, Set
import numpy as np
from PIL import Image

# Check for required dependencies
try:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
except ImportError as e:
    print(f"Error: Missing required package: {e}", file=sys.stderr)
    print("Please install: pip install onnxruntime huggingface-hub pillow numpy", file=sys.stderr)
    sys.exit(1)

# Default exclude list (Standard booru junk)
DEFAULT_EXCLUDE = [
    'masterpiece', 'best quality', 'highres', 'absurdres',
    'simple background', 'white background', 'official art',
    'scenery', 'building', 'landscape'
]

# Model definitions
MODELS = {
    'legacy': {
        'repo': 'SmilingWolf/wd-v1-4-vit-tagger-v2',
        'type': 'vit'
    },
    'convnext': {
        'repo': 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
        'type': 'convnext'
    },
    'swinv2': {
        'repo': 'SmilingWolf/wd-v1-4-swinv2-tagger-v2',
        'type': 'swin'
    },
    # Ensure we map common names to these
    'wd-v1-4-convnext-tagger-v2': { 'repo': 'SmilingWolf/wd-v1-4-convnext-tagger-v2', 'type': 'convnext' },
    'wd-v1-4-swinv2-tagger-v2': { 'repo': 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', 'type': 'swin' },
    'wd-v1-4-vit-tagger-v2': { 'repo': 'SmilingWolf/wd-v1-4-vit-tagger-v2', 'type': 'vit' }
}

def load_model(model_name: str):
    """Downloads (if needed) and loads the ONNX model and tags CSV."""
    config = MODELS.get(model_name)
    if not config:
        # Fallback for exact repo strings if not in map
        if model_name.startswith('SmilingWolf/'):
             config = {'repo': model_name, 'type': 'unknown'}
        else:
            print(f"Error: Unknown model variant: {model_name}", file=sys.stderr)
            sys.exit(1)

    repo_id = config['repo']
    print(f"Loading model from {repo_id}...", flush=True)

    try:
        model_path = hf_hub_download(repo_id, "model.onnx")
        tags_path = hf_hub_download(repo_id, "selected_tags.csv")
    except Exception as e:
        print(f"Error downloading model: {e}", file=sys.stderr)
        sys.exit(1)

    # Load Tags
    tags = []
    character_indexes = []
    general_indexes = []
    rating_indexes = []

    with open(tags_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            name = row.get('name', '').strip()
            category = int(row.get('category', row.get('category_id', 0))) # Handle different CSV headers
            
            tags.append(name)
            
            # 0: General, 4: Character, 9: Rating
            if category == 0:
                general_indexes.append(idx)
            elif category == 4:
                character_indexes.append(idx)
            elif category == 9:
                rating_indexes.append(idx)
            # Other categories ignored for now (e.g. 1: Artist, 3: Copyright)

    # Load ONNX
    try:
        # Use CPU provider to avoid CUDA issues unless explicitly available/configured
        # For now simple CPU is safer for a general script
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    except Exception as e:
        print(f"Error creating ONNX session: {e}", file=sys.stderr)
        sys.exit(1)

    input_name = session.get_inputs()[0].name
    return session, input_name, tags, general_indexes, character_indexes, rating_indexes

def preprocess_image(image_path: str, size: int = 448) -> np.ndarray:
    """
    Standard WD14 preprocessing:
    - Resize long edge to 448
    - Pad short edge to 448 with white (or model specific color, white is standard for these)
    - Convert to BGR (standard for CV models, many ONNX exports expect this) or RGB?
      SmilingWolf v2 models generally expect RGB input normalized 0-1 (BGR is old Caffe style).
      Let's verify: official demo uses `PIL.Image` (RGB) -> resize -> pad -> numpy.
      Standard `SmilingWolf` inference code uses BGR for some, RGB for others. 
      However, the most stable `comfyui` and `A1111` impls use BGR for `wd-v1-4` models.
      Let's try BGR first which is critical for correcting the "confusion" issue.
    """
    try:
        img = Image.open(image_path).convert('RGB')
    except Exception as e:
        print(f"Error opening image {image_path}: {e}", file=sys.stderr)
        return None

    # Resize/Pad logic
    # We want to fit into size x size while maintaining aspect ratio, padding the rest
    old_size = img.size # (width, height)
    ratio = float(size) / max(old_size)
    new_size = tuple([int(x * ratio) for x in old_size])
    
    # Resize
    img = img.resize(new_size, Image.Resampling.BICUBIC)
    
    # Pad
    new_img = Image.new("RGB", (size, size), (255, 255, 255))
    new_img.paste(img, ((size - new_size[0]) // 2, (size - new_size[1]) // 2))
    
    # Convert to Numpy
    # Models typically expect BGR 0-255 or BGR normalized.
    # SmilingWolf's V2 ONNX models (convnext, swin) expect BGR!
    # Reference: https://huggingface.co/SmilingWolf/wd-v1-4-convnext-tagger-v2/discussions/2
    # "The model expects BGR images..."
    
    img_np = np.array(new_img)
    # RGB to BGR
    img_np = img_np[:, :, ::-1] 
    
    # Normalize? 
    # Some runtimes/models expect 0-255 float, others 0-1.
    # Most A1111/Comfy implementations do simple casting to float32 without 0-1 division, 
    # relying on the model's internal normalization often baked in, OR they assume standard ImageNet norm.
    # BUT, looking at `waifu-diffusion` demo code:
    # They usually do `image = image.astype(np.float32)` (0-255 range).
    # Let's try raw 0-255 float32 first. If tags are garbage, we switch to 0-1.
    # *Experience*: It is almost always BGR float32 0-255 for these specific V2 models exported by SW.
    
    img_np = img_np.astype(np.float32)
    
    # Use 5-dim expansion if needed? No, standard is (Batch, Size, Size, Channels) or (Batch, Channels, Size, Size)
    # Check shape later.
    return img_np

def run_inference(session, input_name, img_array):
    """Run inference, handling NCHW vs NHWC."""
    # ONNX Runtime expects specific shape.
    # Check input shape from session
    input_shape = session.get_inputs()[0].shape
    # usually [None, height, width, 3] or [None, 3, height, width]
    
    # img_array is [H, W, 3]
    h, w, c = img_array.shape
    
    # Add batch dimension
    input_data = np.expand_dims(img_array, axis=0) # [1, H, W, C]
    
    # If model expects NCHW [1, C, H, W]
    if input_shape[3] != 3 and input_shape[1] == 3:
        input_data = input_data.transpose(0, 3, 1, 2)
        
    outputs = session.run(None, {input_name: input_data})
    return outputs[0][0] # First batch item

def process_tags(probs, tags, gen_idx, char_idx, rat_idx, threshold, char_threshold, exclude_set):
    """Process raw probabilities into a tag list."""
    
    result_tags = []
    
    # 1. Process General Tags
    for i in gen_idx:
        score = probs[i]
        tag_name = tags[i]
        if score >= threshold and tag_name not in exclude_set:
            result_tags.append((tag_name, score))

    # 2. Process Character Tags (often need lower threshold)
    for i in char_idx:
        score = probs[i]
        tag_name = tags[i]
        if score >= char_threshold and tag_name not in exclude_set:
            result_tags.append((tag_name, score))
            
    # 3. Ratings (Optional, usually we exclude, but can include if explicitly asked)
    # For now, we ignore ratings as they aren't useful for training usually (unless 'explicit' etc)
    
    # Sort by confidence
    result_tags.sort(key=lambda x: x[1], reverse=True)
    
    return [t[0] for t in result_tags]

def normalize_tag(tag):
    return tag.replace('_', ' ').strip()

def format_tags(tags, args):
    """Format tags based on arguments (normalize, start with trigger, etc)"""
    
    # Normalize (underscores to spaces? OR spaces to underscores?)
    # Valid Danbooru tags usually have underscores.
    # If user wants "normalize", usually means "replace underscores with spaces" for human readability,
    # OR "escape brackets" etc.
    # standard wd14 output is `1girl, green_hair` etc.
    # If args.normalize is True, we usually just ensure underscores are there for Danbooru compatibility
    # OR we convert to spaces if that's the preferred style.
    # Let's assume standard Danbooru (underscores) is the goal for LoRA training `train_data`, 
    # but the previous code tried to `replace(' ', '_')`.
    
    processed = []
    for t in tags:
        if args.normalize:
            t = t.replace(' ', '_') # ensure underscores
        processed.append(t)
        
    if args.shuffle:
        import random
        # Keep tokens logic
        keep_count = args.keep_tokens
        if keep_count > 0 and len(processed) > keep_count:
            kept = processed[:keep_count]
            shuffled = processed[keep_count:]
            random.shuffle(shuffled)
            processed = kept + shuffled
    
    if args.trigger:
        processed.insert(0, args.trigger)
        
    return processed

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input_dir', type=str)
    parser.add_argument('--file', type=str)
    parser.add_argument('--model', type=str, default='convnext')
    parser.add_argument('--threshold', type=float, default=0.35)
    parser.add_argument('--character_threshold', type=float, default=0.7) # Higher default for chars to reduce false positives
    parser.add_argument('--max_tags', type=int, default=50) # Not strictly used as hard limit usually
    parser.add_argument('--exclude_tags', type=str, default='') # Comma separated
    parser.add_argument('--normalize', action='store_true')
    parser.add_argument('--trigger', type=str, default='')
    parser.add_argument('--keep_tokens', type=int, default=1)
    parser.add_argument('--shuffle', action='store_true')
    # Backward compat args (ignored or mapped)
    parser.add_argument('--blacklist', type=str, help='deprecated alias for exclude_tags')
    
    args = parser.parse_args()

    # Consolidate exclusions
    exclude_set = set(DEFAULT_EXCLUDE)
    user_exclude = args.exclude_tags or args.blacklist
    if user_exclude:
        for t in user_exclude.split(','):
            exclude_set.add(t.strip().replace(' ', '_')) # store as underscore for matching

    # Validate Input
    targets = []
    if args.file:
        targets.append(Path(args.file))
    elif args.input_dir:
        p = Path(args.input_dir)
        for ext in ['.png', '.jpg', '.jpeg', '.webp']:
             targets.extend(list(p.glob(f'*{ext}')))
             targets.extend(list(p.glob(f'*{ext.upper()}')))
    
    if not targets:
        print("No images found.", file=sys.stderr)
        sys.exit(1)

    # Load Model
    session, input_name, tags, gen_idx, char_idx, rat_idx = load_model(args.model)

    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    total = len(targets)
    print(f"Found {total} images. Starting inference...", flush=True)

    for i, img_path in enumerate(targets, 1):
        try:
            # Emit Progress
            prog = json.dumps({
                "progress": i, 
                "total": total, 
                "current_file": img_path.name,
                "status": "tagging"
            })
            print(f"PROGRESS:{prog}", flush=True)

            # Preprocess
            img_in = preprocess_image(str(img_path))
            if img_in is None: continue

            # Infer
            probs = run_inference(session, input_name, img_in)

            # Process outputs
            final_tags = process_tags(
                probs, tags, gen_idx, char_idx, rat_idx, 
                args.threshold, args.character_threshold or args.threshold, 
                exclude_set
            )
            
            # Format
            formatted_tags = format_tags(final_tags, args)
            
            # Write
            txt_path = img_path.with_suffix('.txt')
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(', '.join(formatted_tags))
                
        except Exception as e:
            print(f"Error processing {img_path}: {e}", file=sys.stderr)

    print("Tagging Finished.")

if __name__ == "__main__":
    main()
