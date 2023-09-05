package main

import (
	"fmt"

	"github.com/dgraph-io/badger/v4"
)

type DB struct {
	kv             *badger.DB
	insertedTitles map[string]struct{}
}

func NewDB(path string) (*DB, error) {
	kv, err := badger.Open(badger.DefaultOptions(path))
	if err != nil {
		return nil, err
	}
	db := &DB{kv: kv, insertedTitles: map[string]struct{}{}}
	return db, nil
}

func (db *DB) Close() error {
	return db.kv.Close()
}

func (db *DB) InsertStems(imdbID string, title string, stems []string) error {
	if _, ok := db.insertedTitles[imdbID]; ok {
		return nil
	}

	return db.kv.Update(func(txn *badger.Txn) error {
		for _, stem := range stems {
			err := txn.Set([]byte(stem), []byte(imdbID))
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (db *DB) List() error {
	return db.kv.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchSize = 10
		it := txn.NewIterator(opts)
		defer it.Close()
		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			k := item.Key()
			err := item.Value(func(v []byte) error {
				fmt.Printf("key=%s, value=%s\n", k, v)
				return nil
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
}
