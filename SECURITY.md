# Segurança da aplicação

Esta versão adiciona as proteções de aplicação solicitadas pela auditoria:

- rotas de currículo, entrevistas, análises, candidaturas e dashboard exigem um Bearer token válido;
- sessões locais usam tokens aleatórios, expiram em 8 horas e podem ser invalidadas no logout;
- quando Supabase Auth é usado, o backend valida o token através do endpoint administrativo do Supabase;
- todos os registros recebem `ownerId` no servidor e cada leitura, alteração e exclusão verifica essa propriedade;
- login, primeiro acesso, checkout e API possuem limites de requisição;
- criação/edição/duplicação de currículos, entrevistas, análises de vagas, candidaturas e webhooks possuem limites separados por operação;
- endpoints sensíveis aplicam proteção progressiva contra rajadas automatizadas sem exigir CAPTCHA no uso normal;
- falhas de login usam mensagem genérica e atraso progressivo;
- CORS usa allowlist, sem wildcard, e headers de segurança são aplicados ao backend e ao servidor do frontend;
- corpo de requisições, tempo de processamento, tamanho de campos e exposição do Express são restritos;
- o preço é definido exclusivamente no backend;
- webhooks exigem HMAC, identificador de evento, valor exato do produto e proteção contra reprocessamento;
- segredos privilegiados nunca são lidos pelo frontend.
- descrições de vagas, respostas de entrevistas e textos de currículo são tratados como dados não confiáveis; padrões de prompt injection são bloqueados antes das rotas;
- URLs externas passam por validação contra esquemas perigosos, credenciais embutidas, hosts locais, redes privadas, endpoints de metadata e path traversal;
- uploads futuros têm validador de extensão, MIME, assinatura real do arquivo, tamanho, nome e caminho de armazenamento aleatório em `src/lib/upload-security.ts`;
- erros enviados ao cliente são genéricos; detalhes de auditoria não incluem senhas, tokens, API keys ou corpos de webhook;
- eventos de login, logout, falhas de autenticação, criação de senha, bloqueios, webhooks e excesso de requisições são registrados com dados minimizados.

## Variáveis obrigatórias em produção

Configure no ambiente do servidor, nunca no código do frontend:

```text
PAYMENT_WEBHOOK_SECRET=<segredo do provedor>
PAYMENT_PRODUCT_ID=<id exato do produto no provedor>
ALLOWED_ORIGINS=https://seu-frontend.example
CHECKOUT_URL=https://checkout-do-provedor.example/...
```

`ALLOWED_ORIGINS` deve conter somente as origens do frontend, separadas por vírgula. Em produção, uma origem não listada não recebe CORS. A política CSP do frontend permite apenas recursos próprios, estilos inline usados pelo React, conexões para as origens configuradas de API/Supabase e WebSocket local durante o desenvolvimento; `frame-ancestors` permanece bloqueado.

O webhook também aceita `PAYMENT_PRODUCT_NAME` como alternativa ao ID quando o provedor não fornece um identificador de produto. Em produção, pelo menos um dos dois deve ser configurado; sem essa configuração, nenhum webhook libera acesso. O payload precisa ter assinatura válida, evento e transação distintos (ou a transação como fallback), identificador do comprador, e-mail, produto, valor de R$ 16,90 e status reconhecido. Eventos repetidos são ignorados e timestamps enviados pelo provedor não podem ter mais de cinco minutos.

Para autenticação Supabase, configure também:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<somente no backend>
```

`SUPABASE_SERVICE_ROLE_KEY` nunca deve começar com `VITE_` nem ser incluída no bundle do frontend.

O armazenamento desta snapshot ainda é em memória. Em produção, substitua os `Map`/arrays por um banco persistente, aplique RLS em todas as tabelas expostas e use uma migração transacional para sessões, usuários, registros do produto e eventos de webhook. O código não declara que armazenamento em memória equivale a RLS.

## Arquivos adicionados nesta atualização

- `SUPABASE_SQL_EDITOR_PROMPT.sql`: schema executável para colar no SQL Editor, com tabelas de perfis, currículos, entrevistas, mensagens, análises, candidaturas, checkout, pagamentos, sessões, auditoria, uploads, índices, triggers, RLS e bucket privado.
- `API_CREDENTIALS_INVENTORY.md`: inventário seguro das variáveis usadas pelo frontend/backend e instruções de cadastro no Render, sem valores secretos.
- `artifacts/api-server/src/lib/upload-security.ts`: validação reutilizável para PDFs/imagens, nomes e caminhos de armazenamento.