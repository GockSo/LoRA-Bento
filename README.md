# LoRA Bento

Start-to-finish dataset preparation tool for Stable Diffusion LoRA training.
Run locally, private, and fast.

## Features

- **Project Management**: Organize datasets in workspaces.
- **Import**: Drag & Drop images or import folders.
- **Augmentation**: Rotate, flip, and zoom to create variations.
- **Preprocessing**: Smart resize and padding (Transparent/Solid/Blur) to target buckets (512, 768, etc).
- **Captioning**: Auto-label with WD14 Tagger or BLIP (via local Python script).
- **Analysis**: Keyword frequency analysis and prompt helper.
- **Export**: Generate ready-to-train datasets (Images + Text files) compatible with Kohya-ss.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (for captioning) installed and in your PATH.
- `pip install torch torchvision torchaudio` (and other dependencies for your chosen caption script).
  *Note: The included `scripts/caption.py` is a stub. You need to provide a real captioning script or install dependencies if using a real one.*

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. git clone https://github.com/kohya-ss/sd-scripts
   
5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Workflow

1. **Import**: Create a project and drop your raw images.
2. **Augment**: (Optional) Generate variations to increase dataset size.
3. **Resize**: Convert all images to standard resolutions (e.g., 512x512) with smart padding.
4. **Caption**: Run the auto-captioner. Edit generated text files if needed.
5. **Export**: Download the ZIP file and use it in your favorite LoRA trainer.

## Project Structure

- `projects/`: Stores your datasets.
  - `<id>/raw`: Original images.
  - `<id>/augmented`: Augmented images.
  - `<id>/processed`: Ready-to-train images and text files.
- `src/`: Next.js source code.
- `scripts/`: Python helper scripts.

## License& Usage

LoRA Bento is a source-available project.

You are free to:

Use the software for personal, hobby, and research purposes

Run it locally on your own machine

Read, modify, and experiment with the source code

However, commercial use is NOT permitted.

❌ Prohibited Uses

The following are not allowed without explicit written permission from the project author:

Selling the software, in whole or in part

Offering it as part of a paid product or service

Hosting it as a commercial SaaS / cloud service

Redistributing modified versions for commercial purposes

✅ Allowed Uses

Personal dataset preparation

Non-commercial research and experimentation

Educational use

Local workflows for training personal models

If you are interested in commercial use, redistribution, or SaaS licensing,
please contact the project author to discuss a separate commercial license.

License Type

This project uses a Non-Commercial Source-Available License.

This project is not Open Source under the OSI definition,
but the source code is publicly available to ensure transparency, learning, and community collaboration.

Why this license?

LoRA Bento is designed to support creators, researchers, and the open ML community,
while preventing closed-source commercial exploitation without contribution.

This license ensures:

Free access for individual creators

Protection against uncredited commercial reuse

A sustainable path for future development

© 2026 LoRA Bento contributors. All rights reserved.
Commercial use requires explicit permission.
