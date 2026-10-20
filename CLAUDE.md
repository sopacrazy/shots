# Projeto Clipai

Aplicação local, sem Supabase e sem provedores de IA. Não exige .env.
Fluxo: tema → roteiro/cenas manuais → uploads → Remotion/FFmpeg → MP4.
Dados em data/database.json e arquivos em data/files/, ignorados pelo Git. Nunca apagar dados do usuário ao atualizar.
Persistência tipada em backend/src/services/local.service.ts: read() devolve snapshot e change() aplica alterações serializadas com escrita atômica. Uma instância Node por diretório. Reinício recupera renderizações interrompidas marcando erro.
API /api/files serve arquivos locais com suporte Range. URLs persistidas são relativas; o worker resolve a origem HTTP local para Chrome e usa o arquivo direto no FFmpeg.
Não executar migrations Supabase. Pasta supabase/ é apenas referência histórica.
Comandos de build e testes no README.md.

Tela principal ProductStudio: biblioteca em data/library/Categoria, descrição somente na publicação, marca d’água e logo com Remotion ProductComposition. video.service.ts importa/prova vídeos e processa a fila. Histórico em Database.edits.
Instagram usa token e URL pública configurados no .env via graph.instagram.com. Todas as credenciais, inclusive Anthropic e webhook, ficam no .env, nunca retornado pelas APIs nem exposto pelo Vite. settings.service.ts migra os antigos JSONs preservando os valores e removendo os segredos dos arquivos antigos. Nunca publicar automaticamente após editar: somente ação explícita no app. Nenhuma publicação real deve ocorrer em testes. Testes devem usar CLIPAI_ENV_FILE em diretório temporário, nunca o .env real.

Automação LINK → comentário público natural → Private Reply por comment_id: comment-automation.service.ts e instagram-webhook.ts. Webhook público montado antes de cors/JSON; autentica HMAC sobre corpo bruto e handshake Verify token. App Secret, Verify token e ativação global no .env; data/instagram-automation.json contém apenas metadados operacionais. Assinatura da conta via subscribed_apps com comments; configuração da URL no painel Meta é separada.
Database.comment_replies é o registro durável e deduplica por conta + comentário; só envia Direct após confirmação da resposta pública. Falha de rede/timeout não implica rejeição da Meta: marcar unknown e não repetir automaticamente. Não enviar para mídia desconhecida, outro perfil, comentário próprio ou produto sem link/pausado. Publicação salva instagram_account_id e instagram_media_id.
Testes de webhook e mensagens sempre com fetch simulado; jamais usar a conta real nos testes.
