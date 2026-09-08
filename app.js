const STORAGE_KEY = "autumn-job-tracker-v1";
const SUPABASE_URL = "https://pinulucawmghmsutjcwa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pKBTM4CCCeZ1KT27Qd4YnA_GLvibWOY";
const ACTIVE_STATUSES = new Set(["笔试", "一面", "二面", "终面"]);
const supabaseClient = globalThis.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  addButton: document.querySelector("#addButton"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  dialog: document.querySelector("#jobDialog"),
  form: document.querySelector("#jobForm"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelButton: document.querySelector("#cancelButton"),
  deleteButton: document.querySelector("#deleteButton"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogEyebrow: document.querySelector("#dialogEyebrow"),
  tableWrap: document.querySelector("#tableWrap"),
  tableBody: document.querySelector("#jobTableBody"),
  emptyState: document.querySelector("#emptyState"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyDescription: document.querySelector("#emptyDescription"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  resultSummary: document.querySelector("#resultSummary"),
  totalCount: document.querySelector("#totalCount"),
  progressCount: document.querySelector("#progressCount"),
  offerCount: document.querySelector("#offerCount"),
  upcomingCount: document.querySelector("#upcomingCount"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarAgenda: document.querySelector("#calendarAgenda"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  todayButton: document.querySelector("#todayButton"),
  cloudStatus: document.querySelector("#cloudStatus"),
  loginButton: document.querySelector("#loginButton"),
  accountMenu: document.querySelector("#accountMenu"),
  userEmail: document.querySelector("#userEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authMessage: document.querySelector("#authMessage"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  toast: document.querySelector("#toast")
};

const fieldNames = [
  "jobId", "company", "role", "location", "salary", "channel", "jobType",
  "jobLink", "fairName", "fairDate", "fairTime", "fairVenue",
  "status", "appliedDate", "deadline", "nextDate", "nextTime", "nodeType", "nextAction",
  "description", "notes"
];

const localJobs = loadLocalJobs();
let jobs = [];
let currentUser = null;
let authMode = "login";
let toastTimer;
let calendarCursor = new Date();
calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);

function loadLocalJobs() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function fromDatabaseRow(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location || "",
    salary: row.salary || "",
    channel: row.channel || "官网",
    jobType: row.job_type || "校招",
    jobLink: row.job_link || "",
    fairName: row.fair_name || "",
    fairDate: row.fair_date || "",
    fairTime: (row.fair_time || "").slice(0, 5),
    fairVenue: row.fair_venue || "",
    status: row.status || "关注中",
    appliedDate: row.applied_date || "",
    deadline: row.deadline || "",
    nextDate: row.next_date || "",
    nextTime: (row.next_time || "").slice(0, 5),
    nodeType: row.node_type || "其他节点",
    nextAction: row.next_action || "",
    description: row.description || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDatabaseRow(job) {
  return {
    company: job.company,
    role: job.role,
    location: job.location || "",
    salary: job.salary || "",
    channel: job.channel || "官网",
    job_type: job.jobType || "校招",
    job_link: job.jobLink || "",
    fair_name: job.fairName || "",
    fair_date: job.fairDate || null,
    fair_time: job.fairTime || null,
    fair_venue: job.fairVenue || "",
    status: job.status || "关注中",
    applied_date: job.appliedDate || null,
    deadline: job.deadline || null,
    next_date: job.nextDate || null,
    next_time: job.nextTime || null,
    node_type: job.nodeType || "其他节点",
    next_action: job.nextAction || "",
    description: job.description || "",
    notes: job.notes || ""
  };
}

function setCloudStatus(message, state = "") {
  elements.cloudStatus.textContent = message;
  elements.cloudStatus.className = `cloud-status${state ? ` is-${state}` : ""}`;
}

function setAuthenticatedUi(user) {
  currentUser = user || null;
  elements.loginButton.hidden = Boolean(user);
  elements.accountMenu.hidden = !user;
  elements.userEmail.textContent = user?.email || "";
  setCloudStatus(user ? "云端已同步" : "尚未登录");
}

function openAuthDialog(preserveMessage = false) {
  if (!preserveMessage) {
    elements.authMessage.textContent = "";
    elements.authMessage.className = "auth-message";
  }
  if (!elements.authDialog.open) elements.authDialog.showModal();
  requestAnimationFrame(() => elements.authEmail.focus());
}

function setAuthMode(mode) {
  authMode = mode;
  elements.authSubmitButton.textContent = mode === "login" ? "登录" : "创建账号";
  elements.authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
  elements.authForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  elements.authMessage.textContent = "";
  elements.authMessage.className = "auth-message";
}

async function loadCloudJobs() {
  if (!currentUser) return;
  setCloudStatus("正在同步…", "syncing");
  const { data, error } = await supabaseClient
    .from("jobs")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    setCloudStatus("同步失败", "error");
    throw error;
  }
  jobs = data.map(fromDatabaseRow);
  render();
  setCloudStatus("云端已同步");
}

async function migrateLocalJobs() {
  if (!currentUser || !localJobs.length || jobs.length) return;
  const migrationKey = `${STORAGE_KEY}-migrated-${currentUser.id}`;
  if (localStorage.getItem(migrationKey)) return;
  if (!confirm(`发现当前浏览器中有 ${localJobs.length} 条旧记录，是否上传到云端？`)) return;

  setCloudStatus("正在上传旧记录…", "syncing");
  const rows = localJobs
    .filter((job) => job?.company && job?.role)
    .map((job) => ({ ...toDatabaseRow(job), user_id: currentUser.id }));
  if (!rows.length) {
    setCloudStatus("云端已同步");
    return;
  }
  const { error } = await supabaseClient.from("jobs").insert(rows);
  if (error) {
    setCloudStatus("迁移失败", "error");
    alert(`旧记录上传失败：${error.message}`);
    return;
  }
  localStorage.setItem(migrationKey, "1");
  await loadCloudJobs();
  showToast(`已将 ${rows.length} 条旧记录上传到云端`);
}

async function applySession(session) {
  const user = session?.user || null;
  if (!user) {
    setAuthenticatedUi(null);
    jobs = [];
    render();
    openAuthDialog();
    return;
  }

  const isSameUser = currentUser?.id === user.id;
  setAuthenticatedUi(user);
  if (elements.authDialog.open) elements.authDialog.close();
  if (!isSameUser) {
    try {
      await loadCloudJobs();
      await migrateLocalJobs();
    } catch (error) {
      alert(`云端数据加载失败：${error.message}`);
    }
  }
}

async function initializeAuth() {
  if (!supabaseClient) {
    setCloudStatus("连接组件加载失败", "error");
    elements.authMessage.textContent = "无法加载云端连接组件，请检查网络后刷新页面。";
    elements.authMessage.className = "auth-message is-error";
    openAuthDialog(true);
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setCloudStatus("登录状态读取失败", "error");
    openAuthDialog();
    return;
  }
  await applySession(data.session);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || session?.user?.id !== currentUser?.id) {
      setTimeout(() => applySession(session), 0);
    }
  });
}

async function submitAuth(event) {
  event.preventDefault();
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  elements.authMessage.className = "auth-message";
  if (!email || password.length < 6) {
    elements.authMessage.textContent = "请输入有效邮箱和至少 6 位密码。";
    elements.authMessage.classList.add("is-error");
    return;
  }

  elements.authSubmitButton.disabled = true;
  elements.authSubmitButton.textContent = authMode === "login" ? "正在登录…" : "正在注册…";
  const result = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });
  elements.authSubmitButton.disabled = false;
  elements.authSubmitButton.textContent = authMode === "login" ? "登录" : "创建账号";

  if (result.error) {
    elements.authMessage.textContent = result.error.message;
    elements.authMessage.classList.add("is-error");
    return;
  }
  if (result.data.session) {
    await applySession(result.data.session);
  } else {
    setAuthMode("login");
    elements.authMessage.textContent = "注册成功，请打开邮箱中的确认链接，然后回来登录。";
    elements.authMessage.classList.add("is-success");
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  const date = parseLocalDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function daysUntil(value) {
  const date = parseLocalDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarEvents() {
  return jobs.flatMap((job) => {
    const events = [];
    if (job.fairDate) {
      events.push({
        date: job.fairDate,
        time: job.fairTime || "",
        type: "fair",
        label: job.fairName || "招聘会",
        meta: job.fairVenue || job.role,
        jobId: job.id,
        company: job.company
      });
    }
    if (job.nextDate) {
      const nodeType = job.nodeType || (ACTIVE_STATUSES.has(job.status) ? job.status : "其他节点");
      const isAssessment = ["笔试", "一面", "二面", "终面"].includes(nodeType);
      events.push({
        date: job.nextDate,
        time: job.nextTime || "",
        type: isAssessment ? "assessment" : "other",
        label: job.nextAction || nodeType,
        meta: job.role,
        jobId: job.id,
        company: job.company
      });
    }
    if (job.deadline) {
      events.push({
        date: job.deadline,
        time: "",
        type: "deadline",
        label: "投递截止",
        meta: job.role,
        jobId: job.id,
        company: job.company
      });
    }
    return events;
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function eventButton(event) {
  const time = event.time ? `<time>${escapeHtml(event.time)}</time>` : "";
  const detail = [event.time, event.meta].filter(Boolean).join(" · ");
  return `<button class="calendar-event event-${event.type}" type="button" data-edit-id="${escapeHtml(event.jobId)}" title="${escapeHtml(`${event.company} · ${event.label}${detail ? ` · ${detail}` : ""}`)}">${time}<span class="calendar-event-copy"><b>${escapeHtml(event.company)} · ${escapeHtml(event.label)}</b>${event.meta ? `<small>${escapeHtml(event.meta)}</small>` : ""}</span></button>`;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const todayKey = toDateKey(new Date());
  const events = getCalendarEvents();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((event) => event.date.startsWith(monthPrefix));
  const eventsByDate = Object.groupBy
    ? Object.groupBy(monthEvents, (event) => event.date)
    : monthEvents.reduce((groups, event) => {
      (groups[event.date] ||= []).push(event);
      return groups;
    }, {});

  elements.calendarTitle.textContent = `${year}年${month + 1}月`;
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);

  elements.calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    const dayEvents = eventsByDate[dateKey] || [];
    const classes = ["calendar-day"];
    if (date.getMonth() !== month) classes.push("outside-month");
    if (dateKey === todayKey) classes.push("is-today");
    return `<div class="${classes.join(" ")}" data-date="${dateKey}">
      <div class="calendar-date"><time datetime="${dateKey}">${date.getDate()}</time>${dateKey === todayKey ? "<span>今天</span>" : ""}</div>
      <div class="day-events">${dayEvents.map(eventButton).join("")}</div>
    </div>`;
  }).join("");

  if (!monthEvents.length) {
    elements.calendarAgenda.innerHTML = `<div class="agenda-empty">本月还没有安排，填写招聘会或下一节点日期后会显示在这里。</div>`;
    return;
  }

  elements.calendarAgenda.innerHTML = Object.entries(eventsByDate).map(([date, dayEvents]) => `
    <section class="agenda-day">
      <div class="agenda-date"><strong>${formatDate(date)}</strong><span>${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][parseLocalDate(date).getDay()]}</span></div>
      <div class="agenda-events">${dayEvents.map(eventButton).join("")}</div>
    </section>
  `).join("");
}

function nextNodeText(job) {
  if (job.nextDate) {
    const days = daysUntil(job.nextDate);
    const suffix = days === 0 ? "今天" : days === 1 ? "明天" : days !== null && days > 1 && days <= 7 ? `${days} 天后` : formatDate(job.nextDate);
    return `<span>${escapeHtml(job.nextAction || job.nodeType || "待办节点")}</span><span class="subline">${escapeHtml(suffix)}</span>`;
  }
  if (job.fairDate) return `<span>${escapeHtml(job.fairName || "招聘会")}</span><span class="subline">${escapeHtml(formatDate(job.fairDate))}</span>`;
  if (job.deadline && job.status === "关注中") {
    return `<span>申请截止</span><span class="subline">${escapeHtml(formatDate(job.deadline))}</span>`;
  }
  return "—";
}

function getVisibleJobs() {
  const keyword = elements.searchInput.value.trim().toLocaleLowerCase("zh-CN");
  const status = elements.statusFilter.value;
  const filtered = jobs.filter((job) => {
    const haystack = [job.company, job.role, job.location, job.channel, job.notes].join(" ").toLocaleLowerCase("zh-CN");
    return (!keyword || haystack.includes(keyword)) && (status === "all" || job.status === status);
  });

  return filtered.sort((a, b) => {
    if (elements.sortSelect.value === "deadline-asc") {
      return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
    }
    if (elements.sortSelect.value === "company-asc") {
      return a.company.localeCompare(b.company, "zh-CN");
    }
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

function render() {
  const visibleJobs = getVisibleJobs();
  const hasFilter = elements.searchInput.value.trim() || elements.statusFilter.value !== "all";

  elements.totalCount.textContent = jobs.length;
  elements.progressCount.textContent = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  elements.offerCount.textContent = jobs.filter((job) => job.status === "Offer").length;
  elements.upcomingCount.textContent = jobs.filter((job) => {
    return [job.fairDate, job.nextDate, job.status === "关注中" ? job.deadline : ""].some((date) => {
      const days = daysUntil(date);
      return days !== null && days >= 0 && days <= 7;
    });
  }).length;

  elements.resultSummary.textContent = hasFilter
    ? `找到 ${visibleJobs.length} 条，共 ${jobs.length} 条记录`
    : `共 ${jobs.length} 条记录`;

  elements.tableBody.innerHTML = visibleJobs.map((job) => `
    <tr>
      <td>
        <span class="job-company">${escapeHtml(job.company)}</span>
        <span class="job-role">${escapeHtml(job.role)}${job.jobType ? ` · ${escapeHtml(job.jobType)}` : ""}</span>
      </td>
      <td><span class="status-pill" data-status="${escapeHtml(job.status)}">${escapeHtml(job.status)}</span></td>
      <td>
        <span>${escapeHtml(job.location || "—")}</span>
        ${job.salary ? `<span class="subline">${escapeHtml(job.salary)}</span>` : ""}
      </td>
      <td>
        <span>${escapeHtml(formatDate(job.appliedDate))}</span>
        ${job.channel ? `<span class="subline">${escapeHtml(job.channel)}</span>` : ""}
      </td>
      <td>${nextNodeText(job)}</td>
      <td><button class="row-action" type="button" data-edit-id="${escapeHtml(job.id)}">编辑</button></td>
    </tr>
  `).join("");

  const isEmpty = visibleJobs.length === 0;
  elements.tableWrap.hidden = isEmpty;
  elements.emptyState.hidden = !isEmpty;
  if (isEmpty) {
    elements.emptyTitle.textContent = hasFilter ? "没有匹配的职位" : "记录你的第一个职位";
    elements.emptyDescription.textContent = hasFilter ? "试试更换关键词或筛选条件。" : "把感兴趣的公司、岗位和投递进度集中放在这里。";
    elements.emptyAddButton.hidden = Boolean(hasFilter);
  }
  renderCalendar();
}

function resetValidation() {
  elements.form.querySelectorAll(".field").forEach((field) => field.classList.remove("has-error"));
  elements.form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
}

function setFormValues(job = {}) {
  fieldNames.forEach((name) => {
    const input = document.querySelector(`#${name}`);
    if (input) input.value = job[name] || "";
  });
  if (!job.id) {
    document.querySelector("#channel").value = "官网";
    document.querySelector("#jobType").value = "校招";
    document.querySelector("#status").value = "关注中";
    document.querySelector("#nodeType").value = "其他节点";
  }
}

function openDialog(jobId = "") {
  const job = jobs.find((item) => item.id === jobId);
  elements.form.reset();
  resetValidation();
  setFormValues(job || {});
  document.querySelector("#jobId").value = job?.id || "";
  elements.dialogTitle.textContent = job ? "编辑职位" : "新增职位";
  elements.dialogEyebrow.textContent = job ? "更新记录" : "新记录";
  elements.deleteButton.hidden = !job;
  elements.dialog.showModal();
  requestAnimationFrame(() => document.querySelector("#company").focus());
}

function closeDialog() {
  elements.dialog.close();
}

function showFieldError(input, message) {
  const field = input.closest(".field");
  field?.classList.add("has-error");
  const error = field?.querySelector(".field-error");
  if (error) error.textContent = message;
}

function validateForm() {
  resetValidation();
  const company = document.querySelector("#company");
  const role = document.querySelector("#role");
  const jobLink = document.querySelector("#jobLink");
  let valid = true;

  if (!company.value.trim()) { showFieldError(company, "请填写公司名称"); valid = false; }
  if (!role.value.trim()) { showFieldError(role, "请填写职位名称"); valid = false; }
  if (jobLink.value.trim()) {
    try { new URL(jobLink.value.trim()); }
    catch { showFieldError(jobLink, "请输入完整有效的网址"); valid = false; }
  }
  if (!valid) elements.form.querySelector(".has-error input")?.focus();
  return valid;
}

function readForm() {
  return Object.fromEntries(fieldNames.filter((name) => name !== "jobId").map((name) => {
    const input = document.querySelector(`#${name}`);
    return [name, input.value.trim()];
  }));
}

async function saveJob(event) {
  event.preventDefault();
  if (!currentUser) { openAuthDialog(); return; }
  if (!validateForm()) return;
  const id = document.querySelector("#jobId").value;
  const values = readForm();
  const submitButton = event.submitter;
  submitButton.disabled = true;
  setCloudStatus("正在保存…", "syncing");

  try {
    const query = id
      ? supabaseClient.from("jobs").update(toDatabaseRow(values)).eq("id", id)
      : supabaseClient.from("jobs").insert({ ...toDatabaseRow(values), user_id: currentUser.id });
    const { data, error } = await query.select().single();
    if (error) throw error;
    const savedJob = fromDatabaseRow(data);
    if (id) {
      const index = jobs.findIndex((job) => job.id === id);
      jobs[index] = savedJob;
    } else {
      jobs.unshift(savedJob);
    }
    render();
    closeDialog();
    setCloudStatus("云端已同步");
    showToast(id ? "职位记录已更新并同步" : "职位记录已保存到云端");
  } catch (error) {
    setCloudStatus("保存失败", "error");
    alert(`保存失败：${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteCurrentJob() {
  const id = document.querySelector("#jobId").value;
  const job = jobs.find((item) => item.id === id);
  if (!job || !confirm(`确定删除「${job.company} · ${job.role}」吗？`)) return;
  elements.deleteButton.disabled = true;
  setCloudStatus("正在删除…", "syncing");
  const { error } = await supabaseClient.from("jobs").delete().eq("id", id);
  elements.deleteButton.disabled = false;
  if (error) {
    setCloudStatus("删除失败", "error");
    alert(`删除失败：${error.message}`);
    return;
  }
  jobs = jobs.filter((item) => item.id !== id);
  render();
  closeDialog();
  setCloudStatus("云端已同步");
  showToast("职位记录已从云端删除");
}

function exportJobs() {
  const payload = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), jobs }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `秋招投递备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(jobs.length ? "备份已导出" : "已导出空白备份");
}

async function importJobs(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incomingJobs = Array.isArray(data) ? data : data.jobs;
    if (!Array.isArray(incomingJobs)) throw new Error("invalid");
    if (jobs.length && !confirm(`导入将替换当前 ${jobs.length} 条记录，是否继续？`)) return;
    const validJobs = incomingJobs.filter((job) => job && typeof job === "object" && job.company && job.role);
    setCloudStatus("正在导入…", "syncing");
    const rows = validJobs.map((job) => ({ ...toDatabaseRow(job), user_id: currentUser.id }));
    const oldIds = jobs.map((job) => job.id);
    const { error: insertError } = rows.length
      ? await supabaseClient.from("jobs").insert(rows)
      : { error: null };
    if (insertError) throw insertError;
    if (oldIds.length) {
      const { error: deleteError } = await supabaseClient.from("jobs").delete().in("id", oldIds);
      if (deleteError) throw deleteError;
    }
    await loadCloudJobs();
    showToast(`已导入 ${validJobs.length} 条记录并同步到云端`);
  } catch (error) {
    setCloudStatus("导入失败", "error");
    alert(`无法导入：${error.message || "请选择由本工具导出的 JSON 备份文件。"}`);
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

elements.addButton.addEventListener("click", () => currentUser ? openDialog() : openAuthDialog());
elements.emptyAddButton.addEventListener("click", () => currentUser ? openDialog() : openAuthDialog());
elements.closeDialogButton.addEventListener("click", closeDialog);
elements.cancelButton.addEventListener("click", closeDialog);
elements.deleteButton.addEventListener("click", deleteCurrentJob);
elements.form.addEventListener("submit", saveJob);
elements.exportButton.addEventListener("click", exportJobs);
elements.importButton.addEventListener("click", () => currentUser ? elements.importInput.click() : openAuthDialog());
elements.importInput.addEventListener("change", importJobs);
elements.searchInput.addEventListener("input", render);
elements.statusFilter.addEventListener("change", render);
elements.sortSelect.addEventListener("change", render);
elements.loginButton.addEventListener("click", openAuthDialog);
elements.logoutButton.addEventListener("click", async () => {
  setCloudStatus("正在退出…", "syncing");
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setCloudStatus("退出失败", "error");
    alert(`退出失败：${error.message}`);
  }
});
elements.authForm.addEventListener("submit", submitAuth);
elements.authForm.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});
elements.authDialog.addEventListener("cancel", (event) => {
  if (!currentUser) event.preventDefault();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) {
    loadCloudJobs().catch(() => {});
  }
});
elements.prevMonthButton.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendar();
});
elements.nextMonthButton.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendar();
});
elements.todayButton.addEventListener("click", () => {
  const today = new Date();
  calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  renderCalendar();
});
elements.tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (button) openDialog(button.dataset.editId);
});
[elements.calendarGrid, elements.calendarAgenda].forEach((container) => container.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (button) openDialog(button.dataset.editId);
}));
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

render();
initializeAuth();
