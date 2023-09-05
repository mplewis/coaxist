package main

import (
	"fmt"
	"os"
	"path"

	_ "modernc.org/sqlite"
)

var (
	WORKDIR             = envOr("WORKDIR", path.Join(os.TempDir(), "metasearch"))
	IMDB_DATASETS       = envOr("IMDB_DATASETS", "http://datasets.imdbws.com")
	IMDB_BASICS_GZ_NAME = envOr("IMDB_BASICS_GZ_NAME", "title.basics.tsv.gz")
	IMDB_AKAS_GZ_NAME   = envOr("IMDB_AKAS_GZ_NAME", "title.akas.tsv.gz")
	DB_PATH             = envOr("DB_PATH", path.Join(WORKDIR, "db"))

	IMDB_BASICS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_BASICS_GZ_NAME)
	IMDB_BASICS_TSV_PATH = path.Join(WORKDIR, "title.basics.tsv")

	IMDB_AKAS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_AKAS_GZ_NAME)
	IMDB_AKAS_TSV_PATH = path.Join(WORKDIR, "title.akas.tsv")
)

func main() {
	os.MkdirAll(WORKDIR, 0755)
	fmt.Println(WORKDIR)

	check(dlAndExtract(IMDB_BASICS_TSV_PATH, IMDB_BASICS_GZ_URL))
	check(dlAndExtract(IMDB_AKAS_TSV_PATH, IMDB_AKAS_GZ_URL))
	db := must(NewDB(DB_PATH))

	fmt.Println("Parsing IMDB metadata")
	imdbIDs := must(loadBasicMetadata(db, IMDB_BASICS_TSV_PATH))

	fmt.Println("Processing titles")
	check(loadTitles(db, IMDB_AKAS_TSV_PATH, imdbIDs))

	// check(db.List())
}
