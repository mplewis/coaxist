-- CreateTable
CREATE TABLE "Media" (
    "type" TEXT NOT NULL,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "imdbID" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Snatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "mediaID" INTEGER NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "URL" TEXT NOT NULL,
    CONSTRAINT "Snatch_mediaID_fkey" FOREIGN KEY ("mediaID") REFERENCES "Media" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SnatchToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_SnatchToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Snatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SnatchToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Media_imdbID_key" ON "Media"("imdbID");

-- CreateIndex
CREATE UNIQUE INDEX "Snatch_URL_key" ON "Snatch"("URL");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_SnatchToTag_AB_unique" ON "_SnatchToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_SnatchToTag_B_index" ON "_SnatchToTag"("B");
