package main

import (
	"encoding/binary"
	"slices"

	set "github.com/deckarep/golang-set/v2"
)

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
