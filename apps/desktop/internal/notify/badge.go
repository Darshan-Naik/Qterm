package notify

// BadgeCount is how many waiting agents belong on the Dock icon.
// Hide the focused pane only while Qterm is the front app. Otherwise a single
// waiting session in the last focused pane would never badge after Cmd-Tab.
func BadgeCount(waiting int, focusedWaiting, appFront bool) int {
	n := waiting
	if appFront && focusedWaiting {
		n--
	}
	if n < 0 {
		return 0
	}
	return n
}
