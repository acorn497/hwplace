-- AlterTable
-- 기존 계정은 이 마이그레이션 시점을 가입 시각으로 삼는다.
-- (실제 가입 시각을 알 수 없지만, 모두 '신규'로 취급해 쿼터가 깎이는 것보다 낫다)
ALTER TABLE `user` ADD COLUMN `USER_CREATED_AT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
