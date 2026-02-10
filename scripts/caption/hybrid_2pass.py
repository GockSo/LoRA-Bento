#!/usr/bin/env python3
"""
Hybrid 2-Pass Captioner
Combines tagger output (tags) + captioner output (natural language) into merged captions
"""

import argparse
import json
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path


def run_tagger(args, temp_dir):
    """Run tagger and collect results"""
    import os
    script_dir = Path(__file__).parent
    tagger_script = script_dir / 'tagger_wd14.py'
    
    cmd = [
        sys.executable,
        str(tagger_script),
        '--input_dir', str(temp_dir),
        '--model', args.tagger_model,
        '--threshold', str(args.tag_threshold),
        '--max_tags', str(args.max_tags),
        '--order', args.tag_order,
    ]
    
    if args.tag_normalize:
        cmd.append('--normalize')
    
    if args.tag_blacklist:
        cmd.extend(['--blacklist', args.tag_blacklist])
    
    if args.tag_whitelist:
        cmd.extend(['--whitelist', args.tag_whitelist])
    
    # Don't add trigger word here, we'll add it during merge
    
    print(f"[Hybrid Pass 1/2] Running tagger ({args.tagger_model})...", flush=True)
    
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
    
    stderr_lines = []
    for line in proc.stdout:
        if line.startswith('PROGRESS:'):
            # Re-emit progress with pass indicator
            progress_data = json.loads(line.replace('PROGRESS:', ''))
            progress_data['current_file'] = f"[Pass 1/2 Tagging] {progress_data.get('current_file', '')}"
            print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)
        else:
            print(f"[Tagger] {line.strip()}", flush=True)
    
    # Capture stderr
    stderr_output = proc.stderr.read()
    proc.wait()
    
    if proc.returncode != 0:
        error_msg = f"Tagger failed with code {proc.returncode}"
        if stderr_output:
            error_msg += f"\nError details: {stderr_output}"
        print(error_msg, file=sys.stderr, flush=True)
        raise Exception(error_msg)


def run_captioner(args, temp_dir):
    """Run captioner and collect results"""
    script_dir = Path(__file__).parent
    
    # Map captioner model to script
    script_map = {
        'blip': 'caption_blip_legacy.py',
        'blip2': 'caption_blip2.py',
        'florence2': 'caption_florence2.py'
    }
    
    captioner_script = script_dir / script_map[args.captioner_model]
    
    cmd = [
        sys.executable,
        str(captioner_script),
        '--input_dir', str(temp_dir),
        '--style', args.caption_style,
        '--format', 'sentence',  # Always generate sentence for hybrid
    ]
    
    if args.avoid_generic:
        cmd.append('--avoid_generic')
    
    # Don't add trigger word here either
    
    print(f"[Hybrid Pass 2/2] Running captioner ({args.captioner_model})...", flush=True)
    
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
    
    for line in proc.stdout:
        if line.startswith('PROGRESS:'):
            progress_data = json.loads(line.replace('PROGRESS:', ''))
            progress_data['current_file'] = f"[Pass 2/2 Captioning] {progress_data.get('current_file', '')}"
            print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)
        else:
            print(f"[Captioner] {line.strip()}", flush=True)
    
    # Capture stderr
    stderr_output = proc.stderr.read()
    proc.wait()
    
    if proc.returncode != 0:
        error_msg = f"Captioner ({args.captioner_model}) failed with code {proc.returncode}"
        if stderr_output:
            error_msg += f"\nError details: {stderr_output}"
        print(error_msg, file=sys.stderr, flush=True)
        raise Exception(error_msg)


def merge_outputs(input_dir, temp_dir, args):
    """Merge tagger and captioner outputs"""
    print("[Hybrid] Merging tagger + captioner outputs...", flush=True)
    
    # Read all .txt files from temp_dir
    temp_path = Path(temp_dir)
    txt_files = list(temp_path.glob('*.txt'))
    
    for txt_file in txt_files:
        # The .txt file now contains caption from pass 2
        # We need to recover tags from tagger (we'll store them in a temp location)
        
        # Actually, both passes write to the same .txt file, overwriting each other
        # We need a different approach: save tagger output to a separate location
        pass
    
    # Better approach: Read outputs after each pass
    tagger_outputs = {}
    captioner_outputs = {}
    
    # This won't work because the second pass overwrites the first
    # Let me redesign the approach


def main():
    parser = argparse.ArgumentParser(description='Hybrid 2-Pass Captioner')
    parser.add_argument('--input_dir', type=str, required=True, help='Directory containing images')
    
    # Tagger args
    parser.add_argument('--tagger_model', type=str, default='convnext',
                       choices=['legacy', 'convnext', 'swinv2'])
    parser.add_argument('--tag_threshold', type=float, default=0.35)
    parser.add_argument('--max_tags', type=int, default=40)
    parser.add_argument('--tag_blacklist', type=str, default='')
    parser.add_argument('--tag_whitelist', type=str, default='')
    parser.add_argument('--tag_normalize', action='store_true')
    parser.add_argument('--tag_order', type=str, default='confidence',
                       choices=['confidence', 'alphabetical', 'model'])
    
    # Captioner args
    parser.add_argument('--captioner_model', type=str, default='florence2',
                       choices=['blip', 'blip2', 'florence2'])
    parser.add_argument('--caption_style', type=str, default='short',
                       choices=['short', 'medium', 'detailed'])
    parser.add_argument('--avoid_generic', action='store_true')
    
    # Hybrid-specific args
    parser.add_argument('--merge_format', type=str, default='trigger_tags_caption',
                       choices=['trigger_tags_caption', 'trigger_caption_tags', 'tags_only'])
    parser.add_argument('--dedupe', action='store_true',
                       help='Remove duplicate words between tags and caption')
    parser.add_argument('--max_length', type=int, default=220,
                       help='Maximum caption length in characters')
    parser.add_argument('--trigger', type=str, default='',
                       help='Trigger word to prepend')
    parser.add_argument('--shuffle', action='store_true',
                       help='Shuffle tags (preserving trigger)')
    parser.add_argument('--keep_tokens', type=int, default=1)
    
    args = parser.parse_args()
    
    # Configure stdout
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    
    print("Starting Hybrid 2-Pass Captioning", flush=True)
    
    # Create temp directories for each pass
    with tempfile.TemporaryDirectory() as temp_root:
        temp_root_path = Path(temp_root)
        tagger_temp = temp_root_path / 'tagger_output'
        captioner_temp = temp_root_path / 'captioner_output'
        tagger_temp.mkdir()
        captioner_temp.mkdir()
        
        # Copy images to both temp dirs
        input_dir = Path(args.input_dir)
        image_files = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
            image_files.extend(input_dir.glob(ext))
            image_files.extend(input_dir.glob(ext.upper()))
        
        for img in image_files:
            shutil.copy2(img, tagger_temp / img.name)
            shutil.copy2(img, captioner_temp / img.name)
        
        # Run tagger pass
        run_tagger(args, tagger_temp)
        
        # Collect tagger outputs
        tagger_outputs = {}
        for txt_file in tagger_temp.glob('*.txt'):
            with open(txt_file, 'r', encoding='utf-8') as f:
                tagger_outputs[txt_file.stem] = f.read().strip()
        
        # Run captioner pass
        run_captioner(args, captioner_temp)
        
        # Collect captioner outputs
        captioner_outputs = {}
        for txt_file in captioner_temp.glob('*.txt'):
            with open(txt_file, 'r', encoding='utf-8') as f:
                captioner_outputs[txt_file.stem] = f.read().strip()
        
        # Merge outputs
        print("[Hybrid] Merging outputs...", flush=True)
        
        for img in image_files:
            stem = img.stem
            tags_text = tagger_outputs.get(stem, '')
            caption_text = captioner_outputs.get(stem, '')
            
            # Parse tags into list
            tags = [t.strip() for t in tags_text.split(',') if t.strip()]
            
            # Merge based on format
            if args.merge_format == 'tags_only':
                merged = tags
            elif args.merge_format == 'trigger_tags_caption':
                merged = tags + [caption_text] if caption_text else tags
            elif args.merge_format == 'trigger_caption_tags':
                merged = [caption_text] + tags if caption_text else tags
            else:
                merged = tags
            
            # Deduplicate if requested
            if args.dedupe and len(merged) > 1:
                # Convert to lowercase for comparison, preserve original case
                seen = set()
                deduped = []
                for item in merged:
                    item_lower = item.lower()
                    if item_lower not in seen:
                        seen.add(item_lower)
                        deduped.append(item)
                merged = deduped
            
            # Shuffle tags if requested (preserve first keep_tokens)
            if args.shuffle and len(merged) > args.keep_tokens:
                import random
                keep = merged[:args.keep_tokens]
                shuffle_part = merged[args.keep_tokens:]
                random.shuffle(shuffle_part)
                merged = keep + shuffle_part
            
            # Add trigger word at the beginning
            if args.trigger:
                merged.insert(0, args.trigger)
            
            # Join and truncate to max length
            final_caption = ', '.join(merged)
            if len(final_caption) > args.max_length:
                # Truncate at last complete tag
                final_caption = final_caption[:args.max_length]
                last_comma = final_caption.rfind(',')
                if last_comma > 0:
                    final_caption = final_caption[:last_comma]
            
            # Write to output
            output_path = img.with_suffix('.txt')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(final_caption)
    
    print("Hybrid captioning complete", flush=True)


if __name__ == "__main__":
    main()
