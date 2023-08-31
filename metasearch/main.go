package main

import (
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
)

var (
	WORKDIR              = envOr("WORKDIR", path.Join(os.TempDir(), "metasearch_imdb"))
	IMDB_DATASETS        = envOr("IMDB_DATASETS", "http://datasets.imdbws.com")
	IMDB_BASICS_GZ_NAME  = envOr("IMDB_BASICS_GZ_NAME", "title.basics.tsv.gz")
	IMDB_AKAS_GZ_NAME    = envOr("IMDB_AKAS_GZ_NAME", "title.akas.tsv.gz")
	IMDB_BASICS_GZ_URL   = envOr("IMDB_BASICS_TGZ", fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_BASICS_GZ_NAME))
	IMDB_AKAS_GZ_URL     = envOr("IMDB_AKAS_TGZ", fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_AKAS_GZ_NAME))
	IMDB_BASICS_GZ_PATH  = path.Join(WORKDIR, IMDB_BASICS_GZ_NAME)
	IMDB_AKAS_GZ_PATH    = path.Join(WORKDIR, IMDB_AKAS_GZ_NAME)
	IMDB_BASICS_TSV_PATH = path.Join(WORKDIR, "title.basics.tsv")
	IMDB_AKAS_TSV_PATH   = path.Join(WORKDIR, "title.akas.tsv")
)

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

// func extractGzipWithShell(path string) (string, error) {
// 	dst := path[:len(path)-3]
// 	err := os.Remove(dst)
// 	if err != nil && !os.IsNotExist(err) {
// 		return "", err
// 	}
// 	err = exec.Command("gunzip", "-c", path).Run()
// 	return dst, err
// }

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

	err = os.Remove(dst)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func main() {
	os.MkdirAll(WORKDIR, 0755)
	fmt.Println(WORKDIR)

	fmt.Println("Downloading...")
	check(download(IMDB_BASICS_GZ_PATH, IMDB_BASICS_GZ_URL))
	// must(grab.Get(IMDB_AKAS_GZ_PATH, IMDB_AKAS_GZ_URL))

	fmt.Println("Extracting...")
	check(extractGzip(IMDB_BASICS_TSV_PATH, IMDB_BASICS_GZ_PATH))
	// check(extractGzip(IMDB_AKAS_GZ_PATH, path.Join(WORKDIR, "title.akas.tsv")))
	// os.Remove(IMDB_BASICS_GZ_PATH)
	// os.Remove(IMDB_AKAS_GZ_PATH)
}
