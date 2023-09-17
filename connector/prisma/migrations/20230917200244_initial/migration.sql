-- CreateTable
CREATE TABLE "Snatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSnatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mediaType" TEXT NOT NULL,
    "imdbID" TEXT NOT NULL,
    "refreshURL" TEXT NOT NULL,
    "debridCredsHash" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "season" INTEGER,
    "episode" INTEGER
);
