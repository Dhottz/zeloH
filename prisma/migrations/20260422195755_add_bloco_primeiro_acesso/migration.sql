-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bloco" TEXT,
ADD COLUMN     "primeiroAcesso" BOOLEAN NOT NULL DEFAULT false;
