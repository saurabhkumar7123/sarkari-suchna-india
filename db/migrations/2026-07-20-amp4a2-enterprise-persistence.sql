-- AMP-4A.2 Enterprise Persistence Layer
-- Run once: mysql ... < db/migrations/2026-07-20-amp4a2-enterprise-persistence.sql
--
-- Safety:
--   * Additive only — creates new tables and extension tables.
--   * No existing columns are dropped or altered destructively.
--   * No runtime reads or writes until application code enables them.
--   * DO NOT execute automatically — operator authorization required.
--
-- Rollback (safe while tables are empty / unused):
--   DROP TABLE IF EXISTS review_queue_extended;
--   DROP TABLE IF EXISTS draft_extended;
--   DROP TABLE IF EXISTS recruitment_extended;
--   DROP TABLE IF EXISTS automation_metrics;
--   DROP TABLE IF EXISTS automation_audit_log;
--   DROP TABLE IF EXISTS automation_workflows;
--   DROP TABLE IF EXISTS soft_delete_log;
--   DROP TABLE IF EXISTS entity_versions;

CREATE TABLE IF NOT EXISTS `entity_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `author` VARCHAR(128) NULL DEFAULT NULL,
  `change_summary` TEXT NULL,
  `snapshot_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_versions_lookup` (`entity_type`, `entity_id`, `version` DESC),
  KEY `idx_entity_versions_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `soft_delete_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `reason` TEXT NULL,
  `deleted_by` VARCHAR(128) NULL DEFAULT NULL,
  `deleted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `restored_at` DATETIME NULL DEFAULT NULL,
  `permanent_deleted_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_soft_delete_entity` (`entity_type`, `entity_id`, `deleted_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automation_workflows` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `workflow_key` VARCHAR(128) NOT NULL,
  `workflow_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `current_state` VARCHAR(64) NOT NULL DEFAULT 'idle',
  `retry_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `failure_reason` TEXT NULL,
  `rollback_point` VARCHAR(128) NULL DEFAULT NULL,
  `state_json` JSON NULL,
  `history_json` JSON NULL,
  `started_at` DATETIME NULL DEFAULT NULL,
  `completed_at` DATETIME NULL DEFAULT NULL,
  `lock_version` INT UNSIGNED NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_automation_workflows_key` (`workflow_key`),
  KEY `idx_automation_workflows_state` (`current_state`),
  KEY `idx_automation_workflows_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automation_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_type` VARCHAR(64) NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'general',
  `actor` VARCHAR(128) NULL DEFAULT NULL,
  `entity_type` VARCHAR(64) NULL DEFAULT NULL,
  `entity_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `action` VARCHAR(128) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'success',
  `detail_json` JSON NULL,
  `ip` VARCHAR(64) NULL DEFAULT NULL,
  `user_agent` VARCHAR(512) NULL DEFAULT NULL,
  `request_id` VARCHAR(128) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_category` (`category`, `created_at` DESC),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_event` (`event_type`, `created_at` DESC),
  KEY `idx_audit_actor` (`actor`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automation_metrics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `metric_date` DATE NOT NULL,
  `metric_type` VARCHAR(64) NOT NULL,
  `dimension` VARCHAR(128) NULL DEFAULT NULL,
  `dimension_value` VARCHAR(256) NULL DEFAULT NULL,
  `value_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_metrics_unique` (`metric_date`, `metric_type`, `dimension`, `dimension_value`),
  KEY `idx_metrics_type_date` (`metric_type`, `metric_date` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recruitment_extended` (
  `recruitment_id` BIGINT UNSIGNED NOT NULL,
  `timeline_json` JSON NULL,
  `confidence_json` JSON NULL,
  `validation_json` JSON NULL,
  `missing_info_json` JSON NULL,
  `review_notes_json` JSON NULL,
  `history_recovery_json` JSON NULL,
  `metadata_json` JSON NULL,
  `current_stage` VARCHAR(64) NULL DEFAULT NULL,
  `previous_stage` VARCHAR(64) NULL DEFAULT NULL,
  `next_expected_stage` VARCHAR(64) NULL DEFAULT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `lock_version` INT UNSIGNED NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `delete_reason` TEXT NULL,
  `deleted_by` VARCHAR(128) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`recruitment_id`),
  KEY `idx_recruitment_extended_deleted` (`deleted_at`),
  KEY `idx_recruitment_extended_stage` (`current_stage`),
  CONSTRAINT `fk_recruitment_extended_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `draft_extended` (
  `draft_id` BIGINT UNSIGNED NOT NULL,
  `generator_payload_json` JSON NULL,
  `structured_output_json` JSON NULL,
  `difference_report_json` JSON NULL,
  `ai_recommendation_json` JSON NULL,
  `confidence_json` JSON NULL,
  `warnings_json` JSON NULL,
  `validation_json` JSON NULL,
  `review_notes_json` JSON NULL,
  `history_json` JSON NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `lock_version` INT UNSIGNED NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `delete_reason` TEXT NULL,
  `deleted_by` VARCHAR(128) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`draft_id`),
  KEY `idx_draft_extended_deleted` (`deleted_at`),
  CONSTRAINT `fk_draft_extended_draft`
    FOREIGN KEY (`draft_id`) REFERENCES `generator_drafts` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `review_queue_extended` (
  `review_id` BIGINT UNSIGNED NOT NULL,
  `queue_json` JSON NULL,
  `priority` VARCHAR(32) NOT NULL DEFAULT 'normal',
  `reviewer` VARCHAR(128) NULL DEFAULT NULL,
  `assignment_json` JSON NULL,
  `confidence_json` JSON NULL,
  `risk_json` JSON NULL,
  `warnings_json` JSON NULL,
  `recommendation_json` JSON NULL,
  `history_json` JSON NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  KEY `idx_review_queue_priority` (`priority`),
  KEY `idx_review_queue_reviewer` (`reviewer`),
  CONSTRAINT `fk_review_queue_extended_review`
    FOREIGN KEY (`review_id`) REFERENCES `recruitment_review_queue` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
