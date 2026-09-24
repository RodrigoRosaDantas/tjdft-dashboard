
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
const root=process.cwd();
const routes=["hoje","mentor","trilha","agenda","revisoes","erros","desempenho","riscos","tecnico","analista","qualidade-dados","sincronizacao","painel-legado"];
test("gera todas as rotas Study OS",async()=>{for(const r of routes) await access(path.join(root,"dist/client",r,"index.html"));});
test("home explicita ausência ≠ zero",async()=>{const html=await readFile(path.join(root,"dist/client/index.html"),"utf8");assert.match(html,/ausência nunca vira zero/i);assert.match(html,/Central de comando/);});
test("rotas estratégicas têm conteúdo",async()=>{for(const r of ["hoje","mentor","desempenho","riscos","tecnico","analista"]){const html=await readFile(path.join(root,"dist/client",r,"index.html"),"utf8");assert.ok(html.length>1000,r);}});
