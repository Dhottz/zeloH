# ZeloH — o centro de operações do condomínio

Next.js 16 (App Router) · Prisma 7 + PostgreSQL · Supabase Storage · Claude (ZileIA) · VISTTO

## Rodando localmente

```bash
docker compose -f ../docker-compose.yml up -d   # Postgres na porta 5433
npm install
npx prisma migrate deploy
npm run dev                                       # http://localhost:3001
```

## Variáveis de ambiente (`.env`)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres |
| `JWT_SECRET` | sim (≥ 32 caracteres) | Assina as sessões. Em produção o app não sobe sem ela |
| `NEXT_PUBLIC_APP_URL` | sim em produção | URL pública (links de convite, QR Codes, e-mails). Ex.: `https://app.zeloh.com.br` |
| `ANTHROPIC_API_KEY` | para a ZileIA | Assistente de IA e leitura de PDFs |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | para fotos e arquivos | Supabase Storage |
| `SUPABASE_BUCKET` | não (padrão `zeloh`) | Nome do bucket **privado** |
| `RESEND_API_KEY` / `EMAIL_FROM` | para e-mail | Ex.: `EMAIL_FROM="ZeloH <avisos@seudominio.com.br>"` (domínio verificado no Resend) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | para push no celular | Gere com `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | não | `mailto:` de contato do remetente do push |
| `CRON_SECRET` | sim em produção | Protege `/api/cron/*` (a Vercel envia automaticamente) |
| `VISTTO_API_URL` / `VISTTO_API_KEY` / `VISTTO_WEBHOOK_SECRET` | para a integração VISTTO | |

Sem Supabase, Resend ou VAPID o app funciona normalmente — só o recurso correspondente fica desligado
(upload retorna aviso, e-mail/push são ignorados e as notificações continuam no app).

## Rotinas automáticas (Vercel Cron — `vercel.json`)

- `/api/cron/diario` — gera as OS dos planos preventivos, dispara comunicados agendados e avisa os gestores
  sobre contratos, certificados e garantias perto de vencer (30, 7, 1 e 0 dias).
- `/api/cron/arquivar-chamados` — arquiva ocorrências concluídas há mais de 2 dias.

## Módulos

Dashboard com "Precisa da sua atenção" · Ocorrências (fotos, avaliação, gerar OS) · Manutenções
(preventiva/corretiva, checklist, fotos, orçamento com aprovação) · Planos preventivos · Equipamentos com
QR Code e histórico · Contratos e certificados · Prestadores com avaliação · Encomendas com foto e aviso ·
Comunicados (segmentação, agendamento, confirmação de leitura) · Enquetes · Documentos com versões ·
Financeiro (despesas, aprovação, orçado × realizado, relatório) · Auditoria · Multi-condomínio · ZileIA.

Perfis: síndico, subsíndico, conselho, zelador, porteiro, prestador, morador e administradora.
