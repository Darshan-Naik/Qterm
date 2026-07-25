package project

import (
	"path/filepath"

	"github.com/google/uuid"
	"qterm/internal/config"
)

const (
	HomeID = "home"
)

type Service struct {
	store *config.Store
}

func NewService(store *config.Store) *Service {
	return &Service{store: store}
}

func (s *Service) List() []config.ProjectMeta {
	return s.store.Get().Projects
}

func (s *Service) Add(path, name string) (config.ProjectMeta, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return config.ProjectMeta{}, err
	}
	if name == "" {
		name = filepath.Base(abs)
	}
	p := config.ProjectMeta{
		ID:   uuid.NewString(),
		Name: name,
		Path: abs,
	}
	err = s.store.Update(func(cfg *config.AppConfig) {
		cfg.Projects = append(cfg.Projects, p)
	})
	return p, err
}

func (s *Service) Remove(id string) error {
	return s.store.Update(func(cfg *config.AppConfig) {
		next := make([]config.ProjectMeta, 0, len(cfg.Projects))
		for _, p := range cfg.Projects {
			if p.ID != id {
				next = append(next, p)
			}
		}
		cfg.Projects = next
		delete(cfg.Layouts, id)
		sessions := make([]config.SessionMeta, 0)
		for _, sess := range cfg.Sessions {
			if sess.ProjectID != id {
				sessions = append(sessions, sess)
			}
		}
		cfg.Sessions = sessions
	})
}

func (s *Service) Rename(id, name string) error {
	return s.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Projects {
			if cfg.Projects[i].ID == id {
				cfg.Projects[i].Name = name
				break
			}
		}
	})
}

func (s *Service) Get(id string) (config.ProjectMeta, bool) {
	for _, p := range s.store.Get().Projects {
		if p.ID == id {
			return p, true
		}
	}
	return config.ProjectMeta{}, false
}
