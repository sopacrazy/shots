# Clipai — editor local de vídeos curtos

React + Vite, Express e Remotion. Projetos e arquivos ficam no computador. Nenhuma conta, banco remoto, chave de API ou arquivo .env é obrigatório.

## Iniciar

1. Instale Node.js 22 ou superior e Google Chrome.
2. Execute `npm install` na raiz.
3. Execute `npm run dev`.

Frontend: http://localhost:3000. Backend: http://localhost:3001/api/health.
O backend aceita conexões locais em 127.0.0.1. Porta e caminhos podem ser personalizados com as opções de `.env.example`.

## Vídeos de produtos (tela inicial)

### Garimpo Shopee

Configure `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` no `.env` do backend. A seção **Garimpo Shopee** busca 20 produtos por página por nome ou categoria, com ordenação por vendas, comissão, preço ou relevância. O filtro de preço se aplica à página carregada. As ofertas mostram preço, avaliações, vendas, comissão estimada e data da consulta; os valores podem mudar e não garantem ganhos. Favoritos ficam no banco local, com limite de 200 produtos.

**Preparar publicação** preenche o nome e o link de afiliado no editor; selecione um vídeo correspondente e use a geração de descrição com IA se desejar. Trocar um produto pede confirmação quando já existe texto ou link. Não há download automático de vídeos nem publicação automática. As credenciais são usadas somente no servidor para assinar consultas à API oficial, nunca no frontend. Ao implantar, configure as credenciais também no `.env` da VPS.

1. Copie seus vídeos para `data/library/Categoria/arquivo.mp4` (ex.: Cozinha, Beleza, Eletrônicos). A biblioteca procura subpastas automaticamente. Também é possível importar uma pasta ou arquivos pela interface; a importação copia os arquivos e preserva os originais.
2. Selecione um vídeo e escreva a descrição do produto. A legenda fica **somente na descrição da publicação**, sem texto adicionado ao vídeo. O campo opcional **Link do produto afiliado** salva o endereço separadamente e o inclui ao final da descrição, preservando os parâmetros de afiliado. A prévia e a revisão de publicação mostram o texto completo; descrição e link juntos têm limite de 2200 caracteres.
3. Informe sua marca d’água em texto (ex.: @sualoja) ou envie uma imagem PNG/WebP/JPEG e escolha um dos quatro cantos. PNG com transparência mantém o fundo transparente na sobreposição; texto e imagem podem ser combinados. A imagem salva pode ser reutilizada pelo histórico de edições.
4. Gere e revise o MP4 vertical 1080×1920. O áudio original é mantido. Você pode baixar o arquivo ou publicar no Instagram após configurar a conta.

Formatos de entrada: MP4, MOV, WebM ou M4V; limite de 250 MB por importação e 30 minutos por edição. Vídeos importados ficam em data/library, versões editadas em data/files/videos/edits. Descrição e histórico ficam no banco JSON local. O editor de cenas anterior continua acessível pelo botão no topo.

## Testar tudo localmente primeiro

## Reel com fotos e música

Abra **Reel com fotos e música**. Envie de 2 a 12 fotos PNG/JPEG/WebP (até 5 MB cada), use as setas para ordenar e escolha de 2 a 8 segundos por foto. A montagem combina zoom suave alternado com dissolução ou deslizamento; cada transição sobrepõe 0,6 segundo. O enquadramento pode preservar a foto com fundo desfocado ou preencher a tela recortando bordas.

Envie uma música MP3/WAV opcional (até 12 MB), ajuste o volume e revise o MP4 com áudio antes de publicar. A trilha é repetida se for curta e recebe fade de entrada/saída. Fotos, música e logo juntos têm limite de 30 MB. Use materiais autorizados para publicação. A música é incorporada ao MP4; este recurso não acessa a biblioteca musical do Instagram.

Preencha descrição, link de afiliado e marca d’água (texto e/ou logo). A geração usa a mesma fila persistente das edições de vídeo; o resultado aparece na própria seção e em **Últimas edições**, podendo ser baixado, publicado com confirmação ou escolhido no agendador. A limpeza após 24 horas da publicação e a exclusão manual removem também as fotos e a música exclusivas da montagem, preservando o logo salvo e os dados da automação LINK.

`npm run test:photos --workspace=backend`, após compilar o backend, renderiza uma montagem temporária de duas imagens com áudio sintético e valida resolução, duração, trilha e download, sem publicar no Instagram.

## Testar tudo localmente primeiro

Edição de vídeos, marca d’água PNG/texto, áudio, link de afiliado, histórico e download funcionam sem configurar Instagram.

Abra **Comentou LINK → resposta + Direct → Teste local — sem enviar mensagens**. Use um produto salvo ou o link de exemplo, digite LINK e clique em **Simular comentário**. A prévia mostra primeiro a resposta pública natural e depois o Direct com o link correto. O simulador não chama a Meta, não publica, não envia mensagens e não altera os registros reais de envio. Também é possível testar palavras que não devem disparar a automação.

A URL pública no `.env` é opcional durante os testes locais. A validação do token consulta o perfil na Meta, mas não publica nem envia mensagens. A simulação não exige token ou conta conectada.

Publicação real e recebimento de comentários reais continuam dependendo de HTTPS público e das permissões/webhooks da Meta. Enquanto não houver URL pública, o botão de publicação permanece indisponível e o backend também rejeita publicações antes de criar trabalhos ou chamar a API.

## Publicar no Instagram

No arquivo `.env` da raiz, preencha `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_API_VERSION`. Quando for publicar, adicione `INSTAGRAM_PUBLIC_BASE_URL` com a URL HTTPS pública que permita baixar os MP4 deste backend. A URL pode ficar vazia nos testes locais. Abra **Configurar Instagram → Validar configuração do .env** para consultar o perfil. Nenhum token é incluído nas respostas da API. `INSTAGRAM_USERNAME` é preenchido pela validação.

Permissões: instagram_business_basic e instagram_business_content_publish. Gere o token e configure as permissões seguindo a [documentação oficial da Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/). Esta versão usa configuração por token; não implementa login OAuth nem renova tokens automaticamente.

O computador local não é acessível pelo Instagram. É preciso disponibilizar **/api/files/** por HTTPS (proxy/túnel configurado pelo usuário) e manter o backend em execução durante o processamento. A API exige host local para os outros endpoints, exceto o webhook assinado da automação descrito abaixo. Não é necessário Supabase. A edição e o download funcionam sem configurar Instagram ou endereço público.

Depois da revisão, o botão Publicar mostra a conta e a descrição para confirmar o envio. O backend cria o contêiner de Reel, espera o processamento e publica. Falhas ficam visíveis. Se a confirmação da Meta se perder após o envio, a edição fica marcada para conferência manual, evitando repetir a postagem automaticamente.

Não foi feita publicação real durante os testes. A integração externa exige credenciais válidas e acesso público ao vídeo.

## Automação: comentou LINK → resposta pública → Direct

O serviço já está no backend Node/Express existente. Não é preciso criar outro projeto Node nem usar Manychat, Supabase ou IA.

Para cada Reel **publicado pelo app**, o ID da mídia é associado à edição e ao link de afiliado do produto. Quando chegar um comentário com a palavra LINK (também reconhece “link”, “LINK!” e “quero o link”), o backend:

1. Confere a assinatura HMAC-SHA256 do webhook com o App Secret e valida a conta destinatária.
2. Localiza exatamente o produto daquele ID de mídia. Comentários de outros posts, do próprio perfil, de produtos sem link ou com automação pausada são ignorados.
3. Salva o comentário numa fila persistida no JSON local, com chave única por conta + ID do comentário.
4. Envia uma resposta pública natural, variando entre textos como “Claro! Vou te mandar o link no Direct 😊”.
5. Somente depois da confirmação da resposta pública, envia uma **Private Reply** ao comentário: “Oi! 😊 Aqui está o link do produto que você pediu: [link daquele produto]”.

Não é uma conversa ilimitada nem envio em massa: é uma única resposta privada ao comentário, usando recipient.comment_id. Mensagens adicionais não fazem parte desta implementação. A Meta aplica as regras e janelas da API; o sistema ignora eventos de comentários com mais de sete dias quando o horário é informado.

### Configurar uma vez

1. Conecte a conta profissional em **Configurar Instagram**. Além de instagram_business_basic e instagram_business_content_publish, o token precisa de **instagram_business_manage_comments** e **instagram_business_manage_messages**.
2. No `.env`, preencha `INSTAGRAM_APP_SECRET` (segredo do aplicativo Meta, diferente do token da conta), `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` e `INSTAGRAM_AUTOMATION_ENABLED=true`. Na primeira inicialização, um Verify token é gerado quando a variável ainda não existe. Use `false` para pausar. Abra **Comentou LINK → resposta + Direct → Atualizar status**.
3. Disponibilize também **/api/instagram/webhook** por HTTPS público, além de /api/files/. Somente essa rota de webhook fica fora da restrição de host local: GET verifica o token; POST exige a assinatura X-Hub-Signature-256 sobre os bytes originais. Os outros comandos permanecem locais.
4. No painel do app Meta, configure o webhook Instagram com a **Callback URL** e o **Verify token** mostrados na interface e selecione o campo **comments**. O handshake GET marca o callback como verificado.
5. Na interface, clique em **Assinar comentários da conta na Meta** para executar a assinatura em /{ig-user-id}/subscribed_apps com subscribed_fields=comments. A assinatura do perfil não substitui a configuração da URL no painel Meta.
6. Ative e salve a automação. Para comentários de pessoas fora dos perfis de teste do app, configure o acesso/permissões exigidos pela Meta e conclua a análise aplicável no painel de desenvolvedor.
7. Em cada produto, mantenha marcada a opção **Responder ao comentário LINK e enviar este link no Direct**. A automação exige o link de afiliado. Em um Reel já publicado, o botão permite pausar/reativar sem renderizar ou publicar novamente.

O serviço Node e a URL HTTPS precisam continuar disponíveis para atender comentários após a publicação. O computador desligado não recebe webhooks em tempo real. A conta sem permissões ou sem configuração de webhook não envia mensagens automaticamente.

Todas as credenciais ficam no `.env`, ignorado pelo Git e bloqueado pelo servidor de desenvolvimento. Os antigos arquivos de configuração são migrados automaticamente para ele na inicialização. `data/instagram-automation.json` guarda somente registros operacionais de verificação/assinatura, sem segredos. Faça backup da pasta data e do `.env` com cuidado.

### Acompanhamento e falhas

O painel mostra separadamente a resposta no comentário, o Direct e os erros. A mesma entrega de webhook não gera novas respostas ao mesmo comentário, mesmo após reinício. Registros ainda pendentes são retomados ao iniciar o backend ou reativar a automação. Envios interrompidos sem confirmação ficam como **Conferir no Instagram** e não são repetidos automaticamente. Se a resposta pública falhar ou ficar sem confirmação, o Direct não é enviado.

Os testes verificam esse fluxo com a API da Meta simulada, incluindo assinaturas inválidas, mídia errada, produto sem link, automação pausada, eventos duplicados, erro na resposta pública e falha no Direct. Nenhuma resposta ou mensagem real é enviada durante os testes.

Referências: [Private Replies da Meta](https://developers.facebook.com/docs/instagram-platform/private-replies/), [Instagram Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/), [coleção oficial da Meta com permissões Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

## Dados

O backend cria automaticamente `data/database.json` para projetos, pastas, roteiros, cenas e metadados, e `data/files/` para imagens, áudio e MP4. O caminho é o mesmo ao usar o código-fonte ou a versão compilada. Os dados sobrevivem ao fechamento do app e ao reinício do backend. Faça backup da pasta data inteira. LOCAL_DATA_DIR permite mudar esse diretório. Nunca apague data para atualizar o app.

As gravações são serializadas e o JSON é substituído de forma atômica. Execute uma instância do backend por diretório de dados. Ao reiniciar, renderizações interrompidas são marcadas como erro e podem ser iniciadas novamente. A fila não é retomada automaticamente.

Não é preciso executar SQL. Os arquivos em supabase/ foram preservados como referência da implementação anterior e não são usados.

## Fluxo manual

Crie o tema, escreva título e roteiro, defina texto e duração de cada cena e envie uma imagem por cena. Narração MP3/WAV é opcional. Imagens aceitas: PNG/JPEG/WebP; limite por upload: 25 MB. Cartão final e capa são opcionais. Renderize e baixe o MP4. As legendas têm tempo aproximado, distribuído pela duração do vídeo.

Ao editar roteiro, imagens, áudio ou cartão final, renderize novamente. Imagens são preservadas por posição da cena. Se alterar o texto narrado, envie um novo áudio.

Para medir a duração do áudio e otimizar MP4, disponibilize FFmpeg no PATH (no Windows, o backend também encontra o binário incluído no Remotion).

## Verificações

- `npm run lint`: verificação de tipos.
- `npm run build`: build do frontend.
- `npm run build --workspace=backend`: build do backend.
- `npm start --workspace=backend`: inicia backend compilado.
- `npm run test --workspace=backend`: validações, persistência e fluxo de API com dados temporários.
- `npm run test:products --workspace=backend`: após compilar o backend, verifica importação, categorias, marca d’água/logo, áudio, download e persistência com arquivos temporários.
- `npm run test:render --workspace=backend`: após compilar, testa um MP4 local de 1 segundo.

O backend precisa de um processo Node persistente com Chrome/FFmpeg e disco persistente. Não serve como função serverless. O Vercel da raiz atende somente o frontend. Esta versão é para uso local, sem autenticação.
## Descrições de produto com Anthropic

No `.env` da raiz, preencha `ANTHROPIC_API_KEY` com sua chave da API. No editor de um vídeo, abra **Descrição com IA → Atualizar configuração**. A chave fica somente no backend e nunca é devolvida pela API de status. As integrações releem o arquivo a cada operação; após editar as variáveis de servidor como PORT, reinicie `npm run dev`. Não use o prefixo VITE_ para segredos.

O modelo é fixo em **Claude Haiku 5.5** (`claude-haiku-5-5`), a opção mais barata da linha atual conforme a [documentação da Anthropic](https://platform.claude.com/docs/en/models/haiku-5-5/overview). Não existe fallback para um modelo mais caro. Cada clique de geração faz uma chamada, com no máximo 6.000 caracteres de dados de produto e 700 tokens de saída; sem ferramentas de busca pagas, raciocínio estendido ou tentativas automáticas. A geração consome créditos da API Anthropic.

Cole o link direto do produto, ou deixe o campo vazio para usar o link de afiliado. O backend lê metadados de produto em HTML/JSON-LD, acompanhando até cinco redirecionamentos, com limite de tamanho e tempo. Destinos privados são bloqueados e o endereço DNS validado é fixado à conexão em cada etapa. Lojas que exigem JavaScript, login, CAPTCHA ou só oferecem IPv6 podem impedir a leitura: nesses casos, cole nome e características no campo de informações. Quando preenchido, esse texto substitui a consulta à página.

Clique **Gerar descrição do produto**, revise o rascunho e escolha **Usar na descrição**. O texto continua editável. O link de afiliado original permanece separado e é incluído pelo fluxo existente; quando a automação está marcada e há link, o prompt pede a chamada para comentar LINK. Essa operação não renderiza, publica nem envia mensagens. Os testes usam respostas simuladas da Anthropic e não consomem créditos reais.

## Agendamento de Reels

Em **Agendar publicações**, selecione uma edição finalizada, informe data e hora e revise antes de confirmar. O horário exibido é o fuso do navegador; a API recebe um instante UTC, independentemente do fuso da VPS. A conta e a URL HTTPS precisam estar configuradas. O botão cancelar funciona até o envio começar.

Os agendamentos ficam em `data/scheduler.sqlite` (SQLite nativo do Node.js 22.13+). Não exige servidor de banco separado. O processo verifica a fila a cada 15 segundos e mantém os horários após reinícios. A publicação pode levar alguns minutos para ser processada pela Meta. Se a VPS voltar com mais de 15 minutos de atraso, o agendamento é marcado como horário perdido para reagendar. Falhas não geram tentativas automáticas. Envios interrompidos sem confirmação ficam para conferência, evitando duplicações. A conta vinculada é conferida antes do envio.

Para backup completo, preserve também `scheduler.sqlite` e seus arquivos WAL/SHM enquanto o processo estiver ativo; prefira backup SQLite consistente ou pare somente o serviço do Shorts antes de copiar a base. Projetos e mídias continuam na estrutura local existente.
## Limpeza de vídeos publicados

Com `MEDIA_CLEANUP_ENABLED=true` no `.env`, o backend verifica a cada 10 minutos e ao iniciar se existem MP4 editados cuja publicação foi confirmada há pelo menos 24 horas. O horário de confirmação é registrado tanto para publicação manual quanto para agendamento. Para registros antigos, usa-se `publish_attempted_at` somente se o estado final for publicado; sem data conhecida, o arquivo é preservado. Falhas, agendamentos futuros e envios incertos não são removidos.

`MEDIA_CLEANUP_ORIGINALS=true` permite remover também o original da biblioteca, somente quando todas as edições vinculadas já foram publicadas há pelo menos 24h. Edições pendentes preservam o original. Arquivos e pastas simbólicos são rejeitados e a limpeza não remove pastas, marcas d’água, banco de dados, legendas, links nem registros de publicação. O vínculo do Reel com a automação LINK permanece salvo. O painel identifica MP4 removidos e continua oferecendo o link da publicação no Instagram.
