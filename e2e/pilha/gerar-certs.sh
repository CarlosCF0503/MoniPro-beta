#!/bin/sh
# R1 (E2E): CA própria e certificado do Postgres, como no servidor (o CN é o nome do
# serviço, "db"). Roda uma vez por volume; o backend valida o SSL com a ca.crt.
set -eu
cd /certs
if [ -f server.crt ]; then
    echo "certificados já existem"
    exit 0
fi
openssl req -new -x509 -days 2 -nodes -subj "/CN=MoniPro E2E CA" \
    -keyout /tmp/ca.key -out ca.crt
openssl req -new -nodes -subj "/CN=db" -keyout server.key -out /tmp/server.csr
printf 'subjectAltName=DNS:db\n' > /tmp/san.ext
openssl x509 -req -in /tmp/server.csr -CA ca.crt -CAkey /tmp/ca.key -CAcreateserial \
    -CAserial /tmp/ca.srl -days 2 -extfile /tmp/san.ext -out server.crt
# O Postgres (uid 999 na imagem oficial) exige a chave legível só pelo dono
chown 999:999 server.key server.crt
chmod 600 server.key
chmod 644 server.crt ca.crt
echo "certificados gerados"
