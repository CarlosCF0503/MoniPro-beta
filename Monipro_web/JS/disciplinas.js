// JS/disciplinas.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. PREPARAÇÃO E SEGURANÇA (Padrão MoniPro) ---
    // Pega o token com o nome correto que a sua equipe usou
    const tokenUsuario = localStorage.getItem('monipro_token');

    // Se não tiver token, expulsa para a tela de login correta (index.html)
    if (!tokenUsuario) {
        alert('Você precisa estar logado para acessar esta página!');
        window.location.href = 'index.html'; 
        return; // Para a execução do código aqui
    }

    // Decodifica o token para descobrir se é aluno ou monitor (igual ao base.js)
    let tipoUsuario = '';
    try {
        const userData = JSON.parse(atob(tokenUsuario.split('.')[1]));
        tipoUsuario = userData.tipo;
    } catch (e) {
        // Se o token for inválido/falso, limpa e expulsa
        localStorage.removeItem('monipro_token');
        window.location.href = 'index.html';
        return;
    }

    // Se for monitor, a gente acende a luz (mostra o botão)
    if (tipoUsuario === 'monitor') {
        const btnNovaDisciplina = document.getElementById('btnNovaDisciplina');
        if (btnNovaDisciplina) btnNovaDisciplina.style.display = 'block';
    }
    
    // Chama a função que busca as disciplinas no back-end
    carregarDisciplinas();

   
    // --- 2. BUSCAR DISCIPLINAS (GET) ---
    async function carregarDisciplinas() {
        const divLista = document.getElementById('listaDisciplinas');

        try {
            const resposta = await fetch(`${MB_BETA_ORM}/disciplinas`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenUsuario}` 
                }
            });

            const dados = await resposta.json();

            if (resposta.status === 200 && dados.success) {
                divLista.innerHTML = ''; 
                
                const lista = dados.disciplinas; 

                if (lista.length === 0) {
                    divLista.innerHTML = '<p>Nenhuma disciplina cadastrada ainda.</p>';
                    return;
                }

                // Agora fazemos o loop na lista correta!
                lista.forEach(disciplina => {
                    const card = document.createElement('div');
                    card.className = 'card-disciplina';
                    card.innerText = disciplina.nome; 
                    divLista.appendChild(card);
                });
            } else {
                divLista.innerHTML = `<p style="color:red;">Erro ao carregar: ${dados.erro}</p>`;
            }
        } catch (erro) {
            console.error(erro); // Isso vai nos mostrar o erro real no console se der ruim de novo!
            divLista.innerHTML = '<p style="color:red;">Falha de conexão com o servidor.</p>';
        }
    }
    

    // --- 3. LÓGICA DO MODAL E CADASTRO (POST) ---
    const modal = document.getElementById('modalDisciplina');
    const btnNovaDisciplina = document.getElementById('btnNovaDisciplina');
    const btnCancelar = document.getElementById('btnCancelar');
    const btnSalvar = document.getElementById('btnSalvar');

    // Abre Modal
    if (btnNovaDisciplina) {
        btnNovaDisciplina.addEventListener('click', () => { 
            modal.style.display = 'flex'; 
        });
    }

    // Fecha Modal
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => { 
            modal.style.display = 'none'; 
            document.getElementById('nomeDisciplina').value = ''; 
        });
    }

    // Salvar Nova Disciplina
    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            const nomeInput = document.getElementById('nomeDisciplina').value;

            if (!nomeInput) {
                // Se vocês usam Toast no projeto, podemos mudar para showToast depois!
                alert('Ops! Digite o nome da disciplina.');
                return;
            }

            try {
                const resposta = await fetch(`${MB_BETA_ORM}/disciplinas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenUsuario}` 
                    },
                    body: JSON.stringify({ nome: nomeInput })
                });

                const dados = await resposta.json();

                if (resposta.status === 201) {
                    alert('Disciplina criada com sucesso!');
                    modal.style.display = 'none'; 
                    document.getElementById('nomeDisciplina').value = ''; 
                    
                    // Recarrega a lista para a nova disciplina aparecer na hora!
                    carregarDisciplinas(); 
                } else {
                    alert(dados.erro || 'Erro ao criar disciplina.');
                }
            } catch (erro) {
                alert('Servidor fora do ar ou erro de conexão.');
            }
        });
    }
});