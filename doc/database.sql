-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

-- -----------------------------------------------------
-- Schema eshistory
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema eshistory
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `eshistory` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ;
USE `eshistory` ;

-- -----------------------------------------------------
-- Table `eshistory`.`project`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`project` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_project_name` (`name` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`author`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`author` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unique_author_name_email` (`name` ASC, `email` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`commit`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`commit` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project` INT UNSIGNED NOT NULL,
  `commit_oid` VARCHAR(40) NOT NULL,
  `date` DATETIME NOT NULL,
  `message` MEDIUMTEXT NOT NULL,
  `author` INT UNSIGNED NOT NULL,
  `extracted` TINYINT(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unique_project_commit` (`project` ASC, `commit_oid` ASC),
  INDEX `fk_commit_author_idx` (`author` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`path`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`path` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `path` VARCHAR(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unique_path` (`path` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`file_entry`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`file_entry` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project` INT UNSIGNED NOT NULL,
  `entry_oid` VARCHAR(40) NOT NULL,
  `has_error` TINYINT(1) NOT NULL DEFAULT 0,
  `error_reason` VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_entry_project_idx` (`project` ASC),
  UNIQUE INDEX `unique_project_entry` (`project` ASC, `entry_oid` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`commit_file`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`commit_file` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `commit` INT UNSIGNED NOT NULL,
  `file_entry` INT UNSIGNED NOT NULL,
  `path` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_commit_idx` (`commit` ASC),
  INDEX `fk_commit_file_entry_idx` (`file_entry` ASC),
  INDEX `fk_commit_file_path_idx` (`path` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`file_metrics`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`file_metrics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_entry` INT UNSIGNED NOT NULL,
  `loc` INT UNSIGNED NOT NULL,
  `cyclomatic` DOUBLE UNSIGNED NOT NULL,
  `cyclomatic_density` DOUBLE UNSIGNED NOT NULL,
  `functions` INT UNSIGNED NOT NULL,
  `dependencies` INT UNSIGNED NOT NULL,
  `maintainability` DOUBLE NOT NULL,
  `hs_operators_total` INT UNSIGNED NOT NULL,
  `hs_operators_distinct` INT UNSIGNED NOT NULL,
  `hs_operands_total` INT UNSIGNED NOT NULL,
  `hs_operands_distinct` INT UNSIGNED NOT NULL,
  `hs_length` INT UNSIGNED NOT NULL,
  `hs_vocabulary` INT UNSIGNED NOT NULL,
  `hs_difficulty` DOUBLE UNSIGNED NOT NULL,
  `hs_volume` DOUBLE UNSIGNED NOT NULL,
  `hs_effort` DOUBLE UNSIGNED NOT NULL,
  `hs_bugs` DOUBLE UNSIGNED NOT NULL,
  `hs_time` DOUBLE UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_file_entry_metrics_idx` (`file_entry` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`function_metrics`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`function_metrics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `file_entry` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `line` INT UNSIGNED NOT NULL,
  `loc` INT UNSIGNED NOT NULL,
  `cyclomatic` INT UNSIGNED NOT NULL,
  `cyclomatic_density` DOUBLE UNSIGNED NOT NULL,
  `params` INT UNSIGNED NOT NULL,
  `hs_operators_total` INT UNSIGNED NOT NULL,
  `hs_operators_distinct` INT UNSIGNED NOT NULL,
  `hs_operands_total` INT UNSIGNED NOT NULL,
  `hs_operands_distinct` INT UNSIGNED NOT NULL,
  `hs_length` INT UNSIGNED NOT NULL,
  `hs_vocabulary` INT UNSIGNED NOT NULL,
  `hs_difficulty` DOUBLE UNSIGNED NOT NULL,
  `hs_volume` DOUBLE UNSIGNED NOT NULL,
  `hs_effort` DOUBLE UNSIGNED NOT NULL,
  `hs_bugs` DOUBLE UNSIGNED NOT NULL,
  `hs_time` DOUBLE UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_function_metrics_entry_idx` (`file_entry` ASC))
ENGINE = MyISAM;


-- -----------------------------------------------------
-- Table `eshistory`.`reference`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `eshistory`.`reference` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `type` ENUM('tag','remote','branch') NOT NULL,
  `commit` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_reference_commit_idx` (`commit` ASC))
ENGINE = MyISAM;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
