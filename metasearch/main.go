package main

import (
	"compress/gzip"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"
	"unicode"

	_ "embed"

	"github.com/sourcegraph/conc/pool"
	"github.com/surgebase/porter2"
	"golang.org/x/exp/slices"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	_ "modernc.org/sqlite"
)

var (
	WORKDIR             = envOr("WORKDIR", path.Join(os.TempDir(), "metasearch"))
	IMDB_DATASETS       = envOr("IMDB_DATASETS", "http://datasets.imdbws.com")
	IMDB_BASICS_GZ_NAME = envOr("IMDB_BASICS_GZ_NAME", "title.basics.tsv.gz")
	IMDB_AKAS_GZ_NAME   = envOr("IMDB_AKAS_GZ_NAME", "title.akas.tsv.gz")
	SQLITE_DB_PATH      = envOr("SQLITE_DB_PATH", path.Join(WORKDIR, "metasearch_imdb.v1.sqlite"))

	IMDB_BASICS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_BASICS_GZ_NAME)
	IMDB_BASICS_TSV_PATH = path.Join(WORKDIR, "title.basics.tsv")

	IMDB_AKAS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_AKAS_GZ_NAME)
	IMDB_AKAS_TSV_PATH = path.Join(WORKDIR, "title.akas.tsv")
)

//go:embed sql/create_tables.sql
var CREATE_TABLES_SQL string

var MEDIA_TYPE_ALLOWLIST = []string{"movie", "tvMovie", "tvSeries", "tvMiniSeries", "tvSpecial", "video"}

type Batcher[T any] struct {
	Callable func([]T) error
	MaxSize  int
	items    []T
}

func (b *Batcher[T]) Submit(items ...T) error {
	for _, item := range items {
		b.items = append(b.items, item)
		if len(b.items) >= b.MaxSize {
			err := b.Flush()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (b *Batcher[T]) Flush() error {
	if (len(b.items)) == 0 {
		return nil
	}
	err := b.Callable(b.items)
	if err != nil {
		return err
	}
	b.items = []T{}
	return nil
}

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

func check(err error) {
	if err != nil {
		panic(err)
	}
}

func must[T any](t T, err error) T {
	check(err)
	return t
}

func envOr(key string, dfault string) string {
	val := os.Getenv(key)
	if val == "" {
		return dfault
	}
	return val
}

func extractGzip(dst string, path string) error {
	rd, err := os.Open(path)
	if err != nil {
		return err
	}
	defer rd.Close()

	gr, err := gzip.NewReader(rd)
	if err != nil {
		return err
	}
	defer gr.Close()

	wr, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer wr.Close()

	_, err = io.Copy(wr, gr)
	return err
}

func download(dst string, url string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func exist(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && !fi.IsDir()
}

func dlAndExtract(dst string, url string) error {
	if exist(dst) {
		fmt.Printf("File %s already exists, skipping download\n", dst)
		return nil
	}

	dlDst := fmt.Sprintf("%s.gz", dst)
	dlDstTmp := fmt.Sprintf("%s.tmp", dlDst)
	if exist(dlDst) {
		fmt.Printf("Downloaded file %s already exists, skipping download\n", dlDst)
	} else {
		fmt.Printf("Downloading %s to %s...\n", url, dlDstTmp)
		err := download(dlDstTmp, url)
		if err != nil {
			os.Remove(dlDst)
			return err
		}
		err = os.Rename(dlDstTmp, dlDst)
		if err != nil {
			os.Remove(dlDst)
			return err
		}
	}

	dstTmp := fmt.Sprintf("%s.tmp", dst)
	fmt.Printf("Extracting %s to %s...\n", dlDst, dstTmp)
	err := extractGzip(dstTmp, dlDst)
	if err != nil {
		os.Remove(dstTmp)
		return err
	}
	err = os.Rename(dstTmp, dst)
	if err != nil {
		os.Remove(dst)
		return err
	}
	os.Remove(dlDst)

	fmt.Printf("Extracted to %s successfully\n", dst)
	return nil
}

type Record struct {
	Data  []string
	Error error
}

func parseTsv(path string) (<-chan Record, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	r := csv.NewReader(f)
	r.Comma = '\t'
	r.LazyQuotes = true

	out := make(chan Record)

	go func() {
		_, err := r.Read()
		if err != nil {
			out <- Record{Error: err}
			return
		}

		for {
			record, err := r.Read()
			if err == io.EOF {
				close(out)
				break
			}
			if err != nil {
				if errors.Is(err, csv.ErrFieldCount) {
					continue
				}
				out <- Record{Error: err}
				break
			}
			out <- Record{Data: record}
		}
	}()

	return out, nil
}

type Indexable struct {
	MediaID int64
	ImdbID  string
	Title   string
	Stems   []string
}

func uniq[T comparable](items []T) []T {
	set := map[T]struct{}{}
	for _, item := range items {
		set[item] = struct{}{}
	}
	out := []T{}
	for item := range set {
		out = append(out, item)
	}
	return out
}

var matchAllLetters = regexp.MustCompile(`[\p{L}|\d]+`)

func parseAllWords(s string) []string {
	return matchAllLetters.FindAllString(s, -1)
}

var transformChainStripAccents = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

func stripAccents(s string) string {
	s, _, _ = transform.String(transformChainStripAccents, s)
	return s
}

var matchAllPunctuation = regexp.MustCompile(`\p{P}+`)

func stripPunctuation(s string) string {
	return matchAllPunctuation.ReplaceAllString(s, "")
}

var matchHyphens = regexp.MustCompile(`[-–—]`)

func splitHyphens(s string) string {
	return matchHyphens.ReplaceAllString(s, " ")
}

func splitSlashes(s string) string {
	return strings.ReplaceAll(s, "/", " ")
}

func canonicalize(s string, en bool) []string {
	words := parseAllWords(stripAccents(stripPunctuation(splitSlashes(splitHyphens(strings.ToLower(s))))))

	stems := []string{}
	if !en {
		stems = words
	} else {
		for _, word := range words {
			word := porter2.Stem(word)
			stems = append(stems, word)
		}
	}

	stems = uniq(stems)
	sort.Strings(stems)
	return stems
}

func fromRecord(record Record) (Indexable, error) {
	title := record.Data[2]
	lang := record.Data[3]
	stems := canonicalize(title, lang == "GB" || lang == "US")
	return Indexable{ImdbID: record.Data[0], Title: title, Stems: stems}, nil
}

func loadBasicMetadata(db *sql.DB, path string) (map[string]int64, error) {
	records, err := parseTsv(IMDB_BASICS_TSV_PATH)
	if err != nil {
		return nil, fmt.Errorf("error parsing IMDB basics TSV: %w", err)
	}

	mediaIDs := map[string]int64{}
	for record := range records {
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
	return mediaIDs, nil
}

func upsert(db *sql.DB, ix Indexable) (bool, error) {
	var titleID int
	row := db.QueryRow("SELECT id FROM title WHERE val = ? AND media_id = ?", ix.Title, ix.MediaID)
	err := row.Scan(&titleID)
	if err == nil {
		return false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false, fmt.Errorf("error scanning titleID: %w", err)
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

func main() {
	os.MkdirAll(WORKDIR, 0755)
	fmt.Println(WORKDIR)

	check(dlAndExtract(IMDB_BASICS_TSV_PATH, IMDB_BASICS_GZ_URL))
	check(dlAndExtract(IMDB_AKAS_TSV_PATH, IMDB_AKAS_GZ_URL))
	db := must(connect(SQLITE_DB_PATH))

	fmt.Println("Parsing IMDB metadata")
	mediaIDs := must(loadBasicMetadata(db, IMDB_BASICS_TSV_PATH))

	fmt.Println("Parsing titles")
	records := must(parseTsv(IMDB_AKAS_TSV_PATH))

	fmt.Println("Processing titles")
	toInsert := make(chan Indexable)
	toIndex := pool.New()
	for record := range records {
		toIndex.Go(func() {
			check(record.Error)

			imdbID := record.Data[0]
			mediaID, found := mediaIDs[imdbID]
			if !found {
				return
			}
			lang := record.Data[3]
			if lang == `\N` {
				return
			}

			indexed := must(fromRecord(record))
			indexed.MediaID = mediaID
			toInsert <- indexed
		})
	}
	toIndex.Wait()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		for ix := range toInsert {
			_, err := upsert(db, ix)
			check(err)
		}
		wg.Done()
	}()
	wg.Wait()
}
