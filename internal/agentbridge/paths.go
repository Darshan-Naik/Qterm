package agentbridge

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"

	"qterm/internal/appmode"
)

const (
	HookMarker = "qterm-agent-bridge"
)

// DefaultPort is the HTTP bridge listen port. Dev builds use a different port
// so wails dev and the packaged app can run side by side.
var DefaultPort = appmode.BridgePort

type EndpointFile struct {
	URL   string `json:"url"`
	Token string `json:"token"`
	Port  int    `json:"port"`
}

func Dir(dataDir string) string {
	dir := filepath.Join(dataDir, "agent")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func EndpointPath(dataDir string) string {
	return filepath.Join(Dir(dataDir), "bridge.json")
}

func TokenPath(dataDir string) string {
	return filepath.Join(Dir(dataDir), "token")
}

func ScriptsDir(dataDir string) string {
	dir := filepath.Join(Dir(dataDir), "scripts")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func LoadOrCreateToken(dataDir string) (string, error) {
	path := TokenPath(dataDir)
	if b, err := os.ReadFile(path); err == nil {
		t := string(b)
		if len(t) >= 16 {
			return t, nil
		}
	}
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	t := hex.EncodeToString(buf)
	if err := os.WriteFile(path, []byte(t), 0o600); err != nil {
		return "", err
	}
	return t, nil
}

func WriteEndpoint(dataDir string, port int, token string) error {
	ep := EndpointFile{
		URL:   "http://127.0.0.1:" + itoa(port),
		Token: token,
		Port:  port,
	}
	data, err := json.MarshalIndent(ep, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(EndpointPath(dataDir), data, 0o600)
}

func ReadEndpoint(dataDir string) (EndpointFile, error) {
	var ep EndpointFile
	b, err := os.ReadFile(EndpointPath(dataDir))
	if err != nil {
		return ep, err
	}
	err = json.Unmarshal(b, &ep)
	return ep, err
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
