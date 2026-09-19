-- LOCAL ONLY: restore jobportal.pages to Generator/publish production-parity.
-- Disposable local data. Do NOT run against production.
-- Derived from page.repository.js insertPage + db/migrations page alters.

DROP TABLE IF EXISTS `pages`;

CREATE TABLE `pages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(500) NOT NULL DEFAULT '',
  `slug` varchar(255) NOT NULL,
  `status` varchar(64) DEFAULT NULL,
  `badges` longtext DEFAULT NULL COMMENT 'JSON array of badge codes',
  `category` varchar(255) DEFAULT NULL,
  `qualification` varchar(128) DEFAULT NULL,
  `state` varchar(128) DEFAULT NULL,
  `department` varchar(128) DEFAULT NULL,
  `post_name` varchar(512) DEFAULT NULL,
  `total_posts` varchar(64) DEFAULT NULL,
  `advertisement_no` varchar(128) DEFAULT NULL,
  `last_date` date DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `raw_text` longtext DEFAULT NULL,
  `position` varchar(32) DEFAULT 'normal',
  `small_box_slot` tinyint(3) unsigned DEFAULT NULL COMMENT 'Homepage small box slot 1-8',
  `breaking` tinyint(1) NOT NULL DEFAULT 0,
  `breaking_order` int(11) NOT NULL DEFAULT 0,
  `event_time` datetime DEFAULT NULL,
  `views` int(10) unsigned NOT NULL DEFAULT 0,
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `content_updated_at` datetime DEFAULT NULL,
  `recruitment_id` bigint(20) unsigned DEFAULT NULL,
  `recruitment_event_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_pages_slug` (`slug`),
  KEY `idx_pages_deleted` (`deleted`),
  KEY `idx_pages_small_box_slot` (`deleted`, `small_box_slot`),
  KEY `idx_pages_recruitment_id` (`recruitment_id`),
  KEY `idx_pages_recruitment_event_id` (`recruitment_event_id`),
  CONSTRAINT `fk_pages_recruitment`
    FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pages_recruitment_event`
    FOREIGN KEY (`recruitment_event_id`) REFERENCES `recruitment_events` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
