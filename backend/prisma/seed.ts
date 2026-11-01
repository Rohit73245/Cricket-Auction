
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const iplRules = {
    rulesSourceSeason: '2026',
    currency: 'INR',
    teamPurse: 1250000000,
    minimumSquadSize: 18,
    maximumSquadSize: 25,
    maximumOverseasPlayers: 8,
    maximumOverseasInXI: 4,
    minimumLocalPlayers: null,
    minimumUnder22Players: null,
    rulesSource:
      'Official IPL 2025–27 Player Regulations and IPL 2026 auction announcements',
    verified: true,
  };

  const result = await prisma.leagueRules.upsert({
    where: { leagueId: 'IPL' },
    update: iplRules,
    create: {
      leagueId: 'IPL',
      ...iplRules,
    },
  });

  console.log('IPL 2026 rules saved successfully!');
  console.log(result);
}

main()
  .catch((error) => {
    console.error('Error saving IPL rules:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
