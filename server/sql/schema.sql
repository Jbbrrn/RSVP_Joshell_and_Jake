-- Fresh install. Run inside the database you selected (USE your_database;).
-- Order matters: companion depends on invited_guest.

CREATE TABLE invited_guest (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(150) NOT NULL,
  name_key        VARCHAR(150) NOT NULL UNIQUE,   -- normalized name used for matching (see normalize.js)
  role            VARCHAR(50)  NOT NULL,          -- ninang, ring bearer, bridesmaid, family, guest...
  max_companions  TINYINT      NOT NULL DEFAULT 2,
  rsvp_status     ENUM('pending','attending','declined') NOT NULL DEFAULT 'pending',
  responded_at    DATETIME NULL,
  first_opened_at DATETIME NULL,                  -- set the first time the name check succeeds
  last_opened_at  DATETIME NULL,
  open_count      INT NOT NULL DEFAULT 0
) CHARACTER SET utf8mb4;

CREATE TABLE companion (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guest_id   INT NOT NULL,
  full_name  VARCHAR(150) NOT NULL,
  FOREIGN KEY (guest_id) REFERENCES invited_guest(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

CREATE TABLE admin_user (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;
