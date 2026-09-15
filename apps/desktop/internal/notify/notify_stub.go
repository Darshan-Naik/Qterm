//go:build !darwin

package notify

type stubPoster struct {
	onActivate ActivateHandler
}

func newPoster() Poster { return &stubPoster{} }

func (s *stubPoster) RequestAuth()                    {}
func (s *stubPoster) Post(Note)                       {}
func (s *stubPoster) SetBadge(int)                    {}
func (s *stubPoster) SetOnActivate(h ActivateHandler) { s.onActivate = h }
func (s *stubPoster) AppActive() bool                 { return true }
func (s *stubPoster) BringToFront()                   {}
