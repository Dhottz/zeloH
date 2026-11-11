-- CreateEnum
CREATE TYPE "DocumentoTipo" AS ENUM ('CONTRATO', 'ATA', 'REGULAMENTO', 'PROCURACAO', 'OUTRO');

-- DropForeignKey
ALTER TABLE "Documento" DROP CONSTRAINT "Documento_condominioId_fkey";

-- AlterTable
ALTER TABLE "Documento" DROP COLUMN "url",
ADD COLUMN     "conteudo" TEXT,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "DocumentoTipo" NOT NULL DEFAULT 'OUTRO';

-- CreateIndex
CREATE INDEX "Documento_tipo_idx" ON "Documento"("tipo");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
