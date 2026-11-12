// Lista de disciplinas: porte de Monipro_web/escolha_disciplina.html + JS/escolha_disciplina.js.
// Cabeçalho, menu lateral, aviso de sair e toast vêm da Casca.
import { useEffect, useState } from 'react';
// Mesmos arquivos e mesma ordem dos <link> do original (o base.css vem da Casca)
import '../../../Monipro_web/CSS/fontes.css';
import '../../../Monipro_web/CSS/legal.css';
import Casca from '../Casca.jsx';
import '../../../Monipro_web/CSS/escolha_disciplina.css';
import iconeDisciplina from '../../../Monipro_web/IMG/Icone_Disciplina.png';
import { chamadaApi, mensagemDaApi, obterSessao } from '../api.js';

const propsIcone = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    'aria-hidden': true
};

export default function EscolhaDisciplina() {
    // disciplinas === null e erro === null: ainda carregando (o "Carregando..." do HTML original)
    const [estado, setEstado] = useState({ ehMonitor: false, disciplinas: null, erro: null });
    const { ehMonitor, disciplinas, erro } = estado;

    useEffect(() => {
        let ativo = true;
        // A sessão e a lista são pedidas juntas; falha na sessão só esconde o botão.
        Promise.all([chamadaApi('/disciplinas'), obterSessao().catch(() => null)]).then(
            ([dados, usuario]) => {
                if (!ativo) return;
                // "+ Nova disciplina" só para monitor. A sessão aqui decide só o que aparece:
                // quem barra de verdade é o 403 do POST /disciplinas.
                const ehMonitor = !!usuario && String(usuario.tipo).toLowerCase() === 'monitor';

                // Servidor respondeu com erro (status 4xx/5xx): o botão segue o papel mesmo assim
                if (dados.erro || dados.statusHttp >= 400) {
                    const mensagem = mensagemDaApi(dados, `Erro ${dados.statusHttp}`);
                    console.error('[MoniPro] Erro ao carregar disciplinas:', mensagem);
                    setEstado({ ehMonitor, disciplinas: null, erro: mensagem });
                    return;
                }

                // Suporta tanto { disciplinas: [...] } quanto array direto
                const lista = Array.isArray(dados) ? dados : dados.disciplinas;
                setEstado({ ehMonitor, disciplinas: Array.isArray(lista) ? lista : [], erro: null });
            },
            (falha) => {
                if (!ativo) return;
                // Erro de rede: o botão continua escondido, como no original
                console.error('[MoniPro] Erro ao carregar disciplinas:', falha.message);
                setEstado({ ehMonitor: false, disciplinas: null, erro: falha.message });
            }
        );
        return () => {
            ativo = false;
        };
    }, []);

    let conteudo;
    if (erro !== null) {
        conteudo = <p>Erro ao carregar disciplinas: {erro}</p>;
    } else if (!disciplinas) {
        conteudo = <p className="loading-text">Carregando disciplinas...</p>;
    } else if (disciplinas.length === 0) {
        conteudo = (
            <div className="lista-vazia">
                <span>Nenhuma disciplina disponível no momento.</span>
                {ehMonitor ? (
                    <a href="cadastro_disciplina.html" className="btn-nova-disciplina">
                        Cadastrar a primeira disciplina
                    </a>
                ) : null}
            </div>
        );
    } else {
        conteudo = disciplinas.map((disc) => (
            <a
                key={disc.id}
                className="disciplina-card"
                href={`marcar_monitoria.html?disciplinaID=${encodeURIComponent(disc.id)}&disciplinaNome=${encodeURIComponent(disc.nome)}`}
            >
                <div className="icone-disciplina">
                    <img src={iconeDisciplina} alt={disc.nome} />
                </div>
                <h2>{disc.nome}</h2>
            </a>
        ));
    }

    return (
        <Casca>
            <main className="dashboard-wrapper">
                <div className="dashboard-container">
                    {/* Cabeçalho */}
                    <div className="page-header">
                        <div className="title-area">
                            <a
                                href="base.html"
                                className="btn-voltar"
                                aria-label="Voltar ao painel principal"
                            >
                                <svg {...propsIcone} strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                                Voltar
                            </a>
                            <h1>Minhas Disciplinas</h1>
                            <p>Selecione uma disciplina para gerenciar a monitoria.</p>
                        </div>

                        <div className="header-direita">
                            {/* Busca: como no original, o campo não filtra a lista (nenhum script o lê) */}
                            <div className="search-area">
                                <div className="search-box">
                                    <svg
                                        {...propsIcone}
                                        focusable="false"
                                        strokeWidth={2}
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    {/* Tarefa 26: rótulo para leitores de tela (o placeholder não substitui o label) */}
                                    <label htmlFor="inputBuscaDisciplina" className="sr-only">
                                        Buscar disciplina
                                    </label>
                                    <input
                                        type="text"
                                        id="inputBuscaDisciplina"
                                        placeholder="Buscar disciplina..."
                                    />
                                </div>
                            </div>
                            {/* Só monitor vê; quem barra de verdade é o 403 da API */}
                            <a
                                href="cadastro_disciplina.html"
                                className="btn-nova-disciplina"
                                id="btnNovaDisciplina"
                                hidden={!ehMonitor}
                            >
                                <svg {...propsIcone}>
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Nova disciplina
                            </a>
                        </div>
                    </div>

                    <div className="disciplinas">{conteudo}</div>
                </div>
            </main>
            <footer className="rodape-legal">
                <a href="privacidade.html">Aviso de Privacidade</a>
            </footer>
        </Casca>
    );
}
