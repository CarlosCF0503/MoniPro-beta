// JS/agenda.js
// Plano 10 (RF-015): "Adicionar à agenda". Monta um arquivo .ics (RFC 5545) com a monitoria e
// entrega ao navegador para baixar. Nada vai ao servidor: o arquivo é feito com os dados que a
// tela já tem. As funções de texto não tocam no DOM, então rodam no navegador (global
// AgendaIcs) e no Jest (module.exports) — ver tests/agendaIcs.test.js.
/* global module */

(function (raiz) {
    const DOMINIO_UID = 'moni-pro.app.br';
    // Alarme dentro do evento: o app de agenda avisa 1h antes (além do lembrete por e-mail)
    const MINUTOS_ALARME = 60;
    // Vaga sem término informado: o evento ocupa 1h na agenda
    const MINUTOS_SEM_FIM = 60;

    /** Escapa um valor de texto (RFC 5545, 3.3.11): barra invertida, ponto e vírgula, vírgula e quebras de linha. */
    function escapar(texto) {
        return String(texto == null ? '' : texto)
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\r|\n/g, '\\n');
    }

    const bytesDe = (cp) => {
        if (cp < 0x80) return 1;
        if (cp < 0x800) return 2;
        if (cp < 0x10000) return 3;
        return 4;
    };

    /** Dobra a linha em pedaços de até 75 bytes (RFC 5545, 3.1), sem partir um caractere acentuado. */
    function dobrar(linha) {
        const partes = [];
        let atual = '';
        let bytes = 0;
        for (const ch of linha) {
            const b = bytesDe(ch.codePointAt(0));
            // A continuação começa com um espaço, que também conta nos 75
            const limite = partes.length ? 74 : 75;
            if (bytes + b > limite) {
                partes.push(atual);
                atual = '';
                bytes = 0;
            }
            atual += ch;
            bytes += b;
        }
        partes.push(atual);
        return partes.join('\r\n ');
    }

    const dois = (n) => String(n).padStart(2, '0');
    /** Data em UTC no formato da agenda: 20261120T170000Z */
    function dataUtc(d) {
        return (
            d.getUTCFullYear() +
            dois(d.getUTCMonth() + 1) +
            dois(d.getUTCDate()) +
            'T' +
            dois(d.getUTCHours()) +
            dois(d.getUTCMinutes()) +
            dois(d.getUTCSeconds()) +
            'Z'
        );
    }

    /**
     * Texto do arquivo .ics de um evento.
     * evento: { uid, inicio: Date, fim: Date|null, titulo, local, descricao, url }
     * agora: Date usada em DTSTAMP e SEQUENCE. O UID é fixo por inscrição (ou vaga), então
     * baixar de novo depois de uma mudança atualiza o evento em vez de duplicar; o SEQUENCE
     * crescente (minutos desde 1970) faz a agenda tratar o arquivo novo como a versão mais recente.
     */
    function textoIcs(evento, agora) {
        const quando = agora || new Date();
        const fim = evento.fim || new Date(evento.inicio.getTime() + MINUTOS_SEM_FIM * 60000);
        const linhas = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MoniPro//Agenda//PT-BR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:' + evento.uid,
            'DTSTAMP:' + dataUtc(quando),
            'SEQUENCE:' + Math.floor(quando.getTime() / 60000),
            'DTSTART:' + dataUtc(evento.inicio),
            'DTEND:' + dataUtc(fim),
            'SUMMARY:' + escapar(evento.titulo)
        ];
        if (evento.local) linhas.push('LOCATION:' + escapar(evento.local));
        if (evento.descricao) linhas.push('DESCRIPTION:' + escapar(evento.descricao));
        if (evento.url) linhas.push('URL:' + evento.url);
        linhas.push(
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:' + escapar(evento.titulo),
            'TRIGGER:-PT' + MINUTOS_ALARME + 'M',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        );
        return linhas.map(dobrar).join('\r\n') + '\r\n';
    }

    // Link de volta para o perfil, só quando a página está num endereço http(s) de verdade
    const linkPerfil = (origem, pagina) =>
        /^https?:\/\//.test(origem || '') ? origem + '/' + pagina : '';

    /** Evento da inscrição do aluno (inscrição já normalizada por PerfilDados). */
    function eventoDaInscricao(i, origem) {
        const perfil = linkPerfil(origem, 'perfil_aluno.html');
        const descricao = ['Monitor: ' + i.monitor];
        if (i.link) descricao.push('Link da sala: ' + i.link);
        if (perfil) descricao.push('Sua inscrição no MoniPro: ' + perfil);
        return {
            uid: 'inscricao-' + i.id + '@' + DOMINIO_UID,
            inicio: i.inicio,
            fim: i.fim,
            titulo: 'Monitoria de ' + i.disciplina,
            local: i.online ? i.link || 'On-line' : i.local,
            descricao: descricao.join('\n'),
            url: i.link || perfil
        };
    }

    /** Evento da vaga que o monitor oferece (vaga já normalizada por PerfilDados). */
    function eventoDaVaga(v, origem) {
        const perfil = linkPerfil(origem, 'perfil_monitor.html');
        const descricao = ['Você é o monitor desta sessão.'];
        if (v.descricao) descricao.push(v.descricao);
        if (v.link) descricao.push('Link da sala: ' + v.link);
        if (perfil) descricao.push('Inscritos e presenças no MoniPro: ' + perfil);
        return {
            uid: 'vaga-' + v.id + '@' + DOMINIO_UID,
            inicio: v.inicio,
            fim: v.fim,
            titulo: 'Monitoria de ' + v.disciplina + ' (monitor)',
            local: v.online ? v.link || 'On-line' : v.local,
            descricao: descricao.join('\n'),
            url: v.link || perfil
        };
    }

    /** Nome do arquivo: monitoria-calculo-i-2026-11-20.ics (data no fuso do aparelho). */
    function nomeArquivo(evento) {
        const d = evento.inicio;
        const base = String(evento.titulo)
            .replace(/ \(monitor\)$/, '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);
        return (
            (base || 'monitoria') +
            '-' +
            d.getFullYear() +
            '-' +
            dois(d.getMonth() + 1) +
            '-' +
            dois(d.getDate()) +
            '.ics'
        );
    }

    /** Baixa o .ics. No celular, abrir o arquivo oferece "Adicionar à agenda". */
    function baixar(evento) {
        const blob = new Blob([textoIcs(evento)], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo(evento);
        a.hidden = true;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Alguns navegadores leem o Blob depois do clique: libera o endereço um pouco depois
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    const api = {
        MINUTOS_ALARME,
        MINUTOS_SEM_FIM,
        escapar,
        dobrar,
        dataUtc,
        textoIcs,
        eventoDaInscricao,
        eventoDaVaga,
        nomeArquivo,
        baixar
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.AgendaIcs = api;
})(typeof window !== 'undefined' ? window : this);
