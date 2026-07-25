#!/usr/bin/env node
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin });
const buffers = new Map();

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
  if (msg.method === "onOutput") {
    const { sessionId, data } = msg.params || {};
    const prev = buffers.get(sessionId) || "";
    const next = (prev + data).slice(-4000);
    buffers.set(sessionId, next);

    if (/error:|failed|ENOENT|permission denied/i.test(data)) {
      emit("notify", sessionId, {
        title: "Demo Hook",
        message: "Looks like an error appeared in the terminal.",
        level: "warning",
      });
      emit("animate", sessionId, { state: "action_required" });
    }
    if (/tests?\s+passed|build succeeded|✓|done\./i.test(data)) {
      emit("notify", sessionId, {
        title: "Demo Hook",
        message: "Task looks complete.",
        level: "success",
      });
      emit("animate", sessionId, { state: "task_complete" });
    }
    if (/password:|\[Y\/n\]|Overwrite\?/i.test(data)) {
      emit("animate", sessionId, { state: "action_required" });
      emit("suggest", sessionId, {
        text: "Input may be required in this terminal.",
      });
    }
  }
  if (msg.method === "onExit") {
    buffers.delete(msg.params?.sessionId);
  }
});
