// WD Tagger Model Definitions
import { WDModel, WDModelDefinition } from '@/types/wd-models';

export const WD_MODELS: WDModelDefinition[] = [
    {
        key: 'wd-v1-4-convnext-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
        label: 'WD v1.4 ConvNeXt (Recommended)',
        files: [
            'model.onnx',
            'selected_tags.csv'
        ],
        size_mb: 255
    },
    {
        key: 'wd-v1-4-moat-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-moat-tagger-v2',
        label: 'WD v1.4 MoAT (SwinV2)',
        files: [
            'model.onnx',
            'selected_tags.csv'
        ],
        size_mb: 344
    },
    {
        key: 'wd-eva02-large-tagger-v3',
        repo_id: 'SmilingWolf/wd-eva02-large-tagger-v3',
        label: 'WD EVA02-Large v3 (Best Quality)',
        files: [
            'model.onnx',
            'selected_tags.csv'
        ],
        size_mb: 921
    },
    {
        key: 'wd-v1-4-vit-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-vit-tagger-v2',
        label: 'WD v1.4 ViT',
        files: [
            'model.onnx',
            'selected_tags.csv'
        ],
        size_mb: 312
    }
];

export function getModelByKey(key: WDModel): WDModelDefinition | undefined {
    return WD_MODELS.find(m => m.key === key);
}

export function getModelLabelByKey(key: WDModel): string {
    const model = getModelByKey(key);
    return model?.label || key;
}
