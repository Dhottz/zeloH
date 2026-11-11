-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "link" TEXT NOT NULL DEFAULT '/dashboard',
    "autorNome" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_condominioId_idx" ON "Notificacao"("condominioId");

-- CreateIndex
CREATE INDEX "Notificacao_condominioId_criadaEm_idx" ON "Notificacao"("condominioId", "criadaEm");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
