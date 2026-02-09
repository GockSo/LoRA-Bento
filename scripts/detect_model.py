import sys
import os
import json
import argparse
from typing import Dict, Any, List, Optional

def detect_model(checkpoint_path: str, repo_path: str) -> Dict[str, Any]:
    """
    Detects the model family from a checkpoint file and recommends a trainer script.
    """
    if not os.path.exists(checkpoint_path):
        return {
            "supported": False,
            "reason": "Checkpoint file not found",
            "modelFamily": "Unknown"
        }

    filename = os.path.basename(checkpoint_path).lower()
    ext = os.path.splitext(filename)[1]
    
    model_family = "Unknown"
    supported = False
    recommended_script = ""
    reason = ""

    # 1. Metadata/Header Analysis
    try:
        if ext == ".safetensors":
            from safetensors.torch import load_file
            # We only need the header/metadata, but safetensors.torch doesn"t explicitly expose just header reading easily 
            # without a library update or custom parsing. However, we can use safe_open from safetensors.
            from safetensors import safe_open
            
            with safe_open(checkpoint_path, framework="pt", device="cpu") as f:
                metadata = f.metadata()
                keys = f.keys()
                
                # Metadata-based heuristics
                if metadata:
                    # Some models specifically tag their architecture
                    # This is model-specific and not standardized, but we can look for clues
                    meta_str = str(metadata).lower()
                    if "sdxl" in meta_str:
                        model_family = "SDXL"
                    elif "sd3" in meta_str or "stable-diffusion-v3" in meta_str:
                        model_family = "SD3"
                    elif "flux" in meta_str:
                        model_family = "FLUX"
                    elif "v1" in meta_str or "sd1" in meta_str:
                        model_family = "SD1.5" # Generic Bucket
                    elif "v2" in meta_str or "sd2" in meta_str:
                        model_family = "SD2.x"
                
                # Key-based heuristics (stronger fallbacks)
                if model_family == "Unknown":
                    has_conditioner = any(k.startswith("conditioner.embedders.1") for k in keys)
                    has_adm_in = any("adm_in" in k for k in keys) # Flux often has this? Or SD3?
                    # FLUX specific keys
                    is_flux = any(k.startswith("flux_") or "double_blocks" in k for k in keys)
                    
                    if has_conditioner:
                        model_family = "SDXL"
                    elif is_flux:
                        model_family = "FLUX"
                    elif any("model.diffusion_model" in k for k in keys) and any("cond_stage_model" in k for k in keys):
                        # SD1.5 or SD2.x
                        # Distinguishing SD1.5 vs SD2.1 usually requires checking checking tensor shapes 
                        # (e.g. text encoder output size 768 vs 1024), but for "trainer script" purposes, 
                        # they often share train_network.py. 
                        model_family = "SD1.x/2.x"
                    elif any("model.diffusion_model" in k for k in keys):
                         # Fallback for SD1/2 variants
                        model_family = "SD1.x/2.x"

        elif ext == ".ckpt":
            # CKPT is harder to parse without loading. 
            # Simple heuristic: try to torch.load the dict (cpu) - might be slow/heavy.
            # For now, let's treat it as generic SD1/2 unless we strictly know better, 
            # or try to load state_dict keys if possible.
            try:
                import torch
                # Load only the map location to avoid full weight loading if possible? 
                # torch.load loads everything. We can try loading with mmap if supported or just bite the bullet.
                # Given the user constraints, we might want to skip heavy loading if possible.
                checkpoint = torch.load(checkpoint_path, map_location="cpu")
                keys = checkpoint.keys()
                if "state_dict" in keys:
                    keys = checkpoint["state_dict"].keys()
                
                if any(k.startswith("conditioner.embedders.1") for k in keys):
                    model_family = "SDXL"
                elif any("model.diffusion_model" in k for k in keys):
                     model_family = "SD1.x/2.x"
                
                del checkpoint
                torch.cuda.empty_cache()
            except Exception as e:
                print(f"Error loading .ckpt: {e}", file=sys.stderr)
                # Fallback to SD1.5 as it"s most common for .ckpt
                model_family = "SD1.x/2.x (Assumed)"

    except Exception as e:
        reason = f"Error interpreting model: {str(e)}"
        print(f"Error: {e}", file=sys.stderr)

    # 4. Map to Script
    # Check what scripts exist in repo_path
    
    script_map = {
        "SD1.5": "train_network.py",
        "SD1.x/2.x": "train_network.py",
        "SD1.x/2.x (Assumed)": "train_network.py",
        "SD2.x": "train_network.py",
        "SDXL": "sdxl_train_network.py",
        "SD3": "sd3_train_network.py",
        "FLUX": "flux_train_network.py",
        "Hunyuan": "hunyuan_image_train_network.py",
        "Lumina": "lumina_train_network.py"
    }

    if model_family in script_map:
        recommended = script_map[model_family]
        # Verify existence
        potential_path = os.path.join(repo_path, recommended)
        if os.path.exists(potential_path):
            recommended_script = recommended
            supported = True
            reason = f"Detected {model_family}"
        else:
            supported = False
            reason = f"Detected {model_family} but script {recommended} not found in {repo_path}"
    else:
        supported = False
        if not reason:
            reason = "Could not identify model family or unsupported type."

    # Available scripts (simple list of all supported scripts found in folder)
    available_scripts = []
    known_scripts = set(script_map.values())
    try:
        if os.path.exists(repo_path):
            for f in os.listdir(repo_path):
                if f in known_scripts:
                   available_scripts.append(f)
    except Exception as e:
        print(f"Error scanning scripts: {e}", file=sys.stderr)

    return {
        "modelFamily": model_family,
        "supported": supported,
        "recommendedScript": recommended_script,
        "availableScripts": available_scripts,
        "reason": reason
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint_path", required=True)
    parser.add_argument("--repo_path", required=True)
    args = parser.parse_args()

    # Ensure safetensors is installed
    try:
        import safetensors
    except ImportError:
        print(json.dumps({
            "supported": False,
            "reason": "safetensors python library not found. Please install it."
        }))
        sys.exit(0)

    result = detect_model(args.checkpoint_path, args.repo_path)
    print(json.dumps(result))
