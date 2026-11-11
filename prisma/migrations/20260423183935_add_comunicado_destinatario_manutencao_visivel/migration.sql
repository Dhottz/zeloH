-- CreateEnum
CREATE TYPE "ComunicadoDestinatario" AS ENUM ('TODOS', 'BLOCOS', 'UNIDADES');

-- AlterTable
ALTER TABLE "Comunicado" ADD COLUMN     "blocos" TEXT[],
ADD COLUMN     "destinatario" "ComunicadoDestinatario" NOT NULL DEFAULT 'TODOS',
ADD COLUMN     "unidades" TEXT[];

-- AlterTable
ALTER TABLE "ManutencaoHistorico" ADD COLUMN     "visivelParaMoradores" BOOLEAN NOT NULL DEFAULT false;
