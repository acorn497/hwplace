-- AlterTable
ALTER TABLE `user` ADD COLUMN `USER_ROLE` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `admin_log` (
    `log_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NULL,
    `action` VARCHAR(32) NOT NULL,
    `target_user` INTEGER NULL,
    `detail` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_log_created_at_idx`(`created_at`),
    INDEX `admin_log_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`log_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_log` ADD CONSTRAINT `admin_log_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `user`(`USER_INDEX`) ON DELETE SET NULL ON UPDATE CASCADE;
