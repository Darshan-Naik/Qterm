package ptyemit

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPushImmediateFlushesNow(t *testing.T) {
	var got atomic.Value
	var n atomic.Int32
	c := New(func(sessionID string, data []byte) {
		n.Add(1)
		got.Store(append([]byte(nil), data...))
	})
	c.Push("s1", []byte("a"))
	c.PushImmediate("s1", []byte("\x1b[6n"))
	deadline := time.Now().Add(50 * time.Millisecond)
	for time.Now().Before(deadline) {
		if n.Load() >= 1 {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if n.Load() != 1 {
		t.Fatalf("flushes=%d", n.Load())
	}
	out, _ := got.Load().([]byte)
	if string(out) != "a\x1b[6n" {
		t.Fatalf("got %q", out)
	}
}

func TestPushBatchesUntilInterval(t *testing.T) {
	var n atomic.Int32
	var mu sync.Mutex
	var payloads []string
	c := New(func(sessionID string, data []byte) {
		n.Add(1)
		mu.Lock()
		payloads = append(payloads, string(data))
		mu.Unlock()
	})
	c.Push("s1", []byte("a"))
	c.Push("s1", []byte("b"))
	if n.Load() != 0 {
		t.Fatal("must not flush before interval")
	}
	time.Sleep(flushInterval + 30*time.Millisecond)
	if n.Load() != 1 {
		t.Fatalf("flushes=%d", n.Load())
	}
	mu.Lock()
	defer mu.Unlock()
	if len(payloads) != 1 || payloads[0] != "ab" {
		t.Fatalf("payloads=%v", payloads)
	}
}
