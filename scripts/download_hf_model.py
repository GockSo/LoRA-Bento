#!/usr/bin/env python3
"""
Download Hugging Face models with real byte-level progress tracking.
Emits JSON progress events to stdout for consumption by Node.js backend.
"""

import sys
import json
import os
from pathlib import Path

try:
    from huggingface_hub import hf_hub_download, HfApi
except ImportError:
    # If huggingface_hub is not installed, emit error and exit
    print(json.dumps({
        "error": "huggingface_hub library not installed. Install with: pip install huggingface_hub"
    }), flush=True)
    sys.exit(1)


def report_progress(data):
    """Emit progress JSON to stdout"""
    print(json.dumps(data), flush=True)


def get_repo_files_info(repo_id):
    """Get list of files in repo with their sizes"""
    try:
        api = HfApi()
        repo_info = api.repo_info(repo_id=repo_id, repo_type="model")
        
        files_info = []
        total_size = 0
        
        for sibling in repo_info.siblings:
            # Only include actual model files we need
            # Skip .gitattributes, README, etc.
            if sibling.rfilename in ['model.onnx', 'selected_tags.csv', 'config.json']:
                files_info.append({
                    'filename': sibling.rfilename,
                    'size': sibling.size or 0
                })
                total_size += sibling.size or 0
        
        return files_info, total_size
    except Exception as e:
        report_progress({
            "error": f"Failed to fetch repo info: {str(e)}"
        })
        sys.exit(1)


def download_model(repo_id, local_dir):
    """Download model with byte-level progress tracking"""
    
    # Step 1: Fetch file list and calculate total size
    report_progress({
        "stage": "calculating_size",
        "status": "starting",
        "current_file": "Fetching file list...",
        "downloaded_bytes": 0,
        "total_bytes": 0,
        "progress": 0
    })
    
    files_info, total_bytes = get_repo_files_info(repo_id)
    
    if not files_info:
        report_progress({
            "error": "No model files found in repository"
        })
        sys.exit(1)
    
    report_progress({
        "stage": "ready",
        "status": "downloading",
        "current_file": "Starting download...",
        "downloaded_bytes": 0,
        "total_bytes": total_bytes,
        "progress": 0
    })
    
    # Step 2: Download files one by one
    downloaded_bytes = 0
    
    for file_info in files_info:
        filename = file_info['filename']
        file_size = file_info['size']
        
        report_progress({
            "stage": "downloading",
            "status": "downloading",
            "current_file": filename,
            "downloaded_bytes": downloaded_bytes,
            "total_bytes": total_bytes,
            "progress": round((downloaded_bytes / total_bytes * 100), 2) if total_bytes > 0 else 0
        })
        
        try:
            # Download the file
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=local_dir,
                local_dir_use_symlinks=False
            )
            
            # Update progress after successful download
            downloaded_bytes += file_size
            
            report_progress({
                "stage": "downloading",
                "status": "downloading",
                "current_file": filename,
                "downloaded_bytes": downloaded_bytes,
                "total_bytes": total_bytes,
                "progress": round((downloaded_bytes / total_bytes * 100), 2) if total_bytes > 0 else 0
            })
            
        except Exception as e:
            report_progress({
                "error": f"Failed to download {filename}: {str(e)}"
            })
            sys.exit(1)
    
    # Step 3: Download complete
    report_progress({
        "stage": "completed",
        "status": "completed",
        "current_file": "Download complete",
        "downloaded_bytes": total_bytes,
        "total_bytes": total_bytes,
        "progress": 100
    })


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({
            "error": "Usage: download_hf_model.py <repo_id> <local_dir>"
        }), flush=True)
        sys.exit(1)
    
    repo_id = sys.argv[1]
    local_dir = sys.argv[2]
    
    # Create local directory if it doesn't exist
    Path(local_dir).mkdir(parents=True, exist_ok=True)
    
    download_model(repo_id, local_dir)
