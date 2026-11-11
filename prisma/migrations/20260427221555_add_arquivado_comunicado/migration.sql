-- AlterTable
ALTER TABLE "Comunicado" ADD COLUMN     "arquivado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Comunicado_condominioId_arquivado_idx" ON "Comunicado"("condominioId", "arquivado");
