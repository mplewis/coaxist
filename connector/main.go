package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/mplewis/coaxist/connector/metafetcher"

	"github.com/deflix-tv/go-debrid/alldebrid"
	"github.com/deflix-tv/go-stremio/pkg/cinemeta"
	"github.com/deflix-tv/imdb2torrent"
	"go.uber.org/zap"
)

func must[T any](t T, err error) T {
	if err != nil {
		panic(err)
	}
	return t
}

func mustEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		panic(fmt.Errorf("environment variable %s must be set", key))
	}
	return val
}

func main() {
	logger := must(zap.NewDevelopment())
	timeout := 5 * time.Second
	maxAgeTorrents := 7 * 24 * time.Hour
	logFoundTorrents := false

	torrentCache := imdb2torrent.NewInMemoryCache()
	cinemetaCache := cinemeta.NewInMemoryCache()

	cinemetaClient := cinemeta.NewClient(cinemeta.DefaultClientOpts, cinemetaCache, logger)
	metaFetcher := must(metafetcher.NewClient("", cinemetaClient, logger))

	baseURLyts := "https://yts.mx"
	baseURLtpb := "https://apibay.org"
	baseURL1337x := "https://1337x.to"
	baseURLibit := "https://ibit.am"
	baseURLrarbg := "https://torrentapi.org"

	ytsClientOpts := imdb2torrent.NewYTSclientOpts(baseURLyts, timeout, maxAgeTorrents)
	tpbClientOpts := imdb2torrent.NewTPBclientOpts(baseURLtpb, "", timeout, maxAgeTorrents)
	leetxClientOpts := imdb2torrent.NewLeetxClientOpts(baseURL1337x, timeout, maxAgeTorrents)
	ibitClientOpts := imdb2torrent.NewIbitClientOpts(baseURLibit, timeout, maxAgeTorrents)
	rarbgClientOpts := imdb2torrent.NewRARBGclientOpts(baseURLrarbg, timeout, maxAgeTorrents)

	tpbClient := must(imdb2torrent.NewTPBclient(tpbClientOpts, torrentCache, metaFetcher, logger, logFoundTorrents))

	siteClients := map[string]imdb2torrent.MagnetSearcher{
		"YTS":   imdb2torrent.NewYTSclient(ytsClientOpts, torrentCache, logger, logFoundTorrents),
		"TPB":   tpbClient,
		"1337X": imdb2torrent.NewLeetxClient(leetxClientOpts, torrentCache, metaFetcher, logger, logFoundTorrents),
		"ibit":  imdb2torrent.NewIbitClient(ibitClientOpts, torrentCache, logger, logFoundTorrents),
		"RARBG": imdb2torrent.NewRARBGclient(rarbgClientOpts, torrentCache, logger, logFoundTorrents),
	}

	searchClient := imdb2torrent.NewClient(siteClients, timeout, logger)
	results := must(searchClient.FindMovie(context.Background(), "tt3783958"))
	torrentInfo := map[string]imdb2torrent.Result{}
	magnets := make([]string, len(results))
	for i, result := range results {
		torrentInfo[result.MagnetURL] = result
		magnets[i] = result.MagnetURL
	}

	adClient := alldebrid.NewClient(alldebrid.ClientOptions{}, mustEnv("ALLDEBRID_API_KEY"), logger)
	inst := must(adClient.GetInstantAvailability(context.Background(), magnets...))
	for magnet := range inst {
		info := torrentInfo[magnet]
		fmt.Printf("%s (%s)\n", info.Title, info.Quality)
	}
}
