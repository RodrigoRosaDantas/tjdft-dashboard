import LawDetailClient from "./law-detail-client";

export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: 26 }, (_, index) => ({
    code: `l${String(index + 1).padStart(2, "0")}`,
  }));
}

export default async function LawDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LawDetailClient code={code} />;
}
