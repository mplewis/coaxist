package filedb

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cespare/xxhash"
)

type FileDB struct {
	path            string
	imdbIDtoTitleID map[string]int
	lastTitleID     int
}

func New(path string) *FileDB {
	return &FileDB{
		path:            path,
		imdbIDtoTitleID: map[string]int{}, // imdb ID -> title ID
		lastTitleID:     0,
	}
}

func (db *FileDB) Empty() error {
	err := os.RemoveAll(db.path)
	if err != nil {
		return fmt.Errorf("error removing db path %s: %w", db.path, err)
	}
	for _, kind := range []string{"title", "stem"} {
		path := filepath.Join(db.path, kind)
		err = os.MkdirAll(path, 0755)
		if err != nil {
			return fmt.Errorf("error creating dir %s: %w", path, err)
		}
	}
	return nil
}

func (db *FileDB) UpsertStems(imdbID string, title string, stems []string) error {
	if _, ok := db.insertedTitles[imdbID]; ok {
		return nil // already indexed this title and its stems
	}

	if id, ok := db.imdbIDtoTitleID[imdbID]; ok {
		return id, nil
	}
	db.lastTitleID++
	titleID := db.lastTitleID
	path := db.pathTitle(titleID)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return 0, fmt.Errorf("error opening title file %s: %w", path, err)
	}
	defer f.Close()
	_, err = f.WriteString(imdbID)
	if err != nil {
		return 0, fmt.Errorf("error writing imdbID to title file %s: %w", path, err)
	}
	db.imdbIDtoTitleID[imdbID] = titleID
	return titleID, nil

	for _, stem := range stems {
		path := db.pathStem(stem)
		f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return fmt.Errorf("error opening stem file %s: %w", path, err)
		}
		defer f.Close()
		_, err = f.WriteString(fmt.Sprintf("%d\n", titleID))
		if err != nil {
			return fmt.Errorf("error writing titleID to stem file %s: %w", path, err)
		}
	}
	db.insertedTitles[imdbID] = struct{}{}
	return nil
}

func (db *FileDB) pathFor(kind, key string) string {
	return filepath.Join(db.path, kind, key)
}

func (db *FileDB) pathTitle(id int) string {
	return db.pathFor("title", fmt.Sprintf("%d", id))
}

func (db *FileDB) pathStem(stem string) string {
	hashed := xxhash.Sum64String(stem)
	hStr := fmt.Sprintf("%x", hashed)
	return db.pathFor("stem", hStr)
}
