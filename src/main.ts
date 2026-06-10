// @ts-nocheck
// Migrated from the original MVP renderer. The next step is to split this into
// typed domain, storage, and view modules without changing behavior.
import "./styles.css";

const STORAGE_KEY = "agent-git:mvp:v1";
    const PREFS_KEY = "agent-git:mvp:prefs:v1";
    const statusLabels = {
      active: "Active",
      blocked: "Blocked",
      paused: "Paused",
      done: "Done"
    };
    const checkpointLabels = {
      planned: "Planned",
      done: "Done",
      current: "HEAD",
      finding: "Finding",
      abandoned: "Abandoned"
    };
    const checkpointMarks = {
      planned: "·",
      done: "✓",
      current: "→",
      finding: "!",
      abandoned: "x"
    };

    const dom = {
      app: document.getElementById("app"),
      saveState: document.getElementById("saveState"),
      sidebarToggle: document.getElementById("sidebarToggle"),
      sidebarRailToggle: document.getElementById("sidebarRailToggle"),
      dateHeading: document.getElementById("dateHeading"),
      daySelect: document.getElementById("daySelect"),
      prevDayBtn: document.getElementById("prevDayBtn"),
      nextDayBtn: document.getElementById("nextDayBtn"),
      todayBtn: document.getElementById("todayBtn"),
      collapseDoneBtn: document.getElementById("collapseDoneBtn"),
      newSnapshotBtn: document.getElementById("newSnapshotBtn"),
      addTaskBtn: document.getElementById("addTaskBtn"),
      addCheckpointBtn: document.getElementById("addCheckpointBtn"),
      forkBtn: document.getElementById("forkBtn"),
      setHeadBtn: document.getElementById("setHeadBtn"),
      sidebarCollapseDoneBtn: document.getElementById("sidebarCollapseDoneBtn"),
      completeTaskBtn: document.getElementById("completeTaskBtn"),
      railAddCheckpointBtn: document.getElementById("railAddCheckpointBtn"),
      railForkBtn: document.getElementById("railForkBtn"),
      railSetHeadBtn: document.getElementById("railSetHeadBtn"),
      exportBtn: document.getElementById("exportBtn"),
      resetBtn: document.getElementById("resetBtn"),
      metricActive: document.getElementById("metricActive"),
      metricHeads: document.getElementById("metricHeads"),
      metricBlocked: document.getElementById("metricBlocked"),
      metricDone: document.getElementById("metricDone"),
      dayList: document.getElementById("dayList"),
      pageTitle: document.getElementById("pageTitle"),
      pageSubtitle: document.getElementById("pageSubtitle"),
      statusStrip: document.getElementById("statusStrip"),
      boardWrap: document.querySelector(".board-wrap"),
      board: document.getElementById("board"),
      toast: document.getElementById("toast")
    };

    let prefs = loadPrefs();
    let state = loadState();
    let inlineEdit = null;
    let statusMenu = null;
    let taskStatusMenu = null;
    let selection = restoreSelection();
    let dragTaskId = null;
    let dragCheckpoint = null;
    let contextMenu = null;
    let imageViewer = null;
    let toastTimer = null;
    let panelClipboard = null;
    const UNDO_LIMIT = 60;
    const undoStack = [];

    applySafetyCopy();
    applyPanelPrefs();
    render();

    dom.sidebarToggle.addEventListener("click", toggleSidebar);
    dom.sidebarRailToggle.addEventListener("click", toggleSidebar);
    dom.daySelect.addEventListener("change", (event) => {
      state.currentDate = event.target.value;
      selection = sanitizeSelection(selection);
      persist();
      render();
    });

    dom.prevDayBtn.addEventListener("click", () => shiftDay(-1));
    dom.nextDayBtn.addEventListener("click", () => shiftDay(1));
    dom.todayBtn.addEventListener("click", openToday);
    dom.collapseDoneBtn.addEventListener("click", toggleCollapseDoneNodes);
    dom.newSnapshotBtn.addEventListener("click", () => createDailySnapshot(getLocalDate()));
    dom.addTaskBtn.addEventListener("click", addTask);
    dom.addCheckpointBtn.addEventListener("click", () => addCheckpointFromSelection(false));
    dom.forkBtn.addEventListener("click", () => addCheckpointFromSelection(true));
    dom.setHeadBtn.addEventListener("click", setSelectedHead);
    dom.sidebarCollapseDoneBtn.addEventListener("click", toggleCollapseDoneNodes);
    dom.completeTaskBtn.addEventListener("click", completeSelectedTask);
    dom.railAddCheckpointBtn.addEventListener("click", () => addCheckpointFromSelection(false));
    dom.railForkBtn.addEventListener("click", () => addCheckpointFromSelection(true));
    dom.railSetHeadBtn.addEventListener("click", setSelectedHead);
    dom.exportBtn.addEventListener("click", exportJson);
    dom.resetBtn.addEventListener("click", resetDemo);
    dom.boardWrap.addEventListener("contextmenu", openBlankContextMenu);
    dom.boardWrap.addEventListener("click", clearSelectionFromBlankClick);
    dom.boardWrap.addEventListener("dragover", handleBoardTaskDragOver);
    dom.boardWrap.addEventListener("drop", handleBoardTaskDrop);
    dom.boardWrap.addEventListener("dragleave", handleBoardTaskDragLeave);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (imageViewer) {
          event.preventDefault();
          closeImageViewer();
          return;
        }
        if (contextMenu) {
          event.preventDefault();
          closeContextMenu(true);
          return;
        }
        if (taskStatusMenu) {
          event.preventDefault();
          closeTaskStatusMenu(true);
          return;
        }
        if (statusMenu) {
          event.preventDefault();
          closeStatusMenu(true);
          return;
        }
      }
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const isModifierShortcut = event.ctrlKey || event.metaKey;
      if (isModifierShortcut && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLastAction();
        return;
      }
      if (isModifierShortcut && key === "c") {
        event.preventDefault();
        copySelectedPanel();
        return;
      }
      if (isModifierShortcut && key === "v") {
        return;
      }
      if (isShortcutControlTarget(event.target)) return;
      if (isModifierShortcut && event.key === "Enter") {
        event.preventDefault();
        addCheckpointFromSelection(true);
        return;
      }
      if (isModifierShortcut && (event.code === "BracketRight" || event.key === "]")) {
        event.preventDefault();
        changeSelectedCheckpointIndent(1);
        return;
      }
      if (isModifierShortcut && (event.code === "BracketLeft" || event.key === "[")) {
        event.preventDefault();
        changeSelectedCheckpointIndent(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        addCheckpointFromSelection(false);
      }
      if (event.key === " ") {
        event.preventDefault();
        startInlineEdit();
      }
    });

    document.addEventListener("paste", handleDocumentPaste);

    document.addEventListener("click", (event) => {
      if (contextMenu && !event.target.closest(".context-menu")) {
        closeContextMenu();
      }
      if (taskStatusMenu && !event.target.closest(".task-status-popover") && !event.target.closest(".task-status-button")) {
        closeTaskStatusMenu();
      }
      if (!statusMenu) return;
      if (event.target.closest(".status-popover") || event.target.closest(".marker")) return;
      closeStatusMenu();
    });

    document.addEventListener("contextmenu", (event) => {
      if (!contextMenu || dom.boardWrap.contains(event.target)) return;
      closeContextMenu();
    });
    window.addEventListener("resize", closeContextMenu);
    dom.boardWrap.addEventListener("scroll", closeContextMenu);

    function uid(prefix) {
      return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function domId(prefix, ...parts) {
      return [prefix, ...parts].join("-").replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function getTaskStatusMenuId(taskId) {
      return domId("task-status-menu", taskId);
    }

    function getCheckpointStatusMenuId(taskId, checkpointId) {
      return domId("checkpoint-status-menu", taskId, checkpointId);
    }

    function getLocalDate(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function loadPrefs() {
      try {
        const saved = JSON.parse(localStorage.getItem(PREFS_KEY));
        return {
          sidebarOpen: saved?.sidebarOpen ?? true,
          foldedDoneBefore: normalizeFoldedDonePrefs(saved?.foldedDoneBefore)
        };
      } catch {
        return {
          sidebarOpen: true,
          foldedDoneBefore: {}
        };
      }
    }

    function normalizeFoldedDonePrefs(value) {
      if (!value || typeof value !== "object") return {};
      return Object.fromEntries(Object.entries(value)
        .map(([taskId, checkpointIds]) => [taskId, Array.isArray(checkpointIds) ? Array.from(new Set(checkpointIds.filter(Boolean))) : []])
        .filter(([, checkpointIds]) => checkpointIds.length));
    }

    function getFoldedDoneBeforeSet(taskId) {
      return new Set(prefs.foldedDoneBefore?.[taskId] || []);
    }

    function hasFoldedDoneNodes() {
      return Object.values(prefs.foldedDoneBefore || {})
        .some((checkpointIds) => Array.isArray(checkpointIds) && checkpointIds.length);
    }

    function isDoneBeforeFolded(taskId, checkpointId) {
      return getFoldedDoneBeforeSet(taskId).has(checkpointId);
    }

    function updateFoldedDoneBefore(taskId, checkpointIds) {
      prefs.foldedDoneBefore = normalizeFoldedDonePrefs({
        ...(prefs.foldedDoneBefore || {}),
        [taskId]: Array.from(checkpointIds)
      });
    }

    function getRawDoneRunThrough(task, checkpointId) {
      const anchorIndex = task?.checkpoints?.findIndex((checkpoint) => checkpoint.id === checkpointId) ?? -1;
      if (anchorIndex < 0 || task.checkpoints[anchorIndex].state !== "done") return [];
      const run = [];
      for (let index = anchorIndex; index >= 0; index -= 1) {
        const checkpoint = task.checkpoints[index];
        if (checkpoint.state !== "done") break;
        run.unshift(checkpoint);
      }
      return run;
    }

    function getVisibleDoneRunThrough(task, checkpointId, hiddenIds = getHiddenDoneCheckpointIds(task)) {
      hiddenIds = new Set(hiddenIds);
      hiddenIds.delete(checkpointId);
      const visibleCheckpoints = (task?.checkpoints || []).filter((checkpoint) => !hiddenIds.has(checkpoint.id));
      const anchorIndex = visibleCheckpoints.findIndex((checkpoint) => checkpoint.id === checkpointId);
      if (anchorIndex < 0 || visibleCheckpoints[anchorIndex].state !== "done") return [];
      const run = [];
      for (let index = anchorIndex; index >= 0; index -= 1) {
        const checkpoint = visibleCheckpoints[index];
        if (checkpoint.state !== "done") break;
        run.unshift(checkpoint);
      }
      return run;
    }

    function getFoldedDoneGroups(task) {
      const candidates = (prefs.foldedDoneBefore?.[task.id] || [])
        .map((anchorId) => ({
          anchorId,
          anchorIndex: task.checkpoints.findIndex((checkpoint) => checkpoint.id === anchorId),
          checkpoints: getRawDoneRunThrough(task, anchorId)
        }))
        .filter(({ anchorIndex, checkpoints }) => anchorIndex >= 0 && checkpoints.length && !hasInlineEditInCheckpoints(task, checkpoints));
      return candidates
        .filter((candidate) => !candidates.some((other) => {
          if (other === candidate || other.anchorIndex <= candidate.anchorIndex) return false;
          const otherCheckpointIds = new Set(other.checkpoints.map((checkpoint) => checkpoint.id));
          return candidate.checkpoints.every((checkpoint) => otherCheckpointIds.has(checkpoint.id));
        }))
        .sort((a, b) => a.anchorIndex - b.anchorIndex);
    }

    function getHiddenDoneCheckpointIds(task, exceptAnchorId = null) {
      const hiddenIds = new Set();
      getFoldedDoneGroups(task).forEach((group) => {
        if (group.anchorId === exceptAnchorId) return;
        group.checkpoints.forEach((checkpoint) => hiddenIds.add(checkpoint.id));
      });
      if (exceptAnchorId) hiddenIds.delete(exceptAnchorId);
      return hiddenIds;
    }

    function hasInlineEditInCheckpoints(task, checkpoints) {
      return inlineEdit?.type === "checkpoint"
        && inlineEdit.taskId === task.id
        && checkpoints.some((checkpoint) => checkpoint.id === inlineEdit.checkpointId);
    }

    function canFoldDoneThrough(task, checkpointId) {
      const run = getVisibleDoneRunThrough(task, checkpointId);
      return run.length > 0
        && !isDoneBeforeFolded(task.id, checkpointId)
        && !hasInlineEditInCheckpoints(task, run);
    }

    function getFoldedGroupForHiddenDone(task, checkpointId) {
      return getFoldedDoneGroups(task)
        .find((group) => group.checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) || null;
    }

    function getSelectionAfterFoldedGroup(task, group) {
      const hiddenIds = getHiddenDoneCheckpointIds(task);
      const nextVisibleCheckpoint = task.checkpoints
        .slice(group.anchorIndex + 1)
        .find((checkpoint) => !hiddenIds.has(checkpoint.id));
      return nextVisibleCheckpoint
        ? { type: "checkpoint", taskId: task.id, checkpointId: nextVisibleCheckpoint.id }
        : { type: "task", taskId: task.id };
    }

    function getFoldedDoneGroupAt(task, startIndex) {
      const checkpoint = task.checkpoints[startIndex];
      if (!checkpoint || checkpoint.state !== "done") return null;
      return getFoldedDoneGroups(task)
        .find((group) => group.checkpoints[0]?.id === checkpoint.id) || null;
    }

    function setDoneThroughFolded(taskId, checkpointId) {
      const task = state.tasks[taskId];
      const run = getRawDoneRunThrough(task, checkpointId);
      const visibleRun = getVisibleDoneRunThrough(task, checkpointId);
      if (!run.length || !visibleRun.length) {
        showToast("No done nodes to fold.");
        return;
      }
      const folded = getFoldedDoneBeforeSet(taskId);
      const hiddenIds = new Set(run.map((checkpoint) => checkpoint.id));
      hiddenIds.forEach((hiddenId) => folded.delete(hiddenId));
      folded.add(checkpointId);
      updateFoldedDoneBefore(taskId, folded);
      statusMenu = null;
      persistPrefs();
      applyPanelPrefs();
      const foldedGroup = getFoldedDoneGroups(task).find((group) => group.anchorId === checkpointId);
      if (foldedGroup && selection?.type === "checkpoint" && selection.taskId === taskId && hiddenIds.has(selection.checkpointId)) {
        selection = getSelectionAfterFoldedGroup(task, foldedGroup);
      } else if (foldedGroup) {
        selection = getSelectionAfterFoldedGroup(task, foldedGroup);
      }
      render();
      showToast(run.length === 1 ? "1 done node folded." : `${run.length} done nodes folded.`);
    }

    function clearDoneThroughFolded(taskId, checkpointId) {
      const folded = getFoldedDoneBeforeSet(taskId);
      folded.delete(checkpointId);
      updateFoldedDoneBefore(taskId, folded);
      persistPrefs();
      applyPanelPrefs();
    }

    function persistPrefs() {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }

    function applySafetyCopy() {
      const undoHint = "Press Ctrl+Z to undo the last in-session change.";
      dom.saveState.title = `Saved locally. ${undoHint}`;
      dom.addTaskBtn.title = `Add a task. ${undoHint}`;
      dom.addTaskBtn.setAttribute("aria-label", "Add task");
      dom.newSnapshotBtn.textContent = "Open Today";
      dom.newSnapshotBtn.title = `Open or create today's snapshot. ${undoHint}`;
      dom.addCheckpointBtn.title = `Add checkpoint after the selected target (Enter). ${undoHint}`;
      dom.forkBtn.title = `Fork from the selected checkpoint (Ctrl+Enter). ${undoHint}`;
      dom.setHeadBtn.title = `Set the selected checkpoint as HEAD. ${undoHint}`;
      dom.completeTaskBtn.title = `Mark the selected task complete. ${undoHint}`;
      dom.railAddCheckpointBtn.title = `Add checkpoint after the selected target (Enter). ${undoHint}`;
      dom.railAddCheckpointBtn.setAttribute("aria-label", "Add checkpoint after selected target");
      dom.railForkBtn.title = `Fork from the selected checkpoint (Ctrl+Enter). ${undoHint}`;
      dom.railForkBtn.setAttribute("aria-label", "Fork from selected checkpoint");
      dom.railSetHeadBtn.title = `Set the selected checkpoint as HEAD. ${undoHint}`;
      dom.railSetHeadBtn.setAttribute("aria-label", "Set selected checkpoint as HEAD");
      dom.exportBtn.textContent = "Export Backup JSON";
      dom.exportBtn.title = "Download a JSON backup of all local Agent-Git data before risky changes.";
      dom.exportBtn.setAttribute("aria-label", "Export backup JSON");
      dom.resetBtn.title = `Reset demo data after confirmation. ${undoHint}`;
    }

    function applyPanelPrefs() {
      dom.app.classList.toggle("sidebar-open", prefs.sidebarOpen);
      dom.sidebarToggle.title = prefs.sidebarOpen ? "Collapse left panel" : "Open left panel";
      dom.sidebarToggle.setAttribute("aria-label", dom.sidebarToggle.title);
      const hasFolds = hasFoldedDoneNodes();
      const doneLabel = hasFolds ? "Show Done" : "Done Folds";
      const doneTitle = hasFolds
        ? "Show all folded completed nodes"
        : "Hover a checkpoint marker to fold the completed nodes before it";
      [dom.collapseDoneBtn, dom.sidebarCollapseDoneBtn].forEach((button) => {
        button.textContent = doneLabel;
        button.title = doneTitle;
        button.setAttribute("aria-label", doneTitle);
        button.classList.toggle("active", hasFolds);
      });
    }

    function toggleSidebar() {
      prefs.sidebarOpen = !prefs.sidebarOpen;
      persistPrefs();
      applyPanelPrefs();
    }

    function toggleCollapseDoneNodes() {
      if (!hasFoldedDoneNodes()) {
        showToast("Hover a step marker to fold the done nodes before it.");
        return;
      }
      prefs.foldedDoneBefore = {};
      persistPrefs();
      applyPanelPrefs();
      render();
      showToast("Done nodes shown.");
    }

    function loadState() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (parsed && parsed.days && parsed.tasks && parsed.currentDate) {
          return parsed;
        }
      } catch (error) {
        console.warn("Agent-Git local state could not be parsed.", error);
      }
      return seedState();
    }

    function seedState() {
      const today = getLocalDate();
      const tasks = {};
      const day = { date: today, taskIds: [], createdAt: nowIso() };

      [
        {
          title: "Open Source Launch",
          goal: "Prepare a clean public repository and first tagged build.",
          status: "active",
          next: "Run the release checklist and publish notes.",
          checkpoints: [
            ["Audit local-only files", "done"],
            ["Sanitize demo data", "done"],
            ["Prepare first public tag", "current"],
            ["Draft release notes", "planned"]
          ]
        },
        {
          title: "Daily Recovery Flow",
          goal: "Make the morning resume path easier to scan.",
          status: "active",
          next: "Compare yesterday and today HEAD labels.",
          checkpoints: [
            ["Map current resume steps", "done"],
            ["Reduce old checkpoint noise", "current"],
            ["Test keyboard-only flow", "planned"]
          ]
        },
        {
          title: "Attachment Handling",
          goal: "Keep screenshot and image evidence local and easy to open.",
          status: "blocked",
          next: "Decide the safest import/export format.",
          checkpoints: [
            ["Paste image into checkpoint", "done"],
            ["Store file under app userData", "finding"],
            ["Design export backup story", "current"]
          ]
        },
        {
          title: "Branch View Polish",
          goal: "Clarify forked checkpoint lines without adding project-management complexity.",
          status: "paused",
          next: "Revisit after core task editing stabilizes.",
          checkpoints: [
            ["Sketch branch depth rules", "current"]
          ]
        }
      ].forEach((taskSeed) => {
        const task = createTaskRecord(taskSeed);
        tasks[task.id] = task;
        day.taskIds.push(task.id);
      });

      return {
        currentDate: today,
        days: { [today]: day },
        tasks
      };
    }

    function createTaskRecord(input = {}) {
      const taskId = uid("task");
      const checkpoints = (input.checkpoints || [["Define first checkpoint", "current"]]).map((item, index) => ({
        id: uid("cp"),
        text: item[0],
        state: item[1] || "planned",
        branchFrom: null,
        depth: 0,
        createdAt: nowIso(),
        order: index
      }));

      return {
        id: taskId,
        title: input.title || "New Task",
        goal: input.goal || "",
        status: input.status || "active",
        next: input.next || "",
        checkpoints,
        createdAt: nowIso()
      };
    }

    function persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      sessionStorage.setItem(`${STORAGE_KEY}:selection`, JSON.stringify(selection));
      dom.saveState.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      dom.saveState.title = "Saved locally. Press Ctrl+Z to undo the last in-session change.";
    }

    function clonePlain(value) {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function rememberUndo() {
      undoStack.push({
        state: clonePlain(state),
        selection: clonePlain(selection)
      });
      if (undoStack.length > UNDO_LIMIT) {
        undoStack.shift();
      }
    }

    function undoLastAction() {
      const snapshot = undoStack.pop();
      if (!snapshot) {
        showToast("Nothing to undo.");
        return;
      }
      state = snapshot.state;
      selection = sanitizeSelection(snapshot.selection, true);
      inlineEdit = null;
      statusMenu = null;
      taskStatusMenu = null;
      closeContextMenu();
      render();
      showToast("Undone.");
    }

    function copySelectedPanel() {
      const selected = getSelected();
      if (!selected?.task) {
        showToast("Select a panel to copy.");
        return;
      }
      panelClipboard = clonePlain(selected.task);
      showToast(`Copied ${selected.task.title || "panel"}.`);
    }

    function pasteCopiedPanel() {
      const day = currentDay();
      if (!day) return;
      if (!panelClipboard) {
        showToast("Copy a panel first.");
        return;
      }

      rememberUndo();
      const task = clonePanelForPaste(panelClipboard);
      state.tasks[task.id] = task;
      const selectedIndex = selection?.taskId ? day.taskIds.indexOf(selection.taskId) : -1;
      const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : day.taskIds.length;
      day.taskIds.splice(insertIndex, 0, task.id);
      selection = { type: "task", taskId: task.id };
      inlineEdit = null;
      statusMenu = null;
      taskStatusMenu = null;
      closeContextMenu();
      render();
      showToast(`Pasted ${task.title || "panel"}.`);
    }

    function clonePanelForPaste(task) {
      const nextTaskId = uid("task");
      const idMap = new Map();
      const checkpoints = (task.checkpoints || []).map((checkpoint, index) => {
        const nextId = uid("cp");
        idMap.set(checkpoint.id, nextId);
        return {
          ...checkpoint,
          id: nextId,
          createdAt: nowIso(),
          order: index
        };
      });
      checkpoints.forEach((checkpoint) => {
        checkpoint.branchFrom = checkpoint.branchFrom ? idMap.get(checkpoint.branchFrom) || null : null;
      });
      return {
        ...task,
        id: nextTaskId,
        title: `${task.title || "Untitled Task"} Copy`,
        status: task.status || "active",
        checkpoints,
        createdAt: nowIso()
      };
    }

    function restoreSelection() {
      try {
        return sanitizeSelection(JSON.parse(sessionStorage.getItem(`${STORAGE_KEY}:selection`)));
      } catch {
        return null;
      }
    }

    function sanitizeSelection(candidate, allowNull = false) {
      const day = currentDay();
      if (!day) return null;
      if (!candidate) {
        if (allowNull) return null;
        const firstTaskId = day.taskIds[0];
        return firstTaskId ? { type: "task", taskId: firstTaskId } : null;
      }
      if (candidate.type === "task" && day.taskIds.includes(candidate.taskId)) {
        return candidate;
      }
      if (candidate.type === "task-field" && day.taskIds.includes(candidate.taskId) && candidate.field === "next") {
        return candidate;
      }
      if (candidate.type === "checkpoint" && day.taskIds.includes(candidate.taskId)) {
        const task = state.tasks[candidate.taskId];
        if (task && task.checkpoints.some((checkpoint) => checkpoint.id === candidate.checkpointId)) {
          const foldedGroup = getFoldedGroupForHiddenDone(task, candidate.checkpointId);
          if (foldedGroup) {
            return getSelectionAfterFoldedGroup(task, foldedGroup);
          }
          return candidate;
        }
      }
      if (allowNull) return null;
      const firstTaskId = day.taskIds[0];
      return firstTaskId ? { type: "task", taskId: firstTaskId } : null;
    }

    function currentDay() {
      return state.days[state.currentDate];
    }

    function currentTasks() {
      const day = currentDay();
      if (!day) return [];
      return day.taskIds.map((taskId) => state.tasks[taskId]).filter(Boolean);
    }

    function sortedDates() {
      return Object.keys(state.days).sort();
    }

    function render() {
      selection = sanitizeSelection(selection, true);
      if (!isInlineEditValid()) inlineEdit = null;
      if (!isStatusMenuValid()) statusMenu = null;
      if (!isTaskStatusMenuValid()) taskStatusMenu = null;
      renderHeader();
      renderSidebar();
      renderBoard();
      updateCommandState();
      persist();
      if (statusMenu || taskStatusMenu) focusOpenMenuItem();
    }

    function isInlineEditValid() {
      if (!inlineEdit) return true;
      const day = currentDay();
      if (!day || !day.taskIds.includes(inlineEdit.taskId)) return false;
      const task = state.tasks[inlineEdit.taskId];
      if (!task) return false;
      if (inlineEdit.type === "task") return true;
      return task.checkpoints.some((checkpoint) => checkpoint.id === inlineEdit.checkpointId);
    }

    function isStatusMenuValid() {
      if (!statusMenu) return true;
      const day = currentDay();
      if (!day || !day.taskIds.includes(statusMenu.taskId)) return false;
      const task = state.tasks[statusMenu.taskId];
      if (!task) return false;
      return task.checkpoints.some((checkpoint) => checkpoint.id === statusMenu.checkpointId);
    }

    function isTaskStatusMenuValid() {
      if (!taskStatusMenu) return true;
      const day = currentDay();
      return Boolean(day?.taskIds.includes(taskStatusMenu.taskId) && state.tasks[taskStatusMenu.taskId]);
    }

    function renderHeader() {
      const dates = sortedDates();
      const date = state.currentDate;
      dom.dateHeading.textContent = date;
      dom.pageTitle.textContent = `${date} Daily Page`;
      dom.pageSubtitle.textContent = buildSubtitle();
      dom.daySelect.innerHTML = "";
      dates.forEach((dayDate) => {
        const option = document.createElement("option");
        option.value = dayDate;
        option.textContent = dayDate;
        option.selected = dayDate === date;
        dom.daySelect.append(option);
      });
      const index = dates.indexOf(date);
      dom.prevDayBtn.disabled = index <= 0;
      dom.nextDayBtn.disabled = index < 0 || index >= dates.length - 1;
    }

    function renderSidebar() {
      const tasks = currentTasks();
      const counts = getCounts(tasks);
      dom.metricActive.textContent = counts.active;
      dom.metricHeads.textContent = counts.heads;
      dom.metricBlocked.textContent = counts.blocked;
      dom.metricDone.textContent = counts.done;

      dom.dayList.innerHTML = "";
      sortedDates().reverse().forEach((date) => {
        const day = state.days[date];
        const button = document.createElement("button");
        button.className = `day-item${date === state.currentDate ? " active" : ""}`;
        button.type = "button";
        button.addEventListener("click", () => {
          state.currentDate = date;
          selection = sanitizeSelection(selection);
          render();
        });

        const text = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = date;
        const sub = document.createElement("span");
        sub.textContent = `${day.taskIds.length} tasks`;
        text.append(label, sub);

        const count = document.createElement("span");
        count.className = "day-count";
        count.textContent = day.taskIds.length;
        button.append(text, count);
        dom.dayList.append(button);
      });

      renderStatusStrip(counts);
    }

    function renderStatusStrip(counts) {
      dom.statusStrip.innerHTML = "";
      [
        ["active", "Active", counts.active],
        ["blocked", "Blocked", counts.blocked],
        ["paused", "Paused", counts.paused],
        ["done", "Done", counts.done]
      ].forEach(([key, label, value]) => {
        const chip = document.createElement("span");
        chip.className = `chip ${key}`;
        const dot = document.createElement("span");
        dot.className = "chip-dot";
        chip.append(dot, document.createTextNode(`${label} ${value}`));
        dom.statusStrip.append(chip);
      });
    }

    function getCounts(tasks) {
      return {
        active: tasks.filter((task) => task.status === "active").length,
        blocked: tasks.filter((task) => task.status === "blocked").length,
        paused: tasks.filter((task) => task.status === "paused").length,
        done: tasks.filter((task) => task.status === "done").length,
        heads: tasks.reduce((sum, task) => sum + task.checkpoints.filter((checkpoint) => checkpoint.state === "current").length, 0)
      };
    }

    function buildSubtitle() {
      const tasks = currentTasks();
      const unfinished = tasks.filter((task) => task.status !== "done").length;
      if (!tasks.length) return "No task roots in this snapshot.";
      if (!unfinished) return `${tasks.length} task roots complete.`;

      const activeTasks = tasks.filter((task) => task.status !== "done");
      const blocked = activeTasks.filter((task) => task.status === "blocked").length;
      const heads = activeTasks.reduce((sum, task) => sum + (task.checkpoints || []).filter((checkpoint) => checkpoint.state === "current").length, 0);
      const targets = activeTasks
        .map((task) => ({ task, summary: getTaskRecoverySummary(task) }))
        .filter(({ summary }) => summary.target)
        .slice(0, 2)
        .map(({ task, summary }) => `${task.title}: ${summary.targetLabel} ${clipText(summary.target.text, 34)}`);
      const more = activeTasks.length > targets.length ? ` +${activeTasks.length - targets.length} more` : "";
      const blockedText = blocked ? `, ${blocked} blocked` : "";
      const targetText = targets.length ? ` Resume: ${targets.join("; ")}${more}.` : " Add a checkpoint to define a resume target.";
      return `${unfinished} unfinished tasks (${heads} HEAD${heads === 1 ? "" : "s"}${blockedText}).${targetText}`;
    }

    function getTaskRecoverySummary(task) {
      const checkpoints = task.checkpoints || [];
      const head = checkpoints.find((checkpoint) => checkpoint.state === "current") || null;
      const fallbackTarget = checkpoints.find((checkpoint) => checkpoint.state === "finding")
        || checkpoints.find((checkpoint) => checkpoint.state === "planned")
        || checkpoints.find((checkpoint) => checkpoint.state !== "done" && checkpoint.state !== "abandoned")
        || checkpoints[checkpoints.length - 1]
        || null;
      const target = head || fallbackTarget;
      const targetIndex = target ? checkpoints.findIndex((checkpoint) => checkpoint.id === target.id) : -1;
      const nextCheckpoint = targetIndex >= 0
        ? checkpoints.slice(targetIndex + 1).find(isForwardCheckpoint) || null
        : checkpoints.find(isForwardCheckpoint) || null;
      const nextText = task.next
        || nextCheckpoint?.text
        || (target ? "Add the next checkpoint from this recovery point." : "Create a checkpoint to define the recovery point.");

      return {
        head,
        target,
        targetLabel: head ? "HEAD" : target ? checkpointLabels[target.state] : "No target",
        nextCheckpoint,
        nextLabel: task.next ? "Next" : nextCheckpoint ? "Next checkpoint" : "Next",
        nextText
      };
    }

    function isForwardCheckpoint(checkpoint) {
      return checkpoint && checkpoint.state !== "done" && checkpoint.state !== "abandoned" && checkpoint.state !== "current";
    }

    function clipText(value, limit) {
      const text = String(value || "").trim();
      if (text.length <= limit) return text;
      return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
    }

    function confirmDeleteTask(task) {
      const name = clipText(task.title || "Untitled task", 80);
      return window.confirm(`Delete task "${name}" from this snapshot?\n\nUse Ctrl+Z after deleting to undo.`);
    }

    function confirmDeleteCheckpoint(checkpoint) {
      const name = clipText(checkpoint.text || "Untitled checkpoint", 80);
      return window.confirm(`Delete checkpoint "${name}"?\n\nUse Ctrl+Z after deleting to undo.`);
    }

    function focusElement(element) {
      if (!element) return;
      window.setTimeout(() => element.focus({ preventScroll: true }), 0);
    }

    function focusFirstMenuItem(menu) {
      const target = menu?.querySelector?.("[aria-checked='true'], .active, button:not(:disabled)");
      focusElement(target);
    }

    function focusOpenMenuItem() {
      focusFirstMenuItem(contextMenu || document.querySelector(".task-status-popover, .status-popover"));
    }

    function findTaskCard(taskId) {
      return Array.from(dom.board.querySelectorAll(".task-card"))
        .find((card) => card.dataset.taskId === taskId) || null;
    }

    function findCheckpointNode(taskId, checkpointId) {
      return Array.from(dom.board.querySelectorAll(".checkpoint"))
        .find((node) => node.dataset.taskId === taskId && node.dataset.checkpointId === checkpointId) || null;
    }

    function focusTaskStatusTrigger(taskId) {
      focusElement(findTaskCard(taskId)?.querySelector(".task-status-button"));
    }

    function focusCheckpointStatusTrigger(taskId, checkpointId) {
      focusElement(findCheckpointNode(taskId, checkpointId)?.querySelector(".marker"));
    }

    function focusSelectedElement() {
      if (!selection) return;
      if (selection.type === "checkpoint") {
        focusElement(findCheckpointNode(selection.taskId, selection.checkpointId));
        return;
      }
      const card = findTaskCard(selection.taskId);
      if (selection.type === "task-field") {
        focusElement(card?.querySelector(".task-next"));
        return;
      }
      focusElement(card?.querySelector(".task-header"));
    }

    function handleMenuKeydown(event, closeHandler) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeHandler(true);
        return;
      }

      const items = Array.from(event.currentTarget.querySelectorAll("button:not(:disabled)"));
      if (!items.length) return;

      const currentIndex = Math.max(0, items.indexOf(document.activeElement));
      let nextIndex = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % items.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = items.length - 1;
      }

      if (nextIndex == null) return;
      event.preventDefault();
      event.stopPropagation();
      items[nextIndex].focus();
    }

    function openBlankContextMenu(event) {
      event.preventDefault();
      if (event.target.closest(".task-card")) return;
      closeStatusMenu();
      closeTaskStatusMenu();
      inlineEdit = null;

      showContextMenu(event.clientX, event.clientY, [
        {
          label: "New Card",
          action: addTask
        }
      ]);
    }

    function clearSelectionFromBlankClick(event) {
      if (event.target.closest(".task-card") || event.target.closest(".context-menu")) return;
      if (!selection && !inlineEdit && !statusMenu && !taskStatusMenu && !contextMenu) return;
      selection = null;
      inlineEdit = null;
      statusMenu = null;
      taskStatusMenu = null;
      closeContextMenu();
      render();
    }

    function openTaskContextMenu(event, taskId) {
      event.preventDefault();
      event.stopPropagation();
      const checkpointNode = event.target.closest(".checkpoint");
      const checkpointId = checkpointNode?.dataset.taskId === taskId
        ? checkpointNode.dataset.checkpointId
        : selection?.type === "checkpoint" && selection.taskId === taskId
          ? selection.checkpointId
          : null;
      closeStatusMenu();
      closeTaskStatusMenu();
      inlineEdit = null;

      if (!state.tasks[taskId]) return;
      if (checkpointId) {
        openCheckpointContextMenu(event, taskId, checkpointId);
        return;
      }

      selection = { type: "task", taskId };
      render();
      showContextMenu(event.clientX, event.clientY, [
        {
          label: "+ Checkpoint",
          action: () => addCheckpoint(taskId)
        },
        {
          label: "Complete",
          action: () => completeTask(taskId)
        },
        {
          separator: true
        },
        {
          label: "Delete Card...",
          danger: true,
          action: () => deleteTask(taskId)
        }
      ]);
    }

    function openCheckpointContextMenu(event, taskId, checkpointId) {
      const task = state.tasks[taskId];
      const checkpoint = task?.checkpoints.find((item) => item.id === checkpointId);
      if (!task || !checkpoint) return;

      selection = { type: "checkpoint", taskId, checkpointId };
      render();
      showContextMenu(event.clientX, event.clientY, [
        {
          label: "+ Next",
          action: () => addCheckpoint(taskId, checkpointId, false)
        },
        {
          label: "Fork",
          action: () => addCheckpoint(taskId, checkpointId, true)
        },
        {
          label: "Set HEAD",
          action: () => setHead(taskId, checkpointId, true)
        },
        {
          separator: true
        },
        {
          label: "Delete Step...",
          danger: true,
          action: () => deleteCheckpoint(taskId, checkpointId)
        }
      ]);
    }

    function showContextMenu(x, y, items) {
      closeContextMenu();

      const menu = document.createElement("div");
      menu.className = "context-menu";
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", "Board actions");
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.addEventListener("click", (event) => event.stopPropagation());
      menu.addEventListener("contextmenu", (event) => event.preventDefault());
      menu.addEventListener("keydown", (event) => handleMenuKeydown(event, closeContextMenu));

      items.forEach((item) => {
        if (item.separator) {
          const separator = document.createElement("div");
          separator.className = "context-menu-separator";
          separator.setAttribute("role", "separator");
          menu.append(separator);
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = `context-menu-item${item.danger ? " danger" : ""}`;
        button.setAttribute("role", "menuitem");
        button.textContent = item.label;
        button.addEventListener("click", () => {
          closeContextMenu();
          item.action();
        });
        menu.append(button);
      });

      document.body.append(menu);
      const rect = menu.getBoundingClientRect();
      const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
      const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      contextMenu = menu;
      focusFirstMenuItem(menu);
    }

    function closeContextMenu(restoreFocus = false) {
      if (!contextMenu) return;
      contextMenu.remove();
      contextMenu = null;
      if (restoreFocus) focusSelectedElement();
    }

    function handleDocumentPaste(event) {
      const imageFiles = getImageFilesFromTransfer(event.clipboardData);
      if (imageFiles.length) {
        event.preventDefault();
        const target = getCheckpointPasteTarget(event.target);
        if (!target) {
          showToast("Select a step before pasting an image.");
          return;
        }
        addImageFilesToCheckpoint(target.taskId, target.checkpointId, imageFiles);
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (!panelClipboard) return;
      event.preventDefault();
      pasteCopiedPanel();
    }

    function getCheckpointPasteTarget(target) {
      if (inlineEdit?.type === "checkpoint") {
        return {
          taskId: inlineEdit.taskId,
          checkpointId: inlineEdit.checkpointId
        };
      }

      const checkpointNode = target?.closest?.(".checkpoint");
      if (checkpointNode?.dataset.taskId && checkpointNode?.dataset.checkpointId) {
        return {
          taskId: checkpointNode.dataset.taskId,
          checkpointId: checkpointNode.dataset.checkpointId
        };
      }

      const selected = getSelected();
      if (selected?.type !== "checkpoint") return null;
      return {
        taskId: selected.task.id,
        checkpointId: selected.checkpoint.id
      };
    }

    function getImageFilesFromTransfer(dataTransfer) {
      if (!dataTransfer) return [];
      const files = [];
      const seen = new Set();
      Array.from(dataTransfer.items || []).forEach((item) => {
        if (item.kind !== "file" || (item.type && !item.type.startsWith("image/"))) return;
        const file = item.getAsFile();
        if (!isImageFile(file, item.type) || seen.has(file)) return;
        seen.add(file);
        files.push(file);
      });
      if (files.length) return files;
      Array.from(dataTransfer.files || []).forEach((file) => {
        if (!isImageFile(file) || seen.has(file)) return;
        seen.add(file);
        files.push(file);
      });
      return files;
    }

    function isImageFile(file, itemType = "") {
      if (!file) return false;
      if ((file.type || itemType || "").startsWith("image/")) return true;
      return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || "");
    }

    function hasFileDrop(event) {
      if (!event.dataTransfer || dragTaskId || dragCheckpoint) return false;
      return Array.from(event.dataTransfer.types || []).includes("Files");
    }

    async function addImageFilesToCheckpoint(taskId, checkpointId, files) {
      const task = state.tasks[taskId];
      const checkpoint = task?.checkpoints.find((item) => item.id === checkpointId);
      if (!task || !checkpoint || !files.length) return;

      rememberUndo();
      commitActiveInlineEditValue();
      checkpoint.attachments = checkpoint.attachments || [];
      selection = { type: "checkpoint", taskId, checkpointId };
      inlineEdit = null;
      statusMenu = null;
      taskStatusMenu = null;
      closeContextMenu();
      showToast(files.length === 1 ? "Adding image..." : `Adding ${files.length} images...`);

      const attachments = [];
      for (const file of files) {
        const attachment = await createImageAttachment(file);
        if (attachment) attachments.push(attachment);
      }

      if (!attachments.length) {
        const snapshot = undoStack.pop();
        if (snapshot) {
          state = snapshot.state;
          selection = sanitizeSelection(snapshot.selection, true);
        }
        inlineEdit = null;
        render();
        showToast("No image was added.");
        return;
      }

      checkpoint.attachments.push(...attachments);
      persist();
      render();
      showToast(attachments.length === 1 ? "Image added to step." : `${attachments.length} images added to step.`);
    }

    function commitActiveInlineEditValue() {
      if (!inlineEdit) return;
      const input = document.getElementById("inlineEditInput");
      const value = input?.value?.trim?.() || "";
      const task = state.tasks[inlineEdit.taskId];
      if (!task) {
        inlineEdit = null;
        return;
      }
      if (inlineEdit.type === "checkpoint") {
        const checkpoint = task.checkpoints.find((item) => item.id === inlineEdit.checkpointId);
        if (checkpoint) checkpoint.text = value || "Untitled checkpoint";
      } else if (inlineEdit.field === "goal") {
        task.goal = value;
      } else if (inlineEdit.field === "next") {
        task.next = value;
      } else {
        task.title = value || "Untitled Task";
      }
      inlineEdit = null;
    }

    async function createImageAttachment(file) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const thumbnailDataUrl = await createThumbnailDataUrl(dataUrl);
        const saved = await saveAttachmentImage(dataUrl);
        return {
          id: uid("img"),
          name: file.name || "Pasted image",
          mimeType: file.type || getMimeTypeFromDataUrl(dataUrl),
          size: file.size || estimateDataUrlBytes(dataUrl),
          createdAt: nowIso(),
          thumbnailDataUrl,
          filePath: saved?.filePath || null,
          dataUrl: saved?.filePath ? null : dataUrl
        };
      } catch (error) {
        console.warn("Image attachment could not be created.", error);
        return null;
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result));
        reader.addEventListener("error", () => reject(reader.error));
        reader.readAsDataURL(file);
      });
    }

    function createThumbnailDataUrl(dataUrl) {
      return new Promise((resolve) => {
        const image = new Image();
        image.addEventListener("load", () => {
          const maxSide = 520;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
          const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
          const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        });
        image.addEventListener("error", () => resolve(dataUrl));
        image.src = dataUrl;
      });
    }

    async function saveAttachmentImage(dataUrl) {
      if (!window.agentGitAttachments?.saveImage) return null;
      try {
        const result = await window.agentGitAttachments.saveImage({ dataUrl });
        return result?.ok ? result : null;
      } catch (error) {
        console.warn("Attachment image could not be saved to disk.", error);
        return null;
      }
    }

    function getMimeTypeFromDataUrl(dataUrl) {
      return /^data:([^;,]+)/i.exec(dataUrl || "")?.[1] || "image/png";
    }

    function estimateDataUrlBytes(dataUrl) {
      const base64 = String(dataUrl || "").split(",")[1] || "";
      return Math.round((base64.length * 3) / 4);
    }

    function renderCheckpointAttachments(task, checkpoint) {
      const attachments = (checkpoint.attachments || []).filter(Boolean);
      if (!attachments.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "checkpoint-attachments";
      attachments.forEach((attachment) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "checkpoint-attachment";
        button.title = attachment.name || "Open image";
        button.setAttribute("aria-label", `Open image: ${attachment.name || "Pasted image"}`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          openAttachmentViewer(task.id, checkpoint.id, attachment.id);
        });
        button.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          openAttachmentInSystem(attachment);
        });

        const image = document.createElement("img");
        image.src = attachment.thumbnailDataUrl || attachment.dataUrl || "";
        image.alt = attachment.name || "Step image";
        image.loading = "lazy";
        button.append(image);
        wrap.append(button);
      });
      return wrap;
    }

    function openAttachmentViewer(taskId, checkpointId, attachmentId) {
      const task = state.tasks[taskId];
      const checkpoint = task?.checkpoints.find((item) => item.id === checkpointId);
      const attachment = checkpoint?.attachments?.find((item) => item.id === attachmentId);
      if (!attachment) return;

      closeImageViewer();
      const backdrop = document.createElement("div");
      backdrop.className = "image-viewer-backdrop";
      backdrop.addEventListener("click", closeImageViewer);

      const dialog = document.createElement("div");
      dialog.className = "image-viewer-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.addEventListener("click", (event) => event.stopPropagation());

      const toolbar = document.createElement("div");
      toolbar.className = "image-viewer-toolbar";
      const title = document.createElement("div");
      title.className = "image-viewer-title";
      const name = document.createElement("strong");
      name.textContent = attachment.name || "Step image";
      const meta = document.createElement("span");
      meta.textContent = formatAttachmentMeta(attachment);
      title.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "image-viewer-actions";
      const openButton = actionButton("Open", "mini", () => openAttachmentInSystem(attachment));
      const removeButton = actionButton("Remove", "mini danger", () => {
        closeImageViewer();
        removeCheckpointAttachment(taskId, checkpointId, attachmentId);
      });
      const closeButton = actionButton("Close", "mini", closeImageViewer);
      actions.append(openButton, removeButton, closeButton);
      toolbar.append(title, actions);

      const body = document.createElement("div");
      body.className = "image-viewer-body";
      const image = document.createElement("img");
      image.src = attachment.thumbnailDataUrl || attachment.dataUrl || "";
      image.alt = attachment.name || "Step image";
      body.append(image);

      dialog.append(toolbar, body);
      backdrop.append(dialog);
      document.body.append(backdrop);
      imageViewer = { element: backdrop, attachmentId };

      resolveAttachmentImageSource(attachment).then((source) => {
        if (imageViewer?.attachmentId !== attachmentId || !source) return;
        image.src = source;
      });
    }

    function closeImageViewer() {
      if (!imageViewer) return;
      imageViewer.element.remove();
      imageViewer = null;
    }

    async function resolveAttachmentImageSource(attachment) {
      if (attachment.dataUrl) return attachment.dataUrl;
      if (!attachment.filePath || !window.agentGitAttachments?.readImage) {
        return attachment.thumbnailDataUrl || "";
      }
      try {
        const result = await window.agentGitAttachments.readImage({ filePath: attachment.filePath });
        return result?.ok ? result.dataUrl : attachment.thumbnailDataUrl || "";
      } catch (error) {
        console.warn("Attachment image could not be read.", error);
        return attachment.thumbnailDataUrl || "";
      }
    }

    async function openAttachmentInSystem(attachment) {
      if (window.agentGitAttachments?.openImage) {
        try {
          const result = await window.agentGitAttachments.openImage({
            filePath: attachment.filePath,
            dataUrl: attachment.dataUrl,
            name: attachment.name,
            mimeType: attachment.mimeType
          });
          if (result?.ok) return;
          showToast(result?.error || "Could not open image.");
        } catch (error) {
          console.warn("Attachment image could not be opened.", error);
        }
      }

      if (attachment.dataUrl) {
        const url = URL.createObjectURL(dataUrlToBlob(attachment.dataUrl));
        window.open(url, "_blank", "noopener");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    }

    function dataUrlToBlob(dataUrl) {
      const [prefix, base64] = String(dataUrl || "").split(",");
      const mimeType = /^data:([^;,]+)/i.exec(prefix)?.[1] || "image/png";
      const bytes = atob(base64 || "");
      const buffer = new Uint8Array(bytes.length);
      for (let index = 0; index < bytes.length; index += 1) {
        buffer[index] = bytes.charCodeAt(index);
      }
      return new Blob([buffer], { type: mimeType });
    }

    function removeCheckpointAttachment(taskId, checkpointId, attachmentId) {
      const task = state.tasks[taskId];
      const checkpoint = task?.checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint?.attachments?.length) return;
      const nextAttachments = checkpoint.attachments.filter((item) => item.id !== attachmentId);
      if (nextAttachments.length === checkpoint.attachments.length) return;
      rememberUndo();
      checkpoint.attachments = nextAttachments;
      selection = { type: "checkpoint", taskId, checkpointId };
      persist();
      render();
      showToast("Image removed from step.");
    }

    function formatAttachmentMeta(attachment) {
      const parts = [];
      if (attachment.mimeType) parts.push(attachment.mimeType.replace("image/", "").toUpperCase());
      if (attachment.size) parts.push(formatBytes(attachment.size));
      return parts.join(" · ");
    }

    function formatBytes(size) {
      if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      if (size >= 1024) return `${Math.round(size / 1024)} KB`;
      return `${size} B`;
    }

    function renderBoard() {
      const tasks = currentTasks();
      dom.board.innerHTML = "";

      if (!tasks.length) {
        const empty = document.createElement("div");
        empty.className = "empty-board";
        const inner = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = "No task roots";
        const copy = document.createElement("span");
        copy.textContent = "Create a task to start today's map.";
        inner.append(title, copy);
        empty.append(inner);
        dom.board.append(empty);
        return;
      }

      tasks.forEach((task, index) => {
        const taskEditField = inlineEdit?.type === "task" && inlineEdit.taskId === task.id
          ? inlineEdit.field || "title"
          : null;
        const isTaskInlineEditing = Boolean(taskEditField);
        const isTaskHeaderEditing = taskEditField === "title" || taskEditField === "goal";
        const card = document.createElement("article");
        card.className = [
          "task-card",
          task.status,
          selection?.type === "task" && selection.taskId === task.id ? "selected" : ""
        ].filter(Boolean).join(" ");
        card.draggable = !isTaskInlineEditing;
        card.dataset.taskId = task.id;
        card.addEventListener("contextmenu", (event) => openTaskContextMenu(event, task.id), { capture: true });
        card.addEventListener("dblclick", (event) => {
          if (event.target.closest(".checkpoint, .task-status-control, .task-card-actions, .task-next, button, input, textarea, select")) return;
          event.stopPropagation();
          beginTaskFieldEdit(task.id, "title");
        });

        card.addEventListener("dragstart", (event) => {
          dragTaskId = task.id;
          inlineEdit = null;
          closeContextMenu();
          statusMenu = null;
          taskStatusMenu = null;
          selection = { type: "task", taskId: task.id };
          card.classList.add("dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", task.id);
        });
        card.addEventListener("dragend", () => {
          finishTaskDrag();
        });
        card.addEventListener("dragover", (event) => {
          if (!dragTaskId) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          showTaskDropIndicator(card, getTaskDropPlacement(event, card));
        });
        card.addEventListener("drop", (event) => {
          if (!dragTaskId) return;
          event.preventDefault();
          event.stopPropagation();
          const placement = getTaskDropPlacement(event, card);
          const movedTaskId = dragTaskId;
          finishTaskDrag();
          moveTask(movedTaskId, task.id, placement);
        });

        const header = document.createElement("div");
        header.className = `task-header${isTaskHeaderEditing ? " inline-editing" : ""}`;
        if (!isTaskHeaderEditing) {
          header.setAttribute("role", "button");
          header.tabIndex = 0;
          header.addEventListener("click", () => {
            inlineEdit = null;
            selection = { type: "task", taskId: task.id };
            render();
          });
          header.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            selection = { type: "task", taskId: task.id };
            render();
          });
        }

        const topline = document.createElement("div");
        topline.className = "task-topline";
        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = String(index + 1).padStart(2, "0");
        const count = document.createElement("span");
        count.className = "checkpoint-count";
        count.textContent = `${task.checkpoints.length} nodes`;
        const statusControl = document.createElement("span");
        statusControl.className = "task-status-control";
        const isTaskStatusMenuOpen = taskStatusMenu?.taskId === task.id;
        const taskStatusMenuId = getTaskStatusMenuId(task.id);
        const badge = document.createElement("button");
        badge.type = "button";
        badge.className = `badge task-status-button ${task.status}`;
        badge.textContent = statusLabels[task.status];
        badge.title = "Change task status";
        badge.setAttribute("aria-label", `Change task status: ${statusLabels[task.status]}`);
        badge.setAttribute("aria-haspopup", "menu");
        badge.setAttribute("aria-expanded", String(isTaskStatusMenuOpen));
        if (isTaskStatusMenuOpen) {
          badge.setAttribute("aria-controls", taskStatusMenuId);
        }
        badge.addEventListener("click", (event) => {
          event.stopPropagation();
          inlineEdit = null;
          closeStatusMenu();
          closeContextMenu();
          const shouldOpen = !isTaskStatusMenuOpen;
          taskStatusMenu = shouldOpen ? { taskId: task.id } : null;
          selection = { type: "task", taskId: task.id };
          renderBoard();
          updateCommandState();
          if (shouldOpen) {
            focusOpenMenuItem();
          } else {
            focusTaskStatusTrigger(task.id);
          }
        });
        statusControl.append(badge);
        if (isTaskStatusMenuOpen) {
          statusControl.append(renderTaskStatusPopover(task, taskStatusMenuId));
        }
        topline.append(rank, count, statusControl);

        const title = taskEditField === "title"
          ? createInlineTextEditor(task.title, "task-title-editor", (value) => {
              task.title = value || "Untitled Task";
            })
          : document.createElement("h2");
        if (taskEditField !== "title") {
          title.className = "task-title";
          title.textContent = task.title;
          title.title = "Double-click to edit";
          title.addEventListener("dblclick", (event) => {
            event.stopPropagation();
            beginTaskFieldEdit(task.id, "title");
          });
        }
        const goal = taskEditField === "goal"
          ? createInlineTextEditor(task.goal, "task-goal-editor", (value) => {
              task.goal = value;
            })
          : document.createElement("p");
        if (taskEditField !== "goal") {
          goal.className = "task-goal";
          goal.textContent = task.goal || "No goal set.";
          goal.title = "Double-click to edit";
          goal.addEventListener("dblclick", (event) => {
            event.stopPropagation();
            beginTaskFieldEdit(task.id, "goal");
          });
        }

        header.append(topline, title, goal);
        card.append(header, renderTimeline(task));

        const footer = document.createElement("div");
        footer.className = "task-footer";
        const next = document.createElement("div");
        next.className = [
          "task-next",
          selection?.type === "task-field" && selection.taskId === task.id && selection.field === "next" ? "selected" : "",
          taskEditField === "next" ? "inline-editing" : ""
        ].filter(Boolean).join(" ");
        if (taskEditField === "next") {
          next.append(createInlineTextEditor(task.next, "task-next-editor", (value) => {
            task.next = value;
          }));
        } else {
          next.setAttribute("role", "button");
          next.tabIndex = 0;
          const strong = document.createElement("strong");
          strong.textContent = "Next: ";
          next.append(strong, document.createTextNode(task.next || "No next step set."));
          next.title = "Click to select. Press Space or double-click to edit.";
          next.addEventListener("click", (event) => {
            event.stopPropagation();
            inlineEdit = null;
            statusMenu = null;
            taskStatusMenu = null;
            selection = { type: "task-field", taskId: task.id, field: "next" };
            render();
          });
          next.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            beginTaskFieldEdit(task.id, "next");
          });
          next.addEventListener("dblclick", (event) => {
            event.stopPropagation();
            beginTaskFieldEdit(task.id, "next");
          });
        }
        const actions = document.createElement("div");
        actions.className = "task-card-actions";
        actions.append(
          actionButton("Blocked", `mini panel-action panel-blocked${task.status === "blocked" ? " active" : ""}`, () => updateTaskStatus(task.id, "blocked")),
          actionButton("Pause", `mini panel-action panel-paused${task.status === "paused" ? " active" : ""}`, () => updateTaskStatus(task.id, "paused")),
          actionButton("Complete", `mini panel-action panel-complete${task.status === "done" ? " active" : ""}`, () => updateTaskStatus(task.id, "done"))
        );
        footer.append(next, actions);
        card.append(footer);

        dom.board.append(card);
      });
    }

    function renderTaskStatusPopover(task, popoverId) {
      const popover = document.createElement("div");
      popover.className = "task-status-popover";
      popover.id = popoverId;
      popover.setAttribute("role", "menu");
      popover.setAttribute("aria-label", `Task status for ${task.title || "task"}`);
      popover.addEventListener("click", (event) => event.stopPropagation());
      popover.addEventListener("keydown", (event) => handleMenuKeydown(event, closeTaskStatusMenu));

      Object.entries(statusLabels).forEach(([statusKey, label]) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = `task-status-option ${statusKey}${task.status === statusKey ? " active" : ""}`;
        option.textContent = label;
        option.setAttribute("role", "menuitemradio");
        option.setAttribute("aria-checked", String(task.status === statusKey));
        option.addEventListener("click", () => updateTaskStatus(task.id, statusKey));
        popover.append(option);
      });

      return popover;
    }

    function getTaskDropPlacement(event, card) {
      const rect = card.getBoundingClientRect();
      return event.clientX > rect.left + rect.width / 2 ? "after" : "before";
    }

    function showTaskDropIndicator(card, placement) {
      clearTaskDropIndicators();
      if (!dragTaskId || dragTaskId === card.dataset.taskId) return;
      card.classList.add(placement === "after" ? "drop-after" : "drop-before");
    }

    function showTaskDropAtEnd() {
      clearTaskDropIndicators();
      const cards = Array.from(dom.board.querySelectorAll(".task-card"));
      const lastCard = cards[cards.length - 1];
      if (lastCard && lastCard.dataset.taskId !== dragTaskId) {
        lastCard.classList.add("drop-after");
      }
    }

    function clearTaskDropIndicators() {
      dom.board.querySelectorAll(".task-card.drop-before, .task-card.drop-after").forEach((card) => {
        card.classList.remove("drop-before", "drop-after");
      });
    }

    function finishTaskDrag() {
      clearTaskDropIndicators();
      dom.board.querySelectorAll(".task-card.dragging").forEach((card) => {
        card.classList.remove("dragging");
      });
      dragTaskId = null;
    }

    function handleBoardTaskDragOver(event) {
      if (!dragTaskId || event.target.closest(".task-card")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      showTaskDropAtEnd();
    }

    function handleBoardTaskDrop(event) {
      if (!dragTaskId || event.target.closest(".task-card")) return;
      event.preventDefault();
      const movedTaskId = dragTaskId;
      finishTaskDrag();
      moveTaskToIndex(movedTaskId, currentDay().taskIds.length);
    }

    function handleBoardTaskDragLeave(event) {
      if (!dragTaskId || dom.boardWrap.contains(event.relatedTarget)) return;
      clearTaskDropIndicators();
    }

    function updateTaskStatus(taskId, nextStatus) {
      const task = state.tasks[taskId];
      if (!task) return;
      if (task.status === nextStatus) {
        taskStatusMenu = null;
        selection = { type: "task", taskId };
        render();
        return;
      }
      rememberUndo();
      task.status = nextStatus;
      taskStatusMenu = null;
      selection = { type: "task", taskId };
      persist();
      render();
      showToast(`Task marked ${statusLabels[nextStatus]}.`);
    }

    function closeTaskStatusMenu(restoreFocus = false) {
      if (!taskStatusMenu) return;
      const taskId = taskStatusMenu.taskId;
      taskStatusMenu = null;
      renderBoard();
      updateCommandState();
      if (restoreFocus) focusTaskStatusTrigger(taskId);
    }

    function renderTimeline(task) {
      const timeline = document.createElement("div");
      timeline.className = "timeline";

      for (let index = 0; index < task.checkpoints.length; index += 1) {
        const checkpoint = task.checkpoints[index];
        const isCheckpointInlineEditing = inlineEdit?.type === "checkpoint"
          && inlineEdit.taskId === task.id
          && inlineEdit.checkpointId === checkpoint.id;
        const foldedGroup = !isCheckpointInlineEditing ? getFoldedDoneGroupAt(task, index) : null;
        if (foldedGroup) {
          timeline.append(renderDoneCollapseGroup(task, foldedGroup.checkpoints, foldedGroup.anchorId));
          index = foldedGroup.anchorIndex;
          continue;
        }

        const isStatusMenuOpen = statusMenu?.taskId === task.id && statusMenu.checkpointId === checkpoint.id;
        const node = document.createElement("div");
        node.className = [
          "checkpoint",
          checkpoint.state,
          checkpoint.branchFrom ? "branch" : "",
          isCheckpointInlineEditing ? "inline-editing" : "",
          selection?.type === "checkpoint" && selection.checkpointId === checkpoint.id ? "selected" : ""
        ].filter(Boolean).join(" ");
        node.draggable = !isCheckpointInlineEditing;
        node.setAttribute("role", "button");
        node.tabIndex = 0;
        node.dataset.taskId = task.id;
        node.dataset.checkpointId = checkpoint.id;
        node.title = "Click to select. Enter adds next checkpoint. Space edits. Ctrl+] indents; Ctrl+[ outdents.";
        node.setAttribute("aria-label", `${checkpoint.text}. ${checkpointLabels[checkpoint.state]} checkpoint.`);
        if (checkpoint.state === "current") {
          node.setAttribute("aria-current", "step");
        }
        node.style.setProperty("--level", String(Math.min(checkpoint.depth || 0, 3)));

        if (!isCheckpointInlineEditing) {
          node.addEventListener("click", () => {
            inlineEdit = null;
            statusMenu = null;
            selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
            render();
          });
          node.addEventListener("dblclick", (event) => {
            if (event.target.closest(".marker, .status-popover, .checkpoint-attachments, button, input, textarea, select")) return;
            event.stopPropagation();
            beginCheckpointEdit(task.id, checkpoint.id);
          });
          node.addEventListener("keydown", (event) => {
            if (event.target !== node) return;
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
              addCheckpoint(task.id, checkpoint.id, true);
              return;
            }
            if ((event.ctrlKey || event.metaKey) && (event.code === "BracketRight" || event.key === "]")) {
              event.preventDefault();
              event.stopPropagation();
              selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
              changeSelectedCheckpointIndent(1);
              return;
            }
            if ((event.ctrlKey || event.metaKey) && (event.code === "BracketLeft" || event.key === "[")) {
              event.preventDefault();
              event.stopPropagation();
              selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
              changeSelectedCheckpointIndent(-1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
              addCheckpoint(task.id, checkpoint.id, false);
              return;
            }
            if (event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              beginCheckpointEdit(task.id, checkpoint.id);
            }
          });
          node.addEventListener("dragstart", (event) => {
            dragCheckpoint = { taskId: task.id, checkpointId: checkpoint.id };
            node.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
          });
          node.addEventListener("dragend", () => {
            dragCheckpoint = null;
            node.classList.remove("dragging");
          });
          node.addEventListener("dragover", (event) => {
            if (hasFileDrop(event)) {
              event.preventDefault();
              event.stopPropagation();
              node.classList.add("image-drop-target");
              event.dataTransfer.dropEffect = "copy";
              return;
            }
            if (dragCheckpoint?.taskId === task.id) event.preventDefault();
          });
          node.addEventListener("dragleave", (event) => {
            if (node.contains(event.relatedTarget)) return;
            node.classList.remove("image-drop-target");
          });
          node.addEventListener("drop", (event) => {
            const imageFiles = getImageFilesFromTransfer(event.dataTransfer);
            if (imageFiles.length) {
              event.preventDefault();
              event.stopPropagation();
              node.classList.remove("image-drop-target");
              addImageFilesToCheckpoint(task.id, checkpoint.id, imageFiles);
              return;
            }
            if (!dragCheckpoint || dragCheckpoint.taskId !== task.id) return;
            event.preventDefault();
            moveCheckpoint(task.id, dragCheckpoint.checkpointId, checkpoint.id);
          });
        }

        const markerWrap = document.createElement("span");
        markerWrap.className = "marker-wrap";

        if (!isCheckpointInlineEditing && canFoldDoneThrough(task, checkpoint.id)) {
          const foldRunLength = getVisibleDoneRunThrough(task, checkpoint.id).length;
          markerWrap.classList.add("has-fold-action");
          const foldButton = document.createElement("button");
          foldButton.className = "fold-before-button";
          foldButton.type = "button";
          foldButton.tabIndex = -1;
          foldButton.textContent = "Fold";
          foldButton.title = foldRunLength === 1
            ? "Fold this done node"
            : `Fold ${foldRunLength} done nodes through this step`;
          foldButton.setAttribute("aria-label", foldButton.title);
          foldButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setDoneThroughFolded(task.id, checkpoint.id);
          });
          markerWrap.append(foldButton);
        }

        const marker = document.createElement("button");
        marker.className = "marker";
        marker.type = "button";
        marker.title = "Change checkpoint status";
        marker.setAttribute("aria-label", `Change status: ${checkpointLabels[checkpoint.state]}`);
        marker.setAttribute("aria-haspopup", "menu");
        marker.setAttribute("aria-expanded", String(isStatusMenuOpen));
        const statusMenuId = getCheckpointStatusMenuId(task.id, checkpoint.id);
        if (isStatusMenuOpen) {
          marker.setAttribute("aria-controls", statusMenuId);
        }
        marker.textContent = checkpointMarks[checkpoint.state];
        marker.addEventListener("click", (event) => {
          event.stopPropagation();
          inlineEdit = null;
          selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
          const shouldOpen = !isStatusMenuOpen;
          statusMenu = shouldOpen ? { taskId: task.id, checkpointId: checkpoint.id } : null;
          render();
          if (!shouldOpen) focusCheckpointStatusTrigger(task.id, checkpoint.id);
        });

        const body = document.createElement("div");
        body.className = "checkpoint-body";
        const text = isCheckpointInlineEditing
          ? createInlineTextEditor(checkpoint.text, "checkpoint-text-editor", (value) => {
              checkpoint.text = value || "Untitled checkpoint";
            })
          : document.createElement("span");
        if (!isCheckpointInlineEditing) {
          text.className = "checkpoint-text";
          text.textContent = checkpoint.text;
        }
        const meta = document.createElement("span");
        meta.className = "checkpoint-meta";
        const badge = document.createElement("span");
        badge.className = `badge ${checkpoint.state}`;
        badge.textContent = checkpointLabels[checkpoint.state];
        meta.append(badge);
        if (checkpoint.branchFrom) {
          const branch = document.createElement("span");
          branch.className = "badge planned";
          branch.textContent = "Fork";
          meta.append(branch);
        }
        if (checkpoint.attachments?.length) {
          const imageBadge = document.createElement("span");
          imageBadge.className = "badge image";
          imageBadge.textContent = checkpoint.attachments.length === 1 ? "1 image" : `${checkpoint.attachments.length} images`;
          meta.append(imageBadge);
        }
        body.append(text, meta);
        const attachments = renderCheckpointAttachments(task, checkpoint);
        if (attachments) body.append(attachments);
        markerWrap.append(marker);
        node.append(markerWrap, body);
        if (isStatusMenuOpen) {
          node.append(renderStatusPopover(task, checkpoint, statusMenuId));
        }
        timeline.append(node);
      }

      return timeline;
    }

    function renderDoneCollapseGroup(task, checkpoints, anchorCheckpointId) {
      const row = document.createElement("div");
      const minDepth = checkpoints.reduce((min, checkpoint) => Math.min(min, checkpoint.depth || 0), 3);
      row.className = "done-collapse-row";
      row.style.setProperty("--level", String(Math.min(minDepth, 3)));
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.title = "Show these completed nodes";
      const showDone = (event) => {
        event.stopPropagation();
        clearDoneThroughFolded(task.id, anchorCheckpointId);
        selection = { type: "checkpoint", taskId: task.id, checkpointId: anchorCheckpointId };
        render();
        showToast("Done nodes shown.");
      };
      row.addEventListener("click", showDone);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        showDone(event);
      });

      const marker = document.createElement("span");
      marker.className = "done-collapse-marker";
      marker.textContent = "✓";

      const body = document.createElement("div");
      body.className = "done-collapse-body";
      const label = document.createElement("strong");
      label.textContent = checkpoints.length === 1 ? "1 done node folded" : `${checkpoints.length} done nodes folded`;
      const preview = document.createElement("span");
      preview.textContent = buildDoneCollapsePreview(checkpoints);
      body.append(label, preview);

      const imageCount = checkpoints.reduce((sum, checkpoint) => sum + (checkpoint.attachments?.length || 0), 0);
      if (imageCount) {
        const imageBadge = document.createElement("span");
        imageBadge.className = "badge image done-collapse-badge";
        imageBadge.textContent = imageCount === 1 ? "1 image" : `${imageCount} images`;
        body.append(imageBadge);
      }

      row.append(marker, body);
      return row;
    }

    function buildDoneCollapsePreview(checkpoints) {
      const labels = checkpoints
        .map((checkpoint) => checkpoint.text)
        .filter(Boolean);
      if (!labels.length) return "Completed steps";
      if (labels.length === 1) return labels[0];
      return `${labels[0]} ... ${labels[labels.length - 1]}`;
    }

    function renderStatusPopover(task, checkpoint, popoverId) {
      const popover = document.createElement("div");
      popover.className = "status-popover";
      popover.id = popoverId;
      popover.setAttribute("role", "menu");
      popover.setAttribute("aria-label", `Checkpoint status for ${checkpoint.text || "checkpoint"}`);
      popover.addEventListener("click", (event) => event.stopPropagation());
      popover.addEventListener("keydown", (event) => handleMenuKeydown(event, closeStatusMenu));

      Object.keys(checkpointLabels).forEach((stateKey) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = [
          "status-option",
          stateKey,
          checkpoint.state === stateKey ? "active" : ""
        ].filter(Boolean).join(" ");
        option.title = checkpointLabels[stateKey];
        option.setAttribute("aria-label", checkpointLabels[stateKey]);
        option.setAttribute("role", "menuitemradio");
        option.setAttribute("aria-checked", String(checkpoint.state === stateKey));
        option.textContent = checkpointMarks[stateKey];
        option.addEventListener("click", () => updateCheckpointStatus(task.id, checkpoint.id, stateKey));
        popover.append(option);
      });

      return popover;
    }

    function updateCheckpointStatus(taskId, checkpointId, nextState) {
      const task = state.tasks[taskId];
      if (!task) return;
      const checkpoint = task.checkpoints.find((item) => item.id === checkpointId);
      if (!checkpoint) return;
      if (checkpoint.state === nextState) {
        statusMenu = null;
        selection = { type: "checkpoint", taskId, checkpointId };
        render();
        return;
      }

      rememberUndo();
      if (nextState === "current") {
        setHead(taskId, checkpointId, false, false);
      } else {
        checkpoint.state = nextState;
        persist();
      }

      statusMenu = null;
      selection = { type: "checkpoint", taskId, checkpointId };
      render();
      showToast(`${checkpointLabels[nextState]} set.`);
    }

    function closeStatusMenu(restoreFocus = false) {
      if (!statusMenu) return;
      const { taskId, checkpointId } = statusMenu;
      statusMenu = null;
      renderBoard();
      updateCommandState();
      if (restoreFocus) focusCheckpointStatusTrigger(taskId, checkpointId);
    }

    function createInlineTextEditor(value, extraClass, applyValue) {
      const textarea = document.createElement("textarea");
      textarea.id = "inlineEditInput";
      textarea.className = `inline-edit-control ${extraClass}`;
      textarea.value = value || "";
      const originalValue = textarea.value;
      const commitInlineValue = () => {
        const nextValue = textarea.value.trim();
        if (nextValue !== originalValue.trim()) {
          rememberUndo();
        }
        applyValue(nextValue);
        finishInlineEdit(true);
      };
      textarea.addEventListener("click", (event) => event.stopPropagation());
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelInlineEdit();
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commitInlineValue();
        }
      });
      textarea.addEventListener("blur", () => {
        if (!inlineEdit) return;
        commitInlineValue();
      });
      return textarea;
    }

    function startInlineEdit() {
      const selected = getSelected();
      if (!selected) return;
      if (selected.type === "checkpoint") {
        inlineEdit = { type: "checkpoint", taskId: selected.task.id, checkpointId: selected.checkpoint.id };
      } else if (selected.type === "task-field") {
        inlineEdit = { type: "task", taskId: selected.task.id, field: selected.field };
      } else {
        inlineEdit = { type: "task", taskId: selected.task.id, field: "title" };
      }
      renderBoard();
      window.setTimeout(() => {
        const target = document.getElementById("inlineEditInput");
        if (target) {
          target.focus();
          target.select();
        }
      }, 0);
    }

    function beginTaskFieldEdit(taskId, field) {
      if (!state.tasks[taskId]) return;
      inlineEdit = { type: "task", taskId, field };
      selection = field === "next"
        ? { type: "task-field", taskId, field: "next" }
        : { type: "task", taskId };
      renderBoard();
      window.setTimeout(() => {
        const target = document.getElementById("inlineEditInput");
        if (target) {
          target.focus();
          target.select();
        }
      }, 0);
    }

    function beginCheckpointEdit(taskId, checkpointId) {
      const task = state.tasks[taskId];
      if (!task?.checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) return;
      inlineEdit = { type: "checkpoint", taskId, checkpointId };
      selection = { type: "checkpoint", taskId, checkpointId };
      renderBoard();
      window.setTimeout(() => {
        const target = document.getElementById("inlineEditInput");
        if (target) {
          target.focus();
          target.select();
        }
      }, 0);
    }

    function finishInlineEdit(shouldSave) {
      inlineEdit = null;
      if (shouldSave) {
        persist();
        render();
        showToast("Updated.");
      } else {
        renderBoard();
      }
    }

    function cancelInlineEdit() {
      finishInlineEdit(false);
    }

    function actionButton(label, variant, handler) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn ${variant}`.trim();
      button.textContent = label;
      button.addEventListener("click", handler);
      return button;
    }

    function getSelected() {
      if (!selection) return null;
      const task = state.tasks[selection.taskId];
      if (!task) return null;
      if (selection.type === "task") return { type: "task", task };
      if (selection.type === "task-field") return { type: "task-field", task, field: selection.field };
      const checkpoint = task.checkpoints.find((item) => item.id === selection.checkpointId);
      if (!checkpoint) return null;
      return { type: "checkpoint", task, checkpoint };
    }

    function updateCommandState() {
      const selected = getSelected();
      const isCheckpoint = selected?.type === "checkpoint";
      const hasTask = Boolean(selected?.task);
      dom.addCheckpointBtn.disabled = !hasTask;
      dom.forkBtn.disabled = !isCheckpoint;
      dom.setHeadBtn.disabled = !isCheckpoint;
      dom.completeTaskBtn.disabled = !hasTask;
      dom.railAddCheckpointBtn.disabled = !hasTask;
      dom.railForkBtn.disabled = !isCheckpoint;
      dom.railSetHeadBtn.disabled = !isCheckpoint;
    }

    function addTask() {
      rememberUndo();
      const task = createTaskRecord({
        title: "New Task",
        goal: "Define the goal.",
        status: "active",
        next: "Choose the next move.",
        checkpoints: [["Initial checkpoint", "current"]]
      });
      state.tasks[task.id] = task;
      currentDay().taskIds.push(task.id);
      selection = { type: "task", taskId: task.id };
      persist();
      render();
      focusEditor();
      showToast("Task added.");
    }

    function deleteTask(taskId) {
      const day = currentDay();
      const task = state.tasks[taskId];
      if (!day || !task) return;
      const index = day.taskIds.indexOf(taskId);
      if (index < 0) return;
      if (!confirmDeleteTask(task)) return;

      rememberUndo();
      day.taskIds.splice(index, 1);
      const stillReferenced = Object.values(state.days).some((dayRecord) => dayRecord.taskIds.includes(taskId));
      if (!stillReferenced) {
        delete state.tasks[taskId];
      }
      const nextTaskId = day.taskIds[index] || day.taskIds[index - 1] || day.taskIds[0] || null;
      selection = nextTaskId ? { type: "task", taskId: nextTaskId } : null;
      inlineEdit = null;
      statusMenu = null;
      persist();
      render();
      showToast(`Deleted ${task.title || "card"}.`);
    }

    function deleteCheckpoint(taskId, checkpointId) {
      const task = state.tasks[taskId];
      if (!task) return;
      const index = task.checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId);
      if (index < 0) return;
      if (!confirmDeleteCheckpoint(task.checkpoints[index])) return;

      rememberUndo();
      const [deleted] = task.checkpoints.splice(index, 1);
      task.checkpoints.forEach((checkpoint, nextIndex) => {
        checkpoint.order = nextIndex;
        if (checkpoint.branchFrom === checkpointId) {
          checkpoint.branchFrom = null;
          checkpoint.depth = 0;
        }
      });

      if (deleted.state === "current" && task.checkpoints.length && !task.checkpoints.some((checkpoint) => checkpoint.state === "current")) {
        const nextHead = task.checkpoints[Math.min(index, task.checkpoints.length - 1)];
        nextHead.state = "current";
      }

      const nextCheckpoint = task.checkpoints[index] || task.checkpoints[index - 1] || null;
      selection = nextCheckpoint
        ? { type: "checkpoint", taskId, checkpointId: nextCheckpoint.id }
        : { type: "task", taskId };
      inlineEdit = null;
      statusMenu = null;
      persist();
      render();
      showToast(`Deleted ${deleted.text || "step"}.`);
    }

    function addCheckpointFromSelection(asFork) {
      const selected = getSelected();
      if (!selected) return;
      if (selected.type !== "checkpoint") {
        addCheckpoint(selected.task.id, null, false);
        return;
      }
      addCheckpoint(selected.task.id, selected.checkpoint.id, asFork);
    }

    function addCheckpoint(taskId, afterCheckpointId = null, asFork = false) {
      const task = state.tasks[taskId];
      if (!task) return;
      rememberUndo();
      const afterIndex = afterCheckpointId
        ? task.checkpoints.findIndex((checkpoint) => checkpoint.id === afterCheckpointId)
        : task.checkpoints.length - 1;
      const parent = afterIndex >= 0 ? task.checkpoints[afterIndex] : null;
      const checkpoint = {
        id: uid("cp"),
        text: asFork ? "New fork checkpoint" : "New checkpoint",
        state: "planned",
        branchFrom: asFork && parent ? parent.id : null,
        depth: asFork && parent ? Math.min((parent.depth || 0) + 1, 3) : (parent?.depth || 0),
        createdAt: nowIso(),
        order: afterIndex + 1
      };
      task.checkpoints.splice(afterIndex + 1, 0, checkpoint);
      selection = { type: "checkpoint", taskId, checkpointId: checkpoint.id };
      persist();
      render();
      focusEditor();
      showToast(asFork ? "Fork created." : "Checkpoint added.");
    }

    function setSelectedHead() {
      const selected = getSelected();
      if (selected?.type !== "checkpoint") return;
      setHead(selected.task.id, selected.checkpoint.id, true);
    }

    function setHead(taskId, checkpointId, shouldRender, shouldRemember = true) {
      const task = state.tasks[taskId];
      if (!task) return;
      if (shouldRemember) {
        rememberUndo();
      }
      task.checkpoints.forEach((checkpoint) => {
        if (checkpoint.id === checkpointId) {
          checkpoint.state = "current";
        } else if (checkpoint.state === "current") {
          checkpoint.state = "done";
        }
      });
      if (task.status === "done") task.status = "active";
      persist();
      if (shouldRender) {
        render();
        showToast("HEAD updated.");
      }
    }

    function completeSelectedTask() {
      const selected = getSelected();
      if (!selected?.task) return;
      completeTask(selected.task.id);
    }

    function completeTask(taskId) {
      const task = state.tasks[taskId];
      if (!task) return;
      if (task.status !== "done") {
        rememberUndo();
      }
      task.status = "done";
      selection = { type: "task", taskId };
      persist();
      render();
      showToast("Task completed.");
    }

    function moveTask(fromId, toId, placement = "before") {
      const ids = currentDay().taskIds;
      const fromIndex = ids.indexOf(fromId);
      if (fromIndex < 0 || fromId === toId) return;

      const idsWithoutMoved = ids.filter((id) => id !== fromId);
      const targetIndex = idsWithoutMoved.indexOf(toId);
      if (targetIndex < 0) return;
      const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
      moveTaskToIndex(fromId, insertIndex);
    }

    function moveTaskToIndex(fromId, insertIndex) {
      const ids = currentDay().taskIds;
      const fromIndex = ids.indexOf(fromId);
      if (fromIndex < 0) return;

      const idsWithoutMoved = ids.filter((id) => id !== fromId);
      const nextIndex = Math.max(0, Math.min(insertIndex, idsWithoutMoved.length));
      if (nextIndex === fromIndex) return;

      rememberUndo();
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(nextIndex, 0, moved);
      selection = { type: "task", taskId: moved };
      persist();
      render();
    }

    function moveCheckpoint(taskId, fromId, toId) {
      const task = state.tasks[taskId];
      if (!task) return;
      const fromIndex = task.checkpoints.findIndex((checkpoint) => checkpoint.id === fromId);
      const toIndex = task.checkpoints.findIndex((checkpoint) => checkpoint.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      rememberUndo();
      const [moved] = task.checkpoints.splice(fromIndex, 1);
      task.checkpoints.splice(toIndex, 0, moved);
      persist();
      render();
    }

    function changeSelectedCheckpointIndent(delta) {
      const selected = getSelected();
      if (selected?.type !== "checkpoint") return;

      const task = selected.task;
      const checkpoint = selected.checkpoint;
      const index = task.checkpoints.findIndex((item) => item.id === checkpoint.id);
      if (index < 0) return;

      const currentDepth = checkpoint.depth || 0;
      let nextDepth = currentDepth + delta;

      if (delta > 0) {
        if (index === 0) {
          showToast("First step cannot be indented.");
          return;
        }
        const previous = task.checkpoints[index - 1];
        const maxDepth = Math.min((previous.depth || 0) + 1, 3);
        nextDepth = Math.min(nextDepth, maxDepth);
      } else {
        nextDepth = Math.max(nextDepth, 0);
      }

      if (nextDepth === currentDepth) {
        showToast(delta > 0 ? "Step is already at max indent." : "Step is already at left edge.");
        return;
      }

      rememberUndo();
      checkpoint.depth = nextDepth;
      if (nextDepth === 0) {
        checkpoint.branchFrom = null;
      } else if (checkpoint.branchFrom) {
        const parent = task.checkpoints.find((item) => item.id === checkpoint.branchFrom);
        if (!parent || (parent.depth || 0) >= nextDepth) {
          checkpoint.branchFrom = null;
        }
      }

      selection = { type: "checkpoint", taskId: task.id, checkpointId: checkpoint.id };
      statusMenu = null;
      persist();
      render();
      showToast(delta > 0 ? "Step indented." : "Step outdented.");
    }

    function createDailySnapshot(date) {
      if (state.days[date]) {
        state.currentDate = date;
        selection = sanitizeSelection(selection);
        render();
        showToast("Snapshot opened.");
        return;
      }

      const previousDate = sortedDates().filter((item) => item < date).pop() || sortedDates().at(-1);
      const previousDay = previousDate ? state.days[previousDate] : null;
      const taskIds = [];

      rememberUndo();
      if (previousDay) {
        previousDay.taskIds.forEach((taskId) => {
          const task = state.tasks[taskId];
          if (!task || task.status === "done") return;
          const cloned = cloneTask(task);
          state.tasks[cloned.id] = cloned;
          taskIds.push(cloned.id);
        });
      }

      state.days[date] = { date, taskIds, createdAt: nowIso(), inheritedFrom: previousDate || null };
      state.currentDate = date;
      selection = sanitizeSelection(null);
      persist();
      render();
      showToast("Daily snapshot created.");
    }

    function cloneTask(task) {
      const nextTaskId = uid("task");
      const idMap = new Map();
      const checkpoints = task.checkpoints.map((checkpoint) => {
        const nextId = uid("cp");
        idMap.set(checkpoint.id, nextId);
        return {
          ...checkpoint,
          id: nextId,
          createdAt: nowIso()
        };
      });
      checkpoints.forEach((checkpoint) => {
        checkpoint.branchFrom = checkpoint.branchFrom ? idMap.get(checkpoint.branchFrom) || null : null;
      });
      return {
        ...task,
        id: nextTaskId,
        status: task.status === "done" ? "active" : task.status,
        checkpoints,
        createdAt: nowIso()
      };
    }

    function shiftDay(delta) {
      const dates = sortedDates();
      const index = dates.indexOf(state.currentDate);
      const next = dates[index + delta];
      if (!next) return;
      state.currentDate = next;
      selection = sanitizeSelection(selection);
      render();
    }

    function openToday() {
      createDailySnapshot(getLocalDate());
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `agent-git-${state.currentDate}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("JSON exported.");
    }

    function resetDemo() {
      const confirmed = window.confirm("Reset Agent-Git demo data?");
      if (!confirmed) return;
      rememberUndo();
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(`${STORAGE_KEY}:selection`);
      state = seedState();
      selection = sanitizeSelection(null);
      render();
      showToast("Demo reset.");
    }

    function focusEditor() {
      startInlineEdit();
    }

    function isTypingTarget(target) {
      const element = target instanceof Element ? target : null;
      return Boolean(element && (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable));
    }

    function isShortcutControlTarget(target) {
      const element = target instanceof Element ? target : null;
      return Boolean(element?.closest("button, a[href], input, textarea, select, summary, [role='button'], [role='menuitem'], [role='menuitemradio']"));
    }

    function showToast(message) {
      window.clearTimeout(toastTimer);
      dom.toast.textContent = message;
      dom.toast.classList.add("visible");
      toastTimer = window.setTimeout(() => {
        dom.toast.classList.remove("visible");
      }, 1800);
    }
