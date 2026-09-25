import { summarizeActiveErrors } from "./error-counts.ts";

Deno.test("banco vazio não vira zero erro ativo", () => {
  const result = summarizeActiveErrors([]);
  if (result.records_present !== false || result.active_count !== null) {
    throw new Error("Sem registros, a contagem ativa deve permanecer não calculável.");
  }
});

Deno.test("registros classificados e encerrados sustentam zero erros ativos", () => {
  const result = summarizeActiveErrors(["Resolvido", "Arquivado", "Fechado"]);
  if (result.records_present !== true || result.active_count !== 0) {
    throw new Error("Registros encerrados permitem concluir que não há erro ativo.");
  }
});

Deno.test("erro ativo é contado quando a situação está classificada", () => {
  const result = summarizeActiveErrors(["Aberto", "Em revisão"]);
  if (result.active_count !== 2) throw new Error("Os registros ativos classificados devem ser contados.");
});

Deno.test("situação ausente impede concluir que o total ativo é zero", () => {
  const result = summarizeActiveErrors(["", "Aberto"]);
  if (result.records_present !== true || result.active_count !== null) {
    throw new Error("Um registro sem situação torna a contagem ativa incompleta.");
  }
});