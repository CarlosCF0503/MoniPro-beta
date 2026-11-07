// JS/disciplina/cadastro.js
// Tela "Nova disciplina" (cadastro_disciplina.html). Só monitores chegam aqui pelo botão de
// Minhas Disciplinas; quem abre o endereço direto sem ser monitor volta para a lista.
/* global DisciplinaRegras, chamadaApi, mensagemDaApi, showToast */

document.addEventListener('DOMContentLoaded', () => {
    const R = DisciplinaRegras;
    const LISTA = 'escolha_disciplina.html';

    // --- 1. Acesso ---
    const token = localStorage.getItem('monipro_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    const perfil = R.perfilDoToken(token);
    if (!perfil) {
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }
    if (perfil !== 'monitor') {
        showToast('Apenas monitores podem cadastrar disciplinas.', 'error');
        setTimeout(() => {
            window.location.href = LISTA;
        }, 1500);
        return;
    }

    // --- 2. Elementos ---
    const form = document.getElementById('form-disciplina');
    const input = document.getElementById('nome-disciplina');
    const caixa = document.getElementById('caixa-nome');
    const erro = document.getElementById('erro-nome');
    const contador = document.getElementById('contador-nome');
    const aviso = document.getElementById('aviso-repetida');
    const avisoTexto = document.getElementById('aviso-repetida-texto');
    const titulosExistentes = document.getElementById('titulo-existentes');
    const tags = document.getElementById('tags-existentes');
    const botao = document.getElementById('btn-cadastrar');
    const rotuloBotao = botao.textContent;

    form.hidden = false;
    let existentes = [];
    let enviando = false;

    // --- 3. Exibição ---
    function mostrarErro(mensagem) {
        erro.textContent = mensagem || '';
        caixa.classList.toggle('invalido', Boolean(mensagem));
        if (mensagem) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
    }

    function desenharExistentes() {
        const repetida = R.acharRepetida(existentes, input.value);
        titulosExistentes.textContent = `Disciplinas já cadastradas (${existentes.length})`;
        tags.textContent = '';
        R.ordenar(existentes).forEach((d) => {
            const li = document.createElement('li');
            li.textContent = d.nome;
            if (repetida && d.id === repetida.id) li.className = 'repetida';
            tags.appendChild(li);
        });
    }

    function atualizar() {
        const n = input.value.length;
        contador.textContent = `${n}/${R.NOME_MAXIMO}`;
        contador.classList.toggle('perto-do-limite', n >= R.NOME_MAXIMO - 5);
        const repetida = R.acharRepetida(existentes, input.value);
        aviso.hidden = !repetida;
        if (repetida) avisoTexto.textContent = `Já existe: ${repetida.nome}`;
        desenharExistentes();
    }

    function marcarEnviando(ligado) {
        enviando = ligado;
        botao.disabled = ligado;
        botao.setAttribute('aria-busy', String(ligado));
        botao.textContent = '';
        if (ligado) {
            const giro = document.createElement('span');
            giro.className = 'giro';
            giro.setAttribute('aria-hidden', 'true');
            botao.append(giro, 'Cadastrando…');
        } else {
            botao.textContent = rotuloBotao;
        }
    }

    // --- 4. Lista para o aviso de repetida (se falhar, a tela funciona sem o aviso) ---
    async function carregarExistentes() {
        try {
            const r = await chamadaApi('/disciplinas');
            if (r.statusHttp === 401) return sessaoExpirada();
            if (r.statusHttp >= 400) throw new Error(mensagemDaApi(r, 'Erro ao listar.'));
            existentes = Array.isArray(r.disciplinas) ? r.disciplinas : [];
        } catch (e) {
            console.warn('[MoniPro] Lista de disciplinas indisponível:', e.message);
            titulosExistentes.textContent =
                'Não foi possível carregar as disciplinas já cadastradas.';
            return;
        }
        atualizar();
    }

    function sessaoExpirada() {
        localStorage.removeItem('monipro_token');
        showToast('Sua sessão expirou. Entre de novo.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }

    // --- 5. Envio ---
    input.addEventListener('input', () => {
        mostrarErro('');
        atualizar();
    });

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        const nome = R.limpar(input.value);
        const invalido = R.validarNome(nome);
        if (invalido) {
            mostrarErro(invalido);
            input.focus();
            return;
        }

        mostrarErro('');
        marcarEnviando(true);
        let r;
        try {
            r = await chamadaApi('/disciplinas', {
                method: 'POST',
                body: JSON.stringify({ nome })
            });
        } catch (e) {
            marcarEnviando(false);
            showToast('Não foi possível conectar ao servidor.', 'error', e);
            return;
        }

        if (r.statusHttp === 201 && r.disciplina) {
            showToast('Disciplina criada com sucesso.', 'success');
            const { id, nome: salvo } = r.disciplina;
            // Segue para criar a primeira vaga da disciplina nova (o botão continua desativado)
            setTimeout(() => {
                window.location.href =
                    'marcar_monitoria.html?disciplinaID=' +
                    encodeURIComponent(id) +
                    '&disciplinaNome=' +
                    encodeURIComponent(salvo);
            }, 800);
            return;
        }

        marcarEnviando(false);
        if (r.statusHttp === 401) return sessaoExpirada();
        if (r.statusHttp === 403) {
            showToast(mensagemDaApi(r, 'Apenas monitores podem cadastrar disciplinas.'), 'error');
            return;
        }
        // 400 e 409: a mensagem fica junto ao campo, que não some como o toast
        const mensagem =
            (r.campos && r.campos.nome) || mensagemDaApi(r, 'Não foi possível cadastrar.');
        mostrarErro(mensagem);
        input.focus();
        // Outro monitor pode ter cadastrado no meio tempo: atualiza a lista do aviso
        if (r.statusHttp === 409) carregarExistentes();
    });

    atualizar();
    carregarExistentes();
    input.focus();
});
