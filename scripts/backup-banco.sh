#!/bin/bash
# backup-banco.sh
# R22: cópia de segurança do PostgreSQL de um ambiente, já cifrada, com prazo de retenção.
#
# O pg_dump sai do contêiner direto para o gpg: o servidor nunca grava a cópia em texto
# aberto. A cifragem usa só a CHAVE PÚBLICA de quem pode restaurar; a chave privada fica
# fora do servidor (ver docs/operacao/backup-e-segredos.md). Quem invadir o servidor e levar
# as cópias não consegue abri-las.
#
# Uso (no servidor, como o usuário do deploy):
#   PROJETO_DIR=~/moni-pro-beta ./scripts/backup-banco.sh                        # produção
#   PROJETO_DIR=~/moni-pro-beta-develop COMPOSE_PROJETO=monipro-dev \
#     AMBIENTE=hml ./scripts/backup-banco.sh                                      # homologação
#
# Variáveis (todas opcionais):
#   PROJETO_DIR     pasta do docker-compose.yml do ambiente   (padrão: ~/moni-pro-beta)
#   COMPOSE_PROJETO nome do projeto Compose (-p)              (padrão: o da pasta)
#   AMBIENTE        prefixo do arquivo                        (padrão: prod)
#   BACKUP_DIR      pasta das cópias                          (padrão: ~/backups/monipro)
#   BACKUP_CHAVE    chave pública gpg (arquivo .asc)          (padrão: ~/.monipro/backup-publica.asc)
#   BACKUP_DIAS     dias de retenção                          (padrão: 30, o prazo do Aviso de Privacidade)
#   COMANDO_DUMP    comando que escreve o dump no stdout (só para teste local)

set -euo pipefail
umask 077

PROJETO_DIR="${PROJETO_DIR:-$HOME/moni-pro-beta}"
COMPOSE_PROJETO="${COMPOSE_PROJETO:-}"
AMBIENTE="${AMBIENTE:-prod}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/monipro}"
BACKUP_CHAVE="${BACKUP_CHAVE:-$HOME/.monipro/backup-publica.asc}"
BACKUP_DIAS="${BACKUP_DIAS:-30}"

falhar() { echo "backup-banco: $*" >&2; exit 1; }

command -v gpg >/dev/null || falhar "gpg não encontrado (sudo apt install gnupg)."
[ -s "$BACKUP_CHAVE" ] || falhar "chave pública não encontrada em $BACKUP_CHAVE (ver docs/operacao/backup-e-segredos.md)."
[[ "$BACKUP_DIAS" =~ ^[0-9]+$ ]] || falhar "BACKUP_DIAS deve ser um número de dias."

if [ -z "${COMANDO_DUMP:-}" ]; then
    [ -f "$PROJETO_DIR/docker-compose.yml" ] || falhar "docker-compose.yml não encontrado em $PROJETO_DIR."
    OPCAO_PROJETO=""
    [ -n "$COMPOSE_PROJETO" ] && OPCAO_PROJETO="-p $COMPOSE_PROJETO"
    # Formato custom (-Fc): comprimido e restaurável com pg_restore. As credenciais são as do
    # próprio contêiner; nenhuma senha passa pela linha de comando.
    COMANDO_DUMP="cd '$PROJETO_DIR' && docker-compose $OPCAO_PROJETO exec -T db sh -c 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc'"
fi

mkdir -p "$BACKUP_DIR"
ARQUIVO="$BACKUP_DIR/monipro-$AMBIENTE-$(date -u +%Y%m%d-%H%M%SZ).dump.gpg"
PARCIAL="$ARQUIVO.parcial"
trap 'rm -f "$PARCIAL"' EXIT

# </dev/null no exec: o docker-compose consome o stdin quando roda dentro de outro script
if ! bash -c "$COMANDO_DUMP" </dev/null \
    | gpg --batch --yes --quiet --trust-model always --recipient-file "$BACKUP_CHAVE" \
          --encrypt --output "$PARCIAL"; then
    falhar "o pg_dump ou a cifragem falhou; nenhuma cópia foi gravada."
fi

[ -s "$PARCIAL" ] || falhar "a cópia saiu vazia; nada foi gravado."
# Confere que o arquivo é mesmo um pacote cifrado do gpg antes de dar a cópia por boa
gpg --batch --list-packets "$PARCIAL" 2>/dev/null | grep -q "pubkey enc packet" \
    || falhar "o arquivo gerado não é uma cópia cifrada válida."
mv "$PARCIAL" "$ARQUIVO"
echo "backup-banco: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"

# Retenção: apaga as cópias cifradas deste ambiente mais antigas que BACKUP_DIAS
APAGADAS=$(find "$BACKUP_DIR" -maxdepth 1 -name "monipro-$AMBIENTE-*.dump.gpg" -mtime +"$BACKUP_DIAS" -print -delete | wc -l)
echo "backup-banco: $APAGADAS cópia(s) com mais de $BACKUP_DIAS dias apagada(s)."

# Cópias antigas sem cifragem (feitas antes deste script) só são listadas, nunca apagadas aqui
SEM_CIFRA=$(find "$HOME/backups" -maxdepth 2 -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.sql.gz' \) 2>/dev/null | wc -l)
if [ "$SEM_CIFRA" -gt 0 ]; then
    echo "backup-banco: atenção, há $SEM_CIFRA cópia(s) sem cifragem em ~/backups (ver o passo 4 do guia)." >&2
fi
