#!/usr/bin/env node
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
const seen = new Set();

function emit(type, sessionId, payload) {
  process.stdout.write(
    JSON.stringify({
      method: "emit",
      params: { type, sessionId, payload },
    }) + "\n"
  );
}

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (msg.method === "onActivate") {
    emit("notify", "", {
      title: "Claude Hook",
      message: "Agent hook active — watching terminals for help opportunities.",
      level: "info",
    });
  }

  if (msg.method === "onOutput") {
    const { sessionId, data } = msg.params || {};
    emit("animate", sessionId, { state: "thinking" });

    if (/command not found|not found:/i.test(data)) {
      const key = `${sessionId}:notfound`;
      if (!seen.has(key)) {
        seen.add(key);
        emit("notify", sessionId, {
          title: "Claude Hook",
          message: "Command not found — I can suggest a fix.",
          level: "info",
        });
        emit("animate", sessionId, { state: "action_required" });
        emit("request_approval", sessionId, {
          title: "Run help?",
          message: "Approve running `type -a` style inspection?",
          command: "echo 'q-term: try checking PATH or installing the missing tool'",
        });
      }
    }

    if (/error TS\d+|TypeError|ReferenceError/i.test(data)) {
      emit("notify", sessionId, {
        title: "Claude Hook",
        message: "Runtime/type error detected — open the stack and inspect.",
        level: "warning",
      });
      emit("animate", sessionId, { state: "action_required" });
    }

    if (/PASS|✓|successfully/i.test(data)) {
      emit("animate", sessionId, { state: "task_complete" });
      emit("notify", sessionId, {
        title: "Claude Hook",
        message: "Looks successful.",
        level: "success",
      });
    }
  }

  if (msg.method === "onIntentResolved") {
    const approved = msg.params?.approved;
    emit("notify", msg.params?.intent?.sessionId || "", {
      title: "Claude Hook",
      message: approved ? "Action approved." : "Action dismissed.",
      level: approved ? "success" : "info",
    });
  }
});
