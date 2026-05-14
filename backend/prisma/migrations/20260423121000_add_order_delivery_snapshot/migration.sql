-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "deliveryLabel" TEXT,
ADD COLUMN "deliveryCountry" TEXT NOT NULL DEFAULT 'Россия',
ADD COLUMN "deliveryCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryStreet" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryHouse" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryApartment" TEXT,
ADD COLUMN "deliveryPostalCode" TEXT,
ADD COLUMN "deliveryComment" TEXT;

-- Drop defaults used only for backfilling existing rows
ALTER TABLE "Order" ALTER COLUMN "deliveryCountry" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "deliveryCity" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "deliveryStreet" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "deliveryHouse" DROP DEFAULT;
