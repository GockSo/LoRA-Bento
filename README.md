# LoRA Bento

Start-to-finish dataset preparation tool for Stable Diffusion LoRA training.  
Run locally, private, and fast.

## Features

- **Project Management**: Organize datasets in workspaces.
- **Import**: Drag & drop images or import folders.
- **Crop (Auto / Manual)**: Optional cropping to focus subject (supports multiple crops per image).
- **Augmentation**: Rotate, flip, and zoom to create variations.
- **Resize & Pad**: Smart resize + padding (Transparent / Solid / Blur) to target buckets (512 / 768 / 1024).
- **Captioning**: Auto-label with WD14 Tagger or BLIP (via local Python script).
- **Analysis & Export**: Review dataset stats and export training-ready dataset compatible with kohya-ss / sd-scripts.
- **Train LoRA (Local)**: Optional local training using kohya-ss `sd-scripts` (SD1.5/SD2/SDXL supported where applicable).

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+ (for captioning and some training workflows)
- Git (optional, for Auto Update / Local Trainer Setup)

> Captioning and training scripts may require additional Python dependencies (Torch, etc.)
> depending on the model and workflow you choose.

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
Run the dev server:

npm run dev
Open:
http://localhost:3000

## Workflow (Recommended)
Import

Create a project and add your raw images.

Crop (Optional)

Auto crop proposals → review → apply.

Or manual crop / “Use Raw” for specific images.

Augment (Optional)

Generate variations from the chosen input set (crop or skip-crop).

Resize & Pad

Resize all training images to your selected resolution with correct padding mode.

Outputs are stored in resized/.

Caption

Caption images from resized/.

Outputs are placed in train_data/ (images + .txt captions together).

Export

Export dataset from train_data/ (zip is created on demand).

Train (Optional)

Train locally using sd-scripts with the prepared dataset in train_data/.

Project Structure
projects/: Stores your datasets.

<id>/raw/: Original images (imported).

<id>/cropped/: Cropped variants per image.

<id>/skip_crop/: Images copied here when user chooses “Skip Crop”.

<id>/augmented/: Augmented outputs.

<id>/resized/: Final resized & padded images used for captioning/training.

<id>/train_data/: Training-ready dataset (images + .txt captions), structured for sd-scripts.

src/: Next.js source code.

scripts/: Local helper scripts (captioning/training integrations, etc.)

train_script/: Local trainer setup folder (e.g., kohya-ss sd-scripts clone)

# License & Usage
LoRA Bento is source-available.

✅ You are allowed to
Use the software for personal, hobby, educational, and non-commercial research purposes

Run it locally on your own machine

Share unmodified copies for free (with this license/credits intact)

❌ You are NOT allowed to
Sell the software (in whole or in part)

Offer it as part of a paid product or paid service

Host it as a commercial SaaS / cloud service

Distribute modified versions

Publish forks/patches/derivative builds

If you need commercial use or permission to modify/distribute changes, please contact the author for a separate license.

This project is not Open Source under the OSI definition (due to non-commercial and no-derivatives restrictions).

Credits & Donate
CivitAI: https://civitai.com/user/GockSo

GitHub: (link your repo here)

Donate (USDT): 0x333d2dF49dbB6d5a833576224Ee26537da136Fbc

© 2026 LoRA Bento contributors. All rights reserved.


## Ref
- https://github.com/kohya-ss/sd-scripts