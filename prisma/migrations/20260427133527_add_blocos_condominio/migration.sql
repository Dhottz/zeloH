-- AlterTable
ALTER TABLE "Condominio" ADD COLUMN     "blocos" TEXT[] DEFAULT ARRAY[]::TEXT[];
