/**
 * Prisma Client Singleton
 * Garante uma única instância do PrismaClient em toda a aplicação
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

// Configuração do Prisma Client com logging
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    errorFormat: 'pretty',
  });
};

// Garantir que só existe uma instância
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
