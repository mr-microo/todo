const priorityRank = { High: 0, Medium: 1, Low: 2 };
const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
const timestampLabel = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function button(label, className, title, onClick) {
  const el = document.createElement("button");
  el.type = "button"; el.className = `icon-button ${className}`; el.textContent = label; el.title = title; el.setAttribute("aria-label", title); el.addEventListener("click", onClick);
  return el;
}

export function renderTasks(tasks, elements, state, actions) {
  const { list, pendingCount, completedCount, visibleCount, summary } = elements;
  pendingCount.textContent = tasks.filter((t) => !t.completed).length;
  completedCount.textContent = tasks.filter((t) => t.completed).length;
  const term = state.search.trim().toLocaleLowerCase();
  let visible = tasks.filter((task) => {
    const matchesStatus = state.filter === "all" || (state.filter === "completed" ? task.completed : !task.completed);
    const matchesPriority = state.priority === "all" || task.priority === state.priority;
    return matchesStatus && matchesPriority && (!term || task.title.toLocaleLowerCase().includes(term));
  });
  visible.sort((a, b) => {
    if (state.sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority] || new Date(b.created_at) - new Date(a.created_at);
    if (state.sort === "due") return (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  visibleCount.textContent = visible.length;
  summary.textContent = tasks.length ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} in your space` : "A fresh start";
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div"); empty.className = "empty-state";
    const mark = document.createElement("span"); mark.className = "empty-mark"; mark.textContent = tasks.length ? "⌕" : "✳";
    const title = document.createElement("strong"); title.textContent = tasks.length ? "Nothing here yet" : "A clear little canvas";
    const copy = document.createElement("span"); copy.textContent = tasks.length ? "Try another filter or search." : "Add a task when something comes to mind.";
    empty.append(mark, title, copy); list.append(empty); return;
  }
  visible.forEach((task, index) => {
    const row = document.createElement("article"); row.className = `task-row${task.completed ? " completed" : ""}`; row.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "check-button"; toggle.setAttribute("aria-pressed", String(task.completed)); toggle.setAttribute("aria-label", task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`); toggle.addEventListener("click", () => actions.toggle(task));
    const main = document.createElement("div"); main.className = "task-main";
    const title = document.createElement("div"); title.className = "task-title"; title.textContent = task.title; main.append(title);
    if (task.description) { const desc = document.createElement("p"); desc.className = "task-description"; desc.textContent = task.description; main.append(desc); }
    const meta = document.createElement("div"); meta.className = "task-meta";
    const priority = document.createElement("span"); priority.className = `priority-badge priority-${task.priority.toLowerCase()}`; priority.textContent = task.priority; meta.append(priority);
    if (task.due_date) { const due = document.createElement("span"); const overdue = !task.completed && new Date(task.due_date) < new Date(); due.className = `due-badge${overdue ? " overdue" : ""}`; due.textContent = `Due ${dateLabel(task.due_date)}${overdue ? " · overdue" : ""}`; meta.append(due); }
    const created = document.createElement("span"); created.className = "meta-date"; created.textContent = `Added ${timestampLabel(task.created_at)} | Updated ${timestampLabel(task.updated_at)}`; meta.append(created); main.append(meta);
    const actionsBox = document.createElement("div"); actionsBox.className = "task-actions"; actionsBox.append(button("↗", "edit-task", "Edit task", () => actions.edit(task)), button("×", "delete-task", "Delete task", () => actions.remove(task)));
    row.append(toggle, main, actionsBox); list.append(row);
  });
}
