package main

import (
	"database/sql"
	"fmt"
	"sync/atomic"

	"github.com/schollz/progressbar/v3"
	"github.com/sourcegraph/conc"
	"github.com/sourcegraph/conc/pool"
	"golang.org/x/exp/slices"
)

var MEDIA_TYPE_ALLOWLIST = []string{"movie", "tvMovie", "tvSeries", "tvMiniSeries", "tvSpecial", "video"}

func loadBasicMetadata(db *sql.DB, path string) (*map[string]int64, error) {
	total := must(countLines(IMDB_BASICS_TSV_PATH)) - 1
	bar := progressbar.Default(int64(total))
	defer bar.Finish()

	records, err := parseTsv(IMDB_BASICS_TSV_PATH)
	if err != nil {
		return nil, fmt.Errorf("error parsing IMDB basics TSV: %w", err)
	}

	mediaIDs := map[string]int64{}
	for record := range records {
		bar.Add(1)
		if record.Error != nil {
			return nil, fmt.Errorf("error parsing IMDB basics TSV record: %w: %+v", record.Error, record)
		}

		adult := record.Data[4]
		if adult == "1" {
			continue
		}
		mediaType := record.Data[1]
		if !slices.Contains(MEDIA_TYPE_ALLOWLIST, mediaType) {
			continue
		}

		imdbId := record.Data[0]

		_, err := db.Exec("INSERT OR IGNORE INTO media (imdb_id) VALUES (?)", imdbId)
		if err != nil {
			return nil, fmt.Errorf("error inserting media: %w", err)
		}
		var mediaID int64
		row := db.QueryRow("SELECT id FROM media WHERE imdb_id = ?", imdbId)
		err = row.Scan(&mediaID)
		if err != nil {
			return nil, fmt.Errorf("error finding media: %w", err)
		}
		mediaIDs[imdbId] = mediaID
	}
	return &mediaIDs, nil
}

func loadTitles(db *sql.DB, path string, mediaIDs *map[string]int64) error {
	recordCount := must(countLines(IMDB_AKAS_TSV_PATH)) - 1
	records := must(parseTsv(IMDB_AKAS_TSV_PATH))
	toInsert := make(chan Indexable)

	var inserter conc.WaitGroup
	var errInsert error
	addedBeforeBarCreated := 0
	var incrBar = func() { addedBeforeBarCreated++ }
	inserter.Go(func() {
		for ix := range toInsert {
			_, err := upsert(db, ix)
			if err != nil {
				errInsert = err
				return
			}
			incrBar()
		}
	})

	fmt.Println("Indexing titles")
	var total int64
	barIndex := progressbar.Default(int64(recordCount))
	toIndex := pool.New().WithErrors()
	for record := range records {
		toIndex.Go(func() error {
			if record.Error != nil {
				return fmt.Errorf("error parsing title: %w: %+v", record.Error, record)
			}

			imdbID := record.Data[0]
			mediaID, found := (*mediaIDs)[imdbID]
			if !found {
				return nil
			}
			lang := record.Data[3]
			if lang == `\N` {
				return nil
			}

			indexed := must(fromRecord(record))
			indexed.MediaID = mediaID
			toInsert <- indexed
			atomic.AddInt64(&total, 1)
			barIndex.Add(1)
			return nil
		})
	}

	err := toIndex.Wait()
	barIndex.Finish()
	close(toInsert)
	if err != nil {
		return fmt.Errorf("error indexing: %w", err)
	}

	fmt.Println("Inserting titles into database")
	barInsert := progressbar.Default(total)
	incrBar = func() { barInsert.Add(1) }
	barInsert.Add(addedBeforeBarCreated)
	defer barInsert.Finish()

	inserter.Wait()
	return errInsert
}
