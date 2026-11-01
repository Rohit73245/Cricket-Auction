-- Remove only the incomplete LeagueRules additions

DROP INDEX IF EXISTS "Auction_leagueRulesId_idx";

ALTER TABLE "Auction"
DROP CONSTRAINT IF EXISTS "Auction_leagueRulesId_fkey";

ALTER TABLE "Auction"
DROP COLUMN IF EXISTS "leagueRulesId";

DROP TABLE IF EXISTS "LeagueRules";