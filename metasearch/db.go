package main

import (
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
)

//go:embed sql/create_tables.sql
var CREATE_TABLES_SQL string

func connect(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("PRAGMA journal_mode=WAL")
	if err != nil {
		return nil, err
	}

	result, err := db.Query("SELECT name FROM sqlite_master WHERE type='table';")
	if err != nil {
		return nil, err
	}

	tables := []string{}
	for result.Next() {
		var name string
		err = result.Scan(&name)
		if err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	result.Close()
	if len(tables) > 0 {
		return db, nil
	}

	_, err = db.Exec(CREATE_TABLES_SQL)
	return db, err
}

func upsert(db *sql.DB, ix Indexable) (bool, error) {
	var existingCount int64
	row := db.QueryRow("SELECT COUNT(*) FROM title WHERE val = ? AND media_id = ?", ix.Title, ix.MediaID)
	err := row.Scan(&existingCount)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, fmt.Errorf("error scanning titleID: %w", err)
	}
	if existingCount > 0 {
		return false, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return false, fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec("INSERT INTO title (val, media_id) VALUES (?, ?)", ix.Title, ix.MediaID)
	if err != nil {
		return false, fmt.Errorf("error inserting title: %w", err)
	}
	var titleID int64
	row = tx.QueryRow("SELECT id FROM title WHERE val = ? AND media_id = ?", ix.Title, ix.MediaID)
	err = row.Scan(&titleID)
	if err != nil {
		return false, fmt.Errorf("error scanning titleID after insert: %w", err)
	}

	var stemIDs []int
	for _, stem := range ix.Stems {
		_, err := tx.Exec("INSERT OR IGNORE INTO stem (val) VALUES (?)", stem)
		if err != nil {
			return false, fmt.Errorf("error inserting stem: %w", err)
		}
		var stemID int
		row = tx.QueryRow("SELECT id FROM stem WHERE val = ?", stem)
		err = row.Scan(&stemID)
		if err != nil {
			return false, fmt.Errorf("error scanning stemID: %w", err)
		}
		stemIDs = append(stemIDs, stemID)
	}

	for _, stemID := range stemIDs {
		_, err := tx.Exec("INSERT OR IGNORE INTO title_stem (title_id, stem_id) VALUES (?, ?)", titleID, stemID)
		if err != nil {
			return false, fmt.Errorf("error inserting title_stem: %w", err)
		}
	}

	err = tx.Commit()
	if err != nil {
		return false, fmt.Errorf("error committing transaction: %w", err)
	}
	return true, nil
}
