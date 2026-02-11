import CaptionClient from './caption-client';

export default function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
    return <CaptionClient params={params} />;
}
