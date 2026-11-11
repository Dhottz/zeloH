-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SINDICO', 'ZELADOR', 'MORADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChamadoStatus" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_PRESTADOR', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ChamadoPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "MensagemAutor" AS ENUM ('MORADOR', 'ASSISTENTE', 'SINDICO');

-- CreateTable
CREATE TABLE "Condominio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "visttoClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MORADOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "condominioId" TEXT NOT NULL,
    "unidade" TEXT,
    "telefone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "moradorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "ChamadoStatus" NOT NULL DEFAULT 'ABERTO',
    "prioridade" "ChamadoPriority" NOT NULL DEFAULT 'MEDIA',
    "visttoOsId" TEXT,
    "visttoOsCod" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "chamadoId" TEXT,
    "titulo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorTipo" "MensagemAutor" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManutencaoHistorico" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "visttoOsId" TEXT NOT NULL,
    "visttoOsCod" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL,
    "prioridade" TEXT,
    "prestadorNome" TEXT,
    "prestadorCnpj" TEXT,
    "valor" DECIMAL(65,30),
    "agendadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManutencaoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER,
    "uploadadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_cnpj_key" ON "Condominio"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Condominio_visttoClientId_key" ON "Condominio"("visttoClientId");

-- CreateIndex
CREATE INDEX "Condominio_cnpj_idx" ON "Condominio"("cnpj");

-- CreateIndex
CREATE INDEX "Condominio_visttoClientId_idx" ON "Condominio"("visttoClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_condominioId_idx" ON "Usuario"("condominioId");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Chamado_condominioId_idx" ON "Chamado"("condominioId");

-- CreateIndex
CREATE INDEX "Chamado_moradorId_idx" ON "Chamado"("moradorId");

-- CreateIndex
CREATE INDEX "Chamado_status_idx" ON "Chamado"("status");

-- CreateIndex
CREATE INDEX "Chamado_visttoOsId_idx" ON "Chamado"("visttoOsId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_chamadoId_key" ON "Conversa"("chamadoId");

-- CreateIndex
CREATE INDEX "Conversa_condominioId_idx" ON "Conversa"("condominioId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_idx" ON "Mensagem"("conversaId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_createdAt_idx" ON "Mensagem"("conversaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManutencaoHistorico_visttoOsId_key" ON "ManutencaoHistorico"("visttoOsId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_condominioId_idx" ON "ManutencaoHistorico"("condominioId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_visttoOsId_idx" ON "ManutencaoHistorico"("visttoOsId");

-- CreateIndex
CREATE INDEX "ManutencaoHistorico_prestadorCnpj_idx" ON "ManutencaoHistorico"("prestadorCnpj");

-- CreateIndex
CREATE INDEX "Documento_condominioId_idx" ON "Documento"("condominioId");

-- CreateIndex
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManutencaoHistorico" ADD CONSTRAINT "ManutencaoHistorico_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
