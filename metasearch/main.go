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
	WORKDIR             = envOr("WORKDIR", path.Join(os.TempDir(), "metasearch_imdb"))
	IMDB_DATASETS       = envOr("IMDB_DATASETS", "http://datasets.imdbws.com")
	IMDB_BASICS_GZ_NAME = envOr("IMDB_BASICS_GZ_NAME", "title.basics.tsv.gz")
	IMDB_AKAS_GZ_NAME   = envOr("IMDB_AKAS_GZ_NAME", "title.akas.tsv.gz")

	IMDB_BASICS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_BASICS_GZ_NAME)
	IMDB_BASICS_TSV_PATH = path.Join(WORKDIR, "title.basics.tsv")

	IMDB_AKAS_GZ_URL   = fmt.Sprintf("%s/%s", IMDB_DATASETS, IMDB_AKAS_GZ_NAME)
	IMDB_AKAS_TSV_PATH = path.Join(WORKDIR, "title.akas.tsv")
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

func main() {
	os.MkdirAll(WORKDIR, 0755)
	fmt.Println(WORKDIR)

	check(dlAndExtract(IMDB_BASICS_TSV_PATH, IMDB_BASICS_GZ_URL))
	check(dlAndExtract(IMDB_AKAS_TSV_PATH, IMDB_AKAS_GZ_URL))
}
