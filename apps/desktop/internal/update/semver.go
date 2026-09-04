package update

import (
	"strconv"
	"strings"
)

// Normalize strips a leading v and any pre-release or build suffix.
func Normalize(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	if i := strings.IndexAny(v, "+-"); i >= 0 {
		v = v[:i]
	}
	return v
}

func parse(v string) [3]int {
	var out [3]int
	parts := strings.Split(Normalize(v), ".")
	for i := 0; i < 3 && i < len(parts); i++ {
		n, _ := strconv.Atoi(parts[i])
		out[i] = n
	}
	return out
}

// Compare returns -1 if a < b, 0 if equal, 1 if a > b (semver major.minor.patch).
func Compare(a, b string) int {
	pa, pb := parse(a), parse(b)
	for i := 0; i < 3; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}
