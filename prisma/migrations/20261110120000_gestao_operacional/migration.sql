
-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('ESSENCIAL', 'GESTAO', 'COMPLETO');

-- CreateEnum
CREATE TYPE "AssinaturaStatus" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ManutencaoTipo" AS ENUM ('PREVENTIVA', 'CORRETIVA');

-- CreateEnum
CREATE TYPE "OrcamentoStatus" AS ENUM ('NAO_SE_APLICA', 'PENDENTE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "EncomendaStatus" AS ENUM ('AGUARDANDO', 'RETIRADA', 'DEVOLVIDA');

-- CreateEnum
CREATE TYPE "DespesaStatus" AS ENUM ('PENDENTE_APROVACAO', 'APROVADA', 'REPROVADA', 'PAGA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUBSINDICO';
ALTER TYPE "UserRole" ADD VALUE 'CONSELHO';
ALTER TYPE "UserRole" ADD VALUE 'PRESTADOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentoTipo" ADD VALUE 'CONVENCAO';
ALTER TYPE "DocumentoTipo" ADD VALUE 'PRESTACAO_CONTAS';
ALTER TYPE "DocumentoTipo" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "Condominio" ADD COLUMN     "assinaturaFimPeriodo" TIMESTAMP(3),
ADD COLUMN     "assinaturaStatus" "AssinaturaStatus" NOT NULL DEFAULT 'ATIVA',
ADD COLUMN     "numeroUnidades" INTEGER,
ADD COLUMN     "plano" "Plano" NOT NULL DEFAULT 'COMPLETO',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "trialAte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "notificarEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prestadorId" TEXT;

-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN     "avaliacaoComentario" TEXT,
ADD COLUMN     "avaliacaoNota" INTEGER,
ADD COLUMN     "equipamentoId" TEXT,
ADD COLUMN     "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "local" TEXT;

-- AlterTable
ALTER TABLE "ManutencaoHistorico" ADD COLUMN     "anexos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "chamadoId" TEXT,
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "equipamentoId" TEXT,
ADD COLUMN     "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orcamentoArquivo" TEXT,
ADD COLUMN     "orcamentoDecididoEm" TIMESTAMP(3),
ADD COLUMN     "orcamentoDecididoPor" TEXT,
ADD COLUMN     "orcamentoObs" TEXT,
ADD COLUMN     "orcamentoStatus" "OrcamentoStatus" NOT NULL DEFAULT 'NAO_SE_APLICA',
ADD COLUMN     "orcamentoValor" DECIMAL(65,30),
ADD COLUMN     "planoId" TEXT,
ADD COLUMN     "prestadorId" TEXT,
ADD COLUMN     "tipo" "ManutencaoTipo" NOT NULL DEFAULT 'CORRETIVA';

-- AlterTable
ALTER TABLE "Comunicado" ADD COLUMN     "anexos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notificadoEm" TIMESTAMP(3),
ADD COLUMN     "publicarEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN     "lidaEm" TIMESTAMP(3),
ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "arquivo" TEXT,
ADD COLUMN     "atual" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "grupoId" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "UsuarioCondominio" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioCondominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'OUTRO',
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "local" TEXT,
    "instaladoEm" TIMESTAMP(3),
    "garantiaAte" TIMESTAMP(3),
    "vidaUtilAnos" INTEGER,
    "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anexos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoManutencao" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "equipamentoId" TEXT,
    "prestadorId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "intervaloDias" INTEGER NOT NULL,
    "proximaEm" TIMESTAMP(3) NOT NULL,
    "antecedenciaDias" INTEGER NOT NULL DEFAULT 7,
    "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "prestadorId" TEXT,
    "titulo" TEXT NOT NULL,
    "objeto" TEXT,
    "valor" DECIMAL(65,30),
    "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL',
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "renovacaoAutomatica" BOOLEAN NOT NULL DEFAULT false,
    "avisoDias" INTEGER NOT NULL DEFAULT 30,
    "arquivo" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'OUTRO',
    "titulo" TEXT NOT NULL,
    "numero" TEXT,
    "emissor" TEXT,
    "emitidoEm" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "arquivo" TEXT,
    "equipamentoId" TEXT,
    "prestadorId" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoPrestador" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "prestadorId" TEXT NOT NULL,
    "manutencaoId" TEXT,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "autorId" TEXT,
    "autorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoPrestador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicadoLeitura" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComunicadoLeitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquete" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "opcoes" TEXT[],
    "multiplaEscolha" BOOLEAN NOT NULL DEFAULT false,
    "encerraEm" TIMESTAMP(3),
    "encerrada" BOOLEAN NOT NULL DEFAULT false,
    "resultadoPublico" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnqueteVoto" (
    "id" TEXT NOT NULL,
    "enqueteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "opcoes" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnqueteVoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encomenda" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "destinatarioId" TEXT,
    "destinatarioNome" TEXT NOT NULL,
    "unidade" TEXT,
    "bloco" TEXT,
    "remetente" TEXT,
    "descricao" TEXT,
    "codigoRastreio" TEXT,
    "foto" TEXT,
    "status" "EncomendaStatus" NOT NULL DEFAULT 'AGUARDANDO',
    "recebidaPor" TEXT,
    "retiradaEm" TIMESTAMP(3),
    "retiradoPor" TEXT,
    "retiradoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encomenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3),
    "status" "DespesaStatus" NOT NULL DEFAULT 'PENDENTE_APROVACAO',
    "pagoEm" TIMESTAMP(3),
    "formaPagamento" TEXT,
    "comprovante" TEXT,
    "notaFiscal" TEXT,
    "prestadorId" TEXT,
    "equipamentoId" TEXT,
    "manutencaoId" TEXT,
    "contratoId" TEXT,
    "criadoPor" TEXT,
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "valorMensal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContratoEquipamentos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContratoEquipamentos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "UsuarioCondominio_condominioId_idx" ON "UsuarioCondominio"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioCondominio_usuarioId_condominioId_key" ON "UsuarioCondominio"("usuarioId", "condominioId");

-- CreateIndex
CREATE INDEX "Equipamento_condominioId_idx" ON "Equipamento"("condominioId");

-- CreateIndex
CREATE INDEX "Equipamento_condominioId_categoria_idx" ON "Equipamento"("condominioId", "categoria");

-- CreateIndex
CREATE INDEX "PlanoManutencao_condominioId_idx" ON "PlanoManutencao"("condominioId");

-- CreateIndex
CREATE INDEX "PlanoManutencao_ativo_proximaEm_idx" ON "PlanoManutencao"("ativo", "proximaEm");

-- CreateIndex
CREATE INDEX "Contrato_condominioId_idx" ON "Contrato"("condominioId");

-- CreateIndex
CREATE INDEX "Contrato_condominioId_fim_idx" ON "Contrato"("condominioId", "fim");

-- CreateIndex
CREATE INDEX "Certificado_condominioId_idx" ON "Certificado"("condominioId");

-- CreateIndex
CREATE INDEX "Certificado_condominioId_validoAte_idx" ON "Certificado"("condominioId", "validoAte");

-- CreateIndex
CREATE INDEX "AvaliacaoPrestador_prestadorId_idx" ON "AvaliacaoPrestador"("prestadorId");

-- CreateIndex
CREATE INDEX "AvaliacaoPrestador_condominioId_idx" ON "AvaliacaoPrestador"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "ComunicadoLeitura_comunicadoId_usuarioId_key" ON "ComunicadoLeitura"("comunicadoId", "usuarioId");

-- CreateIndex
CREATE INDEX "Enquete_condominioId_idx" ON "Enquete"("condominioId");

-- CreateIndex
CREATE UNIQUE INDEX "EnqueteVoto_enqueteId_usuarioId_key" ON "EnqueteVoto"("enqueteId", "usuarioId");

-- CreateIndex
CREATE INDEX "Encomenda_condominioId_status_idx" ON "Encomenda"("condominioId", "status");

-- CreateIndex
CREATE INDEX "Encomenda_destinatarioId_idx" ON "Encomenda"("destinatarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_usuarioId_idx" ON "PushSubscription"("usuarioId");

-- CreateIndex
CREATE INDEX "Despesa_condominioId_competencia_idx" ON "Despesa"("condominioId", "competencia");

-- CreateIndex
CREATE INDEX "Despesa_condominioId_status_idx" ON "Despesa"("condominioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_condominioId_ano_categoria_key" ON "Orcamento"("condominioId", "ano", "categoria");

-- CreateIndex
CREATE INDEX "AuditLog_condominioId_createdAt_idx" ON "AuditLog"("condominioId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "_ContratoEquipamentos_B_index" ON "_ContratoEquipamentos"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_stripeCustomerId_key" ON "Condominio"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_stripeSubscriptionId_key" ON "Condominio"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_equipamentoId_idx" ON "ManutencaoHistorico"("equipamentoId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_planoId_idx" ON "ManutencaoHistorico"("planoId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_condominioId_tipo_idx" ON "ManutencaoHistorico"("condominioId", "tipo");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_criadaEm_idx" ON "Notificacao"("usuarioId", "criadaEm");

-- CreateIndex
CREATE INDEX "Documento_grupoId_idx" ON "Documento"("grupoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioCondominio" ADD CONSTRAINT "UsuarioCondominio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioCondominio" ADD CONSTRAINT "UsuarioCondominio_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManutencaoHistorico" ADD CONSTRAINT "ManutencaoHistorico_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManutencaoHistorico" ADD CONSTRAINT "ManutencaoHistorico_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManutencaoHistorico" ADD CONSTRAINT "ManutencaoHistorico_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoManutencao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManutencaoHistorico" ADD CONSTRAINT "ManutencaoHistorico_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoManutencao" ADD CONSTRAINT "PlanoManutencao_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoManutencao" ADD CONSTRAINT "PlanoManutencao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoManutencao" ADD CONSTRAINT "PlanoManutencao_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoPrestador" ADD CONSTRAINT "AvaliacaoPrestador_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoPrestador" ADD CONSTRAINT "AvaliacaoPrestador_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoPrestador" ADD CONSTRAINT "AvaliacaoPrestador_manutencaoId_fkey" FOREIGN KEY ("manutencaoId") REFERENCES "ManutencaoHistorico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquete" ADD CONSTRAINT "Enquete_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnqueteVoto" ADD CONSTRAINT "EnqueteVoto_enqueteId_fkey" FOREIGN KEY ("enqueteId") REFERENCES "Enquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnqueteVoto" ADD CONSTRAINT "EnqueteVoto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encomenda" ADD CONSTRAINT "Encomenda_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encomenda" ADD CONSTRAINT "Encomenda_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_manutencaoId_fkey" FOREIGN KEY ("manutencaoId") REFERENCES "ManutencaoHistorico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContratoEquipamentos" ADD CONSTRAINT "_ContratoEquipamentos_A_fkey" FOREIGN KEY ("A") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContratoEquipamentos" ADD CONSTRAINT "_ContratoEquipamentos_B_fkey" FOREIGN KEY ("B") REFERENCES "Equipamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Migração de dados ───────────────────────────────────────────────────────


-- Documentos existentes: cada um é a versão 1 do próprio grupo
UPDATE "Documento" SET "grupoId" = "id" WHERE "grupoId" IS NULL AND "tipo" <> 'ENTREGA';

-- Encomendas: eram gravadas como Documento(tipo = ENTREGA) com JSON em "conteudo"
WITH src AS (
  SELECT d.*,
         CASE WHEN d."conteudo" ~ '^\s*\{' THEN d."conteudo"::jsonb ELSE NULL END AS j,
         d."nome" LIKE 'RETIRADO:%' AS retirada,
         regexp_replace(d."nome", '^RETIRADO:\s*', '') AS nome_base
  FROM "Documento" d
  WHERE d."tipo" = 'ENTREGA'
)
INSERT INTO "Encomenda" (
  "id", "condominioId", "destinatarioId", "destinatarioNome", "unidade", "remetente",
  "descricao", "status", "recebidaPor", "retiradaEm", "retiradoPor", "createdAt", "updatedAt"
)
SELECT
  src."id",
  src."condominioId",
  (SELECT u."id" FROM "Usuario" u WHERE u."id" = src.j->>'destinatarioId'),
  split_part(src.nome_base, ' · ', 1),
  src.j->>'unidade',
  COALESCE(NULLIF(src.j->>'remetente', ''), NULLIF(split_part(src.nome_base, ' · ', 2), '')),
  src.j->>'descricao',
  CASE WHEN src.retirada THEN 'RETIRADA'::"EncomendaStatus" ELSE 'AGUARDANDO'::"EncomendaStatus" END,
  src."uploadadoPor",
  CASE WHEN src.retirada THEN COALESCE((src.j->>'retiradaEm')::timestamp, src."updatedAt") ELSE NULL END,
  src.j->>'retiradoPor',
  src."createdAt",
  src."updatedAt"
FROM src;

DELETE FROM "Documento" WHERE "tipo" = 'ENTREGA';
