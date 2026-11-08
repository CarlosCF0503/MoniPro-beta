// Reteste do CT-11 após o PR #27: o perfil do aluno de teste deve informar a pontuação.
import { appendFileSync } from 'node:fs';

const saida = process.argv[2];
const linhas = [`\n### ${new Date().toISOString()} — reteste do CT-11 após o PR #27`];
const reg = (l) => { linhas.push(l); console.log(l); };

for (const base of ['https://dev.moni-pro.app.br', 'https://moni-pro.app.br']) {
    reg(`== ${base}`);
    const login = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: 'ct.aluno1.41813@teste.invalid', senha: process.env.SENHA_TESTE, tipo_usuario: 'aluno' })
    });
    const { token, usuario } = await login.json();
    reg(`  POST /auth/login (aluno de teste 1) → ${login.status}, id ${usuario?.id}`);
    if (!token) continue;
    const perfil = await fetch(`${base}/perfil`, { headers: { Authorization: `Bearer ${token}` } });
    const p = await perfil.json();
    reg(`  GET /perfil → ${perfil.status} ${JSON.stringify({ id: p.user?.id, nome_completo: p.user?.nome_completo, pontos: p.user?.pontos })}`);
    const ranking = await fetch(`${base}/disciplinas/1/ranking`, { headers: { Authorization: `Bearer ${token}` } });
    const r = await ranking.json();
    const noRanking = (r.ranking || []).find((u) => u.id === usuario.id)?.pontos;
    reg(`  GET /disciplinas/1/ranking → ${ranking.status}, pontos do aluno ${noRanking}`);
    const ok = perfil.status === 200 && p.user?.pontos === 10 && noRanking === 10;
    reg(`  [${ok ? 'OK' : 'FALHOU'}] CT-11: perfil informa a pontuação (10), igual à do ranking`);
}
appendFileSync(saida, linhas.join('\n') + '\n');
