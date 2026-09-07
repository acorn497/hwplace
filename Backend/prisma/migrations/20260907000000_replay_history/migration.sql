-- 청크 스냅샷 + 전체 기간 리플레이를 위한 스키마.
--
-- 주의: 이전 커밋(5d55869)에서 canvas_snapshot 을 청크 단위로 바꾸고 snapshot_versions 를
-- 추가했지만 마이그레이션이 생성되지 않아 DB에는 반영돼 있지 않았다. 여기서 함께 처리한다.

-- =========================================================
-- 1) 스냅샷 버전 (리플레이 키프레임)
-- =========================================================
CREATE TABLE `snapshot_versions` (
    `version_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed` BOOLEAN NOT NULL DEFAULT false,

    INDEX `snapshot_versions_completed_created_at_idx`(`completed`, `created_at`),
    PRIMARY KEY (`version_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================================
-- 2) canvas_snapshot 을 청크 단위로 재구성
--
-- 기존 행은 캔버스 전체를 한 덩어리로 담은 옛 형식이라 청크 좌표로 옮길 수 없다.
-- 버전에 속하지 않는 고아 행이기도 해서, 테이블을 새로 만든다.
-- (스냅샷은 canvas_events 로부터 언제든 다시 만들 수 있으므로 유실 위험이 없다.)
-- =========================================================
DROP TABLE `canvas_snapshot`;

CREATE TABLE `canvas_snapshot` (
    `snapshot_idx` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshot_cx` INTEGER NOT NULL,
    `snapshot_cy` INTEGER NOT NULL,
    `snapshot_size` INTEGER NOT NULL,
    `snapshot_version` INTEGER NOT NULL,
    `snapshot_payload` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `canvas_snapshot_snapshot_cx_snapshot_cy_idx`(`snapshot_cx`, `snapshot_cy`),
    INDEX `canvas_snapshot_snapshot_version_idx`(`snapshot_version`),
    UNIQUE INDEX `canvas_snapshot_snapshot_version_snapshot_cx_snapshot_cy_key`(`snapshot_version`, `snapshot_cx`, `snapshot_cy`),
    PRIMARY KEY (`snapshot_idx`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `canvas_snapshot` ADD CONSTRAINT `canvas_snapshot_snapshot_version_fkey`
  FOREIGN KEY (`snapshot_version`) REFERENCES `snapshot_versions`(`version_idx`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================
-- 3) canvas_events: 리플레이 원본이므로 영구 보존한다.
--
-- 유저가 탈퇴해도 그가 찍은 픽셀은 히스토리에 남아야 하므로
-- userId 를 nullable 로 바꾸고 외래키를 CASCADE -> SET NULL 로 교체한다.
-- =========================================================
ALTER TABLE `canvas_events` DROP FOREIGN KEY `canvas_events_userId_fkey`;

ALTER TABLE `canvas_events` MODIFY `userId` INTEGER NULL;

ALTER TABLE `canvas_events` ADD CONSTRAINT `canvas_events_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`USER_INDEX`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 리플레이는 항상 시간 구간으로 조회한다. 없으면 매 조회가 풀스캔이다.
CREATE INDEX `canvas_events_created_at_idx` ON `canvas_events`(`created_at`);
CREATE INDEX `canvas_events_userId_idx` ON `canvas_events`(`userId`);
