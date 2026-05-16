import React, { useEffect, useState } from "react";
import "../styles/MainContent/AdminCrud.css";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const AdminCrud = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("__overview__");
  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [overview, setOverview] = useState({});
  const [dashboardMetrics, setDashboardMetrics] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [topSongs, setTopSongs] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const navigate = useNavigate();

  const authHeaders = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
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

  const loadTableData = () => {
    if (!selectedTable || selectedTable === "__overview__") return;

    authFetch(`${API_BASE}/api/database/tables/${selectedTable}`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setData)
      .catch((err) => {
        console.error("Failed to load table data:", err);
        setData([]);
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
  }, []);

  useEffect(() => {
    authFetch(`${API_BASE}/api/database/activity-logs`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setActivityLogs)
      .catch((err) => {
        console.error("Failed to fetch activity logs:", err);
        setActivityLogs([]);
      });

    authFetch(`${API_BASE}/api/database/top-songs`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setTopSongs)
      .catch((err) => {
        console.error("Failed to fetch top songs:", err);
        setTopSongs([]);
      });

    authFetch(`${API_BASE}/api/database/top-users`, {
      headers: authHeaders,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setTopUsers)
      .catch((err) => {
        console.error("Failed to fetch top users:", err);
        setTopUsers([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedTable || selectedTable === "__overview__") return;

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
  }, [selectedTable]);

  const handleChange = (e, name) => {
    const schemaColumn = schema.find((col) => col.name === name);
    let value = e.target.value;

    if (schemaColumn?.type === "boolean") {
      value = value === "true";
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanedFormData = { ...formData };
    if (editingId && primaryKey) delete cleanedFormData[primaryKey];

    const url = `${API_BASE}/api/database/tables/${selectedTable}${editingId ? `/${editingId}` : ""}`;
    const method = editingId ? "PUT" : "POST";

    await authFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(cleanedFormData),
    });

    setFormData({});
    setEditingId(null);
    loadTableData();
    loadOverview();
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row[primaryKey]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;

    await authFetch(`${API_BASE}/api/database/tables/${selectedTable}/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    loadTableData();
    loadOverview();
  };

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
    setEditingId(null);
    setFormData({});
  };

  const isAutoGeneratedField = (columnName) => {
    const autoGeneratedFields = ["id", "created_at", "updated_at", "timestamp"];
    return autoGeneratedFields.includes(columnName.toLowerCase());
  };

  const isDisabledField = (columnName) => {
    return editingId && isAutoGeneratedField(columnName);
  };

  const renderInputField = (col) => {
    const isDisabled = isDisabledField(col.name);
    const value = formData[col.name];

    if (col.type === "boolean") {
      return (
        <select
          key={col.name}
          name={col.name}
          value={value === true ? "true" : value === false ? "false" : "true"}
          onChange={(e) => handleChange(e, col.name)}
          disabled={isDisabled}
          style={isDisabled ? {
            backgroundColor: "#f5f5f5",
            color: "#666",
            cursor: "not-allowed",
          } : {}}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    return (
      <input
        key={col.name}
        name={col.name}
        value={value || ""}
        onChange={(e) => handleChange(e, col.name)}
        placeholder={isDisabled ? `${col.name} (auto-generated)` : col.name}
        disabled={isDisabled}
        style={isDisabled ? {
          backgroundColor: "#f5f5f5",
          color: "#666",
          cursor: "not-allowed",
        } : {}}
      />
    );
  };

  const supportsQuickStatusToggle = schema.some((col) => col.name === "is_active");

  return (
    <div className="admin-crud">
      <aside className="sidebar">
        <button className="home-button" onClick={() => navigate("/")}>
          <FaArrowLeft style={{ marginRight: "6px" }} />
          Back to Home
        </button>
        <h2>📦 Tables</h2>
        <ul>
          <li
            key="__overview__"
            className={selectedTable === "__overview__" ? "active" : ""}
            onClick={() => setSelectedTable("__overview__")}
          >
            📊 Overview
          </li>

          {tables.map((table) => (
            <li
              key={table}
              className={selectedTable === table ? "active" : ""}
              onClick={() => setSelectedTable(table)}
            >
              {table}
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <h1>🛠 Admin Database</h1>

        {selectedTable === "__overview__" ? (
          <div className="overview">
            <h2>📊 Overview</h2>
            <div className="overview-cards">
              <div className="card"><h3>👤 User</h3><p>{overview.users ?? "..."}</p></div>
              <div className="card"><h3>🎵 Song</h3><p>{overview.songs ?? "..."}</p></div>
              <div className="card"><h3>✅ Active Songs</h3><p>{dashboardMetrics.active_songs ?? "..."}</p></div>
              <div className="card"><h3>⛔ Inactive Songs</h3><p>{dashboardMetrics.inactive_songs ?? "..."}</p></div>
              <div className="card"><h3>📁 Playlist</h3><p>{overview.playlists ?? "..."}</p></div>
              <div className="card"><h3>💿 Album</h3><p>{overview.albums ?? "..."}</p></div>
              <div className="card"><h3>✅ Active Albums</h3><p>{dashboardMetrics.active_albums ?? "..."}</p></div>
              <div className="card"><h3>⛔ Inactive Albums</h3><p>{dashboardMetrics.inactive_albums ?? "..."}</p></div>
              <div className="card"><h3>🎤 Artist</h3><p>{overview.artists ?? "..."}</p></div>
              <div className="card"><h3>✅ Active Artists</h3><p>{dashboardMetrics.active_artists ?? "..."}</p></div>
              <div className="card"><h3>⛔ Inactive Artists</h3><p>{dashboardMetrics.inactive_artists ?? "..."}</p></div>
              <div className="card"><h3>💳 Payments</h3><p>{dashboardMetrics.total_payments ?? "..."}</p></div>
              <div className="card"><h3>⏳ Pending Payments</h3><p>{dashboardMetrics.pending_payments ?? "..."}</p></div>
              <div className="card"><h3>❌ Failed Payments</h3><p>{dashboardMetrics.failed_payments ?? "..."}</p></div>
              <div className="card"><h3>💰 Revenue</h3><p>{dashboardMetrics.total_revenue?.toLocaleString?.("vi-VN") ?? dashboardMetrics.total_revenue ?? "..."}</p></div>
              <div className="card"><h3>🆓 Free Users</h3><p>{dashboardMetrics.free_users ?? "..."}</p></div>
              <div className="card"><h3>⭐ Premium Users</h3><p>{dashboardMetrics.premium_users ?? "..."}</p></div>
              <div className="card"><h3>📄 Active Subs</h3><p>{dashboardMetrics.active_subscriptions ?? "..."}</p></div>
            </div>

            <div style={{ marginTop: "32px" }}>
              <h2>🕒 Recent Activity</h2>
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
              <h2>🔥 Top Songs</h2>
              <div className="data-table" style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Track</th>
                      <th>Artist</th>
                      <th>Plays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSongs.length === 0 ? (
                      <tr><td colSpan="3">No listening data yet.</td></tr>
                    ) : (
                      topSongs.map((song, index) => (
                        <tr key={`${song.track_name}-${index}`}>
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
              <h2>👥 Top Active Users</h2>
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
          </div>
        ) : selectedTable ? (
          <>
            <h2>Table: {selectedTable}</h2>
            <form onSubmit={handleSubmit} className="crud-form">
              {schema
                .filter((col) => !(!editingId && isAutoGeneratedField(col.name)))
                .map(renderInputField)}
              <button type="submit">{editingId ? "Update" : "Create"}</button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({});
                  }}
                  style={{ marginLeft: "10px", backgroundColor: "#6c757d" }}
                >
                  Cancel
                </button>
              )}
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  {schema.map((col) => (
                    <th key={col.name}>{col.name}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(data) && data.map((row, i) => (
                  <tr key={i}>
                    {schema.map((col) => (
                      <td key={col.name}>
                        {isAutoGeneratedField(col.name) ? (
                          <span style={{ color: "#666", fontStyle: "italic" }}>
                            {row[col.name]}
                          </span>
                        ) : typeof row[col.name] === "boolean" ? (
                          row[col.name] ? "true" : "false"
                        ) : (
                          row[col.name]
                        )}
                      </td>
                    ))}
                    <td>
                      <button onClick={() => handleEdit(row)}>✏️</button>
                      {supportsQuickStatusToggle && typeof row.is_active === "boolean" && (
                        <button
                          onClick={() => handleQuickToggleStatus(row)}
                          title={row.is_active ? "Disable item" : "Enable item"}
                          style={{
                            marginLeft: "6px",
                            backgroundColor: row.is_active ? "#8b1e1e" : "#1f6f3d",
                            color: "#fff",
                          }}
                        >
                          {row.is_active ? "Off" : "On"}
                        </button>
                      )}
                      <button onClick={() => handleDelete(row[primaryKey])}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>...</p>
        )}
      </main>
    </div>
  );
};

export default AdminCrud;
