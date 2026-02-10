#!/usr/bin/env python3
"""
BLIP-2 Captioner - Improved quality over legacy BLIP
Generates natural language captions using BLIP-2
"""

import argparse
import json
import sys
from pathlib import Path
from PIL import Image

# Generic phrase patterns to remove
GENERIC_PATTERNS = [
    'a picture of ',
    'an image of ',
    'a photo of ',
    'a photograph of ',
    'a person ',
    'a man ',
    'a woman ',
]


def load_model():
    """Load BLIP-2 model"""
    try:
        from transformers import Blip2Processor, Blip2ForConditionalGeneration
        import torch
    except ImportError as e:
        print(f"Error: Missing required package: {e}", file=sys.stderr)
        print("Please install: pip install transformers torch", file=sys.stderr)
        sys.exit(1)
    
    model_name = "Salesforce/blip2-opt-2.7b"
    processor = Blip2Processor.from_pretrained(model_name)
    model = Blip2ForConditionalGeneration.from_pretrained(model_name)
    
    # Move to GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    
    return processor, model, device


def get_prompt_for_style(style: str) -> str:
    """Generate prompt based on caption style"""
    if style == 'detailed':
        return "Question: Describe this image in detail. Answer:"
    elif style == 'medium':
        return "Question: What is in this image? Answer:"
    else:  # short
        return "Question: What is this? Answer:"


def remove_generic_phrases(text: str, avoid_generic: bool) -> str:
    """Remove generic phrases from caption"""
    if not avoid_generic:
        return text
    
    text_lower = text.lower()
    for pattern in GENERIC_PATTERNS:
        if text_lower.startswith(pattern):
            text = text[len(pattern):]
            break
    
    return text.strip()


def generate_caption(
    processor,
    model,
    device: str,
    image_path: str,
    style: str,
    output_format: str,
    avoid_generic: bool
) -> str:
    """Generate caption for image"""
    
    # Load and process image
    image = Image.open(image_path).convert('RGB')
    
    # Get prompt based on style
    prompt = get_prompt_for_style(style)
    
    # Prepare inputs
    inputs = processor(image, text=prompt, return_tensors="pt").to(device)
    
    # Generate caption
    max_length = 100 if style == 'detailed' else (60 if style == 'medium' else 40)
    
    outputs = model.generate(
        **inputs,
        max_length=max_length,
        num_beams=5,
        temperature=0.7,
        early_stopping=True
    )
    
    caption = processor.decode(outputs[0], skip_special_tokens=True).strip()
    
    # Remove generic phrases
    caption = remove_generic_phrases(caption, avoid_generic)
    
    # Format based on output_format
    if output_format == 'tags':
        # Convert sentence to comma-separated tags
        import re
        # Remove punctuation and split
        words = re.findall(r'\b\w+\b', caption.lower())
        # Filter out very short words and common words
        stopwords = {'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'and', 'or', 'but', 'it', 'this', 'that'}
        words = [w for w in words if len(w) > 2 and w not in stopwords]
        caption = ', '.join(words)
    
    return caption


def main():
    parser = argparse.ArgumentParser(description='BLIP-2 Captioner')
    parser.add_argument('--input_dir', type=str, required=True, help='Directory containing images')
    parser.add_argument('--style', type=str, default='short',
                       choices=['short', 'medium', 'detailed'],
                       help='Caption style/length')
    parser.add_argument('--format', type=str, default='tags',
                       choices=['tags', 'sentence'],
                       help='Output format')
    parser.add_argument('--avoid_generic', action='store_true',
                       help='Remove generic phrases')
    parser.add_argument('--trigger', type=str, default='',
                       help='Trigger word to prepend')
    
    args = parser.parse_args()
    
    # Configure stdout
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    
    # Load model
    print(f"Loading BLIP-2 model...", flush=True)
    processor, model, device = load_model()
    print(f"Model loaded on {device}", flush=True)
    
    # Find images
    input_dir = Path(args.input_dir)
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
        image_files.extend(input_dir.glob(ext))
        image_files.extend(input_dir.glob(ext.upper()))
    
    total = len(image_files)
    print(f"Found {total} images to caption", flush=True)
    
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
            
            # Generate caption
            caption = generate_caption(
                processor, model, device, str(img_path),
                args.style, args.format, args.avoid_generic
            )
            
            # Prepend trigger word
            if args.trigger:
                caption = f"{args.trigger}, {caption}"
            
            # Write to .txt file
            output_path = img_path.with_suffix('.txt')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(caption)
            
        except Exception as e:
            print(f"Error processing {img_path.name}: {e}", file=sys.stderr)
            continue
    
    print(f"Captioning complete: {total} images processed", flush=True)


if __name__ == "__main__":
    main()
