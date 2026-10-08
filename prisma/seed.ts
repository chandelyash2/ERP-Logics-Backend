import { seedComprehensiveData } from "../src/modules/demo/demoSeed.js";
import prisma from "../src/db/prisma.js";

async function main() {
  console.log("🌱 Starting PharmaVanguard database seeding...");
  await seedComprehensiveData();
  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
