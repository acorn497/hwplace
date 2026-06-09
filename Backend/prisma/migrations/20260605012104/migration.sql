/*
  Warnings:

  - A unique constraint covering the columns `[USER_EMAIL]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `PIXEL_PAINTED_BY` to the `pixel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pixel` ADD COLUMN `PIXEL_PAINTED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `PIXEL_PAINTED_BY` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `canvas_snapshot` (
    `snapshot_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshot_width` INTEGER NOT NULL,
    `snapshot_height` INTEGER NOT NULL,
    `snapshot_payload` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`snapshot_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `canvas_events` (
    `event_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `event_x` INTEGER NOT NULL,
    `event_y` INTEGER NOT NULL,
    `event_payload` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`event_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `pixel_PIXEL_PAINTED_BY_idx` ON `pixel`(`PIXEL_PAINTED_BY`);

-- CreateIndex
CREATE UNIQUE INDEX `user_USER_EMAIL_key` ON `user`(`USER_EMAIL`);

-- AddForeignKey
ALTER TABLE `pixel` ADD CONSTRAINT `pixel_PIXEL_PAINTED_BY_fkey` FOREIGN KEY (`PIXEL_PAINTED_BY`) REFERENCES `user`(`USER_INDEX`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `canvas_events` ADD CONSTRAINT `canvas_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`USER_INDEX`) ON DELETE CASCADE ON UPDATE CASCADE;
