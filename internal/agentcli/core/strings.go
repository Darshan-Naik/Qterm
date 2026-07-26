package core

// AsStringSlice coerces JSON array values into a string slice.
func AsStringSlice(v any) []string {
	switch t := v.(type) {
	case []string:
		return append([]string(nil), t...)
	case []any:
		out := make([]string, 0, len(t))
		for _, e := range t {
			if s, ok := e.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

// AddUniqueString appends s if not already present.
func AddUniqueString(list []string, s string) []string {
	for _, e := range list {
		if e == s {
			return list
		}
	}
	return append(list, s)
}

// RemoveStringExact removes all exact matches of s from list.
func RemoveStringExact(list []string, s string) []string {
	out := list[:0]
	for _, e := range list {
		if e != s {
			out = append(out, e)
		}
	}
	return out
}
