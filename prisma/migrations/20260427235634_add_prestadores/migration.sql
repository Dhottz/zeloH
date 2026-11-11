-- CreateTable
CREATE TABLE "Prestador" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidade" TEXT,
    "cnpj" TEXT,
    "cpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prestador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prestador_condominioId_idx" ON "Prestador"("condominioId");

-- CreateIndex
CREATE INDEX "Prestador_condominioId_ativo_idx" ON "Prestador"("condominioId", "ativo");

-- AddForeignKey
ALTER TABLE "Prestador" ADD CONSTRAINT "Prestador_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
