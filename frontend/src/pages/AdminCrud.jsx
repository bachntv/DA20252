import React, { useEffect, useState } from "react";
import "../styles/MainContent/AdminCrud.css";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";
const OVERVIEW_KEY = "__overview__";
const TOP_SONGS_KEY = "__top_songs__";
const TOP_USERS_KEY = "__top_users__";
const PAYMENTS_KEY = "__payments__";
const SUBSCRIPTIONS_KEY = "__subscriptions__";
const NOTIFICATIONS_KEY = "__notifications__";

const PERIOD_LABELS = {
  all: "All Time",
  week: "Last 7 Days",
  month: "Last 30 Days",
};

const ADMIN_VIEW_GROUPS = [
  {
    title: "Reports",
    items: [
      { key: OVERVIEW_KEY, label: "Overview" },
      { key: TOP_SONGS_KEY, label: "Top Songs" },
      { key: TOP_USERS_KEY, label: "Top Users" },
    ],
  },
  {
    title: "Billing",
    items: [
      { key: PAYMENTS_KEY, label: "Payments" },
      { key: SUBSCRIPTIONS_KEY, label: "Subscriptions" },
      { key: NOTIFICATIONS_KEY, label: "Notifications" },
    ],
  },
];

const TABLE_CATEGORY_RULES = [
  { title: "Commerce", keywords: ["payment", "plan", "subscription", "purchase", "billing"] },
  { title: "Music", keywords: ["song", "album", "artist", "playlist", "track"] },
  { title: "Users", keywords: ["user", "settings", "security", "activity"] },
  { title: "Social", keywords: ["social", "follow", "like", "comment", "post", "notification"] },
];

const formatTableName = (name) =>
  name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const FIELD_LABELS = {
  approval_status: "Approval",
  is_active: "Visibility",
  track_id: "Song",
  track_name: "Song Title",
  artist_id: "Artist",
  album_id: "Album",
  uploaded_by_user_id: "Uploaded By",
  rejection_reason: "Rejection Reason",
  audio_url: "Audio File",
  track_image_url: "Cover Image",
  account_type: "Account Type",
  is_muted: "Posting",
  user_id: "User",
};

const VALUE_LABELS = {
  approval_status: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  },
  account_type: {
    free: "Free",
    premium: "Premium",
  },
};

const formatColumnLabel = (name) => FIELD_LABELS[name] || formatTableName(name);

const formatFriendlyValue = (columnName, value) => {
  if (value == null || value === "") return "";
  if (columnName === "is_active") return value ? "Visible" : "Hidden";
  if (columnName === "is_muted") return value ? "Muted" : "Can post";
  return VALUE_LABELS[columnName]?.[value] || value;
};

const categorizeTables = (tableNames) => {
  const groups = TABLE_CATEGORY_RULES.map((rule) => ({ title: rule.title, keywords: rule.keywords, items: [] }));
  const otherGroup = { title: "System Tables", items: [] };

  tableNames.forEach((table) => {
    const normalized = table.toLowerCase();
    const category = groups.find((group) =>
      group.keywords.some((keyword) => normalized.includes(keyword))
    ) || otherGroup;
    category.items.push({ key: table, label: formatTableName(table) });
  });

  return [...groups, otherGroup]
    .filter((group) => group.items.length > 0)
    .map(({ keywords, ...group }) => group);
};

const AdminCrud = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(OVERVIEW_KEY);
  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [editedRows, setEditedRows] = useState({});
  const [savingRowKey, setSavingRowKey] = useState(null);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [overview, setOverview] = useState({});
  const [dashboardMetrics, setDashboardMetrics] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [topSongs, setTopSongs] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [topSongsPeriod, setTopSongsPeriod] = useState("all");
  const [topUsersPeriod, setTopUsersPeriod] = useState("all");
  const [topSongsSearch, setTopSongsSearch] = useState("");
  const [topUsersSearch, setTopUsersSearch] = useState("");
  const [topUsersPlan, setTopUsersPlan] = useState("all");
  const [topSongsSort, setTopSongsSort] = useState("plays_desc");
  const [topUsersSort, setTopUsersSort] = useState("plays_desc");
  const [paymentsReport, setPaymentsReport] = useState([]);
  const [paymentsFilter, setPaymentsFilter] = useState("all");
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsPlan, setPaymentsPlan] = useState("all");
  const [paymentsSort, setPaymentsSort] = useState("created_desc");
  const [subscriptionsReport, setSubscriptionsReport] = useState([]);
  const [subscriptionsFilter, setSubscriptionsFilter] = useState("all");
  const [subscriptionsSearch, setSubscriptionsSearch] = useState("");
  const [subscriptionsPlan, setSubscriptionsPlan] = useState("all");
  const [subscriptionsExpiringDays, setSubscriptionsExpiringDays] = useState("0");
  const [subscriptionsSort, setSubscriptionsSort] = useState("updated_desc");
  const [subscriptionAlerts, setSubscriptionAlerts] = useState([]);
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationType, setNotificationType] = useState("all");
  const [reportLoading, setReportLoading] = useState(false);
  const [revenueSummary, setRevenueSummary] = useState({
    revenue: { all: 0, week: 0, month: 0 },
    payments_by_status: { pending: 0, paid: 0, failed: 0 },
  });
  const [revenueHistory, setRevenueHistory] = useState([]);
  const navigate = useNavigate();

  const authHeaders = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };

  const buildQuery = (params) => new URLSearchParams(params).toString();

  const downloadCsv = async (path, filename) => {
    const res = await authFetch(`${API_BASE}${path}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`Failed to export ${filename}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const loadOverview = () => {
    authFetch(`${API_BASE}/api/database/overview`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setOverview)
      .catch((err) => {
        console.error("Failed to fetch overview:", err);
        setOverview({});
      });

    authFetch(`${API_BASE}/api/database/dashboard-metrics`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setDashboardMetrics)
      .catch((err) => {
        console.error("Failed to fetch dashboard metrics:", err);
        setDashboardMetrics({});
      });
  };

  const loadTopSongs = (period = topSongsPeriod) => {
    const query = buildQuery({ period, search: topSongsSearch, sort: topSongsSort, limit: 100 });
    setReportLoading(true);
    authFetch(`${API_BASE}/api/database/top-songs?${query}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setTopSongs(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch top songs:", err);
        setTopSongs([]);
      })
      .finally(() => setReportLoading(false));
  };

  const loadActivityLogs = () => {
    authFetch(`${API_BASE}/api/database/activity-logs`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setActivityLogs)
      .catch((err) => {
        console.error("Failed to fetch activity logs:", err);
        setActivityLogs([]);
      });
  };

  const loadTopUsers = () => {
    const query = buildQuery({ period: topUsersPeriod, search: topUsersSearch, plan: topUsersPlan, sort: topUsersSort, limit: 100 });
    setReportLoading(true);
    authFetch(`${API_BASE}/api/database/top-users?${query}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setTopUsers(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch top users:", err);
        setTopUsers([]);
      })
      .finally(() => setReportLoading(false));
  };

  const loadRevenueSummary = () => {
    authFetch(`${API_BASE}/api/database/revenue-summary`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setRevenueSummary)
      .catch((err) => {
        console.error("Failed to fetch revenue summary:", err);
        setRevenueSummary({
          revenue: { all: 0, week: 0, month: 0 },
          payments_by_status: { pending: 0, paid: 0, failed: 0 },
        });
      });
  };

  const loadRevenueHistory = () => {
    authFetch(`${API_BASE}/api/database/revenue-history`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setRevenueHistory(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch revenue history:", err);
        setRevenueHistory([]);
      });
  };

  const loadSubscriptionsReport = (status = subscriptionsFilter) => {
    const query = buildQuery({
      status,
      search: subscriptionsSearch,
      plan: subscriptionsPlan,
      expiring_days: subscriptionsExpiringDays,
      sort: subscriptionsSort,
      limit: 100,
    });
    setReportLoading(true);
    authFetch(`${API_BASE}/api/database/subscriptions-report?${query}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setSubscriptionsReport(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch subscriptions report:", err);
        setSubscriptionsReport([]);
      })
      .finally(() => setReportLoading(false));
  };

  const loadSubscriptionAlerts = () => {
    authFetch(`${API_BASE}/api/database/subscription-alerts`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setSubscriptionAlerts(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch subscription alerts:", err);
        setSubscriptionAlerts([]);
      });
  };

  const loadPaymentsReport = (status = paymentsFilter) => {
    const query = buildQuery({ status, search: paymentsSearch, plan: paymentsPlan, sort: paymentsSort, limit: 100 });
    setReportLoading(true);
    authFetch(`${API_BASE}/api/database/payments-report?${query}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setPaymentsReport(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch payments report:", err);
        setPaymentsReport([]);
      })
      .finally(() => setReportLoading(false));
  };

  const loadNotificationLogs = () => {
    const query = buildQuery({ event_type: notificationType, search: notificationSearch, limit: 100 });
    setReportLoading(true);
    authFetch(`${API_BASE}/api/database/notification-logs?${query}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((payload) => setNotificationLogs(payload.items || []))
      .catch((err) => {
        console.error("Failed to fetch notification logs:", err);
        setNotificationLogs([]);
      })
      .finally(() => setReportLoading(false));
  };

  const loadTableData = () => {
    if (!selectedTable || selectedTable === OVERVIEW_KEY || selectedTable === TOP_SONGS_KEY || selectedTable === TOP_USERS_KEY || selectedTable === PAYMENTS_KEY || selectedTable === SUBSCRIPTIONS_KEY || selectedTable === NOTIFICATIONS_KEY) return;

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((rows) => {
        setData(rows);
        setEditedRows({});
      })
      .catch((err) => {
        console.error("Failed to load table data:", err);
        setData([]);
        setEditedRows({});
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    try {
      const roles = jwtDecode(token)?.roles || [];
      if (!roles.includes("admin")) {
        navigate("/");
      }
    } catch {
      navigate("/signin");
    }
  }, [navigate]);

  useEffect(() => {
    authFetch(`${API_BASE}/api/database/tables`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((fetchedTables) => {
        if (Array.isArray(fetchedTables)) setTables(fetchedTables);
        else throw new Error("Tables response is not an array");
      })
      .catch((err) => {
        console.error("Failed to load tables:", err);
        setTables([]);
      });
  }, []);

  useEffect(() => {
    loadOverview();
    loadActivityLogs();
    loadTopSongs("all");
    loadTopUsers();
    loadPaymentsReport("all");
    loadRevenueSummary();
    loadRevenueHistory();
    loadSubscriptionsReport("all");
    loadSubscriptionAlerts();
    loadNotificationLogs();
  }, []);

  useEffect(() => {
    if (selectedTable === TOP_SONGS_KEY) {
      loadTopSongs(topSongsPeriod);
      return;
    }

    if (selectedTable === TOP_USERS_KEY) {
      loadTopUsers();
      return;
    }

    if (selectedTable === PAYMENTS_KEY) {
      loadPaymentsReport(paymentsFilter);
      return;
    }

    if (selectedTable === SUBSCRIPTIONS_KEY) {
      loadSubscriptionsReport(subscriptionsFilter);
      loadSubscriptionAlerts();
      return;
    }

    if (selectedTable === NOTIFICATIONS_KEY) {
      loadNotificationLogs();
      return;
    }

    if (!selectedTable || selectedTable === OVERVIEW_KEY) return;

    loadTableData();
    authFetch(`${API_BASE}/api/database/tables/${selectedTable}/schema`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((loadedSchema) => {
        if (Array.isArray(loadedSchema)) {
          setSchema(loadedSchema);
          const pk = loadedSchema.find((col) => col.is_primary)?.name || loadedSchema[0]?.name;
          setPrimaryKey(pk);
        } else {
          throw new Error("Schema is not an array");
        }
      })
      .catch((err) => {
        console.error("Failed to load schema:", err);
        setSchema([]);
        setPrimaryKey(null);
      });
  }, [
    selectedTable,
    topSongsPeriod,
    topSongsSearch,
    topSongsSort,
    topUsersPeriod,
    topUsersSearch,
    topUsersPlan,
    topUsersSort,
    paymentsFilter,
    paymentsSearch,
    paymentsPlan,
    paymentsSort,
    subscriptionsFilter,
    subscriptionsSearch,
    subscriptionsPlan,
    subscriptionsExpiringDays,
    subscriptionsSort,
    notificationType,
    notificationSearch,
  ]);

  const handleQuickToggleStatus = async (row) => {
    if (!primaryKey || typeof row.is_active !== "boolean") return;

    await authFetch(`${API_BASE}/api/database/tables/${selectedTable}/${row[primaryKey]}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        ...row,
        is_active: !row.is_active,
      }),
    });

    loadTableData();
    loadOverview();
  };

  const getEditableRowKey = (row, index) => {
    const keyValue = primaryKey ? row[primaryKey] : undefined;
    return keyValue ?? `row-${index}`;
  };

  const getEditedValue = (row, rowKey, columnName) => {
    if (editedRows[rowKey] && Object.prototype.hasOwnProperty.call(editedRows[rowKey], columnName)) {
      return editedRows[rowKey][columnName];
    }
    return row[columnName];
  };

  const handleEditableFieldChange = (rowKey, columnName, value) => {
    setEditedRows((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [columnName]: value,
      },
    }));
  };

  const normalizeEditableValue = (value, columnType) => {
    if (value === "") return null;
    const type = columnType.toLowerCase();
    if (type.includes("integer") || type.includes("numeric") || type.includes("double") || type.includes("real")) {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  };

  const handleSaveRow = async (row, rowKey) => {
    if (!primaryKey) return;

    const changes = editedRows[rowKey] || {};
    const normalizedChanges = Object.fromEntries(
      Object.entries(changes).map(([columnName, value]) => {
        const column = schema.find((col) => col.name === columnName);
        return [columnName, normalizeEditableValue(value, column?.type || "")];
      })
    );

    setSavingRowKey(rowKey);
    await authFetch(`${API_BASE}/api/database/tables/${selectedTable}/${row[primaryKey]}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        ...row,
        ...normalizedChanges,
      }),
    });
    setSavingRowKey(null);
    loadTableData();
    loadOverview();
  };

  const handleUploadApproval = async (trackId, status) => {
    let rejectionReason = "";
    if (status === "rejected") {
      rejectionReason = window.prompt("Tell the artist what needs to change before resubmitting.") || "";
      if (!rejectionReason.trim()) return;
    }

    await authFetch(`${API_BASE}/api/music/artist/uploads/${trackId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    });

    loadTableData();
    loadOverview();
  };

  const isAutoGeneratedField = (columnName) => {
    const autoGeneratedFields = ["id", "created_at", "updated_at", "timestamp"];
    return autoGeneratedFields.includes(columnName.toLowerCase());
  };
  const renderEditableCell = (row, rowKey, col) => {
    const value = getEditedValue(row, rowKey, col.name);
    const inputValue = value ?? "";
    const isReadOnly = isAutoGeneratedField(col.name) || col.is_primary;
    const type = col.type.toLowerCase();

    if (isReadOnly) {
      return (
        <input
          className="crud-cell-input read-only"
          value={formatFriendlyValue(col.name, inputValue)}
          readOnly
          title="Database-generated field"
        />
      );
    }

    if (col.name === "approval_status") {
      return (
        <select
          className="crud-cell-input"
          value={value || "pending"}
          onChange={(e) => handleEditableFieldChange(rowKey, col.name, e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      );
    }

    if (type.includes("boolean")) {
      const labels = col.name === "is_active"
        ? ["Visible", "Hidden"]
        : col.name === "is_muted"
          ? ["Muted", "Can post"]
          : ["Yes", "No"];
      return (
        <select
          className="crud-cell-input"
          value={String(Boolean(value))}
          onChange={(e) => handleEditableFieldChange(rowKey, col.name, e.target.value === "true")}
        >
          <option value="true">{labels[0]}</option>
          <option value="false">{labels[1]}</option>
        </select>
      );
    }

    if (type.includes("text") || String(inputValue).length > 80) {
      return (
        <textarea
          className="crud-cell-input crud-cell-textarea"
          value={inputValue}
          onChange={(e) => handleEditableFieldChange(rowKey, col.name, e.target.value)}
        />
      );
    }

    return (
      <input
        className="crud-cell-input"
        type={type.includes("integer") || type.includes("numeric") || type.includes("double") || type.includes("real") ? "number" : "text"}
        value={inputValue}
        onChange={(e) => handleEditableFieldChange(rowKey, col.name, e.target.value)}
      />
    );
  };
  const supportsQuickStatusToggle = schema.some((col) => col.name === "is_active");

  const revenueBars = [
    { key: "all", label: "All Time", value: revenueSummary.revenue?.all || 0 },
    { key: "month", label: "30 Days", value: revenueSummary.revenue?.month || 0 },
    { key: "week", label: "7 Days", value: revenueSummary.revenue?.week || 0 },
  ];
  const maxRevenue = Math.max(...revenueBars.map((item) => item.value), 1);
  const paymentStatusEntries = [
    { key: "paid", label: "Paid", value: revenueSummary.payments_by_status?.paid || 0 },
    { key: "pending", label: "Pending", value: revenueSummary.payments_by_status?.pending || 0 },
    { key: "failed", label: "Failed", value: revenueSummary.payments_by_status?.failed || 0 },
  ];
  const totalPaymentStatuses = paymentStatusEntries.reduce((sum, item) => sum + item.value, 0) || 1;
  const maxRevenueHistory = Math.max(...revenueHistory.map((item) => item.revenue || 0), 1);

  const renderReportToolbar = (children) => (
    <div className="report-toolbar">
      {children}
      {reportLoading && <span className="report-loading">Loading...</span>}
    </div>
  );

  const handleSubscriptionAction = async (subscriptionId, action) => {
    await authFetch(`${API_BASE}/api/database/subscriptions/${subscriptionId}/${action}`, {
      method: "POST",
      headers: authHeaders,
    });
    loadSubscriptionsReport(subscriptionsFilter);
    loadSubscriptionAlerts();
    loadNotificationLogs();
    loadOverview();
  };

  const tableGroups = categorizeTables(tables);

  const overviewMetricGroups = [
    {
      title: "Catalog",
      metrics: [
        { label: "Songs", value: overview.songs },
        { label: "Active Songs", value: dashboardMetrics.active_songs },
        { label: "Inactive Songs", value: dashboardMetrics.inactive_songs },
        { label: "Albums", value: overview.albums },
        { label: "Artists", value: overview.artists },
        { label: "Playlists", value: overview.playlists },
      ],
    },
    {
      title: "Users",
      metrics: [
        { label: "Users", value: overview.users },
        { label: "Free Users", value: dashboardMetrics.free_users },
        { label: "Premium Users", value: dashboardMetrics.premium_users },
        { label: "Active Subs", value: dashboardMetrics.active_subscriptions },
        { label: "Expiring Soon", value: dashboardMetrics.expiring_subscriptions },
      ],
    },
    {
      title: "Payments",
      metrics: [
        { label: "Payments", value: dashboardMetrics.total_payments },
        { label: "Revenue", value: dashboardMetrics.total_revenue?.toLocaleString?.("vi-VN") ?? dashboardMetrics.total_revenue },
        { label: "Success Rate", value: dashboardMetrics.payment_success_rate != null ? `${dashboardMetrics.payment_success_rate}%` : undefined },
        { label: "Pending", value: dashboardMetrics.pending_payments },
        { label: "Failed", value: dashboardMetrics.failed_payments },
      ],
    },
  ];

  const renderSidebarSection = (section) => (
    <div className="nav-section" key={section.title}>
      <div className="nav-section-title">{section.title}</div>
      <ul>
        {section.items.map((item) => (
          <li
            key={item.key}
            className={selectedTable === item.key ? "active" : ""}
            onClick={() => setSelectedTable(item.key)}
          >
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderOverview = () => (
    <div className="overview">
      <h2>Overview</h2>
      <div className="overview-groups">
        {overviewMetricGroups.map((group) => (
          <section className="metric-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="metric-grid">
              {group.metrics.map((metric) => (
                <div className="metric-tile" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value ?? "..."}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Recent Activity</h2>
        <div className="data-table" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.length === 0 ? (
                <tr><td colSpan="5">No activity recorded yet.</td></tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.username || "Unknown"}</td>
                    <td>{log.action}</td>
                    <td>{[log.target_type, log.target_id].filter(Boolean).join(": ") || "-"}</td>
                    <td>{log.details || "-"}</td>
                    <td>{log.created_at || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Top Songs Snapshot</h2>
        <div className="data-table" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Track</th>
                <th>Artist</th>
                <th>Plays</th>
              </tr>
            </thead>
            <tbody>
              {topSongs.length === 0 ? (
                <tr><td colSpan="4">No listening data yet.</td></tr>
              ) : (
                topSongs.slice(0, 5).map((song, index) => (
                  <tr key={`${song.track_name}-${index}`}>
                    <td>#{song.rank || index + 1}</td>
                    <td>{song.track_name}</td>
                    <td>{song.artist_name}</td>
                    <td>{song.play_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Top Active Users</h2>
        <div className="data-table" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Plays</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.length === 0 ? (
                <tr><td colSpan="3">No listening data yet.</td></tr>
              ) : (
                topUsers.map((user, index) => (
                  <tr key={`${user.username}-${index}`}>
                    <td>{user.username}</td>
                    <td>{user.account_type}</td>
                    <td>{user.play_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Revenue Snapshot</h2>
        <div className="mini-chart-grid">
          {revenueBars.map((item) => (
            <div className="mini-chart-card" key={item.key}>
              <div className="mini-chart-label">{item.label}</div>
              <div className="mini-chart-bar">
                <div
                  className="mini-chart-fill"
                  style={{ width: `${Math.max((item.value / maxRevenue) * 100, item.value > 0 ? 8 : 0)}%` }}
                />
              </div>
              <div className="mini-chart-value">{item.value.toLocaleString("vi-VN")} VND</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Payments by Status</h2>
        <div className="mini-chart-grid">
          {paymentStatusEntries.map((item) => (
            <div className="mini-chart-card" key={item.key}>
              <div className="mini-chart-label">{item.label}</div>
              <div className="mini-chart-bar">
                <div
                  className={`mini-chart-fill mini-chart-fill--${item.key}`}
                  style={{ width: `${Math.max((item.value / totalPaymentStatuses) * 100, item.value > 0 ? 8 : 0)}%` }}
                />
              </div>
              <div className="mini-chart-value">{item.value} payment(s)</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Monthly Revenue History</h2>
        <div className="history-chart">
          {revenueHistory.length === 0 ? (
            <div className="empty-report">
              <h3>No paid revenue yet</h3>
              <p>Revenue bars will appear here after successful paid transactions.</p>
            </div>
          ) : (
            revenueHistory.map((item) => (
              <div className="history-bar-card" key={item.month}>
                <div className="history-bar-label">{item.month}</div>
                <div className="history-bar-track">
                  <div
                    className="history-bar-fill"
                    style={{ height: `${Math.max((item.revenue / maxRevenueHistory) * 140, item.revenue > 0 ? 18 : 0)}px` }}
                  />
                </div>
                <div className="history-bar-value">{item.revenue.toLocaleString("vi-VN")}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderTopSongsReport = () => (
    <div className="overview">
      <div className="report-header">
        <div>
          <h2>Top Songs Ranking</h2>
          <p className="report-subtitle">Top 10 listening report by timeframe for admin review and business reporting.</p>
        </div>
        <div className="period-switcher">
          {Object.keys(PERIOD_LABELS).map((period) => (
            <button
              key={period}
              type="button"
              className={`period-button ${topSongsPeriod === period ? "active" : ""}`}
              onClick={() => setTopSongsPeriod(period)}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>
      </div>

      {renderReportToolbar(
        <>
          <input
            value={topSongsSearch}
            onChange={(e) => setTopSongsSearch(e.target.value)}
            placeholder="Search track or artist"
          />
          <select value={topSongsSort} onChange={(e) => setTopSongsSort(e.target.value)}>
            <option value="plays_desc">Most played</option>
            <option value="plays_asc">Least played</option>
            <option value="track_asc">Track A-Z</option>
            <option value="track_desc">Track Z-A</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(`/api/database/top-songs/export?${buildQuery({ period: topSongsPeriod, search: topSongsSearch, sort: topSongsSort })}`, "top-songs.csv")}
          >
            Export CSV
          </button>
        </>
      )}

      <div className="top-songs-hero">
        <div className="hero-card hero-card--primary">
          <span className="hero-label">Period</span>
          <strong>{PERIOD_LABELS[topSongsPeriod]}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Ranked Tracks</span>
          <strong>{topSongs.length}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Top Play Count</span>
          <strong>{topSongs[0]?.play_count ?? 0}</strong>
        </div>
      </div>

      <div className="ranking-board">
        {topSongs.length === 0 ? (
          <div className="empty-report">
            <h3>No listening data yet</h3>
            <p>Let users play some tracks, then this report will populate automatically.</p>
          </div>
        ) : (
          topSongs.map((song) => (
            <div className="ranking-row" key={`${topSongsPeriod}-${song.rank}-${song.track_name}`}>
              <div className="ranking-rank">#{song.rank}</div>
              <div className="ranking-main">
                <div className="ranking-title">{song.track_name}</div>
                <div className="ranking-subtitle">{song.artist_name}</div>
              </div>
              <div className="ranking-metric">
                <span className="metric-value">{song.play_count}</span>
                <span className="metric-label">plays</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="data-table" style={{ overflowX: "auto", marginTop: "28px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Track</th>
              <th>Artist</th>
              <th>Plays</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {topSongs.length === 0 ? (
              <tr><td colSpan="5">No listening data yet.</td></tr>
            ) : (
              topSongs.map((song) => (
                <tr key={`table-${topSongsPeriod}-${song.rank}-${song.track_name}`}>
                  <td>#{song.rank}</td>
                  <td>{song.track_name}</td>
                  <td>{song.artist_name}</td>
                  <td>{song.play_count}</td>
                  <td>{PERIOD_LABELS[topSongsPeriod]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPaymentsReport = () => (
    <div className="overview">
      <div className="report-header">
        <div>
          <h2>Payments Management</h2>
          <p className="report-subtitle">Operational transaction view with status filtering for billing review.</p>
        </div>
        <div className="period-switcher">
          {["all", "pending", "paid", "failed"].map((status) => (
            <button
              key={status}
              type="button"
              className={`period-button ${paymentsFilter === status ? "active" : ""}`}
              onClick={() => setPaymentsFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {renderReportToolbar(
        <>
          <input
            value={paymentsSearch}
            onChange={(e) => setPaymentsSearch(e.target.value)}
            placeholder="Search username or note"
          />
          <select value={paymentsPlan} onChange={(e) => setPaymentsPlan(e.target.value)}>
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select value={paymentsSort} onChange={(e) => setPaymentsSort(e.target.value)}>
            <option value="created_desc">Newest</option>
            <option value="created_asc">Oldest</option>
            <option value="amount_desc">Highest amount</option>
            <option value="amount_asc">Lowest amount</option>
            <option value="status_asc">Status A-Z</option>
            <option value="status_desc">Status Z-A</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(`/api/database/payments-report/export?${buildQuery({ status: paymentsFilter, search: paymentsSearch, plan: paymentsPlan, sort: paymentsSort })}`, "payments.csv")}
          >
            Export CSV
          </button>
        </>
      )}

      <div className="top-songs-hero">
        <div className="hero-card hero-card--primary">
          <span className="hero-label">Current Filter</span>
          <strong>{paymentsFilter.charAt(0).toUpperCase() + paymentsFilter.slice(1)}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Transactions</span>
          <strong>{paymentsReport.length}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Paid Revenue</span>
          <strong>
            {paymentsReport
              .filter((item) => item.status === "paid")
              .reduce((sum, item) => sum + (item.amount || 0), 0)
              .toLocaleString("vi-VN")}
          </strong>
        </div>
      </div>

      <div className="data-table" style={{ overflowX: "auto", marginTop: "28px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {paymentsReport.length === 0 ? (
              <tr><td colSpan="8">No payments found for this filter.</td></tr>
            ) : (
              paymentsReport.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.username || "-"}</td>
                  <td>{payment.plan_name || "-"}</td>
                  <td>{payment.amount?.toLocaleString?.("vi-VN")} {payment.currency}</td>
                  <td>{payment.provider}</td>
                  <td>{payment.status}</td>
                  <td>{payment.created_at || "-"}</td>
                  <td>{payment.updated_at || "-"}</td>
                  <td>{payment.note || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSubscriptionsReport = () => (
    <div className="overview">
      <div className="report-header">
        <div>
          <h2>Subscriptions Management</h2>
          <p className="report-subtitle">Track active, pending, expired, and cancelled subscriptions with expiring-soon alerts.</p>
        </div>
        <div className="period-switcher">
          {["all", "active", "pending_payment", "cancelled", "expired"].map((status) => (
            <button
              key={status}
              type="button"
              className={`period-button ${subscriptionsFilter === status ? "active" : ""}`}
              onClick={() => setSubscriptionsFilter(status)}
            >
              {status === "pending_payment" ? "Pending" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {renderReportToolbar(
        <>
          <input
            value={subscriptionsSearch}
            onChange={(e) => setSubscriptionsSearch(e.target.value)}
            placeholder="Search username"
          />
          <select value={subscriptionsPlan} onChange={(e) => setSubscriptionsPlan(e.target.value)}>
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select value={subscriptionsExpiringDays} onChange={(e) => setSubscriptionsExpiringDays(e.target.value)}>
            <option value="0">Any expiry</option>
            <option value="3">Expires in 3 days</option>
            <option value="7">Expires in 7 days</option>
          </select>
          <select value={subscriptionsSort} onChange={(e) => setSubscriptionsSort(e.target.value)}>
            <option value="updated_desc">Recently updated</option>
            <option value="updated_asc">Oldest update</option>
            <option value="expires_asc">Expiry soonest</option>
            <option value="expires_desc">Expiry latest</option>
            <option value="username_asc">Username A-Z</option>
            <option value="username_desc">Username Z-A</option>
            <option value="status_asc">Status A-Z</option>
            <option value="status_desc">Status Z-A</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(`/api/database/subscriptions-report/export?${buildQuery({ status: subscriptionsFilter, search: subscriptionsSearch, plan: subscriptionsPlan, expiring_days: subscriptionsExpiringDays, sort: subscriptionsSort })}`, "subscriptions.csv")}
          >
            Export CSV
          </button>
        </>
      )}

      <div className="top-songs-hero">
        <div className="hero-card hero-card--primary">
          <span className="hero-label">Current Filter</span>
          <strong>{subscriptionsFilter === "pending_payment" ? "Pending" : subscriptionsFilter.charAt(0).toUpperCase() + subscriptionsFilter.slice(1)}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Subscriptions</span>
          <strong>{subscriptionsReport.length}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Expiring Soon</span>
          <strong>{subscriptionAlerts.length}</strong>
        </div>
      </div>

      <div style={{ marginTop: "28px" }}>
        <h2>Expiring Soon Alerts</h2>
        <div className="alert-list">
          {subscriptionAlerts.length === 0 ? (
            <div className="empty-report">
              <h3>No expiring subscriptions</h3>
              <p>No mock email alerts are needed right now.</p>
            </div>
          ) : (
            subscriptionAlerts.map((alert, index) => (
              <div className="alert-card" key={`${alert.email}-${index}`}>
                <div className="alert-header">
                  <strong>{alert.username}</strong>
                  <span>{alert.plan_name}</span>
                </div>
                <p>{alert.notification_preview}</p>
                <small>Expires at: {alert.expires_at}</small>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="data-table" style={{ overflowX: "auto", marginTop: "28px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Auto Renew</th>
              <th>Started</th>
              <th>Expires</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptionsReport.length === 0 ? (
              <tr><td colSpan="8">No subscriptions found for this filter.</td></tr>
            ) : (
              subscriptionsReport.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.username || "-"}</td>
                  <td>{subscription.plan_name || subscription.plan_code || "-"}</td>
                  <td>{subscription.status}</td>
                  <td>{subscription.auto_renew ? "Enabled" : "Disabled"}</td>
                  <td>{subscription.started_at || "-"}</td>
                  <td>{subscription.expires_at || "-"}</td>
                  <td>{subscription.updated_at || "-"}</td>
                  <td>
                    <button type="button" onClick={() => handleSubscriptionAction(subscription.id, "renew")}>Renew</button>
                    <button type="button" onClick={() => handleSubscriptionAction(subscription.id, "toggle-auto-renew")}>Auto</button>
                    <button type="button" onClick={() => handleSubscriptionAction(subscription.id, "cancel")}>Cancel</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTopUsersReport = () => (
    <div className="overview">
      <div className="report-header">
        <div>
          <h2>Top Users Ranking</h2>
          <p className="report-subtitle">User activity report by listening volume and timeframe.</p>
        </div>
        <div className="period-switcher">
          {Object.keys(PERIOD_LABELS).map((period) => (
            <button
              key={period}
              type="button"
              className={`period-button ${topUsersPeriod === period ? "active" : ""}`}
              onClick={() => setTopUsersPeriod(period)}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>
      </div>

      {renderReportToolbar(
        <>
          <input
            value={topUsersSearch}
            onChange={(e) => setTopUsersSearch(e.target.value)}
            placeholder="Search username"
          />
          <select value={topUsersPlan} onChange={(e) => setTopUsersPlan(e.target.value)}>
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select value={topUsersSort} onChange={(e) => setTopUsersSort(e.target.value)}>
            <option value="plays_desc">Most played</option>
            <option value="plays_asc">Least played</option>
            <option value="username_asc">Username A-Z</option>
            <option value="username_desc">Username Z-A</option>
            <option value="plan_asc">Plan A-Z</option>
            <option value="plan_desc">Plan Z-A</option>
          </select>
          <button
            type="button"
            onClick={() => downloadCsv(`/api/database/top-users/export?${buildQuery({ period: topUsersPeriod, search: topUsersSearch, plan: topUsersPlan, sort: topUsersSort })}`, "top-users.csv")}
          >
            Export CSV
          </button>
        </>
      )}

      <div className="top-songs-hero">
        <div className="hero-card hero-card--primary">
          <span className="hero-label">Period</span>
          <strong>{PERIOD_LABELS[topUsersPeriod]}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Ranked Users</span>
          <strong>{topUsers.length}</strong>
        </div>
        <div className="hero-card">
          <span className="hero-label">Top Plays</span>
          <strong>{topUsers[0]?.play_count ?? 0}</strong>
        </div>
      </div>

      <div className="ranking-board">
        {topUsers.length === 0 ? (
          <div className="empty-report">
            <h3>No user activity yet</h3>
            <p>Ask users to listen to some tracks to populate this report.</p>
          </div>
        ) : (
          topUsers.map((user) => (
            <div className="ranking-row" key={`${topUsersPeriod}-${user.rank}-${user.username}`}>
              <div className="ranking-rank">#{user.rank}</div>
              <div className="ranking-main">
                <div className="ranking-title">{user.username}</div>
                <div className="ranking-subtitle">{user.account_type}</div>
              </div>
              <div className="ranking-metric">
                <span className="metric-value">{user.play_count}</span>
                <span className="metric-label">plays</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="data-table" style={{ overflowX: "auto", marginTop: "28px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Plan</th>
              <th>Plays</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {topUsers.length === 0 ? (
              <tr><td colSpan="5">No user activity yet.</td></tr>
            ) : (
              topUsers.map((user) => (
                <tr key={`table-${topUsersPeriod}-${user.rank}-${user.username}`}>
                  <td>#{user.rank}</td>
                  <td>{user.username}</td>
                  <td>{user.account_type}</td>
                  <td>{user.play_count}</td>
                  <td>{PERIOD_LABELS[topUsersPeriod]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNotificationLogs = () => (
    <div className="overview">
      <div className="report-header">
        <div>
          <h2>Notification Logs</h2>
          <p className="report-subtitle">Internal operational history for payment, renewal, and subscription alerts.</p>
        </div>
      </div>

      {renderReportToolbar(
        <>
          <input
            value={notificationSearch}
            onChange={(e) => setNotificationSearch(e.target.value)}
            placeholder="Search user, title, or message"
          />
          <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)}>
            <option value="all">All events</option>
            <option value="payment_paid">Payment paid</option>
            <option value="payment_failed">Payment failed</option>
            <option value="auto_renew">Auto-renew</option>
            <option value="manual_renew">Manual renew</option>
            <option value="admin_renew">Admin renew</option>
            <option value="admin_cancel">Admin cancel</option>
            <option value="admin_auto_renew_toggle">Auto-renew toggle</option>
          </select>
        </>
      )}

      <div className="data-table" style={{ overflowX: "auto", marginTop: "28px" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Event</th>
              <th>Title</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {notificationLogs.length === 0 ? (
              <tr><td colSpan="6">No notification history yet.</td></tr>
            ) : (
              notificationLogs.map((item) => (
                <tr key={item.id}>
                  <td>{item.created_at || "-"}</td>
                  <td>{item.username || "-"}</td>
                  <td>{item.event_type}</td>
                  <td>{item.title}</td>
                  <td>{item.message}</td>
                  <td>{item.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCrudTable = () => (
    <>
      <h2>{`Manage ${formatTableName(selectedTable)}`}</h2>
      <p className="crud-table-note">
        Table data is loaded from PostgreSQL. Edit values in the boxes and save the row to update the database.
      </p>

      <div className="editable-table-wrap">
        <table className="data-table editable-data-table">
          <thead>
            <tr>
              {schema.map((col) => (
                <th key={col.name}>{formatColumnLabel(col.name)}</th>
              ))}
              {supportsQuickStatusToggle && <th>Status</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(data) && data.map((row, i) => {
              const rowKey = getEditableRowKey(row, i);
              const hasChanges = Boolean(editedRows[rowKey] && Object.keys(editedRows[rowKey]).length);

              return (
                <tr key={rowKey}>
                  {schema.map((col) => (
                    <td key={col.name}>
                      {renderEditableCell(row, rowKey, col)}
                    </td>
                  ))}
                  {supportsQuickStatusToggle && (
                    <td>
                      <span className={`visibility-badge ${row.is_active ? "visible" : "hidden"}`}>
                        {row.is_active ? "Visible" : "Hidden"}
                      </span>
                    </td>
                  )}
                  <td>
                    <button
                      onClick={() => handleSaveRow(row, rowKey)}
                      disabled={!hasChanges || savingRowKey === rowKey}
                    >
                      {savingRowKey === rowKey ? "Saving" : "Save"}
                    </button>
                    {supportsQuickStatusToggle && typeof row.is_active === "boolean" && (
                      <button
                        onClick={() => handleQuickToggleStatus(row)}
                        title={row.is_active ? "Hide from listeners" : "Show to listeners"}
                        style={{
                          marginLeft: "6px",
                          backgroundColor: row.is_active ? "#8b1e1e" : "#1f6f3d",
                          color: "#fff",
                        }}
                      >
                        {row.is_active ? "Hide" : "Show"}
                      </button>
                    )}
                    {selectedTable === "songs" && row.approval_status && (
                      <>
                        <button onClick={() => handleUploadApproval(row[primaryKey], "approved")}>Approve</button>
                        <button onClick={() => handleUploadApproval(row[primaryKey], "rejected")}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="admin-crud">
      <aside className="sidebar">
        <button className="home-button" onClick={() => navigate("/")}>
          <FaArrowLeft style={{ marginRight: "6px" }} />
          Back to Home
        </button>
        <h2>Admin Views</h2>
        <nav className="admin-nav">
          <div className="nav-section">
            <div className="nav-section-title">Music Workflow</div>
            <ul>
              <li onClick={() => navigate("/admin/songs")}>
                <span>Song Review</span>
              </li>
              <li onClick={() => navigate("/admin/moderation")}>
                <span>User & Artist Moderation</span>
              </li>
            </ul>
          </div>
          {ADMIN_VIEW_GROUPS.map(renderSidebarSection)}
          {tableGroups.map(renderSidebarSection)}
        </nav>
      </aside>

      <main className="main">
        <h1>Admin Database</h1>
        {selectedTable === OVERVIEW_KEY
          ? renderOverview()
          : selectedTable === TOP_SONGS_KEY
            ? renderTopSongsReport()
            : selectedTable === TOP_USERS_KEY
              ? renderTopUsersReport()
            : selectedTable === PAYMENTS_KEY
              ? renderPaymentsReport()
            : selectedTable === SUBSCRIPTIONS_KEY
              ? renderSubscriptionsReport()
            : selectedTable === NOTIFICATIONS_KEY
              ? renderNotificationLogs()
            : selectedTable
              ? renderCrudTable()
              : <p>...</p>}
      </main>
    </div>
  );
};

export default AdminCrud;
