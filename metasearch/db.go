package main

import (
	"encoding/binary"
	"errors"
	"fmt"

	set "github.com/deckarep/golang-set/v2"
	"github.com/dgraph-io/badger/v4"
	"golang.org/x/exp/slices"
)

type DB struct {
	kv                  *badger.DB
	insertedTitles      map[string]struct{}
	lastInsertedTitleID uint32
}

func NewDB(path string) (*DB, error) {
	kv, err := badger.Open(badger.DefaultOptions(path))
	if err != nil {
		return nil, err
	}
	db := &DB{kv: kv, insertedTitles: map[string]struct{}{}, lastInsertedTitleID: 0}
	return db, nil
}

func (db *DB) Close() error {
	return db.kv.Close()
}

func (db *DB) InsertMedia(imdbID string) (uint32, error) {
	db.lastInsertedTitleID++
	id := db.lastInsertedTitleID
	idb := uint32ToByte(id)
	err := db.kv.Update(func(txn *badger.Txn) error {
		return txn.Set(append([]byte("_"), idb...), []byte(imdbID))
	})
	if err != nil {
		return 0, fmt.Errorf("error updating db: %w", err)
	}
	return id, nil
}

func (db *DB) InsertStems(mediaID uint32, title string, stems []string) error {
	if _, ok := db.insertedTitles[title]; ok {
		return nil
	}
	mediaIDb := uint32ToByte(mediaID)

	err := db.kv.Update(func(txn *badger.Txn) error {
		for _, stem := range stems {
			item, err := txn.Get([]byte(stem))
			if err != nil {
				if !errors.Is(err, badger.ErrKeyNotFound) {
					return fmt.Errorf("error getting key %s: %w", stem, err)
				}

				err = txn.Set([]byte(stem), mediaIDb)
				if err != nil {
					return fmt.Errorf("error setting key %s: %w", stem, err)
				}
				continue
			}

			existing, err := item.ValueCopy(nil)
			if err != nil {
				return fmt.Errorf("error getting value for key %s: %w", stem, err)
			}

			if contains4(existing, mediaIDb) {
				continue // don't add mediaID if it already exists in the set
			}

			err = txn.Set([]byte(stem), append(existing, mediaIDb...))
			if err != nil {
				return fmt.Errorf("error setting key %s: %w", stem, err)
			}
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("error updating db: %w", err)
	}
	db.insertedTitles[title] = struct{}{}
	return nil
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
				if k[0] == '_' {
					fmt.Printf("key=%+v, value=%s\n", k, v)
				} else {
					fmt.Printf("key=%s, value=%+v\n", k, v)
				}
				return nil
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (db *DB) QueryMedia(id uint32) (string, bool, error) {
	idb := uint32ToByte(id)
	qid := append([]byte("_"), idb...)

	var imdbID string
	found := false
	err := db.kv.View(func(txn *badger.Txn) error {
		item, err := txn.Get(qid)
		if err != nil {
			return fmt.Errorf("error getting key %d: %w", id, err)
		}

		val, err := item.ValueCopy(nil)
		if err != nil {
			if errors.Is(err, badger.ErrKeyNotFound) {
				return nil
			} else {
				return fmt.Errorf("error getting value for key %d: %w", id, err)
			}
		}

		found = true
		imdbID = string(val)
		return nil
	})

	if err != nil {
		return "", false, fmt.Errorf("error querying db: %w", err)
	}
	return imdbID, found, nil
}

func (db *DB) QueryStem(stem string) ([]uint32, error) {
	var ids []uint32
	err := db.kv.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(stem))
		if err != nil {
			if errors.Is(err, badger.ErrKeyNotFound) {
				return nil
			} else {
				return fmt.Errorf("error getting key %s: %w", stem, err)
			}
		}

		val, err := item.ValueCopy(nil)
		if err != nil {
			if errors.Is(err, badger.ErrKeyNotFound) {
				return nil
			} else {
				return fmt.Errorf("error getting value for key %s: %w", stem, err)
			}
		}

		ids = append(ids, bytesToUint32s(val)...)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error querying db: %w", err)
	}
	return ids, nil
}

func uint32ToByte(n uint32) []byte {
	a := make([]byte, 4)
	binary.LittleEndian.PutUint32(a, n)
	return a
}

func bytesToUint32s(b []byte) []uint32 {
	bits := splitEvery4(b)
	var ids []uint32
	for _, b := range bits {
		ids = append(ids, binary.LittleEndian.Uint32(b))
	}
	return ids
}

func splitEvery4(b []byte) [][]byte {
	var bits [][]byte
	for i := 0; i < len(b); i += 4 {
		bits = append(bits, b[i:i+4])
	}
	return bits
}

func contains4(all []byte, x []byte) bool {
	bits := splitEvery4(all)
	for _, b := range bits {
		if slices.Equal(b, x) {
			return true
		}
	}
	return false
}

func intersect(itemSets ...[]uint32) []uint32 {
	sets := []set.Set[uint32]{}
	for _, items := range itemSets {
		sets = append(sets, set.NewSet[uint32](items...))
	}
	result := sets[0]
	for _, s := range sets[1:] {
		result = result.Intersect(s)
	}
	return result.ToSlice()
}
