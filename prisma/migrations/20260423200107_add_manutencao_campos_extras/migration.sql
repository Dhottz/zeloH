-- AlterTable
ALTER TABLE "ManutencaoHistorico" ADD COLUMN     "empresaNome" TEXT,
ADD COLUMN     "local" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'VISTTO',
ADD COLUMN     "registradoPor" TEXT,
ALTER COLUMN "visttoOsId" DROP NOT NULL;
