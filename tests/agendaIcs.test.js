// Plano 10 (RF-015): arquivo .ics de "Adicionar à agenda" (Monipro_web/JS/agenda.js)
const { AgendaIcs: A } = require('../Monipro_web/JS/agenda.js');

const AGORA = new Date('2026-11-19T15:00:00.000Z');
const INICIO = new Date('2026-11-20T17:00:00.000Z');
const FIM = new Date('2026-11-20T18:30:00.000Z');

const inscricao = (campos) => ({
    id: 42,
    disciplina: 'Cálculo I',
    monitor: 'Ana Lima',
    local: 'Bloco B, sala 204; 2º andar',
    inicio: INICIO,
    fim: FIM,
    online: false,
    link: null,
    ...campos
});
const linhas = (texto) => texto.replace(/\r\n /g, '').split('\r\n');
const campo = (texto, nome) =>
    linhas(texto)
        .filter((l) => l.startsWith(nome + ':'))
        .map((l) => l.slice(nome.length + 1));

describe('textoIcs', () => {
    const texto = A.textoIcs(A.eventoDaInscricao(inscricao(), 'https://moni-pro.app.br'), AGORA);

    test('linhas terminam em CRLF e o arquivo tem um evento com alarme 1h antes', () => {
        expect(texto.endsWith('\r\n')).toBe(true);
        expect(texto.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
        expect(linhas(texto)[0]).toBe('BEGIN:VCALENDAR');
        expect(campo(texto, 'TRIGGER')).toEqual(['-PT60M']);
        expect(campo(texto, 'BEGIN')).toEqual(['VCALENDAR', 'VEVENT', 'VALARM']);
    });

    test('horários em UTC com sufixo Z', () => {
        expect(campo(texto, 'DTSTART')).toEqual(['20261120T170000Z']);
        expect(campo(texto, 'DTEND')).toEqual(['20261120T183000Z']);
        expect(campo(texto, 'DTSTAMP')).toEqual(['20261119T150000Z']);
    });

    test('local com vírgula e ponto e vírgula sai escapado', () => {
        expect(campo(texto, 'LOCATION')).toEqual(['Bloco B\\, sala 204\\; 2º andar']);
    });

    test('UID estável por inscrição; SEQUENCE cresce a cada download', () => {
        const depois = A.textoIcs(
            A.eventoDaInscricao(inscricao({ inicio: FIM }), ''),
            new Date(AGORA.getTime() + 5 * 60000)
        );
        expect(campo(texto, 'UID')).toEqual(['inscricao-42@moni-pro.app.br']);
        expect(campo(depois, 'UID')).toEqual(campo(texto, 'UID'));
        expect(Number(campo(depois, 'SEQUENCE')[0])).toBeGreaterThan(
            Number(campo(texto, 'SEQUENCE')[0])
        );
    });

    test('sem término: o evento ocupa 1h', () => {
        const t = A.textoIcs(A.eventoDaInscricao(inscricao({ fim: null }), ''), AGORA);
        expect(campo(t, 'DTEND')).toEqual(['20261120T180000Z']);
    });

    test('descrição com monitor e link do perfil; quebras de linha viram \\n', () => {
        const desc = campo(texto, 'DESCRIPTION')[0];
        expect(desc).toBe(
            'Monitor: Ana Lima\\nSua inscrição no MoniPro: https://moni-pro.app.br/perfil_aluno.html'
        );
        expect(campo(texto, 'URL')).toEqual(['https://moni-pro.app.br/perfil_aluno.html']);
    });
});

describe('escapar e dobrar', () => {
    test('barra invertida, vírgula, ponto e vírgula e quebras de linha', () => {
        expect(A.escapar('a\\b, c; d\r\ne\nf')).toBe('a\\\\b\\, c\\; d\\ne\\nf');
        expect(A.escapar(null)).toBe('');
    });

    test('linhas longas dobram em até 75 bytes sem partir caractere acentuado', () => {
        const longa = 'DESCRIPTION:' + 'ção '.repeat(60);
        const dobrada = A.dobrar(longa);
        const partes = dobrada.split('\r\n');
        expect(partes.length).toBeGreaterThan(1);
        partes.forEach((p) => expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75));
        partes.slice(1).forEach((p) => expect(p.startsWith(' ')).toBe(true));
        expect(dobrada.replace(/\r\n /g, '')).toBe(longa);
        expect(A.dobrar('curta')).toBe('curta');
    });
});

describe('eventos do aluno e do monitor', () => {
    test('on-line: o link da sala vai no local, na descrição e no URL', () => {
        const link = 'https://meet.google.com/abc-defg-hij';
        const ev = A.eventoDaInscricao(inscricao({ online: true, local: 'On-line', link }), '');
        expect(ev.local).toBe(link);
        expect(ev.url).toBe(link);
        expect(ev.descricao).toBe('Monitor: Ana Lima\nLink da sala: ' + link);
    });

    test('fora de um endereço http (prévia em arquivo), sem link do perfil', () => {
        const ev = A.eventoDaInscricao(inscricao(), 'null');
        expect(ev.url).toBe('');
        expect(ev.descricao).toBe('Monitor: Ana Lima');
    });

    test('vaga do monitor: UID próprio, título marcado e descrição da vaga', () => {
        const ev = A.eventoDaVaga(
            {
                id: 7,
                disciplina: 'Física I',
                local: 'Lab 3',
                inicio: INICIO,
                fim: FIM,
                descricao: 'Lista 4',
                online: false,
                link: null
            },
            'https://moni-pro.app.br'
        );
        expect(ev.uid).toBe('vaga-7@moni-pro.app.br');
        expect(ev.titulo).toBe('Monitoria de Física I (monitor)');
        expect(ev.local).toBe('Lab 3');
        expect(ev.descricao).toBe(
            'Você é o monitor desta sessão.\nLista 4\nInscritos e presenças no MoniPro: https://moni-pro.app.br/perfil_monitor.html'
        );
    });

    test('nome do arquivo sem acento, com a data', () => {
        const ev = A.eventoDaInscricao(inscricao({ inicio: new Date(2026, 10, 20, 14) }), '');
        expect(A.nomeArquivo(ev)).toBe('monitoria-de-calculo-i-2026-11-20.ics');
        expect(
            A.nomeArquivo({ titulo: 'Monitoria de Física I (monitor)', inicio: ev.inicio })
        ).toBe('monitoria-de-fisica-i-2026-11-20.ics');
    });
});
