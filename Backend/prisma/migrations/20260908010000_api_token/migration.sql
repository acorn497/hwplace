-- CreateTable
CREATE TABLE `api_token` (
    `token_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `token_prefix` VARCHAR(16) NOT NULL,
    `label` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `api_token_token_hash_key`(`token_hash`),
    INDEX `api_token_userId_idx`(`userId`),
    PRIMARY KEY (`token_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `api_token` ADD CONSTRAINT `api_token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`USER_INDEX`) ON DELETE CASCADE ON UPDATE CASCADE;
