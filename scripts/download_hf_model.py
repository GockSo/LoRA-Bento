#!/usr/bin/env python3
"""
Download Hugging Face models with real byte-level progress tracking.
Emits JSON progress events to stdout for consumption by Node.js backend.
"""

import sys
import json
import os
import time
from pathlib import Path

try:
    import requests
    from huggingface_hub import HfApi, hf_hub_url
except ImportError:
    # If libraries are not installed, emit error and exit
    print(json.dumps({
        "error": "Required libraries not installed. Install with: pip install huggingface_hub requests"
    }), flush=True)
    sys.exit(1)


def report_progress(data):
    """Emit progress JSON to stdout"""
    try:
        print(json.dumps(data), flush=True)
    except BrokenPipeError:
        # Parent process closed the pipe, exit silently
        sys.exit(0)


def get_repo_files_info(repo_id):
    """Get list of files in repo with their sizes"""
    try:
        api = HfApi()
        repo_info = api.repo_info(repo_id=repo_id, repo_type="model")
        
        files_to_download = []
        total_size = 0
        
        for sibling in repo_info.siblings:
            # Only include actual model files we need
            # Skip .gitattributes, README, etc.
            if sibling.rfilename in ['model.onnx', 'selected_tags.csv', 'config.json']:
                files_to_download.append({
                    'filename': sibling.rfilename,
                    'size': sibling.size or 0
                })
                total_size += sibling.size or 0
        
        return files_to_download, total_size
    except Exception as e:
        report_progress({
            "error": f"Failed to fetch repo info: {str(e)}"
        })
        sys.exit(1)


def download_file(url, dest_path, filename, file_size, current_downloaded_bytes, total_downloaded_bytes, total_bytes):
    """Download a single file with streaming and progress updates"""
    try:
        # Create directory if it doesn't exist
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        response = requests.get(url, stream=True, allow_redirects=True)
        response.raise_for_status()
        
        # If file size was unknown (0), try to get it from headers
        if file_size == 0:
            content_length = response.headers.get('content-length')
            if content_length:
                file_size = int(content_length)
                # Adjust total size if we now know more
                total_bytes += file_size
        
        file_downloaded = 0
        chunk_size = 1024 * 1024  # 1MB chunks for smoother UI updates
        
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    file_downloaded += len(chunk)
                    
                    # Update global progress
                    current_total_downloaded = total_downloaded_bytes + file_downloaded
                    
                    # Calculate percentage
                    progress = 0
                    if total_bytes > 0:
                        progress = round((current_total_downloaded / total_bytes * 100), 2)
                    
                    report_progress({
                        "stage": "downloading",
                        "status": "downloading",
                        "current_file": filename,
                        "downloaded_bytes": current_total_downloaded,
                        "total_bytes": total_bytes,
                        "progress": progress
                    })
        
        return file_downloaded
        
    except Exception as e:
        raise Exception(f"Failed to download {filename}: {str(e)}")


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
    
    files_info, total_repo_bytes = get_repo_files_info(repo_id)
    
    if not files_info:
        report_progress({
            "error": "No model files found in repository"
        })
        sys.exit(1)
    
    # Report initial size
    report_progress({
        "stage": "ready",
        "status": "downloading",
        "current_file": "Starting download...",
        "downloaded_bytes": 0,
        "total_bytes": total_repo_bytes,
        "progress": 0
    })
    
    # Step 2: Download files one by one
    total_downloaded = 0
    
    for file_info in files_info:
        filename = file_info['filename']
        file_size = file_info['size']
        dest_path = Path(local_dir) / filename
        
        # Get download URL
        url = hf_hub_url(repo_id=repo_id, filename=filename)
        
        try:
            downloaded = download_file(
                url, 
                dest_path, 
                filename, 
                file_size,
                0, 
                total_downloaded, 
                total_repo_bytes
            )
            total_downloaded += downloaded
            
        except Exception as e:
            report_progress({
                "error": str(e)
            })
            sys.exit(1)
    
    # Step 3: Download complete
    report_progress({
        "stage": "completed",
        "status": "completed",
        "current_file": "Download complete",
        "downloaded_bytes": total_downloaded,
        "total_bytes": total_repo_bytes,
        "progress": 100
    })


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({
            "error": "Usage: download_hf_model.py <repo_id> <local_dir>"
        }), flush=True)
        sys.exit(1)
    
    repo_id_arg = sys.argv[1]
    local_dir_arg = sys.argv[2]
    
    # Create local directory if it doesn't exist
    Path(local_dir_arg).mkdir(parents=True, exist_ok=True)
    
    download_model(repo_id_arg, local_dir_arg)
