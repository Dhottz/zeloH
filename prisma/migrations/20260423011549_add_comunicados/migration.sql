-- CreateEnum
CREATE TYPE "ComunicadoTipo" AS ENUM ('GERAL', 'URGENTE', 'AVISO', 'EVENTO');

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "ComunicadoTipo" NOT NULL DEFAULT 'GERAL',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "fixado" BOOLEAN NOT NULL DEFAULT false,
    "expiraEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_idx" ON "Comunicado"("condominioId");

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_publicado_idx" ON "Comunicado"("condominioId", "publicado");

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_tipo_idx" ON "Comunicado"("condominioId", "tipo");

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
