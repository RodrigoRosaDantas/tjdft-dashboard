import PortuguesRlmDetailClient from "../portugues-rlm-detail-client";

export const dynamicParams = false;

const codes = [
  "P01", "P02", "P03", "RL01", "P04", "REV01", "P05", "P06", "RL02", "P07", "P08", "REV02",
  "P09", "RL03", "P10", "P11", "P12", "REV03", "RL04", "P13", "P14", "P15", "RL05", "REV04",
  "P16", "P17", "P18", "RL06", "RL07", "REV05", "RL08", "RL09", "RL10", "RL11", "RL12", "REV06", "RL13",
];

export function generateStaticParams() {
  return codes.map((code) => ({ code: code.toLowerCase() }));
}

export default async function PortuguesRlmDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PortuguesRlmDetailClient code={code} />;
}
