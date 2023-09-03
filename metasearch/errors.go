package main

func must[T any](t T, err error) T {
	check(err)
	return t
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
