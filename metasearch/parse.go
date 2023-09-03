package main

import (
	"encoding/csv"
	"errors"
	"io"
	"os"
)

type Record struct {
	Data  []string
	Error error
}

type Indexable struct {
	MediaID int64
	ImdbID  string
	Title   string
	Stems   []string
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
		// drop header record
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

func fromRecord(record Record) (Indexable, error) {
	title := record.Data[2]
	lang := record.Data[3]
	stems := canonicalize(title, lang == "GB" || lang == "US")
	return Indexable{ImdbID: record.Data[0], Title: title, Stems: stems}, nil
}
