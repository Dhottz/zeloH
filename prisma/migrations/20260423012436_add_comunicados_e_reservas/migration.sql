-- CreateEnum
CREATE TYPE "ReservaStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "AreaComum" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "capacidade" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaComum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "moradorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "status" "ReservaStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaComum_condominioId_idx" ON "AreaComum"("condominioId");

-- CreateIndex
CREATE INDEX "Reserva_condominioId_idx" ON "Reserva"("condominioId");

-- CreateIndex
CREATE INDEX "Reserva_areaId_data_idx" ON "Reserva"("areaId", "data");

-- CreateIndex
CREATE INDEX "Reserva_moradorId_idx" ON "Reserva"("moradorId");

-- AddForeignKey
ALTER TABLE "AreaComum" ADD CONSTRAINT "AreaComum_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "Condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaComum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
