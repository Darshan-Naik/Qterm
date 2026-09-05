package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"qterm/internal/agentcli"
	"qterm/internal/agentcli/bridge"
	"qterm/internal/appmode"
	"qterm/internal/config"
	"qterm/internal/git"
	"qterm/internal/hooks"
	"qterm/internal/project"
	ptymgr "qterm/internal/pty"
	"qterm/internal/ptyemit"
	"qterm/internal/scrollback"
	"qterm/internal/termquery"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx              context.Context
	store            *config.Store
	pty              *ptymgr.Manager
	projects         *project.Service
	hooks            *hooks.Host
	scrollback       *scrollback.Store
	ptyOut           *ptyemit.Coalescer
	bridge           *bridge.Server
	shuttingDown     bool
	focusedSessionID string
	agentMu          sync.Mutex
	agentBind        map[string]string // CLI session id → Qterm session id (sticky)
	agentLastQterm   string            // last Qterm pane that received agent activity
	pendingSlashAuto map[string]slashAutoPending
	nudgeMu          sync.Mutex
	nudgeSeen        map[string]struct{}      // sessionID\0cli — already nudged
	nudgeTimers      map[string][]*time.Timer // sessionID → 10s/20s/50s checks
	ready            bool
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.ready = false
	setDockIcon(appIcon)
	store, err := config.NewStore()
	if err != nil {
		panic(err)
	}
	a.store = store
	a.projects = project.NewService(store)
	cfg := store.Get()

	sb, err := scrollback.NewStore(filepath.Join(store.DataDir(), "scrollback"))
	if err != nil {
		panic(err)
	}
	a.scrollback = sb

	a.ptyOut = ptyemit.New(a.emitPtyData)
	a.pty = ptymgr.NewManager(cfg.Shell, a.onPtyData, a.onPtyExit)
	// Finder-launched apps miss Homebrew/nvm PATH — enrich before CLI detection.
	agentcli.EnsureUserPath()
	a.hooks = hooks.NewHost(store.HooksDir(), a.onHookIntent)
	a.startAgentBridge()

	// Recreate terminals from last session
	a.restoreSessions()
	a.setupMenu()
	a.ready = true
	// Best-effort notify; DomReady also emits (EventsEmit is reliable there).
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "app:ready", nil)
	}
	go a.notifyAppUpdate()
}

// domReady runs after index.html loads — reliable place to emit runtime events.
func (a *App) domReady(ctx context.Context) {
	a.ctx = ctx
	if a.ready {
		runtime.EventsEmit(ctx, "app:ready", nil)
	}
}

// Ready reports whether Go startup finished (store / projects / pty).
func (a *App) Ready() bool {
	return a != nil && a.ready
}

func (a *App) setupMenu() {
	// First submenu is the macOS app menu. Custom so we can keep About + Settings together
	// (Wails AppMenu role can't be extended with extra items).
	app := menu.NewMenu()
	app.AddText("About "+appmode.AppTitle, nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "app:open-about")
	})
	app.AddSeparator()
	app.AddText("Check for Updates…", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "app:check-updates")
	})
	app.AddSeparator()
	app.AddText("Settings…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "app:open-settings", "appearance")
	})
	app.AddSeparator()
	app.AddText("Quit "+appmode.AppTitle, keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(a.ctx)
	})

	win := menu.NewMenu()
	win.AddText("Minimize", keys.CmdOrCtrl("m"), func(_ *menu.CallbackData) {
		runtime.WindowMinimise(a.ctx)
	})
	win.AddText("Zoom", nil, func(_ *menu.CallbackData) {
		runtime.WindowToggleMaximise(a.ctx)
	})
	win.AddSeparator()
	win.AddText("Reload Window", nil, func(_ *menu.CallbackData) {
		runtime.WindowReloadApp(a.ctx)
	})

	items := []*menu.MenuItem{
		menu.SubMenu(appmode.AppTitle, app),
		menu.EditMenu(),
		menu.SubMenu("Window", win),
	}
	// Developer tools only when the inspector is compiled in (wails dev / debug / --devtools).
	if appmode.IsDev {
		dev := menu.NewMenu()
		dev.AddText(
			"Toggle Developer Tools",
			keys.Combo("i", keys.CmdOrCtrlKey, keys.OptionOrAltKey),
			func(_ *menu.CallbackData) {
				runtime.EventsEmit(a.ctx, "app:open-inspector")
			},
		)
		items = append(items, menu.SubMenu("Developer", dev))
	}

	runtime.MenuSetApplicationMenu(a.ctx, menu.NewMenuFromItems(items[0], items[1:]...))
}

func (a *App) shutdown(ctx context.Context) {
	a.shuttingDown = true
	if a.ptyOut != nil {
		a.ptyOut.FlushAll()
	}
	if a.bridge != nil {
		_ = a.bridge.Stop(ctx)
	}
	if a.scrollback != nil {
		a.scrollback.Close()
	}
	if a.store != nil {
		a.store.Close()
	}
	if a.pty != nil {
		a.pty.CloseAll()
	}
	if a.hooks != nil {
		for _, h := range a.hooks.List() {
			_ = a.hooks.Deactivate(h.Manifest.ID)
		}
	}
}

func (a *App) restoreSessions() {
	cfg := a.store.Get()
	for i, meta := range cfg.Sessions {
		resumeAgent := meta.AgentCLI != "" && meta.AgentSessionID != ""
		if a.scrollback != nil {
			if resumeAgent {
				// Dead TUI bytes would mix with the new shell / resume redraw.
				a.scrollback.Remove(meta.ID)
			} else {
				a.scrollback.Load(meta.ID)
			}
		}
		cwd := meta.Cwd
		if cwd == "" && meta.ProjectID != "" && meta.ProjectID != project.HomeID {
			if p, ok := a.projects.Get(meta.ProjectID); ok {
				cwd = p.Path
			}
		}
		created := meta.CreatedAt
		if created.IsZero() {
			// Older configs: preserve prior config order as start time.
			created = time.Unix(0, int64(i+1)*int64(time.Millisecond))
		}
		_, err := a.pty.Create(ptymgr.CreateOpts{
			ID:        meta.ID,
			Name:      meta.Name,
			ProjectID: meta.ProjectID,
			Cwd:       cwd,
			Pinned:    meta.Pinned,
			CreatedAt: created,
		})
		if err != nil {
			println("restore session failed:", meta.ID, err.Error())
			continue
		}
		if resumeAgent {
			a.bindAgentSession(meta.AgentSessionID, meta.ID)
			a.writeResumeCommand(meta.ID, meta.AgentCLI, meta.AgentSessionID)
		}
	}
	// Tell the UI restore finished — bootstrap may have raced ListSessions.
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	}
}

func (a *App) onPtyData(sessionID string, data []byte) {
	// Answer DA / OSC color queries in-process (like native terminals) so
	// zsh/p10k do not time out waiting on the webview round-trip. Strip those
	// queries from the forward path to avoid double replies from xterm.
	forward, replies, urgent := termquery.Process(data, termquery.DefaultColors)
	if len(replies) > 0 && a.pty != nil {
		_ = a.pty.Write(sessionID, replies)
	}
	if len(forward) == 0 {
		return
	}
	if a.ptyOut != nil {
		if urgent {
			a.ptyOut.PushImmediate(sessionID, forward)
		} else {
			a.ptyOut.Push(sessionID, forward)
		}
		return
	}
	a.emitPtyData(sessionID, forward)
}

func (a *App) emitPtyData(sessionID string, data []byte) {
	var seq uint64
	if a.scrollback != nil {
		seq = a.scrollback.Append(sessionID, data)
	}
	runtime.EventsEmit(a.ctx, "pty:data", map[string]any{
		"sessionId": sessionID,
		"data":      base64.StdEncoding.EncodeToString(data),
		"seq":       seq,
	})
	if a.hooks != nil {
		a.hooks.BroadcastOutput(sessionID, data)
	}
}

func (a *App) onPtyExit(sessionID string, code int) {
	a.cancelConnectNudgeChecks(sessionID)
	runtime.EventsEmit(a.ctx, "pty:exit", map[string]any{
		"sessionId": sessionID,
		"code":      code,
	})
	if a.hooks != nil {
		a.hooks.BroadcastExit(sessionID, code)
	}
	// Keep sessions on disk when the app is quitting so they restore next launch.
	if a.shuttingDown {
		return
	}
	a.removeSessionMeta(sessionID)
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
}

func (a *App) removeSessionMeta(sessionID string) {
	a.clearAgentBindsForQterm(sessionID)
	if a.scrollback != nil {
		a.scrollback.Remove(sessionID)
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		next := make([]config.SessionMeta, 0, len(cfg.Sessions))
		for _, s := range cfg.Sessions {
			if s.ID != sessionID {
				next = append(next, s)
			}
		}
		cfg.Sessions = next
		// Drop leaves that pointed at this session from layouts.
		for key, layout := range cfg.Layouts {
			cleaned, changed := pruneSessionFromLayout(layout, sessionID)
			if changed {
				if cleaned.Type == "" {
					delete(cfg.Layouts, key)
				} else {
					cfg.Layouts[key] = cleaned
				}
			}
		}
	})
}

func pruneSessionFromLayout(node config.SplitNode, sessionID string) (config.SplitNode, bool) {
	if node.Type == "leaf" {
		if node.SessionID == sessionID {
			return config.SplitNode{}, true
		}
		return node, false
	}
	if node.Type != "split" || len(node.Children) != 2 {
		return node, false
	}
	left, lchg := pruneSessionFromLayout(node.Children[0], sessionID)
	right, rchg := pruneSessionFromLayout(node.Children[1], sessionID)
	if !lchg && !rchg {
		return node, false
	}
	if left.Type == "" {
		return right, true
	}
	if right.Type == "" {
		return left, true
	}
	node.Children = []config.SplitNode{left, right}
	return node, true
}

func (a *App) onHookIntent(intent hooks.Intent) {
	runtime.EventsEmit(a.ctx, "hook:intent", intent)
}

// --- About ---

func (a *App) AboutInfo() appmode.AboutInfo {
	return appmode.About()
}

// --- Config ---

func (a *App) GetConfig() config.AppConfig {
	if a.store == nil {
		return config.DefaultConfig()
	}
	return a.store.Get()
}

func (a *App) SaveTheme(theme string) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.Theme = theme
	})
}

func (a *App) SaveShell(shell string) error {
	a.pty.SetShell(shell)
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.Shell = shell
	})
}

func (a *App) SaveFontSize(size int) error {
	if size < config.MinFontSize {
		size = config.MinFontSize
	}
	if size > config.MaxFontSize {
		size = config.MaxFontSize
	}
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.FontSize = size
	})
}

func (a *App) SaveDefaultIDE(name string) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.DefaultIDE = strings.TrimSpace(name)
	})
}

func (a *App) SaveKeybindings(bindings config.KeybindingOverrides) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		if len(bindings) == 0 {
			cfg.Keybindings = nil
			return
		}
		cfg.Keybindings = bindings
	})
}

func (a *App) SaveSnippets(snippets []config.Snippet) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.Snippets = config.SanitizeSnippets(snippets)
	})
}

func (a *App) SaveLayout(key string, layout config.SplitNode) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		if cfg.Layouts == nil {
			cfg.Layouts = config.LayoutStore{}
		}
		if layout.Type == "" {
			delete(cfg.Layouts, key)
			return
		}
		cfg.Layouts[key] = layout
	})
}

func (a *App) GetLayout(key string) config.SplitNode {
	if a.store == nil {
		return config.SplitNode{}
	}
	layouts := a.store.Get().Layouts
	if layouts == nil {
		return config.SplitNode{}
	}
	return layouts[key]
}

func (a *App) SaveActiveScope(scope string) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.ActiveScope = scope
	})
}

func (a *App) SaveUIPrefs(prefs config.UIPrefs) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		open := prefs.SidebarOpen
		cfg.SidebarOpen = &open
		cfg.SidebarWidth = config.ClampSidebarWidth(prefs.SidebarWidth)
		cfg.UiZoom = config.ClampUiZoom(prefs.UiZoom)
		if prefs.CollapsedProjects == nil {
			cfg.CollapsedProjects = map[string]bool{}
		} else {
			cfg.CollapsedProjects = prefs.CollapsedProjects
		}
		if prefs.SidebarFooter == nil {
			cfg.SidebarFooter = []string{}
		} else {
			cfg.SidebarFooter = prefs.SidebarFooter
		}
	})
}

// GetScrollback returns base64 terminal output history and a sequence number
// so the UI can ignore duplicate live events already covered by the snapshot.
func (a *App) GetScrollback(sessionID string) map[string]any {
	if a.scrollback == nil {
		return map[string]any{"data": "", "seq": 0}
	}
	data, seq := a.scrollback.Snapshot(sessionID)
	if len(data) == 0 {
		return map[string]any{"data": "", "seq": seq}
	}
	return map[string]any{
		"data": base64.StdEncoding.EncodeToString(data),
		"seq":  seq,
	}
}

// SearchScrollback finds sessions whose output/prompt text contains query.
// Returns [{sessionId, snippet}, …] for the quick-open palette.
func (a *App) SearchScrollback(query string, sessionIDs []string) []map[string]any {
	if a.scrollback == nil {
		return nil
	}
	hits := a.scrollback.Search(query, sessionIDs)
	if len(hits) == 0 {
		return nil
	}
	out := make([]map[string]any, len(hits))
	for i, h := range hits {
		out[i] = map[string]any{
			"sessionId": h.SessionID,
			"snippet":   h.Snippet,
		}
	}
	return out
}

// ListAgentSessions returns on-disk agent history (no plugin/PATH required).
// Matches title first, then prompt/body text.
func (a *App) ListAgentSessions(query, cliID string) []agentcli.AgentSession {
	return agentcli.ListSessions(a.store.DataDir(), agentcli.SessionQuery{
		Query: query,
		CLI:   cliID,
		Limit: 80,
	})
}

// ResumeAgentSession asks the CLI adapter for the resume command, opens a
// terminal, and types the command to continue the session.
// projectID selects the Qterm project scope; empty means home/unbound (cwd still used).
// If this agent session is already bound to a live terminal, that terminal is returned
// instead of opening a duplicate.
func (a *App) ResumeAgentSession(cli, sessionID, projectID string) (SessionDTO, error) {
	if cli == "" || sessionID == "" {
		return SessionDTO{}, fmt.Errorf("missing agent session")
	}

	if qid := a.lookupAgentBind(sessionID); qid != "" {
		if s, ok := a.pty.Get(qid); ok {
			return SessionDTO{
				ID: s.ID, Name: s.Name, ProjectID: s.ProjectID, Cwd: s.Cwd, Pinned: s.Pinned,
			}, nil
		}
		a.clearAgentBind(sessionID)
	}

	spec, err := agentcli.Resume(cli, sessionID)
	if err != nil {
		return SessionDTO{}, err
	}
	if strings.TrimSpace(spec.Command) == "" {
		return SessionDTO{}, fmt.Errorf("adapter returned empty resume command")
	}

	if projectID != "" {
		if _, ok := a.projects.Get(projectID); !ok {
			projectID = ""
		}
	}

	name := strings.TrimSpace(spec.Title)
	if name == "" {
		if p, ok := agentcli.Find(cli); ok {
			name = p.Name()
		} else {
			name = cli
		}
	}
	if len(name) > 48 {
		name = name[:45] + "…"
	}

	cwd := strings.TrimSpace(spec.Cwd)
	dto, err := a.CreateSession(projectID, name, cwd)
	if err != nil {
		return SessionDTO{}, err
	}
	a.bindAgentSession(sessionID, dto.ID)
	a.persistSessionAgent(dto.ID, cli, sessionID)
	a.writeResumeCommand(dto.ID, cli, sessionID)

	return dto, nil
}

func (a *App) writeResumeCommand(qtermID, cli, sessionID string) {
	if qtermID == "" || cli == "" || sessionID == "" {
		return
	}
	spec, err := agentcli.Resume(cli, sessionID)
	if err != nil || strings.TrimSpace(spec.Command) == "" {
		return
	}
	cmd := spec.Command
	if !strings.HasSuffix(cmd, "\n") {
		cmd += "\n"
	}
	go func(id, payload string) {
		time.Sleep(350 * time.Millisecond)
		_ = a.WriteSession(id, payload)
	}(qtermID, cmd)
}

// ActiveAgentBinds returns live agent conversation id → Qterm terminal id.
func (a *App) ActiveAgentBinds() map[string]string {
	a.agentMu.Lock()
	snap := make(map[string]string, len(a.agentBind))
	for k, v := range a.agentBind {
		if k != "" && v != "" {
			snap[k] = v
		}
	}
	a.agentMu.Unlock()

	out := make(map[string]string, len(snap))
	for k, v := range snap {
		if _, ok := a.pty.Get(v); ok {
			out[k] = v
		}
	}
	return out
}

// --- Projects ---

func (a *App) ListProjects() []config.ProjectMeta {
	if a.projects == nil {
		return []config.ProjectMeta{}
	}
	list := a.projects.List()
	out := make([]config.ProjectMeta, len(list))
	copy(out, list)
	for i := range out {
		if out[i].AddedAt.IsZero() {
			// Older configs: preserve prior config order as added time.
			out[i].AddedAt = time.Unix(0, int64(i+1)*int64(time.Millisecond))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].AddedAt.Before(out[j].AddedAt)
	})
	return out
}

func (a *App) AddProject(path, name string) (config.ProjectMeta, error) {
	return a.projects.Add(path, name)
}

func (a *App) RemoveProject(id string) error {
	return a.projects.Remove(id)
}

func (a *App) RenameProject(id, name string) error {
	return a.projects.Rename(id, name)
}

func (a *App) PickFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select project folder",
	})
}

func (a *App) GetGitStatus(path string) git.Status {
	return git.Probe(path)
}

func (a *App) GetGitSnapshot(path string) git.Snapshot {
	return git.LoadSnapshot(path)
}

func (a *App) ListGitBranches(path string) []git.Branch {
	return git.ListBranches(path)
}

func (a *App) GitFetch(path string) git.Result {
	return git.Fetch(path)
}

func (a *App) GitPull(path string) git.Result {
	return git.Pull(path)
}

func (a *App) GitPush(path string) git.Result {
	return git.Push(path)
}

func (a *App) GitStage(path, file string) git.Result {
	return git.Stage(path, file)
}

func (a *App) GitUnstage(path, file string) git.Result {
	return git.Unstage(path, file)
}

func (a *App) GitStageAll(path string) git.Result {
	return git.StageAll(path)
}

func (a *App) GitUnstageAll(path string) git.Result {
	return git.UnstageAll(path)
}

func (a *App) GitCommit(path, message string) git.Result {
	return git.Commit(path, message)
}

func (a *App) GitCheckout(path, branch string) git.Result {
	return git.Checkout(path, branch)
}

func (a *App) GitCreateBranch(path, name string) git.Result {
	return git.CreateBranch(path, name)
}

func (a *App) GitDeleteBranch(path, name string, force bool) git.Result {
	return git.DeleteBranch(path, name, force)
}

func (a *App) GitDiscard(path, file string) git.Result {
	return git.Discard(path, file)
}

func (a *App) GitDiscardAll(path string) git.Result {
	return git.DiscardAll(path)
}

func (a *App) ListGitStashes(path string) []git.StashEntry {
	return git.ListStashes(path)
}

func (a *App) GitStash(path, message string) git.Result {
	return git.Stash(path, message)
}

func (a *App) GitStashPop(path, ref string) git.Result {
	return git.StashPop(path, ref)
}

func (a *App) GitStashApply(path, ref string) git.Result {
	return git.StashApply(path, ref)
}

func (a *App) GitStashDrop(path, ref string) git.Result {
	return git.StashDrop(path, ref)
}

func (a *App) ListGitWorktrees(path string) []git.Worktree {
	return git.ListWorktrees(path)
}

func (a *App) GitAddWorktree(path, branch string) git.WorktreeAddResult {
	return git.AddWorktree(path, branch)
}

func (a *App) GitRemoveWorktree(path, worktreePath string, force bool) git.Result {
	return git.RemoveWorktree(path, worktreePath, force)
}

func (a *App) GitPruneWorktrees(path string) git.Result {
	return git.PruneWorktrees(path)
}

// --- Sessions / PTY ---

type SessionDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ProjectID string    `json:"projectId"`
	Cwd       string    `json:"cwd"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"createdAt"`
	AgentCLI  string    `json:"agentCli,omitempty"`
}

func (a *App) sessionDTO(s *ptymgr.Session) SessionDTO {
	return SessionDTO{
		ID: s.ID, Name: s.Name, ProjectID: s.ProjectID, Cwd: s.Cwd, Pinned: s.Pinned, CreatedAt: s.CreatedAt,
		AgentCLI: a.sessionAgentCLI(s.ID),
	}
}

func (a *App) ListSessions() []SessionDTO {
	if a.pty == nil {
		return []SessionDTO{}
	}
	live := a.pty.List()
	out := make([]SessionDTO, 0, len(live))
	for _, s := range live {
		out = append(out, a.sessionDTO(s))
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (a *App) CreateSession(projectID, name, cwd string) (SessionDTO, error) {
	if cwd == "" && projectID != "" && projectID != project.HomeID {
		if p, ok := a.projects.Get(projectID); ok {
			cwd = p.Path
		}
	}
	sess, err := a.pty.Create(ptymgr.CreateOpts{
		Name: name, ProjectID: projectID, Cwd: cwd,
	})
	if err != nil {
		return SessionDTO{}, err
	}
	dto := a.sessionDTO(sess)
	_ = a.store.Update(func(cfg *config.AppConfig) {
		meta := config.SessionMeta{
			ID: sess.ID, Name: sess.Name, ProjectID: sess.ProjectID, Cwd: sess.Cwd, Pinned: sess.Pinned, CreatedAt: sess.CreatedAt,
		}
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == sess.ID {
				cfg.Sessions[i] = meta
				return
			}
		}
		cfg.Sessions = append(cfg.Sessions, meta)
	})
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	// New terminal → queue 10s / 20s / 50s connect-nudge checks.
	a.enqueueConnectNudgeChecks(sess.ID)
	return dto, nil
}

func (a *App) WriteSession(id, data string) error {
	return a.pty.Write(id, []byte(data))
}

func (a *App) WriteSessionBytes(id string, b64 string) error {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return err
	}
	return a.pty.Write(id, raw)
}

func (a *App) ResizeSession(id string, cols, rows int) error {
	return a.pty.Resize(id, uint16(cols), uint16(rows))
}

func (a *App) KillSession(id string) error {
	// Persist removal before kill so onPtyExit doesn't race incorrectly.
	a.removeSessionMeta(id)
	a.cancelConnectNudgeChecks(id)
	err := a.pty.Kill(id)
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	return err
}

// SetFocusedSession records which terminal the UI is focused on.
func (a *App) SetFocusedSession(id string) {
	a.focusedSessionID = id
}

func (a *App) PromoteSession(id, projectID string) error {
	sess, ok := a.pty.Get(id)
	if !ok {
		return os.ErrNotExist
	}
	sess.ProjectID = projectID
	if projectID != project.HomeID {
		if p, ok := a.projects.Get(projectID); ok {
			sess.Cwd = p.Path
		}
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == id {
				cfg.Sessions[i].ProjectID = projectID
				cfg.Sessions[i].Cwd = sess.Cwd
			}
		}
	})
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	return nil
}

// --- Agent CLI plugins / legacy intent resolve ---

func (a *App) ResolveHookIntent(intentID string, approved bool) (map[string]any, error) {
	if a.hooks == nil {
		return map[string]any{"ok": true}, nil
	}
	result, err := a.hooks.ResolveIntent(intentID, approved)
	if err != nil {
		return nil, err
	}
	if approved {
		if write, _ := result["writePty"].(bool); write {
			if cmd, ok := result["command"].(string); ok {
				if sid, ok := result["sessionId"].(string); ok && sid != "" {
					_ = a.pty.Write(sid, []byte(cmd+"\n"))
				}
			}
		}
	}
	return result, nil
}
