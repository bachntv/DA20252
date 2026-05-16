import React, { useState, useCallback, useMemo } from "react";
import "../styles/MainContent/AdminCrudExtra.css";

function CrudSection({ index }) {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");

  const handleAdd = useCallback(() => {
    if (input.trim()) setItems((prev) => [...prev, input]);
    setInput("");
  }, [input]);

  const handleRemove = useCallback((idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <div className="admincrud-extra-section">
      <h2>Admin CRUD Section {index + 1}</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add item"
        />
        <button type="submit">Add</button>
      </form>

      <table className="admincrud-extra-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{item}</td>
              <td>
                <button onClick={() => handleRemove(idx)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminCrudExtra() {
  const sections = useMemo(() => Array.from({ length: 15 }), []);

  return (
    <div className="admincrud-extra-root">
      {sections.map((_, i) => (
        <CrudSection key={i} index={i} />
      ))}
    </div>
  );
}

export default AdminCrudExtra;
