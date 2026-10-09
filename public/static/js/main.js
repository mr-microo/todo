import { api } from "./api.js";
import { renderTasks } from "./tasks.js";
import { initScene } from "./scene.js";

const $ = (selector) => document.querySelector(selector);
const state = { tasks: [], filter: "all", priority: "all", search: "", sort: "created", editing: null, saving: false };
const elements = { list: $("#task-list"), pendingCount: $("#pending-count"), completedCount: $("#completed-count"), visibleCount: $("#visible-count"), summary: $("#list-summary") };
const form = $("#task-form"), titleInput = $("#task-title"), notice = $("#notice"), saveButton = $("#save-task");
let noticeTimer;

function showNotice(message, type = "error") { notice.textContent = message; notice.className = `notice ${type}`; notice.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000); }
function localDateTimeValue(value) { const date = new Date(value); const pad = (part) => String(part).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function paint() { renderTasks(state.tasks, elements, state, { toggle: toggleTask, edit: editTask, remove: deleteTask }); }
async function refresh() { elements.list.innerHTML = '<div class="loading-state"><span class="spinner"></span> Finding your focus...</div>'; try { state.tasks = await api.list(); paint(); } catch (error) { elements.list.replaceChildren(); showNotice(error.message); elements.list.innerHTML = '<div class="empty-state"><span class="empty-mark">!</span><strong>Couldn’t load your tasks</strong><span>Refresh the page to try again.</span></div>'; } }
function resetForm() { state.editing = null; form.reset(); $("#form-title").textContent = "Add a task"; saveButton.innerHTML = 'Save task <span>↗</span>'; form.hidden = true; }
function editTask(task) { state.editing = task.id; $("#form-title").textContent = "Edit task"; titleInput.value = task.title; $("#task-description").value = task.description || ""; $("#task-priority").value = task.priority; $("#task-due").value = task.due_date ? localDateTimeValue(task.due_date) : ""; form.hidden = false; titleInput.focus(); form.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
async function toggleTask(task) { try { const updated = await api.update(task.id, { completed: !task.completed }); state.tasks = state.tasks.map((item) => item.id === updated.id ? updated : item); paint(); } catch (error) { showNotice(error.message); } }
async function deleteTask(task) { const dialog = $("#confirm-dialog"); if (!dialog.showModal) { if (!window.confirm(`Delete “${task.title}”?`)) return; } else { dialog.showModal(); if (await new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true })) !== "delete") return; } try { await api.remove(task.id); state.tasks = state.tasks.filter((item) => item.id !== task.id); paint(); showNotice("Task deleted.", "success"); } catch (error) { showNotice(error.message); } }

$("#open-form").addEventListener("click", () => { resetForm(); form.hidden = false; titleInput.focus(); });
$("#close-form").addEventListener("click", resetForm); $("#cancel-form").addEventListener("click", resetForm);
form.addEventListener("submit", async (event) => { event.preventDefault(); if (state.saving) return; const data = { title: titleInput.value, description: $("#task-description").value, priority: $("#task-priority").value, due_date: $("#task-due").value || null }; state.saving = true; saveButton.disabled = true; saveButton.textContent = "Saving…"; try { if (state.editing) { const updated = await api.update(state.editing, data); state.tasks = state.tasks.map((task) => task.id === updated.id ? updated : task); showNotice("Changes saved.", "success"); } else { const created = await api.create(data); state.tasks.unshift(created); showNotice("Task added.", "success"); } resetForm(); paint(); } catch (error) { showNotice(error.message); } finally { state.saving = false; saveButton.disabled = false; saveButton.innerHTML = state.editing ? 'Save changes <span>↗</span>' : 'Save task <span>↗</span>'; } });
document.querySelectorAll(".filter-tab").forEach((tab) => tab.addEventListener("click", () => { document.querySelector(".filter-tab.active")?.classList.remove("active"); tab.classList.add("active"); state.filter = tab.dataset.filter; paint(); }));
$("#priority-filter").addEventListener("change", (event) => { state.priority = event.target.value; paint(); }); $("#sort-select").addEventListener("change", (event) => { state.sort = event.target.value; paint(); }); $("#search-input").addEventListener("input", (event) => { state.search = event.target.value; paint(); });
$("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
refresh();
initScene().then((disposeScene) => window.addEventListener("pagehide", disposeScene, { once: true }));
