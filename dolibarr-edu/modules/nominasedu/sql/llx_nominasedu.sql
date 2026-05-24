-- Copyright (C) Atreyu Servicios Digitales (ASD)
-- NominasEDU - Tablas de base de datos para Dolibarr

CREATE TABLE IF NOT EXISTS llx_nominasedu_employee (
  rowid         INT            NOT NULL AUTO_INCREMENT,
  entity        INT            NOT NULL DEFAULT 1,
  fk_user       INT            NOT NULL,
  employee_type VARCHAR(50)    NOT NULL DEFAULT 'mensual',
  base_salary   DOUBLE         NOT NULL DEFAULT 0,
  ss_group      VARCHAR(10)    NOT NULL DEFAULT '01',
  irpf_rate     DOUBLE         NOT NULL DEFAULT 15,
  active        TINYINT        NOT NULL DEFAULT 1,
  note          TEXT,
  date_creation DATETIME,
  tms           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  import_key    VARCHAR(14),
  PRIMARY KEY (rowid),
  KEY idx_nominasedu_employee_entity (entity),
  KEY idx_nominasedu_employee_user (fk_user),
  CONSTRAINT fk_nominasedu_employee_user FOREIGN KEY (fk_user) REFERENCES llx_user (rowid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS llx_nominasedu_payroll (
  rowid          INT            NOT NULL AUTO_INCREMENT,
  entity         INT            NOT NULL DEFAULT 1,
  fk_employee    INT            NOT NULL,
  period_year    SMALLINT       NOT NULL,
  period_month   TINYINT        NOT NULL,
  gross_salary   DOUBLE         NOT NULL DEFAULT 0,
  extra_pay      DOUBLE         NOT NULL DEFAULT 0,
  irpf_rate      DOUBLE         NOT NULL DEFAULT 0,
  irpf_amount    DOUBLE         NOT NULL DEFAULT 0,
  ss_employee    DOUBLE         NOT NULL DEFAULT 0,
  ss_employer    DOUBLE         NOT NULL DEFAULT 0,
  net_salary     DOUBLE         NOT NULL DEFAULT 0,
  status         TINYINT        NOT NULL DEFAULT 0,
  note_public    TEXT,
  date_creation  DATETIME,
  tms            TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  import_key     VARCHAR(14),
  PRIMARY KEY (rowid),
  KEY idx_nominasedu_payroll_entity (entity),
  KEY idx_nominasedu_payroll_employee (fk_employee),
  KEY idx_nominasedu_payroll_period (period_year, period_month),
  CONSTRAINT fk_nominasedu_payroll_employee FOREIGN KEY (fk_employee) REFERENCES llx_nominasedu_employee (rowid)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS llx_nominasedu_ss_payment (
  rowid           INT            NOT NULL AUTO_INCREMENT,
  entity          INT            NOT NULL DEFAULT 1,
  period_year     SMALLINT       NOT NULL,
  period_month    TINYINT        NOT NULL,
  ss_total        DOUBLE         NOT NULL DEFAULT 0,
  irpf_total      DOUBLE         NOT NULL DEFAULT 0,
  ss_paid         TINYINT        NOT NULL DEFAULT 0,
  irpf_paid       TINYINT        NOT NULL DEFAULT 0,
  date_ss_paid    DATE,
  date_irpf_paid  DATE,
  date_creation   DATETIME,
  tms             TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rowid),
  UNIQUE KEY uk_nominasedu_ss_period (entity, period_year, period_month),
  KEY idx_nominasedu_ss_entity (entity)
) ENGINE=InnoDB;
