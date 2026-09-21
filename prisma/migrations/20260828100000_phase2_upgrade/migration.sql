-- Phase 2-12 Migration SQL Script

-- Alter User table
ALTER TABLE `users` 
  ADD COLUMN `role` ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN `department` VARCHAR(191) NULL DEFAULT 'General',
  ADD COLUMN `customPermissions` TEXT NULL;

-- Alter Expense table
ALTER TABLE `expenses`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD COLUMN `vendorId` INTEGER NULL,
  ADD COLUMN `department` VARCHAR(191) NULL DEFAULT 'General',
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedBy` INTEGER NULL,
  ADD INDEX `expenses_department_idx`(`department`),
  ADD INDEX `expenses_vendorId_idx`(`vendorId`);

-- Alter Budget table
ALTER TABLE `budgets`
  ADD COLUMN `alert50Sent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `alert75Sent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `alert90Sent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `alert100Sent` BOOLEAN NOT NULL DEFAULT false;

-- Create Table DepartmentBudget
CREATE TABLE `department_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `department` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `department_budgets_department_month_year_key`(`department`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table Vendor
CREATE TABLE `vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendors_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table ExpenseReceipt
CREATE TABLE `expense_receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `uploadedBy` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `extractedAmount` DOUBLE NULL,
    `extractedVendor` VARCHAR(191) NULL,
    `extractedDate` DATETIME(3) NULL,
    `extractedGst` VARCHAR(191) NULL,
    `confirmed` BOOLEAN NOT NULL DEFAULT false,

    INDEX `expense_receipts_expenseId_idx`(`expenseId`),
    INDEX `expense_receipts_uploadedBy_idx`(`uploadedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table RecurringExpense
CREATE TABLE `recurring_expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    `nextRun` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `userId` INTEGER NOT NULL,
    `department` VARCHAR(191) NULL DEFAULT 'General',
    `vendorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `recurring_expenses_userId_idx`(`userId`),
    INDEX `recurring_expenses_nextRun_idx`(`nextRun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table AuditLog
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actorId_idx`(`actorId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table Notification
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Table CashBalance
CREATE TABLE `cash_balance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `updatedBy` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add Foreign Keys
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `expense_receipts` ADD CONSTRAINT `expense_receipts_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `expense_receipts` ADD CONSTRAINT `expense_receipts_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_expenses` ADD CONSTRAINT `recurring_expenses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recurring_expenses` ADD CONSTRAINT `recurring_expenses_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
