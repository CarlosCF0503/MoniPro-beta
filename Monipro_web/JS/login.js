// monipro-web/JS/login.js

import { showToast, mensagemDaApi } from './toast.js';
import { chamadaApi } from './api.js';
import { montarAcoesConfirmacao } from './confirmacao_email.js';

const SVG_OLHO_ABERTO = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const SVG_OLHO_FECHADO = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

const LOGIN_COORDENACAO = 'index.html?perfil=coordenacao';

/** Plano 7: login e "Esqueci minha senha" só com o perfil Coordenação (ver o comentário abaixo). */
function aplicarModoCoordenacao() {
    const radio = document.getElementById('radioCoordenacao');
    if (!radio) return;
    radio.checked = true;
    const secao = radio.closest('.profile-section');
    if (secao) secao.hidden = true;
    const texto = {
        tituloLogin: 'Painel da coordenação',
        subtituloLogin: 'Entre com o e-mail ou a matrícula da sua conta.'
    };
    for (const [id, valor] of Object.entries(texto)) {
        const alvo = document.getElementById(id);
        if (alvo) alvo.textContent = valor;
    }
    const visivel = { linkCadastro: false, linkVoltarPublico: true, acessoCoordenacao: false };
    for (const [id, mostrar] of Object.entries(visivel)) {
        const alvo = document.getElementById(id);
        if (alvo) alvo.hidden = !mostrar;
    }
    document.querySelectorAll('a.esqueci').forEach((a) => {
        a.href = 'redefinir_senha.html?perfil=coordenacao';
    });
    // Em "Esqueci minha senha", os links "Voltar ao login" voltam para o login da coordenação
    document.querySelectorAll('a[href="index.html"]:not(#linkVoltarPublico a)').forEach((a) => {
        a.href = LOGIN_COORDENACAO;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Toggle de senha — troca o conteúdo do SVG ao clicar
    document.querySelectorAll('.olho').forEach((olho) => {
        olho.addEventListener('click', function () {
            const input =
                document.getElementById(this.dataset.target) ||
                this.parentElement.querySelector('input');
            const svg = this.querySelector('svg');
            if (input.type === 'password') {
                input.type = 'text';
                svg.innerHTML = SVG_OLHO_FECHADO;
                this.setAttribute('aria-label', 'Esconder senha');
            } else {
                input.type = 'password';
                svg.innerHTML = SVG_OLHO_ABERTO;
                this.setAttribute('aria-label', 'Mostrar senha');
            }
        });
    });

    // Plano 7 (RN-014): a coordenação entra por /coordenacao (o Nginx leva a ?perfil=coordenacao)
    // ou pelo link "Acesso da coordenação" do rodapé. Nesse modo o perfil já vem marcado e a
    // escolha some (aqui e em Esqueci minha senha), junto com o "Cadastre-se", que não vale para
    // a coordenação. A conta continua só sendo criada no servidor.
    if (new URLSearchParams(window.location.search).get('perfil') === 'coordenacao')
        aplicarModoCoordenacao();

    // IDs alinhados com o index.html: formLogin, inputIdentificador, inputSenha
    const formLogin = document.getElementById('formLogin');

    if (!formLogin) return;

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identificadorInput = document.getElementById('inputIdentificador');
        const senhaInput = document.getElementById('inputSenha');
        const tipoUsuarioInput = document.querySelector('input[name="tipo_usuario"]:checked');

        if (!identificadorInput?.value.trim() || !senhaInput?.value || !tipoUsuarioInput) {
            showToast('Preencha todos os campos.', 'error');
            return;
        }

        const aviso = document.getElementById('avisoConfirmar');
        if (aviso) aviso.hidden = true;

        const btnSubmit = document.getElementById('entrar');
        btnSubmit.value = 'Aguarde...';
        btnSubmit.disabled = true;

        try {
            // chamadaApi (api.js) trata resposta não-JSON e registra falhas no console
            const dados = await chamadaApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    identificador: identificadorInput.value.trim(),
                    senha: senhaInput.value,
                    tipo_usuario: tipoUsuarioInput.value
                })
            });

            if (dados.success) {
                // P3 (R7): a sessão ficou no cookie httpOnly que a API gravou; nada a guardar aqui
                showToast('Login realizado com sucesso!', 'success');
                // Plano 7: a coordenação vai direto para o painel
                const destino =
                    dados.usuario && dados.usuario.tipo === 'coordenador'
                        ? 'painel.html'
                        : 'base.html';
                setTimeout(() => {
                    window.location.href = destino;
                }, 1000);
            } else if (dados.codigo === 'email_nao_confirmado' && aviso) {
                // Plano 14 (RF-018): só chega aqui com a senha certa
                montarAcoesConfirmacao(document.getElementById('acoesConfirmacao'), {
                    identificador: identificadorInput.value.trim(),
                    senha: senhaInput.value,
                    tipo_usuario: tipoUsuarioInput.value
                });
                aviso.hidden = false;
                aviso.focus();
            } else {
                showToast(mensagemDaApi(dados, 'Credenciais inválidas.'), 'error', dados);
            }
        } catch (error) {
            showToast('Erro de conexão com o servidor.', 'error', error);
        } finally {
            btnSubmit.value = 'Entrar';
            btnSubmit.disabled = false;
        }
    });
});
