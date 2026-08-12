/** CLI entry point for the materializer. In production this would run nightly. */
import { PrismaClient } from '@prisma/client'
import { recompute } from '../src/server/materialize'

const prisma = new PrismaClient()

async function main() {
  console.log('Recomputing obligations...')
  const result = await recompute(prisma)
  console.log(
    `Done in ${result.durationMs}ms — ${result.carriersProcessed} carriers, ` +
      `${result.obligationsWritten} obligations, ${result.blocksWritten} blocker edges.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
