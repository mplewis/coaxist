package main

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
)

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

func lines(path string) (<-chan string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("error opening file: %s: %w", path, err)
	}

	ret := make(chan string)
	go func() {
		s := bufio.NewScanner(f)
		for s.Scan() {
			ret <- s.Text()
		}
		close(ret)
	}()
	return ret, nil
}

func countLines(path string) (int, error) {
	ch, err := lines(path)
	if err != nil {
		return 0, err
	}
	count := 0
	for range ch {
		count++
	}
	return count, nil
}
