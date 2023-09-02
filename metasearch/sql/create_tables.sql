CREATE TABLE media (
	id INTEGER PRIMARY KEY,
	imdb_id TEXT NOT NULL UNIQUE
);

CREATE TABLE stem (
	id INTEGER PRIMARY KEY,
	val TEXT NOT NULL UNIQUE
);

CREATE TABLE title (
	id INTEGER PRIMARY KEY,
	val TEXT UNIQUE,
	media_id INTEGER NOT NULL,
	FOREIGN KEY (media_id) REFERENCES media(id)
);

CREATE TABLE title_stems (
	title_id INTEGER NOT NULL,
	stem_id INTEGER NOT NULL,
	FOREIGN KEY (title_id) REFERENCES title(id),
	FOREIGN KEY (stem_id) REFERENCES stem(id),
	PRIMARY KEY (title_id, stem_id)
);
