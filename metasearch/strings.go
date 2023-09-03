package main

import (
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/surgebase/porter2"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

func uniq[T comparable](items []T) []T {
	set := map[T]struct{}{}
	for _, item := range items {
		set[item] = struct{}{}
	}
	out := []T{}
	for item := range set {
		out = append(out, item)
	}
	return out
}

var matchAllLetters = regexp.MustCompile(`[\p{L}|\d]+`)

func parseAllWords(s string) []string {
	return matchAllLetters.FindAllString(s, -1)
}

var transformChainStripAccents = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

func stripAccents(s string) string {
	s, _, _ = transform.String(transformChainStripAccents, s)
	return s
}

var matchAllPunctuation = regexp.MustCompile(`\p{P}+`)

func stripPunctuation(s string) string {
	return matchAllPunctuation.ReplaceAllString(s, "")
}

var matchHyphens = regexp.MustCompile(`[-–—]`)

func splitHyphens(s string) string {
	return matchHyphens.ReplaceAllString(s, " ")
}

func splitSlashes(s string) string {
	return strings.ReplaceAll(s, "/", " ")
}

func canonicalize(s string, en bool) []string {
	words := parseAllWords(stripAccents(stripPunctuation(splitSlashes(splitHyphens(strings.ToLower(s))))))

	stems := []string{}
	if !en {
		stems = words
	} else {
		for _, word := range words {
			word := porter2.Stem(word)
			stems = append(stems, word)
		}
	}

	stems = uniq(stems)
	sort.Strings(stems)
	return stems
}
