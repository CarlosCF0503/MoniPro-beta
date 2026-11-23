# Cópias de segurança e troca de segredos

Guia de operação para os riscos R22 (cópias do banco sem cifragem) e R23 (sem rotina de troca de segredos) da especificação v7.3, seção 25. Não contém nenhum segredo: os valores ficam só no `.env` de cada ambiente, no servidor.

Ambientes no servidor:

| Ambiente    | Pasta                     | Projeto Compose                                     |
| ----------- | ------------------------- | --------------------------------------------------- |
| Produção    | `~/moni-pro-beta`         | padrão (`docker-compose ...`)                       |
| Homologação | `~/moni-pro-beta-develop` | `monipro-dev` (`docker-compose -p monipro-dev ...`) |

O servidor usa o `docker-compose` 1.25 (com hífen).

## 1. Cópias de segurança cifradas (R22)

O `scripts/backup-banco.sh` faz o `pg_dump` dentro do contêiner `db` e entrega a saída direto ao `gpg`, que cifra com a **chave pública** de quem pode restaurar. A cópia nunca é gravada em texto aberto no servidor, e a chave privada fica fora dele: quem levar as cópias não consegue abri-las.

### 1.1 Criar o par de chaves (uma vez, no computador do responsável, não no servidor)

```bash
gpg --quick-gen-key "Backup MoniPro <moni-pro@googlegroups.com>" ed25519 cert 2y
gpg --quick-add-key <FINGERPRINT> cv25519 encr 2y      # subchave de cifragem
gpg --armor --export <FINGERPRINT> > backup-publica.asc
gpg --armor --export-secret-keys <FINGERPRINT> > backup-privada.asc   # guardar offline
```

- Proteja a chave privada com uma frase-senha forte. Guarde `backup-privada.asc` e a frase em dois lugares fora do servidor (por exemplo, o cofre de senhas da equipe e um pendrive). Sem ela, nenhuma cópia pode ser restaurada.
- A validade de 2 anos obriga a revisar a chave; renove com `gpg --quick-set-expire` antes de vencer.

### 1.2 Instalar a chave pública no servidor

```bash
mkdir -p ~/.monipro && chmod 700 ~/.monipro
# copiar backup-publica.asc para ~/.monipro/backup-publica.asc (scp)
chmod 600 ~/.monipro/backup-publica.asc
sudo apt install -y gnupg     # se ainda não estiver instalado
```

### 1.3 Testar e agendar

```bash
cd ~/moni-pro-beta && git pull   # ou esperar o deploy que traz o script
PROJETO_DIR=~/moni-pro-beta ./scripts/backup-banco.sh
PROJETO_DIR=~/moni-pro-beta-develop COMPOSE_PROJETO=monipro-dev AMBIENTE=hml ./scripts/backup-banco.sh
ls -l ~/backups/monipro/
```

Agendamento diário (`crontab -e` do usuário do deploy), em horário de pouco uso:

```cron
30 6 * * * PROJETO_DIR=$HOME/moni-pro-beta $HOME/moni-pro-beta/scripts/backup-banco.sh >> $HOME/backups/monipro/backup.log 2>&1
45 6 * * * PROJETO_DIR=$HOME/moni-pro-beta-develop COMPOSE_PROJETO=monipro-dev AMBIENTE=hml $HOME/moni-pro-beta/scripts/backup-banco.sh >> $HOME/backups/monipro/backup.log 2>&1
```

O servidor está em UTC: 06:30 UTC é 03:30 em Brasília. As cópias com mais de 30 dias (prazo do Aviso de Privacidade) são apagadas pelo próprio script; mude com `BACKUP_DIAS`.

### 1.4 Tratar as cópias antigas sem cifragem

As cópias feitas antes do script (`~/backups/*.dump`, como as da migração da Aiven) estão em texto aberto. O script avisa quando elas existem. Para cada uma: se ainda for necessária, cifre e apague o original; se não, apague.

```bash
gpg --batch --trust-model always --recipient-file ~/.monipro/backup-publica.asc --encrypt ARQUIVO.dump \
  && shred -u ARQUIVO.dump
```

### 1.5 Restaurar (teste a cada semestre)

No computador que tem a chave privada, num banco descartável, nunca direto em produção:

```bash
docker run -d --name restauro -e POSTGRES_PASSWORD=descartavel -p 127.0.0.1:5440:5432 postgres:17
gpg --decrypt monipro-prod-AAAAMMDD-HHMMSSZ.dump.gpg \
  | docker exec -i restauro pg_restore -U postgres -d postgres --no-owner --create
docker exec restauro psql -U postgres -d db_monipro -c 'select count(*) from usuarios;'
docker rm -f restauro
```

Uma cópia que nunca foi restaurada não é uma cópia confiável. Registre a data do último teste de restauração.

## 2. Troca de segredos (R23)

| Segredo                                                                          | Onde fica                 | Quando trocar                                                     | Efeito da troca                                                                       |
| -------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `JWT_SECRET`                                                                     | `.env` de cada ambiente   | a cada semestre e se vazar                                        | todas as sessões abertas acabam; cada pessoa entra de novo                            |
| Senha do banco (`POSTGRES_PASSWORD` e a senha na `DATABASE_URL`)                 | `.env` de cada ambiente   | a cada semestre e se vazar                                        | nenhum, se feita na ordem abaixo                                                      |
| Chave SMTP do Brevo (`SMTP_SENHA`)                                               | `.env` e painel do Brevo  | a cada ano (vence em 12 meses ou após 90 dias sem uso) e se vazar | nenhum; os avisos pendentes ficam na fila e saem depois                               |
| Certificado do Postgres (`certs/server.crt`) e CA (`certs/ca.crt`, `DB_CA_CERT`) | pasta `certs/` e `.env`   | antes de vencer                                                   | o backend recusa o banco se o certificado vencer                                      |
| Certificado HTTPS (Let's Encrypt)                                                | `/etc/letsencrypt`        | automático (certbot)                                              | conferir o timer e o dry-run                                                          |
| Chave de cifragem das cópias                                                     | computador do responsável | a cada 2 anos ou se vazar                                         | cópias novas usam a chave nova; guarde a antiga enquanto houver cópias feitas com ela |
| Chave SSH de acesso ao servidor                                                  | computadores da equipe    | ao sair alguém da equipe e se vazar                               | remover a chave antiga de `~/.ssh/authorized_keys`                                    |

Qualquer segredo que tenha passado por chat, e-mail, print ou terminal compartilhado conta como vazado: troque assim que possível.

Gere valores novos sempre com um gerador criptográfico:

```bash
openssl rand -base64 48      # JWT_SECRET (64 caracteres)
openssl rand -base64 32 | tr -d '/+=' | cut -c1-32     # senha do banco, sem caracteres que atrapalham a URL
```

Antes de editar um `.env`, faça uma cópia com data: `cp .env .env.bak-$(date +%Y%m%d)` (e apague a cópia depois de conferir).

### 2.1 JWT_SECRET

```bash
cd ~/moni-pro-beta
# editar JWT_SECRET no .env
docker-compose up -d --force-recreate backend
curl -s -o /dev/null -w '%{http_code}\n' https://moni-pro.app.br/saude    # 200
```

Repita na homologação com outro valor (`-p monipro-dev`). Os dois ambientes nunca usam o mesmo segredo.

### 2.2 Senha do banco

A senha do contêiner só é lida na criação do volume; depois disso, ela muda dentro do Postgres.

```bash
cd ~/moni-pro-beta
docker-compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# dentro do psql: \password   (pede a senha nova duas vezes e não a grava no histórico)
# depois, no .env: trocar POSTGRES_PASSWORD e a senha dentro da DATABASE_URL
docker-compose up -d --force-recreate backend
curl -s https://moni-pro.app.br/saude      # "banco":"ok"
```

### 2.3 Chave SMTP do Brevo

1. No painel do Brevo, criar uma chave SMTP nova (uma por ambiente).
2. Trocar `SMTP_SENHA` no `.env` e recriar o backend.
3. `docker-compose exec -T backend node scripts/testar-email.js moni-pro@googlegroups.com`
4. Apagar a chave antiga no painel.

### 2.4 Certificado do Postgres e CA própria

Conferir a validade (vale para os dois ambientes):

```bash
cd ~/moni-pro-beta
openssl x509 -enddate -noout -in certs/server.crt
openssl x509 -enddate -noout -in certs/ca.crt
```

Para renovar só o certificado do servidor com a mesma CA (o `DB_CA_CERT` não muda), na pasta `certs/`. Isso exige a chave da CA (`ca.key`); se ela não foi guardada quando a CA foi criada, siga o parágrafo seguinte e troque a CA.

```bash
openssl req -new -nodes -subj "/CN=db" -keyout server.key -out server.csr
printf 'subjectAltName=DNS:db,DNS:localhost\n' > san.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -extfile san.ext -out server.crt
sudo chown 999:999 server.key && sudo chmod 600 server.key
docker-compose restart db && docker-compose up -d --force-recreate backend
```

Se a CA também precisar ser trocada, gere uma nova, assine um `server.crt` novo com ela, atualize o `DB_CA_CERT` no `.env` (em uma linha, ver o `.env.example`) e recrie `db` e `backend` juntos.

### 2.5 Certificado HTTPS

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

## 3. DMARC do domínio (R24)

Hoje o registro é `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`: os relatórios chegam, mas e-mails falsos em nome de `moni-pro.app.br` ainda são entregues.

1. No painel do Brevo, conferir os relatórios DMARC das últimas semanas: todos os envios legítimos devem passar em DKIM ou SPF.
2. No Registro.br, trocar o TXT de `_dmarc` para `v=DMARC1; p=quarantine; pct=100; rua=mailto:rua@dmarc.brevo.com; adkim=r; aspf=r`.
3. Depois de algumas semanas sem falhas legítimas, passar para `p=reject`.
4. Conferir: `nslookup -type=TXT _dmarc.moni-pro.app.br 8.8.8.8`.

## 4. Calendário

| Quando                   | O quê                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Todo dia                 | cópia cifrada dos dois bancos (cron)                                                                                    |
| Todo mês                 | conferir `backup.log` e o espaço em disco                                                                               |
| Todo semestre            | restaurar uma cópia num banco descartável; trocar `JWT_SECRET` e a senha do banco; conferir a validade dos certificados |
| Todo ano                 | trocar as chaves SMTP                                                                                                   |
| Ao sair alguém da equipe | trocar todos os segredos que a pessoa conhecia e remover a chave SSH dela                                               |
