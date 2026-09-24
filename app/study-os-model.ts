import dashboard from "@/public/data/tjdft-snapshot.json";
import portuguese from "@/public/data/portugues-rlm.json";
import laws from "@/public/data/leis-primeiro.json";
import edital from "@/public/data/tjdft-edital.json";
import { buildTJDFTIntelligence } from "./intelligence/tjdft-intelligence.mjs";

export function getStudyOsModel() {
  return buildTJDFTIntelligence({ dashboard, portuguese, laws, edital });
}
