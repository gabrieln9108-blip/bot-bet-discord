# Inventário seguro de APIs e variáveis de ambiente

Este arquivo é um mapa de configuração para Render, Supabase e Kiwify.
Ele **não contém credenciais reais**. Segredos não devem entrar no ZIP, no Git,
no HTML, no frontend, em logs ou em mensagens.

## URLs públicas usadas no deploy

| Variável/valor | Onde cadastrar | Uso |
|---|---|---|
| `FRONTEND_URL` | Anotação do operador/Render | URL pública do frontend. O backend não lê esse nome diretamente. |
| `BACKEND_URL` | Anotação do operador/Render | URL pública da API. O frontend usa o valor equivalente em `VITE_API_URL`. |
| `ALLOWED_ORIGINS` | Render — backend | Deve receber a URL do frontend, sem `*` e sem barra final. Ex.: `https://seu-frontend.onrender.com`. |
| `VITE_API_URL` | Render — frontend | URL pública da API, usada pelo bundle do frontend. |

Se o frontend e a API estiverem no mesmo domínio, `VITE_API_URL` pode ficar
vazio e as chamadas relativas serão usadas. Em produção, prefira HTTPS.

## Supabase

### Frontend — variáveis públicas

| Variável | Obrigatória | Observação |
|---|---:|---|
| `VITE_SUPABASE_URL` | Não, se a autenticação for somente pelo backend | URL do projeto, por exemplo `https://<project-ref>.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Não, se a autenticação for somente pelo backend | Chave pública anon/publishable. Ainda assim, o RLS deve estar ativado. |

Essas duas variáveis podem aparecer no bundle público. **Nunca** coloque a
service role key nelas.

### Backend — variáveis privadas

| Variável | Obrigatória em produção | Observação |
|---|---:|---|
| `SUPABASE_URL` | Sim, quando o backend validar tokens Supabase | Mesma URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim, quando o backend validar tokens Supabase | Segredo exclusivo do backend. Nunca usar prefixo `VITE_`. |

O arquivo `SUPABASE_SQL_EDITOR_PROMPT.sql` contém o schema, RLS, índices,
triggers, tabela de auditoria, eventos de pagamento e bucket privado.

## Kiwify/pagamento

O backend atual **não usa uma API key da Kiwify**. Ele recebe e valida um
webhook assinado. Cadastre a URL abaixo no painel do provedor:

```text
https://<BACKEND_URL>/api/webhooks/kiwify
```

| Variável | Obrigatória em produção | Uso |
|---|---:|---|
| `PAYMENT_WEBHOOK_SECRET` | Sim | Segredo HMAC do webhook. |
| `PAYMENT_PRODUCT_ID` | Sim, ou use o nome | ID exato do produto aprovado. |
| `PAYMENT_PRODUCT_NAME` | Alternativa ao ID | Nome exato do produto, usado quando o provedor não envia ID. |
| `CHECKOUT_URL` | Sim para iniciar checkout | URL HTTPS do checkout. |

Aliases compatíveis com a nomenclatura Kiwify:

```text
KIWIFY_WEBHOOK_SECRET=<mesmo segredo do webhook>
KIWIFY_PRODUCT_ID=<mesmo ID do produto>
KIWIFY_PRODUCT_NAME=<mesmo nome do produto>
KIWIFY_CHECKOUT_URL=https://<checkout-do-provedor>
```

O webhook aceita `X-Payment-Signature` ou `X-Kiwify-Signature`. O backend
confere assinatura, produto, valor, moeda, comprador, transação, timestamp,
status e replay.

## Configuração operacional do backend

```text
NODE_ENV=production
PORT=10000
TRUST_PROXY=false
LOG_LEVEL=info

# CORS: apenas origens reais do frontend, separadas por vírgula.
ALLOWED_ORIGINS=https://<seu-frontend.onrender.com>

# Supabase privado
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<preencher como Secret no Render>

# Pagamento
PAYMENT_WEBHOOK_SECRET=<preencher como Secret no Render>
PAYMENT_PRODUCT_ID=<preencher como variável protegida>
CHECKOUT_URL=https://<checkout-do-provedor>
```

Limites opcionais que já são lidos pelo backend:

```text
JOB_ANALYSIS_DAILY_LIMIT=10
JOB_ANALYSIS_HOURLY_LIMIT=4
GLOBAL_JOB_ANALYSIS_LIMIT=1000
```

`DEMO_ACCESS_EMAIL` existe apenas para demonstração fora de produção e não
deve ser usado como mecanismo de autenticação em produção.

## Variáveis que não devem ser inventadas

- `KIWIFY_API_KEY`: não é lida pelo backend atual.
- `DATABASE_URL`: aparece apenas na documentação genérica do workspace; o
  snapshot atual ainda usa arrays/Map em memória e não abre uma conexão de
  banco. A persistência deve ser integrada antes de cadastrar essa variável.
- `FRONTEND_URL` e `BACKEND_URL`: são referências operacionais; o código usa
  `ALLOWED_ORIGINS` e `VITE_API_URL` para a comunicação real.

## Checklist rápido no Render

1. No serviço backend, cadastre as variáveis privadas e os Secrets.
2. No serviço frontend, cadastre apenas `VITE_API_URL`, `VITE_SUPABASE_URL` e,
   se usado, `VITE_SUPABASE_ANON_KEY`.
3. Copie a URL final do frontend para `ALLOWED_ORIGINS` no backend.
4. Configure o webhook do provedor para `/api/webhooks/kiwify`.
5. Execute o SQL do arquivo `SUPABASE_SQL_EDITOR_PROMPT.sql` no projeto
   Supabase correto.
6. Nunca substitua placeholders por segredos dentro deste arquivo ou do ZIP.