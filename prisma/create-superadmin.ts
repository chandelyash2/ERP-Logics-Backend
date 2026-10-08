import prisma from "../src/db/prisma.js";
import { AuthService } from "../src/modules/auth/auth.service.js";

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "superadmin@pharmavanguard.com").toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || "SuperAdmin@Pharma2026!";
  const name = process.env.SUPERADMIN_NAME || "Platform Super Admin";

  console.log(`🔐 Provisioning Super Admin account: ${email}...`);

  const passwordHash = await AuthService.hashPassword(password);

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      canCreateInvoices: true,
      canViewInventory: true,
      canAddCustomers: true,
      canAddSuppliers: true,
      canRecordPayments: true,
      canViewReports: true,
      canEditDeleteRecords: true,
      canManageSettings: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      companyId: null, // Super Admin is not tied to a single tenant
      canCreateInvoices: true,
      canViewInventory: true,
      canAddCustomers: true,
      canAddSuppliers: true,
      canRecordPayments: true,
      canViewReports: true,
      canEditDeleteRecords: true,
      canManageSettings: true,
    },
  });

  console.log("✅ Super Admin created successfully!");
  console.log(`   Email: ${superAdmin.email}`);
  console.log(`   Role: ${superAdmin.role}`);
  console.log("   Portal: http://localhost:3000/superadmin");
}

main()
  .catch((e) => {
    console.error("❌ Failed to create Super Admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
