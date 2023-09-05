package main

import (
	"fmt"
	"strings"

	"github.com/schollz/progressbar/v3"
	"golang.org/x/exp/slices"
)

var MEDIA_TYPE_ALLOWLIST = []string{"movie", "tvMovie", "tvSeries", "tvMiniSeries", "tvSpecial", "video"}

type Indexable struct {
	MediaID int64
	ImdbID  string
	Title   string
	Stems   []string
}

func loadBasicMetadata(db *DB, path string) (map[string]struct{}, error) {
	total, err := countLines(path)
	if err != nil {
		return nil, fmt.Errorf("error counting lines in IMDB basics TSV: %w", err)
	}
	bar := progressbar.Default(int64(total - 1))
	defer bar.Finish()

	records, err := parseTsv(path)
	if err != nil {
		return nil, fmt.Errorf("error parsing IMDB basics TSV: %w", err)
	}

	imdbIDs := map[string]struct{}{}
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

		imdbID := record.Data[0]
		imdbIDs[imdbID] = struct{}{}
	}
	return imdbIDs, nil
}

func loadTitles(db *DB, path string, imdbIDs map[string]struct{}) error {
	recordCount, err := countLines(path)
	if err != nil {
		return fmt.Errorf("error counting lines in IMDB akas TSV: %w", err)
	}
	bar := progressbar.Default(int64(recordCount - 1))
	defer bar.Finish()

	rows, err := lines(path)
	if err != nil {
		return fmt.Errorf("error loading titles: %w", err)
	}

	for row := range rows {
		bar.Add(1)

		record := strings.Split(row, "\t")
		lang := record[3]
		if lang == `\N` {
			continue
		}
		imdbID := record[0]
		if _, ok := imdbIDs[imdbID]; !ok {
			continue
		}

		title := record[2]
		stems := canonicalize(title, lang == "GB" || lang == "US")
		err := db.InsertStems(imdbID, title, stems)
		if err != nil {
			return err
		}
	}

	return nil
}
