import prisma from "../../db/prisma.js";
import { AuthService } from "../auth/auth.service.js";
import { round2, numberToWords, getTodayDateString } from "../../utils/helpers.js";

export async function clearAllDemoData() {
  await prisma.salesReturn.deleteMany();
  await prisma.purchaseReturn.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.customerLedger.deleteMany();
  await prisma.supplierLedger.deleteMany();
  await prisma.medicineBatch.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
}

export async function seedComprehensiveData() {
  await clearAllDemoData();

  // 1. Company
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "PharmaVanguard Wholesale Agency",
        legalName: "PharmaVanguard Healthcare & Distribution LLP",
        gstin: "27AAACC1206D1ZG",
        dlNumber: "MH-TZ1-20B-11920",
        phone: "+91 98200 99881",
        email: "contact@pharmavanguard.com",
        address: "Plot 42, Pharma Industrial Corridor, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        stateCode: "27",
        pincode: "400093",
        invoicePrefix: "INV-2026-",
        purchasePrefix: "PUR-2026-",
      },
    });
  }
  const companyId = company.id;

  // 2. Default Admin and Staff Users
  const adminPasswordHash = await AuthService.hashPassword("Admin@Pharma2026!");
  const staffPasswordHash = await AuthService.hashPassword("Staff@Pharma2026!");

  await prisma.user.upsert({
    where: { email: "admin@pharmavanguard.com" },
    update: { passwordHash: adminPasswordHash, companyId },
    create: {
      email: "admin@pharmavanguard.com",
      name: "Super Admin (Pharma Chief)",
      role: "BUSINESS_OWNER",
      companyId,
      passwordHash: adminPasswordHash,
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

  await prisma.user.upsert({
    where: { email: "staff@pharmavanguard.com" },
    update: { passwordHash: staffPasswordHash, companyId },
    create: {
      email: "staff@pharmavanguard.com",
      name: "Vikash Kumar (Billing Staff)",
      role: "STAFF",
      companyId,
      passwordHash: staffPasswordHash,
      canCreateInvoices: true,
      canViewInventory: true,
      canAddCustomers: true,
      canAddSuppliers: false,
      canRecordPayments: false,
      canViewReports: false,
      canEditDeleteRecords: false,
      canManageSettings: false,
    },
  });

  // 3. Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        companyId,
        supplierIdCode: "SUP-0001",
        name: "Cipla Distribution Hub",
        companyName: "Cipla Ltd",
        phone: "+91 98201 11222",
        email: "orders@ciplahub.com",
        address: "Plot 12, MIDC Industrial Area, Andheri East",
        city: "Mumbai",
        district: "Mumbai Suburban",
        pincode: "400093",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AAACC1206D1ZG",
        dlNumber: "MH-TZ1-20B-11920",
        openingBalance: 45000.0,
        currentBalance: 45000.0,
        paymentTerms: "Net 30",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
    prisma.supplier.create({
      data: {
        companyId,
        supplierIdCode: "SUP-0002",
        name: "Sun Pharma Wholesale Agency",
        companyName: "Sun Pharmaceutical Industries Ltd",
        phone: "+91 98202 33444",
        email: "supply@sunpharmaagency.com",
        address: "B-44, Logistics Park, Bhiwandi",
        city: "Thane",
        district: "Thane",
        pincode: "421302",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AABCS1429B1Z0",
        dlNumber: "MH-TZ2-20B-44912",
        openingBalance: 28000.0,
        currentBalance: 28000.0,
        paymentTerms: "Net 15",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
    prisma.supplier.create({
      data: {
        companyId,
        supplierIdCode: "SUP-0003",
        name: "Abbott Healthcare Depot",
        companyName: "Abbott India Ltd",
        phone: "+91 98203 55666",
        email: "depot@abbottindia.com",
        address: "Sector 3, Pharma Zone, Navi Mumbai",
        city: "Navi Mumbai",
        district: "Thane",
        pincode: "400703",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AAACA0210Q1ZN",
        dlNumber: "MH-TZ3-20B-88314",
        openingBalance: 15000.0,
        currentBalance: 15000.0,
        paymentTerms: "Net 45",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
  ]);

  // 4. Customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId,
        customerIdCode: "CUST-0001",
        name: "Suresh Mehta",
        businessName: "Apollo Chemist & Druggist",
        phone: "+91 98920 77112",
        email: "apollo.chemist.mumbai@gmail.com",
        address: "Shop 4, Sunrise Arcade, MG Road",
        city: "Mumbai",
        district: "Mumbai City",
        pincode: "400001",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AAGFA8890K1ZP",
        dlNumber: "MH-MZ1-20/21-99881",
        creditLimit: 150000.0,
        openingBalance: 24500.0,
        currentBalance: 24500.0,
        paymentTerms: "7 Days Credit",
        status: "active",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
    prisma.customer.create({
      data: {
        companyId,
        customerIdCode: "CUST-0002",
        name: "Rameshwar Sharma",
        businessName: "LifeCare Medicos & Surgical",
        phone: "+91 98921 88223",
        email: "lifecare.medicos@yahoo.com",
        address: "12, Station Road, Dadar West",
        city: "Mumbai",
        district: "Mumbai City",
        pincode: "400028",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AAUFL3341J1ZU",
        dlNumber: "MH-MZ2-20/21-11234",
        creditLimit: 200000.0,
        openingBalance: 38000.0,
        currentBalance: 38000.0,
        paymentTerms: "15 Days Credit",
        status: "active",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
    prisma.customer.create({
      data: {
        companyId,
        customerIdCode: "CUST-0003",
        name: "Dr. Amit Verma",
        businessName: "Sanjeevani Clinic & Pharmacy",
        phone: "+91 98922 99334",
        email: "sanjeevani.pharma@gmail.com",
        address: "Ground Floor, City Hospital Lane",
        city: "Pune",
        district: "Pune",
        pincode: "411001",
        state: "Maharashtra",
        stateCode: "27",
        gstin: "27AAZFS6712M1ZK",
        dlNumber: "MH-PN1-20/21-55442",
        creditLimit: 100000.0,
        openingBalance: 12000.0,
        currentBalance: 12000.0,
        paymentTerms: "Immediate / COD",
        status: "active",
        isInterstate: false,
        saleNature: "intrastate",
      },
    }),
    prisma.customer.create({
      data: {
        companyId,
        customerIdCode: "CUST-0004",
        name: "Vikram Patel",
        businessName: "Shreeji Healthcare (Gujarat)",
        phone: "+91 98250 44556",
        email: "shreeji.healthcare.vad@gmail.com",
        address: "Shop 101, Sayajiganj",
        city: "Vadodara",
        district: "Vadodara",
        pincode: "390005",
        state: "Gujarat",
        stateCode: "24",
        gstin: "24AABCS9876P1ZV",
        dlNumber: "GJ-BRD-20/21-77881",
        creditLimit: 300000.0,
        openingBalance: 50000.0,
        currentBalance: 50000.0,
        paymentTerms: "30 Days (Interstate)",
        status: "active",
        isInterstate: true,
        saleNature: "interstate",
      },
    }),
  ]);

  // 5. Medicines & Batches
  const now = new Date();
  const dolo = await prisma.medicine.create({
    data: {
      companyId,
      name: "Dolo 650 Tablet",
      genericName: "Paracetamol 650mg",
      brand: "Micro Labs Ltd",
      category: "Antipyretic / Analgesic",
      hsnCode: "30049060",
      gstRate: 12.0,
      unit: "Box",
      packSize: "15x15 Tablets",
      rackLocation: "Rack A-1",
      minStockAlert: 30,
      purchaseRate: 210.0,
      saleRate: 260.0,
      wholesaleRate: 250.0,
      mrp: 310.0,
      discountPercent: 3.0,
    },
  });

  const b1 = await prisma.medicineBatch.create({
    data: {
      companyId,
      medicineId: dolo.id,
      medicineName: dolo.name,
      genericName: dolo.genericName,
      hsnCode: dolo.hsnCode,
      batchNumber: "DL-9081",
      mfgDate: new Date(now.getTime() - 200 * 86400000).toISOString().slice(0, 7),
      expiryDate: new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10),
      purchaseRate: 205.0,
      mrp: 310.0,
      saleRate: 255.0,
      gstRate: 12.0,
      quantity: 25,
      freeQuantity: 0,
      supplierId: suppliers[0].id,
      supplierName: suppliers[0].name,
    },
  });

  const b2 = await prisma.medicineBatch.create({
    data: {
      companyId,
      medicineId: dolo.id,
      medicineName: dolo.name,
      genericName: dolo.genericName,
      hsnCode: dolo.hsnCode,
      batchNumber: "DL-9422",
      mfgDate: new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 7),
      expiryDate: new Date(now.getTime() + 550 * 86400000).toISOString().slice(0, 10),
      purchaseRate: 210.0,
      mrp: 310.0,
      saleRate: 260.0,
      gstRate: 12.0,
      quantity: 180,
      freeQuantity: 10,
      supplierId: suppliers[0].id,
      supplierName: suppliers[0].name,
    },
  });

  await prisma.stockLedger.createMany({
    data: [
      {
        companyId,
        date: getTodayDateString(),
        movementType: "Opening Stock",
        referenceId: b1.id,
        referenceInvoiceNo: "OPENING-STOCK",
        medicineId: dolo.id,
        medicineName: dolo.name,
        batchId: b1.id,
        batchNumber: b1.batchNumber,
        qtyIn: 25,
        qtyOut: 0,
        balanceAfter: 25,
        notes: `Initial inventory batch seed (${b1.batchNumber})`,
      },
      {
        companyId,
        date: getTodayDateString(),
        movementType: "Opening Stock",
        referenceId: b2.id,
        referenceInvoiceNo: "OPENING-STOCK",
        medicineId: dolo.id,
        medicineName: dolo.name,
        batchId: b2.id,
        batchNumber: b2.batchNumber,
        qtyIn: 180,
        qtyOut: 0,
        balanceAfter: 180,
        notes: `Initial inventory batch seed (${b2.batchNumber})`,
      },
    ],
  });

  // 6. Expenses
  await prisma.expense.createMany({
    data: [
      {
        companyId,
        expenseDate: getTodayDateString(),
        category: "Transport",
        description: "Delivery Tempo Freight & Loading",
        amount: 2500.0,
        paymentMethod: "UPI",
        notes: "Local chemist deliveries",
        createdBy: "Staff Pharmacist",
      },
      {
        companyId,
        expenseDate: getTodayDateString(),
        category: "Electricity",
        description: "Cold Storage & Warehouse AC Power Bill",
        amount: 8400.0,
        paymentMethod: "Bank Transfer",
        notes: "Adani Electricity bill",
        createdBy: "Staff Pharmacist",
      },
    ],
  });
}
