package agy

import "qterm/internal/agentcli/core"

// Antigravity stores protobuf conversations — no stable text index yet.
func (adapter) ListSessions(core.SessionQuery) ([]core.Session, error) {
	return nil, nil
}

func (adapter) Resume(string) (core.ResumeSpec, error) {
	return core.ResumeSpec{}, core.ErrResumeUnsupported
}
