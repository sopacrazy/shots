# VPS de testes do Shorts

Endereço: https://70.38.101.147/shorts/

O login do painel foi salvo localmente em `data/deployment/acesso-vps.txt` (fora do Git). As credenciais das integrações ficam em `/opt/clipai-shorts/.env` na VPS. Esse arquivo é independente do `.env` do computador.

## Isolamento

- Aplicação e dados: `/opt/clipai-shorts`.
- Serviço: `clipai-shorts.service`, usuário `clipai-shorts`, backend apenas em `127.0.0.1:3011`.
- Frontend compilado com base `/shorts/` e `VITE_API_URL=/shorts`.
- Nginx: novo site `/etc/nginx/sites-available/clipai-shorts` para o IP em HTTPS.
- No site HTTP `folio`, foi acrescentado apenas um include de `/etc/nginx/shorts-http.locations.conf`. As rotas anteriores foram preservadas. Backup: `/opt/clipai-shorts/deploy/folio-before-shorts.conf`.
- Certificado do IP e Certbot têm configuração própria em `/opt/clipai-shorts/certbot`. `clipai-shorts-cert.timer` verifica a renovação duas vezes por dia. Os certificados dos outros sites não são gerenciados por essa configuração.
- Bibliotecas adicionais do Chrome foram extraídas em `/opt/clipai-shorts/chrome-libs`, sem instalar/atualizar pacotes do sistema. Seu LD_LIBRARY_PATH se aplica somente ao processo do Shorts.

## Operação

O agendador usa `/opt/clipai-shorts/data/scheduler.sqlite`, com WAL/SHM do SQLite. A fila roda dentro do mesmo `clipai-shorts.service` a cada 15 segundos. O worker não depende do navegador do usuário permanecer aberto. Não copie um banco antigo por cima desse arquivo ao atualizar. O horário é salvo em UTC e mostrado no fuso do navegador. Em um reinício, envios incertos ficam para conferência e agendamentos com mais de 15 minutos de atraso ficam como perdidos.

A limpeza está ativada no `.env` da VPS com `MEDIA_CLEANUP_ENABLED=true`: MP4 editado é removido após 24h da publicação confirmada, em verificação a cada 10 minutos. `MEDIA_CLEANUP_ORIGINALS=true` permite remover também o original quando todas as edições que o usam já foram publicadas há pelo menos 24h; qualquer edição pendente preserva o original. A limpeza mantém banco, links, identificadores dos Reels e automação de Direct. Essa opção é relida automaticamente, sem reiniciar os serviços.

```sh
systemctl status clipai-shorts
systemctl restart clipai-shorts
journalctl -u clipai-shorts -n 50 --no-pager
```

Esses comandos administram somente o Shorts. Não use comandos de reinício global do PM2 ou do servidor. Alterações de Nginx devem passar por `nginx -t` e recarga, sem parar os serviços.

O painel e a API administrativa exigem login. As rotas `/shorts/api/files/` e `/shorts/api/instagram/webhook` são públicas para a Meta; o webhook valida sua assinatura. Não remova a proteção das demais rotas.

As páginas `/shorts/privacidade.html` e `/shorts/exclusao-de-dados.html` são públicas e independem de autenticação. Suas fontes ficam em `public/` no projeto e devem acompanhar os próximos builds. O root estático do Nginx é `/opt/clipai-shorts/www`, com `www/shorts` apontando para `deploy-build`. Preserve essas duas exceções de autenticação nas atualizações.

Para testar a validação de URLs da Meta com hostname em vez de IP, foi criado `achados.70-38-101-147.sslip.io`, DNS de teste que resolve para a mesma VPS. O site separado `clipai-shorts-public` publica somente `/privacidade.html` e `/exclusao-de-dados.html`. Seu certificado fica em `certbot/config/live/clipai-shorts-public`, gerenciado pela configuração de renovação própria do Shorts. Esse hostname não altera a base da API, o webhook ou o login do painel.

Para a Meta, a base pública é `https://70.38.101.147/shorts`, e o callback é `https://70.38.101.147/shorts/api/instagram/webhook`. Preencha o App Secret e o Verify token no `.env` da VPS antes de configurar o webhook. A ativação global foi mantida em `false`; uma publicação exige revisão e ação explícita pelo app.

## Pacote inicial

`prepare.mjs` prepara a primeira cópia do projeto, dos dados e das credenciais para essa VPS. O pacote em `data/deployment` contém segredos e não deve ser compartilhado. Não extraia esse pacote sobre uma instalação que já tenha novos dados: isso substituiria seu banco e suas mídias. Para atualizações futuras, copie somente código/frontend e preserve `.env` e `data/` da VPS.

Verificações feitas: HTTPS externo, login administrativo, biblioteca, MP4 público com Range, renderização de vídeo com áudio e logo, comparação das rotas anteriores, validação do perfil Instagram, acesso ao modelo Anthropic e renovação simulada do certificado. Nenhum Reel ou Direct foi enviado durante a implantação. App Secret da Meta permanece pendente; o Verify token foi gerado e pode ser consultado no painel autenticado após preencher o App Secret.
